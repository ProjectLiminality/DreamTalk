/**
 * "Morph to…" — the editor's op writes the universal verb into the song:
 * `this.play(Morph(this.a, this.b), d)` at the playhead, with its import.
 */

import { describe, expect, test } from "bun:test"
import { applyAppendCheckpoint } from "../scripts/ops"

const song = `import { Dream, render } from "../src/index"
import { Circle } from "../src/parts/primitives"
import { Truck } from "../vocabulary/Truck/Truck"

export class DotTruckDream extends Dream {
  dot = new Circle({ radius: 40 })
  truck = new Truck({ observer: this.observer, opacity: 0 })

  unfold() {
    this.play(this.dot.x.to(100), 1)
    this.wait(1)
  }
}
`
const anchor = (() => {
  const needle = "this.play(this.dot.x.to(100), 1)"
  const start = song.indexOf(needle)
  return { start, end: start + needle.length }
})()
const file = "core/demo/DotTruck.ts"

describe("appendCheckpoint morphs", () => {
  test("one morph: a play of Morph(a, b) after the anchored clip, and the import beside the others", () => {
    const res = applyAppendCheckpoint(song, {
      op: "appendCheckpoint",
      placement: "after",
      anchor,
      targets: [],
      morphs: [{ from: "this.dot", to: "this.truck" }],
      duration: 4,
      file,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain("    this.play(this.dot.x.to(100), 1)\n    this.play(Morph(this.dot, this.truck), 4)\n")
    expect(res.text).toContain('import { Truck } from "../vocabulary/Truck/Truck"\nimport { Morph } from "../vocabulary/Morph/Morph"\n')
  })

  test("with a pose: under together, both imports", () => {
    const res = applyAppendCheckpoint(song, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [{ path: "this.observer.phi", value: 0.5 }],
      morphs: [{ from: "this.truck", to: "this.dot" }],
      duration: 3,
      file,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain("        Morph(this.truck, this.dot),\n        this.observer.phi.to(0.5),\n")
    expect(res.text).toContain("import { Dream, render, together }")
    expect(res.text).toContain('import { Morph } from "../vocabulary/Morph/Morph"')
  })

  test("an existing Morph import is reused, an existing Morph-module import extended", () => {
    const has = song.replace('import { Truck }', 'import { Morph } from "../vocabulary/Morph/Morph"\nimport { Truck }')
    const op = { op: "appendCheckpoint" as const, placement: "end" as const, targets: [], morphs: [{ from: "this.dot", to: "this.truck" }], file }
    const a = applyAppendCheckpoint(has, op)
    if (!a.ok) throw new Error(a.reason)
    expect(a.text.match(/import \{ Morph \}/g)!.length).toBe(1)
    const shape = song.replace('import { Truck }', 'import { MorphShape } from "../vocabulary/Morph/Morph"\nimport { Truck }')
    const b = applyAppendCheckpoint(shape, op)
    if (!b.ok) throw new Error(b.reason)
    expect(b.text).toContain('import { MorphShape, Morph } from "../vocabulary/Morph/Morph"')
  })

  test("refused: a holon into itself, a path that is not this.*", () => {
    const base = { op: "appendCheckpoint" as const, placement: "end" as const, targets: [], file }
    const self = applyAppendCheckpoint(song, { ...base, morphs: [{ from: "this.dot", to: "this.dot" }] })
    expect(self.ok).toBe(false)
    const foreign = applyAppendCheckpoint(song, { ...base, morphs: [{ from: "this.dot", to: "window.x" }] })
    expect(foreign.ok).toBe(false)
  })

  test("the written call is the real verb: Morph(a, b) of two holons, an Anim", async () => {
    const res = applyAppendCheckpoint(song, {
      op: "appendCheckpoint",
      placement: "after",
      anchor,
      targets: [],
      morphs: [{ from: "this.dot", to: "this.truck" }],
      file,
    })
    if (!res.ok) throw new Error(res.reason)
    const { Morph } = await import("../vocabulary/Morph/Morph")
    const { Circle } = await import("../src/parts/primitives")
    const { Truck } = await import("../vocabulary/Truck/Truck")
    const { Observer } = await import("../src/dream")
    const observer = new Observer()
    const m = Morph(new Circle({ radius: 40 }), new Truck({ observer, opacity: 0 }))
    expect(m.tracks.length).toBeGreaterThan(0)
    expect(res.text).toContain("Morph(this.dot, this.truck)")
  })
})
