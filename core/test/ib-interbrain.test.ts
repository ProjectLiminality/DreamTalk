/**
 * ib-interbrain.test.ts — the InterBrain symbol (the Noosphere's InterBrain
 * sphere, a gem in every node, the Logo at its heart) and its `unfold` axis;
 * and its gem: the Logo (imported, not redrawn) at the heart of a
 * constructed crystal, at InterBrain.png's proportions, inside a ring.
 */

import { describe, expect, test } from "bun:test"
import { CRYSTAL, InterBrainGem, crystalCorners, crystalEdges, crystalFacets, facetLight } from "../vocabulary/InterBrain/InterBrainGem"
import { FLY1, INTERBRAIN, InterBrain } from "../vocabulary/InterBrain/InterBrain"
import { Noosphere } from "../vocabulary/Noosphere/Noosphere"
import { SongLine } from "../vocabulary/SongLine/SongLine"
import { WEB } from "../vocabulary/LiminalWeb/LiminalWeb"
import { gatherStateSpace } from "../src/automaton"
import { Logo } from "../vocabulary/Logo/Logo"
import { DreamNode, FACE_FILL } from "../vocabulary/DreamNode/DreamNode"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)
const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

describe("InterBrainGem", () => {
  test("the crystal: apexes at ±H, as wide as InterBrain.png (0.777 H), symmetric about its axis", () => {
    const H = 300
    const c = crystalCorners(H)
    near(c.top.y, H)
    near(c.bottom.y, -H)
    const xs = [...c.upper, ...c.lower].map((p) => p.x)
    near(Math.max(...xs), CRYSTAL.halfWidth * H)
    near(Math.min(...xs), -CRYSTAL.halfWidth * H)
    for (let i = 0; i < 4; i++) {
      near(c.upper[i]!.x, -c.upper[3 - i]!.x)
      near(c.upper[i]!.y, c.upper[3 - i]!.y)
      near(c.upper[i]!.y, -c.lower[i]!.y)
    }
  })

  test("nine convex facets, each lit by its direction to the upper left", () => {
    const facets = crystalFacets(100)
    expect(facets.length).toBe(9)
    for (const loop of facets) {
      const pts = loop.slice(0, -1)
      const signs = pts.map((_, i) => Math.sign(cross(pts[i]!, pts[(i + 1) % pts.length]!, pts[(i + 2) % pts.length]!)))
      expect(new Set(signs.filter((s) => s !== 0)).size).toBe(1)
    }
    // Upper-left termination brightest, lower-right darkest.
    const light = facets.map(facetLight)
    expect(light[0]!).toBeGreaterThan(light[8]!)
    expect(Math.max(...light)).toBe(light[0]!)
    expect(Math.min(...light)).toBe(light[8]!)
    expect(crystalEdges(100).length).toBe(7)
  })

  test("the Logo is THE Logo, its ring 0.304 H, sitting 0.142 H below the crystal's centre", () => {
    const ib = new InterBrainGem({ radius: 250 })
    void ib.parts
    expect(ib.logo).toBeInstanceOf(Logo)
    near(ib.logo.radius.value * ib.logo.scale.value, CRYSTAL.logo * 250)
    near(ib.logo.y.value, -CRYSTAL.logoDrop * 250)
    near(ib.reach, 250)
  })

  test("in a DreamNode its apexes reach the node's face fill", () => {
    const face = new InterBrainGem({ radius: 300 })
    const node = new DreamNode({ radius: 279, face })
    void node.parts
    near(face.scale.value * 300, FACE_FILL * 279)
  })
})

describe("InterBrain", () => {
  test("the symbol is THE Noosphere in its InterBrain state, ν 2, a gem per node, the Logo at its heart", () => {
    const ib = new InterBrain({ radius: 400 })
    void ib.parts
    expect(ib.sphere).toBeInstanceOf(Noosphere)
    expect(ib.sphere.frequency.value).toBe(INTERBRAIN.frequency)
    expect([ib.sphere.bloom.value, ib.sphere.garden.value, ib.sphere.interbrain.value, ib.sphere.flat.value]).toEqual([1, 1, 1, 0])
    expect(ib.sphere.slots.length).toBe(42) // 10ν² + 2
    for (const slot of ib.sphere.slots) expect(slot.parts[0]).toBeInstanceOf(InterBrainGem)
    void ib.core.parts
    expect(ib.core.faces[0]).toBeInstanceOf(Logo)
    near(ib.core.radius.value * FACE_FILL, INTERBRAIN.heart * 400)
    expect(ib.core.ringOpacity.value).toBe(0)
    near(ib.reach, 400)
  })

  test("folded: what it holds sits on the gems, unseen; the sphere whole", () => {
    const ib = new InterBrain({ radius: 400 })
    void ib.parts
    expect(ib.shell.there.value).toBe(1)
    for (const s of ib.strands) expect(s.there.value).toBe(0)
    expect(ib.song.there.value).toBe(0)
    // Every satellite leaves from a distinct gem, at that gem's place and size.
    const gems = ib.sphere.slots.map((s) => [s.x.value, s.y.value] as const)
    const at = ib.nodes.slice(1).map((n) => gems.findIndex(([x, y]) => Math.hypot(x - n.x.value, y - n.y.value) < 1e-6))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect(new Set(at).size).toBe(at.length)
  })

  test("unfolded: a liminal web round the Logo — friends red, dreams blue — and the song's chapters as a song line", () => {
    const R = 400
    const ib = new InterBrain({ radius: R, unfold: 1 })
    void ib.parts
    expect(ib.shell.there.value).toBe(0)
    near(ib.core.radius.value, INTERBRAIN.web * R)
    expect(ib.core.ringOpacity.value).toBe(1)
    const sats = ib.nodes.slice(1)
    expect(sats.length).toBe(6)
    for (const n of sats) {
      near(Math.hypot(n.x.value, n.y.value), WEB.orbit * INTERBRAIN.web * R, 1e-6)
      near(n.radius.value, WEB.satellite * INTERBRAIN.web * R, 1e-6)
    }
    expect(sats.map((n) => n.kind.value)).toEqual([1, 0, 1, 0, 1, 0])
    for (const s of ib.strands) expect(s.there.value).toBe(1)
    expect(ib.songline).toBeInstanceOf(SongLine)
    expect(ib.songline.count.value).toBe(8)
    expect(ib.songline.grow.value).toBe(1)
    expect(ib.song.there.value).toBe(1)
    // Past FLY1 the web stands still.
    ib.unfold.value = FLY1
    near(ib.core.radius.value, INTERBRAIN.web * R)
  })

  test("walkable: one `unfold` axis (symbol ↔ unfolded) owned by the symbol; the sphere's own axes stand down", () => {
    const ib = new InterBrain({ radius: 400 })
    const space = gatherStateSpace([ib])
    const unfold = space.axes.find((a) => a.id === "unfold")!
    expect(unfold.positions.map((p) => p.name)).toEqual(["symbol", "unfolded"])
    expect(unfold.key).toBe("u")
    expect(unfold.handles()).toEqual([ib])
    for (const id of ["bloom", "garden", "flat", "fragment", "interbrain", "lens"]) expect(space.axes.some((a) => a.id === id)).toBe(false)
    expect(space.clocks).toContain(ib.sphere.spin)
  })
})
