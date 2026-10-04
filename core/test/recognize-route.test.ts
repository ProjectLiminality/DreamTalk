/**
 * route.ts — auto's policy, pure: Clef sees, Groq reads, and genuine
 * ambiguity becomes the options ring instead of a guess.
 */

import { describe, expect, test } from "bun:test"
import { CLOSE, merge, POOR, routeClef, SURE, type Reading } from "../scripts/route"
import type { Candidate } from "../sketch/protocol"

const c = (symbol: string, confidence = 0.8): Candidate => ({ symbol, params: { cx: 1 }, confidence, why: "" })

describe("after Clef", () => {
  test("a sure, well-fitted shape replaces at once", () => {
    expect(routeClef({ choice: "circle", top: 0.9, second: 0.05, placed: true, fit: 0.012 })).toEqual({ to: "replace" })
    // David's live S-mark: 0.59, fit 0.018 — sure enough.
    expect(routeClef({ choice: "sMark", top: 0.59, second: 0.2, placed: true, fit: 0.018 })).toEqual({ to: "replace" })
  })

  test("near-equals open the ring (globe 0.43 vs Regenaissance 0.43, live)", () => {
    expect(routeClef({ choice: "globe", top: 0.55, second: 0.5, placed: true, fit: 0.023 })).toEqual({ to: "ring" })
    expect(routeClef({ choice: "globe", top: 0.55, second: CLOSE * 0.55, placed: true, fit: 0.02 }).to).toBe("ring")
    expect(routeClef({ choice: "globe", top: 0.55, second: CLOSE * 0.55 - 0.01, placed: true, fit: 0.02 }).to).toBe("replace")
  })

  test("writing, none, an unplaceable choice, doubt, a poor fit: Groq is asked", () => {
    expect(routeClef({ choice: "text", top: 0.73, second: 0.1, placed: false })).toEqual({ to: "groq", reason: "writing" })
    expect(routeClef({ choice: "none", top: 0.25, second: 0.2, placed: false }).to).toBe("groq")
    expect(routeClef({ choice: "mindVirus", top: 0.8, second: 0.1, placed: false }).to).toBe("groq")
    expect(routeClef({ choice: "sMark", top: SURE - 0.06, second: 0.1, placed: true, fit: 0.02 })).toMatchObject({ to: "groq" })
    // The live S-mark at 0.44 whose fit came out 0.041: poor fit wins the reason.
    expect(routeClef({ choice: "sMark", top: 0.44, second: 0.1, placed: true, fit: POOR + 0.011 })).toEqual({ to: "groq", reason: "poor fit 0.041" })
  })
})

describe("weighing Clef and Groq", () => {
  const clef: Reading = { via: "clef", candidates: [c("sMark", 0.44), c("regenaissance", 0.3)], fit: 0.041 }

  test("they agree: the better fit replaces, alone", () => {
    const r = merge({ ...clef, candidates: [c("sMark")] }, { via: "groq", candidates: [{ ...c("sMark"), params: { cx: 2 } }], fit: 0.02 })
    expect(r.candidates).toHaveLength(1)
    expect(r.candidates[0]!.params).toEqual({ cx: 2 })
    expect(r.fit).toBe(0.02)
  })

  test("they disagree: the ring, every chip labelled with its reader, all equally weighted", () => {
    const r = merge(clef, { via: "groq", candidates: [c("circle")], fit: 0.018 })
    expect(r.candidates.map((x) => `${x.via}:${x.symbol}`)).toEqual(["clef:sMark", "groq:circle", "clef:regenaissance"])
    expect(new Set(r.candidates.map((x) => x.confidence))).toEqual(new Set([0.5]))
    expect(r.candidates[1]!.label).toBe("groq · 0.018")
    expect(r.fit).toBe(0.018)
  })

  test("Groq found nothing: Clef's picks as a ring; nothing at all: nothing", () => {
    expect(merge(clef, { via: "groq", candidates: [] }).candidates.map((x) => x.symbol)).toEqual(["sMark", "regenaissance"])
    expect(merge(undefined, { via: "groq", candidates: [], notes: "words" })).toEqual({ candidates: [], notes: "words" })
  })

  test("writing: Clef had nothing to place, Groq's text replaces", () => {
    const text = { ...c("text"), params: { content: "DreamTalk" } }
    const r = merge(undefined, { via: "groq", candidates: [text] })
    expect(r.candidates).toEqual([{ ...text, confidence: 0.9 }])
  })
})
