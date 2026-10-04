/**
 * GeometrySketch — a shape's angles, annotated.
 *
 * IMPORTING THIS MODULE TEACHES EVERY STROKE `.sketchGeometry()` (the one
 * sanctioned side-effect import, the ability pattern: DECISIONS.md
 * 2026-09-07, vocabulary/Morph is the template this file copies).
 *
 *     import "../../vocabulary/GeometrySketch/GeometrySketch"
 *     const { sketch, anim } = square.sketchGeometry()
 *     this.stage(sketch)
 *     this.play(anim, 1.5)
 *
 * David's transmission (ONTOLOGY.md 2026-09-16), from Keynote's
 * sketch-effect thinking: throw it at any line or shape and it runs its
 * own logic — it finds the shape's SHARP angles and annotates them as a
 * geometer would: the little square-corner mark where the angle is 90°,
 * an arc drawn across every other one. A square gets four squares, a
 * triangle three arcs, a pentagon five; a custom outline gets whatever
 * corners it really has; a circle gets nothing, because it has no angle
 * to show. It is the SQUARE side of "both creatures describe the
 * mathematics of what they see" (the circle side — its sin/cos graph —
 * is future).
 *
 * WHAT LIVES WHERE
 *
 *   core/src/geometry/angles.ts  the MATHEMATICS — which vertices are
 *                                corners, which side is the interior,
 *                                the square and the arc. Pure.
 *   GeometrySketch (here)        the HOLON — scene state: the marks, as
 *                                Lines that follow the shape live.
 *   the graft (here)             `.sketchGeometry()` on every Stroke.
 *
 * The verb is the one every holon already has: `Create(sketch)` draws the
 * marks on. Nothing about annotating needs timing of its own.
 *
 * WORLD SPACE, LIKE A MORPHER
 *
 * The sketch reads its shape's outline in WORLD space (geometry/morph.ts
 * worldOutlineOf) and sits at the identity, staged at the scene root —
 * the same arrangement as MorphShape, for the same reason: it is a
 * sibling agent in the arena that LOOKS at the shape (ONTOLOGY 2026-09-17,
 * abilities are agents), not a part of it. Move, turn, tilt or resize the
 * shape and the marks follow, because each mark's points are derived from
 * the shape's current outline every time it changes.
 *
 * THE MARK POOL
 *
 * A holon's parts are final once it settles, so the sketch counts the
 * shape's corners when it is built and keeps that many mark Lines. A
 * shape that later loses corners leaves the extra marks empty; one that
 * gains corners (a Polygon whose `sides` animates up) shows only the
 * first ones — build the sketch on the shape in its richest pose.
 */

import { type Overrides } from "../../src/holon"
import { length } from "../../src/params"
import { Circle, Ellipse, Line, Polygon, Rectangle, Square, Stroke } from "../../src/parts/primitives"
import { Create } from "../../src/verbs"
import type { Anim } from "../../src/anim"
import { outlineOf, worldOutlineOf } from "../../src/geometry/morph"
import { angleMark, cornersOf, SHARP_TURN, type Vec3Like } from "../../src/geometry/angles"

/** The outline density the corners are read from — the host's own (128). */
const SAMPLES = 128

/**
 * Everything the outline in world space depends on: the shape's own
 * generator params, and the transform of every node from it to the root.
 * When this reading is unchanged, so are the marks.
 */
const outlineReading = (shape: Stroke): number[] => {
  const out: number[] = []
  if (shape instanceof Circle) out.push(shape.radius.value)
  else if (shape instanceof Ellipse) out.push(shape.radiusX.value, shape.radiusY.value)
  else if (shape instanceof Square) out.push(shape.size.value)
  else if (shape instanceof Polygon) out.push(shape.radius.value, shape.sides.value, shape.phase.value)
  else if (shape instanceof Rectangle) out.push(shape.width.value, shape.height.value, shape.rounding.value)
  else if (shape instanceof Line) for (const p of shape.points) out.push(p.x, p.y, p.z)
  for (let node: Stroke["parent"] = shape; node; node = node.parent) {
    out.push(node.x.value, node.y.value, node.z.value, node.h.value, node.p.value, node.b.value, node.scale.value)
  }
  return out
}

// ─── THE GATE ───────────────────────────────────────────────────────

const SKETCHABLE =
  "Sketchable shapes are: Circle, Ellipse, Square, Polygon, Rectangle, or a Line of two or more points"

/** Does this holon have one outline whose angles can be read? Never throws. */
export const isSketchable = (holon: unknown): boolean =>
  holon instanceof Stroke && outlineOf(holon, 8) !== undefined

const assertSketchable = (holon: Stroke): void => {
  if (isSketchable(holon)) return
  const name = holon.constructor.name
  const composite = !(holon instanceof Line) && holon.parts.length > 0
  throw new Error(
    `GeometrySketch: cannot sketch ${name} — the sketch reads the angles of ONE outline, and ` +
      (composite
        ? `${name} has no outline of its own: it draws itself through ${holon.parts.length} ` +
          `sub-strokes. That is a category error rather than a missing feature — sketch its ` +
          `pieces individually. `
        : `${name} has no outline to read yet (an empty or single-point Line has no ink). Give ` +
          `it its points first. `) +
      `${SKETCHABLE}.`,
  )
}

// ─── THE HOLON ──────────────────────────────────────────────────────

/** Pull-based derived points with a memo — the idiom Morph and Connection use. */
const derivePoints = (line: Line, sourceKey: () => readonly number[], compute: () => Vec3Like[]): void => {
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

/**
 * The annotation of one shape's angles: one mark Line per sharp corner,
 * each the right-angle square or an arc, following the shape live. Its
 * own `tint`, `stroke` and `opacity` are bound into every mark, so the
 * sketch is styled as one thing; `creation` stays per mark, so `Create`
 * draws them on together.
 */
export class GeometrySketch extends Stroke {
  /** ONTOLOGY.md: an ability's holon — an agent that looks at a shape. */
  static sovereign = true
  /** Mark size, world units: the square's side, the arc's radius. */
  size = length(24)

  // A REFERENCE to a shape that lives elsewhere in the scene, held off the
  // field scan (registering it would reparent it).
  private shape!: Stroke
  private marksKey: readonly number[] | undefined
  private marksMemo: Vec3Like[][] = []

  constructor(shape: Stroke, overrides: Overrides = {}) {
    super(overrides)
    assertSketchable(shape)
    this.shape = shape
  }

  protected override compose(): void {
    const count = this.marks().length
    for (let i = 0; i < count; i++) {
      const mark = this.add(
        new Line({ tint: this.tint, stroke: this.stroke, opacity: this.opacity }),
      )
      derivePoints(
        mark,
        () => [this.size.value, ...outlineReading(this.shape)],
        () => this.marks()[i] ?? [],
      )
    }
  }

  /** Every corner's mark, in world space, at the shape's current pose. */
  marks(): Vec3Like[][] {
    const key = [this.size.value, ...outlineReading(this.shape)]
    const k = this.marksKey
    if (!k || k.length !== key.length || key.some((v, i) => v !== k[i])) {
      this.marksKey = key
      const outline = worldOutlineOf(this.shape, SAMPLES) ?? []
      this.marksMemo = cornersOf(outline, { minTurn: SHARP_TURN }).map((c) =>
        angleMark(c, this.size.value),
      )
    }
    return this.marksMemo
  }
}

// ─── THE GRAFT ──────────────────────────────────────────────────────

/** What `.sketchGeometry()` hands back: the sketch to stage, and its draw-on. */
export interface StagedSketch {
  sketch: GeometrySketch
  anim: Anim
}

declare module "../../src/parts/primitives" {
  interface Stroke {
    /**
     * Annotate this shape's angles — the method spelling of
     * `new GeometrySketch(shape)` + `Create`.
     *
     *     const { sketch, anim } = square.sketchGeometry()
     *     this.stage(sketch)
     *     this.play(anim, 1.5)
     *
     * Returns the sketch rather than inserting it: a Dream's holons are
     * its declared fields, so the scene stages it. Available only after
     * `import "vocabulary/GeometrySketch/GeometrySketch"`. Throws here if
     * the shape carries no single outline.
     */
    sketchGeometry(overrides?: Overrides): StagedSketch
  }
}

Object.defineProperty(Stroke.prototype, "sketchGeometry", {
  configurable: true,
  writable: true,
  enumerable: false,
  value: function sketchGeometry(this: Stroke, overrides: Overrides = {}): StagedSketch {
    const sketch = new GeometrySketch(this, overrides)
    return { sketch, anim: Create(sketch) }
  },
})
