/**
 * WorldviewDemo — the Worldview standing alone, walking the film's states
 * (InterBrain film 10:56–11:50, 15:00, 25:00–26:00, 39:20).
 *
 * The world and the eye (f3256); the direct path both ways (f3301), crossed
 * out, the light straight to the eye and a "?" (f3331); the prism between
 * (f3361), the light into it and the spectrum out, the world in the lens
 * (f3376); the feedback loop (f3391); the noosphere as the lens (f3451). Then the manipulated lens: the world
 * fragmented, a narrative cube in the prism, the spectrum smeared, the
 * strings (f3541); the multipolar pull (f4561); the strings cut, the eye
 * looking at the lens (f7606), the lens a lattice (f7681); the world
 * replaced by a box of notes, its digital twin (f7726); and healed: the
 * radiant DreamTalk symbol through a flower-of-life prism, a clean
 * spectrum (f11806).
 *
 * Framing: the holon is built at the film's own scale (default eye, 0.48
 * px per unit), centred on the prism.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Group, Line, Square } from "../../src/parts/primitives"
import { BLUE, WHITE } from "../../src/constants"
import { Create } from "../../src/verbs"
import { LENS, SOURCE, Worldview } from "../../vocabulary/Worldview/Worldview"

/** f7726's digital twin, made neutral (§6 of the report: no third-party
 *  brand) — a blue box of notes. */
const notes = (): Group => {
  const box = new Square({ size: 360, tint: BLUE, stroke: 2 })
  const lines = [100, 35, -30, -95].map(
    (y, i) => new Line({ points: [{ x: -110, y, z: 0 }, { x: i === 3 ? 30 : 110, y, z: 0 }], tint: WHITE, stroke: 2 }),
  )
  return new Group({ members: [box, ...lines] })
}

export class WorldviewDemoDream extends Dream {
  view = new Worldview({ light: 0, prism: 0, sourceFace: notes() })

  unfold() {
    const v = this.view
    this.play(Create(v), 2)
    this.wait(0.5)
    // the direct path, and why it is not there
    this.play(v.direct.to(1), 1.2)
    this.play(together(v.crossed.to(1), v.light.to(1)), 1)
    this.wait(1)
    this.play(together(v.direct.to(0), v.crossed.to(0), v.light.to(0)), 0.8)
    // the lens
    this.play(v.prism.to(1), 1)
    this.play(together(v.light.to(1), v.lens.to(LENS.earth)), 1.2)
    this.play(v.loop.to(1), 1)
    this.wait(1)
    // the lens is the noosphere
    this.play(v.lens.to(LENS.noosphere), 1.2)
    this.wait(1)
    // manipulated
    this.play(together(v.loop.to(0), v.lens.to(LENS.cube), v.source.to(SOURCE.fragmented)), 1.5)
    this.play(v.distortion.to(1), 1.5)
    this.play(v.strings.to(1), 1.2)
    this.wait(1)
    // multipolar
    this.play(together(v.pullers.to(3), v.lens.to(LENS.lattice)), 1.5)
    this.wait(1)
    // cut, and look at the lens
    this.play(together(v.strings.to(0), v.pullers.to(1), v.source.to(SOURCE.earth)), 1.2)
    this.play(v.reverse.to(1), 1.2)
    this.wait(1)
    this.play(v.reverse.to(0), 1)
    // the digital twin
    this.set(v.source.to(SOURCE.face))
    this.wait(1)
    // healed
    this.play(together(v.source.to(SOURCE.radiant), v.lens.to(LENS.flower), v.distortion.to(0)), 2)
    this.wait(2)
  }
}

if (import.meta.main) render(WorldviewDemoDream)
