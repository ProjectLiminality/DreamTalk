/**
 * Horizons.ts — A DreamWeaving
 *
 * WHEN do we care, about WHAT, and who: the axes draw on; the planning
 * horizons are revealed inner to outer — operational, tactical, strategic —
 * each bringing its people; one person comes forward; the open seat, a
 * ghost of who might hold it, is filled and crystallises.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { Horizons } from "../../vocabulary/Horizons/Horizons"

export class HorizonsDream extends Dream {
  horizons = new Horizons()

  unfold() {
    const h = this.horizons
    this.stage(h)
    this.play(Create(h), 1.5)
    this.wait(0.5)
    for (let k = 1; k <= h.data.horizons.length; k++) {
      this.play(h.reveal.to(k), 1.6)
      this.wait(1)
    }
    this.play(h.role("demand").emphasis.to(1), 1)
    this.wait(1.2)
    this.play(h.role("demand").emphasis.to(0), 0.8)
    // The open seat: a superposition of who might hold it — then it is filled.
    this.play(h.role("manager").emphasis.to(1), 1)
    this.wait(1.2)
    this.play(h.role("manager").certainty.to(1), 2.5)
    this.wait(1)
    this.play(h.role("manager").emphasis.to(0), 0.8)
    this.wait(1.5)
  }
}

if (import.meta.main) render(HorizonsDream)
