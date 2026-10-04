/**
 * route.ts — AUTO, as David found it works (2026-10-04, live): Clef sees
 * shapes best and fastest; Groq reads writing best. So auto asks Clef
 * first and lets Groq in only when Clef can't settle it — and when two
 * readings are genuinely plausible it doesn't guess: the options ring.
 *
 *   Clef chose a shape, sure of it, the fit on the ink   → replace
 *   Clef chose between near-equals (2nd ≥ CLOSE·1st)       → the ring
 *   Clef chose text / none / something the fit can't place,
 *   or was unsure (top < SURE), or the fit is poor, or
 *   Clef failed                                            → ask Groq
 *   Groq agrees with Clef                                   → replace (the better fit)
 *   Groq disagrees with Clef                                → the ring, both
 *   Groq found nothing                                      → Clef's picks as a ring
 *
 * The thresholds come from David's live session (the daemon log of
 * 2026-10-04, ~60 readings): Clef's top probability on readings that then
 * fitted well was 0.59–0.96 (circle 0.85–0.96, MindVirus 0.79, flower 0.68,
 * Regenaissance 0.63–0.68, logo 0.60, S-mark 0.59); the ones whose fit came
 * out poor (0.038–0.047) had 0.40–0.45; near-ties (globe 0.43 vs
 * Regenaissance 0.43, 0.46 vs 0.41) were the genuinely ambiguous ones.
 *
 * Pure: the policy is tested without any model.
 */

import type { Candidate, RecognizeResponse } from "../sketch/protocol"

/** Below this top probability Clef is unsure: Groq is asked too. */
export const SURE = 0.5
/** A runner-up at least this fraction of the top makes the reading ambiguous: the ring. */
export const CLOSE = 0.6
/** A fit worse than this (fit.ts score) is not on the ink. */
export const POOR = 0.03

/** What auto needs to know of Clef's answer once the fitter has placed its picks. */
export interface ClefView {
  /** Clef's most probable option ("text", "none", or a symbol id). */
  choice: string
  /** Probability of the top and the runner-up OPTION ("none" counts). */
  top: number
  second: number
  /** Did the fitter place the choice from the ink alone (not text, not none)? */
  placed: boolean
  /** The fit of the placed top choice. */
  fit?: number
}

export type ClefRoute = { to: "replace" } | { to: "ring" } | { to: "groq"; reason: string }

/** After Clef: replace, ring, or ask Groq (and why). */
export const routeClef = (v: ClefView): ClefRoute => {
  if (v.choice === "text") return { to: "groq", reason: "writing" }
  if (v.choice === "none") return { to: "groq", reason: "Clef: none" }
  if (!v.placed) return { to: "groq", reason: "Clef's choice needs reading" }
  if (v.fit === undefined || v.fit > POOR) return { to: "groq", reason: `poor fit ${v.fit?.toFixed(3) ?? "–"}` }
  if (v.top < SURE) return { to: "groq", reason: `Clef unsure ${v.top.toFixed(2)}` }
  if (v.second >= CLOSE * v.top) return { to: "ring" }
  return { to: "replace" }
}

/** The response that replaces at once: the one reading, alone. */
export const single = (c: Candidate, extra: Partial<RecognizeResponse> = {}): RecognizeResponse => ({
  ...extra,
  candidates: [{ ...c, confidence: Math.max(c.confidence, 0.9) }],
})

/**
 * The response that opens the ring: every reading, equally weighted (so the
 * page never replaces on its own), each chip labelled with who read it.
 */
export const ring = (cands: readonly (Candidate & { via: string })[], extra: Partial<RecognizeResponse> = {}): RecognizeResponse => {
  const seen = new Set<string>()
  const unique = cands.filter((c) => {
    const k = `${c.via}:${c.symbol}`
    return !seen.has(k) && seen.add(k)
  })
  return { ...extra, candidates: unique.map((c) => ({ ...c, confidence: 0.5 })) }
}

/** A reading with its fit, from one reader. */
export interface Reading {
  via: string
  candidates: Candidate[]
  fit?: number
  notes?: string
}

/**
 * Clef and Groq both looked: agree → the better-fitting one replaces;
 * disagree → the ring with both; Groq empty → Clef's picks as a ring (or
 * nothing, if Clef had none either).
 */
export const merge = (clef: Reading | undefined, groq: Reading): RecognizeResponse => {
  const label = (r: Reading, c: Candidate, fit?: number): Candidate & { via: string } => ({
    ...c,
    via: r.via,
    label: `${r.via}${fit !== undefined ? ` · ${fit.toFixed(3)}` : ""}`,
  })
  const g = groq.candidates[0]
  const notes = groq.notes ? { notes: groq.notes } : {}
  if (!g) {
    if (!clef || clef.candidates.length === 0) return { candidates: [], ...notes }
    return ring(clef.candidates.map((c, i) => label(clef, c, i === 0 ? clef.fit : undefined)), notes)
  }
  if (!clef || clef.candidates.length === 0) return single(g, { fit: groq.fit, ...notes })
  const c = clef.candidates[0]!
  if (c.symbol === g.symbol) {
    const groqBetter = (groq.fit ?? Infinity) <= (clef.fit ?? Infinity)
    return single(groqBetter ? g : c, { fit: groqBetter ? groq.fit : clef.fit, ...notes })
  }
  const fits = [clef.fit, groq.fit].filter((f): f is number => f !== undefined)
  return ring([label(clef, c, clef.fit), label(groq, g, groq.fit), ...clef.candidates.slice(1).map((x) => label(clef, x))], {
    ...(fits.length ? { fit: Math.min(...fits) } : {}),
    ...notes,
  })
}
