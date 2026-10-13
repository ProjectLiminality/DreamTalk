/**
 * Planning-horizon geometry — the pure layout under vocabulary/Horizons.
 *
 * Two axes from one origin: time (t) running RIGHT, "what do we care
 * about" running DOWN, through rows of domains. Each horizon but the last
 * is a REGION anchored at the origin — `width` along t, reaching down
 * through its first `reach` domains — whose free corner is rounded: the
 * whiteboard's nested quarter-arcs. Horizons nest: operational inside
 * tactical inside strategic (the last horizon is open, unbounded).
 *
 * A role sits in a CELL: its horizon's region minus every inner region,
 * on its domain's row. On a row an inner horizon does not reach, the cell
 * runs back to the axis — a 12-month role on the sales row sits under
 * "13 weeks" because operations' 13-week region never reaches sales. The
 * last horizon is open: its roles stand in its own column.
 */

export interface HorizonSpec {
  /** Extent along t (the last, open horizon's is how far its column runs). */
  width: number
  /** How many domain rows (from the top) its region covers. */
  reach: number
}

export interface Pt {
  x: number
  y: number
}

/** Cumulative right edges of the horizons' columns. */
export const horizonEdges = (hs: readonly HorizonSpec[]): number[] => {
  const out: number[] = []
  let x = 0
  for (const h of hs) out.push((x += h.width))
  return out
}

/**
 * The boundary of region k (not the last): from the time axis at its right
 * edge, down, round the corner, back along its bottom to the domain axis.
 * Local frame: origin at the axes' corner, y down negative.
 */
export const regionBoundary = (
  hs: readonly HorizonSpec[],
  k: number,
  rowHeight: number,
  samples = 24,
): Pt[] => {
  const W = horizonEdges(hs)[k]!
  const D = hs[k]!.reach * rowHeight
  const c = 0.75 * Math.min(W, D)
  const out: Pt[] = [{ x: W, y: 0 }]
  for (let i = 0; i <= samples; i++) {
    const a = (Math.PI / 2) * (i / samples)
    // The corner's centre is (W − c, −D + c); sweep from east to south.
    out.push({ x: W - c + c * Math.cos(a), y: -D + c - c * Math.sin(a) })
  }
  out.push({ x: 0, y: -D })
  return out
}

/** The x-range of the cell (horizon k, row r): back to the innermost region that reaches r. */
export const cellSpan = (hs: readonly HorizonSpec[], k: number, row: number): [number, number] => {
  const edges = horizonEdges(hs)
  // The last horizon is open — no region, just its own column.
  if (k === hs.length - 1) return [k > 0 ? edges[k - 1]! : 0, edges[k]!]
  let left = 0
  for (let j = k - 1; j >= 0; j--) {
    if (hs[j]!.reach > row) {
      left = edges[j]!
      break
    }
  }
  return [left, edges[k]!]
}

/**
 * Where `count` roles sharing cell (k, row) stand: each in the middle of its
 * own equal share of the cell's span (a bounded cell's span kept clear of
 * the region's rounded corner), at the row's middle. Index i of count.
 */
export const roleSpot = (
  hs: readonly HorizonSpec[],
  k: number,
  row: number,
  rowHeight: number,
  i: number,
  count: number,
): Pt => {
  const [a, b0] = cellSpan(hs, k, row)
  // A bounded region's free corner is rounded: keep clear of it.
  const b = k < hs.length - 1 ? b0 - 0.18 * (b0 - a) : b0
  const x = a + ((b - a) * (i + 0.5)) / count
  return { x, y: -(row + 0.5) * rowHeight }
}

/** Region k's rounded corner: centre and radius (k not the last horizon). */
const corner = (hs: readonly HorizonSpec[], k: number, rowHeight: number) => {
  const W = horizonEdges(hs)[k]!
  const D = hs[k]!.reach * rowHeight
  const c = 0.75 * Math.min(W, D)
  return { W, D, c, cx: W - c, cy: -D + c }
}

/**
 * How far right region k reaches at depth y (y ≤ 0): its full width above
 * the corner, the arc through the corner, nothing below its bottom.
 */
export const regionRightAt = (hs: readonly HorizonSpec[], k: number, rowHeight: number, y: number): number => {
  const { W, D, c, cx, cy } = corner(hs, k, rowHeight)
  if (y < -D) return -Infinity
  if (y >= cy) return W
  return cx + Math.sqrt(Math.max(0, c * c - (y - cy) * (y - cy)))
}

/** The point on region k's rounded corner at `frac` of its quarter turn (0 east, 1 south). */
export const cornerPoint = (hs: readonly HorizonSpec[], k: number, rowHeight: number, frac: number): Pt => {
  const { c, cx, cy } = corner(hs, k, rowHeight)
  const a = (Math.PI / 2) * frac
  return { x: cx + c * Math.cos(a), y: cy - c * Math.sin(a) }
}

/**
 * Cut a polyline where it passes within `r` of `at`, into its runs outside —
 * a line opening around a name written on it, as on a whiteboard. Ends of a
 * run are pulled exactly onto the gap's circle.
 */
export const splitAround = (pts: readonly Pt[], at: Pt, r: number): Pt[][] => {
  const inside = (p: Pt) => Math.hypot(p.x - at.x, p.y - at.y) < r
  const edge = (a: Pt, b: Pt): Pt => {
    // Bisect the segment for the crossing of the circle.
    let lo = 0
    let hi = 1
    const aIn = inside(a)
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2
      const p = { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }
      if (inside(p) === aIn) lo = m
      else hi = m
    }
    const m = (lo + hi) / 2
    return { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }
  }
  const runs: Pt[][] = []
  let cur: Pt[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const prev = pts[i - 1]
    if (!inside(p)) {
      if (prev && inside(prev)) cur.push(edge(prev, p))
      cur.push(p)
    } else if (prev && !inside(prev)) {
      cur.push(edge(prev, p))
      if (cur.length >= 2) runs.push(cur)
      cur = []
    }
  }
  if (cur.length >= 2) runs.push(cur)
  return runs
}
