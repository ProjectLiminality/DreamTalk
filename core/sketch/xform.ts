/**
 * xform.ts — the one transform a whiteboard selection undergoes.
 *
 * Every manipulation of a selection — a move, a corner-handle scale, the
 * rotate knob, a two-finger pinch/twist/pan — is the same thing: a
 * SIMILARITY of the page (uniform scale + rotation + translation). It is
 * stated as
 *
 *     p' = pivot + translate + scale · R(rotate) · (p − pivot)
 *
 * in PAGE units (protocol.ts: y down), with `rotate` a PAGE angle —
 * radians, clockwise-positive on the page, the convention vocabulary.ts
 * documents — so R is the ordinary [cos −sin; sin cos] read in y-down
 * coordinates, and CSS's `rotate()` (also clockwise on screen) previews it
 * without a sign flip.
 *
 * Gestures that change pivot mid-flight (a pinch whose fingers lift and
 * land again) compose in matrix form (`Sim`) and are read back as an Xf
 * about whatever pivot is convenient — the two forms describe the same
 * map, so no gesture ever has to know how another one was stated.
 */

export interface Pt {
  x: number
  y: number
}

export interface Xf {
  translate: Pt
  /** Page angle, radians, clockwise-positive on the page. */
  rotate: number
  scale: number
  pivot: Pt
  /** A 3D turn of each oriented symbol about its own centre (see Mat3). */
  tumble?: Mat3
}

export const IDENTITY: Xf = { translate: { x: 0, y: 0 }, rotate: 0, scale: 1, pivot: { x: 0, y: 0 } }

/** Fill a partial transform with identity defaults. */
export const xfOf = (t: Partial<Xf>): Xf => ({
  translate: t.translate ?? { x: 0, y: 0 },
  rotate: t.rotate ?? 0,
  scale: t.scale ?? 1,
  pivot: t.pivot ?? { x: 0, y: 0 },
  ...(t.tumble ? { tumble: t.tumble } : {}),
})

export const xfPoint = (xf: Xf, p: Pt): Pt => {
  // A pure move adds exactly — no round trip through the pivot.
  if (xf.rotate === 0 && xf.scale === 1) return { x: p.x + xf.translate.x, y: p.y + xf.translate.y }
  const c = Math.cos(xf.rotate) * xf.scale
  const s = Math.sin(xf.rotate) * xf.scale
  const dx = p.x - xf.pivot.x
  const dy = p.y - xf.pivot.y
  return {
    x: xf.pivot.x + xf.translate.x + c * dx - s * dy,
    y: xf.pivot.y + xf.translate.y + s * dx + c * dy,
  }
}

export const isIdentity = (xf: Xf, eps = 1e-3): boolean =>
  Math.abs(xf.translate.x) < eps * 100 &&
  Math.abs(xf.translate.y) < eps * 100 &&
  Math.abs(xf.rotate) < eps &&
  Math.abs(xf.scale - 1) < eps &&
  (!xf.tumble || isMat3Identity(xf.tumble, eps))

/** Wrap an angle into (−π, π]. */
export const wrapAngle = (a: number): number => {
  const w = a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI))
  return w === -Math.PI ? Math.PI : w
}

// --- Matrix form ------------------------------------------------------------

/** p' = (a·x − b·y + tx, b·x + a·y + ty). */
export interface Sim {
  a: number
  b: number
  tx: number
  ty: number
}

export const SIM_IDENTITY: Sim = { a: 1, b: 0, tx: 0, ty: 0 }

export const simApply = (m: Sim, p: Pt): Pt => ({ x: m.a * p.x - m.b * p.y + m.tx, y: m.b * p.x + m.a * p.y + m.ty })

export const simOf = (xf: Xf): Sim => {
  const a = Math.cos(xf.rotate) * xf.scale
  const b = Math.sin(xf.rotate) * xf.scale
  const o = { x: xf.pivot.x + xf.translate.x, y: xf.pivot.y + xf.translate.y }
  return { a, b, tx: o.x - (a * xf.pivot.x - b * xf.pivot.y), ty: o.y - (b * xf.pivot.x + a * xf.pivot.y) }
}

/** The same map, stated about `pivot`. */
export const xfFromSim = (m: Sim, pivot: Pt): Xf => {
  const to = simApply(m, pivot)
  return {
    translate: { x: to.x - pivot.x, y: to.y - pivot.y },
    rotate: Math.atan2(m.b, m.a),
    scale: Math.hypot(m.a, m.b),
    pivot,
  }
}

/** second ∘ first — apply `first`, then `second`. */
export const composeSim = (second: Sim, first: Sim): Sim => ({
  a: second.a * first.a - second.b * first.b,
  b: second.b * first.a + second.a * first.b,
  tx: second.a * first.tx - second.b * first.ty + second.tx,
  ty: second.b * first.tx + second.a * first.ty + second.ty,
})

/**
 * The similarity that carries the segment (a0, b0) onto (a, b) — two
 * fingers' start and current positions: pan, pinch and twist in one.
 */
export const simFromPairs = (a0: Pt, b0: Pt, a: Pt, b: Pt): Sim => {
  const v0 = { x: b0.x - a0.x, y: b0.y - a0.y }
  const v = { x: b.x - a.x, y: b.y - a.y }
  const len0 = Math.hypot(v0.x, v0.y)
  if (len0 < 1e-6) return { a: 1, b: 0, tx: a.x - a0.x, ty: a.y - a0.y }
  const k = Math.hypot(v.x, v.y) / len0
  const r = Math.atan2(v.y, v.x) - Math.atan2(v0.y, v0.x)
  return simOf({ pivot: a0, translate: { x: a.x - a0.x, y: a.y - a0.y }, rotate: r, scale: k })
}

// --- Tumble: the selection turned in 3D ---------------------------------------

/**
 * A 3D rotation, row-major 3×3, in SCENE axes — x right, y UP, z toward
 * the viewer (vocabulary.ts: scene x = page x, scene y = −page y). The
 * page is flat, so a tumble moves nothing on it; it turns the ORIENTATION
 * of each symbol that has one (a cube's h/p/b, a MindVirus's heading and
 * tilt) about that symbol's own centre. 2D symbols and ink ignore it.
 */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number]

export const MAT3_IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

export const mat3Mul = (a: Mat3, b: Mat3): Mat3 => {
  const o: number[] = []
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) o.push(a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!)
  return o as unknown as Mat3
}

export const mat3Apply = (m: Mat3, v: { x: number; y: number; z: number }) => ({
  x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
  y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
  z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
})

export const isMat3Identity = (m: Mat3, eps = 1e-6): boolean => m.every((v, i) => Math.abs(v - MAT3_IDENTITY[i]!) < eps)

export const rotX = (a: number): Mat3 => {
  const c = Math.cos(a), s = Math.sin(a)
  return [1, 0, 0, 0, c, -s, 0, s, c]
}
export const rotY = (a: number): Mat3 => {
  const c = Math.cos(a), s = Math.sin(a)
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}
export const rotZ = (a: number): Mat3 => {
  const c = Math.cos(a), s = Math.sin(a)
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

/**
 * A holon's h/p/b as a matrix. The renderer composes them as
 * Rz(b) · Rx(p) · Ry(h) (three-host.ts sync(): three's 'ZXY' order — C4D's
 * HPB under the axis dictionary), and so does this.
 */
export const eulerToMat3 = (h: number, p: number, b: number): Mat3 => mat3Mul(rotZ(b), mat3Mul(rotX(p), rotY(h)))

/** The inverse of eulerToMat3, p ∈ [−π/2, π/2]; at gimbal lock h is 0. */
export const mat3ToEuler = (m: Mat3): { h: number; p: number; b: number } => {
  const p = Math.asin(Math.max(-1, Math.min(1, m[7])))
  if (Math.abs(m[7]) < 0.9999999) return { h: Math.atan2(-m[6], m[8]), p, b: Math.atan2(-m[1], m[4]) }
  return { h: 0, p, b: Math.atan2(m[3], m[0]) }
}

/**
 * The trackball: a drag of (dx, dy) PAGE units turns the object about the
 * view's axes — drag right spins it about the vertical (yaw: its front
 * swings right), drag up about the horizontal (pitch: its front swings
 * up). Applied incrementally per pointer move, the way Blender's trackball
 * is, so circling the pointer rolls it — the feel of turning a real thing.
 */
export const trackball = (dx: number, dy: number, radPerUnit: number): Mat3 =>
  mat3Mul(rotX(dy * radPerUnit), rotY(dx * radPerUnit))
