/**
 * xpbd.ts — the tether solver, pure-stepped.
 *
 * Ported from TheWall/TheWall.py's XPBD_CABLE_CODE (line citations refer
 * to it): a chain of particles pinned at both ends — the spawn anchor
 * and the flying MindVirus — that hangs, swings, and drapes over the
 * creature's folding cube. It is the stack's ONE genuinely stateful
 * holon: each frame's positions depend on the last frame's, so it
 * cannot be sampled at arbitrary t. That is exactly the case bake.ts
 * exists for (ONTOLOGY "Baking, corrected").
 *
 * ## Pure-stepped, not stateful
 *
 * The original kept its state in a C4D spline smuggled to the document
 * root (`read_cable_state`/`write_cable_state`, :663-702) and found it
 * again next frame by name — the same blackboard the wall layer already
 * killed for packing. Here `step(state, config)` takes the whole state
 * in and hands the whole next state back. Nothing is hidden, nothing is
 * global, nothing is random: the same inputs give bit-identical outputs
 * forever, which is what makes the bake reproducible and the tests
 * meaningful. The *simulation* is history-dependent; the *step* is a
 * function.
 *
 * ## The one step (:539-662), in order
 *
 *  1. Pin both endpoints into the predicted positions.
 *  2. Laplacian velocity smoothing — each interior particle's velocity
 *     blended toward the mean of its two neighbours' and its own
 *     (:565-572). Viscosity: it kills the high-frequency shimmer a
 *     6-iteration solver leaves behind, without damping bulk swing.
 *  3. Predict interior positions: gravity, then drag as a per-step
 *     multiplier `max(0, 1 − drag·dt)`, then a speed clamp (:575-583).
 *  4. `iterations` solver passes, each: distance constraints along the
 *     chain (both particles pulled half the error, pinned ones not
 *     moved, :588-599); re-pin (:601-603); directional constraints at
 *     the anchor and the tip (:605-628); bending toward the midpoint of
 *     the neighbours (:630-634); face collisions (:636-640).
 *  5. Velocities derived from the position DELTA over dt, clamped
 *     (:642-650) — the position-based-dynamics signature: velocity is a
 *     readout of what the constraints did, never integrated forward
 *     independently.
 *
 * ## The collision model, de-duplicated
 *
 * The original re-derived the FoldableCube's five faces analytically in
 * `compute_foldable_cube_faces` (:405-500) — a second, drifting copy of
 * a shape this framework already defines once. Here `foldableCubeFaces`
 * derives the same quads from the ONE hinge law the cube itself uses
 * (parts/foldablecube.ts `hingeAngle`), so a change to the cube reaches
 * the collider automatically (DECISIONS 2026-08-29, improvement #5).
 */

import { hingeAngle } from "../parts/foldablecube"
import type { Vec3 } from "./journey"

// --- vec3, module-local ----------------------------------------------------

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const mul = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k })
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z)
const normalize = (a: Vec3): Vec3 | undefined => {
  const l = length(a)
  return l < 1e-9 ? undefined : mul(a, 1 / l)
}

// --- the source's constants, named and cited -------------------------------

/** Particles in the chain: CABLE_SEGMENTS 20 + 1 (:1427). */
export const CABLE_PARTICLES = 21
/** Solver passes per step (XPBD_ITERATIONS, :1522). */
export const XPBD_ITERATIONS = 6
/** Gravity, world units/s² — downward in +y-up space (:1477). */
export const CABLE_GRAVITY = -50
/** Velocity damping coefficient; applied as `1 − drag·dt` (:578). */
export const CABLE_DRAG = 0.15
/** Bending stiffness: blend toward the neighbours' midpoint (:632). */
export const CABLE_STIFFNESS = 0.15
/** Speed clamp, world units/s (:580-582, :646-649). */
export const CABLE_MAX_VELOCITY = 300
/** Laplacian velocity smoothing factor (:565-572). */
export const CABLE_VELOCITY_SMOOTHING = 0.3
/** How hard the end constraints pull toward their target line (:610). */
export const CABLE_DIR_STRENGTH = 0.5
/** Rest length = distance travelled × this (:1473). */
export const CABLE_SLACK = 1.3
/** Collision band half-thickness, world units (:508, :639). */
export const COLLISION_THICKNESS = 15
/** How far toward the pushed-out target a colliding point moves (:639). */
export const COLLISION_PUSH = 0.5
/** Particles at each end that the directional constraints reach (:608). */
export const DIR_CONSTRAINT_REACH = 3

/** Below this completion the tether is a straight line, unsimulated (:1412). */
export const XPBD_ACTIVATION = 0.08
/** Below this completion no tether is drawn at all (:1420). */
export const CABLE_VISIBLE_FROM = 0.02
/** The collider fades in across this completion band (:1503-1508). */
export const COLLIDER_FADE_START = 0.15
export const COLLIDER_FADE_END = 0.5
/** Past this completion the cable settles: stiffer, draggier, looser
 *  ends (:1485-1489). */
export const SETTLE_START = 0.75
/** Settled targets (:1487-1489). */
export const SETTLE_STIFFNESS = 0.8
export const SETTLE_DRAG = 0.5
/** dir_strength is HALVED at full settle, not zeroed (:1489). */
export const SETTLE_DIR_FALLOFF = 0.5

// --- state and configuration ----------------------------------------------

/** The whole simulation state. Nothing else persists between steps. */
export interface CableState {
  positions: Vec3[]
  velocities: Vec3[]
}

/** A collision quad: four corners plus the outward normal (:415-424). */
export interface CollisionFace {
  corners: [Vec3, Vec3, Vec3, Vec3]
  normal: Vec3
}

/** Everything one step needs besides the state. */
export interface StepConfig {
  /** Pinned position of particle 0 — the spawn anchor (:551). */
  anchor: Vec3
  /** Pinned position of the last particle — the creature (:552). */
  tip: Vec3
  /** Timestep, seconds (:1476 — the source steps at 1/30). */
  dt: number
  /** Target length of ONE segment (:1474). */
  restLength: number
  /** Gravity vector (:1477). */
  gravity?: Vec3
  drag?: number
  stiffness?: number
  iterations?: number
  maxVelocity?: number
  velocitySmoothing?: number
  /** Direction the cable departs the anchor — the spawn direction. */
  anchorDir?: Vec3
  /** Direction the cable enters the tip — −(flight tangent) (:1480). */
  tipDir?: Vec3
  dirStrength?: number
  /** Cube faces to collide against, or none while the collider is faded out. */
  faces?: readonly CollisionFace[]
}

/** A straight chain from anchor to tip, at rest — the initial state and
 *  the state the source rewrites every frame below XPBD_ACTIVATION
 *  (:1456-1463). */
export const straightState = (anchor: Vec3, tip: Vec3, particles = CABLE_PARTICLES): CableState => {
  const positions: Vec3[] = []
  const velocities: Vec3[] = []
  for (let i = 0; i < particles; i++) {
    const t = i / (particles - 1)
    positions.push(add(anchor, mul(sub(tip, anchor), t)))
    velocities.push({ x: 0, y: 0, z: 0 })
  }
  return { positions, velocities }
}

// --- collision -------------------------------------------------------------

/**
 * One point against one quad (:502-537). Two-sided detection within
 * `thickness` of the plane, inside-test by the sign of each edge cross
 * product against the normal, then a partial push to the outer surface.
 *
 * Note the original's asymmetry, preserved: a point BEHIND the face is
 * pushed to the same +normal side as one in front, so the cube ejects
 * everything outward rather than trapping what has slipped inside.
 */
export const pointFaceCollision = (
  point: Vec3,
  face: CollisionFace,
  push = COLLISION_PUSH,
  thickness = COLLISION_THICKNESS,
): { point: Vec3; collided: boolean } => {
  const { corners, normal } = face
  const dist = dot(sub(point, corners[0]), normal)
  if (dist < -thickness || dist > thickness) return { point, collided: false }

  const proj = sub(point, mul(normal, dist))
  for (let e = 0; e < 4; e++) {
    const a = corners[e]!
    const b = corners[(e + 1) % 4]!
    if (dot(cross(sub(b, a), sub(proj, a)), normal) < 0) return { point, collided: false }
  }

  const target = add(proj, mul(normal, thickness))
  return { point: add(point, mul(sub(target, point), push)), collided: true }
}

/** An orthonormal frame: the columns of the tip's rotation matrix
 *  (`rot_mat.v1/v2/v3`, :1495-1499 — the virus matrix, normalized). */
export interface Frame {
  vx: Vec3
  vy: Vec3
  vz: Vec3
}

export const IDENTITY_FRAME: Frame = {
  vx: { x: 1, y: 0, z: 0 },
  vy: { x: 0, y: 1, z: 0 },
  vz: { x: 0, y: 0, z: 1 },
}

/**
 * The FoldableCube's five faces in world space — bottom plus four walls
 * swung on their hinges.
 *
 * This replaces the source's second cube model (:405-500). The hinge
 * angle comes from `hingeAngle(fold)`, the cube's OWN law, and each
 * wall is the same square the cube builds: hinged on a bottom edge at
 * ±size/2, extending one edge-length away from that hinge, rotating out
 * of the ground plane by the hinge angle. At fold = 1 the four walls
 * stand upright and the five quads are the cup the creature becomes; at
 * fold = 0 they lie flat as the unfolded cross.
 *
 * `scale` multiplies the local geometry before it is placed — that is
 * how the source fades the collider in (:1503-1515): a zero-scale cube
 * simply has no faces.
 */
export const foldableCubeFaces = (
  center: Vec3,
  frame: Frame,
  fold: number,
  scale: number,
  size = 100,
): CollisionFace[] => {
  const angle = hingeAngle(fold)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const h = size / 2

  const toWorld = (p: Vec3): Vec3 =>
    add(center, {
      x: (frame.vx.x * p.x + frame.vy.x * p.y + frame.vz.x * p.z) * scale,
      y: (frame.vx.y * p.x + frame.vy.y * p.y + frame.vz.y * p.z) * scale,
      z: (frame.vx.z * p.x + frame.vy.z * p.y + frame.vz.z * p.z) * scale,
    })

  const makeFace = (local: [Vec3, Vec3, Vec3, Vec3]): CollisionFace => {
    const c = local.map(toWorld) as [Vec3, Vec3, Vec3, Vec3]
    const n = normalize(cross(sub(c[1], c[0]), sub(c[3], c[0]))) ?? { x: 0, y: 1, z: 0 }
    return { corners: c, normal: n }
  }

  const faces: CollisionFace[] = []

  // Bottom: flat in the local x–z plane, wound CCW seen from above (:428-432).
  faces.push(
    makeFace([
      { x: -h, y: 0, z: -h },
      { x: h, y: 0, z: -h },
      { x: h, y: 0, z: h },
      { x: -h, y: 0, z: h },
    ]),
  )

  // A wall hinged on one bottom edge. `u` runs along the hinge, `out`
  // is the outward in-plane direction; the wall lifts toward +y by the
  // hinge angle, so its far edge sits at out·size·cos + y·size·sin.
  const wall = (out: Vec3, u: Vec3): CollisionFace => {
    const pivot = mul(out, h)
    const far = add(mul(out, size * cos), { x: 0, y: size * sin, z: 0 })
    return makeFace([
      add(pivot, mul(u, -h)),
      add(pivot, mul(u, h)),
      add(add(pivot, far), mul(u, h)),
      add(add(pivot, far), mul(u, -h)),
    ])
  }

  faces.push(wall({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 })) // front (:445-453)
  faces.push(wall({ x: 0, y: 0, z: -1 }, { x: -1, y: 0, z: 0 })) // back (:456-467)
  faces.push(wall({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 })) // right (:470-482)
  faces.push(wall({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })) // left (:485-496)

  return faces
}

// --- the step --------------------------------------------------------------

/**
 * One simulation step: state + config → the next state (:539-662).
 *
 * Deterministic and allocation-honest — the input state is never
 * mutated, so a caller can keep, replay, or fork it freely.
 */
export const step = (state: CableState, config: StepConfig): CableState => {
  const n = state.positions.length
  if (n < 2) return { positions: [...state.positions], velocities: [...state.velocities] }

  const {
    anchor,
    tip,
    dt,
    restLength,
    gravity = { x: 0, y: CABLE_GRAVITY, z: 0 },
    drag = CABLE_DRAG,
    stiffness = CABLE_STIFFNESS,
    iterations = XPBD_ITERATIONS,
    maxVelocity = CABLE_MAX_VELOCITY,
    velocitySmoothing = CABLE_VELOCITY_SMOOTHING,
    anchorDir,
    tipDir,
    dirStrength = CABLE_DIR_STRENGTH,
    faces,
  } = config

  const clampSpeed = (v: Vec3): Vec3 => {
    const speed = length(v)
    return speed > maxVelocity ? mul(v, maxVelocity / speed) : v
  }

  const predicted: Vec3[] = [...state.positions]
  predicted[0] = anchor
  predicted[n - 1] = tip

  // 2. Laplacian velocity smoothing (:565-572) — read from the ORIGINAL
  //    velocities throughout, so the pass is order-independent.
  let velocities = state.velocities
  if (velocitySmoothing > 0 && n > 2) {
    const smoothed = [...velocities]
    for (let i = 1; i < n - 1; i++) {
      const avg = mul(add(add(velocities[i - 1]!, velocities[i]!), velocities[i + 1]!), 1 / 3)
      smoothed[i] = add(velocities[i]!, mul(sub(avg, velocities[i]!), velocitySmoothing))
    }
    velocities = smoothed
  }

  // 3. Predict interior positions (:575-583).
  const dragFactor = Math.max(0, 1 - drag * dt)
  for (let i = 1; i < n - 1; i++) {
    const vel = clampSpeed(mul(add(velocities[i]!, mul(gravity, dt)), dragFactor))
    predicted[i] = add(state.positions[i]!, mul(vel, dt))
  }

  // 4. Constraint passes.
  for (let pass = 0; pass < iterations; pass++) {
    // Distance (:588-599): each pair pulled halfway, pinned ends held.
    for (let i = 0; i < n - 1; i++) {
      const delta = sub(predicted[i + 1]!, predicted[i]!)
      const dist = length(delta)
      if (dist < 0.001) continue
      const correction = mul(delta, 1 - restLength / dist)
      if (i > 0) predicted[i] = add(predicted[i]!, mul(correction, 0.5))
      if (i < n - 2) predicted[i + 1] = sub(predicted[i + 1]!, mul(correction, 0.5))
    }

    // Re-pin (:601-603).
    predicted[0] = anchor
    predicted[n - 1] = tip

    // Directional constraints (:605-628): pull the first/last few
    // particles onto the straight line leaving each end, with weight
    // falling off linearly over DIR_CONSTRAINT_REACH particles.
    const pullEnd = (dir: Vec3 | undefined, base: Vec3, indexOf: (j: number) => number): void => {
      const d = dir && length(dir) > 0.001 ? normalize(dir) : undefined
      if (!d) return
      for (let j = 1; j < Math.min(DIR_CONSTRAINT_REACH + 1, n - 1); j++) {
        const idx = indexOf(j)
        const target = add(base, mul(d, j * restLength))
        const weight = dirStrength * (1 - (j - 1) / DIR_CONSTRAINT_REACH)
        predicted[idx] = add(predicted[idx]!, mul(sub(target, predicted[idx]!), weight))
      }
    }
    pullEnd(anchorDir, anchor, (j) => j)
    pullEnd(tipDir, tip, (j) => n - 1 - j)

    // Bending (:630-634): each interior particle toward its neighbours'
    // midpoint. Sequential by design — the source reads the already
    // corrected predecessor, which is what makes the chain smooth in
    // one pass rather than merely averaged.
    for (let i = 1; i < n - 1; i++) {
      const mid = mul(add(predicted[i - 1]!, predicted[i + 1]!), 0.5)
      predicted[i] = add(predicted[i]!, mul(sub(mid, predicted[i]!), stiffness))
    }

    // Collision (:636-640).
    if (faces && faces.length > 0) {
      for (let i = 1; i < n - 1; i++) {
        for (const face of faces) {
          predicted[i] = pointFaceCollision(predicted[i]!, face).point
        }
      }
    }
  }

  // 5. Velocity as a readout of the position delta (:642-650).
  const invDt = 1 / Math.max(dt, 0.001)
  const newVelocities: Vec3[] = []
  for (let i = 0; i < n; i++) {
    newVelocities.push(clampSpeed(mul(sub(predicted[i]!, state.positions[i]!), invDt)))
  }

  return { positions: predicted, velocities: newVelocities }
}

// --- the completion-driven schedule (:1482-1515) ---------------------------

/** The three parameters the settle phase moves (:1485-1489). */
export interface SettleParams {
  stiffness: number
  drag: number
  dirStrength: number
}

/** Past SETTLE_START the cable stiffens, drags, and lets its ends go
 *  slack — the drape that holds the finished wall's shape (:1485-1489). */
export const settleParams = (completion: number): SettleParams => {
  if (completion <= SETTLE_START) {
    return { stiffness: CABLE_STIFFNESS, drag: CABLE_DRAG, dirStrength: CABLE_DIR_STRENGTH }
  }
  const t = Math.min((completion - SETTLE_START) / (1 - SETTLE_START), 1)
  return {
    stiffness: CABLE_STIFFNESS + (SETTLE_STIFFNESS - CABLE_STIFFNESS) * t,
    drag: CABLE_DRAG + (SETTLE_DRAG - CABLE_DRAG) * t,
    dirStrength: CABLE_DIR_STRENGTH * (1 - t * SETTLE_DIR_FALLOFF),
  }
}

/** The collider's scale at a given completion (:1503-1508): absent while
 *  the creature is small and far, full size once it is half-arrived. */
export const colliderScale = (completion: number): number => {
  if (completion <= COLLIDER_FADE_START) return 0
  if (completion >= COLLIDER_FADE_END) return 1
  return (completion - COLLIDER_FADE_START) / (COLLIDER_FADE_END - COLLIDER_FADE_START)
}
