import type { Overrides } from "../../src/holon"
import { length } from "../../src/params"
import { Line, Stroke, type Vec3Like } from "../../src/parts/primitives"
import { derivePoints, toWorld } from "../../src/parts/soliddrawing"

/**
 * A road, platonic: two edges and a dashed centre line, lying on the
 * ground (local y = 0) along local x, centred on the origin. The concrete
 * form of a flow's line — what an arrow becomes under a lens
 * (vocabulary/Lens), via the morph (its Lines are its curves).
 *
 * `bound` — a world-space predicate — trims every line to where it holds:
 * a lens passes "inside my near face", so the road ends exactly at the
 * lens's rim however it is tilted. Dashes that leave the bound are cut,
 * not dropped, so nothing pops as the road turns.
 */
export class Road extends Stroke {
  /** Length along x. */
  length = length(600)
  /** Width across z, edge to edge. */
  width = length(70)
  /** Dash length (and the gap after it) of the centre line. */
  dash = length(22)

  private bound?: (world: Vec3Like) => boolean
  private boundKey: () => number[] = () => []
  /** The two edges, then the dashes. */
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

  /** A straight span sampled, then trimmed to the bound: its longest run inside. */
  private trimmed(line: Line, a: Vec3Like, b: Vec3Like, samples: number): Vec3Like[] {
    const pts = Array.from({ length: samples + 1 }, (_, i) => {
      const t = i / samples
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
    })
    const bound = this.bound
    if (!bound) return [a, b]
    const inside = (p: Vec3Like) => bound(toWorld(line, p))
    // Longest run of inside samples, its ends refined by bisection.
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
    const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })
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

  protected override compose(): void {
    const look = { tint: this.tint, stroke: this.stroke, opacity: this.opacity, creation: this.creation }
    const key = () => [this.length.value, this.width.value, this.dash.value, ...this.boundKey()]
    for (const side of [-1, 1]) {
      const line = new Line(look)
      derivePoints(
        line,
        () => [...key(), ...worldKey(line)],
        () => {
          const L = this.length.value / 2
          const z = (side * this.width.value) / 2
          return this.trimmed(line, { x: -L, y: 0, z }, { x: L, y: 0, z }, 48)
        },
      )
      this.lines.push(line)
      this.add(line)
    }
    for (let i = 0; i < this.dashSlots; i++) {
      const line = new Line(look)
      derivePoints(
        line,
        () => [...key(), ...worldKey(line)],
        () => {
          const L = this.length.value
          const d = this.dash.value
          const x0 = -L / 2 + d / 2 + i * 2 * d
          if (x0 + d > L / 2) return []
          return this.trimmed(line, { x: x0, y: 0, z: 0 }, { x: x0 + d, y: 0, z: 0 }, 6)
        },
      )
      this.lines.push(line)
      this.add(line)
    }
  }
}

/** A holon's place in the world, as numbers — so a trim re-runs when the road moves. */
const worldKey = (line: Line): number[] => {
  const o = toWorld(line, { x: 0, y: 0, z: 0 })
  const ex = toWorld(line, { x: 1, y: 0, z: 0 })
  const ez = toWorld(line, { x: 0, y: 0, z: 1 })
  return [o.x, o.y, o.z, ex.x, ex.y, ex.z, ez.x, ez.y, ez.z]
}
