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

import { eased, together, type Anim, type Easing, type Windowed } from "../../src/anim"
import { c4dEaseWith, ease } from "../../src/timeline"
import { DottedLine, Line, Stroke } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import type { Holon } from "../../src/holon"
import {
  FLATTEN_TOLERANCE_SLIDE,
  flattenElements,
  type KeyBuild,
  type KeyPathElement,
} from "../../src/geometry/keynote"
import { Connection, keynoteEaseInverse } from "./Connections"

/** Keynote's stroke-draw-on. Core's `Create`, at Keynote's pacing. */
export const LINE_DRAW = "com.apple.iWork.Keynote.LineDrawForLine"
/** The whole-object opacity ramp, under both of the deck's spellings. */
export const DISSOLVE = "apple:dissolve"
export const DISSOLVE_CHARACTER = "apple:dissolve character"
/** On-slide motion along a declared path — see `motionAnim`. */
export const MOTION_PATH = "apple:action-motion-path"
/**
 * The INSTANT appear — no ramp, whatever its record's duration says.
 *
 * Both spellings occur, and all nine instances in the deck sit on P-7's
 * own slides: seven `bc-appear` (36, 45, 46, 47, 48, 49, 52), each one
 * lighting the arrow that the paired `action-motion-path` then glides,
 * and two `appear` on deck 48 (one In, one Out).
 *
 * MEASURED INSTANT, AGAINST ITS OWN DECLARED 1.0s. Every record states
 * `duration: 1.0`, and the footage shows no ramp at all. Deck 47's
 * arrow, peak luminance over its own start-position mask against a
 * clean earlier frame:
 *
 *     t      726.4  726.6  726.8  727.0
 *     max     25     25    255    255
 *
 * A 1.0s ease-both ramp sampled at the reference's 0.2s would pass
 * through roughly 0.03, 0.16, 0.50 and 0.84 of full alpha; nothing
 * between black and full appears on any frame, on any of the three
 * arrows that are cleanly isolated (46, 47, 52). So the effect is a
 * step, and the declared duration is not a ramp length.
 *
 * That has a consequence for the firing model, recorded in
 * `INSTANT_CONSUMES_NO_TIME` below.
 */
export const BC_APPEAR = "apple:bc-appear"
export const APPEAR = "apple:appear"
/**
 * On-slide scaling — implemented, but NOT in `SUPPORTED`, and the
 * distinction is deliberate.
 *
 * `scaleAnim` can play one; what no record carries is the FACTOR to play
 * it with (P-4 established this, P-7 confirmed it in the raw archives).
 * So the effect is only honoured where a scene supplies a measured
 * factor for that specific build id (`Slide.scaleFactors`), which in this
 * deck is one record out of five — deck 56's, the only isolated one.
 *
 * Listing it in `SUPPORTED` would tell every other chapter that the four
 * unmeasured records are handled when they are silently doing nothing.
 * They stay in `unsupported()`, which is the honest report.
 */
export const ACTION_SCALE = "apple:action-scale"

/**
 * The effects the slide vocabulary implements. A build whose effect is
 * not here is reported by `unsupportedBuilds` rather than silently
 * ignored — a slide that quietly drops a build looks exactly like a
 * slide that never had one, and P-2's slide-32 lesson (a held page
 * over-draws an unbuilt label) is the same failure wearing the opposite
 * mask.
 */
export const SUPPORTED = new Set([
  LINE_DRAW,
  DISSOLVE,
  DISSOLVE_CHARACTER,
  MOTION_PATH,
  BC_APPEAR,
  APPEAR,
])

/**
 * An instant build contributes NO delay to the automatic chain.
 *
 * P-5 settled the firing model: an `automatic: true` chunk fires one
 * DECLARED DURATION after its predecessor, an `automatic: false` chunk
 * waits for a click. P-7's slides are the first to put an INSTANT build
 * in the predecessor slot, and there the literal rule over-predicts.
 *
 * The pattern repeats seven times — `bc-appear` on the arrow
 * (`automatic: false`, a click), then `action-motion-path` on the SAME
 * arrow (`automatic: true`, duration 1.0). Read literally, the arrow
 * appears, sits still for a full second, and only then glides. At the
 * reference's 5 fps that stationary second is five frames, and it does
 * not happen on any of the three arrows whose travel is cleanly
 * isolated from other ink:
 *
 *     deck   first arrow ink   fitted motion onset   gap
 *      46        719.2              719.135         +0.065
 *      47        726.8              726.735         +0.065
 *      52        762.0              761.875         +0.125
 *
 * Each gap is under one frame interval: the arrow is already moving in
 * the first frame that shows it. The refinement that reconciles this
 * with P-5's evidence without weakening it: the delay an automatic
 * chunk waits is the predecessor's EFFECTIVE duration, and an instant
 * build's is zero. Every case P-5 measured had a ramping predecessor,
 * where effective and declared duration coincide, so the two readings
 * were indistinguishable there and are distinguished here.
 *
 * Stated as a constant rather than buried in the scenes because it is a
 * claim about the deck, and because a later chapter meeting another
 * instant effect should find it already named.
 */
export const INSTANT_CONSUMES_NO_TIME = true

/** Whether an effect lands in one step rather than over its duration. */
export const isInstant = (record: KeyBuild): boolean =>
  record.effect === BC_APPEAR || record.effect === APPEAR

/**
 * The fraction of an instant build's window its ramp is squeezed into.
 *
 * Not zero: a zero-width window is a degenerate segment, and
 * `Timeline.valueAt` returns the END value for `span <= 0`, which would
 * make the target visible from the clip's start rather than from its
 * onset. A small positive width keeps the segment well-formed and puts
 * the whole transition inside one thousandth of the build's duration —
 * 1 ms on these 1.0s records, against a reference sampled every 200 ms.
 */
export const INSTANT_WINDOW = 0.001

/**
 * KEYNOTE'S `kEaseBoth` IS NOT THE FRAMEWORK'S `smooth` (P-8).
 *
 * Both are the same family — a cubic Bezier value curve with flat value
 * tangents, parameterised by the horizontal tangent length `s`, with
 * control points at (s, 0) and (1 - s, 1) — which is exactly what
 * `c4dEaseWith(u, s, s)` evaluates. They differ in `s`, and the
 * difference is measurable:
 *
 *   - the framework's `smooth` is **s = 0.25**, pydeation's C4D default,
 *     calibrated in `timeline.ts` against video-01's Scene 04;
 *   - Keynote's `kEaseBoth` is **s = 0.42**, which is CSS `ease-in-out`
 *     = `cubic-bezier(0.42, 0, 0.58, 1)` — the x-coordinates are `s` and
 *     `1 - s`, and the y-coordinates 0 and 1 are the flat tangents.
 *
 * MEASURED FOUR TIMES, ON TWO UNRELATED BUILD CLASSES, AND EVERY
 * MINIMUM IS SHARP AND IN THE SAME PLACE. In each case the duration and
 * the geometry are READ from the deck and the onset is the only free
 * quantity — P-7's method, one more parameter swept:
 *
 *   MOTION (`action-motion-path`), rms of the tracked centroid in px:
 *
 *     s          0.25    0.42    best
 *     -------------------------------------
 *     deck 46    2.09    0.44    0.42     straight, 1.0s,  5 samples
 *     deck 56    8.90    1.29    0.42     curved,   3.0s, 13 samples
 *
 *   DISSOLVE (`dissolve character`), rms of the ramped alpha, read as
 *   summed luminance over the target's own settled ink mask:
 *
 *     s          0.25    0.42    best
 *     -------------------------------------
 *     deck 43a   0.0298  0.0164  0.41     2.0s, 8 interior samples
 *     deck 43b   0.0315  0.0075  0.45     2.0s, 7 interior samples
 *
 * A straight path and a curved one; a 1.0s build, two 2.0s builds and a
 * 3.0s one; a position ramp and an opacity ramp; deck slides 43, 46 and
 * 56, spread across 170 seconds of video. The two motion fits land on
 * 0.42 to the sweep's own resolution; the two dissolve fits bracket it
 * at 0.41 and 0.45, which is the precision 7-8 samples of a JPEG
 * luminance ramp can support. At s = 0.25 the same four fits are 4.7x,
 * 6.9x, 1.8x and 4.2x worse.
 *
 * THIS IS A READING, NOT A FIT. The measurement locates a minimum; what
 * makes 0.42 admissible under the refused-fits rule is that the minimum
 * coincides with a NAMED STANDARD curve — CSS `ease-in-out`, whose
 * control points Keynote (a WebKit-era Apple application) would
 * naturally state. A fitted 0.4183 would be a refused fit; 0.42 is the
 * declared constant the measurement points at.
 *
 * P-7's own numbers are unaffected in their conclusions: its seven
 * cursors were fitted with `s = 0.25` and still landed within 1.82 px,
 * because a 54.8 px travel sampled every 0.2 s cannot separate two eases
 * that differ by 5% of the span. Deck 56's 3.0s travel can — which is
 * why this chapter is where it surfaces, and why the correction is
 * reported rather than treated as a defect in P-7's work.
 *
 * A COMPLICATION WORTH STATING: HALF THE DECK DECLARES NO EASING AT ALL.
 *
 * `acceleration` splits the 384 in-scope builds cleanly by CLASS, not by
 * slide:
 *
 *     kEaseBoth   155   every action-motion-path (19), every
 *                       action-scale (5), every LineDraw (130), one
 *                       dissolve character
 *     absent      229   every dissolve (90), 120 of the 121 dissolve
 *                       characters, every appear, fade-and-move
 *
 * So on the archive's own word, the dissolves state no curve — and yet
 * the two 2.0s dissolves measured above are the ones that fit s = 0.42
 * best, at 4x and 9x better than linear. Both facts are real: the field
 * is absent AND the ramp eases.
 *
 * The reading taken here is that an absent `acceleration` is a DEFAULT
 * rather than an assertion of linearity, and Keynote's default for a
 * build is the same ease-both its actions name. That is inference, so it
 * is written down as one. What it is not is a fit: the curve was
 * measured on builds that declare it, and the question here is only
 * whether builds that declare nothing take the same one. The footage
 * says they do.
 *
 * The alternative — dissolves on the framework's `smooth`, motion on
 * Keynote's — was tested rather than argued away: it changes NOTHING on
 * P-5's regression frames (deck 29's frame 2686 scores 0.9664 either
 * way, because its builds have all settled by the scored time) and it
 * would leave the two measured 2.0s ramps fitted 2-4x worse. One curve
 * for one deck, then.
 *
 * The prior chapters' settled scores are unaffected by construction —
 * they are chosen after each segment's last event — and their mid-build
 * frames were re-run (see §Gates in the P-8 report).
 */
export const KEYNOTE_EASE_S = 0.42

/**
 * Keynote's `kEaseBoth`, evaluated at normalized time `u`.
 *
 * Reuses `c4dEaseWith`, which IS this curve family — only the tangent
 * length differs (`KEYNOTE_EASE_S` above). Nothing in `src/` changes:
 * the framework's four named easings keep pydeation's calibration, and
 * this deck's own curve lives beside the deck's own vocabulary.
 */
export const keynoteEase = (u: number): number =>
  c4dEaseWith(u, KEYNOTE_EASE_S, KEYNOTE_EASE_S)

/**
 * How many waypoints reproduce `keynoteEase` through a LINEAR sequence.
 *
 * A `sequence` track with `easing: "linear"` interpolates its waypoints
 * uniformly (`Timeline.valueAt`), so waypoints placed at the Keynote
 * ease's own values reconstruct it directly — with none of the per-pair
 * ripple P-7 had to pre-compensate for, because there is no per-pair
 * ease to fight.
 *
 * Measured max reconstruction error against the exact curve: 0.0086 at
 * 8 waypoints, 0.0022 at 16, 0.00054 at 32, 0.00014 at 64. The quantity
 * it has to resolve is the 0.054 gap between s = 0.25 and s = 0.42, so
 * 32 leaves a 100x margin and is the same count `MOTION_SAMPLES` uses.
 */
export const EASE_SAMPLES = 32

/**
 * A parameter ramp on Keynote's own ease, as a linear waypoint sequence.
 *
 * The framework's `.to()` would apply `smooth` (s = 0.25); this states
 * the s = 0.42 curve explicitly. `from` and `to` are the parameter's
 * endpoint VALUES, and the caller stamps the track `linear` — see
 * `keynoteRamp`'s uses, each of which pairs it with `eased("linear", …)`.
 */
export const keynoteWaypoints = (from: number, to: number): number[] => {
  const out: number[] = []
  for (let k = 0; k <= EASE_SAMPLES; k++) {
    out.push(from + (to - from) * keynoteEase(k / EASE_SAMPLES))
  }
  return out
}

/**
 * An `apple:action-motion-path` as a windowed `Move`.
 *
 * NOT one of the chapter's two verbs, and included for a specific
 * reason: slide 3's "Story" carries one, and rendering it unmoved put
 * the label inside the lens ellipse it should sit above — worth 30
 * points of that segment's `coverage_ref`. Once P-1 carried the path
 * (this chapter's finding), leaving it unimplemented would have meant
 * scoring a frame we knew to be wrong for a reason we could have fixed.
 *
 * The path is DECLARED, relative to the drawable's own position, in
 * slide units — so this reads the endpoint and moves there. The deck's
 * two curved paths (of 34) would need the intermediate points; both are
 * outside the opening arc, and a straight run to the endpoint is exactly
 * right for the 32 that are straight, so the curve case is left to P-7,
 * which owns this build class properly. `motionIsStraight` says which
 * kind a record is, so P-7 inherits a boundary rather than a surprise.
 */
export const motionAnim = (
  record: KeyBuild & { motionPath?: readonly KeyPathElement[] },
  target: Holon,
  scale: number,
): Anim => {
  if (!motionIsStraight(record)) {
    const curved = curvedMotionAnim(record, target, scale)
    if (curved) return curved
  }
  const end = motionEndpoint(record)
  if (!end) return { tracks: [] }
  // Slide units are y-DOWN and world units y-up, the same flip
  // slidePointToWorld performs; a delta takes the flip without the
  // origin shift.
  return together(target.x.by(end.x * scale), target.y.by(-end.y * scale))
}

/**
 * How many waypoints a curved path is resampled into.
 *
 * The count is set by the RIPPLE it has to suppress, not by the curve's
 * own shape — see `curvedMotionAnim` for why a resampled path fights the
 * renderer's per-pair easing. Measured residual against the desired
 * single ease: 0.036 of the path at 4 waypoints, 0.0060 at 16, 0.0030 at
 * 32, 0.0015 at 64 — an O(1/N) convergence. 32 puts the worst deviation
 * at 0.3% of a 285-unit path, i.e. 0.6 slide units or 0.4 video pixels,
 * comfortably under the 5 fps reference's own resolution, and costs 33
 * waypoints on ONE build in the whole deck.
 */
export const MOTION_SAMPLES = 32

/**
 * A curved `action-motion-path`, driven arc-length-uniformly.
 *
 * P-3 implemented the straight case and named this boundary rather than
 * hiding it: `motionAnim` read the path's ENDPOINT and moved there,
 * which is exactly right for a two-node run whose controls sit on its
 * ends, and silently wrong for a path that bows away from its chord.
 *
 * ONE RECORD IN SLIDES 1-58 IS CURVED, AND IT IS DECK SLIDE 56.
 *
 * P-1 carried the census as "34 motion paths, 32 straight, 2 curved",
 * which is the whole 83-slide FILE. Within the video's own scope
 * (slides 1-58, the canon policy) there are 19 motion paths and exactly
 * ONE is curved: build 5602009 on deck slide 56, a 3.0s two-segment
 * cubic run travelling (-284.409, -170.965) slide units with real
 * control points. The second curved record lives in slides 59-83, which
 * appear nowhere in the video. That is a correction to the inherited
 * figure's SCOPE, not to its arithmetic.
 *
 * Deck slide 56 is not in P-7's own row (33-38, 45-53), so this code is
 * written against the DATA and tested synthetically, and the report says
 * plainly that the footage never exercises it. All seven motion paths
 * P-7 does own are straight, and they take the endpoint branch above.
 *
 * WHY RESAMPLING FIGHTS THE RENDERER, AND WHAT IS DONE ABOUT IT
 *
 * The obvious implementation — flatten the curve, hand the points to
 * `sequence` — produces a visibly wrong motion, and the reason is in
 * `Timeline.valueAt`: a `sequence` track eases each CONSECUTIVE PAIR of
 * waypoints over its own sub-span, so N waypoints give N accelerate-
 * decelerate cycles instead of the one the deck declares. Sampled at
 * five points the composite runs 0.032/0.092/0.158/0.218/0.250 across
 * the first quarter where a single ease wants a smooth ramp — the
 * velocity pulses at every junction.
 *
 * So the waypoints are placed to CANCEL that. Waypoint k sits at the
 * arc-length fraction `ease(k/N)` of the flattened path, and the
 * renderer's per-pair easing then composes with that placement to
 * reproduce the single declared ease. The composite converges on the
 * desired curve as the sample count rises (see `MOTION_SAMPLES`), which
 * is the test that pins it.
 *
 * ARC LENGTH, NOT PARAMETER. A cubic's parameter runs fast where the
 * control points bunch, so stepping t uniformly would make the target
 * dawdle and lurch along a path whose own declared timing is uniform.
 * The flattener returns a polyline; this walks its cumulative chord
 * length and inverts it, which is the same arc-length reparameterisation
 * `DrawSteady` uses on a stroke.
 */
export const curvedMotionAnim = (
  record: KeyBuild & { motionPath?: readonly KeyPathElement[] },
  target: Holon,
  scale: number,
): Anim | undefined => {
  const path = record.motionPath
  if (!path || path.length < 2) return undefined

  // The flattener is svg.ts's, reached through keynote.ts — same
  // recursive de Casteljau the shape importer uses, so a motion path and
  // a drawn outline are flattened by one code path and cannot drift
  // apart. The path is RELATIVE to the drawable's position and already
  // in slide units, so it needs no frame fit — only the tolerance.
  const subpaths = flattenElements(path, FLATTEN_TOLERANCE_SLIDE)
  const pts = subpaths[0]?.points
  if (!pts || pts.length < 2) return undefined

  // Cumulative chord length — the arc-length table.
  const cum: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const total = cum[cum.length - 1]!
  if (total <= 1e-9) return undefined

  /** The point at arc-length fraction s, by inverting the table. */
  const atFraction = (s: number): { x: number; y: number } => {
    const want = s * total
    let i = 1
    while (i < cum.length - 1 && cum[i]! < want) i++
    const a = pts[i - 1]!
    const b = pts[i]!
    const seg = cum[i]! - cum[i - 1]!
    const u = seg <= 1e-9 ? 0 : (want - cum[i - 1]!) / seg
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
  }

  // THE DECLARED EASING IS KEYNOTE'S, NOT THE FRAMEWORK'S (P-8).
  //
  // Every action build in the deck states `kEaseBoth`. P-7 mapped that
  // onto the framework's symmetric `smooth`, which is the same curve
  // FAMILY at a different tangent length — pydeation's s = 0.25 rather
  // than Keynote's s = 0.42. On this very build the difference is
  // measurable and large: fitted against the footage, s = 0.42 lands
  // 1.29 px rms where s = 0.25 lands 8.90 px, and the same sweep on one
  // of P-7's own straight cursors agrees to the sweep's resolution. See
  // `KEYNOTE_EASE_S` for the measurement and for why 0.42 is a reading
  // (CSS `ease-in-out`) rather than a fit.
  //
  // The waypoints are therefore placed on the KEYNOTE ease and the track
  // is stamped `linear`, so `Timeline.valueAt` interpolates them
  // uniformly and reconstructs that curve directly. This also removes
  // P-7's pre-compensation problem rather than re-solving it: there is
  // no per-pair ease left to fight, so the ripple that forced the
  // `ease(k/N)` placement is gone and the samples are the curve itself.
  const xs: number[] = []
  const ys: number[] = []
  for (let k = 0; k <= MOTION_SAMPLES; k++) {
    const p = atFraction(keynoteEase(k / MOTION_SAMPLES))
    xs.push(p.x * scale)
    // Slide units are y-DOWN, world y-up — the same flip the straight
    // branch performs.
    ys.push(-p.y * scale)
  }

  // `sequence` states ABSOLUTE waypoints, and the path is relative to
  // wherever the drawable already sits, so the offsets are added to the
  // target's current position at compose time. The first sample is the
  // path's own origin (0,0) and therefore the target's own place.
  const x0 = target.x.value
  const y0 = target.y.value
  return eased(
    "linear",
    target.x.sequence(...xs.map((v) => x0 + v)),
    target.y.sequence(...ys.map((v) => y0 + v)),
  )
}

/**
 * The measured factor an `apple:action-scale` build scales its target by.
 *
 * THE RECORD DECLARES NO MAGNITUDE, AND THAT IS CONFIRMED RATHER THAN
 * ASSUMED. P-4 declined to score deck slide 10's action-scale on exactly
 * this ground, and P-7 checked the raw archives for all five in the
 * deck: they carry `actionMotionPathSource` where a motion path is
 * declared and no scale analogue at all — no `actionScaleSource`, no
 * factor on the build's attributes. The absence is in the archive.
 *
 * SO THE FACTOR IS MEASURED, WHICH IS THE ADMISSIBLE ROUTE. Under the
 * refused-fits rule (DECISIONS 2026-09-07, refined at O-11) a quantity
 * that exists ONLY in the footage is measured, not fitted — the same
 * standing that every click onset in this campaign has. Deck slide 56 is
 * the one place the deck makes this measurable cleanly: its action-scale
 * shares a target and a 3.0s window with the curved motion path, on a
 * `Man_83` figure travelling across empty stage with nothing overlapping
 * it, so its own ink can be isolated frame by frame.
 *
 * Tracking that figure's bounding box through its travel and correcting
 * for its 3.0-unit stroke (which adds one width to each dimension):
 *
 *     declared box height  44.400 px      measured at rest  44.0
 *     declared box width   17.198 px      measured at rest  ~17
 *     measured height, end of travel      35.0
 *     ratio                                0.795
 *
 * and the resulting arrival box, scaled about the box CENTRE, predicts
 * the figure's ink at x[649.3, 665.1] y[278.5, 316.0] against a measured
 * x[649, 664] y[278, 315]. Sub-pixel on three of four edges.
 *
 * 0.8 is quoted rather than 0.795 for the same reason `KEYNOTE_EASE_S`
 * is 0.42 rather than 0.4183: the measurement locates a round number
 * that an author would type, and reporting the third digit would be
 * claiming a precision the 5 fps reference does not carry.
 *
 * ONLY DECK 56 IS SCORED ON THIS. The other four action-scale records
 * (deck slides 10, 17, 21 x2) are NOT given this factor: each would need
 * its own measurement, and none of them is isolated the way this one is.
 * P-4's decision not to score deck 10 stands. This constant is what deck
 * 56's own footage says about deck 56's own build.
 */
export const ACTION_SCALE_D56 = 0.8

/**
 * An `apple:action-scale` as a windowed scale about the target's centre.
 *
 * The factor is the caller's, because the record does not carry one —
 * see `ACTION_SCALE_D56` for what is measurable and where. A caller with
 * no measurement for its own build should not call this; `Slide.build`
 * reports the record through `unsupported()` instead, which is what the
 * other four action-scale records in the deck get.
 *
 * The ramp is Keynote's ease, spelled the same way `curvedMotionAnim`
 * spells it: waypoints on `keynoteEase`, track stamped `linear`.
 */
export const scaleAnim = (target: Holon, factor: number): Anim =>
  eased("linear", target.scale.sequence(...keynoteWaypoints(target.scale.value, target.scale.value * factor)))

/** A motion path's final point, relative to the drawable's position. */
export const motionEndpoint = (
  record: KeyBuild & { motionPath?: readonly KeyPathElement[] },
): { x: number; y: number } | undefined => {
  const last = record.motionPath?.[record.motionPath.length - 1]
  const pts = last?.points
  const pt = pts?.[pts.length - 1]
  return pt ? { x: pt.x, y: pt.y } : undefined
}

/**
 * Whether a motion path is a straight run — two nodes whose controls sit
 * on their endpoints. The deck has 34 motion paths, 32 straight and 2
 * genuinely curved; only the straight ones are honoured here.
 */
export const motionIsStraight = (
  record: KeyBuild & { motionPath?: readonly KeyPathElement[] },
): boolean => {
  const path = record.motionPath
  if (!path || path.length !== 2) return false
  const pts = path[1]!.points ?? []
  if (pts.length !== 3) return pts.length === 1
  const [c1, c2, end] = pts as [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ]
  const on = (p: { x: number; y: number }, q: { x: number; y: number }): boolean =>
    Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6
  return (on(c1, { x: 0, y: 0 }) || on(c1, end)) && on(c2, end)
}

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
 * Direction 53 — the draw that opens at the line's OWN MIDDLE and runs
 * to both ends at once. P-4's finding, measured.
 *
 * P-1 carried `direction` uninterpreted and said so: three values occur
 * (51 once, 52 twenty-eight times, 53 fifteen times), the field is
 * absent on 114 of the deck's 158 LineDrawForLine builds, and naming
 * what they mean from four samples would be a guess. P-3 measured 51 and
 * 52 on slide 2 and found both drawing centre-outward *relative to the
 * page*, which its geometric fallback reproduces without reading the
 * field at all.
 *
 * **53 is not that, and the fallback gets it backwards.** All fifteen of
 * deck slide 9's builds declare it — the only slide in the deck that
 * does — and the footage shows each line growing from its own midpoint
 * symmetrically outward. Sampling ink at fractions along one 594-unit
 * mesh line as it draws (f_00861..871, the 2.0s window from 172.08):
 *
 *     t       0%  10%  20%  30%  40%  50%  60%  70%  80%  90% 100%
 *     172.4    -    -    -    -    -  255    -    -    -    -    -
 *     172.8    -    -    -    -  173  255    -    -    -    -    -
 *     173.0    -    -    -    -  254  255  255    -    -    -    -
 *     173.2    -    -    -  255  254  255  255  253    -    -    -
 *     173.4    -    -  251  255  254  255  255  253  255    -    -
 *     173.8    -  255  255  255  254  255  255  253  253  255    -
 *
 * The middle lights first and the front advances in BOTH directions at
 * the same rate, reaching 40/60 together, then 30/70, then 20/80. Two
 * other lines of different lengths repeat it exactly. A one-ended draw
 * — in either direction — would light one column at a time from one
 * side, which is what our render did and what the mid-draw composite
 * showed as mirrored red/green fronts.
 *
 * Only 53 is claimed here. 51 and 52 keep P-3's geometric resolution,
 * because that is what was measured for them, and the absent case stays
 * the default.
 */
export const DIRECTION_FROM_MIDDLE = 53

/** Whether a build's declared direction is the midpoint-outward draw. */
export const drawsFromMiddle = (
  build: KeyBuild & { direction?: number },
): boolean => build.direction === DIRECTION_FROM_MIDDLE

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

  // A motion path needs the slide-to-world scale, which only the Slide
  // has; `Slide.build` routes it before reaching here.
  if (record.effect === MOTION_PATH) return { tracks: [] }

  // bc-appear / appear: a STEP, not a ramp — see BC_APPEAR for the
  // footage.
  //
  // The step has to be built rather than merely asked for. A `.to()`
  // spans its whole window (`Timeline` reads it as `[previous, value]`
  // and interpolates), so stating one over a 1.0s build would produce
  // exactly the fade the measurement rules out. Squeezing the ramp into
  // the window's first instant is what makes it a step: at any sampled
  // time at or past the onset the value has already arrived.
  if (isInstant(record)) {
    return together([rampOpacity(target, [out ? 0 : 1]), 0, INSTANT_WINDOW])
  }

  // dissolve / dissolve character: one uniform opacity ramp on KEYNOTE's
  // ease. The deck's `delivery: "All at Once"` is what makes the two
  // spellings identical; see the module header for the footage that
  // confirms it, and `KEYNOTE_EASE_S` for the two 2.0s ramps on deck 43
  // that measure the curve.
  return out ? rampOpacity(target, [0], true) : rampOpacity(target, [0, 1], true)
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
/**
 * The tracks that carry a Connection's end decorations through a draw.
 *
 * A head does not queue behind the last dash; it RIDES THE FRONT, lit
 * from the first frame and translating along the shaft as the draw
 * advances (`Connection.headFront`, and P-10's measurement in its
 * doc-comment). So it contributes two things: the front parameter, swept
 * 0→1 across the whole window, and a `creation` of 1 stamped at the
 * start so the outline is drawn rather than waiting to be swept in.
 *
 * `Out` runs it backwards — the head retreats along the shaft as the
 * line un-draws, which is what an Out build is: the In build's effect,
 * played to remove.
 */
const headTracks = (target: Connection, out: boolean): Windowed[] => {
  void target.parts
  if (target.arrows.length === 0) return []
  const tracks: Windowed[] = [
    [out ? target.headFront.sequence(1, 0) : target.headFront.sequence(0, 1), 0, 1],
  ]
  for (const a of target.arrows) {
    tracks.push([a.creation.to(out ? 0 : 1), 0, 0])
  }
  return tracks
}

export const lineDrawAnim = (
  target: Holon,
  reversed: boolean,
  out = false,
  fromMiddle = false,
): Anim => {
  // A `Connection` owns its own continuous dash lattice and its
  // arrowhead, and draws them in one ordering — from the `from` end,
  // from the `to` end, or (direction 53) from its own middle outward to
  // both. It is the mesh's whole draw-on: slide 9 fires fifteen of
  // these, slide 11 seventy.
  if (target instanceof Connection) {
    void target.parts
    // The DASHES carry the sweep; the head is not one of them. It rides
    // the front instead of waiting at the tip — `Connection.headGlide`,
    // driven below — because the footage draws it AT the advancing front
    // from the first frame (P-10: zero ink beyond the front across four
    // consecutive frames on the 25 longest corridors; a head parked at
    // its final position would light that far column immediately).
    const items = target.dashes
    const n = items.length
    if (n === 0) return { tracks: [] }

    // THE FRONT IS EASED, NOT LINEAR, and this is where that lands.
    //
    // A spatial draw is windowed by POSITION and eased in TIME, so the
    // dash occupying arc fraction [k/n, (k+1)/n] must open when the
    // EASED front arrives there — at `keynoteEaseInverse(k/n)`, not at
    // `k/n`. Uniform windows make the front linear, which is what this
    // did before: measured on deck slide 11's seventy lines, the eased
    // front tracks the footage at rms 0.0120 against the linear front's
    // 0.0617, a 5.1x separation (P-10). It is also the retrodiagnosis of
    // this chapter's own two failing mid-draw frames, whose deficit is
    // entirely in `coverage_ours` with `coverage_ref` at 1.0000 — pure
    // overdraw, which is exactly what a linear front does against an
    // eased one through the whole first half. I had recorded those as
    // 5 fps sampling noise; sampling noise scatters both ways across
    // frames and this does not.
    const front = (f: number): number =>
      out ? 1 - keynoteEaseInverse(1 - f) : keynoteEaseInverse(f)

    if (fromMiddle) {
      // Each dash's window is set by its DISTANCE from the middle, so
      // the two fronts advance together and the whole line finishes at
      // the same instant however unevenly the dashes sit about the
      // centre. See `DIRECTION_FROM_MIDDLE` for the footage.
      //
      // The reach is the number of STEPS each front takes, not the
      // distance to the last dash's index: with an even dash count the
      // middle falls between two dashes, so the outermost sits
      // (n-1)/2 away and needs a window ENDING at 1, which means
      // dividing by that distance plus the one step that covers it.
      // Dividing by the distance alone gave the outermost dash a
      // [1, 1] window — zero width, so the two ends of every mesh line
      // silently never drew.
      const mid = (n - 1) / 2
      const steps = Math.max(mid + 0.5, 1e-9)
      const midTracks: Windowed[] = items.map((d, i): Windowed => {
        const from = Math.abs(i - mid) - 0.5
        return [
          out ? d.creation.to(0) : d.creation.sequence(0, 1),
          front(Math.max(0, from / steps)),
          front(Math.min(1, (from + 1) / steps)),
        ]
      })
      midTracks.push(...headTracks(target, out))
      return together(...midTracks)
    }
    const tracks: Windowed[] = items.map((d, i): Windowed => {
      const k = reversed ? n - 1 - i : i
      return [
        out ? d.creation.to(0) : d.creation.sequence(0, 1),
        front(k / n),
        front((k + 1) / n),
      ]
    })
    tracks.push(...headTracks(target, out))
    return together(...tracks)
  }
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
  // front. Fall back to the ramp rather than animating nothing, on the
  // same Keynote ease the dissolves take.
  return out ? rampOpacity(target, [0], true) : rampOpacity(target, [0, 1], true)
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
  // An Action build (a motion path, a scale) operates on something the
  // page is already showing — there is nothing to hold back, and hiding
  // it would blank a drawable the footage has on screen throughout.
  if (record.animationType === "Action") return { tracks: [] }
  if (record.effect === LINE_DRAW) {
    if (target instanceof Connection) {
      void target.parts
      // The head is held back by its POSITION, not by its creation:
      // `headFront` to 0 parks it at the shaft's origin, where the draw
      // begins, so it is in place to ride the front out. Its outline is
      // still pushed to nothing alongside the dashes — an unbuilt line
      // must show nothing at all, head included.
      return together(
        ...target.drawn().map((d) => d.creation.to(0)),
        target.headFront.to(0),
      )
    }
    if (target instanceof DottedLine) {
      void target.parts
      return together(...target.dashes.map((d) => d.creation.to(0)))
    }
    return target.creation.to(0)
  }
  return rampOpacity(target, [0])
}

/** Builds whose effect this chapter does not implement, for reporting. */
export const unsupportedBuilds = (builds: readonly KeyBuild[]): KeyBuild[] =>
  builds.filter((b) => !SUPPORTED.has(b.effect))

/** A Stroke's polyline endpoints, for the direction fallback. */
export const strokeEnds = (
  stroke: Holon,
): { start: { x: number; y: number }; end: { x: number; y: number } } | undefined => {
  const pts =
    stroke instanceof Line || stroke instanceof DottedLine || stroke instanceof Connection
      ? stroke.points
      : []
  if (pts.length < 2) return undefined
  const a = pts[0]!
  const b = pts[pts.length - 1]!
  return { start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y } }
}

/** True when a holon is one of the things a build can drive. */
export const isBuildable = (h: Holon): boolean =>
  h instanceof Stroke || h instanceof Text

/**
 * An opacity ramp that reaches what actually draws.
 *
 * The renderer reads opacity per drawn primitive with no inheritance
 * (render/three-host.ts), and a `DottedLine` draws nothing itself — it
 * parents one `Line` per dash. So a dissolve stated on a DottedLine
 * changes no pixel. Every opacity in this module goes through here for
 * that reason; it is the same fact `Slides.ts`'s `opacityOf` records,
 * and both exist because the two files reach it from different sides.
 */
export const rampOpacity = (
  target: Holon,
  values: readonly number[],
  /**
   * Ramp on KEYNOTE's ease rather than the framework's (`KEYNOTE_EASE_S`
   * — measured, twice, on this deck's own 2.0s dissolves).
   *
   * Off by default because the one caller that must NOT take it is the
   * instant step: `bc-appear` squeezes its whole transition into
   * `INSTANT_WINDOW`, where the curve's shape is unobservable and 33
   * waypoints inside one millisecond would be noise with a cost.
   */
  keynote = false,
): Anim => {
  const drawn: Holon[] =
    target instanceof Connection
      ? (void target.parts, target.drawn())
      : target instanceof DottedLine
        ? (void target.parts, target.dashes)
        : [target]
  if (keynote) {
    // Waypoints on the Keynote curve, interpolated LINEARLY — the same
    // construction `curvedMotionAnim` uses, and for the same reason: a
    // linear `sequence` reproduces whatever curve its waypoints trace,
    // so the ease is stated in the samples rather than asked of the
    // renderer, whose four named easings are pydeation's.
    //
    // An `Out` ramp states one value and starts from whatever the target
    // currently holds, which at build time is 1.
    const from = values.length === 1 ? 1 : values[0]!
    const to = values[values.length - 1]!
    const wp = keynoteWaypoints(from, to)
    return eased("linear", ...drawn.map((h) => h.opacity.sequence(...wp)))
  }
  return together(
    ...drawn.map((h) =>
      values.length === 1
        ? h.opacity.to(values[0]!)
        : h.opacity.sequence(...values),
    ),
  )
}
