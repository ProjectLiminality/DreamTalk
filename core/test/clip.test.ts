import { describe, expect, test } from "bun:test"
import { Circle, Group } from "../src/parts/primitives"
import * as THREE from "three/webgpu"
import { vec4 } from "three/tsl"
import { clip, clipCoverage, clipOf } from "../src/clip"
import { clippedMaterial, unclippedMeshes } from "../src/render/clip"
import { Text } from "../src/parts/text"

describe("clip — ink seen through a window", () => {
  test("nothing declared: no clip anywhere (the host switches no material)", () => {
    const leaf = new Circle()
    new Group({ members: [leaf] })
    expect(clipOf(leaf)).toBeUndefined()
  })

  test("a clip inherits down the tree; the nearest wins", () => {
    const leaf = new Circle()
    const inner = new Group({ members: [leaf] })
    const outer = new Group({ members: [inner] })
    const a = new Circle({ radius: 10 })
    const b = new Circle({ radius: 20 })
    const far = clip(outer, () => a)
    expect(clipOf(leaf)).toBe(far)
    const near = clip(inner, () => b)
    expect(clipOf(leaf)).toBe(near)
    expect(clipOf(outer)).toBe(far)
    expect(near.disc()).toBe(b)
  })

  test("coverage: 1 inside, 0 outside, a one-pixel ramp across the rim", () => {
    const c = { x: 100, y: 100 }
    const u = { x: 50, y: 0 }
    const v = { x: 0, y: 25 } // an ellipse 100×50 px
    expect(clipCoverage({ x: 100, y: 100 }, c, u, v)).toBe(1)
    expect(clipCoverage({ x: 140, y: 100 }, c, u, v)).toBe(1)
    expect(clipCoverage({ x: 160, y: 100 }, c, u, v)).toBe(0)
    expect(clipCoverage({ x: 100, y: 130 }, c, u, v)).toBe(0)
    expect(clipCoverage({ x: 100, y: 125 }, c, u, v)).toBeCloseTo(0.5, 9)
    // An edge-on disc is a window of no area.
    expect(clipCoverage(c, c, { x: 1, y: 0 }, { x: 2, y: 0 })).toBe(0)
  })
})

describe("clip — Text, whose glyphs land late", () => {
  test("a Text under a clipped whole inherits the clip before it has any glyphs", () => {
    const label = new Text({ content: "thesis" })
    const content = new Group({ members: [label] })
    const window = new Circle({ radius: 50 })
    const region = clip(content, () => window)
    expect(clipOf(label)).toBe(region)
  })

  test("what arrives in a watched group after adoption is found on the next frame — and only that", () => {
    const group = new THREE.Group()
    const contour = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicNodeMaterial())
    group.add(contour)
    const adopted = new Map<THREE.Object3D, unknown>()
    expect(unclippedMeshes(group, adopted)).toEqual([contour])
    adopted.set(contour, true)
    expect(unclippedMeshes(group, adopted)).toEqual([])
    // The layout lands: a glyph mesh joins the group.
    const glyphs = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicNodeMaterial())
    group.add(glyphs)
    expect(unclippedMeshes(group, adopted)).toEqual([glyphs])
  })

  test("a material that writes its own output (the glyphs') gets a twin scaling that output; one twin per material", () => {
    const base = new THREE.MeshBasicNodeMaterial()
    base.transparent = true
    base.fragmentNode = vec4(1, 1, 1, 1)
    const twin = clippedMaterial(base) as THREE.NodeMaterial
    expect(twin).not.toBe(base)
    expect(clippedMaterial(base)).toBe(twin)
    expect(twin.fragmentNode).toBeTruthy()
    expect(twin.fragmentNode).not.toBe(base.fragmentNode)
    // An untouched material keeps its own nodes: the twin is a separate object.
    expect(base.maskNode).toBeNull()
  })
})
