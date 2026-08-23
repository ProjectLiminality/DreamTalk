/**
 * VocabShowcase.ts — A DreamWeaving
 *
 * The first video-01 vocabulary batch on parade, echoing Scene 1's
 * furniture (refs/video-01 frames 015/020) without attempting the full
 * scene: white arrowed axes with a BLUE grid domino-cascading on; a
 * BLUE eye (screen right, gazing left) and a RED eye creating by the
 * Eye choreography; the RED rectangle drawing on and morphing through
 * its rounding; then the asymmetry — the grid ERASES front-to-back
 * while the rectangle UN-DRAWS, retracting whence it came.
 */

import { Dream, render } from "../src/index"
import { together } from "../src/anim"
import { Create, UnCreate, UnDraw, Erase } from "../src/verbs"
import { Axes, Eye, Rectangle } from "../src/parts/index"
import { BLUE, RED, PI } from "../src/constants"

export class VocabShowcaseDream extends Dream {
  axes = new Axes({
    mode: "xy",
    xStart: -450,
    xEnd: 450,
    yStart: -260,
    yEnd: 260,
    gridSpacing: 100,
    gridLineLength: 1000,
    drawGrid: true,
    gridTint: BLUE,
  })
  blueEye = new Eye({ tint: BLUE, x: 300, y: -40, h: PI, scale: 0.3 })
  redEye = new Eye({ tint: RED, x: -300, y: -40, scale: 0.3 })
  rectangle = new Rectangle({ width: 100, height: 200 })

  unfold() {
    this.set(...this.observer.dolly(560))
    this.play(Create(this.axes), 3)
    this.wait(0.3)
    this.play(together(Create(this.blueEye), Create(this.redEye)), 2.5)
    this.wait(0.3)
    this.play(Create(this.rectangle), 2)
    this.wait(0.2)
    this.play(this.rectangle.rounding.to(1), 1.5)
    this.wait(0.2)
    this.play(this.rectangle.rounding.to(0), 1)
    this.wait(0.3)
    this.play(Erase(this.axes), 2.5)
    this.play(UnDraw(this.rectangle), 1.5)
    this.play(together(UnCreate(this.blueEye), UnCreate(this.redEye)), 1)
    this.wait(0.5)
  }
}

if (import.meta.main) render(VocabShowcaseDream)
