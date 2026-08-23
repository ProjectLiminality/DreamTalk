/**
 * The boundary-loop recovery (parts/outline.ts) — the contour of a
 * triangulated shape, which is what a glyph must be drawn AS while the
 * Write front is still tracing it.
 *
 * Everything here is exact combinatorics on hand-built triangulations,
 * so the assertions are exact too: a square is four corners, an annulus
 * is two rings, and a buffer of two glyphs filtered to one glyph must
 * forget the other entirely.
 */

import { describe, expect, test } from "bun:test"
import {
  boundaryLoops,
  closeLoop,
  insetLoop,
  loopArea,
  startAtTop,
  WELD_PRECISION,
} from "../src/parts/outline"

/** A unit square as two triangles, corners emitted once each. */
const square = {
  positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
  indices: [0, 1, 2, 0, 2, 3],
}

describe("boundaryLoops", () => {
  test("a square is one loop of its four corners", () => {
    const loops = boundaryLoops(square.positions, square.indices)
    expect(loops.length).toBe(1)
    expect(loops[0]!.length).toBe(4)
    // The shared diagonal 0-2 belongs to both triangles and is interior.
    const xs = loops[0]!.map((p) => p.x).sort()
    const ys = loops[0]!.map((p) => p.y).sort()
    expect(xs).toEqual([0, 0, 1, 1])
    expect(ys).toEqual([0, 0, 1, 1])
  })

  test("duplicate corners weld — the same square, every corner repeated", () => {
    // Each triangle carries its own copies of the shared corners, the way
    // a triangulator emits them. Without the weld this would look like
    // two islands and yield two three-corner loops.
    const positions = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0]
    const indices = [0, 1, 2, 3, 4, 5]
    const loops = boundaryLoops(positions, indices)
    expect(loops.length).toBe(1)
    expect(loops[0]!.length).toBe(4)
  })

  test("corners a hair apart weld; a lattice cell apart stay apart", () => {
    // Two triangles meeting along the square's diagonal, with the second
    // triangle's copy of the origin corner displaced. Welded, the
    // diagonal is interior and the boundary is the square's four sides;
    // unwelded, the diagonal belongs to only one triangle each way and
    // the boundary becomes all six edges.
    const near = WELD_PRECISION / 10
    const far = WELD_PRECISION * 10
    const at = (d: number) => [0, 0, 0, 1, 0, 0, 1, 1, 0, d, d, 0, 1, 1, 0, 0, 1, 0]
    const welded = boundaryLoops(at(near), [0, 1, 2, 3, 4, 5])
    expect(welded.length).toBe(1)
    expect(welded[0]!.length).toBe(4)
    // Unwelded, the two triangles still touch at (1, 1) — that corner IS
    // shared exactly — so the boundary is one figure-eight through it,
    // five corners rather than the welded four.
    const split = boundaryLoops(at(far), [0, 1, 2, 3, 4, 5])
    expect(split.length).toBe(1)
    expect(split[0]!.length).toBe(5)
    expect(split[0]!.some((p) => p.x === far && p.y === far)).toBe(true)
  })

  test("an annulus gives two loops — the silhouette and its counter", () => {
    // A square ring: outer square, inner square hole, triangulated as
    // eight triangles around the gap. This is a glyph like `a` or `e` in
    // miniature, and both contours must come back.
    const outer = [
      [-2, -2],
      [2, -2],
      [2, 2],
      [-2, 2],
    ]
    const inner = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]
    const positions: number[] = []
    for (const [x, y] of [...outer, ...inner]) positions.push(x!, y!, 0)
    const indices: number[] = []
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      indices.push(i, j, 4 + j, i, 4 + j, 4 + i)
    }
    const loops = boundaryLoops(positions, indices)
    expect(loops.length).toBe(2)
    expect(loops.map((l) => l.length).sort()).toEqual([4, 4])
    // The walk starts wherever the adjacency map hands it a vertex, so
    // a loop's SIGN is not meaningful — but its magnitude is, and it is
    // what tells the silhouette from the counter.
    const areas = loops.map((l) => Math.abs(loopArea(l))).sort((a, b) => a - b)
    expect(areas).toEqual([4, 16])
  })

  test("the triangle filter isolates one shape from a shared buffer", () => {
    // Two disjoint squares in one buffer — the way one glyph sits beside
    // another in a text geometry. Filtering to the first two triangles
    // must return only the first square.
    const positions = [
      ...square.positions,
      10, 0, 0, 11, 0, 0, 11, 1, 0, 10, 1, 0,
    ]
    const indices = [...square.indices, 4, 5, 6, 4, 6, 7]
    expect(boundaryLoops(positions, indices).length).toBe(2)
    const first = boundaryLoops(positions, indices, (t) => t < 2)
    expect(first.length).toBe(1)
    expect(first[0]!.every((p) => p.x <= 1)).toBe(true)
    const second = boundaryLoops(positions, indices, (t) => t >= 2)
    expect(second.length).toBe(1)
    expect(second[0]!.every((p) => p.x >= 10)).toBe(true)
  })

  test("degenerate slivers are dropped, not counted as boundary", () => {
    const positions = [...square.positions]
    // A triangle whose three corners weld to one point contributes no
    // edges at all.
    const indices = [...square.indices, 0, 0, 0]
    expect(boundaryLoops(positions, indices).length).toBe(1)
  })

  test("loops wind with the filled interior on their left", () => {
    // insetLoop leans entirely on this: it offsets toward the left
    // normal, so the walk direction IS which side is inside. A
    // counter-clockwise square (positive signed area) keeps its inside
    // on the left.
    const loops = boundaryLoops(square.positions, square.indices)
    expect(loopArea(loops[0]!)).toBeGreaterThan(0)
    // A hole's ring runs the other way, because the triangles around it
    // traverse it backwards — which is exactly what makes insetLoop pull
    // a counter OUTWARD in space and INWARD into the ink.
    const outer = [
      [-2, -2],
      [2, -2],
      [2, 2],
      [-2, 2],
    ]
    const inner = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]
    const positions: number[] = []
    for (const [x, y] of [...outer, ...inner]) positions.push(x!, y!, 0)
    const indices: number[] = []
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      indices.push(i, j, 4 + j, i, 4 + j, 4 + i)
    }
    const rings = boundaryLoops(positions, indices).sort(
      (a, b) => Math.abs(loopArea(a)) - Math.abs(loopArea(b)),
    )
    expect(loopArea(rings[0]!)).toBeLessThan(0)
    expect(loopArea(rings[1]!)).toBeGreaterThan(0)
  })

  test("empty input yields no loops", () => {
    expect(boundaryLoops([], [])).toEqual([])
    expect(boundaryLoops(square.positions, [])).toEqual([])
  })

  test("insetLoop shrinks a shape toward its own interior", () => {
    const loops = boundaryLoops(square.positions, square.indices)
    const inset = insetLoop(loops[0]!, 0.1)
    expect(inset.length).toBe(4)
    // Every corner pulled 0.1 in on both axes: the unit square becomes
    // the 0.1..0.9 square, area 0.64.
    expect(Math.abs(loopArea(inset))).toBeCloseTo(0.64, 6)
    for (const p of inset) {
      expect(p.x).toBeGreaterThan(0.05)
      expect(p.x).toBeLessThan(0.95)
      expect(p.y).toBeGreaterThan(0.05)
      expect(p.y).toBeLessThan(0.95)
    }
  })

  test("insetLoop refuses to fold a shape through itself", () => {
    // Half a unit inward on a unit square would turn it inside out; the
    // loop comes back untouched instead — the honest degradation for a
    // stem narrower than the pen.
    const loops = boundaryLoops(square.positions, square.indices)
    expect(insetLoop(loops[0]!, 0.8)).toBe(loops[0]!)
    expect(insetLoop(loops[0]!, 0)).toBe(loops[0]!)
  })

  test("startAtTop rotates a ring to its topmost point, keeping winding", () => {
    const loops = boundaryLoops(square.positions, square.indices)
    const rotated = startAtTop(loops[0]!)
    expect(rotated.length).toBe(loops[0]!.length)
    expect(rotated[0]!.y).toBe(1)
    // Ties break to the left, and the winding is untouched.
    expect(rotated[0]!.x).toBe(0)
    expect(Math.sign(loopArea(rotated))).toBe(Math.sign(loopArea(loops[0]!)))
  })

  test("closeLoop repeats the first point so the stroke closes", () => {
    const loops = boundaryLoops(square.positions, square.indices)
    const closed = closeLoop(loops[0]!)
    expect(closed.length).toBe(5)
    expect(closed[4]).toEqual(closed[0]!)
    expect(closeLoop([])).toEqual([])
  })
})
