/**
 * Holding the scene in one hand — direct manipulation, 1:1 and rigid.
 *
 * David (2026-10-15): "The moment I grab with the left hand, the entire
 * space should move and rotate relative to my hand from that point in space
 * where I grabbed it." So the world is attached to the hand at the grab:
 * where the palm closed is the PIVOT, and from then on every world point
 * follows the hand's motion since — its rotation exactly, on all three
 * axes (twist, tilt, roll), about the pivot, and its travel, so the
 * grabbed point stays under the hand.
 *
 * The hand's axes are the camera's (+x right, +y up, +z toward the user —
 * hands/screen.ts `palm`), so a hand rotation R in its own frame IS the
 * rotation R of what the eye sees. The world itself is never touched: the
 * VIEW moves by the inverse (src/view.ts `place`), so exports stay clean.
 *
 *   scene motion  M(x) = P_now + ΔR_w (x − P_0),   ΔR_w = C₀ ΔR_cam C₀ᵀ
 *   camera        eye′ = P_0 + ΔR_wᵀ (eye₀ − P_now),   axes′ = ΔR_wᵀ axes₀
 *
 * with C₀ the camera's axes at the grab and ΔR_cam = H_now · H_0ᵀ the hand's
 * rotation since. Pure, so a replay holds the same.
 */

import { OneEuro, type OneEuroOpts } from "./oneeuro"
import type { Pose } from "../view"

export type V = { x: number; y: number; z: number }
/** A rotation as its three columns (the rotated x, y, z axes). */
export type Basis = readonly [V, V, V]

const v = (x: number, y: number, z: number): V => ({ x, y, z })
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: V, b: V): V => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
const scale = (a: V, k: number): V => v(a.x * k, a.y * k, a.z * k)
const sub = (a: V, b: V): V => v(a.x - b.x, a.y - b.y, a.z - b.z)
const add = (a: V, b: V): V => v(a.x + b.x, a.y + b.y, a.z + b.z)
const unit = (a: V): V => scale(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1))
const of = (a: readonly number[]): V => v(a[0]!, a[1]!, a[2]!)

/** Apply a basis (as a matrix) to a vector. */
export const apply = (B: Basis, a: V): V => add(add(scale(B[0], a.x), scale(B[1], a.y)), scale(B[2], a.z))
/** Its transpose (the inverse rotation) applied to a vector. */
export const applyT = (B: Basis, a: V): V => v(dot(B[0], a), dot(B[1], a), dot(B[2], a))
/** A · B. */
export const compose = (A: Basis, B: Basis): Basis => [apply(A, B[0]), apply(A, B[1]), apply(A, B[2])]
/** Aᵀ. */
export const transpose = (A: Basis): Basis => [
  v(A[0].x, A[1].x, A[2].x),
  v(A[0].y, A[1].y, A[2].y),
  v(A[0].z, A[1].z, A[2].z),
]

/**
 * The hand's frame from its palm: z along the fingers, y out of the back of
 * the hand (−normal), x completing a right-handed frame. Any fixed choice
 * serves: only rotations SINCE the grab are used.
 */
export const handBasis = (normal: readonly number[], direction: readonly number[]): Basis => {
  const z = unit(of(direction))
  const n = of(normal)
  const y = unit(sub(scale(z, dot(z, n)), n)) // −normal, made orthogonal to z
  return [cross(y, z), y, z]
}

/** The camera pose that holds the world on the hand (see the header). */
export const holdPose = (cam: Pose, pivot: V, pivotNow: V, handAtGrab: Basis, handNow: Basis): Pose => {
  const C: Basis = [cam.right, cam.up, cam.back]
  const dCam = compose(handNow, transpose(handAtGrab))
  const W = compose(compose(C, dCam), transpose(C)) // ΔR_w
  return {
    eye: add(pivot, applyT(W, sub(cam.eye, pivotNow))),
    right: applyT(W, cam.right),
    up: applyT(W, cam.up),
    back: applyT(W, cam.back),
  }
}

// --- smoothing: light, on the frame clock -------------------------------------

type Q = [number, number, number, number]

const quatOf = (B: Basis): Q => {
  const [X, Y, Z] = B
  const m00 = X.x, m11 = Y.y, m22 = Z.z
  const tr = m00 + m11 + m22
  let q: Q
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    q = [(Y.z - Z.y) / s, (Z.x - X.z) / s, (X.y - Y.x) / s, 0.25 * s]
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    q = [0.25 * s, (Y.x + X.y) / s, (Z.x + X.z) / s, (Y.z - Z.y) / s]
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    q = [(Y.x + X.y) / s, 0.25 * s, (Z.y + Y.z) / s, (Z.x - X.z) / s]
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2
    q = [(Z.x + X.z) / s, (Z.y + Y.z) / s, 0.25 * s, (X.y - Y.x) / s]
  }
  return q
}

const basisOf = ([x, y, z, w]: Q): Basis => [
  v(1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)),
  v(2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)),
  v(2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)),
]

const slerp = (a: Q, b: Q, k: number): Q => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  const s = d < 0 ? -1 : 1
  d *= s
  if (d > 0.9995) {
    const q = a.map((ai, i) => ai + (s * b[i]! - ai) * k) as Q
    const n = Math.hypot(...q)
    return q.map((x) => x / n) as Q
  }
  const th = Math.acos(d)
  const wa = Math.sin((1 - k) * th) / Math.sin(th)
  const wb = (s * Math.sin(k * th)) / Math.sin(th)
  return a.map((ai, i) => wa * ai + wb * b[i]!) as Q
}

/**
 * A light One-Euro on the hand's pose: position per axis, rotation by an
 * adaptive slerp (its cutoff rises with the angular speed, so a still hand
 * is calm and a turning one has no felt lag).
 */
export class PoseFilter {
  readonly #p: [OneEuro, OneEuro, OneEuro]
  readonly #minCutoff: number
  readonly #beta: number
  #q: Q | undefined
  #t = 0

  constructor(position: OneEuroOpts = { minCutoff: 2, beta: 10 }, rotation = { minCutoff: 3, beta: 0.6 }) {
    this.#p = [new OneEuro(position), new OneEuro(position), new OneEuro(position)]
    this.#minCutoff = rotation.minCutoff
    this.#beta = rotation.beta
  }

  reset(): void {
    for (const f of this.#p) f.reset()
    this.#q = undefined
  }

  update(t: number, at: V, B: Basis): { at: V; basis: Basis } {
    const p = v(this.#p[0].filter(at.x, t), this.#p[1].filter(at.y, t), this.#p[2].filter(at.z, t))
    const q = quatOf(B)
    if (!this.#q) {
      this.#q = q
      this.#t = t
      return { at: p, basis: B }
    }
    const dt = Math.max(1e-4, t - this.#t)
    this.#t = t
    const d = Math.min(1, Math.abs(q[0] * this.#q[0] + q[1] * this.#q[1] + q[2] * this.#q[2] + q[3] * this.#q[3]))
    const speed = (2 * Math.acos(d)) / dt // rad/s
    const cutoff = this.#minCutoff + this.#beta * speed
    const k = 1 / (1 + 1 / (2 * Math.PI * cutoff * dt))
    this.#q = slerp(this.#q, q, k)
    return { at: p, basis: basisOf(this.#q) }
  }
}
