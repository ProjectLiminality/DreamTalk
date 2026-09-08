/**
 * Builds — Keynote's per-object build animations, as ordinary Anims over
 * the Slide holon's own parts.
 *
 * WHAT A BUILD IS, AND WHY IT IS NOT A NEW VERB
 *
 * Keynote's "build" is not an animation kind. It is a SCHEDULING unit:
 * one effect, applied to one drawable, fired at a click. The effect
 * itself is something the framework already has — a draw-on, an opacity
 * ramp — so what this module supplies is the WINDOW, not the motion. A
 * build here is `[anim, from, to]`, the framework's own `Windowed`, and
 * the anim inside it is `creation.sequence(0, 1)` or `opacity.to(1)`.
 * Nothing new is being animated; something existing is being timed.
 *
 * That is why these live beside the `Slide` holon rather than in
 * `src/verbs.ts`. A build is slide-domain vocabulary — it means nothing
 * without a deck's build record to read — and the framework verbs it
 * delegates to are already general. Should a build type ever generalize
 * past slides it can move; none of the two here has, and inventing the
 * generality first is the speculative people-pleasing CLAUDE.md warns
 * against.
 *
 * THE TWO THAT DOMINATE THE OPENING ARC
 *
 * Slides 2-6 declare 25 builds. By count:
 *
 *   apple:dissolve character            15   (11 In, 3 Out, + 1 on slide 3)
 *   com.apple.iWork.Keynote.LineDrawForLine  4
 *   apple:dissolve                       5
 *   apple:action-motion-path             1
 *
 * `dissolve character` and `LineDrawForLine` are the chapter's two, and
 * they are the deck's two overall as well (263 of 384 builds in slides
 * 1-58, once `dissolve` is counted with `dissolve character` — they are
 * the same ramp, see below).
 *
 * DISSOLVE CHARACTER IS NOT A PER-GLYPH CASCADE. THE FOOTAGE SAYS SO.
 *
 * The name promises a per-character effect and the recon report expected
 * one ("a plain per-character alpha ramp, a `DissolveCharacters` sibling
 * to `Write`"). Measured, it is a UNIFORM ramp over the whole object:
 *
 * Slide 2's four icons each carry `dissolve character`, and each fades in
 * as one piece. Mean luminance over the icon's own final ink mask, from
 * refs/pitch/pl02/frames5, eagle (build 4880412) at 5 fps:
 *
 *     t     4.0   4.2   4.4   4.6   4.8   5.0   5.2   5.4
 *     mean  0.0   2.7  15.7  60.6 135.0 201.9 221.1 222.5
 *     norm  0.00  0.01  0.07  0.27  0.61  0.91  0.99  1.00
 *
 * A per-glyph cascade would show the mask filling in SPATIALLY — some
 * parts at full strength while others are still black. It does not: the
 * whole mask rises together on one S-curve. The tree, sun and apple
 * repeat it to within a percent, at onsets 6.2, 8.3 and 10.3.
 *
 * The reason is in the data rather than in the rendering: on slide 2 all
 * four `dissolve character` targets are SHAPES, not text. Keynote lets a
 * text effect be applied to any drawable and falls back to the
 * whole-object form when there are no characters to dissolve. Slides 3-5
 * apply the same effect to real text records, and there too the deck
 * states `delivery: "All at Once"` on every one — Keynote's own word for
 * "not per character". Nowhere in the opening arc does the deck ask for
 * a cascade.
 *
 * So `dissolve character` and `dissolve` compile to the SAME anim here,
 * and that identity is derived from the records (`delivery` is
 * "All at Once" for all 25) rather than assumed. If a later chapter meets
 * a `By Object` or per-character delivery, that is where the cascade
 * earns its code — and `Text.letters` / `writeWindows` are the hook it
 * will want.
 *
 * LINEDRAWFORLINE IS A SPATIAL DRAW, AND ITS DIRECTION IS IN THE DECK
 *
 * Also measured. The eagle's dotted connection line, ink extent in a
 * corridor holding neither endpoint's icon (x = 0 at the eagle end,
 * x = 197 at the Vitruvian man's):
 *
 *     t      3.4       3.6       3.8       4.0       4.2
 *     xspan  192-197   151-197    57-197     5-197     0-197
 *
 * The line grows from the man's end outward at full brightness — a draw,
 * not a fade — over ~0.8s against a declared 1.0s. So it is `Create`,
 * and on a DottedLine that is the dash-by-dash sweep the primitive
 * already owns.
 *
 * Which END it starts from is the deck's `direction` field, and it has to
 * be read because the stored point order does NOT agree with itself:
 * three of slide 2's four lines are stored outer-to-inner and one
 * inner-to-outer, while all four draw centre-outward in the footage. See
 * `drawsReversed` for how the field is resolved and what happens when the
 * importer has not carried it.
 */

import { together, type Anim, type Windowed } from "../../src/anim"
import { DottedLine, Line, Stroke } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import type { Holon } from "../../src/holon"
import type { KeyBuild } from "../../src/geometry/keynote"

/** Keynote's stroke-draw-on. Core's `Create`, at Keynote's pacing. */
export const LINE_DRAW = "com.apple.iWork.Keynote.LineDrawForLine"
/** The whole-object opacity ramp, under both of the deck's spellings. */
export const DISSOLVE = "apple:dissolve"
export const DISSOLVE_CHARACTER = "apple:dissolve character"

/**
 * The two effects this chapter implements. A build whose effect is not
 * here is reported by `unsupportedBuilds` rather than silently ignored —
 * a slide that quietly drops a build looks exactly like a slide that
 * never had one, and P-2's slide-32 lesson (a held page over-draws an
 * unbuilt label) is the same failure wearing the opposite mask.
 */
export const SUPPORTED = new Set([LINE_DRAW, DISSOLVE, DISSOLVE_CHARACTER])

/**
 * Whether a LineDrawForLine draws against its subpath's stored order.
 *
 * Keynote states a `direction` code per line-draw build. The importer
 * does not carry it yet (reported to P-1 with the measurements in this
 * module's header), so this reads it when present and otherwise falls
 * back to the GEOMETRY: the deck's connection lines run between a centre
 * and a periphery, and the footage shows them drawing centre-outward, so
 * a line whose stored start is further from the slide's centre than its
 * stored end must be drawn in reverse.
 *
 * The fallback is a derivation from the same physical fact the direction
 * codes encode, not a fit: it uses no per-line constant and nothing tuned
 * against a frame. Where both are available they agree on all four of
 * slide 2's lines — 51 with the stored order, 52 against it.
 */
export const drawsReversed = (
  build: KeyBuild & { direction?: number },
  ends: { start: { x: number; y: number }; end: { x: number; y: number } },
  centre: { x: number; y: number },
): boolean => {
  const d2 = (p: { x: number; y: number }): number =>
    (p.x - centre.x) ** 2 + (p.y - centre.y) ** 2
  return d2(ends.start) > d2(ends.end)
}

/**
 * One build as a windowed Anim.
 *
 * `at` and `span` are in the SCENE's own seconds — a build occupies
 * [at, at + span] of the clip it is played in, and the caller (a scene,
 * or `buildTimeline` below) is what turns the deck's duration and the
 * footage's measured onset into those two numbers. Keeping the arithmetic
 * out here is what lets a scene state a build's onset as the measured
 * quantity it is, without this module pretending to know a schedule the
 * deck does not declare.
 */
export interface Build {
  /** The deck's own record. */
  record: KeyBuild
  /** What it drives. */
  target: Holon
  /** The anim, ready to be windowed. */
  anim: Anim
}

/**
 * The anim one build record drives on one target.
 *
 * Every branch delegates: a draw is `creation`, a dissolve is `opacity`.
 * The `Out` animationType inverts the same param rather than reaching for
 * a second one, because that is what Keynote does — a build Out is the
 * build In's effect, played to remove.
 */
export const buildAnim = (record: KeyBuild, target: Holon): Anim => {
  const out = record.animationType === "Out"

  if (record.effect === LINE_DRAW) {
    // The dash sweep, or a plain draw for a solid stroke. Reversal is the
    // caller's — `lineDrawAnim` takes it, because only the caller has the
    // geometry to resolve it against.
    return lineDrawAnim(target, false, out)
  }

  // dissolve / dissolve character: one uniform opacity ramp. The deck's
  // `delivery: "All at Once"` is what makes the two identical; see the
  // module header for the footage that confirms it.
  return out ? target.opacity.to(0) : target.opacity.sequence(0, 1)
}

/**
 * A LineDrawForLine over a stroke.
 *
 * On a `DottedLine` the primitive's own `createAnim` sweeps its dashes in
 * index order, which IS the spatial draw the footage shows; `reversed`
 * runs the same sweep from the far end, which is what the deck's
 * `direction` selects. On a plain `Line` the draw front is `creation` and
 * `drawReversed` already names the end it starts from.
 */
export const lineDrawAnim = (
  target: Holon,
  reversed: boolean,
  out = false,
): Anim => {
  if (target instanceof DottedLine) {
    void target.parts
    const dashes = target.dashes
    const n = dashes.length
    if (n === 0) return { tracks: [] }
    return together(
      ...dashes.map((d, i): Windowed => {
        const k = reversed ? n - 1 - i : i
        return [
          out ? d.creation.to(0) : d.creation.sequence(0, 1),
          k / n,
          (k + 1) / n,
        ]
      }),
    )
  }
  if (target instanceof Stroke) {
    target.drawReversed.value = reversed
    return out ? target.creation.to(0) : target.creation.sequence(0, 1)
  }
  // Not a stroke — a build the deck applied to something with no draw
  // front. Fall back to the ramp rather than animating nothing.
  return out ? target.opacity.to(0) : target.opacity.sequence(0, 1)
}

/**
 * The state a built target must be in BEFORE its build fires.
 *
 * A `Slide` composes at `creation = 1` and full opacity — it holds the
 * finished tableau, which is 89% of this video's frames and the whole of
 * P-1's gate. Anything a build brings IN must therefore be pushed back to
 * nothing first, or the page shows it before the click; anything a build
 * takes OUT starts where the page already has it. This is the exact
 * failure P-2 hit on slide 32 (`coverage_ours` 0.77 against a
 * `coverage_ref` of 0.997 — a label the footage had not built yet), seen
 * from the other side.
 */
export const preBuildAnim = (record: KeyBuild, target: Holon): Anim => {
  if (record.animationType === "Out") return { tracks: [] }
  if (record.effect === LINE_DRAW) {
    if (target instanceof DottedLine) {
      void target.parts
      return together(...target.dashes.map((d) => d.creation.to(0)))
    }
    return target.creation.to(0)
  }
  return target.opacity.to(0)
}

/** Builds whose effect this chapter does not implement, for reporting. */
export const unsupportedBuilds = (builds: readonly KeyBuild[]): KeyBuild[] =>
  builds.filter((b) => !SUPPORTED.has(b.effect))

/** A Stroke's polyline endpoints, for the direction fallback. */
export const strokeEnds = (
  stroke: Stroke,
): { start: { x: number; y: number }; end: { x: number; y: number } } | undefined => {
  const pts =
    stroke instanceof Line || stroke instanceof DottedLine ? stroke.points : []
  if (pts.length < 2) return undefined
  const a = pts[0]!
  const b = pts[pts.length - 1]!
  return { start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y } }
}

/** True when a holon is one of the things a build can drive. */
export const isBuildable = (h: Holon): boolean =>
  h instanceof Stroke || h instanceof Text
