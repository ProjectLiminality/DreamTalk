/**
 * InfinitePatience.ts — A DreamWeaving
 *
 * "Infinite patience produces immediate results." — A Course in Miracles
 *
 * A mathematical metaphor for a mystical claim, from David (2026-09-24). The
 * line sounds like a paradox and the geometry shows that it is not: near a
 * singularity, the average rate of approach is infinite from ANY starting
 * point, however distant. The sentence is a description of an asymptote.
 *
 * THE FIGURE
 *
 *   x is time, running left to right toward a singularity at x = 0 — the
 *     holy instant, the moment of salvation.
 *   y is whatever grows toward salvation. Joy, say. Its name matters less
 *     than its behaviour: it diverges. We plot y = −1/x, positive on the
 *     negative axis and unbounded as x → 0⁻.
 *
 * A right triangle grows beneath the curve. Its left foot is fixed at the
 * start of the journey (x = −1); its right foot travels with time; its height
 * is the curve's value there. The HYPOTENUSE is therefore the average rate of
 * gain across the whole journey so far — what you would have felt if the joy
 * had arrived evenly.
 *
 * THE PARADOX, WHICH IS THE POINT
 *
 * For any finite height, that hypotenuse has a finite slope: things got
 * better at some rate, gradually, the way patience is usually imagined. But
 * as the right foot reaches the singularity, the height diverges and the
 * hypotenuse stands VERTICAL.
 *
 * And — this is the part worth sitting with — it stands vertical no matter
 * where the left foot is. At x = −1, at x = −10, at x = −10 billion: the
 * average slope over the whole journey is infinite in every case. The instant
 * transcends time, and so it affects ALL of time equally. There is no
 * gradualness anywhere in it. Immediate results, from infinite patience.
 *
 * WHAT THE SCENE DOES ABOUT THE SECOND FOOT
 *
 * The claim "and this is true no matter where you start" cannot be shown by
 * one triangle, so the song shows a second one, starting much further left,
 * and lets both hypotenuses go vertical together. That is the difference
 * between illustrating a formula and making an argument.
 *
 * THE TWO FIGURES
 *
 * A person stands at the start of the journey in BLUE; a second copy travels
 * with the moving foot and turns RED as it nears the singularity. Blue is the
 * one who waits; red is the same one arriving. They are the SAME symbol —
 * `vocabulary/Figure`, shared with the agent-arena song — because David asked
 * that a person be one symbol everywhere, so that redrawing it once redraws
 * every DreamSong that shows a person.
 *
 * WHAT IS DELIBERATELY APPROXIMATE
 *
 * The curve is clipped at the top of its box (Plot clamps rather than drops,
 * so the asymptote runs up the wall and leaves). The triangle's apex rides
 * the CLAMPED height, so past a certain moment the drawn height stops growing
 * while the true value does not. That is honest rather than convenient: no
 * screen can show a divergence, and the vertical hypotenuse — which IS the
 * claim — arrives exactly when it should either way.
 */

import { Dream } from "../../src/index"
import { Null } from "../../src/parts/primitives"
import { Text, Write } from "../../src/parts/text"
import { Create, FadeIn, FadeOut } from "../../src/verbs"
import { together } from "../../src/anim"
import { BLUE, RED, WHITE } from "../../src/constants"
import { Figure } from "../../vocabulary/Figure/Figure"
import { Plot } from "../../vocabulary/Plot/Plot"
import { RightTriangle } from "../../vocabulary/RightTriangle/RightTriangle"

/** The journey's span. x = 0 is the singularity; we stop just short of it. */
const X_START = -1
const X_END = -0.012
/** How high the plot's window reaches, in graph units. */
const Y_TOP = 14

/** The plot's box, in scene units. */
const PLOT_W = 780
const PLOT_H = 430

/** The far-back second journey, to show the claim is start-independent. */
const X_FAR = -0.86

/** y = −1/x: positive on the negative axis, unbounded as x → 0⁻. */
const joy = (x: number): number => -1 / x

export class InfinitePatienceDream extends Dream {
  plot = new Plot({
    // Starts invisible: the axes fade in as their own beat, before the curve
    // is drawn. (A holon's PARTS do not exist until the dream builds, so a
    // scene cannot address `plot.axes` in unfold() — it addresses the plot.)
    opacity: 0,
    fn: joy,
    domain: [X_START, X_END],
    range: [0, Y_TOP],
    width: PLOT_W,
    height: PLOT_H,
    curveTint: WHITE,
    stroke: 3,
    samples: 1400,
  })

  /**
   * Drives the journey: 0 at the start, 1 at the singularity.
   *
   * `creation` defaults to 1, so a Null used as a driver starts at its END
   * state — which had the triangles fully grown before the journey animated
   * at all. A driver must be explicitly zeroed.
   */
  journey = new Null({ creation: 0 })

  /** The triangle from the journey's start. */
  near = new RightTriangle({ stroke: 3, hypotenuseTint: WHITE })
  /** A second, from much further back — the claim is start-independent. */
  far = new RightTriangle({
    stroke: 2.4,
    hypotenuseTint: { r: 0.55, g: 0.62, b: 0.75 },
    legTint: { r: 0.3, g: 0.32, b: 0.38 },
  })

  /** The one who waits, and the same one arriving. */
  waiting = new Figure({ height: 84, tint: BLUE, creation: 0 })
  arriving = new Figure({ height: 84, tint: BLUE, opacity: 0 })

  xLabel = new Text({ content: "time", size: 26, tint: { r: 0.5, g: 0.5, b: 0.55 }, opacity: 0 })
  yLabel = new Text({ content: "joy", size: 26, tint: { r: 0.5, g: 0.5, b: 0.55 }, opacity: 0 })
  instant = new Text({ content: "the holy instant", size: 30, tint: RED, opacity: 0 })

  private root = new Null()

  constructor() {
    super()
    // Everything below is DERIVED from `journey`, so the whole song is a pure
    // function of one number and scrubs backwards exactly.
    const nowX = () => X_START + (X_END - X_START) * this.journey.creation.value

    // The near triangle: left foot fixed at the start, right foot travelling.
    const footNear = this.plot.at(X_START, 0)
    this.near.foot = { x: footNear.x, y: footNear.y }
    this.near.base.follow(
      this.journey.creation.map(() => this.plot.at(nowX(), 0).x - footNear.x),
    )
    this.near.rise.follow(
      this.journey.creation.map(() => this.plot.at(nowX(), joy(nowX())).y - footNear.y),
    )

    // The far triangle: the same construction from a different start.
    const footFar = this.plot.at(X_FAR, 0)
    this.far.foot = { x: footFar.x, y: footFar.y }
    this.far.base.follow(
      this.journey.creation.map(() => Math.max(0, this.plot.at(nowX(), 0).x - footFar.x)),
    )
    this.far.rise.follow(
      this.journey.creation.map(() =>
        Math.max(0, this.plot.at(nowX(), joy(nowX())).y - footFar.y),
      ),
    )

    // The waiting figure stands at the start, on the axis.
    //
    // NOTE, learned the hard way: `holon.x = 5` REPLACES the Param object with
    // a plain number and destroys the param. Positions are set through
    // `.value` (a constant) or `.follow()` (a derived reading) — never by
    // assignment.
    this.waiting.x.value = footNear.x
    this.waiting.y.value = footNear.y + 42

    // The travelling figure rides the moving foot, and reddens as it nears
    // the singularity — the colour IS the approach, not a decoration on it.
    this.arriving.x.follow(this.journey.creation.map(() => this.plot.at(nowX(), 0).x))
    this.arriving.y.value = footNear.y + 42
    this.arriving.tint.follow(this.journey.creation.map((j) => {
      // Ease the reddening late, so the change reads as arrival rather than
      // as a slow crossfade across the whole journey.
      const u = Math.min(1, Math.max(0, (j - 0.25) / 0.75)) ** 1.6
      return {
        r: BLUE.r + (RED.r - BLUE.r) * u,
        g: BLUE.g + (RED.g - BLUE.g) * u,
        b: BLUE.b + (RED.b - BLUE.b) * u,
      }
    }))

    // Labels, placed off the plot's own box.
    this.xLabel.x.value = 0
    this.xLabel.y.value = -PLOT_H / 2 - 44
    this.yLabel.x.value = PLOT_W / 2 + 40
    this.yLabel.y.value = PLOT_H / 2 - 16
    this.instant.x.value = PLOT_W / 2 - 4
    this.instant.y.value = -PLOT_H / 2 - 44
  }

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.root)
    this.stage(this.plot)
    this.stage(this.near)
    this.stage(this.far)
    this.stage(this.waiting)
    this.stage(this.arriving)
    this.stage(this.xLabel)
    this.stage(this.yLabel)
    this.stage(this.instant)

    // --- the claim ------------------------------------------------------
    this.say("Infinite patience produces immediate results.", { hold: true })

    // --- the axes, and what they mean ------------------------------------
    this.say("Here is time, running toward a single moment.", { hold: true })
    this.play(together(FadeIn(this.plot), FadeIn(this.xLabel), FadeIn(this.yLabel)), 1.6)
    this.say("And here is joy — whatever it is in you that grows toward salvation.", {
      hold: true,
    })
    this.wait(0.4)

    // --- someone waiting --------------------------------------------------
    this.say("Someone begins the journey.", { hold: true })
    this.play(Create(this.waiting), 1.2)
    this.wait(0.5)

    // --- the curve --------------------------------------------------------
    this.say("The closer the moment comes, the steeper the growth — without limit.", {
      hold: true,
    })
    this.play(
      together(
        this.plot.reveal.to(1, { easing: "linear" }),
        this.journey.creation.to(1, { easing: "linear" }),
        [FadeIn(this.arriving), 0, 0.08],
      ),
      9,
    )
    this.wait(0.8)

    // --- the paradox ------------------------------------------------------
    this.say(
      "The hypotenuse is the average rate of gain across the whole journey.",
      { hold: true },
    )
    this.say(
      "At the instant itself it stands vertical — and it stands vertical however far back you begin.",
      { hold: true },
    )
    this.play(FadeIn(this.instant), 1.2)
    this.wait(1.2)
    this.say(
      "A moment outside of time changes all of time. There was never anything gradual in it.",
      { hold: true },
    )
    this.wait(1.5)

    this.play(
      together(
        FadeOut(this.plot),
        FadeOut(this.near),
        FadeOut(this.far),
        FadeOut(this.waiting),
        FadeOut(this.arriving),
        FadeOut(this.xLabel),
        FadeOut(this.yLabel),
        FadeOut(this.instant),
      ),
      1.6,
    )
  }
}
