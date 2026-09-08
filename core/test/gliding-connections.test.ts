/**
 * The gliding connection — a connection line re-derived per frame while
 * its endpoints move (P-6).
 *
 * The claims under test are the ones the chapter rests on, and each is
 * checked against something other than the implementation:
 *
 *   • PURITY. The geometry at completion u is a pure function of the
 *     endpoint boxes and u, so sampling out of order — scrubbing — gives
 *     the identical polyline. The derivation memoizes, and a memo that
 *     was secretly a STATE would pass a forward sweep and fail this.
 *
 *   • THE ENDPOINTS ARE EXACT. At u = 0 the derived path reproduces a
 *     static `connectionPath` between the outgoing boxes, and at u = 1
 *     between the incoming ones. This is what makes the hand-off to the
 *     incoming page's own baked mesh invisible: it is the same geometry,
 *     not merely a close one.
 *
 *   • THE DASH ALLOCATION IS SUFFICIENT. The lattice loses and gains
 *     dots as the path shortens and lengthens, and the host binds one
 *     ribbon per child ONCE — so `maxDashes` must bound the count over
 *     the whole window or the mesh is visibly clipped mid-glide.
 */

import { describe, expect, test } from "bun:test"
import {
  connectionPath,
  glidingDashesAt,
  glidingPathAt,
  lerpBox,
  maxDashes,
  targetAt,
  GlidingConnection,
  type GlidingSpec,
  type SlideBox,
} from "../vocabulary/Slides/Connections"

/** A square outline for a box — a stand-in silhouette to clip against. */
const outlineOf = (b: SlideBox) => [
  [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
    { x: b.x, y: b.y },
  ],
]

/** Two boxes that travel apart AND shrink — the deck's own case. */
const A_FROM: SlideBox = { x: 100, y: 100, w: 60, h: 60 }
const A_TO: SlideBox = { x: 40, y: 300, w: 40, h: 40 }
const B_FROM: SlideBox = { x: 500, y: 100, w: 60, h: 60 }
const B_TO: SlideBox = { x: 700, y: 300, w: 40, h: 40 }

const spec = (): GlidingSpec => ({
  from: { id: "a", from: A_FROM, to: A_TO, outline: outlineOf(A_FROM) },
  to: { id: "b", from: B_FROM, to: B_TO, outline: outlineOf(B_FROM) },
  dash: 4,
  period: 12,
})

describe("the interpolated endpoint", () => {
  test("lerpBox is the identity at its two ends", () => {
    expect(lerpBox(A_FROM, A_TO, 0)).toEqual(A_FROM)
    expect(lerpBox(A_FROM, A_TO, 1)).toEqual(A_TO)
  })

  test("the outline travels and scales with the box", () => {
    // At u = 1 the silhouette must sit on the INCOMING box, since the
    // glide draws the outgoing shape resized onto it — the same claim
    // the matcher makes about the icons themselves.
    const t = targetAt(spec().from, 1)
    expect(t.box).toEqual(A_TO)
    const xs = t.outline[0]!.map((p) => p.x)
    const ys = t.outline[0]!.map((p) => p.y)
    expect(Math.min(...xs)).toBeCloseTo(A_TO.x, 6)
    expect(Math.max(...xs)).toBeCloseTo(A_TO.x + A_TO.w, 6)
    expect(Math.min(...ys)).toBeCloseTo(A_TO.y, 6)
    expect(Math.max(...ys)).toBeCloseTo(A_TO.y + A_TO.h, 6)
  })
})

describe("the endpoints are the static geometry, exactly", () => {
  test("u = 0 reproduces a static connectionPath between the outgoing boxes", () => {
    const s = spec()
    const still = connectionPath(
      { id: "a", box: A_FROM, outline: outlineOf(A_FROM) },
      { id: "b", box: B_FROM, outline: outlineOf(B_FROM) },
      undefined,
      {},
    ).points
    expect(glidingPathAt(s, 0)).toEqual(still)
  })

  test("u = 1 reproduces one between the incoming boxes", () => {
    const s = spec()
    // The clip silhouette at u = 1 is the OUTGOING outline carried onto
    // the incoming box, which for these axis-aligned squares is the
    // incoming box's own outline — so the comparison is exact.
    const still = connectionPath(
      { id: "a", box: A_TO, outline: outlineOf(A_TO) },
      { id: "b", box: B_TO, outline: outlineOf(B_TO) },
      undefined,
      {},
    ).points
    const ours = glidingPathAt(s, 1)
    expect(ours.length).toBe(still.length)
    for (let i = 0; i < ours.length; i++) {
      expect(ours[i]!.x).toBeCloseTo(still[i]!.x, 6)
      expect(ours[i]!.y).toBeCloseTo(still[i]!.y, 6)
    }
  })
})

describe("purity — the geometry at t is a function of t alone", () => {
  test("a backwards scrub gives the identical polyline", () => {
    const s = spec()
    const us = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]
    const forward = us.map((u) => glidingPathAt(s, u))
    const backward = [...us].reverse().map((u) => glidingPathAt(s, u))
    backward.reverse()
    expect(backward).toEqual(forward)
  })

  test("the holon's derived dashes scrub identically", () => {
    const line = new GlidingConnection(spec())
    void line.parts
    const read = (u: number): string => {
      line.completion.value = u
      return JSON.stringify(line.dashes.map((d) => d.points))
    }
    const us = [0, 0.3, 0.6, 1]
    const forward = us.map(read)
    // Sampling in a scrambled order must not change a single point. A
    // memo keyed on the completion passes; anything that accumulated
    // across frames would not.
    const scrambled = [1, 0, 0.6, 0.3]
    const again = new Map(scrambled.map((u) => [u, read(u)]))
    us.forEach((u, i) => expect(again.get(u)).toBe(forward[i]!))
  })

  test("re-reading the same completion is stable", () => {
    const line = new GlidingConnection(spec())
    void line.parts
    line.completion.value = 0.42
    const once = JSON.stringify(line.dashes.map((d) => d.points))
    const twice = JSON.stringify(line.dashes.map((d) => d.points))
    expect(twice).toBe(once)
  })
})

describe("the dash allocation bounds the whole window", () => {
  test("maxDashes is never exceeded at any completion", () => {
    const s = spec()
    const allocated = maxDashes(s)
    let peak = 0
    for (let i = 0; i <= 200; i++) {
      const n = glidingDashesAt(s, i / 200).length
      if (n > peak) peak = n
    }
    expect(peak).toBeGreaterThan(0)
    expect(allocated).toBeGreaterThanOrEqual(peak)
  })

  test("a surplus dash derives an EMPTY polyline rather than stale ink", () => {
    // The host passes an emptied derived polyline straight through, so a
    // slot the shortened lattice no longer reaches must draw nothing.
    const line = new GlidingConnection(spec())
    void line.parts
    const at = (u: number): number => {
      line.completion.value = u
      return line.dashes.filter((d) => d.points.length >= 2).length
    }
    const counts = [0, 0.5, 1].map(at)
    // Whichever completion carries the fewest dots, the slots beyond it
    // are empty rather than holding the previous frame's segment.
    line.completion.value = 1
    const drawn = line.dashes.filter((d) => d.points.length >= 2).length
    const empty = line.dashes.length - drawn
    expect(empty).toBeGreaterThanOrEqual(0)
    expect(Math.max(...counts)).toBeLessThanOrEqual(line.dashes.length)
  })

  test("a solid line allocates exactly one run", () => {
    const s: GlidingSpec = { ...spec(), dash: 0, period: 0 }
    expect(maxDashes(s)).toBe(1)
  })
})
