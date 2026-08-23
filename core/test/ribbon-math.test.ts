import { describe, expect, test } from "bun:test"
import { packSegments } from "../src/render/ribbon-math"

const p = (x: number, y: number, z = 0) => ({ x, y, z })

describe("packSegments", () => {
  test("packs N points into N−1 interleaved segment instances", () => {
    const packed = packSegments([p(0, 0), p(3, 4), p(3, 10)])
    expect(packed.count).toBe(2)
    expect(Array.from(packed.positions)).toEqual([0, 0, 0, 3, 4, 0, 3, 4, 0, 3, 10, 0])
  })

  test("distances are cumulative arc length, start/end per segment", () => {
    const packed = packSegments([p(0, 0), p(3, 4), p(3, 10)])
    expect(Array.from(packed.distances)).toEqual([0, 5, 5, 11])
    expect(packed.totalLength).toBe(11)
  })

  test("3D segments use true euclidean length", () => {
    const packed = packSegments([p(0, 0, 0), p(2, 3, 6)])
    expect(packed.totalLength).toBeCloseTo(7, 12)
  })

  test("degenerate inputs yield zero segments", () => {
    expect(packSegments([]).count).toBe(0)
    expect(packSegments([p(1, 2, 3)]).count).toBe(0)
    expect(packSegments([]).totalLength).toBe(0)
  })

  test("closed polyline: total length of a unit square loop", () => {
    const packed = packSegments([p(0, 0), p(1, 0), p(1, 1), p(0, 1), p(0, 0)])
    expect(packed.count).toBe(4)
    expect(packed.totalLength).toBeCloseTo(4, 12)
  })
})
