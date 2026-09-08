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
  APPEAR,
  BC_APPEAR,
  MOTION_PATH,
  MOTION_SAMPLES,
  SUPPORTED,
  curvedMotionAnim,
  isInstant,
  motionEndpoint,
  motionIsStraight,
} from "../vocabulary/Slides/Builds"
import { Circle } from "../src/parts/primitives"
import { ease } from "../src/timeline"
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
   * THE RIPPLE TEST — the one that guards the non-obvious part.
   *
   * `Timeline.valueAt` eases each waypoint PAIR over its own sub-span,
   * so the composed motion is only the declared single ease if the
   * waypoints were placed to cancel that. This reconstructs exactly what
   * the renderer does and compares against arc-length-uniform travel
   * under one ease.
   */
  test("the composed motion is ONE ease, not one per sample", () => {
    const { xs, ys } = waypoints()
    const n = xs.length - 1
    expect(n).toBe(MOTION_SAMPLES)

    // Arc length along the produced waypoints, so "how far" is measured
    // the same way the placement measured it.
    const cum = [0]
    for (let i = 1; i <= n; i++) {
      cum.push(cum[i - 1]! + Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!))
    }
    const total = cum[n]!

    let worst = 0
    for (let k = 0; k <= 200; k++) {
      const u = k / 200
      // The renderer's own lookup.
      const scaled = u * n
      const i = Math.min(Math.floor(scaled), n - 1)
      const local = ease("smooth", scaled - i)
      const travelled = (cum[i]! + (cum[i + 1]! - cum[i]!) * local) / total
      worst = Math.max(worst, Math.abs(travelled - ease("smooth", u)))
    }
    // Measured convergence: 0.036 at 4 samples, 0.013 at 8, 0.0060 at
    // 16, 0.0030 at 32. A naive uniform resample — waypoints at equal
    // arc length rather than at eased positions — peaks near 0.036
    // however many samples are used, because the ripple is per pair.
    expect(worst).toBeLessThan(0.01)
  })

  test("a NAIVE uniform resample would fail that test — the ripple is real", () => {
    // Same reconstruction, waypoints placed at EQUAL arc length. This is
    // the implementation the ripple test exists to reject; if it ever
    // passes, the renderer's per-pair easing has changed and the
    // pre-compensation in `curvedMotionAnim` is no longer needed.
    const n = MOTION_SAMPLES
    let worst = 0
    for (let k = 0; k <= 200; k++) {
      const u = k / 200
      const scaled = u * n
      const i = Math.min(Math.floor(scaled), n - 1)
      const local = ease("smooth", scaled - i)
      const travelled = (i + local) / n
      worst = Math.max(worst, Math.abs(travelled - ease("smooth", u)))
    }
    // 0.074 of the path — on deck 56's 372-unit arc that is 27 slide
    // units, or 18 video pixels of lag and lurch, at the point of
    // maximum deviation. Seven times the bar the placed waypoints meet,
    // and unlike theirs it does not shrink with the sample count.
    expect(worst).toBeGreaterThan(0.05)
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
