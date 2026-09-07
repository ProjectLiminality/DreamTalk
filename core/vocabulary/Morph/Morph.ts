/**
 * Morph — one shape becoming another.
 *
 * ═══════════════════════════════════════════════════════════════════
 * THIS FILE IS THE TEMPLATE FOR EVERY FUTURE ABILITY MODULE.
 * ═══════════════════════════════════════════════════════════════════
 *
 * DreamTalk's first PLUGGABLE ABILITY (docs/DECISIONS.md 2026-09-07,
 * "Abilities are pluggable DreamNodes"). An ability is a self-contained
 * unit in `core/vocabulary/<Ability>/` that, when imported, GRAFTS
 * itself onto every eligible object:
 *
 *     import "../../vocabulary/Morph/Morph"      // the whole space learns
 *     circle.morphTo(square, { copy: true })     // …and this now typechecks
 *
 * That import is THE ONE SANCTIONED SIDE-EFFECT IMPORT in the
 * framework. Everywhere else a module is inert until something calls
 * it; here, importing an ability TEACHES THE WHOLE SPACE, and that is
 * the point rather than an accident. It instantiates "symbols travel
 * with functionality" (LOOPS/ONTOLOGY): the Morph DreamNode CONTAINS
 * the morphing, so a scene that pulls in this one folder gets the
 * geometry, the holon, the verb, the method and the type — nothing to
 * register, nothing to wire.
 *
 *
 * WHAT LIVES WHERE, AND WHY (the split the decision names)
 *
 *   core/src/geometry/morph.ts   the MATHEMATICS — resampling,
 *                                correspondence, interpolation, the two
 *                                readings of a stroke's outline. Pure
 *                                functions over plain data. It stays in
 *                                core because MATH IS INFRASTRUCTURE,
 *                                not ability: a tool that only wants to
 *                                resample a polyline imports that file
 *                                and gains no new methods on anything.
 *
 *   this file                    the ABILITY — the `MorphShape` holon
 *                                (scene state), the `Morph` verb
 *                                (timing), and the `.morphTo()` graft
 *                                (the teaching). Importing this is what
 *                                changes what objects can do.
 *
 * The test of the split: deleting this folder must leave core compiling
 * and the geometry usable. It does.
 *
 *
 * THE FOUR PARTS OF AN ABILITY MODULE (copy this shape)
 *
 *   1. THE HOLON        the scene-state carrier the verb animates, if
 *                       the ability needs one. `MorphShape` here.
 *                       Some abilities (a pure re-timing, say) will not
 *                       need one — skip it, keep the other three.
 *
 *   2. THE VERB         the free function: `Morph(shape, src, dst, opts)`.
 *                       This is the implementation. Everything else
 *                       delegates to it — there is exactly ONE body.
 *
 *   3. THE GRAFT        declaration merging (compile time) + prototype
 *                       augmentation (runtime), so the method spelling
 *                       exists and typechecks. See "THE GRAFT" below.
 *
 *   4. THE GATE         eligibility, at both levels. See "ELIGIBILITY".
 *
 *
 * THE GRAFT (the mechanism, exactly)
 *
 * TypeScript's `declare module` re-opens the module that owns the base
 * class and adds a member to the interface TS keeps for that class. A
 * class declaration produces BOTH a value and an interface, so an
 * `interface Stroke { … }` inside `declare module ".../parts/primitives"`
 * MERGES with `class Stroke` there — every Stroke everywhere, including
 * ones constructed in files that never heard of this module, gains the
 * member. The specifier must resolve to the SAME module TS already
 * loaded (a relative path from this file), or the merge silently opens
 * a new ambient module and the method appears nowhere.
 *
 * The runtime half is one assignment to `Stroke.prototype`. It is
 * non-enumerable — the holon's field scan walks own enumerable string
 * keys, and an enumerable prototype method would be harmless but the
 * framework's own invariant is that only Params and parts are visible
 * there, so we do not test it.
 *
 * Both halves are idempotent: importing this module twice grafts the
 * same function onto the same prototype.
 *
 *
 * ELIGIBILITY (two levels, per the decision)
 *
 * COMPILE TIME — the declaration merges onto `Stroke` ONLY. A morph is
 * an interpolation between two OUTLINES, so it is defined for
 * line geometry and for nothing else: `new Cube().morphTo(…)` is not a
 * runtime error to be caught, it is a type error, and the compiler says
 * so before the scene ever runs.
 *
 * RUNTIME — `Stroke` is a base, and not every Stroke carries an outline
 * of its own. The ambiguous case the decision names is the MULTI-SUBPATH
 * COMPOSITE: a `Sketch` is a Stroke, but its ink lives in 37 child
 * `Line`s and the Sketch itself has no single closed outline. O-6's
 * semantics settle what to do — `outlineOf` (geometry/morph.ts) is the
 * enumeration of what a morph can be stated between, it answers
 * `undefined` for everything else, and the header there says the morph
 * "refuses it loudly at construction rather than rendering a blank".
 * We refuse, and we TEACH: the error names what is morphable, why the
 * shape at hand is not, and what to do instead (morph the child strokes,
 * which ARE eligible). Tone follows the settled-holon error
 * (holon.ts:186) — state the rule, then the way through.
 *
 * The gate fires at CONSTRUCTION, not at render: `morphTo` builds its
 * MorphShape immediately, and MorphShape's constructor checks both ends.
 * A scene with an ineligible morph fails when it is declared, which is
 * the only moment a human is looking at the declaration.
 *
 *
 * NOUN/VERB DUALITY (one implementation, two spellings)
 *
 * Both spellings are canon and both are the same code:
 *
 *     Morph(shape, circle, square, opts)   // the verb — explicit stage
 *     circle.morphTo(square, opts)         // the method — stages for you
 *
 * `morphTo` is sugar with one addition: it CONSTRUCTS the MorphShape,
 * because the two-object spelling has nowhere else to put it. It hands
 * back `{ shape, anim }` — the scene still has to `stage()` the shape,
 * since a Dream's holons are its declared fields and a method that
 * smuggled a new one into the graph mid-play would put geometry outside
 * the scene's own declaration (the same reasoning that made `Morph`
 * take a staged shape in the first place). The verb spelling suits a
 * scene that stages six morphers up front and animates them later
 * (Scene01); the method suits a scene that wants one morph stated in
 * one place.
 *
 *
 * LINEAGE
 *
 * pydeation's `Morph` (refs/pydeation-legacy/animation/animator.py:581-632),
 * whose correspondence rule is derived in geometry/morph.ts and whose
 * timing is transcribed on the verb below. Staged by the 2024 pitch's
 * Scene01 (six simultaneous morphs), Scene06, Scene07, Scene07_1.
 */

import { together, restage, type Anim } from "../../src/anim"
import { Holon, type Overrides } from "../../src/holon"
import { completion, integer } from "../../src/params"
import {
  Circle,
  Ellipse,
  Line,
  Polygon,
  Rectangle,
  Square,
  Stroke,
  type Vec3Like,
} from "../../src/parts/primitives"
import { worldPosition } from "../../src/parts/curves"
import {
  MORPH_SAMPLES,
  morphedPolyline,
  outlineOf,
  worldOutlineOf,
} from "../../src/geometry/morph"

// ─── 1. THE HOLON ───────────────────────────────────────────────────

/**
 * Install a pull-based `points` accessor on a Line: `compute` runs only
 * when `sourceKey` changes, and the memo is what every reader sees. The
 * returned array identity is stable across unchanged frames, so the
 * host's value-comparison dirty-check stays cheap and honest.
 *
 * The same idiom `Connection` and `Cylinder` use (parts/curves.ts), said
 * again here rather than exported from there: it is six lines, and
 * widening curves.ts's surface for it would couple two modules that
 * otherwise share nothing.
 */
const derivePoints = (
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
      }
      return memo
    },
    set(_v: Vec3Like[]) {},
  })
}

/**
 * The size-and-shape half of a stroke's identity — enough of it to know
 * when a derived outline has gone stale. Position is read separately (it
 * comes from the transform chain); this is what the generator itself
 * consumes.
 */
const shapeReading = (holon: Stroke): number[] => {
  const frame = [
    holon.h.value,
    holon.p.value,
    holon.b.value,
    holon.scale.value,
    holon.drawStart.value,
    holon.drawReversed.value ? 1 : 0,
  ]
  if (holon instanceof Circle) return [holon.radius.value, ...frame]
  if (holon instanceof Ellipse) return [holon.radiusX.value, holon.radiusY.value, ...frame]
  if (holon instanceof Square) return [holon.size.value, ...frame]
  if (holon instanceof Polygon)
    return [holon.radius.value, holon.sides.value, holon.phase.value, ...frame]
  if (holon instanceof Rectangle)
    return [holon.width.value, holon.height.value, holon.rounding.value, ...frame]
  if (holon instanceof Line) return [...holon.points.flatMap((p) => [p.x, p.y, p.z]), ...frame]
  return frame
}

// ─── 2. THE GATE ────────────────────────────────────────────────────

/**
 * The runtime half of eligibility, with the teaching error.
 *
 * `outlineOf` IS the enumeration of what a morph can be stated between
 * (geometry/morph.ts) — it answers `undefined` for any Stroke that does
 * not carry one closed plane figure of its own. Two kinds of Stroke land
 * there, and the message separates them, because the way through is
 * different:
 *
 *   A COMPOSITE (a Sketch, and any Stroke with child strokes) has ink,
 *   just not ONE outline — its ink is in its children. Those children
 *   are Lines, which ARE morphable, so the way through is to morph them.
 *
 *   A DEGENERATE end (an empty Line) has no ink at all, and there is
 *   nothing to say but which end it was.
 *
 * Named `assertMorphable` rather than `checkMorphable` because it
 * throws: it is a gate, not a predicate. `isMorphable` below is the
 * predicate, for callers that want to ask without being stopped.
 */
const MORPHABLE = "Morphable shapes are: Circle, Ellipse, Square, Polygon, Rectangle, or a closed Line"

/**
 * The predicate — the same question the gate asks, without the throw.
 * Takes any Holon so a caller can ask about something the compile-time
 * gate would reject outright (a Group is not a Stroke, and the answer is
 * still no).
 */
export const isMorphable = (holon: Holon): boolean =>
  holon instanceof Stroke && outlineOf(holon, 8) !== undefined

const assertMorphable = (holon: Stroke, role: "source" | "target"): void => {
  if (isMorphable(holon)) return
  const name = holon.constructor.name
  const children = holon.parts.filter((p): p is Stroke => p instanceof Stroke)
  throw new Error(
    `Morph: cannot use ${name} as the ${role} — a morph interpolates ONE closed ` +
      `outline into another, and ${name} ` +
      (children.length > 0
        ? `has no single outline of its own: it draws itself through ` +
          `${children.length} sub-strokes. That is a category error rather than a ` +
          `missing feature — morph its pieces individually, since each sub-stroke ` +
          `is morphable on its own.`
        : `has no outline to read (an empty or single-point Line has no ink yet). ` +
          `Give it its points before the morph is declared.`) +
      ` ${MORPHABLE}.`,
  )
}

// ─── 3. THE HOLON (continued) ───────────────────────────────────────

/**
 * The shape mid-morph — pydeation's `morpher`, the Cloner that stands in
 * for both shapes while neither of them is itself.
 *
 * The construction is deliberately the same shape as `Connection`'s: a
 * plain `Line` child whose `points` are a DERIVED reading, pulled fresh
 * whenever the inputs move (parts/curves.ts: derivePoints). That is what
 * makes the whole verb additive — the host has drawn `Line`s since the
 * first commit, and a morphing outline is just a Line whose points are a
 * function of `completion` instead of a constant. No new renderer, no
 * new binding, no per-frame push from the scene.
 *
 * `morph` is the PlainEffector's `modify_clone`: 0 = the source's
 * outline, 1 = the target's. `tint` blends the two shapes' colours over
 * the same window, which is pydeation's `blend_color` — the morpher
 * carries the source's colour at 0 and the destination's at 1
 * (animator.py:606, 620), so a blue circle becoming a red rectangle is
 * purple halfway, and that is the reference's behaviour, not a choice.
 *
 * The outlines are read in WORLD space and the shape itself is left at
 * the identity, exactly as `Connection` does — so its local space IS
 * world space and the derived points need no inverse.
 */
export class MorphShape extends Stroke {
  /** The blend parameter — 0 is the source's shape, 1 is the target's. */
  morph = completion(0)
  /** Resampling density; both outlines are re-laid at this count. */
  samples = integer(MORPH_SAMPLES)

  /**
   * The drawn thing. All four of the morpher's surfaces are BOUND into
   * it (passing a Param as an override makes the field that same Param,
   * holon.ts), so the verb animates the MorphShape and the Line is what
   * the host actually renders — including `fillOpacity`, which is how
   * the interior survives the crossing: Scene01's morphs run between two
   * shapes that are already flooded, and an outline-only blend would
   * read as a hollow ring halfway (f_00190 shows them solid).
   */
  line: Line = new Line({
    tint: this.tint,
    stroke: this.stroke,
    fillOpacity: this.fillOpacity,
    opacity: this.opacity,
  })

  // Held off the field scan, like Connection's anchors: these are
  // REFERENCES to shapes that live elsewhere in the scene, not parts of
  // this one, and registering them would reparent them.
  private ends!: { source: Stroke; target: Stroke }

  constructor(source: Stroke, target: Stroke, overrides: Overrides = {}) {
    super(overrides)
    // The gate, at construction — the moment a human is looking at the
    // declaration. Both ends, source first, so the message names the end
    // that is actually wrong.
    assertMorphable(source, "source")
    assertMorphable(target, "target")
    this.ends = { source, target }
  }

  protected override compose(): void {
    derivePoints(
      this.line,
      () => {
        // Everything the outline depends on: the blend, the density, and
        // where each end currently IS. Reading the two world positions
        // keeps a morph honest when either shape is animated during it.
        const a = worldPosition(this.ends.source)
        const b = worldPosition(this.ends.target)
        return [
          this.morph.value,
          this.samples.value,
          a.x,
          a.y,
          a.z,
          b.x,
          b.y,
          b.z,
          ...shapeReading(this.ends.source),
          ...shapeReading(this.ends.target),
        ]
      },
      () => this.refresh(),
    )
  }

  /** The interpolated outline at the current `morph`, in world space. */
  refresh(): Vec3Like[] {
    const n = this.samples.value
    const a = worldOutlineOf(this.ends.source, n)
    const b = worldOutlineOf(this.ends.target, n)
    if (!a || !b) {
      // Unreachable through the constructor (the gate ran there), but an
      // end can lose its ink after the fact — a Line's points are
      // assignable. Same teaching, at the moment it goes wrong.
      assertMorphable(this.ends.source, "source")
      assertMorphable(this.ends.target, "target")
    }
    return morphedPolyline(a!, b!, this.morph.value, n)
  }
}

// ─── 4. THE VERB ────────────────────────────────────────────────────
//
// The ONTOLOGY-deferred verb (transitions.ts:69), and the one the corpus
// leans on hardest — Scene01's six simultaneous morphs, Scene06's repo
// chain, Scene07's frames-to-Venn, Scene07_1's polygon walk.
//
// The GEOMETRY is in geometry/morph.ts, with the correspondence rule
// derived from pydeation's own construction there. This is the timing
// half: what pydeation's Morph AnimationGroup actually schedules
// (refs/pydeation-legacy/animation/animator.py:614-629), verbatim:
//
//   copy=False:  (hide_start_splines,       (0,    0.01))
//                (show_morpher,             (0,    0.01))
//                (morph_completion,         (0,    1))
//                (blend_color,              (0,    1))
//                (blend_fill,               (0,    1))
//                (show_destination_splines, (0.99, 1))
//                (hide_morpher,             (0.99, 1))
//
//   copy=True:   the same, MINUS hide_start_splines — the source stays
//                lit where it was, and the morpher departs from it as a
//                twin. That is the whole difference, and it is what the
//                repo chain needs (triangle → square → pentagon each
//                leave their predecessor standing beside the arrow).
//
// The two 0.01-wide windows are C4D's spelling of "instantly, but as a
// keyframe pair" — a swap that has to be a track because everything in
// that engine is. Here they are `.to()` steps at the same instants, so
// the handover reads identically while staying a pure f(t): at u < 0.01
// the source is lit, from 0.99 the destination is, and in between the
// morpher alone carries the image.

/** Options for `Morph` — pydeation's own two, plus the density. */
export interface MorphOptions {
  /**
   * Leave the source shape standing (`copy=True`). Default false: the
   * source is taken away as the morph departs, which is Scene01's case
   * and the source's default.
   */
  copy?: boolean
  /** Resampling density, if the default 128 is too coarse for a shape. */
  samples?: number
}

/**
 * One shape becoming another.
 *
 * `shape` is the `MorphShape` the scene has staged between the two ends
 * — the verb animates it, it does not create it, because a Dream's
 * holons are its fields and a verb that conjured a new one mid-play
 * would put geometry outside the scene's own declaration. That is also
 * how pydeation reads: `Morph` builds its helper objects and hands them
 * back on the AnimationGroup (`helper_objects`), for the scene to
 * insert. (`.morphTo()` below is the spelling for a scene that would
 * rather state the pair and take the shape back.)
 *
 * What the returned Anim drives, in the source's own windows:
 *   the morpher's blend 0 → 1 and its tint source → target, over the
 *   whole span; the source's opacity to 0 at the very start (unless
 *   `copy`); the target's opacity to 1 at the very end; and the
 *   morpher's own opacity away at the same instant, so exactly one of
 *   the three is ever the lit image.
 */
export const Morph = (
  shape: MorphShape,
  source: Stroke,
  target: Stroke,
  opts: MorphOptions = {},
): Anim => {
  const parts: Anim[] = [
    // morph_completion + blend_color + blend_fill — all (0, 1).
    shape.morph.sequence(0, 1),
    // The two surfaces blend TO the destination's, and take their start
    // from wherever the morpher already is. That asymmetry is not a
    // shortcut, it is the only correct reading of pydeation's own code.
    //
    // `Morph` there reads BOTH ends' material values at CONSTRUCTION
    // time (animator.py:586-595) and hands the source's to the Cloner as
    // its initial colour. In pydeation that is sound for both ends,
    // because a shape's construction flags set its materials
    // immediately: `Rectangle(color=RED, solid=True)` is red and flooded
    // the moment it exists, whether or not it is visible yet.
    //
    // It is NOT sound for the source in a scene like Scene01, whose
    // nodes are built white and unfilled and only become blue and solid
    // at RUN time (`DrawThenFillCompletely` at localT 0, `ChangeColor`
    // at 4). Freezing the source's build-time white here is what made
    // the first cut of Scene01 morph pale, translucent shapes: the
    // blend departed from a colour the node had not worn for twenty
    // seconds. The DESTINATION's values are construction constants and
    // are read directly; the SOURCE's are whatever the timeline has
    // made them by the time the morph runs, which is exactly what
    // `.to()` means (params.ts: mode "to" resolves its start
    // chronologically). The scene stages the morpher on the source's
    // current surfaces; the verb carries it to the target's.
    shape.tint.to(target.tint.value),
    shape.fillOpacity.to(target.fillOpacity.value),
    // show_morpher (0, 0.01) — the morpher is lit from the first instant.
    restage(shape.opacity.sequence(0, 1), 0, 0.01),
  ]
  const windowed: Anim = {
    tracks: [
      ...(opts.copy
        ? []
        : // hide_start_splines (0, 0.01)
          restage(source.opacity.to(0), 0, 0.01).tracks),
      // show_destination_splines (0.99, 1)
      ...restage(target.opacity.to(1), 0.99, 1).tracks,
      // hide_morpher (0.99, 1)
      ...restage(shape.opacity.to(0), 0.99, 1).tracks,
    ],
  }
  return together(...parts, windowed)
}

// ─── 5. THE GRAFT ───────────────────────────────────────────────────

/** What `.morphTo()` hands back: the morpher to stage, and the Anim. */
export interface StagedMorph {
  /**
   * The morpher the scene must `stage()`. Returned rather than inserted
   * — see the method's own note: the two-object spelling has nowhere to
   * put it, so it builds one, but declaring it stays the scene's job.
   */
  shape: MorphShape
  /** The animation, identical to `Morph(shape, source, target, opts)`. */
  anim: Anim
}

/**
 * The compile-time half of the graft.
 *
 * Re-opening `../../src/parts/primitives` and declaring an
 * `interface Stroke` merges with the `class Stroke` declared there, so
 * the method exists on every Stroke in the program the moment this
 * module is in the compilation. The specifier is relative and resolves
 * to the same file TS already loaded — an absolute or package-style one
 * would declare a NEW ambient module and the merge would silently do
 * nothing.
 *
 * Note what is NOT here: no `Holon`, no `SolidObject`. The merge is the
 * compile-time gate — a morph is defined between outlines, so only
 * outline-carrying holons learn the word.
 */
declare module "../../src/parts/primitives" {
  interface Stroke {
    /**
     * Become `target` — the method spelling of `Morph`.
     *
     *     const { shape, anim } = circle.morphTo(square)
     *     this.stage(shape)
     *     this.play(anim, 4)
     *
     * The two-object spelling has nowhere to put the morpher, so it
     * BUILDS one and hands it back rather than conjuring it into the
     * graph — the scene still stages it, because a Dream's holons are
     * its declared fields and a method that inserted one itself would
     * put geometry outside the scene's own declaration. That is the
     * whole difference between the spellings: the verb takes a morpher
     * the scene already declared, the method returns one for it to
     * declare. Neither smuggles.
     *
     * Available only after `import "vocabulary/Morph/Morph"`. Throws at
     * this call if either end carries no single closed outline (a
     * multi-subpath composite like Sketch) — the error names what is
     * morphable and what to do instead.
     */
    morphTo(target: Stroke, opts?: MorphOptions & Overrides): StagedMorph
  }
}

/**
 * The runtime half of the graft — one non-enumerable method on
 * `Stroke.prototype`, so every Stroke that exists or will exist has it.
 *
 * Non-enumerable because the holon's field scan walks own enumerable
 * string keys and the framework's invariant is that only Params and
 * parts are visible to it. A prototype method would not be scanned
 * anyway; this keeps the invariant true by construction rather than by
 * argument.
 *
 * Idempotent: importing this module twice assigns the same body twice.
 *
 * The body delegates to `Morph`. There is exactly ONE implementation of
 * the morph's timing in this file, and this is not it — the two
 * spellings differ only in who constructs the MorphShape.
 */
Object.defineProperty(Stroke.prototype, "morphTo", {
  configurable: true,
  writable: true,
  enumerable: false,
  value: function morphTo(
    this: Stroke,
    target: Stroke,
    opts: MorphOptions & Overrides = {},
  ): StagedMorph {
    const { copy, samples, ...overrides } = opts
    // The morpher starts invisible and is lit by the verb's own
    // show_morpher window — the same staging Scene01 writes by hand.
    const shape = new MorphShape(this, target, {
      opacity: 0,
      ...(samples === undefined ? {} : { samples }),
      ...overrides,
    })
    return { shape, anim: Morph(shape, this, target, { copy, samples }) }
  },
})
