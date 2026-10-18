import { describe, expect, test } from "bun:test"
import { RESONANCE, Resonance, isResonant, ringAge, ringAt, ringTicks, type ResonanceState } from "../vocabulary/Resonance/Resonance"
import { Circle, Group, Null, Square } from "../src/parts/primitives"
import { Text } from "../src/parts/text"

const S = (o: Partial<ResonanceState> = {}): ResonanceState => ({
  time: 0, speed: 1, rings: 3, dash: 140, radius: 100, reach: 2.2, amount: 1, band: 0.45, ...o,
})
const built = <T extends { walk(): Iterable<unknown> }>(h: T): T => (void [...h.walk()], h)

describe("Resonance — rings of radial ticks travelling out", () => {
  test("rings are evenly staggered in age, and each ages with the clock", () => {
    const ages = [0, 1, 2].map((k) => ringAge(S(), k).age)
    expect(ages[1]! - ages[0]!).toBeCloseTo(1 / 3, 12)
    expect(ages[2]! - ages[1]!).toBeCloseTo(1 / 3, 12)
    expect(ringAge(S({ time: RESONANCE.period / 2 }), 0).age).toBeCloseTo(0.5, 12)
    // A full period later the ring is reborn, one generation on.
    const a = ringAge(S({ time: 0.3 }), 0)
    const b = ringAge(S({ time: 0.3 + RESONANCE.period }), 0)
    expect(b.age).toBeCloseTo(a.age, 9)
    expect(b.gen).toBe(a.gen + 1)
  })

  test("every tick is radial, and a fresh ring's band is centred (1 + birth)·R out", () => {
    const ticks = ringTicks(S({ time: 1e-6 }), 0)
    expect(ticks.length).toBeGreaterThan(100)
    for (const [p, q] of ticks) {
      const cross = p!.x * q!.y - p!.y * q!.x
      expect(Math.abs(cross)).toBeLessThan(1e-6)
      const mid = (Math.hypot(p!.x, p!.y) + Math.hypot(q!.x, q!.y)) / 2
      expect(mid).toBeCloseTo((1 + RESONANCE.birth) * 100, 3)
    }
  })

  test("as it travels a ring grows, its ticks shorten and thin out, and it fades to nothing", () => {
    const young = ringAt(0.1)
    const old = ringAt(0.9)
    expect(old.band).toBeLessThan(young.band)
    expect(old.keep).toBeLessThan(young.keep)
    expect(old.alpha).toBeLessThan(young.alpha)
    expect(ringAt(0).alpha).toBe(0)
    const r = (s: ResonanceState) => {
      const [p, q] = ringTicks(s, 0)[0]!
      return (Math.hypot(p!.x, p!.y) + Math.hypot(q!.x, q!.y)) / 2
    }
    expect(r(S({ time: 2 }))).toBeGreaterThan(r(S({ time: 0.5 })))
    expect(ringTicks(S({ time: 2.7 }), 0).length).toBeLessThan(ringTicks(S({ time: 0.1 }), 0).length)
  })

  test("amount: more resonance travels further (20:19); none is invisible", () => {
    const far = ringTicks(S({ time: 2, amount: 1 }), 0)[0]!
    const near = ringTicks(S({ time: 2, amount: 0.2 }), 0)[0]!
    expect(Math.hypot(far[0]!.x, far[0]!.y)).toBeGreaterThan(Math.hypot(near[0]!.x, near[0]!.y))
    const r = built(new Resonance({ amount: 0, time: 1 }))
    for (const l of r.ringLines) expect(l.opacity.value).toBe(0)
    expect(r.ringLines.length).toBe(3)
  })

  test("pure: the same time gives the same rings", () => {
    expect(ringTicks(S({ time: 1.234 }), 1)).toEqual(ringTicks(S({ time: 1.234 }), 1))
  })
})

describe("Resonance — the ability (.resonate())", () => {
  test("any shape with an outline can resonate; a Text cannot, and the error teaches", () => {
    expect(isResonant(new Circle())).toBe(true)
    expect(isResonant(new Square())).toBe(true)
    expect(isResonant(new Text())).toBe(false)
    expect(() => new Resonance({}, new Text() as never)).toThrow(/new Resonance\(\{ radius, x, y \}\)/)
  })

  test("the rings follow the shape's WORLD centre and radius", () => {
    const c = new Circle({ radius: 50, x: 100 })
    const whole = new Group({ members: [c], scale: 2, y: 30 })
    built(whole)
    const { resonance } = c.resonate({ rings: 2 })
    expect(resonance.radius.value).toBeCloseTo(100, 6)
    expect(resonance.x.value).toBeCloseTo(200, 6)
    expect(resonance.y.value).toBeCloseTo(30, 6)
    c.radius.value = 60
    expect(resonance.radius.value).toBeCloseTo(120, 6)
    expect(resonance.source).toBe(c)
  })

  test("the graft is non-enumerable (the field scan never sees it)", () => {
    expect(Object.keys(new Null())).not.toContain("resonate")
    const d = Object.getOwnPropertyDescriptor(Circle.prototype.constructor.prototype.__proto__, "resonate")
    expect(d?.enumerable).toBe(false)
  })
})
