/**
 * Arc01.ts — A DreamWeaving
 *
 * "Project Liminality" (2023), the opening arc: deck slides 2-6, video
 * seconds 0.6 to 134.8. The Vitruvian man and his four relationships,
 * the story-lens over a tree, the tree as Dead Thing and Living Being,
 * and the collapse to "Story = Being / Liminality".
 *
 * Chapter P-3's gate. Where P-1 proved the geometry and P-2 the type,
 * this proves the deck's two dominant BUILDS — `LineDrawForLine` and
 * `dissolve character` — against the footage's own measured onsets.
 *
 * THE SCENE RUNS ON VIDEO SECONDS
 *
 * The cursor here IS the video's clock: `at(t)` advances to video second
 * t, so every number below can be read against `refs/pitch/pl02/frames5`
 * (frame N is video second (N−1)/5) and against the recon's segment
 * table without arithmetic. That costs nothing and it makes every timing
 * claim in this file falsifiable by opening one JPEG.
 *
 * WHAT IS DECLARED AND WHAT IS MEASURED — THE CHAPTER'S CENTRAL DIVISION
 *
 * The deck states each build's EFFECT, its DURATION (1.0s for all 25 in
 * this arc), its easing, its target, and — since P-1 carried the chunk
 * list — the ORDER the builds fire in. It does NOT state when any of
 * them fires: every chunk in the deck is Keynote's advance-on-click
 * default, and the video was recorded by David clicking through while
 * narrating. So the onsets below are MEASURED from the footage, which
 * under the O-11 refinement of the refused-fits rule is measurement and
 * not fitting. No duration here is tuned to make an onset land; where
 * ours and the reference disagree the onset moves, never the duration.
 *
 * The build ORDER is worth calling out because it is declared and it
 * predicts the footage exactly. The deck's chunk list for slide 2 runs:
 *
 *     Vitruvian, then (line, icon) × 4 for eagle, tree, sun, apple,
 *     then the four lightning glyphs
 *
 * and the measured onsets run 2.4 (Vitruvian), 3.2/4.23 (eagle line,
 * eagle), 5.22/6.23 (tree), 7.6/8.24 (sun), 9.2/10.22 (apple), 11.6
 * (lightning). Same sequence, same interleave — a line always leading
 * its icon by roughly a second. Nothing was reordered to achieve that;
 * the chunk list came out of the archive in that order and the footage
 * agrees with it.
 *
 * The icons' own onsets are spaced 2.005, 2.005 and 1.982 seconds apart,
 * which is the strongest evidence in the chapter that this really is a
 * person clicking a remote rather than a timeline playing back — and it
 * is a quantity that exists nowhere in the deck.
 *
 * THE ONE THING THE DECK GETS WRONG ABOUT ITS OWN TIMING
 *
 * Each chunk carries `automatic`, and on slide 2 twelve of the thirteen
 * are true — Keynote's marker for "fires with the previous build". Taken
 * literally that is ONE event, and the footage shows seven. The flag
 * describes what the deck would do if played back untouched; the video
 * is a person clicking. So the flag is not used for grouping here, and
 * the grouping is measured with the rest of the pacing.
 *
 * FIVE BUILDS HAVE NO TARGET TO DRIVE, AND THAT IS VISIBLE
 *
 * Slide 2's Vitruvian figure and its four lightning glyphs are
 * `TSD.ImageArchive` — the four images P-1's decode skips, plus one. The
 * importer never composed them, so their five `dissolve` builds have
 * nothing to animate and the render is missing that ink at every frame.
 * It is reported by `Slide.missingBuildTargets()` rather than passed
 * over, and it is why segment 2's scores below are quoted with the
 * figure's absence stated rather than blamed on the builds.
 *
 * THE MAGIC MOVES ARE SKIPPED, DELIBERATELY
 *
 * Four of this arc's five transitions are `magic-move-implied-motion-path`
 * (2.0s, 2.0s, 2.0s, 1.5s) and the fifth is a 1.5s FadeThruColor. Magic
 * Move is chapter P-6's whole subject — a matched-object interpolation
 * across two tableaux, not a fade — and standing in a cross-dissolve for
 * it would produce frames that look approximately right for the wrong
 * reason. So each transition is a CUT here: the outgoing page is held to
 * its last settled frame and the incoming page appears at its first.
 * The held windows are stated at each cut below, and no frame inside one
 * is scored.
 */

import { Dream, render } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { Slide } from "../../vocabulary/Slides/Slides"
import {
  slide02,
  slide03,
  slide04,
  slide05,
  slide06,
} from "../../vocabulary/Slides/assets/pl02/index"

/**
 * A build's measured onset, and the deck record it fires.
 *
 * `at` is the video second the footage shows the build starting; `build`
 * is the `KeyBuild.id` — the deck's own identity for it, so a record can
 * be looked up rather than described. Keeping the id here (and not the
 * target, or an index) is what makes a re-emission of the slide modules
 * unable to silently repoint one of these.
 */
interface Onset {
  build: string
  at: number
}

/**
 * Slide 2 — the Vitruvian opening. 0.6-20.2s, 13 builds, 7 measured
 * events.
 *
 * The four (line, icon) pairs are the chapter's whole thesis in one
 * tableau: each dotted connection draws on centre-outward over 1.0s
 * (`LineDrawForLine`) and its icon then fades up uniformly over 1.0s
 * (`dissolve character`).
 *
 * HOW THESE ONSETS WERE OBTAINED, because "the first frame that showed
 * ink" is not the same number.
 *
 * A frame-differenced scan locates each event to within the 0.2s frame
 * interval, and that is where these started. It is not precise enough:
 * at 5 fps a 1.0s ease-both ramp is six samples, and the first of them
 * sits at whatever alpha the encode's floor happens to catch. So each
 * onset here is instead the start time obtained by inverting the deck's
 * OWN declared curve — a 1.0s smoothstep — through every partial sample
 * of that object's ramp, measured as mean luminance over the object's
 * final ink mask. Four samples per icon, and the four independent fits
 * agree with themselves to a standard deviation of ~0.023s:
 *
 *     eagle  t0 = 4.228  sd 0.025      sun    t0 =  8.238  sd 0.023
 *     tree   t0 = 6.233  sd 0.021      apple  t0 = 10.220  sd 0.024
 *
 * That is a DERIVATION given the declared duration, not a fit of it: the
 * curve and its length are read from the deck and only the offset is
 * solved for. The inter-icon gaps that fall out — 2.005, 2.005, 1.982 —
 * are David clicking at a steady two seconds, which nothing in the deck
 * could have told us and which is exactly the kind of quantity the O-11
 * rule admits as measured.
 *
 * The line onsets are the same fit against the fraction of each
 * corridor that carries ink. Only the tree line yields a clean one
 * (5.215, sd 0.044); the other three corridors are contaminated — two by
 * the lightning glyphs that arrive at 11.6, and all of them by the stale
 * connection-line geometry described in the header, which puts the drawn
 * line at a slightly different angle from the stored one. Their onsets
 * are therefore the frame-scan values, good to the 0.2s interval and no
 * better, and they are marked as such.
 *
 * The five image builds are listed with the onsets they were measured at
 * even though nothing renders for them — dropping them from this table
 * would hide the gap instead of recording it.
 */
const SLIDE02: Onset[] = [
  { build: "4880359", at: 2.4 }, // Vitruvian figure — image, not composed
  { build: "4881284", at: 3.2 }, // eagle line  (frame scan, ±0.2)
  { build: "4881256", at: 4.228 }, // eagle      (curve fit, sd 0.025)
  { build: "4880370", at: 5.215 }, // tree line  (curve fit, sd 0.044)
  { build: "4880412", at: 6.233 }, // tree       (curve fit, sd 0.021)
  { build: "4882704", at: 7.6 }, // sun line    (frame scan, ±0.2)
  { build: "4882723", at: 8.238 }, // sun        (curve fit, sd 0.023)
  { build: "4882778", at: 9.2 }, // apple line  (frame scan, ±0.2)
  { build: "4883958", at: 10.22 }, // apple      (curve fit, sd 0.024)
  { build: "5473892", at: 11.6 }, // lightning ×4 — images, not composed
  { build: "5474734", at: 11.6 },
  { build: "5474735", at: 11.6 },
  { build: "5474736", at: 11.6 },
]

/**
 * Slide 3 — the story lens. 20.2-45.8s, 5 builds, 2 measured events.
 *
 * The first click brings the "Story" label and its lens ellipse in
 * together at 32.0; the second adds the second lens and the second tree
 * at 33.4. The deck's chunk list marks exactly those two as
 * `automatic: false`, so here the flag and the footage agree — the one
 * slide in the arc where they do.
 *
 * `4890801` is an `apple:action-motion-path` on the SAME label, firing
 * with its dissolve. It is not one of this chapter's two verbs — the
 * build class is P-7's — but its geometry is DECLARED, a straight
 * (-1.388, -229.910) slide units, and P-1 carried it after this chapter
 * found it. Rendering the label unmoved put it inside the lens ellipse
 * it should sit above, costing segment 3 some 30 points of coverage_ref,
 * so it is honoured here rather than scored wrong on purpose. See
 * `Builds.motionAnim` for what is and is not claimed.
 */
const SLIDE03: Onset[] = [
  { build: "4890648", at: 32.0 }, // "Story"
  { build: "4890801", at: 32.0 }, // …and its motion path, same click
  { build: "4890815", at: 32.0 }, // the lens ellipse
  { build: "4895353", at: 33.4 }, // the second lens
  { build: "4895689", at: 33.4 }, // the second tree
]

/**
 * Slide 4 — Dead Thing / Living Being. 45.8-98.0s, 4 builds, 1 event.
 *
 * All four labels arrive in one click at 46.0, riding the tail of the
 * incoming Magic Move — which is why the recon counted a single event
 * for a 52.2-second segment, the longest hold in the video against the
 * fewest builds. Everything after 46.6 is a still frame until the
 * outgoing transition at 97.6.
 */
const SLIDE04: Onset[] = [
  { build: "4895439", at: 46.0 }, // "Dead Thing"
  { build: "4897553", at: 46.0 }, // "Story" (right)
  { build: "5538572", at: 46.0 }, // "Living"
  { build: "5538573", at: 46.0 }, // "Being"
]

/**
 * Slide 5 — the dead half leaves. 98.0-119.4s, 3 builds, all `Out`.
 *
 * The blue ring, its "Story" and its "Dead Thing" dissolve away together
 * at 116.2, leaving the red side alone for the three seconds before the
 * FadeThru. These are the arc's only `Out` builds, and they are what
 * makes `animationType` load-bearing rather than decorative: the same
 * effect, the same duration, the same target kind, played to remove.
 *
 * THE 98.2 TRAP, AND WHY THE COVERAGE PAIR CAUGHT IT
 *
 * The first reading of this segment put these builds at 98.2, because a
 * frame-differenced scan shows motion there. It is the wrong motion: the
 * incoming Magic Move is still settling, and what arrives at 99.0-99.4
 * is the two "Story" labels, which slide 5 has no build for at all.
 * Scored that way the segment read `coverage_ref 0.4916 /
 * coverage_ours 0.9028` — a composite with the whole blue half in
 * reference-only red, because the render had dissolved at 98.2 something
 * the footage still holds at 110.
 *
 * The blue side's own measurement settles it. Mean luminance over its
 * final ink mask, normalised to its own 150.9 plateau:
 *
 *     t     115.8  116.0  116.2  116.4  116.6  116.8
 *     norm   1.000  0.970  0.738  0.379  0.117  0.000
 *
 * held flat from t=101.4 to 115.8 and gone by 116.8. A motion scan finds
 * WHERE something changed; only the object's own mask says WHAT changed,
 * and the two disagree whenever a transition and a build are near each
 * other.
 *
 * THE ONSET IS 115.85, AND THE DECK'S DURATION IS WHY
 *
 * Inverting a smoothstep through those four ramp samples gives a start
 * time per sample, and which start time depends on the duration assumed:
 *
 *     D = 1.0s (declared)  t0 = 115.896, 115.865, 115.819, 115.813  (sd 0.034)
 *     D = 0.8s (fitted)    t0 = 115.917, 115.932, 115.935, 115.971  (sd 0.020)
 *
 * The 0.8s reading is the tighter fit. It is also a FITTED DURATION, and
 * the deck states 1.0 — so under the refused-fits rule the duration is
 * read and the onset is what moves. 115.85 is the mean the declared
 * duration implies, and the 0.034s spread around it is well inside the
 * 0.2s frame interval, so nothing is being resolved finer than the
 * evidence allows.
 */
const SLIDE05: Onset[] = [
  { build: "5538696", at: 115.85 }, // the blue ring
  { build: "5538697", at: 115.85 }, // its "Story"
  { build: "5538698", at: 115.85 }, // "Dead Thing"
]

/** The four pages that carry builds, with their measured onsets. */
const PAGES = [
  { data: slide02, onsets: SLIDE02, from: 0.6, to: 19.2 },
  { data: slide03, onsets: SLIDE03, from: 21.4, to: 44.6 },
  { data: slide04, onsets: SLIDE04, from: 45.8, to: 97.6 },
  { data: slide05, onsets: SLIDE05, from: 99.4, to: 118.8 },
] as const

/** Reference frames, one per segment, each AFTER that segment's last event. */
export const SCORED = [
  { frame: 81, seg: 2, at: 16.0 }, // last event 12.2
  { frame: 201, seg: 3, at: 40.0 }, // last event 33.6
  { frame: 451, seg: 4, at: 90.0 }, // last event 46.6
  { frame: 591, seg: 5, at: 118.0 }, // last event 117.0
  { frame: 651, seg: 6, at: 130.0 }, // last event 120.4
] as const

export class Arc01Dream extends Dream {
  /**
   * One holon per deck slide. They are staged together and made visible
   * a page at a time — a cut, which is what this chapter renders where
   * the deck asks for a Magic Move (see the header).
   */
  pages = PAGES.map((p) => new Slide({ data: p.data }))
  /** Slide 6 carries no builds at all: a held tableau, cut to at 120.4. */
  liminality = new Slide({ data: slide06 })

  /** The scene cursor in VIDEO seconds — see the header. */
  #now = 0

  /** Advance the cursor to video second t. */
  private at(t: number): void {
    if (t > this.#now) {
      this.wait(t - this.#now)
      this.#now = t
    }
  }

  /**
   * Play an Anim at an ABSOLUTE video second, whatever the cursor is
   * doing.
   *
   * The Dream cursor can only move forward (`wait`), and `play` puts a
   * clip at the cursor and then advances it past the clip. That is the
   * right model for a scene whose actions follow one another, and the
   * wrong one for this video, because BUILDS OVERLAP: the eagle's line
   * starts drawing at 3.4 over 1.0s and the eagle itself starts fading
   * at 4.2, 0.2s before the line has finished. Placed with a forward-only
   * cursor the second build cannot start until 4.4, and every later
   * build inherits the slip — measured as a uniform +0.6s lag across all
   * nineteen, with the clips landing at 4.40, 5.40, 7.80 where the
   * footage has 4.2, 5.2, 7.6.
   *
   * `play()` returns its Clip record for build-time adjustment, so the
   * fix is to place the clip where it belongs rather than to fight the
   * cursor. The cursor is then advanced only if the clip ends later than
   * it already stands, which keeps the timeline's duration honest.
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

    const all = [...this.pages, this.liminality]

    // Every page starts composed-but-hidden, and every In build's target
    // starts at nothing. `preBuild` is the counterpart of Slide composing
    // its tableau finished: without it a page shows a label before the
    // click that brings it, which is exactly the over-draw P-2 measured
    // on slide 32 (coverage_ours 0.77 against coverage_ref 0.997).
    for (const page of all) {
      this.setAt(0, page.creation.to(1), page.visible(false), page.preBuild())
    }

    for (let i = 0; i < PAGES.length; i++) {
      const spec = PAGES[i]!
      const page = this.pages[i]!

      // The cut. The outgoing page's last settled frame is `spec.from`'s
      // predecessor; nothing is scored between the two.
      this.setAt(spec.from, page.cutIn())
      if (i > 0) this.setAt(spec.from, this.pages[i - 1]!.visible(false))

      // Builds sharing an onset fired on ONE click and must run in
      // parallel, so they are played as a single clip. Playing them one
      // after another would serialize four 1.0s ramps into four seconds
      // — slide 4's whole label set arrives together at 46.0, and the
      // footage settles by 46.6.
      const clicks = new Map<number, typeof spec.onsets[number][]>()
      for (const onset of spec.onsets) {
        const group = clicks.get(onset.at)
        if (group) group.push(onset)
        else clicks.set(onset.at, [onset])
      }

      for (const [at, group] of [...clicks].sort((a, b) => a[0] - b[0])) {
        const anims = []
        // The DURATION is the deck's, read from the chunk that fires the
        // build; the ONSET is the footage's. The two are different kinds
        // of number and this is the only place they meet.
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

    // Slide 6 — "Story = Being" inside the red ring, over "Liminality".
    // Zero builds: the page is simply held, from the far side of the
    // 1.5s FadeThruColor to the end of the segment at 134.8.
    this.setAt(120.4, this.pages[this.pages.length - 1]!.visible(false))
    this.setAt(120.4, this.liminality.cutIn())
    // The Timeline's duration is the last clip's END, and a cut is a
    // zero-duration clip — so the arc would stop at 120.4 with fourteen
    // seconds of held tableau unrepresented. `hold` gives the last page
    // the segment it actually occupies.
    this.hold(134.8)
  }

  /**
   * Extend the timeline to video second t without animating anything.
   *
   * `wait()` moves the cursor but adds no clip, and the Timeline's
   * duration comes from the clips — so a scene whose last act is a cut
   * ends AT the cut. This parks an empty clip on the far edge, which is
   * how a held tableau earns its place on the timeline. The whole video
   * is 89% held frames; a harness that could not seek into them would be
   * measuring the wrong 11%.
   */
  private hold(until: number): void {
    const clip = this.play({ tracks: [] }, 0)
    clip.start = until
    this.#now = Math.max(this.#now, until)
  }
}

if (import.meta.main) render(Arc01Dream)
