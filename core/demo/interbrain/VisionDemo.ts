/**
 * VisionDemo.ts — A DreamWeaving
 *
 * Vision standing alone, as the film shows it beside Narrative (f5686) and
 * in Vision Gardening (f5776 → f5821): the white mark writes itself — the
 * pen runs the S tip to tip, the band floods, the dot and square open —
 * then its red ring draws on around it and the light rises at its heart.
 *
 * Framing: the default eye projects z = 0 at 720/1500 = 0.48 px per unit;
 * f5821's mark is R = 150 px (its ring 157 px), so R = 150 / 0.48 units.
 * The ringed Vision's band is the lighter ≈ 0.035·R measured there.
 */

import { Dream, render } from "../../src/index"
import { Create, UnCreate } from "../../src/verbs"
import { together } from "../../src/anim"
import { WHITE } from "../../src/constants"
import { Vision } from "../../vocabulary/Vision/Vision"

const PX = 720 / 1500

export class VisionDemoDream extends Dream {
  vision = new Vision({ radius: 150 / PX, tint: WHITE, weight: 0.035, ringStroke: 3 })

  unfold() {
    this.play(Create(this.vision), 2.5)
    this.play(this.vision.ring.to(1), 1.5)
    this.play(this.vision.light.to(1), 1.5)
    this.wait(2)
    this.play(together(UnCreate(this.vision), this.vision.ring.to(0), this.vision.light.to(0)), 1.5)
    this.wait(0.5)
  }
}

if (import.meta.main) render(VisionDemoDream)
