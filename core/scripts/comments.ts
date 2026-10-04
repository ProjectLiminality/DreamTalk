/**
 * Selection-anchored comments — the intake half of voice-first commenting
 * (docs/EDITOR-VOICE-COMMENTS.md step 1), generalised by creator mode
 * (docs/transmissions/2026-09-20-creator-mode.md: "Changes are git-tracked;
 * Claude-artifact-style comment mode generalised to any element").
 *
 * A comment is a note attached to a SELECTION: the stable SelectionPath
 * (editor/selection.ts) that survives a rebuild, a human-readable label so
 * a reader knows what was pointed at without resolving the path, the note
 * text, the timeline t it was made at, and the selection's screen bounds
 * (main.ts:97 exposes them) so a LATER step can render exactly that region
 * — the bounds+t are captured now so the render is a pure function of them.
 *
 * Storage is one append-only JSONL file per scene, NEXT TO THE SCENE's
 * DreamWeaving — `core/demo/creatormode/creatormode.comments.jsonl` beside
 * `CreatorMode.ts` — and tracked in git like the overrides the ops write
 * into the .ts itself: a comment is a request to change that source, so it
 * travels with it. (The first cut kept them gitignored under core/.comments/;
 * those are still read, so nothing written there is lost.) JSONL is
 * deliberate: the agent can `cat` the file and read every note in order,
 * and an append never rewrites what is already there — resolving is an
 * appended event line too, folded on read, so a git diff of a comment's
 * life is only ever added lines.
 *
 * This module is pure over a root directory; the daemon owns the HTTP
 * surface. Run as a script it is the operating agent's queue:
 *
 *   bun scripts/comments.ts --open [scene]      open comments, with source file:line
 *   bun scripts/comments.ts --all [scene]       every comment, resolved too
 *   bun scripts/comments.ts --resolve <scene> <id>   mark one worked
 */

import { mkdir, readFile, appendFile } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { dirname } from "node:path"
import { Glob } from "bun"
import { whereIsAt, fieldSiteOf, type SourceLine } from "./where"

/** The stable address of a comment's target — mirrors editor/selection.ts. */
export interface CommentPath {
  root: number
  indices: number[]
  className: string
}

/** The selection's screen bounds, in render pixels — the render's future input. */
export interface CommentBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** What the editor POSTs; the store adds `id` and `ts`. */
export interface CommentInput {
  /** The stable SelectionPath, or null for a scene-level (unselected) note. */
  path: CommentPath | null
  /** A human-readable holon name/classname — readable without resolving path. */
  pathLabel: string
  text: string
  /** The timeline t the comment was made at. */
  t: number
  /** The scene registry key (demo/scenes.ts). */
  scene: string
  /** The selection's screen bounds — the render hook's stub input. */
  bounds?: CommentBounds | null
  /**
   * The holon's name in its DreamWeaving — the field that holds it
   * (`opGlyph`), when one does. With `owners` this is what lets the queue
   * point at the line that declares it, not just at its class.
   */
  name?: string
  /** Class names of the holon's wholes, nearest first (`["Group", "Calculator"]`). */
  owners?: string[]
}

export interface Comment extends CommentInput {
  /** A stable id, so a later step can mark one handled without ambiguity. */
  id: string
  /** ISO-8601 wall-clock time the comment was written. */
  ts: string
  /** Whether it has been worked — folded from the file's resolve/reopen events. */
  resolved?: boolean
  /** When it was last resolved (ISO-8601), if it is. */
  resolvedAt?: string
}

/** A line in the JSONL that changes a comment's state rather than adding one. */
interface CommentEvent {
  event: "resolve" | "reopen"
  id: string
  ts: string
}

/** Scene keys are our own registry keys — keep the filename to that shape. */
const SAFE_SCENE = /^[A-Za-z0-9_-]+$/

export const isValidScene = (scene: string): boolean => SAFE_SCENE.test(scene)

/** The first cut's gitignored directory — read, never written. */
export const legacyCommentsFile = (repoRoot: string, scene: string): string =>
  `${repoRoot}core/.comments/${scene}.jsonl`

/**
 * The repo-relative DreamWeaving a scene key is registered from, read off
 * demo/scenes.ts itself (`key: XDream` → `import { XDream } from "./dir/X"`)
 * — the registry is the one place that knows, so it is asked, not mirrored.
 */
export const sceneFileOf = (repoRoot: string, scene: string): string | undefined => {
  if (!isValidScene(scene)) return undefined
  const registry = `${repoRoot}core/demo/scenes.ts`
  if (!existsSync(registry)) return undefined
  const text = readFileSync(registry, "utf8")
  const entry = new RegExp(`^\\s*"?${scene}"?\\s*:\\s*(\\w+)\\b`, "m").exec(text)
  if (!entry) return undefined
  const cls = entry[1]!
  for (const m of text.matchAll(/^import\s*\{([^}]*)\}\s*from\s*"(\.[^"]+)"/gm)) {
    const names = m[1]!.split(",").map((n) => n.trim().split(/\s+as\s+/).pop())
    if (names.includes(cls)) {
      const rel = m[2]!.replace(/^\.\//, "")
      // "../../holons/X/X" walks out of core/demo — normalise the dots.
      const parts: string[] = ["core", "demo"]
      for (const seg of rel.split("/")) {
        if (seg === "..") parts.pop()
        else if (seg !== ".") parts.push(seg)
      }
      return `${parts.join("/")}.ts`
    }
  }
  return undefined
}

/**
 * The JSONL file for one scene: beside its DreamWeaving, named by the
 * scene key (one .ts can register several scenes). A key the registry
 * cannot place lands in core/demo/.
 */
export const commentsFile = (repoRoot: string, scene: string): string => {
  const file = sceneFileOf(repoRoot, scene)
  const dir = file ? `${repoRoot}${dirname(file)}` : `${repoRoot}core/demo`
  return `${dir}/${scene}.comments.jsonl`
}

/** A short, collision-resistant id — time-ordered so a `cat` reads oldest-first. */
export const newCommentId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/**
 * Validate an untrusted POST body into a CommentInput, or return why it is
 * rejected. The daemon exposes this over HTTP, so the shape cannot be
 * assumed — a bad `path`, a non-string `text`, a non-finite `t` are all
 * rejected rather than written.
 */
export const parseCommentInput = (
  body: unknown,
): { ok: true; input: CommentInput } | { ok: false; reason: string } => {
  if (typeof body !== "object" || body === null) return { ok: false, reason: "body is not an object" }
  const b = body as Record<string, unknown>

  if (typeof b.scene !== "string" || !isValidScene(b.scene))
    return { ok: false, reason: "missing or malformed scene key" }
  if (typeof b.text !== "string" || b.text.trim().length === 0)
    return { ok: false, reason: "comment text is empty" }
  if (typeof b.pathLabel !== "string" || b.pathLabel.length === 0)
    return { ok: false, reason: "missing pathLabel" }
  if (typeof b.t !== "number" || !Number.isFinite(b.t))
    return { ok: false, reason: "t is not a finite number" }

  let path: CommentPath | null = null
  if (b.path !== null && b.path !== undefined) {
    const p = b.path as Record<string, unknown>
    if (
      typeof p.root !== "number" ||
      !Number.isInteger(p.root) ||
      !Array.isArray(p.indices) ||
      !p.indices.every((i) => Number.isInteger(i)) ||
      typeof p.className !== "string"
    )
      return { ok: false, reason: "malformed selection path" }
    path = { root: p.root, indices: p.indices as number[], className: p.className }
  }

  let bounds: CommentBounds | null = null
  if (b.bounds !== null && b.bounds !== undefined) {
    const g = b.bounds as Record<string, unknown>
    const nums = [g.minX, g.minY, g.maxX, g.maxY]
    if (!nums.every((n) => typeof n === "number" && Number.isFinite(n)))
      return { ok: false, reason: "malformed bounds" }
    bounds = { minX: g.minX as number, minY: g.minY as number, maxX: g.maxX as number, maxY: g.maxY as number }
  }

  const input: CommentInput = { path, pathLabel: b.pathLabel, text: b.text.trim(), t: b.t, scene: b.scene, bounds }
  if (b.name !== undefined) {
    if (typeof b.name !== "string" || !/^[A-Za-z_$][\w$]*$/.test(b.name)) return { ok: false, reason: "malformed name" }
    input.name = b.name
  }
  if (b.owners !== undefined) {
    if (!Array.isArray(b.owners) || !b.owners.every((o) => typeof o === "string" && /^\w+$/.test(o)))
      return { ok: false, reason: "malformed owners" }
    input.owners = b.owners as string[]
  }
  return { ok: true, input }
}

/** Two paths address the same selection (a scene-level note has path null). */
export const samePath = (a: CommentPath | null, b: CommentPath | null): boolean => {
  if (a === null || b === null) return a === b
  return (
    a.root === b.root &&
    a.className === b.className &&
    a.indices.length === b.indices.length &&
    a.indices.every((v, i) => v === b.indices[i])
  )
}

/**
 * Append one comment to its scene's JSONL, creating the directory on first
 * use. One line per comment, JSON-encoded — the format the operating agent
 * reads with a plain `cat`.
 */
export const appendComment = async (repoRoot: string, input: CommentInput): Promise<Comment> => {
  const file = commentsFile(repoRoot, input.scene)
  await mkdir(dirname(file), { recursive: true })
  const comment: Comment = { ...input, id: newCommentId(), ts: new Date().toISOString() }
  await appendFile(file, JSON.stringify(comment) + "\n", "utf8")
  return comment
}

/**
 * Resolve (or reopen) one comment — an appended event, never a rewrite.
 * Returns the comment as it now reads, or undefined for an unknown id.
 */
export const setResolved = async (
  repoRoot: string,
  scene: string,
  id: string,
  resolved: boolean,
): Promise<Comment | undefined> => {
  const target = (await readComments(repoRoot, scene)).find((c) => c.id === id)
  if (!target) return undefined
  const event: CommentEvent = { event: resolved ? "resolve" : "reopen", id, ts: new Date().toISOString() }
  const file = commentsFile(repoRoot, scene)
  await mkdir(dirname(file), { recursive: true })
  await appendFile(file, JSON.stringify(event) + "\n", "utf8")
  return resolved ? { ...target, resolved: true, resolvedAt: event.ts } : { ...target, resolved: false, resolvedAt: undefined }
}

/**
 * Every comment for a scene, oldest-first — skipping any malformed line so
 * one bad record can never blind the reader to the rest. A missing file is
 * simply an empty list (no comments yet).
 */
export const readComments = async (repoRoot: string, scene: string): Promise<Comment[]> => {
  const out: Comment[] = []
  const byId = new Map<string, Comment>()
  // The legacy file first: it is older than anything beside the scene.
  for (const file of [legacyCommentsFile(repoRoot, scene), commentsFile(repoRoot, scene)]) {
    let raw: string
    try {
      raw = await readFile(file, "utf8")
    } catch {
      continue
    }
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue
      let record: Comment | CommentEvent
      try {
        record = JSON.parse(line) as Comment | CommentEvent
      } catch {
        // A truncated or hand-mangled line is skipped, not fatal.
        continue
      }
      if ("event" in record) {
        const c = byId.get(record.id)
        if (!c) continue
        c.resolved = record.event === "resolve"
        c.resolvedAt = c.resolved ? record.ts : undefined
        if (!c.resolved) delete c.resolvedAt
        continue
      }
      if (typeof record.id !== "string") continue
      byId.set(record.id, record)
      out.push(record)
    }
  }
  return out
}

/** Every scene that has comments — the key is the file's own name. */
export const commentedScenes = async (repoRoot: string): Promise<string[]> => {
  const scenes = new Set<string>()
  // Where a scene's file can live: the demo DreamWeavings, and the holon
  // repos (a scene registered from holons/X keeps its comments in that repo).
  for (const root of ["core/demo", "holons"]) {
    if (!existsSync(`${repoRoot}${root}`)) continue
    for await (const rel of new Glob("**/*.comments.jsonl").scan({ cwd: `${repoRoot}${root}`, onlyFiles: true }))
      if (!rel.includes("node_modules/")) scenes.add(rel.split("/").pop()!.replace(/\.comments\.jsonl$/, ""))
  }
  if (existsSync(`${repoRoot}core/.comments`))
    for await (const rel of new Glob("*.jsonl").scan({ cwd: `${repoRoot}core/.comments`, onlyFiles: true }))
      scenes.add(rel.replace(/\.jsonl$/, ""))
  return [...scenes].filter(isValidScene).sort()
}

/**
 * Where in the source a comment points: the line that NAMES the holon in
 * its nearest whole that does (`opGlyph = new Text(…)` in Calculator.ts),
 * and the line that declares its class. Either can be missing — a holon
 * with no field name has only its class; a class outside the searched
 * roots has neither — and the queue says so rather than guessing.
 */
export const sourceOf = async (
  repoRoot: string,
  comment: Comment,
): Promise<{ site?: SourceLine; decl?: SourceLine }> => {
  const out: { site?: SourceLine; decl?: SourceLine } = {}
  if (comment.name) {
    const wholes: string[] = []
    for (const owner of comment.owners ?? []) {
      const at = await whereIsAt(repoRoot, owner)
      if (at) wholes.push(at.file)
    }
    // A root is a field of the Dream itself — the scene's own file.
    const sceneFile = sceneFileOf(repoRoot, comment.scene)
    if (sceneFile) wholes.push(sceneFile)
    for (const file of wholes) {
      const site = await fieldSiteOf(repoRoot, file, comment.name)
      if (site) {
        out.site = site
        break
      }
    }
  }
  if (comment.path) out.decl = await whereIsAt(repoRoot, comment.path.className)
  return out
}

// --- The operating agent's queue (run as a script) --------------------------

const fmt = (at: SourceLine | undefined) => (at ? `${at.file}:${at.line}` : "?")

const main = async (argv: string[]): Promise<number> => {
  const repoRoot = new URL("../../", import.meta.url).pathname
  const [flag, ...rest] = argv
  if (flag === "--resolve" || flag === "--reopen") {
    const [scene, id] = rest
    if (!scene || !id || !isValidScene(scene)) {
      console.error(`usage: bun scripts/comments.ts ${flag} <scene> <id>`)
      return 2
    }
    const c = await setResolved(repoRoot, scene, id, flag === "--resolve")
    if (!c) {
      console.error(`no comment ${id} in ${scene}`)
      return 1
    }
    console.log(`${flag === "--resolve" ? "resolved" : "reopened"} ${scene}/${id} — "${c.text}"`)
    return 0
  }
  if (flag !== "--open" && flag !== "--all") {
    console.error("usage: bun scripts/comments.ts --open [scene] | --all [scene] | --resolve <scene> <id>")
    return 2
  }
  const scenes = rest[0] ? [rest[0]] : await commentedScenes(repoRoot)
  let shown = 0
  for (const scene of scenes) {
    const comments = (await readComments(repoRoot, scene)).filter((c) => flag === "--all" || !c.resolved)
    if (comments.length === 0) continue
    const file = sceneFileOf(repoRoot, scene)
    console.log(`\n${scene}${file ? `  (${file})` : ""}  — ${comments.length} ${flag === "--all" ? "" : "open "}comment${comments.length === 1 ? "" : "s"}`)
    console.log(`  comments: ${commentsFile(repoRoot, scene).slice(repoRoot.length)}`)
    for (const c of comments) {
      shown++
      const where = await sourceOf(repoRoot, c)
      const path = c.path ? `${[c.path.root, ...c.path.indices].join(".")} ${c.path.className}` : "(scene)"
      console.log(`\n  [${c.id}]${c.resolved ? " RESOLVED" : ""}  t=${c.t.toFixed(2)}s  ${c.name ?? c.pathLabel}  · path ${path}`)
      if (c.owners?.length) console.log(`    within:   ${c.owners.join(" ‹ ")}`)
      if (where.site) console.log(`    declared: ${fmt(where.site)}  ${where.site.text}`)
      if (c.path) console.log(`    class:    ${c.path.className} @ ${fmt(where.decl)}`)
      for (const line of c.text.split("\n")) console.log(`    > ${line}`)
    }
  }
  if (shown === 0) console.log(flag === "--all" ? "no comments." : "no open comments.")
  return 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
