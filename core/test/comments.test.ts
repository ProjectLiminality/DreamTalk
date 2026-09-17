/**
 * The comment store (scripts/comments.ts) — the intake half of voice-first
 * commenting (docs/EDITOR-VOICE-COMMENTS.md step 1).
 *
 * Pure over a temp repo root: validation of an untrusted POST body, the
 * append→read round-trip that persists a comment against a selection, the
 * path match that filters the panel's view, and the resilience that lets one
 * mangled JSONL line not blind the reader to the rest. The daemon owns the
 * HTTP skin; this pins the behaviour the endpoint round-trips.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  appendComment,
  commentsFile,
  isValidScene,
  parseCommentInput,
  readComments,
  samePath,
  type CommentInput,
} from "../scripts/comments"

let root: string
beforeEach(async () => {
  // A repo root ends in a slash, the way daemon.ts's does.
  root = (await mkdtemp(join(tmpdir(), "dt-comments-"))) + "/"
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const input = (over: Partial<CommentInput> = {}): CommentInput => ({
  path: { root: 0, indices: [2, 1], className: "Circle" },
  pathLabel: "Circle",
  text: "make this redder",
  t: 1.5,
  scene: "s01",
  bounds: { minX: 10, minY: 20, maxX: 110, maxY: 120 },
  ...over,
})

describe("parseCommentInput", () => {
  test("accepts a well-formed body and trims the text", () => {
    const parsed = parseCommentInput({ ...input(), text: "  spaced  " })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.input.text).toBe("spaced")
  })

  test("accepts a scene-level (null path) note", () => {
    const parsed = parseCommentInput({ ...input(), path: null })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.input.path).toBeNull()
  })

  test("rejects empty text, a bad scene, a non-finite t, a malformed path", () => {
    expect(parseCommentInput({ ...input(), text: "   " }).ok).toBe(false)
    expect(parseCommentInput({ ...input(), scene: "../etc" }).ok).toBe(false)
    expect(parseCommentInput({ ...input(), t: Infinity }).ok).toBe(false)
    expect(parseCommentInput({ ...input(), path: { root: 0, indices: ["x"], className: "C" } }).ok).toBe(false)
    expect(parseCommentInput("not an object").ok).toBe(false)
  })

  test("rejects malformed bounds but allows omitting them", () => {
    expect(parseCommentInput({ ...input(), bounds: { minX: "a", minY: 0, maxX: 1, maxY: 1 } }).ok).toBe(false)
    const noBounds = parseCommentInput({ ...input(), bounds: null })
    expect(noBounds.ok).toBe(true)
  })
})

describe("isValidScene", () => {
  test("registry keys pass, path escapes fail", () => {
    expect(isValidScene("s01")).toBe(true)
    expect(isValidScene("video01")).toBe(true)
    expect(isValidScene("../secret")).toBe(false)
    expect(isValidScene("a/b")).toBe(false)
  })
})

describe("append → read round-trip", () => {
  test("a comment persists against its selection with id, ts, path, label, text, t, bounds", async () => {
    const written = await appendComment(root, input())
    expect(written.id).toBeTruthy()
    expect(written.ts).toBeTruthy()

    const back = await readComments(root, "s01")
    expect(back).toHaveLength(1)
    const c = back[0]!
    expect(c.id).toBe(written.id)
    expect(c.text).toBe("make this redder")
    expect(c.t).toBe(1.5)
    expect(c.pathLabel).toBe("Circle")
    expect(c.path).toEqual({ root: 0, indices: [2, 1], className: "Circle" })
    expect(c.bounds).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 120 })
  })

  test("appends accumulate oldest-first in the scene's JSONL", async () => {
    await appendComment(root, input({ text: "first" }))
    await appendComment(root, input({ text: "second" }))
    const back = await readComments(root, "s01")
    expect(back.map((c) => c.text)).toEqual(["first", "second"])

    // The file the operating agent cats: one JSON object per line.
    const raw = await readFile(commentsFile(root, "s01"), "utf8")
    expect(raw.trim().split("\n")).toHaveLength(2)
    expect(() => JSON.parse(raw.trim().split("\n")[0]!)).not.toThrow()
  })

  test("comments are scoped per scene", async () => {
    await appendComment(root, input({ scene: "s01", text: "in s01" }))
    await appendComment(root, input({ scene: "s02", text: "in s02" }))
    expect((await readComments(root, "s01")).map((c) => c.text)).toEqual(["in s01"])
    expect((await readComments(root, "s02")).map((c) => c.text)).toEqual(["in s02"])
  })

  test("a missing scene file reads as no comments", async () => {
    expect(await readComments(root, "never")).toEqual([])
  })

  test("a mangled line is skipped, not fatal", async () => {
    await mkdir(join(root, "core/.comments"), { recursive: true })
    const good = JSON.stringify({ id: "a", ts: new Date().toISOString(), path: null, pathLabel: "x", text: "ok", t: 0, scene: "s01" })
    await writeFile(commentsFile(root, "s01"), `${good}\n{ this is not json\n${good}\n`, "utf8")
    const back = await readComments(root, "s01")
    expect(back).toHaveLength(2)
  })
})

describe("samePath (the panel's filter)", () => {
  test("matches identical paths, distinguishes different ones", () => {
    const a = { root: 0, indices: [1, 2], className: "Circle" }
    expect(samePath(a, { root: 0, indices: [1, 2], className: "Circle" })).toBe(true)
    expect(samePath(a, { root: 0, indices: [1, 3], className: "Circle" })).toBe(false)
    expect(samePath(a, { root: 1, indices: [1, 2], className: "Circle" })).toBe(false)
    expect(samePath(a, { root: 0, indices: [1, 2], className: "Square" })).toBe(false)
  })

  test("scene-level notes (null) match only each other", () => {
    expect(samePath(null, null)).toBe(true)
    expect(samePath(null, { root: 0, indices: [], className: "C" })).toBe(false)
  })
})
