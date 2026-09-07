/**
 * Sketch — a drawing imported from an SVG, as strokes.
 *
 * This is an INVISIBLE ASSET, not a sovereign symbol (ONTOLOGY.md's
 * distinction, the same one that keeps `Line` out of core/vocabulary's
 * cast): a Sketch means nothing by itself. It is a generic mechanism —
 * "load this drawing" — and the meaning lives in the drawing it is
 * given. `david` is a symbol; `Sketch` is the doorway symbols like it
 * come through. Hence no `static sovereign`.
 *
 * The contract is pydeation's `SVG(file_name, line_only=…)`
 * (refs/pydeation-legacy/object/vector_graphics.py:31), which loaded a
 * file, kept each subpath its own spline, centered it, and sized it —
 * and then let the ordinary Sketch & Toon machinery draw it. The same
 * division holds here, and it is the point: a Sketch composes one
 * `Line` per subpath through `compose()`, so an imported drawing renders
 * through the IDENTICAL polyline/ribbon path as a Circle or an Axes.
 * There is no SVG-specific rendering anywhere, and the whole stroke
 * surface — tint, stroke width, erasure, drawReversed — applies to it
 * unchanged, because it is literally the same parts.
 *
 * The geometry arrives as data (`SketchData` from a generated module),
 * never as a file path: the framework runs in a browser and the assets
 * are frozen 2021 drawings, so they are flattened once by
 * core/scripts/svg2ts.ts and committed. See core/vocabulary/Sketch/data.ts.
 */

import { color, length } from "../../src/params"
import { together, type Anim, type Windowed } from "../../src/anim"
import { Line, Stroke, type Vec3Like } from "../../src/parts/primitives"
import { WHITE } from "../../src/constants"
import type { SketchData } from "./data"

/** An empty drawing, so a Sketch with no data is still a valid holon. */
const EMPTY: SketchData = { name: "", source: "", hash: "", subpaths: [], closed: [] }

/** Unpack one flat [x0,y0,x1,y1,…] run into the Line's point form. */
const toPoints = (flat: readonly number[], scale: number): Vec3Like[] => {
  const points: Vec3Like[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    points.push({ x: flat[i]! * scale, y: flat[i + 1]! * scale, z: 0 })
  }
  return points
}

/** Total length of a polyline — the weight a subpath carries in a draw. */
const arcLength = (points: readonly Vec3Like[]): number => {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  }
  return total
}

export class Sketch extends Stroke {
  /**
   * The drawing's height in world units — pydeation's target size, and
   * the only sizing control a scene needs. Aspect is preserved and the
   * result stays centered on the origin, so a Sketch's position means
   * the drawing's center whatever its source canvas was.
   */
  height = length(400)
  override tint = color(WHITE)

  /** The generated asset module. Construction data, not a parameter. */
  data: SketchData = EMPTY

  /** One stroke per subpath, in the source document's order. */
  strokes: Line[] = []

  protected override compose(): void {
    const { subpaths } = this.data
    if (subpaths.length === 0) return
    // The data is centered and y-flipped but unscaled, so the fit to
    // `height` happens here — which keeps `height` a real parameter of
    // the holon rather than something baked into the asset.
    let minY = Infinity
    let maxY = -Infinity
    for (const sp of subpaths) {
      for (let i = 1; i < sp.length; i += 2) {
        const y = sp[i]!
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    const span = maxY - minY
    const scale = span > 1e-9 ? this.height.value / span : 1

    for (const sp of subpaths) {
      const points = toPoints(sp, scale)
      if (points.length < 2) continue
      this.strokes.push(
        this.add(new Line({ points, tint: this.tint, stroke: this.stroke })),
      )
    }
  }

  /**
   * Draw every subpath, each over its own share of the span, weighted by
   * ARC LENGTH — so the pen covers long strokes over proportionally more
   * of the span than short ones and never appears to lurch between them.
   *
   * This is not yet DrawSteady. A true steady draw is one pen at
   * constant speed across the whole drawing, with `stroke_order` deciding
   * which subpath it visits next (pydeation's animator.py:245); that is
   * chapter O-2's work. What this does is the honest v1 of it: sequential,
   * arc-length-normalized windows in document order. The pen's SPEED is
   * therefore already right — a stroke twice as long takes twice as long
   * — and only the ORDER, and the eased in/out at each seam, are still
   * per-subpath rather than global.
   */
  override createAnim(): Anim {
    void this.parts // ensure compose() has generated the stroke set
    return this.sweep(false)
  }

  /** The same walk, retracting — the pen goes back the way it came. */
  override unCreateAnim(): Anim {
    void this.parts
    return this.sweep(true)
  }

  private sweep(retract: boolean): Anim {
    const n = this.strokes.length
    if (n === 0) return { tracks: [] }
    const lengths = this.strokes.map((s) => arcLength(s.points))
    const total = lengths.reduce((a, b) => a + b, 0)
    // A drawing of coincident points has no arc length to divide; fall
    // back to equal shares so it still animates rather than dividing by 0.
    const shares = total > 1e-9 ? lengths.map((l) => l / total) : lengths.map(() => 1 / n)

    const items: Windowed[] = []
    let at = 0
    for (let i = 0; i < n; i++) {
      const stroke = this.strokes[i]!
      const from = at
      at += shares[i]!
      const to = i === n - 1 ? 1 : at
      items.push(
        retract
          ? [stroke.creation.to(0), 1 - to, 1 - from]
          : [stroke.creation.sequence(0, 1), from, to],
      )
    }
    return together(...items)
  }
}
