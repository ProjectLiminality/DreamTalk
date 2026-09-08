/**
 * Fractal01.ts — A DreamWeaving
 *
 * "Project Liminality" (2023), the fractal and the beacon: deck slides
 * 43, 44 and 54-58, video seconds 639.4-861.0. A self-similar cone tree
 * three levels deep, the local/non-local pairing that follows it, and
 * the Coherence Beacon family that closes the pitch — a broadcast tower
 * over a ring of heads, then three tribes with a figure walking between
 * them.
 *
 * Chapter P-8's gate. The row named it "recursive/fractal layout at
 * scale, no new verbs — a composition and performance test", and the
 * data says otherwise on both halves of that. What the slides actually
 * needed is below; what they did NOT need is recorded too, because a
 * hypothesis that dissolves on measurement is worth as much as one that
 * holds (P-5's dimmed palette set that precedent).
 *
 * WHAT THE ROW EXPECTED, AND WHAT THE CENSUS SAYS
 *
 * "Deep group nesting at scale" — REFUTED, and already exercised. Deck
 * 43 nests three levels, which is the deepest in the deck; the only
 * other slide that does is deck 48, which P-7 scored at 1.0000/0.9948.
 * So the depth this chapter was to prove had already been proven, and
 * the flattening in `keydecode.py`'s `walk` needed nothing.
 *
 * "Repeated-structure instancing" — NOT NEEDED. The recursion is drawn
 * out by hand in the deck (the recon said so and it is true): 103
 * shapes, each with its own stored path, and the importer emits them as
 * 122 KB of polylines that render at full rate. There is no structure
 * to instance because the deck instanced nothing.
 *
 * WHAT THEY ACTUALLY NEEDED — THE EASING IS WRONG, DECK-WIDE
 *
 * Keynote's `kEaseBoth` is not the framework's `smooth`. Both are the
 * same cubic-Bezier family with flat value tangents; they differ in the
 * tangent length, s = 0.42 against pydeation's 0.25, and 0.42 is CSS
 * `ease-in-out` — a named standard rather than a fitted number, which
 * is what makes it admissible. Measured four times on two unrelated
 * build classes (`Builds.KEYNOTE_EASE_S` carries the table). Deck 56's
 * 3.0s curved travel is what made it visible: at s = 0.25 it fits the
 * footage at 8.90 px rms, at s = 0.42 at 1.29.
 *
 * That is a correction to every chapter, not to this one's slides, and
 * it surfaced here only because this row happens to hold the deck's one
 * long action build.
 *
 * DECK 56 IS THE CURVED MOTION PATH P-7 IMPLEMENTED AND COULD NOT SCORE
 *
 * P-7 wrote `curvedMotionAnim` against the data, tested it
 * synthetically, and said plainly that the footage never exercised it
 * ("when a chapter reaches slide 56, it is waiting and has never been
 * scored against a frame. Score it there."). This is there. Build
 * 5602009 drives a `Man_83` figure along two cubic segments over 3.0s,
 * travelling (-284.409, -170.965) slide units — a person walking from
 * the right tribe up into the centre one — and it is the only in-scope
 * curve in the deck.
 *
 * It also carries an `apple:action-scale` on the SAME target over the
 * same window, and that is the one measurable instance of a build class
 * two chapters have had to decline. See `Builds.ACTION_SCALE_D56`: the
 * record declares no factor, so the factor is MEASURED from the
 * footage, which is the admissible route for a quantity that exists
 * only there. The figure shrinks to 0.8, and the predicted arrival box
 * lands within a pixel of the measured one on three of four edges.
 *
 * THE FIRING MODEL, CONFIRMED ON A SIXTH SLIDE AND MORE SHARPLY
 *
 * Deck 43's six ring dissolves are the cleanest instance of P-5's rule
 * in the video: one manual chunk, then an automatic chain, with every
 * target isolable because the rings sit in separate corners of the
 * canvas. Fitting each against its own exclusive ink mask —
 *
 *     chunk 0  651.105  manual
 *     chunk 1  652.115  automatic   gap 1.010
 *     chunk 2  654.390  MANUAL      gap 2.275
 *     chunk 3  655.395  automatic   gap 1.005
 *     chunk 4  656.395  automatic   gap 1.000
 *     chunk 5  657.380  automatic   gap 0.985
 *
 * Four automatic gaps at mean 1.000x the declared 1.0s duration, range
 * 0.985-1.010, against one manual gap at 2.275x. No overlap, on one
 * slide, with no pooling.
 *
 * ONE APPARENT EXCEPTION, MEASURED AND KEPT
 *
 * Deck 43's chunk 8 (automatic, predecessor duration 2.0) fires 0.060s
 * after chunk 7 rather than 2.0s after it — the "travel by zooming in"
 * label arrives WITH the arrow it labels rather than after it. Both
 * onsets are solid (the arrow fits its 2.0s draw at 0.0076 rms, the
 * label its 2.0s ramp at 0.0231), so this is not a measurement artefact.
 * It is reported rather than resolved: it is a different shape from the
 * two exceptions on record (P-5's deck 25 and P-7's deck 53 are ORDER
 * exceptions; this is a chunk firing simultaneously with its
 * predecessor rather than out of turn), and one instance does not name
 * a rule. The scene uses the measured onsets.
 *
 * A CORRECTION TO THE SEGMENT TABLE, AND IT IS THE LARGEST SO FAR
 *
 * The recon puts deck 54 at 793.4-816.0 and deck 55 at 816.0-827.8. The
 * footage puts the boundary sixteen seconds earlier, in a Magic Move
 * spanning ~797.6-799.8, and two independent lines say so:
 *
 *   - Deck 55's three mini-towers (5491060, 5491203, 5491270, declared
 *     on deck 55 and nowhere else) ink from 812.35.
 *   - Four of the seven tablets vanish at 803.86, and the four are
 *     exactly deck 55's four `fade and move` Out targets; the three that
 *     remain are the three deck-55 tablets carrying no fade-out.
 *
 * The cause is the Viterbi's ordinary failure mode on a near-identical
 * pair: deck 55 IS deck 54 plus three mini-towers and a title, so the
 * thumbnails correlate almost equally against every frame in the
 * stretch. This joins P-4's corrections to segments 7 and 14 and P-5's
 * to 15 and 28.
 *
 * A TRAP I FELL INTO ON THE WAY TO THAT, RECORDED BECAUSE IT COST AN
 * HOUR AND A WRONG FACT REQUEST
 *
 * Deck 54 declares all seven tablets stacked at ONE point on the tower
 * (px x[388,398] y[239,250]) while the footage shows seven spread over
 * the heads, and I wrote that up as an importer bug and sent it to the
 * lead. It is not one. At f_03993 (798.4) the seven ARE clustered at
 * the tower exactly as declared; at f_03996 (799.0) they are caught
 * mid-flight. The outgoing Magic Move carries them, which is the
 * matched-object interpolation doing its job. I had sampled two settled
 * frames and never looked between them — P-7's own recorded lesson,
 * that a scan finds where something changed and not what, with the
 * corollary that two settled frames do not show what happened between
 * them either. The request was withdrawn.
 *
 * THE TRANSITIONS ARE CUTS, AS IN P-3 AND P-7
 *
 * Every transition across this run is a 2.0s Magic Move (deck 57's is
 * 1.0s). Magic Move is P-6's subject and its mid-glide frames are still
 * short of the bar there (p6-handoff), so standing one in here would
 * score frames that look right for the wrong reason. Each is a cut, and
 * no frame inside a transition window is scored — which also means the
 * tablet flight described above is NOT reproduced, and deck 55's scored
 * frame sits after it.
 */

import { Dream, render } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { ACTION_SCALE_D56 } from "../../vocabulary/Slides/Builds"
import { Slide } from "../../vocabulary/Slides/Slides"
import {
  slide43,
  slide44,
  slide54,
  slide55,
  slide56,
  slide57,
  slide58,
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
 * Deck 43 — Liminal Space, the fractal cone tree. 639.4-675.4s.
 *
 * 103 shapes, 31 groups, three levels of nesting, 60 black-filled
 * ellipses: the chapter's centrepiece and the deck's densest slide
 * outside P-10's row. A ring of icons at the apex, two rings of heads
 * below it, four at the base, all strung on cone lines that the filled
 * ellipses cut where they pass behind.
 *
 * The six ring dissolves (chunks 0-5) are the firing model's cleanest
 * confirmation in the video — see the module header. Each was fitted
 * against an EXCLUSIVE ink mask: the six group boxes overlap, and
 * scoring one against its own box alone gives 0.19-0.33 rms where
 * stripping the shared pixels gives 0.023-0.057. The onsets move by up
 * to 0.18s between the two, which is most of a frame.
 */
const DECK43: Onset[] = [
  { build: "5587587", at: 651.105 }, // upper-left ring   rms 0.0400
  { build: "5587588", at: 652.115 }, // upper-right ring  rms 0.0565
  { build: "5587592", at: 654.39 }, // base ring 1        rms 0.0262
  { build: "5587593", at: 655.395 }, // base ring 2       rms 0.0229
  { build: "5587595", at: 656.395 }, // base ring 3       rms 0.0251
  { build: "5587594", at: 657.38 }, // base ring 4        rms 0.0474
  { build: "5532411", at: 660.22 }, // "holographically…" rms 0.0179
  { build: "5591959", at: 663.795 }, // the big arrow     rms 0.0076
  { build: "5529866", at: 663.855 }, // "travel by zooming in" — see header
  { build: "5529738", at: 668.28 }, // "Liminal Space"    rms 0.0092
]

/**
 * Deck 44 — Liminal Space / Physical Space. 675.4-690.6s.
 *
 * Two labelled columns, four builds, and TWO of them are
 * `apple:fade and move character` — a fade combined with a translation
 * whose distance the record does not carry. Same gap as deck 53's
 * `fade and move` (P-7) and deck 10's `action-scale` (P-4), and the same
 * answer under the refused-fits rule: `Slide.unsupported()` reports
 * them, their targets are lit by `cutIn`, and the segment is scored with
 * that stated.
 *
 * The two `dissolve character` builds ARE scored, and both fit cleanly
 * (0.0064 and 0.0185 rms). Their onsets are 3.43s apart, two separate
 * clicks, which matches their `automatic: false` flags.
 */
const DECK44: Onset[] = [
  { build: "5390886", at: 679.395 }, // "local"      rms 0.0064
  { build: "5391017", at: 682.82 }, // "non-local"   rms 0.0185
]

/**
 * Deck 54 — the Coherence Beacon arrives. 793.4-797.6s.
 *
 * SHORTER THAN THE RECON SAYS — see the module header. The segment ends
 * in the Magic Move that carries the tablets out, ~797.6, not at 816.0.
 *
 * Nine chunks, every one `automatic: true`. The tower, the beacon group
 * and the seven tablets all ramp together at ~794.8 (measured on the
 * tablet cluster at its own tower position, 794.4-795.8), and the
 * "Coherence Beacon" label follows at 796.82. That is one click and then
 * one automatic follow-on, in chunk order, with no exception.
 */
const DECK54: Onset[] = [
  { build: "5482590", at: 794.74 }, // the radio tower      rms 0.0528
  { build: "5482594", at: 794.795 }, // the beacon group
  { build: "5451246", at: 794.8 }, // the seven tablets, one click
  { build: "5451292", at: 794.8 },
  { build: "5451338", at: 794.8 },
  { build: "5451384", at: 794.8 },
  { build: "5451440", at: 794.8 },
  { build: "5451500", at: 794.8 },
  { build: "5491508", at: 796.82 }, // "Coherence Beacon"   rms 0.0141
]

/**
 * Deck 55 — Social Resonance Filter. 799.8-827.8s.
 *
 * STARTS SIXTEEN SECONDS EARLIER THAN THE RECON SAYS — the header has
 * the two independent proofs.
 *
 * Its four `fade and move` Out builds are the only place in the deck
 * where that effect's TARGETS are unambiguous, because all four vanish
 * at once and the three that stay are exactly the three with no
 * fade-out. The distance is still undeclared, so the effect is not
 * implemented; what IS scoreable is that the four leave, and they do so
 * together at 803.86 (rms 0.055-0.062, four independent fits).
 *
 * Rather than skip them and hold ink the reference has dropped, the four
 * targets are faded out on the measured onset through the ordinary
 * dissolve path. That reproduces the disappearance without claiming the
 * motion: a `fade and move` whose move is unknown is at least a fade,
 * and stating only the half the record supports is the honest half.
 */
const DECK55: Onset[] = [
  { build: "5491315", at: 812.35 }, // mini-tower 1   rms 0.0096
  { build: "5491316", at: 812.345 }, // mini-tower 2  rms 0.0102
  { build: "5491317", at: 812.35 }, // mini-tower 3   rms 0.0109
  { build: "5491428", at: 815.45 }, // "Social Resonance Filter" rms 0.0113
]

/**
 * Deck 56 — three tribes, and the figure that walks between them.
 * 827.8-846.8s.
 *
 * THE CHAPTER'S OWN SUBJECT, and P-7's unexercised code finally scored.
 *
 * Build 5602009 is the deck's one in-scope curved `action-motion-path`:
 * 3.0s, two cubic segments, (-284.409, -170.965) slide units, bowing 27
 * slide units off its own chord. Build 5602023 is an
 * `apple:action-scale` on the SAME target over the same window.
 *
 * Fitted against the deck's declared path and duration with only the
 * onset free, and with the traveller isolated by connected-component
 * tracking (the static crowd figures around it defeated two simpler
 * masks first), it lands at 830.43 with 1.29 px rms over thirteen
 * samples — on Keynote's ease. On the framework's `smooth` the same fit
 * is 8.90 px, and on a linear ramp 19.75 px. That spread is what
 * identified the ease, and it is the reason this chapter has a header
 * section about easing at all.
 *
 * The two `dissolve` builds are the rest of the migration, and they fire
 * WELL AFTER the travel rather than with the transition — a first pass
 * assumed the latter and left 19% of the reference's ink undrawn, which
 * the composite showed as four walkers and four standing figures in
 * pure red. Measured on their own targets' masks: 5552239 (four
 * `Man Walking_681` on the two arrows) at 837.110, and 5551188 (four
 * `Man_83` inside the centre cone) at 839.685. So the slide's argument
 * runs in three beats — one figure walks, then a crowd follows, then
 * they are standing in the new tribe — and only the first is an action
 * build.
 */
const DECK56: Onset[] = [
  { build: "5602009", at: 830.43 }, // the figure walks   rms 1.29 px
  { build: "5602023", at: 830.43 }, // and shrinks to 0.8, same window
  { build: "5552239", at: 837.11 }, // the crowd on the arrows rms 0.0208
  { build: "5551188", at: 839.685 }, // arrived, in the cone   rms 0.0496
]

/**
 * Deck 57 — Memetic Nomads. 846.8-851.0s.
 *
 * One build, and it arrives WITH the incoming transition rather than on
 * a click inside the hold: the label's ink goes 0 at 846.6 to 1851 at
 * 846.8, which is the segment's own first frame, and reaches full by
 * 847.2. So there is no interior onset to fit, and its onset is the
 * boundary.
 *
 * That does NOT mean it can be left out, which is what a first pass did
 * — `preBuild` correctly hides a built target until its build fires, so
 * an empty onset list holds the label off the page for the whole
 * segment and the composite shows the words in pure red. The build is
 * fired at the segment's own start, which is where the footage puts it.
 */
const DECK57: Onset[] = [
  { build: "5558349", at: 846.8 }, // "Memetic Nomads", with the transition
]

/**
 * Deck 58 — intra-tribe / inter-tribe coherence. 851.0-861.0s.
 *
 * The pitch's closing argument, and the last slide before the title
 * card. One build: "solves need for Gerardian scapegoating!" at 855.50
 * (rms 0.0126). The rest of the tableau arrives through the transition.
 *
 * `Slide.unsupported()` reports one skipped drawable here —
 * `kTSDRightSingleArrow:synthesis-unverified`, the big white arrow
 * between the two halves. It is the same parametric-arrow class P-7
 * found degenerating on its cursors, and it is 1.7% of this frame's ink.
 * Not this chapter's to fix; named so the segment's score is read with
 * it in view.
 */
const DECK58: Onset[] = [
  { build: "5599785", at: 855.5 }, // the Gerardian line   rms 0.0126
]

/**
 * The pages, with the window each is held for.
 *
 * `from` is the first settled video second after the incoming
 * transition; `to` is the last before the outgoing one. Decks 54 and 55
 * carry this chapter's segment-table correction (see the header); the
 * rest agree with the recon.
 */
const PAGES = [
  { data: slide43, onsets: DECK43, from: 640.4, to: 674.4 },
  { data: slide44, onsets: DECK44, from: 677.4, to: 689.0 },
  { data: slide54, onsets: DECK54, from: 793.8, to: 797.4 },
  { data: slide55, onsets: DECK55, from: 800.4, to: 827.0 },
  { data: slide56, onsets: DECK56, from: 829.6, to: 846.2 },
  { data: slide57, onsets: DECK57, from: 847.4, to: 849.6 },
  { data: slide58, onsets: DECK58, from: 852.0, to: 860.8 },
] as const

/**
 * The `apple:action-scale` factors this scene has MEASURED, by build id.
 *
 * One entry, because one is what the footage supports. See
 * `Builds.ACTION_SCALE_D56` for the measurement and for why the deck's
 * other four scale builds stay unscored.
 */
const SCALE_FACTORS: Record<string, number> = { "5602023": ACTION_SCALE_D56 }

/**
 * Reference frames, one per segment, each chosen AFTER that segment's
 * last event and before its outgoing transition (P-2's slide-32 lesson).
 */
export const SCORED = [
  { frame: 3370, deck: 43, at: 673.8 }, // last event 670.3
  { frame: 3441, deck: 44, at: 688.0 }, // last event 683.8
  { frame: 3987, deck: 54, at: 797.2 }, // last event 797.8 — see note
  { frame: 4130, deck: 55, at: 825.8 }, // last event 816.5
  { frame: 4220, deck: 56, at: 843.8 }, // last event 833.4
  { frame: 4245, deck: 57, at: 848.8 }, // no events inside the hold
  { frame: 4290, deck: 58, at: 857.8 }, // last event 856.5
] as const

/**
 * Mid-build frames — where the chapter's own subject lives.
 *
 * Deck 56's travel is the reason the chapter exists: a settled frame
 * cannot tell a correct curve from a correct endpoint, nor a correct
 * scale ramp from a correct final size. These sample inside the 3.0s
 * window, where the two readings differ most.
 *
 * Deck 43's are inside the automatic ring cascade, which is where the
 * firing model is visible at all: at any settled time every ring is up.
 */
export const MIDS = [
  { frame: 3263, deck: 43, at: 652.4 }, // between rings 1 and 2
  { frame: 3275, deck: 43, at: 654.8 }, // ring 3 arriving
  { frame: 3287, deck: 43, at: 657.2 }, // rings 4-5, mid-cascade
  { frame: 3327, deck: 43, at: 665.2 }, // the arrow mid-draw
  { frame: 4159, deck: 56, at: 831.6 }, // the figure, early travel
  { frame: 4162, deck: 56, at: 832.2 }, // mid-travel, fastest point
  { frame: 4165, deck: 56, at: 832.8 }, // late travel, mid-shrink
] as const

export class Fractal01Dream extends Dream {
  pages = PAGES.map((p) => new Slide({ data: p.data, scaleFactors: SCALE_FACTORS }))

  /** The scene cursor in VIDEO seconds — P-3's convention. */
  #now = 0

  /**
   * Play an Anim at an ABSOLUTE video second.
   *
   * Load-bearing on deck 54, whose eight targets share one onset and
   * would otherwise be serialized into eight seconds by `play()`'s
   * forward-only cursor, and on deck 56, where the motion and the scale
   * must start together on the same target.
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

    // Deck 55's four `fade and move` Out builds, as fades only.
    //
    // The record declares the fade and not the distance, so honouring
    // the move would mean fitting an undeclared magnitude. But leaving
    // the build out entirely holds four tablets the reference has
    // dropped by the time its segment settles, which is a frame known to
    // be wrong for a reason the record DOES support. So the half the
    // record states is played and the half it does not is not.
    const deck55 = this.pages[3]!
    for (const id of ["5457731", "5458485", "5458233", "5458107"]) {
      const parts = deck55.byId.get(id)
      if (!parts) continue
      this.playAt(together(...parts.map((p) => p.opacity.to(0))), 803.86, 1.0)
    }

    this.hold(860.8)
  }

  /** Extend the timeline to video second t without animating anything. */
  private hold(until: number): void {
    const clip = this.play({ tracks: [] }, 0)
    clip.start = until
    this.#now = Math.max(this.#now, until)
  }
}

if (import.meta.main) render(Fractal01Dream)
