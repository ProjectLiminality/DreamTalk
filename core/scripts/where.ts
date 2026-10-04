/**
 * where.ts — where does a DreamNode live on disk?
 *
 * The Dream Explorer (demo/explorer.ts) shows every DreamNode's source
 * file under its name: window ≡ folder ≡ DreamNode, the PWD made visible
 * (docs/transmissions/2026-09-20-creator-mode.md). A browser cannot read
 * the filesystem and a bundle has forgotten its files, so the daemon
 * answers by asking the source itself: which .ts file declares
 * `class <Name>`? Never a generated index — an index drifts, the files
 * cannot.
 *
 * Searched in the order a name should resolve: holon repos, then the
 * vocabulary, then the demo DreamWeavings, then the framework. A miss is
 * undefined and the label simply carries no path.
 */

import { Glob } from "bun"
import { existsSync } from "node:fs"

/** Repo-relative roots, most sovereign first. */
const ROOTS = ["holons", "core/vocabulary", "core/demo", "core/src"]

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Hits only — a class written after a miss must still be found. */
const found = new Map<string, string>()

/** The repo-relative file that declares `class <name>`, or undefined. */
export const whereIs = async (repoRoot: string, name: string): Promise<string | undefined> => {
  if (!NAME.test(name)) return undefined
  const known = found.get(name)
  if (known) return known
  const declares = new RegExp(`^\\s*(?:export\\s+)?(?:abstract\\s+)?class\\s+${name}\\b`, "m")
  let hit: string | undefined
  search: for (const root of ROOTS) {
    // A checkout without the holon repos still resolves the rest.
    if (!existsSync(`${repoRoot}${root}`)) continue
    for await (const rel of new Glob("**/*.ts").scan({ cwd: `${repoRoot}${root}`, onlyFiles: true })) {
      if (rel.includes("node_modules/") || rel.includes("dist/") || rel.endsWith(".d.ts")) continue
      const text = await Bun.file(`${repoRoot}${root}/${rel}`).text()
      if (declares.test(text)) {
        hit = `${root}/${rel}`
        break search
      }
    }
  }
  if (hit) found.set(name, hit)
  return hit
}

/** A place in the source an agent can open: repo-relative file, 1-based line. */
export interface SourceLine {
  file: string
  line: number
  /** The line itself, trimmed — so a reader sees what is there without opening it. */
  text: string
}

const lineAt = (text: string, index: number): { line: number; text: string } => {
  const line = text.slice(0, index).split("\n").length
  return { line, text: (text.split("\n")[line - 1] ?? "").trim() }
}

/** whereIs, down to the line that says `class <name>`. */
export const whereIsAt = async (repoRoot: string, name: string): Promise<SourceLine | undefined> => {
  const file = await whereIs(repoRoot, name)
  if (!file) return undefined
  const text = await Bun.file(`${repoRoot}${file}`).text()
  const m = new RegExp(`^[ \\t]*(?:export\\s+)?(?:abstract\\s+)?class\\s+${name}\\b`, "m").exec(text)
  return m ? { file, ...lineAt(text, m.index) } : undefined
}

/**
 * The line in `file` that declares the field `name` — `opGlyph = new
 * Text(…)`, `readonly app: Calculator = …`, or `this.app = …` in a
 * constructor. This is where a holon is MADE, which is usually the line a
 * comment on it wants changed.
 */
export const fieldSiteOf = async (
  repoRoot: string,
  file: string,
  name: string,
): Promise<SourceLine | undefined> => {
  if (!NAME.test(name)) return undefined
  const source = Bun.file(`${repoRoot}${file}`)
  if (!(await source.exists())) return undefined
  const text = await source.text()
  const field = new RegExp(
    `^[ \\t]*(?:(?:readonly|public|private|protected|override|declare)\\s+)*${name}\\s*[!?]?\\s*[:=](?!=)`,
    "m",
  )
  const assigned = new RegExp(`\\bthis\\.${name}\\s*=(?!=)`)
  const m = field.exec(text) ?? assigned.exec(text)
  return m ? { file, ...lineAt(text, m.index) } : undefined
}
