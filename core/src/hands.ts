/**
 * hands.ts — the canonical hand frame: one shape for every hand source.
 *
 * David (2026-10-15): grab the whole scene to turn it, pinch in mid-air
 * where the fingers meet to click a sub-symbol, a hover cursor like the
 * reMarkable pen hovering — and every hand movement recordable with the
 * voice describing it, so the mapping is tuned from real data.
 *
 * Sources (core/hands/): a webcam (MediaPipe), the Leap Motion (through
 * the studio daemon), a recorded session played back, a scripted
 * simulation. They all speak HandFrame; the interaction layer reads only
 * this.
 *
 * THE FRAME. Millimetres, device-centred, right-handed — the Leap's own
 * convention, so its frames pass through untouched:
 *   +x  the user's right
 *   +y  up, away from the desk (the device)
 *   +z  toward the user, away from the screen
 * The webcam estimates the same frame (depth from the hand's known size);
 * its numbers are approximate, its directions are right.
 *
 * THE SKELETON. MediaPipe's 21 landmarks (`J`), for every source: the Leap's
 * four bones per digit map onto it (`leapJoints`, core/hands/leap.ts).
 *
 * INTO THE VIEW. Each source states the comfortable volume a hand works in
 * (`box`); `toNdc` maps a point into [-1, 1]³ over it — x, y as the screen's
 * NDC (raycast from there), z +1 near the user, −1 reaching toward the
 * screen. The interaction layer decides what a pinch or a grab means.
 */

export type Vec3 = [number, number, number]
export type Side = "left" | "right"
export type HandSourceKind = "webcam" | "leap" | "replay" | "sim"

/** The 21 joints, named. Index into `Hand.joints`. */
export const J = {
  wrist: 0,
  thumbCmc: 1,
  thumbMcp: 2,
  thumbIp: 3,
  thumbTip: 4,
  indexMcp: 5,
  indexPip: 6,
  indexDip: 7,
  indexTip: 8,
  middleMcp: 9,
  middlePip: 10,
  middleDip: 11,
  middleTip: 12,
  ringMcp: 13,
  ringPip: 14,
  ringDip: 15,
  ringTip: 16,
  pinkyMcp: 17,
  pinkyPip: 18,
  pinkyDip: 19,
  pinkyTip: 20,
} as const
export type JointName = keyof typeof J
export const JOINT_COUNT = 21

/** The fingertips, thumb first. */
export const TIPS = [J.thumbTip, J.indexTip, J.middleTip, J.ringTip, J.pinkyTip] as const

/** The skeleton's bones as joint pairs — for drawing it. */
export const BONES: readonly [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
]

export interface Palm {
  position: Vec3
  /** Unit vector out of the palm (down, for a hand held flat palm-down). */
  normal: Vec3
  /** Unit vector from the wrist toward the fingers. */
  direction: Vec3
  /** mm */
  width: number
}

export interface Hand {
  /** Track id: stable while the hand stays seen, new when it comes back. */
  id: number
  side: Side
  /** 21 points, indexed by `J`. */
  joints: Vec3[]
  palm: Palm
  /** The device's own pinch strength, 0..1 (the Leap gives one). */
  pinch?: number
  /** The device's own grab strength, 0..1 (the Leap gives one). */
  grab?: number
  /** The device's own thumb–index distance, mm (the Leap gives one). */
  pinchDistance?: number
  /** 0..1 */
  confidence: number
}

/** The comfortable interaction volume of a source, in its frame. */
export interface HandBox {
  center: Vec3
  size: Vec3
}

export interface HandFrame {
  /**
   * Seconds on the source's monotonic clock. In a recorded session
   * (refs/sessions/<id>/hands.jsonl) it is re-stamped onto the session's one
   * clock: seconds since the session began — the voice's t = 0.
   */
  t: number
  source: HandSourceKind
  hands: Hand[]
  box: HandBox
}

/** Where a hand works over a Leap lying on the desk (the legacy InteractionBox, a little roomier). */
export const LEAP_BOX: HandBox = { center: [0, 230, 0], size: [260, 240, 180] }

/**
 * Where a hand works in front of a webcam: the frame's origin sits on the
 * optical axis WEBCAM_DEPTH mm out from the lens; hands mostly rest below it.
 */
export const WEBCAM_DEPTH = 500
export const WEBCAM_BOX: HandBox = { center: [0, -60, 0], size: [420, 300, 300] }

/** A point in the source's frame → [-1, 1]³ over its box (unclamped). */
export const toNdc = (p: Vec3, box: HandBox): Vec3 => [
  (2 * (p[0] - box.center[0])) / box.size[0],
  (2 * (p[1] - box.center[1])) / box.size[1],
  (2 * (p[2] - box.center[2])) / box.size[2],
]

// --- small vector helpers (local: hands are their own little world) -------

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
export const lerp3 = (a: Vec3, b: Vec3, u: number): Vec3 => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
  a[2] + (b[2] - a[2]) * u,
]
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]
}

/**
 * A palm read off the joints — for sources that give only the skeleton.
 * Position: the middle of wrist and the four knuckles; normal out of the
 * palm by the hand's side; width across the knuckles, padded to the hand's
 * edges.
 */
export const palmOf = (joints: Vec3[], side: Side): Palm => {
  const w = joints[J.wrist]!
  const i = joints[J.indexMcp]!
  const m = joints[J.middleMcp]!
  const r = joints[J.ringMcp]!
  const p = joints[J.pinkyMcp]!
  const position = scale(add(add(add(w, i), add(m, r)), p), 1 / 5)
  const a = sub(i, w)
  const b = sub(p, w)
  return {
    position,
    normal: normalize(side === "right" ? cross(a, b) : cross(b, a)),
    direction: normalize(sub(m, w)),
    width: dist(i, p) * 1.25,
  }
}

/** The hand of `side` in a frame, if seen. */
export const handOf = (frame: HandFrame, side: Side): Hand | undefined => frame.hands.find((h) => h.side === side)

// --- recorded sessions: hands.jsonl, one HandFrame per line ----------------

/** Numbers rounded to 0.1 mm / 0.001 — a session file stays small and diffable. */
const round = (v: number, k: number) => Math.round(v * k) / k
const roundVec = (v: Vec3): Vec3 => [round(v[0], 10), round(v[1], 10), round(v[2], 10)]

export const encodeFrame = (f: HandFrame): string =>
  JSON.stringify({
    t: round(f.t, 10000),
    source: f.source,
    box: f.box,
    hands: f.hands.map((h) => ({
      id: h.id,
      side: h.side,
      confidence: round(h.confidence, 1000),
      ...(h.pinch === undefined ? {} : { pinch: round(h.pinch, 1000) }),
      ...(h.grab === undefined ? {} : { grab: round(h.grab, 1000) }),
      ...(h.pinchDistance === undefined ? {} : { pinchDistance: round(h.pinchDistance, 10) }),
      palm: {
        position: roundVec(h.palm.position),
        normal: h.palm.normal.map((v) => round(v, 1000)) as Vec3,
        direction: h.palm.direction.map((v) => round(v, 1000)) as Vec3,
        width: round(h.palm.width, 10),
      },
      joints: h.joints.map(roundVec),
    })),
  })

/** Lines of a session's frames.jsonl → frames in time order; blank or broken lines are skipped. */
export const decodeFrames = (jsonl: string): HandFrame[] => {
  const frames: HandFrame[] = []
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue
    try {
      const f = JSON.parse(line) as HandFrame
      if (typeof f.t === "number" && Array.isArray(f.hands)) frames.push(f)
    } catch {
      // a line cut off by a crash mid-write: the rest of the session still plays
    }
  }
  return frames.sort((a, b) => a.t - b.t)
}

/** The last frame at or before t (binary search); undefined before the first. */
export const frameAt = (frames: readonly HandFrame[], t: number): HandFrame | undefined => {
  let lo = 0
  let hi = frames.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (frames[mid]!.t <= t) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found < 0 ? undefined : frames[found]
}

// --- the wire: the daemon's /ws/hands (scripts/leap-bridge.ts → pages) ------

/**
 * Where the Leap stands, one word each: `nolib` the tracking software is not
 * installed · `noservice` it is installed but its service is not answering ·
 * `nodevice` the service runs, no controller plugged in · `ready` frames flow.
 */
export type LeapState = "nolib" | "noservice" | "nodevice" | "ready"

export type HandMessage = { kind: "frame"; frame: HandFrame } | { kind: "status"; state: LeapState; text: string }

// --- a hand source ---------------------------------------------------------

/** What every source is. Hosts start it; frames arrive as they are seen. */
export interface HandSource {
  readonly kind: HandSourceKind
  /** A short human line: "webcam · 2 hands", "Leap not found — …". */
  readonly status: string
  start(): Promise<void>
  stop(): void
  onFrame(fn: (f: HandFrame) => void): () => void
  onStatus(fn: (s: string) => void): () => void
}

/** The listener plumbing every source shares. */
export class HandEmitter {
  #frames = new Set<(f: HandFrame) => void>()
  #status = new Set<(s: string) => void>()
  status = ""
  last: HandFrame | undefined
  onFrame(fn: (f: HandFrame) => void): () => void {
    this.#frames.add(fn)
    return () => this.#frames.delete(fn)
  }
  onStatus(fn: (s: string) => void): () => void {
    this.#status.add(fn)
    fn(this.status)
    return () => this.#status.delete(fn)
  }
  emit(f: HandFrame) {
    this.last = f
    for (const fn of this.#frames) fn(f)
  }
  say(s: string) {
    if (s === this.status) return
    this.status = s
    for (const fn of this.#status) fn(s)
  }
}
