/**
 * SetPieces.ts — A DreamWeaving
 *
 * "Project Liminality" (2023), the three long-build set pieces: deck
 * slides 16, 17, 18 and 59 — video seconds 263.0-369.4 and 861.0-893.8.
 * The Social Machine assembling out of a ring of heads; the six social
 * organisms flying apart while the machine at their centre swells to
 * fill the frame; the mass-hypnosis towers; and, at the far end of the
 * pitch, the Liminal Flow mountain drawing itself line by line.
 *
 * Chapter P-9's gate. The row called them "assembly / long-build
 * choreography… by construction needs no new capability; it is the
 * integration test". Under the standing instruction that a row title is
 * a hypothesis, the census says the first half of that is right and the
 * second half is the interesting part: no new VERB is needed, but the
 * FIRING MODEL these slides exercise is not the one the campaign had
 * settled, and one of the three slides is not in the deck as the video
 * shows it.
 *
 * WHAT THE ROW GOT RIGHT, AND THE THREE THINGS IT DID NOT SAY
 *
 * 1. THE SET IS FOUR SLIDES, NOT THREE, AND ONE OF THEM WAS INVISIBLE.
 *
 * The recon's row named "16, 17, 58". Under P-1's +1 shift the third is
 * deck 59 — and deck 59 was not being decoded at all. `keydecode.py`
 * cut the deck at `slide_ids[:58]` with the comment "only slides 1-58
 * are in the video", which predates P-1's own correction and contradicts
 * it: the video has 58 SEGMENTS, but because deck 18 is real and in the
 * video those segments run deck 1..59. The cut removed exactly the last
 * content slide, which is the recon's "34 builds, the second-densest
 * build count". Routed to the lead and fixed there; the limit is 59 now.
 *
 * 2. THE 82.6-SECOND SEGMENT SPLITS AT 292.0, AND DECK 18 IS SIXTY-EIGHT
 *    SECONDS LONG, NOT SEVEN.
 *
 * P-1 warned that the recon's segment 17 is two slides and that a
 * chapter owning it "must expect a transition inside what the report
 * calls one segment". True, and the split is much earlier than any
 * existing record puts it. `analysis/segments.json` splits at 362.0;
 * 362.0 is deck 18 LEAVING (the one fade-to-black in the whole window,
 * ink exactly 0 at f_01810 and f_01811, and the next tableau is
 * "Wisdom"/"Power", which is deck 19). Deck 18 ARRIVES at 292.0.
 *
 * The proof is geometric, not correlational, which is what makes it
 * decisive on a slide whose thumbnail is a mid-build state and whose
 * correlations are all under 0.2. Deck 17's 176 shapes span video x
 * 348-932 — the ring, and nothing else; deck 18's 48 span x 235-1045,
 * which is exactly the three-tower tableau the footage draws from 293.8
 * onward. So the towers cannot be deck 17's, because deck 17 does not
 * contain them.
 *
 * The transition itself is deck 18's declared 1.5 s FadeThruColor and it
 * is plainly visible once you look in the right place: ink falls 41,571
 * -> 5,101 across 291.8-293.4 and the new tableau settles by 293.8.
 *
 * HOW THIS WAS GOT WRONG FIRST, because the wrong answer was reached by
 * a method that looks sound. Hunting the boundary by ink-difference
 * found a 33-pixel blip at 344.8 and nothing else in the window, and 33
 * pixels changing across a whole frame reads exactly like a crossfade
 * between near-identical tableaux — so 344.8 was recorded as the
 * boundary and even "confirmed" by a second measurement (the lightning
 * bolts' pixel counts tick 916 -> 913 at precisely that frame). Both
 * observations were real; the inference was not. 344.8 is nothing but
 * the last frame before "mass-hypnosis" begins to ramp, and the ticking
 * bolts are JPEG noise on a static frame.
 *
 * The lesson generalises past this slide: a scan finds WHERE something
 * changed, never WHAT changed, and on a deck whose consecutive slides
 * duplicate each other's geometry the two questions have different
 * answers. P-7 recorded this as "scan-finds-where-not-what" and P-8
 * walked into it on deck 54. This is its third outing, and the
 * instrument that settled it was not a better scan but the SHAPE
 * CENSUS — asking which slide's declared geometry can draw the tableau
 * at all.
 *
 * 3. THE FIRING MODEL: THE CHUNK IS THE UNIT AFTER ALL, AND DECK 16 IS
 *    THE APPARENT COUNTER-CASE THAT ISN'T.
 *
 * See the two sections below. This is the chapter's real subject.
 *
 * DECK 16 — FIFTY CHUNKS, THREE FIRINGS, AND TWENTY-FOUR BUILDS THAT
 * NEVER HAPPEN
 *
 * Deck 16 declares 50 builds in 50 chunks: chunk 0 manual, chunks 1-49
 * all `automatic: true`. Read literally through P-5's settled rule — an
 * automatic chunk fires one declared duration after its predecessor —
 * that is a 49-step chain running about 74 seconds. The segment is 16.4
 * seconds long.
 *
 * Fitting all 24 In-builds independently, each against its own exclusive
 * ink mask, on Keynote's ease, with each build's declared duration and
 * only the onset free:
 *
 *     chunks 0-11  (12 heads,  dissolve, 2.0s)  mean 265.407  sd 0.013
 *     chunks 12-23 (12 spokes, LineDraw, 2.0s)  mean 267.307  sd 0.126
 *     chunk 24     (the blue circle group)           275.400
 *     chunk 25     ("Social Machine")                276.325
 *
 * Twelve independent fits landing inside 0.013 s — a quarter of one
 * frame at 5 fps — is not a cascade. The heads arrive together and the
 * spokes arrive together, 1.900 s later against a declared 2.0 (0.95x),
 * and the label follows the circle by 0.925 against 1.0 (0.93x).
 *
 * The reading that FIRST suggested itself was that consecutive automatic
 * chunks of one effect fire as a group, i.e. that the rule steps over
 * groups rather than chunks. Deck 59 refutes that (below), so the honest
 * account of deck 16 is the one that keeps the settled rule: the twelve
 * heads are twelve chunks that Keynote fires as one because a chunk's
 * wait is its predecessor's EFFECTIVE duration and these have none to
 * wait through — P-7's refinement, applied to a case where the whole
 * group is instantaneous relative to the 5 fps sampling. Deck 16 does
 * not overturn the model; it is the model at a density where twelve
 * steps fit inside one frame.
 *
 * What deck 16 DOES establish, and no chapter has recorded:
 *
 *     AN AUTOMATIC CASCADE IS TRUNCATED BY THE OUTGOING CLICK.
 *
 * Chunks 26-49 are 24 `Out` builds that fade every head and every spoke
 * away, leaving the blue circle, the tower and the label. They never
 * fire. The settled tableau at f_01392 has all 12 heads and all 12
 * spokes present, and David clicks to deck 17 at 278.4 — before the
 * chain reaches them. So a slide's declared build list OVERSTATES what
 * the video contains, and deck 16 overstates it by half. Any chapter
 * reading a build census as a description of the footage needs that:
 * the deck says what would happen if the presenter waited, and this
 * presenter did not.
 *
 * DECK 59 — THIRTY-THREE CHUNKS, THIRTY-THREE FIRINGS, IN ORDER
 *
 * Deck 59 is the discriminator, and it is a better one than deck 16
 * because its chunks INTERLEAVE two effects (dissolve, LineDraw,
 * LineDraw, dissolve, dissolve, LineDraw…). If firing grouped by effect,
 * this slide would show a dozen small groups. It does not: it shows
 * thirty-three firings in strict chunk order.
 *
 *     chunk    0      1      2      3      4      5      6  …
 *     onset  861.53 861.94 862.31 862.65 863.19 863.62 863.94
 *
 * A straight line through the thirteen cleanly-isolable chunks fits with
 * residual rms 0.057 s and slope 0.4223 s per chunk. Independently, the
 * whole cascade runs 861.5 to 875.4 — 13.9 s over 32 gaps, 0.434 s each
 * — measured from total-ink alone, with no per-chunk masks involved.
 *
 * Against a declared duration of 0.5 s that is a ratio of 0.85-0.87,
 * where the six prior confirmations of the model measured 0.985-1.010.
 * THE DISCREPANCY IS REPORTED, NOT EXPLAINED. It is stated here rather
 * than absorbed because absorbing it would mean fitting a per-slide
 * rate, which is exactly the move the campaign forbids. Two candidates
 * that would each be a reading rather than a fit, and which a chapter
 * with a second 0.5 s cascade could separate: the wait may be the
 * predecessor's effective rather than declared duration (P-7's
 * refinement — a 0.5 s dissolve may simply not take 0.5 s), or Keynote
 * may floor the automatic delay somewhere below its shortest duration.
 * This chapter has one 0.5 s slide and one is not enough to choose.
 *
 * The scene fires deck 59 on the MEASURED onsets, as every chapter does.
 *
 * DECK 17 — THE ACTION-SCALE THE CAMPAIGN HAS BEEN DECLINING, MEASURED
 *
 * Deck 17 is the six red social organisms around the blue Social
 * Machine, with lightning between them; then the organisms fly outward
 * and the machine swells until it fills the frame and becomes the
 * broadcast tower over its audience. Its 23 builds are:
 *
 *     chunk 0        an Out on a leftover label            (manual)
 *     chunks 1, 2    the four lightning glyphs, In and Out (manual)
 *     chunks 3-8     six `action-motion-path`              (automatic)
 *     chunk 9        one `apple:action-scale`              (automatic)
 *     chunks 10-22   thirteen heads dissolving in          (automatic)
 *
 * The six motion paths DECLARE their travel in full — (6.416, -375.740),
 * (-619.667, -504.825), (471.914, -525.443), (-475.861, 543.345),
 * (543.287, 539.253), (-3.778, 357.497) slide units, one per compass
 * point — so they are read, not fitted, and `motionAnim` already draws
 * them.
 *
 * The `action-scale` is the one that matters. P-4 declined deck 10's on
 * principle ("its action-scale declares no factor, and scoring would fit
 * an undeclared magnitude"), P-7 declined its own, and P-8 measured deck
 * 56's by the one admissible route: a quantity that exists only in the
 * footage is MEASURED. Deck 17's is a better instance than deck 56's on
 * every axis. The target is the blue circle, isolable by colour on an
 * otherwise white tableau; it crosses an empty stage; and its START size
 * is DECLARED — the 26-member group's box is 292.5 slide units, which is
 * 195.0 video px, against a measured 199 whose 4 px difference is
 * exactly the stroke's two half-widths. So only the factor is free:
 *
 *     kEaseBoth (s = 0.42)   onset 288.285   k 3.0932   rms 0.68 px
 *     smooth    (s = 0.25)   onset 288.285   k 3.1094   rms 8.87 px
 *
 * k = 3.09. And the same fit on chunk 3's top ring, against its DECLARED
 * travel of -250.49 video px, tracked on the ring's lower edge (its
 * centroid is clipped once the ring leaves frame, which cost an hour and
 * a wrong answer — the first fit preferred LINEAR at 10.6 px because the
 * clipping fights the ease):
 *
 *     kEaseBoth  onset 288.285  rms  0.73 px
 *     smooth     onset 288.285  rms  9.26 px
 *     linear     onset 288.300  rms 20.45 px
 *
 * Two independent builds of two different classes agreeing on ONE onset
 * to three decimals, each preferring `kEaseBoth` by better than 12x.
 * That is a seventh and eighth confirmation of P-8's ease, on
 * `action-scale` and `action-motion-path` — neither of which P-8 used —
 * and it is why `ACTION_SCALE_D17` may join `ACTION_SCALE_D56` in the
 * measured table without loosening the rule that keeps ACTION_SCALE out
 * of SUPPORTED.
 *
 * THE IMAGES: THE CEILING IS GONE, AND NOBODY HAD TO TRACE ANYTHING
 *
 * P-1 queued this chapter to "trace or source those four assets as
 * paths through Sketch", with a tracer script to write, a tolerance to
 * declare and a source PNG to hash. None of that was necessary.
 * `TSD.ImageArchive` carries a **`tracedPath`** — Keynote's own
 * instant-alpha vectorization — in the same typed element form as every
 * `bezierPathSource`, stated in the image's own `naturalSize` box. The
 * decoder was discarding it with the rest of the archive.
 *
 * All twelve in-scope images carry one, served by two assets: a
 * 35-element lightning glyph (10 instances, four of them on deck 17 and
 * two on deck 18) and the 2,239-element, 194-subpath Vitruvian figure
 * (decks 2 and 3). Verified against the footage rather than merely
 * present — projecting deck 18's left lightning through the ordinary
 * shape fit predicts x 428.2..460.1, y 207.0..286.6 where f_01790
 * measures x 429.0..459.0, y 207.0..285.0, sub-pixel on all four edges;
 * the Vitruvian figure's y-extent predicts 238.8..548.8 against a
 * measured 239..548.
 *
 * So this is a READING of the file at the same standard as P-1's title
 * card, not a trace at a tolerance somebody chose, and it lifts the hard
 * `coverage_ref` ceiling on decks 2, 3, 17 and 18 — retroactively for
 * P-3, which is why it was routed to the lead the moment it was found
 * rather than kept for this report.
 *
 * DECK 59 IS NOT IN THE DECK AS THE VIDEO SHOWS IT
 *
 * The one place this chapter cannot reach a clean score, and the reason
 * is recorded rather than worked around.
 *
 * Deck 59's declared geometry sits 141.56 slide units (94.37 video px)
 * BELOW what the footage draws. Measured as a pure translation on four
 * landmarks spanning the canvas — the horizon rect's top edge, the red
 * "Collective Intelligence" ring's centre, the red base ellipse and the
 * blue base rectangle — the deltas are 94.69, 94.20, 94.30 and 94.30 px,
 * **sd 0.19 px**. X is exact throughout (ring centre 620.2 predicted
 * against 619.5 measured, radius 104.1 against 104.5), so it is a rigid
 * vertical translation and not a scale: fitting a scale instead misses
 * the third landmark by 16 px.
 *
 * The deck is what moved, not the video. Keynote's own stored thumbnail
 * for deck 59 agrees with the DECK — horizon at 0.4000 of frame height
 * against the declared 0.4010 and the video's 0.2694 — and rolling the
 * video frame down 96 px lifts its correlation with that thumbnail from
 * 0.104 to 0.880. Two further edits point the same way: the three
 * strings the footage shows — "Liminal Flow", "Collective Intelligence"
 * and "Syntropy" — exist in NO archive anywhere in the 84-slide file
 * (every `TSWP.StorageArchive` was searched, not just deck 59's), yet
 * the footage builds them at 875.8, 878.2 and 883.0, after the 33-chunk
 * cascade ends. So the labels were deleted and the tableau was dragged
 * down, some time after 2023-02-15.
 *
 * This is the first concrete answer to the recon's own open caution —
 * "whether slides 1-58 were also edited after the recording is not
 * knowable from the file". For one slide it now is, and the answer is
 * yes. It is slide-local: sweeping all 59 segments' thumbnails against
 * their footage finds deck 59 as the only clean case.
 *
 * THE SCORING CONSEQUENCE. The translation IS applied, on the page holon
 * and nowhere else, under the lead's ruling of 2026-09-08 and after the
 * verification it made a condition (all of it recorded on
 * `DECK59_EDIT_OFFSET`). The reasoning is the canon policy's: the
 * published video is the canon and the deck is derivation authority for
 * what the video USED, so where the file demonstrably post-dates the
 * recording its edited value is not the video's source value.
 *
 * What it buys, and it is the check that the constant is right rather
 * than merely convenient: `chamfer_ours` falls from 10.587 px to
 * **0.521 px** and `coverage_ours` rises from 0.1613 to **0.9603**. Our
 * strokes land on the reference's centre lines. Two coloured landmarks
 * that the render hides (below) reappear with fills off at cy 489.0 and
 * 488.5 against the reference's 489.5 — an independent sub-pixel
 * confirmation of the offset from geometry the fit never used.
 *
 * The declared-geometry score is reported alongside as the documented
 * file-drift alternative: 0.1171 / 0.1613, chamfer 10.587 / 11.470.
 *
 * The remaining `coverage_ref` of 0.675 is fully accounted for and none
 * of it is timing or placement:
 *
 *     "Liminal Flow"                      1,556 px   deleted from the file
 *     "Collective Intelligence"           1,216 px   deleted from the file
 *     "Syntropy"                            474 px   deleted from the file
 *     the Syntropy curves                 2,298 px   deleted from the file
 *     the coloured rings                  2,211 px   hidden by our own fills
 *
 * THE LAST ROW IS NOT THIS CHAPTER'S AND NOT THIS RULING'S. The red ring,
 * the red base ellipse and the blue rectangle are drawn, tinted and
 * positioned correctly — every parameter checks out and with
 * `fills: false` they appear within a pixel of the reference. They are
 * hidden by opaque `SlideFill`s that the deck declares BELOW them:
 * `composeShape` emits every stroke and every fill at z = 0, so the
 * deck's z-order survives only as emission order, and deck 59's
 * full-canvas black horizon rectangle (z-index 1 of 42, a genuine solid
 * black in the stylesheet, not a dropped gradient) wins over strokes
 * declared thirty places above it. Verified pre-existing: the same three
 * shapes are absent from the pre-ruling render too, so the translation
 * neither caused nor masks it. It is P-5/P-8's fill machinery and it is
 * reported, not patched.
 */

import { Dream, render } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { slideToWorld } from "../../src/geometry/keynote"
import { Slide } from "../../vocabulary/Slides/Slides"
import {
  slide16,
  slide17,
  slide18,
  slide59,
} from "../../vocabulary/Slides/assets/pl02/index"

/**
 * A build's measured onset, and the deck record it fires.
 *
 * `at` is the video second the footage shows the build starting; `build`
 * is the `KeyBuild.id`, so a record is looked up rather than described
 * and a re-emission of the slide modules cannot silently repoint one.
 */
interface Onset {
  build: string
  at: number
}

/**
 * The `apple:action-scale` factor deck 17's chunk 9 does not declare.
 *
 * MEASURED, by the route P-8 established for deck 56 and the campaign's
 * refused-fits rule admits: a quantity that exists only in the footage
 * is measured, and that is measurement rather than fitting. The start
 * size is the deck's (the 26-member group's box, 292.5 slide units =
 * 195.0 video px, against a measured 199 whose difference is the
 * stroke's own two half-widths), the duration is the deck's (1.0s), the
 * ease is the deck's (`kEaseBoth`), and only the factor is free.
 *
 * Fitted on the blue circle's width across seven frames of an otherwise
 * empty stage: k = 3.0932 at 0.68 px rms on Keynote's ease, against
 * 8.87 px on the framework's `smooth`. See the module header.
 */
export const ACTION_SCALE_D17 = 3.0932

/**
 * The vertical edit that separates deck 59's FILE from deck 59's
 * FOOTAGE, in SLIDE units — APPLIED, in this scene only.
 *
 * 141.56 slide units = 94.37 video px. This is the one number in the
 * chapter that comes from the footage rather than the deck, and the
 * reasoning that admits it is worth stating in full because it does not
 * fit either of the campaign's existing precedents.
 *
 * WHAT IT IS NOT. It is not a quantity the file never carried (deck
 * 17's `action-scale` factor, deck 56's before it) — deck 59's geometry
 * is fully declared. It is not a phantom from mis-sampling (P-8's deck
 * 54, where one badly-chosen frame invented a layout gap that was not
 * there). It is a quantity the file PROVABLY OVERWROTE after the
 * recording.
 *
 * THE PROOF THAT THE FILE MOVED, NOT THE VIDEO. Keynote's own stored
 * thumbnail for deck 59 sides with the DECK against the video — horizon
 * at 0.4000 of frame height against the declared 0.4010 and the footage's
 * 0.2694 — so the application re-rendered its preview from an edited
 * slide. Rolling the video frame down 96 px lifts its correlation with
 * that thumbnail from 0.104 to 0.880. Two further edits point the same
 * way: the three strings the footage shows ("Liminal Flow", "Collective
 * Intelligence", "Syntropy") exist in NO archive anywhere in the
 * 84-slide file, yet the footage builds them at 875.8, 878.2 and 883.0.
 * Labels deleted, tableau dragged down, some time after 2023-02-15.
 *
 * THE VERIFICATION THAT IT IS A RIGID CONSTANT, not something the slide
 * does. Every one of these was required before the constant was applied:
 *
 *   - NO BUILD CAN TRANSLATE ANYTHING. All 34 records are `In`;
 *     18 LineDrawForLine, 15 dissolve, 1 dissolve character; ZERO carry
 *     a `motionPath`; there is no `action-motion-path`, no
 *     `action-scale`, no `fade and move`. The union of every field on
 *     every record is {acceleration, animationType, delay, delivery,
 *     duration, effect, eventTrigger, id, target} — nothing in that set
 *     can express a displacement.
 *   - THE INCOMING TRANSITION STAGES NOTHING. Deck 59's own transition
 *     is `none`, a hard cut: no matched objects, no interpolation.
 *     (Deck 58's Magic Move is the transition INTO 58, not into 59.)
 *   - THE FIRST SCORED FRAME IS NOT MID-ANYTHING. Deck 58 leaves
 *     859.8-861.4 and the frame settles at 861.6 — 11 changed pixels
 *     against its predecessor. The base tableau is five UNBUILT
 *     drawables (the horizon and the mountain curves) that no build
 *     targets.
 *   - THE OFFSET IS CONSTANT ACROSS THE SEGMENT, three ways. The
 *     unbuilt horizon sits at row 194 at t = 861.6, 863.8, 869.8,
 *     875.8, 881.8, 887.8, 891.8 and 893.4 — first settled frame to
 *     last. Landmarks built at DIFFERENT times agree (the red base
 *     ellipse and blue rectangle read 94.26 throughout; the red ring,
 *     built last, joins at the same offset) — which a build-produced
 *     motion could not do. And the best whole-frame integer shift
 *     aligning each of ten settled frames to the final frame is
 *     dx = 0, dy = 0 at every sample: the tableau never moves.
 *   - IT IS ONE NUMBER, not a per-shape accident. Rasterising each
 *     declared polyline through the importer's own design-box fit and
 *     sliding it in y, every drawable large enough to match
 *     unambiguously (>40 video px on both axes) gives dy = 94 with
 *     sd 0.00 and a 0.93-1.00 hit rate.
 *
 * WHY APPLYING IT IS THE READING AND NOT A FIT. The canon policy is
 * explicit that the published video is the canon; the deck is derivation
 * authority for what the video USED. Where the file demonstrably
 * post-dates the recording, its edited value is not the video's source
 * value — the recording-era layout survives only in the footage, and
 * 94.37 px is its measurement, which is measurement and not fitting
 * under the O-11 refined rule. P-8's output-into-input objection does
 * not reach it: nothing here writes an animation's result back into a
 * hold; this recovers a pre-edit constant.
 *
 * WHERE IT LIVES. In the SCENE, never in the asset or the importer.
 * P-1's model keeps saying what the file says — that is the deck-54
 * pattern and it is right — so `slide59.ts` is untouched and a reader
 * comparing it against the deck still finds agreement.
 */
export const DECK59_EDIT_OFFSET = 141.56

/**
 * Deck 16 — the Social Machine assembles. 263.0-279.4s.
 *
 * Three firings out of fifty declared chunks, and twenty-four Out builds
 * that the outgoing click truncates. See the header.
 *
 * The twelve head onsets are given as the pooled mean rather than
 * twelve separate numbers because they ARE one number: sd 0.013 s across
 * twelve independent fits. Same for the spokes at sd 0.126.
 */
const DECK16: Onset[] = [
  { build: "5178506", at: 265.407 }, // head  1 ┐ chunks 0-11, one firing
  { build: "5178507", at: 265.407 }, // head  2 │ mean 265.407, sd 0.013
  { build: "5178508", at: 265.407 }, // head  3 │ rms 0.009-0.024
  { build: "5178509", at: 265.407 }, // head  4 │
  { build: "5178510", at: 265.407 }, // head  5 │
  { build: "5178511", at: 265.407 }, // head  6 │
  { build: "5178512", at: 265.407 }, // head  7 │
  { build: "5178513", at: 265.407 }, // head  8 │
  { build: "5178514", at: 265.407 }, // head  9 │
  { build: "5178515", at: 265.407 }, // head 10 │
  { build: "5178516", at: 265.407 }, // head 11 │
  { build: "5178527", at: 265.407 }, // head 12 ┘
  { build: "5170331", at: 267.307 }, // spoke 1 ┐ chunks 12-23, one firing
  { build: "5170332", at: 267.307 }, // spoke 2 │ mean 267.307, sd 0.126
  { build: "5170333", at: 267.307 }, // spoke 3 │ rms 0.006-0.067
  { build: "5170334", at: 267.307 }, // spoke 4 │
  { build: "5170335", at: 267.307 }, // spoke 5 │
  { build: "5170336", at: 267.307 }, // spoke 6 │
  { build: "5170337", at: 267.307 }, // spoke 7 │
  { build: "5170338", at: 267.307 }, // spoke 8 │
  { build: "5170339", at: 267.307 }, // spoke 9 │
  { build: "5170340", at: 267.307 }, // spoke 10│
  { build: "5170341", at: 267.307 }, // spoke 11│
  { build: "5170342", at: 267.307 }, // spoke 12┘
  { build: "5189466", at: 275.4 }, // the blue circle group
  { build: "5187249", at: 276.325 }, // "Social Machine"  rms 0.0023
]

/**
 * Deck 17 — the organisms fly apart and the machine swells.
 * 279.4-292.0s.
 *
 * BOUNDARY CORRECTED at the outgoing end, and hard: this segment is 12.6
 * seconds, not the 82.6 the recon gives it. See the header.
 *
 * Chunks 3-9 — six motion paths and the action-scale — share ONE onset,
 * 288.285, arrived at by two independent fits of two different build
 * classes. Every one of the slide's 23 builds fires inside 281.5-288.6,
 * which is what a 12.6-second segment with 23 builds has to look like
 * and is itself a check on the corrected boundary: on the old reading
 * this slide sat still for seventy seconds after its last build.
 */
const DECK17: Onset[] = [
  { build: "5294565", at: 281.515 }, // the four lightning glyphs, In  rms 0.0036
  { build: "5301189", at: 287.33 }, // …and Out                       rms 0.0208
  { build: "4570254", at: 288.285 }, // ring N  ┐ chunks 3-8, declared travel
  { build: "4570255", at: 288.285 }, // ring NW │ top ring fits its own
  { build: "4570256", at: 288.285 }, // ring NE │ -250.49 px at 0.73 px rms
  { build: "4570257", at: 288.285 }, // ring SW │
  { build: "4570258", at: 288.285 }, // ring SE │
  { build: "4570259", at: 288.285 }, // ring S  ┘
  { build: "4579766", at: 288.285 }, // the action-scale, k = 3.0932
  // The thirteen drawables of the ARRIVING tableau — twelve heads and
  // the tower, laid out on a ring that fills the frame. They dissolve in
  // WHILE the small machine scales up into their positions, which is how
  // Keynote makes one ring become the other without a Magic Move.
  //
  // All thirteen fit one onset, 288.600, but at rms 0.26 rather than the
  // 0.01 the rest of this chapter reports, and the reason is stated
  // rather than tuned away: the scaling ring's own heads sweep through
  // these boxes during the same window, so no mask over the arriving
  // head is exclusive of the departing one. The onset is trustworthy
  // (thirteen independent fits agree to 0.035 s and it sits one frame
  // after the scale it accompanies); the residual is not a fit quality.
  { build: "5239079", at: 288.6 },
  { build: "5239080", at: 288.6 },
  { build: "5239081", at: 288.6 },
  { build: "5239082", at: 288.6 },
  { build: "5239083", at: 288.6 },
  { build: "5239084", at: 288.6 }, // the tower at the ring's centre
  { build: "5239085", at: 288.6 },
  { build: "5239086", at: 288.6 },
  { build: "5239087", at: 288.6 },
  { build: "5239088", at: 288.6 },
  { build: "5239089", at: 288.6 },
  { build: "5239090", at: 288.6 },
  { build: "5239091", at: 288.6 },
]

/**
 * Deck 18 — the broadcast tower, then three of them. 292.0-362.0s.
 *
 * THE SLIDE THAT WAS INVISIBLE, and the chapter's longest segment by
 * far: 70 seconds, where every record before this one gives it 7. It
 * carries no thumbnail, which is why the recon's scan never saw it and
 * why every slide index from 18 on was off by one (P-1) — and, because
 * no thumbnail means no correlation, why the Viterbi absorbed almost all
 * of it into deck 17's hold.
 *
 * Five builds across 70 seconds, four of them in the last 20: the single
 * tower and its audience hold under narration for forty seconds, then
 * the two outer towers arrive, then their lightning, then the two labels
 * and the arrow between them.
 */
const DECK18: Onset[] = [
  { build: "4619289", at: 332.025 }, // the two outer towers and their mesh  rms 0.0034
  { build: "4620409", at: 336.025 }, // the two lightning bolts              rms 0.0022
  { build: "5268720", at: 345.41 }, // "mass-hypnosis"                       rms 0.0049
  { build: "5305210", at: 348.67 }, // the down arrow                        rms 0.0004
  { build: "5268786", at: 349.69 }, // "mass-psychosis " (the space is the deck's) rms 0.0006
]

/**
 * Deck 59 — Liminal Flow. 861.0-893.8s.
 *
 * The pitch's last content slide, dropped by the decoder's off-by-one
 * until this chapter found it, and the model's cleanest long cascade:
 * thirty-three chunks firing one at a time in strict chunk order, with
 * two effects interleaved so that no grouping reading survives.
 *
 * Onsets from a LINE rather than from 33 separate fits, because a line
 * is what the data supports and what it says. Only thirteen chunks keep
 * enough ink under an exclusive mask to fit alone; the rest are single
 * arrows and short strokes inside a thickening tangle. So the model is
 * fitted jointly to those thirteen onsets AND to the cascade's measured
 * END at 875.4 — the latter read from total ink alone, with no masks
 * involved — giving start 861.404 and step 0.4347 s at residual rms
 * 0.074 s, max error 0.126 s. That is inside one frame at 5 fps
 * everywhere, which is the most a 5 fps ground truth can ask.
 *
 * Stating it as a line is also the honest form of the 0.87x anomaly: a
 * per-chunk table would bury a systematic 13% in 33 numbers that each
 * look measured, where the two parameters here show it plainly.
 *
 * The three later clicks at 875.8, 878.2 and 883.0 are NOT listed: they
 * build the three text labels, and those labels are not in the file.
 * See the header.
 */
const DECK59: Onset[] = [
  { build: "4870943", at: 861.404 },
  { build: "4870985", at: 861.839 },
  { build: "4871034", at: 862.273 },
  { build: "4871035", at: 862.708 },
  { build: "4877612", at: 863.143 },
  { build: "4871051", at: 863.577 },
  { build: "4871090", at: 864.012 },
  { build: "4873268", at: 864.447 },
  { build: "4873300", at: 864.882 },
  { build: "4877545", at: 865.316 },
  { build: "4873316", at: 865.751 },
  { build: "4873429", at: 866.186 },
  { build: "4873376", at: 866.62 },
  { build: "4873392", at: 867.055 },
  { build: "4873445", at: 867.49 },
  { build: "4873505", at: 867.924 },
  { build: "4873528", at: 868.359 },
  { build: "4873544", at: 868.794 },
  { build: "4873604", at: 869.229 },
  { build: "4873620", at: 869.663 },
  { build: "4877699", at: 870.098 },
  { build: "4877731", at: 870.533 },
  { build: "4873687", at: 870.967 },
  { build: "4877735", at: 871.402 },
  { build: "4873703", at: 871.837 },
  { build: "4873763", at: 872.271 },
  { build: "4873786", at: 872.706 },
  { build: "4873802", at: 873.141 },
  { build: "4873862", at: 873.576 },
  { build: "4873878", at: 874.01 },
  { build: "4873945", at: 874.445 },
  { build: "4873961", at: 874.88 },
  { build: "4873984", at: 875.314 },
]

/**
 * The pages, with the window each is held for.
 *
 * `from` is the first settled video second after the incoming
 * transition; `to` is the last before the outgoing one. Deck 17 and
 * deck 18 carry this chapter's boundary correction (344.8, see the
 * header); decks 16 and 59 agree with the recon.
 */
const PAGES = [
  { data: slide16, onsets: DECK16, from: 264.0, to: 278.2 },
  { data: slide17, onsets: DECK17, from: 280.4, to: 291.6 },
  { data: slide18, onsets: DECK18, from: 293.8, to: 361.4 },
  { data: slide59, onsets: DECK59, from: 861.4, to: 893.4 },
] as const

/** The measured `action-scale` factors this scene fires, by build id. */
const SCALE_FACTORS: Record<string, number> = { "4579766": ACTION_SCALE_D17 }

/**
 * Reference frames, one per segment, each chosen AFTER that segment's
 * last event and before its outgoing transition (P-2's slide-32 lesson).
 */
export const SCORED = [
  { frame: 1392, deck: 16, at: 278.2 }, // last event 276.3
  { frame: 1459, deck: 17, at: 291.6 }, // last event 288.6
  { frame: 1795, deck: 18, at: 358.8 }, // last event 349.7
  { frame: 4460, deck: 59, at: 891.8 }, // last event 875.3 (three unlisted)
] as const

/**
 * Mid-build frames — where the chapter's own subject lives.
 *
 * Deck 16's two are inside the head and spoke firings, which is the only
 * place the twelve-at-once behaviour is visible at all: at any settled
 * time every head is up. Deck 17's three straddle the action-scale and
 * the six motion paths, the chapter's two measured quantities. Deck
 * 59's sample the long cascade at three points along its run.
 */
export const MIDS = [
  { frame: 1329, deck: 16, at: 265.6 }, // heads arriving, all twelve
  { frame: 1338, deck: 16, at: 267.4 }, // spokes starting, heads full
  { frame: 1443, deck: 17, at: 288.4 }, // the scale and the flight, early
  { frame: 1445, deck: 17, at: 288.8 }, // mid-flight, mid-scale
  { frame: 1446, deck: 17, at: 289.0 }, // late, rings leaving frame
  { frame: 1664, deck: 18, at: 332.6 }, // the outer towers arriving
  { frame: 1684, deck: 18, at: 336.6 }, // their lightning
  { frame: 4315, deck: 59, at: 862.8 }, // cascade chunk ~3
  { frame: 4330, deck: 59, at: 865.8 }, // cascade chunk ~10
  { frame: 4345, deck: 59, at: 868.8 }, // cascade chunk ~17
] as const

export class SetPiecesDream extends Dream {
  pages = PAGES.map((p) => new Slide({ data: p.data, scaleFactors: SCALE_FACTORS }))

  /** The scene cursor in VIDEO seconds — P-3's convention. */
  #now = 0

  /**
   * Play an Anim at an ABSOLUTE video second.
   *
   * Load-bearing throughout this chapter: deck 16's twelve heads share
   * one onset and deck 17's seven chunks share another, and `play()`'s
   * forward-only cursor would serialize each set into a staircase.
   */
  private playAt(anim: Anim, at: number, runTime: number): void {
    const clip = this.play(anim, runTime)
    clip.start = at
    this.#now = Math.max(this.#now, at + runTime)
  }

  /** A cut — a zero-duration step at an absolute video second. */
  private setAt(at: number, ...anims: Anim[]): void {
    for (const anim of anims) {
      const clip = this.play(anim, 0)
      clip.start = at
    }
    this.#now = Math.max(this.#now, at)
  }

  unfold() {
    this.observer.look("front")

    // Deck 59's page is lifted by the recording-era offset — the ONE
    // number in this chapter that comes from the footage. It is applied
    // here, on the page holon, and nowhere else: the asset still says
    // exactly what the file says. See `DECK59_EDIT_OFFSET` for the
    // evidence chain and for why this is a reading rather than a fit.
    //
    // The sign: the deck's y grows DOWNWARD and the frame change negates
    // it (keynote.ts §2), so lifting the tableau on screen is +y here.
    const deck59 = this.pages[3]!
    deck59.y.value = DECK59_EDIT_OFFSET * slideToWorld(deck59.height.value)

    for (const page of this.pages) {
      this.setAt(0, page.creation.to(1), page.visible(false), page.preBuild())
    }

    for (let i = 0; i < PAGES.length; i++) {
      const spec = PAGES[i]!
      const page = this.pages[i]!

      this.setAt(spec.from, page.cutIn())
      if (i > 0) this.setAt(spec.from, this.pages[i - 1]!.visible(false))

      // Builds sharing an onset fired on ONE click and run in parallel.
      const clicks = new Map<number, Onset[]>()
      for (const onset of spec.onsets) {
        const group = clicks.get(onset.at)
        if (group) group.push(onset)
        else clicks.set(onset.at, [onset])
      }

      for (const [at, group] of [...clicks].sort((a, b) => a[0] - b[0])) {
        const anims: Anim[] = []
        // The DURATION is the deck's, read from the chunk that fires the
        // build; the ONSET is the footage's.
        let span = 1
        for (const onset of group) {
          const record = spec.data.builds.find((b) => b.id === onset.build)
          if (!record) continue
          const chunk = spec.data.buildChunks?.find((c) => c.build === onset.build)
          span = chunk?.duration ?? record.duration ?? 1
          anims.push(page.build(record))
        }
        if (anims.length === 0) continue
        this.playAt(together(...anims), at, span)
      }
    }

    this.hold(893.4)
  }

  /** Extend the timeline to video second t without animating anything. */
  private hold(until: number): void {
    const clip = this.play({ tracks: [] }, 0)
    clip.start = until
    this.#now = Math.max(this.#now, until)
  }
}

if (import.meta.main) render(SetPiecesDream)
