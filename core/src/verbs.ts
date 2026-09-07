/**
 * The classic animation verbs, operating on the standard params.
 * Abilities belong to objects, not stuntman classes — these are just
 * convenient spellings of param animations, applied holon-deep.
 *
 * Create dispatches per class: a holon that owns a choreography
 * (`createAnim()` — Eye's lids-then-iris, Axes' domino cascade)
 * creates by it; everything else draws on deep-parallel. UnDraw and
 * Erase are the video-01 asymmetry: UnDraw retracts the draw front
 * (back-to-front), Erase advances the consume front (front-to-back —
 * grids "sweep away").
 */

import { restage, together, type Anim } from "./anim"
import type { Color } from "./constants"
import type { Holon } from "./holon"
import { Stroke } from "./parts/index"
import type { MorphShape } from "./geometry/morph"

const deep = (holon: Holon, f: (h: Holon) => Anim): Anim =>
  together(...[...holon.walk()].map(f))

const none: Anim = { tracks: [] }

/**
 * Emerge from nothing. Consults the holon's own choreography
 * (`createAnim()`), recursively per part; the default is draw-on
 * 0 → 1, deep-parallel.
 */
export const Create = (holon: Holon): Anim => {
  const custom = holon.createAnim()
  if (custom) return custom
  return together(holon.creation.sequence(0, 1), ...holon.parts.map((part) => Create(part)))
}

/**
 * Retract into nothing. Consults the holon's own choreography
 * (`unCreateAnim()`) — the destructive half of the classic dispatch,
 * where UnCreateAxes erases and UnCreateEye unfills before it undraws —
 * and otherwise runs the draw front back to the start, recursing PER
 * PART so a nested holon's own choreography is consulted too.
 *
 * That recursion is the whole point, and it used to be missing: the
 * fallback flattened the tree with `walk()` and stamped
 * `creation.to(0)` on every descendant, which silently overrode the
 * custom `unCreateAnim()` of anything below the top. pydeation's
 * dispatch does the opposite — `UnCreateEye` is chosen for an Eye
 * wherever it sits, because `Animator.flatten_input` stops at a
 * CustomObject and the class-specific animator takes over
 * (animator.py:31-58, 742-772). S08's `UnCreate(creature)` is exactly
 * that shape: a Group holding an Eye, whose UnCreateEye (iris unfills
 * 0→50%, pupil 50→60%, lids and eyeball undraw 30→100%) was being
 * replaced by one flat retraction, leaving the iris fill lit to the
 * last frame (video-01 f0689-f0691).
 *
 * `Create` already recursed this way; the two halves are now symmetric.
 */
export const UnCreate = (holon: Holon): Anim => {
  const custom = holon.unCreateAnim()
  if (custom) return custom
  return together(holon.creation.to(0), ...holon.parts.map((part) => UnCreate(part)))
}

export const Draw = Create

/** The report's vocabulary: UnDraw IS the retract (completion → 0). */
export const UnDraw = UnCreate

/**
 * Consume front-to-back: the stroke disappears in draw direction — the
 * drawn front stays put while the tail retreats after it. Distinct
 * from UnDraw by design (video-01 grids erase; primitives un-draw).
 * Applies to strokes; other holons in the tree are untouched. Note:
 * an erased stroke stays consumed (erasure holds 1) — re-Creating it
 * needs its erasure animated back to 0 first.
 */
export const Erase = (holon: Holon): Anim =>
  deep(holon, (h) => (h instanceof Stroke ? h.erasure.sequence(0, 1) : none))

export const FadeIn = (holon: Holon): Anim =>
  deep(holon, (h) => h.opacity.sequence(0, 1))

export const FadeOut = (holon: Holon): Anim =>
  deep(holon, (h) => h.opacity.to(0))

export const Move = (
  holon: Holon,
  delta: { x?: number; y?: number; z?: number },
): Anim => {
  const anims: Anim[] = []
  if (delta.x !== undefined) anims.push(holon.x.by(delta.x))
  if (delta.y !== undefined) anims.push(holon.y.by(delta.y))
  if (delta.z !== undefined) anims.push(holon.z.by(delta.z))
  return together(...anims)
}

export const Scale = (holon: Holon, factor: number): Anim =>
  holon.scale.to(factor)

export const Rotate = (
  holon: Holon,
  delta: { h?: number; p?: number; b?: number },
): Anim => {
  const anims: Anim[] = []
  if (delta.h !== undefined) anims.push(holon.h.by(delta.h))
  if (delta.p !== undefined) anims.push(holon.p.by(delta.p))
  if (delta.b !== undefined) anims.push(holon.b.by(delta.b))
  return together(...anims)
}

// ─── The fill-and-colour grammar ────────────────────────────────────
//
// pydeation's `Fill` / `UnFill` / `ChangeColor` and the three composite
// verbs the corpus is actually written in. All four scenes that use them
// state them on GROUPS (`DrawThenFillCompletely(pie)`), so like the
// other verbs here they run holon-deep.
//
// One inversion to keep in mind throughout: pydeation animates the
// filler material's TRANSPARENCY and we animate its opacity. Every
// number below is 1 − the source's (see Stroke.fillOpacity).
//
// Being deep means these reach strokes that have no interior to wash —
// an AnnularSector's four constituent arcs and edges, say. That is
// deliberate and harmless: `fillOpacity` exists on every Stroke, and the
// host only builds a wash mesh for the shapes it knows how to fill
// (render/three-host.ts: washGeometry), so the extra tracks animate a
// param nothing reads. The alternative — a verb that inspects what can
// be filled — would put rendering knowledge in the grammar.

/**
 * pydeation's `FILLER_TRANSPARENCY` (constants.py:47) as an opacity —
 * the faint interior wash `Fill` gives a shape when the caller says
 * nothing. 1 − 0.93.
 */
export const DEFAULT_FILL_OPACITY = 1 - 0.93

/**
 * Wash the interior — `Fill(*cobjects, solid=False,
 * transparency=FILLER_TRANSPARENCY)` (animator.py:367-381), which drives
 * one thing: the filler material's transparency, over the whole window.
 *
 * The two spellings the source uses reach the same param:
 *   `Fill(x)`               → the 0.07 default wash
 *   `Fill(x, solid=True)`   → transparency forced to 0, i.e. opaque
 *                             (object.py:475-477, and what
 *                             DrawThenFillCompletely passes)
 * A caller may also state `transparency` directly, as Scene03 does
 * (`Fill(global_system, transparency=1)`), and it is read in the
 * source's own units.
 */
export const Fill = (
  holon: Holon,
  opts: { solid?: boolean; transparency?: number } = {},
): Anim => {
  const transparency = opts.solid ? 0 : (opts.transparency ?? 0.93)
  return deep(holon, (h) => (h instanceof Stroke ? h.fillOpacity.to(1 - transparency) : none))
}

/**
 * Take the wash away — `UnFill` (animator.py:383-396), which is `Fill`
 * with `transparency=1` hard-coded: the interior goes fully clear, and
 * the outline is not touched.
 */
export const UnFill = (holon: Holon): Anim =>
  deep(holon, (h) => (h instanceof Stroke ? h.fillOpacity.to(0) : none))

/**
 * Recolour — `ChangeColor(*cobjects, color=…, fill_color=None)`
 * (animator.py:301-337), which moves BOTH surfaces: it builds a
 * `ChangeFillColor` and a `ChangeSketchColor` and runs them over the
 * same (0, 1) window, and when `fill_color` is not given it falls back
 * to `color` so the two move together. Since core carries one `tint`
 * per stroke for both surfaces (Stroke.fillOpacity's header), that is
 * one track.
 *
 * The Eye is the corpus's one exception — `ChangeColorEye` splits iris
 * fill from sketch — and it dispatches on class in pydeation exactly as
 * `Create` does here. No Eye needs it in these scenes; when one does it
 * belongs in vocabulary/Eye as a `changeColorAnim()`, not in this verb.
 */
export const ChangeColor = (holon: Holon, target: Color): Anim =>
  deep(holon, (h) => (h instanceof Stroke ? h.tint.to(target) : none))

/**
 * Draw it, then flood it solid — `DrawThenFillCompletely`
 * (animator.py:498-514):
 *
 *   AnimationGroup((draw, (0, 0.6)), (fill(solid=True), (0.5, 1)))
 *
 * The outline is complete at 60% of the span and the interior floods
 * from 50% to the end, so the two overlap by a tenth of the span — the
 * wash starts arriving while the pen is still closing the loop. Both
 * windows are GROUP RESCALES in pydeation (the composite assembles its
 * choreography at full span and the AnimationGroup squeezes it
 * afterwards), which is `restage`, not the bare tuple: the tangents were
 * stated in seconds against the whole span and do not shrink with the
 * window (anim.ts: Track.smoothingWindow).
 */
export const DrawThenFillCompletely = (holon: Holon): Anim =>
  together(restage(Draw(holon), 0, 0.6), restage(Fill(holon, { solid: true }), 0.5, 1))

/**
 * Drain it, then retract it — `UnFillThenUnDraw` (animator.py:534-550):
 *
 *   AnimationGroup((unfill, (0, 0.6)), (undraw, (0.5, 1)))
 *
 * The mirror of DrawThenFillCompletely, and note which half leads: the
 * INTERIOR goes first and the outline follows, so the shape empties to a
 * line drawing before the line drawing itself retracts. Same 0.1 overlap,
 * same rescale semantics.
 */
export const UnFillThenUnDraw = (holon: Holon): Anim =>
  together(restage(UnFill(holon), 0, 0.6), restage(UnDraw(holon), 0.5, 1))

/**
 * Retract it, then drain what is left — `UnDrawThenUnFill`
 * (animator.py:516-532):
 *
 *   AnimationGroup((undraw, (0, 0.6)), (unfill, (0.3, 1)))
 *
 * The other order, and NOT a mirror of the one above: the two windows
 * overlap by 0.3 of the span rather than 0.1, so the interior is already
 * fading through most of the outline's retraction. That asymmetry is the
 * source's, not a rounding of it — `DrawThenFill` (the non-completely
 * variant this pairs with) has the same (0, 0.6)/(0.3, 1) shape.
 */
export const UnDrawThenUnFill = (holon: Holon): Anim =>
  together(restage(UnDraw(holon), 0, 0.6), restage(UnFill(holon), 0.3, 1))

// ─── Morph ──────────────────────────────────────────────────────────
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
 * (geometry/morph.ts) — the verb animates it, it does not create it,
 * because a Dream's holons are its fields and a verb that conjured a new
 * one mid-play would put geometry outside the scene's own declaration.
 * That is also how pydeation reads: `Morph` builds its helper objects
 * and hands them back on the AnimationGroup (`helper_objects`), for the
 * scene to insert.
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
    // It is NOT sound for the source in a scene like this one, whose
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
