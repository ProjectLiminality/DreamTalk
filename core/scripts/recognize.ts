/**
 * recognize.ts — the sketchpad's eyes: a scribble's PIXELS, looked at by
 * Claude against the scene's imported vocabulary (sketch/vocabulary.ts).
 *
 *   recognize(req) → asks the configured vision backend (scripts/backends.ts:
 *   Groq, the Anthropic API, or — with no keys, as always — the Claude CLI
 *   headless on the subscription), parses its answer into a
 *   RecognizeResponse, and hands it to the FITTER (sketch/fit.ts), which
 *   tunes every candidate's params until the symbol lies on the ink.
 *
 * When the fit stays poor the reading gets a SECOND LOOK: the same fast
 * model sees the ink with its own reading drawn over it in red
 * (overlay.ts) and corrects it; still poor, Claude takes the hard case.
 * Every answer says which stages ran and how long each took.
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

import type { Candidate, InkStroke, RecognizeRequest, RecognizeResponse, RecognizeStage } from "../sketch/protocol"
import { PAGE_H, PAGE_W } from "../sketch/protocol"
import { instantReading, refineResponse, symbolOutline, type FitResult } from "../sketch/fit"
import { inkKey } from "../sketch/speculate"
import { readPoints, vocabById, DEFAULT_IMPORTS, type VocabEntry } from "../sketch/vocabulary"
import { askChain, backendChain, CLI_MODEL, cliResultText, isFast, loadEnv, type Backend, type VisionReply } from "./backends"
import { describeShelf } from "./catalogue"
import { overlayPng } from "./overlay"

export { cliResultText }
/** The CLI's model (backends.ts) — instruct.ts and the logs name it. */
export const MODEL = CLI_MODEL
const TIMEOUT_MS = 90_000
/** Points per stroke handed to the model (evenly subsampled, ends kept). */
const MAX_STROKE_POINTS = 40
const repoRoot = new URL("../../", import.meta.url).pathname

// --- The prompt ---------------------------------------------------------------

const SYSTEM = `You are the recognizer of the DreamTalk sketchpad. A person scribbles on a tablet; you look at the scribble and say which symbol from an imported vocabulary they meant, and with what parameters. You answer with ONE JSON object and nothing else.`

export const subsample = (stroke: InkStroke, max = MAX_STROKE_POINTS): [number, number][] => {
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

export const bbox = (pts: readonly { x: number; y: number }[]): string => {
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

export const vocabBlock = (entries: VocabEntry[]): string =>
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

/**
 * The prompt. `imagePath` is for the CLI, which Reads the image from disk;
 * without one the image is attached inline. `reply: "schema"` describes the
 * reply the API backends are held to (readingSchema: params as a list,
 * which a strict JSON schema can state for every symbol at once).
 */
export const buildPrompt = (
  req: RecognizeRequest,
  imagePath: string | undefined,
  img: { w: number; h: number } | undefined,
  entries: VocabEntry[],
  reply: "object" | "schema" = "object",
): string => {
  const { crop } = req
  const strokes = req.strokes
    .map(strokeLine)
    .join("\n")
  const all = req.strokes.flatMap((s) => s.points)
  const mapping = img
    ? `The image is ${img.w}×${img.h} px and shows the page rectangle x ${Math.round(crop.x)}..${Math.round(crop.x + crop.w)}, y ${Math.round(crop.y)}..${Math.round(crop.y + crop.h)}: page x = ${Math.round(crop.x)} + px·${(crop.w / img.w).toFixed(4)}, page y = ${Math.round(crop.y)} + py·${(crop.h / img.h).toFixed(4)}.`
    : `The image shows the page rectangle x ${Math.round(crop.x)}..${Math.round(crop.x + crop.w)}, y ${Math.round(crop.y)}..${Math.round(crop.y + crop.h)}.`
  const see = imagePath ? `Read the image ${imagePath}` : "Look at the attached image"
  return `${see} — a hand-drawn scribble selected on a ${PAGE_W}×${PAGE_H} page (origin top-left, y DOWN).

${mapping}

The exact pen strokes, in PAGE units (each a polyline of [x, y], subsampled), with measurements: a small start→end gap means a closed loop; the least-squares circle fit is exact for round loops (low rms relative to r) and meaningless otherwise:
${strokes}
All strokes together: bbox ${bbox(all)}.

THE IMPORTED VOCABULARY — the only symbols you may answer with:
${vocabBlock(entries)}

HOW TO READ IT
1. FIRST Read the image — always. Look at it for what the person MEANT; use the stroke coordinates for exact geometry. Every param is in PAGE units / page angles — compute them from the stroke numbers (fit the centre and size to the actual ink, e.g. a circle's centre is the middle of its loop and r the mean distance to it), not from rough image impressions.
2. WORDS. ${entries.some((e) => e.id === "text") ? `If the selection is ONLY handwriting — words and nothing drawn that they could label — it IS the symbol "text": transcribe it exactly as written (same spelling, same case, nothing added or corrected) and measure where and how tall it is from the strokes. ` : ""}Words written BESIDE a drawn shape (a label, caption or arrow next to circles, a box…) are COMMENTS, not shape: they clarify intent ("flower of life", "cube", "→ big") and must steer which symbol you choose for the drawing; exclude their strokes from the geometry, transcribe them into "notes" (e.g. "label: flower of life"), and answer with the shape, never with "text". Text may appear only in the image, not among the strokes.
3. If one reading is clearly right, return exactly ONE candidate. Only if the drawing is genuinely ambiguous between symbols (or between clearly different parameter readings), return 2–4 candidates, most likely first. Never pad with unlikely ones.
4. If nothing in the vocabulary fits at all, return an empty candidates list and say why in "notes".
5. Fill EVERY param of the chosen symbol. "points" params are arrays of [x, y] page points.

${reply === "schema" ? SCHEMA_REPLY : OBJECT_REPLY}`
}
const OBJECT_REPLY = `Reply with ONLY this JSON (no prose, no code fence):
{"candidates":[{"symbol":"<id>","params":{...},"confidence":<0..1>,"why":"<one short line>"}],"notes":"<comments read, or empty>"}`

const SCHEMA_REPLY = `Reply with ONLY this JSON:
{"candidates":[{"symbol":"<id>","params":[{"name":"<param>","number":<number or null>,"text":<string or null>,"points":[{"x":<x>,"y":<y>},…]}],"confidence":<0..1>,"why":"<one short line>"}],"notes":"<comments read, or empty>"}
"params" lists EVERY param of the chosen symbol once: numbers in "number", strings and enum options in "text", point paths in "points" (an empty list for every param that is not a path).`

/**
 * The reply as a strict JSON schema (Groq json_schema strict, Anthropic
 * output_config.format): every object closed, every field required, params
 * as a list of name/value entries — one schema for every symbol.
 */
export const readingSchema = (ids: readonly string[]): Record<string, unknown> => {
  const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] })
  const closed = (properties: Record<string, unknown>) => ({
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  })
  return closed({
    candidates: {
      type: "array",
      items: closed({
        symbol: { type: "string", enum: [...ids] },
        params: {
          type: "array",
          items: closed({
            name: { type: "string" },
            number: nullable("number"),
            text: nullable("string"),
            points: { type: "array", items: closed({ x: { type: "number" }, y: { type: "number" } }) },
          }),
        },
        confidence: { type: "number" },
        why: { type: "string" },
      }),
    },
    notes: { type: "string" },
  })
}

/** Params as the schema's list → the object every other reader expects. */
const paramsFromList = (list: unknown[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const e of list) {
    if (!e || typeof e !== "object") continue
    const { name, number, text, points } = e as { name?: unknown; number?: unknown; text?: unknown; points?: unknown }
    if (typeof name !== "string") continue
    if (Array.isArray(points) && points.length > 0) out[name] = points
    else if (typeof number === "number") out[name] = number
    else if (typeof text === "string") out[name] = text
  }
  return out
}


// --- The reply ------------------------------------------------------------------

export const stripFences = (s: string): string => {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(s)
  if (fenced) return fenced[1]!.trim()
  // Prose around a bare object: take the outermost braces.
  const a = s.indexOf("{")
  const b = s.lastIndexOf("}")
  return a >= 0 && b > a ? s.slice(a, b + 1) : s.trim()
}

/** One param, coerced to its spec; undefined drops it. */
export const coerceParam = (entry: VocabEntry, key: string, v: unknown): unknown => {
  const spec = entry.params[key]
  if (!spec) return undefined
  if (spec.type === "points") {
    const pts = readPoints(v)
    // A tumbled path keeps its depth (vocabulary.ts PagePt); a drawn one has none.
    const r1 = (v: number) => Math.round(v * 10) / 10
    return pts.map((p) => (p.z === undefined ? [r1(p.x), r1(p.y)] : [r1(p.x), r1(p.y), r1(p.z)]))
  }
  if (spec.type === "string") return typeof v === "string" || typeof v === "number" ? String(v) : undefined
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
    const given = Array.isArray(params) ? paramsFromList(params) : params && typeof params === "object" ? (params as Record<string, unknown>) : {}
    for (const [k, v] of Object.entries(given)) {
      const cv = coerceParam(entry, k, v)
      if (cv !== undefined) out[k] = cv
    }
    // Text with nothing to say is no text.
    if (entry.id === "text" && !(typeof out.content === "string" && out.content.trim())) continue
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

// --- The call ---------------------------------------------------------------------

export interface RecognizeOptions {
  /** The backends to ask (default: backends.ts backendChain()). */
  chain?: Backend[]
  /** Asked ahead of ✦ (the pen paused): fast backends only, never the CLI. */
  speculative?: boolean
}

/** A fit worse than this (fit.ts score) earns the reading a second look: the right
 *  symbol lies within ~0.025 of hand-drawn ink, a wrong one 0.03 and up (fit.ts bench). */
export const POOR_FIT = 0.03

const on = (v: string | undefined, dflt: boolean) => (v === undefined ? dflt : !/^(0|false|off|no)$/i.test(v))

/** The fit of a response's top candidate, from refineResponse's fits. */
const topFit = (res: RecognizeResponse, fits: FitResult[]): number | undefined => {
  const top = res.candidates[0]
  return top ? fits.find((f) => f.symbol === top.symbol)?.score.total : undefined
}

const SECOND_LOOK = (c: Candidate) => `

SECOND LOOK. The SECOND attached image is the same crop with your earlier reading drawn in RED over the ink (black): ${c.symbol} ${JSON.stringify(c.params)}. If the red does not lie on the black — the wrong symbol, or the right one misplaced, mis-sized or mis-turned — correct it. Same rules, same reply.`

/**
 * One reading, staged:
 *
 *   0. GEOMETRY (opt-in, RECOGNIZE_GEOMETRY_FIRST=1) — fit.ts instantReading;
 *      a clear circle needs no model at all.
 *   1. FIRST LOOK — down the backend chain (fast first, the CLI last).
 *   2. FIT — every candidate tuned onto the ink (RECOGNIZE_FIT=0 to skip).
 *   3. SECOND LOOK — a poor fit (> POOR_FIT) is shown back to the same fast
 *      model as an overlay, once, to correct.
 *   4. ESCALATE — still poor: Claude (the API; the CLI too, but never
 *      ahead of ✦). RECOGNIZE_ESCALATE=0 turns 3–4 off.
 */
export async function recognize(req: RecognizeRequest, opts: RecognizeOptions = {}): Promise<RecognizeResponse> {
  const started = performance.now()
  const stages: RecognizeStage[] = []
  const timed = (name: string, t0: number, note?: string) =>
    stages.push({ name, ms: Math.round(performance.now() - t0), ...(note ? { note } : {}) })
  const done = (res: RecognizeResponse): RecognizeResponse => {
    res.stages = stages
    console.log(
      `[recognize] ${((performance.now() - started) / 1000).toFixed(2)}s${opts.speculative ? " (ahead)" : ""} · ` +
        stages.map((s) => `${s.name} ${s.ms}ms${s.note ? ` (${s.note})` : ""}`).join(" → ") +
        " → " +
        (res.candidates.map((c) => `${c.symbol} ${c.confidence}`).join(", ") || res.error || "nothing") +
        (res.fit !== undefined ? ` · fit ${res.fit.toFixed(3)}` : ""),
    )
    return res
  }
  try {
    loadEnv()
    const wanted = req.vocabulary ?? DEFAULT_IMPORTS
    // A symbol imported from the shelf is described in its own words.
    await describeShelf(repoRoot)
    const entries = wanted.map(vocabById).filter((e): e is VocabEntry => !!e)
    if (entries.length === 0) return { candidates: [], error: "no known symbols in the imported vocabulary" }
    const ids = entries.map((e) => e.id)
    const full = opts.chain ?? backendChain()
    const chain = opts.speculative ? full.filter(isFast) : full
    if (chain.length === 0) return done({ candidates: [], error: "no fast backend to ask ahead" })
    const png = req.png.replace(/^data:image\/png;base64,/, "")
    const img = pngSize(Uint8Array.from(Buffer.from(png, "base64")))
    const fitting = on(process.env.RECOGNIZE_FIT, true)
    const escalate = on(process.env.RECOGNIZE_ESCALATE, true)

    // 0. Geometry first (opt-in).
    if (on(process.env.RECOGNIZE_GEOMETRY_FIRST, false)) {
      const t0 = performance.now()
      const instant = instantReading(req.strokes, ids)
      timed("geometry", t0, instant ? "clear" : "unclear")
      if (instant) return done({ ...instant.response, fit: instant.fits[0]?.score.total, backend: "geometry" })
    }

    const parses = (r: VisionReply) => !parseRecognizeReply(r.text, ids).error?.startsWith("unparseable")
    const ask = (backends: readonly Backend[], pngs: string[], extra = "") =>
      askChain(
        backends,
        {
          system: SYSTEM,
          pngs,
          tag: "scribble",
          timeoutMs: TIMEOUT_MS,
          schema: readingSchema(ids),
          // The CLI reads the image from disk and answers in the object form, as always.
          prompt: (paths) => (paths ? buildPrompt(req, paths[0], img, entries) : buildPrompt(req, undefined, img, entries, "schema") + extra),
        },
        parses,
      )
    const refine = (res: RecognizeResponse): { res: RecognizeResponse; fit?: number } => {
      if (!fitting || res.candidates.length === 0) return { res }
      const t0 = performance.now()
      const { response, fits } = refineResponse(req.strokes, res)
      const fit = topFit(response, fits)
      timed("fit", t0, fit !== undefined ? fit.toFixed(3) : undefined)
      return { res: response, fit }
    }

    // 1. The first look.
    let t0 = performance.now()
    const first = await ask(chain, [png])
    if (!first.reply) return done({ candidates: [], error: first.failures.join("; ") || "no backend answered" })
    const eyes = first.reply
    timed(`${eyes.backend} ${eyes.model}`, t0, first.failures.length ? `after ${first.failures.join("; ")}` : undefined)
    // 2. The fit.
    let { res, fit } = refine(parseRecognizeReply(eyes.text, ids))
    let backend = `${eyes.backend}:${eyes.model}`

    // 3. A second look by the same fast eyes, at their reading over the ink.
    const top = res.candidates[0]
    if (escalate && top && fit !== undefined && fit > POOR_FIT && eyes.backend !== "cli") {
      t0 = performance.now()
      const overlay = overlayPng(req.strokes, symbolOutline(top.symbol, top.params), req.crop)
      const second = await ask(chain.filter((b) => b.name === eyes.backend), [png, overlay], SECOND_LOOK(top))
      timed("second look", t0, second.reply ? undefined : second.failures.join("; "))
      if (second.reply) {
        const again = refine(parseRecognizeReply(second.reply.text, ids))
        if (again.res.candidates.length > 0 && (again.fit === undefined || again.fit < fit)) ({ res, fit } = again)
      }
    }

    // 4. Still poor: Claude takes the hard case.
    if (escalate && fit !== undefined && fit > POOR_FIT) {
      const claude = full.filter(
        (b) => b.name !== eyes.backend && (b.name === "anthropic" || (b.name === "cli" && !opts.speculative)),
      )[0]
      if (claude) {
        t0 = performance.now()
        const hard = await ask([claude], [png])
        timed(`escalate ${claude.name}`, t0, hard.reply ? undefined : hard.failures.join("; "))
        if (hard.reply) {
          const again = refine(parseRecognizeReply(hard.reply.text, ids))
          if (again.res.candidates.length > 0 && (again.fit === undefined || again.fit < fit)) {
            ;({ res, fit } = again)
            backend = `${hard.reply.backend}:${hard.reply.model}`
          }
        }
      }
    }
    return done({ ...res, ...(fit !== undefined ? { fit } : {}), backend })
  } catch (err) {
    return done({ candidates: [], error: String((err as Error)?.message ?? err) })
  }
}

// --- Asked once, answered twice: the reading of an ink set, remembered ---------------

/** The ink + imports a reading is of (speculate.ts inkKey — the page keys its own by it too). */
export const readingKey = (req: Pick<RecognizeRequest, "strokes" | "vocabulary">): string => Bun.hash(inkKey(req)).toString(36)

const MEMO_SIZE = 32
const memo = new Map<string, Promise<RecognizeResponse>>()

/**
 * recognize(), remembered by readingKey: a reading asked ahead of ✦ (the
 * pen paused) IS the answer when ✦ asks about the same ink — at once if it
 * is done, the rest of the wait if it is still running. An empty reading is
 * not remembered, so ✦ asks again properly (with the CLI, if it must).
 */
export const recognizeMemo = (req: RecognizeRequest, opts: RecognizeOptions = {}): Promise<RecognizeResponse> => {
  const key = readingKey(req)
  const hit = memo.get(key)
  if (hit) {
    const t0 = performance.now()
    return hit.then((r) => {
      if (!opts.speculative && r.candidates.length === 0) {
        if (memo.get(key) === hit) memo.delete(key)
        return recognizeMemo(req, opts)
      }
      return { ...r, stages: [...(r.stages ?? []), { name: "remembered", ms: Math.round(performance.now() - t0) }] }
    })
  }
  const p = recognize(req, opts)
  memo.set(key, p)
  while (memo.size > MEMO_SIZE) memo.delete(memo.keys().next().value!)
  void p.then((r) => {
    if (r.candidates.length === 0 && memo.get(key) === p) memo.delete(key)
  })
  return p
}

/** What the page asks before it reads ahead: is there a fast backend at all? */
export const recognizeConfig = (): { backends: string[]; speculate: boolean } => {
  const chain = backendChain()
  return { backends: chain.map((b) => `${b.name}:${b.model}`), speculate: chain.some(isFast) }
}
