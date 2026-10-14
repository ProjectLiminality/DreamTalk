/**
 * "Morph to…" (editor/morphto.ts): the op a selection + a click write —
 * placed like ⌘K, addressed the way the scene's code addresses holons.
 */

import { describe, expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { Holon } from "../src/holon"
import { completion } from "../src/params"
import { __dt } from "../editor/anchors"
import { addressable, morphOp, MORPH_SECONDS } from "../editor/morphto"

class Dot extends Holon {
  lit = completion(1)
}
class Pair extends Holon {
  left = new Dot()
  right = new Dot()
}

class TwoDream extends Dream {
  dot = new Dot()
  pair = new Pair()
  unfold() {
    this.stage(this.dot)
    this.stage(this.pair)
    __dt(this.play(this.dot.lit.to(1), 2), "core/demo/Two.ts:100:140")
    __dt(this.play(this.dot.lit.to(1), 3), "core/demo/Two.ts:150:190")
  }
}

describe("morph to — this, into that", () => {
  test("the op: after the clip the playhead stands in, Morph(a, b) addressed by path, clocks kept, 4 s", () => {
    const d = new TwoDream()
    d.build()
    const op = morphOp(d, d.dot, d.pair.right, 2.5, { clocks: ["this.map.time"] })
    expect(op).toEqual({
      type: "op",
      op: "appendCheckpoint",
      file: "core/demo/Two.ts",
      placement: "after",
      anchor: { start: 150, end: 190 },
      ordinal: 1,
      targets: [],
      morphs: [{ from: "this.dot", to: "this.pair.right" }],
      clocks: ["this.map.time"],
      duration: MORPH_SECONDS,
    })
  })

  test("refused: into itself; an anonymous part", () => {
    const d = new TwoDream()
    d.build()
    expect(morphOp(d, d.dot, d.dot, 0)).toMatch(/itself/)
    const stray = new Dot()
    expect(morphOp(d, d.dot, stray, 0)).toMatch(/no name/)
  })

  test("a click deep inside a symbol reaches the nearest holon the code names", () => {
    const d = new TwoDream()
    d.build()
    expect(addressable(d, d.pair.left)).toEqual({ holon: d.pair.left, path: "this.pair.left" })
    expect(addressable(d, undefined)).toBeUndefined()
  })
})
