import type { Overrides } from "../../src/holon"
import { angle, completion, length } from "../../src/params"
import { Line, Stroke, type Vec3Like } from "../../src/parts/primitives"
import { derivePoints, toWorld } from "../../src/parts/soliddrawing"
import { toggle, type StateSpace } from "../../src/automaton"

/**
 * A road, platonic: two edges and a dashed centre line, lying on the
 * ground (local y = 0) along local x, centred on the origin — gently
 * curving by `bend` — and, with `horizon`, the land it runs through: a
 * horizon line behind it and two low hills standing on it. The concrete
 * form of a flow's line — what an arrow becomes under a lens
 * (vocabulary/Lens), via the morph (its Lines are its curves).
 *
 * Riders follow it with `pointAt(s)` and `headingAt(s)` (s = arc length
 * from the middle, −length/2 … length/2; heading is the `h` that turns a
 * +x-facing holon onto the road).
 *
 * `bound` — a world-space predicate — trims every line to where it holds:
 * a lens passes "inside my near face", so the road ends exactly at the
 * lens's rim however it is tilted. Dashes that leave the bound are cut,
 * not dropped, so nothing pops as the road turns.
 */
export class Road extends Stroke {
  /** Length along the centre line. */
  length = length(600)
  /** Width, edge to edge. */
  width = length(70)
  /** Dash length (and the gap after it) of the centre line. */
  dash = length(22)
  /** How far the road turns over its whole length, radians (0 = straight; > 0 bends toward −z, away). */
  bend = angle(0)
  /** The land: 0 = only the road, 1 = a horizon line and two hills behind it. */
  horizon = completion(0)

  /** Walkable (src/automaton.ts): the land behind the road, there or not. */
  override stateSpace(): StateSpace {
    return { axes: [toggle("horizon", this.horizon, { off: ["road", 0], on: ["landscape", 1], handles: [this] })] }
  }

  private bound?: (world: Vec3Like) => boolean
  private boundKey: () => number[] = () => []
  /** The two edges, then the dashes, then the land (horizon, two hills). */
  lines: Line[] = []

  constructor(
    overrides: Overrides & {
      bound?: (world: Vec3Like) => boolean
      /** Numbers that move whenever `bound` would answer differently (e.g. the camera). */
      boundKey?: () => number[]
      dashes?: number
    } = {},
  ) {
    const { bound, boundKey, dashes, ...rest } = overrides
    super(rest)
    this.bound = bound
    if (boundKey) this.boundKey = boundKey
    this.dashSlots = dashes ?? 16
  }
  private dashSlots = 16

  /** The centre line's turn at arc length s (from the middle). */
  private turn(s: number): number {
    return (this.bend.value / Math.max(1e-9, this.length.value)) * s
  }

  /** The point at arc length s along the road, `offset` to its left (toward −z at the start). */
  pointAt(s: number, offset = 0): Vec3Like {
    const k = this.bend.value / Math.max(1e-9, this.length.value)
    const th = k * s
    // The centre line: an arc of curvature k through the origin, tangent +x there.
    const x = Math.abs(k) < 1e-9 ? s : Math.sin(th) / k
    const z = Math.abs(k) < 1e-9 ? 0 : -(1 - Math.cos(th)) / k
    // Its left normal in the ground plane.
    return { x: x - Math.sin(th) * offset, y: 0, z: z - Math.cos(th) * offset }
  }

  /** The `h` that turns a holon facing +x onto the road at arc length s. */
  headingAt(s: number): number {
    return this.turn(s)
  }

  protected override compose(): void {
    const look = { tint: this.tint, stroke: this.stroke, opacity: this.opacity, creation: this.creation }
    const key = () => [
      this.length.value,
      this.width.value,
      this.dash.value,
      this.bend.value,
      this.horizon.value,
      ...this.boundKey(),
    ]
    const make = (shape: () => ((t: number) => Vec3Like) | undefined, samples: number) => {
      const line = new Line(look)
      derivePoints(
        line,
        () => [...key(), ...worldKey(line)],
        () => {
          const at = shape()
          return at ? trimPolyline(at, samples, this.bound ? (p) => this.bound!(toWorld(line, p)) : undefined) : []
        },
      )
      this.lines.push(line)
      this.add(line)
    }
    // The edges.
    for (const side of [-1, 1])
      make(() => {
        const L = this.length.value
        const off = (side * this.width.value) / 2
        return (t) => this.pointAt((t - 0.5) * L, off)
      }, 64)
    // The dashes.
    for (let i = 0; i < this.dashSlots; i++)
      make(() => {
        const L = this.length.value
        const d = this.dash.value
        const s0 = -L / 2 + d / 2 + i * 2 * d
        if (s0 + d > L / 2) return undefined
        return (t) => this.pointAt(s0 + d * t)
      }, 6)
    // The land: a horizon line behind the road (−z, away from a viewer the
    // ground is tipped toward), and two low hills standing on it.
    const far = () => -this.width.value * 1.6
    make(() => {
      if (this.horizon.value <= 0) return undefined
      const L = this.length.value * 1.4
      return (t) => ({ x: (t - 0.5) * L, y: 0, z: far() })
    }, 64)
    for (const [cx, w, h] of [
      [-0.16, 0.17, 0.05],
      [0.1, 0.11, 0.035],
    ] as const)
      make(() => {
        if (this.horizon.value <= 0) return undefined
        const L = this.length.value
        return (t) => ({
          x: cx * L + w * L * Math.cos(Math.PI * (1 - t)),
          y: h * L * Math.sin(Math.PI * t) * this.horizon.value,
          z: far(),
        })
      }, 32)
  }
}

/**
 * A parametric curve t ∈ [0, 1] sampled and trimmed to `inside`: its
 * longest run of inside samples, the ends refined by bisection. Without a
 * predicate, the whole curve.
 */
export const trimPolyline = (
  at: (t: number) => Vec3Like,
  samples: number,
  inside?: (p: Vec3Like) => boolean,
): Vec3Like[] => {
  const pts = Array.from({ length: samples + 1 }, (_, i) => at(i / samples))
  if (!inside) return pts
  let best: [number, number] | undefined
  let start = -1
  for (let i = 0; i <= samples; i++) {
    const ok = inside(pts[i]!)
    if (ok && start < 0) start = i
    if ((!ok || i === samples) && start >= 0) {
      const end = ok ? i : i - 1
      if (!best || end - start > best[1] - best[0]) best = [start, end]
      start = -1
    }
  }
  if (!best) return []
  const refine = (tin: number, tout: number) => {
    for (let k = 0; k < 16; k++) {
      const m = (tin + tout) / 2
      if (inside(at(m))) tin = m
      else tout = m
    }
    return tin
  }
  const t0 = best[0] > 0 ? refine(best[0] / samples, (best[0] - 1) / samples) : 0
  const t1 = best[1] < samples ? refine(best[1] / samples, (best[1] + 1) / samples) : 1
  if (t1 - t0 < 1e-6) return []
  const out = [at(t0)]
  for (let i = best[0] + 1; i < best[1]; i++) out.push(pts[i]!)
  out.push(at(t1))
  return out
}

/** A holon's place in the world, as numbers — so a trim re-runs when the road moves. */
const worldKey = (line: Line): number[] => {
  const o = toWorld(line, { x: 0, y: 0, z: 0 })
  const ex = toWorld(line, { x: 1, y: 0, z: 0 })
  const ez = toWorld(line, { x: 0, y: 0, z: 1 })
  return [o.x, o.y, o.z, ex.x, ex.y, ex.z, ez.x, ez.y, ez.z]
}
