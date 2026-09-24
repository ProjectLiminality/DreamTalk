/**
 * flower.ts — a flower-of-life circle packing masked to a shape, and the
 * deterministic scatter that lets it look self-organising. Pure math.
 *
 * The mechanism behind the "Web3" set-piece in the Liminal Consulting Web3
 * video (docs/reports/web3-recon.md §C), which David described exactly and
 * warned NOT to reinvent as a physics simulation:
 *
 *   "don't try to get random particles through attractors to self-organize …
 *    that's where you're fighting entropy, basically, and it's much harder …
 *    [instead] the circles are spawned as a grid — a flower-of-life packing —
 *    masked to the shape of the text, then displaced by a random noise
 *    pattern, and animating the noise amount to zero makes them appear to
 *    self-organise."
 *
 * So the FINAL, organised state is computed FIRST — the packing over the
 * shape — and the scatter is that same set of points pushed off their final
 * spots by a noise field. There are no attractors and no forces: a circle's
 * position at settle s is simply
 *
 *     scatter(s) = final + noise · (1 − s)
 *
 * Animate s from 0 to 1 and every circle slides home along a straight line.
 * The whole thing is a pure function of s, so it scrubs backwards perfectly
 * and renders identically every run — which is why the noise below is a
 * SEEDED HASH, not Math.random(): the scatter must be the same on every
 * frame of every render.
 *
 * WHY HEX PACKING, NOT A SQUARE GRID
 *
 * Flower-of-life packing is hexagonal: each row is offset half a step and
 * pulled closer vertically (√3/2 · spacing), so every circle has six equal
 * neighbours and the plane fills with no preferred axis. Against the letter
 * shapes this reads as the dense, isotropic ringlet field the reference
 * shows, where a square grid would show obvious rows and columns.
 *
 * THE MASK IS SUPPLIED, NOT MEASURED
 *
 * A point belongs to the packing when it is inside the shape. The shape is
 * given as a list of closed polygons (an SVG's flattened subpaths — exactly
 * what `importSvg` returns) and membership is SVG's even-odd rule, so a
 * letter's counter (the hole in an 'e', 'b', or '3') falls out for free: a
 * point inside the outer contour AND the inner one crosses two edges, is
 * even, and is correctly excluded. The mask is passed in rather than
 * measured from live glyphs because glyph shaping is asynchronous (the font
 * loads) and a holon's geometry must exist the instant it composes — the
 * same constraint Quote and Text document. Handing in polygons keeps this
 * file pure and testable and the effect deterministic.
 */

/** A point in the packing plane. Screen-like: x right, y up. */
export interface Vec2 {
  x: number
  y: number
}

/** Axis-aligned bounds a packing is generated over. */
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** The bounding box of a set of polygons (each a closed polyline). */
export const polygonsBounds = (polygons: readonly (readonly Vec2[])[]): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const poly of polygons) {
    for (const p of poly) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return { minX, minY, maxX, maxY }
}

// ---------------------------------------------------------------------------
// Point-in-shape — SVG even-odd, so letter counters are holes for free
// ---------------------------------------------------------------------------

/**
 * Is `p` inside the shape formed by `polygons` under the even-odd rule?
 *
 * A horizontal ray to the right of p crosses the edges; odd crossings means
 * inside. Every subpath is treated as closed (the segment from its last
 * vertex back to its first is included), because a mask polygon is a filled
 * region, and the even-odd count over ALL subpaths together is what makes a
 * hole a hole — an 'e' is its outer loop and its counter loop, and the ink
 * is where exactly one of them contains the point.
 *
 * The half-open convention (count an edge only when `p.y` is in [y0, y1))
 * is the standard guard against a vertex on the ray being counted twice.
 */
export const pointInShape = (p: Vec2, polygons: readonly (readonly Vec2[])[]): boolean => {
  let inside = false
  for (const poly of polygons) {
    const n = poly.length
    if (n < 3) continue
    for (let i = 0; i < n; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % n]!
      // Does the horizontal ray at p.y cross this edge? Half-open in y.
      const crosses = a.y > p.y !== b.y > p.y
      if (!crosses) continue
      // x of the crossing; the ray goes right, so count it when it lies to
      // the right of p.
      const xCross = a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x)
      if (xCross > p.x) inside = !inside
    }
  }
  return inside
}

// ---------------------------------------------------------------------------
// Hex (flower-of-life) packing
// ---------------------------------------------------------------------------

export interface PackConfig {
  /** Centre-to-centre distance between neighbouring circles. */
  spacing: number
  /** Optional inset: keep points at least this far inside the mask edge. */
  margin?: number
}

/**
 * Generate the hex-packed centres that fall inside the mask.
 *
 * Rows step by `spacing · √3/2` in y and alternate a half-`spacing` offset
 * in x — the flower-of-life lattice. The grid is anchored to the bounds'
 * bottom-left and walked deterministically, so the same mask and spacing
 * always yield the same points in the same order (the tests rely on this,
 * and so does the seeded scatter, which keys its noise on point index).
 *
 * The order is row-major, bottom to top, left to right — stable and
 * inspectable.
 */
export const hexPack = (
  polygons: readonly (readonly Vec2[])[],
  config: PackConfig,
): Vec2[] => {
  const { spacing } = config
  if (spacing <= 0) return []
  const bounds = polygonsBounds(polygons)
  const rowStep = spacing * (Math.sqrt(3) / 2)
  const margin = config.margin ?? 0

  const points: Vec2[] = []
  let row = 0
  for (let y = bounds.minY; y <= bounds.maxY; y += rowStep, row++) {
    // Every other row is offset half a step — the hex stagger.
    const xOffset = row % 2 === 0 ? 0 : spacing / 2
    for (let x = bounds.minX + xOffset; x <= bounds.maxX; x += spacing) {
      const p = { x, y }
      if (!pointInShape(p, polygons)) continue
      // Optional inset: require the point to sit inside even when nudged
      // toward each edge, so circles do not hang off the letter's rim.
      if (margin > 0 && !insetOk(p, polygons, margin)) continue
      points.push(p)
    }
  }
  return points
}

/** True when p stays inside the shape under small nudges — a cheap inset. */
const insetOk = (p: Vec2, polygons: readonly (readonly Vec2[])[], m: number): boolean =>
  pointInShape({ x: p.x + m, y: p.y }, polygons) &&
  pointInShape({ x: p.x - m, y: p.y }, polygons) &&
  pointInShape({ x: p.x, y: p.y + m }, polygons) &&
  pointInShape({ x: p.x, y: p.y - m }, polygons)

// ---------------------------------------------------------------------------
// Seeded hash noise — deterministic, so the scatter scrubs and re-renders
// ---------------------------------------------------------------------------

/**
 * A 32-bit integer hash of two integers and a seed (a small mix based on
 * Wang/xxhash-style avalanching). Returns an unsigned 32-bit value.
 *
 * This is the whole reason the effect is reproducible: the displacement of
 * circle i is derived by hashing i (and a channel) with the seed, never by
 * Math.random(). Same seed, same scatter — forever, and on every frame.
 */
export const hash32 = (i: number, channel: number, seed: number): number => {
  let h = (i | 0) ^ Math.imul(channel | 0, 0x9e3779b1) ^ (seed | 0)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** A hash mapped to [0, 1). */
export const hashUnit = (i: number, channel: number, seed: number): number =>
  hash32(i, channel, seed) / 0x100000000

/**
 * The scatter DISPLACEMENT for point index `i`: a vector drawn from the
 * seeded hash, uniform in direction and with magnitude in
 * [minDistance, distance].
 *
 * Magnitude spans a band rather than being fixed so the scattered cloud has
 * depth — some circles flung far, some barely moved — which is what the
 * reference's loose start looks like, instead of a clean expanded copy. A
 * `minDistance` of 0 (the default) gives the full [0, distance] range.
 */
export const scatterOffset = (
  i: number,
  seed: number,
  distance: number,
  minDistance = 0,
): Vec2 => {
  const angle = hashUnit(i, 0, seed) * Math.PI * 2
  const t = hashUnit(i, 1, seed)
  const mag = minDistance + (distance - minDistance) * t
  return { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag }
}

/**
 * Where point `i` sits at settle `s` ∈ [0, 1].
 *
 *     position(s) = final + offset · (1 − s)
 *
 * s = 1 is exactly `final` (the organised word); s = 0 is `final` plus the
 * full seeded offset (the scattered cloud). Linear in s, so a circle travels
 * a straight line home — the scene supplies the ease-out on the `settle`
 * param's animation, keeping this function pure and honest.
 */
export const scatteredPosition = (
  final: Vec2,
  i: number,
  seed: number,
  distance: number,
  s: number,
  minDistance = 0,
): Vec2 => {
  const off = scatterOffset(i, seed, distance, minDistance)
  const k = 1 - s
  return { x: final.x + off.x * k, y: final.y + off.y * k }
}
