import { describe, expect, test } from "bun:test"
import { SANDTALK, SEED, SandTalk, SeedGlyph } from "../vocabulary/SandTalk/SandTalk"
import { Figure, bustHalf, profileHalves } from "../vocabulary/Figure/Figure"
import { Fire } from "../vocabulary/Fire/Fire"
import { Vision } from "../vocabulary/Vision/Vision"
import { Circle } from "../src/parts/primitives"
import { RED } from "../src/constants"

const S = 400

describe("Figure — the profile ability", () => {
  test("profile halves start at the crown and end at the outline's bottom; the face reaches forward", () => {
    const h = 200
    const { back, face } = profileHalves(h)
    for (const half of [back, face]) {
      expect(half[0]!.x).toBeCloseTo(0, 9)
      expect(half[0]!.y).toBeCloseTo(h / 2, 9)
      expect(half[half.length - 1]!.y).toBeCloseTo(-h / 2, 9)
    }
    const ys = [...back, ...face].map((p) => p.y)
    expect(Math.max(...ys)).toBeCloseTo(h / 2, 9)
    // The nose is the furthest point forward; the back of the head is behind the crown.
    expect(Math.max(...face.map((p) => p.x))).toBeGreaterThan(0.4 * h)
    expect(Math.min(...back.map((p) => p.x))).toBeLessThan(-0.3 * h)
  })

  test("profile ±1 turns the bust's outline onto the profile, facing ±x; 0 is the front bust untouched", () => {
    const h = 200
    const { face } = profileHalves(h)
    const front = new Figure({ height: h, form: 1 })
    void front.parts
    const bl = bustHalf(h)
    front.limbs.armLeft.forEach((p, i) => expect(p.x).toBeCloseTo(bl[i]!.x, 9))
    const right = new Figure({ height: h, form: 1, profile: 1 })
    void right.parts
    right.limbs.armRight.forEach((p, i) => expect(p.x).toBeCloseTo(face[i]!.x, 9))
    const left = new Figure({ height: h, form: 1, profile: -1 })
    void left.parts
    left.limbs.armLeft.forEach((p, i) => expect(p.x).toBeCloseTo(-face[i]!.x, 9))
  })
})

describe("SandTalk — two at a fire in the circle of conversation, a seed in the sand", () => {
  test("composed of the shared symbols: two Figures in profile facing each other, a Fire, a Vision in each brow", () => {
    const t = new SandTalk({ size: S })
    void t.parts
    for (const [p, side] of [[t.left, -1], [t.right, 1]] as const) {
      expect(p).toBeInstanceOf(Figure)
      expect(p.form.value).toBe(1)
      expect(p.profile.value).toBe(-side) // each looks toward the fire
      expect(p.x.value).toBeCloseTo(side * SANDTALK.headX * S, 9)
      expect(p.height.value).toBeCloseTo(SANDTALK.head * S, 9)
    }
    expect(t.fire).toBeInstanceOf(Fire)
    expect(t.fire.x.value).toBe(0)
    expect(t.visions.every((v) => v instanceof Vision)).toBe(true)
    // Each Vision sits in front of its crown — between the head and the fire.
    t.visions.forEach((v, i) => {
      const side = i === 0 ? -1 : 1
      expect(Math.abs(v.x.value)).toBeLessThan(SANDTALK.headX * S)
      expect(Math.sign(v.x.value)).toBe(side)
    })
    // The ring behind everything: first attached.
    expect(t.parts[0]).toBe(t.ring)
    expect(t.ring.tint.value).toEqual(RED)
  })

  test("the ring holds the people and the fire; it reshapes into a shared ellipse", () => {
    const t = new SandTalk({ size: S })
    void t.parts
    const rx = t.ring.radiusX.value
    const ry = t.ring.radiusY.value
    expect(ry / rx).toBeCloseTo(SANDTALK.ringAspect, 9)
    // The crowns lie inside the ring's width; the glyph inside its lower half.
    expect(SANDTALK.headX * S).toBeLessThan(rx)
    expect(t.sand.y.value).toBeLessThan(0)
    expect(-t.sand.y.value).toBeLessThan(ry)
    t.ringWidth.value = 2
    t.ringX.value = 0.5
    expect(t.ring.radiusX.value).toBeCloseTo(2 * S, 9)
    expect(t.ring.x.value).toBeCloseTo(0.5 * S, 9)
    expect(t.reach).toBeCloseTo(2 * S, 9)
  })

  test("the sand slot: the seed glyph by default, any symbol fitted to the slot, or bare sand", () => {
    const t = new SandTalk({ size: S })
    void t.parts
    expect(t.glyph).toBeInstanceOf(SeedGlyph)
    expect(t.glyph!.scale.value * (t.glyph as SeedGlyph).reach).toBeCloseTo(SANDTALK.sandR * S, 9)
    // Laid in the sand: the tilt foreshortens a circle to the measured aspect.
    expect(Math.cos(t.sand.p.value)).toBeCloseTo(SANDTALK.sandAspect, 9)
    const v = new Vision({ radius: 50 })
    const u = new SandTalk({ size: S, symbol: v })
    void u.parts
    expect(u.glyph).toBe(v)
    expect(v.scale.value * 50).toBeCloseTo(SANDTALK.sandR * S, 9)
    const bare = new SandTalk({ size: S, symbol: null })
    void bare.parts
    expect(bare.glyph).toBeUndefined()
  })

  test("the seed: the inner circle tangent inside the outer at the back, the strokes' feet on the outer circle", () => {
    const g = new SeedGlyph({ radius: 100 })
    void g.parts
    const [outer, inner] = g.parts as Circle[]
    expect(inner!.y.value + inner!.radius.value).toBeCloseTo(outer!.radius.value, 9)
    expect(SEED.inner).toBeGreaterThan(0.5)
    expect(SEED.apex).toBeLessThan(1)
  })
})
