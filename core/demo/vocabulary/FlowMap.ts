/**
 * FlowMap.ts — A DreamWeaving
 *
 * The value flow map walking its own state space: the members appear with
 * their relations to the group's centre, and those lines morph into the
 * group circle itself; the grain reveals the categories (two discs shrink in from the
 * rim into a vesica, the sites take their colours) and folds back; the flow
 * layers switch on one by one — raw material in (ghosted: conjecture),
 * semi-finished, finished out; the whole map tilts into the stage stack,
 * the categories return in 3D, the semi-finished flows turn concrete —
 * roads with trucks — and back, and it all lays flat and face-on again.
 * Last, the data arrives for the raw-material inflow: its blur of
 * potentiality collapses into solid actuality.
 *
 * Time runs through every step (`flowing`), so the particles never stop.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { FlowMap } from "../../vocabulary/FlowMap/FlowMap"
import { MorphCurves, MorphMany } from "../../vocabulary/Morph/MorphCurves"
import { Circle, Line } from "../../src/parts/primitives"

export class FlowMapDream extends Dream {
  // Who sees it: labels and particles face the camera as the viewer orbits.
  map = new FlowMap({ radius: 300, seenBy: () => this.observer, roads: true })

  /** Play `anim` over `dt` seconds while the flow keeps running. */
  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.map.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const m = this.map
    // Orthographic: the stage stack reads like the board's drawing — every
    // slice the same size at the same slant — instead of fanning open under
    // perspective. ~1300 units of picture height.
    const o = this.observer
    o.orthographic.value = o.orthographic.defaultValue = true
    o.zoom.value = o.zoom.defaultValue = 1023 / (1300 * (16 / 9))
    this.stage(m)

    // The opening — the board's "many connection lines form one circle": the
    // group is first only its relations, a line from its centre to each
    // member; those lines then BECOME the group's boundary (Morph: N curves
    // into one, each a complementary arc of it). A twin of the group circle
    // receives them and hands over to the map's own rim.
    const R = m.radius.value
    // A member sitting at the centre already IS where the lines meet — it
    // gets no line of its own (it would be a stub shorter than its ring).
    const spokes = m.frame().members.filter((p) => Math.hypot(p.x, p.y) > R * 0.25).map((p) => {
      const d = Math.hypot(p.x, p.y)
      const k = (d - R * 0.07) / d
      return new Line({ points: [{ x: 0, y: 0, z: 0 }, { x: p.x * k, y: p.y * k, z: 0 }], stroke: 2.5, creation: 0 })
    })
    const twin = new Circle({ radius: R, stroke: 3, opacity: 0 })
    const relations = new MorphCurves(spokes, [twin], { observer: this.observer, opacity: 0, stroke: 3 })
    for (const h of [...spokes, twin, relations]) this.stage(h)
    this.set(m.rim.to(0))

    this.flowing(3, Create(m), ...spokes.map((l) => l.creation.to(1)))
    this.flowing(0.5)
    this.flowing(2.5, MorphMany(relations))
    this.set(m.rim.to(1), twin.opacity.to(0))
    this.flowing(1)
    // Grain: the categorical dimension, revealed and folded away again.
    this.flowing(2.5, m.grain.to(1))
    this.flowing(1.5)
    this.flowing(2, m.grain.to(0))
    this.flowing(0.5)
    // The flow layers, in the value chain's order.
    this.flowing(1.6, m.stage("raw").shown.to(1))
    this.flowing(1.6, m.stage("semi").shown.to(1))
    this.flowing(1.6, m.stage("finished").shown.to(1))
    this.flowing(3)
    // The chain's order as a dimension: tilt into the stage stack.
    this.flowing(3, m.expand.to(1))
    this.flowing(2.5)
    this.flowing(2.5, m.grain.to(1))
    this.flowing(3)
    // Abstract → concrete: the semi-finished flows become roads, every
    // particle a truck — and back.
    this.flowing(3, m.stage("semi").concrete.to(1))
    this.flowing(3)
    this.flowing(2.5, m.stage("semi").concrete.to(0))
    // And back: flat, face-on, exactly.
    this.flowing(3, m.expand.to(0))
    this.flowing(2)
    // The data arrives: the raw-material inflow's potentiality collapses —
    // the blur crystallises into solid lines.
    this.flowing(3, m.stage("raw").certainty.to(1))
    this.flowing(3)
    // Site focus — the fiber: only site A, what flows into it and what it
    // flows out to remain, rearranged round it; then the whole map returns.
    const focus = m.stateAxis("focus")
    this.flowing(2.2, focus.to("A"))
    this.flowing(3)
    this.flowing(2.2, focus.to("none"))
    this.flowing(1)
  }
}

if (import.meta.main) render(FlowMapDream)
