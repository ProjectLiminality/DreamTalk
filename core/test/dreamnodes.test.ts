/**
 * The Dream Explorer's pure half (editor/dreamnodes.ts): a scene seen as
 * the DreamNodes that compose it, laid out, and walked by path.
 */

import { describe, expect, test } from "bun:test"
import { scenes } from "../demo/scenes"
import {
  dreamNameOf,
  dreamNodesOf,
  flatten,
  inkOf,
  layoutOf,
  LABEL_ROOM,
  moversOf,
  carrierOf,
  nodeNameOf,
  resolvePlace,
  sceneOfNode,
} from "../editor/dreamnodes"
import type { Holon } from "../src/holon"

const treeOf = (key: string) => {
  const Scene = scenes[key]!
  return dreamNodesOf(new Scene().roots, dreamNameOf(Scene))
}

const shape = (key: string) =>
  flatten(treeOf(key)).map((n) => `${"  ".repeat(n.depth)}${n.name}${n.count > 1 ? ` ×${n.count}` : ""}`)

describe("dreamNodesOf", () => {
  test("a scene's sovereign symbols are its DreamNodes, the scene the root", () => {
    expect(shape("creatormode")).toEqual(["CreatorMode", "  Calculator", "  GoldenDot"])
  })

  test("a symbol's own scene IS the symbol's node (single-file pattern)", () => {
    const root = treeOf("mindvirus")
    expect(root.name).toBe("MindVirus")
    expect(root.rep && nodeNameOf(root.rep)).toBe("MindVirus")
    expect(shape("mindvirus")).toEqual(["MindVirus", "  MolochEye", "  FoldableCube", "  Cable"])
  })

  test("a class is one node however many instances — the others fade", () => {
    const globe = treeOf("yinyang").children.find((n) => n.name === "Globe")!
    // Two globes, listed by the scene AND gathered by their Groups: still two.
    expect(globe.count).toBe(2)
    expect(globe.others).toHaveLength(1)
    expect(globe.others[0]).not.toBe(globe.rep)
  })

  test("own ink never reaches into another node", () => {
    const root = treeOf("regenaissance")
    const others = new Set<Holon>()
    for (const n of flatten(root)) if (n !== root) for (const h of n.rep!.walk()) others.add(h)
    for (const ink of inkOf(root, () => true)) for (const h of ink.walk()) expect(others.has(h)).toBe(false)
  })

  test("a nested node rides its carrier: the root's moved holons carry the parts", () => {
    const root = treeOf("mindvirus")
    const movers = moversOf(root)
    for (const child of root.children) expect(carrierOf(child.rep!, movers)).toBe(root)
    expect(carrierOf(root.rep!, movers)).toBeUndefined()
  })
})

describe("layoutOf", () => {
  for (const key of ["creatormode", "mindvirus", "regenaissance", "yinyang", "founding"]) {
    test(`${key}: discs inside the frame, none touching`, () => {
      const discs = [...layoutOf(treeOf(key), 1280, 720).values()]
      for (const d of discs) {
        expect(d.x - d.r).toBeGreaterThanOrEqual(0)
        expect(d.x + d.r).toBeLessThanOrEqual(1280)
        expect(d.y - d.r).toBeGreaterThanOrEqual(0)
        expect(d.y + d.r + LABEL_ROOM).toBeLessThanOrEqual(720)
      }
      for (let i = 0; i < discs.length; i++)
        for (let j = i + 1; j < discs.length; j++) {
          const a = discs[i]!
          const b = discs[j]!
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r)
        }
    })
  }

  test("the frame is wide: two parts sit left and right of the whole, not above and below", () => {
    const root = treeOf("creatormode")
    const layout = layoutOf(root, 1280, 720)
    const c = layout.get(root)!
    for (const child of root.children) expect(Math.abs(layout.get(child)!.y - c.y)).toBeLessThan(1)
  })
})

describe("resolvePlace — the path IS the place", () => {
  test("no path: the scene itself", () => {
    const place = resolvePlace(scenes, "creatormode", [])
    expect(place.name).toBe("CreatorMode")
    expect(place.crumbs.map((c) => c.name)).toEqual(["CreatorMode"])
    expect(place.alone).toBe(false)
  })

  test("a node with a scene of its own opens that scene", () => {
    expect(sceneOfNode(scenes, "MolochEye")).toBe("molocheye")
    const place = resolvePlace(scenes, "mindvirus", ["MolochEye"])
    expect(place.Dream).toBe(scenes.molocheye!)
    expect(place.crumbs.map((c) => c.query)).toEqual(["scene=mindvirus", "scene=mindvirus&path=MolochEye"])
  })

  test("a node without one stands alone, created and held", () => {
    const place = resolvePlace(scenes, "creatormode", ["Calculator"])
    expect(place.alone).toBe(true)
    const dream = new place.Dream()
    expect(dream.duration).toBeGreaterThan(0)
    expect(dream.roots.map(nodeNameOf)).toEqual(["Calculator"])
  })

  test("a step that names nothing ends the walk where the path stops being true", () => {
    const place = resolvePlace(scenes, "creatormode", ["Nope", "Calculator"])
    expect(place.name).toBe("CreatorMode")
    expect(place.crumbs).toHaveLength(1)
  })
})
