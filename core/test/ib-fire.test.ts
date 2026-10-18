import { describe, expect, test } from "bun:test"
import { FIRE_ASPECT, FLAME_RAW, Fire, LOGS_RAW, firePath } from "../vocabulary/Fire/Fire"
import { slide07 } from "../vocabulary/Slides/assets/pl02/slide07"
import { RED } from "../src/constants"

describe("Fire — the campfire, read from PL02's Keynote icon", () => {
  test("the flame is Keynote's Fire_80 and the logs are the shape grouped with it", () => {
    const flame = slide07.shapes.find((s) => s.icon === "Fire_80")!
    expect(FLAME_RAW).toBe(flame.subpaths[0]!)
    const group = slide07.groups.find((g) => g.members.includes(flame.id))!
    const logs = slide07.shapes.find((s) => s.subpaths[0] === LOGS_RAW)!
    expect(group.members).toContain(logs.id)
    expect(logs.id).not.toBe(flame.id)
  })

  test("normalised: `size` is the whole height, centred, the flame above the logs", () => {
    const s = 300
    const flame = firePath(FLAME_RAW, s)
    const logs = firePath(LOGS_RAW, s)
    const all = [...flame, ...logs]
    const ys = all.map((p) => p.y)
    const xs = all.map((p) => p.x)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(s, 9)
    expect(Math.max(...ys) + Math.min(...ys)).toBeCloseTo(0, 9)
    expect(Math.max(...xs) + Math.min(...xs)).toBeCloseTo(0, 9)
    expect((Math.max(...xs) - Math.min(...xs)) / s).toBeCloseTo(FIRE_ASPECT, 9)
    // The flame's tip is the top of the fire; the logs hold the bottom.
    expect(Math.max(...flame.map((p) => p.y))).toBeCloseTo(s / 2, 9)
    expect(Math.min(...logs.map((p) => p.y))).toBeCloseTo(-s / 2, 9)
    // Closed outlines.
    for (const path of [flame, logs]) {
      expect(path[0]!.x).toBeCloseTo(path[path.length - 1]!.x, 9)
      expect(path[0]!.y).toBeCloseTo(path[path.length - 1]!.y, 9)
    }
  })

  test("red ink over a black body, the bodies before the ink", () => {
    const f = new Fire({ size: 200 })
    void f.parts
    expect(f.tint.value).toEqual(RED)
    expect(f.opaque.value).toBe(1)
    expect(f.parts.indexOf(f.body)).toBeLessThan(f.parts.indexOf(f.logs))
    expect(f.parts.indexOf(f.logs)).toBeLessThan(f.parts.indexOf(f.flame))
    expect(f.reach).toBe(100)
  })
})
