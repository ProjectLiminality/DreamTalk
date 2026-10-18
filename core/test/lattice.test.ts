import { describe, expect, test } from "bun:test"
import { Automaton, gatherStateSpace } from "../src/automaton"
import { currentNode, digitsOf, edgesOf, factorsOf, layoutOf, machinesOf, nodeOf, songPath } from "../src/lattice"
import { Timeline } from "../src/timeline"
import { CoherenceBeacon } from "../vocabulary/CoherenceBeacon/CoherenceBeacon"
import { DreamNode } from "../vocabulary/DreamNode/DreamNode"
import { Mind } from "../vocabulary/Mind/Mind"
import { Eye } from "../vocabulary/Eye/Eye"
import { Worldview } from "../vocabulary/Worldview/Worldview"
import { StateLattice } from "../vocabulary/StateLattice/StateLattice"

describe("the holarchy of machines", () => {
  test("a DreamNode holding a Mind: 2 × (2 × 2) — the Mind a sub-machine, woven into one 8-node lattice", () => {
    const node = new DreamNode({ face: new Mind() })
    const top = machinesOf(gatherStateSpace([node]))
    const m = top.parts[0]!
    expect(m.label).toBe("DreamNode")
    expect(m.parts.map((p) => p.label)).toEqual(["Mind"])
    expect(10 ** m.woven).toBeCloseTo(8, 9)
    const fs = factorsOf(m)
    expect(fs.map((f) => f.factor.size)).toEqual([8])
  })

  test("a Worldview is too big to weave: factored into a lattice per machine, its parts a level down", () => {
    const m = machinesOf(gatherStateSpace([new Worldview()])).parts[0]!
    expect(m.woven).toBeGreaterThan(9) // > 10^9 states woven
    const fs = factorsOf(m)
    expect(fs.length).toBeGreaterThan(5)
    expect(fs.every((f) => f.factor.size <= 128)).toBe(true)
    expect(fs[0]!.depth).toBe(0)
    expect(fs.some((f) => f.depth >= 1 && f.factor.label === "Eye")).toBe(true)
    // Factoring is lossless: the factors' state counts multiply back to the whole.
    const logSum = fs.reduce((s, f) => s + Math.log10(f.factor.size), 0)
    expect(logSum).toBeCloseTo(m.woven, 9)
  })
})

describe("one lattice", () => {
  const beacon = machinesOf(gatherStateSpace([new CoherenceBeacon()])).parts[0]!
  const f = factorsOf(beacon)[0]!.factor

  test("mixed radix: every node its own tuple", () => {
    expect(f.size).toBe(64)
    for (let n = 0; n < f.size; n++) expect(nodeOf(f, digitsOf(f, n))).toBe(n)
  })

  test("the layout is injective (no two states coincide), axes past three nested smaller", () => {
    const places = layoutOf(f, 240)
    const keys = new Set(places.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`))
    expect(keys.size).toBe(f.size)
  })

  test("edges join states one step apart along exactly one axis", () => {
    const edges = edgesOf(f)
    // 6 binary axes: each node has one neighbour per axis it can step up: 6 · 32
    expect(edges.length).toBe(6 * 32)
    for (const [a, b] of edges) {
      const da = digitsOf(f, a)
      const db = digitsOf(f, b)
      expect(da.filter((d, i) => d !== db[i]).length).toBe(1)
    }
  })
})

describe("a song through the lattice", () => {
  test("the path is the song's states in order, kept only where they change", () => {
    const eye = new Eye()
    const f = factorsOf(machinesOf(gatherStateSpace([eye])).parts[0]!)[0]!.factor
    const tl = new Timeline([
      { anim: eye.stateAxis("opening").to("closed"), start: 1, duration: 1 },
      { anim: eye.stateAxis("opening").to("open"), start: 3, duration: 1 },
    ])
    const path = songPath(f, (p, t) => tl.valueAt(p, t), 0, tl.duration, 0.1)
    expect(path.map((s) => s.node)).toEqual([1, 0, 1])
    expect(path[1]!.t).toBeGreaterThan(1.4)
    expect(path[1]!.t).toBeLessThan(1.6)
    expect(currentNode(f)).toBe(1)
  })
})

describe("the lattice is walkable", () => {
  test("a node stands for its state: firing its axis there walks the machine (AxisOpts.at)", () => {
    const node = new DreamNode({ face: new Mind() })
    const lattice = new StateLattice({ machine: machinesOf(gatherStateSpace([node])) })
    const [axis] = lattice.axes()
    expect(axis).toBeDefined()
    const nodes = lattice.drawn[0]!.nodes!
    expect(nodes.length).toBe(8)
    const target = axis!.at!(nodes[5]!)!
    expect(target).toBe(axis!.positions[5]!.name)
    const a = new Automaton(gatherStateSpace([node], { axes: lattice.axes() }))
    a.enter()
    a.fire(axis!.id, target)
    a.clock = 10
    a.apply()
    expect(currentNode(lattice.drawn[0]!.factor)).toBe(5)
  })
})
