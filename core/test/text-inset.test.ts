/**
 * The traced letter sits INSIDE its own letterform (parts/outline.ts
 * insetLoop, render/text.ts buildOutlines): every contour is pulled in by
 * half the pen, so the ribbon's outer edge lands back on the true
 * outline. The mirror e2e caught `r e a m` drawn half a pen bolder than
 * `D` — their contours had been refused the inset whole, because a
 * single short tessellation edge beside a sharp corner flipped under the
 * offset. These tests hold the real glyphs (HarfBuzz + Arimo from disk,
 * exactly the geometry render/text.ts traces) to the outline, letter by
 * letter, and pin the short-edge corner on its own.
 */

import { beforeAll, describe, expect, test } from "bun:test"
import { Text as ThreeText } from "three-text"
import { boundaryLoops, insetLoop, insetLoopDeepest, type Loop } from "../src/parts/outline"

const core = new URL("../", import.meta.url).pathname

/** Distance from p to the closed polyline `loop`. */
const distanceTo = (p: { x: number; y: number }, loop: Loop): number => {
  let best = Infinity
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!
    const b = loop[(i + 1) % loop.length]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)))
  }
  return best
}

/** Even-odd inside test against every contour of one glyph. */
const insideGlyph = (p: { x: number; y: number }, loops: Loop[]): boolean => {
  let inside = false
  for (const loop of loops) {
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i]!
      const b = loop[j]!
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside
      }
    }
  }
  return inside
}

let glyphs: Loop[][] = []
const TEXT = "DreamTalk"

beforeAll(async () => {
  ThreeText.setHarfBuzzPath(`file://${core}demo/wasm/hb.wasm`)
  const handle = (await ThreeText.create({
    text: TEXT,
    font: `file://${core}demo/fonts/Arimo-Regular.ttf`,
    size: 50,
    depth: 0,
    perGlyphAttributes: true,
    removeOverlaps: true,
  })) as unknown as { geometry: import("three").BufferGeometry }
  const g = handle.geometry
  const positions = g.getAttribute("position").array as ArrayLike<number>
  const glyphIndex = g.getAttribute("glyphIndex")!
  const indices = g.getIndex()!.array as ArrayLike<number>
  let count = 0
  for (let i = 0; i < glyphIndex.count; i++) count = Math.max(count, glyphIndex.getX(i) + 1)
  glyphs = Array.from({ length: count }, (_, k) =>
    boundaryLoops(positions, indices, (t) => glyphIndex.getX(indices[t * 3]!) === k),
  )
})

describe("traced letters sit half a pen inside their outline", () => {
  // At size 50 Arimo's stems are ~5 units; 1 unit is a 2.56px pen at the
  // default 1.28 px/unit — the scale video-01's text is traced at.
  const d = 1

  test("every contour of every letter takes the inset", () => {
    expect(glyphs.length).toBe([...TEXT].length)
    for (const [k, loops] of glyphs.entries()) {
      for (const loop of loops) {
        // `toBe(loop)` would mean refused: the pen straddling the true
        // outline, the letter half a pen bolder than its neighbours.
        expect({ letter: [...TEXT][k], refused: insetLoop(loop, d) === loop }).toEqual({
          letter: [...TEXT][k],
          refused: false,
        })
      }
    }
  })

  test("the inset edge is a pen-half from the outline and inside the letter", () => {
    for (const [k, loops] of glyphs.entries()) {
      for (const loop of loops) {
        const inset = insetLoop(loop, d)
        const distances = inset.map((p) => distanceTo(p, loop)).sort((a, b) => a - b)
        const median = distances[Math.floor(distances.length / 2)]!
        // Uniformly a pen-half in; never pushed OUT past the outline
        // (inside the letter) and never further in than the offset.
        expect({ letter: [...TEXT][k], median: +median.toFixed(2) }).toEqual({
          letter: [...TEXT][k],
          median: d,
        })
        // An inner (reflex) corner's miter sits further from the corner
        // point itself (√2·d at 90°), bounded by insetLoop's 3x cap.
        expect(distances[distances.length - 1]!).toBeLessThanOrEqual(d * 3 + 1e-9)
        // The miter cap pulls only needle corners short of the offset.
        expect(distances[0]!).toBeGreaterThan(d * 0.3)
        for (const p of inset) expect(insideGlyph(p, loops)).toBe(true)
      }
    }
  })

  test("a stem narrower than the pen is still refused, not folded", () => {
    // Half of Arimo's `l` stem is ~2.4 units: an inset of 3 would turn it
    // inside out, so its contour comes back untouched.
    const l = glyphs[[...TEXT].indexOf("l")]!
    expect(insetLoop(l[0]!, 3)).toBe(l[0]!)
  })
})

describe("insetLoop — a short edge beside a corner is trimmed, not a fold", () => {
  test("the corner's swallowtail is cut where the offset edges meet", () => {
    // A 10x10 square whose bottom-right corner carries a 0.2 sliver edge
    // (the tessellation shape that tripped Arimo's `r`), inset by 1.
    const loop: Loop = [
      { x: 0, y: 0, z: 0 },
      { x: 9.8, y: 0, z: 0 },
      { x: 10, y: 0.05, z: 0 },
      { x: 10, y: 10, z: 0 },
      { x: 0, y: 10, z: 0 },
    ]
    const inset = insetLoop(loop, 1)
    expect(inset).not.toBe(loop)
    for (const p of inset) {
      expect(p.x).toBeGreaterThan(0.99)
      expect(p.x).toBeLessThan(9.01)
      expect(p.y).toBeGreaterThan(0.99)
      expect(p.y).toBeLessThan(9.01)
    }
    // The trimmed corner lands on the true inset corner region.
    const corner = inset.reduce((best, p) => (p.x - p.y > best.x - best.y ? p : best))
    expect(corner.x).toBeCloseTo(9, 1)
    expect(corner.y).toBeCloseTo(1, 1)
  })
})

describe("insetLoopDeepest — never fatter than the letterform", () => {
  test("where the full half-pen fits, it IS insetLoop (unchanged)", () => {
    for (const loops of glyphs) {
      for (const loop of loops) {
        const deep = insetLoopDeepest(loop, 1)
        expect(deep.depth).toBe(1)
        expect(deep.loop).toEqual(insetLoop(loop, 1))
      }
    }
  })

  test("a stem narrower than the pen goes as deep as it can, and the pen narrows to match", () => {
    // Inset 3 folds the `l`, `T` and `k` stems (half-stem ~2.4). Each
    // contour instead takes the deepest inset that does not fold; drawn
    // with a pen of twice that depth, its edge still lands on the outline.
    for (const [k, loops] of glyphs.entries()) {
      for (const loop of loops) {
        const { loop: inset, depth } = insetLoopDeepest(loop, 3)
        expect(depth).toBeGreaterThan(0)
        expect(depth).toBeLessThanOrEqual(3)
        if (depth === 3) continue
        // Its narrowest place sets the depth (the `r` arm's junction: ~0.8).
        expect({ letter: [...TEXT][k], partial: depth > 0.5 }).toEqual({ letter: [...TEXT][k], partial: true })
        const distances = inset.map((p) => distanceTo(p, loop)).sort((a, b) => a - b)
        expect(distances[Math.floor(distances.length / 2)]!).toBeCloseTo(depth, 1)
        for (const p of inset) expect(insideGlyph(p, loops)).toBe(true)
      }
    }
  })
})
