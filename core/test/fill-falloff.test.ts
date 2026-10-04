/**
 * The radial-light fill (Stroke.fillFalloff, render/fill.ts) — the CPU half:
 * every stroke defaults to flat, only a fill that asks switches material,
 * and a radius of 0 means the shape's own extent from its local origin.
 * (The shader half is proven by render: /demo/?scene=fillglow, and the
 * state gate keeps every other fill byte-identical.)
 */

import { describe, expect, test } from "bun:test"
import { FillShape, ellipsePolygon } from "../src/render/fill"
import { Circle, Rectangle } from "../src/parts/primitives"

describe("fillFalloff", () => {
  test("every stroke is flat by default", () => {
    const c = new Circle()
    expect(c.fillFalloff.value).toBe(0)
    expect(c.fillFalloffRadius.value).toBe(0)
    expect(new Rectangle({ fillFalloff: 0.6 }).fillFalloff.value).toBe(0.6)
  })

  test("only the fill that asks leaves the shared flat material", () => {
    const flat = new FillShape(1)
    const lit = new FillShape(2)
    lit.useGradient()
    expect(flat.mesh.material).toBe(flat.material)
    expect(lit.mesh.material).not.toBe(lit.material)
    expect(new FillShape(3).mesh.material).toBe(flat.mesh.material)
  })

  test("radius 0 is the shape's own extent; an explicit radius is kept", () => {
    const lit = new FillShape(1)
    lit.useGradient()
    lit.setPolygon(ellipsePolygon(50, 30))
    lit.setGradient(0.5, 0)
    expect(lit.mesh.userData.dtFillFalloff).toBe(0.5)
    expect(lit.mesh.userData.dtFillFalloffRadius).toBeCloseTo(50, 9)
    lit.setGradient(0.5, 20)
    expect(lit.mesh.userData.dtFillFalloffRadius).toBe(20)
  })
})
