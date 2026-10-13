/**
 * build-demo.ts — the player bundle (demo/dist, gitignored), with local holons.
 *
 *   bun scripts/build-demo.ts
 *
 * Exactly `bun build demo/main.ts --outdir demo/dist`, plus one plugin:
 * demo/localHolons.ts is replaced by a registry of every holon under
 * holons/ whose dreamtalk.json declares a `scene` (see that file). Holons
 * stay sovereign and local; the public tree names none of them.
 */

import type { BunPlugin } from "bun"
import { readdir } from "node:fs/promises"

const repoRoot = new URL("../../", import.meta.url).pathname
const holonsDir = `${repoRoot}holons/`

interface LocalScene {
  id: string
  file: string
  exportName: string
}

const findLocalScenes = async (): Promise<LocalScene[]> => {
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
    if (!s?.id || !s.export) continue
    found.push({ id: s.id, file: `${holonsDir}${d.name}/${s.entry ?? m.entry}`, exportName: s.export })
  }
  return found.sort((a, b) => a.id.localeCompare(b.id))
}

const localHolonsPlugin = (scenes: LocalScene[]): BunPlugin => ({
  name: "dreamtalk-local-holons",
  setup(build) {
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

const scenes = await findLocalScenes()
const result = await Bun.build({
  entrypoints: [`${repoRoot}core/demo/main.ts`],
  outdir: `${repoRoot}core/demo/dist`,
  target: "browser",
  format: "esm",
  plugins: [localHolonsPlugin(scenes)],
})
if (!result.success) {
  for (const message of result.logs) console.error(message)
  process.exit(1)
}
console.log(`demo bundle built${scenes.length ? ` · local scenes: ${scenes.map((s) => s.id).join(", ")}` : ""}`)
