import { describe, expect, test } from "bun:test"
import { rotHPB } from "../src/parts/curves"
import {
  facingAngles,
  fiberRings,
  clearYaw,
  arcTable,
  atArcLength,
  categoryDiscs,
  flowPoint,
  memberLayouts,
  partnerLayout,
  partnerRing,
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

  test("partners: one ring, every class its own regular polygon — David's 18-gon", () => {
    const classes = [
      ...Array(6).fill("raw"),
      ...Array(3).fill("semi-in"),
      ...Array(3).fill("semi-out"),
      ...Array(6).fill("finished"),
    ]
    const { points, exact } = partnerRing(classes, R)
    expect(exact).toBe(true)
    const step = (2 * Math.PI) / 18
    const slot = (p: { x: number; y: number }) => Math.round((((Math.atan2(p.y, p.x) - Math.PI) % (2 * Math.PI)) + 2 * Math.PI) / step) % 18
    const of = (c: string) => points.filter((_, i) => classes[i] === c).map(slot).sort((a, b) => a - b)
    expect(of("raw")).toEqual([0, 3, 6, 9, 12, 15])
    expect(of("finished")).toEqual([1, 4, 7, 10, 13, 16])
    expect(of("semi-in")).toEqual([2, 8, 14])
    expect(of("semi-out")).toEqual([5, 11, 17])
    // A class that cannot be regular on the ring is said so.
    expect(partnerRing(["a", "a", "b", "b", "b"], R).exact).toBe(false)
  })

  test("a fiber is symmetric as a whole: few on one ring, many on two rings sharing the vertical mirror", () => {
    const site = (cls: string) => ({ cls, site: true })
    const partner = (cls: string) => ({ cls, site: false })
    // Four of three classes: one square, sitting flat (a mirror on the vertical).
    const sq = fiberRings([partner("raw"), site("sites-out"), partner("semi-out"), partner("raw")], R)
    expect(sq.outer).toBeCloseTo(R * 0.42, 9)
    const xs = sq.points.map((p) => p.x).sort((a, b) => a - b)
    expect(xs[0]! + xs[3]!).toBeCloseTo(0, 9)
    expect(xs[1]! + xs[2]!).toBeCloseTo(0, 9)
    // Two classes of one apiece: a level diameter.
    const two = fiberRings([partner("raw"), partner("semi-out")], R).points
    expect(two[0]!.y).toBeCloseTo(0, 9)
    expect(two[0]!.x + two[1]!.x).toBeCloseTo(0, 9)
    // Many: sites inner, partners outer, each mirrored about the vertical.
    const many = [...Array(5).fill(0).map(() => site("sites-in")), ...Array(10).fill(0).map(() => partner("raw"))]
    const f = fiberRings(many, R)
    const mirrored = (pts: { x: number; y: number }[]) =>
      pts.every((p) => pts.some((q) => Math.abs(q.x + p.x) < 1e-9 && Math.abs(q.y - p.y) < 1e-9))
    const inner = f.points.slice(0, 5)
    const outer = f.points.slice(5)
    expect(mirrored(inner)).toBe(true)
    expect(mirrored(outer)).toBe(true)
    expect(Math.hypot(outer[0]!.x, outer[0]!.y)).toBeGreaterThan(Math.hypot(inner[0]!.x, inner[0]!.y))
    expect(f.outer).toBeCloseTo(Math.hypot(outer[0]!.x, outer[0]!.y), 9)
  })

  test("a one-in, one-out fiber reads in reading direction: in → site → out", () => {
    const data: FlowMapData = {
      members: [{ id: "A", label: "Site A" }],
      partners: [
        { id: "S1", label: "Supplier 1", side: "in", class: "raw" },
        { id: "K1", label: "Customer 1", side: "out", class: "finished" },
      ],
      stages: [
        { id: "raw", label: "raw" },
        { id: "finished", label: "finished" },
      ],
      flows: [
        { from: "S1", to: "A", stage: "raw" },
        { from: "A", to: "K1", stage: "finished" },
      ],
    }
    const m = new FlowMap({ radius: R, data })
    void m.parts
    ;(m as unknown as Record<string, { value: number }>)["focus_0"]!.value = 1
    const f = m.frame()
    const [s1, k1] = f.partners
    expect(s1!.y).toBeCloseTo(0, 9)
    expect(k1!.y).toBeCloseTo(0, 9)
    expect(s1!.x).toBeLessThan(0)
    expect(k1!.x).toBeCloseTo(-s1!.x, 9)
  })

  test("members sit on a hex lattice, in mirror pairs about their region's axis; never scattered", () => {
    // The 20-member instance: 13 conversion, 2 both, 3 extrusion, 2 neither.
    const cats = [
      ...Array.from({ length: 3 }, () => [0]),
      ...Array.from({ length: 2 }, () => [0, 1]),
      ...Array.from({ length: 13 }, () => [1]),
      [],
      [],
    ]
    const r = R * 0.058 * 0.85
    const { flat, categorised } = memberLayouts(cats, 2, R, r)
    const discs = categoryDiscs(2, R, 1)
    cats.forEach((set, i) => discs.forEach((d, k) => expect(Math.hypot(categorised[i]!.x - d.x, categorised[i]!.y - d.y) < d.radius).toBe(set.includes(k))))
    // No two rings touch.
    for (const pts of [flat, categorised])
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y)).toBeGreaterThan(2.4 * r)
    // Both categories' regions lie along the vertical: every even-count
    // region (and the flat flower) is mirror-symmetric about x = 0.
    const symmetric = (pts: { x: number; y: number }[]) =>
      pts.every((p) => pts.some((q) => Math.abs(q.x + p.x) < 1e-6 && Math.abs(q.y - p.y) < 1e-6))
    expect(symmetric(categorised.slice(3, 5))).toBe(true)
    expect(symmetric(categorised.slice(18, 20))).toBe(true)
    expect(symmetric(flat)).toBe(true)
    // Deterministic.
    expect(memberLayouts(cats, 2, R, r)).toEqual({ flat, categorised })
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
    // Measured by nearest channel sample: good to one sample segment.
    const seg = table.lengths.at(-1)! / (pts.length - 1)
    for (let i = 1; i < along.length; i++) expect(Math.abs(along[i]! - along[i - 1]! - m.spacing.value / 1.5)).toBeLessThan(seg)
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

  test("a sparse stage's symbols are capped relative to the map, not grown by their gap", () => {
    const data: FlowMapData = {
      ...MOCK_FLOWMAP,
      stages: MOCK_FLOWMAP.stages.map((st) => (st.id === "semi" ? { ...st, symbol: "reel" as const } : st)),
      flows: MOCK_FLOWMAP.flows.map((f) => (f.stage === "semi" ? { ...f, rate: 0.1 } : f)),
    }
    const m = new FlowMap({ radius: R, data })
    void m.parts
    const size = (m.stage("semi").flows[0]!.dots[0] as unknown as { size: { value: number } }).size.value
    expect(size).toBeCloseTo(m.particleMax.value * R, 9)
  })

  test("clearYaw keeps a spindle at least 35° off the view, as near the base yaw as it can", () => {
    const view = { x: 0, z: 1 } // looking along z
    // A spindle along x at yaw π/2 points down z — straight at us: it must turn.
    const yaw = clearYaw(Math.PI / 2, { x: 1, z: 0 }, view)
    const sx = Math.cos(yaw)
    const sz = -Math.sin(yaw)
    expect(Math.abs(sz) / Math.hypot(sx, sz)).toBeLessThanOrEqual(Math.cos((35 * Math.PI) / 180) + 1e-9)
    expect(Math.abs(yaw - Math.PI / 2)).toBeLessThan(1.3)
    // Already clear: untouched.
    expect(clearYaw(0, { x: 1, z: 0 }, view)).toBe(0)
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
    expect((flow.dots[1] as unknown as { size: { value: number } }).size.value).toBeCloseTo((m.particleSize.value * m.spacing.value) / Math.max(...MOCK_FLOWMAP.flows.filter((f) => f.stage === "semi").map((f) => f.rate ?? 1)), 9)
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

  test("roads: built only on request; a stage's concrete walks its flows' roads, trucks one per visible particle", () => {
    const plain = new FlowMap({ radius: R })
    void plain.parts
    expect(plain.flows[0]!.road).toBeUndefined()
    expect(plain.stateSpace().axes.some((a) => a.id.endsWith(".concrete"))).toBe(false)
    const m = new FlowMap({ radius: R, roads: true })
    void m.parts
    const st = m.stage("semi")
    st.shown.value = 1
    m.time.value = 3
    const f = st.flows[0]!
    expect(f.road!.concrete).toBe(st.concrete)
    const visible = f.particles().filter((s) => s >= 0).length
    expect(visible).toBeGreaterThan(0)
    st.concrete.value = 1
    // The abstract line and dots hand over to the road …
    expect(f.line.opacity.value).toBe(0)
    expect(f.dots.every((d) => d.opacity.value === 0)).toBe(true)
    // … and the road still gets a truck for every particle that was showing.
    expect(f.particles().filter((s) => s >= 0).length).toBe(visible)
    expect(m.stateSpace().axes.find((a) => a.id === "semi.concrete")!.positions.map((p) => p.name)).toEqual(["lines", "roads"])
  })

  test("a slice's rings are pooled: one Polylines per tint, each ring a loop at its entity's own opacity", () => {
    const plain = new FlowMap({ radius: R })
    void plain.parts
    expect(plain.slices[0]!.pools.length).toBe(0) // off by default
    const m = new FlowMap({ radius: R, poolRings: true })
    void m.parts
    const slice = m.slices[0]!
    // Two category tints, the neither-sites' white, the partners: four pools, not 11 + 18 strokes.
    expect(slice.pools.length).toBe(4)
    const A = MOCK_FLOWMAP.members.findIndex((x) => x.id === "A")
    const site = slice.sites[A]!
    const pool = slice.pools.find((p) => p.loopOwners().includes(site.ring))!
    const at = pool.loopOwners().indexOf(site.ring)
    // Whole and at rest: the pool draws it, its own Circle does not.
    expect(site.ring.opacity.value).toBe(0)
    expect(pool.loopOpacity!()[at]).toBeCloseTo(1, 9)
    const loop = pool.loops[at]!
    expect(loop.length).toBe(129)
    expect(Math.hypot(loop[0]!.x - site.x.value - (loop[64]!.x - site.x.value), 0) / 2).toBeCloseTo(m.slices[0]!.sites[A]!.ring.radius.value, 6)
    // Drawing on: its own Circle draws it, the loop steps aside.
    site.ring.creation.value = 0.5
    expect(site.ring.opacity.value).toBe(1)
    expect(pool.loopOpacity!()[at]).toBe(0)
    site.ring.creation.value = 1
    // Out of a site's fiber: its loop goes with its presence.
    const H = MOCK_FLOWMAP.members.findIndex((x) => x.id === "H")
    const h = slice.sites[H]!
    const hp = slice.pools.find((p) => p.loopOwners().includes(h.ring))!
    ;(m as unknown as Record<string, { value: number }>)[`focus_${A}`]!.value = 1
    expect(hp.loopOpacity!()[hp.loopOwners().indexOf(h.ring)]).toBe(0)
  })

  test("site focus: only the site's fiber stays, rearranged round the site centred, the whole fiber symmetric and filling the view", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    const space = m.stateSpace()
    const focus = space.axes.find((a) => a.id === "focus")!
    expect(focus.positions[0]!.name).toBe("none")
    expect(focus.escape).toBe("none") // Esc returns to the whole map
    // Site A: in from S1 (raw); out to D (semi), Q1 (semi-out).
    const A = MOCK_FLOWMAP.members.findIndex((x) => x.id === "A")
    const w = (m as unknown as Record<string, { value: number }>)[`focus_${A}`]!
    w.value = 1
    const f = m.frame()
    expect(f.unfocused).toBe(0)
    expect(Math.hypot(f.members[A]!.x, f.members[A]!.y)).toBeLessThan(1e-9)
    const idx = (id: string) => MOCK_FLOWMAP.members.findIndex((x) => x.id === id)
    const pidx = (id: string) => MOCK_FLOWMAP.partners!.findIndex((x) => x.id === id)
    // No left/right halves, and the WHOLE fiber symmetric: three neighbours
    // (S1 raw in, D a site it sends to, Q1 semi out) on one ring, an
    // equilateral triangle pointing up.
    const tri = [f.partners[pidx("S1")]!, f.members[idx("D")]!, f.partners[pidx("Q1")]!]
    for (const p of tri) expect(Math.hypot(p.x, p.y)).toBeCloseTo(R * 0.42, 9)
    for (let i = 0; i < 3; i++) {
      const p = tri[i]!
      const q = tri[(i + 1) % 3]!
      expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeCloseTo(R * 0.42 * Math.sqrt(3), 9)
    }
    expect(Math.max(...tri.map((p) => p.y))).toBeCloseTo(R * 0.42, 9)
    // It fills the view: the stack scales up (capped at 3.5).
    expect(f.zoom).toBe(3.5)
    // Outside the fiber: gone, not dimmed.
    expect(f.memberPresence[0]![idx("H")]).toBe(0)
    expect(f.partnerPresence[0]![pidx("K3")]).toBe(0)
    const unrelated = MOCK_FLOWMAP.flows.findIndex((x) => x.from === "G" && x.to === "H")
    expect(f.flowPresence[unrelated]).toBe(0)
    expect(m.flows[unrelated]!.presence.value).toBe(0)
    // The fiber's own flows stay.
    const own = MOCK_FLOWMAP.flows.findIndex((x) => x.from === "A" && x.to === "D")
    expect(f.flowPresence[own]).toBe(1)
    // A handle stands for its own site; touching the focused site returns.
    const ring = m.slices[0]!.sites[A]!.ring
    expect(focus.at!(ring)).toBe("none")
    w.value = 0
    expect(focus.at!(ring)).toBe("A")
    expect(m.frame().unfocused).toBe(1)
    expect(m.frame().zoom).toBe(1)
    // In order, never at once: near the whole map the outsiders are there at
    // full scale; deep in the focus they are gone before the zoom shows.
    w.value = 0.3
    expect(m.frame().zoom).toBe(1)
    expect(m.frame().memberPresence[0]![idx("H")]).toBeGreaterThan(0)
    w.value = 0.6
    expect(m.frame().memberPresence[0]![idx("H")]).toBe(0)
    expect(m.frame().unfocused).toBe(0)
    expect(m.frame().zoom).toBeGreaterThan(1)
    // Fiber to fiber: what lies in neither never flashes in.
    const B = MOCK_FLOWMAP.members.findIndex((x) => x.id === "G")
    const wb = (m as unknown as Record<string, { value: number }>)[`focus_${B}`]!
    w.value = 0.5
    wb.value = 0.5
    const half = m.frame()
    expect(half.unfocused).toBe(0)
    const outside = MOCK_FLOWMAP.members.findIndex((x) => x.id !== "A" && x.id !== "G" && half.memberPresence[0]![MOCK_FLOWMAP.members.indexOf(x)] === 0)
    expect(outside).toBeGreaterThanOrEqual(0)
    expect(half.zoom).toBeGreaterThan(1)
    // … and what is there midway never stacks: every pair of shown members
    // stands apart (the centre sites swing past each other, one fading out
    // before the other fades in).
    const shownAt = MOCK_FLOWMAP.members.flatMap((_, i) => (half.memberPresence[0]![i]! > 0 ? [half.members[i]!] : []))
    for (let i = 0; i < shownAt.length; i++)
      for (let j = i + 1; j < shownAt.length; j++)
        expect(Math.hypot(shownAt[i]!.x - shownAt[j]!.x, shownAt[i]!.y - shownAt[j]!.y)).toBeGreaterThan(R * 0.05)
  })

  test("a flow naming an unknown entity is refused", () => {
    const bad: FlowMapData = { ...MOCK_FLOWMAP, flows: [{ from: "nobody", to: "A", stage: "raw" }] }
    expect(() => new FlowMap({ data: bad }).parts).toThrow(/unknown entity 'nobody'/)
  })
})
