/**
 * Web01.ts — A DreamWeaving
 *
 * "Project Liminality" (2023), the Liminal Web sequence: deck slides
 * 45-53, video seconds 690.6 to 793.4. A laptop screen holding the
 * project's own mark, a cursor that reaches out and clicks, and the
 * network of heads that opens behind each click.
 *
 * Chapter P-7's gate, and the chapter's subject is ON-SLIDE MOTION:
 * `apple:action-motion-path`, the build that moves something the page is
 * already showing. P-3 implemented its straight case while scoring slide
 * 3's "Story" label and named the boundary it stopped at; this chapter
 * owns the class.
 *
 * WHAT THE MOTION BUILDS ACTUALLY ARE — A MOUSE CURSOR
 *
 * The deck's seven in-scope `action-motion-path` builds outside the
 * opening arc all drive the SAME drawable, repeated once per slide: a
 * 39.588 x 26.597 slide-unit arrow rotated 120 degrees, black-filled
 * with a 3.0 white stroke. Rendered at 720p it is a mouse pointer, and
 * the footage shows it clicking the app tiles on the laptop screen. Each
 * one declares the identical translation, (-43.897, -69.458) slide
 * units, which is 54.8 video pixels up and to the left.
 *
 * Every one is preceded by an `apple:bc-appear` on the same target, so
 * the gesture is always the same two beats: the cursor appears where the
 * click will start, then glides. That repetition is what makes the
 * chapter scoreable — seven independent measurements of one declared
 * quantity.
 *
 * THE DECLARED PATHS REPRODUCE THE FOOTAGE, AND THAT IS THE CLAIM
 *
 * Each arrow's centroid was tracked through its travel and fitted
 * against the deck's own declared endpoints and duration, solving only
 * for the onset (P-3's method: the curve and its length are read, the
 * offset is measured). Residuals, in video pixels on a 54.8 px travel:
 *
 *     deck   onset      rms     samples
 *      36   602.880    1.31       5
 *      45   704.920    1.19       7
 *      46   719.135    1.39       7
 *      47   726.735    1.30       7
 *      48   731.180    1.39       7
 *      49   736.935    1.82       7
 *      52   761.875    0.96       7
 *
 * Nothing here is fitted but the offset. The travel, its direction, its
 * 1.0s duration and its ease-both curve are all read from the build
 * record, and they land within two pixels at every sample of every
 * arrow.
 *
 * THE FIRING MODEL NEEDS ONE REFINEMENT, AND THE ARROWS ARE WHY
 *
 * P-5 settled it: an `automatic: true` chunk fires one declared duration
 * after its predecessor. Every arrow here is the pair (`bc-appear`,
 * manual) then (`action-motion-path`, automatic, duration 1.0), so the
 * literal rule says the cursor appears, waits a full second, and then
 * moves. It does not wait. On the three arrows whose travel is cleanly
 * isolated from other ink, the first frame that shows the cursor already
 * has it moving:
 *
 *     deck   first cursor ink   fitted motion onset   gap
 *      46         719.2               719.135       +0.065
 *      47         726.8               726.735       +0.065
 *      52         762.0               761.875       +0.125
 *
 * Every gap is under one 0.2s frame interval, and a one-second wait
 * would have been five frames of a stationary cursor. The refinement is
 * in `Builds.INSTANT_CONSUMES_NO_TIME`: the delay an automatic chunk
 * waits is its predecessor's EFFECTIVE duration, and `bc-appear` is a
 * step (measured — see `Builds.BC_APPEAR`), so its effective duration is
 * zero. P-5's own cases all had ramping predecessors, where the two
 * readings coincide; these are the first that separate them.
 *
 * THE TRANSITIONS ARE CUTS, AS IN P-3
 *
 * All eight transitions across this run are 2.0s
 * `magic-move-implied-motion-path`. Magic Move is P-6's subject and its
 * mid-glide frames are still short of the bar there (p6-handoff), so
 * standing one in here would score frames that look right for the wrong
 * reason. Each is a cut: the outgoing page holds its last settled frame,
 * the incoming appears at its first, and no frame inside a transition
 * window is scored.
 */

import { Dream, render } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { Slide } from "../../vocabulary/Slides/Slides"
import {
  slide45,
  slide46,
  slide47,
  slide48,
  slide49,
  slide50,
  slide51,
  slide52,
  slide53,
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
 * Deck 45 — MonoLogos / DiaLogos. 690.6-710.6s, 6 builds, 4 events.
 *
 * Two labelled rings arrive on separate clicks, then the cursor gesture.
 * The two `dissolve` builds drive GROUPS (5397055, 5396971), which
 * `buildTargets` resolves to their member shapes.
 *
 * The 707.6-709.4 event is the outgoing Magic Move, not a build: deck 45
 * declares nothing that late, and the change sweeps the whole tableau
 * rather than one target's mask. It is left alone, and the scored frame
 * sits before it.
 */
const DECK45: Onset[] = [
  { build: "5398994", at: 691.0 }, // MonoLogos ring (frame scan, ±0.2)
  { build: "4810244", at: 691.0 }, // its label
  { build: "5398944", at: 693.695 }, // DiaLogos ring (curve fit)
  { build: "4810299", at: 693.695 }, // its label
  { build: "5395191", at: 704.92 }, // the cursor appears…
  { build: "5395192", at: 704.92 }, // …and glides, same instant
]

/**
 * Deck 46 — the Liminal Web opens. 710.6-722.4s, 4 builds, 2 events.
 *
 * The title dissolves in with the tableau, the big blue network circle
 * (group 5404466) with it, and the cursor fires alone at 719.135 — the
 * cleanest arrow in the chapter, 1.39 px rms over seven samples with no
 * other ink moving anywhere on the frame.
 */
const DECK46: Onset[] = [
  { build: "5593461", at: 711.0 }, // "Liminal Web"
  { build: "5404715", at: 711.0 }, // the network group
  { build: "5424584", at: 719.135 }, // cursor appears
  { build: "5424583", at: 719.135 }, // cursor glides
]

/**
 * Deck 47 — 722.4-728.8s, 2 builds, 2 events. Only the cursor gesture,
 * on a tableau that arrives whole through the Magic Move.
 */
const DECK47: Onset[] = [
  { build: "5424630", at: 726.735 }, // cursor appears
  { build: "5424629", at: 726.735 }, // cursor glides
]

/**
 * Deck 48 — 728.8-733.2s, 4 builds, 1 measured event.
 *
 * Two `apple:appear` builds — one In on group 5417422, one Out on group
 * 5423084 — swap which cluster is shown, and both are steps rather than
 * ramps (`Builds.BC_APPEAR`). Then the cursor at 731.180.
 */
const DECK48: Onset[] = [
  { build: "5423053", at: 729.595 }, // a cluster appears (curve fit)
  { build: "5423136", at: 729.595 }, // and one leaves, same click
  { build: "5426359", at: 731.18 }, // cursor appears
  { build: "5426360", at: 731.18 }, // cursor glides
]

/** Deck 49 — 733.2-739.0s, 3 builds, 2 events. */
const DECK49: Onset[] = [
  { build: "5424541", at: 735.4 }, // a ring dissolves in (frame scan)
  { build: "5426446", at: 736.935 }, // cursor appears
  { build: "5426447", at: 736.935 }, // cursor glides
]

/**
 * Deck 50 — Video Chat / Liminal Wallet. 739.0-744.0s, 2 builds.
 *
 * Two labels on two separate clicks, 1.57s apart — the only slide in the
 * run whose two builds do NOT share an onset, and both fit their
 * declared 1.0s ramp cleanly.
 */
const DECK50: Onset[] = [
  { build: "5430004", at: 740.875 }, // the left label (curve fit)
  { build: "5430006", at: 742.445 }, // the right label (curve fit)
]

/** Deck 51 — + Digital Sand. 744.0-749.4s, 2 builds, 1 event. */
const DECK51: Onset[] = [
  { build: "5435011", at: 744.175 }, // "Digital Sand" (curve fit)
  { build: "5440091", at: 744.175 }, // its ring, same click
]

/**
 * Deck 52 — 749.4-765.2s, 4 builds, 1 measured event.
 *
 * A `LineDrawForLine` In and a `dissolve character` Out on the SAME
 * target (5541581) — a shape drawn on and then faded away — plus the
 * cursor at 761.875, the tightest fit in the chapter (0.96 px rms).
 *
 * The draw/fade pair fires at 764.4-764.6, inside the outgoing Magic
 * Move window, so its onset is the frame-scan value and the scored frame
 * for this segment sits well before it.
 */
const DECK52: Onset[] = [
  { build: "5442224", at: 761.875 }, // cursor appears
  { build: "5442223", at: 761.875 }, // cursor glides
  { build: "5541627", at: 764.4 }, // the shape draws on (frame scan)
  { build: "5541648", at: 764.4 }, // and dissolves out
]

/**
 * Deck 53 — 765.2-793.4s, 3 builds, 1 event.
 *
 * THE ONE PLACE THE CHUNK ORDER AND THE FOOTAGE DISAGREE. The chunk list
 * runs `fade and move` (manual, 2.0s) then two `LineDrawForLine`
 * (automatic, 1.75s), which predicts the draws at fade + 2.0. Measured
 * on regions chosen so the two builds' ink does not overlap — the fade's
 * own box above y=390, the draws' below y=410 — the draws start FIRST:
 *
 *     fade and move   onset 772.710   rms 0.134
 *     line draws      onset 772.030   rms 0.046
 *
 * The draws lead by 0.68s where the chunk order says they should trail
 * by 2.0s. P-5 recorded one measured exception to chunk-order-is-firing-
 * order already (deck 25 chunk 4); this is a second, and it is reported
 * rather than resolved — two exceptions do not name a rule, and forcing
 * the declared order here would mean rendering a frame known to be wrong.
 * The onsets below are the measured ones.
 *
 * `apple:fade and move` is not implemented: it is a fade combined with a
 * translation whose distance the record does not carry, so honouring it
 * would mean fitting an undeclared magnitude. `Slide.unsupported()`
 * reports it; the target is lit by `cutIn` and the segment is scored with
 * that stated.
 */
const DECK53: Onset[] = [
  { build: "5446055", at: 772.03 }, // left stroke draws on
  { build: "5446056", at: 772.03 }, // right stroke, same click
]

/** The pages that carry builds, with their measured onsets. */
const PAGES = [
  { data: slide45, onsets: DECK45, from: 690.6, to: 707.4 },
  { data: slide46, onsets: DECK46, from: 710.6, to: 720.6 },
  { data: slide47, onsets: DECK47, from: 722.4, to: 728.2 },
  { data: slide48, onsets: DECK48, from: 728.8, to: 732.6 },
  { data: slide49, onsets: DECK49, from: 733.2, to: 738.0 },
  { data: slide50, onsets: DECK50, from: 739.0, to: 743.4 },
  { data: slide51, onsets: DECK51, from: 744.0, to: 748.0 },
  { data: slide52, onsets: DECK52, from: 749.4, to: 763.4 },
  { data: slide53, onsets: DECK53, from: 765.2, to: 792.6 },
] as const

/**
 * Reference frames, one per segment, each chosen AFTER that segment's
 * last event and before its outgoing transition (P-2's slide-32 lesson).
 */
export const SCORED = [
  { frame: 3521, deck: 45, at: 704.0 }, // before the cursor fires
  { frame: 3591, deck: 46, at: 718.0 },
  { frame: 3626, deck: 47, at: 725.0 },
  { frame: 3661, deck: 48, at: 732.0 },
  { frame: 3686, deck: 49, at: 737.0 },
  { frame: 3716, deck: 50, at: 743.0 },
  { frame: 3741, deck: 51, at: 748.0 },
  { frame: 3811, deck: 52, at: 762.0 },
  { frame: 3941, deck: 53, at: 788.0 },
] as const

/**
 * Mid-build frames — where a motion build's whole point lives.
 *
 * A settled frame cannot tell a correct motion from a correct endpoint:
 * both put the cursor in the same place once it stops. These are sampled
 * inside the travel, where the two readings differ most.
 */
export const MIDS = [
  { frame: 3597, deck: 46, at: 719.2 }, // cursor at the path's start
  { frame: 3598, deck: 46, at: 719.4 }, // mid-glide
  { frame: 3599, deck: 46, at: 719.6 }, // mid-glide, fastest point
  { frame: 3635, deck: 47, at: 727.0 }, // mid-glide
  { frame: 3637, deck: 47, at: 727.4 }, // late glide
  { frame: 3812, deck: 52, at: 762.2 }, // mid-glide
  { frame: 3813, deck: 52, at: 762.4 }, // mid-glide
] as const

export class Web01Dream extends Dream {
  pages = PAGES.map((p) => new Slide({ data: p.data }))

  /** The scene cursor in VIDEO seconds — P-3's convention. */
  #now = 0

  private at(t: number): void {
    if (t > this.#now) {
      this.wait(t - this.#now)
      this.#now = t
    }
  }

  /**
   * Play an Anim at an ABSOLUTE video second.
   *
   * P-3's finding, and it matters here for the same reason: builds
   * overlap, and `play()` advances a forward-only cursor past each clip,
   * so placing them in sequence silently lags the whole scene. The
   * cursor gestures make it sharper still — an appear and a motion that
   * share an onset must start together, not one after the other.
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

    // The last page holds to the end of its segment; the Timeline's
    // duration is its last clip's end, and a cut adds none.
    this.hold(792.6)
  }

  /** Extend the timeline to video second t without animating anything. */
  private hold(until: number): void {
    const clip = this.play({ tracks: [] }, 0)
    clip.start = until
    this.#now = Math.max(this.#now, until)
    void this.at
  }
}

if (import.meta.main) render(Web01Dream)
