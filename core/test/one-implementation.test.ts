/**
 * A symbol has exactly one implementation (docs/TASTE.md, "One symbol, one
 * implementation"): a sovereign holon imported everywhere it appears, so
 * an improvement to it reaches every DreamSong. Scenes compose; they do
 * not redraw.
 *
 * These guards catch the two ways that rule has been broken before:
 *   - a scene or another holon declaring its OWN class under a shelf
 *     symbol's name (a second Globe, a second Figure);
 *   - a private copy of a core helper — the derived-points memo lived as
 *     ~20 copies, one of which had silently lost its geomVersion bump.
 */

import { describe, expect, test } from "bun:test"
import { lstatSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { SHELF } from "../sketch/catalogue"

const core = new URL("../", import.meta.url).pathname
const holons = new URL("../../holons/", import.meta.url).pathname

/** Every .ts source under `dir`, bundles and dependencies left out. */
const sources = (dir: string): string[] => {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const out: string[] = []
  for (const name of names) {
    // Submodules are other DreamNodes (and may hold this very repo again).
    if (name === "node_modules" || name === "submodules" || name.startsWith("dist") || name.startsWith(".")) continue
    const path = join(dir, name)
    const st = lstatSync(path)
    if (st.isSymbolicLink()) continue
    if (st.isDirectory()) out.push(...sources(path))
    else if (name.endsWith(".ts")) out.push(path)
  }
  return out
}

const ALL = [...["src", "vocabulary", "demo", "sketch", "editor"].flatMap((d) => sources(join(core, d))), ...sources(holons)]
const rel = (p: string) => relative(core, p)

describe("one symbol, one implementation", () => {
  test("no shelf symbol's class is declared anywhere but its own folder", () => {
    const offenders: string[] = []
    for (const { className, folder } of SHELF) {
      const declares = new RegExp(`^\\s*(?:export\\s+)?class\\s+${className}\\b(?:\\s+extends\\s+(\\w+))?`, "m")
      for (const file of ALL) {
        if (rel(file).startsWith(`vocabulary/${folder}/`)) continue
        const text = readFileSync(file, "utf8")
        const m = declares.exec(text)
        if (!m) continue
        // A DreamNode that EXTENDS the one implementation (a sovereign
        // wrapper, e.g. holons/Cylinder) composes it; that is allowed.
        const base = m[1]
        const imported = base && new RegExp(`import\\s*{[^}]*\\b(?:${className}\\s+as\\s+)?${base}\\b[^}]*}\\s*from\\s*"[^"]*(?:vocabulary/${folder}/|src/parts)`).test(text)
        if (!imported) offenders.push(`${rel(file)}: class ${className}`)
      }
    }
    expect(offenders).toEqual([])
  })

  test("derived Line points go through primitives.ts derivePoints, not a private copy", () => {
    // Holons whose copy awaits their owner's next pass — this list only shrinks.
    const PENDING = new Set<string>([])
    const copy = /defineProperty\(\s*[\w.]+\s*,\s*"points"/
    const offenders = ALL.map(rel).filter(
      (f) => f !== "src/parts/primitives.ts" && !PENDING.has(f) && copy.test(readFileSync(join(core, f), "utf8")),
    )
    expect(offenders).toEqual([])
  })

  test("parts are attached through attach(), not a cast past add()'s protection", () => {
    // Files whose casts await their owner's next pass — this list only shrinks.
    const PENDING = new Set([
      "vocabulary/Earth/Earth.ts",
      "vocabulary/Earth/Labels.ts",
      "vocabulary/Earth/PointData.ts",
      "vocabulary/GeoFlow/GeoFlow.ts",
    ])
    const cast = /as unknown as \{\s*add\(/
    const offenders = ALL.map(rel).filter((f) => !PENDING.has(f) && cast.test(readFileSync(join(core, f), "utf8")))
    expect(offenders).toEqual([])
  })

  test("the eye's distance is stated once: frames.ts eyeDistance/viewOf, not a private copy", () => {
    // The host's own camera placement is the source of truth; the viewer's
    // keep-out inverts the camera; the sketch mirror builds its own THREE
    // camera. Everything else asks frames.ts (viewOf / eyeDistance).
    const ALLOWED = new Set(["src/geometry/frames.ts", "src/render/three-host.ts", "src/view.ts", "sketch/mirror.ts"])
    const copy = /\.radius\.value\s*\/\s*\(\s*\w+\.zoom\.value/
    const offenders = ALL.map(rel).filter(
      (f) => !ALLOWED.has(f) && !f.includes("ValueFlow") && copy.test(readFileSync(join(core, f), "utf8")),
    )
    expect(offenders).toEqual([])
  })
})
