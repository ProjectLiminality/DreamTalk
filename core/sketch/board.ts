/**
 * board.ts — a whiteboard page as a FILE: `core/demo/boards/<name>.board.json`.
 *
 * A board is a DreamTalk scene (demo/boards/Board.ts builds one from it),
 * so it lives in the repo beside the DreamWeavings, committed like them —
 * real DreamNode content, not browser state. The file is the sketchpad's
 * page verbatim: ink strokes and placed symbols in PAGE units, the
 * protocol's own types, nothing derived.
 *
 * Pure: the daemon validates with it, the editor and the whiteboard read
 * and write through it, the tests drive it.
 */

import { PAGE_H, PAGE_W, type InkStroke, type PenSample, type PlacedSymbol } from "./protocol"

export interface BoardFile {
  version: 1
  page: { w: number; h: number }
  strokes: InkStroke[]
  symbols: PlacedSymbol[]
}

/** A name is a file stem: letters, digits, `-`, `_` — nothing that can walk a path. */
const BOARD_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

export const isValidBoardName = (name: string): boolean => BOARD_NAME.test(name)

export const BOARD_SUFFIX = ".board.json"

export const emptyBoard = (): BoardFile => ({ version: 1, page: { w: PAGE_W, h: PAGE_H }, strokes: [], symbols: [] })

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

const parseSample = (v: unknown): PenSample | undefined => {
  const p = v as Partial<PenSample> | null
  if (!p || !finite(p.x) || !finite(p.y)) return undefined
  return { x: p.x, y: p.y, pressure: finite(p.pressure) ? p.pressure : 0.5, t: finite(p.t) ? p.t : 0 }
}

/**
 * Anything → a board, or undefined if it is not one at all. Individual
 * malformed strokes/symbols are dropped rather than failing the whole
 * page: a hand-edited file with one bad entry still opens.
 */
export const parseBoard = (v: unknown): BoardFile | undefined => {
  if (typeof v !== "object" || v === null) return undefined
  const b = v as Partial<BoardFile>
  if (!Array.isArray(b.strokes) || !Array.isArray(b.symbols)) return undefined
  const strokes: InkStroke[] = []
  for (const k of b.strokes as unknown[]) {
    const s = k as Partial<InkStroke> | null
    if (!s || typeof s.id !== "string" || !Array.isArray(s.points)) continue
    const points = s.points.map(parseSample).filter((p): p is PenSample => !!p)
    if (points.length) strokes.push({ id: s.id, points })
  }
  const symbols: PlacedSymbol[] = []
  for (const y of b.symbols as unknown[]) {
    const s = y as Partial<PlacedSymbol> | null
    if (!s || typeof s.id !== "string" || typeof s.symbol !== "string") continue
    const params = typeof s.params === "object" && s.params !== null ? s.params : {}
    const fromStrokes = Array.isArray(s.fromStrokes) ? s.fromStrokes.filter((x) => typeof x === "string") : []
    symbols.push({ id: s.id, symbol: s.symbol, params, fromStrokes })
  }
  return { version: 1, page: { w: PAGE_W, h: PAGE_H }, strokes, symbols }
}

const r2 = (v: number) => Math.round(v * 100) / 100
const r3 = (v: number) => Math.round(v * 1000) / 1000

/** Numbers inside symbol params, rounded the same way (paths included). */
const roundDeep = (v: unknown): unknown => {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v
  if (Array.isArray(v)) return v.map(roundDeep)
  if (typeof v === "object" && v !== null)
    return Object.fromEntries(Object.entries(v).map(([k, e]) => [k, roundDeep(e)]))
  return v
}

/**
 * The file's bytes. One stroke and one symbol per line, so a board diffs
 * like a scene file does — a moved circle is one changed line in git.
 */
export const serializeBoard = (b: { strokes: readonly InkStroke[]; symbols: readonly PlacedSymbol[] }): string => {
  const strokes = b.strokes.map((k) =>
    JSON.stringify({
      id: k.id,
      points: k.points.map((p) => ({ x: r2(p.x), y: r2(p.y), pressure: r3(p.pressure), t: Math.round(p.t) })),
    }),
  )
  const symbols = b.symbols.map((y) => JSON.stringify({ ...y, params: roundDeep(y.params) }))
  const list = (rows: string[]) => (rows.length ? `[\n    ${rows.join(",\n    ")}\n  ]` : "[]")
  return `{\n  "version": 1,\n  "page": { "w": ${PAGE_W}, "h": ${PAGE_H} },\n  "symbols": ${list(symbols)},\n  "strokes": ${list(strokes)}\n}\n`
}
