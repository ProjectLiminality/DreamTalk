/**
 * fresh.ts — the stale-bundle guard.
 *
 * `demo/dist/main.js` is a build artifact the demo serves but never
 * rebuilds itself, so any score taken after a source change but before
 * a `bun build` silently measures the previous state. That hazard bit
 * five different agents across two campaigns ("a plausible number
 * produced by something other than what you think you're measuring"),
 * so the scoring harnesses now enforce freshness instead of asking
 * every operator to remember it.
 *
 * ensureFreshDemoBundle() compares the bundle's mtime against the
 * newest .ts under demo/, src/ and vocabulary/, rebuilds when the
 * source is newer (or the bundle is missing), and says which it did.
 */
import { readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const CORE = "/Users/davidrug/RealDealVault/ProjectLiminality/DreamTalk/core"

const newestSourceMtime = (dir: string): number => {
  let newest = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules") continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestSourceMtime(path))
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".html")) {
      newest = Math.max(newest, statSync(path).mtimeMs)
    }
  }
  return newest
}

export const ensureFreshDemoBundle = (): void => {
  const bundle = join(CORE, "demo/dist/main.js")
  const source = Math.max(
    newestSourceMtime(join(CORE, "demo")),
    newestSourceMtime(join(CORE, "src")),
    newestSourceMtime(join(CORE, "vocabulary")),
  )
  if (existsSync(bundle) && statSync(bundle).mtimeMs >= source) {
    console.log("bundle fresh")
    return
  }
  console.log("bundle STALE — rebuilding before scoring")
  const build = spawnSync(
    "bun",
    ["build", "demo/main.ts", "--outdir", "demo/dist", "--format", "esm", "--target", "browser"],
    { cwd: CORE, stdio: "inherit" },
  )
  if (build.status !== 0) {
    console.error("rebuild failed — refusing to score a stale bundle")
    process.exit(2)
  }
}
