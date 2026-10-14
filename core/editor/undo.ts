/**
 * The undo stack (the reflection's "biggest missing UX primitive").
 *
 * The design rests on one observation: a semantic op's inverse is not
 * something the editor has to reconstruct — the DAEMON knows it, because
 * the daemon is the only party that sees the file both before and after
 * the write. So every `opApplied` ack carries an `undo` field holding a
 * complete op descriptor with the OLD value, and undo is nothing but
 * sending that op back through the same socket. Same queue, same
 * ts-morph re-location, same rebase-onto-drift, same ack. No file
 * snapshots, no diff replay, no second code path that could disagree
 * with the first.
 *
 * Redo falls out symmetrically and for free: the undo op is itself an op,
 * so ITS ack carries an inverse, and that inverse is exactly the thing
 * that was undone. Nothing here has to know what any op means.
 *
 * Two rules make it behave the way a hand expects:
 *
 *  1. LIVE FIRST. The live layer (EDITOR-V4) holds uncommitted overrides
 *     — a half-finished drag, a flown camera, a posed checkpoint. Those
 *     are the most recent thing the hand did, so cmd+Z releases THEM
 *     before it touches the file. Undoing a committed op while a live
 *     tweak still stands on screen would undo something the user is not
 *     looking at.
 *
 *  2. FORGET ONLY WHAT AN EXTERNAL EDIT TOUCHED. Every inverse describes
 *     bytes that stood in a file at a known moment. When someone else
 *     rewrites that file — a hand edit, an agent, a git checkout — an
 *     inverse whose bytes the edit reached stops describing anything, and
 *     the honest response is to forget it and SAY SO, rather than replay
 *     it onto text it was never computed against. (`setOverride`'s
 *     value-carrying inverses would often still "work" on drifted text;
 *     that is exactly the danger.) But an edit to ANOTHER file, or to
 *     another part of the same file, leaves an inverse true: its spans
 *     are rebased by the edit's size and it stays (`external()`). Agents
 *     edit the repo constantly; history must survive what is unrelated.
 *
 * This module is pure: it holds descriptors and decides what to send. The
 * socket, the DOM note and the live layer are the caller's (main.ts).
 */

/** An op descriptor as it goes over the wire — opaque to the stack. */
export type OpDescriptor = Record<string, unknown>

/** What an entry was, for the caller's status line. Never branched on. */
export interface UndoEntry {
  /** The op to SEND to undo the original — the daemon's own inverse. */
  inverse: OpDescriptor
  /** The op name that was applied, for labelling ("moved", "retimed", …). */
  label: string
}

/**
 * Why cmd+Z did nothing, or what it did. The caller turns this into the
 * palette's note; the stack never touches the DOM.
 */
export type UndoOutcome =
  | { kind: "sent"; op: OpDescriptor; label: string }
  | { kind: "empty" }

export class UndoStack {
  #undo: UndoEntry[] = []
  #redo: UndoEntry[] = []
  /**
   * Ops sent for undo/redo, by opId — their acks feed the OPPOSITE stack
   * instead of pushing a new undo entry. Without this, undoing would
   * itself become an undoable action and cmd+Z would oscillate between
   * two states forever.
   */
  #inFlight = new Map<string, "undo" | "redo">()
  #nextId = 1

  /** How deep the two stacks are — the status line, and the tests. */
  get depth(): { undo: number; redo: number } {
    return { undo: this.#undo.length, redo: this.#redo.length }
  }

  get canUndo(): boolean {
    return this.#undo.length > 0
  }

  get canRedo(): boolean {
    return this.#redo.length > 0
  }

  /** A fresh correlation id, stamped on every op the editor sends. */
  nextOpId(): string {
    return `op-${this.#nextId++}`
  }

  /**
   * An op the editor sent has been applied. `undo` is the daemon's
   * inverse, absent when the op is not invertible (an inserted property,
   * a non-literal run_time) — in which case the honest thing is to record
   * NOTHING and let the stack end there, rather than to leave a hole a
   * later undo would step over into the wrong state.
   *
   * A normal ack invalidates the redo stack: history has branched, and
   * the redo entries describe a future that no longer exists.
   */
  applied(ack: { opId?: string; undo?: OpDescriptor; op?: string }): void {
    const role = ack.opId ? this.#inFlight.get(ack.opId) : undefined
    if (role) {
      this.#inFlight.delete(ack.opId!)
      // The ack of an undo carries the redo, and vice versa.
      if (!ack.undo) return
      const entry = { inverse: ack.undo, label: labelOf(ack.undo) }
      if (role === "undo") this.#redo.push(entry)
      else this.#undo.push(entry)
      return
    }
    this.#redo = []
    if (!ack.undo) {
      // Not invertible. Everything below it is still individually valid,
      // but cmd+Z can no longer walk PAST this edit, so the stack ends.
      this.#undo = []
      return
    }
    this.#undo.push({ inverse: ack.undo, label: labelOf(ack.undo) })
  }

  /** An op the editor sent was refused — nothing changed, nothing to track. */
  rejected(opId?: string): void {
    if (opId) this.#inFlight.delete(opId)
  }

  /**
   * Pop the newest inverse and stamp it for sending. The caller does the
   * sending; the returned op already carries the opId whose ack will
   * become the redo entry.
   */
  undo(): UndoOutcome {
    const entry = this.#undo.pop()
    if (!entry) return { kind: "empty" }
    return { kind: "sent", op: this.#stamp(entry.inverse, "undo"), label: entry.label }
  }

  redo(): UndoOutcome {
    const entry = this.#redo.pop()
    if (!entry) return { kind: "empty" }
    return { kind: "sent", op: this.#stamp(entry.inverse, "redo"), label: entry.label }
  }

  /**
   * Rule 2, precisely: files someone else just rewrote — with, where the
   * daemon knew the old bytes, the one changed range (old coordinates,
   * and how much it grew). Entries for other files stand untouched. In a
   * changed file, an entry whose spans lie clear of the range is rebased
   * (positions past it shift by its growth); one the range reaches is
   * forgotten, and so is every OLDER entry of that file, whose
   * coordinates assumed the forgotten one would be undone first. Redo
   * entries of a changed file are forgotten (a branch the edit
   * overwrote). Without a range, every entry of that file goes. Returns
   * how many entries were forgotten.
   */
  external(changes: readonly ExternalChange[]): number {
    const byFile = new Map(changes.map((c) => [c.file, c.range]))
    let lost = 0
    const keep: UndoEntry[] = []
    const voidedFiles = new Set<string>()
    // Newest first: a forgotten entry takes everything under it in its file.
    for (const entry of [...this.#undo].reverse()) {
      const file = String(entry.inverse.file ?? "")
      if (!byFile.has(file)) {
        keep.push(entry)
        continue
      }
      const range = byFile.get(file)
      const rebased = range && !voidedFiles.has(file) ? rebaseOp(entry.inverse, range) : undefined
      if (rebased) keep.push({ ...entry, inverse: rebased })
      else {
        voidedFiles.add(file)
        lost++
      }
    }
    this.#undo = keep.reverse()
    const redo = this.#redo.filter((e) => !byFile.has(String(e.inverse.file ?? "")))
    lost += this.#redo.length - redo.length
    this.#redo = redo
    return lost
  }

  /**
   * Forget everything — someone else rewrote a file, so every inverse computed
   * against its old bytes is void. Returns whether anything was actually
   * discarded, so the caller only shows the note when there was history
   * to lose.
   */
  clear(): boolean {
    const had = this.#undo.length > 0 || this.#redo.length > 0
    this.#undo = []
    this.#redo = []
    this.#inFlight.clear()
    return had
  }

  #stamp(op: OpDescriptor, role: "undo" | "redo"): OpDescriptor {
    const opId = this.nextOpId()
    this.#inFlight.set(opId, role)
    return { ...op, opId }
  }
}

/** One external rewrite: the file, and (when known) the changed range in its OLD bytes. */
export interface ExternalChange {
  file: string
  range?: ChangedRange
}

/** Old bytes [start, end) became a region `delta` bytes longer (negative: shorter). */
export interface ChangedRange {
  start: number
  end: number
  delta: number
}

/**
 * The one contiguous region two texts differ in — common prefix and suffix
 * trimmed (never overlapping) — in the OLD text's coordinates. Several
 * edits between two looks coalesce into one range: conservative, never wrong.
 */
export const changedRange = (before: string, after: string): ChangedRange | undefined => {
  if (before === after) return undefined
  const max = Math.min(before.length, after.length)
  let p = 0
  while (p < max && before.charCodeAt(p) === after.charCodeAt(p)) p++
  let s = 0
  while (s < max - p && before.charCodeAt(before.length - 1 - s) === after.charCodeAt(after.length - 1 - s)) s++
  return { start: p, end: before.length - s, delta: after.length - before.length }
}

/**
 * An inverse op moved past an edit, or undefined when the edit reached it.
 * Its positions are `span`s (setOverride, setRunTime, deleteSpan and every
 * `also`) and insertSpan's `at`; an op with none (setBackdrop re-locates by
 * structure) passes through. A span touches the range when they overlap,
 * or when the range is a pure insertion strictly inside the span.
 */
export const rebaseOp = (op: OpDescriptor, r: ChangedRange): OpDescriptor | undefined => {
  type Span = { start: number; end: number }
  const hits = (s: Span) => (r.start === r.end ? s.start < r.start && r.start < s.end : s.start < r.end && s.end > r.start)
  const move = (n: number) => (n >= r.end ? n + r.delta : n)
  // A span ENDING where text was inserted keeps its end: the text came after it.
  const moveEnd = (n: number) => (n > r.end || (n === r.end && r.start !== r.end) ? n + r.delta : n)
  const shift = (s: Span): Span | undefined => (hits(s) ? undefined : { start: move(s.start), end: moveEnd(s.end) })
  const out: OpDescriptor = { ...op }
  if (op.span) {
    const s = shift(op.span as Span)
    if (!s) return undefined
    out.span = s
  }
  if (typeof op.at === "number") {
    if (r.start < op.at && op.at < r.end) return undefined
    out.at = move(op.at)
  }
  if (Array.isArray(op.also)) {
    const also = []
    for (const e of op.also as { span: Span }[]) {
      const s = shift(e.span)
      if (!s) return undefined
      also.push({ ...e, span: s })
    }
    out.also = also
  }
  return out
}

/** A human word for an op, for the status note. */
export const labelOf = (op: OpDescriptor): string => {
  switch (op.op) {
    case "setOverride":
      return `${String(op.name ?? "parameter")}`
    case "setRunTime":
      return "clip duration"
    case "setBackdrop":
      return "backdrop"
    case "deleteSpan":
      return "checkpoint"
    case "insertSpan":
      return "checkpoint"
    default:
      return String(op.op ?? "edit")
  }
}

/**
 * Rule 1, as a decision the caller can test without a browser: what
 * cmd+Z means right now. A live layer holding uncommitted overrides is
 * the most recent thing the hand did, so it is released first; only with
 * nothing live does cmd+Z reach into committed history.
 */
export const undoAction = (live: { size: number }, stack: UndoStack): "release" | "pop" | "none" =>
  live.size > 0 ? "release" : stack.canUndo ? "pop" : "none"
