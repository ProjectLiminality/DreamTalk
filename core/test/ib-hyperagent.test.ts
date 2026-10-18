import { describe, expect, test } from "bun:test"
import {
  HYPER,
  HyperAgent,
  assignSpots,
  buildAt,
  bustOf,
  cubeTopOf,
  flowerSpots,
  loveHalves,
  mindRadius,
  warMachine,
} from "../vocabulary/HyperAgent/HyperAgent"
import { MIND, Mind } from "../vocabulary/Mind/Mind"
import { MolochEye } from "../vocabulary/MolochEye/MolochEye"
import { Conflict } from "../vocabulary/Conflict/Conflict"
import { Puppeteer } from "../vocabulary/Puppeteer/Puppeteer"
import { presencesOf } from "../src/certainty"
import type { Holon } from "../src/holon"

const s = 1200
const H = (s * Math.sqrt(3)) / 2
const shown = (h: Holon) => presencesOf(h).reduce((a, p) => a * p.value, 1)

describe("HyperAgent — divide and conquer, recursively", () => {
  test("a depth-d root: 2^(d+1) − 1 triangles of minds (the crown among them), 2^d − 1 bolts, two hands per bolt", () => {
    for (const d of [0, 1, 2, 3, 4]) {
      const m = warMachine(d, s)
      expect(m.minds.length).toBe(2 ** (d + 1) - 1)
      expect(m.bolts.length).toBe(2 ** d - 1)
      expect(m.hands.length).toBe(2 * m.bolts.length)
      expect(m.minds.filter((w) => w.crown).length).toBe(1)
      expect(m.minds[0]!.crown).toBe(true)
    }
    // Depth 0 is the small icon: the crown alone is the whole triangle.
    const icon = warMachine(0, s).minds[0]!
    expect(icon.side).toBe(s)
    expect(icon.ay).toBeCloseTo(H / 2, 9)
  })

  test("the triangles tile the pyramid as Sierpinski's: area 3/4 per level, apex at H/2, base at −H/2", () => {
    const d = 3
    const m = warMachine(d, s)
    const area = (t: number) => (Math.sqrt(3) / 4) * t * t
    // Each level splits its triangle in four: the top quarter and the leaves are minds, the middle quarter
    // is the bolt's. So the minds' triangles and the bolts' middles tile the root exactly.
    const middles = m.bolts.reduce((acc, b) => acc + area(b.size / HYPER.bolt) / 4, 0)
    const minds = m.minds.reduce((acc, w) => acc + area(w.side), 0)
    expect(minds + middles).toBeCloseTo(area(s), 6)
    for (const w of m.minds) {
      const h = (w.side * Math.sqrt(3)) / 2
      expect(w.ay).toBeLessThanOrEqual(H / 2 + 1e-9)
      expect(w.ay - h).toBeGreaterThanOrEqual(-H / 2 - 1e-9)
    }
    const lowest = Math.min(...m.minds.map((w) => w.ay - (w.side * Math.sqrt(3)) / 2))
    expect(lowest).toBeCloseTo(-H / 2, 9)
  })

  test("each hand stands over the corner where its held mind's triangle has its apex; the strings reach that mind's cube", () => {
    const m = warMachine(3, s)
    for (const h of m.hands) {
      const held = m.minds[h.holds]!
      expect(held.ax).toBeCloseTo(h.x, 9)
      expect(held.ay).toBeCloseTo(h.y, 9)
      expect(held.stage).toBeLessThan(h.stage)
    }
    const agent = new HyperAgent({ size: s, depth: 3 })
    void agent.parts
    agent.hands.forEach((hand, i) => {
      const h = m.hands[i]!
      expect(hand.size.value).toBeCloseTo(HYPER.fist * h.side, 9)
      expect(hand.y.value - hand.length.value).toBeCloseTo(cubeTopOf(m.minds[h.holds]!), 9)
    })
  })

  test("composed of the shared symbols, never redrawn: Mind (its triangle IS the tile), MolochEye, Conflict, Puppeteer", () => {
    const agent = new HyperAgent({ size: s, depth: 2 })
    void agent.parts
    const m = agent.machine
    expect(agent.minds.length).toBe(m.minds.length)
    agent.minds.forEach((mind, i) => {
      expect(mind).toBeInstanceOf(Mind)
      expect(mind.triangleSide).toBeCloseTo(m.minds[i]!.side, 9)
      // Bound: the inner minds are posed by the whole, not walkable on their own.
      expect(mind.stateSpace()).toBeUndefined()
      const b = bustOf(m.minds[i]!)
      expect(mind.x.value).toBeCloseTo(b.x, 9)
      expect(mind.y.value).toBeCloseTo(b.y, 9)
    })
    expect(agent.eye).toBeInstanceOf(MolochEye)
    expect(agent.eye.height.value).toBeCloseTo(HYPER.eyeWar * m.minds[0]!.side, 9)
    for (const b of agent.bolts) expect(b).toBeInstanceOf(Conflict)
    for (const h of agent.hands) expect(h).toBeInstanceOf(Puppeteer)
    expect(agent.stateSpace()!.axes.map((a) => a.id)).toEqual(["love", "apex"])
  })
})

describe("HyperAgent — war ↔ love, one number", () => {
  test("the flower's lattice: whole hexagonal shells — a, then √3·a — turned as f13111", () => {
    const a = 100
    const twelve = flowerSpots(14, a)
    expect(twelve.length).toBe(12)
    const d = twelve.map((p) => Math.hypot(p.x, p.y))
    expect(d.slice(0, 6).every((r) => Math.abs(r - a) < 1e-9)).toBe(true)
    expect(d.slice(6).every((r) => Math.abs(r - Math.sqrt(3) * a) < 1e-9)).toBe(true)
    // First shell on the horizontal, second on the vertical.
    expect(twelve.slice(0, 6).some((p) => Math.abs(p.y) < 1e-9 && p.x > 0)).toBe(true)
    expect(twelve.slice(6).some((p) => Math.abs(p.x) < 1e-9 && p.y > 0)).toBe(true)
    expect(flowerSpots(30, a).length).toBe(30)
    expect(flowerSpots(3, a).length).toBe(3)
    // The assignment is one-to-one.
    const to = assignSpots(warMachine(3, s).minds.slice(1).map(bustOf), twelve)
    const used = to.filter((j) => j >= 0)
    expect(new Set(used).size).toBe(12)
    expect(to.filter((j) => j < 0).length).toBe(2)
  })

  test("love 0 — the war machine: domesticated minds in their triangles at the tiles, bolts and hands present, the eye's cube", () => {
    const agent = new HyperAgent({ size: s, depth: 3 })
    void agent.parts
    for (const mind of agent.minds) {
      expect(mind.liminal.value).toBe(0)
      expect(mind.framed.value).toBe(1)
      expect(mind.scale.value).toBe(1)
    }
    expect(agent.eye.iris.value).toBe(0)
    for (const h of agent.hands) expect(shown(h)).toBe(1)
    for (const b of agent.bolts) expect(shown(b)).toBe(1)
    expect(shown(agent.rimCircle)).toBe(0)
    // The crown is the eye; its mind is not seen.
    expect(shown(agent.minds[0]!)).toBe(0)
    expect(shown(agent.eye)).toBe(1)
  })

  test("love 1 — the hyper-agent of love: liminal minds of one size on the lattice, the liminal eye at the centre, no bolts, no hands", () => {
    const agent = new HyperAgent({ size: s, depth: 3, love: 1 })
    void agent.parts
    const a = HYPER.lattice * s
    const spots = flowerSpots(14, a)
    const loveR = (HYPER.bustLove * a) / MIND.bust
    let gathered = 0
    agent.minds.forEach((mind, i) => {
      expect(mind.liminal.value).toBe(1)
      expect(mind.framed.value).toBe(0)
      if (i === 0 || shown(mind) === 0) return
      gathered++
      const spot = spots.find((p) => Math.hypot(p.x - mind.x.value, p.y - mind.y.value) < 1e-6)
      expect(spot).toBeDefined()
      expect(mind.size.value * mind.scale.value).toBeCloseTo(loveR, 9)
    })
    expect(gathered).toBe(12)
    expect(agent.eye.iris.value).toBe(1)
    expect(agent.eye.x.value).toBeCloseTo(0, 9)
    expect(agent.eye.y.value).toBeCloseTo(0, 9)
    expect(agent.eye.height.value * agent.eye.scale.value).toBeCloseTo(HYPER.eyeLove * s, 9)
    for (const h of agent.hands) expect(shown(h)).toBe(0)
    for (const b of agent.bolts) expect(shown(b)).toBe(0)
    // Every petal is the lattice's circle; the eye's frame is the centre one; the rim closes round them.
    for (const p of agent.petals) expect(p.radius.value).toBeCloseTo(a, 9)
    for (const q of agent.eyeFrame.points) expect(Math.hypot(q.x, q.y)).toBeCloseTo(a, 6)
    expect(agent.rimCircle.radius.value).toBeCloseTo((1 + Math.sqrt(3)) * a, 9)
    expect(shown(agent.rimCircle)).toBe(1)
  })

  test("the walk's two halves: in place first (turn), then the gathering", () => {
    expect(loveHalves(0)).toEqual({ turn: 0, gather: 0 })
    expect(loveHalves(0.5)).toEqual({ turn: 1, gather: 0 })
    expect(loveHalves(1)).toEqual({ turn: 1, gather: 1 })
    const half = new HyperAgent({ size: s, depth: 2, love: 0.5 })
    void half.parts
    const m = half.machine
    half.minds.forEach((mind, i) => {
      expect(mind.liminal.value).toBe(1)
      expect(mind.x.value).toBeCloseTo(bustOf(m.minds[i]!).x, 9)
    })
  })

  test("build: nothing at 0, the leaves first, the whole at 1", () => {
    expect(buildAt(0, 4, 0)).toBe(0)
    expect(buildAt(0.25, 4, 0)).toBe(1)
    expect(buildAt(0.25, 4, 1)).toBe(0)
    expect(buildAt(1, 4, 3)).toBe(1)
    const agent = new HyperAgent({ size: s, depth: 2, build: 0 })
    void agent.parts
    for (const h of [...agent.minds, ...agent.bolts, ...agent.hands, agent.eye]) expect(shown(h)).toBe(0)
    agent.build.value = 1 / 3
    const m = agent.machine
    agent.minds.forEach((mind, i) => {
      if (m.minds[i]!.crown) return
      expect(shown(mind)).toBe(m.minds[i]!.stage === 0 ? 1 : 0)
    })
  })

  test("the eye's frame at war is the crown's triangle (Mind's own outline), its mind's R from the side", () => {
    const agent = new HyperAgent({ size: s, depth: 1 })
    void agent.parts
    const crown = agent.machine.minds[0]!
    const pts = agent.eyeFrame.points
    const top = pts.reduce((a, p) => (p.y > a.y ? p : a))
    expect(top.x).toBeCloseTo(crown.ax, 6)
    expect(top.y).toBeCloseTo(crown.ay, 6)
    expect(mindRadius(crown.side) * MIND.triRadius * Math.sqrt(3)).toBeCloseTo(crown.side, 9)
  })
})
