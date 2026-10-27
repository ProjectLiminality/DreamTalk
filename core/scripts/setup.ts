/**
 * setup.ts — a fresh clone's one step after `bun install`: bring in the
 * public holons the core itself composes.
 *
 *   bun run setup
 *
 * `holons/` is gitignored: every holon there is its own repo. The founding
 * holons (the Circle, the Square and the Cylinder they become) are drawn
 * into the core's own scenes and vocabulary, so a clone needs them before
 * it builds. Each one missing is cloned from its public repo; one already
 * there is left as it is (pull it yourself). Private holons never come
 * from here — clone those into holons/ by hand, where they are allowed.
 */

import { existsSync } from "node:fs"
import { holonsDir } from "./local-holons"

const FOUNDING = ["Circle", "Square", "Cylinder"]
const ORIGIN = "https://github.com/ProjectLiminality"

let failed = false
for (const name of FOUNDING) {
  const dir = `${holonsDir}${name}`
  if (existsSync(dir)) {
    console.log(`holons/${name} · present`)
    continue
  }
  const clone = Bun.spawnSync(["git", "clone", "--quiet", `${ORIGIN}/${name}.git`, dir], { stdout: "inherit", stderr: "inherit" })
  if (clone.exitCode === 0) console.log(`holons/${name} · cloned`)
  else {
    console.error(`holons/${name} · clone failed`)
    failed = true
  }
}
if (failed) process.exit(1)
