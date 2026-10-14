/**
 * The boundary of a triangle mesh as polylines — the edges that belong to
 * exactly one triangle, chained into loops. What a fill's halo follows
 * (render/glow.ts): a disc's rim, a land mass's coast, a letter's outline
 * and its counters, with no knowledge of how the mesh was made.
 *
 * Vertices are welded by position first, so a fan whose last rim point
 * repeats its first, or a triangulation that duplicates seam vertices,
 * still has no false edge along the seam. A closed solid has no boundary
 * at all, and gets none. Pure.
 */

export interface P3 {
  x: number
  y: number
  z: number
}

/**
 * Boundary polylines of the mesh (`positions` xyz-flat, `indices` triangle
 * corners; sequential triples when omitted). A closed loop repeats its
 * first point at the end.
 */
export const boundaryLoops = (positions: ArrayLike<number>, indices?: ArrayLike<number>): P3[][] => {
  const vertexCount = Math.floor(positions.length / 3)
  if (vertexCount < 3) return []
  // Weld: one id per distinct position, at a tolerance relative to the mesh.
  let extent = 0
  for (let i = 0; i < positions.length; i++) extent = Math.max(extent, Math.abs(positions[i]!))
  const q = 1e6 / Math.max(extent, 1e-9)
  const idOf = new Map<string, number>()
  const weld = new Int32Array(vertexCount)
  const points: P3[] = []
  for (let v = 0; v < vertexCount; v++) {
    const x = positions[v * 3]!, y = positions[v * 3 + 1]!, z = positions[v * 3 + 2]!
    const key = `${Math.round(x * q)},${Math.round(y * q)},${Math.round(z * q)}`
    let id = idOf.get(key)
    if (id === undefined) {
      id = points.length
      idOf.set(key, id)
      points.push({ x, y, z })
    }
    weld[v] = id
  }
  const corner = (i: number) => weld[indices ? indices[i]! : i]!
  const cornerCount = indices ? indices.length : vertexCount
  // Count each undirected edge.
  const n = points.length
  const edgeKey = (a: number, b: number) => (a < b ? a * n + b : b * n + a)
  const uses = new Map<number, number>()
  for (let t = 0; t + 2 < cornerCount; t += 3) {
    const a = corner(t), b = corner(t + 1), c = corner(t + 2)
    if (a === b || b === c || c === a) continue
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      const k = edgeKey(u, v)
      uses.set(k, (uses.get(k) ?? 0) + 1)
    }
  }
  // Boundary adjacency.
  const next = new Map<number, number[]>()
  const link = (u: number, v: number) => {
    const list = next.get(u)
    if (list) list.push(v)
    else next.set(u, [v])
  }
  for (const [k, count] of uses) {
    if (count !== 1) continue
    const a = Math.floor(k / n), b = k % n
    link(a, b)
    link(b, a)
  }
  // Chain: walk unused edges, open chains from their ends first.
  const used = new Set<number>()
  const loops: P3[][] = []
  const walk = (start: number) => {
    const chain = [start]
    let at = start
    for (;;) {
      const step = (next.get(at) ?? []).find((v) => !used.has(edgeKey(at, v)))
      if (step === undefined) break
      used.add(edgeKey(at, step))
      chain.push(step)
      at = step
      if (at === start) break
    }
    if (chain.length > 1) loops.push(chain.map((id) => points[id]!))
  }
  for (const [v, list] of next) if (list.length % 2 === 1) walk(v)
  for (const v of next.keys()) {
    while ((next.get(v) ?? []).some((w) => !used.has(edgeKey(v, w)))) walk(v)
  }
  return loops
}

/** Signed area of a closed loop in the xy plane (CCW positive). */
const signedArea = (loop: readonly P3[]): number => {
  let a = 0
  for (let i = 0; i + 1 < loop.length; i++) a += loop[i]!.x * loop[i + 1]!.y - loop[i + 1]!.x * loop[i]!.y
  return a / 2
}

/** Even-odd: is (x, y) inside this closed loop? */
const inside = (loop: readonly P3[], x: number, y: number): boolean => {
  let odd = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i]!, b = loop[j]!
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) odd = !odd
  }
  return odd
}

/**
 * Orient FLAT boundary loops (all in one z plane) so the filled side is
 * always on the LEFT: outer loops counter-clockwise, holes (loops inside
 * an odd number of others) clockwise — whatever winding the triangulation
 * had. A halo can then light only the side away from the fill.
 */
export const orientLoops = (loops: readonly P3[][]): P3[][] =>
  loops.map((loop, i) => {
    const p = loop[0]!
    let depth = 0
    for (let j = 0; j < loops.length; j++) if (j !== i && inside(loops[j]!, p.x, p.y)) depth++
    const wantCCW = depth % 2 === 0
    return signedArea(loop) > 0 === wantCCW ? loop : [...loop].reverse()
  })

/** Do all these points lie in one z plane (to a tolerance relative to their extent)? */
export const isFlat = (positions: ArrayLike<number>): boolean => {
  let zMin = Infinity, zMax = -Infinity, extent = 0
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const z = positions[i + 2]!
    if (z < zMin) zMin = z
    if (z > zMax) zMax = z
    extent = Math.max(extent, Math.abs(positions[i]!), Math.abs(positions[i + 1]!))
  }
  return zMax - zMin <= 1e-6 * Math.max(extent, 1)
}
