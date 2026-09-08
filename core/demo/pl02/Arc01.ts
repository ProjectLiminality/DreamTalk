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
 * and the measured onsets run 2.4 (Vitruvian), 3.4/4.2 (eagle line,
 * eagle), 5.2/6.2 (tree), 7.6/8.3 (sun), 9.4/10.3 (apple), 11.6
 * (lightning). Same sequence, same interleave — a line always leading
 * its icon by roughly 0.8s. Nothing was reordered to achieve that; the
 * chunk list came out of the archive in that order and the footage
 * agrees with it.
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
import { together } from "../../src/anim"
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
 * tableau: each dotted connection draws on centre-outward over ~1.0s
 * (`LineDrawForLine`) and its icon then fades up uniformly over 1.0s
 * (`dissolve character`). Onsets from a frame-differenced scan of
 * frames5, cross-checked per object against its own final ink mask.
 *
 * The five image builds are listed with the onsets they were measured at
 * even though nothing renders for them — dropping them from this table
 * would hide the gap instead of recording it.
 */
const SLIDE02: Onset[] = [
  { build: "4880359", at: 2.4 }, // Vitruvian figure — image, not composed
  { build: "4881284", at: 3.4 }, // eagle line   (dir 52)
  { build: "4881256", at: 4.2 }, // eagle
  { build: "4880370", at: 5.2 }, // tree line    (dir 51)
  { build: "4880412", at: 6.2 }, // tree
  { build: "4882704", at: 7.6 }, // sun line     (dir 52)
  { build: "4882723", at: 8.3 }, // sun
  { build: "4882778", at: 9.4 }, // apple line   (dir 52)
  { build: "4883958", at: 10.3 }, // apple
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
 * `4890801` is an `apple:action-motion-path` on the same label, which
 * this chapter does not implement (P-7's build class). It is left out of
 * this table and reported by `Slide.unsupported()`; the label's own
 * dissolve still fires, which is what the frames at 32.0 onward show.
 */
const SLIDE03: Onset[] = [
  { build: "4890648", at: 32.0 }, // "Story"
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
 * at 98.2, leaving the red side alone for the twenty seconds before the
 * FadeThru. These are the arc's only `Out` builds, and they are what
 * makes `animationType` load-bearing rather than decorative: the same
 * effect, the same duration, the same target kind, played to remove.
 */
const SLIDE05: Onset[] = [
  { build: "5538696", at: 98.2 }, // the blue ring
  { build: "5538697", at: 98.2 }, // its "Story"
  { build: "5538698", at: 98.2 }, // "Dead Thing"
]

/** The four pages that carry builds, with their measured onsets. */
const PAGES = [
  { data: slide02, onsets: SLIDE02, from: 0.6, to: 19.2 },
  { data: slide03, onsets: SLIDE03, from: 21.4, to: 44.6 },
  { data: slide04, onsets: SLIDE04, from: 45.8, to: 97.6 },
  { data: slide05, onsets: SLIDE05, from: 99.4, to: 118.8 },
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

  /**
   * The scene cursor in VIDEO seconds — see the header.
   *
   * `play()` advances the Dream's own cursor by the clip's run time, so
   * this mirrors it rather than tracking it independently: every `at()`
   * and every `play()` below keeps the two in step, and a build whose
   * 1.0s window runs past the next onset would otherwise silently push
   * the whole arc late. (It did, by 11.8 seconds, before this was a
   * mirror.)
   */
  #now = 0

  /** Advance the cursor to video second t. A build already past t wins. */
  private at(t: number): void {
    if (t > this.#now) {
      this.wait(t - this.#now)
      this.#now = t
    }
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
      this.set(page.creation.to(1), page.opacity.to(0), page.preBuild())
    }

    for (let i = 0; i < PAGES.length; i++) {
      const spec = PAGES[i]!
      const page = this.pages[i]!

      // The cut. The outgoing page's last settled frame is `spec.from`'s
      // predecessor; nothing is scored between the two.
      this.at(spec.from)
      this.set(page.opacity.to(1))
      if (i > 0) this.set(this.pages[i - 1]!.opacity.to(0))

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
          const chunk = spec.data.buildChunks.find((c) => c.build === onset.build)
          span = chunk?.duration ?? record.duration ?? 1
          anims.push(page.build(record))
        }
        if (anims.length === 0) continue
        this.at(at)
        this.play(together(...anims), span)
        this.#now = at + span
      }

      this.at(spec.to)
    }

    // Slide 6 — "Story = Being" inside the red ring, over "Liminality".
    // Zero builds: the page is simply held, from the far side of the
    // 1.5s FadeThruColor to the end of the segment at 134.8.
    this.at(120.4)
    this.set(this.pages[this.pages.length - 1]!.opacity.to(0))
    this.set(this.liminality.opacity.to(1))
    this.at(134.8)
  }
}

if (import.meta.main) render(Arc01Dream)
