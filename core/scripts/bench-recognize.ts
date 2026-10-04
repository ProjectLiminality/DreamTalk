/**
 * bench-recognize.ts — David's real cylinder (59 searching strokes on the
 * scratch board, read-only), read N times by each path: choice
 * correctness, end-to-end ms, fit. Prints table rows for
 * docs/reports/fast-recognition.md §6.
 *
 *   WHICH=geometry,cli,groq,clef,clef-mock,groq-mock  N=10  bun scripts/bench-recognize.ts
 *
 * groq/clef need their keys (core/.env); the -mock paths fake the model
 * (CLEF_LAT / GROQ_LAT ms) to time our own share.
 */
import { recognize } from "./recognize"
import { cliBackend, clefBackend, decisionFirst, groqBackend, loadEnv, type Backend } from "./backends"
import { instantReading } from "../sketch/fit"
import { DEFAULT_IMPORTS } from "../sketch/vocabulary"
import type { InkStroke } from "../sketch/protocol"
const vocab = [...DEFAULT_IMPORTS.filter((v) => v !== "cylinder"), "cylinder"]
loadEnv()
const out = new URL("../../.cache/sketch", import.meta.url).pathname
await Bun.$`mkdir -p ${out}`
const board = await Bun.file(new URL("../demo/boards/scratch.board.json", import.meta.url).pathname).json()
const ink: InkStroke[] = board.strokes.filter((s: InkStroke) => s.points.every((p) => p.x > 1300 && p.y > 900))
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
for (const s of ink) for (const p of s.points) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
const crop = { x: x0 - 32, y: y0 - 32, w: x1 - x0 + 64, h: y1 - y0 + 64 }
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${crop.w}" height="${crop.h}" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}"><rect x="${crop.x}" y="${crop.y}" width="${crop.w}" height="${crop.h}" fill="white"/>` + ink.map((s) => `<polyline fill="none" stroke="black" stroke-width="3" stroke-linecap="round" points="${s.points.map((p) => p.x + "," + p.y).join(" ")}"/>`).join("") + "</svg>"
await Bun.write(`${out}/realcyl.svg`, svg)
Bun.spawnSync(["rsvg-convert", "-o", `${out}/realcyl.png`, `${out}/realcyl.svg`])
const png = Buffer.from(await Bun.file(`${out}/realcyl.png`).arrayBuffer()).toString("base64")
const req = { png, crop, strokes: ink, vocabulary: vocab }
console.log("strokes", ink.length, "vocab", vocab.length)
const N = Number(process.env.N ?? 10)
const which = (process.env.WHICH ?? "geometry,clef-mock,groq-mock").split(",")
const row = (name: string, runs: { ok: boolean; ms: number; fit?: number; what: string }[]) => {
  const ms = runs.map((r) => r.ms).sort((a, b) => a - b)
  const med = ms[Math.floor(ms.length / 2)]!
  console.log(`ROW | ${name} | ${runs.filter((r) => r.ok).length}/${runs.length} | ${med.toFixed(0)} | ${ms[0]!.toFixed(0)}–${ms.at(-1)!.toFixed(0)} | ${runs.map((r) => r.fit?.toFixed(3) ?? "–").join(" ")} | ${[...new Set(runs.map((r) => r.what))].join(", ")}`)
}
const mockFetch = (lat: number, body: () => unknown) => async () => { await new Promise((r) => setTimeout(r, lat)); return new Response(JSON.stringify(body())) }
for (const w of which) {
  const runs: { ok: boolean; ms: number; fit?: number; what: string }[] = []
  for (let i = 0; i < N; i++) {
    const t0 = performance.now()
    if (w === "geometry") {
      const r = instantReading(ink, vocab)
      runs.push({ ok: r?.response.candidates[0]?.symbol === "cylinder", ms: performance.now() - t0, fit: r?.fits[0]?.score.total, what: r?.response.candidates[0]?.symbol ?? "deferred" })
      continue
    }
    let chain: Backend[] = [], decision: any = null
    if (w === "cli") chain = [cliBackend()]
    if (w === "groq") {
      if (!process.env.GROQ_API_KEY) { console.log("groq: awaiting key"); break }
      chain = [groqBackend({ apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL })]
    }
    if (w === "clef") {
      decision = decisionFirst({ ...process.env, RECOGNIZE_BACKENDS: "clef" })
      if (!decision) { console.log("clef: awaiting CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN"); break }
    }
    if (w === "clef-mock") decision = clefBackend({ accountId: "x", apiToken: "x", fetch: mockFetch(Number(process.env.CLEF_LAT ?? 150), () => ({ result: { answers: { symbol: { type: "choice", choice: "cylinder", probabilities: { cylinder: 0.9, cube: 0.1 }, confidence: 0.8 } } } })) })
    if (w === "groq-mock") chain = [groqBackend({ apiKey: "x", fetch: mockFetch(Number(process.env.GROQ_LAT ?? 450), () => ({ choices: [{ message: { content: JSON.stringify({ candidates: [{ symbol: "cylinder", params: [["cx", 1420], ["cy", 1075], ["radius", 70], ["height", 200], ["h", 0], ["p", 0.4], ["b", 0]].map(([name, number]) => ({ name, number, text: null, points: [] })), confidence: 0.9, why: "" }], notes: "" }) } }] })) })]
    const r = await recognize(req, { chain, decision })
    runs.push({ ok: r.candidates[0]?.symbol === "cylinder", ms: performance.now() - t0, fit: r.fit, what: r.candidates[0]?.symbol ?? (r.error ?? "none").slice(0, 60) })
  }
  if (runs.length) row(w, runs)
}
