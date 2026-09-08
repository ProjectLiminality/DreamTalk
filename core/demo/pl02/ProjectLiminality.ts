/**
 * ProjectLiminality.ts — A DreamSong
 *
 * "Project Liminality" (2023-02-15), whole: all 59 deck slides and the
 * closing return to the title card, as ONE composition at the video's
 * own boundaries — 903.4 seconds (ONTOLOGY.md "The DreamSong: one file,
 * linear, one import set").
 *
 * THE SONG'S CLOCK IS THE VIDEO'S CLOCK, AND THAT IS WHY THIS IS NOT A
 * `DreamSong`
 *
 * The ORIGINS song (demo/origins/OriginsPitch.ts) is a `DreamSong`: its
 * twelve chapters each run on their OWN local clock from zero, and the
 * class places each one at an offset by accumulating spans. Every PL02
 * chapter does the opposite. P-3 set the convention on the first chapter
 * and all seven kept it: `at(t)` advances to VIDEO second t, and every
 * clip is placed by `clip.start = <video second>`. Arc01 runs 0 -> 134.8,
 * Fractal01 runs 0 -> 860.8, and both are already in video time.
 *
 * Measured, not assumed — every chapter, its own `clips` inspected:
 *
 *     chapter      duration   clips   minStart   maxEnd
 *     Arc01         134.80      39       0.00     134.80
 *     Mesh01        227.00      37       0.00     227.00
 *     Density01     220.00      51       0.00     220.00
 *     Chain01       546.20      53       0.00     546.20
 *     SetPieces     893.40      66       0.00     893.40
 *     Web01         792.60      61       0.00     792.60
 *     Fractal01     860.80      59       0.00     860.80
 *
 * So the chapters do not TILE the film the way Origins' do — they
 * OVERLAP it, each holding its own pages hidden outside its own windows.
 * A `DreamSong` would place chapter i at the sum of the spans before it
 * and shift clips that are already correct. Every chapter would need
 * offset 0, which is not a thing the span model can express.
 *
 * Hence: this is one `Dream` on the video's clock which BORROWS each
 * chapter's clips verbatim (`clip.start` unchanged) and stages its
 * roots. That is the same borrowing `DreamSong.unfold()` does, minus the
 * offset arithmetic — and it is the strongest possible statement of the
 * composition-invisibility property the Origins precedent asks for. The
 * chapters are not re-implemented here, not transcribed, and not
 * re-timed: their clip lists are the song's clip lists. A chapter's
 * frames in the song cannot differ from its frames standalone, because
 * they are computed from the same clips at the same times. The
 * spot-score table in docs/reports/pl02/ProjectLiminality-assembly.md
 * reports that equality as a measurement rather than as a claim.
 *
 *
 * WHAT THE CHAPTERS COVER, AND WHAT THIS FILE ADDS
 *
 * The seven chapters build 39 of the 59 decks — every deck that carries
 * real build choreography, and 715 of the film's 903 seconds:
 *
 *     Arc01      decks 2-6         P-3   the opening arc
 *     Mesh01     decks 7,8,9,14    P-4   campfires and social organisms
 *     Density01  decks 11,12,13    P-10  the density peak
 *     Chain01    decks 15,22-25,29,30   P-5   the labelled chains
 *     SetPieces  decks 16,17,18,59 P-9   the long-build set pieces
 *     Web01      decks 45-53       P-7   the Liminal Web
 *     Fractal01  decks 43,44,54-58 P-8   the fractal and the beacon
 *
 * The remaining twenty decks get the STANDARD TREATMENT below: compose
 * the slide, cut it in at its boundary, fire its builds through the
 * three-state firing model at the measured clicks. They are the film's
 * quiet stretches — 188.6 seconds carrying just 34 of the 141 measured
 * animation events, and eight of the twenty declare no build at all.
 * Nothing here needed a capability that was not already landed.
 *
 *
 * THE FIRING MODEL IS THE ONE P-10 SETTLED, AND IT IS IMPORTED
 *
 * `firingTimes` (demo/pl02/Density01.ts, P-10's close) is the three
 * states, and this file imports it rather than restating it:
 *
 *   • `automatic: false`            waits for a CLICK — measured;
 *   • `automatic + referent: true`  steps ONE declared duration after
 *                                   its predecessor — derived;
 *   • `automatic + referent: false` fires WITH its referent — derived.
 *
 * Only the clicks are footage-measured, and they are measured at the
 * frame rate's own resolution (5 fps) rather than by inverting a single
 * target's ramp. That is deliberate and it is weaker than what the
 * chapters did per build, so it is stated: a click is the instant the
 * frame STARTS changing, and the model cascades every automatic chunk
 * from it. The chapters' sub-frame precision comes from isolating one
 * target's own ink; on these decks the targets are nested overlapping
 * groups that mask each other to zero pixels, so that instrument does
 * not reach them. What is measured is measured; nothing is fitted.
 *
 * A chunk list whose FIRST chunk is `automatic` has no predecessor to
 * step from, and `firingTimes` starts its clock at zero — so such a
 * cascade is computed from zero and SHIFTED onto the click that
 * advanced to the slide, which preserves every derived interval and
 * measures only the one quantity the footage alone holds. Six of the
 * twenty decks are of that shape (20, 32, 39, 40, 41, 42); the chapters
 * never met the case, because every slide they own opens on a manual
 * chunk. See `Standard.cascadeFrom`.
 *
 *
 * THE TRANSITIONS ARE CUTS, AND THAT IS INHERITED RATHER THAN CHOSEN
 *
 * Every chapter renders its transitions as cuts — the outgoing page is
 * held to its last settled frame, the incoming page appears at its
 * first, and no frame inside the crossing is scored. P-3 set that
 * (Arc01's header, "THE MAGIC MOVES ARE SKIPPED, DELIBERATELY") and P-7
 * restated it. The song cannot do otherwise for those 39 decks without
 * re-timing chapters it borrows verbatim, so it does the same for the
 * twenty it adds: the film cuts where the deck asks for a Magic Move.
 *
 * THE COST IS REAL AND IT IS THE FILM'S LARGEST KNOWN GAP. 44 of the
 * 59 transitions are `magic-move-implied-motion-path` at a declared 2.0s
 * (three at 1.5s), so about 88 seconds of the film — a tenth of it —
 * are crossings the reference glides and the reproduction cuts. The
 * machinery to do better is LANDED and proven on two pairs (P-6's
 * `magicMove`/`magicMoveAnim`/`magicMoveSwap`, scored on decks 12->13
 * and 36->37), and the honest reason it is not used here is
 * p6-handoff.md: MM01's mid-glide frames score 0.23-0.35 because
 * Keynote re-derives a connection line per frame from the objects it
 * joins while ours glides as a rigid baked drawable — the DASH-PHASE
 * RESIDUAL, still open, with `GlidingConnection` the identified fix.
 * Standing a half-right glide into the film would replace a clean cut
 * with 88 seconds of visibly wrong frames. The cut is stated, scored,
 * and left for the chapter that closes p6-handoff.
 *
 *
 * DECK 59 RENDERS ITS FILMED STATE
 *
 * The standing ruling (pl02-vocabulary.md, P-9 final). Deck 59 is the
 * one slide the file demonstrably post-dates: its tableau sits 141.56
 * slide units below what the footage draws, and three labels the footage
 * builds exist in NO archive in the 84-slide file. SetPieces already
 * applies the translation on the page holon (`DECK59_EDIT_OFFSET`), so
 * the song inherits it. What the song adds is the other half of the
 * ruling — the three deleted labels, reconstructed from the footage.
 * See `DECK59_LABELS` for the full chain.
 */

import { Dream, render } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { Slide } from "../../vocabulary/Slides/Slides"
import { Text } from "../../src/parts/text"
import { slideToWorld, slidePointToWorld } from "../../src/geometry/keynote"
import type { SlideData } from "../../src/geometry/keynote"

/**
 * The visible frame height the 36mm rig gives at its 1000-unit distance
 * — `Slide.height`'s own default, restated here because the three
 * reconstructed labels are staged as siblings of a page rather than as
 * members of one and so have no page to read it from.
 */
const SLIDE_FRAME_HEIGHT = 562.4987439260904

// The seven chapters, borrowed whole.
import { Arc01Dream } from "./Arc01"
import { Mesh01Dream } from "./Mesh01"
import { Density01Dream, firingTimes } from "./Density01"
import { Chain01Dream } from "./Chain01"
import { SetPiecesDream } from "./SetPieces"
import { Web01Dream } from "./Web01"
import { Fractal01Dream } from "./Fractal01"

// The twenty decks no chapter builds.
import {
  slide01,
  slide10,
  slide19,
  slide20,
  slide21,
  slide26,
  slide27,
  slide28,
  slide31,
  slide32,
  slide33,
  slide34,
  slide35,
  slide36,
  slide37,
  slide38,
  slide39,
  slide40,
  slide41,
  slide42,
} from "../../vocabulary/Slides/assets/pl02/index"

/** The published video's duration — the song's, by construction. */
export const PL02_DURATION = 903.4

/**
 * THE BOUNDARY TABLE — all 60 segments, in video seconds.
 *
 * `deck` is the DECK slide (P-1's +1 shift from show position 18 already
 * applied), `t0` is where the segment begins and the next entry's `t0`
 * is where it ends. The last row is the closing return to the title
 * card, which is deck 1 again (P-1's closing correction: the video does
 * NOT end on decks 60/61 — f_04490 is the title card mid-dissolve, and
 * the Viterbi's row-61 assignment sits at correlation 0.114, which is
 * noise).
 *
 * PROVENANCE. The skeleton is `refs/pitch/pl02/analysis/segments.json`
 * with the +1 shift; six rows are CORRECTED by chapter measurement and
 * each correction is marked. The corrections are the authority — a
 * chapter that measured a boundary looked at the footage with an
 * instrument built for that question, and the Viterbi did not.
 */
export const BOUNDARIES: readonly { deck: number; t0: number; note?: string }[] = [
  { deck: 1, t0: 0.0 },
  { deck: 2, t0: 0.6 },
  { deck: 3, t0: 20.2 },
  { deck: 4, t0: 45.8 },
  { deck: 5, t0: 98.0 },
  { deck: 6, t0: 119.4 },
  { deck: 7, t0: 134.8 },
  { deck: 8, t0: 162.8 },
  { deck: 9, t0: 171.2 },
  { deck: 10, t0: 193.8 },
  { deck: 11, t0: 199.4 },
  { deck: 12, t0: 214.4 },
  // P-6's own measurement of this exact pair, applied. MagicMove01 is
  // the chapter that studied the deck 12 -> 13 Magic Move, and it puts
  // the glide's onset at 216.4 (`ONSET_VIDEO`) — the frame the GEOMETRY
  // first moves, distinguished there from 216.2, the frame the first
  // pixel changes because the second superposed copy became visible.
  // At the declared 1.5s that crossing ends at 217.9, and Density01
  // cuts deck 13 in at its settled 218.4. The recon's 217.0 sits inside
  // the glide.
  { deck: 13, t0: 216.4, note: "P-6" },
  { deck: 14, t0: 219.4 },
  // P-5's correction: deck 15 settles 225.2 and leaves at 262.2, not 227.0/263.0.
  { deck: 15, t0: 225.2, note: "P-5" },
  { deck: 16, t0: 262.2, note: "P-5" },
  { deck: 17, t0: 279.4 },
  // P-9's correction, the largest in the campaign: the recon's 82.6s
  // "segment 17" is TWO slides and the split is at 292.0, not 362.0.
  // Deck 18 is SEVENTY seconds long. The proof is geometric — deck 17's
  // shapes reach x 329.7-950.4 and cannot draw the outer towers at
  // ~235/~1040 that the footage shows from 293.8.
  { deck: 18, t0: 292.0, note: "P-9" },
  { deck: 19, t0: 362.0 },
  { deck: 20, t0: 369.4 },
  { deck: 21, t0: 375.2 },
  { deck: 22, t0: 428.2 },
  { deck: 23, t0: 445.8 },
  { deck: 24, t0: 452.0 },
  // P-5's own build measurements, applied: deck 25's three In builds are
  // fitted at 490.108-490.115 (sd 0.022-0.024), and a whole-frame change
  // scan puts the crossing's first changing frame at 490.2 — so the
  // recon's 490.6 is late by two frames. The chapter's PAGES table still
  // says `from: 490.6`, which is the one place its cut-in disagrees with
  // its own onsets; the boundary follows the MEASUREMENT.
  //
  // Nothing visible turns on the disagreement, and the reason is worth
  // stating: decks 24 and 25 are not a crossing at all. Deck 25 IS deck
  // 24 plus an arrow and a "?" — the InterLogos mesh is identical in
  // both and simply persists — so the 0.4s in which the chapter has both
  // pages up draws the same mesh twice over, which is why three
  // chapters' scoring never saw it.
  { deck: 25, t0: 490.2, note: "P-5 onsets" },
  { deck: 26, t0: 503.6 },
  { deck: 27, t0: 510.2 },
  { deck: 28, t0: 517.6 },
  { deck: 29, t0: 526.6 },
  { deck: 30, t0: 539.6 },
  { deck: 31, t0: 546.2 },
  { deck: 32, t0: 553.8 },
  { deck: 33, t0: 572.6 },
  { deck: 34, t0: 590.6 },
  { deck: 35, t0: 599.6 },
  { deck: 36, t0: 601.4 },
  { deck: 37, t0: 606.0 },
  { deck: 38, t0: 608.4 },
  { deck: 39, t0: 610.6 },
  { deck: 40, t0: 613.8 },
  { deck: 41, t0: 618.6 },
  { deck: 42, t0: 627.2 },
  { deck: 43, t0: 639.4 },
  { deck: 44, t0: 675.4 },
  { deck: 45, t0: 690.6 },
  { deck: 46, t0: 710.6 },
  { deck: 47, t0: 722.4 },
  { deck: 48, t0: 728.8 },
  { deck: 49, t0: 733.2 },
  { deck: 50, t0: 739.0 },
  { deck: 51, t0: 744.0 },
  { deck: 52, t0: 749.4 },
  { deck: 53, t0: 765.2 },
  { deck: 54, t0: 793.4 },
  // P-8's correction: deck 54 holds ~793.4-797.6, the Magic Move runs
  // ~797.6-799.8, deck 55 holds from 799.8 — not 816.0. The recon's
  // Viterbi hit its near-identical-pair failure mode; confirmed
  // independently by the mini-towers inking from 812.35.
  { deck: 55, t0: 799.8, note: "P-8" },
  { deck: 56, t0: 827.8 },
  { deck: 57, t0: 846.8 },
  { deck: 58, t0: 851.0 },
  { deck: 59, t0: 861.0 },
  // The closing card: deck 1 again (P-1's closing correction).
  { deck: 1, t0: 893.8, note: "P-1 closing" },
]

/**
 * A measured click: the video second at which the frame STARTS changing,
 * and the chunk index in the slide's own chunk list that fired then.
 *
 * `firingTimes` derives every other chunk's time from these.
 */
interface Click {
  chunk: number
  at: number
}

/**
 * A deck the chapters do not build, with the clicks measured for it.
 *
 * The clicks come from a whole-frame change scan over the segment
 * (5 fps, the footage's own resolution), reading each maximal run of
 * changing frames as one firing. Runs at the segment's own edges are
 * the incoming and outgoing transitions and are excluded — those are
 * cuts here, not builds.
 */
interface Standard {
  data: SlideData
  clicks: readonly Click[]
  /**
   * The video second the segment's LEADING cascade begins, for a slide
   * whose chunk 0 is `automatic`.
   *
   * `firingTimes` honours a click only on a chunk marked
   * `automatic: false` — which is right, because that is what the flag
   * MEANS: an automatic chunk's time is derived from its predecessor,
   * never measured. But a chunk list whose FIRST entry is automatic has
   * no predecessor to derive from, and the helper's `referentTime`
   * starts at zero, so the whole cascade lands at video second 0.
   *
   * That is not a defect in the helper; it is a case the deck's own
   * semantics leave open, and the reading it forces is the obvious one:
   * the referent a leading automatic chunk steps from is the CLICK THAT
   * ADVANCED TO THE SLIDE. So the cascade is computed from zero and
   * then SHIFTED by that measured instant, which preserves every
   * derived interval exactly and measures only the one quantity that
   * exists solely in the footage.
   *
   * Five of the twenty decks are of this shape — 20, 39, 40, 41, 42 —
   * and deck 32's chunk 0 is too. The chapters never met the case:
   * every slide they own opens on a manual chunk.
   */
  cascadeFrom?: number
}

/**
 * The twenty decks, with their measured clicks.
 *
 * Read against `BOUNDARIES` above: each deck's window runs from its own
 * `t0` to the next row's. A deck with no builds carries no clicks and
 * is simply held — eight of the twenty are of that kind, which is what
 * a 89%-still slideshow looks like from the inside.
 */
const STANDARD: readonly Standard[] = [
  // Deck 1 — the title card, 0.0-0.6s. Four shapes and a word, no
  // builds, no transition in. P-1's gate scene (TitleSlide.ts) holds
  // exactly this tableau and scores 1.0000/1.0000.
  { data: slide01, clicks: [] },

  // Deck 10 — Social Organism / Biological Organism, 193.8-199.4s.
  // Three builds in two chunks: a motion-path with an action-scale
  // riding WITH it (referent: false), then a dissolve.
  //
  // THE ACTION-SCALE FACTOR IS NOT DECLARED, and this is the slide P-4
  // refused to score for exactly that reason ("an undeclared magnitude
  // fitted to make a frame match is what the refused-fits rule
  // forbids"). The song inherits the refusal rather than reversing it:
  // the build fires, and `Slide.build` renders an action-scale without
  // a `scaleFactors` entry at its declared geometry. The left cluster
  // therefore does not shrink. That is a KNOWN, STATED gap of one
  // build on one 5.6-second segment, and it is the honest reading —
  // P-8 and P-9 measured factors for decks 56 and 17 because those
  // targets cross an empty stage and could be measured admissibly;
  // this one cannot.
  { data: slide10, clicks: [{ chunk: 0, at: 193.8 }, { chunk: 2, at: 196.8 }] },

  // Deck 19 — Wisdom / Power, 362.0-369.4s. Two labels, two clicks.
  { data: slide19, clicks: [{ chunk: 0, at: 364.6 }, { chunk: 1, at: 366.2 }] },

  // Deck 20 — the title card's second appearance, 369.4-375.2s. The two
  // circles draw on (2.0s LineDrawForLine, the second firing WITH the
  // first), then the word dissolves in on its own click.
  //
  // Chunk 0 is `automatic` with no predecessor, so it takes the
  // segment's first click — the shape decks 39-42 also have.
  { data: slide20, clicks: [{ chunk: 2, at: 372.8 }], cascadeFrom: 369.4 },

  // Deck 21 — Logos divides, 375.2-428.2s. The film's longest uncovered
  // segment and its only substantial one: a campfire ring with dashed
  // spokes opens out into MonoLogos, DiaLogos and InterLogos.
  //
  // NINE manual chunks against EIGHT measured clicks. Chunks 4 and 5
  // are two `action-motion-path` builds that fire together — the two
  // side groups travel out simultaneously, which the footage shows
  // plainly at 394.6-395.8 (both lobes move in the same frames). So
  // chunk 5 is given chunk 4's click rather than a click of its own.
  // That is a reading of the footage, not a convenience: giving chunk 5
  // the NEXT measured click (399.6) would leave the 399.6 mesh
  // transformation with nothing to fire it.
  {
    data: slide21,
    clicks: [
      { chunk: 0, at: 377.0 }, // the three groups dissolve in
      { chunk: 3, at: 380.2 }, // "Logos"
      { chunk: 4, at: 394.6 }, // both motion paths — see above
      { chunk: 5, at: 394.6 },
      { chunk: 7, at: 399.6 }, // the ring becomes the mesh
      { chunk: 9, at: 405.0 }, // the arcs
      { chunk: 10, at: 414.0 }, // "MonoLogos"
      { chunk: 11, at: 416.2 }, // "DiaLogos"
      { chunk: 12, at: 418.4 }, // "InterLogos"
    ],
  },

  // Deck 26 — 503.6-510.2s. Five shapes, no builds: a held tableau.
  { data: slide26, clicks: [] },

  // Deck 27 — 510.2-517.6s. Thirty-eight shapes, no builds.
  { data: slide27, clicks: [] },

  // Deck 28 — Location A / Distance / Location B, 517.6-526.6s. One
  // click, then a two-step cascade of 1.0s LineDrawForLine.
  { data: slide28, clicks: [{ chunk: 0, at: 521.6 }] },

  // Deck 31 — 546.2-553.8s. A single `Out` dissolve.
  { data: slide31, clicks: [{ chunk: 0, at: 548.0 }] },

  // Deck 32 — story = place / MonoLogos Node / InterLogos,
  // 553.8-572.6s. P-2's generalization slide (StoryPlaceSlide.ts holds
  // its settled tableau and scores it). Chunk 0 is a step with no
  // predecessor and takes the first click; chunks 2 and 3 are clicks.
  {
    data: slide32,
    clicks: [
      { chunk: 2, at: 556.6 },
      { chunk: 3, at: 565.8 },
    ],
    cascadeFrom: 554.6,
  },

  // Deck 33 — Liminal Wallet, 572.6-590.6s. No builds.
  { data: slide33, clicks: [] },

  // Deck 34 — Liminal Wallet, 590.6-599.6s. Two dissolves, two clicks —
  // but the footage shows only ONE inner change (592.4). The second
  // click is the outgoing edge at 598.0, which is this segment's own
  // last event rather than the next segment's transition (deck 35
  // begins at 599.6). Both are given.
  { data: slide34, clicks: [{ chunk: 0, at: 592.4 }, { chunk: 1, at: 598.0 }] },

  // Deck 35 — Liminal Wallet, 599.6-601.4s. No builds; 1.8s of hold.
  { data: slide35, clicks: [] },

  // Deck 36 — Liminal Wallet, 601.4-606.0s. The cursor gesture P-7
  // measured seven times: `bc-appear` (a STEP, effective duration zero)
  // then `action-motion-path` one step later, which by P-7's refinement
  // means immediately. P-7 fitted this arrow's motion onset at 602.880;
  // the measured click at 602.8 is the same instant at frame
  // resolution.
  { data: slide36, clicks: [{ chunk: 0, at: 602.8 }] },

  // Deck 37 — Liminal Wallet, 606.0-608.4s. No builds. This is the
  // arrival page of MagicMove02's pair (deck 36 -> 37).
  { data: slide37, clicks: [] },

  // Deck 38 — 608.4-610.6s. No builds.
  { data: slide38, clicks: [] },

  // Deck 39 — 610.6-613.8s. One step chunk, no predecessor: the
  // segment's first click.
  { data: slide39, clicks: [], cascadeFrom: 612.6 },

  // Deck 40 — 613.8-618.6s. A step chunk leading three that fire WITH
  // it: one dissolve and three labels arriving together.
  { data: slide40, clicks: [], cascadeFrom: 614.8 },

  // Deck 41 — 618.6-627.2s. Seven chunks, ALL automatic — one click and
  // a cascade. The footage agrees: change runs begin at 619.6, 621.6,
  // 623.6 and 625.6, which is a 2.0s step between the LineDraw chunks
  // and 1.0s around them, exactly what the chunk durations declare.
  // This is the three-state model predicting a whole segment from one
  // measured number.
  { data: slide41, clicks: [], cascadeFrom: 618.6 },

  // Deck 42 — 627.2-639.4s. Eight chunks, all automatic — the same
  // shape as deck 41 and the same agreement: the scan's runs at 628.4,
  // 629.4, 631.4, 632.4, 634.4 and 635.4 track the declared 1.0/2.0s
  // steps across the cascade.
  { data: slide42, clicks: [], cascadeFrom: 627.4 },
]

/**
 * DECK 59's THREE DELETED LABELS — the filmed state, reconstructed.
 *
 * THE RULING. pl02-vocabulary.md (P-9 final, and the lead's assembly
 * note): "the FILM renders the FILMED state — translation + the three
 * labels reconstructed from footage (the canon policy's inverse case:
 * content in the footage absent from the source is reproduced FROM the
 * footage)". SetPieces already applies the translation
 * (`DECK59_EDIT_OFFSET`, 141.56 slide units, verified five ways); these
 * are the other half.
 *
 * THE EVIDENCE CHAIN, in full, because this is the one place in the
 * whole film where geometry comes from the footage rather than the deck:
 *
 *  1. WHY THEY ARE NOT IN THE DECK. Every `TSWP.StorageArchive` in the
 *     84-slide file was searched, not just deck 59's, and the strings
 *     "Liminal Flow", "Collective Intelligence" and "Syntropy" appear
 *     in NONE of them. The emitted `slide59` module carries zero text
 *     records, against 91 across the rest of the deck. They were
 *     deleted after the recording, along with the tableau being dragged
 *     down 141.56 units.
 *
 *  2. WHY THE FILE IS THE THING THAT CHANGED, not the video. Keynote's
 *     own stored thumbnail for deck 59 agrees with the DECK, not the
 *     footage (horizon at 0.4000 of frame height against the declared
 *     0.4010 and the video's 0.2694), and rolling the video frame down
 *     96 px lifts its correlation with that thumbnail from 0.104 to
 *     0.880. So the deck on disk post-dates the recording, and under
 *     the canon policy — the published video is the canon — the
 *     recording-era state is what the film reproduces.
 *
 *  3. THE TEXT. Read directly from the footage, where all three are
 *     plainly legible at f_04451 (video 890.0s) and every frame after
 *     the cascade settles.
 *
 *  4. THE POSITIONS. Measured from the footage by ink bounding box of
 *     each label's own glyph block, in an otherwise empty region of the
 *     frame, over eight settled frames after all three have arrived
 *     (886.0-893.0s, the segment's last hold). The boxes are IDENTICAL
 *     across all eight — sd 0.00 px on every edge — which is what a
 *     held tableau should give and is the check that the window really
 *     is settled. Converted to slide units by the pipeline's own 3/2
 *     (the inverse of `SLIDE_TO_PX`).
 *
 *     Because SetPieces' deck-59 page carries the `DECK59_EDIT_OFFSET`
 *     translation, these are given in the FILMED frame and staged as
 *     SIBLINGS of that page rather than as members of it — a label that
 *     rode the page would be lifted twice.
 *
 *  5. THE SIZES AND THE FACE — DERIVED, then matched to the deck's own
 *     styles, which is the whole point of taking from the footage only
 *     what the footage uniquely holds. Each label's CAP HEIGHT was
 *     measured on a glyph with no descender ("L" of Liminal Flow, the
 *     first line of Collective Intelligence, "S" of Syntropy), and
 *     HelveticaNeue's cap height is 0.714 em, so the em follows:
 *
 *         label                     cap px    implied size    deck size
 *         Liminal Flow                24         50.42            50
 *         Collective Intelligence     15         31.51            32
 *         Syntropy                    19         39.92            40
 *
 *     All three land within half a unit of a size the deck's own
 *     stylesheet carries (24/30/32/34/36/37/40/50/116), so the SIZE
 *     TAKEN IS THE DECK'S and the measurement is what selects it. That
 *     is the distinction the refused-fits rule turns on: nothing here
 *     is tuned to make a frame match — a cap height is read, and it
 *     picks a value out of a list the deck already declares.
 *
 *     The face is `HelveticaNeue` regular, the deck's own body face
 *     (all 91 in-scope text records are HelveticaNeue, -Medium or
 *     -Bold; every comparable label on a tableau of this kind is the
 *     plain face). Collective Intelligence's two lines measure a
 *     baseline gap of 24 px against a 21.01 px em, i.e. `lineSpacing`
 *     1.142 — carried as measured rather than rounded to the deck's
 *     usual 1.0, because on a two-line label it is visible.
 *
 *  6. THE ONSETS. Measured, like every click in the film: the three
 *     labels build at 875.8, 878.2 and 883.0, after the 33-chunk
 *     cascade ends at 875.314. Each is a 1.0s `dissolve character`
 *     ramp — the effect every other label on the deck uses, and the
 *     one the footage shows (they fade up as blocks, not per glyph:
 *     P-1's amendment established that all 384 in-scope builds are
 *     `All at Once`).
 *
 * WHAT IS NOT RECONSTRUCTED, and it is named so the residual is not
 * mistaken for these: the SYNTROPY CURVES (2,298 px in P-9's
 * accounting) are also absent from the file and are NOT rebuilt here.
 * They are two long free-drawn beziers, and reconstructing a curve from
 * footage is a different order of act from reading three strings and
 * three centroids — it would be tracing, and the campaign's one
 * tracing question was settled by finding Keynote's own stored
 * `tracedPath` rather than by tracing. There is no stored path for a
 * shape that was deleted. So the curves stay missing, stated, and
 * visible in the deck-59 score.
 */
const DECK59_LABELS: readonly {
  content: string
  /**
   * The block's anchor in SLIDE units, in the FILMED frame (y down,
   * origin top-left) — x is the centre of the block (all three are
   * centred, as all 91 of the deck's own records are) and y is the
   * FIRST LINE'S BASELINE, which is what `Text` anchors on.
   *
   * Derived from the measured ink box: the baseline sits one cap height
   * (0.714 em) below the measured cap top, and px -> slide is 3/2.
   *
   *   label                    cap top px   baseline px   slide y
   *   Liminal Flow                610.0        633.80      950.70
   *   Collective Intelligence     131.0        146.23      219.35
   *   Syntropy                    301.0        320.04      480.06
   */
  x: number
  y: number
  size: number
  /**
   * Baseline-to-baseline as a multiple of the em.
   *
   * ALWAYS SET, never left undefined, and that is not cosmetic: every
   * one of the deck's 91 text records carries `lineSpacing: 1` and so
   * passes a `lineHeight` through to the shaper, and the two labels here
   * that first omitted it were the only Texts in the whole film to do
   * so — and the only two that failed to draw. The single-line default
   * is therefore stated as the deck states it.
   */
  lineHeight: number
  /** The measured build onset, video seconds. */
  at: number
}[] = [
  { content: "Liminal Flow", x: 960.0, y: 950.7, size: 50, lineHeight: 1, at: 875.8 },
  {
    content: "Collective\nIntelligence",
    x: 930.75,
    y: 219.35,
    size: 32,
    // MEASURED: a 24 px baseline gap against a 21.01 px em. The deck's
    // own records are all 1.0, but this label is not in the deck.
    lineHeight: 1.142,
    at: 878.2,
  },
  { content: "Syntropy", x: 1443.0, y: 480.06, size: 40, lineHeight: 1, at: 883.0 },
]

/** The chapter classes, in film order — borrowed whole, never re-timed. */
const CHAPTERS = [
  Arc01Dream,
  Mesh01Dream,
  Density01Dream,
  Chain01Dream,
  SetPiecesDream,
  Web01Dream,
  Fractal01Dream,
] as const

export class ProjectLiminalityDream extends Dream {
  /** The twenty pages this file composes itself. */
  pages = STANDARD.map((s) => new Slide({ data: s.data }))

  /**
   * Deck 59's three reconstructed labels — see `DECK59_LABELS`.
   *
   * Built exactly as `Slide.composeText` builds the deck's own labels:
   * the same face, the same `size` in world units (`fontSize * scale`),
   * the same centred alignment, and the same anchor convention (block
   * centre in x, first baseline in y). The only difference is where the
   * numbers come from — the footage rather than a text record — which
   * is the whole of the ruling.
   */
  labels = DECK59_LABELS.map((l) => {
    // The same scale every page uses: `Slide.height` defaults to the
    // 36mm rig's visible height, so the 1080-unit canvas fills the frame
    // the way the projector filled it (TitleSlide.ts's header).
    const scale = slideToWorld(SLIDE_FRAME_HEIGHT)
    const world = slidePointToWorld({ x: l.x, y: l.y }, scale)
    return new Text({
      content: l.content,
      size: l.size * scale,
      align: "center",
      font: "HelveticaNeue",
      lineHeight: l.lineHeight,
      x: world.x,
      y: world.y,
      creation: 1,
      opacity: 0,
    })
  })

  /**
   * The chapter instances whose clips the song borrowed, in film order.
   *
   * Kept rather than discarded because the holons the song drives ARE
   * these instances' holons — `unfold` constructs each chapter once,
   * takes its clip list, and stages its roots, so the params the
   * borrowed clips drive belong here. The composition-invisibility test
   * needs exactly this instance to compare against a fresh standalone
   * one; without it there is nothing to compare but a re-derivation.
   */
  chapterDreams: Dream[] = []

  /** Play an Anim at an ABSOLUTE video second (P-3's convention). */
  private playAt(anim: Anim, at: number, runTime: number): void {
    const clip = this.play(anim, runTime)
    clip.start = at
  }

  /** A cut — a zero-duration step at an absolute video second. */
  private setAt(at: number, ...anims: Anim[]): void {
    for (const anim of anims) {
      const clip = this.play(anim, 0)
      clip.start = at
    }
  }

  /** The video second a deck's segment begins — its row in `BOUNDARIES`. */
  private windowStart(deck: number): number {
    const i = BOUNDARIES.findIndex((b, j) => b.deck === deck && j !== BOUNDARIES.length - 1)
    if (i < 0) throw new Error(`no boundary row for deck ${deck}`)
    return BOUNDARIES[i]!.t0
  }

  /**
   * The video second a deck's segment ends — the next row's t0.
   *
   * Deck 1 is the exception and it is the film's own: it appears twice,
   * at the head and at the close, so its "window end" for gating
   * purposes is the film's end. The closing cut-in re-lights it.
   */
  private windowEnd(deck: number): number {
    const i = BOUNDARIES.findIndex((b, j) => b.deck === deck && j !== BOUNDARIES.length - 1)
    if (i < 0) throw new Error(`no boundary row for deck ${deck}`)
    return BOUNDARIES[i + 1]!.t0
  }

  unfold(): void {
    this.observer.look("front")

    // ---- The seven chapters, borrowed verbatim -------------------
    //
    // Each chapter's clips are already in video time, so they are
    // restated at their own starts with no offset. `play()` owns the
    // clip list and the cursor, so each borrowed clip is played where
    // the cursor stands and then moved to its true start — the same
    // dance `DreamSong.unfold()` does.
    for (const Chapter of CHAPTERS) {
      const dream = new Chapter()
      this.chapterDreams.push(dream)
      for (const clip of dream.clips) {
        const placed = this.play(clip.anim, clip.duration)
        placed.start = clip.start
        this.wait(-clip.duration)
      }
      for (const root of dream.roots) this.stage(root)
    }

    // ---- Gate every borrowed page to its own window ---------------
    //
    // THE ONE THING A CHAPTER CANNOT KNOW, and the assembly's real
    // structural finding.
    //
    // A chapter hides the OUTGOING page when it cuts to the next one
    // (`setAt(from, pages[i-1].visible(false))`), which is exactly right
    // standalone: the chapter's own run is contiguous, and its LAST page
    // is meant to hold to the end because the chapter ends there. In a
    // film neither holds. The last page of every chapter would stay on
    // screen for the rest of the video, and a chapter whose decks are
    // NOT contiguous in film order (SetPieces owns 16,17,18 and 59, with
    // decks 19-58 in between) leaks its mid-run pages the same way.
    //
    // Measured before the fix, at video 700: seven pages drawing at once
    // — Mesh01's deck 14 (1,329 leaf drawables), Density01's deck 13
    // (1,327), SetPieces' deck 18 (1,801), Chain01's deck 30, Arc01's
    // deck 6, Web01's deck 45 and Fractal01's deck 44. The composite was
    // every tableau in the film superimposed.
    //
    // This is NOT a defect in the chapters. Each is correct over its own
    // windows, which is all a chapter is scored on and all it can know:
    // "when does my last page leave" is a question only the film can
    // answer. So the song answers it, uniformly, for every page it can
    // reach — including its own twenty, which get the same treatment
    // below rather than a second mechanism.
    //
    // The gate is a plain `visible(false)` at the far edge of the page's
    // window. It cannot disturb the chapter's own scoring: inside the
    // window nothing is written, and outside it the chapter had no
    // opinion. The composition-invisibility test asserts exactly that,
    // sampling each chapter at the settled middle of each of its decks
    // and requiring param-for-param equality with the standalone.
    for (const dream of this.chapterDreams) {
      const pages = (dream as unknown as { pages?: Slide[] }).pages ?? []
      // Arc01's deck 6 is a separate field (`liminality`), not a member
      // of its `pages` array — it is the one held tableau in the arc
      // that carries no builds. Reached by name so it is gated too.
      const extra = (dream as unknown as { liminality?: Slide }).liminality
      for (const page of [...pages, ...(extra ? [extra] : [])]) {
        this.setAt(this.windowEnd(page.data.index), page.visible(false))
      }
    }

    // ---- The twenty decks the chapters do not build ---------------
    //
    // Every page starts composed-but-hidden with its In-build targets
    // held back (`preBuild`), and is cut in at its own boundary. This
    // is P-3's staging, unchanged.
    for (const page of this.pages) {
      this.setAt(0, page.creation.to(1), page.visible(false), page.preBuild())
    }

    for (let i = 0; i < STANDARD.length; i++) {
      const spec = STANDARD[i]!
      const page = this.pages[i]!
      const deck = spec.data.index
      const t0 = this.windowStart(deck)
      const t1 = this.windowEnd(deck)

      // The cut in. The outgoing page belongs to whichever chapter or
      // page owns the previous segment, and every page hides itself
      // when its own window closes — so a page's visibility is its own
      // business and no page has to know its neighbour.
      this.setAt(t0, page.cutIn())
      this.setAt(t1, page.visible(false))

      const chunks = spec.data.buildChunks ?? []
      if (chunks.length === 0) continue

      // The three-state firing model (P-10's close), imported from the
      // chapter that settled it. Clicks are measured; every automatic
      // chunk's time is derived.
      //
      // A slide whose chunk 0 is automatic has no predecessor to derive
      // from, so its cascade is computed from zero and shifted onto the
      // click that advanced to the slide — see `Standard.cascadeFrom`.
      // The shift preserves every derived interval exactly.
      const raw = firingTimes(chunks, spec.clicks)
      const times =
        spec.cascadeFrom === undefined
          ? raw
          : new Map(
              [...raw].map(([build, t]) => [
                build,
                // Only the leading cascade is shifted: a chunk that took
                // a measured click of its own already sits in video time.
                t < t0 ? t + spec.cascadeFrom! : t,
              ]),
            )

      // Group by firing instant: chunks that share one derive one clip,
      // so a `referent: false` run really does fire together rather
      // than becoming a staircase.
      const byInstant = new Map<number, string[]>()
      for (const chunk of chunks) {
        const t = times.get(chunk.build)
        if (t === undefined) continue
        const group = byInstant.get(t)
        if (group) group.push(chunk.build)
        else byInstant.set(t, [chunk.build])
      }

      for (const [at, group] of [...byInstant].sort((a, b) => a[0] - b[0])) {
        const anims: Anim[] = []
        let span = 1
        for (const id of group) {
          const record = spec.data.builds.find((b) => b.id === id)
          if (!record) continue
          const chunk = chunks.find((c) => c.build === id)
          // The DURATION is the deck's; the ONSET is the footage's or
          // derived from it. The two never trade.
          span = chunk?.duration ?? record.duration ?? 1
          anims.push(page.build(record))
        }
        if (anims.length === 0) continue
        this.playAt(together(...anims), at, span)
      }
    }

    // ---- Deck 59's three reconstructed labels ---------------------
    //
    // Staged as siblings of SetPieces' deck-59 page rather than as its
    // members, because that page carries the `DECK59_EDIT_OFFSET`
    // translation and a member would be lifted twice. Their positions
    // are therefore given in the FILMED frame directly.
    for (let i = 0; i < DECK59_LABELS.length; i++) {
      const spec = DECK59_LABELS[i]!
      const label = this.labels[i]!
      this.stage(label)
      // Dark until the build fires — the counterpart of `preBuild` for a
      // label that has no page to be pre-built by.
      this.setAt(0, label.opacity.to(0))
      // A 1.0s `dissolve character` ramp delivered All at Once, i.e. one
      // uniform opacity ramp: P-1's amendment established that every one
      // of the deck's in-scope builds is All at Once, so the per-glyph
      // capability is owed to nothing and a `dissolve character` here is
      // the same ramp P-3 implements for the deck's own labels.
      this.playAt(label.opacity.to(1), spec.at, 1.0)
      // The film returns to the title card at 893.8; deck 59 and its
      // labels leave together.
      this.setAt(893.8, label.opacity.to(0))
    }

    // ---- The closing return to the title card ---------------------
    //
    // The video closes by returning to DECK 1 (P-1's closing
    // correction). The title page is `pages[0]`, already composed, so
    // the close is a second cut-in of the same holon rather than a new
    // one — which is what the deck does: slides 1, 20 and the close are
    // the same drawing, and the recon measured their thumbnails
    // identical to correlation 0.99999998.
    const title = this.pages[0]!
    this.setAt(893.8, title.cutIn())

    // The timeline's duration is its last clip's END, and a cut is a
    // zero-duration clip — so without this the film would stop at 893.8
    // with the closing card unrepresented. This parks an empty clip on
    // the far edge, which is how a held tableau earns its place
    // (Arc01's `hold`, same reason).
    const last = this.play({ tracks: [] }, 0)
    last.start = PL02_DURATION
  }
}

if (import.meta.main) render(ProjectLiminalityDream)
