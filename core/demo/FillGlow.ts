/**
 * FillGlow.ts — the radial-light fill (Stroke.fillFalloff), shown plainly.
 *
 * Four shapes: a flat wash (falloff 0, the unchanged default), then three
 * lit radially — the brightness falling from full at each disc's centre
 * toward its rim. The middle two animate their falloff 0 → 0.85, so the
 * light is a pure f(t); the last sets an explicit radius smaller than the
 * disc, so the outer ring holds at the rim's dimmest.
 */

import { Dream, render } from "../src/index"
import { together } from "../src/index"
import { BLUE, WHITE } from "../src/constants"
import { Circle, Rectangle } from "../src/parts/index"

export class FillGlowDream extends Dream {
  flat = new Circle({ radius: 110, x: -390, fillOpacity: 1, tint: WHITE })
  lit = new Circle({ radius: 110, x: -130, fillOpacity: 1, tint: WHITE, fillFalloff: 0 })
  litBlue = new Rectangle({ width: 200, height: 200, x: 130, fillOpacity: 1, tint: BLUE, fillFalloff: 0 })
  tight = new Circle({ radius: 110, x: 390, fillOpacity: 1, tint: WHITE, fillFalloff: 0.85, fillFalloffRadius: 60 })

  unfold() {
    for (const h of [this.flat, this.lit, this.litBlue, this.tight]) this.stage(h)
    this.set(...this.observer.dolly(1250))
    this.play(together(this.lit.fillFalloff.to(0.85), this.litBlue.fillFalloff.to(0.85)), 3)
    this.wait(1)
  }
}

if (import.meta.main) render(FillGlowDream)
