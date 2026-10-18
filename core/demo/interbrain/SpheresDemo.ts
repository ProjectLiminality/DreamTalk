/**
 * SpheresDemo.ts — the three realms in film order:
 *
 *   0–3 s     the Earth, the social sphere, the noosphere draw on (f2086)
 *   3–7 s     the three namings: Engineering (f2086) → structure (f2161)
 *             → sphere (f2236); the icon rows come in over them (f2161)
 *   8–10 s    the row folds into the stack (f2386)
 *   10–13 s   the order of influence flows down, the ladder of leverage
 *             climbs (f2416, f2506)
 *   13–15 s   ch8: the realms as they are, wounded (f12451)
 *   15–19 s   the healing trickles down, top to bottom (f12496)
 *
 * Framing: the default eye is 0.48 px per unit at 720p; the row's sphere
 * radius is 125 px, the origin the frame's centre.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together } from "../../src/anim"
import { Spheres } from "../../vocabulary/Spheres/Spheres"

export class SpheresDemoDream extends Dream {
  spheres = new Spheres({ labels: 1, creation: 0 })

  unfold() {
    const s = this.spheres
    this.play(Create(s), 3)
    this.play(together(s.labels.to(2), s.icons.to(1)), 2)
    this.wait(0.5)
    this.play(together(s.labels.to(3), s.icons.to(0)), 1)
    this.wait(1.5)
    this.play(s.stack.to(1), 2)
    this.play(s.arrows.to(1), 3)
    this.play(s.fragmented.to(1), 2)
    this.play(s.healed.to(1), 4)
    this.wait(1.5)
  }
}

if (import.meta.main) render(SpheresDemoDream)
