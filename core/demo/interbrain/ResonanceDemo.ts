/**
 * ResonanceDemo.ts — A DreamWeaving
 *
 * Resonance round the ancient tribe (f6106, f6121): seven liminal minds in
 * their hexagon, each ringed by `.resonate()` on its own frame — the rings
 * follow the circle they were grafted onto. They swell in (`amount` 0 → 1:
 * brighter and further, "inspiring visions travel faster and further",
 * 20:19), then the whole tribe resonates as one: a Resonance placed round
 * the group (a group has no outline of its own), wide and slow (f6121).
 *
 * Framing (0.48 px/unit): f6106's minds have R = 75 px (156 units), their
 * centres 262 px apart (546). (The red tribe edges and campfires are the
 * Tribe holon's, not this demo's.)
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { TAU } from "../../src/constants"
import { Mind } from "../../vocabulary/Mind/Mind"
import { Resonance } from "../../vocabulary/Resonance/Resonance"

const PX = 720 / 1500
const R = 75 / PX
const D = 262 / PX

const SPOTS = [{ x: 0, y: 0 }, ...Array.from({ length: 6 }, (_, i) => ({ x: D * Math.cos((i * TAU) / 6), y: D * Math.sin((i * TAU) / 6) }))]

export class ResonanceDemoDream extends Dream {
  minds = SPOTS.map((p) => new Mind({ size: R, liminal: 1, x: p.x, y: p.y }))
  rings = this.minds.map((m) => (void m.parts, m.frame.resonate({ amount: 0, rings: 2, dash: 180, reach: 1.6 }).resonance))
  tribe = new Resonance({ radius: D + R, amount: 0, rings: 2, dash: 360, reach: 0.6, band: 0.06, speed: 0.5, stroke: 1.6 })

  private all(): Resonance[] {
    return [...this.rings, this.tribe]
  }

  /** Play `anims` over `dt` while every ring keeps travelling. */
  private running(dt: number, ...anims: Anim[]): void {
    this.play(together(...this.all().map((r) => r.time.by(dt, { easing: "linear" })), ...anims), dt)
  }

  unfold() {
    for (const r of this.all()) this.stage(r)
    this.play(together(...this.minds.map((m) => Create(m))), 1.5)
    this.running(1.5, ...this.rings.map((r) => r.amount.to(1)))
    this.running(4)
    this.running(1.5, this.tribe.amount.to(1), ...this.rings.map((r) => r.amount.to(0.4)))
    this.running(4)
  }
}

if (import.meta.main) render(ResonanceDemoDream)
