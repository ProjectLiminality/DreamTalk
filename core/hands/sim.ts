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
  /** Turn about +y, radians (0: fingers point at the screen, −z; +: counter-clockwise seen from above). */
  yaw?: number
  /** Tilt about the hand's sideways axis, radians (+: fingers up — knuckles up for a fist). */
  pitch?: number
  /** Roll about the fingers' axis, radians (+: counter-clockwise seen from the wrist looking along the fingers). */
  roll?: number
  /** Per-digit curl 0..1, thumb first — a hand shape (a mudra); overrides `grab` digit by digit. */
  curls?: [number, number, number, number, number]
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
// A fist as David makes one (measured on his Leap, 2026-10-15): the thumb lies
// ACROSS the curled index and middle, its tip ~0.41–0.45 hand sizes from the
// index tip — not on it (that is a pinch).
/** How far the fingers close before the thumb starts to wrap. */
const THUMB_LAG = 0.5
/**
 * The control points of the thumb's wrap (a quadratic Bézier from open to
 * fist): only the tip bends — it swings out over the closing fingers, which
 * keeps it ≥ 0.40 hand sizes from the index tip all the way (searched, so a
 * closing fist never reads as a pinch); the other joints go straight.
 */
const THUMB_WRAP: Vec3[] = [
  [-20, -8, -25],
  [-39, -16, -47.5],
  [-36.5, -27, -68.5],
  [20, -30, -115],
]
const THUMB_FIST: Vec3[] = [
  [-20, -8, -25],
  [-36, -22, -45],
  [-18, -42, -62],
  [5, -48, -70],
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
  const curl = (d: number) => Math.min(1, Math.max(0, pose.curls?.[d] ?? g))
  // The thumb closes after the fingers and wraps AROUND the curled index (a
  // curved path through THUMB_WRAP), so a fist never passes through a pinch.
  const tc = pose.curls ? curl(0) : Math.max(0, (g - THUMB_LAG) / (1 - THUMB_LAG))
  const thumb = THUMB_OPEN.map((p, i) => {
    const a = mix(p, THUMB_WRAP[i]!, tc)
    const b = mix(THUMB_WRAP[i]!, THUMB_FIST[i]!, tc)
    return mix(a, b, tc)
  })
  const fingers = MCP.map((m, i) => finger(m, SEG[i]!, curl(i + 1)))
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
  const cr = Math.cos(pose.roll ?? 0)
  const sr = Math.sin(pose.roll ?? 0)
  return local.map(([xm, ym, z0]) => {
    // roll about the fingers' axis (z), then pitch about x (+ lifts the fingers:
    // −z turns toward +y), then yaw about y — all about the wrist
    const xf = xm * flip
    const x = xf * cr - ym * sr
    const y0 = xf * sr + ym * cr
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
const DEG30 = Math.PI / 6
const DEG40 = (40 * Math.PI) / 180

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
  /**
   * David's natural pinch: the other three fingers curled, the index bent
   * down to the thumb — closed twice. Its least-curled tip stays far from the
   * palm (a pinch, not a fist).
   */
  "pinch-curled": [
    { t: 0, right: { ...open(0), curls: [0, 0, 1, 1, 1] } },
    { t: 0.6, right: { ...open(0), curls: [0, 0, 1, 1, 1] } },
    { t: 0.8, right: { ...open(0), pinch: 1, curls: [0, 0, 1, 1, 1] } },
    { t: 1.1, right: { ...open(0), pinch: 1, curls: [0, 0, 1, 1, 1] } },
    { t: 1.3, right: { ...open(0), curls: [0, 0, 1, 1, 1] } },
    { t: 1.8, right: { ...open(0), curls: [0, 0, 1, 1, 1] } },
    { t: 2.0, right: { ...open(0), pinch: 1, curls: [0, 0, 1, 1, 1] } },
    { t: 2.3, right: { ...open(0), pinch: 1, curls: [0, 0, 1, 1, 1] } },
    { t: 2.5, right: { ...open(0), curls: [0, 0, 1, 1, 1] } },
    { t: 3.0, right: { ...open(0), curls: [0, 0, 1, 1, 1] } },
  ],
  /**
   * A LEFT fist closes, then turns on each axis and back, ~1 s each: yaw 40°
   * clockwise seen from above (yaw −0.70), pitch 30° knuckles up, roll 30°
   * (counter-clockwise from the wrist) — then opens. For the 6-DoF hold.
   */
  "fist-turn": [
    { t: 0, left: open(-40) },
    { t: 0.3, left: open(-40) },
    { t: 0.7, left: { ...open(-40), grab: 1 } },
    { t: 1.7, left: { ...open(-40), grab: 1, yaw: -DEG40 } },
    { t: 2.7, left: { ...open(-40), grab: 1 } },
    { t: 3.7, left: { ...open(-40), grab: 1, pitch: DEG30 } },
    { t: 4.7, left: { ...open(-40), grab: 1 } },
    { t: 5.7, left: { ...open(-40), grab: 1, roll: DEG30 } },
    { t: 6.7, left: { ...open(-40), grab: 1 } },
    { t: 7.1, left: open(-40) },
    { t: 7.5, left: open(-40) },
  ],
  /** A LEFT fist closes and carries 60 mm right, 40 mm up, 50 mm toward the screen, then opens. */
  "fist-carry": [
    { t: 0, left: open(-40) },
    { t: 0.3, left: open(-40) },
    { t: 0.7, left: { ...open(-40), grab: 1 } },
    { t: 2.2, left: { ...open(20, 40, -50), grab: 1 } },
    { t: 2.6, left: open(20, 40, -50) },
    { t: 3.0, left: open(20, 40, -50) },
  ],
  /**
   * Left fist, then right; they spread from 160 to 320 mm apart, turn
   * together 30° about the vertical (steering), both wrists twist 25° about
   * the line between them, then open.
   */
  "two-fists": twoFists(),
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

/** two-fists: hands on a line through the box centre, `half` mm from it, the line turned `turn` about +y. */
function twoFists(): SimKey[] {
  const pair = (half: number, turn: number, twist: number, lg: number, rg: number): Omit<SimKey, "t"> => {
    const c = Math.cos(turn)
    const s = Math.sin(turn)
    // The line between the hands is x turned by `turn`; twisting about it is a pitch for both (in their own frames).
    const place = (sign: number, g: number) => ({ ...open(sign * half * c, 0, -sign * half * s), grab: g, yaw: turn, pitch: twist })
    return { left: place(-1, lg), right: place(1, rg) }
  }
  const keys: SimKey[] = [
    { t: 0, ...pair(80, 0, 0, 0, 0) },
    { t: 0.4, ...pair(80, 0, 0, 1, 0) },
    { t: 0.8, ...pair(80, 0, 0, 1, 1) },
    { t: 2.3, ...pair(160, 0, 0, 1, 1) },
  ]
  // The steering turn as an arc (four steps), not a chord.
  for (let k = 1; k <= 4; k++) keys.push({ t: 2.3 + k * 0.3, ...pair(160, (DEG30 * k) / 4, 0, 1, 1) })
  keys.push({ t: 4.4, ...pair(160, DEG30, (25 * Math.PI) / 180, 1, 1) })
  keys.push({ t: 4.8, ...pair(160, DEG30, (25 * Math.PI) / 180, 0, 0) })
  keys.push({ t: 5.2, ...pair(160, DEG30, (25 * Math.PI) / 180, 0, 0) })
  return keys
}

const smooth = (u: number) => u * u * (3 - 2 * u)
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

const poseBetween = (a: Omit<HandPose, "side">, b: Omit<HandPose, "side">, u: number): Omit<HandPose, "side"> => ({
  at: mix(a.at, b.at, u),
  pinch: lerp(a.pinch, b.pinch, u),
  grab: lerp(a.grab, b.grab, u),
  yaw: lerp(a.yaw ?? 0, b.yaw ?? 0, u),
  pitch: lerp(a.pitch ?? 0, b.pitch ?? 0, u),
  roll: lerp(a.roll ?? 0, b.roll ?? 0, u),
  ...(a.curls || b.curls
    ? { curls: [0, 1, 2, 3, 4].map((d) => lerp(a.curls?.[d] ?? a.grab, b.curls?.[d] ?? b.grab, u)) as HandPose["curls"] }
    : {}),
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

/** The sim's own sampling rate (what a played script emits, stall or no stall). */
export const SIM_FPS = 60

/** The script sampled at `fps` over its whole span. */
export const simFrames = (keys: readonly SimKey[], fps = SIM_FPS): HandFrame[] => {
  const end = keys[keys.length - 1]!.t
  const n = Math.floor(end * fps) + 1
  return Array.from({ length: n }, (_, k) => simFrameAt(keys, k / fps))
}

/** A script's span, seconds. */
export const simDuration = (keys: readonly SimKey[]): number => keys[keys.length - 1]?.t ?? 0

// --- pinching at given screen points -------------------------------------------

/** A screen point (the gesture layer's space: x, y ∈ [0, 1], y down) → the frame, at the box's depth. */
export const screenToFrame = (x: number, y: number, box: HandBox = LEAP_BOX): Vec3 => [
  box.center[0] + (x - 0.5) * box.size[0],
  box.center[1] + (0.5 - y) * box.size[1],
  box.center[2],
]

/** Where the fingers meet at a full pinch, relative to the wrist (a right hand, unturned). */
const contactOffset = (): Vec3 => {
  const j = poseJoints({ side: "right", at: [0, 0, 0], pinch: 1, grab: 0 })
  return mix(j[4]!, j[8]!, 0.5)
}

/**
 * A right hand that comes to rest over each target, pinches so the tips meet
 * exactly there — the thumb travelling much less than the index, as
 * poseJoints models it — and lets go. `contacts` are the truths a
 * thumb-bias calibration should recover: where and when each pinch closed.
 * The open hand's thumb–index midpoint is NOT over the target: that offset
 * is the bias.
 */
export const pinchAtScript = (
  targets: readonly (readonly [number, number])[],
  box: HandBox = LEAP_BOX,
): { keys: SimKey[]; contacts: { x: number; y: number; t: number }[] } => {
  const off = contactOffset()
  const wristFor = ([x, y]: readonly [number, number]): Vec3 => {
    const p = screenToFrame(x, y, box)
    return [p[0] - off[0], p[1] - off[1], p[2] - off[2]]
  }
  const keys: SimKey[] = []
  const contacts: { x: number; y: number; t: number }[] = []
  let t = 0
  for (const target of targets) {
    const at = wristFor(target)
    keys.push({ t, right: { at, pinch: 0, grab: 0 } }) // arrived (from the last target: 0.6 s of travel)
    keys.push({ t: t + 0.3, right: { at, pinch: 0, grab: 0 } }) // hover, still
    keys.push({ t: t + 0.5, right: { at, pinch: 1, grab: 0 } }) // closed: the click
    contacts.push({ x: target[0], y: target[1], t: t + 0.5 })
    keys.push({ t: t + 0.7, right: { at, pinch: 1, grab: 0 } })
    keys.push({ t: t + 0.9, right: { at, pinch: 0, grab: 0 } })
    t += 1.5
  }
  return { keys, contacts }
}

/** The five calibration targets: the centre and four towards the corners. */
export const PINCH_TARGETS: readonly (readonly [number, number])[] = [
  [0.5, 0.5],
  [0.25, 0.3],
  [0.75, 0.3],
  [0.25, 0.7],
  [0.75, 0.7],
]

// --- simulated mudras (shapes only — David's own come from his recordings) -----

const GYAN: [number, number, number, number, number] = [0, 0, 0, 0, 0]
const POINT: [number, number, number, number, number] = [0.9, 0, 1, 1, 1]

/** Named simulated mudras: `gyan` (thumb and index touch, the rest open) held 3×; `point-circle` (index out, the rest folded) drawing a circle 3×. */
export const SIM_MUDRAS: Record<string, SimKey[]> = {
  gyan: [0, 1, 2].flatMap((k) => {
    const t = k * 2
    return [
      { t, right: { ...open(0), curls: GYAN } },
      { t: t + 0.4, right: { ...open(0), pinch: 1, curls: GYAN } },
      { t: t + 1.2, right: { ...open(0), pinch: 1, curls: GYAN } },
      { t: t + 1.6, right: { ...open(0), curls: GYAN } },
    ]
  }),
  "point-circle": [
    { t: 0, right: { ...open(0), curls: [0, 0, 0, 0, 0] } },
    { t: 0.4, right: { ...open(50), curls: POINT } },
    ...Array.from({ length: 3 * 8 }, (_, i) => {
      const a = ((i + 1) / 8) * 2 * Math.PI
      return { t: 0.4 + (i + 1) * 0.15, right: { ...open(Math.cos(a) * 50, Math.sin(a) * 50), curls: POINT } }
    }),
    { t: 4.4, right: { ...open(50), curls: [0, 0, 0, 0, 0] } },
  ],
}
