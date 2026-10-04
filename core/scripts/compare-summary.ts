/**
 * compare-summary.ts — which reader wins over David's real sketches.
 *
 *   bun scripts/compare-summary.ts [path]   (default .cache/sketch/compare.jsonl)
 *
 * Reads every comparison the whiteboard logged (recognize.ts
 * recognizeCompare: one line per ✦-compare, one entry per reader) and every
 * pick David made from a comparison's ring, and prints one line per reader:
 * how often it answered, how fast (median ms), how well its reading lay on
 * the ink (median fit), how often it agreed with the majority, and — the
 * strongest signal — how often David PICKED its chip.
 */

import { existsSync, readFileSync } from "node:fs"

interface Entry {
  backend: string
  choice: string | null
  ms: number
  fit: number | null
  error?: string
}
interface Comparison {
  id: string
  results: Entry[]
}
interface Pick {
  pick: string
  backend: string
  symbol: string
}

export const summarize = (lines: readonly string[]): string[] => {
  const comparisons: Comparison[] = []
  const picks: Pick[] = []
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const o = JSON.parse(line) as Partial<Comparison & Pick>
      if (Array.isArray(o.results)) comparisons.push(o as Comparison)
      else if (typeof o.pick === "string") picks.push(o as Pick)
    } catch {
      // a torn line: skip it
    }
  }
  const median = (xs: number[]) => {
    if (xs.length === 0) return undefined
    const s = [...xs].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]!
  }
  const by = new Map<string, { runs: number; answered: number; ms: number[]; fit: number[]; agree: number; picked: number; errors: number }>()
  const stat = (b: string) => {
    let s = by.get(b)
    if (!s) by.set(b, (s = { runs: 0, answered: 0, ms: [], fit: [], agree: 0, picked: 0, errors: 0 }))
    return s
  }
  for (const c of comparisons) {
    const votes = new Map<string, number>()
    for (const r of c.results) if (r.choice) votes.set(r.choice, (votes.get(r.choice) ?? 0) + 1)
    const majority = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    for (const r of c.results) {
      const s = stat(r.backend)
      s.runs++
      s.ms.push(r.ms)
      if (r.error) s.errors++
      if (!r.choice) continue
      s.answered++
      if (r.fit !== null) s.fit.push(r.fit)
      if (r.choice === majority) s.agree++
    }
  }
  for (const p of picks) stat(p.backend).picked++
  const rows = [...by.entries()].sort((a, b) => b[1].picked - a[1].picked || (median(a[1].ms) ?? 0) - (median(b[1].ms) ?? 0))
  const out = [`${comparisons.length} comparisons, ${picks.length} picks`]
  for (const [b, s] of rows) {
    const ms = median(s.ms)
    const fit = median(s.fit)
    out.push(
      `${b.padEnd(9)} picked ${String(s.picked).padStart(3)} · answered ${s.answered}/${s.runs} · median ${ms === undefined ? "–" : `${ms} ms`} · fit ${fit === undefined ? "–" : fit.toFixed(3)} · with majority ${s.agree}/${s.answered}${s.errors ? ` · ${s.errors} errors` : ""}`,
    )
  }
  return out
}

if (import.meta.main) {
  const path = process.argv[2] ?? new URL("../../.cache/sketch/compare.jsonl", import.meta.url).pathname
  if (!existsSync(path)) {
    console.log(`no comparisons yet (${path}) — Shift+✦ or "compare" on the whiteboard`)
  } else {
    for (const line of summarize(readFileSync(path, "utf8").split("\n"))) console.log(line)
  }
}
