import { BLUE } from "../../src/constants"
import type { Holon, Overrides } from "../../src/holon"
import { derive, integer, length, scalar } from "../../src/params"
import { Circle, Stroke, type Vec3Like } from "../../src/parts/primitives"
import { atArcLength, smooth, streamArc } from "../../src/geometry/flowmap"

/**
 * A stream of particles running along a path — the abstract flow: dots
 * on a line, evenly spaced by arc length, moving at a constant speed, a
 * pure function of `time` (FlowMap's own stream, src/geometry/flowmap.ts
 * `streamArc`, reused rather than restated). Advance `time` linearly and
 * the particles run; scrub it and they run back.
 *
 * What a particle IS is the `symbol` hook: a function that builds one
 * particle holon from the overrides that place it (x, y, z, opacity) —
 * the neutral blue dot by default. The Stream owns and stages them.
 *
 * It answers the FLOW SOURCE contract a Lens reads (vocabulary/Lens):
 * `path()` — the path in this holon's frame — and `particles()` — each
 * particle's place along it as a fraction of its arc length, or −1 while
 * it is "in the pipe" (beyond the path's end, hidden). FlowMap's `Flow`
 * answers the same two questions.
 */
export class Stream extends Stroke {
  /** Particles in the loop (n · spacing is the loop's length). */
  count = integer(16)
  /** Arc length between consecutive particles. */
  spacing = length(70)
  /** Scene units per second. */
  speed = scalar(80)
  /** Seconds of flow — advance it linearly and the particles run. */
  time = scalar(0)
  /** The default dot's radius. */
  radius = length(9)

  private stream!: {
    points: Vec3Like[]
    lengths: number[]
    symbol: (overrides: Overrides, index: number) => Holon
  }
  /** The particle holons, in index order. */
  dots: Holon[] = []

  constructor(
    overrides: Overrides & {
      path?: Vec3Like[]
      symbol?: (overrides: Overrides, index: number) => Holon
    } = {},
  ) {
    const { path, symbol, ...rest } = overrides
    super({ tint: BLUE, ...rest })
    const points = path ?? [
      { x: -500, y: 0, z: 0 },
      { x: 500, y: 0, z: 0 },
    ]
    const lengths = [0]
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!
      const b = points[i]!
      lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z))
    }
    this.stream = {
      points,
      lengths,
      symbol:
        symbol ??
        ((o) => new Circle({ radius: this.radius, tint: this.tint, stroke: 0, fillOpacity: 1, ...o })),
    }
  }

  /** The path, in this holon's frame. */
  path(): Vec3Like[] {
    return this.stream.points
  }

  /** Each particle's place along the path, s ∈ [0, 1], or −1 in the pipe. */
  particles(): number[] {
    const L = this.stream.lengths.at(-1)!
    const n = this.count.value
    return Array.from({ length: n }, (_, j) => {
      const a = streamArc(j, n, this.spacing.value, this.speed.value, this.time.value, 0)
      return a > L ? -1 : a / L
    })
  }

  protected override compose(): void {
    const { points, lengths } = this.stream
    const L = lengths.at(-1)!
    const n = this.count.value
    for (let j = 0; j < n; j++) {
      const at = () => {
        const a = streamArc(j, n, this.spacing.value, this.speed.value, this.time.value, 0)
        const edge = Math.min(24, L / 4)
        const fade = a > L ? 0 : smooth(0, edge, a) * smooth(L, L - edge, a)
        return { p: atArcLength(points, lengths, Math.min(a, L)), fade }
      }
      const dot = this.stream.symbol(
        {
          x: derive(() => at().p.x),
          y: derive(() => at().p.y),
          z: derive(() => at().p.z),
          opacity: derive(() => at().fade * this.opacity.value),
        },
        j,
      )
      this.dots.push(dot)
      this.add(dot)
    }
  }
}
