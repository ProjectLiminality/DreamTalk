/**
 * Semantic ops — the UI→code half of the bidirectional loop (EDITOR.md).
 *
 * Pure functions over source text: parse with ts-morph, rewrite only the
 * targeted literals/statement, preserve every other byte. The daemon owns
 * files and queues; this module owns nothing but the transformation.
 */

import { IndentationText, Project, SyntaxKind } from "ts-morph"
import type { CallExpression, MethodDeclaration } from "ts-morph"

export interface SetBackdropOp {
  op: "setBackdrop"
  /** Reference path relative to the repo root, e.g. "refs/video-01/x.mkv". */
  path: string
  /** Seconds added to scene t when sampling the backdrop (default 0). */
  offset?: number
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
