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

export type OpResult =
  | { ok: true; text: string }
  | { ok: false; reason: string }

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
