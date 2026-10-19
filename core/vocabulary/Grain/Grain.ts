/**
 * Grain — a particle that knows how much we know about it.
 *
 * David (2026-10-13): if all we know is kilograms moving, a particle is a
 * neutral sphere — "a sphere is very neutral". When we tell categories
 * apart, the dots take colours; when we know the TYPE, each dot becomes a
 * symbol of an example of that material (a pallet of granulate, a reel of
 * film, a pouch); when we know the exact item, it is still that symbol,
 * but named. Morphing between the rungs keeps the eye on the essence:
 * THIS dot stands for THIS more complex thing.
 *
 *   rung 0  mass       a neutral dot
 *   rung 1  category   the dot takes its category's colour
 *   rung 2  type       the dot becomes the type's symbol (a SolidDrawing)
 *   rung 3  item       the symbol is named — its label writes in
 *
 * `grain` is the rung, continuous: 0.5 is a dot halfway to its colour,
 * 1.5 a dot halfway into its symbol (fill out → outline flies apart onto
 * the symbol's visible 3D edges → the symbol's fill comes in — Morph's
 * three channels, `morphPhases`, over correspond.ts's N→M plan).
 *
 * EACH RUNG HAS ITS OWN CERTAINTY. Knowing a particle's category from the
 * data while only guessing its type is the normal case, so `massKnown`,
 * `categoryKnown`, `typeKnown`, `itemKnown` (1 = data, 0 = a picture we
 * are painting) say how real each rung is, and the Grain's `certainty`
 * (src/certainty.ts, the renderer's ghost and superposition) follows the
 * rung it stands on. Mocked, the pallet is a ghost; when the data
 * arrives, `typeKnown.to(1)` collapses it to solid.
 *
 * The morph runs in the Grain's OWN frame, not world space: a particle
 * travelling down a flow does not re-plan its morph each frame (under an
 * orthographic camera, never; in perspective, only as the view of it
 * turns). The dot and the label face the camera as seen from the grain's
 * own frame, so a Grain may sit under any parent, turned any way — a flow
 * can turn its particles along its channel and the symbol shows its 3D
 * side while the dot and the name still face the viewer.
 *
 *     new Grain({ observer: this.observer, category: BLUE,
 *                 symbol: (o) => new FilmReel(o), label: "BOPP film · 2,400 m" })
 */

import { WHITE, rgb, type Color } from "../../src/constants"
import type { Observer } from "../../src/dream"
import type { Overrides } from "../../src/holon"
import { certainty, certaintyOf, seenOpacity } from "../../src/certainty"
import { Param, completion, derive, length, scalar, type Readable } from "../../src/params"
import { memoReads } from "../../src/params"
import { Group, Line, Stroke, type Vec3Like } from "../../src/parts/primitives"
import { rotHPB } from "../../src/parts/curves"
import { Text } from "../../src/parts/text"
import { Polylines, deriveLoops } from "../../src/parts/polylines"
import { derivePoints, localView, toLocal, toWorld, viewOf, type SolidDrawing } from "../../src/parts/soliddrawing"
import { Surface } from "../../src/parts/surface"
import { CLOUD_PX, ECHOES, echoBreath, echoOffset } from "../../src/render/superposition"
import { orthoHalfHeight } from "../../src/dream"
import type { Holon } from "../../src/holon"
import { solidBounds, type View } from "../../src/geometry/hiddenline"
import { blendPlan, planMorph, type MorphPlan } from "../../src/geometry/correspond"
import { morphPhases } from "../Morph/MorphCurves"
import { axis, type StateSpace } from "../../src/automaton"

/** A dot of mass whose kind we do not know — neither white nor any category. */
export const NEUTRAL: Color = rgb(170, 170, 170)

/**
 * The view grid every grain sees through, radians. A grain's symbol is
 * small, so it is drawn as seen along ONE direction (from its centre
 * toward the eye), snapped to this grid — and drawings and morph plans
 * are SHARED by every grain whose symbol and snapped view agree
 * (SolidDrawing `shareViews`, and the plan caches below). Hundreds of
 * pallets on a flow under a perspective camera then cost a few dozen
 * hidden-line solves in all, not one per particle per frame. 0.025 rad
 * (1.4°) is invisible at symbol size.
 */
export const VIEW_STEP = 0.025

/** Snap a unit direction to the view grid (azimuth about +y, elevation). */
export const snapDirection = (k: Vec3Like, step = VIEW_STEP): Vec3Like => {
  const A = Math.round(Math.atan2(k.x, k.z) / step) * step
  const E = Math.round(Math.asin(Math.max(-1, Math.min(1, k.y))) / step) * step
  return { x: Math.cos(E) * Math.sin(A), y: Math.sin(E), z: Math.cos(E) * Math.cos(A) }
}

/** Morph plans shared by every grain: by the target's (shared) drawing, then a key of the rest. */
const DOT_PLANS = new WeakMap<object, Map<string, MorphPlan>>()
const ITEM_PLANS = new WeakMap<object, WeakMap<object, Map<string, MorphPlan>>>()
const PLANS_PER_DRAWING = 256
const remember = (m: Map<string, MorphPlan>, key: string, make: () => MorphPlan): MorphPlan => {
  let plan = m.get(key)
  if (!plan) {
    plan = make()
    if (m.size >= PLANS_PER_DRAWING) m.delete(m.keys().next().value!)
    m.set(key, plan)
  }
  return plan
}

/** A small integer per drawing object — a cheap dirty key for the line pool. */
const DRAWING_IDS = new WeakMap<object, number>()
let nextDrawingId = 1
const drawingId = (d: object): number => {
  let id = DRAWING_IDS.get(d)
  if (id === undefined) DRAWING_IDS.set(d, (id = nextDrawingId++))
  return id
}

/** The rungs, by name — `grain.to(RUNG.type)` reads as what it says. */
export const RUNG = { mass: 0, category: 1, type: 2, item: 3 } as const

export interface GrainOptions {
  /** The scene's observer — the symbol's edges, the dot and the label face it. */
  observer?: Observer
  /**
   * Draw the dot in a shared DotPool (one mesh for a whole flow's dots)
   * instead of a fill of its own. See DotPool.
   */
  dots?: DotPool
  /** Rung 1: the category's colour (the symbol's `material`, if it has one). Default NEUTRAL. */
  category?: Color
  /** Rung 2: the type's symbol, built from the overrides that size and fade it. */
  symbol?: (overrides: Overrides & { observer?: Observer }) => SolidDrawing
  /** Rung 3: the exact item's name. */
  label?: string
  /**
   * Rung 3: the exact item's own symbol — the type's symbol made from the
   * item's data (a reel of its real width and diameter, an octabin rather
   * than sacks, a bigger pouch). Built like `symbol` and drawn at the
   * TYPE's scale, so a wider reel is wider; 2 → 3 morphs the type's
   * symbol into it. Omit it and the item rung only names the type.
   */
  item?: (overrides: Overrides & { observer?: Observer }) => SolidDrawing
  /** The dot's colour before its category is known. Default NEUTRAL. */
  neutral?: Color
  /**
   * Stand the symbol ON the plane the dot rides in (its base at the dot's
   * centre, up = +y) rather than centred on the dot. Default false.
   */
  stand?: boolean
}

const mixColor = (a: Color, b: Color, u: number): Color => ({
  r: a.r + (b.r - a.r) * u,
  g: a.g + (b.g - a.g) * u,
  b: a.b + (b.b - a.b) * u,
})
const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x)
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** A drawing's solids' bounds: the largest extent (what `size` measures) and the lowest y. */
const boundsOf = (sym: SolidDrawing): { extent: number; bottom: number } => {
  const lo = { x: Infinity, y: Infinity, z: Infinity }
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const s of sym.solids()) {
    const b = solidBounds(s)
    for (const a of ["x", "y", "z"] as const) {
      lo[a] = Math.min(lo[a], b.lo[a])
      hi[a] = Math.max(hi[a], b.hi[a])
    }
  }
  return { extent: Math.max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z, 1e-6), bottom: lo.y }
}

/** The certainty a grain stands at, between the rungs' own: piecewise linear in `g`. */
export const rungCertainty = (g: number, known: readonly number[]): number => {
  const top = known.length - 1
  const x = Math.min(top, Math.max(0, g))
  const i = Math.min(top - 1, Math.floor(x))
  const u = x - i
  return known[i]! + (known[i + 1]! - known[i]!) * u
}

/**
 * The phases of a grain at rung `g`: how far its colour has come (rung
 * 0→1), its morph into the symbol (1→2, Morph's three channels), and its
 * label (2→3). Pure.
 */
export const grainPhases = (
  g: number,
): {
  color: number
  fillOut: number
  morph: number
  fillIn: number
  label: number
  item: { fillOut: number; morph: number; fillIn: number }
} => {
  const m = morphPhases(g - 1)
  return { color: clamp01(g), ...m, label: clamp01(g - 2), item: morphPhases(g - 2) }
}

export class Grain extends Stroke {
  /** The rung: 0 mass (a neutral dot), 1 category (its colour), 2 type (its symbol), 3 item (named). */
  grain = scalar(0)
  /** The dot's radius. */
  radius = length(9)
  /** The symbol's largest extent, scene units. */
  size = length(70)
  /**
   * Level of detail: below this on-screen size (pixels at a 720-high
   * frame) the grain shows only its dot, whatever its rung — a far or tiny
   * particle stays the essence. Between 1× and 1.5× it morphs dot → symbol
   * as it grows on screen (magnification is the morph). Default 14 — a
   * symbol smaller than that is illegible anyway; 0 = always detailed.
   */
  detailPx = length(14)
  /** How real each rung is: 1 = the data says so, 0 = a picture we are painting. */
  massKnown = completion(1)
  categoryKnown = completion(1)
  typeKnown = completion(1)
  itemKnown = completion(1)
  /** What the renderer ghosts by — the certainty of the rung the grain stands on (read-only: it follows the four above). */
  certainty = certainty(1)

  /** The symbol this grain becomes (rung 2), if it has one. */
  symbol?: SolidDrawing
  /** The exact item's symbol (rung 3), if the data gives one. */
  item?: SolidDrawing
  /** The item's name (rung 3), if it has one. */
  label?: Text

  private opts!: GrainOptions

  constructor(overrides: Overrides & GrainOptions = {}) {
    const { observer, category, symbol, label, item, neutral, stand, dots, ...rest } = overrides
    super({ stroke: 2.5, ...rest })
    this.opts = { observer, category, symbol, label, item, neutral, stand, dots }
    // Read by every leaf under the grain every frame (the renderer's
    // ghost and superposition): once per param epoch, replaying its reads
    // (src/memo.ts) so the host can still skip what did not move.
    this.certainty.follow(
      derive(
        memoReads(() =>
          rungCertainty(this.rung(), [this.massKnown.value, this.categoryKnown.value, this.typeKnown.value, this.itemKnown.value]),
        ),
      ),
    )
  }

  /** How much of the dot's fill shows (its own opacity aside): gone once the symbol morph starts. */
  dotFill(): number {
    return this.rung() < 2 ? 1 - grainPhases(this.rung()).fillOut : 0
  }

  /** The colour now: neutral → the category's as rung 0 → 1. */
  dotTint(): Color {
    const { category, neutral } = this.opts
    return mixColor(neutral ?? NEUTRAL, category ?? neutral ?? NEUTRAL, grainPhases(this.rung()).color)
  }

  /**
   * The rung actually drawn: `grain`, held at the dot (1) while the symbol
   * would be smaller on screen than `detailPx` (see there). Pure in the
   * params and the camera; once per param epoch.
   */
  rung(): number {
    return this.rungNow()
  }
  private rungNow = memoReads((): number => {
    const g = this.grain.value
    const px = this.detailPx.value
    let shown = g
    if (px > 0 && g > 1 && this.opts.observer) {
      const t = smoothstep(px, 1.5 * px, this.screenSize(this.opts.observer))
      shown = Math.min(g, 1 + t * (g - 1))
    }
    return shown
  })

  /** The symbol's size on screen, pixels of a 720-high frame. */
  screenSize(o: Observer): number {
    let s = this.size.value
    for (let n: Holon | undefined = this; n; n = n.parent) s *= Math.abs(n.scale.value)
    if (o.orthographic.value) return (s / (2 * orthoHalfHeight(o.zoom.value || 1, 16 / 9))) * 720
    const v = viewOf(o)
    if (!("eye" in v)) return Infinity
    const p = toWorld(this, { x: 0, y: 0, z: 0 })
    const d = Math.hypot(v.eye.x - p.x, v.eye.y - p.y, v.eye.z - p.z) || 1e-6
    return (s / (2 * d * Math.tan(o.fov.value / 2))) * 720
  }

  /** The view, in this grain's frame. */
  private view(): View {
    const o = this.opts.observer
    return localView(this, o ? viewOf(o) : { eye: { x: 0, y: 0, z: 1500 } })
  }

  /** The unit direction toward the viewer, grain-local, snapped to the view grid. */
  private toward(): Vec3Like {
    // Read by every slot of every grain each frame: answered once per
    // param epoch (nothing it reads can change between two equal epochs).
    return this.towardNow()
  }
  private towardNow = memoReads((): Vec3Like => {
    const v = this.view()
    const d = "eye" in v ? v.eye : v.toward
    const l = Math.hypot(d.x, d.y, d.z) || 1
    return snapDirection({ x: d.x / l, y: d.y / l, z: d.z / l })
  })

  /** The dot's outline: a circle facing the viewer, grain-local, closed. */
  dotOutline(n = 48): Vec3Like[] {
    const k = this.toward()
    // u ⟂ up and the view; w completes the screen plane (up on screen).
    let u = { x: k.z, y: 0, z: -k.x }
    const lu = Math.hypot(u.x, u.z)
    u = lu > 1e-6 ? { x: u.x / lu, y: 0, z: u.z / lu } : { x: 1, y: 0, z: 0 }
    const w = { x: k.y * u.z - k.z * u.y, y: k.z * u.x - k.x * u.z, z: k.x * u.y - k.y * u.x }
    const r = this.radius.value
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * 2 * Math.PI
      const c = Math.cos(a) * r
      const s = Math.sin(a) * r
      return { x: u.x * c + w.x * s, y: u.y * c + w.y * s, z: u.z * c + w.z * s }
    })
    pts.push(pts[0]!)
    return pts
  }

  /** A symbol's visible curves, grain-local (its own scale, turn and place). Default: the type's. */
  symbolCurves(sym: SolidDrawing | undefined = this.symbol): Vec3Like[][] {
    if (!sym) return []
    const drawing = sym.drawing()
    const pk = this.placeKey(sym).join(",")
    const memo = this.curveMemo.get(sym)
    if (memo && memo.drawing === drawing && memo.pk === pk) return memo.curves
    const s = sym.scale.value
    const [x, y, z, p, h, b] = [sym.x.value, sym.y.value, sym.z.value, sym.p.value, sym.h.value, sym.b.value]
    const turned = p !== 0 || h !== 0 || b !== 0
    const curves = drawing.lines.map((l) =>
      l.map((q) => {
        const r = turned ? rotHPB({ x: q.x * s, y: q.y * s, z: q.z * s }, p, h, b) : { x: q.x * s, y: q.y * s, z: q.z * s }
        return { x: r.x + x, y: r.y + y, z: r.z + z }
      }),
    )
    this.curveMemo.set(sym, { drawing, pk, curves })
    return curves
  }
  private curveMemo = new Map<SolidDrawing, { drawing: object; pk: string; curves: Vec3Like[][] }>()

  /** What a symbol's grain-local curves depend on, besides its own signature. */
  private placeKey(sym: SolidDrawing): number[] {
    return [sym.scale.value, sym.x.value, sym.y.value, sym.z.value, sym.p.value, sym.h.value, sym.b.value]
  }

  /** The dot → symbol plan, re-planned only when the view of it or the symbol changes. */
  plan(): MorphPlan | undefined {
    const sym = this.symbol
    if (!sym) return undefined
    const k = this.toward()
    const drawing = sym.drawing()
    let plans = DOT_PLANS.get(drawing)
    if (!plans) DOT_PLANS.set(drawing, (plans = new Map()))
    const key = `${this.radius.value}|${this.placeKey(sym).join(",")}|${k.x},${k.y},${k.z}`
    return remember(plans, key, () => planMorph([this.dotOutline()], this.symbolCurves(), { normal: k }))
  }

  /** The type → item plan (rung 2 → 3), re-planned only when either drawing or the view changes. */
  itemPlan(): MorphPlan | undefined {
    const a = this.symbol
    const b = this.item
    if (!a || !b) return undefined
    const k = this.toward()
    const da = a.drawing()
    const db = b.drawing()
    let byItem = ITEM_PLANS.get(da)
    if (!byItem) ITEM_PLANS.set(da, (byItem = new WeakMap()))
    let plans = byItem.get(db)
    if (!plans) byItem.set(db, (plans = new Map()))
    const key = `${this.placeKey(a).join(",")}|${this.placeKey(b).join(",")}|${k.x},${k.y},${k.z}`
    return remember(plans, key, () => planMorph(this.symbolCurves(a), this.symbolCurves(b), { normal: k }))
  }

  /** The morph's curves at the current rung — empty unless mid-morph. */
  pieces(): Vec3Like[][] {
    const g = this.rung()
    const ph = grainPhases(g)
    if (g > 1 && g < 2) {
      if (ph.fillIn > 0 || !this.symbol) return []
      const plan = this.plan()
      return plan ? blendPlan(plan, ph.morph, 0.5) : []
    }
    // The type's symbol becoming the exact item's: like shapes, so every
    // point travels straight (no lag) — the reel simply takes its size.
    if (g > 2 && g < 3 && this.item && ph.item.fillOut >= 1 && ph.item.fillIn <= 0) {
      const plan = this.itemPlan()
      return plan ? blendPlan(plan, ph.item.morph, 0) : []
    }
    return []
  }

  /**
   * What the grain's own lines draw: the morph's pieces while it travels,
   * and at rest the symbol's visible edges themselves — the symbols keep
   * only their fills (lineSlots 0), so a grain mounts one pool of lines,
   * not two.
   */
  ink(): Vec3Like[][] {
    const g = this.rung()
    if (g <= 1 || !this.symbol) return []
    const ph = grainPhases(g)
    const moving = this.pieces()
    if (moving.length) return moving
    if (g < 2) return ph.fillIn > 0 ? this.symbolCurves() : []
    if (this.item && g > 2) return ph.item.fillOut < 1 ? this.symbolCurves() : this.symbolCurves(this.item)
    return this.symbolCurves()
  }

  protected override compose(): void {
    const { observer, symbol, label, item } = this.opts
    // Read by every slot each frame: once per param epoch.
    const phases = memoReads(() => grainPhases(this.rung()))
    // With an item symbol the type's symbol hands over to it on 2 → 3.
    const typeFill = () => {
      const ph = phases()
      return item && this.rung() > 2 ? 1 - ph.item.fillOut : ph.fillIn
    }
    const typeShown = () => {
      const ph = phases()
      if (item && this.rung() > 2) return ph.item.fillOut < 1
      return ph.fillIn > 0
    }

    // The symbol first: its solid fills paint under every line.
    if (symbol) {
      const sym = symbol({
        observer,
        shareViews: VIEW_STEP,
        // One (empty) line slot, not none: a Stroke whose parts are ALL closed
        // Lines is washed by the host as one even-odd drawing, which would
        // swallow the fills.
        lineSlots: 1,
        // Faces as a few depth-writing Surfaces, not a fill Line per face.
        solidFaces: true,
        stroke: this.stroke,
        tint: this.tint,
        fillOpacity: derive(typeFill),
        opacity: derive(() => (typeShown() ? this.opacity.value : 0)),
      })
      const { extent, bottom } = boundsOf(sym)
      const place = (s: SolidDrawing, low: number) => {
        // Scaled by the TYPE's extent, so an item's own dimensions show.
        s.scale.follow(derive(() => this.size.value / extent))
        if (this.opts.stand) s.y.follow(derive(() => (-low * this.size.value) / extent))
        // The material is the category's colour, when the symbol has one.
        const material = (s as unknown as Record<string, unknown>).material
        if (material instanceof Param) (material as Param<Color>).follow(derive(() => this.dotTint()))
      }
      place(sym, bottom)
      this.symbol = sym
      this.add(sym)
      if (item) {
        const exact = item({
          observer,
          shareViews: VIEW_STEP,
          // One (empty) line slot, not none: a Stroke whose parts are ALL closed
          // Lines is washed by the host as one even-odd drawing, which would
          // swallow the fills.
          lineSlots: 1,
          // Faces as a few depth-writing Surfaces, not a fill Line per face.
          solidFaces: true,
          stroke: this.stroke,
          tint: this.tint,
          fillOpacity: derive(() => phases().item.fillIn),
          opacity: derive(() => (this.rung() > 2 && phases().item.fillIn > 0 ? this.opacity.value : 0)),
        })
        place(exact, boundsOf(exact).bottom)
        this.item = exact
        this.add(exact)
      }
    }

    // The dot: a filled disc facing the viewer, in the colour of its rung —
    // its own fill, or one disc in a shared DotPool.
    if (this.opts.dots) this.opts.dots.join(this)
    else {
      const dot = new Line({
        stroke: 0,
        tint: derive(() => this.dotTint()),
        fillOpacity: derive(() => 1 - phases().fillOut),
        opacity: derive(() => (this.rung() < 2 ? this.opacity.value : 0)),
      })
      derivePoints(dot, () => [...Object.values(this.toward()), this.radius.value], () => this.dotOutline())
      this.add(dot)
    }

    // The grain's lines, grain-local: the morph's pieces, or at rest the
    // symbol's own edges (see `ink`).
    let version = 0
    let lastKey = ""
    const piecesNow = () => this.ink()
    let memo: Vec3Like[][] = []
    const current = memoReads((): Vec3Like[][] => {
      const ids = [this.symbol, this.item].map((s) => (s && s.opacity.value > 0 ? drawingId(s.drawing()) : 0))
      const key = `${this.rung()}|${this.radius.value}|${this.size.value}|${Object.values(this.toward()).join(",")}|${ids.join(",")}`
      if (key !== lastKey) {
        lastKey = key
        memo = piecesNow()
        version++
      }
      return memo
    })
    const inkTint = memoReads(
      (): Color => (this.rung() > 2 ? this.tint.value : mixColor(this.dotTint(), this.tint.value, phases().morph)),
    )
    if (symbol) {
      // ONE stroke for all of it (src/parts/polylines.ts): every piece and
      // edge a loop of the same ribbon, so a flow of hundreds of grains
      // mounts hundreds of strokes, not tens of thousands.
      const pool = new Polylines({ stroke: this.stroke, tint: derive(inkTint), opacity: this.opacity })
      deriveLoops(pool, () => (current(), [version]), () => current())
      this.add(pool)
    }

    // The name, under the symbol, facing the viewer.
    if (label) {
      const text = new Text({
        content: label,
        size: derive(() => this.size.value * 0.2),
        tint: WHITE,
        align: "left",
        // Beside the symbol, up and to the right (a flow runs on, so the
        // next particle is ahead, not above).
        x: derive(() => this.size.value * 0.58),
        y: derive(() => (this.opts.stand ? 0.85 : 0.35) * this.size.value),
        creation: derive(() => phases().label),
        opacity: this.opacity,
      })
      this.label = text
      // Turned to the viewer as seen from THIS grain's frame (Ry(h)·Rx(p)
      // carries +z onto the local view direction), so it reads under any
      // parent — a flow that turns its particles along its channel, a stack.
      const tilt = new Group({ members: [text], p: derive(() => -Math.asin(Math.max(-1, Math.min(1, this.toward().y)))) })
      this.add(new Group({ members: [tilt], h: derive(() => Math.atan2(this.toward().x, this.toward().z)) }))
    }
  }

  /** Walkable (src/automaton.ts): the rung of knowledge — mass · category · type · item. */
  override stateSpace(): StateSpace | undefined {
    if (this.grain.isBound) return undefined
    return {
      axes: [
        axis(
          "grain",
          this,
          { mass: { grain: RUNG.mass }, category: { grain: RUNG.category }, type: { grain: RUNG.type }, item: { grain: RUNG.item } },
          { duration: 1.2, handles: [this] },
        ),
      ],
    }
  }
}


// ─── Many dots, one mesh ────────────────────────────────────────────

/** A holon's scale in the world: the product of every scale up its chain. */
const worldScale = (h: Holon): number => {
  let s = 1
  for (let n: Holon | undefined = h; n; n = n.parent) s *= Math.abs(n.scale.value)
  return s
}

/** Disc vertices per dot (one centre + this many around). */
const POOL_SEGMENTS = 48

/**
 * DotPool — every dot of a flow as ONE fill mesh.
 *
 * A Grain's dot is a filled disc; a flow of hundreds of grains as hundreds
 * of fills is hundreds of draws. A DotPool is one Surface (a transparent
 * sheet) holding all its members' discs, each facing the camera at its
 * grain's place and size, each at its own opacity through the Surface's
 * per-vertex `alphas` — the grain's own seen opacity (its fade, the
 * presence and the certainty ghost of its whole chain, certainty.ts
 * seenOpacity) over the pool's (which the host already applies), times
 * its dot's fill (gone once the symbol morph starts).
 * The tint is the members' dot colour (a flow's grains share their rung
 * and category). A dot at zero is left out of the mesh.
 *
 * The discs are drawn in member order within the one mesh, so where two
 * dots of a flow overlap at partial opacity the later one composites over
 * the earlier — as their separate fills did, in attach order.
 *
 * An uncertain dot keeps its own PROBABILITY CLOUD: the host's echo
 * recipe (render/superposition.ts — ECHOES discs, each orbiting
 * CLOUD_PX·(1 − c) pixels off, a little larger, faint and breathing) is
 * drawn into the same mesh, right after its dot, at its own seed — so the
 * dots of a flow shimmer independently, as their separate fills did. The
 * cloud's clock is `time` (the flow's; scene seconds), 0 without one.
 *
 * Place it in a frame that holds the flow (FlowMap's Flow; a Stream's
 * parent) and hand it to each Grain as `dots`.
 */
export class DotPool extends Surface {
  private crowd!: { grains: Grain[]; observer?: Observer; time?: Readable<number> }
  // The seen-opacity readers (certainty.ts), made at the first build — the
  // tree is final by then.
  private seen?: { pool: Readable<number>; members: Map<Grain, Readable<number>> }

  constructor(overrides: Overrides & { observer?: Observer; time?: Readable<number> } = {}) {
    const { observer, time, ...rest } = overrides
    super(rest)
    this.crowd = { grains: [], observer, time }
    this.tint.follow(derive(() => this.crowd.grains[0]?.dotTint() ?? NEUTRAL))
    const now = memoReads(() => this.build())
    let last: unknown
    let version = 0
    Object.defineProperty(this, "geomVersion", {
      configurable: true,
      get: () => {
        const m = now()
        if (m !== last) {
          last = m
          version++
        }
        return version
      },
      set() {},
    })
    Object.defineProperty(this, "positions", { configurable: true, get: () => now().positions, set() {} })
    Object.defineProperty(this, "indices", { configurable: true, get: () => now().indices, set() {} })
    Object.defineProperty(this, "alphas", { configurable: true, get: () => now().alphas, set() {} })
  }

  /** A grain's dot joins the pool (Grain does this for its `dots` option). */
  join(g: Grain): void {
    this.crowd.grains.push(g)
  }

  /** The members, in drawing order. */
  get members(): readonly Grain[] {
    return this.crowd.grains
  }

  private build(): { positions: Float32Array; indices: Uint32Array; alphas: Float32Array } {
    const o = this.crowd.observer
    const view = localView(this, o ? viewOf(o) : { eye: { x: 0, y: 0, z: 1500 } })
    const scale = worldScale(this) || 1
    // What the host already applies to the pool (its presence and the ghost
    // of its certainty), divided out of each member's own seen opacity —
    // so a dot carries exactly its grain's fade, presence (a fiber's focus)
    // and certainty, however they differ along the flow.
    this.seen ??= { pool: seenOpacity(this), members: new Map() }
    const poolSeen = this.seen.pool.value
    if (poolSeen <= 0) return { positions: new Float32Array(0), indices: new Uint32Array(0), alphas: new Float32Array(0) }
    const seenOf = (g: Grain): number => {
      let r = this.seen!.members.get(g)
      if (!r) this.seen!.members.set(g, (r = seenOpacity(g)))
      return r.value
    }
    const pos: number[] = []
    const idx: number[] = []
    const alpha: number[] = []
    const n = POOL_SEGMENTS
    const t = this.crowd.time?.value ?? 0
    // Units per screen pixel in this frame (a 720-high frame, as Grain's LOD).
    const upp = (c: Vec3Like): number => {
      if (!o) return 1
      if (o.orthographic.value) return (2 * orthoHalfHeight(o.zoom.value || 1, 16 / 9)) / 720 / scale
      const v = viewOf(o)
      if (!("eye" in v)) return 1
      const p = toWorld(this, c)
      const d = Math.hypot(v.eye.x - p.x, v.eye.y - p.y, v.eye.z - p.z)
      return (2 * d * Math.tan(o.fov.value / 2)) / 720 / scale
    }
    const disc = (cx: number, cy: number, cz: number, u: Vec3Like, w: Vec3Like, r: number, a: number) => {
      const base = pos.length / 3
      pos.push(cx, cy, cz)
      alpha.push(a)
      for (let i = 0; i < n; i++) {
        const th = (i / n) * 2 * Math.PI
        const x = Math.cos(th) * r
        const y = Math.sin(th) * r
        pos.push(cx + u.x * x + w.x * y, cy + u.y * x + w.y * y, cz + u.z * x + w.z * y)
        alpha.push(a)
      }
      for (let i = 0; i < n; i++) idx.push(base, base + 1 + i, base + 1 + ((i + 1) % n))
    }
    this.crowd.grains.forEach((g, gi) => {
      const fill = g.dotFill()
      if (fill <= 0) return
      const sure = certaintyOf(g)
      const a = (seenOf(g) * fill) / poolSeen
      if (a <= 0) return
      const c = toLocal(this, toWorld(g, { x: 0, y: 0, z: 0 }))
      // Facing the viewer from the dot's own place (the grain's rule, in
      // the pool's frame): u ⟂ up and the view, w up on screen.
      const d = "eye" in view ? { x: view.eye.x - c.x, y: view.eye.y - c.y, z: view.eye.z - c.z } : view.toward
      const l = Math.hypot(d.x, d.y, d.z) || 1
      const k = snapDirection({ x: d.x / l, y: d.y / l, z: d.z / l })
      let u = { x: k.z, y: 0, z: -k.x }
      const lu = Math.hypot(u.x, u.z)
      u = lu > 1e-6 ? { x: u.x / lu, y: 0, z: u.z / lu } : { x: 1, y: 0, z: 0 }
      const w = { x: k.y * u.z - k.z * u.y, y: k.z * u.x - k.x * u.z, z: k.x * u.y - k.y * u.x }
      const r = (g.radius.value * worldScale(g)) / scale
      disc(c.x, c.y, c.z, u, w, r, a)
      // Its probability cloud, right after it (superposition.ts's recipe).
      const doubt = 1 - (sure <= 0 ? 0 : sure >= 1 ? 1 : sure)
      if (doubt <= 0) return
      const unit = upp(c)
      const seed = gi + 1
      for (let k = 0; k < ECHOES; k++) {
        const off = echoOffset(k, seed, t, CLOUD_PX * doubt)
        const ox = off.x * unit
        const oy = off.y * unit
        disc(c.x + u.x * ox + w.x * oy, c.y + u.y * ox + w.y * oy, c.z + u.z * ox + w.z * oy, u, w, r * (1 + 0.9 * doubt), a * doubt * 0.24 * echoBreath(k, seed, t))
      }
    })
    return { positions: new Float32Array(pos), indices: new Uint32Array(idx), alphas: new Float32Array(alpha) }
  }
}
