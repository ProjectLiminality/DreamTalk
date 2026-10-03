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
import { buildSymbol, canTumble, transformSymbol, tumbleTurn, vocabById } from "../sketch/vocabulary"
import { Group } from "../src/parts/primitives"
import type { Holon } from "../src/holon"
import { coerceParam } from "../scripts/recognize"
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

  // The live preview turns each 3D symbol on a pivot about its (x, y) by
  // the turn its body really takes (main.ts SymbolsDream + tumbleTurn);
  // the commit must build that same picture — body AND tail. Before, the
  // committed tail lay flat on the page while the body had turned.
  test("mindVirus with a drawn tail: the commit is the previewed creature, tail and all", () => {
    const cable = [[200, 520], [260, 470], [320, 500], [370, 450]]
    const s = sym("mindVirus", { x: 400, y: 400, size: 100, heading: -0.9, fold: 1, cable })
    const m = trackball(60, -35, K)
    const P = tumbleTurn(vocabById("mindVirus")!, s.params, m)
    const out = transformSymbol(s, { tumble: m })

    // The cable points: the drawn ones turned rigidly about the body centre.
    const pts = out.params.cable as number[][]
    expect(pts).toHaveLength(cable.length)
    pts.forEach((p, i) => {
      const v = mat3Apply(P, { x: cable[i]![0]! - 400, y: -(cable[i]![1]! - 400), z: 0 })
      expect(p[0]).toBeCloseTo(400 + v.x, 9)
      expect(p[1]).toBeCloseTo(400 - v.y, 9)
      expect(p[2]).toBeCloseTo(v.z, 9)
    })
    expect(pts.some((p) => Math.abs(p[2]!) > 10)).toBe(true)

    // The preview: the UNTURNED build on the pivot main.ts makes, turned by P.
    type MV = Holon & { cable: { _path: (t: number) => { x: number; y: number; z: number } } }
    const flat = buildSymbol(s) as MV
    const e = mat3ToEuler(P)
    const inner = new Group({ members: [flat], x: -400, y: 400 })
    const pivot = new Group({ members: [inner], x: 400, y: -400, h: e.h, p: e.p, b: e.b })
    void pivot.parts // the host walks the tree: parent links are made here
    void inner.parts
    const deep = buildSymbol(out) as MV
    // Same body orientation: P · (the flat body's frame) = the committed frame.
    close(eulerToMat3(deep.h.value, deep.p.value, deep.b.value), mat3Mul(P, eulerToMat3(flat.h.value, flat.p.value, flat.b.value)))
    // Same tail, in world space, along its whole window (the trail source
    // the Cable draws from — private, read here on purpose).
    for (const t of [0, 0.7, 2.2, 4.1, 5.5, 6]) {
      const a = flat.cable._path(t)
      const b = deep.cable._path(t)
      expect(a.x).toBeCloseTo(b.x, 6)
      expect(a.y).toBeCloseTo(b.y, 6)
      expect(a.z).toBeCloseTo(b.z, 6)
    }
  })

  test("a cube's body takes the trackball turn exactly; a MindVirus's drops only the roll", () => {
    const m = trackball(60, -35, K)
    close(tumbleTurn(vocabById("cube")!, { h: 0.6, p: 0.4 }, m), m)
    const P = tumbleTurn(vocabById("mindVirus")!, { heading: -0.9 }, m)
    // Same heading as m gives…
    const f = { x: Math.cos(-0.9), y: -Math.sin(-0.9), z: 0 }
    const a = mat3Apply(P, f)
    const b = mat3Apply(m, f)
    expect(a.x).toBeCloseTo(b.x, 9)
    expect(a.y).toBeCloseTo(b.y, 9)
    expect(a.z).toBeCloseTo(b.z, 9)
    // …but not the same turn: the trackball rolled it, and that is what P leaves out.
    expect(Math.max(...P.map((v, i) => Math.abs(v - m[i]!)))).toBeGreaterThan(1e-3)
  })

  test("a tumbled cable keeps its depth under page moves, scaling with the page", () => {
    const s = sym("mindVirus", { x: 0, y: 0, size: 100, heading: 0, fold: 1, cable: [[-100, 0, 30], { x: -50, y: 0, z: 10 }] })
    const out = transformSymbol(s, { translate: { x: 10, y: 0 }, scale: 2, rotate: 0.5 })
    const [a, b] = out.params.cable as [number[], { x: number; y: number; z: number }]
    expect(a[2]).toBeCloseTo(60, 9)
    expect(b.z).toBeCloseTo(20, 9)
    // Untumbled cables stay two-component (a drawn path never grows a z).
    const drawn = transformSymbol(sym("mindVirus", { x: 0, y: 0, cable: [[1, 2], [3, 4]] }), { rotate: 0.3 })
    expect((drawn.params.cable as number[][])[0]).toHaveLength(2)
  })

  test("a voice edit that hands the tumbled cable back keeps its depth", () => {
    const mv = vocabById("mindVirus")!
    expect(coerceParam(mv, "cable", [[1.23, 2, 30.46], [3, 4]])).toEqual([[1.2, 2, 30.5], [3, 4]])
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
