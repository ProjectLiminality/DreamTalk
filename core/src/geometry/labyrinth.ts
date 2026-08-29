/**
 * The Labyrinth footprint — a circular maze over a polar cell graph,
 * pure math (no Holon, no render). Ported from the 2021 generator
 * (TheWall/TheLabyrinth.py, the Python-in-C4D original; line citations
 * below refer to it).
 *
 * The construction (TheLabyrinth.py:81-90):
 *
 *  1. a polar cell grid between the citadel and the outer radius,
 *     ring cell counts DOUBLING adaptively so cells stay roughly
 *     square as circumference grows;
 *  2. a perfect maze carved over that grid by iterative-DFS
 *     backtracking (every cell reachable, no loops);
 *  3. wall center-lines extracted for every uncarved cell boundary —
 *     with NO outer boundary: you can wander in from the open outside,
 *     but never reach the core;
 *  4. walls filtered to those connected (via shared endpoints) to the
 *     closed inner citadel circle — free-floating wall islands drop;
 *  5. surviving segments merged into continuous polyline chains at
 *     degree-2 junctions;
 *  6. the citadel circle appended as a closed loop.
 *
 * The original was seeded (random.Random(seed), :143) and so is this
 * port — mulberry32 below — so one seed is one labyrinth, forever.
 *
 * The plane: the Python built in C4D's XZ ground plane (:174). The
 * framework's scene plane is XY, so everything here is Vec2 in the
 * footprint plane; the part maps {x, y} → world {x, y, z: 0}.
 */

/** A point in the footprint plane. */
export interface Vec2 {
  x: number
  y: number
}

export interface LabyrinthConfig {
  /** Outermost wall radius (the open edge). */
  radius: number
  /** Radius of the closed citadel circle the maze grows from. */
  citadelRadius: number
  /**
   * The intended ring thickness, and thereby the rough cell scale —
   * the 2021 generator took ring/base counts directly (:48); stating
   * the SIZE and deriving the counts keeps one knob at every scale.
   */
  targetCellSize: number
  /** Maze seed — same seed, same labyrinth. */
  seed: number
}

/** The polar cell grid the maze is carved over. */
export interface RingLayout {
  ringCount: number
  ringThickness: number
  /** Cells in each ring, innermost first (:95-107). */
  cellsPerRing: number[]
  /** Ring boundary radii — radii[0] is the citadel, radii[ringCount] the rim (:162-165). */
  radii: number[]
  cellCount: number
}

export interface LabyrinthStats {
  /** Carved passages — cellCount − 1 exactly, the spanning-tree signature. */
  passageCount: number
  /** Wall center-line segments before the citadel-connectivity filter. */
  wallSegments: number
  /** Segments surviving the filter. */
  connectedSegments: number
  /** Free-floating wall islands dropped by the filter. */
  orphanSegments: number
  chainCount: number
}

export interface LabyrinthResult {
  /**
   * Wall center-line polylines, open, sorted by their innermost point's
   * radius — the order a create that radiates outward wants.
   */
  chains: Vec2[][]
  /** The citadel circle, closed (first point repeated at the end). */
  citadel: Vec2[]
  cells: RingLayout
  stats: LabyrinthStats
}

/** Points per arc wall — the 2021 smoothness (ARC_SEGMENTS, :92). */
export const ARC_SEGMENTS = 8

/**
 * The adaptive-doubling law (:103): a cell may grow to at most this
 * many ring-thicknesses wide (measured on the ring's mid-circumference)
 * before its ring doubles its cell count. The base ring is BORN at this
 * limit — the widest legal cells, which is what gave the 2021 face its
 * long unbroken arcs near the citadel (cells_base 6 against 6 rings).
 */
export const CELL_WIDTH_LIMIT = 2

/** No ring may degenerate below a triangle's worth of cells. */
const MIN_BASE_CELLS = 3

/**
 * Endpoint matching tolerance as a fraction of the cell size. The 2021
 * main() passed 2.0 world units against 200-unit cells (:432, :437) —
 * the same 1% here, but stated as a ratio so the maze survives rescaling.
 */
const TOLERANCE_RATIO = 0.01

/**
 * mulberry32 — a tiny 32-bit seeded PRNG standing in for the original's
 * random.Random(seed) (:143). Uniform in [0, 1), one multiply per draw.
 */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The ring layout: ring count from the radial span at targetCellSize,
 * base cell count born at the width limit, then the doubling rule
 * (compute_cells_per_ring, :95-107) — when a ring's mid-circumference
 * arc per cell would exceed CELL_WIDTH_LIMIT ring-thicknesses, the
 * count doubles; otherwise it carries over.
 */
export const ringLayout = (
  radius: number,
  citadelRadius: number,
  targetCellSize: number,
): RingLayout => {
  const span = radius - citadelRadius
  const ringCount = Math.max(1, Math.round(span / targetCellSize))
  const ringThickness = span / ringCount
  const baseMidRadius = citadelRadius + ringThickness / 2
  // ceil, not round: the base ring is born AT the width limit, never past
  // it, so the law below holds for ring 0 too.
  const baseCells = Math.max(
    MIN_BASE_CELLS,
    Math.ceil((2 * Math.PI * baseMidRadius) / (CELL_WIDTH_LIMIT * ringThickness)),
  )
  const cellsPerRing = [baseCells]
  for (let r = 1; r < ringCount; r++) {
    const midRadius = citadelRadius + (r + 0.5) * ringThickness
    const arcPerCell = (2 * Math.PI * midRadius) / cellsPerRing[r - 1]!
    cellsPerRing.push(
      arcPerCell > CELL_WIDTH_LIMIT * ringThickness
        ? cellsPerRing[r - 1]! * 2
        : cellsPerRing[r - 1]!,
    )
  }
  const radii: number[] = []
  for (let i = 0; i <= ringCount; i++) radii.push(citadelRadius + (span * i) / ringCount)
  const cellCount = cellsPerRing.reduce((a, b) => a + b, 0)
  return { ringCount, ringThickness, cellsPerRing, radii, cellCount }
}

/** Flat cell ids: ring offsets, then id = offset[ring] + index. */
const ringOffsets = (cellsPerRing: readonly number[]): number[] => {
  const offsets = [0]
  for (const count of cellsPerRing) offsets.push(offsets[offsets.length - 1]! + count)
  return offsets
}

/**
 * Adjacency of the polar cell graph (build_adjacency, :110-138), in the
 * original's neighbor order: CW, CCW, inward (parent under doubling),
 * outward (all children under doubling).
 */
export const buildAdjacency = (cellsPerRing: readonly number[]): number[][] => {
  const offsets = ringOffsets(cellsPerRing)
  const id = (r: number, c: number): number => offsets[r]! + c
  const adjacency: number[][] = []
  for (let r = 0; r < cellsPerRing.length; r++) {
    const count = cellsPerRing[r]!
    for (let c = 0; c < count; c++) {
      const neighbors: number[] = []
      neighbors.push(id(r, (c + 1) % count))
      neighbors.push(id(r, (c - 1 + count) % count))
      if (r > 0) {
        const prevCount = cellsPerRing[r - 1]!
        // Same count: straight inward. Doubled: integer parent (:124-125).
        neighbors.push(
          count === prevCount ? id(r - 1, c) : id(r - 1, Math.floor((c * prevCount) / count)),
        )
      }
      if (r < cellsPerRing.length - 1) {
        const nextCount = cellsPerRing[r + 1]!
        if (nextCount === count) {
          neighbors.push(id(r + 1, c))
        } else {
          const ratio = nextCount / count
          for (let k = 0; k < ratio; k++) neighbors.push(id(r + 1, c * ratio + k))
        }
      }
      adjacency.push(neighbors)
    }
  }
  return adjacency
}

/** Canonical passage key for an unordered cell pair (frozenset, :154). */
const passageKey = (a: number, b: number): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`

/**
 * Iterative-DFS backtracking carve (carve_maze, :141-159): start at
 * cell (0, 0), always step to a random unvisited neighbor, backtrack
 * when stuck. Visits every cell; carves exactly cellCount − 1 passages
 * — a spanning tree, so the maze is perfect (no isolated cells, no
 * loops).
 */
export const carveMaze = (
  adjacency: readonly number[][],
  random: () => number,
): Set<string> => {
  const passages = new Set<string>()
  const visited = new Array<boolean>(adjacency.length).fill(false)
  const stack = [0]
  visited[0] = true
  while (stack.length > 0) {
    const current = stack[stack.length - 1]!
    const open = adjacency[current]!.filter((n) => !visited[n])
    if (open.length > 0) {
      const next = open[Math.floor(random() * open.length)]!
      passages.add(passageKey(current, next))
      visited[next] = true
      stack.push(next)
    } else {
      stack.pop()
    }
  }
  return passages
}

/** Points along an arc about the origin (arc_points, :168-175). */
const arcPoints = (radius: number, angleStart: number, angleEnd: number): Vec2[] => {
  const points: Vec2[] = []
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const angle = angleStart + ((angleEnd - angleStart) * i) / ARC_SEGMENTS
    points.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) })
  }
  return points
}

/**
 * Wall center-line segments (extract_wall_segments, :178-224). Per cell:
 * its outer arc where no outward passage was carved — split per CHILD
 * cell when the next ring doubled (:203-213), so arc endpoints land on
 * every finer boundary angle and connectivity stays endpoint-only —
 * and its CW radial edge where no sideways passage was carved
 * (:215-222). The outermost ring contributes NO outer arcs (:196): the
 * rim stays open.
 */
export const extractWallSegments = (
  layout: RingLayout,
  passages: ReadonlySet<string>,
): Vec2[][] => {
  const { cellsPerRing, radii, ringCount } = layout
  const offsets = ringOffsets(cellsPerRing)
  const id = (r: number, c: number): number => offsets[r]! + c
  const TWO_PI = 2 * Math.PI
  const segments: Vec2[][] = []

  for (let r = 0; r < ringCount; r++) {
    const count = cellsPerRing[r]!
    const rInner = radii[r]!
    const rOuter = radii[r + 1]!
    const cellAngle = TWO_PI / count

    for (let c = 0; c < count; c++) {
      const angleEnd = cellAngle * (c + 1)
      const cell = id(r, c)

      if (r < ringCount - 1) {
        const nextCount = cellsPerRing[r + 1]!
        if (nextCount === count) {
          if (!passages.has(passageKey(cell, id(r + 1, c)))) {
            segments.push(arcPoints(rOuter, cellAngle * c, angleEnd))
          }
        } else {
          const ratio = nextCount / count
          const childAngle = TWO_PI / nextCount
          for (let k = 0; k < ratio; k++) {
            const child = c * ratio + k
            if (!passages.has(passageKey(cell, id(r + 1, child)))) {
              segments.push(arcPoints(rOuter, childAngle * child, childAngle * (child + 1)))
            }
          }
        }
      }

      if (!passages.has(passageKey(cell, id(r, (c + 1) % count)))) {
        segments.push([
          { x: rInner * Math.cos(angleEnd), y: rInner * Math.sin(angleEnd) },
          { x: rOuter * Math.cos(angleEnd), y: rOuter * Math.sin(angleEnd) },
        ])
      }
    }
  }

  return segments
}

const dist = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.y - a.y)

/**
 * Keep only wall segments connected to the citadel
 * (filter_connected_to_citadel, :227-271): seed with every segment that
 * has a point ON the citadel radius (:231-235 — ring-0 radial walls),
 * then flood outward through shared ENDPOINTS (:249-269; interior arc
 * points never join anything — the construction puts every junction on
 * a segment end). What the flood never reaches is a floating island the
 * open rim disowned; it drops.
 */
export const filterConnectedToCitadel = (
  segments: readonly Vec2[][],
  citadelRadius: number,
  tolerance: number,
): Vec2[][] => {
  const touchesCitadel = (segment: readonly Vec2[]): boolean =>
    segment.some((p) => Math.abs(Math.hypot(p.x, p.y) - citadelRadius) < tolerance)

  const connected = new Set<number>()
  const remaining = new Set<number>()
  segments.forEach((segment, i) => {
    if (touchesCitadel(segment)) connected.add(i)
    else remaining.add(i)
  })

  const ends = (i: number): [Vec2, Vec2] => [segments[i]![0]!, segments[i]![segments[i]!.length - 1]!]

  let changed = true
  while (changed) {
    changed = false
    for (const i of remaining) {
      const [a0, a1] = ends(i)
      let joined = false
      for (const j of connected) {
        const [b0, b1] = ends(j)
        if (
          dist(a0, b0) < tolerance ||
          dist(a0, b1) < tolerance ||
          dist(a1, b0) < tolerance ||
          dist(a1, b1) < tolerance
        ) {
          joined = true
          break
        }
      }
      if (joined) {
        connected.add(i)
        remaining.delete(i)
        changed = true
      }
    }
  }

  return [...connected].sort((a, b) => a - b).map((i) => segments[i]!)
}

/** Quantized endpoint key for junction matching (snap_key, :279-283). */
const snapKey = (p: Vec2, precision: number): string =>
  `${Math.round(p.x / precision)},${Math.round(p.y / precision)}`

/**
 * Merge wall segments into continuous polyline chains
 * (merge_segments_into_chains, :285-388). Exactly-two-segment junctions
 * merge; T-junctions (3+ ends meeting) never do — those segments stay
 * separate chains that happen to share an endpoint (:289-292).
 *
 * One deliberate divergence from the original: its `used_in_merge`
 * guard (:308-315) let each segment join at most ONE junction, capping
 * every chain at two segments — an accident that its own docstring
 * ("longer polyline chains") contradicts, and that changes only how the
 * ink is grouped, not where it lies. Here a chain runs through EVERY
 * degree-2 junction on its way, which is the stated intent.
 */
export const mergeSegmentsIntoChains = (
  segments: readonly Vec2[][],
  tolerance: number,
): Vec2[][] => {
  interface End {
    seg: number
    end: 0 | 1
  }
  const endPoint = (e: End): Vec2 =>
    e.end === 0 ? segments[e.seg]![0]! : segments[e.seg]![segments[e.seg]!.length - 1]!

  const junctions = new Map<string, End[]>()
  segments.forEach((_, seg) => {
    for (const end of [0, 1] as const) {
      const key = snapKey(endPoint({ seg, end }), tolerance)
      const entries = junctions.get(key)
      if (entries) entries.push({ seg, end })
      else junctions.set(key, [{ seg, end }])
    }
  })

  /** The single other segment-end at this end's junction, if degree 2. */
  const partnerOf = (e: End): End | undefined => {
    const entries = junctions.get(snapKey(endPoint(e), tolerance))!
    if (entries.length !== 2) return undefined
    const other = entries.find((o) => o.seg !== e.seg)
    return other
  }

  const visited = new Set<number>()
  const chains: Vec2[][] = []

  for (let start = 0; start < segments.length; start++) {
    if (visited.has(start)) continue
    visited.add(start)

    /** flip: the segment reads tail-to-head reversed in the final chain. */
    interface Link {
      seg: number
      flip: boolean
    }

    // Extend from the head (end 1) forward…
    const forward: Link[] = []
    let cursor: End = { seg: start, end: 1 }
    for (;;) {
      const partner = partnerOf(cursor)
      if (!partner || visited.has(partner.seg)) break
      visited.add(partner.seg)
      forward.push({ seg: partner.seg, flip: partner.end === 1 })
      cursor = { seg: partner.seg, end: partner.end === 0 ? 1 : 0 }
    }

    // …and from the tail (end 0) backward.
    const backward: Link[] = []
    cursor = { seg: start, end: 0 }
    for (;;) {
      const partner = partnerOf(cursor)
      if (!partner || visited.has(partner.seg)) break
      visited.add(partner.seg)
      backward.push({ seg: partner.seg, flip: partner.end === 0 })
      cursor = { seg: partner.seg, end: partner.end === 0 ? 1 : 0 }
    }
    backward.reverse()

    const sequence: Link[] = [...backward, { seg: start, flip: false }, ...forward]
    const points: Vec2[] = []
    sequence.forEach((link, i) => {
      const raw = segments[link.seg]!
      const oriented = link.flip ? [...raw].reverse() : raw
      // Junction points are shared; keep one copy.
      points.push(...(i === 0 ? oriented : oriented.slice(1)))
    })
    chains.push(points)
  }

  return chains
}

/**
 * The closed citadel circle (:439-445): sampled at the arc resolution
 * of the base ring's cell count, first point repeated at the end (the
 * framework's closed-polyline convention).
 */
export const citadelPolyline = (citadelRadius: number, baseCells: number): Vec2[] => {
  const count = ARC_SEGMENTS * baseCells * 2
  const points: Vec2[] = []
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count
    points.push({ x: citadelRadius * Math.cos(angle), y: citadelRadius * Math.sin(angle) })
  }
  points.push({ ...points[0]! })
  return points
}

/** A chain's closest approach to the center — the radiating-create sort key. */
const innermostRadius = (chain: readonly Vec2[]): number =>
  chain.reduce((min, p) => Math.min(min, Math.hypot(p.x, p.y)), Infinity)

/** The whole construction (main, :413-456), deterministic in its seed. */
export const generateLabyrinth = (config: LabyrinthConfig): LabyrinthResult => {
  const { radius, citadelRadius, targetCellSize, seed } = config
  const tolerance = targetCellSize * TOLERANCE_RATIO

  const cells = ringLayout(radius, citadelRadius, targetCellSize)
  const adjacency = buildAdjacency(cells.cellsPerRing)
  const passages = carveMaze(adjacency, mulberry32(seed))
  const segments = extractWallSegments(cells, passages)
  const connected = filterConnectedToCitadel(segments, citadelRadius, tolerance)
  const chains = mergeSegmentsIntoChains(connected, tolerance).sort(
    (a, b) => innermostRadius(a) - innermostRadius(b),
  )
  const citadel = citadelPolyline(citadelRadius, cells.cellsPerRing[0]!)

  return {
    chains,
    citadel,
    cells,
    stats: {
      passageCount: passages.size,
      wallSegments: segments.length,
      connectedSegments: connected.length,
      orphanSegments: segments.length - connected.length,
      chainCount: chains.length,
    },
  }
}
