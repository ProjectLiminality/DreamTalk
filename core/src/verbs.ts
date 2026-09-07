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
