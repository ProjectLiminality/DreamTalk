/**
 * Harmonization.ts — A DreamWeaving
 *
 * Hub vs pairwise: six systems on a ring draw on, and the web between them
 * — every pair mapped, fifteen red chords. The web bends through the
 * centre and collapses into a hub: one canonical model, six spokes, each as
 * long as its system is far. The hub is a plan until it is built: the first
 * system defines the model (it crystallises out of it), then the others
 * are onboarded one at a time, each costing its distance.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { Harmonization } from "../../vocabulary/Harmonization/Harmonization"

export class HarmonizationDream extends Dream {
  harmonization = new Harmonization()

  unfold() {
    const h = this.harmonization
    this.stage(h)
    this.play(Create(h), 3)
    this.wait(1.5)
    // Every pair, mapped: N² — the web collapses into one model.
    this.play(h.topology.to(1), 3.5)
    this.wait(1)
    this.play(h.costs.to(1), 1)
    this.wait(0.5)
    // The first system defines the model; each next one costs its distance.
    this.play(h.onboarded.to(1), 2.4)
    this.wait(1)
    for (let k = 2; k <= h.data.systems.length; k++) {
      this.play(h.onboarded.to(k), 1.3)
      this.wait(0.5)
    }
    this.wait(2)
  }
}

if (import.meta.main) render(HarmonizationDream)
