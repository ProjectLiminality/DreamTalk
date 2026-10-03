/**
 * state.ts — the sketchpad's page, pure.
 *
 * The page is two lists — raw ink and placed symbols — and nothing else.
 * Every change goes through a COMMAND, and the history keeps the page as it
 * was before and after each one. Since strokes and symbols are never mutated
 * (a command builds new arrays around the same objects), a snapshot is two
 * array references, and undo is exact by construction: the strokes a
 * replacement swallowed come back as the very objects they were, in the
 * order they were, in one step.
 *
 * No DOM here — the page (main.ts) and the tests drive the same functions.
 */

import type { EditOp, InkStroke, PenSample, PlacedSymbol } from "./protocol"
import { transformSymbol, vocabById } from "./vocabulary"
import { xfPoint, type Xf } from "./xform"

export interface SketchState {
  strokes: InkStroke[]
  symbols: PlacedSymbol[]
}

export const emptyState = (): SketchState => ({ strokes: [], symbols: [] })

export type Command =
  | { kind: "addStroke"; stroke: InkStroke }
  /** Remove strokes (the eraser). */
  | { kind: "erase"; ids: string[] }
  /** Strokes → one symbol: the "make it real" step. */
  | { kind: "replace"; ids: string[]; symbol: PlacedSymbol }
  /** Remove strokes and/or symbols (Delete key). */
  | { kind: "delete"; ids: string[] }
  /** Translate strokes and/or symbols, in page units. */
  | { kind: "move"; ids: string[]; dx: number; dy: number }
  /** Move/rotate/scale strokes and/or symbols together about one pivot (xform.ts). */
  | { kind: "transform"; ids: string[]; xf: Xf }
  /** Place a symbol that replaces nothing. */
  | { kind: "addSymbol"; symbol: PlacedSymbol }
  /** Merge params into a placed symbol; `symbol` turns it into another entry. */
  | { kind: "update"; id: string; symbol?: string; params: Record<string, unknown> }
  /**
   * Several commands as ONE step — a spoken instruction's edits (voice.ts).
   * `selected` is what was selected when it was said, restored on undo.
   */
  | { kind: "edit"; steps: Command[]; selected: string[] }
  | { kind: "clear" }

/** Apply a command to a page, returning a NEW page (inputs untouched). */
export const apply = (s: SketchState, cmd: Command): SketchState => {
  switch (cmd.kind) {
    case "addStroke":
      return { strokes: [...s.strokes, cmd.stroke], symbols: s.symbols }
    case "erase":
    case "delete": {
      const gone = new Set(cmd.ids)
      return {
        strokes: s.strokes.filter((k) => !gone.has(k.id)),
        symbols: s.symbols.filter((y) => !gone.has(y.id)),
      }
    }
    case "replace": {
      const gone = new Set(cmd.ids)
      const symbol = { ...cmd.symbol, fromStrokes: [...cmd.ids] }
      return {
        strokes: s.strokes.filter((k) => !gone.has(k.id)),
        symbols: [...s.symbols, symbol],
      }
    }
    case "move": {
      const moving = new Set(cmd.ids)
      return {
        strokes: s.strokes.map((k) => (moving.has(k.id) ? translateStroke(k, cmd.dx, cmd.dy) : k)),
        symbols: s.symbols.map((y) => (moving.has(y.id) ? translateSymbol(y, cmd.dx, cmd.dy) : y)),
      }
    }
    case "transform": {
      const moving = new Set(cmd.ids)
      return {
        strokes: s.strokes.map((k) => (moving.has(k.id) ? transformStroke(k, cmd.xf) : k)),
        symbols: s.symbols.map((y) => (moving.has(y.id) ? transformSymbol(y, cmd.xf) : y)),
      }
    }
    case "addSymbol":
      return { strokes: s.strokes, symbols: [...s.symbols, cmd.symbol] }
    case "update":
      return { strokes: s.strokes, symbols: s.symbols.map((y) => (y.id === cmd.id ? updateSymbol(y, cmd) : y)) }
    case "edit":
      return cmd.steps.reduce(apply, s)
    case "clear":
      return emptyState()
  }
}

/**
 * A symbol with new params merged in. Turned into ANOTHER symbol, it keeps
 * only the params the new entry also has (a circle's centre and radius
 * carry over into a flower of life; nothing else does).
 */
export const updateSymbol = (
  y: PlacedSymbol,
  u: { symbol?: string; params: Record<string, unknown> },
): PlacedSymbol => {
  if (!u.symbol || u.symbol === y.symbol) return { ...y, params: { ...y.params, ...u.params } }
  const entry = vocabById(u.symbol)
  const kept = Object.fromEntries(Object.entries(y.params).filter(([k]) => !entry || k in entry.params))
  return { ...y, symbol: u.symbol, params: { ...kept, ...u.params } }
}

/** The ids a command leaves changed or new on the page — what stays selected after it. */
export const touched = (cmd: Command): string[] => {
  switch (cmd.kind) {
    case "move":
    case "transform":
      return [...cmd.ids]
    case "replace":
    case "addSymbol":
      return [cmd.symbol.id]
    case "update":
      return [cmd.id]
    case "edit":
      return [...new Set(cmd.steps.flatMap(touched))]
    default:
      return []
  }
}

/**
 * Validated edit ops (protocol.ts EditOp) → one undoable `edit` command,
 * read against the page as it is NOW: ops on ids that no longer exist are
 * dropped, new symbols get fresh ids, and a transform without a pivot
 * turns about the centre of what it moves. Undefined if nothing is left.
 */
export const editCommand = (
  s: SketchState,
  ops: readonly EditOp[],
  selected: readonly string[],
  makeId: (prefix: string) => string = newId,
): Extract<Command, { kind: "edit" }> | undefined => {
  const steps: Command[] = []
  let cur = s
  const has = (st: SketchState, id: string) => st.strokes.some((k) => k.id === id) || st.symbols.some((y) => y.id === id)
  for (const op of ops) {
    let step: Command | undefined
    switch (op.op) {
      case "update":
        if (cur.symbols.some((y) => y.id === op.id)) step = { kind: "update", id: op.id, symbol: op.symbol, params: { ...op.params } }
        break
      case "add":
        step = { kind: "addSymbol", symbol: { id: makeId("sym"), symbol: op.symbol, params: { ...op.params }, fromStrokes: [] } }
        break
      case "remove":
        if (has(cur, op.id)) step = { kind: "delete", ids: [op.id] }
        break
      case "replaceStrokes": {
        const ids = op.strokeIds.filter((id) => cur.strokes.some((k) => k.id === id))
        if (ids.length)
          step = { kind: "replace", ids, symbol: { id: makeId("sym"), symbol: op.symbol, params: { ...op.params }, fromStrokes: ids } }
        break
      }
      case "transform": {
        const ids = op.ids.filter((id) => has(cur, id))
        const box = selectionBox(cur, new Set(ids))
        if (ids.length && box)
          step = {
            kind: "transform",
            ids,
            xf: {
              translate: op.translate ?? { x: 0, y: 0 },
              rotate: op.rotate ?? 0,
              scale: op.scale ?? 1,
              pivot: op.pivot ?? boxCenter(box),
            },
          }
        break
      }
    }
    if (!step) continue
    steps.push(step)
    cur = apply(cur, step)
  }
  return steps.length ? { kind: "edit", steps, selected: [...selected] } : undefined
}

/** Ink transforms point by point; pressure and timing are the pen's, and stay. */
export const transformStroke = (k: InkStroke, xf: Xf): InkStroke => ({
  id: k.id,
  points: k.points.map((p) => ({ ...p, ...xfPoint(xf, p) })),
})

export const translateStroke = (k: InkStroke, dx: number, dy: number): InkStroke => ({
  id: k.id,
  points: k.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
})

/** Translate a symbol's position and paths, never its shape (vocabulary.ts transformSymbol). */
export const translateSymbol = (y: PlacedSymbol, dx: number, dy: number): PlacedSymbol =>
  transformSymbol(y, { translate: { x: dx, y: dy } })

const isPoint = (v: unknown): v is { x: number; y: number } =>
  typeof v === "object" && v !== null && typeof (v as { x?: unknown }).x === "number" &&
  typeof (v as { y?: unknown }).y === "number"

// --- History -----------------------------------------------------------------

interface Entry {
  cmd: Command
  before: SketchState
  after: SketchState
}

/** The undo/redo stack around a page. */
export class History {
  #state: SketchState
  #done: Entry[] = []
  #undone: Entry[] = []

  constructor(initial: SketchState = emptyState()) {
    this.#state = initial
  }

  get state(): SketchState {
    return this.#state
  }

  get canUndo(): boolean {
    return this.#done.length > 0
  }

  get canRedo(): boolean {
    return this.#undone.length > 0
  }

  do(cmd: Command): SketchState {
    const before = this.#state
    const after = apply(before, cmd)
    this.#done.push({ cmd, before, after })
    this.#undone.length = 0
    this.#state = after
    return after
  }

  /** Undo one step; returns the command undone (the page uses it to restore selection). */
  undo(): Command | undefined {
    const e = this.#done.pop()
    if (!e) return undefined
    this.#undone.push(e)
    this.#state = e.before
    return e.cmd
  }

  redo(): Command | undefined {
    const e = this.#undone.pop()
    if (!e) return undefined
    this.#done.push(e)
    this.#state = e.after
    return e.cmd
  }
}

// --- Geometry & hit-testing ----------------------------------------------------

export interface Pt {
  x: number
  y: number
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Even-odd ray cast. */
export const pointInPolygon = (p: Pt, poly: readonly Pt[]): boolean => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** A stroke is lassoed when MOST of its points are inside (default: over half). */
export const strokeInLasso = (k: InkStroke, poly: readonly Pt[], fraction = 0.5): boolean => {
  if (poly.length < 3 || k.points.length === 0) return false
  let n = 0
  for (const p of k.points) if (pointInPolygon(p, poly)) n++
  return n / k.points.length > fraction
}

export const boxOfPoints = (pts: readonly Pt[]): Box | undefined => {
  if (pts.length === 0) return undefined
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of pts) {
    if (p.x < x0) x0 = p.x
    if (p.y < y0) y0 = p.y
    if (p.x > x1) x1 = p.x
    if (p.y > y1) y1 = p.y
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export const unionBox = (boxes: readonly (Box | undefined)[]): Box | undefined => {
  const pts: Pt[] = []
  for (const b of boxes) if (b) pts.push({ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h })
  return boxOfPoints(pts)
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined)

/**
 * A symbol's footprint on the page, read from its params. The vocabulary
 * speaks in page units, so position is x/y (or cx/cy) and size is whichever
 * of r/radius/size/width/height it carries; any {x,y} or [x,y] path widens
 * it. A heuristic — good enough for hit-testing and framing, which is all
 * it is used for.
 */
export const symbolBox = (y: PlacedSymbol): Box => {
  const p = y.params
  const cx = num(p.x) ?? num(p.cx) ?? 0
  const cy = num(p.y) ?? num(p.cy) ?? 0
  const r = num(p.r) ?? num(p.radius) ?? undefined
  const size = num(p.size)
  const fp = vocabById(y.symbol)?.footprint?.(p)
  const w = fp?.w ?? num(p.width) ?? (r !== undefined ? 2 * r : size ?? 160)
  const h = fp?.h ?? num(p.height) ?? (r !== undefined ? 2 * r : size ?? w)
  const pts: Pt[] = [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
  ]
  for (const v of Object.values(p)) {
    if (!Array.isArray(v)) continue
    for (const e of v) {
      if (isPoint(e)) pts.push(e)
      else if (Array.isArray(e) && typeof e[0] === "number" && typeof e[1] === "number") pts.push({ x: e[0], y: e[1] })
    }
  }
  return boxOfPoints(pts)!
}

export const boxCenter = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

export const inBox = (p: Pt, b: Box, pad = 0): boolean =>
  p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad

/** Everything a lasso catches: strokes by majority of points, symbols by their centre. */
export const lassoSelect = (s: SketchState, poly: readonly Pt[]): string[] => {
  const ids: string[] = []
  for (const k of s.strokes) if (strokeInLasso(k, poly)) ids.push(k.id)
  for (const y of s.symbols) if (pointInPolygon(boxCenter(symbolBox(y)), poly)) ids.push(y.id)
  return ids
}

const segDist = (p: Pt, a: Pt, b: Pt): number => {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const len2 = vx * vx + vy * vy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2))
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy))
}

export const strokeDistance = (k: InkStroke, p: Pt): number => {
  const pts = k.points
  if (pts.length === 1) return Math.hypot(p.x - pts[0]!.x, p.y - pts[0]!.y)
  let d = Infinity
  for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i - 1]!, pts[i]!))
  return d
}

/**
 * What is under a point: the topmost symbol whose footprint contains it,
 * else the nearest stroke within `tolerance` page units, else nothing.
 */
export const hitTest = (s: SketchState, p: Pt, tolerance = 14): string | undefined => {
  for (let i = s.symbols.length - 1; i >= 0; i--) {
    const y = s.symbols[i]!
    if (inBox(p, symbolBox(y), tolerance)) return y.id
  }
  let best: string | undefined
  let bestD = tolerance
  for (const k of s.strokes) {
    const d = strokeDistance(k, p)
    if (d <= bestD) {
      bestD = d
      best = k.id
    }
  }
  return best
}

/** Strokes the eraser touches at p. */
export const strokesNear = (s: SketchState, p: Pt, radius: number): string[] =>
  s.strokes.filter((k) => strokeDistance(k, p) <= radius).map((k) => k.id)

/** The page box of a selection (strokes and symbols). */
export const selectionBox = (s: SketchState, ids: ReadonlySet<string>): Box | undefined =>
  unionBox([
    ...s.strokes.filter((k) => ids.has(k.id)).map((k) => boxOfPoints(k.points)),
    ...s.symbols.filter((y) => ids.has(y.id)).map(symbolBox),
  ])

/** Drop ids that no longer exist on the page. */
export const pruneSelection = (s: SketchState, ids: Iterable<string>): Set<string> => {
  const live = new Set<string>([...s.strokes.map((k) => k.id), ...s.symbols.map((y) => y.id)])
  return new Set([...ids].filter((id) => live.has(id)))
}

export const newId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export type { InkStroke, PenSample, PlacedSymbol }
