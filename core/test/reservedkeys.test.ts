import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { RESERVED_KEYS } from "../src/automaton"

/** Every .ts file under a directory, skipping built bundles and dependencies. */
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name.startsWith("dist")) return []
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return name.endsWith(".ts") ? [path] : []
  })

describe("reserved player keys", () => {
  test("no shipped holon or scene declares a key the player keeps for itself", () => {
    const root = join(import.meta.dir, "..")
    const clashes: string[] = []
    for (const file of [...sources(join(root, "vocabulary")), ...sources(join(root, "demo"))]) {
      const text = readFileSync(file, "utf8")
      // An axis option's key is one character: `key: "g"`.
      for (const m of text.matchAll(/\bkey:\s*(["'`])(.)\1/g)) {
        if (!RESERVED_KEYS.includes(m[2]!)) continue
        const line = text.slice(0, m.index).split("\n").length
        clashes.push(`${file.slice(root.length + 1)}:${line} key "${m[2]}"`)
      }
    }
    // A reserved key is replaced by a digit in the player — say so here instead.
    expect(clashes).toEqual([])
  })
})
