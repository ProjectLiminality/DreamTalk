/**
 * recognize.ts — the sketchpad's eyes: a scribble's PIXELS, looked at by
 * Claude against the scene's imported vocabulary (sketch/vocabulary.ts).
 *
 *   recognize(req) → writes the crop PNG under .cache/sketch/, spawns the
 *   Claude CLI headless (`claude -p`, the subscription — there is no API
 *   key on this machine), and parses its answer into a RecognizeResponse.
 *
 * The prompt hands the model three things at once, because each covers
 * the others' blind spot:
 *
 *  - the IMAGE (Read tool) — the gestalt: what was meant, words and arrows;
 *  - the STROKES as integer page-unit polylines, with their bounding boxes —
 *    exact geometry, where crop pixels are coarse and conversion error-prone;
 *  - the VOCABULARY entries actually imported (ids, descriptions, params) —
 *    the only answers allowed.
 *
 * Every number goes in and comes out in PAGE units (protocol.ts), so the
 * model never converts between frames; the crop box is stated only so it
 * can locate what it sees in the image on the page.
 *
 * `parseRecognizeReply` is the pure half — fence stripping, validation,
 * coercion — exported for the tests.
 */

import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import type { Candidate, InkStroke, RecognizeRequest, RecognizeResponse } from "../sketch/protocol"
import { PAGE_H, PAGE_W } from "../sketch/protocol"
import { readPoints, vocabById, VOCABULARY, type VocabEntry } from "../sketch/vocabulary"

const MODEL = "claude-opus-5-5"
const TIMEOUT_MS = 90_000
/** Points per stroke handed to the model (evenly subsampled, ends kept). */
const MAX_STROKE_POINTS = 40
const repoRoot = new URL("../../", import.meta.url).pathname
const cacheDir = `${repoRoot}.cache/sketch`

// --- The prompt ---------------------------------------------------------------

const SYSTEM = `You are the recognizer of the DreamTalk sketchpad. A person scribbles on a tablet; you look at the scribble and say which symbol from an imported vocabulary they meant, and with what parameters. You answer with ONE JSON object and nothing else.`

const subsample = (stroke: InkStroke, max = MAX_STROKE_POINTS): [number, number][] => {
  const pts = stroke.points
  if (pts.length === 0) return []
  const n = Math.min(max, pts.length)
  const out: [number, number][] = []
  for (let k = 0; k < n; k++) {
    const p = pts[n === 1 ? 0 : Math.round((k * (pts.length - 1)) / (n - 1))]!
    out.push([Math.round(p.x), Math.round(p.y)])
  }
  return out
}

const bbox = (pts: readonly { x: number; y: number }[]): string => {
  if (pts.length === 0) return "empty"
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of pts) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y)
  }
  return `x ${Math.round(x0)}..${Math.round(x1)}, y ${Math.round(y0)}..${Math.round(y1)} (w ${Math.round(x1 - x0)}, h ${Math.round(y1 - y0)})`
}

/**
 * Least-squares circle through a stroke (Kåsa fit) — a measurement handed
 * to the model as a hint, so a round loop's centre and radius are exact
 * instead of eyeballed from a bbox. `rms` says how round the stroke is.
 */
export const fitCircle = (
  pts: readonly { x: number; y: number }[],
): { cx: number; cy: number; r: number; rms: number } | undefined => {
  const n = pts.length
  if (n < 5) return undefined
  let mx = 0, my = 0
  for (const p of pts) { mx += p.x; my += p.y }
  mx /= n; my /= n
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0
  for (const p of pts) {
    const u = p.x - mx, v = p.y - my
    suu += u * u; svv += v * v; suv += u * v
    suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u
  }
  const det = suu * svv - suv * suv
  if (Math.abs(det) < 1e-9) return undefined
  const a = (suuu + suvv) / 2
  const b = (svvv + svuu) / 2
  const uc = (a * svv - b * suv) / det
  const vc = (b * suu - a * suv) / det
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n)
  let e = 0
  for (const p of pts) e += (Math.hypot(p.x - mx - uc, p.y - my - vc) - r) ** 2
  return { cx: mx + uc, cy: my + vc, r, rms: Math.sqrt(e / n) }
}

const strokeLine = (s: InkStroke, i: number): string => {
  const pts = s.points
  const first = pts[0]
  const last = pts[pts.length - 1]
  const gap = first && last ? Math.round(Math.hypot(first.x - last.x, first.y - last.y)) : 0
  const fit = fitCircle(pts)
  const fitText =
    fit && fit.r < 5000
      ? `; circle fit centre (${Math.round(fit.cx)}, ${Math.round(fit.cy)}) r ${Math.round(fit.r)} rms ${fit.rms.toFixed(1)}`
      : ""
  return `stroke ${i + 1} (${pts.length} samples; bbox ${bbox(pts)}; start→end gap ${gap}${fitText}): ${JSON.stringify(subsample(s))}`
}

const vocabBlock = (entries: VocabEntry[]): string =>
  entries
    .map((e) => {
      const params = Object.entries(e.params)
        .map(([k, s]) => `    - ${k} (${s.type}${s.options ? `: ${s.options.join("|")}` : ""}): ${s.description}`)
        .join("\n")
      return `- id "${e.id}" — ${e.name}. ${e.description}\n  params:\n${params}`
    })
    .join("\n")

/** PNG width/height from its IHDR chunk (bytes 16..23), or undefined. */
export const pngSize = (bytes: Uint8Array): { w: number; h: number } | undefined => {
  if (bytes.length < 24 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return undefined
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { w: dv.getUint32(16), h: dv.getUint32(20) }
}

export const buildPrompt = (
  req: RecognizeRequest,
  imagePath: string,
  img: { w: number; h: number } | undefined,
  entries: VocabEntry[],
): string => {
  const { crop } = req
  const strokes = req.strokes
    .map(strokeLine)
    .join("\n")
  const all = req.strokes.flatMap((s) => s.points)
  const mapping = img
    ? `The image is ${img.w}×${img.h} px and shows the page rectangle x ${Math.round(crop.x)}..${Math.round(crop.x + crop.w)}, y ${Math.round(crop.y)}..${Math.round(crop.y + crop.h)}: page x = ${Math.round(crop.x)} + px·${(crop.w / img.w).toFixed(4)}, page y = ${Math.round(crop.y)} + py·${(crop.h / img.h).toFixed(4)}.`
    : `The image shows the page rectangle x ${Math.round(crop.x)}..${Math.round(crop.x + crop.w)}, y ${Math.round(crop.y)}..${Math.round(crop.y + crop.h)}.`
  return `Read the image ${imagePath} — a hand-drawn scribble selected on a ${PAGE_W}×${PAGE_H} page (origin top-left, y DOWN).

${mapping}

The exact pen strokes, in PAGE units (each a polyline of [x, y], subsampled), with measurements: a small start→end gap means a closed loop; the least-squares circle fit is exact for round loops (low rms relative to r) and meaningless otherwise:
${strokes}
All strokes together: bbox ${bbox(all)}.

THE IMPORTED VOCABULARY — the only symbols you may answer with:
${vocabBlock(entries)}

HOW TO READ IT
1. FIRST Read the image — always. Look at it for what the person MEANT; use the stroke coordinates for exact geometry. Every param is in PAGE units / page angles — compute them from the stroke numbers (fit the centre and size to the actual ink, e.g. a circle's centre is the middle of its loop and r the mean distance to it), not from rough image impressions.
2. Handwritten words, arrows and labels are COMMENTS, not shape: they clarify intent ("flower of life", "cube", "→ big") and must steer which symbol you choose. Exclude their strokes from the geometry. Transcribe what they say into "notes" (e.g. "label: flower of life"). Text may appear only in the image, not among the strokes.
3. If one reading is clearly right, return exactly ONE candidate. Only if the drawing is genuinely ambiguous between symbols (or between clearly different parameter readings), return 2–4 candidates, most likely first. Never pad with unlikely ones.
4. If nothing in the vocabulary fits at all, return an empty candidates list and say why in "notes".
5. Fill EVERY param of the chosen symbol. "points" params are arrays of [x, y] page points.

Reply with ONLY this JSON (no prose, no code fence):
{"candidates":[{"symbol":"<id>","params":{...},"confidence":<0..1>,"why":"<one short line>"}],"notes":"<comments read, or empty>"}`
}

// --- The reply ------------------------------------------------------------------

const stripFences = (s: string): string => {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(s)
  if (fenced) return fenced[1]!.trim()
  // Prose around a bare object: take the outermost braces.
  const a = s.indexOf("{")
  const b = s.lastIndexOf("}")
  return a >= 0 && b > a ? s.slice(a, b + 1) : s.trim()
}

/** One param, coerced to its spec; undefined drops it. */
const coerceParam = (entry: VocabEntry, key: string, v: unknown): unknown => {
  const spec = entry.params[key]
  if (!spec) return undefined
  if (spec.type === "points") {
    const pts = readPoints(v)
    return pts.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10])
  }
  if (spec.type === "enum") {
    const s = String(v)
    return spec.options && !spec.options.includes(s) ? spec.options[0] : s
  }
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  if (entry.id === "mindVirus" && key === "fold") return Math.min(1, Math.max(-1, n))
  return n
}

/**
 * The model's raw text → a validated RecognizeResponse. Pure. Unknown or
 * un-imported symbols are dropped, numbers coerced, fold clamped to
 * [−1, 1], confidence clamped to [0, 1], candidates sorted by confidence.
 */
export const parseRecognizeReply = (text: string, allowed?: readonly string[]): RecognizeResponse => {
  let raw: unknown
  try {
    raw = JSON.parse(stripFences(text))
  } catch {
    return { candidates: [], error: `unparseable reply: ${text.slice(0, 200)}` }
  }
  if (!raw || typeof raw !== "object") return { candidates: [], error: "reply is not an object" }
  const obj = raw as { candidates?: unknown; notes?: unknown }
  const list = Array.isArray(obj.candidates) ? obj.candidates : []
  const candidates: Candidate[] = []
  for (const c of list) {
    if (!c || typeof c !== "object") continue
    const { symbol, params, confidence, why } = c as Record<string, unknown>
    const entry = typeof symbol === "string" ? vocabById(symbol) : undefined
    if (!entry || (allowed && !allowed.includes(entry.id))) continue
    const out: Record<string, unknown> = {}
    const given = params && typeof params === "object" ? (params as Record<string, unknown>) : {}
    for (const [k, v] of Object.entries(given)) {
      const cv = coerceParam(entry, k, v)
      if (cv !== undefined) out[k] = cv
    }
    const conf = Number(confidence)
    candidates.push({
      symbol: entry.id,
      params: out,
      confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5,
      why: typeof why === "string" ? why : "",
    })
  }
  candidates.sort((a, b) => b.confidence - a.confidence)
  const res: RecognizeResponse = { candidates }
  if (typeof obj.notes === "string" && obj.notes.trim()) res.notes = obj.notes.trim()
  if (list.length > 0 && candidates.length === 0) res.error = "no candidate named an imported symbol"
  return res
}

/** The CLI's --output-format json: an array of events (or one object);
 *  the `result` event's `.result` is the model's text. */
export const cliResultText = (stdout: string, meta?: { turns?: number; cost?: number }): string => {
  const parsed = JSON.parse(stdout) as unknown
  const events = Array.isArray(parsed) ? parsed : [parsed]
  const result = events.find((e) => (e as { type?: string })?.type === "result") as
    | { result?: unknown; is_error?: boolean; num_turns?: number; total_cost_usd?: number }
    | undefined
  if (!result) throw new Error("no result event in CLI output")
  if (meta) {
    meta.turns = result.num_turns
    meta.cost = result.total_cost_usd
  }
  if (result.is_error) throw new Error(`CLI error: ${String(result.result).slice(0, 300)}`)
  return String(result.result ?? "")
}

// --- The call ---------------------------------------------------------------------

export async function recognize(req: RecognizeRequest): Promise<RecognizeResponse> {
  const started = performance.now()
  try {
    const wanted = req.vocabulary?.length ? req.vocabulary : VOCABULARY.map((e) => e.id)
    const entries = wanted.map(vocabById).filter((e): e is VocabEntry => !!e)
    if (entries.length === 0) return { candidates: [], error: "no known symbols in the imported vocabulary" }
    const b64 = req.png.replace(/^data:image\/png;base64,/, "")
    const bytes = Uint8Array.from(Buffer.from(b64, "base64"))
    await mkdir(cacheDir, { recursive: true })
    const imagePath = `${cacheDir}/scribble-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
    await Bun.write(imagePath, bytes)

    const prompt = buildPrompt(req, imagePath, pngSize(bytes), entries)
    // Lean session: Read only, no MCP servers, no settings/CLAUDE.md, run
    // from outside the repo so no project instructions load.
    const proc = Bun.spawn(
      [
        "claude", "-p",
        "--model", MODEL,
        "--tools", "Read",
        "--allowedTools", "Read",
        "--strict-mcp-config",
        "--setting-sources", "",
        "--no-session-persistence",
        "--system-prompt", SYSTEM,
        "--output-format", "json",
        prompt,
      ],
      { cwd: tmpdir(), stdout: "pipe", stderr: "pipe", stdin: "ignore" },
    )
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
    }, TIMEOUT_MS)
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    clearTimeout(timer)
    if (timedOut) return { candidates: [], error: `recognizer timed out after ${TIMEOUT_MS / 1000}s` }
    if (code !== 0 && !stdout.trim()) {
      return { candidates: [], error: `claude exited ${code}: ${stderr.slice(0, 300)}` }
    }
    const meta: { turns?: number; cost?: number } = {}
    const res = parseRecognizeReply(cliResultText(stdout, meta), entries.map((e) => e.id))
    console.log(
      `[recognize] ${((performance.now() - started) / 1000).toFixed(1)}s · ${meta.turns ?? "?"} turns · $${meta.cost?.toFixed(3) ?? "?"} → ` +
        (res.candidates.map((c) => `${c.symbol} ${c.confidence}`).join(", ") || res.error || "nothing"),
    )
    return res
  } catch (err) {
    return { candidates: [], error: String((err as Error)?.message ?? err) }
  }
}
