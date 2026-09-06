/**
 * The Labyrinth maze math (geometry/labyrinth.ts) and its part. The
 * generator is random-seeded, so nothing here compares against a fixed
 * maze — the tests pin the STRUCTURAL invariants the 2021 construction
 * promises (TheWall/TheLabyrinth.py): a perfect maze (spanning tree
 * over the polar cells), every wall chain connected to the citadel, no
 * orphans, cells held roughly square by the adaptive doubling, chains
 * as clean simple polylines — and seeded determinism.
 */

import { describe, expect, test } from "bun:test"
import {
  ARC_SEGMENTS,
  CELL_WIDTH_LIMIT,
  buildAdjacency,
  carveMaze,
  filterConnectedToCitadel,
  generateLabyrinth,
  mergeSegmentsIntoChains,
  mulberry32,
  ringLayout,
  type LabyrinthConfig,
  type Vec2,
} from "../src/geometry/labyrinth"
import { Labyrinth } from "../vocabulary/Labyrinth/Labyrinth"
import { Line } from "../src/parts/index"

/** The demo's config plus scale/shape variations. */
const CONFIGS: LabyrinthConfig[] = [
  { radius: 650, citadelRadius: 165, targetCellSize: 80, seed: 42 },
  { radius: 1800, citadelRadius: 600, targetCellSize: 200, seed: 42 },
  { radius: 1000, citadelRadius: 300, targetCellSize: 90, seed: 7 },
  { radius: 500, citadelRadius: 120, targetCellSize: 55, seed: 1234 },
]

const radiusOf = (p: Vec2): number => Math.hypot(p.x, p.y)

describe("ringLayout — the adaptive doubling", () => {
  test("counts only ever carry over or double, and cells stay roughly square", () => {
    for (const cfg of CONFIGS) {
      const layout = ringLayout(cfg.radius, cfg.citadelRadius, cfg.targetCellSize)
      const t = layout.ringThickness
      for (let r = 0; r < layout.ringCount; r++) {
        const count = layout.cellsPerRing[r]!
        if (r > 0) {
          const prev = layout.cellsPerRing[r - 1]!
          expect(count === prev || count === 2 * prev).toBe(true)
        }
        // Arc per cell at the ring's mid-circumference: never wider than
        // the doubling limit, never squashed below one thickness.
        const midRadius = cfg.citadelRadius + (r + 0.5) * t
        const arc = (2 * Math.PI * midRadius) / count
        expect(arc).toBeLessThanOrEqual(CELL_WIDTH_LIMIT * t * 1.01)
        expect(arc).toBeGreaterThan(t * 0.99)
      }
      expect(layout.radii[0]).toBeCloseTo(cfg.citadelRadius, 9)
      expect(layout.radii[layout.ringCount]).toBeCloseTo(cfg.radius, 9)
    }
  })
})

describe("carveMaze — a perfect maze", () => {
  test("passages form a spanning tree: cellCount − 1 edges, all cells connected", () => {
    for (const cfg of CONFIGS) {
      const layout = ringLayout(cfg.radius, cfg.citadelRadius, cfg.targetCellSize)
      const adjacency = buildAdjacency(layout.cellsPerRing)
      const passages = carveMaze(adjacency, mulberry32(cfg.seed))
      expect(passages.size).toBe(layout.cellCount - 1)

      // Union-find over the carved passages: one component, no cycles.
      const parent = Array.from({ length: layout.cellCount }, (_, i) => i)
      const find = (i: number): number => {
        while (parent[i] !== i) i = parent[i] = parent[parent[i]!]!
        return i
      }
      let merges = 0
      for (const key of passages) {
        const [a, b] = key.split("|").map(Number) as [number, number]
        const ra = find(a)
        const rb = find(b)
        expect(ra).not.toBe(rb) // an equal pair would be a cycle
        parent[ra] = rb
        merges++
      }
      expect(merges).toBe(layout.cellCount - 1)
      const root = find(0)
      for (let i = 0; i < layout.cellCount; i++) expect(find(i)).toBe(root)
    }
  })

  test("every passage joins actual graph neighbors", () => {
    const cfg = CONFIGS[0]!
    const layout = ringLayout(cfg.radius, cfg.citadelRadius, cfg.targetCellSize)
    const adjacency = buildAdjacency(layout.cellsPerRing)
    const passages = carveMaze(adjacency, mulberry32(cfg.seed))
    for (const key of passages) {
      const [a, b] = key.split("|").map(Number) as [number, number]
      expect(adjacency[a]!).toContain(b)
      expect(adjacency[b]!).toContain(a)
    }
  })
})

describe("filterConnectedToCitadel", () => {
  test("keeps the flood from the citadel, drops the floating island", () => {
    const touching: Vec2[] = [{ x: 100, y: 0 }, { x: 150, y: 0 }]
    const chainedOn: Vec2[] = [{ x: 150, y: 0 }, { x: 150, y: 50 }]
    const island: Vec2[] = [{ x: 300, y: 300 }, { x: 350, y: 300 }]
    const kept = filterConnectedToCitadel([touching, chainedOn, island], 100, 1)
    expect(kept).toHaveLength(2)
    expect(kept).toContainEqual(touching)
    expect(kept).toContainEqual(chainedOn)
  })
})

describe("mergeSegmentsIntoChains", () => {
  const p = (x: number, y: number): Vec2 => ({ x, y })

  test("degree-2 junctions merge into one ordered chain, whatever the orientations", () => {
    // a: 0→1, b REVERSED: 2→1, c: 2→3 — still one chain 0…3 (or its mirror).
    const chains = mergeSegmentsIntoChains(
      [
        [p(0, 0), p(10, 0)],
        [p(20, 0), p(10, 0)],
        [p(20, 0), p(30, 0)],
      ],
      0.5,
    )
    expect(chains).toHaveLength(1)
    const xs = chains[0]!.map((q) => q.x)
    expect(chains[0]!).toHaveLength(4)
    const forward = [0, 10, 20, 30]
    expect(xs).toEqual(xs[0] === 0 ? forward : [...forward].reverse())
  })

  test("T-junctions never merge — three meeting segments stay three chains", () => {
    const chains = mergeSegmentsIntoChains(
      [
        [p(-10, 0), p(0, 0)],
        [p(0, 0), p(10, 0)],
        [p(0, 0), p(0, 10)],
      ],
      0.5,
    )
    expect(chains).toHaveLength(3)
  })
})

describe("generateLabyrinth — the assembled maze", () => {
  test("every chain is connected to the citadel through shared endpoints (no orphans)", () => {
    for (const cfg of CONFIGS) {
      const { chains } = generateLabyrinth(cfg)
      const tolerance = cfg.targetCellSize * 0.02
      const close = (a: Vec2, b: Vec2): boolean => Math.hypot(a.x - b.x, a.y - b.y) < tolerance

      const endpoints = chains.map((c) => [c[0]!, c[c.length - 1]!] as const)
      const reached = new Set<number>()
      chains.forEach((chain, i) => {
        if (chain.some((q) => Math.abs(radiusOf(q) - cfg.citadelRadius) < tolerance)) {
          reached.add(i)
        }
      })
      expect(reached.size).toBeGreaterThan(0)
      let changed = true
      while (changed) {
        changed = false
        for (let i = 0; i < chains.length; i++) {
          if (reached.has(i)) continue
          for (const j of reached) {
            const [a0, a1] = endpoints[i]!
            const [b0, b1] = endpoints[j]!
            if (close(a0, b0) || close(a0, b1) || close(a1, b0) || close(a1, b1)) {
              reached.add(i)
              changed = true
              break
            }
          }
        }
      }
      expect(reached.size).toBe(chains.length)
    }
  })

  test("chains are simple polylines inside the annulus, radiating order, honest stats", () => {
    for (const cfg of CONFIGS) {
      const { chains, cells, stats } = generateLabyrinth(cfg)
      expect(stats.chainCount).toBe(chains.length)
      expect(stats.passageCount).toBe(cells.cellCount - 1)
      expect(stats.connectedSegments + stats.orphanSegments).toBe(stats.wallSegments)

      const slack = 1e-6
      let previousInnermost = -Infinity
      for (const chain of chains) {
        expect(chain.length).toBeGreaterThanOrEqual(2)
        let innermost = Infinity
        for (let i = 0; i < chain.length; i++) {
          const q = chain[i]!
          expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true)
          const r = radiusOf(q)
          expect(r).toBeGreaterThanOrEqual(cfg.citadelRadius - slack)
          expect(r).toBeLessThanOrEqual(cfg.radius + slack)
          innermost = Math.min(innermost, r)
          if (i > 0) {
            expect(Math.hypot(q.x - chain[i - 1]!.x, q.y - chain[i - 1]!.y)).toBeGreaterThan(0)
          }
        }
        expect(innermost).toBeGreaterThanOrEqual(previousInnermost)
        previousInnermost = innermost
      }
    }
  })

  test("the rim stays open: no wall arc lies on the outermost radius", () => {
    // The 2021 construction gives the outermost ring no outer arcs (:196)
    // — you can wander in from outside. Radial walls still reach the rim,
    // so the test is that no RUN of points sits on it, which is what an
    // arc would be.
    for (const cfg of CONFIGS) {
      const { chains } = generateLabyrinth(cfg)
      const slack = cfg.targetCellSize * 0.01
      const onRim = (q: Vec2): boolean => Math.abs(radiusOf(q) - cfg.radius) < slack
      for (const chain of chains) {
        for (let i = 2; i < chain.length; i++) {
          expect(onRim(chain[i]!) && onRim(chain[i - 1]!) && onRim(chain[i - 2]!)).toBe(false)
        }
      }
    }
  })

  test("no cell is walled in: every cell keeps at least one carved passage", () => {
    // The spanning tree already forbids isolation, but state it over the
    // CELLS rather than the edge count — an unreachable room is the one
    // failure a maze must never have.
    for (const cfg of CONFIGS) {
      const layout = ringLayout(cfg.radius, cfg.citadelRadius, cfg.targetCellSize)
      const passages = carveMaze(buildAdjacency(layout.cellsPerRing), mulberry32(cfg.seed))
      const degree = new Array<number>(layout.cellCount).fill(0)
      for (const key of passages) {
        const [a, b] = key.split("|").map(Number) as [number, number]
        degree[a]!++
        degree[b]!++
      }
      for (let i = 0; i < layout.cellCount; i++) expect(degree[i]).toBeGreaterThan(0)
    }
  })

  test("the citadel is a closed circle on its radius", () => {
    const cfg = CONFIGS[0]!
    const { citadel, cells } = generateLabyrinth(cfg)
    expect(citadel.length).toBe(ARC_SEGMENTS * cells.cellsPerRing[0]! * 2 + 1)
    expect(citadel[0]).toEqual(citadel[citadel.length - 1]!)
    for (const q of citadel) expect(radiusOf(q)).toBeCloseTo(cfg.citadelRadius, 6)
  })

  test("seeded determinism: same seed same maze, different seed different maze", () => {
    const cfg = CONFIGS[0]!
    const first = JSON.stringify(generateLabyrinth(cfg))
    const again = JSON.stringify(generateLabyrinth({ ...cfg }))
    const other = JSON.stringify(generateLabyrinth({ ...cfg, seed: 43 }))
    expect(again).toBe(first)
    expect(other).not.toBe(first)
  })
})

describe("Labyrinth part", () => {
  test("composes the citadel circle plus one Line per chain, bound to tint and stroke", () => {
    const lab = new Labyrinth({})
    expect(lab.parts).toHaveLength(lab.maze.chains.length + 1)
    expect(lab.chains.every((line) => line instanceof Line)).toBe(true)
    expect(lab.chains[0]!.points.length).toBe(lab.maze.chains[0]!.length)
    expect(lab.citadel.radius.value).toBe(lab.citadelRadius.value)
  })

  test("createAnim covers the citadel and every chain", () => {
    const lab = new Labyrinth({})
    const anim = lab.createAnim()
    const params = new Set(anim.tracks.map((t) => t.param))
    expect(params.has(lab.citadel.creation)).toBe(true)
    for (const chain of lab.chains) expect(params.has(chain.creation)).toBe(true)
  })

  test("two parts with one seed build the identical maze", () => {
    const a = new Labyrinth({ seed: 5 })
    const b = new Labyrinth({ seed: 5 })
    expect(JSON.stringify(a.maze)).toBe(JSON.stringify(b.maze))
  })
})
