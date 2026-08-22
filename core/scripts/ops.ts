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
