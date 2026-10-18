import { describe, expect, test } from "bun:test"
import { TRIBE, Tribe, latticeEdges, latticeNodes, nodeOutline, nodePosition, tribeCentres } from "../vocabulary/Tribe/Tribe"
import { Mind } from "../vocabulary/Mind/Mind"
import { SandTalk } from "../vocabulary/SandTalk/SandTalk"
import { BLUE, RED } from "../src/constants"

const D = 300

describe("Tribe — the lattice", () => {
  test("rings 1: seven minds, the six rim edges and six spokes, every edge one spacing long", () => {
    const nodes = latticeNodes(1)
    expect(nodes.length).toBe(7)
    expect(nodes[0]).toEqual({ q: 0, r: 0 })
    const edges = latticeEdges(1)
    expect(edges.length).toBe(12)
    for (const [i, j] of edges) {
      const a = nodePosition(nodes[i]!, D)
      const b = nodePosition(nodes[j]!, D)
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(D, 9)
    }
    // The middle row runs horizontally with a mind at either end (f6091, f5221).
    const mids = nodes.map((n) => nodePosition(n, D)).filter((p) => Math.abs(p.y) < 1e-9)
    expect(mids.map((p) => Math.round(p.x)).sort((a, b) => a - b)).toEqual([-D, 0, D])
  })

  test("rings 3: the huge web of f6736 — rows of 4, 5, 6, 7, 6, 5, 4", () => {
    const rows = new Map<number, number>()
    for (const n of latticeNodes(3)) rows.set(n.r, (rows.get(n.r) ?? 0) + 1)
    expect([...rows.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])).toEqual([4, 5, 6, 7, 6, 5, 4])
    // A hexagon of R rings of the triangular lattice has 9R² + 3R edges (R = 1: twelve).
    for (const R of [1, 2, 3]) expect(latticeEdges(R).length).toBe(9 * R * R + 3 * R)
  })

  test("tribes of tribes: the centre and six round it, the ring turned 30°, recursively", () => {
    const c1 = tribeCentres(1, D)
    expect(c1.length).toBe(7)
    expect(c1[0]).toEqual({ x: 0, y: 0 })
    for (const c of c1.slice(1)) expect(Math.hypot(c.x, c.y)).toBeCloseTo(TRIBE.tribeSpacing * D, 9)
    expect(c1[1]!.x).toBeCloseTo(0, 9) // the first straight up (f6286)
    expect(tribeCentres(2, D).length).toBe(49)
    // The ring of tribes clears each tribe: no two touch.
    expect(TRIBE.tribeSpacing * D).toBeGreaterThan(2 * (1 + TRIBE.circle) * D)
  })
})

describe("Tribe — ancient ↔ modern", () => {
  test("the node frame: a circle at 0, a square at 1, corners on the samples", () => {
    for (const p of nodeOutline(D, 0)) expect(Math.hypot(p.x, p.y)).toBeCloseTo(TRIBE.circle * D, 9)
    const sq = nodeOutline(D, 1)
    for (const p of sq) expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeCloseTo(TRIBE.square * D, 9)
    expect(sq.some((p) => Math.abs(Math.abs(p.x) - TRIBE.square * D) < 1e-9 && Math.abs(Math.abs(p.y) - TRIBE.square * D) < 1e-9)).toBe(true)
  })

  test("ancient: liminal Minds in red, a SandTalk on every edge inside its band", () => {
    const t = new Tribe({ size: D })
    void t.parts
    expect(t.minds.length).toBe(7)
    expect(t.minds.every((m) => m instanceof Mind && m.liminal.value === 1 && m.framed.value === 0)).toBe(true)
    expect(t.frames[0]!.tint.value).toEqual(RED)
    expect(t.campfires.length).toBe(12)
    expect(t.campfires.every((c) => c instanceof SandTalk && c.symbol === null)).toBe(true)
    // The campfire sits inside its band; the band tucks under both circles.
    expect(t.campfires[0]!.reach).toBeLessThan(TRIBE.bandX * D)
    expect(TRIBE.bandX * D).toBeGreaterThan(D / 2 - TRIBE.circle * D)
    expect(TRIBE.bandX * D).toBeLessThan(D / 2)
    expect(t.bands[0]!.radiusY.value).toBeCloseTo(TRIBE.bandY * D, 9)
  })

  test("modern: domesticated Minds, blue, the bands closed to a line, the busts grown to the film's", () => {
    const t = new Tribe({ size: D, modern: 1 })
    void t.parts
    expect(t.minds.every((m) => m.liminal.value === 0)).toBe(true)
    expect(t.frames[0]!.tint.value).toEqual(BLUE)
    expect(t.bands.every((b) => b.radiusY.value === 0)).toBe(true)
    expect(t.minds[0]!.scale.value).toBeCloseTo(TRIBE.bustModern / TRIBE.bustAncient, 9)
    // Boxes: none until `boxed`, then every head but the middle one.
    expect(t.boxes.every((b) => b.presence.value === 0)).toBe(true)
    t.boxed.value = 1
    expect(t.boxes[0]!.presence.value).toBe(0)
    expect(t.boxes.slice(1).every((b) => b.presence.value === 1)).toBe(true)
    // A box covers the head: its ring wider than the bust's head.
    expect(TRIBE.box).toBeGreaterThan(0.3 * TRIBE.bustModern)
  })

  test("walkable: era and boxed", () => {
    const t = new Tribe({ size: D })
    expect(t.stateSpace()!.axes.map((a) => a.id)).toEqual(["era", "boxed"])
    void t.parts
    expect(t.minds[0]!.stateSpace()).toBeUndefined()
  })
})
