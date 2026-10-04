/**
 * fit.ts — a reading of a scribble, tuned until the symbol lies ON the ink.
 *
 * The recognizer (scripts/recognize.ts) says WHAT was drawn and roughly
 * where; its numbers are eyeballed. This closes the loop with geometry:
 * build the symbol, flatten it to the polylines the page draws
 * (mirror.ts flattenSymbol — pure, no GPU), measure how far it lies from
 * the ink, nudge its params, repeat. A few hundred evaluations, tens of
 * milliseconds.
 *
 *   SCORE      symmetric chamfer distance between the ink and the symbol,
 *              both resampled at one arc-length step: the mean distance
 *              from every ink sample to the symbol's outline (is all
 *              the ink explained?) and from every symbol sample to the
 *              nearest ink (did the symbol add anything not drawn?) —
 *              each truncated, so a stray label costs a bounded amount —
 *              averaged and divided by the ink's bbox diagonal, so a score
 *              reads the same for a thumbnail and a poster. 0 = exact;
 *              a careful hand-drawn circle scores ~0.01.
 *   OPTIMISER  Nelder–Mead, finished by a compass search, over the
 *              entry's continuous params, each scaled by its ROLE
 *              (vocabulary.ts ParamRole: positions by the ink's size,
 *              lengths by their own size, angles by a fraction of a
 *              radian) — coarse to fine through the POSE SHORTCUT below.
 *   WITHOUT A MODEL  `raceVocabulary` tries every imported symbol from a
 *              cheap start (its bbox scaled and centred on the ink's,
 *              angles scanned coarsely) and keeps the lowest score —
 *              near-instant for circles, squares, triangles, flowers;
 *              `instantReading` says when that answer is clear enough to
 *              skip the model.
 *
 * Shape params the optimiser cannot see stay as given: point paths (the
 * MindVirus cable), strings, enums (the race tries each enum option as its
 * own hypothesis).
 *
 * Pure: the tests and the bench call the same functions.
 */

import { flattenSymbol } from "./mirror"
import { PAGE_H, PAGE_W, type Candidate, type InkStroke, type RecognizeResponse } from "./protocol"
import { vocabById, type ParamSpec, type VocabEntry } from "./vocabulary"

export interface Pt {
  x: number
  y: number
}

// --- Geometry ---------------------------------------------------------------------

/**
 * The cylinder's wireframe is view-dependent — the host computes its
 * silhouette per frame (vocabulary/Cylinder), so flattenSymbol has nothing
 * to walk. Its outline in the page, straight on (perspective ignored):
 * two cap ellipses (long axis = radius, short = radius·sin p) a projected
 * height·cos p apart along the axis, leaning by the page angle b, and the
 * two sides joining their ends.
 */
const cylinderOutline = (p: Record<string, unknown>): Pt[][] => {
  const n = (k: string, d: number) => (Number.isFinite(Number(p[k])) ? Number(p[k]) : d)
  const cx = n("cx", 0), cy = n("cy", 0)
  const R = Math.max(1, n("radius", 60))
  const H = Math.max(1, n("height", 160))
  const pitch = n("p", 0.4), b = n("b", 0)
  const u = { x: Math.sin(b), y: -Math.cos(b) } // the axis, upward on the page
  const v = { x: Math.cos(b), y: Math.sin(b) } // the caps' long axis
  const half = (H / 2) * Math.cos(pitch)
  const minor = R * Math.sin(pitch)
  const cap = (s: number): Pt[] => {
    const c = { x: cx + u.x * half * s, y: cy + u.y * half * s }
    const out: Pt[] = []
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2
      out.push({ x: c.x + v.x * R * Math.cos(t) + u.x * minor * Math.sin(t), y: c.y + v.y * R * Math.cos(t) + u.y * minor * Math.sin(t) })
    }
    return out
  }
  const side = (k: number): Pt[] => [
    { x: cx + u.x * half + v.x * R * k, y: cy + u.y * half + v.y * R * k },
    { x: cx - u.x * half + v.x * R * k, y: cy - u.y * half + v.y * R * k },
  ]
  return [cap(1), cap(-1), side(1), side(-1)]
}

/**
 * A symbol as the polylines a person would draw for it, in page units:
 * every line the page draws, and the rim of every DARK fill (a black disk
 * is drawn as its outline). White fills are knock-outs, not ink.
 */
export const symbolOutline = (symbol: string, params: Record<string, unknown>): Pt[][] => {
  if (symbol === "cylinder") return cylinderOutline(params)
  const out: Pt[][] = []
  for (const prim of flattenSymbol({ symbol, params })) {
    if (prim.k === "fill" && prim.grey > 128) continue
    const pts: Pt[] = []
    for (let i = 0; i + 1 < prim.pts.length; i += 2) pts.push({ x: prim.pts[i]!, y: prim.pts[i + 1]! })
    if (prim.k === "fill" && pts.length > 2) pts.push(pts[0]!)
    if (pts.length >= 2) out.push(pts)
  }
  return out
}

/**
 * THE POSE SHORTCUT. Most symbols are the same drawing wherever they sit:
 * moving, turning and scaling them moves, turns and scales their outline.
 * So the outline is flattened ONCE per shape (everything but the pose) at
 * an ANCHOR pose — near where the symbol is, angle 0 — and every nearby
 * pose is a 2D similarity of it: microseconds instead of a holon build (a
 * Regenaissance flattens in ~6 ms). Whether that holds is MEASURED, not
 * assumed: a new template is checked against two real flattenings a fit's
 * step away. Flat symbols pass exactly; a 3D one seen in perspective (a
 * cube, a MindVirus) passes approximately — its view changes a little as
 * it moves, so the anchor is binned to where it is (ANCHOR_STEP) — and an
 * absolute cable path fails and takes the exact path.
 */
interface PoseKeys {
  x: string
  y: string
  len: string
  angle?: string
}

/** Anchors are binned to this many page units, and sizes to powers of this ratio. */
const ANCHOR_STEP = 40
const ANCHOR_RATIO = 1.25

const poseKeys = (entry: VocabEntry): PoseKeys | undefined => {
  const of = (role: string) => Object.keys(entry.params).filter((k) => entry.params[k]!.role === role)
  const [x] = of("x"), [y] = of("y"), lens = of("length"), angles = of("angle")
  if (!x || !y || lens.length !== 1 || angles.length > 1) return undefined
  return { x, y, len: lens[0]!, angle: angles[0] }
}

/**
 * Template per symbol + shape: its canonical outline and how far the
 * shortcut can be trusted — "exact" (it IS the flattening, to 0.4 %),
 * "approx" (within 4 %: a perspective cube; good enough to steer by, and
 * the fit polishes on the real thing), or "none".
 */
interface Template {
  tpl: Pt[][]
  /** The pose it was flattened at. */
  at: { x: number; y: number; len: number }
  verdict: "exact" | "approx" | "none"
}
const templates = new Map<string, Template>()
/** The check's verdict per symbol + shape: measured once, wherever the shape first appeared. */
const verdicts = new Map<string, Template["verdict"]>()
/** The gap (relative to size) below which the shortcut still steers well. */
const APPROX = 0.06

const posed = (t: Pick<Template, "tpl" | "at">, x: number, y: number, len: number, angle: number): Pt[][] => {
  const s = len / t.at.len, c = Math.cos(angle) * s, n = Math.sin(angle) * s
  return t.tpl.map((pts) =>
    pts.map((q) => {
      const dx = q.x - t.at.x, dy = q.y - t.at.y
      return { x: x + dx * c - dy * n, y: y + dx * n + dy * c }
    }),
  )
}

/** Vertices a template keeps: posing it is then cheap whatever the symbol's detail. */
const TEMPLATE_POINTS = 2 * 180

/** An outline resampled to about TEMPLATE_POINTS vertices in all — each
 *  polyline keeps its ends, so nothing short vanishes. */
const lighten = (polys: readonly (readonly Pt[])[]): Pt[][] => {
  const step = polysLength(polys) / TEMPLATE_POINTS
  if (!(step > 0)) return polys.map((p) => p.slice())
  return polys.map((pts) => {
    const flat = sampleAlong([pts], step)
    const out: Pt[] = []
    for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i]!, y: flat[i + 1]! })
    const last = pts[pts.length - 1]!
    const end = out[out.length - 1]
    if (!end || end.x !== last.x || end.y !== last.y) out.push({ ...last })
    return out
  })
}

/** How far apart two outlines are as drawings — the Hausdorff distance from
 *  each one's vertices to the other's segments — whatever order or start
 *  point their polylines have. */
const outlineGap = (a: readonly (readonly Pt[])[], b: readonly (readonly Pt[])[]): number => {
  const toSegs = (P: readonly (readonly Pt[])[], q: Pt): number => {
    let m = Infinity
    for (const pts of P) {
      if (pts.length === 1) m = Math.min(m, (q.x - pts[0]!.x) ** 2 + (q.y - pts[0]!.y) ** 2)
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!, b = pts[i]!
        const dx = b.x - a.x, dy = b.y - a.y
        const L2 = dx * dx + dy * dy
        const u = L2 > 0 ? Math.min(1, Math.max(0, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L2)) : 0
        m = Math.min(m, (q.x - a.x - u * dx) ** 2 + (q.y - a.y - u * dy) ** 2)
      }
    }
    return m
  }
  const dir = (P: readonly (readonly Pt[])[], Q: readonly (readonly Pt[])[]) => {
    const all = P.flat()
    const every = Math.max(1, Math.floor(all.length / 300)) // a check, not a census
    let g = 0
    for (let i = 0; i < all.length; i += every) g = Math.max(g, toSegs(Q, all[i]!))
    return Math.sqrt(g)
  }
  if (a.length === 0 || b.length === 0) return a.length === b.length ? 0 : Infinity
  return Math.max(dir(a, b), dir(b, a))
}

/** Exposed for the tests and the bench: how the shortcut judged a shape. */
export const shortcutVerdict = (symbol: string, params: Record<string, unknown>): Template["verdict"] =>
  templateFor(symbol, params)?.t.verdict ?? "none"

const templateFor = (
  symbol: string,
  params: Record<string, unknown>,
  check = true,
): { t: Template; keys: PoseKeys } | undefined => {
  const entry = vocabById(symbol)
  const keys = entry && symbol !== "cylinder" ? poseKeys(entry) : undefined
  if (!keys) return undefined
  const num = (k: string, d: number) => (Number.isFinite(Number(params[k])) ? Number(params[k]) : d)
  const shape: Record<string, unknown> = { ...params }
  for (const k of [keys.x, keys.y, keys.len, keys.angle]) if (k) delete shape[k]
  const at = {
    x: Math.round(num(keys.x, PAGE_W / 2) / ANCHOR_STEP) * ANCHOR_STEP,
    y: Math.round(num(keys.y, PAGE_H / 2) / ANCHOR_STEP) * ANCHOR_STEP,
    len: ANCHOR_RATIO ** Math.round(Math.log(Math.max(1, num(keys.len, 100))) / Math.log(ANCHOR_RATIO)),
  }
  // A shape that passed exactly is the same drawing anywhere: one template.
  const shapeKey = `${symbol} ${JSON.stringify(shape)}`
  const verdict = verdicts.get(shapeKey)
  const key = verdict === "exact" ? shapeKey : `${shapeKey} @${at.x},${at.y},${at.len.toFixed(2)}`
  let t = templates.get(key)
  if (!t && verdict && (check || verdict === "exact")) {
    const canon = { ...shape, [keys.x]: at.x, [keys.y]: at.y, [keys.len]: at.len, ...(keys.angle ? { [keys.angle]: 0 } : {}) }
    t = { tpl: lighten(symbolOutline(symbol, canon)), at, verdict }
    if (templates.size > 512) templates.clear()
    templates.set(key, t)
  }
  if (!t && !check) return undefined
  if (!t) {
    const canon = (x: number, y: number, len: number, a: number) => ({ ...shape, [keys.x]: x, [keys.y]: y, [keys.len]: len, ...(keys.angle ? { [keys.angle]: a } : {}) })
    const tpl = symbolOutline(symbol, canon(at.x, at.y, at.len, 0))
    // The check: two poses a fit's step away, the gap relative to size.
    let gap = 0
    for (const [dx, dy, k, a] of [
      [ANCHOR_STEP, -ANCHOR_STEP, 1.3, 0.7],
      [-ANCHOR_STEP, ANCHOR_STEP, 1 / 1.3, -2.3],
    ] as const) {
      const x = at.x + dx, y = at.y + dy, len = at.len * k, angle = keys.angle ? a : 0
      gap = Math.max(gap, outlineGap(posed({ tpl, at }, x, y, len, angle), symbolOutline(symbol, canon(x, y, len, angle))) / len)
    }
    if (process.env.FIT_DEBUG) console.log(`[fit] shortcut ${key}: gap ${(gap * 100).toFixed(2)} %`)
    t = { tpl: lighten(tpl), at, verdict: gap <= 0.004 ? "exact" : gap <= APPROX ? "approx" : "none" }
    if (templates.size > 512) templates.clear()
    templates.set(t.verdict === "exact" ? shapeKey : key, t)
    if (verdicts.size > 512) verdicts.clear()
    verdicts.set(shapeKey, t.verdict)
  }
  return { t, keys }
}

/**
 * symbolOutline through the pose shortcut where it holds — exactly, or
 * with `approx` also approximately (the fit's steering phase).
 */
export const fastOutline = (symbol: string, params: Record<string, unknown>, approx = false): Pt[][] => {
  // Exact answers never pay for a check: they use a shape already judged exact, or flatten.
  const hit = templateFor(symbol, params, approx)
  if (!hit || hit.t.verdict === "none" || (hit.t.verdict === "approx" && !approx)) return symbolOutline(symbol, params)
  const { keys } = hit
  const num = (k: string | undefined, d: number) => (k !== undefined && Number.isFinite(Number(params[k])) ? Number(params[k]) : d)
  return posed(hit.t, num(keys.x, 0), num(keys.y, 0), num(keys.len, hit.t.at.len), num(keys.angle, 0))
}

/** Polylines → samples every `step` along each (ends kept), flat [x0, y0, x1, y1, …];
 *  `starts` collects the index of each polyline's first sample. */
export const sampleAlong = (polys: readonly (readonly Pt[])[], step: number, starts?: number[]): Float64Array => {
  const out: number[] = []
  for (const pts of polys) {
    if (pts.length === 0) continue
    starts?.push(out.length >> 1)
    out.push(pts[0]!.x, pts[0]!.y)
    let carry = 0
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!
      const L = Math.hypot(b.x - a.x, b.y - a.y)
      let s = step - carry
      while (s <= L) {
        const u = s / L
        out.push(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u)
        s += step
      }
      carry = L - (s - step)
    }
    const last = pts[pts.length - 1]!
    if (carry > step * 0.25) out.push(last.x, last.y)
  }
  return Float64Array.from(out)
}

const polysLength = (polys: readonly (readonly Pt[])[]): number => {
  let L = 0
  for (const pts of polys) for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
  return L
}

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const boxOf = (polys: readonly (readonly Pt[])[]): Box | undefined => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const pts of polys)
    for (const p of pts) {
      if (p.x < x0) x0 = p.x
      if (p.y < y0) y0 = p.y
      if (p.x > x1) x1 = p.x
      if (p.y > y1) y1 = p.y
    }
  return x0 <= x1 ? { x0, y0, x1, y1 } : undefined
}

// --- The ink, prepared once --------------------------------------------------------

/** Samples per side the chamfer works with — the cost is their product. */
const INK_SAMPLES = 140
const SYMBOL_SAMPLES = 180
/** Distances beyond this fraction of the ink's diagonal all cost the same. */
const TRUNCATE = 0.35

export interface Ink {
  samples: Float64Array
  box: Box
  /** The bbox diagonal: the unit every score is stated in. */
  diag: number
  /** The arc-length step both sides are sampled at. */
  step: number
}

export const prepareInk = (strokes: readonly InkStroke[]): Ink | undefined => {
  const polys = strokes.map((s) => s.points.map((p) => ({ x: p.x, y: p.y }))).filter((p) => p.length > 0)
  const box = boxOf(polys)
  if (!box) return undefined
  const diag = Math.max(1, Math.hypot(box.x1 - box.x0, box.y1 - box.y0))
  const step = Math.max(diag / 400, polysLength(polys) / INK_SAMPLES)
  return { samples: sampleAlong(polys, step), box, diag, step }
}

export interface Score {
  /** The objective: (inkToSymbol + symbolToInk) / 2 + regularisers. */
  total: number
  /** Mean truncated distance ink → symbol, in diagonals: is the ink explained? */
  inkToSymbol: number
  /** Mean truncated distance symbol → ink, in diagonals: did the symbol invent anything? */
  symbolToInk: number
}

/** The symmetric chamfer of one symbol reading against the ink. */
export const scoreOutline = (ink: Ink, outline: readonly (readonly Pt[])[]): Score => {
  const L = polysLength(outline)
  if (L <= 0) return { total: TRUNCATE, inkToSymbol: TRUNCATE, symbolToInk: TRUNCATE }
  const starts: number[] = []
  const sym = sampleAlong(outline, Math.max(ink.step, L / SYMBOL_SAMPLES), starts)
  const a = ink.samples
  const na = a.length >> 1, nb = sym.length >> 1
  // Ink → symbol measures to the symbol's SEGMENTS, not just its samples:
  // where the samples fall shifts as the params move, and a distance that
  // jittered with it would leave the optimiser a field of false minima.
  const segDx = new Float64Array(nb), segDy = new Float64Array(nb), segInv = new Float64Array(nb)
  for (let j = 0; j + 1 < nb; j++) {
    const dx = sym[2 * j + 2]! - sym[2 * j]!, dy = sym[2 * j + 3]! - sym[2 * j + 1]!
    const L2 = dx * dx + dy * dy
    segDx[j] = dx
    segDy[j] = dy
    segInv[j] = L2 > 0 ? 1 / L2 : 0
  }
  for (const k of starts) if (k > 0) segInv[k - 1] = 0 // no segment across polylines
  if (nb > 0) segInv[nb - 1] = 0
  const cap = TRUNCATE * ink.diag
  const cap2 = cap * cap
  const nearB = new Float64Array(nb).fill(cap2)
  let sumA = 0
  for (let i = 0; i < na; i++) {
    const ax = a[2 * i]!, ay = a[2 * i + 1]!
    let best = cap2
    for (let j = 0; j < nb; j++) {
      const px = ax - sym[2 * j]!, py = ay - sym[2 * j + 1]!
      const d2 = px * px + py * py
      if (d2 < nearB[j]!) nearB[j] = d2
      if (d2 < best) best = d2
      const inv = segInv[j]!
      if (inv > 0) {
        const u = (px * segDx[j]! + py * segDy[j]!) * inv
        if (u > 0 && u < 1) {
          const qx = px - u * segDx[j]!, qy = py - u * segDy[j]!
          const e2 = qx * qx + qy * qy
          if (e2 < best) best = e2
        }
      }
    }
    sumA += Math.sqrt(best)
  }
  let sumB = 0
  for (let j = 0; j < nb; j++) sumB += Math.sqrt(nearB[j]!)
  const inkToSymbol = sumA / na / ink.diag
  const symbolToInk = sumB / nb / ink.diag
  return { total: (inkToSymbol + symbolToInk) / 2, inkToSymbol, symbolToInk }
}

// --- What can be tuned --------------------------------------------------------------

/** Continuous params with no role that are still worth tuning, and their range. */
const FREE_NUMBERS: Record<string, { lo: number; hi: number; step: number; start: number }> = {
  fold: { lo: -1, hi: 1, step: 0.3, start: 1 },
}

interface Dim {
  key: string
  role: ParamSpec["role"] | "free"
  /** The simplex's first step: what "a noticeable change" of this param is. */
  step: number
  lo: number
  hi: number
}

const TUNED_ROLES = new Set(["x", "y", "length", "angle", "yaw", "pitch", "tilt"])

/** The entry's tunable params, each with its natural step, given the ink. */
const dimsOf = (entry: VocabEntry, params: Record<string, unknown>, ink: Ink, only?: readonly string[]): Dim[] => {
  const dims: Dim[] = []
  for (const [key, spec] of Object.entries(entry.params)) {
    if (only && !only.includes(key)) continue
    if (spec.type !== "number") continue
    const v = Number(params[key])
    if (spec.role && TUNED_ROLES.has(spec.role)) {
      if (spec.role === "tilt") continue // a flat page shows no tilt
      const step =
        spec.role === "x" || spec.role === "y"
          ? ink.diag * 0.05
          : spec.role === "length"
            ? Math.max(ink.diag * 0.02, 0.15 * (Number.isFinite(v) ? Math.abs(v) : ink.diag / 4))
            : 0.25
      dims.push({ key, role: spec.role, step, lo: spec.role === "length" ? Math.max(1, ink.diag * 0.01) : -Infinity, hi: Infinity })
    } else if (FREE_NUMBERS[key]) {
      const f = FREE_NUMBERS[key]!
      dims.push({ key, role: "free", step: f.step, lo: f.lo, hi: f.hi })
    }
  }
  return dims
}

const clampDim = (d: Dim, v: number) => Math.min(d.hi, Math.max(d.lo, v))

// --- Nelder–Mead ---------------------------------------------------------------------

export interface MinimizeResult {
  x: number[]
  f: number
  evals: number
  /** The best value after every evaluation. */
  history: number[]
}

/**
 * Nelder–Mead (standard coefficients) from `x0` with per-dimension initial
 * steps, at most `maxEvals` evaluations. When the simplex shrinks below
 * `tol` (relative spread of values) with budget left it restarts around
 * the best vertex with smaller steps, for as long as restarts still pay —
 * the cheap cure for a simplex that collapsed onto a ridge.
 */
export const nelderMead = (
  f: (x: number[]) => number,
  x0: number[],
  steps: number[],
  maxEvals: number,
  tol = 1e-5,
): MinimizeResult => {
  const n = x0.length
  const history: number[] = []
  let evals = 0
  let best = Infinity
  let bestX = x0.slice()
  const ev = (x: number[]): number => {
    const v = f(x)
    evals++
    if (v < best) {
      best = v
      bestX = x.slice()
    }
    history.push(best)
    return v
  }
  if (n === 0) {
    ev(x0)
    return { x: bestX, f: best, evals, history }
  }
  const run = (start: number[], st: number[]) => {
    let simplex = [start.slice()]
    for (let i = 0; i < n; i++) {
      const x = start.slice()
      x[i] = x[i]! + st[i]!
      simplex.push(x)
    }
    let vals = simplex.map(ev)
    while (evals < maxEvals) {
      const order = vals.map((_, i) => i).sort((a, b) => vals[a]! - vals[b]!)
      simplex = order.map((i) => simplex[i]!)
      vals = order.map((i) => vals[i]!)
      if (Math.abs(vals[n]! - vals[0]!) <= tol * (Math.abs(vals[0]!) + 1e-9)) return
      const c = new Array(n).fill(0)
      for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) c[k] += simplex[i]![k]! / n
      const along = (t: number) => c.map((ck, k) => ck + t * (simplex[n]![k]! - ck))
      const xr = along(-1)
      const fr = ev(xr)
      if (fr < vals[0]!) {
        const xe = along(-2)
        const fe = evals < maxEvals ? ev(xe) : Infinity
        if (fe < fr) (simplex[n] = xe), (vals[n] = fe)
        else (simplex[n] = xr), (vals[n] = fr)
      } else if (fr < vals[n - 1]!) {
        simplex[n] = xr
        vals[n] = fr
      } else {
        const xc = fr < vals[n]! ? along(-0.5) : along(0.5)
        const fc = evals < maxEvals ? ev(xc) : Infinity
        if (fc < Math.min(fr, vals[n]!)) {
          simplex[n] = xc
          vals[n] = fc
        } else {
          for (let i = 1; i <= n && evals < maxEvals; i++) {
            simplex[i] = simplex[i]!.map((v, k) => simplex[0]![k]! + 0.5 * (v - simplex[0]![k]!))
            vals[i] = ev(simplex[i]!)
          }
        }
      }
    }
  }
  run(x0, steps)
  // Restart around the best vertex while restarts still pay.
  for (let k = 1; evals + n + 1 < maxEvals; k++) {
    const before = best
    run(bestX, steps.map((s) => s / (k + 1)))
    if (before - best <= 1e-3 * Math.abs(before)) break
  }
  return { x: bestX, f: best, evals, history }
}

/**
 * Compass search: each dimension tried a step either way, a move kept
 * when it helps, every step halved when none does. Slow to start, but it
 * never stalls on the ridges a chamfer of messy ink is full of — the
 * finishing pass after Nelder–Mead.
 */
export const compassSearch = (
  f: (x: number[]) => number,
  x0: number[],
  steps: number[],
  maxEvals: number,
  minStep = 1e-3,
): MinimizeResult => {
  const history: number[] = []
  let x = x0.slice()
  let fx = f(x)
  let evals = 1
  history.push(fx)
  const st = steps.slice()
  while (evals < maxEvals && st.some((s, i) => s > minStep * steps[i]!)) {
    let moved = false
    for (let i = 0; i < x.length && evals < maxEvals; i++) {
      for (const dir of [1, -1]) {
        if (evals >= maxEvals) break
        const y = x.slice()
        y[i] = y[i]! + dir * st[i]!
        const fy = f(y)
        evals++
        if (fy < fx) {
          x = y
          fx = fy
          moved = true
          history.push(fx)
          break
        }
        history.push(fx)
      }
    }
    if (!moved) for (let i = 0; i < st.length; i++) st[i] = st[i]! / 2
  }
  return { x, f: fx, evals, history }
}

// --- Fitting one reading ------------------------------------------------------------

export interface FitOptions {
  /** Evaluation budget (each one a build + flatten + chamfer). Default 200. */
  maxEvals?: number
  /** Only these params are tuned (default: every tunable one). */
  only?: readonly string[]
  /** A time budget: a symbol slow to flatten (a MindVirus with its cable,
   *  ~2.5 ms) gets as many evaluations as fit in it, at least 30. */
  maxMs?: number
}

export interface FitResult {
  symbol: string
  params: Record<string, unknown>
  score: Score
  /** The score of the params as given, before any tuning. */
  initial: Score
  /** Best total after each evaluation. */
  history: number[]
  evals: number
  ms: number
}

const scoreParams = (ink: Ink, symbol: string, params: Record<string, unknown>, approx = false): Score =>
  scoreOutline(ink, fastOutline(symbol, params, approx))

/** A pitch or yaw strayed from what the entry assumes costs a whisker — ties go to the default view. */
const PRIOR = 0.002
/** The polish's budget, in simplex sizes: a few dozen real flattenings. */
const POLISH = 8
/** Values tried per shape param (yaw, pitch, fold) before the pose is tuned. */
const SHAPE_GRID = 5

/**
 * Tune one reading's params so the symbol lies on the ink. Coarse to fine:
 *
 *   1. SHAPE  the params that change the drawing itself (a cube's view, a
 *             MindVirus's fold) on a small grid, the pose held;
 *   2. POSE   position, size and angle by Nelder–Mead through the pose
 *             shortcut — microseconds an evaluation;
 *   3. POLISH everything together on the real flattening, briefly — only
 *             when the shortcut was approximate or the shape was gridded.
 *
 * A symbol the shortcut can't serve is tuned on the real flattening throughout.
 */
export const fitSymbol = (
  strokes: readonly InkStroke[] | Ink,
  candidate: Pick<Candidate, "symbol" | "params">,
  opts: FitOptions = {},
): FitResult => {
  const started = performance.now()
  const ink = "samples" in strokes ? strokes : prepareInk(strokes)
  const entry = vocabById(candidate.symbol)
  let base = { ...candidate.params }
  if (!ink || !entry) {
    const none: Score = { total: TRUNCATE, inkToSymbol: TRUNCATE, symbolToInk: TRUNCATE }
    return { symbol: candidate.symbol, params: base, score: none, initial: none, history: [], evals: 0, ms: 0 }
  }
  const symbol = candidate.symbol
  const dims = dimsOf(entry, base, ink, opts.only)
  for (const d of dims) {
    if (!Number.isFinite(Number(base[d.key])))
      base[d.key] = entry.params[d.key]?.default ?? FREE_NUMBERS[d.key]?.start ?? 0
  }
  const prior = (p: Record<string, unknown>): number => {
    let s = 0
    for (const d of dims) {
      if (d.role !== "yaw" && d.role !== "pitch") continue
      const def = entry.params[d.key]?.default
      if (def !== undefined) s += (Number(p[d.key]) - def) ** 2
    }
    return PRIOR * s
  }
  let budget = opts.maxEvals ?? 200
  const history: number[] = []
  let evals = 0
  let best = Infinity
  const note = (v: number) => {
    evals++
    best = Math.min(best, v)
    history.push(best)
    return v
  }
  const cost = (p: Record<string, unknown>, approx: boolean) => note(scoreParams(ink, symbol, p, approx).total + prior(p))
  /** Nelder–Mead over `ds`, from `from`, steps scaled by `scale`. */
  const tune = (ds: Dim[], from: Record<string, unknown>, maxEvals: number, approx: boolean, scale = 1) => {
    const at = (u: number[]) => {
      const p = { ...from }
      ds.forEach((d, i) => (p[d.key] = clampDim(d, Number(from[d.key]) + u[i]! * d.step * scale)))
      return p
    }
    const obj = (u: number[]) => cost(at(u), approx)
    const nm = nelderMead(obj, ds.map(() => 0), ds.map(() => 1), Math.ceil(maxEvals * 0.6))
    const cs = compassSearch(obj, nm.x, ds.map(() => 0.25), maxEvals - nm.evals)
    return at(cs.f <= nm.f ? cs.x : nm.x)
  }

  const t0 = performance.now()
  const initial = scoreParams(ink, symbol, base)
  const evalMs = performance.now() - t0
  // A param the drawing doesn't show (a cylinder's turn about its own axis) is not tuned.
  for (let i = dims.length - 1; i >= 0; i--) {
    const d = dims[i]!
    const moved = scoreParams(ink, symbol, { ...base, [d.key]: clampDim(d, Number(base[d.key]) + d.step) }, true)
    note(moved.total)
    if (Math.abs(moved.total - initial.total) < 1e-9) dims.splice(i, 1)
  }
  const verdict = templateFor(symbol, base)?.t.verdict ?? "none"
  // Only the exact path costs a real flattening per evaluation; the time budget binds there.
  if (opts.maxMs !== undefined && verdict === "none") budget = Math.min(budget, Math.max(30, Math.floor(opts.maxMs / Math.max(evalMs, 1e-3))))
  const shapeDims = dims.filter((d) => d.role === "yaw" || d.role === "pitch" || d.role === "free")
  const poseDims = dims.filter((d) => !shapeDims.includes(d))
  if (verdict === "none" || poseDims.length === 0) {
    base = tune(dims, base, budget, false)
  } else {
    // 1. SHAPE on a grid (each point a new template: one real flattening).
    if (shapeDims.length > 0) {
      let grid: Record<string, unknown>[] = [{}]
      for (const d of shapeDims) {
        const v0 = Number(base[d.key])
        const values =
          d.role === "free"
            ? Array.from({ length: SHAPE_GRID }, (_, i) => d.lo + ((d.hi - d.lo) * i) / (SHAPE_GRID - 1))
            : Array.from({ length: SHAPE_GRID }, (_, i) => v0 + (i - (SHAPE_GRID - 1) / 2) * d.step * 1.5)
        grid = grid.flatMap((g) => values.map((v) => ({ ...g, [d.key]: v })))
      }
      let bestCost = Infinity
      let bestP = base
      for (const g of grid) {
        const p = { ...base, ...g }
        const c = cost(p, true)
        if (c < bestCost) (bestCost = c), (bestP = p)
      }
      base = bestP
    }
    // 2. POSE through the shortcut.
    const polish = verdict === "approx" || shapeDims.length > 0
    const left = budget - evals
    base = tune(poseDims, base, polish ? Math.ceil(left * 0.6) : left, true)
    // 3. POLISH on the real thing.
    if (polish && budget - evals > dims.length + 1) base = tune(dims, base, Math.min(budget - evals, POLISH * (dims.length + 1)), false, 0.3)
  }
  const params = base
  // Numbers to a tenth of a page unit (a thousandth of a radian), like the recognizer's.
  for (const d of dims) {
    const v = Number(params[d.key])
    // Angles come back in (−π, π]: a turn and a turn-and-a-revolution are one reading.
    const w = d.role === "angle" ? v - 2 * Math.PI * Math.ceil((v - Math.PI) / (2 * Math.PI)) : v
    params[d.key] = d.role === "x" || d.role === "y" || d.role === "length" ? Math.round(w * 10) / 10 : Math.round(w * 1000) / 1000
  }
  const score = scoreParams(ink, symbol, params)
  return { symbol, params, score, initial, history, evals: evals + 2, ms: performance.now() - started }
}

/**
 * The recognizer's answer, every candidate refined against the ink, the
 * best-fitting first among those the model was equally sure of. A
 * refinement that fits WORSE than the model's own numbers is dropped (the
 * model's are kept) — the fit only ever helps.
 */
export const refineResponse = (
  strokes: readonly InkStroke[],
  res: RecognizeResponse,
  opts: FitOptions = {},
): { response: RecognizeResponse; fits: FitResult[] } => {
  const ink = prepareInk(strokes)
  if (!ink) return { response: res, fits: [] }
  const fits: FitResult[] = []
  const candidates = res.candidates.map((c) => {
    if (c.symbol === "text") return c // letters fit by their words, not their ink
    const fit = fitSymbol(ink, c, { maxMs: 150, ...opts })
    fits.push(fit)
    return fit.score.total < fit.initial.total ? { ...c, params: fit.params } : c
  })
  return { response: { ...res, candidates }, fits }
}

// --- Without a model: race the vocabulary --------------------------------------------

/** Factors each of several lengths is scanned by before tuning. */
const LENGTH_SCAN = [0.5, 0.7, 1.4, 2]
/** Angles tried before tuning (a coarse scan beats a local optimiser's guess at symmetry). */
const ANGLE_SCAN = 12

const roleKey = (entry: VocabEntry, role: string): string | undefined =>
  Object.keys(entry.params).find((k) => entry.params[k]!.role === role)

/**
 * The cheap start: the symbol at its default shape, angle `angle`, scaled so
 * its bbox's larger side matches the ink's and moved so the two bboxes
 * share a centre. Two flattenings.
 */
export const bboxStart = (entry: VocabEntry, ink: Ink, fixed: Record<string, unknown> = {}, angle?: number): Record<string, unknown> => {
  const p: Record<string, unknown> = { ...fixed }
  const xKey = roleKey(entry, "x"), yKey = roleKey(entry, "y"), aKey = roleKey(entry, "angle")
  const cx = (ink.box.x0 + ink.box.x1) / 2, cy = (ink.box.y0 + ink.box.y1) / 2
  for (const [k, s] of Object.entries(entry.params)) {
    if (k in p || s.type !== "number") continue
    if (s.role === "length") p[k] = s.default ?? 100
    else if (s.role === "x") p[k] = cx
    else if (s.role === "y") p[k] = cy
    else if (s.role === "angle") p[k] = k === aKey && angle !== undefined ? angle : (s.default ?? 0)
    else if (s.default !== undefined) p[k] = s.default
    else if (FREE_NUMBERS[k]) p[k] = FREE_NUMBERS[k]!.start
  }
  const b = boxOf(fastOutline(entry.id, p, true))
  if (!b) return p
  const s = Math.max(ink.box.x1 - ink.box.x0, ink.box.y1 - ink.box.y0) / Math.max(1e-6, b.x1 - b.x0, b.y1 - b.y0)
  for (const [k, spec] of Object.entries(entry.params)) if (spec.role === "length" && !(k in fixed)) p[k] = Number(p[k]) * s
  // Scaling about the symbol's own anchor moved its bbox centre with it.
  const ax = xKey ? Number(p[xKey]) : 0, ay = yKey ? Number(p[yKey]) : 0
  const bx = ax + ((b.x0 + b.x1) / 2 - ax) * s, by = ay + ((b.y0 + b.y1) / 2 - ay) * s
  if (xKey) p[xKey] = ax + cx - bx
  if (yKey) p[yKey] = ay + cy - by
  return p
}

export interface RaceOptions extends FitOptions {
  /** How many scanned starts per hypothesis go on to be tuned. Default 2. */
  starts?: number
  /** A hypothesis whose best start scores worse than the leader's by this factor is not tuned. Default 1.6. */
  prune?: number
}

const PRUNE = 1.6

/** A symbol hypothesis the race can try: an entry and its enum choices. */
const hypotheses = (entry: VocabEntry): Record<string, unknown>[] => {
  let out: Record<string, unknown>[] = [{}]
  for (const [k, s] of Object.entries(entry.params)) {
    if (s.type === "enum" && s.options) out = out.flatMap((h) => s.options!.map((o) => ({ ...h, [k]: o })))
  }
  return out
}

/**
 * Entries the race can't try: words need their letters, not their ink, and
 * a symbol with a drawn path (the MindVirus cable) needs that path traced —
 * both are the model's to read.
 */
export const raceable = (entry: VocabEntry): boolean =>
  !Object.values(entry.params).some((s) => s.type === "string" || s.role === "content" || s.role === "points")

/**
 * Every imported symbol, fitted from a cheap start, best score first.
 * No model: this is the near-instant path for shapes whose geometry IS
 * their meaning.
 */
export const raceVocabulary = (strokes: readonly InkStroke[], vocabulary: readonly string[], opts: RaceOptions = {}): FitResult[] => {
  const ink = prepareInk(strokes)
  if (!ink) return []
  // 1. SCAN: every hypothesis from its cheap starts — two outlines each.
  const scans: { id: string; entry: VocabEntry; started: number; ms: number; starts: { params: Record<string, unknown>; total: number }[] }[] = []
  for (const id of vocabulary) {
    const entry = vocabById(id)
    if (!entry || !raceable(entry)) continue
    for (const fixed of hypotheses(entry)) {
      const started = performance.now()
      const aKey = roleKey(entry, "angle")
      const angles = aKey ? Array.from({ length: ANGLE_SCAN }, (_, i) => (i / ANGLE_SCAN) * 2 * Math.PI - Math.PI) : [undefined]
      const lengths = Object.keys(entry.params).filter((k) => entry.params[k]!.role === "length")
      const starts = angles
        .map((a) => {
          let params = bboxStart(entry, ink, fixed, a)
          let total = scoreParams(ink, id, params, true).total
          // Several lengths (a cylinder's radius and height): one bbox can't
          // set their ratio, so each is scanned on its own around the start.
          if (lengths.length > 1)
            for (const k of lengths)
              for (const f of LENGTH_SCAN) {
                const p = { ...params, [k]: Number(params[k]) * f }
                const t = scoreParams(ink, id, p, true).total
                if (t < total) (params = p), (total = t)
              }
          return { params, total }
        })
        .sort((a, b) => a.total - b.total)
      scans.push({ id, entry, started, ms: performance.now() - started, starts })
    }
  }
  // 2. PRUNE: a hypothesis whose best start is far behind the leader's won't catch up.
  const lead = Math.min(...scans.map((s) => s.starts[0]!.total))
  const results: FitResult[] = []
  for (const s of scans) {
    const evals0 = s.starts.length * 2
    if (s.starts[0]!.total > lead * (opts.prune ?? PRUNE)) {
      const total = s.starts[0]!
      const score = scoreParams(ink, s.id, total.params)
      results.push({ symbol: s.id, params: total.params, score, initial: score, history: [], evals: evals0, ms: s.ms })
      continue
    }
    // 3. TUNE the survivors from their best starts.
    const t0 = performance.now()
    let best: FitResult | undefined
    let evals = evals0
    // Distinct starts only: two scanned angles scoring alike are usually one
    // pose seen through the symbol's symmetry (a cylinder lying left or right).
    const distinct: typeof s.starts = []
    for (const st of s.starts) {
      if (distinct.length >= (opts.starts ?? 2)) break
      if (!distinct.some((d) => Math.abs(d.total - st.total) <= 0.02 * st.total)) distinct.push(st)
    }
    for (const st of distinct) {
      const fit = fitSymbol(ink, { symbol: s.id, params: st.params }, opts)
      evals += fit.evals
      if (!best || fit.score.total < best.score.total) best = fit
    }
    results.push({ ...best!, evals, ms: s.ms + performance.now() - t0 })
  }
  return results.sort((a, b) => rank(a) - rank(b))
}

/** Occam: each tuned param costs a whisker, so a cylinder seen end-on loses to the circle it looks like. */
const OCCAM = 0.0005
/** A 3D symbol seen edge-on (pitch below this) is the flat shape it collapses to — a cylinder
 *  with line caps is a rectangle — so the flat shape should answer, not it. */
const EDGE_ON = 0.15
const EDGE_ON_COST = 0.01
/** Two lengths of one symbol this far apart (a cylinder of height ~0) collapse it to something else. */
const COLLAPSED = 0.12

/**
 * A reading that is really a different, flatter shape: a 3D symbol seen
 * edge-on, or one whose lengths collapsed — a cylinder with no height is
 * an ellipse, with no radius a line. Geometry fits these perfectly and
 * means nothing by them.
 */
export const degenerate = (f: Pick<FitResult, "symbol" | "params">): boolean => {
  const entry = vocabById(f.symbol)
  if (!entry) return false
  const lens: number[] = []
  for (const [k, spec] of Object.entries(entry.params)) {
    const v = Math.abs(Number(f.params[k]))
    if (spec.role === "pitch" && Number.isFinite(v) && v < EDGE_ON) return true
    if (spec.role === "length" && Number.isFinite(v)) lens.push(v)
  }
  return lens.length > 1 && Math.min(...lens) < COLLAPSED * Math.max(...lens)
}

const rank = (f: FitResult): number => {
  const entry = vocabById(f.symbol)
  if (!entry) return f.score.total
  return f.score.total + OCCAM * dimsOf(entry, f.params, { diag: 1 } as Ink).length + (degenerate(f) ? EDGE_ON_COST : 0)
}

/** Below this score a fit is on the ink (a wobbly hand-drawn circle scores ~0.015). */
export const CLEAR_SCORE = 0.03
/** …and the runner-up must be this much worse for the answer to be clear. */
export const CLEAR_MARGIN = 1.5

/**
 * The race's answer, when it is clear: the best fit is on the ink and
 * clearly better than every OTHER symbol (another enum option of the same
 * symbol is no rival). Undefined means "ask the model".
 */
export const instantReading = (
  strokes: readonly InkStroke[],
  vocabulary: readonly string[],
  opts: RaceOptions = {},
): { response: RecognizeResponse; fits: FitResult[] } | undefined => {
  const fits = raceVocabulary(strokes, vocabulary, opts)
  const best = fits[0]
  if (!best || best.score.total > CLEAR_SCORE || degenerate(best)) return undefined
  const rival = fits.find((f) => f.symbol !== best.symbol)
  if (rival && rank(rival) < rank(best) * CLEAR_MARGIN) return undefined
  const confidence = Math.round(Math.min(0.99, 1 - best.score.total / CLEAR_SCORE / 2) * 100) / 100
  return {
    response: {
      candidates: [{ symbol: best.symbol, params: best.params, confidence, why: `geometry fit ${best.score.total.toFixed(3)}` }],
    },
    fits,
  }
}
