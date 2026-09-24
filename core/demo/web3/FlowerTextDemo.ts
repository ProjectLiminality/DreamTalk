/**
 * FlowerTextDemo — the "Web3" self-organising circles, proving the holon.
 *
 * The set-piece from the Liminal Consulting Web3 video (docs/reports/
 * web3-recon.md §C): the word "Web3" made of hundreds of small red circles
 * in a flower-of-life packing, scattered at the start and gathering into the
 * letters over ~6-8s with an ease-out settle.
 *
 * THE MASK. `web3-mask.json` holds the real Arimo glyph outlines of "Web3"
 * as flattened polygons (letter counters included), generated offline from
 * the bundled font — see scripts/gen-web3-mask.ts. It is JSON rather than a
 * live shape because glyph shaping is asynchronous and a holon composes
 * synchronously; handing FlowerText a list of polygons is the honest, exact
 * mask (the same subpath data `importSvg` produces), and keeps the effect
 * deterministic. The polygons are in font units, so the demo flips y (font
 * y is up, but harfbuzz outlines here need centring) and scales to a target
 * height in scene units.
 *
 * THE EASE-OUT lives HERE, not in the holon: `settle` animates 0 → 1 with an
 * ease-out so the cloud rushes together and arrives gently — the reference's
 * settle. FlowerText itself stays a pure function of `settle`.
 */

import { Dream } from "../../src/index"
import { Null } from "../../src/parts/primitives"
import { FlowerText } from "../../vocabulary/FlowerText/FlowerText"
import type { Vec2 } from "../../src/geometry/flower"
import { web3MaskData } from "./web3-mask"

/**
 * The mask, centred on the origin and scaled so the word is `height` tall in
 * scene units. Font outlines come in y-up already, so no flip — only centre
 * and scale, uniformly, to preserve the letterforms.
 */
const web3Mask = (height: number): Vec2[][] => {
  const { bounds, polygons } = web3MaskData
  const h = bounds.maxY - bounds.minY
  const scale = height / h
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  return polygons.map((poly) => poly.map((p) => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale })))
}

export class FlowerTextDemoDream extends Dream {
  // Word ~220 units tall → roughly the reference's frame-filling word at
  // this camera. Small circles at flower-of-life spacing pack it densely.
  word = new FlowerText({
    mask: web3Mask(220),
    circleRadius: 6,
    spacing: 7.5,
    settle: 0,
    scatterDistance: 260,
    scatterMin: 25,
    seed: 7,
    stroke: 1.5,
    circleOpacity: 0.85,
  })

  private root = new Null()

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.root)
    this.stage(this.word)
    // Start scattered, hold a beat so the cloud is legible, then gather with
    // an ease-out — the reference's ~6-8s settle.
    this.wait(0.8)
    this.play(this.word.settle.to(1, { easing: "easeOut" }), 7)
    this.wait(2)
  }
}
