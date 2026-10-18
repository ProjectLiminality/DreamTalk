/**
 * Attractor — one pole of the freedom-order dialectic, and the pathology it
 * falls into under fragmentation (docs/reports/interbrain-vocabulary.md
 * §4.1, "Chaos / Oppression — the two pathological attractors").
 *
 *   "Among the most fundamental of these seemingly conflicting values is
 *    the freedom-order dialectic" (0:56) — a red circle labelled *freedom*,
 *    a blue square labelled *order* (f346).
 *   "Freedom times fragmentation equals chaos, while order times
 *    fragmentation equals oppression" (1:57) — the circle radiating bolts,
 *    labelled *Chaos*; the square ringed by bolts, labelled *Oppression*
 *    (f541; David's 2024 DreamNode `ThirdAttractor` has the same two).
 *
 * ONE HOLON, `kind` chaos | oppression, because the value and its pathology
 * are ONE pole seen sober or fragmented: the film never draws Chaos anywhere
 * but where freedom stood (f480: the label crossfades in place, the bolts
 * burst out of it). So the pathology is ONE number that scrubs:
 *
 *   `pathology` 0  the value — *freedom* in red italic in the red circle,
 *                  *order* in blue italic in the blue square;
 *               1  the pathology — *Chaos* / *Oppression* in white italic,
 *                  a ring of eight Conflict bolts flown out round it
 *                  (Chaos's radiate, Oppression's strike inward).
 *
 * and a second look the film gives the same pole while the two values
 * attack each other (1:13–1:30, f391–f436): `armed` crossfades the circle /
 * square into a BLUE equilateral triangle (both triangles are blue in the
 * film, even freedom's), its apex at angle `aim` — pointing at the pole it
 * attacks, or away while it is attacked. The label stays.
 *
 * COMPOSED, NEVER REDRAWN. The circle and the square are the founding
 * holon's two (holons/Circle and holons/Square ARE the core Circle and
 * Square primitives, `class Circle extends CirclePart {}` — holons/ is
 * gitignored, so a tracked holon imports the primitive they anchor); the
 * bolts are `Conflict`'s own ring. Only the triangle and the labels are
 * this holon's.
 *
 * MEASURED (1280×720, the default eye's 0.48 px/unit), in units of R =
 * `size`, the circle's radius (f346: 84.5 px at its centreline):
 *
 *   SQUARE      side = 2R — the square circumscribes the circle (f346: 171
 *               px against the circle's 169; f1501: 108 against 110) — the
 *               founding pair at the one proportion where circle × square
 *               is a cylinder
 *   TRIANGLE    circumradius 2.2R (f391: side 326 px)
 *   BOLT        Conflict size 0.58R; ring radius 1.48R round the circle,
 *               1.52R (to the side) round the square (f541 — the numbers
 *               ConflictDemo measured, now in R)
 *   LABELS      Times Italic; *freedom* / *order* 0.41R, *Chaos* 0.5R,
 *               *Oppression* 0.36R (it must fit the square, f541)
 */

import { Null, Polygon, Square, Circle } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { angle, choice, completion, derive, length } from "../../src/params"
import { BLUE, PI, RED, TAU, WHITE } from "../../src/constants"
import { clamp01 } from "../../src/math"
import { ease } from "../../src/timeline"
import { restage, together, type Anim } from "../../src/anim"
import { axis, type StateSpace } from "../../src/automaton"
import { Conflict } from "../Conflict/Conflict"
import { presence } from "../../src/certainty"
import { Layer } from "../Figure/Figure"

/** The construction, in units of R = `size` (see header). */
export const ATTRACTOR = {
  /** The square's side over R: 2 — it circumscribes the circle. */
  square: 2,
  triangle: 2.2,
  bolt: 0.58,
  ringCircle: 1.48,
  ringSquare: 1.52,
  valueLabel: 0.41,
  chaosLabel: 0.5,
  oppressionLabel: 0.36,
  /** The labels' drop below the centre (f346: "freedom" spans 345–374 px about a centre at 360). */
  labelDrop: 0.115,
} as const

export const ATTRACTOR_KINDS = ["chaos", "oppression"] as const
export type AttractorKind = (typeof ATTRACTOR_KINDS)[number]

/** What each pole is called, sober and fragmented, and its colour. */
export const POLE = {
  chaos: { value: "freedom", pathology: "Chaos", tint: RED },
  oppression: { value: "order", pathology: "Oppression", tint: BLUE },
} as const

/** The film's label face: serif italic (f346, f541). */
export const LABEL_FONT = "Times-Italic"

/**
 * The pathology's three readings at p — how much of the value's label is
 * left, how much of the pathology's has arrived, and how far the bolts have
 * struck in and flown out. The labels cross in the middle (f480); the bolts
 * strike in over the first half and fly out over the whole (f484 → f496).
 */
export const pathologyAt = (p: number): { value: number; pathology: number; strike: number; spread: number } => {
  const u = clamp01(p)
  return {
    value: 1 - ease("smooth", clamp01((u - 0.2) / 0.5)),
    pathology: ease("smooth", clamp01((u - 0.3) / 0.5)),
    strike: clamp01(u / 0.4),
    spread: ease("smooth", u),
  }
}

export class Attractor extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** Which pole: chaos (freedom's, the red circle) or oppression (order's, the blue square). Fixed at compose. */
  kind = choice("chaos", ATTRACTOR_KINDS)
  /** R — the circle's radius (the square's half-side); every measure derives from it. */
  size = length(176)
  /** 0 the value (freedom / order) … 1 the pathology (Chaos / Oppression). Scrubs. */
  pathology = completion(0)
  /** 0 the circle / square … 1 the blue triangle the value turns into while it attacks (f391). */
  armed = completion(0)
  /** The triangle's apex turned (counter-clockwise) from its rest: chaos's points up, oppression's down (f391). */
  aim = angle(0)
  /** The labels shown (1) or not (0) — the oscillation's poles are bare (f736, f1306). */
  label = completion(1)
  /** The whole pole there (1) or gone (0) — inherited by every part, bolts and labels too. */
  presence = presence(1)
  /** Pen width in screen px — the film's lines are fine (f346: ≈ 2.3 px at 720p). */
  stroke = length(2.3)

  /** The circle (chaos) or square (oppression) — the founding pair's own. */
  shape!: Circle | Square
  triangle!: Polygon
  valueText!: Text
  pathologyText!: Text
  bolts!: Conflict
  /** The layers the readings fade (presence inherits: certainty.ts). */
  shapeLayer!: Layer
  triangleLayer!: Layer
  valueLayer!: Layer
  pathologyLayer!: Layer

  get poleKind(): AttractorKind {
    return this.kind.value as AttractorKind
  }

  protected override compose(): void {
    const kind = this.poleKind
    const pole = POLE[kind]
    const R = () => this.size.value
    const stroke = this.stroke
    const at = () => pathologyAt(this.pathology.value)

    this.shape =
      kind === "chaos"
        ? new Circle({ radius: derive(R), tint: pole.tint, stroke })
        : new Square({ size: derive(() => ATTRACTOR.square * R()), tint: pole.tint, stroke })
    this.shapeLayer = this.add(new Layer({ presence: derive(() => 1 - this.armed.value), members: [this.shape] }))

    const rest = kind === "chaos" ? PI / 2 : -PI / 2
    this.triangle = new Polygon({
      sides: 3,
      radius: derive(() => ATTRACTOR.triangle * R()),
      phase: derive(() => rest + this.aim.value),
      tint: BLUE,
      stroke,
    })
    this.triangleLayer = this.add(new Layer({ presence: derive(() => this.armed.value), members: [this.triangle] }))

    const pathologySize = kind === "chaos" ? ATTRACTOR.chaosLabel : ATTRACTOR.oppressionLabel
    this.valueText = new Text({
      content: pole.value,
      font: LABEL_FONT,
      size: derive(() => ATTRACTOR.valueLabel * R()),
      y: derive(() => -ATTRACTOR.labelDrop * R()),
      tint: pole.tint,
    })
    this.pathologyText = new Text({
      content: pole.pathology,
      font: LABEL_FONT,
      size: derive(() => pathologySize * R()),
      y: derive(() => -ATTRACTOR.labelDrop * R()),
      tint: WHITE,
    })
    this.valueLayer = this.add(
      new Layer({ presence: derive(() => this.label.value * at().value), members: [this.valueText] }),
    )
    this.pathologyLayer = this.add(
      new Layer({ presence: derive(() => this.label.value * at().pathology), members: [this.pathologyText] }),
    )

    this.bolts = this.add(
      new Conflict({
        size: derive(() => ATTRACTOR.bolt * R()),
        count: 8,
        radius: derive(() => (kind === "chaos" ? ATTRACTOR.ringCircle : ATTRACTOR.ringSquare) * R()),
        ring: kind === "chaos" ? "circle" : "square",
        // Chaos's bolts fly outward; Oppression's strike in at the square.
        direction: kind === "chaos" ? 0 : TAU / 2,
        creation: derive(() => at().strike),
        spread: derive(() => at().spread),
      }),
    )
  }

  /** Walkable (src/automaton.ts): the value ↔ its pathology. */
  override stateSpace(): StateSpace | undefined {
    if (this.pathology.isBound) return undefined
    const [sober, fragmented] = this.poleKind === "chaos" ? ["freedom", "chaos"] : ["order", "oppression"]
    return {
      axes: [axis("pathology", this, { [sober]: { pathology: 0 }, [fragmented]: { pathology: 1 } }, { duration: 1.4, handles: [this] })],
    }
  }

  /** The pole draws, its label writes (each seen as far as the state shows it). */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(this.presence.to(1), 0, 0.05),
      restage(this.shape.creation.sequence(0, 1), 0, 0.7),
      restage(this.triangle.creation.sequence(0, 1), 0, 0.7),
      restage(this.valueText.creation.sequence(0, 1), 0.35, 1),
      restage(this.pathologyText.creation.sequence(0, 1), 0.35, 1),
    )
  }

  override unCreateAnim(): Anim {
    void this.parts
    return together(
      this.shape.creation.to(0),
      this.triangle.creation.to(0),
      this.valueText.creation.to(0),
      this.pathologyText.creation.to(0),
      restage(this.presence.to(0), 0.6, 1),
    )
  }
}
