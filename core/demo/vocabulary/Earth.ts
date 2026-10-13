/**
 * Earth.ts — A DreamWeaving
 *
 * The whole black Earth turns from the Atlantic toward Europe while its
 * shoreline draws on and the land floods in white. Then the eye descends:
 * the land dims to a quiet grey so the country borders can draw in, and
 * the headquarters rises out of the ground in Austria, the production
 * sites after it across Europe — red and blue, the two kinds.
 *
 * The sites are MOCK data (vocabulary/Earth/mockSites.ts); the camera is
 * an EarthView flying lat/lon/zoom, not raw orbit angles.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { rgb } from "../../src/constants"
import { Earth } from "../../vocabulary/Earth/Earth"
import { EarthView, FrameRegion, followEarth } from "../../vocabulary/Earth/EarthView"
import { sitePlaces } from "../../vocabulary/Earth/Sites"
import { MOCK_SITES } from "../../vocabulary/Earth/mockSites"

export const EUROPE = { lat: 49, lon: 12, span: 17 }

export class EarthDream extends Dream {
  sites = sitePlaces(MOCK_SITES, { sunk: true })
  earth = new Earth({ coastDraw: 0, landOpacity: 0, borderDraw: 0, places: this.sites })
  view = new EarthView({ lat: 18, lon: -62 })

  unfold() {
    followEarth(this.observer, this.earth, this.view, { detail: 1.5 })
    this.stage(this.earth)
    this.stage(this.view)

    // The planet turns toward Europe as its shore draws on and fills.
    this.play(
      together(
        [this.earth.coastDraw.to(1, { easing: "easeOut" }), 0, 0.55],
        [this.earth.landOpacity.to(1), 0.35, 0.8],
        this.view.lon.to(EUROPE.lon),
        this.view.lat.to(32),
      ),
      6,
    )
    // The descent: land dims so the borders can be read, borders draw in.
    this.play(
      together(
        FrameRegion(this.view, EUROPE, { earth: this.earth, observer: this.observer }),
        [this.view.tilt.to(38), 0.3, 1],
        // Tints are linear (the renderer sRGB-encodes them), so 0x0e reads ~#424242.
        [this.earth.land.to(rgb(0x0e, 0x0e, 0x0e)), 0.25, 0.75],
        [this.earth.borderDraw.to(1), 0.4, 1],
      ),
      4.5,
    )
    // The headquarters rises, then the sites after it.
    const [hq, ...rest] = this.sites
    this.play(hq!.altitude.to(0), 1.6)
    this.play(
      together(...rest.map((s, i): [ReturnType<typeof s.altitude.to>, number, number] => [s.altitude.to(0), (i / rest.length) * 0.7, (i / rest.length) * 0.7 + 0.3])),
      3.5,
    )
    this.wait(2.5)
  }
}

if (import.meta.main) render(EarthDream)
