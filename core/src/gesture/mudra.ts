/**
 * Hand talk — mudras as invocations.
 *
 * David (2026-10-15): "dream talk is basically digital sand talk, but there's
 * also hand talk, and these are mudras … with those you can invoke symbols —
 * a form of incantation … you invoke a digital spirit."
 *
 * A MUDRA is a named template learned from examples, not a rule written by
 * hand: record it a few times (a held pose, or a short movement), name it,
 * and the recogniser knows it. Two kinds:
 *
 *   pose     a held configuration of the fingers (and of both hands, for a
 *            two-handed mudra) — matched by nearest neighbour, and must be
 *            HELD for `hold` seconds before it counts;
 *   motion   a short gesture — the normalised pose trajectory plus the palm's
 *            path — matched by dynamic time warping over the recent window.
 *
 * NORMALISED, so a mudra means the same near or far, turned or not, left or
 * right: joints relative to the wrist, in hand sizes, in the hand's own frame
 * (up = wrist → middle root, across = index root → pinky root), a left hand
 * mirrored onto a right one. Confidence is the margin to the next-best class
 * (1 = nothing else is close), so an ambiguous shape never invokes by itself
 * — it becomes a CANDIDATE for the intent layer (jev.ts), which also hears
 * what is being said.
 *
 * REST. A hand at rest is not "no mudra" by itself — an open hand sits close
 * to every open-fingered mudra. Record the hand at rest as a mudra named with
 * a leading underscore (`_rest`): it competes in the matching like any other,
 * so a resting hand matches it and nothing else, but it is never reported as
 * a candidate and never invokes.
 *
 * Pure and frame-clocked: a recorded take recognises the same mudras.
 */

import { J, palm, type Hand, type HandFrame } from "./hand"

export type Pose = number[] // 20 joints × 3 (wrist dropped: it is the origin)

/** A hand in its own frame: wrist at 0, hand sizes, rotation-free, mirrored to right. */
export const normalise = (h: Hand): Pose => {
  const w = h.joints[J.wrist]!
  const s = h.scale || 1
  const rel = (j: readonly number[]) => [(j[0]! - w[0]) / s, (j[1]! - w[1]) / s, (j[2]! - w[2]) / s]
  const up = unit(rel(h.joints[J.middleMcp]!))
  let across = sub(rel(h.joints[J.pinkyMcp]!), rel(h.joints[J.indexMcp]!))
  across = unit(sub(across, scale(up, dot(across, up))))
  // A left hand is a mirror image of a right one. Its own across and up axes
  // already follow the mirror, but the normal built as up × across comes out
  // reversed (a mirror flips handedness): flip it back, and the two hands
  // read alike.
  let normal = cross(up, across)
  if (h.side === "left") normal = scale(normal, -1)
  const out: number[] = []
  for (let i = 1; i < 21; i++) {
    const r = rel(h.joints[i]!)
    out.push(dot(r, across), dot(r, up), dot(r, normal))
  }
  return out
}

export interface MudraExample {
  /** One pose per hand, right hand first (a two-handed mudra has two). */
  poses: Pose[]
  /** For a motion: the sampled trajectory (each entry one time step). */
  path?: { poses: Pose[]; palm: number[] }[]
}

export interface Mudra {
  name: string
  kind: "pose" | "motion"
  hands: 1 | 2
  examples: MudraExample[]
}

export interface Candidate {
  name: string
  /** 0 … 1: the margin to the next-best class. */
  confidence: number
  /** Distance to the best example (lower is closer). */
  distance: number
  t: number
}

export interface RecogniserOpts {
  /** Seconds a pose must be held to invoke. */
  hold?: number
  /** Below this confidence a match is only a candidate, never an invocation. */
  invokeAt?: number
  /** A match farther than this (mean joint distance, hand sizes) is nothing. */
  maxDistance?: number
  /** Seconds of motion window, and samples it is resampled to. */
  window?: number
  samples?: number
  /** Seconds after an invocation before the same mudra can invoke again. */
  refractory?: number
}

const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]!)
const scale = (a: number[], k: number) => a.map((v) => v * k)
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i]!, 0)
const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
const unit = (a: number[]) => {
  const n = Math.hypot(...a) || 1
  return a.map((v) => v / n)
}

/** Mean joint distance between two poses (hand sizes). */
export const poseDistance = (a: Pose, b: Pose): number => {
  let s = 0
  for (let i = 0; i < a.length; i += 3) s += Math.hypot(a[i]! - b[i]!, a[i + 1]! - b[i + 1]!, a[i + 2]! - b[i + 2]!)
  return s / (a.length / 3)
}

const handsOf = (f: HandFrame): Hand[] => [...f.hands].sort((a, b) => (a.side === b.side ? a.id - b.id : a.side === "right" ? -1 : 1))

/** The poses of a frame, right hand first. */
export const framePoses = (f: HandFrame): Pose[] => handsOf(f).map(normalise)

/** Dynamic time warping over two sequences, with a per-step cost. */
export const dtw = <T>(a: readonly T[], b: readonly T[], cost: (x: T, y: T) => number): number => {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return Infinity
  let prev = new Float64Array(m + 1).fill(Infinity)
  prev[0] = 0
  for (let i = 1; i <= n; i++) {
    const cur = new Float64Array(m + 1).fill(Infinity)
    for (let j = 1; j <= m; j++) cur[j] = cost(a[i - 1]!, b[j - 1]!) + Math.min(prev[j]!, cur[j - 1]!, prev[j - 1]!)
    prev = cur
  }
  return prev[m]! / (n + m)
}

/** A trajectory step's distance: the poses, and the palm's path (relative to its start). */
const stepDistance = (x: { poses: Pose[]; palm: number[] }, y: { poses: Pose[]; palm: number[] }): number => {
  let d = 0
  const k = Math.min(x.poses.length, y.poses.length)
  for (let i = 0; i < k; i++) d += poseDistance(x.poses[i]!, y.poses[i]!)
  d /= k || 1
  return d + Math.hypot(...sub(x.palm, y.palm))
}

/** Resample a frame window to n steps: poses, and the palm path in hand sizes from the first palm. */
export const trajectory = (frames: readonly HandFrame[], n: number): { poses: Pose[]; palm: number[] }[] => {
  const usable = frames.filter((f) => f.hands.length > 0)
  if (usable.length === 0) return []
  const first = handsOf(usable[0]!)[0]!
  const p0 = palm(first)
  const s = first.scale || 1
  const t0 = usable[0]!.t
  const t1 = usable[usable.length - 1]!.t
  const out: { poses: Pose[]; palm: number[] }[] = []
  for (let k = 0; k < n; k++) {
    const t = t0 + ((t1 - t0) * k) / Math.max(1, n - 1)
    let f = usable[0]!
    for (const g of usable) if (g.t <= t) f = g
    const h = handsOf(f)[0]!
    const p = palm(h)
    out.push({ poses: framePoses(f), palm: [(p[0] - p0[0]) / s, (p[1] - p0[1]) / s, (p[2] - p0[2]) / s] })
  }
  return out
}

/** Learn a mudra from recorded takes (each take: the frames of one performance). */
export const learn = (name: string, kind: "pose" | "motion", takes: readonly (readonly HandFrame[])[], samples = 16): Mudra => {
  const examples: MudraExample[] = []
  let hands: 1 | 2 = 1
  for (const take of takes) {
    const withHands = take.filter((f) => f.hands.length > 0)
    if (withHands.length === 0) continue
    // A held pose: the middle of the take, away from the onset and the release.
    const mid = withHands[Math.floor(withHands.length / 2)]!
    if (mid.hands.length >= 2) hands = 2
    examples.push({ poses: framePoses(mid), path: kind === "motion" ? trajectory(withHands, samples) : undefined })
  }
  return { name, kind, hands, examples }
}

/** The library, as plain JSON (stored by the browser; fixtures in tests). */
export interface MudraLibrary {
  mudras: Mudra[]
}

/**
 * The streaming recogniser: frames in; this frame's best CANDIDATES out
 * (for the intent layer), and an INVOCATION when a mudra is confident and
 * held (a pose) or completed (a motion).
 */
export class MudraRecogniser {
  readonly hold: number
  readonly invokeAt: number
  readonly maxDistance: number
  readonly window: number
  readonly samples: number
  readonly refractory: number
  library: MudraLibrary
  #frames: HandFrame[] = []
  #held?: { name: string; since: number }
  #lastInvoked = new Map<string, number>()

  constructor(library: MudraLibrary, opts: RecogniserOpts = {}) {
    this.library = library
    this.hold = opts.hold ?? 0.35
    this.invokeAt = opts.invokeAt ?? 0.5
    this.maxDistance = opts.maxDistance ?? 0.35
    this.window = opts.window ?? 1.2
    this.samples = opts.samples ?? 16
    this.refractory = opts.refractory ?? 1.5
  }

  update(frame: HandFrame): { candidates: Candidate[]; invoked?: Candidate } {
    this.#frames.push(frame)
    while (this.#frames.length > 2 && this.#frames[0]!.t < frame.t - this.window) this.#frames.shift()
    const scored: { name: string; d: number }[] = []
    const poses = frame.hands.length > 0 ? framePoses(frame) : []
    let traj: ReturnType<typeof trajectory> | undefined
    for (const m of this.library.mudras) {
      if (poses.length < m.hands) continue
      let best = Infinity
      for (const ex of m.examples) {
        if (m.kind === "pose") {
          let d = 0
          for (let i = 0; i < m.hands; i++) d += poseDistance(poses[i]!, ex.poses[i]!)
          best = Math.min(best, d / m.hands)
        } else if (ex.path) {
          traj ??= trajectory(this.#frames, this.samples)
          best = Math.min(best, dtw(traj, ex.path, stepDistance))
        }
      }
      if (best < Infinity) scored.push({ name: m.name, d: best })
    }
    scored.sort((a, b) => a.d - b.d)
    const candidates: Candidate[] = scored
      .filter((s) => s.d <= this.maxDistance)
      .filter((s) => !s.name.startsWith("_") || s === scored[0]) // rest competes; it is dropped below
      .map((s, i) => {
        const next = scored.find((o, j) => j !== i && o.name !== s.name)
        const margin = next ? Math.min(1, (next.d - s.d) / Math.max(next.d, 1e-9)) : 1
        const closeness = 1 - s.d / this.maxDistance
        return { name: s.name, distance: s.d, confidence: Math.max(0, Math.min(1, margin * closeness * 2)), t: frame.t }
      })
    // The hand at rest wins, or loses, like any class — but is never news.
    const top = candidates[0]?.name.startsWith("_") ? undefined : candidates[0]
    for (let i = candidates.length - 1; i >= 0; i--) if (candidates[i]!.name.startsWith("_")) candidates.splice(i, 1)
    let invoked: Candidate | undefined
    if (top && top.confidence >= this.invokeAt) {
      const kind = this.library.mudras.find((m) => m.name === top.name)!.kind
      if (this.#held?.name !== top.name) this.#held = { name: top.name, since: frame.t }
      const due = kind === "motion" || frame.t - this.#held.since >= this.hold
      const last = this.#lastInvoked.get(top.name)
      if (due && (last === undefined || frame.t - last >= this.refractory)) {
        invoked = top
        this.#lastInvoked.set(top.name, frame.t)
        if (kind === "motion") this.#frames = [] // a completed gesture starts the window afresh
      }
    } else {
      this.#held = undefined
    }
    return { candidates, invoked }
  }
}
