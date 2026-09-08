/**
 * P-7 — on-slide motion builds: the curved path, the instant appear, and
 * the Liminal Web schedule.
 *
 * What these pin, in order of how expensive the bug would be:
 *
 *   1. THE CURVED PATH'S EASE. A `sequence` track eases each consecutive
 *      pair of waypoints over its own sub-span, so a curve resampled the
 *      obvious way accelerates and decelerates once PER SAMPLE instead
 *      of once over the whole travel. The waypoints are therefore placed
 *      to cancel that, and the cancellation is the thing most likely to
 *      be broken by a well-meaning simplification — it looks like
 *      redundant arithmetic and is not. The test compares the composed
 *      motion against a single ease and asserts the ripple stays small.
 *   2. ARC LENGTH, not curve parameter. A cubic's parameter runs fast
 *      where its controls bunch; stepping it uniformly makes the target
 *      lurch along a path whose declared timing is uniform. Pinned by
 *      asserting equal distance per equal time at the path's midpoint.
 *   3. THE CURVE IS HONOURED AT ALL. The straight branch reads only the
 *      endpoint, which for a bowed path is a chord through empty space.
 *      The one curved record in slides 1-58 bows 27 slide units off its
 *      own chord, so the two implementations are distinguishable.
 *   4. `bc-appear` IS A STEP. Measured instant against its own declared
 *      1.0s (docs/reports/pl02/p7-motion.md); implemented by squeezing
 *      the ramp into the window's first instant. A `.to()` spanning the
 *      whole window would be the fade the footage rules out, and it
 *      would look almost right.
 */

import { describe, expect, test } from "bun:test"
import {
  ACTION_SCALE,
  ACTION_SCALE_D56,
  APPEAR,
  BC_APPEAR,
  EASE_SAMPLES,
  KEYNOTE_EASE_S,
  MOTION_PATH,
  MOTION_SAMPLES,
  SUPPORTED,
  curvedMotionAnim,
  isInstant,
  keynoteEase,
  motionEndpoint,
  motionIsStraight,
  scaleAnim,
} from "../vocabulary/Slides/Builds"
import { Circle } from "../src/parts/primitives"
import { c4dEaseWith, ease } from "../src/timeline"
import type { KeyBuild, KeyPathElement } from "../src/geometry/keynote"

/**
 * The deck's ONE curved motion path in slides 1-58 — build 5602009 on
 * deck slide 56, transcribed from the decoded archive.
 *
 * Two cubic segments, 3.0s, travelling (-284.409, -170.965) slide units.
 * P-1 carried the census as "34 paths, 32 straight, 2 curved" over the
 * whole 83-slide FILE; within the video's own scope there are 19 and
 * exactly this one is curved. Deck 56 is not in P-7's row, so the
 * footage never exercises this — the record is real, the test is
 * synthetic, and the report says so.
 */
const CURVED_PATH: KeyPathElement[] = [
  { type: "moveTo", points: [{ x: 0, y: 0 }] },
  {
    type: "curveTo",
    points: [
      { x: -70.021095, y: 10.075332 },
      { x: -141.15013, y: -8.462149 },
      { x: -197.34671, y: -51.432034 },
    ],
  },
  {
    type: "curveTo",
    points: [
      { x: -237.33026, y: -82.00486 },
      { x: -267.57568, y: -123.5304 },
      { x: -284.40918, y: -170.96474 },
    ],
  },
]

const curvedRecord = (): KeyBuild & { motionPath: KeyPathElement[] } =>
  ({
    id: "5602009",
    target: "5601749",
    effect: MOTION_PATH,
    animationType: "Action",
    duration: 3.0,
    delay: 0,
    motionPath: CURVED_PATH,
  }) as unknown as KeyBuild & { motionPath: KeyPathElement[] }

/** A straight two-node run, the shape 32 of the deck's 34 paths have. */
const straightRecord = (): KeyBuild & { motionPath: KeyPathElement[] } =>
  ({
    id: "4890801",
    target: "4516215",
    effect: MOTION_PATH,
    animationType: "Action",
    duration: 1.0,
    delay: 0,
    motionPath: [
      { type: "moveTo", points: [{ x: 0, y: 0 }] },
      {
        type: "curveTo",
        points: [
          { x: -1.388, y: -229.91 },
          { x: -1.388, y: -229.91 },
          { x: -1.388, y: -229.91 },
        ],
      },
    ],
  }) as unknown as KeyBuild & { motionPath: KeyPathElement[] }

/** The x/y waypoint lists a curved motion produces, at scale 1. */
const waypoints = (): { xs: number[]; ys: number[] } => {
  const target = new Circle({ radius: 1 })
  const anim = curvedMotionAnim(curvedRecord(), target, 1)
  expect(anim).toBeDefined()
  const xs = anim!.tracks.find((t) => t.param === target.x)!.values as number[]
  const ys = anim!.tracks.find((t) => t.param === target.y)!.values as number[]
  return { xs, ys }
}

describe("the curved motion path", () => {
  test("the deck's one in-scope curved record is NOT straight", () => {
    expect(motionIsStraight(curvedRecord())).toBe(false)
    // …and the straight case it is contrasted against still reads straight,
    // so the predicate is discriminating rather than always-false.
    expect(motionIsStraight(straightRecord())).toBe(true)
  })

  test("it bows far enough off its chord for the two branches to differ", () => {
    // The straight branch would move along the chord from (0,0) to the
    // endpoint. If the curve never left that line, honouring it would be
    // busywork; it leaves it by 27 units, which at this deck's scale is
    // eighteen video pixels.
    const end = motionEndpoint(curvedRecord())!
    const { xs, ys } = waypoints()
    let worst = 0
    for (let i = 0; i < xs.length; i++) {
      // distance from the point to the chord through the origin
      const cross = Math.abs(end.x * -ys[i]! - end.y * xs[i]!)
      worst = Math.max(worst, cross / Math.hypot(end.x, end.y))
    }
    expect(worst).toBeGreaterThan(20)
  })

  test("it ends exactly on the record's declared endpoint", () => {
    const end = motionEndpoint(curvedRecord())!
    const { xs, ys } = waypoints()
    expect(xs[xs.length - 1]!).toBeCloseTo(end.x, 3)
    // Slide units are y-down, world y-up.
    expect(ys[ys.length - 1]!).toBeCloseTo(-end.y, 3)
  })

  test("it starts at the target's own position — the path is relative", () => {
    const { xs, ys } = waypoints()
    expect(xs[0]!).toBeCloseTo(0, 6)
    expect(ys[0]!).toBeCloseTo(0, 6)
  })

  test("scale multiplies the offsets, and only the offsets", () => {
    const target = new Circle({ radius: 1 })
    const a = curvedMotionAnim(curvedRecord(), target, 1)!
    const b = curvedMotionAnim(curvedRecord(), target, 2)!
    const ax = a.tracks.find((t) => t.param === target.x)!.values as number[]
    const bx = b.tracks.find((t) => t.param === target.x)!.values as number[]
    for (let i = 0; i < ax.length; i++) expect(bx[i]!).toBeCloseTo(ax[i]! * 2, 6)
  })

  /**
   * THE RIPPLE TEST, REWRITTEN FOR THE MECHANISM THAT REPLACED IT (P-8).
   *
   * P-7 stamped these waypoints with the framework's `smooth` easing, so
   * `Timeline.valueAt` eased every consecutive PAIR over its own
   * sub-span and the composite rippled once per sample; the waypoints
   * were placed at `ease(k/N)` to cancel that, and this test asserted
   * the cancellation held.
   *
   * P-8 measured the deck's `kEaseBoth` and found it is NOT `smooth` —
   * it is the same Bezier family at s = 0.42 rather than 0.25, four
   * independent fits (`Builds.KEYNOTE_EASE_S`). The framework's `Easing`
   * union has no name for that curve and `src/` is not this vocabulary's
   * to change, so the track is now stamped `linear` and the waypoints
   * trace the Keynote curve directly.
   *
   * That dissolves the ripple rather than cancelling it: a linear
   * `sequence` interpolates its waypoints uniformly, so there is no
   * per-pair ease left to fight. The property worth guarding is now the
   * simpler one — the composite IS the Keynote ease — and it is a
   * stronger statement than the old bound, so the test survives its own
   * mechanism changing.
   */
  test("the composed motion is ONE ease — Keynote's, not the framework's", () => {
    const { xs, ys } = waypoints()
    const n = xs.length - 1
    expect(n).toBe(MOTION_SAMPLES)

    const cum = [0]
    for (let i = 1; i <= n; i++) {
      cum.push(cum[i - 1]! + Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!))
    }
    const total = cum[n]!

    let worst = 0
    for (let k = 0; k <= 200; k++) {
      const u = k / 200
      // The renderer's own lookup, for a track stamped `linear`.
      const scaled = u * n
      const i = Math.min(Math.floor(scaled), n - 1)
      const local = scaled - i
      const travelled = (cum[i]! + (cum[i + 1]! - cum[i]!) * local) / total
      worst = Math.max(worst, Math.abs(travelled - keynoteEase(u)))
    }
    // Measured reconstruction error for a linear waypoint sequence:
    // 0.0086 at 8 samples, 0.0022 at 16, 0.00054 at 32 — an order of
    // magnitude tighter than the 0.0030 the pre-compensated version
    // reached at the same count, because it is an interpolation rather
    // than a cancellation.
    expect(worst).toBeLessThan(0.002)
  })

  test("the waypoints trace KEYNOTE's ease, and `smooth` is distinguishable", () => {
    // The guard that keeps the measurement honest: if someone maps
    // `kEaseBoth` back onto the framework's `smooth`, the waypoints move
    // by 0.054 of the path at the point of maximum divergence — on deck
    // 56's 372-unit arc that is 20 slide units, or 13 video pixels, and
    // it is the difference the footage measures (8.90 px rms against
    // 1.29). This asserts the two curves have NOT been conflated.
    let worst = 0
    for (let k = 0; k <= 200; k++) {
      const u = k / 200
      worst = Math.max(worst, Math.abs(keynoteEase(u) - ease("smooth", u)))
    }
    expect(worst).toBeGreaterThan(0.05)
  })

  test("Keynote's ease is CSS ease-in-out, and it is symmetric", () => {
    // s = 0.42 is `cubic-bezier(0.42, 0, 0.58, 1)`: the x-coordinates are
    // s and 1 - s, the y-coordinates are the flat tangents. What makes
    // 0.42 a READING rather than a fit is that it names a standard
    // curve; these assert the properties that standard has.
    expect(KEYNOTE_EASE_S).toBe(0.42)
    expect(keynoteEase(0)).toBeCloseTo(0, 9)
    expect(keynoteEase(1)).toBeCloseTo(1, 9)
    expect(keynoteEase(0.5)).toBeCloseTo(0.5, 9)
    for (const u of [0.1, 0.25, 0.37, 0.5]) {
      expect(keynoteEase(u) + keynoteEase(1 - u)).toBeCloseTo(1, 6)
    }
    // It starts and ends slower than `smooth` and crosses in the middle —
    // the shape a longer tangent gives.
    expect(keynoteEase(0.2)).toBeLessThan(ease("smooth", 0.2))
    expect(keynoteEase(0.8)).toBeGreaterThan(ease("smooth", 0.8))
  })

  test("a linear waypoint sequence reproduces any curve it samples", () => {
    // Why the mechanism is sound in general, not just at s = 0.42: the
    // reconstruction error is a property of the sample count, so the
    // same construction carries whatever curve a later measurement
    // finds. Checked across the family.
    for (const s of [0.15, 0.25, 0.42, 0.5]) {
      const wp: number[] = []
      for (let k = 0; k <= MOTION_SAMPLES; k++) {
        wp.push(c4dEaseWith(k / MOTION_SAMPLES, s, s))
      }
      let worst = 0
      for (let k = 0; k <= 200; k++) {
        const u = k / 200
        const scaled = u * MOTION_SAMPLES
        const i = Math.min(Math.floor(scaled), MOTION_SAMPLES - 1)
        const lin = wp[i]! + (wp[i + 1]! - wp[i]!) * (scaled - i)
        worst = Math.max(worst, Math.abs(lin - c4dEaseWith(u, s, s)))
      }
      expect(worst).toBeLessThan(0.002)
    }
  })

  test("an action-scale ramps on the same curve, about the target's own scale", () => {
    const target = new Circle({ radius: 1 })
    const anim = scaleAnim(target, ACTION_SCALE_D56)
    const track = anim.tracks.find((t) => t.param === target.scale)!
    // Linear, so the waypoints ARE the curve — the same contract the
    // motion path takes.
    expect(track.easing).toBe("linear")
    expect(track.mode).toBe("sequence")
    const wp = track.values as number[]
    expect(wp.length).toBe(EASE_SAMPLES + 1)
    expect(wp[0]!).toBeCloseTo(1, 9)
    expect(wp[wp.length - 1]!).toBeCloseTo(ACTION_SCALE_D56, 9)
    // Monotone shrink — a scale that overshoots would read as a bounce.
    for (let i = 1; i < wp.length; i++) expect(wp[i]!).toBeLessThanOrEqual(wp[i - 1]! + 1e-12)
  })

  test("action-scale stays OUT of SUPPORTED — four of the five are unmeasured", () => {
    // The record declares no factor (P-4, confirmed by P-7 in the raw
    // archives), so only a build whose factor a scene has MEASURED can
    // be played. Listing the effect as supported would tell a later
    // chapter that the other four are handled while they silently do
    // nothing; they must keep showing up in `unsupported()`.
    expect(SUPPORTED.has(ACTION_SCALE)).toBe(false)
  })

  test("waypoints are spaced by ARC LENGTH, not by curve parameter", () => {
    // Equal-time steps in the middle of the travel, where the ease is
    // flattest, must cover near-equal distance. A parameter-uniform
    // sampling of this record's two cubics differs by over 10% there.
    const { xs, ys } = waypoints()
    const n = xs.length - 1
    const mid = Math.floor(n / 2)
    const seg = (i: number): number =>
      Math.hypot(xs[i + 1]! - xs[i]!, ys[i + 1]! - ys[i]!)
    const a = seg(mid - 1)
    const b = seg(mid)
    expect(Math.abs(a - b) / Math.max(a, b)).toBeLessThan(0.05)
  })

  test("a degenerate path yields no motion rather than NaNs", () => {
    const target = new Circle({ radius: 1 })
    const zero = {
      ...curvedRecord(),
      motionPath: [
        { type: "moveTo", points: [{ x: 0, y: 0 }] },
        { type: "lineTo", points: [{ x: 0, y: 0 }] },
      ] as KeyPathElement[],
    }
    expect(curvedMotionAnim(zero, target, 1)).toBeUndefined()
  })
})

describe("the instant appear", () => {
  const record = (effect: string, type = "In"): KeyBuild =>
    ({
      id: "5424584",
      target: "5424594",
      effect,
      animationType: type,
      duration: 1.0,
      delay: 0,
    }) as unknown as KeyBuild

  test("both spellings are recognised as instant", () => {
    expect(isInstant(record(BC_APPEAR))).toBe(true)
    expect(isInstant(record(APPEAR))).toBe(true)
  })

  test("a ramping effect is not", () => {
    expect(isInstant(record("apple:dissolve"))).toBe(false)
    expect(isInstant(record(MOTION_PATH))).toBe(false)
  })

  test("both are implemented rather than reported unsupported", () => {
    expect(SUPPORTED.has(BC_APPEAR)).toBe(true)
    expect(SUPPORTED.has(APPEAR)).toBe(true)
  })
})
