import type { Observer } from "../../src/dream"
import type { Overrides } from "../../src/holon"
import { derive, length } from "../../src/params"
import { Line, Stroke } from "../../src/parts/primitives"
import { derivePoints } from "../../src/parts/soliddrawing"
import { wordOutline, type FontData } from "../../src/geometry/glyphs"
import { ARIMO } from "../../src/geometry/fonts/arimo"

/**
 * A written word as CURVES: one closed Line per glyph contour, filled
 * solid across all of them by even-odd — so an "o" keeps its counter and
 * an "é" its accent — from a font baked as data (src/geometry/glyphs.ts).
 *
 * It exists so a symbol can BECOME its word and back (vocabulary/Morph,
 * `MorphToWord`): "Words are symbols of symbols, twice removed from
 * reality. DreamTalk symbols are the universal layer beneath language."
 * The Text holon writes words beautifully but asynchronously, in the
 * renderer; a morph needs them as curves, now.
 *
 * With `observer`, the word faces the camera (laid in its right/up
 * plane, re-laid as the camera moves); without, it lies in its local XY
 * plane like any 2D shape.
 */
export class Word extends Stroke {
  /** The em size, scene units. */
  size = length(100)

  private spec!: { text: string; font: FontData; observer?: Observer }
  /** One closed Line per contour, in reading order. */
  contours: Line[] = []

  constructor(text: string, overrides: Overrides & { font?: FontData; observer?: Observer } = {}) {
    const { font, observer, ...rest } = overrides
    const turn = observer
      ? {
          h: derive(() => facing(observer).h),
          p: derive(() => facing(observer).p),
          b: derive(() => facing(observer).b),
        }
      : {}
    super({ fillOpacity: 1, ...turn, ...rest })
    this.spec = { text, font: font ?? ARIMO, observer }
  }

  /** The observer it faces, if any. */
  get observer(): Observer | undefined {
    return this.spec.observer
  }

  /** The word it writes. */
  get text(): string {
    return this.spec.text
  }

  protected override compose(): void {
    const flat = wordOutline(this.spec.text, this.spec.font, { size: 1 })
    flat.forEach((contour) => {
      const line = new Line({ tint: this.tint, stroke: this.stroke, opacity: this.opacity, creation: this.creation })
      derivePoints(
        line,
        () => [this.size.value],
        () => {
          const k = this.size.value
          return contour.map((p) => ({ x: p.x * k, y: p.y * k, z: 0 }))
        },
      )
      this.contours.push(line)
      this.add(line)
    })
  }
}

/**
 * Facing the camera: the rotation (rotHPB's order, M = Rz(b)·Rx(p)·Ry(h))
 * whose x is the camera's right and y its up — so a Word's contours stay
 * in its own XY plane (where the host's even-odd fill triangulates them)
 * and the WORD turns, rather than its points.
 */
export const facing = (o: Observer): { h: number; p: number; b: number } => {
  const phi = o.phi.value
  const th = o.theta.value
  const ez = { x: Math.sin(phi) * Math.cos(th), y: Math.sin(th), z: Math.cos(phi) * Math.cos(th) }
  const ex = { x: Math.cos(phi), y: 0, z: -Math.sin(phi) }
  const ey = { x: ez.y * ex.z - ez.z * ex.y, y: ez.z * ex.x - ez.x * ex.z, z: ez.x * ex.y - ez.y * ex.x }
  return { p: Math.asin(Math.max(-1, Math.min(1, ey.z))), b: Math.atan2(-ey.x, ey.y), h: Math.atan2(-ex.z, ez.z) }
}
