/**
 * Mind — a person's consciousness, in the two states the InterBrain film
 * turns one into the other (docs/reports/interbrain-vocabulary.md §4.1,
 * "Mind — domesticated / liminal"):
 *
 *   DOMESTICATED (`liminal` 0) — David's 2024 DreamNode `DomesticatedMind`:
 *     the bust with a blue perspective cube around its head, the narrative
 *     it is held in. Framed (`framed` 1) it stands in a blue equilateral
 *     triangle — David's `MolochConsciousness`, the unit the War Machine is
 *     built of ("captured minds", 13:03; f1861, f3676, f7021 left, f5221).
 *   LIMINAL (`liminal` 1) — an agent of wholeness: the cube is gone, the red
 *     Vision shines in the head, and the frame is a red circle (f7021 right,
 *     f8221, f6106, f13111).
 *
 * The film morphs the one into the other twice — the arrow at f7021 and the
 * war machine's minds at 2595–2630 — so the state is ONE number that scrubs:
 * the cube fades as it lifts off the head, the Vision fades in where the
 * cube held the head, the frame's outline slides from the triangle onto the
 * circle (radius by radius, about the moving centre) while its colour turns
 * blue → red.
 *
 * COMPOSED, NEVER REDRAWN. The person is `Figure` in its bust form (THE
 * person); the cube is `Narrative` — a FoldableCube (DomesticatedMind.py:
 * `FoldableCube(color=BLUE, bottom=False)` — ours keeps its bottom, which is
 * the back square the film shows); the mark is `Vision`. Only the frame is
 * this holon's own line.
 *
 * THE CUBE'S DEPTH. The cube is `Narrative` — the film's own symbol for
 * it — bare (no ring) and blue: FoldableCube at fold 1 (the closed cup),
 * its open side toward the viewer and its rim in the person's plane,
 * tapered so that seen front-on its back square is the film's 0.716 of
 * the front (f7021; Narrative's header) rather than the ≈ 0.94 a true
 * head-sized box shows from a camera 1500 units off. It stays an honest
 * 3D solid: off-centre minds see it from the side, as a box would be seen.
 *
 * MEASURED off f7021 (1280×720), in units of R — the liminal circle's
 * centreline radius (125.5 px), which is `size`. The origin is the person:
 * the bust's centre.
 *
 *   BUST          bust height (crown to shoulders' ends) 96 px → 0.765·R
 *   CIRCLE_Y      the circle's centre, 4 px below the bust's → −0.03·R
 *   TRI_RADIUS    the triangle's circumradius: side 250 px → 144 px → 1.15·R
 *   TRI_Y         its centroid, 9 px below the bust's centre → −0.07·R
 *   CUBE_RIM      the cube's front square, 75 px → 0.78 of the bust
 *   CUBE_Y        its centre, 32 px below the crown → 0.17 of the bust above
 *                 the bust's centre (its top edge clears the crown by 5 px)
 *   VISION_R      the S's height 19 px ≈ 1.3·r → r = 0.15 of the bust
 *   VISION_Y      its centre 18.5 px below the crown → 0.31 of the bust above
 *                 the bust's centre
 */

import { Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, derive, length } from "../../src/params"
import { BLUE, PI, RED, WHITE, type Color } from "../../src/constants"
import { lerp } from "../../src/math"
import { type Anim, restage, together } from "../../src/anim"
import { Create } from "../../src/verbs"
import { axis, type StateSpace } from "../../src/automaton"
import { Figure, Layer } from "../Figure/Figure"
import { FoldableCube } from "../FoldableCube/FoldableCube"
import { Narrative } from "../Narrative/Narrative"
import { FILM_BAND, Vision } from "../Vision/Vision"

/** The construction, in units of R = `size` (see header). */
export const MIND = {
  bust: 0.765,
  circleY: -0.03,
  triRadius: 1.15,
  triY: -0.07,
  /** These three in units of the bust's height. */
  cubeRim: 0.78,
  cubeY: 0.17,
  visionR: 0.15,
  visionY: 0.31,
  /** How far the cube lifts (units of the bust) as it lets the head go. */
  cubeLift: 0.35,
} as const


/** Samples round the frame — a multiple of 3, so the triangle's corners are samples. */
const FRAME_SAMPLES = 120

/**
 * The frame's closed outline at state `l` (0 triangle … 1 circle), for a
 * mind of size R: each sample is a ray from the frame's centre at angle θ,
 * its length sliding from the triangle's (inradius / cos of the angle to
 * the nearest edge normal) to the circle's R. Starts and ends at the apex.
 */
export const frameOutline = (R: number, l: number): Vec3Like[] => {
  const rt = MIND.triRadius * R
  const inr = rt / 2
  const cy = lerp(MIND.triY, MIND.circleY, l) * R
  const pts: Vec3Like[] = []
  for (let i = 0; i <= FRAME_SAMPLES; i++) {
    const a = PI / 2 + (2 * PI * i) / FRAME_SAMPLES
    // Edge normals at −90°, 30°, 150°: the nearest is within ±60° of θ.
    const sector = (2 * PI) / 3
    const rel = ((((a + PI / 2 + PI / 3) % sector) + sector) % sector) - PI / 3
    const r = lerp(inr / Math.cos(rel), R, l)
    pts.push({ x: r * Math.cos(a), y: cy + r * Math.sin(a), z: 0 })
  }
  return pts
}

const mix = (a: Color, b: Color, u: number): Color => ({
  r: lerp(a.r, b.r, u),
  g: lerp(a.g, b.g, u),
  b: lerp(a.b, b.b, u),
})

export class Mind extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** R — the liminal circle's radius; every other measure derives from it. */
  size = length(160)
  /** 0 domesticated (DomesticatedMind) … 1 liminal. Scrubs. */
  liminal = completion(0)
  /** 0 unframed … 1 in its frame (triangle when domesticated — MolochConsciousness — circle when liminal). */
  framed = completion(1)
  /** The person's ink. */
  tint = color(WHITE)
  /** Pen width in screen px, for the person, the cube and the frame — the
   *  film's lines are finer than the framework's default 3 (f7021). */
  stroke = length(2.2)

  /** Walkable (src/automaton.ts): domesticated ↔ liminal, unframed ↔ framed. */
  override stateSpace(): StateSpace | undefined {
    const axes = []
    if (!this.liminal.isBound)
      axes.push(axis("liminal", this, { domesticated: { liminal: 0 }, liminal: { liminal: 1 } }, { duration: 2, handles: [this] }))
    if (!this.framed.isBound)
      axes.push(axis("framed", this, { unframed: { framed: 0 }, framed: { framed: 1 } }, { duration: 0.8, handles: [this] }))
    return axes.length ? { axes } : undefined
  }

  /** The cube, in the layer that fades and lifts it as the mind turns liminal. */
  narrative!: Layer
  /** The Narrative round the head (bare, blue) and its FoldableCube. */
  cage!: Narrative
  cube!: FoldableCube
  /** The frame's one outline, triangle ↔ circle, in its framed layer. */
  frameLayer!: Layer
  frame!: Line
  person!: Figure
  vision!: Vision

  /** The triangle's side, for composers tiling minds (divide and conquer). */
  get triangleSide(): number {
    return Math.sqrt(3) * MIND.triRadius * this.size.value
  }

  protected override compose(): void {
    const R = this.size.value
    const hb = MIND.bust * R
    const l = this.liminal
    const stroke = this.stroke

    // The cube first: attach order is composite order, and the person's
    // black silhouette must cover the cube's back where the head is.
    const edge = MIND.cubeRim * hb
    // Bare and blue: the narrative a domesticated mind is held in.
    this.cage = new Narrative({ size: edge, ring: derive(() => 0), tint: BLUE, stroke })
    void this.cage.parts
    this.cube = this.cage.cube
    this.narrative = this.add(
      new Layer({
        y: derive(() => (MIND.cubeY + MIND.cubeLift * l.value) * hb),
        presence: derive(() => 1 - l.value),
        members: [this.cage],
      }),
    )

    this.frame = new Line({
      tint: derive(() => mix(BLUE, RED, l.value)),
      stroke,
    })
    derivePoints(this.frame, () => [l.value], () => frameOutline(R, l.value))
    this.frameLayer = this.add(new Layer({ presence: derive(() => this.framed.value), members: [this.frame] }))

    this.person = this.add(
      new Figure({ height: hb, form: derive(() => 1), opaque: 1, tint: this.tint, stroke }),
    )

    this.vision = this.add(
      new Vision({
        radius: MIND.visionR * hb,
        y: MIND.visionY * hb,
        weight: FILM_BAND,
        presence: derive(() => l.value),
      }),
    )
  }

  /** The person draws, the cube closes round the head, the frame draws on
   *  around them; the Vision writes itself (seen only as far as `liminal`). */
  override createAnim(): Anim {
    void this.parts // compose() is lazy: the parts exist once it has run
    return together(
      restage(Create(this.person), 0, 0.55),
      restage(Create(this.narrative), 0.3, 0.8),
      restage(this.frame.creation.sequence(0, 1), 0.45, 1),
      restage(Create(this.vision), 0.5, 1),
    )
  }
}
