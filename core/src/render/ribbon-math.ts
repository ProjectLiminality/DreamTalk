/**
 * Pure polyline → instanced-segment packing for the ribbon stroke
 * pipeline (render/ribbon.ts). No three.js imports — unit-testable.
 *
 * A polyline of N points becomes N−1 segment instances. Each instance
 * carries its start/end positions (interleaved, 6 floats) and its
 * cumulative arc-length window (2 floats) — the same buffer layout as
 * three's LineSegmentsGeometry, which the ribbon shader reads as
 * instanceStart/instanceEnd and instanceDistanceStart/End.
 */

export interface Point3 {
  x: number
  y: number
  z: number
}

export interface PackedSegments {
  /** Per segment: start xyz, end xyz. */
  positions: Float32Array
  /** Per segment: cumulative arc length at start and at end. */
  distances: Float32Array
  /** Segment (instance) count: points − 1. */
  count: number
  /** Total polyline arc length in local units. */
  totalLength: number
}

export const packSegments = (pts: readonly Point3[]): PackedSegments => {
  const count = Math.max(0, pts.length - 1)
  const positions = new Float32Array(count * 6)
  const distances = new Float32Array(count * 2)
  let acc = 0
  for (let i = 0; i < count; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    positions[i * 6] = a.x
    positions[i * 6 + 1] = a.y
    positions[i * 6 + 2] = a.z
    positions[i * 6 + 3] = b.x
    positions[i * 6 + 4] = b.y
    positions[i * 6 + 5] = b.z
    distances[i * 2] = acc
    acc += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    distances[i * 2 + 1] = acc
  }
  return { positions, distances, count, totalLength: acc }
}
