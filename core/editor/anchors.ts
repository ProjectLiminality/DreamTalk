/**
 * Build-time span anchors, runtime side (EDITOR.md "Anchoring").
 *
 * The daemon's build wraps every PascalCase construction and every
 * `this.play(...)` / `this.backdrop(...)` in a DreamWeaving with
 * `__dt(expr, "core/demo/File.ts:start:end")`. This module is that
 * helper: it attaches {file, span} to object values (Holon instances)
 * via a WeakMap — never touching the objects themselves — and passes
 * everything else through untouched. Spans are byte offsets into the
 * ORIGINAL file on disk, which is what semantic ops target.
 */

export interface SourceAnchor {
  /** Repo-relative path, e.g. "core/demo/FoundingSmoke.ts". */
  file: string
  /** Start offset of the anchored expression in the original source. */
  start: number
  /** End offset (exclusive) of the anchored expression. */
  end: number
}

const anchors = new WeakMap<object, SourceAnchor>()

/** Build-injected wrapper — a passthrough that remembers where a value was born. */
export const __dt = <T>(value: T, anchor: string): T => {
  if (value !== null && typeof value === "object") {
    const sep2 = anchor.lastIndexOf(":")
    const sep1 = anchor.lastIndexOf(":", sep2 - 1)
    const file = anchor.slice(0, sep1)
    const start = Number(anchor.slice(sep1 + 1, sep2))
    const end = Number(anchor.slice(sep2 + 1))
    if (file && Number.isFinite(start) && Number.isFinite(end)) {
      anchors.set(value as object, { file, start, end })
    }
  }
  return value
}

/** The source location that created a value, if the build anchored it. */
export const anchorOf = (value: object): SourceAnchor | undefined => anchors.get(value)
