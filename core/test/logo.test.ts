/**
 * Logo — the brand mark's derivations, pinned.
 *
 * Every number here is recomputed from the source's own named values
 * (custom_objects.py:115-146) rather than copied out of the
 * implementation, so a drifted constant fails rather than agreeing with
 * itself. The two facts that make the mark what it is — the circles'
 * radii and the legs' convergence on the focal point — are checked as
 * GEOMETRY: the legs' equations are solved for their intersection, not
 * compared to a stored endpoint.
 */

import { describe, expect, test } from "bun:test"
import {
  ANGLE_LINES,
  ANGLE_OFFSET,
  FOCAL_RATIO,
  Logo,
  SMALL_CIRCLE_GAP,
  SMALL_CIRCLE_RATIO,
  proportions,
} from "../vocabulary/Logo/Logo"
import { Circle, Line } from "../src/parts/primitives"
import { BLUE, PI, RED, WHITE } from "../src/constants"

describe("the two circles", () => {
  test("the source's named values are what the file carries", () => {
    // The designer's three decisions, verbatim from custom_objects.py:122-133.
    expect(ANGLE_LINES).toBeCloseTo((PI * 2) / 5, 12)
    expect(ANGLE_OFFSET).toBeCloseTo(-PI / 2, 12)
    expect(SMALL_CIRCLE_RATIO).toBe(0.61)
    expect(SMALL_CIRCLE_GAP).toBe(6)
    expect(FOCAL_RATIO).toBe(0.11)
  })

  test("small radius = 200 · 0.61 = 122, the source's own arithmetic", () => {
    const logo = new Logo()
    expect(logo.radius.value).toBe(200) // Circle's C4D default, which the source relies on
    expect(logo.geometry.smallRadius).toBeCloseTo(200 * 0.61, 12)
    expect(logo.geometry.smallRadius).toBeCloseTo(122, 12)
    expect(logo.smallCircle.radius.value).toBeCloseTo(122, 12)
  })

  test("small centre = radius − smallRadius − 6 = 72", () => {
    // NOT 72.2: the origins report's §1 quotes an arithmetic slip there,
    // and 200 − 122 − 6 is 72. The reference frames agree (see below).
    const logo = new Logo()
    expect(logo.geometry.smallCenter).toBeCloseTo(200 - 122 - 6, 12)
    expect(logo.geometry.smallCenter).toBeCloseTo(72, 12)
    expect(logo.smallCircle.y.value).toBeCloseTo(72, 12)
  })

  test("the 6-unit gap leaves the two circles nearly kissing at the top", () => {
    // The small circle's top reaches 72 + 122 = 194, six short of the
    // main circle's 200 — which is the whole point of the −6.
    const { smallCenter, smallRadius } = proportions(200)
    expect(smallCenter + smallRadius).toBeCloseTo(200 - SMALL_CIRCLE_GAP, 12)
  })

  test("focal height = smallCentre + 0.11 · smallRadius = 85.42", () => {
    const logo = new Logo()
    expect(logo.geometry.focalHeight).toBeCloseTo(72 + 0.11 * 122, 12)
    expect(logo.geometry.focalHeight).toBeCloseTo(85.42, 10)
    // The apex sits inside the small circle's upper half, 13.42 above
    // its centre — a fraction 0.11 of the way out to its rim.
    const above = logo.geometry.focalHeight - logo.geometry.smallCenter
    expect(above / logo.geometry.smallRadius).toBeCloseTo(FOCAL_RATIO, 12)
    expect(above).toBeLessThan(logo.geometry.smallRadius)
  })
})

describe("the legs converge on the focal point", () => {
  test("the feet sit on the main circle at −π/2 ± π/5", () => {
    const logo = new Logo()
    const [left] = logo.leftLeg.points
    const [right] = logo.rightLeg.points
    // On the circle: |foot| = radius, to full precision.
    expect(Math.hypot(left!.x, left!.y)).toBeCloseTo(200, 10)
    expect(Math.hypot(right!.x, right!.y)).toBeCloseTo(200, 10)
    // At the stated angles. polar2cartesian(r, φ) = (r cos φ, r sin φ).
    expect(left!.x).toBeCloseTo(200 * Math.cos(ANGLE_OFFSET + ANGLE_LINES / 2), 10)
    expect(left!.y).toBeCloseTo(200 * Math.sin(ANGLE_OFFSET + ANGLE_LINES / 2), 10)
    expect(right!.x).toBeCloseTo(200 * Math.cos(ANGLE_OFFSET - ANGLE_LINES / 2), 10)
    // Both legs share the LEFT foot's height — the source reads z once
    // (custom_objects.py:139) and gives it to both. sin is even about
    // −π/2, so the two agree anyway; the redundancy is the source's.
    expect(right!.y).toBeCloseTo(left!.y, 12)
  })

  test("the feet are separated by exactly angle_lines = 2π/5", () => {
    const logo = new Logo()
    const [left] = logo.leftLeg.points
    const [right] = logo.rightLeg.points
    const angle = Math.atan2(left!.y, left!.x) - Math.atan2(right!.y, right!.x)
    expect(Math.abs(angle)).toBeCloseTo(ANGLE_LINES, 10)
  })

  test("the two legs INTERSECT at (0, focalHeight) — solved, not stored", () => {
    const logo = new Logo()
    const ends = (leg: Line): [number, number][] =>
      leg.points.map((p) => [p.x ?? 0, p.y ?? 0])
    const [[l0x, l0y], [l1x, l1y]] = ends(logo.leftLeg) as [[number, number], [number, number]]
    const [[r0x, r0y], [r1x, r1y]] = ends(logo.rightLeg) as [[number, number], [number, number]]
    // Solve l0 + s(l1 − l0) = r0 + u(r1 − r0) for s, by Cramer's rule.
    const dlx = l1x - l0x
    const dly = l1y - l0y
    const drx = r1x - r0x
    const dry = r1y - r0y
    const det = dlx * -dry - -drx * dly
    expect(Math.abs(det)).toBeGreaterThan(1e-9) // not parallel
    const s = ((r0x - l0x) * -dry - -drx * (r0y - l0y)) / det
    const meetX = l0x + s * dlx
    const meetY = l0y + s * dly
    expect(meetX).toBeCloseTo(0, 9)
    expect(meetY).toBeCloseTo(logo.geometry.focalHeight, 9)
    // And the meeting is at the legs' far ENDS (s = 1), not somewhere
    // mid-segment — the Λ closes exactly where it stops.
    expect(s).toBeCloseTo(1, 9)
  })

  test("the legs are drawn foot → apex, which is core's default pen", () => {
    // The reference shows the ink's bottom edge pinned while the top
    // climbs (Scene09 f_01643-f_01668), so the pen enters at the foot.
    // Points in that order + drawReversed false is exactly that.
    const logo = new Logo()
    for (const leg of [logo.leftLeg, logo.rightLeg]) {
      const ys = leg.points.map((p) => p.y ?? 0)
      expect(ys[0]!).toBeLessThan(ys.at(-1)!) // starts low, ends at the apex
      expect(leg.drawReversed.value).toBe(false)
    }
  })
})

describe("the mark scales as one thing", () => {
  test("every proportion is a fraction of radius — a Logo at any size is the same mark", () => {
    const unit = proportions(200)
    for (const r of [1, 50, 200, 1000]) {
      const p = proportions(r)
      const k = r / 200
      expect(p.smallRadius).toBeCloseTo(unit.smallRadius * k, 9)
      expect(p.smallCenter).toBeCloseTo(unit.smallCenter * k, 9)
      expect(p.focalHeight).toBeCloseTo(unit.focalHeight * k, 9)
      expect(p.footX).toBeCloseTo(unit.footX * k, 9)
      expect(p.footY).toBeCloseTo(unit.footY * k, 9)
    }
  })

  test("a non-default radius still lands its legs on its own circle", () => {
    const logo = new Logo({ radius: 500 })
    const [foot] = logo.leftLeg.points
    expect(Math.hypot(foot!.x, foot!.y)).toBeCloseTo(500, 9)
    expect(logo.smallCircle.radius.value).toBeCloseTo(500 * 0.61, 9)
  })
})

describe("the projection that makes the reference frames", () => {
  test("at Scene09's 1.29 px/unit the mark lands on f_01700's measurements", () => {
    // zoom 1 → camera distance 1000; the 36mm rig's f = 1290 px at 1280
    // wide → 1.29 px per world unit at the origin plane. Measured values
    // are from refs/pitch/origins/frames5/f_01700 (see Scene09.ts).
    const PX = 1.29
    const CX = 640
    const CY = 360
    const logo = new Logo()
    const g = logo.geometry
    expect(logo.radius.value * PX).toBeCloseTo(258, 0) // measured 258
    expect(g.smallRadius * PX).toBeCloseTo(157.4, 1) // measured 158
    expect(CY - g.smallCenter * PX).toBeCloseTo(267.1, 1) // measured 268
    expect(CX + g.footX * PX).toBeCloseTo(791.6, 1) // measured 790
    expect(CX - g.footX * PX).toBeCloseTo(488.4, 1) // measured 490
    expect(CY - g.footY * PX).toBeCloseTo(568.7, 1) // measured 566
    expect(CY - g.focalHeight * PX).toBeCloseTo(249.8, 1) // measured 249
  })

  test("at Scene05's scale 0.6 and 0.9675 px/unit it lands on f_00760's", () => {
    // zoom 3/4 → distance 1333.33 → 1290/1333.33 = 0.9675 px/unit; the
    // logo is lifted 50 units (source z=50) and scaled 0.6.
    const PX = 1290 / (1000 / (3 / 4))
    const S = 0.6
    const LIFT = 50
    const g = proportions(200)
    expect(200 * S * PX).toBeCloseTo(116.1, 1) // measured r 117
    expect(360 - LIFT * PX).toBeCloseTo(311.6, 1) // measured cy 312
    expect(g.smallRadius * S * PX).toBeCloseTo(70.8, 1) // measured r 72
    expect(360 - (LIFT + g.smallCenter * S) * PX).toBeCloseTo(269.8, 1) // measured 271
  })
})

describe("the parts and their tints", () => {
  test("two Circles and two Lines, tinted BLUE / RED / WHITE", () => {
    const logo = new Logo()
    expect(logo.mainCircle).toBeInstanceOf(Circle)
    expect(logo.smallCircle).toBeInstanceOf(Circle)
    expect(logo.leftLeg).toBeInstanceOf(Line)
    expect(logo.rightLeg).toBeInstanceOf(Line)
    expect(logo.mainCircle.tint.value).toEqual(BLUE)
    expect(logo.smallCircle.tint.value).toEqual(RED)
    expect(logo.leftLeg.tint.value).toEqual(WHITE)
    expect(logo.rightLeg.tint.value).toEqual(WHITE)
  })

  test("the two tints are promoted and reach their circles", () => {
    const logo = new Logo({ tint: RED, smallTint: BLUE })
    expect(logo.mainCircle.tint.value).toEqual(RED)
    expect(logo.smallCircle.tint.value).toEqual(BLUE)
  })

  test("it is sovereign, and renders nothing of its own", () => {
    expect(Logo.sovereign).toBe(true)
    // A bare Stroke subclass has no shape of its own — the mark IS its
    // four parts, which is what makes it a composite rather than a
    // primitive with decoration.
    expect(new Logo().parts.length).toBe(4)
  })
})

describe("CreateLogo — the source's windows, not a generic draw", () => {
  const tracksOf = (logo: Logo) => logo.createAnim()!.tracks

  test("the main circle FADES over (0, 0.4) — opacity, never creation", () => {
    const logo = new Logo()
    const t = tracksOf(logo).find((k) => k.param === logo.mainCircle.opacity)
    expect(t).toBeDefined()
    expect(t!.relStart).toBeCloseTo(0, 9)
    expect(t!.relStop).toBeCloseTo(0.4, 9)
    // The circle is never DRAWN — a partial arc appears in no frame.
    expect(tracksOf(logo).some((k) => k.param === logo.mainCircle.creation)).toBe(false)
  })

  test("the legs DRAW over (0.4, 0.7), both together", () => {
    const logo = new Logo()
    for (const leg of [logo.leftLeg, logo.rightLeg]) {
      const t = tracksOf(logo).find((k) => k.param === leg.creation)
      expect(t).toBeDefined()
      expect(t!.relStart).toBeCloseTo(0.4, 9)
      expect(t!.relStop).toBeCloseTo(0.7, 9)
    }
  })

  test("the small circle blooms out of the apex over (0.7, 1) — all three at once", () => {
    const logo = new Logo()
    const t = tracksOf(logo)
    const opacity = t.find((k) => k.param === logo.smallCircle.opacity)
    const radius = t.find((k) => k.param === logo.smallCircle.radius)
    const height = t.find((k) => k.param === logo.smallCircle.y)
    for (const track of [opacity, radius, height]) {
      expect(track).toBeDefined()
      expect(track!.relStart).toBeCloseTo(0.7, 9)
      expect(track!.relStop).toBeCloseTo(1, 9)
    }
    // It is BORN at the focal point with no size, and SETTLES down to
    // its own centre at full size — the two motions that make it a
    // bloom rather than a fade-in.
    expect(radius!.values[0]).toBeCloseTo(0, 9)
    expect(radius!.values.at(-1)).toBeCloseTo(logo.geometry.smallRadius, 9)
    expect(height!.values[0]).toBeCloseTo(logo.geometry.focalHeight, 9)
    expect(height!.values.at(-1)).toBeCloseTo(logo.geometry.smallCenter, 9)
    // Down, not up: the apex is above the settled centre.
    expect(height!.values[0] as number).toBeGreaterThan(height!.values.at(-1) as number)
  })

  test("the source's smoothings are carried as easings", () => {
    // These are not decoration: the reference's red circle reaches 72%
    // of full radius in the first frame of its bloom and decelerates
    // after, which only a flattened DEPARTING tangent produces. Fitting
    // Scene05 with the symmetric default instead costs it 17 of 30
    // frames, so the easings are pinned here.
    const logo = new Logo()
    const t = tracksOf(logo)
    const easingOf = (param: unknown) => t.find((k) => k.param === param)!.easing
    // smoothing_right=0 on Draw(lines) — the pen does not decelerate
    // into the apex.
    expect(easingOf(logo.leftLeg.creation)).toBe("easeIn")
    expect(easingOf(logo.rightLeg.creation)).toBe("easeIn")
    // smoothing_left=0 on the radius and the transform — the bloom
    // launches at full speed.
    expect(easingOf(logo.smallCircle.radius)).toBe("easeOut")
    expect(easingOf(logo.smallCircle.y)).toBe("easeOut")
  })

  test("every window is restaged — tangents stated against the whole span", () => {
    // pydeation states an ease's tangents against the FULL play span, so
    // a track filling 0.3 of it carries them proportionally longer
    // (timeline.ts smoothingFor reads Track.smoothingWindow, which only
    // restage() sets). Without this the legs draw over 1.0s where the
    // reference takes 0.6. A plain tuple leaves smoothingWindow unset.
    for (const track of tracksOf(new Logo())) {
      expect(track.smoothingWindow).toBeDefined()
      // Stated against the whole span, not the sub-window it occupies.
      expect(track.smoothingWindow).toBeGreaterThan(track.relStop - track.relStart)
    }
  })

  test("the phases tile the span end to end, in order", () => {
    const logo = new Logo()
    const t = tracksOf(logo)
    const starts = [...new Set(t.map((k) => Number(k.relStart.toFixed(6))))].sort((a, b) => a - b)
    const stops = [...new Set(t.map((k) => Number(k.relStop.toFixed(6))))].sort((a, b) => a - b)
    expect(starts).toEqual([0, 0.4, 0.7])
    expect(stops).toEqual([0.4, 0.7, 1])
  })
})

describe("UnCreateLogo — its own order, not createAnim reversed", () => {
  test("small circle out first (0, 0.3), legs (0.3, 0.6), main circle last (0.6, 1)", () => {
    const logo = new Logo()
    const t = logo.unCreateAnim()!.tracks
    const at = (param: unknown, a: number, b: number) => {
      const track = t.find((k) => k.param === param)
      expect(track).toBeDefined()
      expect(track!.relStart).toBeCloseTo(a, 9)
      expect(track!.relStop).toBeCloseTo(b, 9)
    }
    at(logo.smallCircle.opacity, 0, 0.3)
    at(logo.leftLeg.creation, 0.3, 0.6)
    at(logo.rightLeg.creation, 0.3, 0.6)
    at(logo.mainCircle.opacity, 0.6, 1)
  })

  test("the small circle only fades — it does not shrink back into the apex", () => {
    // The source's own asymmetry (animator.py:808-836): UnCreateLogo
    // touches opacity alone, so create and un-create are not mirrors.
    const logo = new Logo()
    const t = logo.unCreateAnim()!.tracks
    expect(t.some((k) => k.param === logo.smallCircle.radius)).toBe(false)
    expect(t.some((k) => k.param === logo.smallCircle.y)).toBe(false)
  })
})
