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
import { dirname } from "node:path"
import {
  appendComment,
  commentedScenes,
  commentsFile,
  isValidScene,
  legacyCommentsFile,
  parseCommentInput,
  readComments,
  samePath,
  sceneFileOf,
  setResolved,
  sourceOf,
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
    await mkdir(dirname(commentsFile(root, "s01")), { recursive: true })
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

/** A temp repo with a scene registry, a DreamWeaving, and the classes it names. */
const writeRepo = async (files: Record<string, string>) => {
  for (const [rel, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, rel)), { recursive: true })
    await writeFile(join(root, rel), text, "utf8")
  }
}

const REGISTRY = `import { ArenaDream } from "./arena/Arena"
import { OutsideDream } from "../../holons/Outside/Outside"
export const scenes = {
  arena: ArenaDream,
  outside: OutsideDream,
}
`

describe("beside the scene (git-tracked)", () => {
  test("the registry places a scene's file, and its comments sit next to it", async () => {
    await writeRepo({ "core/demo/scenes.ts": REGISTRY })
    expect(sceneFileOf(root, "arena")).toBe("core/demo/arena/Arena.ts")
    expect(sceneFileOf(root, "outside")).toBe("holons/Outside/Outside.ts")
    expect(sceneFileOf(root, "absent")).toBeUndefined()
    expect(commentsFile(root, "arena")).toBe(`${root}core/demo/arena/arena.comments.jsonl`)
    // A key the registry cannot place still has a home.
    expect(commentsFile(root, "absent")).toBe(`${root}core/demo/absent.comments.jsonl`)

    await appendComment(root, input({ scene: "arena" }))
    const raw = await readFile(`${root}core/demo/arena/arena.comments.jsonl`, "utf8")
    expect(raw.trim().split("\n")).toHaveLength(1)
    expect(await commentedScenes(root)).toEqual(["arena"])
  })

  test("the first cut's gitignored notes are still read, oldest first", async () => {
    const old = { id: "old", ts: "2026-09-17T00:00:00.000Z", path: null, pathLabel: "x", text: "legacy", t: 0, scene: "s01" }
    await mkdir(dirname(legacyCommentsFile(root, "s01")), { recursive: true })
    await writeFile(legacyCommentsFile(root, "s01"), JSON.stringify(old) + "\n", "utf8")
    await appendComment(root, input({ text: "new" }))
    expect((await readComments(root, "s01")).map((c) => c.text)).toEqual(["legacy", "new"])
    expect(await commentedScenes(root)).toEqual(["s01"])
  })
})

describe("resolving", () => {
  test("resolve and reopen are appended events, folded on read", async () => {
    const a = await appendComment(root, input({ text: "a" }))
    const b = await appendComment(root, input({ text: "b" }))
    const r = await setResolved(root, "s01", a.id, true)
    expect(r?.resolved).toBe(true)
    let back = await readComments(root, "s01")
    expect(back.find((c) => c.id === a.id)?.resolved).toBe(true)
    expect(back.find((c) => c.id === a.id)?.resolvedAt).toBeTruthy()
    expect(back.find((c) => c.id === b.id)?.resolved).toBeUndefined()

    await setResolved(root, "s01", a.id, false)
    back = await readComments(root, "s01")
    expect(back.find((c) => c.id === a.id)?.resolved).toBe(false)
    expect(back).toHaveLength(2)
    // Nothing rewritten: two comments, two events, four lines.
    const raw = await readFile(commentsFile(root, "s01"), "utf8")
    expect(raw.trim().split("\n")).toHaveLength(4)
  })

  test("resolving a legacy note writes beside the scene, never to the legacy file", async () => {
    const old = { id: "old", ts: "2026-09-17T00:00:00.000Z", path: null, pathLabel: "x", text: "legacy", t: 0, scene: "s01" }
    await mkdir(dirname(legacyCommentsFile(root, "s01")), { recursive: true })
    await writeFile(legacyCommentsFile(root, "s01"), JSON.stringify(old) + "\n", "utf8")
    await setResolved(root, "s01", "old", true)
    expect((await readComments(root, "s01"))[0]?.resolved).toBe(true)
    expect((await readFile(legacyCommentsFile(root, "s01"), "utf8")).trim().split("\n")).toHaveLength(1)
  })

  test("an unknown id is undefined and writes nothing", async () => {
    expect(await setResolved(root, "s01", "nope", true)).toBeUndefined()
    expect(await readComments(root, "s01")).toEqual([])
  })
})

describe("the anchor an agent follows", () => {
  test("name and owners are validated when present", () => {
    const ok = parseCommentInput({ ...input(), name: "opGlyph", owners: ["Group", "Calculator"] })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.input.owners).toEqual(["Group", "Calculator"])
    expect(parseCommentInput({ ...input(), name: "a b" }).ok).toBe(false)
    expect(parseCommentInput({ ...input(), owners: ["../x"] }).ok).toBe(false)
  })

  test("sourceOf finds the line that makes the holon, and its class", async () => {
    await writeRepo({
      "core/demo/scenes.ts": REGISTRY,
      "core/demo/arena/Arena.ts": "export class ArenaDream {\n  app = new Abacus()\n}\n",
      "core/demo/arena/Abacus.ts":
        "/** doc */\nexport class Abacus extends Null {\n  frame = new Bead()\n  readonly plusGlyph = new Bead({ size: 3 })\n}\n",
      "core/src/Bead.ts": "// the bead\n\nexport class Bead {}\n",
    })
    const at = await sourceOf(root, {
      ...input({ scene: "arena", name: "plusGlyph", owners: ["Abacus"] }),
      path: { root: 0, indices: [1], className: "Bead" },
      id: "x",
      ts: "",
    })
    expect(at.site).toEqual({ file: "core/demo/arena/Abacus.ts", line: 4, text: "readonly plusGlyph = new Bead({ size: 3 })" })
    expect(at.decl).toEqual({ file: "core/src/Bead.ts", line: 3, text: "export class Bead {}" })

    // A root is a field of the Dream: found in the scene's own file.
    const rootAt = await sourceOf(root, {
      ...input({ scene: "arena", name: "app", owners: [] }),
      path: { root: 0, indices: [], className: "Abacus" },
      id: "y",
      ts: "",
    })
    expect(rootAt.site).toMatchObject({ file: "core/demo/arena/Arena.ts", line: 2 })
    expect(rootAt.decl).toMatchObject({ file: "core/demo/arena/Abacus.ts", line: 2 })
  })
})
