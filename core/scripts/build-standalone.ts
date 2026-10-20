/**
 * build-standalone.ts — one local holon scene as a static site of its own,
 * outside this repo: index.html + app.js + the fonts and the shaping WASM.
 * Any static host serves it (`bunx serve <out>`).
 *
 *   bun scripts/build-standalone.ts --scene <id> [--data=anon|client] [--out <dir>] [--title <text>]
 *
 * --scene   a holon scene id (its dreamtalk.json `scene.id`, scripts/local-holons.ts).
 * --data    `anon` (default): every module of the holon that has a
 *           `<name>.anon.ts` beside it is built from that instead; the build
 *           fails if the holon has none, so a missing variant can never ship
 *           the original. `client`: the holon's modules as they are.
 * --out     default: `<holon name>Demo/` beside this repo. Never inside it.
 * --title   the page title; default: the holon's name, words spaced.
 *
 * The bundle is demo/standalone.ts with the registry holding ONLY this scene
 * (the public scene list is never imported), minified (no comments), no
 * source map. The page opens in free play, presenter mode on, unless its
 * URL says otherwise.
 */

import type { BunPlugin } from "bun"
import { copyFile, mkdir, readdir, rm } from "node:fs/promises"
import { basename, dirname, join, resolve } from "node:path"
import { findLocalScenes, localHolonsPlugin, holonsDir } from "./local-holons"

const repoRoot = resolve(new URL("../../", import.meta.url).pathname)
const core = `${repoRoot}/core`

const args = process.argv.slice(2)
const opt = (name: string): string | undefined => {
  const eq = args.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const sceneId = opt("scene")
const variant = opt("data") ?? "anon"
if (!sceneId) throw new Error("--scene <id> is required")
if (variant !== "anon" && variant !== "client") throw new Error(`--data must be anon or client, not ${variant}`)
const scene = (await findLocalScenes()).find((s) => s.id === sceneId)
if (!scene) throw new Error(`no local holon declares scene "${sceneId}"`)
const holonDir = dirname(scene.file)
const holonName = basename(holonDir)
const out = resolve(opt("out") ?? `${dirname(repoRoot)}/${holonName}Demo`)
if (out === repoRoot || out.startsWith(`${repoRoot}/`)) throw new Error(`--out must lie outside ${repoRoot}`)
const title = opt("title") ?? holonName.replace(/([a-z])([A-Z])/g, "$1 $2")

/** Modules of the holon swapped for their `.anon.ts` sibling. */
const swapped = new Set<string>()
const variantPlugin: BunPlugin = {
  name: "standalone-data-variant",
  setup(build) {
    if (variant === "client") return
    build.onResolve({ filter: /^\.\.?\// }, (a) => {
      if (!a.importer.startsWith(`${holonsDir}${holonName}/`)) return undefined
      const target = resolve(dirname(a.importer), a.path).replace(/\.ts$/, "")
      const alt = `${target}.${variant}.ts`
      if (!target.startsWith(holonDir) || !Bun.file(alt).size) return undefined
      swapped.add(basename(alt))
      return { path: alt }
    })
  },
}

/**
 * Fonts and the WASM next to the page (relative), not at the studio's
 * /core/demo/…; and the editor's class-name map (every vocabulary class,
 * through the parts barrel) cut to `constructor.name`, which identifiers
 * kept unminified leave intact — so the bundle holds only what the scene uses.
 */
const assetsPlugin: BunPlugin = {
  name: "standalone-assets",
  setup(build) {
    build.onLoad({ filter: /editor\/classname\.ts$/ }, () => ({
      loader: "ts",
      contents: `import type { Holon } from "../src/holon"\nexport const classNameOf = (holon: Holon): string => holon.constructor.name`,
    }))
    // parts/index's compatibility re-exports of the old sovereign symbols
    // (static fields keep them from being shaken out): cut, but Cylinder,
    // which the host draws itself. A scene still importing one through
    // parts/index fails this build by name.
    build.onLoad({ filter: /src\/parts\/index\.ts$/ }, async (a) => ({
      loader: "ts",
      contents: (await Bun.file(a.path).text()).replace(/^export \* from "\.\.\/\.\.\/vocabulary\/(?!Cylinder\/).*$/gm, ""),
    }))
    build.onLoad({ filter: /src\/render\/text\.ts$/ }, async (a) => ({
      loader: "ts",
      contents: (await Bun.file(a.path).text()).replaceAll('"/core/demo/fonts/', '"./fonts/').replaceAll('"/core/demo/wasm/', '"./wasm/'),
    }))
  },
}

// Only what this script writes is replaced; the rest of the folder (a README, a .git) stays.
await mkdir(out, { recursive: true })
for (const f of await readdir(out)) if (f === "index.html" || f === "fonts" || f === "wasm" || /\.(js|map)$/.test(f)) await rm(join(out, f), { recursive: true })

const result = await Bun.build({
  entrypoints: [`${core}/demo/standalone.ts`],
  outdir: out,
  naming: "app.js",
  target: "browser",
  format: "esm",
  // Whitespace and syntax only: identifiers keep their names, since the nest
  // and the toolkit name levels by their classes.
  minify: { whitespace: true, syntax: true, identifiers: false },
  sourcemap: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [localHolonsPlugin([scene]), variantPlugin, assetsPlugin],
})
if (!result.success) {
  for (const m of result.logs) console.error(m)
  process.exit(1)
}
if (variant !== "client" && swapped.size === 0) {
  await rm(join(out, "app.js"), { force: true })
  throw new Error(`--data=${variant}: ${holonName} has no *.${variant}.ts module — nothing built`)
}

// Studio-only paths cut: a module's absolute __dirname (the build machine's
// tree), refs/ (the studio's gitignored material, which a static host
// never has — a face looked for there falls back to the vendored one), and
// a vendored Keynote asset's provenance (its .iwa path; never read). The
// framework's own name in its log prefixes and event names goes too (all of
// them, in this one bundle, so dispatch and listener still agree).
const appPath = `${out}/app.js`
const home = process.env.HOME ?? "/Users/"
const app = (await Bun.file(appPath).text())
  .replace(/"(\/Users\/|\/home\/)[^"]*"/g, '""')
  .replaceAll('"refs/', '"')
  .replace(/"[^"]*\.iwa"/g, '""')
  .replace(/dreamtalk/gi, "app")
for (const leak of [repoRoot, home, "refs/"]) if (app.includes(leak)) throw new Error(`app.js still names ${leak}`)
await Bun.write(appPath, app)

await mkdir(`${out}/fonts`, { recursive: true })
await mkdir(`${out}/wasm`, { recursive: true })
for (const f of ["Arimo-Regular.ttf", "Cousine-Regular.ttf", "OFL-Cousine.txt"]) await copyFile(`${core}/demo/fonts/${f}`, `${out}/fonts/${f}`)
await copyFile(`${core}/demo/wasm/hb.wasm`, `${out}/wasm/hb.wasm`)

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
await Bun.write(
  `${out}/index.html`,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <link rel="icon" href="data:," />
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
    #stage { width: 100vw; height: 100vh; display: block; }
    #readout { position: fixed; bottom: 10px; left: 12px; color: #555; font: 12px monospace; }
  </style>
  <script>
    // A bare link opens in free play, presenter mode on.
    if (!location.search) history.replaceState(null, "", "?play=free&presenter=1" + location.hash)
  </script>
</head>
<body>
  <canvas id="stage" width="1280" height="720"></canvas>
  <div id="readout">loading…</div>
  <script type="module" src="./app.js"></script>
</body>
</html>
`,
)

const kb = (Bun.file(`${out}/app.js`).size / 1024).toFixed(0)
console.log(`${sceneId} → ${out} · data=${variant}${swapped.size ? ` (${[...swapped].join(", ")})` : ""} · app.js ${kb} KB`)
