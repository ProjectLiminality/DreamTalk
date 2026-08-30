/**
 * xpbd.test.ts — the tether solver.
 *
 * What is pinned here: the step is a FUNCTION (same in, same out, input
 * untouched), the endpoints stay where they are told, the chain
 * converges to its rest length, the speed clamp holds, and the
 * collision cube derived from the ONE FoldableCube definition agrees
 * with that cube's own geometry.
 */

import { describe, expect, test } from "bun:test"
import {
  CABLE_DRAG,
  CABLE_MAX_VELOCITY,
  CABLE_PARTICLES,
  CABLE_STIFFNESS,
  COLLISION_THICKNESS,
  colliderScale,
  foldableCubeFaces,
  IDENTITY_FRAME,
  pointFaceCollision,
  settleParams,
  SETTLE_START,
  step,
  straightState,
  type CableState,
  type StepConfig,
} from "../src/geometry/xpbd"
import type { Vec3 } from "../src/geometry/journey"

const A: Vec3 = { x: 0, y: 0, z: 0 }
const B: Vec3 = { x: 300, y: 0, z: 0 }
const dist = (p: Vec3, q: Vec3): number => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)

const baseConfig = (rest: number): StepConfig => ({
  anchor: A,
  tip: B,
  dt: 1 / 30,
  restLength: rest,
})

const settleFor = (frames: number, config: StepConfig, from?: CableState): CableState => {
  let s = from ?? straightState(A, B)
  for (let i = 0; i < frames; i++) s = step(s, config)
  return s
}

describe("the step is a function", () => {
  test("same inputs give bit-identical outputs", () => {
    const s = straightState(A, B)
    const c = baseConfig(20)
    const one = step(s, c)
    const two = step(s, c)
    for (let i = 0; i < one.positions.length; i++) {
      expect(one.positions[i]).toEqual(two.positions[i]!)
      expect(one.velocities[i]).toEqual(two.velocities[i]!)
    }
  })

  test("the input state is not mutated", () => {
    const s = straightState(A, B)
    const before = JSON.stringify(s)
    step(s, baseConfig(20))
    expect(JSON.stringify(s)).toBe(before)
  })

  test("no hidden state: a replayed sequence reproduces itself", () => {
    const c = baseConfig(18)
    const first = settleFor(40, c)
    const second = settleFor(40, c)
    expect(second.positions).toEqual(first.positions)
  })
})

describe("endpoint pinning", () => {
  test("both ends sit exactly where the config says, every frame", () => {
    let s = straightState(A, B)
    const anchor = { x: -10, y: 5, z: 2 }
    for (let i = 0; i < 30; i++) {
      const tip = { x: 300 + i, y: i * 2, z: 0 }
      s = step(s, { ...baseConfig(20), anchor, tip })
      expect(s.positions[0]).toEqual(anchor)
      expect(s.positions[s.positions.length - 1]).toEqual(tip)
    }
  })

  test("a chain of one segment is left alone", () => {
    const s: CableState = { positions: [A, B], velocities: [A, A] }
    const out = step(s, baseConfig(300))
    expect(out.positions[0]).toEqual(A)
    expect(out.positions[1]).toEqual(B)
  })
})

describe("constraint convergence", () => {
  test("segments reach their rest length once the chain has settled", () => {
    // Rest length exactly spans the gap: the straight chain IS the
    // solution, and gravity must not be able to pull it off it.
    const rest = 300 / (CABLE_PARTICLES - 1)
    const s = settleFor(200, { ...baseConfig(rest), drag: 2 })
    for (let i = 0; i < s.positions.length - 1; i++) {
      expect(Math.abs(dist(s.positions[i]!, s.positions[i + 1]!) - rest)).toBeLessThan(rest * 0.05)
    }
  })

  test("a slack chain hangs: total length exceeds the straight span", () => {
    const rest = (300 * 1.3) / (CABLE_PARTICLES - 1)
    const s = settleFor(150, baseConfig(rest))
    let total = 0
    for (let i = 0; i < s.positions.length - 1; i++) total += dist(s.positions[i]!, s.positions[i + 1]!)
    expect(total).toBeGreaterThan(300 * 1.1)
    // and it sags DOWNWARD — gravity is −y
    const mid = s.positions[Math.floor(CABLE_PARTICLES / 2)]!
    expect(mid.y).toBeLessThan(-1)
  })

  test("a chain stretched beyond its rest length is pulled taut, not snapped", () => {
    // Rest far shorter than the span: the pinned ends win, and every
    // interior particle ends up on the line between them.
    const s = settleFor(200, { ...baseConfig(1), drag: 2 })
    for (const p of s.positions) {
      expect(Math.abs(p.y)).toBeLessThan(30)
      expect(Math.abs(p.z)).toBeLessThan(1e-6)
    }
  })
})

describe("energy sanity", () => {
  test("the velocity clamp is respected on output", () => {
    // A violently moving tip injects far more than 300 units/s.
    let s = straightState(A, B)
    for (let i = 0; i < 20; i++) {
      const tip = { x: 300, y: i % 2 === 0 ? 4000 : -4000, z: 0 }
      s = step(s, { ...baseConfig(20), tip })
      for (const v of s.velocities) {
        expect(Math.hypot(v.x, v.y, v.z)).toBeLessThanOrEqual(CABLE_MAX_VELOCITY + 1e-6)
      }
    }
  })

  test("it does not explode: a long free run stays bounded", () => {
    const rest = (300 * 1.3) / (CABLE_PARTICLES - 1)
    const s = settleFor(600, baseConfig(rest))
    for (const p of s.positions) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true)
      expect(Math.hypot(p.x, p.y, p.z)).toBeLessThan(2000)
    }
  })

  test("gravity off and drag high leaves a straight chain straight", () => {
    const rest = 300 / (CABLE_PARTICLES - 1)
    const s = settleFor(50, { ...baseConfig(rest), gravity: { x: 0, y: 0, z: 0 } })
    for (const p of s.positions) expect(Math.abs(p.y)).toBeLessThan(1e-6)
  })
})

describe("directional constraints", () => {
  test("the anchor end leaves along its spawn direction", () => {
    const rest = (300 * 1.3) / (CABLE_PARTICLES - 1)
    const s = settleFor(60, {
      ...baseConfig(rest),
      anchorDir: { x: 0, y: 1, z: 0 },
    })
    // Particle 1 is pulled hardest toward anchor + up·rest.
    expect(s.positions[1]!.y).toBeGreaterThan(0)
  })

  test("reach is three particles, each pulled a decreasing FRACTION of the way", () => {
    // Each of particles 1..3 has its own target (j·rest along the
    // direction) and its own weight, 0.5 · (1 − (j−1)/3): 0.5, 1/3,
    // 1/6. The property is the FRACTION of the way covered, not the
    // absolute height — particle 2 aims twice as far as particle 1.
    const rest = 20
    const s = step(straightState(A, B), {
      ...baseConfig(rest),
      anchorDir: { x: 0, y: 1, z: 0 },
      gravity: { x: 0, y: 0, z: 0 },
      stiffness: 0,
      iterations: 1,
    })
    const fraction = (j: number): number => s.positions[j]!.y / (j * rest)
    expect(fraction(1)).toBeCloseTo(0.5, 6)
    expect(fraction(2)).toBeCloseTo(1 / 3, 6)
    expect(fraction(3)).toBeCloseTo(1 / 6, 6)
    // The fourth particle is outside the reach entirely.
    expect(s.positions[4]!.y).toBeCloseTo(0, 6)
  })

  test("the tip end is pulled the same way, counting inward from the last", () => {
    const rest = 20
    const s = step(straightState(A, B), {
      ...baseConfig(rest),
      tipDir: { x: 0, y: 1, z: 0 },
      gravity: { x: 0, y: 0, z: 0 },
      stiffness: 0,
      iterations: 1,
    })
    const n = s.positions.length
    expect(s.positions[n - 2]!.y / rest).toBeCloseTo(0.5, 6)
    expect(s.positions[n - 5]!.y).toBeCloseTo(0, 6)
  })
})

describe("the settle schedule (:1485-1489)", () => {
  test("below the threshold nothing changes", () => {
    const p = settleParams(0.5)
    expect(p.stiffness).toBe(CABLE_STIFFNESS)
    expect(p.drag).toBe(CABLE_DRAG)
    expect(p.dirStrength).toBe(0.5)
  })

  test("at full settle: stiffness 0.8, drag 0.5, dir halved", () => {
    const p = settleParams(1)
    expect(p.stiffness).toBeCloseTo(0.8, 10)
    expect(p.drag).toBeCloseTo(0.5, 10)
    expect(p.dirStrength).toBeCloseTo(0.25, 10)
  })

  test("it is continuous at the threshold", () => {
    const before = settleParams(SETTLE_START - 1e-9)
    const after = settleParams(SETTLE_START + 1e-9)
    expect(after.stiffness - before.stiffness).toBeLessThan(1e-6)
  })
})

describe("the collider fade (:1503-1508)", () => {
  test("absent early, ramping, then full", () => {
    expect(colliderScale(0.1)).toBe(0)
    expect(colliderScale(0.15)).toBe(0)
    expect(colliderScale(0.325)).toBeCloseTo(0.5, 10)
    expect(colliderScale(0.5)).toBe(1)
    expect(colliderScale(0.9)).toBe(1)
  })
})

describe("collision against the ONE cube definition", () => {
  test("five faces: a bottom and four walls", () => {
    expect(foldableCubeFaces(A, IDENTITY_FRAME, 1, 1).length).toBe(5)
  })

  test("at fold 1 the walls stand upright — the open cup", () => {
    const faces = foldableCubeFaces(A, IDENTITY_FRAME, 1, 1, 100)
    // Every wall's far edge is one edge-length above the ground.
    for (let f = 1; f < 5; f++) {
      const ys = faces[f]!.corners.map((c) => c.y)
      expect(Math.max(...ys)).toBeCloseTo(100, 6)
      expect(Math.min(...ys)).toBeCloseTo(0, 6)
    }
  })

  test("at fold 0 the walls lie flat — the unfolded cross", () => {
    const faces = foldableCubeFaces(A, IDENTITY_FRAME, 0, 1, 100)
    for (const face of faces) for (const c of face.corners) expect(Math.abs(c.y)).toBeLessThan(1e-9)
    // The cross reaches 1.5 edges out in each ground direction.
    const xs = faces.flatMap((f) => f.corners.map((c) => c.x))
    expect(Math.max(...xs)).toBeCloseTo(150, 6)
  })

  test("at fold −1 the walls wrap through to −y", () => {
    const faces = foldableCubeFaces(A, IDENTITY_FRAME, -1, 1, 100)
    for (let f = 1; f < 5; f++) {
      expect(Math.min(...faces[f]!.corners.map((c) => c.y))).toBeCloseTo(-100, 6)
    }
  })

  test("scale shrinks the whole cube — the collider fade", () => {
    const half = foldableCubeFaces(A, IDENTITY_FRAME, 1, 0.5, 100)
    expect(Math.max(...half[1]!.corners.map((c) => c.y))).toBeCloseTo(50, 6)
  })

  test("the frame rotates it: a quarter turn swaps x and z extents", () => {
    const turned: typeof IDENTITY_FRAME = {
      vx: { x: 0, y: 0, z: -1 },
      vy: { x: 0, y: 1, z: 0 },
      vz: { x: 1, y: 0, z: 0 },
    }
    const flat = foldableCubeFaces(A, turned, 0, 1, 100)
    const zs = flat.flatMap((f) => f.corners.map((c) => c.z))
    expect(Math.max(...zs)).toBeCloseTo(150, 6)
  })

  test("a point inside the collision band is pushed to the surface", () => {
    const bottom = foldableCubeFaces(A, IDENTITY_FRAME, 1, 1, 100)[0]!
    const inside = { x: 0, y: bottom.normal.y * 5, z: 0 }
    const { point, collided } = pointFaceCollision(inside, bottom)
    expect(collided).toBe(true)
    // Half the way (push 0.5) toward normal · thickness.
    const along = point.y * bottom.normal.y
    expect(along).toBeGreaterThan(5)
    expect(along).toBeLessThanOrEqual(COLLISION_THICKNESS)
  })

  test("a point beyond the thickness band is untouched", () => {
    const bottom = foldableCubeFaces(A, IDENTITY_FRAME, 1, 1, 100)[0]!
    const far = { x: 0, y: 500, z: 0 }
    expect(pointFaceCollision(far, bottom).collided).toBe(false)
  })

  test("a point outside the quad's bounds is untouched even at zero distance", () => {
    const bottom = foldableCubeFaces(A, IDENTITY_FRAME, 1, 1, 100)[0]!
    expect(pointFaceCollision({ x: 400, y: 0, z: 0 }, bottom).collided).toBe(false)
  })

  test("the cable is kept out of the cube it drapes over", () => {
    // A chain pinned across the cube's middle, with the cube in the way.
    const faces = foldableCubeFaces({ x: 150, y: 0, z: 0 }, IDENTITY_FRAME, 1, 1, 100)
    let s = straightState(A, { x: 300, y: 0, z: 0 })
    for (let i = 0; i < 120; i++) s = step(s, { ...baseConfig(18), faces })
    // No particle ends up sitting on a face's surface inside the band.
    for (let i = 1; i < s.positions.length - 1; i++) {
      const p = s.positions[i]!
      const insideBottom = Math.abs(p.x - 150) < 50 && Math.abs(p.z) < 50 && Math.abs(p.y) < 1
      expect(insideBottom).toBe(false)
    }
  })
})
