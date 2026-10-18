/**
 * NoosphereDemo.ts — the Noosphere walking its states in film order.
 *
 *   0–5 s    the LATTICE draws on and turns (f2236); the light kindles at
 *            its heart — the noosphere as lens (f2311)
 *   5–12 s   the NARRATIVE-ENGINEERED sphere (f5146) turns VISION-GARDENED
 *            (f5716, f12451)
 *   12–25 s  the WHOLE DISK grows (f7231); bolts strike along six cuts
 *            (f7246); it squares to a hexagon (f7441) and breaks into the
 *            VORTEX (f7471), turning; it heals back to the disk (f11806–f11851)
 *   25–31 s  the disk rises into the INTERBRAIN SPHERE (f11896, f11941)
 *
 * Three instances because the film draws three geodesic frequencies
 * (lattice ν 4, the narrative/vision sphere ν 7, the InterBrain sphere ν 2);
 * each walks its own states with the one holon's axes.
 *
 * Framing: the default eye is 0.48 px per unit at 720p; radii from the
 * frames ÷ 0.48 — lattice 124 px (258), garden sphere 186 px (388), disk
 * 198 px (412), InterBrain sphere 193 px (402).
 */

import { Dream, render } from "../../src/index"
import { Create, UnCreate } from "../../src/verbs"
import { together } from "../../src/anim"
import { Noosphere } from "../../vocabulary/Noosphere/Noosphere"

const PX = 720 / 1500

export class NoosphereDemoDream extends Dream {
  lattice = new Noosphere({ radius: 124 / PX, frequency: 4, creation: 0 })
  garden = new Noosphere({ radius: 186 / PX, frequency: 7, bloom: 1, creation: 0 })
  medium = new Noosphere({ radius: 198 / PX, frequency: 2, bloom: 1, garden: 1, flat: 1, creation: 0 })

  unfold() {
    const { lattice, garden, medium } = this
    this.play(Create(lattice), 1.6)
    this.play(lattice.spin.to(lattice.spin.value + 0.6), 1.4)
    this.play(lattice.stateAxis("lens").to("lit"), 1)
    this.wait(0.6)
    this.play(UnCreate(lattice), 0.5)

    this.play(Create(garden), 1.5)
    this.wait(1)
    this.play(together(garden.stateAxis("garden").to("vision-gardened"), garden.spin.to(garden.spin.value + 0.4)), 2.5)
    this.wait(1)
    this.play(UnCreate(garden), 0.5)

    this.play(Create(medium), 1.5)
    this.wait(0.5)
    this.play(medium.stateAxis("fragment").to("struck"), 1)
    this.wait(0.6)
    this.play(medium.stateAxis("fragment").to("hexagon"), 1)
    this.wait(0.4)
    this.play(together(medium.stateAxis("fragment").to("vortex"), medium.swirl.to(0.5)), 2.5)
    this.play(medium.swirl.to(1.2), 2)
    this.play(together(medium.stateAxis("fragment").to("whole"), medium.swirl.to(0)), 2.5)
    this.wait(0.6)
    this.play(together(medium.stateAxis("flat").to("sphere"), medium.radius.to(193 / PX)), 1.5)
    this.play(medium.stateAxis("interbrain").to("interbrain"), 1.5)
    this.play(medium.spin.to(medium.spin.value + 0.5), 3)
  }
}

if (import.meta.main) render(NoosphereDemoDream)
