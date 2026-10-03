/**
 * sketch-tumble.test.ts — "select something and rotate it, and then you
 * see, oh, it's actually 3D." The trackball (sketch/xform.ts) and how a
 * tumble turns a symbol's own orientation params (vocabulary.ts
 * tumbleParams), never the camera and never its place on the page.
 */

import { describe, expect, test } from "bun:test"
import {
  eulerToMat3,
  isIdentity,
  mat3Apply,
  mat3Mul,
  mat3ToEuler,
  rotX,
  rotY,
  trackball,
  IDENTITY,
  type Mat3,
} from "../sketch/xform"
import { buildSymbol, canTumble, transformSymbol } from "../sketch/vocabulary"
import { History } from "../sketch/state"
import { forwardFor } from "../vocabulary/MindVirus/MindVirus"
import type { PlacedSymbol } from "../sketch/protocol"

const sym = (symbol: string, params: Record<string, unknown>): PlacedSymbol => ({ id: "s", symbol, params, fromStrokes: [] })
const close = (a: Mat3, b: Mat3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 9))
const K = Math.PI / 360

describe("trackball math", () => {
  test("euler ↔ matrix round-trips in the renderer's Rz(b)·Rx(p)·Ry(h) order", () => {
    for (const [h, p, b] of [[0.6, 0.4, 0], [-2.1, 1.2, 0.7], [3, -0.3, -2.5]] as const) {
      const e = mat3ToEuler(eulerToMat3(h, p, b))
      close(eulerToMat3(e.h, e.p, e.b), eulerToMat3(h, p, b))
      expect(e.h).toBeCloseTo(h, 9)
      expect(e.p).toBeCloseTo(p, 9)
      expect(e.b).toBeCloseTo(b, 9)
    }
  })

  test("drag right = yaw: the front (+z, toward the viewer) swings right (+x)", () => {
    const v = mat3Apply(trackball(Math.PI / 2 / K, 0, K), { x: 0, y: 0, z: 1 })
    expect(v.x).toBeCloseTo(1, 9)
    expect(v.z).toBeCloseTo(0, 9)
  })

  test("drag up (page dy < 0) = pitch: the front swings up (scene +y)", () => {
    const v = mat3Apply(trackball(0, -Math.PI / 2 / K, K), { x: 0, y: 0, z: 1 })
    expect(v.y).toBeCloseTo(1, 9)
    expect(v.z).toBeCloseTo(0, 9)
  })

  test("increments compose about the VIEW axes, whatever the object's pose", () => {
    // Already yawed 90°: a further drag right still turns about the screen's vertical.
    const m = mat3Mul(trackball(10, 0, K), rotY(Math.PI / 2))
    close(m, rotY(Math.PI / 2 + 10 * K))
    close(mat3Mul(trackball(0, 10, K), rotX(0.3)), rotX(0.3 + 10 * K))
  })

  test("a tumble is not identity; a still one is", () => {
    expect(isIdentity({ ...IDENTITY, tumble: trackball(5, 0, K) })).toBe(false)
    expect(isIdentity({ ...IDENTITY, tumble: trackball(0, 0, K) })).toBe(true)
  })
})

describe("tumbling symbols", () => {
  test("which symbols are 3D", () => {
    expect(canTumble(sym("cube", {}))).toBe(true)
    expect(canTumble(sym("mindVirus", {}))).toBe(true)
    for (const flat of ["circle", "square", "text", "figure", "eye"]) expect(canTumble(sym(flat, {}))).toBe(false)
  })

  test("cube: its h/p/b become the tumbled orientation, its place does not move", () => {
    const s = sym("cube", { cx: 500, cy: 600, size: 200, h: 0.6, p: 0.4, b: 0.1 })
    const m = trackball(40, -25, K)
    const out = transformSymbol(s, { tumble: m })
    expect(out.params.cx).toBe(500)
    expect(out.params.cy).toBe(600)
    expect(out.params.size).toBe(200)
    // The page roll b is the negated scene bank.
    const want = mat3Mul(m, eulerToMat3(0.6, 0.4, -0.1))
    close(eulerToMat3(out.params.h as number, out.params.p as number, -(out.params.b as number)), want)
    // …and the built holon carries exactly that orientation.
    const g = buildSymbol(out) as unknown as { h: { value: number }; p: { value: number }; b: { value: number } }
    close(eulerToMat3(g.h.value, g.p.value, g.b.value), want)
  })

  test("cube with missing h/p starts from the builder's defaults", () => {
    const out = transformSymbol(sym("cube", { cx: 0, cy: 0, size: 100 }), { tumble: trackball(30, 0, K) })
    close(eulerToMat3(out.params.h as number, out.params.p as number, -(out.params.b as number)), mat3Mul(trackball(30, 0, K), eulerToMat3(0.6, 0.4, 0)))
  })

  test("mindVirus: heading + tilt turn as a direction", () => {
    const s = sym("mindVirus", { x: 400, y: 400, size: 100, heading: 0, fold: 1 })
    // Facing right (+x); a yaw of −45° swings that heading toward the viewer (+z).
    const yawed = transformSymbol(s, { tumble: rotY(-Math.PI / 4) })
    expect(yawed.params.heading).toBeCloseTo(0, 9)
    expect(yawed.params.tilt).toBeCloseTo(Math.PI / 4, 9)
    expect(yawed.params.x).toBe(400)
    // Built: the creature's forward is that 3D direction.
    const mv = buildSymbol(yawed) as unknown as { h: { value: number }; p: { value: number }; b: { value: number } }
    const f = forwardFor(mv.h.value, mv.p.value, mv.b.value)
    expect(f.x).toBeCloseTo(Math.SQRT1_2, 6)
    expect(f.y).toBeCloseTo(0, 6)
    expect(f.z).toBeCloseTo(Math.SQRT1_2, 6)
  })

  test("flat symbols and ink ignore a tumble; the whole gesture is one undo step", () => {
    const circle = sym("circle", { cx: 1, cy: 2, r: 3 })
    expect(transformSymbol(circle, { tumble: trackball(50, 50, K) }).params).toEqual(circle.params)
    const cube = { ...sym("cube", { cx: 0, cy: 0, size: 100, h: 0, p: 0, b: 0 }), id: "c" }
    const h = new History({ strokes: [{ id: "k", points: [{ x: 1, y: 1, pressure: 0.5, t: 0 }] }], symbols: [cube] })
    h.do({ kind: "transform", ids: ["c", "k"], xf: { ...IDENTITY, tumble: trackball(Math.PI / 2 / K, 0, K) } })
    expect(h.state.symbols[0]!.params.h).toBeCloseTo(Math.PI / 2, 9)
    expect(h.state.strokes[0]!.points[0]).toEqual({ x: 1, y: 1, pressure: 0.5, t: 0 })
    h.undo()
    expect(h.state.symbols[0]!.params.h).toBe(0)
  })
})
