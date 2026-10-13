/**
 * Recede — a 3D holon set on a flat page: the same picture, every depth
 * behind the page, solids composited in attach order.
 */

import { describe, expect, test } from "bun:test"
import { Null, type Vec3Like } from "../src/parts/primitives"
import { Surface } from "../src/parts/surface"
import { Recede } from "../src/parts/recede"
import { toWorld } from "../src/parts/soliddrawing"

/** The default observer's eye (dream.ts) and its projection onto z = 0. */
const EYE = { x: 0, y: 0, z: 1500 }
const onPage = (p: Vec3Like) => {
  const u = EYE.z / (EYE.z - p.z)
  return { x: EYE.x + (p.x - EYE.x) * u, y: EYE.y + (p.y - EYE.y) * u }
}

/** A sphere's worth of sample points of radius r, as Nulls in a holder. */
const ball = (r: number) => {
  const pts: Vec3Like[] = []
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2
    const b = Math.acos(1 - (2 * (i + 0.5)) / 64)
    pts.push({ x: r * Math.sin(b) * Math.cos(a), y: r * Math.sin(b) * Math.sin(a), z: r * Math.cos(b) })
  }
  return pts
}

describe("Recede", () => {
  test("keeps the picture (no fit) and puts every depth behind the page", () => {
    const holder = new Null()
    const recede = new Recede({ members: [holder], reach: 200, fit: false, x: 120, y: -40 })
    void recede.parts
    for (const q of ball(200)) {
      const pushed = toWorld(holder, q)
      const flat = onPage({ x: q.x + 120, y: q.y - 40, z: q.z })
      const seen = onPage(pushed)
      expect(seen.x).toBeCloseTo(flat.x, 6)
      expect(seen.y).toBeCloseTo(flat.y, 6)
      expect(pushed.z).toBeLessThan(0)
    }
  })

  test("with fit, a ball of radius `reach` shows a silhouette of radius `reach`", () => {
    const holder = new Null()
    const r = 300
    const recede = new Recede({ members: [holder], reach: r })
    void recede.parts
    // The silhouette of the pushed ball, seen from the eye: its angular
    // radius, carried to the page plane.
    const c = toWorld(holder, { x: 0, y: 0, z: 0 })
    const rr = r * holder.parent!.scale.value
    const d = EYE.z - c.z
    expect(EYE.z * Math.tan(Math.asin(rr / d))).toBeCloseTo(r, 6)
    expect(recede.toPage({ x: 0, y: r, z: 0 }).y).toBeLessThanOrEqual(r + 1e-9)
  })

  test("its solids composite in attach order", () => {
    const sheet = new Surface({ solid: true })
    const recede = new Recede({ members: [sheet], reach: 10 })
    void recede.parts
    expect(sheet.composite).toBe("inOrder")
    expect(new Surface({ solid: true }).composite).toBe("first")
  })
})
