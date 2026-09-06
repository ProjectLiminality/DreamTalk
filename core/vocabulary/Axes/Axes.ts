import { bool, color, length, scalar } from "../../src/params"
import { restage, together, type Anim, type Windowed } from "../../src/anim"
import { Line, Stroke, dominoWindows, type Vec3Like } from "../../src/parts/primitives"
import { WHITE } from "../../src/constants"

/**
 * A group of strokes drawing as a domino cascade over one span.
 *
 * `restage`, not a bare window, and the reason is in the pydeation source
 * rather than in any frame. Each child's `Animation` is constructed by
 * `CObject.animate` with `rel_run_time = (rel_start_point, rel_end_point)
 * = (0, 1)`, so `rel_duration` is 1 (animation.py:10-20). `Domino` then
 * squeezes it into its window by `rescale_run_time`, which rewrites
 * `rel_run_time` and **leaves `rel_duration` at 1** (animation.py:29-44)
 * — and `rel_duration` is exactly what `play()` multiplies the run time
 * by when it sets the keyframe tangents (`run_time=run_time *
 * rel_duration`, scene.py:990, feeding `smoothing * run_time` into
 * `SetTimeLeft/Right`, scene.py:785-786).
 *
 * So a grid line occupying 0.3 of a 3s draw carries a tangent stated
 * against the whole 3s: a normalized smoothing of 0.25/0.3 = 0.83,
 * clamped at 1 by `smoothingFor`. The cascade's children are therefore
 * far more eased than their windows alone would suggest — many lines
 * visibly *started* and creeping, rather than a few lines racing. That
 * is what the reference shows (video-01 S08 f0608: 18 grid lines carry
 * ink where a 0.25-eased cascade puts 14), and it is a property of the
 * 2021 machinery, not a fit.
 */
const cascade = (lines: readonly Stroke[]): Anim => {
  const windows = dominoWindows(lines.length)
  return together(
    ...lines.map((line, i) =>
      restage(line.creation.sequence(0, 1), windows[i]![0], windows[i]![1]),
    ),
  )
}

/** The same cascade running the erase front instead of the draw front. */
const consume = (lines: readonly Stroke[]): Anim => {
  const windows = dominoWindows(lines.length)
  return together(
    ...lines.map((line, i) =>
      restage(line.erasure.sequence(0, 1), windows[i]![0], windows[i]![1]),
    ),
  )
}

/**
 * Axes with optional grid and ticks — generated entirely from Line
 * parts (symbolic holon: the CPU decides what exists; compose() runs
 * once, so extents/spacing are construction-time). Faithful to the
 * pydeation construction (custom_objects.py): per axis letter in
 * `mode`, one arrowed axis line plus — per `drawGrid` — grid lines of
 * `gridLineLength` centered on the axis at every `gridSpacing` from
 * start to end (0 and the extremes excluded), at half the axes' stroke
 * width, in `gridTint`. In DreamTalk's world the scene plane is XY:
 * an "xy" grid is x-positioned lines running in y plus y-positioned
 * lines running in x (rotate the holon for walls and floors).
 */
export class Axes extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol (pre-pop-out) — cast, not asset. */
  static sovereign = true
  mode = "xy"
  xStart = scalar(-200)
  xEnd = scalar(200)
  yStart = scalar(-200)
  yEnd = scalar(200)
  zStart = scalar(-200)
  zEnd = scalar(200)
  gridSpacing = length(30)
  gridLineLength = length(1000)
  drawGrid = bool(false)
  drawTicks = bool(false)
  arrowEnd = bool(true)
  /** Forwarded to each axis Line — see Line.arrowSize. */
  arrowSize = length(720 / 700)
  gridTint = color(WHITE)

  axisLines: Line[] = []
  gridGroups: Line[][] = []
  tickGroups: Line[][] = []

  protected override compose(): void {
    const spacing = this.gridSpacing.value
    const halfGrid = this.gridLineLength.value / 2
    const extents: Record<string, [number, number]> = {
      x: [this.xStart.value, this.xEnd.value],
      y: [this.yStart.value, this.yEnd.value],
      z: [this.zStart.value, this.zEnd.value],
    }
    // Local frame per axis: its direction, and the in-plane perpendicular
    // its grid lines and ticks run along (pydeation's XZ plane → our XY).
    const frames: Record<string, { dir: Vec3Like; perp: Vec3Like }> = {
      x: { dir: { x: 1, y: 0, z: 0 }, perp: { x: 0, y: 1, z: 0 } },
      y: { dir: { x: 0, y: 1, z: 0 }, perp: { x: 1, y: 0, z: 0 } },
      z: { dir: { x: 0, y: 0, z: 1 }, perp: { x: 1, y: 0, z: 0 } },
    }
    const at = (v: Vec3Like, k: number): Vec3Like => ({ x: v.x * k, y: v.y * k, z: v.z * k })
    const sum = (a: Vec3Like, b: Vec3Like): Vec3Like => ({
      x: a.x + b.x,
      y: a.y + b.y,
      z: a.z + b.z,
    })
    // Grid positions at integer multiples of spacing, most negative
    // first, excluding 0 and the outermost multiple (pydeation's
    // range(1, round(extent / distance)) on both sides).
    const positions = (start: number, end: number): number[] => {
      const out: number[] = []
      // Round the magnitudes so both sides treat half-spacings alike.
      const negCount = Math.round(Math.abs(start) / spacing)
      const posCount = Math.round(end / spacing)
      for (let i = negCount - 1; i >= 1; i--) out.push(-i * spacing)
      for (let i = 1; i < posCount; i++) out.push(i * spacing)
      return out
    }

    for (const axis of this.mode) {
      const frame = frames[axis]
      const extent = extents[axis]
      if (!frame || !extent) continue
      const [start, end] = extent
      this.axisLines.push(
        this.add(
          new Line({
            points: [at(frame.dir, start), at(frame.dir, end)],
            tint: this.tint,
            stroke: this.stroke,
            arrowEnd: this.arrowEnd.value,
            arrowSize: this.arrowSize,
          }),
        ),
      )
      if (this.drawGrid.value) {
        const group: Line[] = []
        for (const pos of positions(start, end)) {
          group.push(
            this.add(
              new Line({
                points: [
                  sum(at(frame.dir, pos), at(frame.perp, -halfGrid)),
                  sum(at(frame.dir, pos), at(frame.perp, halfGrid)),
                ],
                tint: this.gridTint,
                stroke: this.stroke.times(0.5),
              }),
            ),
          )
        }
        this.gridGroups.push(group)
      }
      if (this.drawTicks.value) {
        const group: Line[] = []
        const tickHalf = 5 // pydeation tick_length 10, centered
        const posCount = Math.round(end / spacing)
        const negCount = Math.round(Math.abs(start) / spacing)
        for (let i = -(negCount - 1); i < posCount; i++) {
          group.push(
            this.add(
              new Line({
                points: [
                  sum(at(frame.dir, i * spacing), at(frame.perp, -tickHalf)),
                  sum(at(frame.dir, i * spacing), at(frame.perp, tickHalf)),
                ],
                tint: this.tint,
                stroke: this.stroke,
              }),
            ),
          )
        }
        this.tickGroups.push(group)
      }
    }
  }

  /** CreateAxes: axes draw 0→80%, each grid group dominoes 0→100%, ticks 30→100%. */
  override createAnim(): Anim {
    void this.parts // ensure compose() has generated the line set
    const hasSub = this.gridGroups.length > 0 || this.tickGroups.length > 0
    const items: Windowed[] = [
      [together(...this.axisLines.map((l) => l.creation.sequence(0, 1))), 0, hasSub ? 0.8 : 1],
    ]
    for (const group of this.gridGroups) items.push([cascade(group), 0, 1])
    for (const group of this.tickGroups) items.push([cascade(group), 0.3, 1])
    return together(...items)
  }

  /**
   * UnCreateAxes: built on Erase, not UnDraw (animator.py:881-912) — the
   * axes are consumed from their start over the whole span while the tick
   * dominoes are eaten inside the first 70% of it, so the lattice sweeps
   * away ahead of the line rather than retracting back along it.
   */
  override unCreateAnim(): Anim {
    void this.parts // ensure compose() has generated the line set
    const items: Windowed[] = [
      [together(...this.axisLines.map((l) => l.erasure.sequence(0, 1))), 0, 1],
    ]
    for (const group of this.gridGroups) items.push([consume(group), 0, 1])
    for (const group of this.tickGroups) items.push([consume(group), 0, 0.7])
    return together(...items)
  }
}
