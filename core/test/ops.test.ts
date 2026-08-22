/**
 * Semantic ops — the AST transformation as a pure function.
 * The contract: rewrite only the targeted literals/statement; every
 * other byte of the DreamWeaving survives untouched.
 */

import { describe, expect, test } from "bun:test"
import { applySetBackdrop, applySetOverride, injectAnchors } from "../scripts/ops"

const bare = `/**
 * FoundingSmoke.ts — A DreamWeaving
 */

import { Dream, render } from "../src/index"

export class FoundingSmokeDream extends Dream {
  unfold() {
    this.play(Create(this.square), 2)
    this.wait(1)
  }
}

if (import.meta.main) render(FoundingSmokeDream)
`

const withBackdrop = `/**
 * FoundingSmoke.ts — A DreamWeaving
 */

import { Dream, render } from "../src/index"

export class FoundingSmokeDream extends Dream {
  unfold() {
    this.backdrop("refs/video-01/DialecticalThinking.mkv", { offset: 0 })
    this.play(Create(this.square), 2)
    this.wait(1)
  }
}

if (import.meta.main) render(FoundingSmokeDream)
`

describe("applySetBackdrop", () => {
  test("inserts as first statement of unfold() when absent", () => {
    const res = applySetBackdrop(bare, {
      op: "setBackdrop",
      path: "refs/video-01/DialecticalThinking.mkv",
      offset: 0,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toBe(withBackdrop)
  })

  test("rewrites path and offset literals when present", () => {
    const res = applySetBackdrop(withBackdrop, {
      op: "setBackdrop",
      path: "refs/video-01/frame_020.png",
      offset: 1.5,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toBe(
      withBackdrop.replace(
        `this.backdrop("refs/video-01/DialecticalThinking.mkv", { offset: 0 })`,
        `this.backdrop("refs/video-01/frame_020.png", { offset: 1.5 })`,
      ),
    )
  })

  test("preserves all bytes outside the edited statement", () => {
    const res = applySetBackdrop(bare, {
      op: "setBackdrop",
      path: "refs/x.png",
      offset: 0,
    })
    if (!res.ok) throw new Error(res.reason)
    const inserted = `    this.backdrop("refs/x.png", { offset: 0 })\n`
    expect(res.text.replace(inserted, "")).toBe(bare)
  })

  test("adds the offset property to an existing options literal lacking it", () => {
    const src = withBackdrop.replace(
      `this.backdrop("refs/video-01/DialecticalThinking.mkv", { offset: 0 })`,
      `this.backdrop("refs/video-01/DialecticalThinking.mkv", {})`,
    )
    const res = applySetBackdrop(src, { op: "setBackdrop", path: "refs/y.mp4", offset: 2 })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain(`this.backdrop("refs/y.mp4", { offset: 2 })`)
  })

  test("adds the options argument when the call has only a path", () => {
    const src = withBackdrop.replace(
      `this.backdrop("refs/video-01/DialecticalThinking.mkv", { offset: 0 })`,
      `this.backdrop("refs/video-01/DialecticalThinking.mkv")`,
    )
    const res = applySetBackdrop(src, { op: "setBackdrop", path: "refs/y.mp4", offset: 0 })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain(`this.backdrop("refs/y.mp4", { offset: 0 })`)
  })

  test("is idempotent", () => {
    const once = applySetBackdrop(bare, { op: "setBackdrop", path: "refs/z.mkv", offset: 0 })
    if (!once.ok) throw new Error(once.reason)
    const twice = applySetBackdrop(once.text, { op: "setBackdrop", path: "refs/z.mkv", offset: 0 })
    if (!twice.ok) throw new Error(twice.reason)
    expect(twice.text).toBe(once.text)
  })

  test("rejects when no unfold() exists", () => {
    const res = applySetBackdrop(`export const x = 1\n`, {
      op: "setBackdrop",
      path: "refs/x.png",
    })
    expect(res.ok).toBe(false)
  })
})

const weaving = `export class SmokeDream extends Dream {
  square = new Square({ size: 200, tint: RED, x: -300 })
  circle = new Circle({ radius: 100 })

  unfold() {
    this.play(Create(this.square), 2)
  }
}
`
const squareSpan = (): { start: number; end: number } => {
  const start = weaving.indexOf("new Square")
  return { start, end: weaving.indexOf(")", start) + 1 }
}

describe("applySetOverride", () => {
  test("rewrites an existing property literal, all other bytes intact", () => {
    const res = applySetOverride(weaving, {
      op: "setOverride",
      span: squareSpan(),
      className: "Square",
      name: "size",
      value: 260,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toBe(weaving.replace("size: 200", "size: 260"))
  })

  test("inserts a new property, keeping a single-line literal single-line", () => {
    const res = applySetOverride(weaving, {
      op: "setOverride",
      span: squareSpan(),
      className: "Square",
      name: "opacity",
      value: 0.5,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toBe(
      weaving.replace(
        "{ size: 200, tint: RED, x: -300 }",
        "{ size: 200, tint: RED, x: -300, opacity: 0.5 }",
      ),
    )
  })

  test("writes string and boolean literals", () => {
    const res = applySetOverride(weaving, {
      op: "setOverride",
      span: squareSpan(),
      className: "Square",
      name: "label",
      value: "the first breath",
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain(`label: "the first breath"`)
    const res2 = applySetOverride(weaving, {
      op: "setOverride",
      span: squareSpan(),
      className: "Square",
      name: "visible",
      value: false,
    })
    if (!res2.ok) throw new Error(res2.reason)
    expect(res2.text).toContain("visible: false")
  })

  test("rebases via className when the span has drifted", () => {
    const res = applySetOverride(weaving, {
      op: "setOverride",
      span: { start: 1, end: 2 }, // stale offsets
      className: "Square",
      name: "size",
      value: 240,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toBe(weaving.replace("size: 200", "size: 240"))
  })

  test("rejects when the construction is gone", () => {
    const res = applySetOverride(weaving, {
      op: "setOverride",
      span: { start: 1, end: 2 },
      className: "Pentagon",
      name: "size",
      value: 1,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain("no longer exists")
  })

  test("rejects a drifted span when the className is ambiguous", () => {
    const twice = weaving.replace(
      "circle = new Circle({ radius: 100 })",
      "circle = new Square({ size: 90 })",
    )
    const res = applySetOverride(twice, {
      op: "setOverride",
      span: { start: 1, end: 2 },
      className: "Square",
      name: "size",
      value: 240,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain("ambiguous")
  })

  test("adds the overrides argument when the construction has none", () => {
    const bare = weaving.replace("new Circle({ radius: 100 })", "new Circle()")
    const start = bare.indexOf("new Circle()")
    const res = applySetOverride(bare, {
      op: "setOverride",
      span: { start, end: start + "new Circle()".length },
      className: "Circle",
      name: "radius",
      value: 60,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain("new Circle({ radius: 60 })")
  })
})

describe("injectAnchors", () => {
  test("wraps constructions, play and backdrop with original-source spans", () => {
    const withBd = weaving.replace(
      "this.play(Create(this.square), 2)",
      `this.backdrop("refs/x.mkv", { offset: 0 })\n    this.play(Create(this.square), 2)`,
    )
    const out = injectAnchors(withBd, "core/demo/Smoke.ts", "./anchors")
    expect(out.startsWith(`import { __dt } from "./anchors"\n`)).toBe(true)
    const sq = squareSpan() // spans in withBd match weaving up to the unfold body
    expect(out).toContain(
      `square = __dt(new Square({ size: 200, tint: RED, x: -300 }), "core/demo/Smoke.ts:${sq.start}:${sq.end}")`,
    )
    const bdStart = withBd.indexOf("this.backdrop(")
    const bdEnd = withBd.indexOf(")", withBd.indexOf("offset")) + 1 // after "…0 })"
    expect(out).toContain(`"core/demo/Smoke.ts:${bdStart}:${bdEnd}")`)
    const playStart = withBd.indexOf("this.play(")
    expect(out).toContain(`__dt(this.play(`)
    expect(out).toContain(`"core/demo/Smoke.ts:${playStart}:`)
  })

  test("returns the source untouched when there is nothing to anchor", () => {
    const plain = `export const answer = 42\n`
    expect(injectAnchors(plain, "core/demo/Plain.ts", "./anchors")).toBe(plain)
  })

  test("round-trip: a span recorded by the transform targets the original file", () => {
    const out = injectAnchors(weaving, "core/demo/Smoke.ts", "./anchors")
    const m = out.match(/"core\/demo\/Smoke\.ts:(\d+):(\d+)"\)/)
    expect(m).not.toBeNull()
    const start = Number(m![1])
    const end = Number(m![2])
    expect(weaving.slice(start, end).startsWith("new ")).toBe(true)
  })
})
