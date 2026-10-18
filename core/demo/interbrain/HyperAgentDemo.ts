/**
 * HyperAgentDemo.ts — A DreamWeaving
 *
 * The HyperAgent standing alone, the way the film tells it. The war
 * machine builds by recursion — "the divided and conquered divide and
 * conquer" (12:43): the leaves, two minds ⚡ at a time; a head mind over
 * each pair, the hands taking hold; level on level up to the eye at the
 * apex, "the spirit of fragmentation" (13:38, f4141). "Power" climbs both
 * flanks (f4351). Hold. Then the turn (f13006 → f13111): the hands and the
 * bolts let go, the triangles round, the eye and the minds turn liminal,
 * and they gather into the flower of life round the liminal eye — "a
 * collective hyper-agent grounded in love … that knows no enemies"
 * (42:30). Hold.
 *
 * At the default camera (0.48 px per unit) the pyramid is the film's:
 * 690 px of side (1437 units), centred on the frame (f4351).
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { HyperAgent } from "../../vocabulary/HyperAgent/HyperAgent"

const PX = 720 / 1500

export class HyperAgentDemoDream extends Dream {
  agent = new HyperAgent({ size: 690 / PX, depth: 3, power: 0 })

  unfold() {
    this.play(Create(this.agent), 9)
    this.play(this.agent.power.to(1), 1.2)
    this.wait(2)
    this.play(this.agent.love.to(1), 6)
    this.wait(2.5)
  }
}

if (import.meta.main) render(HyperAgentDemoDream)

/**
 * The unit of divide and conquer alone (f3616 → f3676): two minds ⚡, a
 * third above them, the hands taking hold — a depth-1 HyperAgent with a
 * mind at its apex instead of the eye, 510 px of side as in f3676.
 */
export class HyperAgentUnitDemoDream extends Dream {
  agent = new HyperAgent({ size: 510 / PX, depth: 1, apex: 0, power: 0 })

  unfold() {
    this.play(Create(this.agent), 5)
    this.wait(2)
  }
}
