import { describe, expect, test } from "bun:test"
import { COMPOSED, DRAWN_ICONS, ICON_NAMES, ICON_ROWS, Icon, glyphPaths, icon } from "../vocabulary/Icons/Icons"
import { RING_COUNT, RadioTower, TOWER_ASPECT, TOWER_RAW, ringPresence, towerPath } from "../vocabulary/RadioTower/RadioTower"
import { BOOK_ASPECT, BOOK_TRACE, Book, LEFT_COVER, bookPath } from "../vocabulary/Book/Book"
import { slide22 } from "../vocabulary/Slides/assets/pl02/slide22"
import { slide24 } from "../vocabulary/Slides/assets/pl02/slide24"
import { SPHERES } from "../vocabulary/Spheres/Spheres"

const box = (runs: { x: number; y: number }[][]) => {
  const xs = runs.flatMap((r) => r.map((p) => p.x))
  const ys = runs.flatMap((r) => r.map((p) => p.y))
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

describe("Icons — the film's props (an invisible asset)", () => {
  test("not sovereign; the two concept icons are", () => {
    expect((Icon as unknown as { sovereign?: boolean }).sovereign).toBeUndefined()
    expect(RadioTower.sovereign).toBe(true)
    expect(Book.sovereign).toBe(true)
  })

  test("every drawn icon is centred and its larger side is `size`", () => {
    for (const name of DRAWN_ICONS) {
      const b = box(glyphPaths(name, 2).map((r) => r.points))
      expect(Math.max(b.x1 - b.x0, b.y1 - b.y0)).toBeCloseTo(2, 9)
      expect((b.x0 + b.x1) / 2).toBeCloseTo(0, 9)
      expect((b.y0 + b.y1) / 2).toBeCloseTo(0, 9)
    }
  })

  test("Keynote's icons are the deck's geometry, point for point", () => {
    const deck = (slide: typeof slide22, key: string) => slide.shapes.find((s) => s.icon === key)!
    for (const [name, slide, key] of [
      ["laptop", slide24, "Notebook_109"],
      ["musicNote", slide22, "Music Note_217"],
      ["gameController", slide22, "Game Controller_92"],
    ] as const) {
      const s = deck(slide, key)
      const runs = glyphPaths(name, 1)
      expect(runs.length).toBe(s.subpaths.length)
      const xs = s.subpaths.flatMap((r) => r.filter((_, i) => i % 2 === 0))
      const ys = s.subpaths.flatMap((r) => r.filter((_, i) => i % 2 === 1))
      const b = box(runs.map((r) => r.points))
      expect((b.x1 - b.x0) / (b.y1 - b.y0)).toBeCloseTo((Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys)), 9)
    }
  })

  test("icon() hands out every name; the composed entries are their own holons", () => {
    for (const name of ICON_NAMES) expect(icon(name, { size: 50 })).toBeDefined()
    expect(icon("radioTower")).toBeInstanceOf(RadioTower)
    expect(icon("book")).toBeInstanceOf(Book)
    expect(icon("tank")).toBeInstanceOf(Icon)
    expect(COMPOSED.every((n) => !(DRAWN_ICONS as readonly string[]).includes(n))).toBe(true)
  })

  test("the spheres' icon rows draw from the Icons table, in the film's three rows", () => {
    const rows = [ICON_ROWS.infra, ICON_ROWS.social, ICON_ROWS.super]
    SPHERES.icons.forEach((row, i) => expect(row.map(([n]) => n)).toEqual([...rows[i]!]))
  })
})

describe("RadioTower — broadcast", () => {
  test("Keynote's sixteen outlines: three nested ring bands, then the mast; `size` is the height", () => {
    expect(TOWER_RAW.length).toBe(16)
    const rings = TOWER_RAW.slice(0, RING_COUNT).map((r) => box([towerPath(r, 1)]))
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i]!.x1 - rings[i]!.x0).toBeLessThan(rings[i - 1]!.x1 - rings[i - 1]!.x0)
      expect(rings[i]!.y1).toBeLessThan(rings[i - 1]!.y1)
    }
    const all = box(TOWER_RAW.map((r) => towerPath(r, 300)))
    expect(all.y1 - all.y0).toBeCloseTo(300, 6)
    expect((all.x1 - all.x0) / (all.y1 - all.y0)).toBeCloseTo(TOWER_ASPECT, 9)
  })

  test("broadcast: 0 the bare mast, 1 all rings, the inner one first", () => {
    expect([0, 1, 2].map((i) => ringPresence(0, i))).toEqual([0, 0, 0])
    expect([0, 1, 2].map((i) => ringPresence(1, i))).toEqual([1, 1, 1])
    expect(ringPresence(0.5, 0)).toBe(1)
    expect(ringPresence(0.5, 2)).toBe(0)
    const t = new RadioTower({ broadcast: 0.4 })
    void t.parts
    expect(t.rings.length).toBe(3)
    expect(t.rings[0]!.opacity.value).toBe(1)
    expect(t.rings[2]!.opacity.value).toBe(0)
  })
})

describe("Book — the written word", () => {
  test("one unit tall, mirror-symmetric about its spine, 84 × 81 as f6526", () => {
    const left = bookPath(LEFT_COVER)
    const right = bookPath(LEFT_COVER, true)
    left.forEach((p, i) => {
      expect(right[i]!.x).toBeCloseTo(-p.x, 12)
      expect(right[i]!.y).toBeCloseTo(p.y, 12)
    })
    expect(BOOK_TRACE.height).toBe(81)
    expect(BOOK_ASPECT).toBeCloseTo(84 / 81, 9)
    const b = new Book({ size: 162 })
    void b.parts
    expect(b.covers.members.length).toBe(3)
  })
})
