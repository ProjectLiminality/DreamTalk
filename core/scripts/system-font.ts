/**
 * system-font.ts — put a face from a macOS system font COLLECTION into
 * the local, gitignored cache at `refs/fonts/`.
 *
 * Usage:
 *   bun core/scripts/system-font.ts --list                     # what PL02 needs, and whether it is here
 *   bun core/scripts/system-font.ts HelveticaNeue-Bold         # extract one face
 *   bun core/scripts/system-font.ts --all                      # every face PL02's deck declares
 *
 * WHY A SCRIPT AND NOT A COMMITTED FILE. The PL02 deck sets its type in
 * HelveticaNeue; Apple's fonts are proprietary and cannot be vendored
 * into this public repo. They ARE on every macOS machine, so the honest
 * arrangement is: this machine extracts what it has into a cache git
 * never sees, and anything without that cache falls back to the vendored
 * Arimo — a reproducible repo for everyone, full fidelity where the
 * licence already permits it. `core/demo/fonts/README.md` states the
 * difference the fallback makes.
 *
 * The extraction itself is src/render/ttc.ts — an sfnt repack, no
 * re-encoding, deterministic. This script is only the file plumbing.
 */

import { existsSync, mkdirSync } from "node:fs"
import { extractFace, listFaces } from "../src/render/ttc"
import { SYSTEM_FACES, systemFontPath } from "../src/render/fonts"

const REPO = new URL("../../", import.meta.url).pathname
const CACHE = `${REPO}refs/fonts`

const args = process.argv.slice(2)
const wanted = args.filter((a) => !a.startsWith("--"))

if (args.includes("--list")) {
  for (const [ps, source] of Object.entries(SYSTEM_FACES)) {
    const cached = existsSync(`${CACHE}/${ps}.ttf`)
    const present = existsSync(source)
    console.log(
      `${ps.padEnd(28)} collection=${present ? "present" : "MISSING"}  cache=${cached ? "yes" : "no"}`,
    )
  }
  if (args.length === 1) process.exit(0)
}

const faces = args.includes("--all") ? Object.keys(SYSTEM_FACES) : wanted
if (faces.length === 0) {
  console.error("usage: bun core/scripts/system-font.ts <PostScriptName…> | --all | --list")
  process.exit(2)
}

mkdirSync(CACHE, { recursive: true })

for (const postScriptName of faces) {
  const source = systemFontPath(postScriptName)
  if (!source) {
    console.error(`${postScriptName}: not a face this repo knows how to source (see SYSTEM_FACES)`)
    process.exitCode = 1
    continue
  }
  if (!existsSync(source)) {
    console.error(`${postScriptName}: ${source} is not on this machine — the fallback stays in force`)
    process.exitCode = 1
    continue
  }
  const collection = new Uint8Array(await Bun.file(source).arrayBuffer())
  const face = listFaces(collection).find((f) => f.postScriptName === postScriptName)
  if (!face) {
    console.error(`${postScriptName}: not in ${source}`)
    process.exitCode = 1
    continue
  }
  const out = `${CACHE}/${postScriptName}.ttf`
  const bytes = extractFace(collection, face.index)
  await Bun.write(out, bytes)
  console.log(`${postScriptName}: face ${face.index} of ${source} → ${out} (${bytes.length} bytes)`)
}
