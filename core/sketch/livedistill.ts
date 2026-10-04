/**
 * livedistill.ts — distill while drawing: the SEARCH, recognised as it
 * happens.
 *
 * David searches for a line by drawing it again and again over itself
 * (distill.ts). Live distill notices that searching while the pen is still
 * moving and, the moment the pen rests, replaces the passes with the one
 * line they mean — the way Procreate's QuickShape answers a held stroke, or
 * tldraw tidies a scribble, but for HIS way of drawing: many passes, one
 * meaning. Explicit ≋ stays the default; this is a toolbar toggle.
 *
 * A SEARCH is the strokes, drawn one right after another, that RE-TRACE each
 * other. A finished stroke joins the current search only if all of these
 * hold, and otherwise ends it and begins the next:
 *
 *   TIME     it began within PAUSE_MS of the last one ending;
 *   ON       most of it (ON_FRAC of its length) lies on the search's ink —
 *            within `near` of it, a tolerance that grows with the drawing
 *            (a big circle's passes wander further than a small S's);
 *   COVERS   it re-traces a real part of that ink (COVER_FRAC — half — of it), and
 *   RETRACE  the overlapping length is a stroke, not a dot (MIN_RETRACE).
 *
 * Handwriting is clusters too, and never distils: adjacent letters do not
 * lie on each other (ON fails), a crossbar or a stem meets its letter at a
 * point (ON fails), an i's dot is a dot (RETRACE fails), the stem of an `a`
 * runs down one side of its bowl (COVERS fails). A single stroke is never a
 * search, however it loops: only TWO or more passes are.
 *
 * WHEN. The pen resting for PAUSE_MS after a search of two or more passes —
 * no new stroke begun — is the moment: the search distils in place as one
 * undoable step. A stroke drawn elsewhere ends the search at once (the hand
 * moved on), and it distils then.
 *
 * Pure — main.ts keeps the clock and the page; the tests drive the same
 * functions with injected times.
 */

import { resample, type Pt } from "./distill"

/** The pen at rest this long after a search: distil it. */
export const PAUSE_MS = 600
/** Of a new stroke's length, at least this much on the search's ink. */
export const ON_FRAC = 0.6
/** Of the search's ink, at least this much re-traced by the new stroke. */
export const COVER_FRAC = 0.5
/** The re-traced length must be a stroke's (page units ≈ 4 mm on the rM2). */
export const MIN_RETRACE = 36
/** Samples along every stroke, page units. */
const STEP = 3

/** The tolerance for "on the same ink": a twentieth of the drawing, within [6, 30] page units. */
export const nearFor = (diag: number): number => Math.min(30, Math.max(6, 0.05 * diag))

export interface Search {
  /** The passes, in drawing order. */
  ids: string[]
  /** Each pass resampled at STEP, page units. */
  paths: Pt[][]
  /** When the last pass ended (ms, the caller's clock). */
  endedAt: number
}

export interface Pass {
  id: string
  points: readonly Pt[]
  /** When the pen went down and came up for it (ms, the caller's clock). */
  start: number
  end: number
}

const sampled = (pts: readonly Pt[]): Pt[] => (pts.length > 1 ? resample(pts, STEP) : pts.map((p) => ({ x: p.x, y: p.y })))

const diagOf = (sets: readonly (readonly Pt[])[]): number => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const s of sets)
    for (const p of s) {
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    }
  return x1 >= x0 ? Math.hypot(x1 - x0, y1 - y0) : 0
}

/** "Is there a point of `pts` within r of q?" — a grid hash of cell r. */
const nearIndex = (pts: readonly Pt[], r: number) => {
  const cells = new Map<string, Pt[]>()
  const key = (cx: number, cy: number) => `${cx},${cy}`
  for (const p of pts) {
    const k = key(Math.floor(p.x / r), Math.floor(p.y / r))
    const list = cells.get(k)
    if (list) list.push(p)
    else cells.set(k, [p])
  }
  return (q: Pt): boolean => {
    const cx = Math.floor(q.x / r)
    const cy = Math.floor(q.y / r)
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const p of cells.get(key(cx + dx, cy + dy)) ?? []) if (Math.hypot(p.x - q.x, p.y - q.y) <= r) return true
    return false
  }
}

/** How a stroke sits on a search's ink: the measures the rules above read. */
export const overlap = (search: Pick<Search, "paths">, points: readonly Pt[]) => {
  const mine = sampled(points)
  const ink = search.paths.flat()
  const near = nearFor(diagOf([ink, mine]))
  const onInk = nearIndex(ink, near)
  const onMine = nearIndex(mine, near)
  const on = mine.filter(onInk).length
  return {
    near,
    /** Fraction of the new stroke lying on the search's ink. */
    on: mine.length ? on / mine.length : 0,
    /** Fraction of the search's ink the new stroke re-traces. */
    covers: ink.length ? ink.filter(onMine).length / ink.length : 0,
    /** Length of the new stroke that lies on the ink, page units. */
    retrace: on * STEP,
  }
}

/** Does this finished pass continue the search? */
export const joins = (search: Search, pass: Pass): boolean => {
  if (pass.start - search.endedAt > PAUSE_MS) return false
  const o = overlap(search, pass.points)
  return o.on >= ON_FRAC && o.covers >= COVER_FRAC && o.retrace >= MIN_RETRACE
}

/** Two or more passes: something to distil. */
export const isSearch = (s: Search | undefined): s is Search => !!s && s.ids.length >= 2

/**
 * A pass has ended: it continues the current search, or the current search
 * is over (`done`, to distil now if it is one) and the pass begins the next.
 */
export const nextSearch = (cur: Search | undefined, pass: Pass): { search: Search; done?: Search } => {
  if (cur && joins(cur, pass))
    return { search: { ids: [...cur.ids, pass.id], paths: [...cur.paths, sampled(pass.points)], endedAt: pass.end } }
  return {
    search: { ids: [pass.id], paths: [sampled(pass.points)], endedAt: pass.end },
    ...(isSearch(cur) ? { done: cur } : {}),
  }
}

/** The pen has rested long enough after a real search: distil it now. */
export const ripe = (s: Search | undefined, now: number): s is Search => isSearch(s) && now - s.endedAt >= PAUSE_MS
