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
