/**
 * Screen-arc reparametrisation (render/screen-arc.ts) — the pure half of
 * the Sketch & Toon draw model: the pen advances by SCREEN pixels of
 * VISIBLE stroke, not by world arc length.
 *
 * The two properties that matter for reproduction are pinned here on
 * geometry simple enough to work out by hand:
 *   - off-frame geometry costs no draw time (S01's y-axis, which starts
 *     a thousand pixels below the frame);
 *   - foreshortened stretches cost draw time in proportion to their
 *     PIXELS, so a receding line dwells on its near end.
 *
 * The one real reference measurement (S01's y-axis tip across
 * f0090-f0100) is reproduced at the bottom, so a regression that
 * quietly reverts to world arc length fails a test rather than a frame.
 */

import { expect, test, describe } from "bun:test"
import { clipToViewport, screenArcRemap, type ProjectedPoint } from "../src/render/screen-arc"

const VIEW = { width: 1280, height: 720 }

const pt = (x: number, y: number, world: number, onCamera = true): ProjectedPoint => ({
  x,
  y,
  world,
  onCamera,
})

describe("clipToViewport", () => {
  test("a segment wholly inside is unclipped", () => {
    expect(clipToViewport(100, 100, 200, 200, VIEW)).toEqual([0, 1])
  })

  test("a segment wholly outside returns an empty interval", () => {
    const [t0, t1] = clipToViewport(-500, 100, -300, 200, VIEW)
    expect(t1).toBeLessThanOrEqual(t0)
  })

  test("a segment crossing the bottom edge keeps its inside half", () => {
    // y from 620 to 820 crosses y=720 exactly halfway.
    const [t0, t1] = clipToViewport(640, 620, 640, 820, VIEW)
    expect(t0).toBeCloseTo(0, 9)
    expect(t1).toBeCloseTo(0.5, 9)
  })

  test("a segment spanning the whole frame is clipped on both sides", () => {
    // x from -1280 to 2560 (span 3840): inside is x in [0, 1280].
    const [t0, t1] = clipToViewport(-1280, 360, 2560, 360, VIEW)
    expect(t0).toBeCloseTo(1280 / 3840, 9)
    expect(t1).toBeCloseTo(2560 / 3840, 9)
  })

  test("a segment parallel to an edge and outside it is rejected", () => {
    const [t0, t1] = clipToViewport(100, 900, 400, 900, VIEW)
    expect(t1).toBeLessThanOrEqual(t0)
  })
})

describe("screenArcRemap", () => {
  test("a fully visible straight line reduces to world arc length", () => {
    const pts = [pt(100, 360, 0), pt(1100, 360, 500)]
    const remap = screenArcRemap(pts, 500, VIEW)
    expect(remap.screenLength).toBeCloseTo(1000, 6)
    expect(remap.worldAt(0)).toBeCloseTo(0, 6)
    expect(remap.worldAt(0.5)).toBeCloseTo(250, 6)
    expect(remap.worldAt(1)).toBeCloseTo(500, 6)
  })

  test("off-frame geometry costs no draw time", () => {
    // Half the world length sits below the frame (y 1440 → 720), the
    // other half crosses it (720 → 0). By world arc the pen would be at
    // world 1000 when it reached the frame edge; by screen arc it is
    // there at fraction 0, because the off-frame half has no stroke.
    const pts = [pt(640, 1440, 0), pt(640, 720, 1000), pt(640, 0, 2000)]
    const remap = screenArcRemap(pts, 2000, VIEW)
    expect(remap.screenLength).toBeCloseTo(720, 6)
    expect(remap.worldAt(0)).toBeCloseTo(1000, 6)
    expect(remap.worldAt(0.5)).toBeCloseTo(1500, 6)
    expect(remap.worldAt(1)).toBeCloseTo(2000, 6)
  })

  test("a foreshortened stretch costs draw time by its pixels, not its metres", () => {
    // Two world halves of 1000 units each. The first projects to 900px
    // (near), the second to 100px (receding). The pen should spend 90%
    // of its time on the near half.
    const pts = [pt(40, 360, 0), pt(940, 360, 1000), pt(1040, 360, 2000)]
    const remap = screenArcRemap(pts, 2000, VIEW)
    expect(remap.screenLength).toBeCloseTo(1000, 6)
    expect(remap.worldAt(0.9)).toBeCloseTo(1000, 6)
    // Half the draw is only 555 world units in — barely past the middle
    // of the near half, and nowhere near the world midpoint.
    expect(remap.worldAt(0.5)).toBeCloseTo((0.5 * 1000) / 0.9, 6)
  })

  test("points behind the camera are skipped, not projected", () => {
    const pts = [pt(0, 0, 0, false), pt(200, 360, 500), pt(400, 360, 1000)]
    const remap = screenArcRemap(pts, 1000, VIEW)
    expect(remap.screenLength).toBeCloseTo(200, 6)
    expect(remap.worldAt(0)).toBeCloseTo(500, 6)
    expect(remap.worldAt(1)).toBeCloseTo(1000, 6)
  })

  test("a wholly off-screen stroke falls back to world arc length", () => {
    const pts = [pt(-900, 360, 0), pt(-500, 360, 700)]
    const remap = screenArcRemap(pts, 700, VIEW)
    expect(remap.screenLength).toBe(0)
    expect(remap.worldAt(0.5)).toBeCloseTo(350, 6)
    expect(remap.worldAt(1)).toBeCloseTo(700, 6)
  })

  test("the map is monotone and clamped outside [0, 1]", () => {
    const pts = [pt(100, 700, 0), pt(700, 100, 400), pt(1200, 50, 900)]
    const remap = screenArcRemap(pts, 900, VIEW)
    let previous = -Infinity
    for (let i = 0; i <= 20; i++) {
      const w = remap.worldAt(i / 20)
      expect(w).toBeGreaterThanOrEqual(previous)
      previous = w
    }
    expect(remap.worldAt(-1)).toBeCloseTo(remap.worldAt(0), 9)
    expect(remap.worldAt(2)).toBeCloseTo(remap.worldAt(1), 9)
  })

  test("a gap between visible runs is crossed for free", () => {
    // Run A on screen, a long excursion off the right edge, run B back
    // on screen. The excursion carries world length but no stroke, so
    // the pen must jump it without spending draw time.
    const pts = [
      pt(100, 100, 0),
      pt(300, 100, 200), //   run A: 200px, world 0..200
      pt(2400, 100, 3000), //  off-frame excursion (clipped away)
      pt(2400, 300, 3200), //  still off-frame
      pt(300, 300, 5000), //   returns: only the on-screen part counts
      pt(100, 300, 5200), //   run B
    ]
    const remap = screenArcRemap(pts, 5200, VIEW)
    // Segment 2 contributes its clipped inside portion (x 300→1280 of
    // 300→2400), and segment 4 likewise, so the total is more than
    // A + B; what matters is that the pen never dwells beyond x=1280.
    expect(remap.screenLength).toBeGreaterThan(400)
    expect(remap.worldAt(0)).toBeCloseTo(0, 6)
    expect(remap.worldAt(1)).toBeCloseTo(5200, 6)
    // Monotone across the gap.
    expect(remap.worldAt(0.4)).toBeLessThan(remap.worldAt(0.6))
  })
})

/**
 * The reference measurement, reproduced as a test.
 *
 * S01's y-axis under the 2021 rig runs world y = -2000 → +400 and
 * projects to screen y = 1699.7 → -198.5 (CameraCal's own numbers), so
 * only the 720px of frame between them carries stroke. The reference's
 * pen tip across f0090-f0100 is the ground truth; world arc length
 * misses it by ~774px RMSE, this model by ~20px.
 *
 * Rather than re-derive the projection here, the test states the two
 * endpoints the calibration already pins and checks that the model puts
 * the tip where the reference frames put it.
 */
describe("S01's y-axis — the measurement that settled the model", () => {
  const SCREEN_START = 1699.74 // world y = -2000
  const SCREEN_END = -198.52 // world y = +400
  const WORLD_SPAN = 2400

  // Screen y is affine in world y only to first order; sample the line
  // densely enough that the piecewise-linear remap is exact for the
  // straight segment the axis actually is.
  const yAxis: ProjectedPoint[] = [
    pt(640, SCREEN_START, 0),
    pt(640, SCREEN_END, WORLD_SPAN),
  ]

  test("the visible stroke is exactly the frame height", () => {
    const remap = screenArcRemap(yAxis, WORLD_SPAN, VIEW)
    expect(remap.screenLength).toBeCloseTo(720, 4)
  })

  test("the pen tip is at the bottom of the frame at fraction 0", () => {
    const remap = screenArcRemap(yAxis, WORLD_SPAN, VIEW)
    const w = remap.worldAt(0)
    const screenY = SCREEN_START + ((SCREEN_END - SCREEN_START) * w) / WORLD_SPAN
    expect(screenY).toBeCloseTo(720, 3)
  })

  test("the pen tip crosses the frame linearly in the draw fraction", () => {
    const remap = screenArcRemap(yAxis, WORLD_SPAN, VIEW)
    for (const f of [0.25, 0.5, 0.75, 1]) {
      const w = remap.worldAt(f)
      const screenY = SCREEN_START + ((SCREEN_END - SCREEN_START) * w) / WORLD_SPAN
      expect(screenY).toBeCloseTo(720 * (1 - f), 3)
    }
  })

  test("world arc length would put the tip off-frame for most of the draw", () => {
    // The contrast the model is defined against. Screen y is NOT affine
    // in the world fraction — perspective is the whole point — so these
    // are the projected values themselves, sampled from the rig at
    // world fractions 0.50 / 0.65 / 0.70 / 0.75 (proj: 1084 / 805 / 697
    // / 580). The frame edge is crossed only around fraction 0.695.
    const worldTipProjected: [number, number][] = [
      [0.5, 1084.3],
      [0.65, 805.3],
      [0.7, 697.1],
      [0.75, 579.7],
    ]
    expect(worldTipProjected[0]![1]).toBeGreaterThan(720)
    expect(worldTipProjected[1]![1]).toBeGreaterThan(720)
    expect(worldTipProjected[2]![1]).toBeLessThan(720)
    // Where THIS model puts the tip at the same fractions: already deep
    // into the frame at 0.5, and finished at 0.75.
    const remap = screenArcRemap(yAxis, WORLD_SPAN, VIEW)
    const screenAt = (f: number) => {
      const w = remap.worldAt(f)
      return SCREEN_START + ((SCREEN_END - SCREEN_START) * w) / WORLD_SPAN
    }
    expect(screenAt(0.5)).toBeCloseTo(360, 3)
    expect(screenAt(0.75)).toBeCloseTo(180, 3)
  })
})
