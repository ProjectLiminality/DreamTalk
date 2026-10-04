/**
 * Live distill (sketch/livedistill.ts): a SEARCH — passes re-tracing each
 * other, drawn one right after another — distils the moment the pen rests;
 * handwriting, a single stroke, or passes drawn apart in time never do.
 */

import { describe, expect, test } from "bun:test"
import type { Pt } from "../sketch/distill"
import { PAUSE_MS, isSearch, joins, nextSearch, overlap, ripe, type Pass, type Search } from "../sketch/livedistill"

const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}

const line = (a: Pt, b: Pt, n = 30): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }))

/** An elliptical arc, page angles (y down), from a0 to a1. */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 48): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }
  })

/** Feed passes as a hand draws them: each `dur` ms long, `gap` ms apart. Returns every state seen. */
const draw = (strokes: Pt[][], dur = 300, gap = 120) => {
  let cur: Search | undefined
  let t = 0
  const seen: { search: Search; done?: Search }[] = []
  strokes.forEach((points, i) => {
    const pass: Pass = { id: `k${i}`, points, start: t, end: t + dur }
    t += dur + gap
    const r = nextSearch(cur, pass)
    cur = r.search
    seen.push(r)
  })
  return { cur, seen, t }
}

/** n loops round one circle, each wobbling as a searching hand does. */
const loops = (n: number, cx = 600, cy = 600, R = 200, seed = 3): Pt[][] => {
  const r = rng(seed)
  return Array.from({ length: n }, () => {
    const dr = (r() - 0.5) * 16
    const ox = (r() - 0.5) * 10
    const oy = (r() - 0.5) * 10
    const a0 = r() * Math.PI * 2
    return arc(cx + ox, cy + oy, R + dr, R + dr, a0, a0 + Math.PI * 2.05, 120)
  })
}

describe("live distill: what is a search", () => {
  test("loops traced round and round are ONE search, ripe only once the pen has rested", () => {
    const { cur, seen } = draw(loops(6))
    expect(seen.every((s) => !s.done)).toBe(true)
    expect(cur!.ids).toEqual(["k0", "k1", "k2", "k3", "k4", "k5"])
    expect(ripe(cur, cur!.endedAt + PAUSE_MS - 1)).toBe(false)
    expect(ripe(cur, cur!.endedAt + PAUSE_MS)).toBe(true)
  })

  test("a bundle of partial passes along a curve is a search", () => {
    const r = rng(9)
    const curve = (t: number): Pt => ({ x: 200 + 500 * t, y: 900 + 90 * Math.sin(Math.PI * 2 * t) })
    const passes = Array.from({ length: 5 }, () => {
      const t0 = r() * 0.25
      const t1 = 0.7 + r() * 0.3
      const off = (r() - 0.5) * 8
      return Array.from({ length: 61 }, (_, i) => {
        const p = curve(t0 + ((t1 - t0) * i) / 60)
        return { x: p.x, y: p.y + off }
      })
    })
    expect(draw(passes).cur!.ids.length).toBe(5)
  })

  test("a single stroke is never a search — however many times it loops", () => {
    const one = loops(8).flat()
    const { cur } = draw([one])
    expect(isSearch(cur)).toBe(false)
    expect(ripe(cur, 1e9)).toBe(false)
  })

  test("passes drawn apart in time are separate (the pen rested between them)", () => {
    const [a, b] = loops(2)
    const s = nextSearch(undefined, { id: "a", points: a!, start: 0, end: 300 }).search
    expect(joins(s, { id: "b", points: b!, start: 300 + PAUSE_MS + 1, end: 1500 })).toBe(false)
    expect(joins(s, { id: "b", points: b!, start: 300 + PAUSE_MS - 1, end: 1500 })).toBe(true)
  })

  test("a stroke elsewhere ends the search, handing it over to distil at once", () => {
    const { seen } = draw([...loops(3), line({ x: 100, y: 1500 }, { x: 400, y: 1500 })])
    const last = seen[seen.length - 1]!
    expect(last.done?.ids).toEqual(["k0", "k1", "k2"])
    expect(last.search.ids).toEqual(["k3"])
    // ...and a lone stroke ending is nothing to hand over
    const two = draw([line({ x: 0, y: 0 }, { x: 300, y: 0 }), line({ x: 0, y: 900 }, { x: 300, y: 900 })])
    expect(two.seen[1]!.done).toBeUndefined()
  })

  test("the tolerance grows with the drawing: a big circle's wandering passes still count", () => {
    const big = loops(2, 700, 900, 600, 21) // passes up to ~8 units apart on a 1200-wide circle
    expect(overlap({ paths: [big[0]!] }, big[1]!).near).toBe(30)
    expect(draw(big).cur!.ids.length).toBe(2)
  })
})

describe("live distill: handwriting never distils", () => {
  // A cap band 60 units tall (a hand writing on the rM2), x-height 36, baseline y = 400.
  const B = 400
  const X = B - 36
  const T = B - 60
  /** Every stroke of the word, in writing order, letters `adv` apart. */
  const letters: Record<string, (x: number) => Pt[][]> = {
    h: (x) => [line({ x, y: T }, { x, y: B }), [...line({ x, y: B - 6 }, { x, y: X + 4 }, 4), ...arc(x + 12, X + 10, 12, 10, Math.PI, 2 * Math.PI, 16), ...line({ x: x + 24, y: X + 10 }, { x: x + 24, y: B })]],
    e: (x) => [[...line({ x, y: B - 18 }, { x: x + 26, y: B - 18 }, 10), ...arc(x + 13, B - 18, 13, 17, 0, -Math.PI * 1.75, 30)]],
    l: (x) => [line({ x, y: T }, { x, y: B })],
    o: (x) => [arc(x + 14, B - 18, 14, 18, -Math.PI / 2, Math.PI * 1.55, 40)],
    // bowl, then the stem down its right side
    a: (x) => [arc(x + 13, B - 17, 13, 17, -Math.PI / 4, Math.PI * 1.8, 40), line({ x: x + 26, y: X }, { x: x + 26, y: B })],
    // ...hugging it, a little inside (the closest an `a` comes to a retrace)
    α: (x) => [arc(x + 13, B - 17, 13, 17, -Math.PI / 4, Math.PI * 1.8, 40), line({ x: x + 24, y: X - 4 }, { x: x + 24, y: B })],
    d: (x) => [arc(x + 13, B - 17, 13, 17, -Math.PI / 4, Math.PI * 1.8, 40), line({ x: x + 25, y: T }, { x: x + 25, y: B })],
    t: (x) => [line({ x: x + 8, y: T + 6 }, { x: x + 8, y: B }), line({ x, y: X }, { x: x + 20, y: X })],
    i: (x) => [line({ x: x + 4, y: X }, { x: x + 4, y: B }), arc(x + 4, X - 12, 1.5, 1.5, 0, Math.PI * 2, 8)],
    E: (x) => [line({ x, y: T }, { x, y: B }), line({ x, y: T }, { x: x + 30, y: T }), line({ x, y: B - 30 }, { x: x + 24, y: B - 30 }), line({ x, y: B }, { x: x + 30, y: B })],
    H: (x) => [line({ x, y: T }, { x, y: B }), line({ x: x + 34, y: T }, { x: x + 34, y: B }), line({ x, y: B - 30 }, { x: x + 34, y: B - 30 })],
    A: (x) => [[...line({ x, y: B }, { x: x + 18, y: T }), ...line({ x: x + 18, y: T }, { x: x + 36, y: B })], line({ x: x + 8, y: B - 22 }, { x: x + 28, y: B - 22 })],
    x: (x) => [line({ x, y: X }, { x: x + 26, y: B }), line({ x: x + 26, y: X }, { x, y: B })],
    "=": (x) => [line({ x, y: B - 22 }, { x: x + 30, y: B - 22 }), line({ x, y: B - 12 }, { x: x + 30, y: B - 12 })],
    "4": (x) => [[...line({ x: x + 22, y: T }, { x, y: B - 18 }), ...line({ x, y: B - 18 }, { x: x + 32, y: B - 18 })], line({ x: x + 24, y: T + 10 }, { x: x + 24, y: B })],
  }
  const word = (w: string, x0 = 100, adv = 36) => w.split("").flatMap((c, i) => letters[c]!(x0 + i * adv))

  for (const w of ["hello", "the", "lilt", "a", "α", "dad", "EHA", "x=4", "tea", "hall"]) {
    test(`"${w}", written quickly, forms no search`, () => {
      const { seen } = draw(word(w), 250, 80)
      for (const s of seen) {
        expect(s.search.ids.length).toBe(1)
        expect(s.done).toBeUndefined()
      }
    })
  }

  test("a letter written small (the = sign at half size) still forms no search", () => {
    const small = word("=", 100, 36).map((k) => k.map((p) => ({ x: 100 + (p.x - 100) / 2, y: B + (p.y - B) / 2 })))
    expect(draw(small).seen.every((s) => s.search.ids.length === 1)).toBe(true)
  })

  test("but a letter TRACED OVER again is a search (that is what retracing means)", () => {
    const o = letters.o!(100)[0]!
    const again = o.map((p) => ({ x: p.x + 1.5, y: p.y - 1 }))
    expect(draw([o, again]).cur!.ids.length).toBe(2)
  })
})
