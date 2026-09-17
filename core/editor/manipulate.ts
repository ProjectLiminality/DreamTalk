/**
 * Direct manipulation — the MATH of the move gesture (EDITOR-V5.md,
 * "Direct manipulation — the settled architecture", decision 2).
 *
 * Dragging the selection moves it on the VIEW PLANE: the plane through
 * the object's origin perpendicular to the view axis — C4D's default
 * move. The pointer's NDC position becomes a ray through the camera
 * (perspective: from the eye through the frustum; orthographic: parallel
 * rays offset across the frustum), the ray meets the plane, and the
 * difference between where the grab landed and where the pointer is now
 * is the world-space delta. That delta is then carried into the frame
 * the holon's x/y actually live in — its PARENT's — because parts sit
 * inside transformed groups, and "move 100 right on screen" must become
 * whatever local numbers put it there.
 *
 * Everything here is pure arithmetic over plain vectors: no three.js, no
 * DOM, no GPU — which is what lets test/manipulate.test.ts pin the
 * plane intersection, the parent-frame conversion and the axis
 * constraint as bare functions. main.ts owns the gesture's wiring (what
 * arms it, what it writes overrides on, what commits); this module owns
 * only the geometry.
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Ndc {
  x: number
  y: number
}

export interface Ray {
  origin: Vec3
  dir: Vec3
}

/**
 * The camera, reduced to exactly what a drag needs: its world-space
 * basis and its projection's shape. Extracted per pointer event by
 * `cameraFrameOf` — the wheel can dolly mid-move, so the frame is never
 * cached across events (the drag PLANE is, which is what keeps the
 * gesture stable while the camera breathes).
 */
export interface CameraFrame {
  position: Vec3
  right: Vec3
  up: Vec3
  /** The view direction — the normal of every drag plane. */
  forward: Vec3
  orthographic: boolean
  /** Perspective: vertical field of view in radians, and the frustum aspect. */
  fovY: number
  aspect: number
  /** Orthographic: the frustum's half extents in world units. */
  halfWidth: number
  halfHeight: number
}

/** The structural face of THREE's two cameras — no three.js import needed. */
export interface CameraLike {
  matrixWorld: { elements: ArrayLike<number> }
  isOrthographicCamera?: boolean
  /** Perspective, degrees (three's convention). */
  fov?: number
  aspect?: number
  /** Orthographic frustum edges. */
  left?: number
  right?: number
  top?: number
  bottom?: number
}

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z)
const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z)
const scale = (a: Vec3, k: number): Vec3 => v3(a.x * k, a.y * k, a.z * k)
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
const normalize = (a: Vec3): Vec3 => {
  const len = Math.hypot(a.x, a.y, a.z)
  return len > 1e-12 ? scale(a, 1 / len) : v3(0, 0, 0)
}

/**
 * Read a camera's world basis and projection shape. Columns of the world
 * matrix are the camera's right/up/back axes (normalized here so a
 * scaled ancestor could never warp the ray), position its translation;
 * forward is MINUS the z column — three's cameras look down their own -z,
 * tilt and all, so a rolled camera's plane math is already correct.
 */
export const cameraFrameOf = (camera: CameraLike): CameraFrame => {
  const e = camera.matrixWorld.elements
  return {
    position: v3(e[12]!, e[13]!, e[14]!),
    right: normalize(v3(e[0]!, e[1]!, e[2]!)),
    up: normalize(v3(e[4]!, e[5]!, e[6]!)),
    forward: normalize(v3(-e[8]!, -e[9]!, -e[10]!)),
    orthographic: camera.isOrthographicCamera === true,
    fovY: ((camera.fov ?? 50) * Math.PI) / 180,
    aspect: camera.aspect ?? 16 / 9,
    halfWidth: ((camera.right ?? 1) - (camera.left ?? -1)) / 2,
    halfHeight: ((camera.top ?? 1) - (camera.bottom ?? -1)) / 2,
  }
}

/**
 * The world-space ray under an NDC point. Perspective: origin at the
 * eye, direction fanned across the frustum by tan(fov/2). Orthographic:
 * parallel to the view axis, origin offset across the frustum's extent —
 * which is why ortho drags are exactly linear in the pointer.
 */
export const pointerRay = (frame: CameraFrame, ndc: Ndc): Ray => {
  if (frame.orthographic) {
    const origin = add(
      frame.position,
      add(scale(frame.right, ndc.x * frame.halfWidth), scale(frame.up, ndc.y * frame.halfHeight)),
    )
    return { origin, dir: frame.forward }
  }
  const tanHalf = Math.tan(frame.fovY / 2)
  const dir = normalize(
    add(
      frame.forward,
      add(scale(frame.right, ndc.x * tanHalf * frame.aspect), scale(frame.up, ndc.y * tanHalf)),
    ),
  )
  return { origin: frame.position, dir }
}

/**
 * Where a ray meets the plane through `point` with `normal`, or
 * undefined for a parallel ray or a hit behind the origin (a plane
 * behind the camera is not something a drag can address).
 */
export const intersectPlane = (ray: Ray, point: Vec3, normal: Vec3): Vec3 | undefined => {
  const denom = dot(ray.dir, normal)
  if (Math.abs(denom) < 1e-9) return undefined
  const s = dot(sub(point, ray.origin), normal) / denom
  if (s < 0) return undefined
  return add(ray.origin, scale(ray.dir, s))
}

/**
 * The inverse of a world matrix's upper 3x3 (col-major 16 elements, as
 * THREE.Matrix4.elements), returned row-major — what carries a WORLD
 * direction into the matrix's LOCAL frame. Undefined for a degenerate
 * (zero-scaled) frame, where no local answer exists.
 */
export const invertUpper3x3 = (elements: ArrayLike<number>): number[] | undefined => {
  // Col-major: column j lives at elements[4j .. 4j+2].
  const a = elements[0]!, b = elements[4]!, c = elements[8]!
  const d = elements[1]!, e = elements[5]!, f = elements[9]!
  const g = elements[2]!, h = elements[6]!, i = elements[10]!
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  if (Math.abs(det) < 1e-12) return undefined
  const k = 1 / det
  return [
    (e * i - f * h) * k, (c * h - b * i) * k, (b * f - c * e) * k,
    (f * g - d * i) * k, (a * i - c * g) * k, (c * d - a * f) * k,
    (d * h - e * g) * k, (b * g - a * h) * k, (a * e - b * d) * k,
  ]
}

/** Apply a row-major 3x3 to a vector (a direction — no translation). */
export const applyMat3 = (m: readonly number[], v: Vec3): Vec3 =>
  v3(
    m[0]! * v.x + m[1]! * v.y + m[2]! * v.z,
    m[3]! * v.x + m[4]! * v.y + m[5]! * v.z,
    m[6]! * v.x + m[7]! * v.y + m[8]! * v.z,
  )

/**
 * Shift's constraint (decision 4): the move collapses onto whichever
 * local axis carries more of it. Ties go to x — some axis must win, and
 * the horizontal is the Keynote-flavoured guess.
 */
export const constrainDominant = (dx: number, dy: number): [number, number] =>
  Math.abs(dx) >= Math.abs(dy) ? [dx, 0] : [0, dy]

/**
 * Whether a drag may move this holon at all (decision 1): bound x/y are
 * derived readings, and the gesture refuses rather than silently moving
 * an ancestor or fighting the binding.
 */
export const movable = (holon: { x: { isBound: boolean }; y: { isBound: boolean } }): boolean =>
  !holon.x.isBound && !holon.y.isBound

/**
 * One move, from grab to release. Created the moment the drag ENGAGES
 * (past the click threshold, playback just paused) and asked for target
 * x/y on every pointer event after.
 *
 * What is frozen at the grab: the drag plane (through the holon's world
 * origin, facing the view axis), the world→parent conversion, the base
 * x/y, and where on the plane the grab ray landed. What is fresh per
 * event: the camera frame and the pointer ray — so a mid-move dolly
 * bends the mapping without ever moving the plane.
 */
export class MoveGesture {
  readonly baseX: number
  readonly baseY: number
  readonly #planePoint: Vec3
  readonly #normal: Vec3
  readonly #from: Vec3
  readonly #toParent: readonly number[]

  private constructor(
    planePoint: Vec3,
    normal: Vec3,
    from: Vec3,
    toParent: readonly number[],
    baseX: number,
    baseY: number,
  ) {
    this.#planePoint = planePoint
    this.#normal = normal
    this.#from = from
    this.#toParent = toParent
    this.baseX = baseX
    this.baseY = baseY
  }

  /**
   * Arm a move, or refuse (undefined) when the geometry cannot answer:
   * a grab ray that misses the plane, or a degenerate parent frame.
   */
  static create(
    frame: CameraFrame,
    grab: Ndc,
    origin: Vec3,
    parentWorld: ArrayLike<number>,
    baseX: number,
    baseY: number,
  ): MoveGesture | undefined {
    const normal = frame.forward
    const from = intersectPlane(pointerRay(frame, grab), origin, normal)
    if (!from) return undefined
    const toParent = invertUpper3x3(parentWorld)
    if (!toParent) return undefined
    return new MoveGesture(origin, normal, from, toParent, baseX, baseY)
  }

  /**
   * The x/y the holon should hold with the pointer at `ndc` — base plus
   * the plane delta expressed in the parent frame (its z component is
   * dropped: a view-plane drag steers the two params it can honestly
   * steer). Undefined while the pointer is somewhere the plane is not.
   */
  target(frame: CameraFrame, ndc: Ndc, constrain: boolean): { x: number; y: number } | undefined {
    const hit = intersectPlane(pointerRay(frame, ndc), this.#planePoint, this.#normal)
    if (!hit) return undefined
    const local = applyMat3(this.#toParent, sub(hit, this.#from))
    let [dx, dy] = [local.x, local.y]
    if (constrain) [dx, dy] = constrainDominant(dx, dy)
    return { x: this.baseX + dx, y: this.baseY + dy }
  }
}

/**
 * The world-space direction of a local axis (x/y/z) under a parent's world
 * matrix, carrying the parent's scale in its LENGTH. Column j of the
 * col-major upper 3x3 is exactly the image of local basis vector j — so
 * this is a plain column read, no matrix multiply needed.
 */
export const worldAxisOf = (parentWorld: ArrayLike<number>, axis: 0 | 1 | 2): Vec3 => {
  const c = axis * 4
  return v3(parentWorld[c]!, parentWorld[c + 1]!, parentWorld[c + 2]!)
}

/**
 * A single-axis drag — the transform gizmo's handle (EDITOR-VOICE-COMMENTS
 * step 2). Where MoveGesture moves on the view plane in two params, this
 * constrains motion to ONE world axis and returns the signed distance the
 * pointer has swept ALONG it, in that axis's own parameter units.
 *
 * The plane the drag lives on is the one that CONTAINS the axis and faces
 * the camera as squarely as possible: its normal is the component of the
 * view direction perpendicular to the axis (forward − (forward·â)â). That
 * keeps a nearly edge-on axis from becoming un-draggable — the classic
 * gizmo choice. Pointer travel on that plane is projected back onto the
 * axis, so only motion along the handle counts.
 *
 * Units: the world axis carries the parent's scale in its length, so a
 * world sweep of `d` along the normalized axis is `d / |worldAxis|`
 * parameter units — "move 100 world-right" becomes whatever local number
 * the parent's frame needs. Angles (h/p/b) and scale reuse the same
 * machinery: the caller passes the world axis to sweep along and a
 * `perUnit` that converts a world distance into the param's units.
 */
export class AxisGesture {
  readonly base: number
  readonly #planePoint: Vec3
  readonly #normal: Vec3
  readonly #axisDir: Vec3
  readonly #from: Vec3
  readonly #perUnit: number

  private constructor(
    planePoint: Vec3,
    normal: Vec3,
    axisDir: Vec3,
    from: Vec3,
    perUnit: number,
    base: number,
  ) {
    this.#planePoint = planePoint
    this.#normal = normal
    this.#axisDir = axisDir
    this.#from = from
    this.#perUnit = perUnit
    this.base = base
  }

  /**
   * Arm an axis drag, or refuse (undefined) when the geometry cannot
   * answer: a degenerate axis, a grab ray that misses the drag plane, or
   * an axis pointing straight at the camera (no in-plane sweep possible).
   *
   * `worldAxis` is the axis to move along in WORLD space, its length the
   * scale that maps world distance to parameter units. `perUnit` scales
   * that further for non-translate handles (radians per world unit for a
   * rotate ring, etc.); translate passes 1.
   */
  static create(
    frame: CameraFrame,
    grab: Ndc,
    origin: Vec3,
    worldAxis: Vec3,
    base: number,
    perUnit = 1,
  ): AxisGesture | undefined {
    const axisLen = Math.hypot(worldAxis.x, worldAxis.y, worldAxis.z)
    if (axisLen < 1e-9) return undefined
    const axisDir = scale(worldAxis, 1 / axisLen)
    // Plane normal: the view direction with its along-axis part removed, so
    // the plane contains the axis. If the axis faces the camera dead-on the
    // remainder is ~0 and there is no honest in-plane drag.
    const along = dot(frame.forward, axisDir)
    const normal = normalize(sub(frame.forward, scale(axisDir, along)))
    if (Math.hypot(normal.x, normal.y, normal.z) < 1e-6) return undefined
    const from = intersectPlane(pointerRay(frame, grab), origin, normal)
    if (!from) return undefined
    // perUnit combines the world→param scale (1/axisLen) with the caller's
    // per-world-unit factor: translate → 1/axisLen; rotate/scale → their own.
    return new AxisGesture(origin, normal, axisDir, from, perUnit / axisLen, base)
  }

  /**
   * The param value the handle should hold with the pointer at `ndc`:
   * base plus the pointer's swept distance ALONG the axis, in param units.
   * Undefined while the pointer is off the plane.
   */
  value(frame: CameraFrame, ndc: Ndc): number | undefined {
    const hit = intersectPlane(pointerRay(frame, ndc), this.#planePoint, this.#normal)
    if (!hit) return undefined
    const sweep = dot(sub(hit, this.#from), this.#axisDir) // world distance along axis
    return this.base + sweep * this.#perUnit
  }
}
