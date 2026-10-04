/**
 * Shot01Globe — shot 1 of the Liminal Consulting Web3 video (0–4.5s): the
 * world, alone, before the argument begins.
 *
 * refs/web3/frames f_00001–f_00004 and frames at 4fps (0–5s):
 *
 *   0–1s   a dark grey globe on black (Indonesia/Australia face), its limb a
 *          thin grey ring;
 *   1–3.5s the land brightens toward white — in the original a terminator
 *          sweeps across it under C4D lighting, which this host has no
 *          lights to reproduce, so the brightening is the land's tint;
 *   3.5–4.5 the limb is a clean white ring; the globe then divides into the
 *          two globes that open the yin-yang (the next chapter).
 *
 * Measured: limb radius ~260px at 1280w ≈ 203 scene units at this camera.
 *
 * A composition of the Globe holon only — nothing new. The face is chosen by
 * `spin`: the centre longitude is −spin, so −1.95 rad (≈112°E) puts India
 * left of centre and Australia lower right, as in f_00003.
 */

import { Dream } from "../../src/index"
import { together } from "../../src/anim"
import { Globe } from "../../vocabulary/Globe/Globe"
import { rgb } from "../../src/constants"

export class Shot01GlobeDream extends Dream {
  globe = new Globe({
    radius: 203,
    continents: "fill",
    land: rgb(0x33, 0x33, 0x33),
    limbStroke: 1.5,
    limbTint: rgb(0x55, 0x55, 0x55),
    tilt: 0.12,
    spin: -1.95,
  })

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.globe)

    // The whole shot turns a little — the globe is never still.
    this.play(
      together(
        this.globe.spin.to(-1.8, { easing: "linear" }),
        [this.globe.land.to(rgb(0xdc, 0xdc, 0xdc), { easing: "smooth" }), 0.2, 0.8],
        [this.globe.limbTint.to(rgb(0xf0, 0xf0, 0xf0)), 0.3, 0.8],
      ),
      4.5,
    )
  }
}
