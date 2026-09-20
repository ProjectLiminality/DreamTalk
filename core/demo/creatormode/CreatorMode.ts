/**
 * CreatorMode.ts — A DreamWeaving
 *
 * "Playing with the rules" — the second DreamSong woven straight from a
 * transmission rather than from a legacy video.
 *
 * Source: docs/transmissions/2026-09-20-creator-mode.md (David, stream of
 * consciousness). He asked for exactly this and said why:
 *
 *   "I will never read through all of the endless lines of text or code in
 *    this repository. But rather, I want to co create dream songs that
 *    explain and visualize everything that I'm describing here."
 *
 * So the transmission's index is short on purpose and THIS is the artifact.
 *
 * WHAT IT SHOWS, AND WHY THIS AND NOT THE REST
 *
 * The transmission carries many threads — the bureaucratic hangover, the
 * cosmic Dream Explorer, epistemology = ontology, remaster→remake, the cut
 * scene, creation vs optimization. A DreamSong that tried to hold all of them
 * would be the wall of text in moving form, which is the one thing David
 * asked not to receive.
 *
 * So this song shows ONE thing completely: **the flip between game mode and
 * creator mode**, on the calculator David himself chose as the example. It is
 * the right one because it is the load-bearing interaction of the whole
 * system — everything else in the transmission either leads to it (you must
 * be able to play with the rules) or follows from it (what you then edit, and
 * where the edit lives). Get this one clear and the others have somewhere to
 * attach. The remaining threads are named at the foot of this file as the
 * songs they want to become.
 *
 * IT IS A CUT SCENE, IN DAVID'S SENSE
 *
 *   "a dream song explaining how Auryn works in a sense is like a cut scene.
 *    It's a choreography where the user inputs are basically scripted based
 *    on a timeline and not interactive based on user."
 *
 * Every beat here is a real interaction with a real (if minimal) interface,
 * driven by the score instead of by a hand. The cursor moves because the
 * timeline moves it. Nothing is a picture of an interaction; it is the
 * interaction, scripted. That is why the calculator is a holon with named,
 * addressable parts rather than a drawing of a calculator.
 *
 * THE ONE IDEA, IN SIX BEATS
 *
 *   1. GAME MODE. An arena (the calculator) and an avatar (the cursor). The
 *      cursor goes to `+`, clicks, and 8 appears. Playing WITHIN the rules.
 *   2. THE FLIP. The key is pressed. The arrow's agency is RELEASED as the
 *      golden dot — the cursor does not move aside, it transforms, because
 *      the shape change IS the mode change.
 *   3. ATTENTION GLOWS. The dot passes over elements and each one lights as
 *      it is attended to. Hover is not a hint here; it is the visible fact
 *      that attention is what makes a thing editable.
 *   4. SELECT, DON'T FIRE. The dot clicks `+`. Nothing computes. The button
 *      is SELECTED — the same click, a different world.
 *   5. CHANGE THE RULE. `+` leaves, `×` arrives, and the output recomputes
 *      from 8 to 15. The behaviour was rewritten, not the pixels.
 *   6. RETURN. The glow concentrates back into the avatar; the arrow is
 *      itself again; and the calculator — changed — is playable once more.
 *
 * WHAT THE SCENE ASSERTS BY ITS STRUCTURE, NOT BY SAYING IT
 *
 * The calculator is never rebuilt. The SAME holon is used in game mode, in
 * creator mode, and after the edit — because that is the claim: it is one
 * thing seen two ways, not an app beside a mock-up of the app. If the scene
 * had swapped in a separate "editor view", it would have quietly argued the
 * opposite of what David is saying.
 */

import { Dream } from "../../src/index"
import { Line, Null, Rectangle } from "../../src/parts/primitives"
import { Text, Write } from "../../src/parts/text"
import { Create, FadeIn, FadeOut } from "../../src/verbs"
import { together } from "../../src/anim"
import { RED, WHITE } from "../../src/constants"
import { Calculator } from "./Calculator"
import { GOLD, GoldenDot } from "./GoldenDot"

/** Labels are nouns beside drawings — the whiteboard rule, kept. */
const LABEL = 34

/** Where the operator button sits, in the calculator's own frame. */
const OP = { x: 0, y: 90 }

export class CreatorModeDream extends Dream {
  app = new Calculator()

  /**
   * The avatar: an arrow, drawn as the two strokes a pointer actually is.
   * It lives in the scene (not in the app) because it is the USER's body in
   * this arena, not a part of the arena.
   */
  cursor = new Line({
    // Tip at the origin (the point it acts at), body trailing down-right —
    // the pointer shape everyone already reads, so the mode change in beat 2
    // is the only thing the eye has to learn.
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: -52, z: 0 },
      { x: 14, y: -39, z: 0 },
      { x: 0, y: 0, z: 0 },
    ],
    tint: RED,
    stroke: 6,
    x: 250,
    y: -30,
  })

  /** The same agency, released. Starts collapsed; beat 2 blooms it. */
  dot = new GoldenDot({ radius: 14, x: 250, y: -30, scale: 0, glow: 0 })

  // --- The glow of attention -------------------------------------------
  // One halo per attendable element, laid OVER it and lit only while the dot
  // is there. Deliberately not a re-tint of the element itself: being looked
  // at does not change a thing — that is precisely what beat 4 establishes —
  // so the light has to be something additional, which is what attention is.
  glowA = new Rectangle({ width: 140, height: 140, rounding: 0.18, x: -154, y: 90, tint: GOLD, stroke: 4, opacity: 0 })
  glowOut = new Rectangle({ width: 412, height: 140, rounding: 0.18, y: -90, tint: GOLD, stroke: 4, opacity: 0 })
  glowOp = new Rectangle({ width: 140, height: 140, rounding: 0.18, y: 90, tint: GOLD, stroke: 4, opacity: 0 })

  // --- The words the scene is allowed ----------------------------------
  // One line at a time, and only where the idea has no picture.
  gameMode = new Text({ content: "game mode — play within the rules", size: LABEL, tint: WHITE, y: -290 })
  creatorMode = new Text({ content: "creator mode — play with the rules", size: LABEL, tint: GOLD, y: -290 })

  private root = new Null()

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(3 / 4))
    this.stage(this.root)

    // ---- BEAT 1 · GAME MODE ------------------------------------------
    // The arena builds, then the avatar enters it. Container before
    // inhabitant — the same order the agent-arena board established.
    this.play(Create(this.app.frame), 1.2)
    this.play(
      together(
        Create(this.app.slotA),
        [Write(this.app.valueA), 0.35, 1],
        [Create(this.app.slotB), 0.15, 1],
        [Write(this.app.valueB), 0.5, 1],
        [Create(this.app.opButton), 0.3, 1],
        [Write(this.app.opPlus), 0.6, 1],
        [Create(this.app.outSlot), 0.45, 1],
      ),
      2.4,
    )
    this.play(together(Create(this.cursor), [Write(this.gameMode), 0.3, 1]), 1.4)
    this.wait(0.6)

    // The scripted click. The cursor travels to `+`, presses (a small dip
    // is all a press is), and the rule fires: 8 appears.
    this.play(together(this.cursor.x.to(OP.x - 6), this.cursor.y.to(OP.y + 20)), 1.2)
    this.wait(0.3)
    this.play(this.cursor.scale.to(0.88), 0.14)
    this.play(this.cursor.scale.to(1), 0.14)
    this.play(FadeIn(this.app.out8), 0.5)
    this.wait(1.4)

    // ---- BEAT 2 · THE FLIP -------------------------------------------
    // The arrow does not step aside for the dot; it BECOMES it. The arrow
    // shrinks to nothing at the same instant the dot blooms from the same
    // point, so one presence persists through the change of mode.
    this.play(FadeOut(this.gameMode), 0.5)
    this.play(
      together(
        this.cursor.scale.to(0),
        this.cursor.opacity.to(0),
        [this.dot.scale.to(1), 0.25, 1],
        [this.dot.glow.to(1), 0.3, 1],
        [Write(this.creatorMode), 0.45, 1],
      ),
      1.6,
    )
    this.wait(0.8)

    // ---- BEAT 3 · ATTENTION GLOWS ------------------------------------
    // The dot visits three elements. Each lights while attended and dims
    // when left — the light belongs to the looking, not to the thing.
    this.play(
      together(
        this.dot.x.to(-154),
        this.dot.y.to(20),
        [this.glowA.opacity.to(1), 0.45, 1],
      ),
      1.1,
    )
    this.wait(0.5)
    this.play(
      together(
        this.glowA.opacity.to(0),
        this.dot.x.to(0),
        this.dot.y.to(-158),
        [this.glowOut.opacity.to(1), 0.45, 1],
      ),
      1.2,
    )
    this.wait(0.5)

    // ---- BEAT 4 · SELECT, DON'T FIRE ---------------------------------
    // The same gesture as beat 1, over the same button — and nothing
    // computes. That silence is the beat.
    this.play(
      together(
        this.glowOut.opacity.to(0),
        this.dot.x.to(OP.x),
        this.dot.y.to(OP.y - 70),
        [this.glowOp.opacity.to(1), 0.45, 1],
      ),
      1.2,
    )
    // The click: the dot pulses, the halo brightens and HOLDS. A fired
    // button flashes and releases; a selected one stays lit.
    this.play(this.dot.glow.to(0.5), 0.22)
    this.play(together(this.dot.glow.to(1), this.glowOp.stroke.to(9)), 0.3)
    this.wait(1.2)

    // ---- BEAT 5 · CHANGE THE RULE ------------------------------------
    // The old rule leaves, the new one arrives, and the result recomputes
    // itself — because what changed was the behaviour, not the picture.
    this.play(
      together(
        FadeOut(this.app.opPlus),
        [FadeIn(this.app.opTimes), 0.4, 1],
      ),
      1.4,
    )
    this.wait(0.5)
    this.play(together(FadeOut(this.app.out8), [FadeIn(this.app.out15), 0.45, 1]), 1.2)
    this.wait(1.6)

    // ---- BEAT 6 · RETURN ---------------------------------------------
    // The glow concentrates back into the avatar, exactly as the
    // transmission describes, and the arena is playable again — changed.
    this.play(FadeOut(this.creatorMode), 0.5)
    this.play(
      together(
        this.dot.x.to(250),
        this.dot.y.to(-30),
        [this.dot.glow.to(0), 0.5, 1],
        [this.dot.scale.to(0), 0.6, 1],
        [this.cursor.x.to(250), 0, 0.55],
        [this.cursor.y.to(-30), 0, 0.55],
        [this.cursor.opacity.to(1), 0.6, 1],
        [this.cursor.scale.to(1), 0.6, 1],
        this.glowOp.opacity.to(0),
      ),
      1.8,
    )
    this.play(Write(this.gameMode), 1)
    this.wait(2)
    this.play(together(FadeOut(this.app.all), FadeOut(this.cursor), FadeOut(this.gameMode)), 1.2)
  }
}
