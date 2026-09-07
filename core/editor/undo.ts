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
 *  2. CLEAR ON EXTERNAL EDIT. Every inverse describes bytes that stood in
 *     a file at a known moment. When someone else rewrites that file — a
 *     hand edit, an agent, a git checkout — those descriptors stop
 *     describing anything, and the honest response is to forget them and
 *     SAY SO, rather than to replay an inverse onto text it was never
 *     computed against. (`setOverride`'s value-carrying inverses would
 *     often still "work" on drifted text; that is exactly the danger.)
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
   * Rule 2: someone else rewrote a file, so every inverse computed
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
