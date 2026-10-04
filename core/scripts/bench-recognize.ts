/**
 * bench-recognize.ts — every reader on a benchmark set, N times each:
 * choice correctness, end-to-end ms, fit. Prints table rows for
 * docs/reports/fast-recognition.md.
 *
 *   WHICH=geometry,groq,clef,haiku,opus  N=5  bun scripts/bench-recognize.ts
 *   REAL=cylinder BOARD=scratch          also David's newest burst on that board, read as a cylinder
 *
 * The set: seeded scribbles (test/scribbles.ts — circle, cylinder, cube,
 * MindVirus with its tail) plus, with REAL, the newest burst of ink on a
 * board (speculate.ts likelySelection; read-only). Readers without keys
 * print "awaiting key". Each reading goes through recognize() with the
 * magic switch's name — exactly what the whiteboard does.
 */

import { eyesOptions, loadEnv } from "./backends"
import { recognize } from "./recognize"
import type { InkStroke } from "../sketch/protocol"
import { likelySelection } from "../sketch/speculate"
import { DEFAULT_IMPORTS } from "../sketch/vocabulary"
import { roughCube, roughCylinder, roughMindVirus, wobblyCircle } from "../test/scribbles"

loadEnv()
const out = new URL("../../.cache/sketch", import.meta.url).pathname
await Bun.$`mkdir -p ${out}`
const vocab = [...new Set([...DEFAULT_IMPORTS, "cylinder"])]

/** The ink as the page renders it for the model: dark on white, cropped + margin. */
const pngOf = async (ink: readonly InkStroke[], name: string) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const s of ink) for (const p of s.points) (x0 = Math.min(x0, p.x)), (y0 = Math.min(y0, p.y)), (x1 = Math.max(x1, p.x)), (y1 = Math.max(y1, p.y))
  const crop = { x: x0 - 32, y: y0 - 32, w: x1 - x0 + 64, h: y1 - y0 + 64 }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${crop.w}" height="${crop.h}" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}"><rect x="${crop.x}" y="${crop.y}" width="${crop.w}" height="${crop.h}" fill="white"/>` +
    ink.map((s) => `<polyline fill="none" stroke="black" stroke-width="3" stroke-linecap="round" points="${s.points.map((p) => `${p.x},${p.y}`).join(" ")}"/>`).join("") +
    "</svg>"
  await Bun.write(`${out}/bench-${name}.svg`, svg)
  Bun.spawnSync(["rsvg-convert", "-o", `${out}/bench-${name}.png`, `${out}/bench-${name}.svg`])
  return { png: Buffer.from(await Bun.file(`${out}/bench-${name}.png`).arrayBuffer()).toString("base64"), crop }
}

const set: { name: string; truth: string; ink: InkStroke[] }[] = [
  { name: "circle", truth: "circle", ink: wobblyCircle(3) },
  { name: "cylinder", truth: "cylinder", ink: roughCylinder(3) },
  { name: "cube", truth: "cube", ink: roughCube(3) },
  { name: "mindVirus", truth: "mindVirus", ink: roughMindVirus(3).ink },
]
if (process.env.REAL) {
  const board = await Bun.file(new URL(`../demo/boards/${process.env.BOARD ?? "scratch"}.board.json`, import.meta.url).pathname).json()
  const ink = likelySelection(board.strokes as InkStroke[])
  if (ink.length) set.push({ name: `real ${process.env.REAL} (${ink.length} strokes)`, truth: process.env.REAL, ink })
  else console.log("REAL: the board has no ink")
}

const N = Number(process.env.N ?? 5)
const which = (process.env.WHICH ?? "geometry,groq,clef,haiku,opus").split(",")
const options = eyesOptions()
console.log("| reader | sketch | right | median ms | range ms | fit |\n|---|---|---|---|---|---|")
for (const w of which) {
  const opt = options.find((o) => o.id === w)
  if (!opt?.available) {
    console.log(`| ${w} | — | awaiting key (${opt?.needs ?? "?"}) | | | |`)
    continue
  }
  for (const c of set) {
    const { png, crop } = await pngOf(c.ink, c.name.split(" ")[0]!)
    const runs: { ok: boolean; ms: number; fit?: number }[] = []
    for (let i = 0; i < N; i++) {
      const t0 = performance.now()
      const r = await recognize({ png, crop, strokes: c.ink, vocabulary: vocab, backend: w })
      runs.push({ ok: r.candidates[0]?.symbol === c.truth, ms: performance.now() - t0, fit: r.fit })
    }
    const ms = runs.map((r) => r.ms).sort((a, b) => a - b)
    const fits = runs.map((r) => r.fit).filter((f): f is number => f !== undefined).sort((a, b) => a - b)
    console.log(
      `| ${opt.label} | ${c.name} | ${runs.filter((r) => r.ok).length}/${N} | ${ms[Math.floor(N / 2)]!.toFixed(0)} | ${ms[0]!.toFixed(0)}–${ms.at(-1)!.toFixed(0)} | ${fits.length ? fits[Math.floor(fits.length / 2)]!.toFixed(3) : "–"} |`,
    )
  }
}
