/**
 * HandsTestDemo.ts — A DreamWeaving
 *
 * A light room for tuning hands (`?scene=hands-test&play=free&hands=webcam`,
 * or `hands=leap`): three walkable symbols big in view — the Eye, the
 * FoldableCube, the MindVirus — each with its own axes to pinch, and little
 * else to draw or pick, so what is felt is the hands, not the scene.
 */

import { Dream, render } from "../src/index"
import { Create } from "../src/verbs"
import { BLUE, RED } from "../src/constants"
import { Eye } from "../vocabulary/Eye/Eye"
import { FoldableCube } from "../vocabulary/FoldableCube/FoldableCube"
import { MindVirus } from "../vocabulary/MindVirus/MindVirus"

/** Distance between the symbols, scene units. */
const CELL = 900

export class HandsTestDream extends Dream {
  eye = new Eye({ tint: BLUE, scale: 0.55, x: -CELL })
  cube = new FoldableCube({ size: 260, tint: RED, p: -0.5, h: 0.6 })
  virus = new MindVirus({ scale: 2.6, x: CELL, h: -0.5, p: 0.35 })

  unfold() {
    const o = this.observer
    o.radius.value = o.radius.defaultValue = 3000
    const all = [this.eye, this.cube, this.virus]
    for (const h of all) this.stage(h)
    for (const h of all) this.play(Create(h), 0.6)
    this.wait(0.3)
  }
}

if (import.meta.main) render(HandsTestDream)
