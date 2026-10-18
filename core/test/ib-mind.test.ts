import { describe, expect, test } from "bun:test"
import { MIND, Mind, frameOutline } from "../vocabulary/Mind/Mind"
import { Figure } from "../vocabulary/Figure/Figure"
import { FoldableCube } from "../vocabulary/FoldableCube/FoldableCube"
import { Vision } from "../vocabulary/Vision/Vision"
import { BLUE, RED } from "../src/constants"

const R = 200

describe("Mind — domesticated ↔ liminal", () => {
  test("composed of the shared symbols, never redrawn: Figure (bust), FoldableCube (closed), Vision", () => {
    const m = new Mind({ size: R })
    void m.parts
    expect(m.person).toBeInstanceOf(Figure)
    expect(m.person.form.value).toBe(1)
    expect(m.person.height.value).toBeCloseTo(MIND.bust * R, 9)
    expect(m.person.opaque.value).toBe(1)
    expect(m.cube).toBeInstanceOf(FoldableCube)
    expect(m.cube.fold.value).toBe(1)
    expect(m.cube.size.value).toBeCloseTo(MIND.cubeRim * MIND.bust * R, 9)
    expect(m.vision).toBeInstanceOf(Vision)
    // Attach order is composite order: the cube before the person, whose
    // black silhouette must hide the cube behind the head.
    expect(m.parts.indexOf(m.narrative)).toBeLessThan(m.parts.indexOf(m.person))
    expect(m.parts.indexOf(m.person)).toBeLessThan(m.parts.indexOf(m.vision))
    // The cube's rim clears the crown (f7021: by 5 px of 96).
    const hb = MIND.bust * R
    expect(MIND.cubeY * hb + m.cube.size.value / 2).toBeGreaterThan(hb / 2)
  })

  test("liminal 0 — DomesticatedMind in its triangle (MolochConsciousness): an equilateral blue triangle", () => {
    const m = new Mind({ size: R })
    void m.parts
    expect(m.narrative.presence.value).toBe(1)
    expect(m.vision.presence.value).toBe(0)
    expect(m.frame.tint.value).toEqual(BLUE)
    const pts = m.frame.points
    const cy = MIND.triY * R
    const d = pts.map((p) => Math.hypot(p.x, p.y - cy))
    const rt = MIND.triRadius * R
    // Three corners at the circumradius, 120° apart, apex up; every other point inside it.
    const corners = pts.filter((_, i) => d[i]! > rt - 1e-9)
    expect(corners.length).toBe(4) // apex at both ends of the closed loop + two
    expect(corners[0]!.x).toBeCloseTo(0, 9)
    expect(corners[0]!.y).toBeCloseTo(cy + rt, 9)
    const side = Math.hypot(corners[1]!.x - corners[2]!.x, corners[1]!.y - corners[2]!.y)
    expect(side).toBeCloseTo(m.triangleSide, 9)
    expect(Math.hypot(corners[0]!.x - corners[1]!.x, corners[0]!.y - corners[1]!.y)).toBeCloseTo(side, 9)
    // The edges are straight: every sample lies on one of the three edges (distance inradius along its normal).
    for (const p of pts) {
      const proj = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6].map(
        (n) => p.x * Math.cos(n) + (p.y - cy) * Math.sin(n),
      )
      expect(Math.max(...proj)).toBeCloseTo(rt / 2, 9)
    }
  })

  test("liminal 1 — the circle, red; the cube gone, the Vision in the head", () => {
    const m = new Mind({ size: R, liminal: 1 })
    void m.parts
    expect(m.narrative.presence.value).toBe(0)
    expect(m.vision.presence.value).toBe(1)
    expect(m.frame.tint.value).toEqual(RED)
    for (const p of m.frame.points) expect(Math.hypot(p.x, p.y - MIND.circleY * R)).toBeCloseTo(R, 9)
    // The Vision sits inside the head's upper half.
    const hb = MIND.bust * R
    expect(m.vision.y.value).toBeGreaterThan(0)
    expect(m.vision.y.value).toBeLessThan(hb / 2)
  })

  test("the state scrubs: the frame's every ray slides from triangle to circle", () => {
    const a = frameOutline(R, 0)
    const b = frameOutline(R, 1)
    const h = frameOutline(R, 0.5)
    const cy = (l: number) => (MIND.triY + (MIND.circleY - MIND.triY) * l) * R
    for (let i = 0; i < a.length; i++) {
      const ra = Math.hypot(a[i]!.x, a[i]!.y - cy(0))
      const rb = Math.hypot(b[i]!.x, b[i]!.y - cy(1))
      expect(Math.hypot(h[i]!.x, h[i]!.y - cy(0.5))).toBeCloseTo((ra + rb) / 2, 9)
    }
  })

  test("framed fades the frame; both axes walkable", () => {
    const m = new Mind({ size: R, framed: 0 })
    void m.parts
    expect(m.frameLayer.presence.value).toBe(0)
    expect(m.stateSpace()!.axes.map((a) => a.id)).toEqual(["liminal", "framed"])
    // The inner symbols are posed by the mind, not walkable on their own.
    expect(m.cube.stateSpace()).toBeUndefined()
    expect(m.person.stateSpace()).toBeUndefined()
  })
})
