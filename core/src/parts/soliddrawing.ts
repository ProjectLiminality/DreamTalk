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
import { derive } from "../params"
import { Line, Stroke, type Vec3Like } from "./primitives"
import { invRotHPB, rotHPB } from "./curves"
import { hiddenLineDrawing, type Drawing, type Solid, type View } from "../geometry/hiddenline"
import type { Holon } from "../holon"

// ─── The view ───────────────────────────────────────────────────────

/**
 * Where an Observer sees from, in world space — the host's camera
 * placement (three-host.ts syncCamera), restated as plain arithmetic so
 * CPU geometry can be view-dependent: focus (x, y, z) plus the spherical
 * offset at radius/zoom, or, orthographic, only the direction.
 */
export const viewOf = (obs: Observer): View => {
  const phi = obs.phi.value
  const theta = obs.theta.value
  const dir = { x: Math.sin(phi) * Math.cos(theta), y: Math.sin(theta), z: Math.cos(phi) * Math.cos(theta) }
  if (obs.orthographic.value) return { toward: dir }
  const r = obs.radius.value / (obs.zoom.value || 1)
  return { eye: { x: obs.x.value + dir.x * r, y: obs.y.value + dir.y * r, z: obs.z.value + dir.z * r } }
}

/** A local point of `holon` carried to world space (scale → rotation → translation, up the chain). */
export const toWorld = (holon: Holon, p: Vec3Like): Vec3Like => {
  let out = p
  for (let node: Holon | undefined = holon; node; node = node.parent) {
    const s = node.scale.value
    out = rotHPB({ x: out.x * s, y: out.y * s, z: out.z * s }, node.p.value, node.h.value, node.b.value)
    out = { x: out.x + node.x.value, y: out.y + node.y.value, z: out.z + node.z.value }
  }
  return out
}

/** The inverse of `toWorld`: a world point in `holon`'s local space. */
export const toLocal = (holon: Holon, p: Vec3Like): Vec3Like => {
  const chain: Holon[] = []
  for (let node: Holon | undefined = holon; node; node = node.parent) chain.push(node)
  let out = p
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i]!
    out = { x: out.x - node.x.value, y: out.y - node.y.value, z: out.z - node.z.value }
    out = invRotHPB(out, node.p.value, node.h.value, node.b.value)
    const s = node.scale.value || 1
    out = { x: out.x / s, y: out.y / s, z: out.z / s }
  }
  return out
}

/** A world-space view carried into `holon`'s local space. */
const localView = (holon: Holon, view: View): View => {
  if ("eye" in view) return { eye: toLocal(holon, view.eye) }
  const o = toLocal(holon, { x: 0, y: 0, z: 0 })
  const d = toLocal(holon, view.toward)
  const t = { x: d.x - o.x, y: d.y - o.y, z: d.z - o.z }
  const l = Math.hypot(t.x, t.y, t.z) || 1
  return { toward: { x: t.x / l, y: t.y / l, z: t.z / l } }
}

/**
 * Install a pull-based `points` accessor on a Line (the Connection /
 * MorphShape idiom, said again here rather than widened out of curves.ts):
 * `compute` runs only when `sourceKey` changes, and the Line's
 * geomVersion bumps exactly then.
 */
export const derivePoints = (
  line: Line,
  sourceKey: () => readonly number[],
  compute: () => Vec3Like[],
): void => {
  let key: readonly number[] | undefined
  let memo: Vec3Like[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get(): Vec3Like[] {
      const next = sourceKey()
      if (!key || key.length !== next.length || next.some((v, i) => v !== key![i])) {
        key = next
        memo = compute()
        line.geomVersion++
      }
      return memo
    },
    set(_v: Vec3Like[]) {},
  })
}

// ─── The holon ──────────────────────────────────────────────────────

export interface SolidDrawingOptions {
  /** The scene's observer — whose view decides what is visible. */
  observer?: Observer
  /** Stroke slots (visible edge spans). Default 64. */
  lineSlots?: number
  /** Fill slots (visible faces). Default 32. */
  faceSlots?: number
}

const flattenSolids = (solids: readonly Solid[]): number[] =>
  solids.flatMap((s) => {
    const fill = s.fill ? [s.fill.r, s.fill.g, s.fill.b] : [-1, -1, -1]
    return s.kind === "box"
      ? [0, s.center.x, s.center.y, s.center.z, s.size.x, s.size.y, s.size.z, ...fill]
      : [1, s.center.x, s.center.y, s.center.z, s.radius, s.height, "xyz".indexOf(s.axis), ...fill]
  })

export abstract class SolidDrawing extends Stroke {
  /** The solids, in local space — the subclass's whole job. */
  abstract solids(): Solid[]

  // Off the field scan (a reference, not a part — registering the
  // observer would reparent it).
  private seen!: { observer?: Observer; lineSlots: number; faceSlots: number }
  private memo?: { key: number[]; drawing: Drawing }

  constructor(overrides: Overrides & SolidDrawingOptions = {}) {
    const { observer, lineSlots, faceSlots, ...rest } = overrides
    // A solid drawing is filled unless told otherwise — the fill colours
    // are its solids' own; fillOpacity is how much of them shows.
    super({ fillOpacity: 1, ...rest })
    this.seen = { observer, lineSlots: lineSlots ?? 64, faceSlots: faceSlots ?? 32 }
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
    const key = this.signature()
    const m = this.memo
    if (!m || m.key.length !== key.length || key.some((x, i) => x !== m.key[i])) {
      this.memo = { key, drawing: hiddenLineDrawing(this.solids(), localView(this, this.view())) }
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
    for (let i = 0; i < this.seen.faceSlots; i++) {
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
          const c = this.drawing().faces[i]?.fill ?? BLACK
          const k = this.fillOpacity.value
          return { r: c.r * k, g: c.g * k, b: c.b * k }
        }),
        fillOpacity: derive(() => (this.fillOpacity.value > 0 ? 1 : 0)),
        opacity: this.opacity,
      })
      derivePoints(slot, () => [this.drawingVersion()], () => this.drawing().faces[i]?.points ?? [])
      this.add(slot)
    }
    for (let i = 0; i < this.seen.lineSlots; i++) {
      const slot = new Line({ tint: this.tint, stroke: this.stroke, opacity: this.opacity })
      derivePoints(slot, () => [this.drawingVersion()], () => this.drawing().lines[i] ?? [])
      this.add(slot)
    }
  }

  // A counter that moves exactly when the memo is rebuilt — the slots'
  // shared dirty key, so 96 slots compare one integer, not the drawing.
  private version = 0
  private lastDrawing?: Drawing
  private drawingVersion(): number {
    const d = this.drawing()
    if (d !== this.lastDrawing) {
      this.lastDrawing = d
      this.version++
    }
    return this.version
  }
}
