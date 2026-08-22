/**
 * Semantic ops — the AST transformation as a pure function.
 * The contract: rewrite only the targeted literals/statement; every
 * other byte of the DreamWeaving survives untouched.
 */

import { describe, expect, test } from "bun:test"
import { applySetBackdrop } from "../scripts/ops"

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
