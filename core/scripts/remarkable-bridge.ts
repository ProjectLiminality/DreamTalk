/**
 * remarkable-bridge.ts — the reMarkable's pen and fingers, streamed into DreamTalk.
 *
 *   bun run studio                                  # the daemon starts this for you
 *   bun scripts/remarkable-bridge.ts                # standalone
 *   bun scripts/remarkable-bridge.ts --doctor       # ✓/✗ every step, if anything is off
 *   bun scripts/remarkable-bridge.ts --calibrate    # raw pen + touch values, live
 *   RM_HOST=192.168.1.42 bun scripts/remarkable-bridge.ts   # skip discovery
 *
 * Reads the tablet's digitizer and touchscreen over SSH and relays every
 * event to the daemon's `/ws/pen`, where the sketch page receives it as a
 * PenEvent (core/sketch/protocol.ts). Nothing is installed on the tablet.
 *
 * THE BAR: the tablet only has to be on the same Wi-Fi. So the bridge
 *
 *   FIRST TIME, once, over USB (since OS 3.22 SSH is USB-only by default):
 *     (1) ssh root@10.11.99.1 rm-ssh-over-wlan on   (2) ssh-copy-id with the
 *     bridge's key (below). Then unplug. The bridge and `--doctor` say exactly
 *     this, in this order, whenever it is what's missing.
 *
 *   FINDS it — the cached address, USB (10.11.99.1), the names `remarkable.local`
 *     and `remarkable`, then a quick parallel sweep of the Mac's own /24 for
 *     an SSH server that announces itself as dropbear (the tablet's sshd),
 *     confirmed by `/sys/devices/soc0/machine` saying "reMarkable". The winner
 *     is cached in ~/.config/dreamtalk/remarkable.json.
 *   AUTHENTICATES with its own key, ~/.config/dreamtalk/remarkable_ed25519
 *     (generated on first run), passed with -i/IdentitiesOnly and `-F
 *     /dev/null`, so David's ~/.ssh is never read or written. If the tablet
 *     refuses the key, the page is told the one command that fixes it
 *     (`status: needs-key`). No password is ever stored or typed by us.
 *   STAYS ALIVE — the tablet sleeps and its Wi-Fi drops. SSH keepalives notice
 *     a dead link within ~10 s; then `asleep`, back off 1 s → 2 s → … → 30 s,
 *     rediscover, reconnect, resume. Between attempts the last known address
 *     is knocked on every 2 s, so a waking tablet is picked up at once. One
 *     log line per state change, never one per retry.
 *
 * WHY THIS PRESERVES THE PAPER FEEL
 *
 * The reMarkable writes fast on slow e-ink through a dedicated low-latency
 * path in its own app (xochitl): the pen's trail is drawn by a fast partial
 * waveform on just the pixels under the nib. Re-implementing that is the
 * hard part of every custom reMarkable app. This bridge sidesteps it
 * entirely: reading `/dev/input/eventN` is NON-EXCLUSIVE, so xochitl keeps
 * drawing your ink at its native latency while we read the SAME events in
 * parallel. Open a blank notebook page, write, and the tablet feels exactly
 * like the tablet; the Mac receives every sample and builds the scene.
 *
 * THE TABLET'S OWN SCREEN. With dreamtalk-pad open in AppLoad
 * (tablet/dreamtalk-pad), the tablet shows the whiteboard page itself: the
 * bridge also carries the page's display list there (below, "the tablet's
 * screen"), and AppLoad's window takes the pen, so no notebook is inked.
 * Without it, the tablet shows xochitl's notebook and the reading above
 * still works — the pen is the same pen either way.
 *
 * THE WIRE FORMAT
 *
 * A Linux `input_event` is { struct timeval time; u16 type; u16 code; s32
 * value }. timeval is two longs, so the record is 16 bytes on the rM2's
 * 32-bit ARM and 24 bytes on a 64-bit kernel (reMarkable Paper Pro). The size
 * is detected from `uname -m`, not assumed.
 */

/** Event types and codes we care about (linux/input-event-codes.h). */
export const EV_SYN = 0
export const EV_KEY = 1
export const EV_ABS = 3
export const SYN_REPORT = 0
export const SYN_DROPPED = 3
export const ABS_X = 0
export const ABS_Y = 1
export const ABS_PRESSURE = 24
export const ABS_DISTANCE = 25
export const ABS_MT_SLOT = 47
export const ABS_MT_POSITION_X = 53
export const ABS_MT_POSITION_Y = 54
export const ABS_MT_TRACKING_ID = 57
export const BTN_TOOL_PEN = 320
export const BTN_TOOL_RUBBER = 321
export const BTN_TOUCH = 330
export const BTN_STYLUS = 331
export const BTN_STYLUS2 = 332

import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { connect as netConnect } from "node:net"
import { homedir, networkInterfaces } from "node:os"
import { join } from "node:path"
import { PAD_DISPLAY_PORT, PAGE_H, PAGE_W, type PenEvent, type PenSample } from "../sketch/protocol"
import { DisplayStore, parseDisplayOps, toLines } from "../sketch/display"

export interface RawEvent {
  type: number
  code: number
  value: number
  /** Kernel timestamp, ms. */
  t: number
}

/**
 * Parse as many whole input_event records as `buf` holds. Returns the events
 * and the unconsumed tail (a record can straddle two SSH reads).
 */
export const parseEvents = (
  buf: Uint8Array,
  recordSize: 16 | 24,
): { events: RawEvent[]; rest: Uint8Array } => {
  const events: RawEvent[] = []
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let off = 0
  while (off + recordSize <= buf.byteLength) {
    let sec: number
    let usec: number
    if (recordSize === 16) {
      sec = view.getUint32(off, true)
      usec = view.getUint32(off + 4, true)
    } else {
      // 64-bit longs; seconds fit comfortably in the low word for decades.
      sec = view.getUint32(off, true) + view.getUint32(off + 4, true) * 2 ** 32
      usec = view.getUint32(off + 8, true)
    }
    const body = off + recordSize - 8
    events.push({
      type: view.getUint16(body, true),
      code: view.getUint16(body + 2, true),
      value: view.getInt32(body + 4, true),
      t: sec * 1000 + usec / 1000,
    })
    off += recordSize
  }
  return { events, rest: buf.slice(off) }
}

/**
 * A sensor's raw ranges and how its axes sit against the portrait page.
 *
 * Pen (reMarkable 2): ABS_X 0..20967 and ABS_Y 0..15725, pressure 0..4095.
 * The digitizer is mounted rotated relative to the portrait screen, so page
 * x comes from raw Y and page y from raw X, with one axis flipped.
 *
 * Touch (reMarkable 2): the panel reports in roughly screen pixels,
 * ABS_MT_POSITION_X 0..1403 and _Y 0..1871, unrotated, with y counted from
 * the bottom edge.
 *
 * The exact flips of BOTH are the one thing worth confirming against the real
 * device on first use — `--calibrate` prints raw and mapped values live, and
 * every field is overridable by env (RM_* for the pen, RM_TOUCH_* for touch)
 * so nobody has to edit code.
 */
export interface DigitizerMap {
  maxX: number
  maxY: number
  maxPressure: number
  /** Page x from raw Y (true on rM2), else from raw X. */
  swap: boolean
  flipX: boolean
  flipY: boolean
}

export const RM2_MAP: DigitizerMap = {
  maxX: 20967,
  maxY: 15725,
  maxPressure: 4095,
  swap: true,
  flipX: false,
  flipY: true,
}

export const RM2_TOUCH_MAP: DigitizerMap = {
  maxX: 1403,
  maxY: 1871,
  maxPressure: 1,
  swap: false,
  flipX: false,
  flipY: true,
}

/** Raw sensor coordinates → page units (1404×1872, y down). */
export const toPage = (rawX: number, rawY: number, m: DigitizerMap): { x: number; y: number } => {
  let u = m.swap ? rawY / m.maxY : rawX / m.maxX
  let v = m.swap ? rawX / m.maxX : rawY / m.maxY
  if (m.flipX) u = 1 - u
  if (m.flipY) v = 1 - v
  return { x: u * PAGE_W, y: v * PAGE_H }
}

/**
 * Folds the kernel's event stream into PenEvents.
 *
 * The kernel reports state CHANGES between EV_SYN markers; a PenEvent is the
 * state AT a marker. So this keeps the running state (position, pressure,
 * touching, button, tool) and, on every SYN, emits whatever that frame meant:
 * contact started → "down", continued → "move", ended → "up"; no contact but
 * pen in range → "hover"; side button flipped → "button"; pen gone out of
 * range → "leave".
 */
export class PenStateMachine {
  private rawX = 0
  private rawY = 0
  private pressure = 0
  private touching = false
  private wasTouching = false
  private pen = false
  private rubber = false
  private wasInRange = false
  private button = false
  private wasButton = false

  constructor(private readonly map: DigitizerMap) {}

  feed(e: RawEvent): PenEvent[] {
    if (e.type === EV_ABS) {
      if (e.code === ABS_X) this.rawX = e.value
      else if (e.code === ABS_Y) this.rawY = e.value
      else if (e.code === ABS_PRESSURE) this.pressure = e.value
      return []
    }
    if (e.type === EV_KEY) {
      if (e.code === BTN_TOUCH) this.touching = e.value !== 0
      else if (e.code === BTN_STYLUS || e.code === BTN_STYLUS2) this.button = e.value !== 0
      else if (e.code === BTN_TOOL_PEN) this.pen = e.value !== 0
      else if (e.code === BTN_TOOL_RUBBER) this.rubber = e.value !== 0
      return []
    }
    if (e.type !== EV_SYN || e.code !== SYN_REPORT) return []

    const inRange = this.pen || this.rubber
    const p = toPage(this.rawX, this.rawY, this.map)
    const sample: PenSample = {
      x: p.x,
      y: p.y,
      pressure: this.touching ? Math.min(1, this.pressure / this.map.maxPressure) : 0,
      t: e.t,
    }
    const out: PenEvent[] = []
    if (this.button !== this.wasButton) {
      out.push({ kind: "button", pressed: this.button, sample })
      this.wasButton = this.button
    }
    if (this.touching && !this.wasTouching) {
      out.push({ kind: "down", sample, button: this.button, eraser: this.rubber })
    } else if (this.touching) {
      out.push({ kind: "move", sample, button: this.button, eraser: this.rubber })
    } else if (this.wasTouching) {
      out.push({ kind: "up", sample, button: this.button, eraser: this.rubber })
    } else if (inRange) {
      out.push({ kind: "hover", sample, button: this.button })
    }
    if (this.wasInRange && !inRange) out.push({ kind: "leave" })
    this.wasTouching = this.touching
    this.wasInRange = inRange
    return out
  }
}

// ── the touchscreen ───────────────────────────────────────────────────────

export type TouchFrame = Extract<PenEvent, { kind: "touch" }>

/**
 * Folds multitouch protocol B (Documentation/input/multi-touch-protocol.rst)
 * into raw `touch` frames: every finger currently down, on every SYN_REPORT.
 *
 * Protocol B speaks in SLOTS: ABS_MT_SLOT picks one, and what follows updates
 * that slot until the next pick. ABS_MT_TRACKING_ID ≥ 0 puts a finger in the
 * slot, -1 lifts it. Positions only arrive when they change, so the machine
 * keeps every slot's last known position.
 */
export class TouchStateMachine {
  private slot = 0
  private readonly slots = new Map<number, { id: number; rawX: number; rawY: number }>()
  /** After SYN_DROPPED the kernel's deltas are unreliable until the next SYN_REPORT. */
  private dropping = false

  constructor(private readonly map: DigitizerMap) {}

  /** The slot being written; a finger already down when we joined the stream gets one on first sight. */
  private current() {
    let s = this.slots.get(this.slot)
    if (!s) {
      s = { id: this.slot, rawX: 0, rawY: 0 }
      this.slots.set(this.slot, s)
    }
    return s
  }

  feed(e: RawEvent): TouchFrame | undefined {
    if (e.type === EV_SYN) {
      if (e.code === SYN_DROPPED) {
        this.dropping = true
        return undefined
      }
      if (e.code !== SYN_REPORT) return undefined
      this.dropping = false
      const touches = [...this.slots.values()]
        .map((s) => ({ id: s.id, ...toPage(s.rawX, s.rawY, this.map) }))
        .sort((a, b) => a.id - b.id)
      return { kind: "touch", touches, t: e.t }
    }
    if (e.type !== EV_ABS || this.dropping) return undefined
    if (e.code === ABS_MT_SLOT) this.slot = e.value
    else if (e.code === ABS_MT_TRACKING_ID) {
      if (e.value < 0) this.slots.delete(this.slot)
      else this.current().id = e.value
    } else if (e.code === ABS_MT_POSITION_X) this.current().rawX = e.value
    else if (e.code === ABS_MT_POSITION_Y) this.current().rawY = e.value
    return undefined
  }
}

/**
 * ~60 Hz while fingers move, but never late on what matters: a finger landing
 * or lifting (the set of ids changing) and the empty all-lifted frame always
 * go out at once. A frame held back is kept as `pending` so the caller can
 * flush it on a timer — the last position of a pinch is never lost.
 */
export class TouchThrottle {
  private lastSent = -Infinity
  private lastIds = ""
  pending: TouchFrame | undefined

  constructor(private readonly minMs = 16) {}

  offer(f: TouchFrame, now: number): TouchFrame | undefined {
    const ids = f.touches.map((t) => t.id).join(",")
    if (f.touches.length === 0 || ids !== this.lastIds || now - this.lastSent >= this.minMs) {
      this.lastSent = now
      this.lastIds = ids
      this.pending = undefined
      return f
    }
    this.pending = f
    return undefined
  }

  /** The held-back frame, if any — sending it counts as a send. */
  flush(now: number): TouchFrame | undefined {
    const f = this.pending
    if (f) {
      this.pending = undefined
      this.lastSent = now
    }
    return f
  }
}

// ── discovery (pure) ──────────────────────────────────────────────────────

export const USB_HOST = "10.11.99.1"
export type CandidateSource = "cached" | "usb" | "name" | "scan"
export interface Candidate {
  host: string
  source: CandidateSource
}

/** The cheap guesses, best first: what worked last time, USB, the tablet's names. */
export const nameCandidates = (cached?: string, lastSeen?: string): Candidate[] => {
  const all: Candidate[] = [
    ...(cached ? [{ host: cached, source: "cached" as const }] : []),
    ...(lastSeen ? [{ host: lastSeen, source: "cached" as const }] : []),
    { host: USB_HOST, source: "usb" },
    { host: "remarkable.local", source: "name" },
    { host: "remarkable", source: "name" },
  ]
  return all.filter((c, i) => all.findIndex((d) => d.host === c.host) === i)
}

export interface Iface {
  address: string
  netmask: string
  family: string | number
  internal: boolean
  name?: string
}

/** Tunnels and Apple's peer-to-peer links are never where the tablet lives. */
const VIRTUAL_IFACE = /^(utun|ppp|ipsec|tun|tap|gif|stf|awdl|llw|lo|bridge100)/

/**
 * Every address in the /24 around each of the Mac's real IPv4 interfaces,
 * minus the Mac itself. A wider netmask still scans only its own /24: that is
 * where a home router puts its DHCP clients, and it keeps the sweep to
 * ~254 knocks.
 */
export const subnetHosts = (ifaces: Iface[]): string[] => {
  const own = new Set(ifaces.map((i) => i.address))
  const out = new Set<string>()
  for (const i of ifaces) {
    if (i.internal || !(i.family === "IPv4" || i.family === 4)) continue
    if (i.name && VIRTUAL_IFACE.test(i.name)) continue
    if (i.address.startsWith("169.254.")) continue
    const prefix = i.address.split(".").slice(0, 3).join(".")
    for (let n = 1; n < 255; n++) {
      const host = `${prefix}.${n}`
      if (!own.has(host)) out.add(host)
    }
  }
  return [...out]
}

/** dropbear is the sshd every reMarkable ships; a Mac or NAS answers OpenSSH. */
export const looksLikeTablet = (banner: string): boolean => /dropbear/i.test(banner)

export interface Probe extends Candidate {
  /** The resolved IP, when the TCP connect succeeded. */
  address?: string
  /** The SSH server's first line, e.g. "SSH-2.0-dropbear_2020.81". */
  banner?: string
}

const PRIORITY: Record<CandidateSource, number> = { cached: 0, usb: 1, name: 2, scan: 3 }

/**
 * Which probed hosts are worth an SSH login attempt, best first. A cached,
 * USB or named host only has to speak SSH; a host found by the sweep must
 * also announce dropbear and must not be the router (home routers running
 * OpenWrt answer dropbear too). Each address appears once.
 */
export const rankProbes = (probes: Probe[], gateway?: string): string[] => {
  const ok = probes.filter(
    (p) =>
      p.banner &&
      (p.source !== "scan" || (looksLikeTablet(p.banner) && (p.address ?? p.host) !== gateway)),
  )
  ok.sort((a, b) => PRIORITY[a.source] - PRIORITY[b.source])
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of ok) {
    const addr = p.address ?? p.host
    if (seen.has(addr)) continue
    seen.add(addr)
    out.push(addr)
  }
  return out
}

/** What an SSH login attempt against a candidate said. */
export type Confirm = "ok" | "auth" | "not-remarkable" | "unreachable"

export const classifyLogin = (code: number, stdout: string, stderr: string): Confirm => {
  if (code === 0) return /remarkable/i.test(stdout.split("\n---")[0] ?? "") ? "ok" : "not-remarkable"
  if (/permission denied|publickey|authentication|too many auth/i.test(stderr)) return "auth"
  return "unreachable"
}

export type Discovery =
  | { kind: "found"; host: string }
  | { kind: "needs-key"; host: string }
  | { kind: "none" }

/** The first host that let us in wins; else the first that refused our key; else nothing. */
export const decide = (attempts: { host: string; result: Confirm }[]): Discovery => {
  const ok = attempts.find((a) => a.result === "ok")
  if (ok) return { kind: "found", host: ok.host }
  const auth = attempts.find((a) => a.result === "auth")
  if (auth) return { kind: "needs-key", host: auth.host }
  return { kind: "none" }
}

export interface DeviceInfo {
  machine: string
  arch: string
  recordSize: 16 | 24
  pen: string
  touch?: string
  /** The tablet's own Wi-Fi address, if it has joined a network. */
  wlan?: string
}

/** The pen and touchscreen nodes by NAME (numbers move between models/firmware). */
export const findDevices = (procDevices: string): { pen: string; touch?: string } => {
  let pen: string | undefined
  let touch: string | undefined
  for (const block of procDevices.split(/\n\s*\n/)) {
    const name = block.match(/Name="([^"]*)"/)?.[1] ?? ""
    const ev = block.match(/Handlers=.*\b(event\d+)\b/)?.[1]
    if (!ev) continue
    if (/pt_mt|cyttsp|touch|_mt\b/i.test(name)) touch ??= `/dev/input/${ev}`
    else if (/wacom|digitizer|marker|pen|stylus/i.test(name)) pen ??= `/dev/input/${ev}`
  }
  return { pen: pen ?? "/dev/input/event1", touch } // event1: the rM2's well-known pen
}

/** One SSH round-trip tells us everything: model, word size, device nodes, Wi-Fi address. */
export const PROBE_CMD =
  "cat /sys/devices/soc0/machine; echo; echo ---; uname -m; echo ---; cat /proc/bus/input/devices; " +
  "echo; echo ---; (ip -4 addr show wlan0 || ifconfig wlan0) 2>/dev/null"

export const parseDeviceInfo = (stdout: string): DeviceInfo => {
  const [machine = "", arch = "", devices = "", wlan = ""] = stdout.split(/\n---\n/)
  const a = arch.trim()
  return {
    machine: machine.trim(),
    arch: a,
    recordSize: /64|aarch/.test(a) ? 24 : 16,
    ...findDevices(devices),
    wlan: wlan.match(/inet (?:addr:)?(\d+\.\d+\.\d+\.\d+)/)?.[1],
  }
}

/**
 * Since OS 3.22 the tablet serves SSH over USB only until this is run once,
 * over USB (docs/reports/remarkable-display.md §1). It survives updates.
 */
export const WLAN_ON_CMD = `ssh root@${USB_HOST} rm-ssh-over-wlan on`

/**
 * Connected over USB: can it go cordless? `wifiAnswers` is the Mac knocking on
 * the tablet's own Wi-Fi address — proof, not a guess about the setting. When
 * Wi-Fi SSH is on, the Wi-Fi address is what gets cached, so unplugging the
 * cable reconnects over the air at once.
 */
export const usbAdvice = (wlan: string | undefined, wifiAnswers: boolean): { cache: string; message: string } => {
  if (wlan && wifiAnswers) return { cache: wlan, message: `Connected over USB; Wi-Fi SSH is on (${wlan}) — unplug any time.` }
  if (wlan) return { cache: USB_HOST, message: `Connected over USB. To go cordless, run once: ${WLAN_ON_CMD} — then unplug.` }
  return { cache: USB_HOST, message: "Connected over USB. The tablet isn't on Wi-Fi — join the Mac's network to go cordless." }
}

// ── status and retry (pure) ───────────────────────────────────────────────

export type BridgeStatus = Extract<PenEvent, { kind: "status" }>
export type BridgeState = BridgeStatus["state"]

/** 1 s, 2 s, 4 s … capped at 30 s. */
export const backoffMs = (attempt: number): number => Math.min(30_000, 1000 * 2 ** Math.max(0, attempt))

/** While the page waits on a one-time key copy, look again soon — not on a 30 s back-off. */
export const NEEDS_KEY_RETRY_MS = 3000

/**
 * The state after a discovery or stream outcome. "searching" is only for a
 * tablet never seen in this run; once it has been seen, losing it is "asleep".
 */
export const nextState = (
  prev: BridgeState | undefined,
  outcome: Discovery["kind"] | "stream-ended",
): BridgeState => {
  if (outcome === "found") return "connected"
  if (outcome === "needs-key") return "needs-key"
  if (outcome === "stream-ended") return "asleep"
  return prev === undefined || prev === "searching" ? "searching" : "asleep"
}

export const retryDelay = (state: BridgeState, attempt: number): number =>
  state === "needs-key" ? NEEDS_KEY_RETRY_MS : backoffMs(attempt)

/** Says a status only when it differs from the last one said. */
export class StatusTracker {
  current: BridgeStatus | undefined

  set(next: BridgeStatus): boolean {
    const c = this.current
    if (c && c.state === next.state && c.host === next.host && c.message === next.message) return false
    this.current = next
    return true
  }
}

// ── the host side ─────────────────────────────────────────────────────────

const CONFIG_DIR = join(homedir(), ".config", "dreamtalk")
export const KEY_PATH = join(CONFIG_DIR, "remarkable_ed25519")
const KEY_SHOWN = "~/.config/dreamtalk/remarkable_ed25519"
const CACHE_PATH = join(CONFIG_DIR, "remarkable.json")

const PASSWORD_AT = "password: tablet → Settings → Help → Copyrights and licenses"

/**
 * The one-time setup, in the order it has to happen. Over USB both steps fit
 * in one sitting — the key copied there works over Wi-Fi too.
 */
export const needsKeyMessage = (host: string): string =>
  host === USB_HOST
    ? `One-time, over USB: (1) ${WLAN_ON_CMD}  (2) ssh-copy-id -i ${KEY_SHOWN}.pub root@${USB_HOST}  ` +
      `(${PASSWORD_AT}). Then unplug — same Wi-Fi is all it needs from then on.`
    : `One-time: ssh-copy-id -i ${KEY_SHOWN}.pub root@${host}  (${PASSWORD_AT})`

const SEARCHING_MSG = "Looking for the reMarkable on this network…"
/** Most likely cause of a tablet not found on Wi-Fi: Wi-Fi SSH is off (the default since OS 3.22). */
export const NOT_FOUND_MSG =
  `Not found on this Wi-Fi. First time? Plug in USB and run once: ${WLAN_ON_CMD} — then unplug. ` +
  "(Otherwise: wake the tablet, same Wi-Fi as the Mac.)"
const LOCAL_NETWORK_MSG =
  "macOS is blocking local-network access for this terminal: System Settings → Privacy & Security → Local Network → turn it on, then restart the studio."
const ASLEEP_MSG = "The tablet stopped answering (asleep?) — it reconnects by itself when it wakes."

const ensureKey = async (): Promise<boolean> => {
  if (existsSync(KEY_PATH)) return false
  await mkdir(CONFIG_DIR, { recursive: true })
  const p = Bun.spawn(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "dreamtalk-remarkable", "-f", KEY_PATH], {
    stdout: "ignore",
    stderr: "pipe",
  })
  if ((await p.exited) !== 0) throw new Error(`ssh-keygen failed: ${await new Response(p.stderr).text()}`)
  return true
}

const readCache = async (): Promise<string | undefined> => {
  try {
    const host = JSON.parse(await readFile(CACHE_PATH, "utf8"))?.host
    return typeof host === "string" ? host : undefined
  } catch {
    return undefined
  }
}

const writeCache = async (host: string) => {
  try {
    await mkdir(CONFIG_DIR, { recursive: true })
    await writeFile(CACHE_PATH, JSON.stringify({ host, at: new Date().toISOString() }, null, 2) + "\n")
  } catch {}
}

/**
 * The ssh argv. `-F /dev/null` + `UserKnownHostsFile=/dev/null`: David's own
 * SSH config and known_hosts are neither read nor written, and a tablet that
 * was re-flashed (new host key) or got a new DHCP address never wedges the
 * bridge on a host-key mismatch. Keepalives: 3 × 3 s, so a sleeping tablet is
 * noticed in ~10 s instead of TCP's minutes.
 */
export const sshArgs = (host: string, cmd: string, key = KEY_PATH): string[] => [
  "ssh",
  "-F", "/dev/null",
  "-i", key,
  "-o", "IdentitiesOnly=yes",
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=4",
  "-o", "ServerAliveInterval=3",
  "-o", "ServerAliveCountMax=3",
  "-o", "StrictHostKeyChecking=no",
  "-o", "UserKnownHostsFile=/dev/null",
  "-o", "LogLevel=ERROR",
  `root@${host}`,
  cmd,
]

/**
 * The ssh argv that makes ssh's own stdin/stdout a TCP stream to `port` on
 * the TABLET's loopback (`-W`: dropbear's direct-tcpip, on by default — no
 * listener on either machine, nothing to go stale when Wi-Fi drops).
 */
export const sshForwardArgs = (host: string, port: number, key = KEY_PATH): string[] => {
  const args = sshArgs(host, "", key).slice(0, -2)
  return [...args, "-W", `127.0.0.1:${port}`, `root@${host}`]
}

const ssh = (host: string, cmd: string) => Bun.spawn(sshArgs(host, cmd), { stdout: "pipe", stderr: "pipe", stdin: "ignore" })

const login = async (host: string): Promise<{ result: Confirm; info?: DeviceInfo; stderr: string }> => {
  const p = ssh(host, PROBE_CMD)
  const [stdout, stderr, code] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ])
  const result = classifyLogin(code, stdout, stderr)
  return { result, info: result === "ok" ? parseDeviceInfo(stdout) : undefined, stderr: stderr.trim() }
}

/** TCP 22 → the SSH banner, or why not. Never longer than `ms`. */
const probeSsh = (host: string, ms: number): Promise<{ address?: string; banner?: string; error?: string }> =>
  new Promise((resolve) => {
    let done = false
    let buf = ""
    const sock = netConnect({ host, port: 22 })
    const finish = (r: { address?: string; banner?: string; error?: string }) => {
      if (done) return
      done = true
      clearTimeout(timer)
      sock.destroy()
      resolve(r)
    }
    const timer = setTimeout(() => finish({ address: sock.remoteAddress, error: "timeout" }), ms)
    sock.on("data", (d: Buffer) => {
      buf += d.toString("latin1")
      if (buf.includes("\n")) finish({ address: sock.remoteAddress, banner: buf.split(/\r?\n/)[0]!.trim() })
    })
    sock.on("error", (err: NodeJS.ErrnoException) => finish({ error: err.code ?? err.message }))
  })

/** Run `fn` over `items` with at most `limit` in flight. */
const pool = async <T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!)
      }
    }),
  )
  return out
}

const defaultGateway = async (): Promise<string | undefined> => {
  try {
    const p = Bun.spawn(["route", "-n", "get", "default"], { stdout: "pipe", stderr: "ignore" })
    const text = await new Response(p.stdout).text()
    return text.match(/gateway:\s*([\d.]+)/)?.[1]
  } catch {
    return undefined
  }
}

const localIfaces = (): Iface[] =>
  Object.entries(networkInterfaces()).flatMap(([name, list]) => (list ?? []).map((i) => ({ ...i, name })))

/**
 * Is macOS's Local Network privacy gate (Sequoia+) blocking this process?
 * Knocking on the router answers it: refused or open means the LAN is
 * reachable; EHOSTUNREACH to our own gateway means the OS said no.
 */
const localNetworkBlocked = async (gateway: string | undefined): Promise<boolean> => {
  if (!gateway) return false
  const r = await probeSsh(gateway, 800)
  return r.error === "EHOSTUNREACH"
}

export interface DiscoverReport {
  outcome: Discovery
  info?: DeviceInfo
  probes: Probe[]
  attempts: { host: string; result: Confirm; stderr: string }[]
  scanned: number
  gateway?: string
  blocked: boolean
}

/**
 * Find the tablet. The cheap guesses first (in parallel, ~1 s); the sweep only
 * when none of them is a reMarkable we can log into.
 */
const discover = async (lastSeen?: string): Promise<DiscoverReport> => {
  const forced = process.env.RM_HOST
  const cached = forced ?? (await readCache())
  const gateway = await defaultGateway()
  const attempts: DiscoverReport["attempts"] = []
  const probes: Probe[] = []

  const tryHosts = async (hosts: string[]): Promise<{ outcome: Discovery; info?: DeviceInfo } | undefined> => {
    for (const host of hosts.slice(0, 6)) {
      if (attempts.some((a) => a.host === host)) continue
      const r = await login(host)
      attempts.push({ host, result: r.result, stderr: r.stderr })
      if (r.result === "ok") return { outcome: { kind: "found", host }, info: r.info }
    }
    return undefined
  }

  const guesses = forced ? [{ host: forced, source: "cached" as const }] : nameCandidates(cached, lastSeen)
  const [blocked, guessed] = await Promise.all([
    localNetworkBlocked(gateway),
    Promise.all(guesses.map(async (c) => ({ ...c, ...(await probeSsh(c.host, 1200)) }))),
  ])
  probes.push(...guessed)
  const hit = await tryHosts(rankProbes(guessed, gateway))
  if (hit) return { ...hit, probes, attempts, scanned: 0, gateway, blocked }

  // A tablet that refused our key is still THE tablet: while David copies the
  // key, look again every few seconds without sweeping the whole subnet.
  let scanned = 0
  if (!forced && !attempts.some((a) => a.result === "auth")) {
    const hosts = subnetHosts(localIfaces()).filter((h) => !guessed.some((g) => g.address === h))
    scanned = hosts.length
    const swept = await pool(hosts, 96, async (host) => ({ host, source: "scan" as const, ...(await probeSsh(host, 700)) }))
    probes.push(...swept)
    const hit2 = await tryHosts(rankProbes(swept, gateway))
    if (hit2) return { ...hit2, probes, attempts, scanned, gateway, blocked }
  }
  return { outcome: decide(attempts), probes, attempts, scanned, gateway, blocked }
}

/**
 * `cat` a device node over SSH and hand every parsed event to `onEvent`.
 * Resolves when the stream ends — the tablet slept, the link died, or `stop`.
 */
const streamDevice = (
  host: string,
  dev: string,
  recordSize: 16 | 24,
  onEvent: (e: RawEvent) => void,
): { done: Promise<void>; stop: () => void } => {
  const proc = ssh(host, `cat ${dev}`)
  const done = (async () => {
    let pending: Uint8Array = new Uint8Array(0)
    // An explicit reader rather than `for await`: the DOM lib's ReadableStream
    // type lacks the async iterator even though Bun provides it.
    const reader = proc.stdout.getReader()
    for (;;) {
      const { value: chunk, done } = await reader.read()
      if (done || !chunk) break
      const joined = new Uint8Array(pending.length + chunk.length)
      joined.set(pending)
      joined.set(chunk, pending.length)
      const { events, rest } = parseEvents(joined, recordSize)
      pending = rest
      for (const e of events) onEvent(e)
    }
    await proc.exited
  })().catch(() => {})
  return { done, stop: () => proc.kill() }
}

const envFlag = (name: string, fallback: boolean): boolean => {
  const v = process.env[name]
  return v === undefined ? fallback : v === "1" || v === "true"
}

const envNum = (name: string, fallback: number): number => {
  const v = Number(process.env[name])
  return process.env[name] !== undefined && Number.isFinite(v) && v > 0 ? v : fallback
}

const penMap = (): DigitizerMap => ({
  ...RM2_MAP,
  maxX: envNum("RM_MAX_X", RM2_MAP.maxX),
  maxY: envNum("RM_MAX_Y", RM2_MAP.maxY),
  swap: envFlag("RM_SWAP", RM2_MAP.swap),
  flipX: envFlag("RM_FLIP_X", RM2_MAP.flipX),
  flipY: envFlag("RM_FLIP_Y", RM2_MAP.flipY),
})

const touchMap = (): DigitizerMap => ({
  ...RM2_TOUCH_MAP,
  maxX: envNum("RM_TOUCH_MAX_X", RM2_TOUCH_MAP.maxX),
  maxY: envNum("RM_TOUCH_MAX_Y", RM2_TOUCH_MAP.maxY),
  swap: envFlag("RM_TOUCH_SWAP", RM2_TOUCH_MAP.swap),
  flipX: envFlag("RM_TOUCH_FLIP_X", RM2_TOUCH_MAP.flipX),
  flipY: envFlag("RM_TOUCH_FLIP_Y", RM2_TOUCH_MAP.flipY),
})

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Wait `ms` — but knock on the tablet's last address every 2 s and return
 * early the moment its SSH answers, so a tablet waking from a long sleep is
 * back in seconds, not after the 30 s back-off.
 */
const waitOrWake = async (ms: number, host: string | undefined) => {
  const until = Date.now() + ms
  while (Date.now() < until) {
    await sleep(Math.min(2000, until - Date.now()))
    if (host && Date.now() < until && (await probeSsh(host, 800)).banner) return
  }
}

const log = (line: string) => console.log(line)

/** The daemon socket, reconnecting quietly: the bridge survives a daemon restart. */
const relay = (url: string, onOpen: () => void) => {
  let ws: WebSocket | undefined
  const connect = () => {
    ws = new WebSocket(url)
    ws.onopen = onOpen
    ws.onclose = () => setTimeout(connect, 1000)
    ws.onerror = () => {}
  }
  connect()
  return (ev: PenEvent) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(ev))
  }
}

// ── the tablet's screen ───────────────────────────────────────────────────
//
// The whiteboard page publishes what it shows as a display list on the
// daemon's /ws/display (sketch/mirror.ts). The bridge keeps the merged list
// and hands it to dreamtalk-pad — the AppLoad app on the tablet, listening on
// the tablet's 127.0.0.1:7777 — through `ssh -W`, one JSON op per line: a
// snapshot on every (re)connect, then each batch as it comes. While the app
// isn't running the connect is simply refused; the bridge knocks again
// quietly. RM_SCREEN=off leaves the screen alone.

type Lines = (text: string) => void

/** The display list from the daemon, kept merged, offered to whoever listens. */
const displayFeed = (url: string) => {
  const store = new DisplayStore()
  const sinks = new Set<Lines>()
  const connect = () => {
    const ws = new WebSocket(url)
    ws.onmessage = (m) => {
      let ops
      try {
        ops = parseDisplayOps(JSON.parse(String(m.data)))
      } catch {
        return
      }
      if (!ops.length) return
      store.apply(ops)
      const text = toLines(ops)
      for (const sink of sinks) sink(text)
    }
    ws.onclose = () => setTimeout(connect, 1000)
    ws.onerror = () => {}
  }
  connect()
  return {
    snapshot: () => toLines(store.snapshot()),
    listen(sink: Lines): () => void {
      sinks.add(sink)
      return () => sinks.delete(sink)
    },
  }
}

type Feed = ReturnType<typeof displayFeed>

/** Keep one `ssh -W` open to the pad while the tablet session lasts. */
const linkScreen = (host: string, feed: Feed): { stop: () => void } => {
  let stopped = false
  let proc: ReturnType<typeof Bun.spawn> | undefined
  const run = async () => {
    let quiet = 2000
    while (!stopped) {
      const p = Bun.spawn(sshForwardArgs(host, PAD_DISPLAY_PORT), { stdin: "pipe", stdout: "pipe", stderr: "ignore" })
      proc = p
      const sink = p.stdin as import("bun").FileSink
      const send: Lines = (text) => {
        try {
          sink.write(text)
          sink.flush()
        } catch {
          // the link is going down; exited follows
        }
      }
      send(feed.snapshot())
      const unlisten = feed.listen(send)
      // The pad greets on accept: that line is what "connected" means.
      let hello = false
      const reader = (p.stdout as ReadableStream<Uint8Array>).getReader()
      void (async () => {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          if (!hello && value && new TextDecoder().decode(value).includes("dreamtalk-pad")) {
            hello = true
            log(`screen: dreamtalk-pad connected on ${host}`)
          }
        }
      })().catch(() => {})
      await p.exited
      unlisten()
      if (stopped) break
      if (hello) {
        log("screen: dreamtalk-pad disconnected")
        quiet = 2000
      } else quiet = Math.min(15_000, quiet * 1.5)
      await sleep(hello ? 1000 : quiet)
    }
  }
  void run()
  return {
    stop: () => {
      stopped = true
      proc?.kill()
    },
  }
}

/** The bridge proper: find, connect, stream, and on any loss start over. Never returns. */
const runBridge = async () => {
  const tracker = new StatusTracker()
  const penUrl = process.env.DT_WS ?? "ws://localhost:4174/ws/pen"
  const feed =
    process.env.RM_SCREEN === "off"
      ? undefined
      : displayFeed(process.env.DT_DISPLAY_WS ?? penUrl.replace(/\/ws\/pen$/, "/ws/display"))
  let send: (ev: PenEvent) => void = () => {}
  send = relay(penUrl, () => {
    // A (re)connected daemon learns the state at once; it replays it to pages.
    if (tracker.current) send(tracker.current)
  })
  const say = (s: BridgeStatus) => {
    if (!tracker.set(s)) return
    send(s)
    log(`${s.state}${s.host ? ` ${s.host}` : ""}${s.message ? ` — ${s.message}` : ""}`)
  }

  if (await ensureKey()) log(`generated the bridge's own SSH key at ${KEY_SHOWN}`)
  say({ kind: "status", state: "searching", message: SEARCHING_MSG })

  let attempt = 0
  let lastSeen: string | undefined
  for (;;) {
    let state: BridgeState
    try {
      const report = await discover(lastSeen)
      const outcome = report.outcome
      state = nextState(tracker.current?.state, outcome.kind)
      if (outcome.kind === "found" && report.info) {
        let message = `${report.info.machine} at ${outcome.host}`
        let cache = outcome.host
        if (outcome.host === USB_HOST) {
          const wlan = report.info.wlan
          const advice = usbAdvice(wlan, !!wlan && !!(await probeSsh(wlan, 1200)).banner)
          message = advice.message
          cache = advice.cache
        }
        lastSeen = cache
        await writeCache(cache)
        const started = Date.now()
        say({ kind: "status", state, host: outcome.host, message })
        await streamTablet(outcome.host, report.info, send, feed)
        // A stream that dies at once is a fault, not a sleep: keep backing off
        // instead of hammering the tablet once a second.
        attempt = Date.now() - started > 5000 ? 0 : attempt + 1
        state = nextState(state, "stream-ended")
        say({ kind: "status", state, host: outcome.host, message: ASLEEP_MSG })
      } else if (outcome.kind === "needs-key") {
        lastSeen = outcome.host
        say({ kind: "status", state, host: outcome.host, message: needsKeyMessage(outcome.host) })
      } else {
        attempt++
        const message = report.blocked ? LOCAL_NETWORK_MSG : state === "asleep" ? ASLEEP_MSG : NOT_FOUND_MSG
        say({ kind: "status", state, host: state === "asleep" ? lastSeen : undefined, message })
      }
    } catch (err) {
      // Nothing transient may kill the bridge; say it once, try again.
      state = tracker.current?.state ?? "searching"
      attempt++
      log(`error: ${(err as Error).message}`)
    }
    await waitOrWake(retryDelay(state, attempt), lastSeen ?? (await readCache()))
  }
}

/** Pen and touchscreen in parallel; resolves when either stream ends (both are then stopped). */
const streamTablet = async (host: string, info: DeviceInfo, send: (ev: PenEvent) => void, feed?: Feed) => {
  const pen = new PenStateMachine(penMap())
  let lastHover = 0
  const penStream = streamDevice(host, info.pen, info.recordSize, (raw) => {
    for (const ev of pen.feed(raw)) {
      // Hover is chatty and only needs to be smooth, not complete.
      if (ev.kind === "hover") {
        if (ev.sample.t - lastHover < 16) continue
        lastHover = ev.sample.t
      }
      send(ev)
    }
  })
  const streams = [penStream]

  if (info.touch) {
    const touch = new TouchStateMachine(touchMap())
    const throttle = new TouchThrottle(16)
    let trailing: ReturnType<typeof setTimeout> | undefined
    streams.push(
      streamDevice(host, info.touch, info.recordSize, (raw) => {
        const frame = touch.feed(raw)
        if (!frame) return
        const out = throttle.offer(frame, performance.now())
        if (out) {
          clearTimeout(trailing)
          trailing = undefined
          send(out)
        } else {
          trailing ??= setTimeout(() => {
            trailing = undefined
            const f = throttle.flush(performance.now())
            if (f) send(f)
          }, 16)
        }
      }),
    )
  }
  const screen = feed && linkScreen(host, feed)
  await Promise.race(streams.map((s) => s.done))
  screen?.stop()
  for (const s of streams) s.stop()
  await Promise.all(streams.map((s) => s.done))
}

// ── --doctor and --calibrate ──────────────────────────────────────────────

const ok = (step: string, detail: string) => console.log(`✓ ${step.padEnd(10)} ${detail}`)
const bad = (step: string, detail: string, ...hints: string[]) => {
  console.log(`✗ ${step.padEnd(10)} ${detail}`)
  for (const h of hints) console.log(`  ${" ".repeat(10)} → ${h}`)
}

/** Find the tablet or explain, step by step, why not. Returns the host + devices, or undefined. */
const doctorDiscover = async (): Promise<{ host: string; info: DeviceInfo } | undefined> => {
  const fresh = await ensureKey()
  ok("key", `${KEY_SHOWN}${fresh ? " (just generated)" : ""}`)

  console.log(`… discovery  cached / USB / remarkable.local, then the local /24 …`)
  const t0 = performance.now()
  const r = await discover()
  const secs = ((performance.now() - t0) / 1000).toFixed(1)
  if (r.blocked) bad("network", `the router (${r.gateway}) is unreachable from this process`, LOCAL_NETWORK_MSG)
  else ok("network", r.gateway ? `local network reachable (router ${r.gateway})` : "no default route — USB only")

  const servers = r.probes.filter((p) => p.banner)
  for (const p of servers) console.log(`             ${p.source.padEnd(6)} ${(p.address ?? p.host).padEnd(16)} ${p.banner}`)
  for (const a of r.attempts) console.log(`             login  ${a.host.padEnd(16)} ${a.result}${a.stderr ? ` (${a.stderr.split("\n")[0]})` : ""}`)

  const o = r.outcome
  if (o.kind === "none") {
    bad(
      "discovery",
      `no reMarkable found (${r.scanned} addresses swept in ${secs}s, ${servers.length} SSH servers seen)`,
      "Wake the tablet (press the power button) and check it's on the same Wi-Fi as this Mac.",
      "Its IP is on the tablet under Settings → Help → Copyrights and licenses; try RM_HOST=<ip> bun scripts/remarkable-bridge.ts --doctor",
    )
    bad(
      "wifi ssh",
      "unknown — the tablet isn't reachable over USB to check",
      `MOST LIKELY CAUSE (first time): SSH over Wi-Fi is off by default. Plug in USB and run once: ${WLAN_ON_CMD}`,
      "then run this doctor again (still plugged in) to finish the setup.",
    )
    return undefined
  }
  ok("discovery", `${o.host} in ${secs}s`)
  if (o.kind === "needs-key") {
    if (o.host === USB_HOST) {
      bad(
        "auth",
        "the tablet refused the bridge's key — one-time setup, in this order, while plugged in:",
        `1. ${WLAN_ON_CMD}`,
        `2. ssh-copy-id -i ${KEY_SHOWN}.pub root@${USB_HOST}`,
        `   (${PASSWORD_AT}, both times)`,
        "3. run this doctor again, then unplug — same Wi-Fi is all it needs from then on.",
      )
    } else bad("auth", "the tablet refused the bridge's key", needsKeyMessage(o.host))
    return undefined
  }
  const info = r.info!
  ok("auth", `${info.machine} (key accepted)`)
  ok("devices", `${info.arch}, ${info.recordSize}-byte events · pen ${info.pen} · touch ${info.touch ?? "—"}`)
  if (!info.touch) bad("touch", "no touchscreen device found by name in /proc/bus/input/devices")
  if (o.host !== USB_HOST) ok("wifi ssh", `on (connected over Wi-Fi at ${o.host})`)
  else if (!info.wlan) bad("wifi ssh", "the tablet isn't on Wi-Fi", "join the same network as this Mac (tablet → Settings → Wi-Fi)")
  else if ((await probeSsh(info.wlan, 1200)).banner) {
    await writeCache(info.wlan)
    ok("wifi ssh", `on — ${info.wlan} answers; unplug any time`)
  } else bad("wifi ssh", `off — ${info.wlan} doesn't answer SSH`, `run once (plugged in): ${WLAN_ON_CMD}`)
  return { host: o.host, info }
}

/** Count events from one device for `ms`. */
const countFor = async (host: string, dev: string, size: 16 | 24, ms: number, count: (e: RawEvent) => boolean) => {
  let n = 0
  const s = streamDevice(host, dev, size, (e) => {
    if (count(e)) n++
  })
  await Promise.race([s.done, sleep(ms)])
  s.stop()
  return n
}

const runDoctor = async () => {
  console.log("DreamTalk ↔ reMarkable doctor\n")
  let healthy = true
  const found = await doctorDiscover()
  if (found) {
    const { host, info } = found
    console.log("… pen        hover over or write on the tablet for 5 s …")
    const pen = await countFor(host, info.pen, info.recordSize, 5000, (e) => e.type === EV_SYN)
    if (pen > 0) ok("pen", `${pen} frames`)
    else {
      healthy = false
      bad("pen", "no pen events in 5 s", `is ${info.pen} the digitizer? (cat /proc/bus/input/devices on the tablet)`)
    }
    if (info.touch) {
      console.log("… touch      touch the screen with a finger for 5 s …")
      const touch = await countFor(host, info.touch, info.recordSize, 5000, (e) => e.type === EV_SYN)
      if (touch > 0) ok("touch", `${touch} frames`)
      else {
        healthy = false
        bad("touch", "no touch events in 5 s")
      }
    }
  } else healthy = false

  const url = process.env.DT_WS ?? "ws://localhost:4174/ws/pen"
  const daemonUp = await new Promise<boolean>((resolve) => {
    const ws = new WebSocket(url)
    const t = setTimeout(() => resolve(false), 1500)
    ws.onopen = () => (clearTimeout(t), ws.close(), resolve(true))
    ws.onerror = () => (clearTimeout(t), resolve(false))
  })
  if (daemonUp) ok("daemon", url)
  else bad("daemon", `${url} not answering`, "start it: cd core && bun run studio")
  console.log(healthy && daemonUp ? "\nAll good." : "")
  process.exit(healthy ? 0 : 1)
}

const runCalibrate = async () => {
  const found = await doctorDiscover()
  if (!found) process.exit(1)
  const { host, info } = found
  const pm = penMap()
  const tm = touchMap()
  console.log(
    "\nTouch each corner with the pen, then a finger. Top-left should map near (0, 0),\n" +
      `bottom-right near (${PAGE_W}, ${PAGE_H}). If an axis is mirrored, set RM_FLIP_X/RM_FLIP_Y=1|0\n` +
      "(pen) or RM_TOUCH_FLIP_X/RM_TOUCH_FLIP_Y (touch); RM_SWAP / RM_TOUCH_SWAP swap the axes.\n",
  )
  let pen = { x: 0, y: 0 }
  let touch = { x: 0, y: 0 }
  const show = () => {
    const pp = toPage(pen.x, pen.y, pm)
    const tp = toPage(touch.x, touch.y, tm)
    process.stdout.write(
      `\rpen X=${String(pen.x).padStart(6)} Y=${String(pen.y).padStart(6)} → (${pp.x.toFixed(0).padStart(4)}, ${pp.y.toFixed(0).padStart(4)})` +
        `   touch X=${String(touch.x).padStart(5)} Y=${String(touch.y).padStart(5)} → (${tp.x.toFixed(0).padStart(4)}, ${tp.y.toFixed(0).padStart(4)})   `,
    )
  }
  const streams = [
    streamDevice(host, info.pen, info.recordSize, (e) => {
      if (e.type !== EV_ABS) return
      if (e.code === ABS_X) pen = { ...pen, x: e.value }
      else if (e.code === ABS_Y) pen = { ...pen, y: e.value }
      else return
      show()
    }),
  ]
  if (info.touch) {
    streams.push(
      streamDevice(host, info.touch, info.recordSize, (e) => {
        if (e.type !== EV_ABS) return
        if (e.code === ABS_MT_POSITION_X) touch = { ...touch, x: e.value }
        else if (e.code === ABS_MT_POSITION_Y) touch = { ...touch, y: e.value }
        else return
        show()
      }),
    )
  }
  await Promise.race(streams.map((s) => s.done))
  console.log("\nstream ended")
  process.exit(0)
}

if (import.meta.main) {
  // Spawned by the daemon: our stdin is its pipe, and EOF means the daemon is
  // gone — exit rather than linger as an orphan that would double every event
  // once a new daemon starts its own bridge.
  if (process.env.DT_BRIDGE_CHILD === "1") {
    process.stdin.on("end", () => process.exit(0))
    process.stdin.resume()
  }
  if (process.argv.includes("--doctor")) await runDoctor()
  else if (process.argv.includes("--calibrate")) await runCalibrate()
  else await runBridge()
}
