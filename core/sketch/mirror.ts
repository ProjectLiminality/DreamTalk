/**
 * mirror.ts — the whiteboard page as a DISPLAY LIST, for the reMarkable's
 * own screen (protocol.ts: "The display list").
 *
 * The page stays the app; the tablet becomes its e-ink mirror. Everything
 * visible on the page is restated here as keyed items of 2D primitives in
 * PAGE units — ink with its pressure widths, every placed symbol flattened
 * to the polylines the Mac draws, the selection's frame and handles, the
 * lasso, the options ring — black on white.
 *
 * FLATTENING A SYMBOL. A symbol is a holon tree drawn by ThreeHost through a
 * perspective camera (framePage: straight on, at the distance that makes the
 * page's height fill the frame). This walks the same tree the host attaches
 * — same order, same transforms (h/p/b as three's 'ZXY' Euler, uniform
 * scale), same outlines (the host's own `polyline`) — and projects every
 * point through the same camera, so a flat symbol lands on exactly its page
 * coordinates and a tumbled cube shows the perspective the Mac shows.
 * Filled shapes (FoldableCube's occluding faces, the Eye's iris) become
 * fills, painted in the host's attach order. Text glyphs are triangulated
 * meshes, not line geometry, and are not mirrored yet.
 *
 * Pure until `Mirror`, which owns the socket: the builders run under bun test.
 */

import * as THREE from "three/webgpu"
import type { Color } from "../src/constants"
import { Dream } from "../src/dream"
import type { Holon } from "../src/holon"
import { Circle, Ellipse, Rectangle, Stroke, rectanglePolyline } from "../src/parts/primitives"
import { polyline } from "../src/render/three-host"
import { DisplayDiff, encodeItem, type EncodedItem } from "./display"
import {
  PAGE_H,
  PAGE_W,
  type Candidate,
  type DisplayItem,
  type DisplayPrim,
  type InkStroke,
  type PenSample,
  type PlacedSymbol,
} from "./protocol"
import { boxOfPoints, type Box, type Pt } from "./state"
import { buildSymbol, framePage } from "./vocabulary"
import { xfPoint, type Xf } from "./xform"

// --- Small geometry ---------------------------------------------------------------

/** Points are sent to a tenth of a page unit: a tenth of an rM2 pixel. */
const r1 = (v: number) => Math.round(v * 10) / 10

const flat = (pts: readonly Pt[]): number[] => {
  const out: number[] = []
  for (const p of pts) out.push(r1(p.x), r1(p.y))
  return out
}

const circlePts = (c: Pt, r: number, n = 48): Pt[] => {
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) })
  }
  return out
}

const quadOf = (b: Box): Pt[] => [
  { x: b.x, y: b.y },
  { x: b.x + b.w, y: b.y },
  { x: b.x + b.w, y: b.y + b.h },
  { x: b.x, y: b.y + b.h },
  { x: b.x, y: b.y },
]

/** Map a primitive's points (and leave its widths) — the page-plane similarity of a live gesture. */
const mapPrim = (p: DisplayPrim, f: (q: Pt) => Pt, widthScale = 1): DisplayPrim => {
  const pts: number[] = []
  for (let i = 0; i + 1 < p.pts.length; i += 2) {
    const q = f({ x: p.pts[i]!, y: p.pts[i + 1]! })
    pts.push(r1(q.x), r1(q.y))
  }
  if (p.k === "fill") return { ...p, pts }
  const w = typeof p.w === "number" ? r1(p.w * widthScale) : p.w.map((v) => r1(v * widthScale))
  return { ...p, pts, w }
}

const primsBox = (prims: readonly DisplayPrim[]): Box | undefined => {
  const pts: Pt[] = []
  for (const p of prims) for (let i = 0; i + 1 < p.pts.length; i += 2) pts.push({ x: p.pts[i]!, y: p.pts[i + 1]! })
  return boxOfPoints(pts)
}

// --- Ink ----------------------------------------------------------------------------

/** The ink width the page draws a sample with (main.ts `strokeWidth`) — the same nib. */
export const inkWidth = (p: PenSample): number => 2.2 + 3.2 * Math.min(1, Math.max(0, p.pressure || 0.5))

export const inkPrim = (points: readonly PenSample[], grey = 0): DisplayPrim => ({
  k: "line",
  pts: flat(points),
  w: points.map((p) => r1(inkWidth(p))),
  ...(grey ? { grey } : {}),
})

// --- Symbols: the holon tree → 2D, through the page's camera -----------------------------

/** Dark-theme colour → e-ink grey. The light page inverts the symbol layer
 *  (index.html: `filter: invert(1)`), and e-ink IS the light page. */
const inverseGrey = (c: Color): number =>
  Math.round(255 * (1 - Math.min(1, Math.max(0, 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b))))

/** Lines: anything that reads on the dark page is black on e-ink (a coloured
 *  line must not fade to a pale grey); near-black lines vanish there too. */
const lineGrey = (c: Color): number | undefined => (inverseGrey(c) > 200 ? undefined : 0)

/** A line width the e-ink can show: the host's px width, read as page units. */
const LINE_W = (px: number) => r1(Math.min(12, Math.max(1.5, px)))

const STRAIGHT_ON = new THREE.Euler()
const tmpV = new THREE.Vector3()

class FlatDream extends Dream {
  constructor(private readonly holon: Holon) {
    super()
    framePage(this)
  }
  unfold() {
    this.stage(this.holon)
  }
}

/** The host's camera for a dream (ThreeHost.syncCamera, perspective), and
 *  NDC → page for a frame centred on the page with the page's height. */
const pageProjector = (dream: Dream) => {
  const obs = dream.observer
  const cam = new THREE.PerspectiveCamera()
  const phi = obs.phi.value
  const theta = obs.theta.value
  const r = obs.radius.value / (obs.zoom.value || 1)
  const focus = new THREE.Vector3(obs.x.value, obs.y.value, obs.z.value)
  cam.position.set(
    focus.x + r * Math.sin(phi) * Math.cos(theta),
    focus.y + r * Math.sin(theta),
    focus.z + r * Math.cos(phi) * Math.cos(theta),
  )
  cam.up.set(0, 1, 0)
  cam.lookAt(focus)
  if (obs.tilt.value !== 0) cam.rotateZ(obs.tilt.value)
  cam.aspect = 16 / 9
  cam.fov = THREE.MathUtils.radToDeg(obs.fov.value)
  cam.near = 0.1
  cam.far = 1e7
  cam.updateProjectionMatrix()
  cam.updateMatrixWorld(true)
  // framePage centres the observer on the page and fits its HEIGHT.
  const cx = PAGE_W / 2
  const cy = PAGE_H / 2
  const half = PAGE_H / 2
  return (v: THREE.Vector3): Pt => {
    tmpV.copy(v).project(cam)
    return { x: cx + tmpV.x * half * cam.aspect, y: cy - tmpV.y * half }
  }
}

/** The polyline cut to its visible window [erasure, creation] of arc length. */
const visibleRun = (pts: readonly Pt[], from: number, to: number): Pt[] => {
  if (from <= 0 && to >= 1) return [...pts]
  if (to <= from || pts.length < 2) return []
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y))
  const total = cum[cum.length - 1]!
  const a = from * total
  const b = to * total
  const at = (s: number): Pt => {
    let i = 1
    while (i < pts.length - 1 && cum[i]! < s) i++
    const seg = cum[i]! - cum[i - 1]!
    const u = seg < 1e-9 ? 0 : (s - cum[i - 1]!) / seg
    return { x: pts[i - 1]!.x + (pts[i]!.x - pts[i - 1]!.x) * u, y: pts[i - 1]!.y + (pts[i]!.y - pts[i - 1]!.y) * u }
  }
  const out = [at(a)]
  for (let i = 0; i < pts.length; i++) if (cum[i]! > a && cum[i]! < b) out.push(pts[i]!)
  out.push(at(b))
  return out
}

/**
 * A holon tree (already sampled) → primitives on the page, in the host's
 * attach order: a node's fill or wash, then its outline, then its parts.
 */
export const flattenHolon = (root: Holon, project: (v: THREE.Vector3) => Pt): DisplayPrim[] => {
  const prims: DisplayPrim[] = []
  const local = new THREE.Matrix4()
  const quat = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  const toPage = (m: THREE.Matrix4, pts: readonly { x: number; y: number; z: number }[]): Pt[] =>
    pts.map((p) => project(tmpV.set(p.x, p.y, p.z).applyMatrix4(m)))

  const visit = (h: Holon, parent: THREE.Matrix4) => {
    pos.set(h.x.value, h.y.value, h.z.value)
    quat.setFromEuler(STRAIGHT_ON.set(h.p.value, h.h.value, h.b.value, "ZXY"))
    const s = h.scale.value
    scl.set(s, s, s)
    const world = new THREE.Matrix4().multiplyMatrices(parent, local.compose(pos, quat, scl))

    if (h instanceof Stroke && h.opacity.value > 0.01) {
      const filledShape =
        (h instanceof Ellipse && h.filled.value) || (h instanceof Rectangle && h.filled.value) ? h : undefined
      if (filledShape) {
        // A flat fill (no outline): present once it is more there than not.
        if (h.creation.value * h.opacity.value > 0.5) {
          const outline =
            filledShape instanceof Ellipse
              ? ellipseOutline(filledShape.radiusX.value, filledShape.radiusY.value)
              : rectanglePolyline(filledShape.width.value, filledShape.height.value, filledShape.rounding.value)
          prims.push({ k: "fill", pts: flat(toPage(world, outline)), grey: inverseGrey(h.tint.value) })
        }
      } else {
        // The wash (Stroke.fillOpacity) of the shapes the host washes.
        const wash = h.fillOpacity.value * h.opacity.value
        if (wash > 0.05 && (h instanceof Circle || h instanceof Ellipse || h instanceof Rectangle)) {
          const outline =
            h instanceof Circle
              ? ellipseOutline(h.radius.value, h.radius.value)
              : h instanceof Ellipse
                ? ellipseOutline(h.radiusX.value, h.radiusY.value)
                : rectanglePolyline(h.width.value, h.height.value, h.rounding.value)
          const grey = Math.round(255 - (255 - inverseGrey(h.tint.value)) * Math.min(1, wash))
          if (grey < 245) prims.push({ k: "fill", pts: flat(toPage(world, outline)), grey })
        }
        const grey = lineGrey(h.tint.value)
        const pts = grey === undefined ? undefined : polyline(h)
        if (pts && pts.length >= 2) {
          const run = visibleRun(toPage(world, pts), h.erasure.value, h.creation.value)
          if (run.length >= 2) prims.push({ k: "line", pts: flat(run), w: LINE_W(h.stroke.value), ...(grey ? { grey } : {}) })
        }
      }
    }
    for (const part of h.parts) visit(part, world)
  }
  visit(root, new THREE.Matrix4())
  return prims
}

const ellipseOutline = (rx: number, ry: number, n = 64) => {
  const out: { x: number; y: number; z: number }[] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry, z: 0 })
  }
  return out
}

const symbolCache = new Map<string, DisplayPrim[]>()

/** A placed symbol, at rest, as the page draws it. Unknown or broken symbols are empty. */
export const flattenSymbol = (s: Pick<PlacedSymbol, "symbol" | "params">): DisplayPrim[] => {
  const key = JSON.stringify([s.symbol, s.params])
  const hit = symbolCache.get(key)
  if (hit) return hit
  let prims: DisplayPrim[] = []
  try {
    const holon = buildSymbol({ id: "mirror", symbol: s.symbol, params: s.params, fromStrokes: [] })
    const dream = new FlatDream(holon)
    // At rest: the end of anything the symbol plays (a fresh symbol's
    // Create, a MindVirus journey on its own clock).
    dream.applyAt(dream.duration)
    const project = pageProjector(dream)
    for (const r of dream.roots) prims.push(...flattenHolon(r, project))
  } catch {
    prims = []
  }
  if (symbolCache.size > 256) symbolCache.clear()
  symbolCache.set(key, prims)
  return prims
}

// --- The page → items ------------------------------------------------------------------

/** Everything the page shows, as main.ts states it (sizes already in page units). */
export interface MirrorView {
  strokes: readonly InkStroke[]
  symbols: readonly PlacedSymbol[]
  selection: ReadonlySet<string>
  /** The live transform of the selection (a drag, a handle, fingers). */
  liveXf?: Xf
  /** The stroke being drawn right now. */
  liveStroke: readonly PenSample[]
  /** The lasso being drawn right now. */
  lasso: readonly Pt[]
  /** Strokes the eraser is passing over. */
  erased: ReadonlySet<string>
  /** Page units per css px of the Mac's chrome (main.ts `px(1)`). */
  unit: number
  /** The selection's padded frame, before the live transform. */
  frame?: Box
  /** Each selected symbol's padded box, when several are selected. */
  groupBoxes: readonly { id: string; box: Box }[]
  /** The handles (absent during a gesture, as on the Mac). */
  chrome?: { corners: Pt[]; knob: Pt; frameTop: Pt; chip?: Pt; handle: number; knobR: number; chipR: number }
  /** A recognition in flight: the padded box that marches on the Mac. */
  thinking?: Box
  /** The options ring. */
  ring?: { center: Pt; radius: number; chipPage: number; chips: readonly { x: number; y: number; candidate: Candidate }[] }
}

const Z = { symbol: 10, lifted: 11, ink: 20, frame: 30, chrome: 40, live: 50, ring: 60, ringChip: 61 }

/** A small filled-then-outlined shape: the Mac's handles sit on the page colour. */
const knockout = (pts: Pt[], w: number): DisplayPrim[] => [
  { k: "fill", pts: flat(pts), grey: 255 },
  { k: "line", pts: flat(pts), w: r1(w) },
]

/** The ✦ chip's star, as four-pointed line work. */
const star = (c: Pt, r: number): Pt[] => {
  const out: Pt[] = []
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4
    const k = i % 2 === 0 ? r : r * 0.32
    out.push({ x: c.x + k * Math.cos(a), y: c.y + k * Math.sin(a) })
  }
  return out
}

const inkCache = new WeakMap<InkStroke, EncodedItem>()

/**
 * The display list for one moment of the page, encoded. Unchanged strokes
 * reuse their encoding, so a page of a thousand strokes diffs in a breath.
 */
export const buildDisplay = (v: MirrorView): EncodedItem[] => {
  const out: EncodedItem[] = []
  const put = (item: DisplayItem) => out.push(encodeItem(item))
  const xf = v.liveXf
  const moved = (p: Pt) => (xf ? xfPoint(xf, p) : p)
  const u = v.unit

  for (const y of v.symbols) {
    const sel = v.selection.has(y.id)
    let prims = flattenSymbol(y)
    if (sel && xf) prims = prims.map((p) => mapPrim(p, moved))
    put({ id: `sym:${y.id}`, z: sel ? Z.lifted : Z.symbol, prims })
  }

  for (const k of v.strokes) {
    const transformed = v.selection.has(k.id) && xf
    const grey = v.erased.has(k.id) ? 200 : 0
    if (!transformed && !grey) {
      let e = inkCache.get(k)
      if (!e) {
        e = encodeItem({ id: `ink:${k.id}`, z: Z.ink, prims: [inkPrim(k.points)] })
        inkCache.set(k, e)
      }
      out.push(e)
      continue
    }
    const pts = transformed ? k.points.map((p) => ({ ...p, ...xfPoint(xf, p) })) : k.points
    put({ id: `ink:${k.id}`, z: Z.ink, prims: [inkPrim(pts, grey)] })
  }

  const dash: [number, number] = [r1(3 * u), r1(6 * u)]
  if (v.frame && !v.thinking) {
    const q = quadOf(v.frame).map(moved)
    put({ id: "frame", z: Z.frame, grab: true, prims: [{ k: "line", pts: flat(q), w: 1.5, dash }] })
  }
  for (const g of v.groupBoxes) {
    const q = quadOf(g.box).map(moved)
    put({ id: `group:${g.id}`, z: Z.frame, prims: [{ k: "line", pts: flat(q), w: 1.5, dash: [r1(5 * u), r1(5 * u)] }] })
  }

  const c = v.chrome
  if (c) {
    put({
      id: "chrome:knob",
      z: Z.chrome,
      noInk: true,
      prims: [
        { k: "line", pts: flat([c.frameTop, { x: c.knob.x, y: c.knob.y + c.knobR }]), w: 1.5 },
        ...knockout(circlePts(c.knob, c.knobR, 24), 2),
      ],
    })
    c.corners.forEach((p, i) => {
      const s = c.handle / 2
      put({ id: `chrome:corner${i}`, z: Z.chrome, noInk: true, prims: knockout(quadOf({ x: p.x - s, y: p.y - s, w: 2 * s, h: 2 * s }), 2) })
    })
    if (c.chip) {
      put({
        id: "chrome:chip",
        z: Z.chrome,
        noInk: true,
        prims: [...knockout(circlePts(c.chip, c.chipR, 32), 2), { k: "fill", pts: flat(star(c.chip, c.chipR * 0.62)), grey: 0 }],
      })
    }
  }

  if (v.thinking) {
    put({ id: "thinking", z: Z.frame, prims: [{ k: "line", pts: flat(quadOf(v.thinking)), w: 2, dash: [r1(6 * u), r1(8 * u)] }] })
  }

  if (v.liveStroke.length) put({ id: "live", z: Z.live, live: true, prims: [inkPrim(v.liveStroke)] })
  if (v.lasso.length > 1) {
    put({
      id: "lasso",
      z: Z.live,
      live: true,
      prims: [{ k: "line", pts: flat([...v.lasso, v.lasso[0]!]), w: 2, dash: [r1(6 * u), r1(6 * u)] }],
    })
  }

  const ring = v.ring
  if (ring) {
    put({ id: "ring", z: Z.ring, prims: [{ k: "line", pts: flat(circlePts(ring.center, ring.radius, 96)), w: 1, grey: 170 }] })
    ring.chips.forEach((chip, i) => {
      const at = { x: chip.x, y: chip.y }
      const r = ring.chipPage / 2
      const prims: DisplayPrim[] = knockout(circlePts(at, r, 48), 2)
      // The candidate itself, drawn small inside its chip: a choice between pictures.
      const thumb = flattenSymbol(chip.candidate)
      const b = primsBox(thumb)
      if (b) {
        const k = (r * 0.8) / Math.max(Math.hypot(b.w, b.h) / 2, 1) // its corners stay in the circle
        const mid = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
        prims.push(...thumb.map((p) => mapPrim(p, (q) => ({ x: at.x + (q.x - mid.x) * k, y: at.y + (q.y - mid.y) * k }), Math.min(1, k))))
      }
      put({ id: `ring:${i}`, z: Z.ringChip, noInk: true, prims })
    })
  }
  return out
}

// --- The socket: throttled diffs to the daemon -------------------------------------------

/** At most one batch per this many ms (e-ink can't show more), and only on change. */
export const MIRROR_INTERVAL_MS = 100

/**
 * Publishes the page's display list on /ws/display: a full snapshot on every
 * (re)connect, then diffs, at most every MIRROR_INTERVAL_MS. `changed()` is
 * cheap to call on every repaint; it sends at once when the interval has
 * passed (so a page in a background tab, whose timers the browser slows,
 * still keeps up — each incoming pen event is a chance to send).
 */
export class Mirror {
  private ws?: WebSocket
  private diff = new DisplayDiff()
  private last = -Infinity
  private timer?: ReturnType<typeof setTimeout>
  private dirty = false
  private delay = 1000

  constructor(
    private readonly view: () => MirrorView,
    private readonly url: string,
  ) {}

  start(): void {
    let ws: WebSocket
    try {
      ws = new WebSocket(this.url)
    } catch {
      setTimeout(() => this.start(), this.delay)
      return
    }
    this.ws = ws
    ws.onopen = () => {
      this.delay = 1000
      this.diff.reset()
      this.send(true)
    }
    ws.onclose = () => {
      if (this.ws === ws) this.ws = undefined
      this.delay = Math.min(this.delay * 2, 15000)
      setTimeout(() => this.start(), this.delay)
    }
    ws.onerror = () => {
      // onclose follows
    }
  }

  changed(): void {
    this.dirty = true
    const wait = this.last + MIRROR_INTERVAL_MS - performance.now()
    if (wait <= 0) this.send(false)
    else this.timer ??= setTimeout(() => {
      this.timer = undefined
      if (this.dirty) this.send(false)
    }, wait)
  }

  private send(full: boolean): void {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    this.dirty = false
    this.last = performance.now()
    let items: EncodedItem[]
    try {
      items = buildDisplay(this.view())
    } catch (err) {
      console.warn("[mirror] display list failed", err)
      return
    }
    const msg = full ? this.diff.full(items) : this.diff.diff(items)
    if (msg) ws.send(msg)
  }
}
