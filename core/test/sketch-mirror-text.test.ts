/**
 * Text on the tablet's screen: the letters reach the display list as
 * filled outlines with their counters, laid out by the same HarfBuzz
 * layout the Mac's glyph mesh comes from, placed where the vocabulary says
 * the words stand. Run headless: HarfBuzz and the font come from disk.
 */

import { beforeAll, describe, expect, test } from "bun:test"
import { Text as MeshText } from "three-text"
import { configureGlyphs, onGlyphs, textOutline, whenGlyphsSettled } from "../sketch/glyphs"
import { flattenSymbol } from "../sketch/mirror"
import type { DisplayPrim } from "../sketch/protocol"
import { Text } from "../src/parts/text"
import { TEXT_ASCENDER_EM, TEXT_CAP_EM } from "../sketch/vocabulary"

const root = new URL("../../", import.meta.url).pathname

beforeAll(async () => {
  configureGlyphs({
    harfBuzz: await Bun.file(`${root}core/demo/wasm/hb.wasm`).arrayBuffer(),
    fontSource: (url) => Bun.file(root + url.replace(/^\//, "")).arrayBuffer(),
  })
})

type Fill = Extract<DisplayPrim, { k: "fill" }>

/** A text symbol's prims, after its layout has landed. */
const letters = async (params: Record<string, unknown>): Promise<Fill[]> => {
  flattenSymbol({ symbol: "text", params })
  await whenGlyphsSettled()
  return flattenSymbol({ symbol: "text", params }).filter((p): p is Fill => p.k === "fill")
}

const box = (fills: readonly Fill[]) => {
  const xs = fills.flatMap((f) => f.pts.filter((_, i) => i % 2 === 0))
  const ys = fills.flatMap((f) => f.pts.filter((_, i) => i % 2 === 1))
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

/** Signed area of one contour (page y down: positive = clockwise on the page). */
const area = (pts: readonly number[], from: number, n: number) => {
  let a = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    a += pts[2 * (from + i)]! * pts[2 * (from + j)! + 1]! - pts[2 * (from + j)]! * pts[2 * (from + i) + 1]!
  }
  return a / 2
}

describe("text on the tablet", () => {
  test("first asked, it is pending (no letters, not cached); then the letters land and say so", async () => {
    let landed = 0
    const off = onGlyphs(() => landed++)
    const params = { content: "pending", cx: 300, cy: 300, size: 50 }
    expect(flattenSymbol({ symbol: "text", params }).filter((p) => p.k === "fill")).toHaveLength(0)
    await whenGlyphsSettled()
    expect(landed).toBeGreaterThan(0)
    expect(flattenSymbol({ symbol: "text", params }).filter((p) => p.k === "fill")).toHaveLength(7)
    off()
  })

  test("the band constants are Arimo's own: capitals 1409, ascenders 1484 of 2048", async () => {
    const top = async (c: string) => {
      const t = new Text({ content: c, size: 2048 })
      textOutline(t)
      await whenGlyphsSettled()
      return Math.max(...textOutline(t)!.flat(2).map((p) => p.y))
    }
    for (const c of ["H", "D", "T", "E", "1", "7"]) expect(await top(c)).toBeCloseTo(TEXT_CAP_EM * 2048, 6)
    for (const c of ["b", "d", "h", "k", "l"]) expect(await top(c)).toBeCloseTo(TEXT_ASCENDER_EM * 2048, 6)
  })

  test("the words stand where the vocabulary puts them: the band centred on (cx, cy), `size` tall", async () => {
    // With a capital, the band is the capitals': H spans baseline → top exactly.
    const fills = await letters({ content: "lH", cx: 700, cy: 900, size: 100 })
    expect(fills).toHaveLength(2)
    const [l, H] = fills.map((f) => box([f]))
    expect(H!.y0).toBeCloseTo(850, 1)
    expect(H!.y1).toBeCloseTo(950, 1)
    // type's l overshoots a capital by Arimo's own ratio
    expect(l!.y0).toBeCloseTo(950 - 100 * (TEXT_ASCENDER_EM / TEXT_CAP_EM), 1) // the display list rounds to 0.1
    expect((box(fills).x0 + box(fills).x1) / 2).toBeCloseTo(700, 0)
    for (const f of fills) expect(f.grey).toBe(0)
    // Without one, the hand sized its tall letters: l spans the band.
    const low = box(await letters({ content: "hill", cx: 700, cy: 900, size: 100 }))
    expect(low.y0).toBeCloseTo(850, 1)
    expect(low.y1).toBeCloseTo(950, 1)
  })

  test("an `o` is one fill with its counter, wound against its outside", async () => {
    const [o] = await letters({ content: "o", cx: 400, cy: 400, size: 200 })
    expect(o!.rings).toHaveLength(2)
    const [outer, inner] = o!.rings!
    expect(outer! + inner!).toBe(o!.pts.length / 2)
    const a = area(o!.pts, 0, outer!)
    const b = area(o!.pts, outer!, inner!)
    expect(Math.sign(a)).toBe(-Math.sign(b))
    expect(Math.abs(b)).toBeLessThan(Math.abs(a))
  })

  test("the outline is the mesh's outline: same layout, same anchoring, same ink box", async () => {
    const t = new Text({ content: "Liminal ego", size: 80 })
    textOutline(t)
    await whenGlyphsSettled()
    const rings = textOutline(t)!.flat(2)
    const xs = rings.map((p) => p.x)
    const ys = rings.map((p) => p.y)
    // The Mac's mesh, built exactly as render/text.ts builds it, then anchored the same way.
    const mesh = (await MeshText.create({
      text: "Liminal ego",
      font: await Bun.file(`${root}core/demo/fonts/Arimo-Regular.ttf`).arrayBuffer(),
      size: 80,
      depth: 0,
      perGlyphAttributes: true,
      removeOverlaps: true,
      layout: { align: "center" },
    })) as unknown as { geometry: { computeBoundingBox(): void; boundingBox: { min: { x: number; y: number }; max: { x: number; y: number } } } }
    mesh.geometry.computeBoundingBox()
    const m = mesh.geometry.boundingBox
    const mid = (m.min.x + m.max.x) / 2
    expect(Math.min(...xs)).toBeCloseTo(m.min.x - mid, 0)
    expect(Math.max(...xs)).toBeCloseTo(m.max.x - mid, 0)
    expect(Math.min(...ys)).toBeCloseTo(m.min.y, 0)
    expect(Math.max(...ys)).toBeCloseTo(m.max.y, 0)
  })

  test("several lines, each centred on the block's axis; turned with the words", async () => {
    const level = await letters({ content: "a\nwide line", cx: 700, cy: 900, size: 60 })
    const top = level.filter((f) => box([f]).y1 < 900)
    const bottom = level.filter((f) => box([f]).y0 > 900)
    expect(top.length).toBe(1)
    expect(bottom.length).toBe(8)
    expect((box(top).x0 + box(top).x1) / 2).toBeCloseTo(700, 0)
    expect((box(bottom).x0 + box(bottom).x1) / 2).toBeCloseTo(700, 0)
    // a quarter turn clockwise on the page: the block now runs downwards
    const turned = box(await letters({ content: "a\nwide line", cx: 700, cy: 900, size: 60, rotation: Math.PI / 2 }))
    expect(turned.y1 - turned.y0).toBeGreaterThan(turned.x1 - turned.x0)
  })
})
