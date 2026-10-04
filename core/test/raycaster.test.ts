/**
 * RayCaster (vocabulary/Eye/RayCaster.ts, geometry/rays.ts) — rays fan
 * out from an emitter, STOP where they meet a collider's outline, mark
 * the hit with an "x", and send out an ease-out shockwave; the Eye's
 * `rayCast` is the three-ray edge case, following the eye's own gaze.
 */

import { describe, expect, test } from "bun:test"
import { castRay, fanAngles, shockwave } from "../src/geometry/rays"
import { Cast, RayCaster } from "../vocabulary/Eye/RayCaster"
import { Eye } from "../vocabulary/Eye/Eye"
import { AnnularSector, Circle, Line, Null, Square } from "../src/parts/primitives"
import { Dream } from "../src/dream"
import { PI } from "../src/constants"

describe("fanAngles", () => {
  test("a full turn spreads evenly without repeating the seam", () => {
    expect(fanAngles(0, 2 * Math.PI, 4)).toEqual([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2])
  })
  test("a narrower fan includes both of its edges", () => {
    expect(fanAngles(-1, 1, 3)).toEqual([-1, 0, 1])
    expect(fanAngles(1, -1, 3)).toEqual([1, 0, -1])
  })
  test("one ray goes down the middle; none is none", () => {
    expect(fanAngles(-1, 1, 1)).toEqual([0])
    expect(fanAngles(0, 1, 0)).toEqual([])
  })
})

describe("castRay — the first outline a ray meets", () => {
  const square = [
    { x: -100, y: -100 },
    { x: 100, y: -100 },
    { x: 100, y: 100 },
    { x: -100, y: 100 },
    { x: -100, y: -100 },
  ]
  test("it stops on the near side", () => {
    const hit = castRay({ x: -300, y: 0 }, 0, [square], 1000)!
    expect(hit.distance).toBeCloseTo(200, 9)
    expect(hit.point.x).toBeCloseTo(-100, 9)
  })
  test("from inside, it stops on the wall it faces", () => {
    expect(castRay({ x: 0, y: 0 }, Math.PI / 2, [square], 1000)!.point.y).toBeCloseTo(100, 9)
  })
  test("it misses what it does not point at, and what is out of reach", () => {
    expect(castRay({ x: -300, y: 0 }, Math.PI / 2, [square], 1000)).toBeUndefined()
    expect(castRay({ x: -300, y: 0 }, 0, [square], 150)).toBeUndefined()
  })
  test("the nearest of several colliders wins", () => {
    const near = [{ x: -200, y: -50 }, { x: -200, y: 50 }]
    expect(castRay({ x: -300, y: 0 }, 0, [square, near], 1000)!.distance).toBeCloseTo(100, 9)
  })
  test("grazing along an edge never stops a ray", () => {
    const edge = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
    expect(castRay({ x: -50, y: 0 }, 0, [edge], 1000)).toBeUndefined()
  })
})

describe("shockwave — all energy at impact, dissipating as it spreads", () => {
  test("nothing before impact or after the wave has run", () => {
    expect(shockwave(-0.1).strength).toBe(0)
    expect(shockwave(0).strength).toBe(0)
    expect(shockwave(1).strength).toBe(0)
  })
  test("ease-OUT: it rushes out first and slows, while its strength fades", () => {
    expect(shockwave(0.25).radius).toBeGreaterThan(0.25)
    expect(shockwave(0.5)).toEqual({ radius: 0.75, strength: 0.5 })
    expect(shockwave(0.9).radius - shockwave(0.8).radius).toBeLessThan(shockwave(0.2).radius - shockwave(0.1).radius)
  })
})

describe("RayCaster — the holon", () => {
  /** One ray along +x from (-300, 0) at a 200-square: the hit is 200 out, at x = -100. */
  const rig = () => {
    const emitter = new Null({ x: -300 })
    const square = new Square({ size: 200 })
    const caster = new RayCaster(emitter, [square], { first: 0, last: 0, steps: 1, reach: 600 })
    const [ray, xa, xb, wave] = caster.parts as [Line, Line, Line, Circle]
    return { emitter, square, caster, ray, xa, xb, wave }
  }

  test("each ray carries its line, its x and its shockwave", () => {
    const { caster } = rig()
    expect(caster.parts.length).toBe(4)
    expect(new RayCaster(new Null(), [new Square()]).parts.length).toBe(12 * 4)
  })

  test("the front travels out, stops at the hit, and only then marks it", () => {
    const { caster, ray, xa, xb, wave } = rig()
    expect(ray.points).toEqual([]) // nothing cast
    caster.cast.value = 0.2 // front at 120: short of the square
    expect(ray.points[1]!.x).toBeCloseTo(-180, 9)
    expect(xa.points).toEqual([])
    expect(wave.opacity.value).toBe(0)
    caster.cast.value = 0.5 // front at 300: past the hit
    expect(ray.points[1]!.x).toBeCloseTo(-100, 9) // it STOPPED
    expect(xa.points.length).toBe(2)
    expect(xb.points.length).toBe(2)
    expect([wave.x.value, wave.y.value]).toEqual([-100, 0])
    expect(wave.radius.value).toBeGreaterThan(0)
    expect(wave.opacity.value).toBeGreaterThan(0)
    caster.cast.value = 1 // the wave (180 long) has long run its course
    expect(wave.opacity.value).toBe(0)
    expect(ray.points[1]!.x).toBeCloseTo(-100, 9)
  })

  test("a ray that meets nothing runs to its reach, with no x and no wave", () => {
    const emitter = new Null({ x: -300 })
    const caster = new RayCaster(emitter, [new Square({ size: 200 })], { first: PI, last: PI, steps: 1, reach: 400, cast: 1 })
    const [ray, xa, , wave] = caster.parts as [Line, Line, Line, Circle]
    expect(ray.points[1]!.x).toBeCloseTo(-700, 9)
    expect(xa.points).toEqual([])
    expect(wave.opacity.value).toBe(0)
  })

  test("isotropic from inside a square: every ray stops on the square", () => {
    const caster = new RayCaster(new Null(), [new Square({ size: 200 })], { cast: 1 })
    for (const h of caster.hits()) {
      expect(h.hit).toBeDefined()
      expect(Math.max(Math.abs(h.hit!.point.x), Math.abs(h.hit!.point.y))).toBeCloseTo(100, 9)
    }
  })

  test("it follows: move the collider and the hit moves with it", () => {
    const { square, caster, ray } = rig()
    caster.cast.value = 1
    expect(ray.points[1]!.x).toBeCloseTo(-100, 9)
    square.x.value = 100
    expect(ray.points[1]!.x).toBeCloseTo(0, 9)
  })

  test("the gate refuses a collider with no outline of its own, and teaches", () => {
    expect(() => new RayCaster(new Null(), [new AnnularSector()])).toThrow(/sub-strokes/)
  })

  test("Cast sends the rays out on the timeline", () => {
    class Look extends Dream {
      emitter = new Null({ x: -300 })
      square = new Square({ size: 200 })
      caster = new RayCaster(this.emitter, [this.square], { first: 0, last: 0, steps: 1 })
      unfold() {
        this.play(Cast(this.caster), 2)
      }
    }
    const dream = new Look()
    dream.build()
    dream.applyAt(0)
    expect(dream.caster.cast.value).toBe(0)
    dream.applyAt(2)
    expect(dream.caster.cast.value).toBe(1)
  })
})

describe("eye.rayCast — the Dialectical-Thinking beat", () => {
  test("three rays across the eye's opening; the gaze ray hits what the eye looks at", () => {
    const eye = new Eye({ x: -400 })
    const circle = new Circle({ radius: 100 })
    const { caster, anim } = eye.rayCast([circle])
    expect(caster.parts.length).toBe(3 * 4)
    const hits = caster.hits()
    expect(hits.map((h) => h.angle)).toEqual([PI / 8, 0, -PI / 8])
    expect(hits[1]!.hit!.point.x).toBeCloseTo(-100, 9)
    expect(anim.tracks.length).toBeGreaterThan(0)
  })

  test("the fan follows the eye: turn it away and the gaze ray misses", () => {
    const eye = new Eye({ x: -400 })
    const { caster } = eye.rayCast([new Circle({ radius: 100 })])
    eye.b.value = PI / 2 // looking straight up
    expect(caster.hits()[1]!.angle).toBeCloseTo(PI / 2, 9)
    expect(caster.hits()[1]!.hit).toBeUndefined()
  })

  test("blinking narrows the fan", () => {
    const eye = new Eye({ x: -400, opening: 0.5 })
    const { caster } = eye.rayCast([new Circle({ radius: 100 })])
    expect(caster.hits()[0]!.angle).toBeCloseTo(PI / 16, 9)
  })
})
