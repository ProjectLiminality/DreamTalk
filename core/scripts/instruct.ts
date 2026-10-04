/**
 * instruct.ts — the whiteboard's ears and hands: David selects something (or
 * nothing) and SAYS what should happen to it; Claude looks at the page and
 * answers with edits.
 *
 *   instruct(req) → asks the recognizer's backends (backends.ts: Groq or the
 *   Anthropic API when a key is set, else the Claude CLI's lean session
 *   exactly as before), and parses the answer into an InstructResponse —
 *   a list of EditOps plus one line for David.
 *
 * The prompt hands the model the same three views recognize.ts does, for
 * the same reason (each covers the others' blind spot) — now of the WHOLE
 * page rather than one scribble:
 *
 *  - the IMAGE — the gestalt: what is where, what "the circle on the left"
 *    is. Every item carries a short TAG (S1… symbols, K1… raw ink), and
 *    the selection is drawn blue, so pixels and data name the same things;
 *  - the SCENE as data — each symbol's exact params, each stroke's bbox,
 *    circle fit and subsampled polyline, all in page units;
 *  - the VOCABULARY actually imported — the only symbols it may place.
 *
 * The selection decides the subject: "this/it/these" are the selected
 * items; with nothing selected the instruction is about the whole scene.
 * Ops speak in TAGS; `parseInstructReply` (pure, tested) maps them back to
 * page ids and validates every symbol and param against the vocabulary
 * exactly as recognize.ts does. The page turns the ops into ONE undoable
 * command (state.ts editCommand).
 */

import type { EditOp, InkStroke, InstructRequest, InstructResponse, PlacedSymbol } from "../sketch/protocol"
import { PAGE_H, PAGE_W } from "../sketch/protocol"
import { vocabById, DEFAULT_IMPORTS, type VocabEntry } from "../sketch/vocabulary"
import { askChain, backendChain, eyesFor } from "./backends"
import { describeShelf } from "./catalogue"
import { bbox, coerceParam, fitCircle, pngSize, stripFences, subsample, vocabBlock } from "./recognize"

const TIMEOUT_MS = 120_000
/** Points per stroke in the scene listing — the image carries the rest. */
const STROKE_POINTS = 16
const repoRoot = new URL("../../", import.meta.url).pathname

// --- The prompt ---------------------------------------------------------------

const SYSTEM = `You are the hands of the DreamTalk whiteboard. A person draws on a page, selects things, and SAYS what should happen; you change the page to do exactly what they said — and nothing else. You answer with ONE JSON object and nothing else.`

const round = (v: unknown): unknown => {
  if (typeof v === "number") return Math.round(v * 100) / 100
  if (Array.isArray(v)) return v.map(round)
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)]))
  return v
}

const symbolLine = (y: PlacedSymbol, tag: string, selected: boolean): string =>
  `${tag}${selected ? " [SELECTED]" : ""} ${y.symbol} ${JSON.stringify(round(y.params))}`

const inkLine = (k: InkStroke, tag: string, selected: boolean): string => {
  const pts = k.points
  const first = pts[0]
  const last = pts[pts.length - 1]
  const gap = first && last ? Math.round(Math.hypot(first.x - last.x, first.y - last.y)) : 0
  const fit = fitCircle(pts)
  const fitText =
    fit && fit.r < 5000 ? `; circle fit centre (${Math.round(fit.cx)}, ${Math.round(fit.cy)}) r ${Math.round(fit.r)} rms ${fit.rms.toFixed(1)}` : ""
  return `${tag}${selected ? " [SELECTED]" : ""} ink, ${pts.length} samples; bbox ${bbox(pts)}; start→end gap ${gap}${fitText}: ${JSON.stringify(subsample(k, STROKE_POINTS))}`
}

export const buildInstructPrompt = (
  req: InstructRequest,
  imagePath: string | undefined,
  img: { w: number; h: number } | undefined,
  entries: VocabEntry[],
): string => {
  const sel = new Set(req.selection)
  const tag = (id: string) => req.labels[id] ?? id
  const symbols = req.board.symbols.map((y) => symbolLine(y, tag(y.id), sel.has(y.id))).join("\n") || "(none)"
  const strokes = req.board.strokes.map((k) => inkLine(k, tag(k.id), sel.has(k.id))).join("\n") || "(none)"
  const scale = img ? `, drawn at ${(img.w / PAGE_W).toFixed(4)} image px per page unit (${img.w}×${img.h} px): page x = px·${(PAGE_W / img.w).toFixed(4)}, page y = py·${(PAGE_H / img.h).toFixed(4)}` : ""
  const subject = sel.size
    ? `SELECTED: ${[...sel].map(tag).join(", ")}. "this", "it", "these", "them" mean exactly these items. Act on them unless the instruction plainly names something else.`
    : `NOTHING is selected: the instruction is about the whole scene. Items are named by what they are ("the circle", "the cube on the left"); new things go where they make sense.`
  const see = imagePath ? `Read the image ${imagePath}` : "Look at the attached image"
  return `${see} — the whole whiteboard page, ${PAGE_W}×${PAGE_H} page units, origin top-left, y DOWN${scale}. Each item carries a small grey TAG: S1, S2 … placed symbols; K1, K2 … raw ink strokes (scribbles not yet made into symbols). Selected items are drawn BLUE inside a blue frame.

THE INSTRUCTION (speech-to-text — expect mishearings and homophones: "mind virus" = mindVirus, "flour of life" = flowerOfLife, "cue" = cube):
"${req.transcript.replace(/"/g, "'")}"

${subject}

THE PAGE
Placed symbols (params in page units / page angles):
${symbols}
Raw ink strokes (subsampled polylines [x, y]; a small start→end gap means a closed loop; the circle fit is exact for round loops, meaningless otherwise):
${strokes}

THE IMPORTED VOCABULARY — the only symbols you may place or turn things into:
${vocabBlock(entries)}

CONVENTIONS
- Everything in PAGE units. Angles are radians, PAGE angles: 0 = right (+x), increasing CLOCKWISE (y is down) — so up = −π/2, left = π, down = π/2. Facing a target from (x, y): angle = atan2(ty − y, tx − x).
- Keep everything the instruction does not mention EXACTLY as it is. In an update, give only the params that change.
- Relative words act on the current values: "twice as big" doubles the size param (r / size / height) and keeps the centre; "a bit" ≈ 20–30 %. A MindVirus "opening" its cube = fold toward 0; "closing" = fold 1.
- New symbols: a size in proportion to what is already there, fully on the page, not overlapping anything unless asked, with roughly one body-length of space to whatever they relate to. Fill EVERY param of a new symbol.
- Raw ink → a symbol: replaceStrokes, with params fitted to the ink's geometry (as a careful recognizer would). A symbol → a different symbol: update with "symbol" (shared params like a centre carry over).
- Moving / turning / scaling ink, or several items together as a group: transform.

THE OPS (refer to items by their TAG):
{"op":"update","id":"S1","params":{...only what changes...}}      — optional "symbol":"<vocab id>" turns it into another symbol
{"op":"add","symbol":"<vocab id>","params":{...every param...}}
{"op":"remove","id":"K2"}
{"op":"replaceStrokes","strokeIds":["K1","K2"],"symbol":"<vocab id>","params":{...every param...}}
{"op":"transform","ids":["S1","K3"],"translate":[dx,dy],"rotate":<page-angle delta>,"scale":<factor>,"pivot":[x,y]}   — all but ids optional; pivot defaults to the centre of what moves

HOW
1. FIRST Read the image — always. Use it to know what is where; take exact numbers from the data above.
2. Decide what the instruction means for this page, then express it in as few ops as do it.
3. If it cannot be done with this vocabulary, or is too unclear to act on, return no ops and say why (or what you need) in "reply".

Reply with ONLY this JSON (no prose, no code fence):
{"ops":[...],"reply":"<one short, plain line to the person: what you did — or why nothing>"}`
}

// --- The reply ------------------------------------------------------------------

const readPt = (v: unknown): { x: number; y: number } | undefined => {
  const x = Array.isArray(v) ? Number(v[0]) : Number((v as { x?: unknown })?.x)
  const y = Array.isArray(v) ? Number(v[1]) : Number((v as { y?: unknown })?.y)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined
}

const coerceParams = (entry: VocabEntry, given: unknown): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  if (!given || typeof given !== "object") return out
  for (const [k, v] of Object.entries(given as Record<string, unknown>)) {
    const cv = coerceParam(entry, k, v)
    if (cv !== undefined) out[k] = cv
  }
  return out
}

export interface InstructContext {
  /** id → tag, as drawn in the image. */
  labels: Record<string, string>
  board: { strokes: readonly { id: string }[]; symbols: readonly { id: string; symbol: string }[] }
  /** Imported symbol ids. */
  allowed: readonly string[]
}

/**
 * The model's raw text → a validated InstructResponse. Pure. Tags (or raw
 * ids) resolve to page ids; ops on unknown items, symbols outside the
 * imported vocabulary and params a symbol does not have are dropped;
 * numbers are coerced, fold clamped, scale kept positive.
 */
export const parseInstructReply = (text: string, ctx: InstructContext): InstructResponse => {
  let raw: unknown
  try {
    raw = JSON.parse(stripFences(text))
  } catch {
    return { ops: [], reply: "", error: `unparseable reply: ${text.slice(0, 200)}` }
  }
  if (!raw || typeof raw !== "object") return { ops: [], reply: "", error: "reply is not an object" }
  const obj = raw as { ops?: unknown; reply?: unknown }
  const reply = typeof obj.reply === "string" ? obj.reply.trim() : ""

  const byKey = new Map<string, string>()
  for (const k of ctx.board.strokes) byKey.set(k.id.toLowerCase(), k.id)
  for (const y of ctx.board.symbols) byKey.set(y.id.toLowerCase(), y.id)
  for (const [id, tag] of Object.entries(ctx.labels)) if (byKey.has(id.toLowerCase())) byKey.set(tag.toLowerCase(), id)
  const resolve = (v: unknown): string | undefined => (typeof v === "string" ? byKey.get(v.trim().toLowerCase()) : undefined)
  const strokeIds = new Set(ctx.board.strokes.map((k) => k.id))
  const symbolOf = new Map(ctx.board.symbols.map((y) => [y.id, y.symbol]))
  const entryOf = (v: unknown): VocabEntry | undefined => {
    const e = typeof v === "string" ? vocabById(v) : undefined
    return e && ctx.allowed.includes(e.id) ? e : undefined
  }

  const list = Array.isArray(obj.ops) ? obj.ops : []
  const ops: EditOp[] = []
  for (const o of list) {
    if (!o || typeof o !== "object") continue
    const r = o as Record<string, unknown>
    switch (r.op) {
      case "update": {
        const id = resolve(r.id)
        const current = id ? symbolOf.get(id) : undefined
        if (!id || !current) break
        const turned = r.symbol !== undefined && r.symbol !== current ? entryOf(r.symbol) : undefined
        if (r.symbol !== undefined && r.symbol !== current && !turned) break
        const entry = turned ?? vocabById(current)
        if (!entry) break
        const params = coerceParams(entry, r.params)
        if (!turned && Object.keys(params).length === 0) break
        ops.push(turned ? { op: "update", id, symbol: turned.id, params } : { op: "update", id, params })
        break
      }
      case "add": {
        const entry = entryOf(r.symbol)
        if (entry) ops.push({ op: "add", symbol: entry.id, params: coerceParams(entry, r.params) })
        break
      }
      case "remove": {
        const id = resolve(r.id)
        if (id) ops.push({ op: "remove", id })
        break
      }
      case "replaceStrokes": {
        const entry = entryOf(r.symbol)
        const given = Array.isArray(r.strokeIds) ? r.strokeIds : Array.isArray(r.ids) ? r.ids : []
        const ids = [...new Set(given.map(resolve).filter((id): id is string => !!id && strokeIds.has(id)))]
        if (entry && ids.length) ops.push({ op: "replaceStrokes", strokeIds: ids, symbol: entry.id, params: coerceParams(entry, r.params) })
        break
      }
      case "transform": {
        const ids = [...new Set((Array.isArray(r.ids) ? r.ids : []).map(resolve).filter((id): id is string => !!id))]
        if (ids.length === 0) break
        const op: Extract<EditOp, { op: "transform" }> = { op: "transform", ids }
        const translate = readPt(r.translate)
        if (translate) op.translate = translate
        const rotate = Number(r.rotate)
        if (r.rotate !== undefined && Number.isFinite(rotate)) op.rotate = rotate
        const scale = Number(r.scale)
        if (r.scale !== undefined && Number.isFinite(scale) && scale > 0) op.scale = Math.min(50, Math.max(0.02, scale))
        const pivot = readPt(r.pivot)
        if (pivot) op.pivot = pivot
        if (op.translate || op.rotate || op.scale) ops.push(op)
        break
      }
    }
  }
  const res: InstructResponse = { ops, reply }
  if (list.length > 0 && ops.length === 0) res.error = "none of the edits named something on the page"
  return res
}

// --- The call ---------------------------------------------------------------------

export async function instruct(req: InstructRequest): Promise<InstructResponse> {
  const started = performance.now()
  try {
    const wanted = req.vocabulary ?? DEFAULT_IMPORTS
    // A symbol imported from the shelf is described in its own words.
    await describeShelf(repoRoot)
    const entries = wanted.map(vocabById).filter((e): e is VocabEntry => !!e)
    const b64 = req.png.replace(/^data:image\/png;base64,/, "")
    const size = pngSize(Uint8Array.from(Buffer.from(b64, "base64")))
    // The recognizer's backends (backends.ts): fast eyes when a key is set,
    // else the CLI's lean session exactly as before.
    // The magic switch picks the reader; geometry and clef read no instructions (→ the chain).
    const chosen = req.backend && req.backend !== "auto" ? eyesFor(req.backend)?.chain : undefined
    const { reply, failures } = await askChain(chosen?.length ? chosen : backendChain(), {
      system: SYSTEM,
      pngs: [b64],
      tag: "page",
      timeoutMs: TIMEOUT_MS,
      maxTokens: 4096,
      prompt: (paths) => buildInstructPrompt(req, paths?.[0], size, entries),
    })
    if (!reply) return { ops: [], reply: "", error: failures.join("; ") || "no backend answered" }
    const meta = reply
    const res = parseInstructReply(reply.text, {
      labels: req.labels ?? {},
      board: req.board,
      allowed: entries.map((e) => e.id),
    })
    console.log(
      `[instruct] ${((performance.now() - started) / 1000).toFixed(1)}s · ${meta.backend}:${meta.model}${meta.turns ? ` · ${meta.turns} turns` : ""}${meta.cost !== undefined ? ` · $${meta.cost.toFixed(3)}` : ""} · "${req.transcript}" → ` +
        (res.ops.map((o) => o.op).join(", ") || res.error || "no ops") + (res.reply ? ` — ${res.reply}` : ""),
    )
    return res
  } catch (err) {
    return { ops: [], reply: "", error: String((err as Error)?.message ?? err) }
  }
}
