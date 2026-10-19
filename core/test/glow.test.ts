import { describe, expect, test } from "bun:test"
import { Circle, Group } from "../src/parts/primitives"
import { breathe, glow, glowsOf, HOVER, isGlow, seenGlow, SELECTED } from "../src/glow"
import { completion } from "../src/params"
import { GOLD, cssOf } from "../src/constants"
import { boundaryLoops, isFlat, orientLoops } from "../src/geometry/boundary"
import { echoBreath, echoOffset } from "../src/render/superposition"

class Whole extends Group {
  glow = glow(0)
}
class Lit extends Group {
  glow = glow(0.3)
}

describe("glow — the ability", () => {
  test("a glow is a completion param the renderer can recognise", () => {
    const p = glow(0.5)
    expect(isGlow(p)).toBe(true)
    expect(isGlow(completion(0.5))).toBe(false)
    expect(p.value).toBe(0.5)
  })

  test("nothing declared anywhere: no reading at all (the host makes no halo)", () => {
    const part = new Circle()
    new Group({ members: [part] })
    expect(seenGlow(part)).toBeUndefined()
    expect(glowsOf(part)).toEqual([])
  })

  test("a glow inherits down the tree as a max", () => {
    const part = new Circle()
    const lit = new Lit({ members: [part] })
    const whole = new Whole({ members: [lit] })
    const seen = seenGlow(part)!
    expect(seen.value).toBeCloseTo(0.3, 12)
    whole.glow.value = 0.8
    expect(seen.value).toBeCloseTo(0.8, 12)
    whole.glow.value = 0
    expect(seenGlow(whole)!.value).toBe(0)
  })

  test("the interaction layer's intensities: hover is faint, selection full", () => {
    expect(HOVER).toBeGreaterThan(0)
    expect(HOVER).toBeLessThan(SELECTED)
    expect(SELECTED).toBe(1)
  })

  test("breathe is a slow swell in [1 − depth, 1]; no depth is exactly 1", () => {
    for (let t = 0; t < 7; t += 0.13) {
      const b = breathe(t)
      expect(b).toBeLessThanOrEqual(1)
      expect(b).toBeGreaterThanOrEqual(1 - 0.18 - 1e-12)
      expect(breathe(t, 0)).toBe(1)
    }
    expect(breathe(0)).toBe(1)
  })

  test("one gold, spoken as CSS by the overlays", () => {
    expect(cssOf(GOLD)).toBe("rgba(255, 199, 84, 1)")
    expect(cssOf(GOLD, 0.5)).toBe("rgba(255, 199, 84, 0.5)")
  })
})

/** A fan of n triangles around (0,0): a disc whose last rim point repeats its first. */
const fan = (n: number, r = 1): { positions: number[]; indices: number[] } => {
  const positions = [0, 0, 0]
  for (let i = 0; i <= n; i++) positions.push(Math.cos((i / n) * 2 * Math.PI) * r, Math.sin((i / n) * 2 * Math.PI) * r, 0)
  const indices: number[] = []
  for (let i = 1; i <= n; i++) indices.push(0, i, i + 1)
  return { positions, indices }
}

describe("boundary — what a fill's halo follows", () => {
  test("a fan disc has one closed rim, the seam welded away", () => {
    const { positions, indices } = fan(32)
    const loops = boundaryLoops(positions, indices)
    expect(loops.length).toBe(1)
    expect(loops[0]!.length).toBe(33)
    const [first, last] = [loops[0]![0]!, loops[0]![32]!]
    expect(first).toEqual(last)
    for (const p of loops[0]!) expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 9)
  })

  test("an annulus has two loops; oriented, the outer runs CCW and the hole CW", () => {
    const n = 24
    const positions: number[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI
      positions.push(Math.cos(a) * 2, Math.sin(a) * 2, 0, Math.cos(a), Math.sin(a), 0)
    }
    const indices: number[] = []
    for (let i = 0; i < n; i++) {
      const o0 = 2 * i, i0 = 2 * i + 1, o1 = (2 * i + 2) % (2 * n), i1 = (2 * i + 3) % (2 * n)
      indices.push(o0, o1, i0, i0, o1, i1)
    }
    const loops = orientLoops(boundaryLoops(positions, indices))
    expect(loops.length).toBe(2)
    const area = (l: { x: number; y: number }[]) => {
      let s = 0
      for (let i = 0; i + 1 < l.length; i++) s += l[i]!.x * l[i + 1]!.y - l[i + 1]!.x * l[i]!.y
      return s / 2
    }
    const outer = loops.find((l) => Math.hypot(l[0]!.x, l[0]!.y) > 1.5)!
    const hole = loops.find((l) => Math.hypot(l[0]!.x, l[0]!.y) < 1.5)!
    expect(area(outer)).toBeGreaterThan(0)
    expect(area(hole)).toBeLessThan(0)
  })

  test("a closed solid (a tetrahedron) has no boundary at all", () => {
    const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]
    const indices = [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]
    expect(boundaryLoops(positions, indices)).toEqual([])
    expect(isFlat(positions)).toBe(false)
    expect(isFlat(fan(8).positions)).toBe(true)
  })
})

describe("superposition — unchanged by becoming a soft echo", () => {
  test("the echo cloud's motion is the same pure function it was", () => {
    // Pinned values: certainty's blur must read exactly as before the refactor.
    const o = echoOffset(2, 3, 1.25, 5)
    const r = 5 * (0.55 + 0.45 * Math.sin(1.3 * 1.25 + (3 * 2.399 + (2 * Math.PI * 2) / 6) * 1.7))
    expect(Math.hypot(o.x, o.y)).toBeCloseTo(Math.abs(r), 12)
    expect(echoBreath(1, 2, 0.5)).toBeCloseTo(0.725 + 0.275 * Math.sin(1.9 * 0.5 + 2 * 3.1 + 1.7), 12)
  })
})

describe("glow — a halo around many polylines (parts/polylines.ts)", () => {
  test("a ribbon set by loops glows without treating its loops as one polyline", async () => {
    const THREE = await import("three/webgpu")
    const { RibbonStroke } = await import("../src/render/ribbon")
    const { StrokeHalo } = await import("../src/render/glow")
    const ribbon = new RibbonStroke(2)
    const v = (x: number, y: number) => new THREE.Vector3(x, y, 0)
    ribbon.setLoops([
      [v(0, 0), v(10, 0), v(10, 10)],
      [v(20, 0), v(30, 0)],
      [v(40, 0), v(50, 5)],
    ])
    ribbon.style(1, 1, GOLD, 2)
    const layer = new THREE.Group()
    const halo = new StrokeHalo(ribbon, layer)
    expect(() => halo.sync(1)).not.toThrow()
    const [rim] = halo.meshes()
    expect(rim!.visible).toBe(true)
  })

  test("a loop faded out of the ink (loop alphas) is out of its light: rim, aura and mask take the same alphas", async () => {
    const THREE = await import("three/webgpu")
    const { RibbonStroke } = await import("../src/render/ribbon")
    const { StrokeHalo } = await import("../src/render/glow")
    const ribbon = new RibbonStroke(2)
    const v = (x: number, y: number) => new THREE.Vector3(x, y, 0)
    ribbon.setLoops([
      [v(0, 0), v(10, 0), v(10, 10)],
      [v(20, 0), v(30, 0)],
    ])
    ribbon.setLoopAlphas(new Float32Array([1, 0]))
    ribbon.style(1, 1, GOLD, 2)
    const halo = new StrokeHalo(ribbon, new THREE.Group())
    halo.sync(1)
    const alphaOf = (m: { geometry: unknown }) =>
      Array.from(((m.geometry as InstanceType<typeof THREE.InstancedBufferGeometry>).getAttribute("instanceAlpha").array as Float32Array).slice(0, 3))
    for (const m of halo.meshes()) expect(alphaOf(m as { geometry: unknown })).toEqual([1, 1, 0])
    // The ink's alphas move: the light follows.
    ribbon.setLoopAlphas(new Float32Array([0.5, 1]))
    halo.sync(1)
    for (const m of halo.meshes()) expect(alphaOf(m as { geometry: unknown })).toEqual([0.5, 0.5, 1])
  })
})
