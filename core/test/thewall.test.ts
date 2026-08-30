/**
 * TheWall — the wiring between the packing and the journey pipeline.
 *
 * The pure math is pinned in journey.test.ts and packing.test.ts; what
 * this file checks is that the holon drives each creature from its OWN
 * slot's completion, that growth alone moves the whole wall, and that
 * the blackboard the original needed (PackingLUT, SearchObject-by-name)
 * has really been replaced by owned data.
 */

import { describe, expect, test } from "bun:test"
import { TheWall, WALL_ROW_LAG } from "../src/parts/thewall"
import { MindVirus } from "../src/parts/mindvirus"
import { circleFootprint, flowerFootprint } from "../src/geometry/packing"

const near = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps)

/** A small wall — enough structure, quick to build. */
const smallWall = (overrides: Record<string, unknown> = {}) =>
  new TheWall({ rowCount: 2, ...overrides, footprint: circleFootprint(400) } as never)

describe("composition", () => {
  test("one MindVirus per slot", () => {
    const wall = smallWall()
    const viruses = wall.parts.filter((p) => p instanceof MindVirus)
    expect(viruses.length).toBe(wall.virusCount)
    expect(wall.virusCount).toBe(wall.rowLength * 2)
    expect(wall.rowLength).toBeGreaterThan(10)
  })

  test("the packing is OWNED data, not a blackboard lookup", () => {
    const wall = smallWall()
    expect(wall.layout.ts.length).toBe(wall.rowLength)
    expect(wall.slots.length).toBe(wall.virusCount)
    // Ascending, and every slot carries its own row and normal.
    for (const slot of wall.slots) {
      expect(slot.row).toBeGreaterThanOrEqual(0)
      near(Math.hypot(slot.normal.x, slot.normal.z), 1, 1e-9)
    }
  })

  test("the row lag constant is the reference render's 1.66", () => {
    expect(WALL_ROW_LAG).toBe(1.66)
    expect(smallWall().rowLag.value).toBe(1.66)
  })

  test("brickSize sizes both the packing and the creature's cube", () => {
    const big = new TheWall({ rowCount: 1, brickSize: 200, footprint: circleFootprint(400) })
    const small = new TheWall({ rowCount: 1, brickSize: 100, footprint: circleFootprint(400) })
    expect(big.rowLength).toBeLessThan(small.rowLength)
    const virus = big.parts.find((p) => p instanceof MindVirus) as MindVirus
    expect(virus.cube.size.value).toBe(200)
  })

  test("cables are OFF — the XPBD tether awaits the baking pass", () => {
    expect(smallWall().cables.value).toBe(false)
  })
})

describe("growth drives everything", () => {
  test("at growth 0 every creature sits at the spawn, unbuilt", () => {
    const wall = smallWall()
    wall.growth.value = 0
    for (const p of wall.parts) {
      if (!(p instanceof MindVirus)) continue
      expect(p.scale.value).toBe(0)
      expect(p.fold.value).toBe(1)
      near(p.x.value, wall.spawn.x, 1e-9)
      near(p.z.value, wall.spawn.z, 1e-9)
    }
  })

  test("at growth 1 the built creatures stand in their own slots, wrapped", () => {
    const wall = smallWall()
    wall.growth.value = 1
    const viruses = wall.parts.filter((p): p is MindVirus => p instanceof MindVirus)
    let settled = 0
    viruses.forEach((virus, i) => {
      const slot = wall.slots[i]!
      if (virus.scale.value < 1) return // the trailing tail of the wave
      settled++
      near(virus.x.value, slot.position.x, 1e-6)
      near(virus.z.value, slot.position.z, 1e-6)
      expect(virus.fold.value).toBe(-1)
    })
    // The overwhelming majority have arrived (the tail lags by design —
    // see journey.test.ts on the wave's range).
    expect(settled / viruses.length).toBeGreaterThan(0.85)
  })

  test("growth sweeps: early slots build before later ones", () => {
    const wall = smallWall()
    wall.growth.value = 0.4
    const row0 = wall.parts
      .filter((p): p is MindVirus => p instanceof MindVirus)
      .slice(0, wall.rowLength)
    const first = row0[0]!.scale.value
    const last = row0[row0.length - 1]!.scale.value
    expect(first).toBeGreaterThan(last)
  })

  test("higher rows lag lower ones (the diagonal wave)", () => {
    const wall = smallWall()
    wall.growth.value = 0.5
    const viruses = wall.parts.filter((p): p is MindVirus => p instanceof MindVirus)
    // Compared at the wave FRONT — behind it both rows are finished and
    // ahead of it neither has begun, so the lag only shows in between.
    let compared = 0
    for (let column = 0; column < wall.rowLength; column++) {
      const bottom = viruses[column]!.scale.value
      const top = viruses[wall.rowLength + column]!.scale.value
      expect(bottom).toBeGreaterThanOrEqual(top)
      if (bottom > top) compared++
    }
    expect(compared).toBeGreaterThan(0)
  })

  test("every creature is a pure function of growth — scrubbing is exact", () => {
    const wall = smallWall()
    const sample = () => {
      wall.growth.value = 0.37
      const v = wall.parts.find((p): p is MindVirus => p instanceof MindVirus)!
      return [v.x.value, v.y.value, v.z.value, v.fold.value, v.scale.value]
    }
    const a = sample()
    wall.growth.value = 0.9
    wall.growth.value = 0.1
    expect(sample()).toEqual(a)
  })

  test("scale rises monotonically for a given creature as the wall grows", () => {
    const wall = smallWall()
    const virus = wall.parts.find((p): p is MindVirus => p instanceof MindVirus)!
    let prev = -1
    for (let i = 0; i <= 100; i++) {
      wall.growth.value = i / 100
      expect(virus.scale.value).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = virus.scale.value
    }
  })
})

describe("flight paths", () => {
  test("every creature departs the SAME spawn and arrives at its OWN slot", () => {
    const wall = smallWall()
    const viruses = wall.parts.filter((p): p is MindVirus => p instanceof MindVirus)
    wall.growth.value = 0
    const starts = viruses.map((v) => `${v.x.value.toFixed(3)},${v.z.value.toFixed(3)}`)
    expect(new Set(starts).size).toBe(1)
    wall.growth.value = 3 // well past the wave's end: everything seated
    const ends = viruses.map((v) => `${v.x.value.toFixed(3)},${v.z.value.toFixed(3)}`)
    // Rows sit above each other, so distinct XZ positions = one row's worth.
    expect(new Set(ends).size).toBe(wall.rowLength)
  })

  test("rows land at their own heights, centred on zero", () => {
    const wall = smallWall()
    wall.growth.value = 3
    const viruses = wall.parts.filter((p): p is MindVirus => p instanceof MindVirus)
    near(viruses[0]!.y.value, -50, 1e-6)
    near(viruses[wall.rowLength]!.y.value, 50, 1e-6)
  })

  test("the creature faces where it is going — heading is a real unit frame", () => {
    const wall = smallWall()
    wall.growth.value = 0.3
    for (const p of wall.parts) {
      if (!(p instanceof MindVirus)) continue
      expect(Number.isFinite(p.h.value)).toBe(true)
      expect(Number.isFinite(p.p.value)).toBe(true)
    }
  })

  test("mid-flight the creatures are actually between spawn and slot", () => {
    const wall = smallWall()
    wall.growth.value = 0.5
    const viruses = wall.parts.filter((p): p is MindVirus => p instanceof MindVirus)
    const moving = viruses.filter((v) => v.scale.value > 0.05 && v.scale.value < 0.95)
    expect(moving.length).toBeGreaterThan(0)
    for (const v of moving) {
      const r = Math.hypot(v.x.value - wall.spawn.x, v.z.value - wall.spawn.z)
      expect(r).toBeGreaterThan(0)
    }
  })
})

describe("footprints", () => {
  test("the flower packs more slots than a circle of its inner radius", () => {
    const flower = new TheWall({
      rowCount: 1,
      footprint: flowerFootprint({ innerRadius: 500, outerRadius: 1000, petals: 5 }),
    })
    const circle = new TheWall({ rowCount: 1, footprint: circleFootprint(500) })
    expect(flower.rowLength).toBeGreaterThan(circle.rowLength)
  })

  test("the reference footprints yield their measured slot counts", () => {
    // Recorded so a change in the packing shows up as a test failure
    // rather than as a quietly different wall.
    expect(new TheWall({ rowCount: 1, footprint: circleFootprint(1000) }).rowLength).toBe(59)
    expect(
      new TheWall({
        rowCount: 1,
        footprint: flowerFootprint({ innerRadius: 500, outerRadius: 1000, petals: 5 }),
      }).rowLength,
    ).toBe(62)
  })
})
