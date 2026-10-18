/**
 * ib-songline.test.ts — the SongLine (vocabulary/SongLine): a column of
 * clipped conversations above a DreamNode, growing one clip at a time.
 */

import { describe, expect, test } from "bun:test"
import { SONGLINE, SongLine, lemniscate } from "../vocabulary/SongLine/SongLine"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe("SongLine", () => {
  test("the clips stack a pitch apart, the lowest the film's distance above the node", () => {
    const s = new SongLine({ size: 100, count: 4 })
    void s.parts
    expect(s.clips.length).toBe(4)
    near(s.clips[3]!.y.value, SONGLINE.last * 100)
    for (let k = 0; k < 3; k++) near(s.clips[k]!.y.value - s.clips[k + 1]!.y.value, SONGLINE.pitch * 100)
    // The last arrow lands on the node's ring.
    const last = s.arrows[3]!.points
    near(last[last.length - 1]!.y, 100)
    near(last[0]!.y, s.clips[3]!.y.value - (SONGLINE.boxH / 2) * 100)
  })

  test("grow: the clips arrive oldest first, one by one", () => {
    const s = new SongLine({ size: 100, count: 3, grow: 0 })
    void s.parts
    expect(s.clips.map((c) => c.there.value)).toEqual([0, 0, 0])
    s.grow.value = 0.5
    expect(s.clips.map((c) => c.there.value)).toEqual([1, 0.5, 0])
    s.grow.value = 1
    expect(s.clips.map((c) => c.there.value)).toEqual([1, 1, 1])
    expect(s.arrows.every((a) => a.creation.value === 1)).toBe(true)
  })

  test("the infinity loop: closed, crossing at the centre, its half-width and half-height", () => {
    const pts = lemniscate(80, 30, 400)
    near(pts[0]!.x, pts[pts.length - 1]!.x)
    near(pts[0]!.x, 0)
    near(pts[0]!.y, 0)
    near(Math.max(...pts.map((p) => p.x)), 80, 1e-3)
    near(Math.max(...pts.map((p) => p.y)), 30, 0.05)
  })
})
