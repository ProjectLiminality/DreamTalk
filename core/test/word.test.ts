/**
 * Glyphs, Word and MorphToWord — a symbol becoming its written word.
 */

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { readTTF } from "../src/geometry/ttf"
import { flattenContour, wordOutline } from "../src/geometry/glyphs"
import { ARIMO } from "../src/geometry/fonts/arimo"
import { correspond, cumulative } from "../src/geometry/correspond"
import { Word } from "../vocabulary/Word/Word"
import { MorphToWord } from "../vocabulary/Morph/MorphToWord"
import { MorphMany, curvesOf } from "../vocabulary/Morph/MorphCurves"
import { Truck } from "../vocabulary/Truck/Truck"
import { MindVirus } from "../vocabulary/MindVirus/MindVirus"
import { Observer } from "../src/dream"
import { Line, type Vec3Like } from "../src/parts/primitives"

const area = (c: { x: number; y: number }[]) => {
  let a = 0
  for (let i = 1; i < c.length; i++) a += c[i - 1]!.x * c[i]!.y - c[i]!.x * c[i - 1]!.y
  return a / 2
}

describe("the font as data", () => {
  test("the baked face is the font file's own outlines", () => {
    const font = readTTF(readFileSync(new URL("../demo/fonts/Arimo-Regular.ttf", import.meta.url).pathname), [0x61, 0xe9])
    for (const cp of [0x61, 0xe9]) {
      const read = font.glyphs.get(cp)!
      const baked = ARIMO.glyphs[cp]!
      expect(baked[0]).toBe(read.advance)
      expect(baked[1].map((c) => c.length / 3)).toEqual(read.contours.map((c) => c.length))
    }
  })

  test("contours per letter: counters and composites", () => {
    const count = (w: string) => wordOutline(w, ARIMO).length
    expect(count("o")).toBe(2) // and its counter
    expect(count("B")).toBe(3)
    expect(count("é")).toBe(3) // a composite: e (2) + the acute (1)
    expect(count("Mind Virus")).toBe(12)
  })

  test("every contour closes, the word is centred, and an 'o' has a hole of opposite winding", () => {
    const o = wordOutline("o", ARIMO, { size: 100 })
    for (const c of o) expect(c[0]).toEqual(c.at(-1)!)
    const pts = o.flat()
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(0, 6)
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(0, 6)
    const [a, b] = o.map(area)
    expect(Math.sign(a!)).toBe(-Math.sign(b!))
  })

  test("flattening an all-on contour returns it, closed", () => {
    const sq = flattenContour([0, 0, 1, 10, 0, 1, 10, 10, 1, 0, 10, 1], 1)
    expect(sq).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ])
  })
})

describe("Word", () => {
  test("one closed Line per contour, filled", () => {
    const w = new Word("truck", { size: 80 })
    void w.parts
    expect(w.contours.length).toBe(5)
    expect(w.fillOpacity.value).toBe(1)
    for (const l of w.contours) expect(l.points[0]).toEqual(l.points.at(-1)!)
  })

  test("facing the camera, it turns as a whole — its contours stay in its own plane", () => {
    const obs = new Observer({ phi: 0.62, theta: 0.3 })
    const w = new Word("hi", { observer: obs })
    void w.parts
    for (const l of w.contours) for (const p of l.points) expect(p.z).toBe(0)
    expect(w.h.value).not.toBe(0)
  })
})

describe("sweep-angular", () => {
  test("keeps the sweep's shares and covers every target exactly once", () => {
    const arcs = Array.from({ length: 6 }, (_, k) => [
      { x: k * 50, y: 0, z: 0 },
      { x: k * 50 + 30, y: 40, z: 0 },
    ])
    const letters = wordOutline("ab", ARIMO, { size: 100 })
    const sweep = correspond(arcs, letters, { order: "sweep" })
    const gathered = correspond(arcs, letters, { order: "sweep-angular" })
    const share = (ps: typeof sweep.pieces, t: number) =>
      ps.filter((p) => p.target === t).reduce((s, p) => s + Math.abs(p.to[1] - p.to[0]), 0)
    letters.forEach((c, t) => {
      expect(share(gathered.pieces, t)).toBeCloseTo(cumulative(c).at(-1)!, 6)
      expect(share(gathered.pieces, t)).toBeCloseTo(share(sweep.pieces, t), 6)
    })
  })
})

describe("MorphToWord", () => {
  test("via the line (default): the symbol settles into one line, the letters rise from it — and it builds all of it", () => {
    const obs = new Observer({ phi: 0.6, theta: 0.3 })
    const truck = new Truck({ observer: obs })
    const m = MorphToWord(truck, "truck", { observer: obs })
    expect(m.holons.length).toBe(7)
    const line = m.holons.find((h): h is Line => h instanceof Line)!
    expect(line.points.length).toBe(2)
    // Squashed, not re-drawn: every stroke ends ON the line, within its span.
    m.toWord.morph.value = 1
    m.toWord.opacity.value = 1 // drawn (a hidden morpher reads nothing)
    const [a, b] = line.points as [Vec3Like, Vec3Like]
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    const ink = m.toWord.parts.filter((p): p is Line => p instanceof Line).filter((l) => l.points.length >= 2)
    expect(ink.length).toBeGreaterThan(10)
    for (const l of ink)
      for (const p of l.points) {
        const s = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y) + (p.z - a.z) * (b.z - a.z)) / len
        expect(s).toBeGreaterThan(-1e-6 * len)
        expect(s).toBeLessThan(len * (1 + 1e-6))
        const q = { x: a.x + ((b.x - a.x) * s) / len, y: a.y + ((b.y - a.y) * s) / len, z: a.z + ((b.z - a.z) * s) / len }
        expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(1e-6 * len)
      }
    // At the middle of `there()`, the line is shown and nothing else is drawn.
    const tracks = m.there().tracks
    const shows = tracks.filter((t) => t.param === line.opacity && t.values[0] === 1)
    expect(shows.length).toBe(1)
    expect(shows[0]!.relStop).toBeCloseTo(0.45, 6)
    // …and it is held: the word appears only after 0.58.
    const word = tracks.filter((t) => t.param === m.word.opacity && t.values[0] === 1)
    expect(word[0]!.relStart).toBeGreaterThan(0.53)
  })

  test("the word stands where the symbol is, as wide as it, and both morphs read both", () => {
    const obs = new Observer({ phi: 0.6, theta: 0.3 })
    const truck = new Truck({ observer: obs, x: 100 })
    const m = MorphToWord(truck, "truck", { observer: obs, via: "none" })
    expect(m.word.x.value).toBeCloseTo(100, 6)
    expect(m.word.opacity.value).toBe(0)
    m.toWord.morph.value = 1
    m.toWord.opacity.value = 1 // drawn (a hidden morpher reads nothing)
    void m.toWord.parts
    const ink = m.toWord.parts.filter((p): p is Line => p instanceof Line).filter((l) => l.points.length >= 2)
    expect(ink.length).toBeGreaterThanOrEqual(5)
  })

  test("a composite leaves whole: every part that owns its opacity is hidden by the verb", () => {
    const virus = new MindVirus({})
    void virus.parts
    expect(curvesOf(virus).length).toBeGreaterThan(5)
    const m = MorphToWord(virus, "Mind Virus", { via: "none" })
    const hidden = new Set(MorphMany(m.toWord).tracks.filter((t) => t.values[0] === 0 && t.param.name === "opacity").map((t) => t.param))
    for (const n of virus.walk()) if (!n.opacity.isBound && n.opacity.defaultValue > 0) expect(hidden.has(n.opacity)).toBe(true)
  })
})
