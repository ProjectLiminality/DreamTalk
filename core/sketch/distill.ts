/**
 * distill.ts — many rough strokes → the one clean stroke they mean.
 *
 * David doesn't draw a line right the first time. He searches for it: a
 * circle as ten overlapping loops, a curve as a bundle of nearly parallel
 * passes, an S as a cloud of little dabs — until the AVERAGE is the shape he
 * intends. Distill is the centre-of-gravity reduction of that way of painting:
 * pure geometry, no AI, a few milliseconds.
 *
 *   1. SAMPLES   every stroke resampled at uniform arc length, so the ink's
 *                weight is its length (a dab still weighs at least a pen tip).
 *   2. SPREAD    how wide the searching is: the median perpendicular scatter
 *                (minor axis of a local PCA), the neighbourhood radius
 *                iterated to a fixed point — a single clean line shrinks it
 *                to the pen, a filled area grows it to its width.
 *   3. CLUSTERS  strokes closer than ~σ belong together; separate clusters
 *                are distilled separately, each with its own σ.
 *   4. DENSITY   splat into a grid, Gaussian blur with σ, threshold relative
 *                to the density the ink itself sits on.
 *   5. SKELETON  Zhang–Suen thinning, staircase pixels removed, traced into a
 *                graph (junction clusters, edges, pure cycles). Short spurs
 *                pruned, thin bubbles (two passes diverging) averaged.
 *   6. TOPOLOGY  at every junction the most nearly straight pair of branches
 *                is continued through; the rest end there. Chains → open
 *                strokes, rings → closed ones; a figure 8 stays ONE stroke.
 *                Free ends close together and facing each other are bridged
 *                (sparse stippling thins the density, not the line).
 *   7. PRINCIPAL CURVE  each path is pulled, vertex by vertex, onto the
 *                Gaussian-weighted mean of the ink perpendicular to it (with
 *                a little Laplacian smoothing), free ends trimmed (a skeleton
 *                curls into its blob's corner) and extended straight to where
 *                the ink really ends, then Gaussian-smoothed along the arc.
 *                Ends at a junction are snapped onto the stroke they meet.
 *   8. OUTPUT    Ramer–Douglas–Peucker, Catmull-Rom resample, uniform
 *                pressure (the input's median).
 *
 * No DOM — main.ts and the tests call the same function.
 */

import type { InkStroke, PenSample } from "./protocol"

export interface Pt {
  x: number
  y: number
}

/** One distilled curve, in page units. Closed curves do NOT repeat their first point. */
export interface DistilledPath {
  points: Pt[]
  closed: boolean
}

export interface DistillOptions {
  /** Force the blur radius (page units) instead of estimating it. */
  sigma?: number
  /** Diagnostics (σ per cluster, stage timings) — tests and tuning only. */
  trace?: (line: string) => void
}

/** Resampling step of the output stroke, page units. */
const OUT_STEP = 2.5
/** The pen's own width, page units — a dab weighs at least this much ink. */
const PEN = 4
const SIGMA_MIN = 2.5

// --- 1. Samples ---------------------------------------------------------------------

interface Samples {
  x: Float64Array
  y: Float64Array
  w: Float64Array
  stroke: Int32Array
  n: number
}

const strokeLength = (pts: readonly Pt[]): number => {
  let L = 0
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
  return L
}

/** Uniform arc-length resampling of a polyline (first and last points kept). */
export const resample = (pts: readonly Pt[], step: number, closed = false): Pt[] => {
  if (pts.length === 0) return []
  const src = closed ? [...pts, pts[0]!] : pts
  const out: Pt[] = [{ x: src[0]!.x, y: src[0]!.y }]
  let carry = 0
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1]!
    const b = src[i]!
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    if (d === 0) continue
    let s = step - carry
    while (s <= d) {
      const t = s / d
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      s += step
    }
    carry = d - (s - step)
  }
  const last = src[src.length - 1]!
  if (closed) {
    // drop a final sample that landed on (or next to) the start again
    const e = out[out.length - 1]!
    if (out.length > 2 && Math.hypot(e.x - last.x, e.y - last.y) < step * 0.5) out.pop()
  } else {
    const e = out[out.length - 1]!
    if (Math.hypot(e.x - last.x, e.y - last.y) > step * 0.25) out.push({ x: last.x, y: last.y })
  }
  return out
}

const sampleStrokes = (strokes: readonly (readonly Pt[])[], h: number): Samples => {
  const xs: number[] = []
  const ys: number[] = []
  const ws: number[] = []
  const ks: number[] = []
  strokes.forEach((pts, k) => {
    if (pts.length === 0) return
    const L = strokeLength(pts)
    const r = L > 0 ? resample(pts, h) : [pts[0]!]
    const w = Math.max(L, PEN) / r.length
    for (const p of r) {
      xs.push(p.x)
      ys.push(p.y)
      ws.push(w)
      ks.push(k)
    }
  })
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), w: Float64Array.from(ws), stroke: Int32Array.from(ks), n: xs.length }
}

const subset = (s: Samples, keep: (i: number) => boolean): Samples => {
  const idx: number[] = []
  for (let i = 0; i < s.n; i++) if (keep(i)) idx.push(i)
  return {
    x: Float64Array.from(idx, (i) => s.x[i]!),
    y: Float64Array.from(idx, (i) => s.y[i]!),
    w: Float64Array.from(idx, (i) => s.w[i]!),
    stroke: Int32Array.from(idx, (i) => s.stroke[i]!),
    n: idx.length,
  }
}

const bounds = (s: Samples) => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < s.n; i++) {
    x0 = Math.min(x0, s.x[i]!)
    y0 = Math.min(y0, s.y[i]!)
    x1 = Math.max(x1, s.x[i]!)
    y1 = Math.max(y1, s.y[i]!)
  }
  return { x0, y0, x1, y1, diag: Math.hypot(x1 - x0, y1 - y0) }
}

// --- Spatial hash ---------------------------------------------------------------------

class Hash {
  readonly #x0: number
  readonly #y0: number
  readonly #nx: number
  readonly #ny: number
  /** Counting-sorted buckets: cell k's samples are items[start[k] .. start[k + 1]). */
  readonly #start: Int32Array
  readonly #items: Int32Array
  constructor(
    readonly s: Samples,
    readonly cell: number,
  ) {
    const b = bounds(s)
    this.#x0 = b.x0
    this.#y0 = b.y0
    this.#nx = Math.max(1, Math.floor((b.x1 - b.x0) / cell) + 1)
    this.#ny = Math.max(1, Math.floor((b.y1 - b.y0) / cell) + 1)
    const of = new Int32Array(s.n)
    const count = new Int32Array(this.#nx * this.#ny + 1)
    for (let i = 0; i < s.n; i++) {
      const k = Math.floor((s.y[i]! - b.y0) / cell) * this.#nx + Math.floor((s.x[i]! - b.x0) / cell)
      of[i] = k
      count[k + 1]!++
    }
    for (let k = 1; k < count.length; k++) count[k]! += count[k - 1]!
    this.#start = count.slice()
    this.#items = new Int32Array(s.n)
    for (let i = 0; i < s.n; i++) this.#items[count[of[i]!]!++] = i
  }
  /** Calls f for every sample within r of (x, y). */
  near(x: number, y: number, r: number, f: (i: number, d2: number) => void) {
    const c = this.cell
    const gx0 = Math.max(0, Math.floor((x - r - this.#x0) / c))
    const gx1 = Math.min(this.#nx - 1, Math.floor((x + r - this.#x0) / c))
    const gy0 = Math.max(0, Math.floor((y - r - this.#y0) / c))
    const gy1 = Math.min(this.#ny - 1, Math.floor((y + r - this.#y0) / c))
    const r2 = r * r
    const sx = this.s.x
    const sy = this.s.y
    for (let gy = gy0; gy <= gy1; gy++)
      for (let gx = gx0; gx <= gx1; gx++) {
        const k = gy * this.#nx + gx
        for (let q = this.#start[k]!; q < this.#start[k + 1]!; q++) {
          const i = this.#items[q]!
          const dx = sx[i]! - x
          const dy = sy[i]! - y
          const d2 = dx * dx + dy * dy
          if (d2 <= r2) f(i, d2)
        }
      }
  }
}

// --- 2. Spread ------------------------------------------------------------------------

/** Median minor-axis std of the ink around (a subset of) its own samples, within R. */
const scatterAt = (s: Samples, R: number): number => {
  const hash = new Hash(s, R)
  const stride = Math.max(1, Math.floor(s.n / 300))
  const vals: number[] = []
  for (let q = 0; q < s.n; q += stride) {
    // one pass of raw moments about the query point
    let W = 0
    let mx = 0
    let my = 0
    let sxx = 0
    let syy = 0
    let sxy = 0
    let n = 0
    const qx = s.x[q]!
    const qy = s.y[q]!
    hash.near(qx, qy, R, (i) => {
      const w = s.w[i]!
      const dx = s.x[i]! - qx
      const dy = s.y[i]! - qy
      W += w
      mx += w * dx
      my += w * dy
      sxx += w * dx * dx
      syy += w * dy * dy
      sxy += w * dx * dy
      n++
    })
    if (n < 5) continue
    mx /= W
    my /= W
    sxx = sxx / W - mx * mx
    syy = syy / W - my * my
    sxy = sxy / W - mx * my
    const tr = (sxx + syy) / 2
    const det = Math.sqrt(Math.max(0, ((sxx - syy) / 2) ** 2 + sxy * sxy))
    vals.push(Math.sqrt(Math.max(0, tr - det)))
  }
  if (vals.length === 0) return 0
  vals.sort((a, b) => a - b)
  return vals[vals.length >> 1]!
}

/**
 * Every `stride`-th sample of each stroke (and each stroke's last), weights
 * scaled so every stroke keeps its total — a coarser view of the same ink.
 */
const decimate = (s: Samples, stride: number): Samples => {
  if (stride <= 1) return s
  const idx: number[] = []
  const w: number[] = []
  let i = 0
  while (i < s.n) {
    let j = i
    while (j < s.n && s.stroke[j] === s.stroke[i]) j++
    const keep: number[] = []
    for (let k = i; k < j; k += stride) keep.push(k)
    if (keep[keep.length - 1] !== j - 1) keep.push(j - 1)
    let total = 0
    for (let k = i; k < j; k++) total += s.w[k]!
    for (const k of keep) {
      idx.push(k)
      w.push(total / keep.length)
    }
    i = j
  }
  return {
    x: Float64Array.from(idx, (k) => s.x[k]!),
    y: Float64Array.from(idx, (k) => s.y[k]!),
    w: Float64Array.from(w),
    stroke: Int32Array.from(idx, (k) => s.stroke[k]!),
    n: idx.length,
  }
}

/** σ for the blur: ~ the perpendicular scatter of the searching passes. */
const estimateSigma = (s: Samples, h: number): number => {
  const { diag } = bounds(s)
  if (diag < 2 * SIGMA_MIN) return SIGMA_MIN
  let R = diag / 8
  let sc = 0
  for (let it = 0; it < 4; it++) {
    // neighbours ~R/12 apart are plenty for a PCA over radius R
    sc = scatterAt(decimate(s, Math.floor(R / 12 / h)), R)
    const next = Math.min(diag / 4, Math.max(4 * h, 2.5 * sc + 3 * h))
    if (Math.abs(next - R) < 0.05 * R) break
    R = next
  }
  return Math.min(diag / 4, Math.max(SIGMA_MIN, 1.25 * sc))
}

// --- 3. Clusters ----------------------------------------------------------------------

/** Groups of stroke indices whose ink comes within `gap` of each other. */
const clusters = (s: Samples, strokes: number, gap: number): number[][] => {
  const parent = Array.from({ length: strokes }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  const hash = new Hash(s, gap)
  for (let i = 0; i < s.n; i++) {
    const a = s.stroke[i]!
    hash.near(s.x[i]!, s.y[i]!, gap, (j) => {
      const b = s.stroke[j]!
      if (b !== a) {
        const ra = find(a)
        const rb = find(b)
        if (ra !== rb) parent[ra] = rb
      }
    })
  }
  const groups = new Map<number, number[]>()
  for (let k = 0; k < strokes; k++) {
    const r = find(k)
    let g = groups.get(r)
    if (!g) groups.set(r, (g = []))
    g.push(k)
  }
  return [...groups.values()]
}

// --- 4. Density -------------------------------------------------------------------------

interface Grid {
  W: number
  H: number
  x0: number
  y0: number
  c: number
  d: Float32Array
}

const densityGrid = (s: Samples, sigma: number): Grid => {
  const b = bounds(s)
  const c = Math.min(6, Math.max(0.75, sigma / 3))
  const pad = 3 * sigma + 2 * c
  const x0 = b.x0 - pad
  const y0 = b.y0 - pad
  const W = Math.ceil((b.x1 - b.x0 + 2 * pad) / c) + 1
  const H = Math.ceil((b.y1 - b.y0 + 2 * pad) / c) + 1
  const raw = new Float32Array(W * H)
  for (let i = 0; i < s.n; i++) {
    const gx = (s.x[i]! - x0) / c
    const gy = (s.y[i]! - y0) / c
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    const fx = gx - ix
    const fy = gy - iy
    const w = s.w[i]!
    const o = iy * W + ix
    raw[o] = raw[o]! + w * (1 - fx) * (1 - fy)
    raw[o + 1] = raw[o + 1]! + w * fx * (1 - fy)
    raw[o + W] = raw[o + W]! + w * (1 - fx) * fy
    raw[o + W + 1] = raw[o + W + 1]! + w * fx * fy
  }
  // separable Gaussian
  const sg = sigma / c
  const rad = Math.ceil(3 * sg)
  const k = new Float32Array(2 * rad + 1)
  let ks = 0
  for (let i = -rad; i <= rad; i++) ks += k[i + rad] = Math.exp((-i * i) / (2 * sg * sg))
  for (let i = 0; i < k.length; i++) k[i] = k[i]! / ks
  const tmp = new Float32Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = raw[y * W + x]!
      if (v === 0) continue
      for (let i = -rad; i <= rad; i++) {
        const xx = x + i
        if (xx >= 0 && xx < W) tmp[y * W + xx] = tmp[y * W + xx]! + v * k[i + rad]!
      }
    }
  const d = new Float32Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = tmp[y * W + x]!
      if (v === 0) continue
      for (let i = -rad; i <= rad; i++) {
        const yy = y + i
        if (yy >= 0 && yy < H) d[yy * W + x] = d[yy * W + x]! + v * k[i + rad]!
      }
    }
  return { W, H, x0, y0, c, d }
}

const sampleGrid = (g: Grid, x: number, y: number): number => {
  const gx = Math.round((x - g.x0) / g.c)
  const gy = Math.round((y - g.y0) / g.c)
  return gx < 0 || gy < 0 || gx >= g.W || gy >= g.H ? 0 : g.d[gy * g.W + gx]!
}

// --- 5. Skeleton --------------------------------------------------------------------------

// neighbour offsets P2..P9 clockwise from north (Zhang–Suen's numbering)
const NX = [0, 1, 1, 1, 0, -1, -1, -1]
const NY = [-1, -1, 0, 1, 1, 1, 0, -1]

const zhangSuen = (m: Uint8Array, W: number, H: number) => {
  // only the pixels still set are visited, without allocating per pixel
  let live: number[] = []
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (m[y * W + x]) live.push(y * W + x)
  const off = NX.map((dx, i) => NY[i]! * W + dx)
  const p = new Uint8Array(8)
  const del: number[] = []
  let changed = true
  while (changed) {
    changed = false
    for (let step = 0; step < 2; step++) {
      del.length = 0
      for (const o of live) {
        if (!m[o]) continue
        let B = 0
        for (let i = 0; i < 8; i++) B += p[i] = m[o + off[i]!]!
        if (B < 2 || B > 6) continue
        let A = 0
        for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) & 7]) A++
        if (A !== 1) continue
        if (step === 0 ? p[0]! * p[2]! * p[4]! || p[2]! * p[4]! * p[6]! : p[0]! * p[2]! * p[6]! || p[0]! * p[4]! * p[6]!) continue
        del.push(o)
      }
      for (const o of del) m[o] = 0
      if (del.length) changed = true
    }
    live = live.filter((o) => m[o])
  }
}

/** Remove staircase pixels: those whose neighbours stay one 8-connected piece without them. */
const pruneStairs = (m: Uint8Array, W: number, H: number) => {
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const o = y * W + x
      if (!m[o]) continue
      const on: number[] = []
      for (let i = 0; i < 8; i++) if (m[o + NY[i]! * W + NX[i]!]) on.push(i)
      if (on.length < 2) continue
      // are the set neighbours mutually 8-connected (ignoring the centre)?
      const seen = new Set([on[0]!])
      const stack = [on[0]!]
      while (stack.length) {
        const a = stack.pop()!
        for (const b of on)
          if (!seen.has(b) && Math.max(Math.abs(NX[a]! - NX[b]!), Math.abs(NY[a]! - NY[b]!)) === 1) {
            seen.add(b)
            stack.push(b)
          }
      }
      if (seen.size === on.length) m[o] = 0
    }
}

// --- The skeleton as a graph ---------------------------------------------------------------

interface GNode {
  x: number
  y: number
  edges: Set<number>
}
interface GEdge {
  a: number
  b: number
  pts: Pt[]
}

class Graph {
  nodes = new Map<number, GNode>()
  edges = new Map<number, GEdge>()
  #id = 0
  addNode(x: number, y: number): number {
    const id = this.#id++
    this.nodes.set(id, { x, y, edges: new Set() })
    return id
  }
  addEdge(a: number, b: number, pts: Pt[]): number {
    const id = this.#id++
    this.edges.set(id, { a, b, pts })
    this.nodes.get(a)!.edges.add(id)
    this.nodes.get(b)!.edges.add(id)
    return id
  }
  removeEdge(e: number) {
    const E = this.edges.get(e)!
    this.nodes.get(E.a)?.edges.delete(e)
    this.nodes.get(E.b)?.edges.delete(e)
    this.edges.delete(e)
  }
  /** Ends at a node — a self-loop counts twice. */
  degree(n: number): number {
    let d = 0
    for (const e of this.nodes.get(n)!.edges) {
      const E = this.edges.get(e)!
      d += E.a === n && E.b === n ? 2 : 1
    }
    return d
  }
  /** An edge's points starting from node n. */
  from(e: number, n: number): Pt[] {
    const E = this.edges.get(e)!
    return E.a === n ? E.pts : [...E.pts].reverse()
  }
  /** Splice out every node with exactly two distinct edge ends (not a lone self-loop). */
  mergeThrough() {
    for (const [n, N] of this.nodes) {
      if (N.edges.size !== 2) continue
      const [e1, e2] = [...N.edges] as [number, number]
      const E1 = this.edges.get(e1)!
      const E2 = this.edges.get(e2)!
      if (E1.a === E1.b || E2.a === E2.b) continue
      const p1 = this.from(e1, n).reverse() // ... → n
      const p2 = this.from(e2, n) // n → ...
      const a = E1.a === n ? E1.b : E1.a
      const b = E2.a === n ? E2.b : E2.a
      this.removeEdge(e1)
      this.removeEdge(e2)
      this.nodes.delete(n)
      this.addEdge(a, b, [...p1, ...p2.slice(1)])
    }
  }
}

const traceSkeleton = (m: Uint8Array, g: Grid): Graph => {
  const { W, H } = g
  const P = (o: number): Pt => ({ x: g.x0 + (o % W) * g.c, y: g.y0 + Math.floor(o / W) * g.c })
  const nbrs = (o: number): number[] => {
    const r: number[] = []
    for (let i = 0; i < 8; i++) {
      const q = o + NY[i]! * W + NX[i]!
      if (m[q]) r.push(q)
    }
    return r
  }
  const deg = new Int8Array(W * H)
  for (let o = 0; o < W * H; o++) if (m[o]) deg[o] = nbrs(o).length
  const graph = new Graph()
  // junction/end pixels, clustered by 8-adjacency into nodes
  const nodeOf = new Int32Array(W * H).fill(-1)
  for (let o = 0; o < W * H; o++) {
    if (!m[o] || deg[o] === 2 || nodeOf[o]! >= 0) continue
    const members: number[] = []
    const stack = [o]
    nodeOf[o] = -2
    while (stack.length) {
      const q = stack.pop()!
      members.push(q)
      for (const r of nbrs(q))
        if (deg[r] !== 2 && nodeOf[r]! === -1) {
          nodeOf[r] = -2
          stack.push(r)
        }
    }
    let sx = 0
    let sy = 0
    for (const q of members) {
      const p = P(q)
      sx += p.x
      sy += p.y
    }
    const id = graph.addNode(sx / members.length, sy / members.length)
    for (const q of members) nodeOf[q] = id
  }
  const visited = new Uint8Array(W * H)
  const walk = (start: number, prev: number, from: number) => {
    const pts: Pt[] = [{ x: graph.nodes.get(from)!.x, y: graph.nodes.get(from)!.y }]
    let cur = start
    let back = prev
    for (;;) {
      visited[cur] = 1
      pts.push(P(cur))
      const next = nbrs(cur).filter((q) => q !== back && !(nodeOf[q]! === from && pts.length <= 2 && q !== back))
      const end = next.find((q) => nodeOf[q]! >= 0)
      if (end !== undefined) {
        const to = nodeOf[end]!
        pts.push({ x: graph.nodes.get(to)!.x, y: graph.nodes.get(to)!.y })
        graph.addEdge(from, to, pts)
        return
      }
      const go = next.find((q) => !visited[q])
      if (go === undefined) {
        // only touches its own start node right away: a nub, not an edge
        if (pts.length > 2) {
          const to = graph.addNode(pts[pts.length - 1]!.x, pts[pts.length - 1]!.y)
          graph.addEdge(from, to, pts)
        }
        return
      }
      back = cur
      cur = go
    }
  }
  for (let o = 0; o < W * H; o++) {
    if (nodeOf[o]! < 0) continue
    for (const r of nbrs(o)) if (deg[r] === 2 && nodeOf[r]! < 0 && !visited[r]) walk(r, o, nodeOf[o]!)
  }
  // pure cycles: no node anywhere on them
  for (let o = 0; o < W * H; o++) {
    if (!m[o] || visited[o] || nodeOf[o]! >= 0) continue
    const pts: Pt[] = []
    let cur = o
    let back = -1
    for (;;) {
      visited[cur] = 1
      pts.push(P(cur))
      const go = nbrs(cur).find((q) => q !== back && !visited[q])
      if (go === undefined) break
      back = cur
      cur = go
    }
    if (pts.length < 3) continue
    const n = graph.addNode(pts[0]!.x, pts[0]!.y)
    graph.addEdge(n, n, [...pts, pts[0]!])
  }
  return graph
}

// --- 5b. Cleaning the graph ------------------------------------------------------------------

const pathLen = strokeLength

/** Two paths between the same ends, mean-resampled into one. */
const averagePaths = (p: Pt[], q: Pt[]): Pt[] => {
  const n = Math.max(p.length, q.length, 4)
  const a = resampleN(p, n)
  const b = resampleN(q, n)
  return a.map((u, i) => ({ x: (u.x + b[i]!.x) / 2, y: (u.y + b[i]!.y) / 2 }))
}

const resampleN = (pts: readonly Pt[], n: number): Pt[] => {
  const L = pathLen(pts)
  if (L === 0) return Array.from({ length: n }, () => ({ ...pts[0]! }))
  const r = resample(pts, L / (n - 1))
  while (r.length < n) r.push({ ...pts[pts.length - 1]! })
  return r.slice(0, n)
}

const maxGap = (p: Pt[], q: Pt[]): number => {
  const n = 24
  const a = resampleN(p, n)
  const b = resampleN(q, n)
  let m = 0
  for (let i = 0; i < n; i++) m = Math.max(m, Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y))
  return m
}

const cleanGraph = (G: Graph, sigma: number) => {
  const spur = 2.5 * sigma
  for (let round = 0; round < 12; round++) {
    let changed = false
    G.mergeThrough()
    for (const [e, E] of [...G.edges]) {
      if (!G.edges.has(e)) continue
      const L = pathLen(E.pts)
      // tiny self-loops: holes in the density, not shapes
      if (E.a === E.b) {
        if (L < 4 * sigma) {
          G.removeEdge(e)
          changed = true
        }
        continue
      }
      const da = G.degree(E.a)
      const db = G.degree(E.b)
      // spurs: a short branch ending in nothing, off a junction
      if (L < spur && ((da === 1 && db >= 3) || (db === 1 && da >= 3))) {
        G.removeEdge(e)
        changed = true
      }
    }
    // bubbles: two edges between the same pair of nodes, close together → their mean
    const byPair = new Map<string, number[]>()
    for (const [e, E] of G.edges) {
      if (E.a === E.b) continue
      const key = E.a < E.b ? `${E.a}:${E.b}` : `${E.b}:${E.a}`
      let l = byPair.get(key)
      if (!l) byPair.set(key, (l = []))
      l.push(e)
    }
    for (const l of byPair.values()) {
      if (l.length < 2) continue
      const [e1, e2] = l as [number, number]
      const E1 = G.edges.get(e1)!
      const p = E1.pts
      const q = G.from(e2, E1.a)
      if (maxGap(p, q) > 4 * sigma) continue
      const avg = averagePaths(p, q)
      const { a, b } = E1
      G.removeEdge(e1)
      G.removeEdge(e2)
      G.addEdge(a, b, avg)
      changed = true
    }
    // drop isolated nodes left behind (unless they're all there is)
    for (const [n, N] of [...G.nodes]) if (N.edges.size === 0 && G.edges.size > 0) G.nodes.delete(n)
    if (!changed) break
  }
  G.mergeThrough()
}

// --- 6. Topology: continue straight through junctions ----------------------------------------

interface Chain {
  pts: Pt[]
  closed: boolean
  /** Whether each end stops at a junction (pinned) rather than in open space (free). */
  pinned: [boolean, boolean]
}

const chains = (G: Graph, sigma: number): Chain[] => {
  // an end = edge id + which side (0 = a, 1 = b)
  const endKey = (e: number, side: number) => e * 2 + side
  const partner = new Map<number, number>()
  const dirAt = (e: number, side: number): Pt => {
    const E = G.edges.get(e)!
    const pts = side === 0 ? E.pts : [...E.pts].reverse()
    const L = pathLen(pts)
    const want = Math.min(6 * sigma, L / 2)
    let acc = 0
    let q = pts[pts.length - 1]!
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
      if (acc >= want) {
        q = pts[i]!
        break
      }
    }
    const dx = q.x - pts[0]!.x
    const dy = q.y - pts[0]!.y
    const d = Math.hypot(dx, dy) || 1
    return { x: dx / d, y: dy / d }
  }
  for (const [n, N] of G.nodes) {
    const ends: { key: number; dir: Pt }[] = []
    for (const e of N.edges) {
      const E = G.edges.get(e)!
      if (E.a === n) ends.push({ key: endKey(e, 0), dir: dirAt(e, 0) })
      if (E.b === n) ends.push({ key: endKey(e, 1), dir: dirAt(e, 1) })
    }
    if (ends.length === 2) {
      partner.set(ends[0]!.key, ends[1]!.key)
      partner.set(ends[1]!.key, ends[0]!.key)
      continue
    }
    // greedy: the most nearly straight continuations first
    const pairs: { i: number; j: number; dot: number }[] = []
    for (let i = 0; i < ends.length; i++)
      for (let j = i + 1; j < ends.length; j++)
        pairs.push({ i, j, dot: ends[i]!.dir.x * ends[j]!.dir.x + ends[i]!.dir.y * ends[j]!.dir.y })
    pairs.sort((p, q) => p.dot - q.dot)
    const used = new Set<number>()
    for (const { i, j, dot } of pairs) {
      if (dot > -Math.cos((50 * Math.PI) / 180)) break
      if (used.has(i) || used.has(j)) continue
      used.add(i)
      used.add(j)
      partner.set(ends[i]!.key, ends[j]!.key)
      partner.set(ends[j]!.key, ends[i]!.key)
    }
  }
  const out: Chain[] = []
  const done = new Set<number>()
  const endNode = (e: number, side: number) => (side === 0 ? G.edges.get(e)!.a : G.edges.get(e)!.b)
  const pinnedAt = (n: number) => G.degree(n) >= 3
  const follow = (e0: number, side0: number): Chain => {
    // walk from end (e0, side0) through the edge and onward via partners
    const pts: Pt[] = []
    const first = pinnedAt(endNode(e0, side0))
    let e = e0
    let side = side0
    for (;;) {
      done.add(e)
      const E = G.edges.get(e)!
      const seg = side === 0 ? E.pts : [...E.pts].reverse()
      pts.push(...(pts.length ? seg.slice(1) : seg))
      const far = endKey(e, 1 - side)
      const p = partner.get(far)
      if (p === undefined) return { pts, closed: false, pinned: [first, pinnedAt(endNode(e, 1 - side))] }
      const ne = p >> 1
      if (ne === e0 && (p & 1) === side0) return { pts, closed: true, pinned: [false, false] }
      if (done.has(ne)) return { pts, closed: false, pinned: [first, true] }
      e = ne
      side = p & 1
    }
  }
  // open chains start at unpartnered ends
  for (const [e] of G.edges)
    for (const side of [0, 1]) {
      if (done.has(e) || partner.has(endKey(e, side))) continue
      out.push(follow(e, side))
    }
  // what is left is all cycles
  for (const [e] of G.edges) if (!done.has(e)) out.push(follow(e, 0))
  // a closed walk: drop the repeated start point
  for (const c of out)
    if (c.closed && c.pts.length > 1) {
      const f = c.pts[0]!
      const l = c.pts[c.pts.length - 1]!
      if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-6) c.pts.pop()
    }
  // lone nodes (a dot)
  if (G.edges.size === 0) for (const [, N] of G.nodes) out.push({ pts: [{ x: N.x, y: N.y }], closed: false, pinned: [false, false] })
  return out
}

/**
 * Bridge gaps: two free ends close together (< 5σ) and pointing at each
 * other become one chain — sparse stippling thins the density in places,
 * the line it means doesn't break there. A chain's own two ends meeting
 * close it into a loop.
 */
const joinEnds = (cs: Chain[], sigma: number): Chain[] => {
  const outward = (c: Chain, end: 0 | 1): { p: Pt; d: Pt } => {
    const pts = end === 0 ? c.pts : [...c.pts].reverse()
    const p = pts[0]!
    let q = pts[pts.length - 1]!
    let acc = 0
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
      if (acc >= 2 * sigma) {
        q = pts[i]!
        break
      }
    }
    const dx = p.x - q.x
    const dy = p.y - q.y
    const L = Math.hypot(dx, dy) || 1
    return { p, d: { x: dx / L, y: dy / L } }
  }
  const out = [...cs]
  for (let pass = 0; pass < 32; pass++) {
    let best: { i: number; ei: 0 | 1; j: number; ej: 0 | 1; cost: number } | undefined
    for (let i = 0; i < out.length; i++) {
      const a = out[i]!
      if (a.closed || a.pts.length < 2) continue
      for (const ei of [0, 1] as const) {
        if (a.pinned[ei]) continue
        const A = outward(a, ei)
        for (let j = i; j < out.length; j++) {
          const b = out[j]!
          if (b.closed || b.pts.length < 2) continue
          for (const ej of [0, 1] as const) {
            if (b.pinned[ej] || (i === j && ei >= ej)) continue
            const B = outward(b, ej)
            const gx = B.p.x - A.p.x
            const gy = B.p.y - A.p.y
            const gap = Math.hypot(gx, gy)
            if (gap > 5 * sigma) continue
            const g = { x: gx / (gap || 1), y: gy / (gap || 1) }
            // A heads towards B, B towards A, and they don't meet head-on sideways
            const ok = gap < sigma || (A.d.x * g.x + A.d.y * g.y > 0.5 && -(B.d.x * g.x + B.d.y * g.y) > 0.5)
            if (!ok || (i === j && pathLen(a.pts) < 6 * sigma)) continue
            if (!best || gap < best.cost) best = { i, ei, j, ej, cost: gap }
          }
        }
      }
    }
    if (!best) break
    const { i, ei, j, ej } = best
    const a = out[i]!
    if (i === j) {
      out[i] = { pts: a.pts, closed: true, pinned: [false, false] }
      continue
    }
    const b = out[j]!
    // a's joined end last, b's joined end first
    const ap = ei === 1 ? a.pts : [...a.pts].reverse()
    const bp = ej === 0 ? b.pts : [...b.pts].reverse()
    const joined: Chain = { pts: [...ap, ...bp], closed: false, pinned: [a.pinned[1 - ei]!, b.pinned[1 - ej]!] }
    out.splice(j, 1)
    out[i] = joined
  }
  return out
}

// --- 7. Principal curve ------------------------------------------------------------------------

const tangentAt = (pts: Pt[], i: number, closed: boolean): Pt => {
  const n = pts.length
  const a = closed ? pts[(i - 1 + n) % n]! : pts[Math.max(0, i - 1)]!
  const b = closed ? pts[(i + 1) % n]! : pts[Math.min(n - 1, i + 1)]!
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1
  return { x: dx / d, y: dy / d }
}

const refine = (c: Chain, hash: Hash, sigma: number): Chain => {
  const s = hash.s
  const step = Math.max(1, sigma / 2)
  let pts = c.closed ? resample(c.pts, step, true) : resample(c.pts, step)
  // A skeleton's free end curls into a corner of the blob it thinned: trim
  // ~2σ off each free end; the extension below grows it back, straight.
  if (!c.closed && pts.length * step > 8 * sigma) {
    const cut = Math.round((2 * sigma) / step)
    pts = pts.slice(c.pinned[0] ? 0 : cut, c.pinned[1] ? pts.length : pts.length - cut)
  }
  if (pts.length < 3) return { ...c, pts }
  const r = 3 * sigma
  const s2 = 2 * sigma * sigma
  const fixedEnd = (i: number) => !c.closed && ((i === 0 && c.pinned[0]) || (i === pts.length - 1 && c.pinned[1]))
  const pull = () => {
    const next = pts.map((p, i) => {
      if (fixedEnd(i)) return p
      const t = tangentAt(pts, i, c.closed)
      let W = 0
      let off = 0
      hash.near(p.x, p.y, r, (j) => {
        const dx = s.x[j]! - p.x
        const dy = s.y[j]! - p.y
        const along = dx * t.x + dy * t.y
        const across = -dx * t.y + dy * t.x
        const w = s.w[j]! * Math.exp(-(along * along) / (s2 * 2.25)) * Math.exp(-(across * across) / s2)
        W += w
        off += w * across
      })
      if (W === 0) return p
      off /= W
      return { x: p.x - t.y * off * 0.8, y: p.y + t.x * off * 0.8 }
    })
    pts = next
  }
  const smooth = (lambda: number) => {
    const n = pts.length
    pts = pts.map((p, i) => {
      if (!c.closed && (i === 0 || i === n - 1)) return p
      const a = pts[(i - 1 + n) % n]!
      const b = pts[(i + 1) % n]!
      return { x: p.x + lambda * ((a.x + b.x) / 2 - p.x), y: p.y + lambda * ((a.y + b.y) / 2 - p.y) }
    })
  }
  for (let it = 0; it < 10; it++) {
    pull()
    smooth(0.35)
    if (it % 3 === 2) pts = c.closed ? resample(pts, step, true) : resample(pts, step)
  }
  // free ends: extend out along the tangent to where the ink really stops
  if (!c.closed) {
    for (const end of [0, 1] as const) {
      if (c.pinned[end]) continue
      const i = end === 0 ? 0 : pts.length - 1
      const p = pts[i]!
      const back = Math.max(3, Math.round((2 * sigma) / step))
      const q = pts[end === 0 ? Math.min(pts.length - 1, back) : Math.max(0, pts.length - 1 - back)]!
      const dx = p.x - q.x
      const dy = p.y - q.y
      const d = Math.hypot(dx, dy) || 1
      const t = { x: dx / d, y: dy / d }
      const ahead: number[] = []
      hash.near(p.x, p.y, 4 * sigma, (j) => {
        const ex = s.x[j]! - p.x
        const ey = s.y[j]! - p.y
        const along = ex * t.x + ey * t.y
        if (along > 0 && Math.abs(-ex * t.y + ey * t.x) < sigma) ahead.push(along)
      })
      if (ahead.length < 2) continue
      ahead.sort((a, b) => a - b)
      const ext = ahead[Math.floor(ahead.length * 0.97)]!
      if (ext < step * 0.5) continue
      const tip = { x: p.x + t.x * ext, y: p.y + t.y * ext }
      if (end === 0) pts = [...resample([tip, p], step).slice(0, -1), ...pts]
      else pts = [...pts, ...resample([p, tip], step).slice(1)]
    }
    for (let it = 0; it < 3; it++) {
      pull()
      smooth(0.3)
    }
  }
  return { ...c, pts: gaussSmooth(resample(pts, step, c.closed), 1.5, c.closed) }
}

/**
 * Gaussian smoothing along the curve (std in vertices) — the calm of a
 * careful hand. Open curves narrow the window towards their ends, so the
 * ends stay where the ink ends.
 */
const gaussSmooth = (pts: Pt[], std: number, closed: boolean): Pt[] => {
  const n = pts.length
  if (n < 4) return pts
  const R = Math.ceil(2.5 * std)
  return pts.map((p, i) => {
    const reach = closed ? R : Math.min(R, i, n - 1 - i)
    if (reach === 0) return p
    let W = 0
    let x = 0
    let y = 0
    for (let k = -reach; k <= reach; k++) {
      const q = pts[closed ? (((i + k) % n) + n) % n : i + k]!
      const w = Math.exp((-k * k) / (2 * std * std))
      W += w
      x += w * q.x
      y += w * q.y
    }
    return { x: x / W, y: y / W }
  })
}

/**
 * Strokes that end at a junction end ON the stroke they meet: each pinned
 * end slides onto the nearest point of another refined chain (within 3σ),
 * the last few vertices easing along with it.
 */
const snapJunctions = (cs: Chain[], sigma: number) => {
  for (const c of cs) {
    if (c.closed || c.pts.length < 2) continue
    for (const end of [0, 1] as const) {
      if (!c.pinned[end]) continue
      const i0 = end === 0 ? 0 : c.pts.length - 1
      const p = c.pts[i0]!
      let best: Pt | undefined
      let bd = 3 * sigma
      for (const o of cs) {
        if (o === c) continue
        for (const q of o.pts) {
          const d = Math.hypot(q.x - p.x, q.y - p.y)
          if (d < bd) {
            bd = d
            best = q
          }
        }
      }
      if (!best) continue
      const dx = best.x - p.x
      const dy = best.y - p.y
      const k = Math.min(6, c.pts.length - 1)
      for (let j = 0; j <= k; j++) {
        const i = end === 0 ? j : c.pts.length - 1 - j
        const f = 1 - j / (k + 1)
        c.pts[i] = { x: c.pts[i]!.x + dx * f, y: c.pts[i]!.y + dy * f }
      }
    }
  }
}

// --- 8. Output -----------------------------------------------------------------------------------

const rdp = (pts: Pt[], eps: number): Pt[] => {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [i, j] = stack.pop()!
    const a = pts[i]!
    const b = pts[j]!
    const vx = b.x - a.x
    const vy = b.y - a.y
    const L = Math.hypot(vx, vy) || 1
    let best = -1
    let bd = eps
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((pts[k]!.x - a.x) * vy - (pts[k]!.y - a.y) * vx) / L
      if (d > bd) {
        bd = d
        best = k
      }
    }
    if (best >= 0) {
      keep[best] = 1
      stack.push([i, best], [best, j])
    }
  }
  return pts.filter((_, i) => keep[i])
}

/** RDP on a loop: split at the point farthest from the start, simplify both halves. */
const rdpClosed = (pts: Pt[], eps: number): Pt[] => {
  if (pts.length < 4) return pts
  let far = 1
  let fd = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i]!.x - pts[0]!.x, pts[i]!.y - pts[0]!.y)
    if (d > fd) {
      fd = d
      far = i
    }
  }
  const a = rdp(pts.slice(0, far + 1), eps)
  const b = rdp([...pts.slice(far), pts[0]!], eps)
  return [...a, ...b.slice(1, -1)]
}

/** Centripetal-ish Catmull-Rom through the points, resampled at `step`. */
const catmullRom = (pts: Pt[], step: number, closed: boolean): Pt[] => {
  const n = pts.length
  if (n < 3) return resample(pts, step)
  const P = (i: number) => (closed ? pts[((i % n) + n) % n]! : pts[Math.min(n - 1, Math.max(0, i))]!)
  const dense: Pt[] = []
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1)
    const p1 = P(i)
    const p2 = P(i + 1)
    const p3 = P(i + 2)
    const m = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / (step / 2)))
    for (let k = 0; k < m; k++) {
      const t = k / m
      const t2 = t * t
      const t3 = t2 * t
      dense.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  if (!closed) dense.push(P(n - 1))
  return closed ? resample(dense, step, true) : resample(dense, step)
}

// --- The whole reduction ------------------------------------------------------------------------

const distillCluster = (s: Samples, sigma: number, trace?: (line: string) => void): DistilledPath[] => {
  const b = bounds(s)
  const t0 = performance.now()
  const lap = (what: string) => trace?.(`  ${what} ${(performance.now() - t0).toFixed(1)} ms`)
  if (b.diag < 2 * sigma) {
    // all of it within a pen-and-a-bit: a dot at the centre of gravity
    let W = 0
    let x = 0
    let y = 0
    for (let i = 0; i < s.n; i++) {
      W += s.w[i]!
      x += s.w[i]! * s.x[i]!
      y += s.w[i]! * s.y[i]!
    }
    return [{ points: [{ x: x / W, y: y / W }], closed: false }]
  }
  const g = densityGrid(s, sigma)
  const at: number[] = []
  for (let i = 0; i < s.n; i++) at.push(sampleGrid(g, s.x[i]!, s.y[i]!))
  at.sort((a, c) => a - c)
  const tau = 0.3 * at[at.length >> 1]!
  const m = new Uint8Array(g.W * g.H)
  for (let y = 1; y < g.H - 1; y++) for (let x = 1; x < g.W - 1; x++) if (g.d[y * g.W + x]! > tau) m[y * g.W + x] = 1
  zhangSuen(m, g.W, g.H)
  pruneStairs(m, g.W, g.H)
  lap(`density+skeleton (${g.W}×${g.H}, c ${g.c.toFixed(2)})`)
  const G = traceSkeleton(m, g)
  cleanGraph(G, sigma)
  lap(`graph (${G.nodes.size} nodes, ${G.edges.size} edges)`)
  const hash = new Hash(s, 2.5 * sigma)
  const out: DistilledPath[] = []
  const cs = chains(G, sigma)
  trace?.(`  chains: ${cs.map((c) => `${c.closed ? "○" : "—"}${c.pts.length}${c.pinned.map((p) => (p ? "▪" : "·")).join("")}`).join(" ")}`)
  const refined = joinEnds(cs, sigma).map((c) => (c.pts.length === 1 ? c : refine(c, hash, sigma)))
  snapJunctions(refined, sigma)
  for (const r of refined) {
    if (r.pts.length === 1) {
      out.push({ points: r.pts, closed: false })
      continue
    }
    const simple = r.closed ? rdpClosed(r.pts, 0.04 * sigma) : rdp(r.pts, 0.04 * sigma)
    const pts = catmullRom(simple, OUT_STEP, r.closed)
    out.push({ points: pts, closed: r.closed })
  }
  lap(`curves (${out.length})`)
  return out
}

/** The geometry alone: rough strokes (page units) → the clean curves they mean. */
export const distillPaths = (strokes: readonly (readonly Pt[])[], opts: DistillOptions = {}): DistilledPath[] => {
  const live = strokes.filter((k) => k.length > 0)
  if (live.length === 0) return []
  const t0 = performance.now()
  const lap = (what: string) => opts.trace?.(`${what} ${(performance.now() - t0).toFixed(1)} ms`)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const k of live)
    for (const p of k) {
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    }
  const h = Math.max(0.75, Math.hypot(x1 - x0, y1 - y0) / 600)
  const s = sampleStrokes(live, h)
  lap(`${s.n} samples, h ${h.toFixed(2)}`)
  const sigma0 = opts.sigma ?? estimateSigma(s, h)
  lap(`σ ${sigma0.toFixed(2)}`)
  const gap = Math.max(5, 1.5 * sigma0)
  const groups = live.length === 1 ? [[0]] : clusters(decimate(s, Math.floor(gap / 4 / h)), live.length, gap)
  lap(`${groups.length} clusters`)
  const out: DistilledPath[] = []
  for (const group of groups) {
    const mine = new Set(group)
    const cs = group.length === live.length ? s : subset(s, (i) => mine.has(s.stroke[i]!))
    const sigma = opts.sigma ?? (group.length === live.length ? sigma0 : estimateSigma(cs, h))
    opts.trace?.(`cluster of ${group.length} strokes, ${cs.n} samples, σ ${sigma.toFixed(2)}`)
    // samples σ/4 apart carry all the shape a σ blur can see
    out.push(...distillCluster(decimate(cs, Math.floor(sigma / 4 / h)), sigma, opts.trace))
  }
  return out
}

/**
 * Strokes → their distillation as InkStrokes: uniform pressure (the input's
 * median), timestamps continuing from the first input sample. Closed curves
 * repeat their first point at the end so they draw closed.
 */
export const distillStrokes = (
  strokes: readonly InkStroke[],
  makeId: () => string,
  opts: DistillOptions = {},
): InkStroke[] => {
  const pressures = strokes.flatMap((k) => k.points.map((p) => p.pressure)).filter((p) => p > 0).sort((a, b) => a - b)
  const pressure = pressures.length ? pressures[pressures.length >> 1]! : 0.5
  let t = Date.now()
  for (const k of strokes) for (const p of k.points) if (Number.isFinite(p.t) && p.t < t) t = p.t
  return distillPaths(
    strokes.map((k) => k.points),
    opts,
  ).map((path) => {
    const pts = path.closed ? [...path.points, path.points[0]!] : path.points
    const points: PenSample[] = pts.map((p) => ({ x: round(p.x), y: round(p.y), pressure, t: (t += 8) }))
    return { id: makeId(), points }
  })
}

const round = (v: number) => Math.round(v * 100) / 100

/**
 * The distill chip's glyph, in the chip's own units: three loose searching
 * passes (faint) and the one line they mean (bold). The Mac's canvas and the
 * tablet's display list draw the same polylines.
 */
export const distillGlyph = (c: Pt, r: number): { faint: Pt[][]; bold: Pt[] } => {
  const wave = (dy: number, amp: number, tilt: number): Pt[] =>
    Array.from({ length: 13 }, (_, i) => {
      const u = i / 12
      const x = c.x + (u - 0.5) * 1.15 * r
      return { x, y: c.y + dy + tilt * (u - 0.5) * r - amp * r * Math.sin(u * Math.PI * 2) }
    })
  return {
    faint: [wave(-0.3 * r, 0.16, 0.12), wave(0.3 * r, 0.2, -0.1), wave(-0.08 * r, 0.24, -0.18)],
    bold: wave(0, 0.18, 0),
  }
}
