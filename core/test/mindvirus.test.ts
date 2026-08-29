/**
 * MindVirus — the jellyfish profile, the journey derivation, and the
 * pass-the-param plumbing, pinned against the source's numbers
 * (MindVirus.py thrust_pulse: phases 30/20/50, distances 5/55/40,
 * min fold 0.1; States idle/hunting/attached = fold 1 / 0.5 / −1).
 */

import { describe, expect, test } from "bun:test"
import {
  MindVirus,
  PULSE_SHARES,
  forwardFor,
  headingFor,
  pulseDistance,
  pulseFold,
} from "../src/parts/mindvirus"
import { PI } from "../src/constants"

describe("the pulse profile", () => {
  test("phase boundaries carry the source's distance shares 5/55/40", () => {
    expect(pulseDistance(0)).toBe(0)
    expect(pulseDistance(0.3)).toBeCloseTo(0.05, 12) // open done
    expect(pulseDistance(0.5)).toBeCloseTo(0.6, 12) // thrust done
    expect(pulseDistance(1)).toBe(1)
  })

  test("fold cycles 1 → 0.1 → 1 at the phase boundaries", () => {
    expect(pulseFold(0)).toBe(1)
    expect(pulseFold(0.3)).toBeCloseTo(0.1, 12)
    expect(pulseFold(0.5)).toBeCloseTo(1, 12)
    expect(pulseFold(0.75)).toBe(1)
    expect(pulseFold(1)).toBe(1)
  })

  test("headway is monotone and fold stays within [0.1, 1]", () => {
    let prev = 0
    for (let k = 0; k <= 200; k++) {
      const u = k / 200
      const d = pulseDistance(u)
      expect(d).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = d
      const f = pulseFold(u)
      expect(f).toBeGreaterThanOrEqual(0.1 - 1e-12)
      expect(f).toBeLessThanOrEqual(1 + 1e-12)
    }
  })

  test("custom shares move the boundaries with them", () => {
    const shares = { open: 0.19, thrust: 0.13 }
    expect(pulseDistance(0.19, shares)).toBeCloseTo(0.05, 12)
    expect(pulseDistance(0.32, shares)).toBeCloseTo(0.6, 12)
    expect(pulseFold(0.19, shares)).toBeCloseTo(0.1, 12)
    expect(pulseFold(0.32, shares)).toBeCloseTo(1, 12)
  })
})

describe("heading math", () => {
  test("forwardFor(headingFor(dir)) round-trips", () => {
    const dirs = [
      { x: 0, y: 0, z: 1 },
      { x: 0.6, y: 0, z: 0.8 },
      { x: -0.36, y: -0.13, z: 0.92 },
      { x: 0.2, y: 0.5, z: 0.84 },
    ]
    for (const d of dirs) {
      const l = Math.hypot(d.x, d.y, d.z)
      const unit = { x: d.x / l, y: d.y / l, z: d.z / l }
      const { h, p } = headingFor(unit)
      const back = forwardFor(h, p)
      expect(back.x).toBeCloseTo(unit.x, 9)
      expect(back.y).toBeCloseTo(unit.y, 9)
      expect(back.z).toBeCloseTo(unit.z, 9)
    }
  })
})

describe("anatomy", () => {
  test("fold passes-the-param into the cube; states carry the source values", () => {
    const virus = new MindVirus()
    void virus.parts
    expect(virus.cube.fold).toBe(virus.fold)
    expect(virus.fold.value).toBe(1) // idle at birth
    virus.fold.value = 0.5
    expect(virus.cube.frontPivot.p.value).toBeCloseTo(-(0.5 * PI) / 2, 12)
    expect(virus.states.idle.values["fold"]).toBe(1)
    expect(virus.states.hunting.values["fold"]).toBe(0.5)
    expect(virus.states.attached.values["fold"]).toBe(-1)
  })

  test("the cube trails aft: walls point −z at fold 1 (bell behind the face)", () => {
    const virus = new MindVirus()
    void virus.parts
    // cube pitched −PI/2: its +y (walls at fold 1) lands on local −z
    expect(virus.cube.p.value).toBeCloseTo(-PI / 2, 12)
  })
})

describe("the journey (pure-timeline spelling)", () => {
  const journey = {
    origin: { x: 0, y: 0, z: 0 },
    pulses: [
      { start: 0.5, duration: 1, to: { x: 100, y: 0, z: 0 } },
      { start: 2, duration: 1, to: { x: 100, y: 0, z: 200 } },
    ],
  }

  test("pathAt: rests at origin, hits waypoints, holds between pulses", () => {
    const virus = new MindVirus({ journey })
    void virus.parts
    expect(virus.pathAt(0)).toEqual({ x: 0, y: 0, z: 0 })
    expect(virus.pathAt(0.5)).toEqual({ x: 0, y: 0, z: 0 })
    expect(virus.pathAt(1.5).x).toBeCloseTo(100, 9)
    expect(virus.pathAt(1.8).x).toBeCloseTo(100, 9) // holding
    expect(virus.pathAt(3).z).toBeCloseTo(200, 9)
    expect(virus.pathAt(99).z).toBeCloseTo(200, 9)
    // mid-thrust of pulse 1: origin + 0.6 of the way
    expect(virus.pathAt(1).x).toBeCloseTo(60, 9)
  })

  test("transform and fold FOLLOW the clock", () => {
    const virus = new MindVirus({ journey })
    void virus.parts
    virus.clock.value = 1 // pulse 1, u = 0.5 (thrust just done)
    expect(virus.x.value).toBeCloseTo(60, 9)
    expect(virus.fold.value).toBeCloseTo(1, 9)
    virus.clock.value = 0.8 // u = 0.3 — the bell fully open
    expect(virus.fold.value).toBeCloseTo(0.1, 9)
    // heading: pulse 1 travels +x → h = PI/2
    virus.clock.value = 1.4
    expect(virus.h.value).toBeCloseTo(PI / 2, 9)
  })

  test("the whole composite is pure: scrub away and back, bit-identical", () => {
    const virus = new MindVirus({ journey })
    void virus.parts
    const grab = (): string =>
      JSON.stringify({
        x: virus.x.value,
        z: virus.z.value,
        h: virus.h.value,
        fold: virus.fold.value,
        a: virus.cable.edgeA.points,
        rings: virus.cable.ringLines.map((r) => r.points),
      })
    virus.clock.value = 2.6
    const first = grab()
    for (const t of [0.1, 3, 1.2]) {
      virus.clock.value = t
      void grab()
    }
    virus.clock.value = 2.6
    expect(grab()).toBe(first)
  })

  test("the cable rides the journey: its head is the creature (local origin)", () => {
    const virus = new MindVirus({ journey })
    void virus.parts
    virus.clock.value = 1.5
    const a0 = virus.cable.edgeA.points[0]!
    const b0 = virus.cable.edgeB.points[0]!
    expect((a0.x + b0.x) / 2).toBeCloseTo(0, 6)
    expect((a0.y + b0.y) / 2).toBeCloseTo(0, 6)
    expect((a0.z + b0.z) / 2).toBeCloseTo(0, 6)
  })
})

describe("thrustPulse (free-swimming spelling)", () => {
  test("samples the same profile: final pose and mid-thrust waypoint agree", () => {
    const virus = new MindVirus()
    void virus.parts
    // face +x
    virus.h.value = PI / 2
    const anim = virus.thrustPulse(100)
    const xTrack = anim.tracks.find((t) => t.param === virus.x)!
    const foldTrack = anim.tracks.find((t) => t.param === virus.fold)!
    const last = xTrack.values[xTrack.values.length - 1] as number
    expect(last).toBeCloseTo(100, 9)
    // waypoint at u = 0.5 (index 30 of 60): 60% of the distance
    expect(xTrack.values[30] as number).toBeCloseTo(60, 9)
    expect(foldTrack.values[18] as number).toBeCloseTo(pulseFold(0.3), 9)
    expect(foldTrack.values[0] as number).toBe(1)
    for (const track of anim.tracks) expect(track.easing).toBe("linear")
    expect(PULSE_SHARES.open + PULSE_SHARES.thrust).toBeCloseTo(0.5, 12)
  })
})
