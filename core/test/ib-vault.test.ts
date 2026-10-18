import { describe, expect, test } from "bun:test"
import { PATTERN, VAULT, Vault, levelOf, levelProgress, vaultLayout } from "../vocabulary/Vault/Vault"

describe("Vault — knowledge as managed", () => {
  test("the film's two levels (f8326): 3 + 9 Categories, 2 + 6 pages, the frame 27 px under the lowest box", () => {
    const lay = vaultLayout(2)
    const at = (l: number, kind: string) => lay.items.filter((i) => i.level === l && i.kind === kind).length
    expect(at(0, "vault")).toBe(1)
    expect([at(1, "category"), at(1, "page")]).toEqual([3, 2])
    expect([at(2, "category"), at(2, "page")]).toEqual([9, 6])
    expect(lay.frame.y1).toBeCloseTo(668.25, 6)
    expect(lay.frame.x1 - lay.frame.x0).toBeCloseTo(VAULT.frameW, 9)
  })

  test("every box's five drops are Category, page, Category, page, Category — spaced evenly about it", () => {
    expect(PATTERN).toEqual(["category", "article", "category", "document", "category"])
    const lay = vaultLayout(1)
    const l1 = lay.items.filter((i) => i.level === 1).map((i) => i.x)
    for (let j = 1; j < l1.length; j++) expect(l1[j]! - l1[j - 1]!).toBeCloseTo(VAULT.levels[0].spacing, 9)
    expect((l1[0]! + l1[4]!) / 2).toBeCloseTo(VAULT.origin[0], 9)
  })

  test("pages are 0.61 of their level's box, centred on the boxes' row", () => {
    for (const it of vaultLayout(2).items) {
      if (it.kind !== "page") continue
      const g = levelOf(it.level)
      expect(it.height).toBeCloseTo(g.box * VAULT.page, 9)
      expect(it.y).toBeCloseTo(g.y, 9)
    }
  })

  test("deeper levels continue self-similar: below their parent, never overlapping", () => {
    const lay = vaultLayout(4)
    for (let l = 3; l <= 4; l++) {
      const g = levelOf(l)
      const up = levelOf(l - 1)
      expect(g.bus).toBeGreaterThan(up.y + up.box / 2)
      expect(g.y - g.box / 2).toBeGreaterThan(g.bus)
      const row = lay.items.filter((i) => i.level === l).sort((a, b) => a.x - b.x)
      const half = (i: (typeof row)[number]) => (i.kind === "page" ? (i.height * 0.757) / 2 : i.box / 2)
      for (let j = 1; j < row.length; j++) expect(row[j]!.x - half(row[j]!)).toBeGreaterThan(row[j - 1]!.x + half(row[j - 1]!))
    }
  })

  test("grow: the levels fill in top down; 0 the Vault alone, 1 all", () => {
    expect(levelProgress(0, 0, 2)).toBe(0)
    expect(levelProgress(1, 2, 2)).toBe(1)
    expect(levelProgress(2 / 3, 1, 2)).toBeCloseTo(1, 9)
    expect(levelProgress(2 / 3, 2, 2)).toBeCloseTo(0, 9)
    // grow 0: the Vault alone, drawn; nothing below it.
    const v = new Vault({ grow: 0 })
    void v.parts
    expect(v.frame.creation.value).toBe(1)
    expect(v.links.members.every((l) => l.creation.value === 0)).toBe(true)
    v.grow.value = 1
    expect(v.links.members.every((l) => l.creation.value === 1)).toBe(true)
    const axes = v.stateSpace()!.axes
    expect(axes.map((a) => a.id)).toEqual(["grow"])
  })
})
