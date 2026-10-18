import { describe, expect, test } from "bun:test"
import { LABELS, SPHERES, Spheres, boltSeats, petals, seats, socialOutline, triangleGrid } from "../vocabulary/Spheres/Spheres"

describe("Spheres — biosphere, social sphere, noosphere", () => {
  test("the social sphere seats 19 people, rows 3-4-5-4-3, on a triangular lattice inside the circle", () => {
    const s = seats()
    expect(s.length).toBe(19)
    const rows = [...new Set(s.map((p) => p.y.toFixed(9)))]
    expect(rows.map((y) => s.filter((p) => p.y.toFixed(9) === y).length)).toEqual([3, 4, 5, 4, 3])
    const a = SPHERES.lattice
    expect(Math.hypot(s[1]!.x - s[0]!.x, s[1]!.y - s[0]!.y)).toBeCloseTo(a, 9)
    expect(Math.hypot(s[3]!.x - s[0]!.x, s[3]!.y - s[0]!.y)).toBeCloseTo(a, 9) // a neighbour in the next row
    for (const p of s) expect(Math.hypot(p.x, p.y) + SPHERES.bust / 2).toBeLessThan(1)
    expect(boltSeats().length).toBe(2 + 3 + 4 + 3 + 2)
  })

  test("the triangle grid's lines pass between the seats (each seat an up-triangle's centroid) and stay inside", () => {
    const grid = triangleGrid()
    for (const [p, q] of grid) {
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(0.95 + 1e-9)
      expect(Math.hypot(q.x, q.y)).toBeLessThanOrEqual(0.95 + 1e-9)
      for (const s of seats()) {
        // distance from the seat to the line ≥ the incircle radius a/(2√3)
        const dx = q.x - p.x
        const dy = q.y - p.y
        const d = Math.abs(dx * (p.y - s.y) - dy * (p.x - s.x)) / Math.hypot(dx, dy)
        expect(d).toBeGreaterThan(SPHERES.lattice / (2 * Math.sqrt(3)) - 1e-9)
      }
    }
    for (const run of petals()) for (const p of run) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(0.95 + 1e-9)
  })

  test("the social sphere's outline: rounding 1 the circle, 0 the square of the same half-side", () => {
    for (const p of socialOutline(1)) expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 9)
    const sq = socialOutline(0)
    for (const p of sq) expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeCloseTo(1, 9)
  })

  test("row ↔ stack: the film's places; the noosphere largest on top in the stack", () => {
    const s = new Spheres({ size: 125 })
    expect([0, 1, 2].map((i) => s.placement(i).x)).toEqual([...SPHERES.row.x])
    s.stack.value = 1
    const [bio, soc, noo] = [0, 1, 2].map((i) => s.placement(i))
    expect(noo!.y).toBeGreaterThan(soc!.y)
    expect(soc!.y).toBeGreaterThan(bio!.y)
    expect(noo!.r).toBeGreaterThan(soc!.r)
    expect(soc!.r).toBeGreaterThan(bio!.r)
    expect(noo!.r).toBeCloseTo(166, 9)
  })

  test("the healing trickles down: the noosphere first, the Earth last; 0 and 1 are the endpoints", () => {
    const s = new Spheres()
    s.healed.value = 0
    expect([0, 1, 2].map((i) => s.healOf(i))).toEqual([0, 0, 0])
    s.healed.value = 0.4
    expect(s.healOf(2)).toBeGreaterThan(s.healOf(1))
    expect(s.healOf(1)).toBeGreaterThan(s.healOf(0))
    s.healed.value = 1
    expect([0, 1, 2].map((i) => s.healOf(i))).toEqual([1, 1, 1])
  })

  test("three namings, three spheres; the states are walkable", () => {
    expect(LABELS.length).toBe(3)
    expect(LABELS[2]).toEqual(["Biosphere", "Social Sphere", "Noosphere"])
    const s = new Spheres()
    void s.parts
    expect(s.stateSpace()!.axes.map((a) => a.id)).toEqual(["stack", "labels", "icons", "arrows", "fragmented", "healed"])
    expect(s.noosphere.stateSpace()).toBeUndefined()
  })
})
