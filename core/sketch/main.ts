/**
 * The sketchpad page — the surface David draws on.
 *
 * Two layers over one page rectangle (protocol.ts: 1404 × 1872, y down):
 *
 *   - SYMBOLS: a ThreeHost canvas rendering every placed symbol through
 *     vocabulary.ts's buildSymbol. Rebuilt (a fresh canvas, swapped in when
 *     it has rendered) whenever the symbol list changes — reliable and
 *     simple, and the page rarely holds more than a handful.
 *   - INK: a 2D canvas on top for strokes, the live stroke, the lasso, the
 *     selection and the options ring's guide. Redrawn whole on each change;
 *     instant at sketch scale.
 *
 * Input from the browser's pointer and from the reMarkable (over /ws/pen)
 * is normalised to the protocol's PenEvent and fed to ONE handler, so the
 * pen and the mouse are the same instrument. The side button is emulated
 * in the browser by SHIFT or the secondary button.
 *
 *   button up   + drag            → ink
 *   button held + drag            → lasso (drag starting inside the selection → move it)
 *   button held + tap on a thing  → select it
 *   button held + tap IN the selection, Enter, or ✦ → TRANSFORM ("make it real")
 *   eraser end                    → erase strokes touched
 */

import { Dream } from "../src/dream"
import { Create } from "../src/verbs"
import type { Holon } from "../src/holon"
import { ThreeHost } from "../src/render/three-host"
import { VOCABULARY, buildSymbol } from "./vocabulary"
import {
  PAGE_H,
  PAGE_W,
  type Candidate,
  type InkStroke,
  type PenEvent,
  type PenSample,
  type PlacedSymbol,
  type RecognizeRequest,
  type RecognizeResponse,
} from "./protocol"
import {
  History,
  boxCenter,
  boxOfPoints,
  hitTest,
  inBox,
  lassoSelect,
  newId,
  pruneSelection,
  selectionBox,
  strokesNear,
  symbolBox,
  translateStroke,
  unionBox,
  type Box,
  type Command,
  type Pt,
  type SketchState,
} from "./state"

// --- DOM ----------------------------------------------------------------------

const pageEl = document.getElementById("page") as HTMLDivElement
const ink = document.getElementById("ink") as HTMLCanvasElement
const ringEl = document.getElementById("ring") as HTMLDivElement
const statusEl = document.getElementById("status") as HTMLSpanElement
const importsEl = document.getElementById("imports") as HTMLSpanElement
const btn = (id: string) => document.getElementById(id) as HTMLButtonElement
const ctx = ink.getContext("2d")!

// --- Persistence ----------------------------------------------------------------

const STORE_KEY = "dreamtalk.sketch.page.v1"
const THEME_KEY = "dreamtalk.sketch.dark"

const loadState = (): SketchState => {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as SketchState
      if (Array.isArray(s.strokes) && Array.isArray(s.symbols)) return s
    }
  } catch {
    // a blocked or corrupt store is an empty page, never a broken one
  }
  return { strokes: [], symbols: [] }
}

const saveState = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(history.state))
  } catch {
    // ignore
  }
}

let dark = true
try {
  dark = localStorage.getItem(THEME_KEY) !== "0"
} catch {
  // default dark
}

// --- Page state -----------------------------------------------------------------

const history = new History(loadState())
let selection = new Set<string>()

interface Pending {
  ids: string[]
  box: Box
  started: number
}
/** A recognition in flight. */
let thinking: Pending | undefined

interface LastResponse {
  ids: string[]
  box: Box
  response: RecognizeResponse
}
let last: LastResponse | undefined

interface Chip {
  candidate: Candidate
  /** page units */
  x: number
  y: number
  el: HTMLDivElement
  host?: ThreeHost
}
interface Ring {
  ids: string[]
  center: Pt
  radius: number
  chipPage: number
  chips: Chip[]
}
let ring: Ring | undefined

// Gesture state
type Mode = "idle" | "draw" | "lasso" | "pressSel" | "move" | "erase"
let mode: Mode = "idle"
let live: PenSample[] = []
let lasso: Pt[] = []
let pressStart: Pt | undefined
let moveDelta: Pt = { x: 0, y: 0 }
let erased = new Set<string>()
let hover: { p: Pt; button: boolean; at: number } | undefined

// --- Layout -----------------------------------------------------------------------

const TOOLBAR_H = 44
let scale = 1 // css px per page unit
let dpr = window.devicePixelRatio || 1

const layout = () => {
  const availW = window.innerWidth - 32
  const availH = window.innerHeight - TOOLBAR_H - 24
  scale = Math.min(availW / PAGE_W, availH / PAGE_H)
  const w = PAGE_W * scale
  const h = PAGE_H * scale
  pageEl.style.width = `${w}px`
  pageEl.style.height = `${h}px`
  pageEl.style.left = `${(window.innerWidth - w) / 2}px`
  pageEl.style.top = `${TOOLBAR_H + (availH + 24 - h) / 2}px`
  dpr = window.devicePixelRatio || 1
  ink.width = Math.round(w * dpr)
  ink.height = Math.round(h * dpr)
  ink.style.width = `${w}px`
  ink.style.height = `${h}px`
}

/** css px within the page → page units */
const toPage = (clientX: number, clientY: number): Pt => {
  const r = pageEl.getBoundingClientRect()
  return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale }
}

// --- Theme ------------------------------------------------------------------------

const applyTheme = () => {
  document.documentElement.dataset.theme = dark ? "dark" : "light"
  btn("theme").textContent = dark ? "◐ dark" : "◑ light"
  try {
    localStorage.setItem(THEME_KEY, dark ? "1" : "0")
  } catch {
    // ignore
  }
  drawInk()
}

const inkColor = () => (dark ? "#f2f2f2" : "#111")
const accent = "#00a2ff"

// --- Symbols layer (ThreeHost) -----------------------------------------------------

/** A dream that stages the page's symbols, observed straight on so scene
 *  (x, −y) lands on page (x, y). The host is always 16:9; its canvas is
 *  sized to the page's HEIGHT and centred, the page container clipping the
 *  sides — so the vertical framing is exact and nothing is stretched. */
class SymbolsDream extends Dream {
  constructor(
    private readonly placed: readonly PlacedSymbol[],
    frame: { cx: number; cy: number; h: number },
    private readonly fresh?: string,
  ) {
    super()
    const o = this.observer
    o.x.defaultValue = o.x.value = frame.cx
    o.y.defaultValue = o.y.value = -frame.cy
    // The default vertical fov is 53.13°, tan(fov/2) = 0.5, so distance = height.
    const r = frame.h / (2 * Math.tan(o.fov.value / 2))
    o.radius.defaultValue = o.radius.value = r
  }

  unfold() {
    for (const s of this.placed) {
      let h: Holon
      try {
        h = buildSymbol(s)
      } catch (err) {
        console.warn("[sketch] cannot build", s.symbol, err)
        continue
      }
      if (s.id === this.fresh) this.play(Create(h), 0.9)
      else this.stage(h)
    }
  }
}

const glCanvasOf = (cssW: number, cssH: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas")
  canvas.className = "gl"
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  return canvas
}

let glHost: ThreeHost | undefined
let glCanvas: HTMLCanvasElement | undefined
let glBusy = false
let glAgain: { fresh?: string } | undefined
let glSignature = ""

const symbolsSignature = () => JSON.stringify(history.state.symbols) + `|${scale}|${dpr}`

/** Rebuild the symbol layer if what it shows changed. Serialised: a request
 *  during a rebuild is coalesced into one more after it. */
const syncSymbols = async (fresh?: string): Promise<void> => {
  if (glBusy) {
    glAgain = { fresh: fresh ?? glAgain?.fresh }
    return
  }
  const sig = symbolsSignature()
  if (sig === glSignature && glHost) return
  glBusy = true
  try {
    const h = PAGE_H * scale
    const w = (h * 16) / 9
    const dream = new SymbolsDream(history.state.symbols, { cx: PAGE_W / 2, cy: PAGE_H / 2, h: PAGE_H }, fresh)
    const canvas = glCanvasOf(w, h)
    canvas.style.left = `${(PAGE_W * scale - w) / 2}px`
    // Mount needs the canvas in the document to know its size.
    canvas.style.visibility = "hidden"
    pageEl.insertBefore(canvas, ink)
    const host = await ThreeHost.mount(dream, canvas)
    host.renderer.setPixelRatio(dpr)
    host.renderer.setSize(w, h, false)
    await host.renderFrame(0)
    await host.renderFrame(0)
    canvas.style.visibility = "visible"
    const old = glCanvas
    const oldHost = glHost
    glCanvas = canvas
    glHost = host
    glSignature = sig
    old?.remove()
    oldHost?.dispose()
    // Draw the fresh symbol on, if there is one to draw.
    const duration = dream.duration
    if (duration > 0) {
      const t0 = performance.now()
      const tick = async () => {
        if (glHost !== host) return
        const t = Math.min(duration, (performance.now() - t0) / 1000)
        await host.renderFrame(t)
        if (t < duration) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
  } catch (err) {
    console.error("[sketch] symbol layer failed", err)
    flash(`render failed: ${(err as Error).message}`)
  } finally {
    glBusy = false
    if (glAgain) {
      const next = glAgain
      glAgain = undefined
      void syncSymbols(next.fresh)
    }
  }
}

// --- Ink layer ----------------------------------------------------------------------

const strokeWidth = (p: PenSample) => 2.2 + 3.2 * Math.min(1, Math.max(0, p.pressure || 0.5))

const drawStroke = (c: CanvasRenderingContext2D, pts: readonly PenSample[], k: number, color: string, extra = 0) => {
  c.strokeStyle = color
  c.fillStyle = color
  c.lineCap = "round"
  c.lineJoin = "round"
  if (pts.length === 1) {
    const p = pts[0]!
    c.beginPath()
    c.arc(p.x * k, p.y * k, ((strokeWidth(p) + extra) * k) / 2, 0, Math.PI * 2)
    c.fill()
    return
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    c.lineWidth = Math.max(1, ((strokeWidth(a) + strokeWidth(b)) / 2 + extra) * k)
    c.beginPath()
    c.moveTo(a.x * k, a.y * k)
    c.lineTo(b.x * k, b.y * k)
    c.stroke()
  }
}

const dashedBox = (b: Box, k: number, color: string, pad: number, dash: number[], offset = 0) => {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.2 * dpr
  ctx.setLineDash(dash.map((d) => d * dpr))
  ctx.lineDashOffset = offset
  const r = 10 * dpr
  const x = (b.x - pad) * k
  const y = (b.y - pad) * k
  const w = (b.w + 2 * pad) * k
  const h = (b.h + 2 * pad) * k
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.stroke()
  ctx.restore()
}

let inkQueued = false
const drawInk = () => {
  if (inkQueued) return
  inkQueued = true
  requestAnimationFrame(() => {
    inkQueued = false
    paintInk()
  })
}

const paintInk = () => {
  const k = scale * dpr
  ctx.clearRect(0, 0, ink.width, ink.height)
  const s = history.state
  const busy = new Set(thinking?.ids ?? [])
  for (const stroke of s.strokes) {
    const sel = selection.has(stroke.id)
    let pts = stroke.points
    if (sel && mode === "move") pts = translateStroke(stroke, moveDelta.x, moveDelta.y).points
    if (sel) {
      // a soft halo under selected ink
      ctx.save()
      ctx.globalAlpha = 0.3
      drawStroke(ctx, pts, k, accent, 9)
      ctx.restore()
      ctx.save()
      ctx.globalAlpha = busy.has(stroke.id) ? 0.55 + 0.35 * Math.sin(performance.now() / 260) : 1
      drawStroke(ctx, pts, k, inkColor())
      ctx.restore()
    } else {
      ctx.save()
      if (erased.has(stroke.id)) ctx.globalAlpha = 0.2
      drawStroke(ctx, pts, k, inkColor())
      ctx.restore()
    }
  }
  // selected symbols: a dashed frame around each
  for (const y of s.symbols) {
    if (!selection.has(y.id)) continue
    const b = symbolBox(y)
    const shifted = mode === "move" ? { ...b, x: b.x + moveDelta.x, y: b.y + moveDelta.y } : b
    dashedBox(shifted, k, accent, 10, [5, 5])
  }
  // the selection's frame
  const sb = selectionBox(s, selection)
  if (sb && selection.size > 0 && !thinking) {
    const b = mode === "move" ? { ...sb, x: sb.x + moveDelta.x, y: sb.y + moveDelta.y } : sb
    dashedBox(b, k, dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.25)", 26, [2, 6])
  }
  // thinking: a slow marching frame
  if (thinking) {
    dashedBox(thinking.box, k, accent, 26, [6, 8], -(performance.now() / 40) % 1000)
  }
  // live stroke
  if (mode === "draw" && live.length) drawStroke(ctx, live, k, inkColor())
  // lasso
  if (mode === "lasso" && lasso.length > 1) {
    ctx.save()
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.5 * dpr
    ctx.setLineDash([6 * dpr, 6 * dpr])
    ctx.beginPath()
    ctx.moveTo(lasso[0]!.x * k, lasso[0]!.y * k)
    for (const p of lasso) ctx.lineTo(p.x * k, p.y * k)
    ctx.closePath()
    ctx.globalAlpha = 0.08
    ctx.fillStyle = accent
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.stroke()
    ctx.restore()
  }
  // the ring's guide circle
  if (ring) {
    ctx.save()
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"
    ctx.lineWidth = 1 * dpr
    ctx.beginPath()
    ctx.arc(ring.center.x * k, ring.center.y * k, ring.radius * k, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  // the tablet pen's hover cursor (the browser draws its own)
  if (hover && performance.now() - hover.at < 1500) {
    ctx.save()
    ctx.strokeStyle = hover.button ? accent : dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"
    ctx.lineWidth = 1.5 * dpr
    ctx.beginPath()
    ctx.arc(hover.p.x * k, hover.p.y * k, 7 * dpr, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  if (thinking) drawInk() // keep the frame marching
}

// --- Commands -----------------------------------------------------------------------

const commit = (cmd: Command, fresh?: string) => {
  history.do(cmd)
  afterChange(fresh)
}

const afterChange = (fresh?: string) => {
  selection = pruneSelection(history.state, selection)
  saveState()
  updateButtons()
  drawInk()
  void syncSymbols(fresh)
}

const updateButtons = () => {
  btn("undo").disabled = !history.canUndo
  btn("redo").disabled = !history.canRedo
  btn("transform").disabled = !!thinking || selectedStrokes().length === 0
}

const selectedStrokes = (): InkStroke[] => history.state.strokes.filter((k) => selection.has(k.id))

const setSelection = (ids: Iterable<string>) => {
  selection = pruneSelection(history.state, ids)
  updateButtons()
  drawInk()
}

const undo = () => {
  closeRing()
  const cmd = history.undo()
  if (!cmd) return
  // Restore what the step took away as the selection, so the next move
  // (a different pick, a re-ask) has its subject in hand.
  if (cmd.kind === "replace" || cmd.kind === "delete" || cmd.kind === "erase") selection = new Set(cmd.ids)
  else if (cmd.kind === "move") selection = new Set(cmd.ids)
  else selection = new Set()
  afterChange()
  if (cmd.kind === "replace" && last && sameIds(last.ids, cmd.ids) && last.response.candidates.length > 1) openRing(last)
}

const redo = () => {
  closeRing()
  const cmd = history.redo()
  if (!cmd) return
  selection = cmd.kind === "move" ? new Set(cmd.ids) : new Set()
  afterChange(cmd.kind === "replace" ? cmd.symbol.id : undefined)
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

const deleteSelection = () => {
  if (selection.size === 0) return
  commit({ kind: "delete", ids: [...selection] })
  selection = new Set()
  drawInk()
}

const clearPage = () => {
  if (history.state.strokes.length === 0 && history.state.symbols.length === 0) return
  closeRing()
  selection = new Set()
  commit({ kind: "clear" })
}

// --- Status ------------------------------------------------------------------------

let flashTimer: ReturnType<typeof setTimeout> | undefined
const flash = (msg: string, ms = 4000) => {
  statusEl.textContent = msg
  statusEl.classList.add("on")
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => statusEl.classList.remove("on"), ms)
}
const say = (msg: string) => {
  if (flashTimer) clearTimeout(flashTimer)
  statusEl.textContent = msg
  statusEl.classList.toggle("on", msg !== "")
}

// --- Transform: pixels in, vocabulary out ----------------------------------------------

/** The selected ink as the model sees it: dark on white, cropped + margin. */
export const renderCrop = (strokes: readonly InkStroke[]): { png: string; crop: Box } => {
  const b = boxOfPoints(strokes.flatMap((k) => k.points))!
  const margin = 32
  const crop = { x: b.x - margin, y: b.y - margin, w: b.w + 2 * margin, h: b.h + 2 * margin }
  const k = Math.min(1, 768 / Math.max(crop.w, crop.h))
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.round(crop.w * k))
  c.height = Math.max(1, Math.round(crop.h * k))
  const g = c.getContext("2d")!
  g.fillStyle = "#fff"
  g.fillRect(0, 0, c.width, c.height)
  g.translate(-crop.x * k, -crop.y * k)
  for (const s of strokes) drawStroke(g, s.points, Math.max(k, 0.5), "#000")
  return { png: c.toDataURL("image/png").split(",")[1]!, crop }
}

type Recognizer = (req: RecognizeRequest) => Promise<RecognizeResponse>

const httpRecognize: Recognizer = async (req) => {
  const res = await fetch("/api/recognize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  })
  const text = await res.text()
  let body: RecognizeResponse
  try {
    body = JSON.parse(text) as RecognizeResponse
  } catch {
    return { candidates: [], error: res.ok ? "unreadable answer" : `recognizer ${res.status}: ${text.slice(0, 80)}` }
  }
  if (!res.ok && !body.error) body.error = `recognizer ${res.status}`
  return body
}

let recognize: Recognizer = httpRecognize

const transform = async (): Promise<void> => {
  if (thinking) return
  const strokes = selectedStrokes()
  if (strokes.length === 0) {
    flash("select some ink first (shift-drag a lasso)")
    return
  }
  const ids = strokes.map((k) => k.id)
  // A multi-reading we already have for exactly this ink: show it again
  // rather than asking twice. Asked again from an OPEN ring → re-ask.
  if (!ring && last && sameIds(last.ids, ids) && last.response.candidates.length > 1) {
    openRing(last)
    return
  }
  closeRing()
  const box = boxOfPoints(strokes.flatMap((k) => k.points))!
  thinking = { ids, box, started: performance.now() }
  updateButtons()
  say("thinking…")
  drawInk()
  let response: RecognizeResponse
  try {
    const { png, crop } = renderCrop(strokes)
    response = await recognize({ png, crop, strokes, vocabulary: VOCABULARY.map((e) => e.id) })
  } catch (err) {
    response = { candidates: [], error: (err as Error).message || "recognizer unreachable" }
  }
  thinking = undefined
  updateButtons()
  drawInk()
  const known = new Set(VOCABULARY.map((e) => e.id))
  const candidates = (response.candidates ?? []).filter((c) => known.has(c.symbol))
  response = { ...response, candidates: [...candidates].sort((a, b) => b.confidence - a.confidence) }
  last = { ids, box, response }
  if (response.error && candidates.length === 0) {
    flash(response.error)
    return
  }
  if (candidates.length === 0) {
    flash(response.notes ? `no symbol — ${response.notes}` : "no symbol recognised")
    return
  }
  // The ink may have changed while the model looked.
  const live = new Set(history.state.strokes.map((k) => k.id))
  if (!ids.every((id) => live.has(id))) {
    flash("the ink changed while thinking — try again")
    return
  }
  // One CLEAR reading replaces at once — a lone candidate, or one that
  // dominates the rest. The others stay in `last`: undo reopens them as a ring.
  const [top, second] = response.candidates
  const clear = !second || (top!.confidence >= 0.75 && top!.confidence >= 3 * second.confidence)
  if (clear) {
    say("")
    choose(ids, top!)
  } else {
    say("")
    openRing(last)
  }
}

const choose = (ids: string[], c: Candidate) => {
  closeRing()
  const symbol: PlacedSymbol = { id: newId("sym"), symbol: c.symbol, params: c.params, fromStrokes: ids }
  selection = new Set()
  commit({ kind: "replace", ids, symbol }, symbol.id)
  const name = VOCABULARY.find((e) => e.id === c.symbol)?.name ?? c.symbol
  flash(`${name}${c.why ? ` — ${c.why}` : ""}`, 3500)
}

// --- The options ring ----------------------------------------------------------------

const CHIP_CSS = 112

const openRing = (from: LastResponse) => {
  closeRing()
  const cands = from.response.candidates
  const n = cands.length
  const chipPage = CHIP_CSS / scale
  const half = Math.hypot(from.box.w, from.box.h) / 2
  const radius = Math.max(half + chipPage * 0.75, (chipPage * 0.62) / Math.sin(Math.PI / Math.max(n, 2)))
  // Shift the whole ring (never single chips) to keep it on the page —
  // equidistance is the promise.
  const c = boxCenter(from.box)
  const lim = radius + chipPage / 2 + 8
  const center = {
    x: PAGE_W > 2 * lim ? Math.min(PAGE_W - lim, Math.max(lim, c.x)) : PAGE_W / 2,
    y: PAGE_H > 2 * lim ? Math.min(PAGE_H - lim, Math.max(lim, c.y)) : PAGE_H / 2,
  }
  const chips: Chip[] = cands.map((candidate, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    const x = center.x + radius * Math.cos(a)
    const y = center.y + radius * Math.sin(a)
    const el = document.createElement("div")
    el.className = "chip"
    el.style.left = `${x * scale}px`
    el.style.top = `${y * scale}px`
    el.style.width = el.style.height = `${CHIP_CSS}px`
    el.title = candidate.why ?? ""
    const name = VOCABULARY.find((e) => e.id === candidate.symbol)?.name ?? candidate.symbol
    el.innerHTML = `<div class="thumb"></div><div class="label"><b></b><span></span></div>`
    el.querySelector("b")!.textContent = name
    el.querySelector("span")!.textContent = `${Math.round((candidate.confidence ?? 0) * 100)}%`
    el.style.animationDelay = `${i * 40}ms`
    ringEl.appendChild(el)
    return { candidate, x, y, el }
  })
  ring = { ids: from.ids, center, radius, chipPage, chips }
  selection = new Set(from.ids)
  updateButtons()
  drawInk()
  void renderThumbs(ring, from.box)
}

/** Each candidate drawn small inside its chip — the symbol itself, framed
 *  on the selection, so the choice is between pictures, not names. */
const renderThumbs = async (r: Ring, box: Box) => {
  for (const chip of r.chips) {
    if (ring !== r) return
    try {
      const placed: PlacedSymbol = { id: "thumb", symbol: chip.candidate.symbol, params: chip.candidate.params, fromStrokes: [] }
      const fb = unionBox([box, symbolBox(placed)])!
      const fc = boxCenter(fb)
      const cssH = CHIP_CSS * 0.58
      const cssW = (cssH * 16) / 9
      const dream = new SymbolsDream([placed], { cx: fc.x, cy: fc.y, h: Math.max(fb.w, fb.h) * 1.12 })
      const canvas = glCanvasOf(cssW, cssH)
      canvas.style.visibility = "hidden"
      chip.el.querySelector(".thumb")!.appendChild(canvas)
      const host = await ThreeHost.mount(dream, canvas)
      host.renderer.setPixelRatio(dpr)
      host.renderer.setSize(cssW, cssH, false)
      await host.renderFrame(0)
      await host.renderFrame(0)
      if (ring !== r) {
        host.dispose()
        return
      }
      canvas.style.visibility = "visible"
      chip.host = host
      chip.el.classList.add("drawn")
    } catch (err) {
      console.warn("[sketch] thumbnail failed", err)
    }
  }
}

const closeRing = () => {
  if (!ring) return
  for (const c of ring.chips) {
    c.host?.dispose()
    c.el.remove()
  }
  ring = undefined
  drawInk()
}

const chipAt = (p: Pt): Chip | undefined => {
  if (!ring) return undefined
  for (const c of ring.chips) if (Math.hypot(p.x - c.x, p.y - c.y) <= ring.chipPage / 2) return c
  return undefined
}

// --- The one pen handler ------------------------------------------------------------

const TAP = 12 // page units of travel that still count as a tap

const pathLength = (pts: readonly Pt[]) => {
  let d = 0
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
  return d
}

const handlePen = (ev: PenEvent, source: "pointer" | "tablet") => {
  const p = { x: ev.sample.x, y: ev.sample.y }
  if (ev.kind === "hover" || ev.kind === "button") {
    if (source === "tablet") {
      hover = { p, button: ev.kind === "button" ? ev.pressed : ev.button, at: performance.now() }
      drawInk()
    }
    return
  }
  if (source === "tablet") hover = { p, button: ev.button, at: performance.now() }

  if (ev.kind === "down") {
    // The ring takes the first touch: a chip picks, anywhere else dismisses.
    if (ring) {
      const chip = chipAt(p)
      if (chip) {
        choose(ring.ids, chip.candidate)
        mode = "idle"
        return
      }
      closeRing()
    }
    if (ev.eraser) {
      mode = "erase"
      erased = new Set(strokesNear(history.state, p, 10))
    } else if (ev.button) {
      pressStart = p
      const sb = selectionBox(history.state, selection)
      if (selection.size > 0 && sb && inBox(p, sb, 26)) {
        mode = "pressSel"
        moveDelta = { x: 0, y: 0 }
      } else {
        mode = "lasso"
        lasso = [p]
      }
    } else {
      mode = "draw"
      live = [ev.sample]
      if (selection.size) selection = new Set()
      updateButtons()
    }
    drawInk()
    return
  }

  if (ev.kind === "move") {
    switch (mode) {
      case "draw":
        live.push(ev.sample)
        break
      case "lasso":
        lasso.push(p)
        break
      case "pressSel":
        if (pressStart && Math.hypot(p.x - pressStart.x, p.y - pressStart.y) > TAP) mode = "move"
        if (mode !== "move") break
      // falls through
      case "move":
        moveDelta = { x: p.x - pressStart!.x, y: p.y - pressStart!.y }
        break
      case "erase":
        for (const id of strokesNear(history.state, p, 10)) erased.add(id)
        break
    }
    drawInk()
    return
  }

  // up
  const was = mode
  mode = "idle"
  switch (was) {
    case "draw": {
      live.push(ev.sample)
      const stroke: InkStroke = { id: newId("ink"), points: live }
      live = []
      commit({ kind: "addStroke", stroke })
      break
    }
    case "lasso": {
      const pts = lasso
      lasso = []
      if (pathLength(pts) < TAP * 2) {
        // a tap: select what's under it (or nothing)
        const id = hitTest(history.state, p)
        setSelection(id ? [id] : [])
      } else {
        setSelection(lassoSelect(history.state, pts))
      }
      break
    }
    case "pressSel":
      // a button-held tap INSIDE the selection: make it real
      drawInk()
      void transform()
      break
    case "move": {
      const d = moveDelta
      moveDelta = { x: 0, y: 0 }
      if (Math.hypot(d.x, d.y) > 0.5) commit({ kind: "move", ids: [...selection], dx: d.x, dy: d.y })
      else drawInk()
      break
    }
    case "erase": {
      const ids = [...erased]
      erased = new Set()
      if (ids.length) commit({ kind: "erase", ids })
      else drawInk()
      break
    }
    default:
      drawInk()
  }
}

// --- Browser pointer → PenEvent ------------------------------------------------------

let pointerT0 = performance.now()
const sampleOf = (e: PointerEvent): PenSample => {
  const p = toPage(e.clientX, e.clientY)
  return { x: p.x, y: p.y, pressure: e.pointerType === "mouse" ? (e.buttons ? 0.5 : 0) : e.pressure, t: e.timeStamp - pointerT0 }
}
const buttonOf = (e: PointerEvent) => e.shiftKey || (e.buttons & 2) !== 0 || e.button === 2
const eraserOf = (e: PointerEvent) => e.pointerType === "pen" && ((e.buttons & 32) !== 0 || e.button === 5)

let activePointer: number | undefined
ink.addEventListener("pointerdown", (e) => {
  if (activePointer !== undefined) return
  activePointer = e.pointerId
  ink.setPointerCapture(e.pointerId)
  e.preventDefault()
  handlePen({ kind: "down", sample: sampleOf(e), button: buttonOf(e), eraser: eraserOf(e) }, "pointer")
})
ink.addEventListener("pointermove", (e) => {
  if (e.pointerId !== activePointer) return
  const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : []
  for (const ce of events.length ? events : [e])
    handlePen({ kind: "move", sample: sampleOf(ce), button: buttonOf(e), eraser: eraserOf(e) }, "pointer")
})
const pointerEnd = (e: PointerEvent) => {
  if (e.pointerId !== activePointer) return
  activePointer = undefined
  handlePen({ kind: "up", sample: sampleOf(e), button: buttonOf(e), eraser: eraserOf(e) }, "pointer")
}
ink.addEventListener("pointerup", pointerEnd)
ink.addEventListener("pointercancel", pointerEnd)
ink.addEventListener("contextmenu", (e) => e.preventDefault())

// --- reMarkable over /ws/pen ------------------------------------------------------------

const isPenEvent = (v: unknown): v is PenEvent =>
  typeof v === "object" && v !== null && typeof (v as { kind?: unknown }).kind === "string" &&
  typeof (v as { sample?: unknown }).sample === "object"

let penSocketUp = false
const connectPen = (delay = 1000) => {
  let ws: WebSocket
  try {
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/pen`)
  } catch {
    setTimeout(() => connectPen(Math.min(delay * 2, 15000)), delay)
    return
  }
  ws.onopen = () => {
    penSocketUp = true
    delay = 1000
    document.body.classList.add("tablet")
  }
  ws.onmessage = (m) => {
    let v: unknown
    try {
      v = JSON.parse(String(m.data))
    } catch {
      return
    }
    const list = Array.isArray(v) ? v : [(v as { event?: unknown })?.event ?? v]
    for (const e of list) if (isPenEvent(e)) handlePen(e, "tablet")
  }
  ws.onclose = () => {
    penSocketUp = false
    document.body.classList.remove("tablet")
    setTimeout(() => connectPen(Math.min(delay * 2, 15000)), delay)
  }
  ws.onerror = () => {
    // onclose follows; reconnect quietly from there
  }
}

// --- Keys & toolbar ---------------------------------------------------------------------

window.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey
  if (meta && e.key.toLowerCase() === "z") {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
  } else if (meta && e.key.toLowerCase() === "y") {
    e.preventDefault()
    redo()
  } else if (e.key === "Enter") {
    e.preventDefault()
    void transform()
  } else if (e.key === "Escape") {
    if (ring) closeRing()
    else setSelection([])
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault()
    closeRing()
    deleteSelection()
  }
})

btn("transform").addEventListener("click", () => void transform())
btn("undo").addEventListener("click", undo)
btn("redo").addEventListener("click", redo)
btn("theme").addEventListener("click", () => {
  dark = !dark
  applyTheme()
})
btn("clear").addEventListener("click", clearPage)
document.querySelectorAll("#toolbar button").forEach((b) => b.addEventListener("pointerdown", (e) => e.preventDefault()))

importsEl.textContent = VOCABULARY.map((e) => e.id).join(" · ")
importsEl.title = VOCABULARY.map((e) => `${e.name} — ${e.description}`).join("\n\n")

window.addEventListener("resize", () => {
  closeRing()
  layout()
  drawInk()
  void syncSymbols()
})

// --- Test hooks ----------------------------------------------------------------------------

declare global {
  interface Window {
    __sketch?: Record<string, unknown>
  }
}

window.__sketch = {
  ready: false,
  state: () => history.state,
  selection: () => [...selection],
  injectStroke: (points: { x: number; y: number; pressure?: number }[]) => {
    const stroke: InkStroke = {
      id: newId("ink"),
      points: points.map((p, i) => ({ x: p.x, y: p.y, pressure: p.pressure ?? 0.5, t: i * 8 })),
    }
    commit({ kind: "addStroke", stroke })
    return stroke.id
  },
  select: (ids: string[]) => setSelection(ids),
  transform: () => transform(),
  undo,
  redo,
  lastResponse: () => last?.response,
  /** Replace the recognizer: a fixed response, a function, or null for the real one. */
  stubRecognize: (r: RecognizeResponse | Recognizer | null) => {
    recognize = r === null ? httpRecognize : typeof r === "function" ? r : async () => r
  },
  ring: () =>
    ring && {
      center: ring.center,
      radius: ring.radius,
      chips: ring.chips.map((c) => ({ symbol: c.candidate.symbol, x: c.x, y: c.y, drawn: !!c.host })),
    },
  pick: (i: number) => {
    const c = ring?.chips[i]
    if (ring && c) choose(ring.ids, c.candidate)
  },
  pen: (ev: PenEvent) => handlePen(ev, "tablet"),
  symbolsReady: () => !glBusy && !glAgain && glSignature === symbolsSignature(),
  tabletConnected: () => penSocketUp,
  setDark: (d: boolean) => {
    dark = d
    applyTheme()
  },
  clear: () => {
    closeRing()
    selection = new Set()
    history.do({ kind: "clear" })
    afterChange()
  },
}

// --- Boot ------------------------------------------------------------------------------------

layout()
applyTheme()
updateButtons()
drawInk()
connectPen()
void syncSymbols().then(() => {
  ;(window.__sketch as { ready: boolean }).ready = true
})
