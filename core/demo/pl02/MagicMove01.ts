/**
 * MagicMove01.ts — A DreamWeaving
 *
 * PL02 deck slides 12 → 13, across the Magic Move that joins them:
 * one twelve-node dotted mesh becomes two smaller ones side by side.
 * Chapter P-6's gate, and the reason this pair and not another is that
 * **the glide is the content here** — a mid-transition frame shows
 * something a settled frame cannot, and 44 of the video's 58 transitions
 * are this one operation.
 *
 * WHY THIS PAIR
 *
 * Of the deck's 44 Magic Moves this is the cleanest instrument:
 *
 *   • the matched objects VISIBLY TRAVEL. Twelve `Head with
 *     Shoulders_826` icons move and shrink together (matched scale
 *     0.660, median travel 133 slide units), so a matcher that paired
 *     them wrongly would show heads crossing through one another rather
 *     than a tableau contracting — the failure is unmissable rather than
 *     subtle;
 *   • it carries BOTH unmatched directions at once — one outgoing
 *     drawable (the single ring outline) and three incoming (the
 *     twin-lobe outline and two double-arrows) — so the fade-out and
 *     fade-in halves of `customMagicMoveFadeUnmatchedObjects` are both
 *     exercised;
 *   • it is a DOTTED MESH, so the connection lines' behaviour through a
 *     glide is on screen rather than hypothetical (Transitions.ts's
 *     `magicMove` header states why they do not themselves glide);
 *   • and it is one of only three Magic Moves in the deck declared at
 *     **1.5s** rather than 2.0s, so the duration being READ rather than
 *     assumed is load-bearing here in a way it is not on the other 41.
 *
 * THE WINDOW IS MEASURED; THE DURATION IS READ
 *
 * The chapter's central division, and both halves are checkable.
 *
 * MEASURED — the onset, at **216.4s**, and WHICH EVENT that is matters.
 * A frame-differenced scan finds the segment's first changing pixels one
 * frame earlier, at 216.2 (f_01081 → f_01082, after five perfectly still
 * frames), and P-6 first took that for the onset. It is not: at f_01082
 * the ring's pixel count is UNCHANGED (8662, identical to f_01081) and
 * the heads have not moved at all (top ink row still 52, band still 366
 * px wide) — what changed is that the second superposed copy became
 * visible. The GEOMETRY first moves at f_01083, and the glide's onset is
 * the glide, not the fade that precedes it.
 *
 * The difference is worth a paragraph because it is 0.2s of a 1.5s
 * window — 13% of the whole crossing — and because the earlier reading
 * survived a whole chapter by being *nearly* right.
 *
 * READ — the duration. The deck declares 1.5s (`KeyTransition.duration`
 * on slide 13) and the footage CONFIRMS it rather than supplying it, on
 * a far stronger instrument than the ink-edge track P-6 first used.
 * Recovering the transition's own completion per frame — fitting all
 * twelve heads' measured centroids against the interpolation, which
 * closes to 0.7-1.4 px mean (see below) — gives u directly:
 *
 *     video      217.0   217.2   217.4   217.6
 *     recovered  0.400   0.590   0.740   0.865
 *
 * and against `smooth` on the deck's own numbers:
 *
 *     reading                              rms(u)
 *     onset 216.2, duration 1.5 (P-6's)    0.130
 *     onset 216.4, duration 1.5 (DECLARED) 0.030
 *     onset 216.30, duration 1.62 (fitted) 0.011
 *
 * The declared duration at the corrected onset is a 4x improvement with
 * NOTHING fitted. The 1.62s free fit is better still by a hair and is
 * REPORTED RATHER THAN ADOPTED — adopting it would be fitting a duration
 * the deck states, which DECISIONS' refused-fits rule forbids, and 1.62
 * is inside 5 fps sampling's own resolution of 1.5.
 *
 * THE GEOMETRY IS EXACT; THE RESIDUAL WAS ALWAYS THE CLOCK.
 *
 * At the recovered completion the model reproduces all twelve heads to
 * **0.67-1.36 px mean, 2.46 px worst** — sub-pixel, with no free
 * parameter. So the ~15-20px mid-glide error P-6 reported was not
 * geometry: it was this onset, plus a measurement artefact worth naming
 * so it is not rediscovered. Comparing the reference's ink CENTROID
 * against a predicted BOX CENTRE adds a spurious +6 px downward offset,
 * uniform across every head, because the glyph is bottom-heavy
 * (shoulders wider than head) and its centroid sits 5.9 px below its box
 * centre at settled size. Compare centroid to centroid, or box to box —
 * never one to the other.
 *
 * WHAT IS STAGED
 *
 * Both pages are composed and `magicMoveSetup` lights A and darkens B;
 * the glide plays over the declared 1.5s from the measured onset; the
 * swap hands the frame to B. The hold either side is the projector's —
 * segment 12 runs 214.4-217.0 and segment 13 runs 217.0-219.4, and this
 * scene reproduces the crossing between them, not the whole slideshow.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Slide } from "../../vocabulary/Slides/Slides"
import {
  glidingMesh,
  glidingMeshAnim,
  glidingMeshSetup,
  magicMove,
  magicMoveAnim,
  magicMoveSetup,
  magicMoveSwap,
} from "../../vocabulary/Slides/Transitions"
import { slide12 } from "../../vocabulary/Slides/assets/pl02/slide12"
import { slide13 } from "../../vocabulary/Slides/assets/pl02/slide13"

/**
 * The measured onset, as an offset into this scene's own clock.
 *
 * Scene t = 1.0 IS video 216.4 — the frame the geometry first moves, not
 * the frame the first pixel changes. See the header: 216.2 is the second
 * superposed copy appearing, and using it put the whole glide 0.2s
 * early.
 */
const ONSET = 1.0
/** Video seconds at ONSET — what a scored frame's `@t` must be read from. */
export const ONSET_VIDEO = 216.4
/** The deck's own declared duration for this transition. READ, not fitted. */
const DURATION = slide13.transition?.duration ?? 1.5

/**
 * WHAT THIS SLIDE ACTUALLY IS, and it is not what the eye reports.
 *
 * f_01081 shows SIX heads in one ring, so the obvious reading is that
 * six heads become twelve. The deck says otherwise: slide 12 carries
 * **twelve** heads and thirty connection lines, exactly as slide 13
 * does. It draws two coincident six-node meshes stacked on the same
 * spot — the deck's own doubling, the same construction P-5 found on
 * slide 23 — and the Magic Move separates the copies into two lobes.
 *
 * That is why the matcher reports 12 matched, 1 out, 3 in rather than
 * the 6-and-6 the picture suggests, and it is why every one of the
 * thirty connections has both endpoints matched: nothing is created
 * here, a superposition is pulled apart.
 */

export class MagicMove01Dream extends Dream {
  from = new Slide({ data: slide12 })
  to = new Slide({ data: slide13 })
  /**
   * The gliding mesh — one stand-in per connection, re-derived per frame
   * between the travelling heads. Declared as a field because a Dream's
   * holons are its declared fields; `glidingMesh` builds them from the
   * match and the scene stages them.
   */
  mesh = glidingMesh(this.from, this.to, magicMove(this.from, this.to))

  unfold() {
    this.observer.look("front")
    const match = magicMove(this.from, this.to)
    // Stated rather than inferred: the mesh's stand-ins are animated, so
    // the root scan would find them anyway — staging says they are the
    // scene's own geometry regardless of what any clip happens to touch.
    for (const line of this.mesh.lines) this.stage(line)

    this.set(this.from.creation.to(1))
    this.set(this.to.creation.to(1))
    this.set(magicMoveSetup(this.from, this.to))
    this.set(glidingMeshSetup(this.from, this.to, this.mesh))

    this.wait(ONSET)
    // The icons' glide and the mesh's re-derivation are ONE event over
    // ONE window — `play` advances the cursor, so they must be handed to
    // it together rather than in sequence.
    this.play(
      together(magicMoveAnim(this.from, this.to, match), glidingMeshAnim(this.mesh)),
      DURATION,
    )
    this.set(magicMoveSwap(this.from, this.to, match, this.mesh))
    this.wait(1.5)
  }
}

if (import.meta.main) render(MagicMove01Dream)
