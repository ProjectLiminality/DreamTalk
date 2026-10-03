/**
 * Creator mode's pure seams (editor/creator.ts): the one key, the rim's
 * buffer→client mapping, and the selection token the player hands the
 * editor. The dot and the rims themselves are verified by driving the
 * pages headless; what is pinned here is what they stand on.
 */

import { expect, test, describe } from "bun:test"
import { CREATOR_KEY, bufferToClient, decodePath, encodePath, isCreatorToggle } from "../editor/creator"

const key = (code: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey", boolean>> = {}) => ({
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...mods,
})

describe("isCreatorToggle", () => {
  test("the lone backquote flips the mode", () => {
    expect(CREATOR_KEY.code).toBe("Backquote")
    expect(isCreatorToggle(key("Backquote"))).toBe(true)
  })
  test("never a chord — ⌘` is the system's window cycling, ⌘Space its Spotlight", () => {
    expect(isCreatorToggle(key("Backquote", { metaKey: true }))).toBe(false)
    expect(isCreatorToggle(key("Backquote", { ctrlKey: true }))).toBe(false)
    expect(isCreatorToggle(key("Backquote", { altKey: true }))).toBe(false)
    expect(isCreatorToggle(key("Space", { metaKey: true }))).toBe(false)
  })
})

describe("bufferToClient", () => {
  test("carries a box through the stage's stretch", () => {
    const r = bufferToClient(
      { min: { x: 640, y: 360 }, max: { x: 1280, y: 720 } },
      { left: 100, top: 50, width: 640, height: 360 },
      { width: 1280, height: 720 },
    )
    expect(r).toEqual({ x: 420, y: 230, w: 320, h: 180 })
  })
})

describe("selection token", () => {
  test("round-trips a part path, root-only included", () => {
    const deep = { root: 1, indices: [6, 0], className: "Text" }
    expect(encodePath(deep)).toBe("1-6-0~Text")
    expect(decodePath(encodePath(deep))).toEqual(deep)
    const root = { root: 0, indices: [], className: "Calculator" }
    expect(decodePath(encodePath(root))).toEqual(root)
  })
  test("refuses anything else", () => {
    expect(decodePath("")).toBeUndefined()
    expect(decodePath("1-x~Text")).toBeUndefined()
    expect(decodePath("1-6")).toBeUndefined()
  })
})
