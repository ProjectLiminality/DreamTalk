/**
 * local-holons.ts — the ONE way the player bundle is built: with whatever
 * scenes this machine's local holon repos declare.
 *
 * `holons/` is gitignored; each holon there is its own local repo, and some
 * never leave the machine. A holon whose dreamtalk.json names
 * `"scene": { "id", "export", "entry"? }` is playable at
 * `/demo/?scene=<id>`. `localHolonsPlugin` swaps demo/localHolons.ts for
 * a registry of them; `buildPlayer` builds demo/main.ts → demo/dist (also
 * gitignored) with it. Used by `bun run build:demo` (scripts/build-demo.ts)
 * and by the studio daemon's auto-rebuild, so the two can never disagree.
 * The tracked editor bundle never goes through here.
 */

import type { BunPlugin, PluginBuilder } from "bun"
import { existsSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"

const repoRoot = new URL("../../", import.meta.url).pathname
export const holonsDir = `${repoRoot}holons/`

export interface LocalScene {
  id: string
  file: string
  exportName: string
}

export const findLocalScenes = async (): Promise<LocalScene[]> => {
  const found: LocalScene[] = []
  const dirs = await readdir(holonsDir, { withFileTypes: true }).catch(() => [])
  for (const d of dirs) {
    if (!d.isDirectory()) continue
    const manifest = Bun.file(`${holonsDir}${d.name}/dreamtalk.json`)
    if (!(await manifest.exists())) continue
    const m = (await manifest.json().catch(() => ({}))) as {
      entry?: string
      scene?: { id?: string; export?: string; entry?: string }
    }
    const s = m.scene
    const entry = s?.entry ?? m.entry
    if (!s?.id || !s.export || !entry) continue
    found.push({ id: s.id, file: `${holonsDir}${d.name}/${entry}`, exportName: s.export })
  }
  return found.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * A holon shared without its private modules plays on their anonymized
 * siblings: inside holons/, an import of `./data` whose `data.ts` is absent
 * resolves to `data.anon.ts`. A machine that has the private module uses it.
 */
export const anonFallback = (build: PluginBuilder): void => {
  build.onResolve({ filter: /^\.\.?\// }, (a) => {
    if (!a.importer.startsWith(holonsDir)) return undefined
    const target = resolve(dirname(a.importer), a.path).replace(/\.ts$/, "")
    if (existsSync(`${target}.ts`) || existsSync(target)) return undefined
    const alt = `${target}.anon.ts`
    return existsSync(alt) ? { path: alt } : undefined
  })
}

export const localHolonsPlugin = (scenes: LocalScene[]): BunPlugin => ({
  name: "dreamtalk-local-holons",
  setup(build) {
    anonFallback(build)
    build.onLoad({ filter: /demo\/localHolons\.ts$/ }, () => ({
      loader: "ts",
      contents: [
        `import type { DreamClass } from "../src/dream"`,
        ...scenes.map((s, i) => `import { ${s.exportName} as S${i} } from ${JSON.stringify(s.file)}`),
        `export const localScenes: Record<string, DreamClass> = {`,
        ...scenes.map((s, i) => `  ${JSON.stringify(s.id)}: S${i},`),
        `}`,
      ].join("\n"),
    }))
  },
})

/** Build the player bundle with the local scenes. Never throws: a broken tree reports and returns false. */
export const buildPlayer = async (): Promise<{ ok: boolean; scenes: string[] }> => {
  const scenes = await findLocalScenes()
  try {
    const result = await Bun.build({
      entrypoints: [`${repoRoot}core/demo/main.ts`],
      outdir: `${repoRoot}core/demo/dist`,
      target: "browser",
      format: "esm",
      plugins: [localHolonsPlugin(scenes)],
    })
    if (!result.success) {
      for (const message of result.logs) console.error(message)
      return { ok: false, scenes: scenes.map((s) => s.id) }
    }
  } catch (err) {
    console.error("[dreamtalk] player build failed:", err)
    return { ok: false, scenes: scenes.map((s) => s.id) }
  }
  return { ok: true, scenes: scenes.map((s) => s.id) }
}
