/**
 * Selection-anchored comments — the intake half of voice-first commenting
 * (docs/EDITOR-VOICE-COMMENTS.md step 1).
 *
 * A comment is a note attached to a SELECTION: the stable SelectionPath
 * (editor/selection.ts) that survives a rebuild, a human-readable label so
 * a reader knows what was pointed at without resolving the path, the note
 * text, the timeline t it was made at, and the selection's screen bounds
 * (main.ts:97 exposes them) so a LATER step can render exactly that region
 * — the bounds+t are captured now so the render is a pure function of them.
 *
 * Storage is one append-only JSONL file per scene under core/.comments/ —
 * gitignored, because comments are transient context the operating agent
 * consumes and works, not source. JSONL is deliberate: the agent can
 * `cat core/.comments/<scene>.jsonl` and read every note in order, and an
 * append never rewrites what is already there. This module is pure over a
 * root directory; the daemon owns the HTTP surface and the queue.
 */

import { mkdir, readFile, appendFile } from "node:fs/promises"

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
}

export interface Comment extends CommentInput {
  /** A stable id, so a later step can mark one handled without ambiguity. */
  id: string
  /** ISO-8601 wall-clock time the comment was written. */
  ts: string
  /** Whether the operating agent has acted on it (a later step sets this). */
  resolved?: boolean
}

/** Scene keys are our own registry keys — keep the filename to that shape. */
const SAFE_SCENE = /^[A-Za-z0-9_-]+$/

export const isValidScene = (scene: string): boolean => SAFE_SCENE.test(scene)

/** The comments directory under a repo root. */
export const commentsDir = (repoRoot: string): string => `${repoRoot}core/.comments`

/** The JSONL file for one scene. */
export const commentsFile = (repoRoot: string, scene: string): string =>
  `${commentsDir(repoRoot)}/${scene}.jsonl`

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

  return {
    ok: true,
    input: { path, pathLabel: b.pathLabel, text: b.text.trim(), t: b.t, scene: b.scene, bounds },
  }
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
  await mkdir(commentsDir(repoRoot), { recursive: true })
  const comment: Comment = { ...input, id: newCommentId(), ts: new Date().toISOString() }
  await appendFile(commentsFile(repoRoot, input.scene), JSON.stringify(comment) + "\n", "utf8")
  return comment
}

/**
 * Every comment for a scene, oldest-first — skipping any malformed line so
 * one bad record can never blind the reader to the rest. A missing file is
 * simply an empty list (no comments yet).
 */
export const readComments = async (repoRoot: string, scene: string): Promise<Comment[]> => {
  let raw: string
  try {
    raw = await readFile(commentsFile(repoRoot, scene), "utf8")
  } catch {
    return []
  }
  const out: Comment[] = []
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line) as Comment)
    } catch {
      // A truncated or hand-mangled line is skipped, not fatal.
    }
  }
  return out
}
