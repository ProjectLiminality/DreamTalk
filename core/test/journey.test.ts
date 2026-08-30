/**
 * The journey pipeline, pinned against the source's arithmetic
 * (TheWall/TheWall.py:331-398, :1252-1387). These tests exist because
 * the study calls this code "preserve verbatim" — every boundary below
 * is a number the 2021 render's choreography actually depends on, and a
 * test that fails here means the port has drifted from the original.
 */

import { describe, expect, test } from "bun:test"
import {
  ARRIVAL_FACTOR,
  BRICK_FOLD_END,
  DISTANCE_PER_THRUST,
  PULSE_MIN_FOLD,
  SCALE_CRUISE_END,
  SCALE_CRUISE_VALUE,
  SCALE_POP_END,
  SCALE_POP_VALUE,
  SCALE_RAMP_END,
  SCALE_RAMP_VALUE,
  THRUST_END,
  THRUST_TRAVEL,
  TRAVEL_END,
  arcLengthToT,
  bezierPoint,
  bezierTangent,
  buildArcLut,
  buildBezierPath,
  buildJourney,
  completionOf,
  completionToScale,
  completionToTravel,
  journeyState,
  pulseCountFor,
  travelToFold,
  travelToSplinePosition,
} from "../src/geometry/journey"

const near = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe("cubic Bezier flight path", () => {
  const spawn = { x: 0, y: 0, z: 0 }
  const slot = { x: 1000, y: 0, z: 0 }

  test("interpolates its endpoints", () => {
    const path = buildBezierPath({ spawn, slot })
    expect(bezierPoint(path, 0)).toEqual(spawn)
    expect(bezierPoint(path, 1)).toEqual(slot)
  })

  test("p1 is spawn + the full spawn direction vector (:1137)", () => {
    const path = buildBezierPath({ spawn, slot, spawnDir: { x: 0, y: 500, z: 0 } })
    expect(path.p1).toEqual({ x: 0, y: 500, z: 0 })
  })

  test("a longer spawn direction exaggerates the departure (:1136-1140)", () => {
    const near1 = buildBezierPath({ spawn, slot, spawnDir: { x: 0, y: 200, z: 0 } })
    const far = buildBezierPath({ spawn, slot, spawnDir: { x: 0, y: 900, z: 0 } })
    expect(bezierPoint(far, 0.25).y).toBeGreaterThan(bezierPoint(near1, 0.25).y)
  })

  test("p2 stands off the slot along its normal by distance*ARRIVAL_FACTOR (:1148)", () => {
    const path = buildBezierPath({ spawn, slot, slotNormal: { x: 1, y: 0, z: 0 } })
    near(path.p2.x, 1000 + 1000 * ARRIVAL_FACTOR)
  })

  test("without a normal the source approaches from -X (:1151)", () => {
    const path = buildBezierPath({ spawn, slot })
    near(path.p2.x, 1000 - 1000 * ARRIVAL_FACTOR)
  })

  test("a degenerate flight collapses without dividing by zero (:1119-1120)", () => {
    const path = buildBezierPath({ spawn, slot: spawn })
    expect(bezierPoint(path, 0.5)).toEqual(spawn)
  })
})

describe("arc-length parameterization", () => {
  test("half the arc length is half the DISTANCE, not half the parameter", () => {
    // Collinear control points 0/300/675/900: the curve is a straight
    // line traversed non-uniformly, which is precisely what the LUT is
    // for. Half its length is x = 450 — at a Bezier parameter that is
    // NOT 0.5 (the raw curve is at x = 478 there).
    const path = buildBezierPath({
      spawn: { x: 0, y: 0, z: 0 },
      slot: { x: 900, y: 0, z: 0 },
      spawnDir: { x: 300, y: 0, z: 0 },
      slotNormal: { x: -1, y: 0, z: 0 },
    })
    const lut = buildArcLut(path)
    near(lut.totalLength, 900, 0.5)
    near(bezierPoint(path, arcLengthToT(lut, 0.5)).x, 450, 0.5)
    expect(Math.abs(arcLengthToT(lut, 0.5) - 0.5)).toBeGreaterThan(0.01)
    near(bezierPoint(path, 0.5).x, 478.125, 1e-6)
  })

  test("equal steps in s cover equal ARC LENGTH on a strongly curved path", () => {
    // Measured as arc length (densely integrated), not as the straight
    // chord between samples: this path swings past its slot and doubles
    // back along the approach normal, so its final chord is much
    // shorter than the distance actually travelled.
    const lut = buildArcLut(
      buildBezierPath({
        spawn: { x: 0, y: 0, z: 0 },
        slot: { x: 1000, y: 0, z: 0 },
        spawnDir: { x: 0, y: 800, z: 0 },
        slotNormal: { x: 1, y: 0, z: 0 },
      }),
    )
    const arcBetween = (t0: number, t1: number): number => {
      const N = 400
      let total = 0
      let prev = bezierPoint(lut.path, t0)
      for (let i = 1; i <= N; i++) {
        const p = bezierPoint(lut.path, t0 + ((t1 - t0) * i) / N)
        total += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z)
        prev = p
      }
      return total
    }
    const steps = 10
    const expected = lut.totalLength / steps
    for (let i = 1; i <= steps; i++) {
      const arc = arcBetween(arcLengthToT(lut, (i - 1) / steps), arcLengthToT(lut, i / steps))
      expect(Math.abs(arc - expected) / expected).toBeLessThan(0.01)
    }
  })

  test("clamps outside [0,1]", () => {
    const lut = buildArcLut(
      buildBezierPath({ spawn: { x: 0, y: 0, z: 0 }, slot: { x: 100, y: 0, z: 0 } }),
    )
    expect(arcLengthToT(lut, -1)).toBe(0)
    expect(arcLengthToT(lut, 2)).toBe(1)
  })
})

describe("pulse count = round(pathLength / 350) (:1256)", () => {
  test("rounds to nearest", () => {
    expect(pulseCountFor(350)).toBe(1)
    expect(pulseCountFor(700)).toBe(2)
    expect(pulseCountFor(1400)).toBe(4)
    expect(pulseCountFor(1500)).toBe(4)
    expect(pulseCountFor(1600)).toBe(5)
  })

  test("never fewer than one pulse, however short the flight", () => {
    expect(pulseCountFor(0)).toBe(1)
    expect(pulseCountFor(10)).toBe(1)
  })

  test("the constant is the source's distance_per_thrust", () => {
    expect(DISTANCE_PER_THRUST).toBe(350)
  })
})

describe("travel: completion → path parameter (:1294-1302)", () => {
  test("travel is COMPLETE at completion 0.85 — the pinned boundary", () => {
    expect(completionToTravel(TRAVEL_END)).toBe(1)
    expect(TRAVEL_END).toBe(0.85)
    expect(completionToTravel(0.8499)).toBeLessThan(1)
    expect(completionToTravel(0.9)).toBe(1)
  })

  test("eases OUT — decelerating into the slot", () => {
    // Past the halfway point of travel well before half the completion.
    expect(completionToTravel(TRAVEL_END / 2)).toBeGreaterThan(0.5)
    const early = completionToTravel(0.2) - completionToTravel(0.1)
    const late = completionToTravel(0.8) - completionToTravel(0.7)
    expect(late).toBeLessThan(early)
  })

  test("starts at rest and is monotone", () => {
    expect(completionToTravel(0)).toBe(0)
    let prev = -1
    for (let i = 0; i <= 100; i++) {
      const v = completionToTravel(i / 100)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe("spline position: the pulses then the brick phase (:332-361)", () => {
  test("endpoints", () => {
    expect(travelToSplinePosition(0, 4)).toBe(0)
    expect(travelToSplinePosition(1, 4)).toBe(1)
  })

  test("the swimming phases cover exactly the first 0.8 of the path", () => {
    near(travelToSplinePosition(THRUST_END, 4), THRUST_TRAVEL, 1e-12)
  })

  test("each pulse covers its own equal share of that travel", () => {
    const pulses = 4
    for (let k = 1; k < pulses; k++) {
      near(travelToSplinePosition((THRUST_END * k) / pulses, pulses), (THRUST_TRAVEL * k) / pulses)
    }
  })

  test("within a pulse: 10% opening, 55% thrusting, 35% gliding (:341-343)", () => {
    const pulses = 4
    const span = THRUST_END / pulses
    const perPulse = THRUST_TRAVEL / pulses
    // End of the OPEN phase (30% of the pulse's time).
    near(travelToSplinePosition(span * 0.3, pulses), perPulse * 0.1)
    // End of the THRUST phase (a further 20% of its time).
    near(travelToSplinePosition(span * 0.5, pulses), perPulse * (0.1 + 0.55))
  })

  test("the thrust is the fastest part of a pulse", () => {
    const pulses = 4
    const span = THRUST_END / pulses
    const at = (u: number) => travelToSplinePosition(span * u, pulses)
    const openRate = (at(0.3) - at(0)) / 0.3
    const thrustRate = (at(0.5) - at(0.3)) / 0.2
    const glideRate = (at(1) - at(0.5)) / 0.5
    expect(thrustRate).toBeGreaterThan(openRate)
    expect(thrustRate).toBeGreaterThan(glideRate)
  })

  test("brick phase: its first 30% covers 15% of what remains (:356-360)", () => {
    const brickStart = THRUST_END + (1 - THRUST_END) * 0.3
    near(travelToSplinePosition(brickStart, 4), THRUST_TRAVEL + (1 - THRUST_TRAVEL) * 0.15)
  })

  test("monotone across the whole range for every pulse count", () => {
    for (const pulses of [1, 2, 4, 7]) {
      let prev = -1
      for (let i = 0; i <= 400; i++) {
        const v = travelToSplinePosition(i / 400, pulses)
        expect(v).toBeGreaterThanOrEqual(prev - 1e-12)
        prev = v
      }
    }
  })
})

describe("fold: the bell (:363-398)", () => {
  test("open at rest, fully wrapped at the end", () => {
    expect(travelToFold(0, 4)).toBe(1)
    expect(travelToFold(1, 4)).toBe(-1)
  })

  test("each swimming pulse dips to 0.1 and snaps back to 1", () => {
    const pulses = 4
    const span = THRUST_END / pulses
    for (let k = 0; k < pulses; k++) {
      const base = k * span
      near(travelToFold(base + span * 0.3, pulses), PULSE_MIN_FOLD)
      // Glide: fully closed again.
      expect(travelToFold(base + span * 0.75, pulses)).toBe(1)
    }
  })

  test("the bell NEVER wraps while swimming — fold stays >= 0.1", () => {
    for (let i = 0; i < 800; i++) {
      const t = (i / 800) * THRUST_END
      expect(travelToFold(t, 4)).toBeGreaterThanOrEqual(PULSE_MIN_FOLD - 1e-12)
    }
  })

  test("brick-fold reaches -1 at exactly 75% of the brick phase (:395-396)", () => {
    const brickAt = (u: number) => THRUST_END + (1 - THRUST_END) * u
    near(travelToFold(brickAt(BRICK_FOLD_END), 4), -1, 1e-12)
    expect(BRICK_FOLD_END).toBe(0.75)
    // Not yet wrapped just before.
    expect(travelToFold(brickAt(0.74), 4)).toBeGreaterThan(-1)
    // Still wrapped through the final quarter, which travels folded.
    expect(travelToFold(brickAt(0.9), 4)).toBe(-1)
  })

  test("the brick phase opens once more (to 0.1) before wrapping", () => {
    const brickAt = (u: number) => THRUST_END + (1 - THRUST_END) * u
    // 30% of the fold window (0.75) = 0.225 of the phase.
    near(travelToFold(brickAt(BRICK_FOLD_END * 0.3), 4), PULSE_MIN_FOLD)
  })

  test("fold stays within its bipolar range everywhere", () => {
    for (let i = 0; i <= 1000; i++) {
      const f = travelToFold(i / 1000, 4)
      expect(f).toBeGreaterThanOrEqual(-1)
      expect(f).toBeLessThanOrEqual(1)
    }
  })
})

describe("scale: tiny lies that grow (:1356-1386)", () => {
  test("the four milestones, exactly", () => {
    expect(completionToScale(0)).toBe(0)
    near(completionToScale(SCALE_POP_END), SCALE_POP_VALUE)
    near(completionToScale(SCALE_CRUISE_END), SCALE_CRUISE_VALUE)
    near(completionToScale(SCALE_RAMP_END), SCALE_RAMP_VALUE)
    expect(completionToScale(1)).toBe(1)
  })

  test("the pop is fast: 20% of full size within 5% of completion", () => {
    expect(completionToScale(0.025)).toBeGreaterThan(SCALE_POP_VALUE * 0.5)
  })

  test("the cruise is the slow stretch — most of the flight stays small", () => {
    expect(completionToScale(0.4)).toBeLessThan(0.3)
    const cruiseRate = (SCALE_CRUISE_VALUE - SCALE_POP_VALUE) / (SCALE_CRUISE_END - SCALE_POP_END)
    const rampRate = (SCALE_RAMP_VALUE - SCALE_CRUISE_VALUE) / (SCALE_RAMP_END - SCALE_CRUISE_END)
    expect(rampRate).toBeGreaterThan(cruiseRate * 10)
  })

  test("monotone, and never outside [0,1]", () => {
    let prev = -1
    for (let i = 0; i <= 1000; i++) {
      const s = completionToScale(i / 1000)
      expect(s).toBeGreaterThanOrEqual(prev - 1e-12)
      expect(s).toBeLessThanOrEqual(1)
      prev = s
    }
  })
})

describe("the growth wave (:1283-1290)", () => {
  const config = { rowCount: 4, rowLength: 60, rowLag: 1.66 }

  test("growth 0 leaves everything unbuilt", () => {
    expect(completionOf(0, { splineT: 0, row: 0 }, config)).toBe(0)
    expect(completionOf(0, { splineT: 0.5, row: 2 }, config)).toBe(0)
  })

  test("growth 1 completes every slot EXCEPT the very end of the footprint", () => {
    // The wave's range is stretched by the accumulated row lag, which is
    // what lets the top row finish at all — but only the lag is added,
    // not the smoothstep's own width. So a slot at splineT = 1 is still
    // mid-transition (row 0) or has not begun (the last row) when growth
    // reaches 1. Verified against the source's arithmetic verbatim: it
    // yields the same 0.5936 / 0 at splineT = 1.
    //
    // Exactly: at growth = 1 every row is complete out to splineT =
    // 1 − TRANSITION_WIDTH = 0.85, and the last row fades to nothing
    // over the remaining 0.15.
    //
    // It barely shows in practice — packSlots never places a brick AT
    // t = 1 (a closed footprint stops before wrapping onto its first
    // brick) — but the tail slots of the top row genuinely do lag, so
    // scenes drive growth slightly past 1 to seal the wall. Recorded
    // because it is a property of the original, not a port artifact.
    for (const row of [0, 1, 2, 3]) {
      for (const splineT of [0, 0.5, 0.85]) {
        expect(completionOf(1, { splineT, row }, config)).toBe(1)
      }
    }
    near(completionOf(1, { splineT: 1, row: 0 }, config), 0.5936, 1e-4)
    expect(completionOf(1, { splineT: 1, row: 3 }, config)).toBe(0)
    // Driving the wave past 1 seals it.
    expect(completionOf(1.2, { splineT: 1, row: 3 }, config)).toBe(1)
  })

  test("the wave sweeps along the footprint — earlier slots complete first", () => {
    const growth = 0.5
    const early = completionOf(growth, { splineT: 0.1, row: 0 }, config)
    const late = completionOf(growth, { splineT: 0.9, row: 0 }, config)
    expect(early).toBeGreaterThan(late)
  })

  test("higher rows lag lower ones", () => {
    const growth = 0.5
    const bottom = completionOf(growth, { splineT: 0.4, row: 0 }, config)
    const top = completionOf(growth, { splineT: 0.4, row: 3 }, config)
    expect(bottom).toBeGreaterThan(top)
  })

  test("with no lag every row is in lockstep", () => {
    const flat = { ...config, rowLag: 0 }
    const a = completionOf(0.5, { splineT: 0.3, row: 0 }, flat)
    const b = completionOf(0.5, { splineT: 0.3, row: 3 }, flat)
    expect(a).toBe(b)
  })

  test("a slot's completion is monotone in growth", () => {
    let prev = -1
    for (let i = 0; i <= 200; i++) {
      const c = completionOf(i / 200, { splineT: 0.5, row: 1 }, config)
      expect(c).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = c
    }
  })

  test("row lag is measured in BRICKS — one brick of lag shifts by one slot", () => {
    const cfg = { rowCount: 2, rowLength: 11, rowLag: 1 }
    const brick = 1 / 10
    // Row 1 at slot k behaves like row 0 at slot k+1.
    near(
      completionOf(0.5, { splineT: 0.3, row: 1 }, cfg),
      completionOf(0.5, { splineT: 0.3 + brick, row: 0 }, cfg),
      1e-12,
    )
  })
})

describe("journeyState — the whole pipeline", () => {
  const journey = buildJourney({
    spawn: { x: 0, y: 0, z: 0 },
    slot: { x: 1000, y: 100, z: 0 },
    spawnDir: { x: 0, y: 500, z: 0 },
    slotNormal: { x: 1, y: 0, z: 0 },
  })

  test("completion 0: at the spawn, open, invisible", () => {
    const s = journeyState(0, journey)
    expect(s.position).toEqual({ x: 0, y: 0, z: 0 })
    expect(s.fold).toBe(1)
    expect(s.scale).toBe(0)
  })

  test("completion 1: in its slot, wrapped shut, full size", () => {
    const s = journeyState(1, journey)
    near(s.position.x, 1000, 1e-6)
    near(s.position.y, 100, 1e-6)
    expect(s.fold).toBe(-1)
    expect(s.scale).toBe(1)
  })

  test("arrives at its slot by completion 0.85 and stays put (:1294)", () => {
    const at85 = journeyState(TRAVEL_END, journey)
    const at1 = journeyState(1, journey)
    near(at85.position.x, at1.position.x, 1e-6)
    near(at85.position.y, at1.position.y, 1e-6)
    // But it is still growing and still folding after arrival.
    expect(journeyState(TRAVEL_END, journey).scale).toBeLessThan(1)
  })

  test("the creature faces -tangent — its face leads its motion (:1341-1345)", () => {
    const s = journeyState(0.3, journey)
    const t = bezierTangent(journey.lut.path, arcLengthToT(journey.lut, s.splineS))
    const l = Math.hypot(t.x, t.y, t.z)
    near(s.heading.x, -t.x / l, 1e-9)
    near(s.heading.y, -t.y / l, 1e-9)
    near(s.heading.z, -t.z / l, 1e-9)
  })

  test("heading is a unit vector throughout", () => {
    for (let i = 0; i <= 50; i++) {
      const { heading } = journeyState(i / 50, journey)
      near(Math.hypot(heading.x, heading.y, heading.z), 1, 1e-9)
    }
  })

  test("clamps completion outside [0,1] instead of extrapolating", () => {
    expect(journeyState(-5, journey).scale).toBe(0)
    expect(journeyState(5, journey).fold).toBe(-1)
  })

  test("travel is monotone along the path", () => {
    let prev = -1
    for (let i = 0; i <= 400; i++) {
      const s = journeyState(i / 400, journey)
      expect(s.splineS).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = s.splineS
    }
  })

  test("pure: same input, same output", () => {
    const a = journeyState(0.42, journey)
    const b = journeyState(0.42, journey)
    expect(a).toEqual(b)
  })
})
