/**
 * CoherenceBeaconDemo — reach coupled to coherence (InterBrain film
 * 37:14–38:14, f11446–f11506): the coherent node (circle × square =
 * cylinder) bursts with cyan rays above the incoherent one (circle + square
 * = a muddied square) in its red swarm; the beacon's broadcast spreads in
 * rings round the RadioTower standing on it; the incoherent node fades; then the beacon dims and flares again.
 *
 * Framing: 0.48 px per unit at 720p. f11491: the beacon's node centred at
 * (640, 223) → y 285.
 */

import { Dream, render } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { Text } from "../../src/parts/text"
import { BEACON, CoherenceBeacon } from "../../vocabulary/CoherenceBeacon/CoherenceBeacon"
import { RadioTower } from "../../vocabulary/RadioTower/RadioTower"

const PX = 0.48

export class CoherenceBeaconDemoDream extends Dream {
  beacon = new CoherenceBeacon({
    size: 33 / PX,
    y: (360 - 223) / PX,
    reach: 0,
    tower: new RadioTower({ size: (BEACON.tower * 33) / PX, solid: 0 }),
  })
  title = new Text({ content: "Coherence Beacon", size: 72, y: (360 - 640) / PX })

  /** Play `anims` over `dt` while the rays and the swarm keep flowing. */
  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.beacon.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    this.flowing(3, Create(this.beacon))
    this.flowing(2.5, this.beacon.reach.to(1), Create(this.title))
    this.flowing(1.5)
    this.flowing(2, this.beacon.noise.to(0))
    this.flowing(1)
    this.flowing(2, this.beacon.coherence.to(0.15), this.beacon.reach.to(0.2))
    this.flowing(2, this.beacon.coherence.to(1), this.beacon.reach.to(1))
    this.flowing(1.5)
  }
}

if (import.meta.main) render(CoherenceBeaconDemoDream)
