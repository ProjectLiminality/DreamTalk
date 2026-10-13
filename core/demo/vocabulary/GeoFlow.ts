/**
 * GeoFlow.ts — A DreamWeaving
 *
 * An organisation where it is, then as what it is. The Earth turns to
 * Europe and the land floods; the eye descends, the group's headquarters
 * and its sites rise, every site reports home and the value flows between
 * them as traffic. Then the one axis: the eye pulls back, the arcs lift off
 * the planet into one circle — the group — the sites glide to their seats,
 * the planet goes, and the abstract flow map is what remains. And back.
 *
 * Mock data only (FlowMap's MOCK_FLOWMAP, vocabulary/GeoFlow/mockGeo.ts).
 * Free play: v walks globe ↔ abstract.
 */

import { Dream, render } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { GeoFlow } from "../../vocabulary/GeoFlow/GeoFlow"

export class GeoFlowDream extends Dream {
  geo = new GeoFlow({ seenBy: () => this.observer, landIn: 0, rise: 0, relate: 0, traffic: 0 })

  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.geo.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const g = this.geo
    void g.parts // composes it: the map and the camera rig exist from here
    this.stage(g)
    this.flowing(2.5, g.landIn.to(1))
    this.flowing(3.5, g.descent.to(g.regionZoom()))
    this.flowing(2.2, g.rise.to(1))
    this.flowing(2.4, g.relate.to(1))
    this.flowing(2.4, g.traffic.to(1))
    this.flowing(2.5)
    // The one axis: globe → abstract.
    this.flowing(6.6, g.view.to(1, { easing: "linear" }))
    this.flowing(2, g.map.grain.to(1))
    this.flowing(1.6, g.map.stage("semi").shown.to(1))
    this.flowing(1.6, g.map.stage("finished").shown.to(1))
    this.flowing(2.5)
    // And back to the planet.
    this.flowing(6.6, g.view.to(0, { easing: "linear" }))
    this.flowing(2)
  }
}

if (import.meta.main) render(GeoFlowDream)
