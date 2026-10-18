/**
 * ib-dreamnode.test.ts — the DreamNode (InterBrain film 29:14–35:49) and the
 * rename it rests on (LightNode → DreamTalkSymbol): the face fitted to the
 * ring, the kind's two endpoints, the holarchy's live layout, and the outer
 * tangents of an import.
 */

import { describe, expect, test } from "bun:test"
import {
  CHILD_ORBIT,
  CHILD_SHARE,
  DREAM,
  DREAMER,
  DreamNode,
  FACE_FILL,
  ImportLines,
  outerTangent,
  reachOf,
} from "../vocabulary/DreamNode/DreamNode"
import { DreamTalkSymbol, RAY_REACH } from "../vocabulary/DreamTalkSymbol/DreamTalkSymbol"
import { LightNode } from "../vocabulary/LightNode/LightNode"
import { Group } from "../src/parts/primitives"
import { BLUE, RED } from "../src/constants"
import { parseBoard } from "../sketch/board"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe("DreamTalkSymbol (was LightNode)", () => {
  test("LightNode is the same class, re-exported; old boards open as the new id", () => {
    expect(LightNode).toBe(DreamTalkSymbol)
    const b = parseBoard({ strokes: [], symbols: [{ id: "s1", symbol: "lightNode", params: {} }] })!
    expect(b.symbols[0]!.symbol).toBe("dreamTalkSymbol")
  })

  test("its reach is the axis rays' tips", () => {
    const s = new DreamTalkSymbol({ radius: 80 })
    near(s.reach, 80 * RAY_REACH)
  })
})

describe("DreamNode", () => {
  test("the default dream face reaches FACE_FILL of the ring; the dreamer face is folded away", () => {
    const n = new DreamNode({ radius: 300 })
    void n.parts
    expect(n.kind.value).toBe(DREAM)
    const [dream, dreamer] = n.faces
    expect(dream).toBeInstanceOf(DreamTalkSymbol)
    near(dream!.scale.value * reachOf(dream!), FACE_FILL * 300)
    near(dreamer!.scale.value, 0)
    // f9076: the symbol's own ring is 142.5 / 211.5 of the node's.
    const ring = (dream as DreamTalkSymbol).radius.value * dream!.scale.value
    expect(Math.abs(ring / 300 - 142.5 / 211.5)).toBeLessThan(0.01)
  })

  test("kind: 'dreamer' reads as 1 — the ring turns red, the faces swap; it scrubs between", () => {
    const n = new DreamNode({ radius: 200, kind: "dreamer" })
    void n.parts
    expect(n.kind.value).toBe(DREAMER)
    expect(n.ring.tint.value).toEqual(RED)
    const [dream, dreamer] = n.faces
    near(dream!.scale.value, 0)
    near(dreamer!.scale.value * reachOf(dreamer!), FACE_FILL * 200)
    n.kind.value = 0
    expect(n.ring.tint.value).toEqual(BLUE)
    n.kind.value = 0.5
    near(dream!.scale.value * reachOf(dream!), FACE_FILL * 100)
    const axis = n.stateAxis("kind")
    expect(axis.positions.map((p) => p.name)).toEqual(["dream", "dreamer"])
  })

  test("a given face is held alone and follows the ring live", () => {
    const face = new DreamTalkSymbol({ radius: 100 })
    const n = new DreamNode({ radius: 100, face, kind: "dreamer" })
    void n.parts
    expect(n.faces).toEqual([face])
    near(face.scale.value * face.reach, FACE_FILL * 100)
    n.radius.value = 250
    near(face.scale.value * face.reach, FACE_FILL * 250)
  })

  test("children: a share of the ring, evenly round the orbit, the first at the bottom — live", () => {
    const kids = [new DreamNode(), new DreamNode(), new DreamNode()]
    const p = new DreamNode({ radius: 262, children: kids })
    void p.parts
    expect(p.faces).toEqual([]) // a holder shows only its children (f10760)
    for (const k of kids) {
      near(k.radius.value, CHILD_SHARE * 262)
      near(Math.hypot(k.x.value, k.y.value), CHILD_ORBIT * 262)
    }
    near(kids[0]!.x.value, 0)
    expect(kids[0]!.y.value).toBeLessThan(0)
    // 120° apart.
    const ang = kids.map((k) => Math.atan2(k.y.value, k.x.value))
    near(Math.cos(ang[1]! - ang[0]!), Math.cos((2 * Math.PI) / 3))
    p.radius.value = 100
    near(kids[1]!.radius.value, CHILD_SHARE * 100)
    near(Math.hypot(kids[1]!.x.value, kids[1]!.y.value), CHILD_ORBIT * 100)
  })

  test("circleIn carries a child's ring up through its parents' transforms", () => {
    const kid = new DreamNode()
    const p = new DreamNode({ radius: 200, x: 50, y: -20, scale: 2, children: [kid] })
    const g = new Group({ members: [p] })
    void g.parts
    void p.parts
    const c = kid.circleIn(g)
    near(c.x, 50 + 2 * kid.x.value)
    near(c.y, -20 + 2 * kid.y.value)
    near(c.r, 2 * kid.radius.value)
  })
})

describe("the import's outer tangents", () => {
  const a = { x: 0, y: 0, r: 100 }
  const b = { x: 400, y: 150, r: 30 }

  test("each touches both rings at right angles to their radii", () => {
    for (const side of [1, -1] as const) {
      const [p, q] = outerTangent(a, b, side)
      near(Math.hypot(p!.x - a.x, p!.y - a.y), a.r)
      near(Math.hypot(q!.x - b.x, q!.y - b.y), b.r)
      const dx = q!.x - p!.x
      const dy = q!.y - p!.y
      near((p!.x - a.x) * dx + (p!.y - a.y) * dy, 0, 1e-6)
      near((q!.x - b.x) * dx + (q!.y - b.y) * dy, 0, 1e-6)
    }
  })

  test("the two are mirror images about the line of centres; none when one ring holds the other", () => {
    const [p1] = outerTangent(a, { x: 300, y: 0, r: 40 }, 1)
    const [p2] = outerTangent(a, { x: 300, y: 0, r: 40 }, -1)
    near(p1!.x, p2!.x)
    near(p1!.y, -p2!.y)
    expect(outerTangent(a, { x: 10, y: 0, r: 20 }, 1)).toEqual([])
  })

  test("ImportLines draws them between two nodes in a common frame", () => {
    const kid = new DreamNode()
    const parent = new DreamNode({ radius: 262, children: [kid] })
    const source = new DreamNode({ radius: 212, x: 0, y: -600 })
    const g = new Group({ members: [parent, source] })
    const lines = new ImportLines({ between: [source, kid], frame: () => g })
    g.attach(lines)
    void g.parts
    void lines.parts
    const k = kid.circleIn(g)
    for (const l of [lines.left, lines.right]) {
      const [p, q] = l.points
      near(Math.hypot(p!.x - source.x.value, p!.y - source.y.value), 212)
      near(Math.hypot(q!.x - k.x, q!.y - k.y), k.r)
    }
  })
})
