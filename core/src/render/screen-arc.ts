/**
 * Screen-arc reparametrisation — how Sketch & Toon actually distributes
 * ONE draw parameter along a stroke. Pure (no three.js): the host hands
 * in already-projected points, the tests hand in synthetic ones.
 *
 * ## Why this exists
 *
 * Our ribbon draws by WORLD arc length: `drawn` is a distance in local
 * units and the pen tip sits at that distance along the polyline. That
 * is the obvious model and it is wrong, because Sketch & Toon is not a
 * 3D pen. S&T *renders* the scene, extracts contours as SCREEN-SPACE
 * strokes, and then animates them — which is why pydeation can ask for
 * a stroke speed in `"pixels"` at all (object.py:427, `speed = {…,
 * "pixels": 0, "completion": 2}`) and why S&T states thickness in pixel
 * units against a reference frame size (scene.py:69-74). A stroke's
 * natural length is its length ON THE FRAME, and geometry that falls
 * outside the frame contributes no stroke at all.
 *
 * Two consequences, both visible in video-01 and neither reproducible
 * by world arc length:
 *
 *  1. **Perspective weighting.** A line receding to the horizon spends
 *     most of its world length in a few pixels near the vanishing
 *     point; the pen crosses that stretch almost instantly and dwells
 *     on the near end, where the pixels are.
 *  2. **Off-frame geometry costs nothing.** Scene 01's y-axis runs from
 *     world y=-2000 to y=+400. Under the 2021 rig its start projects to
 *     screen y≈1700 — a thousand pixels BELOW a 720px frame. By world
 *     arc length the pen spends the first 70% of the draw off-screen
 *     and the axis appears only two thirds of the way in. The reference
 *     has it moving in the very first frame of the Create.
 *
 * ## The measurement that settles it (S01's y-axis, refs f0090-f0100)
 *
 * The Create runs video 18.0→21.0 with the axes windowed (0, 0.8). The
 * y-axis pen tip, read straight off the reference frames, against three
 * parametrisations of the same C4D auto-tangent ease — RMSE in pixels:
 *
 *     world arc length            774 px
 *     screen arc, full extent     636 px
 *     screen arc, viewport-clipped 20 px      <- this module
 *
 * Nothing is fitted: all three use the source's own ease and window.
 * The x-axis, an independent line with a different clip, agrees to
 * 10-27px on a 1370px visible chord. A 30x error reduction from a
 * structural hypothesis with zero free parameters is the kind of
 * evidence TASTE asks for.
 *
 * ## What this module computes
 *
 * `screenArcRemap(points, total, view)` walks the projected polyline, measures
 * each segment's ON-SCREEN length (segments wholly outside the viewport
 * contribute 0; a segment straddling an edge contributes its clipped
 * part), and returns a monotone lookup that converts a draw fraction in
 * SCREEN arc into the WORLD arc-length distance the ribbon wants.
 *
 * Degenerate cases fall back to the identity (world arc): a stroke
 * entirely off-screen, entirely behind the camera, or of zero screen
 * length has no screen parametrisation to speak of, and the identity is
 * both the old behaviour and the only stable answer.
 */

/** A polyline point as the host projects it, ready to measure. */
export interface ProjectedPoint {
  /** Screen x in device-independent pixels, or undefined if behind the camera. */
  x: number
  /** Screen y, same convention. */
  y: number
  /** Cumulative WORLD arc length at this point, in the ribbon's local units. */
  world: number
  /** False when the point is behind the near plane (no valid projection). */
  onCamera: boolean
}

export interface Viewport {
  width: number
  height: number
}

/**
 * The fraction of segment [a, b] that lies inside the axis-aligned
 * viewport rectangle, by Liang-Barsky. Returns [t0, t1] with
 * t1 <= t0 when the segment misses the rectangle entirely.
 *
 * Exported for the tests: this is the one piece of real geometry here.
 */
export const clipToViewport = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  view: Viewport,
): [number, number] => {
  const dx = bx - ax
  const dy = by - ay
  let t0 = 0
  let t1 = 1
  const edges: [number, number][] = [
    [-dx, ax - 0],
    [dx, view.width - ax],
    [-dy, ay - 0],
    [dy, view.height - ay],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      // Parallel to this edge: inside iff q >= 0, else the whole
      // segment is out.
      if (q < 0) return [1, 0]
      continue
    }
    const r = q / p
    if (p < 0) {
      if (r > t1) return [1, 0]
      if (r > t0) t0 = r
    } else {
      if (r < t0) return [1, 0]
      if (r < t1) t1 = r
    }
  }
  return [t0, t1]
}

/**
 * A monotone map from draw fraction (0..1 of the stroke's visible screen
 * arc) to WORLD arc-length distance along the same polyline.
 */
export interface ScreenArcRemap {
  /** Total on-screen stroke length in pixels — 0 when nothing is visible. */
  screenLength: number
  /** Draw fraction → world arc-length distance in the ribbon's units. */
  worldAt: (fraction: number) => number
}

/**
 * Build the remap for one projected polyline.
 *
 * `totalWorld` is the ribbon's own `totalLength`, and is what the
 * identity fallback parametrises — so a degenerate stroke silently
 * keeps the old world-arc behaviour instead of vanishing.
 */
export const screenArcRemap = (
  points: readonly ProjectedPoint[],
  totalWorld: number,
  view: Viewport,
): ScreenArcRemap => {
  const identity: ScreenArcRemap = {
    screenLength: 0,
    worldAt: (f) => Math.max(0, Math.min(1, f)) * totalWorld,
  }
  if (points.length < 2 || totalWorld <= 0) return identity

  // Per visible sub-segment: the screen length it contributes and the
  // world-arc interval it covers. Walking these in order gives the map.
  const screenSteps: number[] = []
  const worldFrom: number[] = []
  const worldTo: number[] = []
  let screenTotal = 0

  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    if (!a.onCamera || !b.onCamera) continue
    const [t0, t1] = clipToViewport(a.x, a.y, b.x, b.y, view)
    if (t1 <= t0) continue
    const px = Math.hypot(b.x - a.x, b.y - a.y) * (t1 - t0)
    if (px <= 0) continue
    screenSteps.push(px)
    worldFrom.push(a.world + (b.world - a.world) * t0)
    worldTo.push(a.world + (b.world - a.world) * t1)
    screenTotal += px
  }
  if (screenTotal <= 0) return identity

  return {
    screenLength: screenTotal,
    worldAt: (fraction: number): number => {
      const f = Math.max(0, Math.min(1, fraction))
      if (f <= 0) return worldFrom[0]!
      if (f >= 1) return worldTo[worldTo.length - 1]!
      let target = f * screenTotal
      for (let i = 0; i < screenSteps.length; i++) {
        const step = screenSteps[i]!
        if (target <= step) {
          const u = step > 0 ? target / step : 0
          return worldFrom[i]! + (worldTo[i]! - worldFrom[i]!) * u
        }
        target -= step
        // Between visible runs the pen jumps the off-screen gap for
        // free — that IS the model: invisible geometry carries no
        // stroke, so it costs no draw time. Land on the next run's
        // start rather than interpolating through the gap.
        if (i + 1 < screenSteps.length && target <= 0) return worldFrom[i + 1]!
      }
      return worldTo[worldTo.length - 1]!
    },
  }
}
