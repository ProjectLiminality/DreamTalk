/**
 * SolidDrawing — a 3D thing drawn the platonic way: a fill colour and the
 * visible edges, as real 3D strokes, recomputed for wherever the camera is.
 *
 * A subclass states its SOLIDS (boxes and capped cylinders, in its own
 * local space) as a function of its params; this base turns them into
 * strokes and fills every frame through geometry/hiddenline.ts:
 *
 *   - visible edges and contour generators → a pool of stroke Lines,
 *     bound to this holon's tint / stroke / opacity;
 *   - visible faces of filled solids → a pool of closed fill Lines
 *     (stroke 0, fillOpacity bound), drawn back to front and BEFORE every
 *     edge, so the solids' fills occlude each other by the painter's rule
 *     and never cover a line.
 *
 * The view is read from the scene's Observer (pass `observer:` at
 * construction — the Dream's `this.observer`), with the host camera's own
 * placement rule (`viewOf`, mirroring three-host.ts syncCamera). Without
 * one the default observer's view is used.
 *
 * And `worldCurves()` hands the same visible curves out in world space —
 * which is what lets a morph (vocabulary/Morph, MorphCurves) land on what
 * the camera actually sees of this solid.
 */

import type { Observer } from "../dream"
import type { Overrides } from "../holon"
import type { Color } from "../constants"
import { BLACK } from "../constants"
import { derive, paramEpoch, type Readable } from "../params"
import { ghost, seenCertainty } from "../certainty"
import { Line, Stroke, derivePoints, type Vec3Like } from "./primitives"
import { Surface } from "./surface"
import { hiddenLineDrawing, type Drawing, type Solid, type View } from "../geometry/hiddenline"
import { localView, toWorld, viewOf } from "../geometry/frames"
import type { Holon } from "../holon"

/** Re-exported for the holons that import it from here (it lives beside Line). */
export { derivePoints }

// ─── The view ───────────────────────────────────────────────────────
// viewOf / toWorld / toLocal / localView live in src/geometry/frames.ts
// (the one implementation); re-exported here for this module's importers.
export { viewOf, toWorld, toLocal, localView } from "../geometry/frames"

const EMPTY: Drawing = { lines: [], faces: [] }

/**
 * An empty face slot is a closed loop of zero area, never an empty line:
 * the host gives a Line its fill only if it is a closed loop when the
 * scene mounts (three-host's wash gate), and a solid that is hidden at
 * mount — a truck waiting to be morphed into — must still own its fills.
 */
const ORIGIN = { x: 0, y: 0, z: 0 }
const NO_FACE: Vec3Like[] = [ORIGIN, ORIGIN, ORIGIN, ORIGIN]

// ─── The holon ──────────────────────────────────────────────────────

export interface SolidDrawingOptions {
  /** The scene's observer — whose view decides what is visible. */
  observer?: Observer
  /** Stroke slots (visible edge spans). Default 64. */
  lineSlots?: number
  /** Fill slots (visible faces). Default 32. */
  faceSlots?: number
  /**
   * Snap the eye to a grid of this many RADIANS (and the distance to the
   * same relative step) and keep every drawing made — so a solid that
   * moves (a truck driving through a lens) recomputes its hidden lines
   * once per bucket, and a looping flow not at all after its first lap.
   * The drawing is then exact for a camera at most half a bucket away:
   * 0.01 rad is invisible at symbol size. 0 (default) = exact, no cache.
   */
  viewBucket?: number
  /**
   * SHARE drawings across every SolidDrawing of the same class and solids:
   * the view is taken as a DIRECTION from this solid's centre (an
   * orthographic view of the solid alone — exact for small symbols, whose
   * perspective within themselves is negligible), snapped to a grid of
   * this many radians, and the drawing kept in one cache for all
   * instances. Hundreds of particles that are all pallets then cost a
   * handful of hidden-line solves, under any camera, however they move.
   * 0 (default) = off.
   */
  shareViews?: number
  /**
   * Draw the faces of boxes, cylinders and panels as a few opaque,
   * DEPTH-WRITING Surfaces — one per group of solids sharing a fill colour
   * at construction — instead of one painter-ordered fill Line per face.
   * Occlusion between the faces is then exact (the GPU's depth test), and
   * a drawing costs two or three meshes rather than twenty: what lets
   * hundreds of symbols ride a flow. The fills dim toward black with
   * `fillOpacity` exactly as the painter faces do. Default false.
   */
  solidFaces?: boolean
}

/** A mesh's identity for the signature: meshes are data — a new array is a new shape. */
const meshIds = new WeakMap<object, number>()
let nextMeshId = 1
const meshId = (positions: object): number => {
  let id = meshIds.get(positions)
  if (id === undefined) meshIds.set(positions, (id = nextMeshId++))
  return id
}

const flattenSolids = (solids: readonly Solid[]): number[] =>
  solids.flatMap((s) => {
    const fill = s.fill ? [s.fill.r, s.fill.g, s.fill.b] : [-1, -1, -1]
    if (s.kind === "mesh") return [3, meshId(s.positions), meshId(s.triangles), s.crease ?? -1, ...fill]
    if (s.kind === "panel")
      return [2, s.center.x, s.center.y, s.center.z, s.size.x, s.size.y, s.size.z, s.normal.x, s.normal.y, s.normal.z, ...fill]
    return s.kind === "box"
      ? [0, s.center.x, s.center.y, s.center.z, s.size.x, s.size.y, s.size.z, ...fill]
      : [1, s.center.x, s.center.y, s.center.z, s.radius, s.height, "xyz".indexOf(s.axis), ...fill]
  })

/** Drawings shared across instances (`shareViews`), by class, solids and view bucket. */
const SHARED = new Map<string, Drawing>()
const SHARED_MAX = 4096

/** The direction toward the viewer from a solid's centre, local — snapped to `step` radians. */
const sharedDirection = (d: SolidDrawing, step: number): { az: number; el: number } => {
  const v = localView(d, d.view())
  const t = "eye" in v ? v.eye : v.toward
  const r = Math.hypot(t.x, t.y, t.z) || 1
  return { az: Math.round(Math.atan2(t.x, t.z) / step), el: Math.round(Math.asin(Math.max(-1, Math.min(1, t.y / r))) / step) }
}

const sharedDrawing = (d: SolidDrawing, step: number): Drawing => {
  const { az, el } = sharedDirection(d, step)
  const solids = d.solids()
  const key = `${d.constructor.name}|${step}|${az}|${el}|${flattenSolids(solids).join(",")}`
  let drawing = SHARED.get(key)
  if (!drawing) {
    const A = az * step
    const E = el * step
    drawing = hiddenLineDrawing(solids, { toward: { x: Math.cos(E) * Math.sin(A), y: Math.sin(E), z: Math.cos(E) * Math.cos(A) } })
    if (SHARED.size >= SHARED_MAX) SHARED.delete(SHARED.keys().next().value!)
    SHARED.set(key, drawing)
  }
  return drawing
}

export abstract class SolidDrawing extends Stroke {
  /** The solids, in local space — the subclass's whole job. */
  abstract solids(): Solid[]

  // Off the field scan (a reference, not a part — registering the
  // observer would reparent it).
  private seen!: { observer?: Observer; lineSlots: number; faceSlots: number; viewBucket: number; shareViews: number; solidFaces: boolean }
  private buckets = new Map<string, Drawing>()
  private memo?: { key: number[]; drawing: Drawing }
  private memoEpoch = -1

  constructor(overrides: Overrides & SolidDrawingOptions = {}) {
    const { observer, lineSlots, faceSlots, viewBucket, shareViews, solidFaces, ...rest } = overrides
    // A solid drawing is filled unless told otherwise — the fill colours
    // are its solids' own; fillOpacity is how much of them shows.
    super({ fillOpacity: 1, ...rest })
    this.seen = { observer, lineSlots: lineSlots ?? 64, faceSlots: faceSlots ?? 32, viewBucket: viewBucket ?? 0, shareViews: shareViews ?? 0, solidFaces: solidFaces ?? false }
  }

  /** The observer it is drawn for (a morph reads it to see as the camera does). */
  get observer(): Observer | undefined {
    return this.seen.observer
  }

  /** The world-space view this drawing is seen from. */
  view(): View {
    return this.seen.observer ? viewOf(this.seen.observer) : { eye: { x: 0, y: 0, z: 1500 } }
  }

  /**
   * Everything the drawing depends on, as numbers — the local view and
   * the solids. (A morph adds the transform chain for world space.)
   */
  signature(): number[] {
    const v = localView(this, this.view())
    const vk = "eye" in v ? [0, v.eye.x, v.eye.y, v.eye.z] : [1, v.toward.x, v.toward.y, v.toward.z]
    return [...vk, ...flattenSolids(this.solids())]
  }

  /** The visible drawing in LOCAL space, memoised on the view and the solids. */
  drawing(): Drawing {
    const epoch = paramEpoch()
    if (this.memo && this.memoEpoch === epoch) return this.memo.drawing
    this.memoEpoch = epoch
    const share = this.seen.shareViews
    if (share > 0) {
      const drawing = sharedDrawing(this, share)
      this.memo = { key: [], drawing }
      return drawing
    }
    const key = this.signature()
    const m = this.memo
    if (!m || m.key.length !== key.length || key.some((x, i) => x !== m.key[i])) {
      const view = localView(this, this.view())
      const b = this.seen.viewBucket
      if (b > 0 && "eye" in view) {
        const { x, y, z } = view.eye
        const r = Math.hypot(x, y, z) || 1
        const q = (v: number, step: number) => Math.round(v / step) * step
        const az = q(Math.atan2(x, z), b)
        const el = q(Math.asin(Math.max(-1, Math.min(1, y / r))), b)
        const rr = Math.exp(q(Math.log(r), b))
        const bucket = `${az.toFixed(6)}|${el.toFixed(6)}|${rr.toFixed(3)}|${flattenSolids(this.solids()).join(",")}`
        let drawing = this.buckets.get(bucket)
        if (!drawing) {
          const eye = { x: rr * Math.cos(el) * Math.sin(az), y: rr * Math.sin(el), z: rr * Math.cos(el) * Math.cos(az) }
          drawing = hiddenLineDrawing(this.solids(), { eye })
          if (this.buckets.size > 512) this.buckets.delete(this.buckets.keys().next().value!)
          this.buckets.set(bucket, drawing)
        }
        this.memo = { key, drawing }
      } else this.memo = { key, drawing: hiddenLineDrawing(this.solids(), view) }
    }
    return this.memo!.drawing
  }

  /** The visible curves in WORLD space — what a morph lands on. */
  worldCurves(): Vec3Like[][] {
    return this.drawing().lines.map((l) => l.map((p) => toWorld(this, p)))
  }

  protected override compose(): void {
    // Fills first: they take the earlier render order, so every edge
    // draws over every fill (hiddenline already removed the hidden ones).
    if (this.seen.solidFaces) this.composeSolidFaces()
    for (let i = 0; i < (this.seen.solidFaces ? 0 : this.seen.faceSlots); i++) {
      // A solid stays SOLID while its fill fades: the fill dims toward the
      // black ground (colour × fillOpacity) at full coverage, rather than
      // turning translucent — a translucent cab would show the cargo's
      // blue through itself, since each face fades on its own and the
      // host has no per-holon layer to fade them as one. Exact on the
      // black ground every DreamTalk scene stands on; at fillOpacity 0
      // the fills are gone and only the lines remain.
      const slot = new Line({
        stroke: 0,
        tint: derive((): Color => {
          const c = this.shown().faces[i]?.fill ?? BLACK
          const k = this.fillOpacity.value
          return { r: c.r * k, g: c.g * k, b: c.b * k }
        }),
        fillOpacity: derive(() => (this.fillOpacity.value > 0 ? 1 : 0)),
        opacity: this.opacity,
      })
      derivePoints(slot, () => [this.drawingVersion()], () => this.shown().faces[i]?.points ?? NO_FACE)
      this.add(slot)
    }
    // Filled meshes: one opaque, depth-writing Surface each (their fill
    // occludes by depth, not by painting order), sized by the solids the
    // drawing declares now.
    const meshes = this.solids().filter((x) => x.kind === "mesh" && x.fill).length
    for (let i = 0; i < meshes; i++) {
      const surface = new Surface({
        solid: true,
        tint: derive((): Color => {
          const c = this.drawing().surfaces?.[i]?.fill ?? BLACK
          const k = this.solidDim()
          return { r: c.r * k, g: c.g * k, b: c.b * k }
        }),
        fillOpacity: derive(() => (this.fillOpacity.value > 0 ? 1 : 0)),
        opacity: this.opacity,
      })
      deriveSurface(surface, () => {
        const m = this.drawing().surfaces?.[i]
        return m ? [meshId(m.positions), meshId(m.triangles)] : [0, 0]
      }, () => this.drawing().surfaces?.[i])
      this.add(surface)
    }
    for (let i = 0; i < this.seen.lineSlots; i++) {
      const slot = new Line({ tint: this.tint, stroke: this.stroke, opacity: this.opacity })
      derivePoints(slot, () => [this.drawingVersion()], () => this.shown().lines[i] ?? [])
      this.add(slot)
    }
  }

  /**
   * How much of a SOLID surface's colour shows. A depth-writing solid is
   * opaque — the host ignores its opacity — so everything that would fade
   * it dims it toward the black ground instead: the fill (`fillOpacity`),
   * the holon's own fade (`opacity`, a particle at the end of its run),
   * and its inherited certainty (the ghost, src/certainty.ts). Painter
   * faces get the last two from the host; solids must say them here.
   */
  private solidDim(): number {
    if (this.sure === null) this.sure = seenCertainty(this)
    return this.fillOpacity.value * this.opacity.value * (this.sure ? ghost(this.sure.value) : 1)
  }
  // The inherited certainty, captured at the first frame (the chain is final by then).
  private sure: Readable<number> | undefined | null = null

  /**
   * `solidFaces`: the faces grouped by their solids' fill colour at
   * construction, each group one depth-writing Surface whose tint is its
   * first solid's live fill (× fillOpacity, dimming toward black).
   */
  private composeSolidFaces(): void {
    const solids = this.solids()
    const groupOf: number[] = []
    const firsts: number[] = []
    const keys: string[] = []
    solids.forEach((s, i) => {
      if (s.kind === "mesh" || !s.fill) return (groupOf[i] = -1)
      const k = `${s.fill.r},${s.fill.g},${s.fill.b}`
      let g = keys.indexOf(k)
      if (g < 0) {
        g = keys.push(k) - 1
        firsts.push(i)
      }
      groupOf[i] = g
    })
    firsts.forEach((first, g) => {
      const surface = new Surface({
        solid: true,
        tint: derive((): Color => {
          const c = this.solids()[first]?.fill ?? BLACK
          const k = this.solidDim()
          return { r: c.r * k, g: c.g * k, b: c.b * k }
        }),
        fillOpacity: derive(() => (this.fillOpacity.value > 0 ? 1 : 0)),
        opacity: this.opacity,
      })
      deriveSurface(surface, () => [this.drawingVersion()], () => faceMesh(this.shown(), groupOf, g))
      this.add(surface)
    })
  }

  /**
   * What the slots draw: the drawing, or nothing while unseen — a hidden
   * solid computes nothing for its own slots (a fleet of hidden trucks
   * riding a lens must not each run hidden-line removal). `worldCurves()`
   * still answers, since a morph reads a target before it is shown.
   */
  private shown(): Drawing {
    return this.opacity.value <= 0 ? EMPTY : this.drawing()
  }

  // A counter that moves exactly when the memo is rebuilt — the slots'
  // shared dirty key, so 96 slots compare one integer, not the drawing.
  private version = 0
  private lastDrawing?: Drawing
  private drawingVersion(): number {
    const d = this.shown()
    if (d !== this.lastDrawing) {
      this.lastDrawing = d
      this.version++
    }
    return this.version
  }
}

/**
 * A Surface whose triangles are a derived reading: recomputed (and its
 * geomVersion bumped) only when `key` changes — derivePoints for meshes.
 */
/** One group's faces as a triangle mesh (fans — every face is convex), cached per drawing. */
const FACE_MESHES = new WeakMap<Drawing, Map<string, { positions: Vec3Like[]; triangles: [number, number, number][] }>>()
const faceMesh = (
  d: Drawing,
  groupOf: readonly number[],
  g: number,
): { positions: Vec3Like[]; triangles: [number, number, number][] } => {
  let byGroup = FACE_MESHES.get(d)
  if (!byGroup) FACE_MESHES.set(d, (byGroup = new Map()))
  const key = `${g}|${groupOf.join(",")}`
  let m = byGroup.get(key)
  if (m) return m
  const positions: Vec3Like[] = []
  const triangles: [number, number, number][] = []
  for (const f of d.faces) {
    if (groupOf[f.solid] !== g) continue
    // A face is a closed polygon whose last point repeats its first.
    const n = f.points.length - 1
    if (n < 3) continue
    const base = positions.length
    for (let i = 0; i < n; i++) positions.push(f.points[i]!)
    for (let i = 1; i + 1 < n; i++) triangles.push([base, base + i, base + i + 1])
  }
  m = { positions, triangles }
  byGroup.set(key, m)
  return m
}

const deriveSurface = (
  surface: Surface,
  key: () => readonly number[],
  compute: () => { positions: readonly Vec3Like[]; triangles: readonly (readonly [number, number, number])[] } | undefined,
): void => {
  let last: readonly number[] | undefined
  let version = 0
  let positions = new Float32Array(0)
  let indices = new Uint32Array(0)
  const refresh = () => {
    const k = key()
    if (last && last.length === k.length && k.every((v, i) => v === last![i])) return
    last = k
    const m = compute()
    positions = new Float32Array(m ? m.positions.flatMap((p) => [p.x, p.y, p.z]) : [])
    indices = new Uint32Array(m ? m.triangles.flat() : [])
    version++
  }
  Object.defineProperty(surface, "geomVersion", { configurable: true, get: () => (refresh(), version), set() {} })
  Object.defineProperty(surface, "positions", { configurable: true, get: () => (refresh(), positions), set() {} })
  Object.defineProperty(surface, "indices", { configurable: true, get: () => (refresh(), indices), set() {} })
}
