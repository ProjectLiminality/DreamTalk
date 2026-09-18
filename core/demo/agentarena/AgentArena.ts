/**
 * AgentArena.ts — A DreamWeaving
 *
 * "Agent · Arena · Ensoulment" — the first DreamSong woven straight from a
 * whiteboard rather than from a legacy video.
 *
 * Source of truth: docs/transmissions/whiteboards/2026-09-18-agent-arena-
 * ensoulment.jpg, read in docs/transmissions/2026-09-18-agent-arena.md.
 * David drew the board and talked over it; this is that drawing, weighed
 * and sequenced, in motion.
 *
 * THE BOARD'S OWN LAW, WHICH THIS SCENE OBEYS
 *
 * The whiteboard is drawn in exactly two markers, and the choice is not
 * decoration — it is the argument:
 *
 *   BLUE  = the arena. The container, the system, the world one is in.
 *   RED   = the agent. Attention, choice, soul — the thing that extends
 *           INTO an arena and acts there.
 *
 * Every pair on the board is that same relation at a different scale:
 * a text field (blue) has a cursor (red); a GUI (blue) has a mouse
 * (red); a game (blue) has an avatar (red). David drew a single long
 * arrow down the middle of those three and labelled it "one continuous
 * pattern" — the storyboard connector, and the reason beats 3-5 land in
 * that order and then sit together.
 *
 * Core's canonical BLUE (0,162,255) and RED (255,100,78) ARE the two
 * markers, so the scene states no colour of its own.
 *
 * THE SPINE (docs/transmissions/2026-09-18-agent-arena.md §"The spine")
 *
 *   1. An agent is in an arena.                            (the primitive)
 *   2. Human choice flows into a virtual arena THROUGH a virtual agent.
 *   3. That relation is one continuous pattern at three scales.
 *   4. selection = attention = animation = soul extension.  (ensoulment)
 *   5. Zoom out: the physical world is an arena too, holding a human,
 *      holding a screen, holding another arena. The interface is the
 *      membrane — inputs paired to outputs.
 *   6. Therefore macOS is already an infinite game engine; DreamOS makes
 *      it explicit.
 *
 * ILLUSTRATION-FIRST. David: "it's mainly about the illustrations, but
 * sometimes of course it also makes sense to use text, but never a wall
 * of text." So: text appears only where the board itself is text — the
 * three equations and the two closing lines — and only one line at a
 * time. Every label is a short noun beside a drawing, never a sentence.
 *
 * THE RECURSION IS THE POINT (beat 7). The board's centre-bottom figure
 * is an arena containing a human containing a screen containing an
 * arena containing an agent. This scene builds it by REUSING the very
 * Arena and AgentFigure holons beat 1 introduced, scaled down and put
 * on the laptop's screen — so the recursion is literal in the code, not
 * merely depicted. That is the holonic reading the transmission notes
 * call for: a glyph that repeats is ONE holon, created once and reused.
 */

import { Dream } from "../../src/index"
import { Circle, Group, Line, Null, Rectangle, Square } from "../../src/parts/primitives"
import { Text, Write } from "../../src/parts/text"
import { Create, FadeIn, FadeOut, UnCreate } from "../../src/verbs"
import { together } from "../../src/anim"
import { BLUE, RED, WHITE } from "../../src/constants"
import { AgentFigure } from "./AgentFigure"
import { Arena } from "./Arena"
import { Ensoulment } from "./Ensoulment"
import { Pairing } from "./Pairing"

/** The board's label size — a noun beside a drawing, never a paragraph. */
const LABEL = 34
/** The equations, which are the only lines that carry weight as TEXT. */
const EQUATION = 40

export class AgentArenaDream extends Dream {
  // --- Beat 1: the primitive -------------------------------------------
  // The arena and its agent, at the board's own top-left scale. These two
  // holons are the scene's vocabulary: beat 7 puts the SAME pair on a
  // laptop screen, which is what makes the recursion real.
  arena = new Arena({ radius: 210 })
  agent = new AgentFigure({ height: 210 })
  arenaLabel = new Text({ content: "arena", size: LABEL, tint: BLUE, y: 255 })
  agentLabel = new Text({ content: "agent", size: LABEL, tint: RED, y: -110 })
  primitive = new Group({ members: [this.arena, this.agent, this.arenaLabel, this.agentLabel] })

  // --- Beat 2: agency flows --------------------------------------------
  // The red line of choice leaving the agent — the board's "human agency
  // (CHOICE) flows into virtual arena through virtual agent", drawn as
  // the flow it describes rather than written out as the sentence it is.
  choice = new Line({
    points: [
      { x: 0, y: -40, z: 0 },
      { x: 330, y: -40, z: 0 },
    ],
    tint: RED,
    arrowEnd: true,
  })
  choiceLabel = new Text({ content: "CHOICE", size: LABEL, tint: RED, x: 165, y: 10 })
  agency = new Group({ members: [this.choice, this.choiceLabel] })

  // --- Beats 3-5: the three pairs --------------------------------------
  // Each Pairing is one blue container with one red inhabitant. Stacked
  // where the board stacks them, so the single arrow of beat 5 can run
  // down all three and name what they share.
  textPair = new Pairing({ kind: "text", x: -230, y: 230 })
  guiPair = new Pairing({ kind: "gui", x: -230, y: 0 })
  gamePair = new Pairing({ kind: "game", x: -230, y: -230 })
  pairs = new Group({ members: [this.textPair, this.guiPair, this.gamePair] })

  // The connector David drew down the middle of the three — the board's
  // own statement that these are not three facts but one.
  patternArrow = new Line({
    points: [
      { x: 250, y: 320, z: 0 },
      { x: 250, y: -320, z: 0 },
    ],
    tint: WHITE,
    arrowEnd: true,
  })
  patternLabel = new Text({
    content: "one continuous pattern",
    size: LABEL,
    tint: WHITE,
    x: 500,
    y: 0,
  })
  pattern = new Group({ members: [this.patternArrow, this.patternLabel] })

  // --- Beat 6: ensoulment ----------------------------------------------
  // The starburst: energy radiating from a dense centre. The board draws
  // it twice — here, and again on the human in the physical arena — so it
  // is a holon, and beat 7 reuses this same class.
  soul = new Ensoulment({ rays: 14, radius: 150 })
  eq1 = new Text({ content: "selection = attention = animation", size: EQUATION, tint: WHITE, y: -290 })
  eq2 = new Text({ content: "selection = soul extension", size: EQUATION, tint: RED, y: -290 })

  // --- Beat 7: the recursion -------------------------------------------
  // The physical arena, holding the human, holding the laptop, holding —
  // on its screen — the arena-and-agent from beat 1, one tenth the size.
  physicalArena = new Arena({ radius: 330, x: -260 })
  human = new AgentFigure({ height: 150, x: -510, y: -40 })
  humanSoul = new Ensoulment({ rays: 12, radius: 78, x: -510, y: -30 })
  // The laptop: a screen plate tilted open above a keyboard plate.
  screen = new Rectangle({ width: 300, height: 195, x: -200, y: 45, tint: WHITE })
  keyboard = new Line({
    points: [
      { x: -345, y: -55, z: 0 },
      { x: -55, y: -55, z: 0 },
    ],
    tint: WHITE,
  })
  // The arena INSIDE the screen — the same holon as beat 1, made small.
  innerArena = new Arena({ radius: 62, x: -200, y: 50 })
  innerAgent = new AgentFigure({ height: 40, x: -200, y: 38 })
  // The sight lines from the human's eye to what is on the screen.
  sight1 = new Line({
    points: [
      { x: -470, y: 30, z: 0 },
      { x: -265, y: 60, z: 0 },
    ],
    tint: RED,
  })
  sight2 = new Line({
    points: [
      { x: -470, y: 30, z: 0 },
      { x: -265, y: 10, z: 0 },
    ],
    tint: RED,
  })
  inputLabel = new Text({ content: "input", size: LABEL, tint: WHITE, x: 10, y: -55 })
  recursion = new Group({
    members: [
      this.physicalArena,
      this.human,
      this.screen,
      this.keyboard,
      this.innerArena,
      this.innerAgent,
      this.sight1,
      this.sight2,
      this.humanSoul,
      this.inputLabel,
    ],
  })

  // The interface inventory: what the membrane is actually made of.
  // Blue in, red out, exactly as the board pairs them.
  ifaceIn = new Text({ content: "camera\nmic\nkeyboard", size: LABEL, tint: BLUE, x: 250, y: 120, align: "left" })
  ifaceOut = new Text({ content: "screen\nspeaker\nmotor", size: LABEL, tint: RED, x: 520, y: 120, align: "left" })
  ifaceTitle = new Text({ content: "interface", size: LABEL, tint: WHITE, x: 400, y: 250 })
  iface = new Group({ members: [this.ifaceTitle, this.ifaceIn, this.ifaceOut] })

  // --- Beat 8: the conclusion ------------------------------------------
  macos = new Text({ content: "macOS already = infinite game engine", size: EQUATION, tint: WHITE, y: 90 })
  dreamos = new Text({ content: "DreamOS", size: 130, tint: RED, y: -60 })
  explicit = new Text({ content: "makes it explicit", size: EQUATION, tint: WHITE, y: -190 })

  private stageRoot = new Null()

  unfold() {
    this.observer.look("front")
    // The board is read in REGIONS — the eye goes to a corner, takes it
    // in, then moves. The camera does the same: each beat is framed for
    // what it holds, rather than one zoom fitted to the widest moment
    // (which would leave every other beat small and far away).
    this.set(this.observer.zoom.to(1))
    this.stage(this.stageRoot)

    // BEAT 1 — an agent is in an arena.
    this.play(Create(this.arena), 1.6)
    this.play(together(Create(this.agent), [Write(this.arenaLabel), 0.3, 1]), 1.6)
    this.play(Write(this.agentLabel), 0.8)
    this.wait(1)

    // BEAT 2 — and agency flows out of it, into somewhere.
    this.play(Create(this.agency), 1.4)
    this.wait(1.2)
    this.play(together(FadeOut(this.primitive), FadeOut(this.agency)), 0.8)

    // BEATS 3-5 — the same relation, three times, then named as one.
    // Each pair draws its arena first and its agent second, so the
    // container-then-inhabitant reading repeats in the MOTION, not just
    // in the picture.
    // Three stacked pairs need the wide view.
    this.play(this.observer.zoom.to(1 / 2), 0.8)
    this.play(Create(this.textPair), 1.8)
    this.wait(0.6)
    this.play(Create(this.guiPair), 1.8)
    this.wait(0.6)
    this.play(Create(this.gamePair), 1.8)
    this.wait(0.8)
    this.play(together(Create(this.patternArrow), [Write(this.patternLabel), 0.4, 1]), 2)
    this.wait(1.5)
    this.play(together(FadeOut(this.pairs), FadeOut(this.pattern)), 0.9)

    // BEAT 6 — ensoulment. The starburst, then the equations one at a
    // time: the board's three-term identity, then its consequence.
    // Back in for the starburst — it is a single dense mark, but the
    // equation beneath it needs room, so not all the way in.
    this.play(this.observer.zoom.to(6 / 7), 0.8)
    this.play(Create(this.soul), 2)
    this.play(Write(this.eq1), 1.6)
    this.wait(1.4)
    this.play(FadeOut(this.eq1), 0.5)
    this.play(Write(this.eq2), 1.4)
    this.wait(1.6)
    this.play(together(FadeOut(this.soul), FadeOut(this.eq2)), 0.9)

    // BEAT 7 — pull back. The arena we were just inside turns out to sit
    // on a screen, inside a human, inside an arena.
    // The pull-BACK is the beat's whole meaning: the arena we were
    // inside turns out to be on a screen, inside a larger arena.
    this.play(this.observer.zoom.to(4 / 7), 1.2)
    this.play(Create(this.physicalArena), 1.6)
    this.play(together(Create(this.human), [Create(this.screen), 0.4, 1], [Create(this.keyboard), 0.5, 1]), 2)
    // The recursion lands: the beat-1 pair, now small, on the screen.
    this.play(together(Create(this.innerArena), [Create(this.innerAgent), 0.35, 1]), 1.8)
    // Sight and soul: the human looks, and pours.
    this.play(together(Create(this.sight1), Create(this.sight2), [FadeIn(this.inputLabel), 0.5, 1]), 1.4)
    this.play(Create(this.humanSoul), 1.4)
    this.wait(1)
    // The membrane, itemised.
    this.play(together(Write(this.ifaceTitle), [FadeIn(this.ifaceIn), 0.3, 1], [FadeIn(this.ifaceOut), 0.5, 1]), 2)
    this.wait(2)
    this.play(together(FadeOut(this.recursion), FadeOut(this.iface)), 1)

    // BEAT 8 — therefore.
    this.play(this.observer.zoom.to(1), 0.8)
    this.play(Write(this.macos), 1.8)
    this.wait(1.2)
    this.play(together(FadeOut(this.macos), [Create(this.dreamos), 0.2, 1]), 2.2)
    this.play(Write(this.explicit), 1.2)
    this.wait(2)
    this.play(together(UnCreate(this.dreamos), FadeOut(this.explicit)), 1.2)
  }
}
