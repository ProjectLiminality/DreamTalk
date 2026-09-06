/**
 * Axes.ts — A DreamWeaving
 *
 * The Axes standing alone, grid on: the two arrowed axis lines draw
 * first and the blue lattice dominoes in behind them — pydeation's
 * cascade, each line more eased than its window suggests. Erased (not
 * un-drawn) on the way out: the lattice sweeps away ahead of the axes.
 */

import { Dream, render } from "../../src/index"
import { Create, Erase } from "../../src/verbs"
import { Axes } from "../../vocabulary/Axes/Axes"
import { BLUE } from "../../src/constants"

export class AxesDream extends Dream {
  axes = new Axes({
    mode: "xy",
    xStart: -260,
    xEnd: 260,
    yStart: -260,
    yEnd: 260,
    gridSpacing: 100,
    gridLineLength: 1000,
    drawGrid: true,
    gridTint: BLUE,
  })

  unfold() {
    this.set(...this.observer.dolly(560))
    this.play(Create(this.axes), 3)
    this.wait(2)
    this.play(Erase(this.axes), 2.5)
    this.wait(0.5)
  }
}

if (import.meta.main) render(AxesDream)
