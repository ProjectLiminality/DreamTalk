/**
 * The whiteboard — the DreamTalk editor's 2D layout workspace, the surface
 * David draws on (with the reMarkable as its pen).
 *
 * ONE SCENE, TWO WORKSPACES. The page is a BOARD (sketch/board.ts): a file
 * in the repo, core/demo/boards/<name>.board.json, saved through the
 * daemon after every committed change. The editor opens the very same
 * file as the scene `board:<name>` (demo/boards/Board.ts) and remounts
 * when it changes — layout here, camera/timeline/choreography there.
 * `/sketch/?board=<name>` picks a board (default `scratch`).
 *
 * Layers over one page rectangle (protocol.ts: 1404 × 1872, y down):
 *
 *   - SYMBOLS, twice: a ThreeHost canvas for the symbols at rest and one
 *     for the SELECTED symbols, so a live move/rotate/scale is a CSS
 *     transform of the lifted layer — exact for the flat page plane,
 *     instant, and rebuilt properly once the gesture commits.
 *   - INK: a 2D canvas on top for strokes, the live stroke, the lasso,
 *     the selection's frame, handles and ✦ chip, and the options ring.
 *
 * Input from the browser's pointer and from the reMarkable (over /ws/pen)
 * is normalised to the protocol's PenEvent and fed to ONE handler, so the
 * pen and the mouse are the same instrument. The side button is emulated
 * in the browser by SHIFT or the secondary button.
 *
 *   PEN TIP            always ink (the tablet shows its own notebook, not
 *                      this page — the tip must be predictable unseen);
 *                      the ✦ chip and the frame's handles are the only
 *                      things it can touch instead
 *   PEN BUTTON + drag  outside the selection → lasso; inside → move
 *   PEN BUTTON + tap   inside the selection → TRANSFORM ("make it real");
 *                      on a stroke/symbol → select it; on nothing → clear
 *   ✦ chip             (below the selection) tap/click → TRANSFORM
 *   corner handles     uniform scale about the opposite corner (Alt: centre)
 *   rotate knob        rotate about the centre (Shift snaps 15°)
 *   eraser end         erase strokes touched
 *   FINGERS            with a selection: pinch / twist / pan, live and
 *                      combined, ONE undo step on lift. Two-finger tap =
 *                      undo, three-finger tap = redo. Nothing else — no
 *                      camera on e-ink. Ignored while the pen is in range
 *                      and for 300 ms after it leaves (palm rejection).
 */

import { Dream } from "../src/dream"
import { Create } from "../src/verbs"
import type { Holon } from "../src/holon"
import { ThreeHost } from "../src/render/three-host"
import { VOCABULARY, buildSymbol, framePage } from "./vocabulary"
import { emptyBoard, isValidBoardName, parseBoard, serializeBoard } from "./board"
import {
  IDENTITY,
  SIM_IDENTITY,
  composeSim,
  isIdentity,
  simFromPairs,
  xfFromSim,
  xfPoint,
  type Sim,
  type Xf,
} from "./xform"
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
  transformStroke,
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
const presenceEl = document.getElementById("presence") as HTMLDivElement
const dotEl = document.getElementById("tabletdot") as HTMLSpanElement
const bannerEl = document.getElementById("banner") as HTMLDivElement
const boardInput = document.getElementById("board") as HTMLInputElement
const boardList = document.getElementById("boards") as HTMLDataListElement
const editorLink = document.getElementById("toeditor") as HTMLAnchorElement
const btn = (id: string) => document.getElementById(id) as HTMLButtonElement
const ctx = ink.getContext("2d")!

// --- The board: a file through the daemon, the browser only as a fallback ------

const THEME_KEY = "dreamtalk.sketch.dark"
/** The page as the sketchpad kept it before boards were files. */
const LEGACY_KEY = "dreamtalk.sketch.page.v1"
const localKey = (name: string) => `dreamtalk.board.${name}.v1`

const requested = new URLSearchParams(location.search).get("board") ?? "scratch"
const boardName = isValidBoardName(requested) ? requested : "scratch"

const readLocal = (key: string): SketchState | undefined => {
  try {
    const raw = localStorage.getItem(key)
    const b = raw ? parseBoard(JSON.parse(raw)) : undefined
    return b && (b.strokes.length || b.symbols.length) ? { strokes: b.strokes, symbols: b.symbols } : undefined
  } catch {
    // a blocked or corrupt store is no fallback, never a broken page
    return undefined
  }
}

/** Load the board: the file if the daemon has it; else this browser's copy. */
const loadBoard = async (): Promise<{ state: SketchState; migrate: boolean }> => {
  try {
    const res = await fetch(`/api/board/${encodeURIComponent(boardName)}`, { cache: "no-store" })
    if (res.ok) {
      const b = parseBoard(await res.json()) ?? emptyBoard()
      return { state: { strokes: b.strokes, symbols: b.symbols }, migrate: false }
    }
    if (res.status === 404) {
      // A new board — or one drawn before boards were files: bring it in.
      const local = readLocal(localKey(boardName)) ?? (boardName === "scratch" ? readLocal(LEGACY_KEY) : undefined)
      return { state: local ?? { strokes: [], symbols: [] }, migrate: !!local }
    }
  } catch {
    // daemon unreachable — fall through
  }
  offline = true
  return { state: readLocal(localKey(boardName)) ?? { strokes: [], symbols: [] }, migrate: false }
}

let offline = false
let saveTimer: ReturnType<typeof setTimeout> | undefined
let saving: Promise<void> = Promise.resolve()
let saveWarned = false

const saveNow = (): Promise<void> => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = undefined
  const body = serializeBoard(history.state)
  saving = saving.then(async () => {
    try {
      const res = await fetch(`/api/board/${encodeURIComponent(boardName)}`, { method: "PUT", body })
      if (!res.ok) throw new Error(`daemon ${res.status}`)
      offline = false
      saveWarned = false
    } catch {
      offline = true
      if (!saveWarned) flash("not saved to disk — daemon unreachable (kept in this browser)", 6000)
      saveWarned = true
    }
  })
  return saving
}

/** Every committed change: mirrored locally at once, written to the file shortly after. */
const saveState = () => {
  try {
    localStorage.setItem(localKey(boardName), serializeBoard(history.state))
  } catch {
    // ignore
  }
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void saveNow(), 350)
}

let dark = true
try {
  dark = localStorage.getItem(THEME_KEY) !== "0"
} catch {
  // default dark
}

// --- Page state -----------------------------------------------------------------

let history = new History()
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
type Mode = "idle" | "draw" | "lasso" | "pressSel" | "move" | "erase" | "chipPress" | "scale" | "rotate"
let mode: Mode = "idle"
let live: PenSample[] = []
let lasso: Pt[] = []
let pressStart: Pt | undefined
let pressButton = false
let erased = new Set<string>()
/** The live transform of the selection (a pen drag, a handle, or fingers). */
let liveXf: Xf | undefined
/** What a handle drag holds on to. */
let handleDrag: { corner: Pt; opposite: Pt; center: Pt; start: Pt } | undefined
/** Modifier keys, for handle drags (Alt: scale about centre; Shift: snap rotation). */
const keys = { alt: false, shift: false }

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

/** css px → page units (chrome is sized for the screen, hit-tested on the page). */
const px = (n: number) => n / scale

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
const pageColor = () => (dark ? "#000" : "#fff")
const accent = "#00a2ff"

// --- Symbols layers (ThreeHost) -----------------------------------------------------

/** A dream that stages some symbols, observed straight on so scene (x, −y)
 *  lands on page (x, y) — the same framing as the board scene (Board.ts).
 *  The host is always 16:9; its canvas is sized to the page's HEIGHT and
 *  centred, the page container clipping the sides — so the vertical
 *  framing is exact and nothing is stretched. */
class SymbolsDream extends Dream {
  constructor(
    private readonly placed: readonly PlacedSymbol[],
    frame: { cx: number; cy: number; h: number },
    private readonly fresh?: string,
  ) {
    super()
    framePage(this, frame)
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

/** One symbol canvas: what it shows (its signature), and the live host. */
interface Layer {
  name: "rest" | "lifted"
  canvas?: HTMLCanvasElement
  host?: ThreeHost
  sig: string
}
const restLayer: Layer = { name: "rest", sig: "" }
const liftedLayer: Layer = { name: "lifted", sig: "" }

let glBusy = false
let glAgain: { fresh?: string } | undefined

const layerLists = (): [Layer, PlacedSymbol[]][] => {
  const all = history.state.symbols
  return [
    [restLayer, all.filter((y) => !selection.has(y.id))],
    [liftedLayer, all.filter((y) => selection.has(y.id))],
  ]
}
const layerSig = (list: readonly PlacedSymbol[]) => JSON.stringify(list) + `|${scale}|${dpr}`

/** The page-height canvas sits centred, overhanging the page at both sides. */
const glGeometry = () => {
  const h = PAGE_H * scale
  const w = (h * 16) / 9
  return { w, h, left: (PAGE_W * scale - w) / 2 }
}

/** Rebuild whichever symbol layer's content changed, and swap the new
 *  canvases in TOGETHER — a symbol moving between rest and lifted never
 *  blinks out or doubles. Serialised: a request during a rebuild is
 *  coalesced into one more after it. */
const syncSymbols = async (fresh?: string): Promise<void> => {
  if (glBusy) {
    glAgain = { fresh: fresh ?? glAgain?.fresh }
    return
  }
  const todo = layerLists().filter(([L, list]) => layerSig(list) !== L.sig || (list.length > 0 && !L.host))
  if (todo.length === 0) return
  glBusy = true
  const built: { L: Layer; sig: string; canvas?: HTMLCanvasElement; host?: ThreeHost; duration: number }[] = []
  try {
    const { w, h, left } = glGeometry()
    for (const [L, list] of todo) {
      if (list.length === 0) {
        built.push({ L, sig: layerSig(list), duration: 0 })
        continue
      }
      const dream = new SymbolsDream(list, { cx: PAGE_W / 2, cy: PAGE_H / 2, h: PAGE_H }, fresh)
      const canvas = glCanvasOf(w, h)
      canvas.classList.add(L.name)
      canvas.style.left = `${left}px`
      // Mount needs the canvas in the document to know its size.
      canvas.style.visibility = "hidden"
      pageEl.insertBefore(canvas, ink)
      const host = await ThreeHost.mount(dream, canvas)
      host.renderer.setPixelRatio(dpr)
      host.renderer.setSize(w, h, false)
      await host.renderFrame(0)
      await host.renderFrame(0)
      built.push({ L, sig: layerSig(list), canvas, host, duration: dream.duration })
    }
    for (const b of built) {
      const old = b.L.canvas
      const oldHost = b.L.host
      if (b.canvas) b.canvas.style.visibility = "visible"
      b.L.canvas = b.canvas
      b.L.host = b.host
      b.L.sig = b.sig
      old?.remove()
      oldHost?.dispose()
      // Draw the fresh symbol on, if there is one to draw.
      const host = b.host
      if (host && b.duration > 0) {
        const t0 = performance.now()
        const tick = async () => {
          if (b.L.host !== host) return
          const t = Math.min(b.duration, (performance.now() - t0) / 1000)
          await host.renderFrame(t)
          if (t < b.duration) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }
    if (liveXf) liftCss(liveXf)
  } catch (err) {
    console.error("[sketch] symbol layer failed", err)
    flash(`render failed: ${(err as Error).message}`)
    for (const b of built) if (b.L.canvas !== b.canvas) (b.canvas?.remove(), b.host?.dispose())
  } finally {
    glBusy = false
    if (glAgain) {
      const next = glAgain
      glAgain = undefined
      void syncSymbols(next.fresh)
    }
  }
}

/** Preview a transform on the lifted layer: the page plane is parallel to
 *  the image plane, so a similarity of the page IS a similarity of the
 *  picture, and CSS (rotate() clockwise on screen, like page angles)
 *  states it without a sign flip. */
const liftCss = (xf: Xf | undefined) => {
  const c = liftedLayer.canvas
  if (!c) return
  if (!xf) {
    c.style.transform = ""
    return
  }
  const { left } = glGeometry()
  c.style.transformOrigin = `${xf.pivot.x * scale - left}px ${xf.pivot.y * scale}px`
  c.style.transform =
    `translate(${xf.translate.x * scale}px, ${xf.translate.y * scale}px) rotate(${xf.rotate}rad) scale(${xf.scale})`
}

// --- Selection chrome: frame, handles, rotate knob, ✦ chip ---------------------------

const FRAME_PAD = 10 // css px around the selection
const HANDLE = 7 // css px, the corner squares
const HANDLE_HIT = 11
const KNOB_GAP = 24 // css px above the frame
const KNOB_R = 5
const KNOB_HIT = 12
const CHIP_R = 13
const CHIP_GAP = 10 // css px below the frame
const CHIP_HIT = 16

const selectedStrokes = (): InkStroke[] => history.state.strokes.filter((k) => selection.has(k.id))

/** The selection's frame on the page (padded), or nothing. */
const frameBox = (): Box | undefined => {
  if (selection.size === 0) return undefined
  const sb = selectionBox(history.state, selection)
  if (!sb) return undefined
  const pad = px(FRAME_PAD)
  return { x: sb.x - pad, y: sb.y - pad, w: sb.w + 2 * pad, h: sb.h + 2 * pad }
}

const clampY = (y: number, r: number) => Math.min(PAGE_H - px(r + 3), Math.max(px(r + 3), y))

interface Chrome {
  frame: Box
  corners: Pt[]
  knob: Pt
  chip?: Pt
}

/** Where the handles are — or nothing, while a gesture or the ring owns the page. */
const chrome = (): Chrome | undefined => {
  if (thinking || ring || liveXf) return undefined
  const frame = frameBox()
  if (!frame) return undefined
  const corners = [
    { x: frame.x, y: frame.y },
    { x: frame.x + frame.w, y: frame.y },
    { x: frame.x + frame.w, y: frame.y + frame.h },
    { x: frame.x, y: frame.y + frame.h },
  ]
  const cx = frame.x + frame.w / 2
  const knob = { x: cx, y: clampY(frame.y - px(KNOB_GAP), KNOB_R) }
  const chip = selectedStrokes().length
    ? { x: cx, y: clampY(frame.y + frame.h + px(CHIP_GAP + CHIP_R), CHIP_R) }
    : undefined
  return { frame, corners, knob, chip }
}

type ChromeHit = { kind: "chip" } | { kind: "rotate" } | { kind: "corner"; i: number }

const chromeAt = (p: Pt): ChromeHit | undefined => {
  const c = chrome()
  if (!c) return undefined
  const near = (q: Pt, r: number) => Math.hypot(p.x - q.x, p.y - q.y) <= px(r)
  if (c.chip && near(c.chip, CHIP_HIT)) return { kind: "chip" }
  if (near(c.knob, KNOB_HIT)) return { kind: "rotate" }
  for (let i = 0; i < 4; i++) if (near(c.corners[i]!, HANDLE_HIT)) return { kind: "corner", i }
  return undefined
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

/** A box as four page points, carried through the live transform. */
const boxQuad = (b: Box, pad = 0): Pt[] => {
  const q = [
    { x: b.x - pad, y: b.y - pad },
    { x: b.x + b.w + pad, y: b.y - pad },
    { x: b.x + b.w + pad, y: b.y + b.h + pad },
    { x: b.x - pad, y: b.y + b.h + pad },
  ]
  return liveXf ? q.map((p) => xfPoint(liveXf!, p)) : q
}

const dashedQuad = (quad: Pt[], k: number, color: string, dash: number[], offset = 0) => {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.2 * dpr
  ctx.setLineDash(dash.map((d) => d * dpr))
  ctx.lineDashOffset = offset
  ctx.beginPath()
  ctx.moveTo(quad[0]!.x * k, quad[0]!.y * k)
  for (const p of quad.slice(1)) ctx.lineTo(p.x * k, p.y * k)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

const dashedBox = (b: Box, k: number, color: string, pad: number, dash: number[], offset = 0) => {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.2 * dpr
  ctx.setLineDash(dash.map((d) => d * dpr))
  ctx.lineDashOffset = offset
  const r = 10 * dpr
  ctx.beginPath()
  ctx.roundRect((b.x - pad) * k, (b.y - pad) * k, (b.w + 2 * pad) * k, (b.h + 2 * pad) * k, r)
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

const paintChrome = (c: Chrome, k: number) => {
  ctx.save()
  // the rotate knob's stem
  const top = { x: c.frame.x + c.frame.w / 2, y: c.frame.y }
  ctx.strokeStyle = accent
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 1 * dpr
  ctx.beginPath()
  ctx.moveTo(top.x * k, top.y * k)
  ctx.lineTo(c.knob.x * k, (c.knob.y + px(KNOB_R)) * k)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = pageColor()
  ctx.lineWidth = 1.3 * dpr
  ctx.beginPath()
  ctx.arc(c.knob.x * k, c.knob.y * k, KNOB_R * dpr, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // corner handles
  const s = HANDLE * dpr
  for (const p of c.corners) {
    ctx.beginPath()
    ctx.rect(p.x * k - s / 2, p.y * k - s / 2, s, s)
    ctx.fill()
    ctx.stroke()
  }
  // the ✦ chip: make it real
  if (c.chip) {
    const x = c.chip.x * k
    const y = c.chip.y * k
    ctx.beginPath()
    ctx.arc(x, y, CHIP_R * dpr, 0, Math.PI * 2)
    ctx.fillStyle = pageColor()
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.3 * dpr
    ctx.stroke()
    ctx.fillStyle = accent
    ctx.font = `${13 * dpr}px -apple-system, "SF Pro", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("✦", x, y + 0.5 * dpr)
  }
  ctx.restore()
}

const paintInk = () => {
  const k = scale * dpr
  ctx.clearRect(0, 0, ink.width, ink.height)
  const s = history.state
  const busy = new Set(thinking?.ids ?? [])
  for (const stroke of s.strokes) {
    const sel = selection.has(stroke.id)
    const pts = sel && liveXf ? transformStroke(stroke, liveXf).points : stroke.points
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
  // selected symbols in a group: a dashed frame around each (alone, the
  // selection's own frame says it)
  for (const y of s.symbols) {
    if (!selection.has(y.id) || selection.size < 2) continue
    dashedQuad(boxQuad(symbolBox(y), px(5)), k, accent, [5, 5])
  }
  // the selection's frame (turning and scaling with a live gesture)
  const fb = frameBox()
  if (fb && !thinking) {
    dashedQuad(boxQuad(fb), k, dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.25)", [2, 6])
  }
  const c = chrome()
  if (c) paintChrome(c, k)
  // thinking: a slow marching frame
  if (thinking) {
    dashedBox(thinking.box, k, accent, px(FRAME_PAD), [6, 8], -(performance.now() / 40) % 1000)
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
  liftCss(liveXf)
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

const setSelection = (ids: Iterable<string>) => {
  selection = pruneSelection(history.state, ids)
  updateButtons()
  drawInk()
  void syncSymbols()
}

/** Commit the live transform as ONE step (or drop it if it went nowhere). */
const commitLive = () => {
  const xf = liveXf
  liveXf = undefined
  if (xf && !isIdentity(xf) && selection.size > 0) {
    // The lifted canvas keeps its CSS transform until the rebuilt layer
    // replaces it — no snap back in between.
    history.do({ kind: "transform", ids: [...selection], xf })
    afterChange()
  } else {
    liftCss(undefined)
    drawInk()
  }
}

const cancelLive = () => {
  liveXf = undefined
  liftCss(undefined)
  drawInk()
}

const undo = () => {
  closeRing()
  cancelLive()
  const cmd = history.undo()
  if (!cmd) return
  // Restore what the step took away (or moved) as the selection, so the
  // next move (a different pick, a re-ask) has its subject in hand.
  if (cmd.kind === "replace" || cmd.kind === "delete" || cmd.kind === "erase") selection = new Set(cmd.ids)
  else if (cmd.kind === "move" || cmd.kind === "transform") selection = new Set(cmd.ids)
  else selection = new Set()
  afterChange()
  if (cmd.kind === "replace" && last && sameIds(last.ids, cmd.ids) && last.response.candidates.length > 1) openRing(last)
}

const redo = () => {
  closeRing()
  cancelLive()
  const cmd = history.redo()
  if (!cmd) return
  selection = cmd.kind === "move" || cmd.kind === "transform" ? new Set(cmd.ids) : new Set()
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
  const liveIds = new Set(history.state.strokes.map((k) => k.id))
  if (!ids.every((id) => liveIds.has(id))) {
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

const startHandle = (hit: { kind: "rotate" } | { kind: "corner"; i: number }, p: Pt) => {
  const c = chrome()!
  const center = boxCenter(c.frame)
  if (hit.kind === "rotate") {
    mode = "rotate"
    handleDrag = { corner: c.knob, opposite: center, center, start: p }
  } else {
    mode = "scale"
    handleDrag = { corner: c.corners[hit.i]!, opposite: c.corners[(hit.i + 2) % 4]!, center, start: p }
  }
  liveXf = { ...IDENTITY, pivot: center }
}

const SNAP = Math.PI / 12 // 15°

const dragHandle = (p: Pt) => {
  const d = handleDrag!
  if (mode === "rotate") {
    let a =
      Math.atan2(p.y - d.center.y, p.x - d.center.x) - Math.atan2(d.start.y - d.center.y, d.start.x - d.center.x)
    if (keys.shift) a = Math.round(a / SNAP) * SNAP
    liveXf = { ...IDENTITY, pivot: d.center, rotate: a }
  } else {
    // Uniform scale, read as the pointer's progress along the diagonal
    // from the pivot through the grabbed corner.
    const pivot = keys.alt ? d.center : d.opposite
    const v = { x: d.corner.x - pivot.x, y: d.corner.y - pivot.y }
    const len2 = v.x * v.x + v.y * v.y
    const grab = { x: d.start.x - d.corner.x, y: d.start.y - d.corner.y }
    const q = { x: p.x - grab.x - pivot.x, y: p.y - grab.y - pivot.y }
    const k = len2 < 1e-9 ? 1 : Math.min(50, Math.max(0.05, (q.x * v.x + q.y * v.y) / len2))
    liveXf = { ...IDENTITY, pivot, scale: k }
  }
}

const handlePen = (ev: PenEvent, source: "pointer" | "tablet") => {
  switch (ev.kind) {
    case "leave":
      penLeft()
      return
    case "status":
      setTabletStatus(ev)
      return
    case "gesture":
      if (!penNear()) fingerTap(ev.name)
      return
    case "touch":
      handleTouch(ev.touches, ev.t)
      return
    default:
  }
  const p = { x: ev.sample.x, y: ev.sample.y }
  if (source === "tablet") penAt(p, ev.kind === "button" ? ev.pressed : ev.button)
  // The pen takes the page from any finger gesture.
  if (touching && !touching.rejected) rejectTouch()
  if (ev.kind === "hover" || ev.kind === "button") return

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
      drawInk()
      return
    }
    const hit = chromeAt(p)
    if (hit?.kind === "chip") {
      // Tip or button: a tap here is "make it real", and never ink.
      mode = "chipPress"
      pressStart = p
      pressButton = ev.button
      live = [ev.sample]
    } else if (hit) {
      startHandle(hit, p)
    } else if (ev.button) {
      pressStart = p
      const fb = frameBox()
      if (fb && inBox(p, fb)) {
        mode = "pressSel"
        liveXf = undefined
      } else {
        mode = "lasso"
        lasso = [p]
      }
    } else {
      mode = "draw"
      live = [ev.sample]
      if (selection.size) setSelection([])
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
      case "chipPress":
        live.push(ev.sample)
        // Not a tap after all: it was the start of a stroke (or a lasso).
        if (pressStart && Math.hypot(p.x - pressStart.x, p.y - pressStart.y) > TAP) {
          if (pressButton) {
            mode = "lasso"
            lasso = live.map((q) => ({ x: q.x, y: q.y }))
          } else {
            mode = "draw"
            setSelection([])
          }
        }
        break
      case "pressSel":
        if (pressStart && Math.hypot(p.x - pressStart.x, p.y - pressStart.y) > TAP) mode = "move"
        if (mode !== "move") break
      // falls through
      case "move":
        liveXf = { ...IDENTITY, translate: { x: p.x - pressStart!.x, y: p.y - pressStart!.y } }
        break
      case "scale":
      case "rotate":
        dragHandle(p)
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
    case "chipPress":
      live = []
      drawInk()
      void transform()
      break
    case "pressSel":
      // a button-held tap INSIDE the selection: make it real
      drawInk()
      void transform()
      break
    case "move":
    case "scale":
    case "rotate":
      handleDrag = undefined
      commitLive()
      break
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

// --- The tablet pen's presence ---------------------------------------------------------

/** Pen in range (the digitizer sees it) — and when it last spoke. */
let penInRange = false
let penSeenAt = -Infinity
let presenceTimer: ReturnType<typeof setTimeout> | undefined

/** A pen that stops reporting without a `leave` (an older bridge) is gone after this. */
const PEN_STALE_MS = 1500
/** Palm rejection's grace after the pen leaves. */
const PALM_GRACE_MS = 300

const penNear = (): boolean => {
  const since = performance.now() - penSeenAt
  return (penInRange && since < PEN_STALE_MS) || since < PALM_GRACE_MS
}

const penAt = (p: Pt, button: boolean) => {
  penInRange = true
  penSeenAt = performance.now()
  presenceEl.style.transform = `translate(${p.x * scale}px, ${p.y * scale}px)`
  presenceEl.classList.add("on")
  presenceEl.classList.toggle("button", button)
  if (presenceTimer) clearTimeout(presenceTimer)
  presenceTimer = setTimeout(() => presenceEl.classList.remove("on"), 3000)
}

const penLeft = () => {
  penInRange = false
  penSeenAt = performance.now()
  presenceEl.classList.remove("on", "button")
}

// --- Fingers (raw `touch` frames from the tablet) ------------------------------------------

/** A finger gesture, from first finger down to last finger up. */
interface Touching {
  t0: number
  maxN: number
  /** The furthest any finger has travelled from where it landed (page units). */
  travel: number
  starts: Map<number, Pt>
  /** The transform accumulated by earlier two-finger segments. */
  acc: Sim
  /** The current two-finger segment: which fingers, where they began. */
  seg?: { ids: [number, number]; a0: Pt; b0: Pt }
  segSim: Sim
  pivot?: Pt
  rejected: boolean
}
let touching: Touching | undefined

/** Shorter and stiller than this is a tap (undo/redo), not a manipulation. */
const FINGER_TAP_MS = 250
const FINGER_TAP_TRAVEL = 40 // page units ≈ 4.5 mm on the rM2

const rejectTouch = () => {
  if (!touching) return
  touching.rejected = true
  if (mode === "idle") cancelLive()
}

const handleTouch = (touches: readonly { id: number; x: number; y: number }[], t: number) => {
  const now = Number.isFinite(t) ? t : performance.now()
  if (!touching) {
    if (touches.length === 0) return
    touching = {
      t0: now,
      maxN: 0,
      travel: 0,
      starts: new Map(),
      acc: SIM_IDENTITY,
      segSim: SIM_IDENTITY,
      // Palm rejection: a hand resting while the pen is near, or while the
      // pen is mid-gesture, is never a command.
      rejected: penNear() || mode !== "idle",
    }
  }
  const g = touching
  if (!g.rejected && (penNear() || mode !== "idle")) rejectTouch()
  if (touches.length === 0) {
    touching = undefined
    if (g.rejected) return
    if (now - g.t0 < FINGER_TAP_MS && g.travel < FINGER_TAP_TRAVEL) {
      if (g.maxN === 2) fingerTap("undo")
      else if (g.maxN === 3) fingerTap("redo")
      cancelLive()
    } else if (liveXf) {
      commitLive()
    }
    return
  }
  if (g.rejected) return
  g.maxN = Math.max(g.maxN, touches.length)
  for (const f of touches) {
    const s = g.starts.get(f.id)
    if (!s) g.starts.set(f.id, { x: f.x, y: f.y })
    else g.travel = Math.max(g.travel, Math.hypot(f.x - s.x, f.y - s.y))
  }
  // Two fingers on a selection: pan + pinch + twist, all at once. Any other
  // count freezes what has been done so far; two again continues from it.
  if (touches.length === 2 && selection.size > 0 && !thinking && !ring) {
    const [a, b] = [...touches].sort((p, q) => p.id - q.id) as [Pt & { id: number }, Pt & { id: number }]
    if (!g.seg || g.seg.ids[0] !== a.id || g.seg.ids[1] !== b.id) {
      g.acc = composeSim(g.segSim, g.acc)
      g.segSim = SIM_IDENTITY
      g.seg = { ids: [a.id, b.id], a0: { x: a.x, y: a.y }, b0: { x: b.x, y: b.y } }
      g.pivot ??= boxCenter(selectionBox(history.state, selection) ?? { x: a.x, y: a.y, w: 0, h: 0 })
    }
    g.segSim = simFromPairs(g.seg.a0, g.seg.b0, a, b)
    if (g.travel >= FINGER_TAP_TRAVEL) {
      liveXf = xfFromSim(composeSim(g.segSim, g.acc), g.pivot!)
      drawInk()
    }
  } else if (g.seg) {
    g.acc = composeSim(g.segSim, g.acc)
    g.segSim = SIM_IDENTITY
    g.seg = undefined
  }
}

/** A finger tap — from raw frames or the bridge's own `gesture` — once. */
let lastTap = { name: "", at: -Infinity }
const fingerTap = (name: "undo" | "redo") => {
  const now = performance.now()
  if (lastTap.name === name && now - lastTap.at < 400) return
  lastTap = { name, at: now }
  if (name === "undo") {
    if (!history.canUndo) return
    undo()
    flash("↶ undo", 1200)
  } else {
    if (!history.canRedo) return
    redo()
    flash("↷ redo", 1200)
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
const noteKeys = (e: { altKey: boolean; shiftKey: boolean }) => {
  keys.alt = e.altKey
  keys.shift = e.shiftKey
}

/** The mouse's cursor says what a press would do there. */
const CORNER_CURSORS = ["nwse-resize", "nesw-resize", "nwse-resize", "nesw-resize"]
const hoverCursor = (e: PointerEvent) => {
  const p = toPage(e.clientX, e.clientY)
  const hit = chromeAt(p)
  const fb = frameBox()
  ink.style.cursor =
    hit?.kind === "chip"
      ? "pointer"
      : hit?.kind === "rotate"
        ? "grab"
        : hit?.kind === "corner"
          ? CORNER_CURSORS[hit.i]!
          : e.shiftKey && fb && inBox(p, fb)
            ? "move"
            : "crosshair"
}

let activePointer: number | undefined
ink.addEventListener("pointerdown", (e) => {
  if (activePointer !== undefined) return
  activePointer = e.pointerId
  ink.setPointerCapture(e.pointerId)
  e.preventDefault()
  noteKeys(e)
  handlePen({ kind: "down", sample: sampleOf(e), button: buttonOf(e), eraser: eraserOf(e) }, "pointer")
})
ink.addEventListener("pointermove", (e) => {
  noteKeys(e)
  if (e.pointerId !== activePointer) {
    if (activePointer === undefined) hoverCursor(e)
    return
  }
  const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : []
  for (const ce of events.length ? events : [e])
    handlePen({ kind: "move", sample: sampleOf(ce), button: buttonOf(e), eraser: eraserOf(e) }, "pointer")
})
const pointerEnd = (e: PointerEvent) => {
  if (e.pointerId !== activePointer) return
  activePointer = undefined
  handlePen({ kind: "up", sample: sampleOf(e), button: buttonOf(e), eraser: eraserOf(e) }, "pointer")
  hoverCursor(e)
}
ink.addEventListener("pointerup", pointerEnd)
ink.addEventListener("pointercancel", pointerEnd)
ink.addEventListener("contextmenu", (e) => e.preventDefault())

// --- reMarkable over /ws/pen ------------------------------------------------------------

const SAMPLED = new Set(["down", "move", "up", "hover", "button"])
const UNSAMPLED = new Set(["leave", "gesture", "touch", "status"])

const isPenEvent = (v: unknown): v is PenEvent => {
  if (typeof v !== "object" || v === null) return false
  const kind = (v as { kind?: unknown }).kind
  if (typeof kind !== "string") return false
  if (SAMPLED.has(kind)) return typeof (v as { sample?: unknown }).sample === "object"
  if (kind === "touch") return Array.isArray((v as { touches?: unknown }).touches)
  return UNSAMPLED.has(kind)
}

type TabletState = Extract<PenEvent, { kind: "status" }>["state"]
let penSocketUp = false
let tablet: { state: TabletState; host?: string; message?: string } | undefined
let bannerDismissed = false

const TABLET_WORDS: Record<TabletState, string> = {
  connected: "reMarkable connected",
  searching: "looking for the reMarkable…",
  asleep: "reMarkable asleep — will reconnect",
  "needs-key": "reMarkable found — needs its one-time key setup",
}

const renderTablet = () => {
  const state = penSocketUp ? (tablet?.state ?? "none") : "offline"
  dotEl.className = `tabletdot ${state}`
  dotEl.title = !penSocketUp
    ? "daemon unreachable (/ws/pen)"
    : tablet
      ? `${TABLET_WORDS[tablet.state]}${tablet.host ? ` (${tablet.host})` : ""}`
      : "no tablet bridge running"
  const showBanner = penSocketUp && tablet?.state === "needs-key" && !bannerDismissed
  bannerEl.classList.toggle("on", showBanner)
  if (showBanner) {
    const cmd = bannerEl.querySelector("code")!
    cmd.textContent = tablet!.message ?? "bun scripts/remarkable-bridge.ts --setup"
  }
}

const setTabletStatus = (ev: Extract<PenEvent, { kind: "status" }>) => {
  if (ev.state !== "needs-key") bannerDismissed = false
  tablet = { state: ev.state, host: ev.host, message: ev.message }
  if (ev.state !== "connected") penLeft()
  renderTablet()
}

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
    renderTablet()
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
    tablet = undefined
    renderTablet()
    setTimeout(() => connectPen(Math.min(delay * 2, 15000)), delay)
  }
  ws.onerror = () => {
    // onclose follows; reconnect quietly from there
  }
}

// --- Keys & toolbar ---------------------------------------------------------------------

const typing = (e: Event) => e.target instanceof HTMLInputElement

window.addEventListener("keydown", (e) => {
  noteKeys(e)
  if (typing(e)) return
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
window.addEventListener("keyup", noteKeys)

btn("transform").addEventListener("click", () => void transform())
btn("undo").addEventListener("click", undo)
btn("redo").addEventListener("click", redo)
btn("theme").addEventListener("click", () => {
  dark = !dark
  applyTheme()
})
btn("clear").addEventListener("click", clearPage)
document.querySelectorAll("#toolbar button").forEach((b) => b.addEventListener("pointerdown", (e) => e.preventDefault()))
bannerEl.querySelector("button")!.addEventListener("click", () => {
  bannerDismissed = true
  renderTablet()
})

// The board switcher: a name. An existing board opens; a new name is a new board.
boardInput.value = boardName
editorLink.href = `/?scene=${encodeURIComponent(`board:${boardName}`)}`
const openBoard = async () => {
  const name = boardInput.value.trim()
  if (name === boardName) return
  if (!isValidBoardName(name)) {
    flash("a board name is letters, digits, - and _")
    boardInput.value = boardName
    return
  }
  if (saveTimer) await saveNow()
  await saving
  location.search = `?board=${encodeURIComponent(name)}`
}
boardInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void openBoard()
  else if (e.key === "Escape") {
    boardInput.value = boardName
    boardInput.blur()
  }
})
boardInput.addEventListener("change", () => void openBoard())
const listBoards = async () => {
  try {
    const res = await fetch("/api/boards")
    if (!res.ok) return
    const list = (await res.json()) as { name: string }[]
    boardList.textContent = ""
    for (const { name } of list) {
      const o = document.createElement("option")
      o.value = name
      boardList.appendChild(o)
    }
  } catch {
    // offline: no list, the field still works
  }
}

importsEl.textContent = VOCABULARY.map((e) => e.id).join(" · ")
importsEl.title = VOCABULARY.map((e) => `${e.name} — ${e.description}`).join("\n\n")

window.addEventListener("resize", () => {
  closeRing()
  layout()
  drawInk()
  void syncSymbols()
})
window.addEventListener("beforeunload", () => {
  if (saveTimer) void saveNow()
})

// --- Test hooks ----------------------------------------------------------------------------

declare global {
  interface Window {
    __sketch?: Record<string, unknown>
  }
}

const pageToClient = (p: Pt): Pt => {
  const r = pageEl.getBoundingClientRect()
  return { x: r.left + p.x * scale, y: r.top + p.y * scale }
}

window.__sketch = {
  ready: false,
  board: () => boardName,
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
  canUndo: () => history.canUndo,
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
  /** The selection's handles, in page units and client px. */
  chrome: () => {
    const c = chrome()
    if (!c) return undefined
    const both = (p: Pt) => ({ page: p, client: pageToClient(p) })
    return { frame: c.frame, corners: c.corners.map(both), knob: both(c.knob), chip: c.chip && both(c.chip) }
  },
  toClient: pageToClient,
  liveXf: () => liveXf,
  symbolsReady: () => !glBusy && !glAgain && layerLists().every(([L, list]) => L.sig === layerSig(list)),
  tabletConnected: () => penSocketUp,
  tablet: () => tablet,
  saved: async () => {
    if (saveTimer) await saveNow()
    await saving
    return !offline
  },
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
renderTablet()
connectPen()
void listBoards()
void loadBoard().then(async ({ state, migrate }) => {
  history = new History(state)
  if (migrate) saveState()
  if (offline) flash("daemon unreachable — this board is this browser's copy", 6000)
  updateButtons()
  drawInk()
  await syncSymbols()
  ;(window.__sketch as { ready: boolean }).ready = true
})
