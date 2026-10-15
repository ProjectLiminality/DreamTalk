/**
 * sim.ts — a scripted hand, for tests and for working without a device.
 *
 * `poseHand` builds a plausible 21-joint hand from a few numbers (where the
 * palm is, how far it pinches, how far it grabs, how it is turned);
 * `SIM_SCRIPTS` are named trajectories over those numbers — hover, pinch,
 * drag, grab-turn, two-hand spread — and `simFrames` samples one into
 * HandFrames. Pure: same script, same frames.
 *
 * The pinch is modelled as David described his own: the thumb moves much
 * less than the index, so the fingers meet nearer the thumb (PINCH_BIAS of
 * the way from the thumb's rest to the index's). The interaction layer's
 * bias correction can be tested against exactly that.
 */

import {
  LEAP_BOX,
  palmOf,
  type Hand,
  type HandBox,
  type HandFrame,
  type HandSourceKind,
  type Side,
  type Vec3,
} from "../src/hands"

/** Where on the thumb→index line the tips meet: 0 at the thumb, 1 at the index. */
export const PINCH_BIAS = 0.3
/** The tips' gap at a full pinch, mm (tip points sit inside the finger pads). */
export const PINCH_GAP = 8

export interface HandPose {
  side: Side
  /** The wrist, in the frame (mm). */
  at: Vec3
  /** 0 open … 1 thumb and index tips meet. */
  pinch: number
  /** 0 open … 1 a fist. */
  grab: number
  /** Turn about +y, radians (0: fingers point at the screen, −z). */
  yaw?: number
  /** Tilt about the hand's sideways axis, radians (+: fingers up). */
  pitch?: number
}

// The right hand, palm down, fingers toward −z, wrist at the origin (mm).
const MCP: Vec3[] = [
  [-24, 0, -88],
  [-4, 0, -92],
  [15, -2, -86],
  [32, -5, -76],
]
const SEG: [number, number, number][] = [
  [40, 24, 20],
  [45, 28, 21],
  [42, 27, 21],
  [33, 19, 18],
]
const BEND = [1.35, 1.65, 1.2] // full-fist flexion per joint, radians
const THUMB_OPEN: Vec3[] = [
  [-20, -8, -25],
  [-42, -10, -50],
  [-55, -12, -75],
  [-62, -14, -95],
]
const THUMB_FIST: Vec3[] = [
  [-20, -8, -25],
  [-38, -16, -48],
  [-28, -28, -66],
  [-10, -32, -72],
]

const mix = (a: Vec3, b: Vec3, u: number): Vec3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]

/** A finger from its knuckle, curled by c (0..1): flexion turns −z toward −y. */
const finger = (mcp: Vec3, seg: [number, number, number], c: number): Vec3[] => {
  const out: Vec3[] = [mcp]
  let p = mcp
  let theta = 0
  for (let k = 0; k < 3; k++) {
    theta += BEND[k]! * c
    p = [p[0], p[1] - Math.sin(theta) * seg[k]!, p[2] - Math.cos(theta) * seg[k]!]
    out.push(p)
  }
  return out
}

/** The 21 joints of a pose, in the frame. */
export const poseJoints = (pose: HandPose): Vec3[] => {
  const g = Math.min(1, Math.max(0, pose.grab))
  const pinch = Math.min(1, Math.max(0, pose.pinch)) * (1 - g)
  const thumb = THUMB_OPEN.map((p, i) => mix(p, THUMB_FIST[i]!, g))
  const fingers = MCP.map((m, i) => finger(m, SEG[i]!, g))
  if (pinch > 0) {
    // The index curls a little toward the thumb; both tips travel to the meeting point.
    const index = finger(MCP[0]!, SEG[0]!, 0.35 * pinch)
    const t0 = thumb[3]!
    const i0 = fingers[0]![3]!
    const meet = mix(t0, i0, PINCH_BIAS)
    const dir = [i0[0] - t0[0], i0[1] - t0[1], i0[2] - t0[2]] as Vec3
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1
    const half = PINCH_GAP / 2 / len
    const iTarget: Vec3 = [meet[0] + dir[0] * half, meet[1] + dir[1] * half, meet[2] + dir[2] * half]
    const tTarget: Vec3 = [meet[0] - dir[0] * half, meet[1] - dir[1] * half, meet[2] - dir[2] * half]
    const iShift = mix([0, 0, 0], [iTarget[0] - index[3]![0], iTarget[1] - index[3]![1], iTarget[2] - index[3]![2]], pinch)
    const tShift = mix([0, 0, 0], [tTarget[0] - t0[0], tTarget[1] - t0[1], tTarget[2] - t0[2]], pinch)
    fingers[0] = index.map((p, k) => [p[0] + iShift[0] * [0, 0.25, 0.6, 1][k]!, p[1] + iShift[1] * [0, 0.25, 0.6, 1][k]!, p[2] + iShift[2] * [0, 0.25, 0.6, 1][k]!])
    thumb[2] = [thumb[2]![0] + tShift[0] * 0.5, thumb[2]![1] + tShift[1] * 0.5, thumb[2]![2] + tShift[2] * 0.5]
    thumb[3] = [t0[0] + tShift[0], t0[1] + tShift[1], t0[2] + tShift[2]]
  }
  const local: Vec3[] = [[0, 0, 0], ...thumb, ...fingers.flat()]
  const flip = pose.side === "left" ? -1 : 1
  const yaw = pose.yaw ?? 0
  const pitch = pose.pitch ?? 0
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  return local.map(([x0, y0, z0]) => {
    const x = x0 * flip
    // pitch about x (+ lifts the fingers: −z turns toward +y), then yaw about y
    const y1 = y0 * cp - z0 * sp
    const z1 = y0 * sp + z0 * cp
    return [pose.at[0] + x * cy + z1 * sy, pose.at[1] + y1, pose.at[2] - x * sy + z1 * cy]
  })
}

/** A pose as a canonical Hand. `pinch`/`grab` are reported as a device would. */
export const poseHand = (pose: HandPose, id = pose.side === "left" ? 1 : 2): Hand => {
  const joints = poseJoints(pose)
  return { id, side: pose.side, joints, palm: palmOf(joints, pose.side), pinch: pose.pinch, grab: pose.grab, confidence: 1 }
}

// --- scripts ---------------------------------------------------------------

/** A key of a trajectory: the pose of each hand at t (seconds); absent → hand not seen. */
export interface SimKey {
  t: number
  right?: Omit<HandPose, "side">
  left?: Omit<HandPose, "side">
}

const C = LEAP_BOX.center
const at = (dx: number, dy: number, dz: number): Vec3 => [C[0] + dx, C[1] - 60 + dy, C[2] + 40 + dz]
const open = (x: number, y = 0, z = 0) => ({ at: at(x, y, z), pinch: 0, grab: 0 })

export const SIM_SCRIPTS: Record<string, SimKey[]> = {
  /** An open right hand drawing a slow circle: the hover cursor. */
  hover: Array.from({ length: 9 }, (_, i) => ({
    t: i * 0.5,
    right: open(Math.cos((i / 8) * 2 * Math.PI) * 60, Math.sin((i / 8) * 2 * Math.PI) * 40),
  })),
  /** Still, two clicks: pinch 1.0–1.3 s, 2.2–2.5 s. */
  pinch: [
    { t: 0, right: open(0) },
    { t: 0.8, right: open(0) },
    { t: 1.0, right: { ...open(0), pinch: 1 } },
    { t: 1.3, right: { ...open(0), pinch: 1 } },
    { t: 1.5, right: open(0) },
    { t: 2.0, right: open(0) },
    { t: 2.2, right: { ...open(0), pinch: 1 } },
    { t: 2.5, right: { ...open(0), pinch: 1 } },
    { t: 2.7, right: open(0) },
    { t: 3.2, right: open(0) },
  ],
  /** Pinch, carry 120 mm to the right, release. */
  drag: [
    { t: 0, right: open(-60) },
    { t: 0.6, right: open(-60) },
    { t: 0.8, right: { ...open(-60), pinch: 1 } },
    { t: 2.0, right: { ...open(60), pinch: 1 } },
    { t: 2.2, right: open(60) },
    { t: 2.8, right: open(60) },
  ],
  /** A fist closes on the scene, sweeps it around (yaw), and lets go. */
  "grab-turn": [
    { t: 0, right: open(-40) },
    { t: 0.5, right: open(-40) },
    { t: 0.8, right: { ...open(-40), grab: 1 } },
    { t: 2.2, right: { ...open(60, 0, -20), grab: 1, yaw: 0.6 } },
    { t: 2.5, right: { ...open(60, 0, -20), yaw: 0.6 } },
    { t: 3.0, right: { ...open(60, 0, -20), yaw: 0.6 } },
  ],
  /** Both hands grab and draw apart: the zoom. */
  spread: [
    { t: 0, left: open(-50), right: open(50) },
    { t: 0.5, left: { ...open(-50), grab: 1 }, right: { ...open(50), grab: 1 } },
    { t: 2.0, left: { ...open(-120), grab: 1 }, right: { ...open(120), grab: 1 } },
    { t: 2.3, left: open(-120), right: open(120) },
    { t: 2.8, left: open(-120), right: open(120) },
  ],
}

const smooth = (u: number) => u * u * (3 - 2 * u)
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

const poseBetween = (a: Omit<HandPose, "side">, b: Omit<HandPose, "side">, u: number): Omit<HandPose, "side"> => ({
  at: mix(a.at, b.at, u),
  pinch: lerp(a.pinch, b.pinch, u),
  grab: lerp(a.grab, b.grab, u),
  yaw: lerp(a.yaw ?? 0, b.yaw ?? 0, u),
  pitch: lerp(a.pitch ?? 0, b.pitch ?? 0, u),
})

/** The script's frame at t (clamped to its span). */
export const simFrameAt = (keys: readonly SimKey[], t: number, box: HandBox = LEAP_BOX, source: HandSourceKind = "sim"): HandFrame => {
  let i = 0
  while (i < keys.length - 2 && keys[i + 1]!.t <= t) i++
  const a = keys[i]!
  const b = keys[Math.min(i + 1, keys.length - 1)]!
  const u = b.t > a.t ? smooth(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)))) : 0
  const hands: Hand[] = []
  for (const side of ["left", "right"] as const) {
    const pa = a[side]
    const pb = b[side] ?? pa
    if (pa && pb) hands.push(poseHand({ side, ...poseBetween(pa, pb, u) }))
  }
  return { t, source, hands, box }
}

/** The script sampled at `fps` over its whole span. */
export const simFrames = (keys: readonly SimKey[], fps = 60): HandFrame[] => {
  const end = keys[keys.length - 1]!.t
  const n = Math.floor(end * fps) + 1
  return Array.from({ length: n }, (_, k) => simFrameAt(keys, k / fps))
}

/** A script's span, seconds. */
export const simDuration = (keys: readonly SimKey[]): number => keys[keys.length - 1]?.t ?? 0
