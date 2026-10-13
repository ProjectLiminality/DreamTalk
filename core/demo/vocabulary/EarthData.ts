/**
 * EarthData.ts — A DreamWeaving
 *
 * The Earth as a surface for knowledge: a value per country painted on the
 * land and passing through a year, columns rising from eight places as
 * their own series move, and traffic flowing along great circles into a
 * hub — each from a plain table, each a function of t. Missing data is
 * ghosted: one country reports late, one stops, one has a hole.
 *
 * All data is MOCK (vocabulary/Earth/mockData.ts).
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { rgb } from "../../src/constants"
import { scalar } from "../../src/params"
import { Earth, Place } from "../../vocabulary/Earth/Earth"
import { EarthView, followEarth } from "../../vocabulary/Earth/EarthView"
import { Choropleth } from "../../vocabulary/Earth/Choropleth"
import { PointData } from "../../vocabulary/Earth/PointData"
import { Connection } from "../../vocabulary/Earth/Connection"
import { MOCK_CHOROPLETH, MOCK_FLOWS, MOCK_HUB, MOCK_POINTS, MONTHS } from "../../vocabulary/Earth/mockData"

export class EarthDataDream extends Dream {
  /** One year, as one continuous param every layer shares. */
  month = scalar(0)
  /** The flows' clock. */
  clock = scalar(0)
  map = new Choropleth({ data: MOCK_CHOROPLETH, periods: [...MONTHS], period: this.month, strength: 0 })
  points = new PointData({ rows: MOCK_POINTS, period: this.month, strength: 0, size: 12, width: 3.2 })
  hub = new Place({ lat: MOCK_HUB.lat, lon: MOCK_HUB.lon })
  flows = MOCK_FLOWS.map(
    (f) =>
      new Connection({
        ends: [this.points.spots[f.from]!, this.hub],
        particles: 14,
        volume: f.volume,
        time: this.clock,
        tint: rgb(0x60, 0x60, 0x60),
        particleTint: rgb(0xff, 0xff, 0xff),
        stroke: 0.9,
        creation: 0,
      }),
  )
  earth = new Earth({
    land: rgb(0x0e, 0x0e, 0x0e),
    borderOpacity: 0.7,
    layers: [this.map],
    places: [this.points, this.hub, ...this.flows],
  })
  view = new EarthView({ lat: 49, lon: 11, zoom: 2.1, tilt: 30 })

  unfold() {
    followEarth(this.observer, this.earth, this.view, { detail: 2 })
    this.stage(this.earth)
    this.stage(this.view)

    // The data arrives: the map floods in, the columns rise, the flows draw.
    this.play(this.map.strength.to(1), 1.5)
    this.play(this.points.strength.to(1), 1.5)
    this.play(together(...this.flows.map((f) => f.creation.to(1))), 1.5)
    // A year passes, the traffic running all the while.
    this.play(
      together(this.month.to(MONTHS.length - 1, { easing: "linear" }), this.clock.to(14, { easing: "linear" })),
      12,
    )
    this.wait(1.5)
  }
}

if (import.meta.main) render(EarthDataDream)
