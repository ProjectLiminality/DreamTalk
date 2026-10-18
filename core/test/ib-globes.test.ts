/**
 * "Why 60 globes?" — the InterBrain song's globes, kept light at the source.
 *
 *  - Earth `resolution` (construction-time): a small globe is meshed coarser.
 *  - Static meshes are shared by every Earth built at the same radius.
 *  - A night or lakes that are off hold no mesh.
 *  - Worldview builds only the optional globes (`globes`) a scene visits.
 */

import { describe, expect, test } from "bun:test"
import { Earth } from "../vocabulary/Earth/Earth"
import { Worldview } from "../vocabulary/Worldview/Worldview"
import type { Surface } from "../src/parts/surface"

const triangles = (e: Earth): number => {
  let n = 0
  for (const h of e.walk()) {
    const s = h as unknown as Surface
    if (s.indices) {
      void s.geomVersion
      n += s.indices.length / 3
    }
  }
  return n
}

describe("Earth resolution", () => {
  test("coarser shares carry far fewer triangles", () => {
    const full = triangles(new Earth({ mapLines: false }))
    const half = triangles(new Earth({ mapLines: false, resolution: 0.5 }))
    const quarter = triangles(new Earth({ mapLines: false, resolution: 0.25 }))
    expect(half).toBeLessThan(full / 2)
    expect(quarter).toBeLessThan(full / 5)
  })

  test("Earths at one radius share their land arrays", () => {
    const a = new Earth({ radius: 33, mapLines: false })
    const b = new Earth({ radius: 33, mapLines: false })
    void a.parts
    void b.parts
    expect(a.landSheets[0]!.positions).toBe(b.landSheets[0]!.positions)
    expect(a.ball.positions).toBe(b.ball.positions)
  })

  test("a night that is off holds no mesh; it is built when it rises", () => {
    const e = new Earth({ mapLines: false })
    void e.parts
    const cap = e.nightSheets[0]!
    void cap.geomVersion
    expect(cap.positions.length).toBe(0)
    e.nightOpacity.value = 1
    void cap.geomVersion
    expect(cap.positions.length).toBeGreaterThan(0)
  })
})

describe("Worldview globes", () => {
  const earths = (w: Worldview) => [...w.walk()].filter((h) => h instanceof Earth).length
  test("all three by default; only the source Earth with none", () => {
    expect(earths(new Worldview({}))).toBe(3)
    expect(earths(new Worldview({ globes: [] }))).toBe(1)
    expect(earths(new Worldview({ globes: ["radiant"] }))).toBe(2)
  })
})
