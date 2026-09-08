/**
 * Chain01.ts — A DreamWeaving
 *
 * "Project Liminality" (2023), the labelled chains: deck slides 15, 22,
 * 23, 24, 25, 29 and 30 — video segments 15, 21, 22, 23, 24, 28 and 29.
 * Symbol becomes Symbol-System becomes Tele-Communication; Logos divides
 * into MonoLogos, DiaLogos and InterLogos; and two campfires at Location
 * A and Location B are joined across a Distance.
 *
 * Chapter P-5. It was briefed as the DIMMED-PALETTE chapter, on the
 * recon report's §5 line "Dimmed-state colour #A9A9A9 — needed by slides
 * 15, 29, others; the greying-out of an earlier chain element is a
 * ChangeColor to #A9A9A9, which should join the vocabulary's named
 * colours."
 *
 * THAT PREMISE IS REFUTED, AND THE REFUTATION IS THE CHAPTER'S FIRST
 * RESULT — see p5-chains.md §1. Counting every colour on every drawable
 * of all 58 in-scope slides gives exactly four:
 *
 *     #FFFFFF 1655   #000000 413   #00A2FF 109   #FF644E 77
 *
 * #A9A9A9 appears zero times, no drawable carries a non-palette colour,
 * and the opacity histogram over all 1841 drawables has a single bin at
 * 1.0. There is also no `ChangeColor` build in the deck: every one of
 * this chapter's 18 builds is `apple:dissolve` or `apple:dissolve
 * character`, which P-3 already implements as one uniform opacity ramp.
 *
 * So no dimming verb is built here. What the recon saw as a grey label
 * is a MID-DISSOLVE FRAME: on deck slide 29 the word "Distance" fires
 * about four seconds after "Location A"/"Location B", and a frame
 * sampled in between catches it part-way up its declared 1.0s ramp. A
 * stroke-core scan of all seven settled frames in this chapter (local
 * maxima only, so antialiased edges are excluded) puts 0.996, 0.998,
 * 1.000, 1.000, 0.812, 1.000 and 0.952 of cores at luma >= 230; the only
 * sub-230 cores anywhere are the blue #00A2FF (luma ~124) and the red on
 * the InterLogos slides. There is no grey plateau in the video.
 *
 * The chapter is therefore what its row's second clause always said:
 * THE LABELLED-CHAIN LAYOUT, text-heavy and geometry-light, and the
 * seven segments are scored as such.
 *
 * WHAT THIS CHAPTER DOES SETTLE: THE FIRING MODEL
 *
 * P-1 left it open and P-4 confirmed one half of it. Two fields claim to
 * say when a build fires — the chunk's `automatic` and the build's
 * `eventTrigger` — and they disagree on 330 chunks deck-wide. P-4 found
 * slide 8's ten builds cascading from one click, fitting `automatic`;
 * P-3 found slide 2's thirteen builds firing as seven separate events
 * and read that as fitting `eventTrigger` instead.
 *
 * DECK SLIDE 15 IS THE DISCRIMINATING CASE, because it is the only slide
 * in either chapter's reach that carries BOTH flag values — five chunks
 * `automatic: false` and four `automatic: true`, all nine builds
 * `eventTrigger: 1`. Its nine onsets, each obtained by inverting the
 * deck's own declared 1.0s smoothstep through that target's own ink-mask
 * ramp (P-3's method, solving only for the offset):
 *
 *     #  build      automatic   onset      gap
 *     1  5286898    false      226.310
 *     2  5161707    false      228.781    +2.471
 *     3  5291410    TRUE       229.776    +0.995
 *     4  5286946    TRUE       230.766    +0.990
 *     5  5068320    false      234.838    +4.072
 *     6  5161127    false      245.717   +10.879
 *     7  5161126    TRUE       246.709    +0.992
 *     8  5287000    TRUE       247.717    +1.008
 *     9  5071095    false      256.490    +8.773
 *
 * The structure is unmistakable and it reconciles the two chapters. A
 * chunk marked `automatic: true` fires exactly ONE DECLARED DURATION
 * after its predecessor (0.995, 0.990, 0.992, 1.008 against a declared
 * 1.0); a chunk marked `automatic: false` waits for a click (2.47, 4.07,
 * 10.88, 8.77 — human intervals, and no two alike). Pooling this slide
 * with P-4's slide 8 and P-3's slide 2 gives 20 automatic gaps averaging
 * 1.001x the declared duration and 4 manual gaps spanning 2.47-10.88s,
 * with no overlap between the groups.
 *
 * SO SLIDE 2 WAS NEVER A COUNTER-CASE. Its seven measured events are
 * seven steps of a cascade running at ~1.0s intervals — 1.028, 0.992,
 * 1.013, 1.367, 0.638, 0.962, 1.020 against a declared 1.0s — which is
 * what `automatic: true` predicts, not what refutes it. What made it
 * look like a refutation is that the flag was read as "fires with the
 * previous build", i.e. simultaneously; it means "fires without waiting
 * for a click", which on a 1.0s build is one second later. The chunk
 * order is the firing order on all three slides, element for element.
 *
 * `eventTrigger` is 1 on every build of all three slides and so
 * distinguishes nothing among them; it cannot be the field that carries
 * this. See p5-chains.md §3 for the one partial exception (deck 25) and
 * for what is and is not claimed.
 *
 * THE SCENE RUNS ON VIDEO SECONDS, as Arc01 and Mesh01 do — every number
 * below reads directly against refs/pitch/pl02/frames5 (frame N is video
 * second (N-1)/5).
 *
 * THE MAGIC MOVES ARE HELD, as P-3 holds them. Five of this chapter's
 * seven transitions in are `BLTFadeThruColor` and two are
 * `magic-move-implied-motion-path`; all are rendered as CUTS and no
 * frame inside one is scored. Magic Move is P-6's whole subject.
 */

import { Dream, render } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { Slide } from "../../vocabulary/Slides/Slides"
import {
  slide15,
  slide22,
  slide23,
  slide24,
  slide25,
  slide29,
  slide30,
} from "../../vocabulary/Slides/assets/pl02/index"

/** A build's measured onset, keyed by the deck's own build id. */
interface Onset {
  build: string
  at: number
}

/**
 * Deck slide 15 — Symbol, Symbol-System, Tele-Communication.
 * Video 227.0-263.0s (segment 15), 9 builds, 36 seconds.
 *
 * THE CHAPTER'S GATE, and the slide that settles the firing model
 * (header). The chain is built left to right over thirty seconds: the
 * word "Symbol" over the Logo, then the first arrow and the book, then
 * "Symbol-System", then "non-contextual" beneath the arrow; a long pause
 * under narration; then the second arrow, the radio tower,
 * "Tele-Communication", and finally "non-local".
 *
 * Nine builds and nine distinct onsets — no two coincide, which is what
 * makes the slide able to discriminate the two firing fields at all. All
 * nine are 1.0s, all `In`, and the four that follow an `automatic: true`
 * chunk land one declared duration after their predecessor to within
 * 0.010s.
 *
 * The onsets are fitted, not scanned. A frame-differenced motion scan of
 * this segment finds only TWO events (near 230.2 and 247.2), because
 * seven of the nine ramps move too little ink to clear its threshold —
 * P-3's "a motion scan finds where something changed, not what changed",
 * in its starkest form yet. Each value below is the mean of 3-4
 * independent per-sample inversions of the declared curve through that
 * target's own mask, and every standard deviation is <= 0.030s against
 * the reference's 0.2s frame interval.
 */
const SLIDE15: Onset[] = [
  { build: "5286898", at: 226.310 }, // "Symbol"                      sd 0.030
  { build: "5161707", at: 228.781 }, // the first arrow               sd 0.023
  { build: "5291410", at: 229.776 }, // the book       (automatic)    sd 0.016
  { build: "5286946", at: 230.766 }, // "Symbol-System" (automatic)   sd 0.020
  { build: "5068320", at: 234.838 }, // "non-contextual"              sd 0.024
  { build: "5161127", at: 245.717 }, // the second arrow              sd 0.028
  { build: "5161126", at: 246.709 }, // the tower       (automatic)   sd 0.024
  { build: "5287000", at: 247.717 }, // "Tele-Communication" (auto)   sd 0.016
  { build: "5071095", at: 256.490 }, // "non-local"                   sd 0.025
]

/**
 * Deck slide 22 — MonoLogos. Video 428.2-445.8s (segment 21), 1 build.
 *
 * The Logo on the left, an arrow, and a cluster of five media icons on
 * the right: a book, a game controller, a radio tower, a video player
 * and a music note. One `apple:dissolve` brings the cluster on, five
 * seconds after the FadeThruColor settles.
 *
 * Its single chunk is `automatic: false` — a click — which is what a
 * lone build after a five-second gap should be and is consistent with
 * the rule without being evidence for it.
 */
const SLIDE22: Onset[] = [
  { build: "4685729", at: 433.191 }, // the five media icons          sd 0.029
]

/**
 * Deck slide 23 — DiaLogos, the first tableau. 445.8-452.0s (segment 22).
 *
 * ZERO BUILDS: two heads facing one another across a fire inside an
 * ellipse, under the word "DiaLogos". A held tableau for 6.2 seconds,
 * cut to and cut away from. The purest still-frame test in the chapter,
 * since nothing about it can be mistimed.
 */
const SLIDE23: Onset[] = []

/**
 * Deck slide 24 — DiaLogos, the second tableau. 452.0-490.6 (segment 23).
 *
 * ZERO BUILDS again, and the longest hold in the chapter at 38.6
 * seconds: the same two heads, now with the Logo drawn between them —
 * one blue circle, one red circle, the Λ in white. The composition is
 * black-filled shapes over white strokes, which makes it the chapter's
 * test of fill ordering rather than of any animation.
 */
const SLIDE24: Onset[] = []

/**
 * Deck slide 25 — InterLogos. 490.6-503.6s (segment 24), 4 builds.
 *
 * A five-node mesh on the left, an arrow, and the Logo on the right in
 * full palette — blue outer circle, red inner circle, white Λ. Three
 * `In` builds fire together at 490.11 as the FadeThruColor settles, and
 * one `Out` at 493.62 takes away the "?" that the first of them brought.
 *
 * THIS SLIDE IS THE FIRING RULE'S ONE PARTIAL EXCEPTION, and it is
 * recorded rather than smoothed over. Its chunk list runs (1) the "?"
 * `false`, (2) the arrow `true`, (3) the "?" Out `false`, (4) the Logo
 * `true` — so the rule predicts chunk 4 fires one second after chunk 3,
 * at ~494.6. It is measured at 490.109, simultaneous with chunk 1: the
 * measured order is 1, 4, 2, 3 where the chunk order is 1, 2, 3, 4.
 *
 * What survives on this slide is the weaker claim, and it is still not
 * nothing: chunks 1 and 2 are 0.007s apart where the rule predicts 1.0s,
 * so the exception is not a single stray build. What does NOT survive
 * here is chunk order as firing order, which held element-for-element on
 * decks 2, 8, 15 and 29. Four builds inside 3.5 seconds is also the
 * least resolvable arrangement in the chapter at 5 fps, so this is
 * reported as an exception to be re-examined on a slide with more room
 * rather than as a refutation of a rule that 24 gaps support.
 *
 * The onsets are the measurement, and they are what this scene plays.
 */
const SLIDE25: Onset[] = [
  { build: "4707179", at: 490.108 }, // "?"                      In   sd 0.023
  { build: "4709394", at: 490.115 }, // the arrow                In   sd 0.024
  { build: "4706910", at: 490.109 }, // the Logo                 In   sd 0.022
  { build: "4707194", at: 493.624 }, // "?" away                Out   sd 0.019
]

/**
 * Deck slide 29 — Location A, Distance, Location B. 526.6-539.6s
 * (segment 28), 3 builds.
 *
 * THE SLIDE THE CHAPTER WAS NAMED FOR, and the one whose "dimmed" label
 * turned out to be a mid-dissolve frame (header). Two campfire ellipses
 * joined by a long dashed arrow through a small Logo at the midpoint,
 * with three labels arriving in turn.
 *
 * All three chunks are `automatic: false`, and the measured gaps are
 * 2.09 and 2.38 seconds — clicks, not cascade steps, exactly as the flag
 * says. That is the chapter's third independent slide agreeing with the
 * rule, and its second showing the manual branch.
 *
 * The masks here are small (47-56 px each) because the labels are 30-pt
 * text and the ramp had to be measured on ink the build itself brings —
 * pixels lit at 537 and dark at 530 — rather than on the whole box,
 * which the campfires' own ink dominates. The three fits are still tight
 * (sd 0.070, 0.027, 0.019).
 */
const SLIDE29: Onset[] = [
  { build: "5358100", at: 531.401 }, // "Location A"                  sd 0.070
  { build: "5358098", at: 533.495 }, // "Location B"                  sd 0.027
  { build: "5358099", at: 535.870 }, // "Distance" — the "grey" one   sd 0.019
]

/**
 * Deck slide 30 — the chain returns. 539.6-546.2s (segment 29), 1 build.
 *
 * Deck slide 15's finished tableau, re-entered after 280 seconds and
 * with one thing added: a red rectangle drawn around "non-local". The
 * single `apple:dissolve character` build is that box, and it is the
 * whole difference between this segment and segment 15's last frame —
 * which makes the pair a useful check that the chapter's geometry is
 * stable across a re-entry rather than tuned per segment.
 */
const SLIDE30: Onset[] = [
  { build: "5357519", at: 542.259 }, // the red box on "non-local"    sd 0.006
]

/**
 * The seven pages, with the window each is held for.
 *
 * `from` is the first settled video second after the incoming
 * transition; `to` is the last before the outgoing one. Two boundaries
 * are corrected against the recon's segment table, both measured from
 * frames5 at a threshold that catches the subtle transitions:
 *
 *   - SEGMENT 15 settles at 225.2, not 227.0. The table's 227.0 is 1.8s
 *     inside the held tableau, and its first build has already fired by
 *     226.3 — so the table's own start time postdates an event it also
 *     lists. The outgoing transition begins at 262.2, not 263.0.
 *   - SEGMENT 28 settles at 527.6 and its outgoing transition begins at
 *     538.8, against the table's 526.6-539.6.
 *
 * These join P-4's corrections to segments 7 and 14. The pattern is the
 * same each time: the Viterbi tiling has to assign every frame to some
 * slide, so a boundary lands mid-transition rather than at the settle.
 */
const PAGES = [
  { data: slide15, onsets: SLIDE15, from: 225.2, to: 262.2 },
  { data: slide22, onsets: SLIDE22, from: 429.8, to: 445.2 },
  { data: slide23, onsets: SLIDE23, from: 446.6, to: 450.4 },
  { data: slide24, onsets: SLIDE24, from: 452.6, to: 490.4 },
  { data: slide25, onsets: SLIDE25, from: 490.6, to: 503.0 },
  { data: slide29, onsets: SLIDE29, from: 527.6, to: 538.8 },
  { data: slide30, onsets: SLIDE30, from: 540.8, to: 545.4 },
] as const

/**
 * Reference frames, one per segment, each AFTER that segment's last
 * event and before its outgoing transition.
 *
 * Segment 24's frame is late in its window on purpose: its `Out` build
 * finishes at 494.6, and the settled tableau it leaves behind is what
 * the segment actually holds for its remaining eight seconds.
 */
export const SCORED = [
  { frame: 1301, seg: 15, at: 260.0 }, // last event 257.5
  { frame: 2216, seg: 21, at: 443.0 }, // last event 434.2
  { frame: 2246, seg: 22, at: 449.0 }, // no events at all
  { frame: 2351, seg: 23, at: 470.0 }, // no events at all
  { frame: 2496, seg: 24, at: 499.0 }, // last event 494.6
  { frame: 2686, seg: 28, at: 537.0 }, // last event 536.9
  { frame: 2721, seg: 29, at: 544.0 }, // last event 543.3
] as const

export class Chain01Dream extends Dream {
  /** One holon per deck slide, staged together and cut between. */
  pages = PAGES.map((p) => new Slide({ data: p.data }))

  /** The scene cursor in VIDEO seconds. */
  #now = 0

  /**
   * Play an Anim at an ABSOLUTE video second — P-3's fix, inherited.
   *
   * It is load-bearing on deck slide 25, whose three `In` builds all
   * start at 490.11 and would be serialized into three seconds by a
   * forward-only cursor, and on deck slide 15, where builds 3 and 4 fire
   * 0.99s apart with 1.0s durations and so overlap by 0.01s — enough
   * that a cursor would push build 4 late and every later build with it.
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

    // Every page composes finished, then is hidden and pushed back to
    // its pre-build state. Without `preBuild` a page shows a label
    // before the click that brings it — P-2's slide-32 over-draw.
    for (const page of this.pages) {
      this.setAt(0, page.creation.to(1), page.visible(false), page.preBuild())
    }

    for (let i = 0; i < PAGES.length; i++) {
      const spec = PAGES[i]!
      const page = this.pages[i]!

      this.setAt(spec.from, page.cutIn())
      if (i > 0) this.setAt(spec.from, this.pages[i - 1]!.visible(false))

      // Builds sharing an onset fired together and must run in parallel.
      // Deck 25's three `In` builds are the case here.
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
    last.start = 546.2
    this.#now = Math.max(this.#now, 546.2)
  }
}

if (import.meta.main) render(Chain01Dream)
