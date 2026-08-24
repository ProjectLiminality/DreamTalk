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

/**
 * Subdivide a polyline so that no segment spans enough of the frame for
 * the ribbon's per-segment linear arc-length→pixel identity to lie.
 *
 * WHY THIS IS NOT A COSMETIC RESAMPLE. Both the shader
 * (`pxPerUnit = lenPx / (distEnd - distStart)`) and every screen-space
 * measurement (render/screen-arc.ts) treat arc length as LINEAR in
 * screen position within a segment. Under perspective it is not: a
 * straight world line projects to a straight screen line, but its
 * arc-length parametrisation along that line is projective. On a
 * two-point Line receding to a vanishing point the two disagree by the
 * whole depth range — S08's axis arms (world x = -500 → 2100, the far
 * end at the vanishing point) had the pen correctly placed at world
 * x ≈ +8 and the ink painted at 19.5% of the screen chord.
 *
 * Splitting into `target` pieces makes each piece's foreshortening
 * locally uniform, so the linear identity becomes locally true and the
 * error falls as 1/target^2. Uniform in WORLD arc length, because that
 * is the parameter both consumers index by. Polylines that already
 * carry at least `target` segments (circles, silhouettes, traced text)
 * are returned unchanged — they are fine enough already, and the cost
 * of the split is linear in the result.
 */
export const resamplePolyline = <T extends Point3>(
  pts: readonly T[],
  target: number,
  make: (x: number, y: number, z: number) => T,
): T[] => {
  if (pts.length < 2) return pts.map((p) => make(p.x, p.y, p.z))
  const perSegment = Math.max(1, Math.ceil(target / (pts.length - 1)))
  if (perSegment <= 1) return pts.map((p) => make(p.x, p.y, p.z))
  const first = pts[0]!
  const out: T[] = [make(first.x, first.y, first.z)]
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    for (let k = 1; k <= perSegment; k++) {
      const u = k / perSegment
      out.push(make(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u))
    }
  }
  return out
}
