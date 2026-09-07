/**
 * Semantic ops — the UI→code half of the bidirectional loop (EDITOR.md).
 *
 * Pure functions over source text: parse with ts-morph, rewrite only the
 * targeted literals/statement, preserve every other byte. The daemon owns
 * files and queues; this module owns nothing but the transformation.
 */

import { IndentationText, Project, SyntaxKind } from "ts-morph"
import type { CallExpression, MethodDeclaration, NewExpression, SourceFile } from "ts-morph"

export interface SetBackdropOp {
  op: "setBackdrop"
  /** Reference path relative to the repo root, e.g. "refs/video-01/x.mkv". */
  path: string
  /** Seconds added to scene t when sampling the backdrop (default 0). */
  offset?: number
}

export interface SetOverrideOp {
  op: "setOverride"
  /** Byte span of the `new X({...})` expression in the file the client loaded. */
  span: { start: number; end: number }
  /** Holon class name — the structural fallback when the span has drifted. */
  className?: string
  /** Property to write in the construction's object literal. */
  name: string
  value: number | string | boolean
}

export interface SetRunTimeOp {
  op: "setRunTime"
  /** Byte span of the `this.play(...)` call in the file the client loaded. */
  span: { start: number; end: number }
  /** The clip's new duration in seconds. */
  runTime: number
}

/** One guarded edit: `span` must still hold `expect`, and becomes `replace`. */
export interface SpanEdit {
  span: { start: number; end: number }
  /** The exact text expected there — refuse rather than cut blind. */
  expect: string
  /** What it becomes. Absent means "remove it". */
  replace?: string
}

/**
 * The inverse of appendCheckpoint: put back exactly the bytes the
 * insertion changed. Unlike every other op this one is not a form the
 * editor's UI can express — it exists only so undo can say "put the file
 * back", and it is guarded rather than rebased (the daemon computes it by
 * diffing its own write, so it knows precisely what to look for).
 *
 * It carries a LIST because a capture with several targets edits TWO
 * places: the new `this.play(...)` statement, and the import clause that
 * gains `together`. The first is a removal, the second a replacement —
 * both guarded, all-or-nothing. Half an undo is a state nobody authored.
 */
export interface DeleteSpanOp {
  op: "deleteSpan"
  /** Byte range in the file this op was computed against. */
  span: { start: number; end: number }
  /** The exact text expected there. */
  expect: string
  /** What that range becomes; absent means remove it. */
  replace?: string
  /** Further guarded edits in the same write. */
  also?: SpanEdit[]
}

/**
 * The inverse of deleteSpan — put exactly those bytes back where they
 * were. Only ever produced by undoing an undo, which is why it is allowed
 * to be this literal: the text it restores is text the daemon itself
 * removed one op ago.
 *
 * `context` is how a pure insertion stays honest across drift: an offset
 * alone means nothing once the file has moved, so the op also names the
 * text that must immediately FOLLOW the insertion point. Found exactly
 * once, that re-locates the offset; found zero or many times, the op
 * refuses rather than splicing a statement into an arbitrary place.
 */
export interface InsertSpanOp {
  op: "insertSpan"
  /** Byte offset the text is inserted at. */
  at: number
  text: string
  /** Text expected to begin at `at` — the drift guard. */
  context?: string
  /** Further guarded edits applied in the same write (a capture's import line). */
  also?: SpanEdit[]
}

export type OpResult =
  | { ok: true; text: string }
  | { ok: false; reason: string }

/**
 * Splice `text` back in at `at` (re-located via `context` when the offset
 * has drifted), plus any `also` edits — all-or-nothing, like deleteSpan.
 */
export const applyInsertSpan = (source: string, op: InsertSpanOp): OpResult => {
  if (op.text.length === 0) return { ok: false, reason: "insertSpan has nothing to insert" }

  let at = op.at
  const contextHolds =
    op.context === undefined || op.context.length === 0
      ? Number.isInteger(at) && at >= 0 && at <= source.length
      : source.startsWith(op.context, at)
  if (!contextHolds) {
    const ctx = op.context!
    const first = source.indexOf(ctx)
    if (first < 0) return { ok: false, reason: "the place to re-insert is no longer in the file" }
    if (source.indexOf(ctx, first + 1) >= 0)
      return { ok: false, reason: "the place to re-insert is ambiguous — refusing" }
    at = first
  }
  if (!Number.isInteger(at) || at < 0 || at > source.length)
    return { ok: false, reason: "insertSpan offset is outside the file — reload" }

  // The `also` edits are resolved against the PRE-insertion text and
  // applied back-to-front together with the insertion, so their offsets
  // never have to account for it.
  const edits: { start: number; end: number; replace: string }[] = [
    { start: at, end: at, replace: op.text },
  ]
  for (const edit of op.also ?? []) {
    if (edit.expect.length === 0) return { ok: false, reason: "insertSpan edit has no guard" }
    const { start, end } = edit.span
    const replace = edit.replace ?? ""
    if (source.slice(start, end) === edit.expect) {
      edits.push({ start, end, replace })
      continue
    }
    const first = source.indexOf(edit.expect)
    if (first < 0) return { ok: false, reason: "the text to restore is no longer in the file" }
    if (source.indexOf(edit.expect, first + 1) >= 0)
      return { ok: false, reason: "the text to restore appears more than once — ambiguous" }
    edits.push({ start: first, end: first + edit.expect.length, replace })
  }
  edits.sort((a, b) => b.start - a.start)
  for (let i = 1; i < edits.length; i++) {
    if (edits[i]!.end > edits[i - 1]!.start)
      return { ok: false, reason: "the ranges to restore overlap — refusing" }
  }
  let text = source
  for (const { start, end, replace } of edits)
    text = text.slice(0, start) + replace + text.slice(end)
  return { ok: true, text }
}

/**
 * Cut `span` out of the source, but only if it still holds `expect`. The
 * guard is the whole point: a deleteSpan carries no intent a parser could
 * re-locate, so the moment the bytes underneath have moved it must refuse
 * rather than delete whatever now sits at those offsets. A single
 * re-location attempt is allowed — the same text found EXACTLY ONCE
 * elsewhere is still unambiguously the thing that was inserted.
 */
export const applyDeleteSpan = (source: string, op: DeleteSpanOp): OpResult => {
  const edits: SpanEdit[] = [
    { span: op.span, expect: op.expect, replace: op.replace },
    ...(op.also ?? []),
  ]
  const resolved: { start: number; end: number; replace: string }[] = []
  for (const edit of edits) {
    const { start, end } = edit.span
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start)
      return { ok: false, reason: "deleteSpan has a malformed span" }
    if (edit.expect.length === 0) return { ok: false, reason: "deleteSpan has nothing to undo" }
    const replace = edit.replace ?? ""
    if (source.slice(start, end) === edit.expect) {
      resolved.push({ start, end, replace })
      continue
    }
    // The span drifted. The same text found EXACTLY ONCE elsewhere is
    // still unambiguously the thing that was written; anything less
    // determinate is refused rather than rewritten blind.
    const first = source.indexOf(edit.expect)
    if (first < 0) return { ok: false, reason: "the text to undo is no longer in the file" }
    if (source.indexOf(edit.expect, first + 1) >= 0)
      return { ok: false, reason: "the text to undo appears more than once — ambiguous" }
    resolved.push({ start: first, end: first + edit.expect.length, replace })
  }
  // Back-to-front so each edit leaves the earlier offsets valid.
  resolved.sort((a, b) => b.start - a.start)
  for (let i = 1; i < resolved.length; i++) {
    if (resolved[i]!.end > resolved[i - 1]!.start)
      return { ok: false, reason: "the ranges to undo overlap — refusing" }
  }
  let text = source
  for (const { start, end, replace } of resolved)
    text = text.slice(0, start) + replace + text.slice(end)
  return { ok: true, text }
}

/**
 * One changed region: the range it occupies in `after`, the text standing
 * there now, and the text that stood there in `before` (empty for a pure
 * insertion). Undoing the write is exactly "each `text` becomes `was`".
 */
export interface ChangedSpan {
  start: number
  end: number
  /** What the write put there — the guard, in `after`'s coordinates. */
  text: string
  /** What it replaced — "" when the region was purely inserted. */
  was: string
}

/**
 * The byte range one insertion added. Kept as the simple case (a single
 * contiguous pure insertion); `changedSpans` is the general form.
 */
export const insertedSpan = (
  before: string,
  after: string,
): { start: number; end: number; text: string } | undefined => {
  const spans = changedSpans(before, after)
  if (spans?.length !== 1 || spans[0]!.was !== "") return undefined
  const { start, end, text } = spans[0]!
  return { start, end, text }
}

/**
 * EVERY region in which `after` differs from `before`, in `after`'s
 * coordinates — a line-level diff, which is the right granularity here
 * because the writers emit whole statements and whole import clauses.
 *
 * The two-region case is the one that matters: a multi-target checkpoint
 * capture writes a new `this.play(...)` statement AND rewrites the import
 * line to add `together`. An insertion-only diff calls that "not
 * contiguous" and gives up, which would make exactly the ops most worth
 * undoing the ones that cannot be — so the diff must describe a
 * replacement as well as an insertion.
 *
 * The alignment is a longest-common-subsequence over lines; the file is a
 * few hundred lines and this runs once per op, so the quadratic table is
 * free and the result is exact rather than heuristic.
 */
export const changedSpans = (before: string, after: string): ChangedSpan[] => {
  const oldLines = before.split("\n")
  const newLines = after.split("\n")
  const n = oldLines.length
  const m = newLines.length

  // lcs[i][j] = length of the longest common subsequence of the suffixes.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        oldLines[i] === newLines[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }

  // Width of newLines[j] in `after`, including its newline where it has one.
  const widthOf = (j: number): number => newLines[j]!.length + (j < m - 1 ? 1 : 0)
  const oldWidthOf = (i: number): number => oldLines[i]!.length + (i < n - 1 ? 1 : 0)

  const spans: ChangedSpan[] = []
  let offset = 0
  let run: { start: number; end: number; was: string } | null = null
  const closeRun = () => {
    if (!run) return
    if (run.end > run.start || run.was.length > 0)
      spans.push({ start: run.start, end: run.end, text: after.slice(run.start, run.end), was: run.was })
    run = null
  }

  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && oldLines[i] === newLines[j]) {
      closeRun()
      offset += widthOf(j)
      i++
      j++
      continue
    }
    // Not a common line: advance whichever side the LCS says to drop.
    const takeNew = j < m && (i >= n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)
    if (!run) run = { start: offset, end: offset, was: "" }
    if (takeNew) {
      const w = widthOf(j)
      run.end = offset + w
      offset += w
      j++
    } else {
      run.was += oldLines[i]! + (i < n - 1 ? "\n" : "")
      i++
    }
  }
  closeRun()
  return spans
}

const project = new Project({
  useInMemoryFileSystem: true,
  manipulationSettings: { indentationText: IndentationText.TwoSpaces },
})

const numberLiteral = (n: number): string =>
  Number.isFinite(n) ? String(n) : "0"

/** The unfold() body of the first Dream class in the file, if any. */
const findUnfold = (fileText: string): MethodDeclaration | undefined => {
  const file = project.createSourceFile("op-target.ts", fileText, { overwrite: true })
  for (const cls of file.getClasses()) {
    const unfold = cls.getMethod("unfold")
    if (unfold) return unfold
  }
  return undefined
}

/** The `this.backdrop(...)` call among unfold()'s statements, if present. */
const findBackdropCall = (unfold: MethodDeclaration): CallExpression | undefined => {
  for (const stmt of unfold.getStatements()) {
    const exprStmt = stmt.asKind(SyntaxKind.ExpressionStatement)
    const call = exprStmt?.getExpression().asKind(SyntaxKind.CallExpression)
    if (call?.getExpression().getText() === "this.backdrop") return call
  }
  return undefined
}

/**
 * Insert or update the `this.backdrop("…", { offset: … })` statement at
 * the top of unfold(). Rebasable by construction: it re-locates the
 * constrained form in whatever text it is given.
 */
export const applySetBackdrop = (source: string, op: SetBackdropOp): OpResult => {
  const unfold = findUnfold(source)
  if (!unfold) return { ok: false, reason: "no class with an unfold() method found" }
  if (!unfold.getBody()) return { ok: false, reason: "unfold() has no body" }

  const offset = numberLiteral(op.offset ?? 0)
  const call = findBackdropCall(unfold)

  if (!call) {
    unfold.insertStatements(0, `this.backdrop(${JSON.stringify(op.path)}, { offset: ${offset} })`)
    return { ok: true, text: unfold.getSourceFile().getFullText() }
  }

  const [pathArg, optsArg] = call.getArguments()
  if (pathArg) pathArg.replaceWithText(JSON.stringify(op.path))
  else call.addArgument(JSON.stringify(op.path))

  const optsLiteral = optsArg?.asKind(SyntaxKind.ObjectLiteralExpression)
  if (!optsArg) {
    call.addArgument(`{ offset: ${offset} }`)
  } else if (!optsLiteral) {
    optsArg.replaceWithText(`{ offset: ${offset} }`)
  } else {
    const prop = optsLiteral.getProperty("offset")?.asKind(SyntaxKind.PropertyAssignment)
    if (prop) {
      prop.setInitializer(offset)
    } else {
      // Keep the temporal statement on one line (SYNTAX-TS rule 1):
      // rebuild the literal inline rather than letting ts-morph wrap it.
      const kept = optsLiteral.getProperties().map((p) => p.getText())
      optsLiteral.replaceWithText(`{ ${[...kept, `offset: ${offset}`].join(", ")} }`)
    }
  }
  return { ok: true, text: call.getSourceFile().getFullText() }
}

export interface AppendCheckpointOp {
  op: "appendCheckpoint"
  /**
   * Where the checkpoint clip lands among unfold()'s statements:
   * "after"/"before" the statement containing `anchor` (the span of a
   * `this.play(...)` call), or at the "end" of the body.
   */
  placement: "after" | "before" | "end"
  /** Byte span of the play() call the placement is relative to. */
  anchor?: { start: number; end: number }
  /**
   * The captured pose: one `.to()` per overridden param, addressed the
   * way the scene's own code addresses it (`this.circle.x`,
   * `this.observer.phi`, `this.lines[2].y`).
   */
  targets: { path: string; value: number | boolean }[]
  /** Seconds the transition plays over (default 1). */
  duration?: number
  /** Repo-relative path of the file, for computing an import specifier. */
  file?: string
}

/** A target path is a `this.` member chain — anything else never reaches the file. */
const CHECKPOINT_PATH = /^this(\.[A-Za-z_$][A-Za-z0-9_$]*(\[\d+\])?)+$/

const checkpointLiteral = (value: number | boolean): string =>
  typeof value === "boolean" ? String(value) : numberLiteral(value)

/** `from`'s directory to `target`, both repo-relative — an import specifier. */
const relativeSpecifier = (from: string, target: string): string => {
  const dir = from.split("/").slice(0, -1)
  const to = target.split("/")
  let common = 0
  while (common < dir.length && common < to.length && dir[common] === to[common]) common++
  const up = dir.length - common
  return (up === 0 ? "./" : "../".repeat(up)) + to.slice(common).join("/")
}

/**
 * Make `together` importable: already imported, added to an existing
 * anim/index import, or a fresh import computed from the file's own
 * repo-relative path. Returns a reason when none of those can work.
 */
const ensureTogetherImport = (file: SourceFile, relFile?: string): string | undefined => {
  const imports = file.getImportDeclarations()
  for (const decl of imports) {
    for (const named of decl.getNamedImports()) {
      if (!named.isTypeOnly() && (named.getAliasNode()?.getText() ?? named.getName()) === "together")
        return undefined
    }
  }
  const host = imports.find((d) => {
    const spec = d.getModuleSpecifierValue()
    return spec.endsWith("/anim") || spec.endsWith("/src/index") || spec.endsWith("/src")
  })
  if (host) {
    host.addNamedImport("together")
    return undefined
  }
  if (!relFile) return "no anim import to extend and no file path to compute one from"
  const last = imports[imports.length - 1]
  const specifier = relativeSpecifier(relFile, "core/src/anim")
  const decl = { moduleSpecifier: specifier, namedImports: ["together"] }
  if (last) file.insertImportDeclaration(last.getChildIndex() + 1, decl)
  else file.insertImportDeclaration(0, decl)
  return undefined
}

/**
 * Append a captured pose as a Magic Move clip (ONTOLOGY.md "Magic Move",
 * case 1): one `this.play(...to()..., d)` statement whose targets ARE the
 * pose, inserted after the clip the playhead was inside. The spelling is
 * the scene's own idiom — explicit param references under `together` —
 * so the generated line is indistinguishable from a hand-written one.
 */
export const applyAppendCheckpoint = (source: string, op: AppendCheckpointOp): OpResult => {
  if (op.targets.length === 0) return { ok: false, reason: "empty pose — nothing to capture" }
  for (const target of op.targets) {
    if (!CHECKPOINT_PATH.test(target.path))
      return { ok: false, reason: `target path '${target.path}' is not a this.* param reference` }
    if (typeof target.value === "number" && !Number.isFinite(target.value))
      return { ok: false, reason: `target '${target.path}' has a non-finite value` }
  }

  const unfold = findUnfold(source)
  if (!unfold) return { ok: false, reason: "no class with an unfold() method found" }
  if (!unfold.getBody()) return { ok: false, reason: "unfold() has no body" }

  // insertStatements() counts comment nodes as statements, so the index
  // must be found in the SAME list — a DreamWeaving's prose comments
  // otherwise shift every insertion up by one per comment above it.
  const statements = unfold.getStatementsWithComments()
  let index = statements.length
  if (op.placement !== "end") {
    if (!op.anchor) return { ok: false, reason: `placement '${op.placement}' needs an anchor span` }
    const { start, end } = op.anchor
    const at = statements.findIndex((s) => s.getStart() <= start && s.getEnd() >= end)
    if (at < 0)
      return { ok: false, reason: "no statement at the anchored span — reload and recapture" }
    index = op.placement === "before" ? at : at + 1
  }

  const duration = numberLiteral(op.duration ?? 1)
  const calls = op.targets.map((t) => `${t.path}.to(${checkpointLiteral(t.value)})`)
  const statement =
    calls.length === 1
      ? `this.play(${calls[0]}, ${duration})`
      : [
          "this.play(",
          "  together(",
          ...calls.map((c) => `    ${c},`),
          "  ),",
          `  ${duration},`,
          ")",
        ].join("\n")

  unfold.insertStatements(index, statement)
  if (calls.length > 1) {
    const failure = ensureTogetherImport(unfold.getSourceFile(), op.file)
    if (failure) return { ok: false, reason: failure }
  }
  return { ok: true, text: unfold.getSourceFile().getFullText() }
}

/** The shortest clip a drag can write — sub-0.1s durations are noise. */
const MIN_RUN_TIME = 0.1

/**
 * Rewrite the run_time of the `this.play(...)` call at span — the
 * timeline's edge-drag made durable. Re-location is exact-span first,
 * then start-anchored (the contract applySetOverride established: edits
 * inside a call move its END, never its START). There is no structural
 * rebase beyond that: play() calls are positional, and retiming one by
 * ordinal guesswork would silently retime the wrong clip.
 *
 * Only a numeric-literal run_time is rewritten. A named constant or an
 * expression (`SIGHT_RUN_TIME`, `7 / 4`) is a statement of intent the
 * editor must not flatten into a number — rejected with the reason.
 */
export const applySetRunTime = (source: string, op: SetRunTimeOp): OpResult => {
  if (!Number.isFinite(op.runTime))
    return { ok: false, reason: "runTime is not a finite number" }
  const seconds = Math.max(MIN_RUN_TIME, Math.round(op.runTime * 100) / 100)

  const file = project.createSourceFile("op-target.ts", source, { overwrite: true })
  const calls = file
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((c) => c.getExpression().getText() === "this.play")
  const target =
    calls.find((c) => c.getStart() === op.span.start && c.getEnd() === op.span.end) ??
    calls.find((c) => c.getStart() === op.span.start)
  if (!target)
    return { ok: false, reason: "no play() call at the anchored span — reload and re-drag" }

  const args = target.getArguments()
  if (args.length === 0) return { ok: false, reason: "play() call has no arguments" }
  const runArg = args[1]
  if (!runArg) {
    // `play(anim)` runs the default 1s — the duration becomes explicit.
    target.addArgument(numberLiteral(seconds))
    return { ok: true, text: file.getFullText() }
  }
  if (!runArg.asKind(SyntaxKind.NumericLiteral))
    return {
      ok: false,
      reason: `run_time is \`${runArg.getText()}\` — not a numeric literal; edit the source`,
    }
  runArg.replaceWithText(numberLiteral(seconds))
  return { ok: true, text: file.getFullText() }
}

const isPascalConstruction = (node: NewExpression): boolean =>
  /^[A-Z]/.test(node.getExpression().asKind(SyntaxKind.Identifier)?.getText() ?? "")

const pascalConstructions = (file: SourceFile): NewExpression[] =>
  file.getDescendantsOfKind(SyntaxKind.NewExpression).filter(isPascalConstruction)

const overrideLiteral = (value: number | string | boolean): string =>
  typeof value === "string" ? JSON.stringify(value) : String(value)

/**
 * Rewrite (or insert) `name: <literal>` in the object literal of the
 * construction at span. Re-location is span-then-structure (EDITOR.md):
 * the exact span wins when it still holds the expected form; on drift,
 * the op rebases onto the unique construction of `className`; anything
 * less determinate is rejected with a reason — never a silent guess.
 */
export const applySetOverride = (source: string, op: SetOverrideOp): OpResult => {
  const file = project.createSourceFile("op-target.ts", source, { overwrite: true })
  const constructions = pascalConstructions(file)

  let target = constructions.find(
    (n) =>
      n.getStart() === op.span.start &&
      n.getEnd() === op.span.end &&
      (!op.className || n.getExpression().getText() === op.className),
  )
  // A drag commits x and y as two ops against the same construction: the
  // first rewrite moves the construction's END but never its START, so a
  // start-anchored match keeps the second op exact even when the class is
  // constructed many times (S01 has two Eyes — the unique-class rebase
  // below could never serve it).
  if (!target) {
    target = constructions.find(
      (n) =>
        n.getStart() === op.span.start &&
        (!op.className || n.getExpression().getText() === op.className),
    )
  }
  if (!target) {
    if (!op.className) return { ok: false, reason: "no construction at span and no className to rebase by" }
    const candidates = constructions.filter((n) => n.getExpression().getText() === op.className)
    if (candidates.length === 0)
      return { ok: false, reason: `construction of ${op.className} no longer exists` }
    if (candidates.length > 1)
      return { ok: false, reason: `span drifted and ${op.className} is constructed ${candidates.length} times — ambiguous` }
    target = candidates[0]!
  }

  const lit = overrideLiteral(op.value)
  const [firstArg] = target.getArguments()
  if (!firstArg) {
    target.addArgument(`{ ${op.name}: ${lit} }`)
    return { ok: true, text: file.getFullText() }
  }
  const overrides = firstArg.asKind(SyntaxKind.ObjectLiteralExpression)
  if (!overrides)
    return { ok: false, reason: "construction argument is not an object literal — outside the editable form" }

  const existing = overrides.getProperty(op.name)
  const assignment = existing?.asKind(SyntaxKind.PropertyAssignment)
  if (assignment) {
    assignment.setInitializer(lit)
  } else if (existing) {
    existing.replaceWithText(`${op.name}: ${lit}`)
  } else if (overrides.getText().includes("\n")) {
    overrides.addPropertyAssignment({ name: op.name, initializer: lit })
  } else {
    // Single-line literal stays single-line (SYNTAX-TS: literals inline).
    const kept = overrides.getProperties().map((p) => p.getText())
    overrides.replaceWithText(`{ ${[...kept, `${op.name}: ${lit}`].join(", ")} }`)
  }
  return { ok: true, text: file.getFullText() }
}

// --- Reading what an op is about to replace (the undo half) ----------------
//
// Every op's inverse is the SAME op carrying the value that stood before
// it — so undo needs no new machinery, only a reader per op run against
// the file as it is about to be rewritten. These live here, beside the
// writers, because the two must agree on what "the targeted form" means:
// a reader that located a different node than its writer would produce an
// inverse that undoes something else.

/** The construction an applySetOverride would target, by the same rules. */
const findConstruction = (
  file: SourceFile,
  span: { start: number; end: number },
  className?: string,
): NewExpression | undefined => {
  const constructions = pascalConstructions(file)
  const named = (n: NewExpression) => !className || n.getExpression().getText() === className
  return (
    constructions.find((n) => n.getStart() === span.start && n.getEnd() === span.end && named(n)) ??
    constructions.find((n) => n.getStart() === span.start && named(n)) ??
    (className
      ? (() => {
          const candidates = constructions.filter((n) => n.getExpression().getText() === className)
          return candidates.length === 1 ? candidates[0] : undefined
        })()
      : undefined)
  )
}

/**
 * What `name` holds in the targeted construction right now: a literal's
 * value, or `absent` when the property is not written there at all (the
 * inverse of an insertion is a removal, which setOverride cannot express
 * — see the daemon's note; the editor keeps such an op un-undoable rather
 * than writing a wrong literal back).
 */
export const readOverride = (
  source: string,
  op: Pick<SetOverrideOp, "span" | "className" | "name">,
):
  | { kind: "literal"; value: number | string | boolean }
  | { kind: "absent" }
  | { kind: "unreadable"; reason: string } => {
  const file = project.createSourceFile("op-read.ts", source, { overwrite: true })
  const target = findConstruction(file, op.span, op.className)
  if (!target) return { kind: "unreadable", reason: "no construction at span" }
  const [firstArg] = target.getArguments()
  if (!firstArg) return { kind: "absent" }
  const overrides = firstArg.asKind(SyntaxKind.ObjectLiteralExpression)
  if (!overrides) return { kind: "unreadable", reason: "argument is not an object literal" }
  const assignment = overrides.getProperty(op.name)?.asKind(SyntaxKind.PropertyAssignment)
  if (!assignment) return { kind: "absent" }
  const init = assignment.getInitializer()
  if (!init) return { kind: "unreadable", reason: "property has no initializer" }
  return literalValue(init.getText())
}

/** A literal's value, or why it is not one (a named constant must not be flattened). */
const literalValue = (
  text: string,
): { kind: "literal"; value: number | string | boolean } | { kind: "unreadable"; reason: string } => {
  if (text === "true") return { kind: "literal", value: true }
  if (text === "false") return { kind: "literal", value: false }
  if (/^-?\d+(\.\d+)?$/.test(text)) return { kind: "literal", value: Number(text) }
  if (/^-\s*\d+(\.\d+)?$/.test(text)) return { kind: "literal", value: Number(text.replace(/\s+/g, "")) }
  if (/^(["']).*\1$/s.test(text)) {
    try {
      return { kind: "literal", value: JSON.parse(text.replace(/^'|'$/g, '"')) as string }
    } catch {
      return { kind: "unreadable", reason: `unparseable string literal ${text}` }
    }
  }
  return { kind: "unreadable", reason: `\`${text}\` is not a literal` }
}

/** The run_time of the play() call at span, by applySetRunTime's own rules. */
export const readRunTime = (
  source: string,
  span: { start: number; end: number },
): { kind: "literal"; value: number } | { kind: "default" } | { kind: "unreadable"; reason: string } => {
  const file = project.createSourceFile("op-read.ts", source, { overwrite: true })
  const calls = file
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((c) => c.getExpression().getText() === "this.play")
  const target =
    calls.find((c) => c.getStart() === span.start && c.getEnd() === span.end) ??
    calls.find((c) => c.getStart() === span.start)
  if (!target) return { kind: "unreadable", reason: "no play() call at span" }
  const runArg = target.getArguments()[1]
  // `play(anim)` runs the implicit 1s; applySetRunTime makes that
  // explicit, so the honest inverse is the same number, not a removal.
  if (!runArg) return { kind: "default" }
  if (!runArg.asKind(SyntaxKind.NumericLiteral))
    return { kind: "unreadable", reason: `run_time is \`${runArg.getText()}\`, not a literal` }
  return { kind: "literal", value: Number(runArg.getText()) }
}

/** The backdrop spec standing in unfold(), if the line is there at all. */
export const readBackdrop = (
  source: string,
): { kind: "spec"; path: string; offset: number } | { kind: "absent" } | { kind: "unreadable"; reason: string } => {
  const unfold = findUnfold(source)
  if (!unfold?.getBody()) return { kind: "unreadable", reason: "no unfold() body" }
  const call = findBackdropCall(unfold)
  if (!call) return { kind: "absent" }
  const [pathArg, optsArg] = call.getArguments()
  if (!pathArg) return { kind: "unreadable", reason: "backdrop() has no path" }
  const path = literalValue(pathArg.getText())
  if (path.kind !== "literal" || typeof path.value !== "string")
    return { kind: "unreadable", reason: "backdrop path is not a string literal" }
  const opts = optsArg?.asKind(SyntaxKind.ObjectLiteralExpression)
  const offsetInit = opts?.getProperty("offset")?.asKind(SyntaxKind.PropertyAssignment)?.getInitializer()
  if (!offsetInit) return { kind: "spec", path: path.value, offset: 0 }
  const offset = literalValue(offsetInit.getText())
  if (offset.kind !== "literal" || typeof offset.value !== "number")
    return { kind: "unreadable", reason: "backdrop offset is not a numeric literal" }
  return { kind: "spec", path: path.value, offset: offset.value }
}

/**
 * Build-time anchor injection (EDITOR.md "Anchoring"): wrap every
 * PascalCase construction and every `this.play(...)` / `this.backdrop(...)`
 * call with `__dt(expr, "<relFile>:<start>:<end>")`, spans being offsets
 * into the ORIGINAL source. Pure text splicing over positions gathered
 * from one parse — no AST re-printing, so untouched bytes stay untouched.
 * Fails open: anything unexpected returns the source unchanged.
 */
export const injectAnchors = (
  source: string,
  relFile: string,
  helperSpecifier: string,
): string => {
  try {
    const file = project.createSourceFile("anchor-target.ts", source, { overwrite: true })
    const spans: { start: number; end: number }[] = []
    for (const node of pascalConstructions(file)) {
      spans.push({ start: node.getStart(), end: node.getEnd() })
    }
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression().getText()
      if (callee === "this.play" || callee === "this.backdrop") {
        spans.push({ start: call.getStart(), end: call.getEnd() })
      }
    }
    if (spans.length === 0) return source

    const insertions: { pos: number; text: string }[] = []
    for (const { start, end } of spans) {
      insertions.push({ pos: start, text: "__dt(" })
      insertions.push({ pos: end, text: `, ${JSON.stringify(`${relFile}:${start}:${end}`)})` })
    }
    insertions.sort((a, b) => b.pos - a.pos)
    let out = source
    for (const { pos, text } of insertions) {
      out = out.slice(0, pos) + text + out.slice(pos)
    }
    return `import { __dt } from ${JSON.stringify(helperSpecifier)}\n${out}`
  } catch (err) {
    console.error(`[dreamtalk] anchor injection failed for ${relFile} — passing through:`, err)
    return source
  }
}
