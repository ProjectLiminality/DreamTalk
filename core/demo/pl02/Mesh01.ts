/**
 * Mesh01.ts — A DreamWeaving
 *
 * "Project Liminality" (2023), the campfire and social-organism family:
 * deck slides 7, 8, 9 and 14, video seconds 134.8 to 227.0. The tribe
 * around one fire; five fires cross-linked by travel; the six-person
 * social organism drawn as a complete mesh; and the two organisms that
 * have grown too far apart to reach one another.
 *
 * Chapter P-4's gate. Where P-3 proved two build verbs on tableaux of
 * nine shapes and no groups, this proves the deck's CONNECTION LINES at
 * scale — and proves them by REBUILDING them, because a quarter of the
 * deck's stored connection paths are stale leftovers (Connections.ts).
 *
 * WHAT IS NEW HERE, AND WHAT IS INHERITED
 *
 * New: the connection renderer. Every line on these slides is recomputed
 * from `connects` — centre to centre, clipped at each object's own drawn
 * silhouette, laid as a quadratic through the stored middle point, with
 * a dash lattice measured by continuous arc length. Slide 9 is fifteen
 * such lines in a complete K6 and is the chapter's sharpest test, since
 * six identical icons at hexagon positions make every clip comparable.
 *
 * Inherited unchanged: P-3's verbs (`LineDrawForLine`, `dissolve` and
 * `dissolve character` as one uniform ramp), P-3's timing method (read
 * the duration, measure the onset, never fit one to fix the other), and
 * P-3's absolute clip placement, which builds that overlap require.
 *
 * THE SCENE RUNS ON VIDEO SECONDS, as Arc01 does — `at(t)` advances to
 * video second t, so every number below reads directly against
 * refs/pitch/pl02/frames5 (frame N is video second (N-1)/5).
 *
 * SLIDE 8 SETTLES A QUESTION P-1 AND P-3 LEFT OPEN
 *
 * P-1 carried two fields that both claim to say when a build fires and
 * that disagree deck-wide on 330 chunks — the chunk's `automatic` and
 * the build's `eventTrigger` — and recorded the firing model as UNSETTLED
 * because neither predicts slide 2 (p1-importer.md §1). Slide 8 is the
 * case that discriminates, and it comes down on `automatic`.
 *
 * Its ten builds are all 0.5s `LineDrawForLine` on the ten connection
 * lines, and its chunk list marks the first `automatic: false` and the
 * other nine `automatic: true` — i.e. one click, then a nine-step
 * cascade, 5.0 seconds end to end. The footage measures each line's own
 * corridor crossing half brightness at:
 *
 *     164.73  165.21  166.31  166.72  166.72  167.34  167.62  168.33
 *     168.74  169.24
 *
 * Ten firings, ~0.5s apart, spanning 164.7 to 169.2 — a 4.5s cascade
 * from one click, not ten clicks. And the ORDER is the chunk list's own,
 * element for element (4107941, 4108292, 4108036/4108188, 4107905,
 * 4108007, 4107870, 4108075, 4105549, 4107977), with the single
 * inversion inside the 0.2s frame interval that separates them. Nothing
 * was reordered to achieve that.
 *
 * So `automatic` is not decorative and it is not wrong: on slide 2 it
 * reads as one cascade because slide 2's chunks really are marked that
 * way and David clicked THROUGH the cascade instead of letting it run.
 * The flag says what the deck would do unattended; the footage says what
 * he did. Where he let it run — here — the two agree exactly. That is
 * reported to P-9, which owns the long-build set pieces, as the first
 * measured confirmation of the field.
 *
 * SLIDE 10 IS DELIBERATELY NOT SCORED
 *
 * It belongs to this chapter's row and carries thirty connection lines,
 * but its left cluster is driven by an `apple:action-scale` whose FACTOR
 * IS NOT IN THE RECORD — the build declares an effect, a duration and an
 * easing, and no target scale. Its value can only come from the footage
 * (fitting the cluster's ink gives 0.810), and an undeclared magnitude
 * fitted to make a frame match is exactly what the DECISIONS refused-fits
 * rule forbids; the build class is P-7's in any case. The slide is
 * emitted and its mesh recomputes correctly — measured against the
 * transformed cluster the clip rule gives 0.340 +/- 0.417 slide units,
 * the tightest reading in the chapter — but no frame of it is scored
 * here. See p4-connections.md.
 */

import { Dream, render } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { Slide } from "../../vocabulary/Slides/Slides"
import {
  slide07,
  slide08,
  slide09,
  slide14,
} from "../../vocabulary/Slides/assets/pl02/index"

/** A build's measured onset, keyed by the deck's own build id. */
interface Onset {
  build: string
  at: number
}

/**
 * Slide 7 — the campfire. 134.8-162.8s, 10 builds, 4 measured events.
 *
 * The tribe around one fire, with the tribe members and their notebooks
 * arriving in stages. Four of its ten builds are effects this chapter
 * does not implement — three `apple:fade and move character` and one
 * `com.apple.iWork.Keynote.LineDraw` (distinct from `LineDrawForLine`:
 * it draws a SHAPE's outline rather than a line's length) — and they are
 * left to the chapters that own them rather than approximated. They are
 * reported by `Slide.unsupported()` and named in the report, so the
 * segment's score is quoted knowing what is missing from it.
 *
 * The onsets are the frame-scan values from the recon's own event list
 * (136.4, 139.8, 151.2, 161.6), good to the 0.2s interval. Slide 7's
 * builds mostly drive drawables whose ink overlaps their neighbours', so
 * the per-object curve inversion P-3 uses does not have a clean mask to
 * work from here and a tighter number would be false precision.
 */
const SLIDE07: Onset[] = [
  { build: "4898956", at: 136.4 }, // the fire
  { build: "4899602", at: 139.8 }, // fade-and-move (not implemented)
  { build: "4899603", at: 139.8 }, // fade-and-move (not implemented)
  { build: "4899360", at: 151.2 },
  { build: "4899359", at: 151.2 },
  { build: "4902536", at: 161.6 }, // fade-and-move (not implemented)
  { build: "4902694", at: 161.6 }, // LineDraw (not implemented)
  { build: "4902695", at: 161.6 }, // LineDraw (not implemented)
  { build: "4902699", at: 161.6 },
  { build: "4902700", at: 161.6 },
]

/**
 * Slide 8 — five campfires, cross-linked. 162.8-171.2s, 10 builds.
 *
 * The chapter's cascade evidence (header) and its hardest geometry: ten
 * coarse-dashed (6,6) lines running between GROUPS, each bowed as a
 * quadratic through its stored middle point, each ending in an
 * arrowhead.
 *
 * THE ONSETS ARE THE CASCADE'S OWN, AND ONLY THE FIRST IS A CLICK.
 * Measured per line from its own corridor's mid-50% crossing half
 * brightness — the values in the header. They are quoted to the 0.05s
 * the crossing resolves rather than to the 0.2s frame interval, because
 * a linear interpolation between two samples of a 0.5s ramp is worth
 * that much and no more.
 *
 * THE OUTSET IS THE REASON THIS SLIDE WAS HARD, AND IT IS NOW READ.
 * Its ten connections declare `outsetFrom`/`outsetTo` of 30.0 — a
 * further stand-off beyond the silhouette clip. P-1's note had recorded
 * the field as "both 0.0 throughout this deck", and on that authority
 * this renderer first drew slide 8's lines thirty units long at each
 * end while six candidate boundary rules were tested against the drawn
 * extents and none gave a constant residual (best sd 11.3 slide units).
 * The residual was not a missing rule; it was a missing field. P-1 has
 * since carried it — 164 of the 467 in-scope lines are non-zero, and
 * they cluster on exactly the densest meshes — and `composeConnection`
 * reads it.
 */
const SLIDE08: Onset[] = [
  { build: "4108627", at: 164.73 }, // the click
  { build: "4108628", at: 165.21 }, // …and the nine-step cascade
  { build: "4108629", at: 166.72 },
  { build: "4108630", at: 166.31 },
  { build: "4108631", at: 166.72 },
  { build: "4108632", at: 167.34 },
  { build: "4108633", at: 167.62 },
  { build: "4108634", at: 168.33 },
  { build: "4108635", at: 168.74 },
  { build: "4108636", at: 169.24 },
]

/**
 * Slide 9 — the Social Organism. 171.2-193.8s, 18 builds, 6 events.
 *
 * THE CHAPTER'S GATE. Six `Head with Shoulders_826` icons at the corners
 * of a hexagon, joined by all fifteen lines of a complete K6, inside a
 * red ring, over the Logo and the words "Social Organism". Every one of
 * the fifteen is a 2.0s `LineDrawForLine`, and all fifteen chunks are
 * `automatic: true` — one click, one cascade, which at 5 fps reads as a
 * single 1.6s event and is why the recon counted six events for eighteen
 * builds.
 *
 * It is the gate because the six icons are IDENTICAL and their positions
 * are symmetric, so the fifteen clips are fifteen independent samples of
 * one rule with no confounds. That is what made the silhouette clip
 * measurable to -0.14 +/- 1.45 slide units and the dash period to
 * 15.003 +/- 0.009 against a prediction of 15.005 (Connections.ts).
 *
 * THE ONSETS, by P-3's method — invert the deck's own declared curve
 * through the object's own ink-mask ramp, solving only for the offset:
 *
 *     the fifteen lines   172.08   (two independent fits, sd 0.031/0.015)
 *     the red ring        174.79   (sd 0.009)
 *     the Logo            184.32   (sd 0.032)
 *     "Social Organism"   186.25   (sd 0.019)
 *
 * Every one of those standard deviations is an order of magnitude inside
 * the 0.2s frame interval, which is what a declared duration inverted
 * through a real ramp looks like when the duration is right.
 */
const SLIDE09: Onset[] = [
  // The fifteen-line cascade, one click at 172.08.
  { build: "5095178", at: 172.08 },
  { build: "5095181", at: 172.08 },
  { build: "5095182", at: 172.08 },
  { build: "5095190", at: 172.08 },
  { build: "5095192", at: 172.08 },
  { build: "5095196", at: 172.08 },
  { build: "5095197", at: 172.08 },
  { build: "5095199", at: 172.08 },
  { build: "5095200", at: 172.08 },
  { build: "5137042", at: 172.08 },
  { build: "5137121", at: 172.08 },
  { build: "5137197", at: 172.08 },
  { build: "5137269", at: 172.08 },
  { build: "5137353", at: 172.08 },
  { build: "5137422", at: 172.08 },
  { build: "5114880", at: 174.79 }, // the red ring
  { build: "5160213", at: 184.32 }, // the Logo
  { build: "5147682", at: 186.25 }, // "Social Organism"
]

/**
 * Slide 14 — two organisms, out of reach. 219.4-227.0s, ZERO builds.
 *
 * Thirty connection lines and not one animation: a held tableau, cut to
 * from a 1.5s FadeThruColor and held for 7.6 seconds. That makes it the
 * purest possible test of the recompute rule, because nothing about the
 * frame depends on timing — every pixel of it is geometry, and the two
 * fifteen-line meshes either land or they do not.
 */
const SLIDE14: Onset[] = []

/** The pages, with the video seconds each is cut in and out at. */
const PAGES = [
  { data: slide07, onsets: SLIDE07, from: 134.8, to: 161.8 },
  { data: slide08, onsets: SLIDE08, from: 163.8, to: 170.4 },
  { data: slide09, onsets: SLIDE09, from: 171.2, to: 191.8 },
  { data: slide14, onsets: SLIDE14, from: 220.4, to: 227.0 },
] as const

/** Reference frames, one per segment, each AFTER that segment's last event. */
export const SCORED = [
  { frame: 809, seg: 7, at: 161.6 }, // held before the last build fires
  { frame: 851, seg: 8, at: 170.0 }, // last event 169.7
  { frame: 950, seg: 9, at: 189.8 }, // last event 187.3
  { frame: 1128, seg: 14, at: 225.4 }, // no events at all
] as const

export class Mesh01Dream extends Dream {
  pages = PAGES.map((p) => new Slide({ data: p.data }))

  /** The scene cursor in VIDEO seconds. */
  #now = 0

  /**
   * Play an Anim at an ABSOLUTE video second — P-3's fix, and it matters
   * more here, not less. Slide 8's ten builds overlap by construction:
   * each is 0.5s and they fire 0.5s apart, so a forward-only cursor
   * would happen to look right on that slide and be silently wrong on
   * slide 9, where fifteen 2.0s builds all start at the same instant and
   * a cursor would serialize them into thirty seconds.
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

    for (const page of this.pages) {
      this.setAt(0, page.creation.to(1), page.visible(false), page.preBuild())
    }

    for (let i = 0; i < PAGES.length; i++) {
      const spec = PAGES[i]!
      const page = this.pages[i]!

      this.setAt(spec.from, page.cutIn())
      if (i > 0) this.setAt(spec.from, this.pages[i - 1]!.visible(false))

      // Builds sharing an onset fired on ONE click (or one step of one
      // cascade) and must run in parallel. Slide 9's fifteen lines are
      // the extreme case: played in sequence they would take thirty
      // seconds where the footage settles in under two.
      const clicks = new Map<number, (typeof spec.onsets)[number][]>()
      for (const onset of spec.onsets) {
        const group = clicks.get(onset.at)
        if (group) group.push(onset)
        else clicks.set(onset.at, [onset])
      }

      for (const [at, group] of [...clicks].sort((a, b) => a[0] - b[0])) {
        const anims: Anim[] = []
        let span = 1
        for (const onset of group) {
          const record = spec.data.builds.find((b) => b.id === onset.build)
          if (!record) continue
          const chunk = spec.data.buildChunks?.find((c) => c.build === onset.build)
          // The DURATION is the deck's; the ONSET is the footage's.
          span = chunk?.duration ?? record.duration ?? 1
          anims.push(page.build(record))
        }
        if (anims.length === 0) continue
        this.playAt(together(...anims), at, span)
      }
    }

    // The last page holds to the end of its segment; `wait` moves the
    // cursor but adds no clip, so the timeline needs a parked one.
    const last = this.play({ tracks: [] }, 0)
    last.start = 227.0
    this.#now = Math.max(this.#now, 227.0)
  }
}

if (import.meta.main) render(Mesh01Dream)
