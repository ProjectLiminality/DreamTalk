import { describe, expect, test } from "bun:test"
import { rotHPB } from "../src/parts/curves"
import {
  facingAngles,
  arcTable,
  atArcLength,
  categoryDiscs,
  flowPoint,
  memberLayouts,
  partnerLayout,
  sliceDepths,
} from "../src/geometry/flowmap"
import { certainty, certaintyOf, ghost, GHOST_FLOOR, seenOpacity, wobble } from "../src/certainty"
import { Circle, Group } from "../src/parts/primitives"
import { FlowMap, MOCK_FLOWMAP, type FlowMapData } from "../vocabulary/FlowMap/FlowMap"

const R = 300

describe("flow-map geometry", () => {
  test("category discs shrink in from the group's own circumference — the tangent point never moves", () => {
    for (const n of [1, 2, 3, 5]) {
      for (const g of [0, 0.25, 0.5, 1]) {
        for (const d of categoryDiscs(n, R, g)) {
          expect(Math.hypot(d.x, d.y) + d.radius).toBeCloseTo(R, 9)
          if (g === 0) expect(d.radius).toBe(R)
        }
      }
    }
  })

  test("two categories at full grain are the vesica piscis: each centre on the other's rim", () => {
    const [a, b] = categoryDiscs(2, R, 1)
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeCloseTo(a!.radius, 9)
    expect(a!.radius).toBeCloseTo((2 * R) / 3, 9)
    // The first category sits on top.
    expect(a!.y).toBeGreaterThan(0)
    expect(a!.x).toBeCloseTo(0, 9)
  })

  test("member layouts are deterministic, and every member lands in exactly its own region", () => {
    const cats = [[0], [0], [0, 1], [1], [1], [1], [0, 1], [1], []]
    const one = memberLayouts(cats, 2, R, R * 0.058)
    const two = memberLayouts(cats, 2, R, R * 0.058)
    expect(one).toEqual(two)
    const discs = categoryDiscs(2, R, 1)
    cats.forEach((set, i) => {
      const p = one.categorised[i]!
      expect(Math.hypot(p.x, p.y)).toBeLessThan(R)
      discs.forEach((d, k) => {
        const inside = Math.hypot(p.x - d.x, p.y - d.y) < d.radius
        expect(inside).toBe(set.includes(k))
      })
    })
    // Flat: all inside the sunflower, no two members on one petal.
    for (const p of one.flat) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(R * 0.68 + 1e-9)
    expect(new Set(one.flat.map((p) => `${p.x},${p.y}`)).size).toBe(cats.length)
  })

  test("members in one region keep their distance from each other and from every rim", () => {
    const cats = [[1], [1], [1], [1], [1]]
    const { categorised } = memberLayouts(cats, 2, R, R * 0.058)
    for (let i = 0; i < categorised.length; i++)
      for (let j = i + 1; j < categorised.length; j++) {
        const a = categorised[i]!
        const b = categorised[j]!
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(R * 0.058 * 2.5)
      }
  })

  test("partners: suppliers left, customers right, two-way above and below", () => {
    const pos = partnerLayout(["in", "out", "both", "both", "in"], R)
    expect(pos[0]!.x).toBeLessThan(0)
    expect(pos[4]!.x).toBeLessThan(0)
    expect(pos[1]!.x).toBeGreaterThan(0)
    expect(pos[2]!.y).toBeGreaterThan(0)
    expect(pos[3]!.y).toBeLessThan(0)
    for (const p of pos) expect(Math.hypot(p.x, p.y)).toBeGreaterThan(R)
  })

  test("slice depths: flat is one plane; opening never reorders; a closed gap merges two slices", () => {
    expect(sliceDepths([1, 1, 1], 330, 0)).toEqual([0, 0, 0, 0])
    for (const open of [[1, 1, 1], [0.3, 1, 0], [0, 0, 1]]) {
      for (const e of [0.2, 0.7, 1]) {
        const z = sliceDepths(open, 330, e)
        for (let k = 1; k < z.length; k++) expect(z[k]!).toBeGreaterThanOrEqual(z[k - 1]!)
        expect(z[0]! + z[z.length - 1]!).toBeCloseTo(0, 9)
      }
    }
    const z = sliceDepths([1, 0, 1], 330, 1)
    expect(z[1]).toBe(z[2])
  })

  test("a flow's channel runs end to end and bows in the picture's plane", () => {
    const a = { x: -100, y: 0, z: -50 }
    const b = { x: 100, y: 0, z: 50 }
    expect(flowPoint(a, b, 0, 0.2)).toEqual(a)
    expect(flowPoint(a, b, 1, 0.2)).toEqual(b)
    const mid = flowPoint(a, b, 0.5, 0.2)
    expect(mid.z).toBeCloseTo(0, 9)
    expect(mid.y).toBeGreaterThan(0)
  })
})

describe("arc length", () => {
  test("a sampled curve walks by arc length, clamped to its ends", () => {
    const t = arcTable((u) => ({ x: 100 * u, y: 0, z: 0 }), 10)
    expect(t.lengths[10]).toBeCloseTo(100, 9)
    expect(atArcLength(t.points, t.lengths, 37).x).toBeCloseTo(37, 9)
    expect(atArcLength(t.points, t.lengths, -5).x).toBe(0)
    expect(atArcLength(t.points, t.lengths, 500).x).toBe(100)
  })
})

describe("certainty", () => {
  test("ghost: hard data is untouched, conjecture keeps a floor", () => {
    expect(ghost(1)).toBe(1)
    expect(ghost(0)).toBe(GHOST_FLOOR)
    expect(ghost(-3)).toBe(GHOST_FLOOR)
  })

  test("no certainty anywhere: the renderer gets the holon's own opacity, the very same param", () => {
    const c = new Circle()
    new Group({ members: [c] })
    expect(seenOpacity(c)).toBe(c.opacity)
  })

  test("certainty inherits down the tree, as a product", () => {
    class Branch extends Group {
      certainty = certainty(0.5)
    }
    const leaf = new Circle({ opacity: 0.8 })
    const inner = new Branch({ members: [leaf] })
    const outer = new Branch({ members: [inner] })
    expect(certaintyOf(leaf)).toBeCloseTo(0.25, 12)
    expect(seenOpacity(leaf).value).toBeCloseTo(0.8 * ghost(0.25), 12)
    outer.certainty.value = 1
    expect(seenOpacity(leaf).value).toBeCloseTo(0.8 * ghost(0.5), 12)
  })

  test("wobble: certain things hold still; conjecture hovers, deterministically", () => {
    expect(wobble(3, 1.7, 1, 10)).toEqual({ x: 0, y: 0 })
    expect(wobble(3, 1.7, 0, 10)).toEqual(wobble(3, 1.7, 0, 10))
    const w = wobble(3, 1.7, 0, 10)
    expect(Math.hypot(w.x, w.y)).toBeGreaterThan(0)
    expect(Math.hypot(w.x, w.y)).toBeLessThanOrEqual(10 * Math.SQRT2 + 1e-9)
  })
})

describe("FlowMap", () => {
  test("grain interpolates every member between its two layouts", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    const flat = m.frame().members.map((p) => ({ ...p }))
    m.grain.value = 1
    const cat = m.frame().members.map((p) => ({ ...p }))
    m.grain.value = 0.5
    m.frame().members.forEach((p, i) => {
      expect(p.x).toBeCloseTo((flat[i]!.x + cat[i]!.x) / 2, 9)
      expect(p.y).toBeCloseTo((flat[i]!.y + cat[i]!.y) / 2, 9)
    })
    // And back exactly.
    m.grain.value = 0
    expect(m.frame().members).toEqual(flat)
  })

  test("expand tilts the stack and spreads the slices; collapsing is face-on and flat again, exactly", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    expect(Math.abs(m.stack.h.value)).toBe(0)
    expect(m.slices.map((s) => s.z.value)).toEqual([0, 0, 0, 0])
    m.expand.value = 1
    expect(m.stack.h.value).toBeCloseTo(m.tilt.value, 12)
    const z = m.slices.map((s) => s.z.value)
    for (let k = 1; k < z.length; k++) expect(z[k]! - z[k - 1]!).toBeCloseTo(m.gap.value, 9)
    // A stage closed: its two slices merge, the rest keep their order.
    m.stage("semi").open.value = 0
    const zc = m.slices.map((s) => s.z.value)
    expect(zc[2]).toBe(zc[1])
    m.stage("semi").open.value = 1
    m.expand.value = 0
    expect(Math.abs(m.stack.h.value)).toBe(0)
    expect(m.slices.map((s) => Math.abs(s.z.value))).toEqual([0, 0, 0, 0])
  })

  test("one slice per stage boundary; flows, particles and certainty follow the data", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    expect(m.slices.length).toBe(MOCK_FLOWMAP.stages.length + 1)
    expect(m.flows.length).toBe(MOCK_FLOWMAP.flows.length)
    // One carrier per particle; a denser (rate 1.5) flow gets the bigger pool.
    for (const f of m.flows) expect(f.carriers.length).toBe(f.dots.length)
    expect(m.flows[0]!.dots.length).toBeGreaterThan(m.flows[1]!.dots.length)
    // Raw material is conjecture in the mock: its particles are ghosted.
    expect(certaintyOf(m.flows[0]!.dots[0]!)).toBeCloseTo(0.15, 12)
    expect(certaintyOf(m.flows[MOCK_FLOWMAP.flows.length - 1]!.dots[0]!)).toBe(1)
  })

  test("particles are a pure function of time", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    m.stage("semi").shown.value = 1
    const flow = m.stage("semi").flows[0]!
    const dot = flow.dots[1]!
    const at = flow.carriers[1]!
    m.time.value = 3.25
    const a = [at.x.value, at.y.value, at.z.value, dot.opacity.value]
    m.time.value = 7
    m.time.value = 3.25
    expect([at.x.value, at.y.value, at.z.value, dot.opacity.value]).toEqual(a)
  })

  test("particles run evenly spaced by arc length, `spacing / rate` apart", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    m.stage("finished").shown.value = 1
    m.time.value = 2.5
    const flow = m.stage("finished").flows[0]! // rate 1.5
    const pts = flow.line.points
    const table = arcTable((u) => pts[Math.round(u * (pts.length - 1))]!, pts.length - 1)
    // Arc position of each visible particle, by its nearest channel sample.
    const along = flow.carriers
      .filter((_, j) => flow.dots[j]!.opacity.value > 0.999)
      .map((c) => {
        let best = 0
        pts.forEach((p, i) => {
          const q = pts[best]!
          if (Math.hypot(p.x - c.x.value, p.y - c.y.value) < Math.hypot(q.x - c.x.value, q.y - c.y.value)) best = i
        })
        return table.lengths[best]!
      })
      .sort((a, b) => a - b)
    expect(along.length).toBeGreaterThan(2)
    for (let i = 1; i < along.length; i++) expect(Math.abs(along[i]! - along[i - 1]! - m.spacing.value / 1.5)).toBeLessThan(8)
  })

  test("the turn leads and the slices fan out behind it — both exact at the ends", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    m.expand.value = 0.5
    const f = m.frame()
    expect(f.heading / m.tilt.value).toBeGreaterThan(0.6)
    const z = f.depths
    expect(z[1]! - z[0]!).toBeLessThan(m.gap.value * 0.5)
    m.expand.value = 1
    expect(m.frame().pitch).toBeCloseTo(m.pitch.value, 12)
  })

  test("particles and labels face the camera however the stack turns — one carrier each", () => {
    // stack ∘ carrier must undo the stack's turn exactly (no observer)…
    const m = new FlowMap({ radius: R })
    void m.parts
    m.expand.value = 0.8
    const carrier = m.flows[3]!.carriers[0]!
    expect(carrier.parts[0]).toBe(m.flows[3]!.dots[0])
    const apply = (v: { x: number; y: number; z: number }, h: { p: { value: number }; h: { value: number }; b: { value: number } }) =>
      rotHPB(v, h.p.value, h.h.value, h.b.value)
    for (const v of [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0.3, y: -0.4, z: 0.86 }]) {
      const w = apply(apply(v, carrier), m.stack)
      expect(w.x).toBeCloseTo(v.x, 9)
      expect(w.y).toBeCloseTo(v.y, 9)
      expect(w.z).toBeCloseTo(v.z, 9)
    }
  })

  test("facingAngles is the product it names", () => {
    // Ry(−H)·Rx(−P)·Ry(φ)·Rx(−θ) applied to v, against one rotHPB with the decomposed angles.
    const ry = (v: { x: number; y: number; z: number }, a: number) => rotHPB(v, 0, a, 0)
    const rx = (v: { x: number; y: number; z: number }, a: number) => rotHPB(v, a, 0, 0)
    for (const [H, P, phi, th] of [[1.2, 0.4, 0.7, 0.3], [-0.5, 0.9, -1.1, 0.2], [0, 0, 0, 0]] as const) {
      const a = facingAngles(H, P, phi, th)
      const v = { x: 0.2, y: 0.7, z: -0.5 }
      const want = ry(rx(ry(rx(v, -th), phi), -P), -H)
      const got = rotHPB(v, a.p, a.h, a.b)
      expect(got.x).toBeCloseTo(want.x, 9)
      expect(got.y).toBeCloseTo(want.y, 9)
      expect(got.z).toBeCloseTo(want.z, 9)
    }
  })

  test("a flow exposes its path and its particles' places along it", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    m.stage("semi").shown.value = 1
    m.time.value = 4
    const flow = m.stage("semi").flows[0]!
    expect(flow.path().length).toBeGreaterThan(10)
    const s = flow.particles()
    expect(s.length).toBe(flow.dots.length)
    for (const v of s) expect(v === -1 || (v >= 0 && v <= 1)).toBe(true)
    // A visible particle sits where its place says.
    const j = s.findIndex((v, i) => v > 0.2 && v < 0.8 && flow.dots[i]!.opacity.value > 0.99)
    const pts = flow.path()
    const t = arcTable((u) => pts[Math.round(u * (pts.length - 1))]!, pts.length - 1)
    const p = atArcLength(t.points, t.lengths, s[j]! * t.lengths[t.lengths.length - 1]!)
    expect(Math.hypot(p.x - flow.carriers[j]!.x.value, p.y - flow.carriers[j]!.y.value)).toBeLessThan(1e-6)
  })

  test("member labels: one per labelled member and slice, off by default, tinted as the ring", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    const site = m.slices[0]!.sites[0]!
    expect(site.label?.content).toBe(MOCK_FLOWMAP.members[0]!.label)
    expect(site.label!.opacity.value).toBe(0)
    m.memberLabels.value = 1
    expect(site.label!.opacity.value).toBe(1)
    m.grain.value = 1
    expect(site.label!.tint.value).toEqual(site.ring.tint.value)
  })

  test("memberScale shrinks the rings and re-lays the members, still each in its own region", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    const before = m.slices[0]!.sites[0]!.ring.radius.value
    m.memberScale.value = 0.7
    m.grain.value = 1
    expect(m.slices[0]!.sites[0]!.ring.radius.value).toBeCloseTo(before * 0.7, 9)
    const discs = categoryDiscs(2, R, 1)
    MOCK_FLOWMAP.members.forEach((mem, i) => {
      const p = m.frame().members[i]!
      discs.forEach((d, k) => {
        const id = MOCK_FLOWMAP.categories![k]!.id
        expect(Math.hypot(p.x - d.x, p.y - d.y) < d.radius).toBe((mem.categories ?? []).includes(id))
      })
    })
  })

  test("a material stage's particles ride along the channel (heading + symbolYaw), sized to the gap", () => {
    const data: FlowMapData = {
      ...MOCK_FLOWMAP,
      stages: MOCK_FLOWMAP.stages.map((st) => (st.id === "semi" ? { ...st, symbol: "reel" as const } : st)),
    }
    const m = new FlowMap({ radius: R, data, expand: 1 })
    void m.parts
    m.stage("semi").shown.value = 1
    m.time.value = 2
    const flow = m.stage("semi").flows[0]!
    const carrier = flow.carriers[1]!
    // No billboard: the carrier is the Grain's direct parent and carries a heading.
    expect(carrier.parts[0]).toBe(flow.dots[1])
    const pts = flow.path()
    const a = pts[0]!
    const b = pts.at(-1)!
    const chord = Math.atan2(-(b.z - a.z), b.x - a.x)
    // Along the channel to within its bow, plus the 3/4 offset.
    expect(Math.abs(carrier.h.value - m.symbolYaw.value - chord)).toBeLessThan(0.8)
    expect((flow.dots[1] as unknown as { size: { value: number } }).size.value).toBeCloseTo((m.particleSize.value * m.spacing.value) / (MOCK_FLOWMAP.flows.find((f) => f.stage === "semi")!.rate ?? 1), 9)
    // Dot stages keep their camera-facing carriers (a full turn: p and b
    // bound too); a material carrier turns by heading only.
    const raw = m.stage("raw").flows[0]!
    expect(raw.carriers[0]!.p.isBound).toBe(true)
    expect(carrier.p.isBound).toBe(false)
  })

  test("a stage's material type certainty reaches every Grain, with a guess ↔ data toggle", () => {
    const data: FlowMapData = {
      ...MOCK_FLOWMAP,
      stages: MOCK_FLOWMAP.stages.map((st) => (st.id === "semi" ? { ...st, symbol: "reel" as const, typeKnown: 0.6 } : st)),
    }
    const m = new FlowMap({ radius: R, data })
    void m.parts
    const grain = m.stage("semi").flows[0]!.dots[0] as unknown as { typeKnown: { value: number } }
    expect(grain.typeKnown.value).toBeCloseTo(0.6, 12)
    m.stage("semi").typeKnown.value = 1
    expect(grain.typeKnown.value).toBe(1)
    const t = m.stateSpace().axes.find((a) => a.id === "semi.type")!
    expect(t.positions.map((p) => p.name)).toEqual(["guess", "data"])
  })

  test("a flow naming an unknown entity is refused", () => {
    const bad: FlowMapData = { ...MOCK_FLOWMAP, flows: [{ from: "nobody", to: "A", stage: "raw" }] }
    expect(() => new FlowMap({ data: bad }).parts).toThrow(/unknown entity 'nobody'/)
  })
})
