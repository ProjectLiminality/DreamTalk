/**
 * ib-interbrain.test.ts — the InterBrain's own face: the Logo (imported, not
 * redrawn) at the heart of a constructed crystal, at InterBrain.png's
 * proportions, inside a ring as a DreamNode.
 */

import { describe, expect, test } from "bun:test"
import { CRYSTAL, InterBrain, crystalCorners, crystalEdges, crystalFacets, facetLight } from "../vocabulary/InterBrain/InterBrain"
import { Logo } from "../vocabulary/Logo/Logo"
import { DreamNode, FACE_FILL } from "../vocabulary/DreamNode/DreamNode"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)
const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

describe("InterBrain", () => {
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
    const ib = new InterBrain({ radius: 250 })
    void ib.parts
    expect(ib.logo).toBeInstanceOf(Logo)
    near(ib.logo.radius.value * ib.logo.scale.value, CRYSTAL.logo * 250)
    near(ib.logo.y.value, -CRYSTAL.logoDrop * 250)
    near(ib.reach, 250)
  })

  test("in a DreamNode its apexes reach the node's face fill", () => {
    const face = new InterBrain({ radius: 300 })
    const node = new DreamNode({ radius: 279, face })
    void node.parts
    near(face.scale.value * 300, FACE_FILL * 279)
  })
})
