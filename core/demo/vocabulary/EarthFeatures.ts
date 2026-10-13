/**
 * EarthFeatures.ts — A DreamWeaving
 *
 * The Earth's other degrees of freedom, one after another: the planet draws
 * itself, the graticule fades in over the sea, the land dims so the lakes,
 * rivers and borders can be read, and the eye descends on Europe while the
 * country and city names arrive with the zoom. Austria lights up, and the eye
 * closes in on it — inside the Alps the 1:10m pack draws the land. Then the
 * eye rises, crosses the Mediterranean and comes down on the Nile, where
 * Egypt lights up in turn — the same two verbs (Focus, FlyTo) for any place.
 * Last, the eye rises back to the whole planet: an atmosphere rims it, and
 * the sun sweeps across so the night falls over Europe and Africa.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { BLUE, rgb } from "../../src/constants"
import { Create } from "../../src/verbs"
import { Earth } from "../../vocabulary/Earth/Earth"
import { EarthView, FlyTo, Focus, followEarth } from "../../vocabulary/Earth/EarthView"
import { ALPS_10M } from "../../vocabulary/Earth/packs/alps10m"

export class EarthFeaturesDream extends Dream {
  earth = new Earth({
    limbStroke: 1.2,
    limbDraw: 0,
    coastDraw: 0,
    landOpacity: 0,
    borderDraw: 0,
    highlight: ["AT", "EG"],
    labels: { countries: 5, cities: 4 },
    packs: [ALPS_10M],
  })
  view = new EarthView({ lat: 30, lon: 15 })

  unfold() {
    followEarth(this.observer, this.earth, this.view, { detail: 2 })
    this.stage(this.earth)
    this.stage(this.view)
    const frame = { earth: this.earth, observer: this.observer }
    const egypt = this.earth.country("EG")
    egypt.tint.value = BLUE
    egypt.tint.defaultValue = BLUE

    this.play(Create(this.earth), 3)
    this.play(this.earth.graticuleOpacity.to(1), 1.5)
    this.play(
      together(
        this.earth.land.to(rgb(0x0e, 0x0e, 0x0e)),
        [this.earth.lakeOpacity.to(1), 0.3, 1],
        [this.earth.riverOpacity.to(1), 0.4, 1],
      ),
      2,
    )
    this.play(
      together(
        Focus(this.view, { lat: 47.5, lon: 12, span: 11, tilt: 32 }, frame),
        [this.earth.graticuleOpacity.to(0.6), 0.5, 1],
      ),
      4,
    )
    this.play(this.earth.country("AT").fillOpacity.to(0.85), 1.5)
    // Close in on Austria, where the 1:10m pack takes over from 1:50m.
    this.play(
      together(
        Focus(this.view, { lat: 47.4, lon: 13.6, span: 3.2, tilt: 38 }, frame),
        [this.earth.country("AT").fillOpacity.to(0.35), 0.3, 1],
      ),
      3,
    )
    this.wait(1)
    this.play(
      together(
        FlyTo(this.view, { lat: 27, lon: 31, span: 12, tilt: 28 }, frame),
        [this.earth.country("AT").fillOpacity.to(0), 0, 0.3],
        [egypt.fillOpacity.to(0.85), 0.75, 1],
      ),
      5,
    )
    this.wait(1.5)
    // The whole planet again — its atmosphere, and the day passing over it.
    this.set(this.earth.sunLat.to(12), this.earth.sunLon.to(80))
    this.play(
      together(
        Focus(this.view, { lat: 22, lon: 20, zoom: 0, tilt: 0 }),
        [this.earth.labelOpacity.to(0), 0, 0.4],
        [this.earth.graticuleOpacity.to(0.35), 0, 0.5],
        [this.earth.atmosphereOpacity.to(1), 0.4, 1],
        [this.earth.country("EG").fillOpacity.to(0), 0, 0.5],
      ),
      3.5,
    )
    this.play(
      together(
        [this.earth.nightOpacity.to(0.92), 0, 0.3],
        [this.earth.terminatorOpacity.to(0.9), 0, 0.3],
        this.earth.sunLon.to(-75, { easing: "linear" }),
      ),
      6,
    )
    this.wait(1.5)
  }
}

if (import.meta.main) render(EarthFeaturesDream)
