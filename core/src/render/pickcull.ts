/**
 * pickcull.ts — what lets the host's pick skip ink that cannot be under the
 * cursor, without ever changing its answer.
 *
 * Each pickable buffer (a ribbon's segments, a fill's triangles, a glyph
 * mesh's vertices) gets local-space boxes: one for the whole and one per
 * CHUNK of elements. They are cached against the buffer itself — the array,
 * its version, its count — so they are rebuilt only when the geometry
 * changes, never per pick.
 *
 * At pick time a box's 8 corners go through one model-view-projection to
 * pixels. A box wholly in front of the camera projects INSIDE the hull of its
 * projected corners (a perspective map keeps convex sets convex in front of
 * the eye), so the corners' screen rectangle bounds every pixel its ink can
 * reach. Ink farther than the pick tolerance from that rectangle is farther
 * from the cursor than the tolerance — the exhaustive pick would have
 * discarded it too. A box with any corner at or behind the eye is never
 * culled. Hence: same answers, far less work.
 */

import type * as THREE from "three/webgpu"

/** Elements per chunk box: small enough to cull tightly, large enough to stay cheap. */
export const CHUNK = 64
/** Pixels of padding on every cull test — float slack between this projection and toScreen's. */
export const CULL_SLACK = 1

export interface Boxes {
  /** Elements covered (segments, triangles or vertices). */
  count: number
  /** [minX, minY, minZ, maxX, maxY, maxZ] of everything. */
  whole: Float32Array
  /** The same per chunk of CHUNK elements, chunk k at k * 6. */
  chunks: Float32Array
}

interface Cached {
  array: ArrayLike<number>
  version: number
  count: number
  index?: ArrayLike<number>
  indexVersion?: number
  boxes: Boxes
}

/** One cache per kind of box: a geometry may be asked for more than one kind. */
const segmentCache = new WeakMap<object, Cached>()
const triangleCache = new WeakMap<object, Cached>()
const vertexCache = new WeakMap<object, Cached>()

/** A position attribute's x, y, z of vertex v — straight from its array when it is a plain one (the fast path). */
const reader = (position: THREE.BufferAttribute) => {
  const plain = !(position as unknown as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute
  const a = position.array
  const n = position.itemSize
  return plain
    ? (v: number, k: number) => a[v * n + k]!
    : (v: number, k: number) => (k === 0 ? position.getX(v) : k === 1 ? position.getY(v) : position.getZ(v))
}

const empty = (n: number) => {
  const a = new Float32Array(n * 6)
  for (let k = 0; k < n; k++) a.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], k * 6)
  return a
}
const grow = (a: Float32Array, k: number, x: number, y: number, z: number) => {
  const o = k * 6
  if (x < a[o]!) a[o] = x
  if (y < a[o + 1]!) a[o + 1] = y
  if (z < a[o + 2]!) a[o + 2] = z
  if (x > a[o + 3]!) a[o + 3] = x
  if (y > a[o + 4]!) a[o + 4] = y
  if (z > a[o + 5]!) a[o + 5] = z
}
const merge = (chunks: Float32Array, n: number): Float32Array => {
  const whole = empty(1)
  for (let k = 0; k < n; k++) {
    grow(whole, 0, chunks[k * 6]!, chunks[k * 6 + 1]!, chunks[k * 6 + 2]!)
    grow(whole, 0, chunks[k * 6 + 3]!, chunks[k * 6 + 4]!, chunks[k * 6 + 5]!)
  }
  return whole
}

/**
 * Boxes over `count` segments of a packed segment buffer: 6 floats per
 * segment from `stride`·i (start xyz, end xyz) — a ribbon's instanceStart.
 * `key` is what the cache hangs on (the geometry), `version` the buffer's.
 */
export const segmentBoxes = (key: object, array: ArrayLike<number>, version: number, count: number, stride = 6): Boxes => {
  const hit = segmentCache.get(key)
  if (hit && hit.array === array && hit.version === version && hit.count === count) return hit.boxes
  const n = Math.ceil(count / CHUNK)
  const chunks = empty(n)
  for (let i = 0; i < count; i++) {
    const k = (i / CHUNK) | 0
    const o = i * stride
    grow(chunks, k, array[o]!, array[o + 1]!, array[o + 2]!)
    grow(chunks, k, array[o + 3]!, array[o + 4]!, array[o + 5]!)
  }
  const boxes = { count, whole: merge(chunks, n), chunks }
  segmentCache.set(key, { array, version, count, boxes })
  return boxes
}

/** Boxes over an indexed triangle list (CHUNK triangles per chunk). */
export const triangleBoxes = (
  key: object,
  position: THREE.BufferAttribute,
  index: THREE.BufferAttribute,
): Boxes => {
  const array = position.array
  const indices = index.array
  const count = Math.floor(index.count / 3)
  const hit = triangleCache.get(key)
  if (
    hit &&
    hit.array === array &&
    hit.version === position.version &&
    hit.count === count &&
    hit.index === indices &&
    hit.indexVersion === index.version
  )
    return hit.boxes
  const n = Math.ceil(count / CHUNK)
  const chunks = empty(n)
  const at = reader(position)
  for (let t = 0; t < count; t++) {
    const k = (t / CHUNK) | 0
    for (let c = 0; c < 3; c++) {
      const v = indices[t * 3 + c]!
      grow(chunks, k, at(v, 0), at(v, 1), at(v, 2))
    }
  }
  const boxes = { count, whole: merge(chunks, n), chunks }
  triangleCache.set(key, { array, version: position.version, count, index: indices, indexVersion: index.version, boxes })
  return boxes
}

/** One box over all of a position attribute's vertices (glyph quads). */
export const vertexBox = (key: object, position: THREE.BufferAttribute): Boxes => {
  const array = position.array
  const count = position.count
  const hit = vertexCache.get(key)
  if (hit && hit.array === array && hit.version === position.version && hit.count === count) return hit.boxes
  const whole = empty(1)
  const at = reader(position)
  for (let v = 0; v < count; v++) grow(whole, 0, at(v, 0), at(v, 1), at(v, 2))
  const boxes = { count, whole, chunks: whole }
  vertexCache.set(key, { array, version: position.version, count, boxes })
  return boxes
}

/**
 * Could the box (6 floats at `o` of `box`, local space) put ink within `tol`
 * pixels of (px, py)? `mvp` is projection · view · model (column-major
 * elements). False only when provably not: every corner in front of the eye
 * and the cursor outside the corners' screen rectangle by more than tol.
 */
export const mayReach = (
  box: Float32Array,
  o: number,
  mvp: ArrayLike<number>,
  width: number,
  height: number,
  px: number,
  py: number,
  tol: number,
): boolean => {
  const x0 = box[o]!
  if (!(x0 <= box[o + 3]!)) return false // an empty box: no elements
  const m = mvp
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let c = 0; c < 8; c++) {
    const x = c & 1 ? box[o + 3]! : x0
    const y = c & 2 ? box[o + 4]! : box[o + 1]!
    const z = c & 4 ? box[o + 5]! : box[o + 2]!
    const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!
    if (!(w > 1e-9)) return true // at or behind the eye: no honest bound
    const sx = (((m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) / w + 1) / 2) * width
    const sy = ((1 - (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) / w) / 2) * height
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return true
    if (sx < minX) minX = sx
    if (sx > maxX) maxX = sx
    if (sy < minY) minY = sy
    if (sy > maxY) maxY = sy
  }
  const pad = tol + CULL_SLACK
  return px >= minX - pad && px <= maxX + pad && py >= minY - pad && py <= maxY + pad
}
