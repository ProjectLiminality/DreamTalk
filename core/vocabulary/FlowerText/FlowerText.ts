/**
 * FlowerText — a word made of small circles that self-organise out of a
 * scattered cloud.
 *
 * The "Web3" set-piece from the Liminal Consulting Web3 video (docs/reports/
 * web3-recon.md §C), which David asked to exist as a reusable holon and about
 * whose MECHANISM he was emphatic — it is NOT a particle simulation:
 *
 *   "don't try to get random particles through attractors to self-organize …
 *    that's where you're fighting entropy, basically, and it's much harder.
 *    The circles are spawned as a flower-of-life packing masked to the text,
 *    then displaced by a noise pattern; animating the noise amount to zero
 *    makes them appear to self-organise."
 *
 * So the ORGANISED state is computed first — `hexPack` fills the mask with a
 * hex (flower-of-life) lattice of centres — and the scatter is those centres
 * pushed off their spots by a seeded noise field. `src/geometry/flower.ts`
 * is the mathematics (packing, even-odd mask test, deterministic scatter);
 * this is the drawing: one small Circle per centre, each riding home.
 *
 * ONE PARAM DRIVES EVERYTHING: `settle`
 *
 * `settle` ∈ [0, 1] is the noise amount, inverted: 0 is fully scattered, 1
 * is the crisp word. Animate it 0 → 1 (with an ease-out on the scene's
 * side — see FlowerTextDemo) and the cloud gathers into the letters. Every
 * circle's position is derived from `settle` through the same pure
 * `scatteredPosition` the tests pin, so the holon is a pure function of one
 * number and scrubs backwards exactly — the FourierTrace `turn` pattern.
 *
 * THE MASK IS DATA
 *
 * `mask` is a list of closed polygons — an SVG's flattened subpaths, exactly
 * what `importSvg` returns, letter counters included. It is passed in rather
 * than measured from a live font because glyph shaping is asynchronous and a
 * holon composes synchronously (the constraint Quote and Text both document).
 * Handing in polygons is the honest option: testable, deterministic, and it
 * makes FlowerText work for ANY shape, not only text — a silhouette, a logo,
 * a symbol — which is the reusable essence.
 *
 * WHY RINGS, NOT DISCS
 *
 * The reference's circles are outline ringlets, not filled dots (look at
 * web3form_00061 — you can see through each one to its neighbours). So each
 * circle is a Circle stroke at `circleRadius`, and their overlap at
 * flower-of-life spacing gives the woven, translucent letter the reference
 * shows.
 */

import { Group, Null, Circle } from "../../src/parts/primitives"
import { color, completion, integer, length } from "../../src/params"
import { RED, type Color } from "../../src/constants"
import {
  hexPack,
  scatteredPosition,
  type Vec2,
} from "../../src/geometry/flower"

export class FlowerText extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /**
   * The shape to fill, as closed polygons in scene units — typically the
   * subpaths of an imported SVG. Data, like `Line.points`. Empty means
   * nothing to pack, and the holon composes to an empty (but present) group.
   */
  mask: Vec2[][] = []

  /** Radius of each little circle. The reference's ringlets are small. */
  circleRadius = length(9)

  /**
   * Centre-to-centre distance in the flower-of-life lattice. Usually a touch
   * under twice `circleRadius`, so neighbours overlap and the letter reads as
   * a woven field rather than separate dots.
   */
  spacing = length(11)

  /**
   * Keep packed centres at least this far inside the mask edge, so circles do
   * not hang off the letterform's rim. 0 packs right to the boundary.
   */
  margin = length(0)

  /**
   * The effect. 0 = fully scattered cloud, 1 = crisp word. Animate 0 → 1
   * with an ease-out. Named for what it DOES (the letters settle), which is
   * the inverse of the noise amount the original keyframed.
   */
  settle = completion(0)

  /**
   * How far a circle is flung at settle = 0, in scene units — the radius of
   * the scattered cloud around each circle's home. The reference scatters
   * roughly a word-height out.
   */
  scatterDistance = length(220)

  /**
   * The smallest scatter distance, so some circles start far and some near —
   * the loose, uneven cloud the reference shows rather than a clean halo.
   */
  scatterMin = length(20)

  /**
   * Seed for the deterministic scatter. Changing it reshuffles which circle
   * goes where without changing the settled word; the SAME seed always gives
   * the SAME scatter, which is what makes the scene reproducible.
   */
  seed = integer(1)

  /** The settled word's colour — the reference's Web3 red. */
  tint = color(RED)

  /** Ring stroke width. */
  stroke = length(2)

  /** How opaque the rings are (the reference's are translucent, overlapping). */
  circleOpacity = completion(0.9)

  /** The packed centres, in packing order — the settled positions. */
  centres: Vec2[] = []
  circles: Circle[] = []
  field!: Group

  /** How many circles the mask packed into — handy for scenes and tests. */
  get count(): number {
    return this.centres.length
  }

  protected override compose(): void {
    this.centres = hexPack(this.mask, {
      spacing: this.spacing.value,
      margin: this.margin.value,
    })

    const seed = Math.round(this.seed.value)
    const dist = this.scatterDistance.value
    const dmin = Math.min(this.scatterMin.value, dist)

    this.circles = this.centres.map((final, i) => {
      // Each circle's x and y are DERIVED from `settle` through the same pure
      // scatteredPosition the tests pin, so the drawing cannot drift from the
      // maths. settle = 1 lands exactly on `final`.
      const at = (): Vec2 => scatteredPosition(final, i, seed, dist, this.settle.value, dmin)
      return new Circle({
        radius: this.circleRadius,
        tint: this.tint,
        stroke: this.stroke,
        opacity: this.circleOpacity,
        x: this.settle.map(() => at().x),
        y: this.settle.map(() => at().y),
      })
    })

    this.field = this.add(new Group({ members: this.circles }))
  }

  /** A circle's live position at the current `settle` — for anything riding it. */
  positionOf(i: number): Vec2 {
    const final = this.centres[i]
    if (!final) return { x: 0, y: 0 }
    return scatteredPosition(
      final,
      i,
      Math.round(this.seed.value),
      this.scatterDistance.value,
      this.settle.value,
      Math.min(this.scatterMin.value, this.scatterDistance.value),
    )
  }
}
