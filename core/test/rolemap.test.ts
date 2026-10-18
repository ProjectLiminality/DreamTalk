import { describe, expect, test } from "bun:test"
import { glide, hexCluster, ringRadius, sectorDividers, sectorMiddle, seats, turn, type RoleSpec } from "../vocabulary/RoleMap/layout"
import { MOCK_ROLEMAP, RoleMap } from "../vocabulary/RoleMap/RoleMap"

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps)
const TAU = Math.PI * 2
const norm = (a: number) => ((a % TAU) + TAU) % TAU

describe("RoleMap layout", () => {
  const sites = MOCK_ROLEMAP.sites!
  const all = seats(MOCK_ROLEMAP.roles, sites, 100)

  test("one seat per holder, every one on its ring", () => {
    const people = MOCK_ROLEMAP.roles.reduce((a, r) => a + (r.count ?? 1), 0)
    expect(all.length).toBe(people)
    for (const s of all) close(Math.hypot(s.p.x, s.p.y), ringRadius(s.ring, 100), 1e-6)
  })

  test("an unsited ring is spaced at equal angles, an equal share in every sector, none on a divider", () => {
    const outer = all.filter((s) => s.ring === 3).map((s) => norm(s.angle)).sort((a, b) => a - b)
    for (let i = 1; i < outer.length; i++) close(outer[i]! - outer[i - 1]!, TAU / outer.length, 1e-9)
    const dividers = sectorDividers(sites.length).map(norm)
    const share = sites.map(() => 0)
    for (const a of outer) {
      for (const d of dividers) expect(Math.abs(turn(a, d))).toBeGreaterThan(1e-6)
      const s = sites.findIndex((_, k) => Math.abs(turn(a, sectorMiddle(k, sites.length))) < Math.PI / sites.length)
      share[s]!++
    }
    expect(new Set(share).size).toBe(1)
  })

  test("a sited ring keeps each site's people in its own sector, centred, at one step", () => {
    const ring2 = all.filter((s) => s.ring === 2)
    sites.forEach((site, k) => {
      const mine = ring2.filter((s) => MOCK_ROLEMAP.roles[s.role]!.site === site)
      const mid = sectorMiddle(k, sites.length)
      for (const s of mine) expect(Math.abs(turn(s.angle, mid))).toBeLessThan(Math.PI / sites.length)
      close(mine.reduce((a, s) => a + turn(mid, s.angle), 0), 0, 1e-9)
    })
  })

  test("unknown sites and mixed rings are data errors", () => {
    const bad: RoleSpec[] = [{ id: "a", label: "A", ring: 1, site: "Nowhere" }]
    expect(() => seats(bad, ["Site 1"], 1)).toThrow(/unknown site/)
    const mixed: RoleSpec[] = [
      { id: "a", label: "A", ring: 1, site: "Site 1" },
      { id: "b", label: "B", ring: 1 },
    ]
    expect(() => seats(mixed, ["Site 1"], 1)).toThrow(/mixes/)
  })
})

describe("the shared-service cluster", () => {
  test("whole symmetric shells: 7 and 19 round a node, 12 round a triangle", () => {
    for (const n of [1, 3, 7, 12, 19]) {
      const pts = hexCluster(n, 1)
      expect(pts.length).toBe(n)
      const cx = pts.reduce((a, p) => a + p.x, 0) / n
      const cy = pts.reduce((a, p) => a + p.y, 0) / n
      close(cx, 0, 1e-9)
      close(cy, 0, 1e-9)
    }
  })

  test("no two people share a slot; neighbours a lattice step apart", () => {
    const pts = hexCluster(12, 2)
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y)).toBeGreaterThan(2 - 1e-9)
  })

  test("a glide starts at the seat, ends at the slot, and stays on the ring's side of the centre", () => {
    const [seat] = seats([{ id: "r", label: "R", ring: 3, count: 12 }], [], 100).filter((s) => s.angle > 1)
    const at = -Math.PI / 2
    const slot = { x: 10, y: -5 }
    const R = ringRadius(3, 100)
    const a = glide(seat!, R, at, slot, 0)
    close(a.x, seat!.p.x, 1e-9)
    close(a.y, seat!.p.y, 1e-9)
    const b = glide(seat!, R, at, slot, 1)
    close(b.x, slot.x, 1e-9)
    close(b.y, -R + slot.y, 1e-9)
    for (let s = 0; s <= 1; s += 0.05) {
      const p = glide(seat!, R, at, slot, s)
      expect(Math.hypot(p.x, p.y)).toBeGreaterThan(R * 0.85)
    }
  })
})

describe("RoleMap holon", () => {
  test("composes the mock, one person per holder, and declares its three axes", () => {
    const m = new RoleMap()
    void m.parts
    expect(m.people.length).toBe(27)
    expect(m.holders("replenishment").length).toBe(12)
    const ids = m.stateSpace().axes.map((a) => a.id)
    expect(ids).toEqual(["centralise", "sites", "risk"])
    expect(m.stateSpace().axes[0]!.positions.map((p) => p.name)).toEqual(["decentralised", "shared-service"])
  })
})
