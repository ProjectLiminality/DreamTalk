/**
 * leap-bridge.ts — the Leap Motion's hands, streamed into DreamTalk.
 *
 *   bun run studio                         # the daemon starts this for you (DT_LEAP=off to skip)
 *   bun scripts/leap-bridge.ts             # standalone
 *   bun scripts/leap-bridge.ts --doctor    # ✓/✗ every step, then a few seconds of live hands
 *
 * Talks to Ultraleap's tracking service through LeapC (the C library its
 * "Ultraleap Hand Tracking" app ships, loaded with bun:ffi — nothing to
 * build, no Python) and relays every tracking frame as a HandFrame to the
 * daemon's `/ws/hands`, where pages with `?hands=leap` receive it
 * (core/hands/sources.ts). Both the original Leap Motion Controller and the
 * Controller 2 work with the Gemini (v5) service on Apple Silicon macOS.
 *
 * Absence is a state, never a crash: no library → `nolib` (and the install
 * line), no service → `noservice`, no controller → `nodevice`. The bridge
 * keeps waiting and picks the controller up the moment it is plugged in.
 * One log line per state change.
 */

import { existsSync } from "node:fs"
import { dlopen, FFIType, ptr, read, toArrayBuffer, type Pointer } from "bun:ffi"
import { LEAP_BOX, type HandFrame, type HandMessage, type LeapState } from "../src/hands"
import { LEAP_HAND_SIZE, leapHands } from "../hands/leap"

const APP = "/Applications/Ultraleap Hand Tracking.app"
const LIB_CANDIDATES = [
  process.env.LEAPC_LIB,
  `${APP}/Contents/LeapSDK/lib/libLeapC.dylib`,
  `${APP}/Contents/LeapSDK/lib/libLeapC.5.dylib`,
  "/usr/local/lib/libLeapC.dylib",
].filter((p): p is string => !!p)

export const INSTALL_HINT =
  "install Ultraleap Hand Tracking for macOS (https://www.ultraleap.com/downloads/ → Leap Motion Controller → macOS), open it once, allow it in System Settings → Privacy & Security"

const STATUS_TEXT: Record<LeapState, string> = {
  nolib: `Leap software not found — ${INSTALL_HINT}`,
  noservice: "Ultraleap tracking service not answering — open “Ultraleap Hand Tracking” from Applications",
  nodevice: "Leap service running, no controller — plug the Leap in (USB; a hub or adapter is fine)",
  ready: "Leap ready",
}

// LeapC.h: eLeapRS / eLeapEventType values, LEAP_CONNECTION_MESSAGE layout (packed: type @4, pointer @8).
const RS_SUCCESS = 0
const EV_CONNECTION = 1
const EV_CONNECTION_LOST = 2
const EV_DEVICE = 3
const EV_DEVICE_FAILURE = 4
const EV_TRACKING = 0x100
const EV_DEVICE_LOST = 0x104
// LEAP_TRACKING_EVENT: nHands @32, pHands @36.
const TRACK_NHANDS = 32
const TRACK_PHANDS = 36

const openLib = () => {
  const path = LIB_CANDIDATES.find((p) => existsSync(p))
  if (!path) return undefined
  return dlopen(path, {
    LeapCreateConnection: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    LeapOpenConnection: { args: [FFIType.ptr], returns: FFIType.i32 },
    LeapPollConnection: { args: [FFIType.ptr, FFIType.u32, FFIType.ptr], returns: FFIType.i32 },
    LeapCloseConnection: { args: [FFIType.ptr], returns: FFIType.void },
    LeapDestroyConnection: { args: [FFIType.ptr], returns: FFIType.void },
  })
}

/**
 * The tracking loop: connect, then drain the service's events every few ms
 * (a zero-timeout poll — a blocking one would stall the socket). Calls
 * `onState` on every change and `onFrame` with each tracking frame.
 */
export const runLeap = (onState: (s: LeapState) => void, onFrame: (f: HandFrame) => void): (() => void) => {
  const lib = openLib()
  if (!lib) {
    onState("nolib")
    return () => {}
  }
  const L = lib.symbols
  const handle = new BigUint64Array(1)
  if (L.LeapCreateConnection(null, ptr(handle)) !== RS_SUCCESS || L.LeapOpenConnection(Number(handle[0]) as Pointer) !== RS_SUCCESS) {
    onState("noservice")
    return () => {}
  }
  const conn = Number(handle[0]) as Pointer
  const msg = new Uint8Array(32)
  const msgView = new DataView(msg.buffer)
  const msgPtr = ptr(msg)
  let state: LeapState = "noservice"
  const set = (s: LeapState) => {
    if (s !== state) onState((state = s))
  }
  let devices = 0
  let lastHands = -1
  let stopped = false
  const t0 = performance.now()
  const tick = async () => {
    while (!stopped) {
      for (let n = 0; n < 64; n++) {
        if (L.LeapPollConnection(conn, 0, msgPtr) !== RS_SUCCESS) break
        const type = msgView.getUint32(4, true)
        const at = Number(msgView.getBigUint64(8, true))
        if (type === EV_CONNECTION) set(devices > 0 ? "ready" : "nodevice")
        else if (type === EV_CONNECTION_LOST) set("noservice")
        else if (type === EV_DEVICE) {
          devices++
          set("ready")
        } else if (type === EV_DEVICE_LOST || type === EV_DEVICE_FAILURE) {
          devices = Math.max(0, devices - 1)
          if (devices === 0) set("nodevice")
        } else if (type === EV_TRACKING && at) {
          if (devices === 0) {
            devices = 1
            set("ready")
          }
          const nHands = read.u32(at, TRACK_NHANDS)
          // An empty frame once when the hands leave, then silence until they return.
          if (nHands === 0 && lastHands === 0) continue
          lastHands = nHands
          const pHands = read.ptr(at, TRACK_PHANDS)
          const hands = nHands && pHands ? leapHands(new DataView(toArrayBuffer(pHands, 0, nHands * LEAP_HAND_SIZE).slice(0)), nHands) : []
          onFrame({ t: (performance.now() - t0) / 1000, source: "leap", hands, box: LEAP_BOX })
        }
      }
      await Bun.sleep(4)
    }
  }
  void tick()
  // No answer at all within 2 s: the service isn't there.
  setTimeout(() => state === "noservice" && onState("noservice"), 2000)
  return () => {
    stopped = true
    L.LeapCloseConnection(conn)
    L.LeapDestroyConnection(conn)
  }
}

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
  return (m: HandMessage) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m))
  }
}

const runBridge = () => {
  const url = process.env.DT_WS ?? "ws://localhost:4174/ws/hands"
  let state: LeapState | undefined
  const statusMsg = (): HandMessage => ({ kind: "status", state: state ?? "noservice", text: STATUS_TEXT[state ?? "noservice"] })
  const send = relay(url, () => state && send(statusMsg()))
  runLeap(
    (s) => {
      state = s
      console.log(STATUS_TEXT[s])
      send(statusMsg())
    },
    (frame) => send({ kind: "frame", frame }),
  )
}

const runDoctor = async () => {
  const lib = LIB_CANDIDATES.find((p) => existsSync(p))
  console.log(lib ? `✓ LeapC library: ${lib}` : `✗ LeapC library not found — ${INSTALL_HINT}`)
  if (!lib) process.exit(1)
  let frames = 0
  let hands = 0
  let last: LeapState | undefined
  const stop = runLeap(
    (s) => {
      last = s
      console.log(`${s === "ready" ? "✓" : "…"} ${STATUS_TEXT[s]}`)
    },
    (f) => {
      frames++
      hands = f.hands.length
      if (frames % 30 === 0) {
        const h = f.hands[0]
        console.log(
          `  ${f.hands.length} hand(s)` +
            (h ? ` · ${h.side} palm (${h.palm.position.map((v) => v.toFixed(0)).join(", ")}) mm · pinch ${h.pinch?.toFixed(2)} · grab ${h.grab?.toFixed(2)}` : ""),
        )
      }
    },
  )
  await Bun.sleep(6000)
  stop()
  if (last !== "ready") console.log(`✗ ${STATUS_TEXT[last ?? "noservice"]}`)
  else console.log(frames ? `✓ ${frames} frames in 6 s (last: ${hands} hand(s))` : "✓ controller ready — hold a hand ~20 cm above it to see frames")
  process.exit(last === "ready" ? 0 : 1)
}

if (import.meta.main) {
  // Spawned by the daemon: our stdin is its pipe, and EOF means the daemon is gone.
  if (process.env.DT_BRIDGE_CHILD === "1") {
    process.stdin.on("end", () => process.exit(0))
    process.stdin.resume()
  }
  if (process.argv.includes("--doctor")) await runDoctor()
  else runBridge()
}
