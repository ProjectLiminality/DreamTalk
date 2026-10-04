/**
 * fit.ts — the symbol tuned onto the ink. The optimisers on functions whose
 * minimum is known, the chamfer on outlines whose distance is known, the
 * pose shortcut against the real flattening, and the fit itself on seeded
 * hand-drawn scribbles (test/scribbles.ts) whose true params are known.
 */

import { describe, expect, test } from "bun:test"
import {
  compassSearch,
  degenerate,
  fastOutline,
  fitSymbol,
  instantReading,
  nelderMead,
  prepareInk,
  raceVocabulary,
  refineResponse,
  scoreOutline,
  symbolOutline,
  traceTail,
  type Pt,
} from "../sketch/fit"
import type { InkStroke } from "../sketch/protocol"
import { DEFAULT_IMPORTS } from "../sketch/vocabulary"
import { roughCylinder, roughFlower, roughMindVirus, roughSquare, roughTriangle, wobblyCircle } from "./scribbles"

const VOCAB = [...new Set([...DEFAULT_IMPORTS, "cylinder"])]

const inkOf = (polys: Pt[][]): InkStroke[] =>
  polys.map((pts, i) => ({ id: `k${i}`, points: pts.map((p, t) => ({ ...p, pressure: 0.5, t })) }))

const ring = (cx: number, cy: number, r: number, n = 96): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: cx + r * Math.cos((i / n) * 2 * Math.PI), y: cy + r * Math.sin((i / n) * 2 * Math.PI) }))

describe("the optimisers", () => {
  const bowl = (x: number[]) => (x[0]! - 3) ** 2 + 10 * (x[1]! + 1) ** 2 + 0.5 * (x[2]! - 0.5) ** 2

  test("Nelder–Mead finds a bowl's bottom within its budget", () => {
    const r = nelderMead(bowl, [0, 0, 0], [1, 1, 1], 400)
    expect(r.f).toBeLessThan(1e-4)
    expect(r.x[0]!).toBeCloseTo(3, 1)
    expect(r.x[1]!).toBeCloseTo(-1, 1)
    expect(r.evals).toBeLessThanOrEqual(400)
    // The history is the best-so-far: it never rises.
    for (let i = 1; i < r.history.length; i++) expect(r.history[i]!).toBeLessThanOrEqual(r.history[i - 1]!)
  })

  test("compass search gets there too, and stops at its budget", () => {
    const r = compassSearch(bowl, [0, 0, 0], [1, 1, 1], 600)
    expect(r.f).toBeLessThan(1e-3)
    expect(r.evals).toBeLessThanOrEqual(600)
  })
})

describe("the chamfer score", () => {
  test("ink exactly on the outline scores ~0; moving it away costs in proportion", () => {
    const o = [ring(500, 500, 100)]
    const ink = prepareInk(inkOf(o))!
    expect(scoreOutline(ink, o).total).toBeLessThan(0.002)
    const off = scoreOutline(ink, [ring(510, 500, 100)])
    const far = scoreOutline(ink, [ring(530, 500, 100)])
    expect(off.total).toBeGreaterThan(0.01)
    expect(far.total).toBeGreaterThan(2 * off.total)
  })

  test("the two directions say different things: missing ink vs invented outline", () => {
    const ink = prepareInk(inkOf([ring(500, 500, 100)]))!
    // A symbol with an extra ring the person never drew: the ink is all explained…
    const extra = scoreOutline(ink, [ring(500, 500, 100), ring(560, 500, 100)])
    expect(extra.inkToSymbol).toBeLessThan(0.002)
    // …but the symbol invented half of itself.
    expect(extra.symbolToInk).toBeGreaterThan(0.03)
  })
})

describe("the pose shortcut", () => {
  test.each([
    ["circle", { cx: 300, cy: 900, r: 80 }],
    ["square", { cx: 1200, cy: 300, size: 260, rotation: 0.7 }],
    ["flowerOfLife", { cx: 700, cy: 650, r: 55, rings: "1", rotation: -0.4 }],
  ])("%s: the posed template scores as the flattening does (within 1 %%)", (symbol, params) => {
    // Ink drawn somewhere else entirely, so the score has something to measure.
    const ink = prepareInk(wobblyCircle(1, 700, 600, 150))!
    const exact = scoreOutline(ink, symbolOutline(symbol, params))
    const fast = scoreOutline(ink, fastOutline(symbol, params, true))
    expect(Math.abs(fast.total - exact.total)).toBeLessThan(0.01 * exact.total)
  })
})

describe("fitting one reading", () => {
  test("a wobbly circle: a rough guess is pulled onto the ink", () => {
    const ink = wobblyCircle(7, 600, 500, 120)
    const fit = fitSymbol(ink, { symbol: "circle", params: { cx: 630, cy: 470, r: 150 } })
    expect(fit.score.total).toBeLessThan(fit.initial.total / 2)
    expect(Math.hypot(Number(fit.params.cx) - 600, Number(fit.params.cy) - 500)).toBeLessThan(8)
    expect(Math.abs(Number(fit.params.r) - 120)).toBeLessThan(10)
  })

  test("a triangle's angle and size come from the ink, not the guess", () => {
    const ink = roughTriangle(3)
    const fit = fitSymbol(ink, { symbol: "triangle", params: { cx: 590, cy: 515, r: 110, rotation: -1.3 } })
    expect(fit.score.total).toBeLessThan(0.012)
    expect(fit.score.total).toBeLessThan(fit.initial.total)
  })

  test("a cylinder (the analytic outline) finds its height and the caps' tilt", () => {
    const ink = roughCylinder(2, 900, 600, 70, 220)
    const fit = fitSymbol(ink, { symbol: "cylinder", params: { cx: 880, cy: 620, radius: 90, height: 180, p: 0.4, b: 0.1 } })
    expect(fit.score.total).toBeLessThan(0.012)
    expect(Math.abs(Number(fit.params.radius) - 70)).toBeLessThan(10)
    // The page shows the axis foreshortened: height·cos p ≈ the drawn 220.
    expect(Math.abs(Number(fit.params.height) * Math.cos(Number(fit.params.p)) - 220)).toBeLessThan(20)
  })

  test("the MindVirus tail is traced from the ink: with no cable given, the fit finds one", async () => {
    const { ink, tail } = roughMindVirus(1)
    const fit = fitSymbol(ink, { symbol: "mindVirus", params: { x: 880, y: 620, size: 180, heading: 0.2, fold: 1 } }, { maxMs: 150 })
    const cable = fit.params.cable as [number, number][]
    expect(cable.length).toBe(16)
    // Ordered free end → body: it starts where the drawn tail starts, far left.
    expect(Math.hypot(cable[0]![0] - tail[0]!.x, cable[0]![1] - tail[0]!.y)).toBeLessThan(30)
    expect(fit.score.total).toBeLessThan(0.02)
    expect(Math.abs(Number(fit.params.x) - 900)).toBeLessThan(15)
  })

  test("traceTail: the longest run of ink outside the body, free end first", () => {
    const { ink, tail } = roughMindVirus(2)
    const t = traceTail(ink, { x: 900, y: 600, size: 160 })!
    expect(t).toHaveLength(16)
    expect(t[0]![0]).toBeLessThan(t[15]![0]) // the tail trails off to the left, the body is right
    expect(Math.abs(t[0]![0] - tail[0]!.x)).toBeLessThan(30)
    // No ink leaves a lone circle's body: no tail.
    expect(traceTail(wobblyCircle(1, 600, 500, 60), { x: 600, y: 500, size: 120 })).toBeUndefined()
  })

  test("refineResponse refines shapes and leaves words alone", () => {
    const ink = wobblyCircle(2)
    const { response, fits } = refineResponse(ink, {
      candidates: [
        { symbol: "circle", params: { cx: 640, cy: 520, r: 100 }, confidence: 0.9, why: "" },
        { symbol: "text", params: { content: "o", cx: 600, cy: 500, size: 200, rotation: 0 }, confidence: 0.1, why: "" },
      ],
    })
    expect(fits).toHaveLength(1)
    expect(Number(response.candidates[0]!.params.cx)).toBeLessThan(620)
    expect(response.candidates[1]!.params.content).toBe("o")
  })
})

describe("racing the vocabulary (no model)", () => {
  test.each([
    ["circle", wobblyCircle(5)],
    ["triangle", roughTriangle(5)],
    ["square", roughSquare(5)],
    ["flowerOfLife", roughFlower(5)],
    ["cylinder", roughCylinder(5)],
  ] as const)("a rough %s wins its own race", (symbol, ink) => {
    const fits = raceVocabulary(ink, VOCAB, { maxEvals: 120 })
    expect(fits[0]!.symbol).toBe(symbol)
  })

  test("a clear shape is answered at once — the MindVirus too, its tail traced", () => {
    const circle = instantReading(wobblyCircle(9), VOCAB, { maxEvals: 120 })
    expect(circle?.response.candidates[0]?.symbol).toBe("circle")
    const virus = instantReading(roughMindVirus(9).ink, VOCAB, { maxEvals: 120 })
    expect(virus?.response.candidates[0]?.symbol).toBe("mindVirus")
    expect(Math.abs(Number(virus!.response.candidates[0]!.params.heading))).toBeLessThan(0.2) // swims right, away from its tail
  })

  test("a degenerate reading never answers: a cylinder with no height is an ellipse", () => {
    expect(degenerate({ symbol: "cylinder", params: { cx: 0, cy: 0, radius: 100, height: 5, p: 0.4, b: 0 } })).toBe(true)
    expect(degenerate({ symbol: "cylinder", params: { cx: 0, cy: 0, radius: 100, height: 200, p: 0.05, b: 0 } })).toBe(true)
    expect(degenerate({ symbol: "cylinder", params: { cx: 0, cy: 0, radius: 70, height: 220, p: 0.4, b: 0 } })).toBe(false)
    const flat = inkOf([Array.from({ length: 100 }, (_, i) => ({ x: 600 + 200 * Math.cos(i / 15.7), y: 500 + 80 * Math.sin(i / 15.7) }))])
    expect(instantReading(flat, VOCAB, { maxEvals: 120 })).toBeUndefined()
  })
})
