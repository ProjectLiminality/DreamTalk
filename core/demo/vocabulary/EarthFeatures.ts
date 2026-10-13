/**
 * EarthFeatures.ts — A DreamWeaving
 *
 * The Earth's other degrees of freedom, one after another: the planet draws
 * itself, the graticule fades in over the sea, the land dims so the lakes,
 * rivers and borders can be read, and the eye descends on Europe while the
 * country and city names arrive with the zoom. Austria lights up. Then the
 * eye rises, crosses the Mediterranean and comes down on the Nile, where
 * Egypt lights up in turn — the same two verbs (Focus, FlyTo) for any place.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { BLUE, rgb } from "../../src/constants"
import { Create } from "../../src/verbs"
import { Earth } from "../../vocabulary/Earth/Earth"
import { EarthView, FlyTo, Focus, followEarth } from "../../vocabulary/Earth/EarthView"

export class EarthFeaturesDream extends Dream {
  earth = new Earth({
    limbStroke: 1.2,
    limbDraw: 0,
    coastDraw: 0,
    landOpacity: 0,
    borderDraw: 0,
    highlight: ["AT", "EG"],
    labels: { countries: 5, cities: 4 },
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
    this.wait(1)
    this.play(
      together(
        FlyTo(this.view, { lat: 27, lon: 31, span: 12, tilt: 28 }, frame),
        [this.earth.country("AT").fillOpacity.to(0), 0, 0.3],
        [egypt.fillOpacity.to(0.85), 0.75, 1],
      ),
      5,
    )
    this.wait(2.5)
  }
}

if (import.meta.main) render(EarthFeaturesDream)
