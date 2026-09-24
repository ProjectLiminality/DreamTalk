/**
 * ClarityField — shots 7 and 8: complexity, and the clarity inside it.
 *
 * The turn of the Liminal Consulting Web3 argument. The word "Web3" bursts
 * into a vast red field of flower-of-life ringlets — thousands of them, dense
 * at the centre, fading to grey at the rim (shot 7, 43–52s). Then the field
 * dims and a blue-ringed disc of bright dots crystallises at its heart: the
 * "clarity behind complexity" (shot 8, 52–66s).
 *
 *   docs/reports/web3-recon.md shots 7–8. Colours measured from the frames:
 *   red core #7a2a24, grey rim #999, blue ring #2f8fe0, white dots #fff.
 *
 * WHY THIS IS A SCENE AND NOT A HOLON
 *
 * It is `hexPack` (already built for FlowerText) over a disc mask, plus a
 * ring and a second, tighter pack. Nothing here is a new capability — the
 * campaign map's test is whether the *parameterisation* is the interesting
 * thing, and here it is not: what is interesting is this particular
 * composition, which is exactly what a scene is for. Had the field been made
 * a holon, its knobs would have been "how red" and "how many" — a worse
 * FlowerText with a disc instead of letters.
 *
 * THE DENSITY FALLOFF, AND WHY IT IS OPACITY AND NOT SPACING
 *
 * The reference field is DENSEST AT THE CENTRE and thins to a grey halo. A
 * hex pack is uniform by construction, so the gradient has to come from
 * somewhere. Two options: vary the spacing radially (a genuinely non-uniform
 * pack), or pack uniformly and fade the ringlets outward.
 *
 * Fading wins, and not only because it is simpler. A radially-varying pack
 * destroys the flower-of-life lattice — the thing the whole motif is ABOUT —
 * because the lattice only exists when every circle is the same distance from
 * its neighbours. The reference keeps its lattice visible right to the rim;
 * it is the brightness that falls away, not the geometry. So: uniform pack,
 * radial opacity and tint.
 *
 * ONE PARAM PER BEAT
 *
 * `burst` grows the field from nothing; `clarity` brings the inner disc in
 * and dims the field around it. Each is a pure function of one number, the
 * same shape as FourierTrace's `turn` and FlowerText's `settle`.
 */

import { Dream } from "../../src/index"
import { Circle, Group, Null } from "../../src/parts/primitives"
import { hexPack, type Vec2 } from "../../src/geometry/flower"
import { rgb } from "../../src/constants"

/**
 * Measured from the reference frames (recon shots 7–8) — and then two of them
 * DELIBERATELY DEPARTED FROM, for the reason below.
 *
 * The measured core colour is #7a2a24 — but that is the colour of the FIELD
 * as photographed, after the original's bloom and compositing flattened it.
 * Drawn literally at these stroke widths it reads as near-black. The ringlet
 * INK has to be brighter than the field it averages to, which is why this is
 * lifted rather than copied.
 */
const RED_CORE = rgb(0xc4, 0x46, 0x3a)
const RIM_GREY = rgb(0x6e, 0x6e, 0x72)
const CLARITY_BLUE = rgb(0x2f, 0x8f, 0xe0)
const DOT_WHITE = rgb(0xff, 0xff, 0xff)

/** The complexity field's reach, and the clarity disc's. */
const FIELD_RADIUS = 330
const CLARITY_RADIUS = 96

/** A disc as a polygon, for hexPack's mask. */
const disc = (radius: number, segments = 96): Vec2[] =>
  Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius }
  })

/** Linear blend between two colours — the rim fade. */
const mix = (a: { r: number; g: number; b: number }, b: typeof a, u: number) => ({
  r: a.r + (b.r - a.r) * u,
  g: a.g + (b.g - a.g) * u,
  b: a.b + (b.b - a.b) * u,
})

export class ClarityFieldDream extends Dream {
  /** Shot 7: the field bursts outward. */
  burst = new Null()
  /** Shot 8: the clarity disc crystallises and the field dims around it. */
  clarity = new Null()

  field!: Group
  inner!: Group
  ring!: Circle

  private root = new Null()

  constructor() {
    super()
    // --- the complexity field -----------------------------------------
    // Uniform flower-of-life pack over the whole disc; the falloff is in
    // opacity and tint, never in spacing (see the header).
    const centres = hexPack([disc(FIELD_RADIUS)], { spacing: 17 })
    const rings = centres.map((c) => {
      const d = Math.hypot(c.x, c.y) / FIELD_RADIUS
      return new Circle({
        radius: 9,
        x: c.x,
        y: c.y,
        // Red at the core, grey at the rim — the reference's halo.
        tint: mix(RED_CORE, RIM_GREY, Math.min(1, Math.max(0, (d - 0.55) / 0.45))),
        stroke: 1.6,
        // Dense and bright in the middle, thin at the edge.
        opacity: this.fieldOpacityAt(d),
      })
    })
    this.field = new Group({ members: rings })

    // --- the clarity disc ---------------------------------------------
    // A tighter pack of bright dots, inside its own blue ring. Filled,
    // not outlined: the reference reads as DOTS against the field's
    // ringlets, and that contrast is the point of the shot.
    const dots = hexPack([disc(CLARITY_RADIUS - 8)], { spacing: 13 }).map(
      (c) =>
        new Circle({
          radius: 2.6,
          x: c.x,
          y: c.y,
          tint: DOT_WHITE,
          fillOpacity: 1,
          stroke: 1,
          opacity: this.clarityOpacity,
        }),
    )
    this.inner = new Group({ members: dots })
    this.ring = new Circle({
      radius: CLARITY_RADIUS,
      tint: CLARITY_BLUE,
      stroke: 3,
      opacity: this.clarityOpacity,
    })
  }

  /**
   * A ringlet's opacity: how bright it is at rest, scaled by the burst and
   * dimmed once clarity arrives.
   *
   * The dimming is what makes the shot legible — the field must recede for
   * the disc to read as clarity rather than as one more dense patch.
   */
  private fieldOpacityAt(d: number) {
    const atRest = 1 - 0.45 * d * d
    return this.burst.creation.map((b) =>
      // Ringlets appear from the centre outward, so the burst reads as
      // expansion rather than as a uniform fade-up.
      Math.max(0, Math.min(1, (b - d * 0.45) / 0.55)) *
      atRest *
      (1 - 0.55 * this.clarity.creation.value),
    )
  }

  private get clarityOpacity() {
    return this.clarity.creation.map((c) => Math.max(0, Math.min(1, c)))
  }

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.root)
    this.stage(this.field)
    this.stage(this.ring)
    this.stage(this.inner)

    // Shot 7 — the burst. Fast out of the word, then settling.
    this.say("The word bursts into complexity.")
    this.play(this.burst.creation.to(1), 4)
    this.wait(1.5)

    // Shot 8 — the clarity inside it.
    this.say("And inside the complexity, clarity.", { hold: true })
    this.play(this.clarity.creation.to(1), 3.5)
    this.wait(3)
  }
}
