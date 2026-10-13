/**
 * Shot15Hero — shot 15 (≈130–146s): Web3 spreading light. The world inside a
 * flower of life, a bold red ring, and long white rays.
 *
 The node is the LightNode holon (vocabulary/LightNode) — the same symbol
 * as the yin-yang's red lobe and GlobeDemo's hero panel — at the reference's
 * proportions, measured on f_00136 at 1280w (scene units at this camera,
 * 1.28px each),
 *
 *   globe radius   ~107px  →  83
 *   red ring       ~253px  → 198   (= ClarityField's HERO_RING_RADIUS, which
 *                                    is where shot 14's swelling disc ends)
 *   rays           to ~313px → 245, twelve of them, the four on the axes
 *                  reaching a little further than the diagonals
 *   flower lattice circles of a third of the ring's radius
 *
 * and a white bloom around the globe. The bloom is concentric rings of
 * falling opacity rather than a filled disc — YinYang found a disc behind
 * the globe shows THROUGH its transparent ocean as a grey wash.
 *
 * Timing (refs at 4fps, 130–146s): the globe and its light come up out of
 * the swollen disc over ~1.25s, then the globe turns slowly and the image
 * holds until the wipe into the portrait at ~145.
 */

import { Dream } from "../../src/index"
import { together } from "../../src/anim"
import { LightNode } from "../../vocabulary/LightNode/LightNode"
import { HERO_RING_RADIUS } from "./ClarityField"

const GLOBE_R = 83

export class Shot15HeroDream extends Dream {
  node = new LightNode({
    radius: HERO_RING_RADIUS,
    globe: GLOBE_R / HERO_RING_RADIUS,
    spin: 0.15,
    tilt: 0.1,
    landOpacity: 0,
    bloomOpacity: 0,
    latticeOpacity: 0,
    rayOpacity: 0,
  })

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.node.seenFrom(this.observer)
    this.stage(this.node)
    this.play(
      together(
        this.node.landOpacity.to(1),
        this.node.bloomOpacity.to(1),
        this.node.latticeOpacity.to(0.55),
        [this.node.rayOpacity.to(0.85), 0.2, 1],
        this.node.spin.to(0.1, { easing: "linear" }),
      ),
      1.25,
    )
    // The globe keeps turning through the hold.
    this.play(this.node.spin.to(-0.25, { easing: "linear" }), 14.75)
  }
}
