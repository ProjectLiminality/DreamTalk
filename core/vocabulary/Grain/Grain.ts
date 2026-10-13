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
 * turns). The dot faces the camera; so does the label (from the
 * observer's phi/theta — a Grain under a ROTATED parent should be carried
 * by a facing carrier, as FlowMap does).
 *
 *     new Grain({ observer: this.observer, category: BLUE,
 *                 symbol: (o) => new FilmReel(o), label: "BOPP film · 2,400 m" })
 */

import { WHITE, rgb, type Color } from "../../src/constants"
import type { Observer } from "../../src/dream"
import type { Overrides } from "../../src/holon"
import { certainty } from "../../src/certainty"
import { Param, completion, derive, length, paramEpoch, scalar } from "../../src/params"
import { Group, Line, Stroke, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { derivePoints, localView, viewOf, type SolidDrawing } from "../../src/parts/soliddrawing"
import { solidBounds, type View } from "../../src/geometry/hiddenline"
import { blendPlan, planMorph, type MorphPlan } from "../../src/geometry/correspond"
import { morphPhases } from "../Morph/MorphCurves"

/** A dot of mass whose kind we do not know — neither white nor any category. */
export const NEUTRAL: Color = rgb(170, 170, 170)

/** The rungs, by name — `grain.to(RUNG.type)` reads as what it says. */
export const RUNG = { mass: 0, category: 1, type: 2, item: 3 } as const

export interface GrainOptions {
  /** The scene's observer — the symbol's edges, the dot and the label face it. */
  observer?: Observer
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
  private planMemo?: { key: number[]; plan: MorphPlan }
  private itemPlanMemo?: { key: number[]; plan: MorphPlan }

  constructor(overrides: Overrides & GrainOptions = {}) {
    const { observer, category, symbol, label, item, neutral, stand, ...rest } = overrides
    super({ stroke: 2.5, ...rest })
    this.opts = { observer, category, symbol, label, item, neutral, stand }
    this.certainty.follow(
      derive(() =>
        rungCertainty(this.grain.value, [
          this.massKnown.value,
          this.categoryKnown.value,
          this.typeKnown.value,
          this.itemKnown.value,
        ]),
      ),
    )
  }

  /** The colour now: neutral → the category's as rung 0 → 1. */
  dotTint(): Color {
    const { category, neutral } = this.opts
    return mixColor(neutral ?? NEUTRAL, category ?? neutral ?? NEUTRAL, grainPhases(this.grain.value).color)
  }

  /** The view, in this grain's frame. */
  private view(): View {
    const o = this.opts.observer
    return localView(this, o ? viewOf(o) : { eye: { x: 0, y: 0, z: 1500 } })
  }

  /** The unit direction toward the viewer, grain-local. */
  private toward(): Vec3Like {
    // Read by every slot of every grain each frame: answered once per
    // param epoch (nothing it reads can change between two equal epochs).
    const e = paramEpoch()
    if (this.towardMemo?.epoch === e) return this.towardMemo.k
    const v = this.view()
    const d = "eye" in v ? v.eye : v.toward
    const l = Math.hypot(d.x, d.y, d.z) || 1
    const k = { x: d.x / l, y: d.y / l, z: d.z / l }
    this.towardMemo = { epoch: e, k }
    return k
  }
  private towardMemo?: { epoch: number; k: Vec3Like }

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

  /** A symbol's visible curves, grain-local (it sits on the y axis, scaled, unturned). Default: the type's. */
  symbolCurves(sym: SolidDrawing | undefined = this.symbol): Vec3Like[][] {
    if (!sym) return []
    const s = sym.scale.value
    const y = sym.y.value
    return sym.drawing().lines.map((l) => l.map((p) => ({ x: p.x * s, y: p.y * s + y, z: p.z * s })))
  }

  /** The dot → symbol plan, re-planned only when the view of it or the symbol changes. */
  plan(): MorphPlan | undefined {
    const sym = this.symbol
    if (!sym) return undefined
    const k = this.toward()
    const key = [this.radius.value, sym.scale.value, sym.y.value, k.x, k.y, k.z, ...sym.signature()]
    const m = this.planMemo
    if (m && m.key.length === key.length && m.key.every((x, i) => x === key[i])) return m.plan
    const plan = planMorph([this.dotOutline()], this.symbolCurves(), { normal: k })
    this.planMemo = { key, plan }
    return plan
  }

  /** The type → item plan (rung 2 → 3), re-planned only when either drawing or the view changes. */
  itemPlan(): MorphPlan | undefined {
    const a = this.symbol
    const b = this.item
    if (!a || !b) return undefined
    const k = this.toward()
    const key = [a.scale.value, a.y.value, b.scale.value, b.y.value, k.x, k.y, k.z, ...a.signature(), -1, ...b.signature()]
    const m = this.itemPlanMemo
    if (m && m.key.length === key.length && m.key.every((x, i) => x === key[i])) return m.plan
    const plan = planMorph(this.symbolCurves(a), this.symbolCurves(b), { normal: k })
    this.itemPlanMemo = { key, plan }
    return plan
  }

  /** The morph's curves at the current rung — empty unless mid-morph. */
  pieces(): Vec3Like[][] {
    const g = this.grain.value
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

  protected override compose(): void {
    const { observer, symbol, label, item } = this.opts
    const phases = () => grainPhases(this.grain.value)
    // With an item symbol the type's symbol hands over to it on 2 → 3.
    const typeFill = () => {
      const ph = phases()
      return item && this.grain.value > 2 ? 1 - ph.item.fillOut : ph.fillIn
    }
    const typeShown = () => {
      const ph = phases()
      if (item && this.grain.value > 2) return ph.item.fillOut < 1
      return ph.fillIn > 0
    }

    // The symbol first: its solid fills paint under every line.
    if (symbol) {
      const sym = symbol({
        observer,
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
          stroke: this.stroke,
          tint: this.tint,
          fillOpacity: derive(() => phases().item.fillIn),
          opacity: derive(() => (this.grain.value > 2 && phases().item.fillIn > 0 ? this.opacity.value : 0)),
        })
        place(exact, boundsOf(exact).bottom)
        this.item = exact
        this.add(exact)
      }
    }

    // The dot: a filled disc facing the viewer, in the colour of its rung.
    const dot = new Line({
      stroke: 0,
      tint: derive(() => this.dotTint()),
      fillOpacity: derive(() => 1 - phases().fillOut),
      opacity: derive(() => (this.grain.value < 2 ? this.opacity.value : 0)),
    })
    derivePoints(dot, () => [...Object.values(this.toward()), this.radius.value], () => this.dotOutline())
    this.add(dot)

    // The morph in flight: one Line per piece, grain-local. One dot outline
    // into M curves makes at most 1 + M pieces; M is read for the view at
    // construction, with room for a view that shows a few more spans (a
    // flow may carry hundreds of grains — every slot is a mounted line).
    const capacity = symbol ? 16 + this.symbolCurves().length + (this.item ? this.symbolCurves(this.item).length : 0) : 0
    let version = 0
    let lastKey = ""
    const piecesNow = () => this.pieces()
    let memo: Vec3Like[][] = []
    let lastEpoch = -1
    const current = () => {
      const e = paramEpoch()
      if (e === lastEpoch) return memo
      lastEpoch = e
      const key = `${this.grain.value}|${this.radius.value}|${this.size.value}|${Object.values(this.toward()).join(",")}`
      if (key !== lastKey) {
        lastKey = key
        memo = piecesNow()
        version++
      }
      return memo
    }
    for (let i = 0; i < capacity; i++) {
      const slot = new Line({
        stroke: this.stroke,
        tint: derive(() => (this.grain.value > 2 ? this.tint.value : mixColor(this.dotTint(), this.tint.value, phases().morph))),
        opacity: derive(() => (current()[i] ? this.opacity.value : 0)),
      })
      derivePoints(slot, () => (current(), [version]), () => current()[i] ?? [])
      this.add(slot)
    }

    // The name, under the symbol, facing the viewer.
    if (label) {
      const text = new Text({
        content: label,
        size: derive(() => this.size.value * 0.2),
        tint: WHITE,
        y: derive(() => (this.opts.stand ? -0.3 : -0.74) * this.size.value),
        creation: derive(() => phases().label),
        opacity: this.opacity,
      })
      this.label = text
      const tilt = new Group({ members: [text], p: derive(() => -(observer?.theta.value ?? 0)) })
      this.add(new Group({ members: [tilt], h: derive(() => observer?.phi.value ?? 0) }))
    }
  }
}

