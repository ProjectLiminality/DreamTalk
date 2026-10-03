/**
 * remarkable-bridge.ts — the reMarkable's pen, streamed into DreamTalk.
 *
 *   bun scripts/remarkable-bridge.ts                       # USB: 10.11.99.1
 *   RM_HOST=192.168.1.42 bun scripts/remarkable-bridge.ts  # Wi-Fi
 *   bun scripts/remarkable-bridge.ts --calibrate           # print raw corners
 *
 * Reads the tablet's digitizer over SSH and relays every pen event to the
 * daemon's `/ws/pen`, where the sketch page receives it as a PenEvent
 * (core/sketch/protocol.ts). Nothing is installed on the tablet.
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
 * The cost of that choice, stated up front: the tablet shows xochitl's ink,
 * not DreamTalk's scene — selections, options and symbols appear on the Mac.
 * And the Lamy side button is xochitl's eraser, so a lasso drawn with the
 * button held also rubs out the native ink under it on the tablet (the
 * DreamTalk scene is unaffected). Owning the screen — rendering symbols back
 * onto the e-ink — is the next step (rm2fb / AppLoad), and this protocol
 * doesn't change when it comes.
 *
 * ONE-TIME SETUP
 *
 *   Settings → Help → Copyrights and licenses shows the root password and the
 *   Wi-Fi IP. Then once, from the Mac:
 *       ssh-copy-id root@<ip>
 *   After that the bridge connects without a password.
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
export const ABS_X = 0
export const ABS_Y = 1
export const ABS_PRESSURE = 24
export const ABS_DISTANCE = 25
export const BTN_TOOL_PEN = 320
export const BTN_TOOL_RUBBER = 321
export const BTN_TOUCH = 330
export const BTN_STYLUS = 331
export const BTN_STYLUS2 = 332

import { PAGE_H, PAGE_W, type PenEvent, type PenSample } from "../sketch/protocol"

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
 * The digitizer's raw ranges and how its axes sit against the portrait page.
 *
 * reMarkable 2 defaults: ABS_X 0..20967 and ABS_Y 0..15725, pressure
 * 0..4095. The digitizer is mounted rotated relative to the portrait screen,
 * so page x comes from raw Y and page y from raw X, with one axis flipped.
 * The exact flips are the one thing worth confirming against the real
 * device on first use — `--calibrate` prints raw values at the corners, and
 * every flag below is overridable by env so nobody has to edit code.
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

/** Raw digitizer coordinates → page units (1404×1872, y down). */
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
 * pen in range → "hover"; side button flipped → "button".
 */
export class PenStateMachine {
  private rawX = 0
  private rawY = 0
  private pressure = 0
  private touching = false
  private wasTouching = false
  private inRange = false
  private button = false
  private wasButton = false
  private eraser = false

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
      else if (e.code === BTN_TOOL_PEN) this.inRange = e.value !== 0
      else if (e.code === BTN_TOOL_RUBBER) {
        this.eraser = e.value !== 0
        this.inRange = e.value !== 0 || this.inRange
      }
      return []
    }
    if (e.type !== EV_SYN) return []

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
      out.push({ kind: "down", sample, button: this.button, eraser: this.eraser })
    } else if (this.touching) {
      out.push({ kind: "move", sample, button: this.button, eraser: this.eraser })
    } else if (this.wasTouching) {
      out.push({ kind: "up", sample, button: this.button, eraser: this.eraser })
    } else if (this.inRange) {
      out.push({ kind: "hover", sample, button: this.button })
    }
    this.wasTouching = this.touching
    return out
  }
}

// ── the process ───────────────────────────────────────────────────────────

const ssh = (host: string, cmd: string) =>
  Bun.spawn(
    [
      "ssh",
      "-o", "ConnectTimeout=5",
      "-o", "ServerAliveInterval=5",
      "-o", "BatchMode=yes",
      "-o", "StrictHostKeyChecking=accept-new",
      `root@${host}`,
      cmd,
    ],
    { stdout: "pipe", stderr: "pipe" },
  )

const sshText = async (host: string, cmd: string): Promise<string> => {
  const p = ssh(host, cmd)
  const out = await new Response(p.stdout).text()
  const code = await p.exited
  if (code !== 0) {
    const err = await new Response(p.stderr).text()
    throw new Error(err.trim() || `ssh exited ${code}`)
  }
  return out
}

/** Find the pen digitizer's /dev/input node by name, not by number. */
const findDigitizer = async (host: string): Promise<string> => {
  const devices = await sshText(host, "cat /proc/bus/input/devices")
  for (const block of devices.split(/\n\s*\n/)) {
    if (!/Name=.*(Wacom|Digitizer|Marker|Pen)/i.test(block)) continue
    if (/touch/i.test(block.match(/Name="([^"]*)"/)?.[1] ?? "")) continue
    const ev = block.match(/Handlers=.*\b(event\d+)\b/)
    if (ev) return `/dev/input/${ev[1]}`
  }
  return "/dev/input/event1" // the rM2's well-known default
}

const envFlag = (name: string, fallback: boolean): boolean => {
  const v = process.env[name]
  return v === undefined ? fallback : v === "1" || v === "true"
}

if (import.meta.main) {
  const host = process.env.RM_HOST ?? "10.11.99.1"
  const daemon = process.env.DT_WS ?? "ws://localhost:4174/ws/pen"
  const calibrate = process.argv.includes("--calibrate")
  const map: DigitizerMap = {
    ...RM2_MAP,
    swap: envFlag("RM_SWAP", RM2_MAP.swap),
    flipX: envFlag("RM_FLIP_X", RM2_MAP.flipX),
    flipY: envFlag("RM_FLIP_Y", RM2_MAP.flipY),
  }

  console.log(`reMarkable bridge → ${host}`)
  let arch = ""
  let dev = ""
  try {
    arch = (await sshText(host, "uname -m")).trim()
    dev = await findDigitizer(host)
  } catch (err) {
    console.error(`cannot reach root@${host}: ${(err as Error).message}`)
    console.error("  USB: plug in and use 10.11.99.1.  Wi-Fi: RM_HOST=<ip> (Settings → Help → Copyrights).")
    console.error("  First time: ssh-copy-id root@<ip>")
    process.exit(1)
  }
  const recordSize: 16 | 24 = /64|aarch/.test(arch) ? 24 : 16
  console.log(`  ${arch}, ${recordSize}-byte events from ${dev}`)

  // The daemon socket, reconnecting quietly: the bridge should survive a
  // daemon restart without being restarted itself.
  let ws: WebSocket | undefined
  const connect = () => {
    ws = new WebSocket(daemon)
    ws.onopen = () => console.log(`  relaying to ${daemon}`)
    ws.onclose = () => setTimeout(connect, 1000)
    ws.onerror = () => {}
  }
  if (!calibrate) connect()

  const machine = new PenStateMachine(map)
  let lastHover = 0
  const proc = ssh(host, `cat ${dev}`)
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
    for (const raw of events) {
      if (calibrate) {
        if (raw.type === EV_ABS && (raw.code === ABS_X || raw.code === ABS_Y)) {
          process.stdout.write(`\r${raw.code === ABS_X ? "X" : "Y"}=${String(raw.value).padStart(6)}   `)
        }
        continue
      }
      for (const ev of machine.feed(raw)) {
        // Hover is chatty and only needs to be smooth, not complete.
        if (ev.kind === "hover") {
          if (ev.sample.t - lastHover < 16) continue
          lastHover = ev.sample.t
        }
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(ev))
      }
    }
  }
  console.error("digitizer stream ended (tablet asleep or disconnected)")
  process.exit(2)
}
