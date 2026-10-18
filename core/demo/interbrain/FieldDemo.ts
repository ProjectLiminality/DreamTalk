/**
 * FieldDemo.ts — A DreamWeaving
 *
 * The Field standing alone, walking the film's own turn: the red field of
 * fragmentation flies out of its vanishing point (f736); it holds its
 * breath and whitens; a wave of cyan acceleration spreads from the centre
 * (f1591 → f1621); the field fades, a circle draws, and a cyan ray-burst
 * rings it (f12721, the liminal eye's burst).
 *
 * Time runs through every step (`flowing`), so the particles never stop.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { Circle } from "../../src/parts/primitives"
import { WHITE } from "../../src/constants"
import { Field } from "../../vocabulary/Field/Field"
import { LENS_RADIUS_RATIO, LENS_STROKE_RATIO, MolochEye } from "../../vocabulary/MolochEye/MolochEye"
import type { Vec2 } from "../../src/geometry/flower"

/** Default observer: 720 px across 1500 units at z = 0. */
const PX_PER_UNIT = 720 / 1500

export class FieldDemoDream extends Dream {
  field = new Field()
  /** The rim of the burst (f12721: the iris ring is ~100 px, the burst ~340 px). */
  rim = new Circle({ radius: 100 / PX_PER_UNIT, tint: WHITE, stroke: 4 })
  burst = new Field({
    mode: "burst",
    wholeness: 1,
    radius: 100 / PX_PER_UNIT,
    reach: 240 / PX_PER_UNIT,
    stroke: 1.5,
    count: 4000,
    creation: 0,
  })

  /** Play `anims` over `dt` seconds while both fields keep flowing. */
  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(
      together(this.field.time.by(dt, { easing: "linear" }), this.burst.time.by(dt, { easing: "linear" }), ...anims),
      dt,
    )
  }

  unfold() {
    this.flowing(1.5, Create(this.field))
    this.flowing(3)
    // Fragmentation → the white pause → wholeness spreading from the centre.
    this.flowing(1.5, this.field.wholeness.to(0.5))
    this.flowing(3, this.field.wholeness.to(1, { easing: "linear" }))
    this.flowing(2)
    // The burst around a circle.
    this.flowing(1.2, this.field.opacity.to(0), Create(this.rim))
    this.flowing(1.2, Create(this.burst))
    this.flowing(3)
  }
}

/**
 * The lens outline of a MolochEye of half-height h — its two 3-4-5 arcs
 * (R = 2.5h, centres (0, ∓1.5h), tips at (±2h, 0)) — as one closed polyline.
 */
const lensOutline = (h: number, steps = 48): Vec2[] => {
  const R = LENS_RADIUS_RATIO * h
  const c = R - h
  const half = Math.asin(2 / LENS_RADIUS_RATIO)
  const pts: Vec2[] = []
  for (let k = 0; k <= steps; k++) {
    const a = Math.PI / 2 + half - (2 * half * k) / steps
    pts.push({ x: R * Math.cos(a), y: -c + R * Math.sin(a) })
  }
  for (let k = 1; k <= steps; k++) {
    const a = -Math.PI / 2 + half - (2 * half * k) / steps
    pts.push({ x: R * Math.cos(a), y: c + R * Math.sin(a) })
  }
  return pts
}

/**
 * The swarm (f46, f12661): red strands crawling over the domesticated eye,
 * then the eye's capture dissolving — the strands blown away.
 */
export class FieldSwarmDemoDream extends Dream {
  /** f46: lens half-height ~104 px at 720p. */
  eye = new MolochEye({ height: 104 / PX_PER_UNIT, stroke: LENS_STROKE_RATIO * 104 * 1.6 })
  swarm = new Field({
    mode: "swarm",
    shape: [lensOutline(104 / PX_PER_UNIT)],
    reach: 55 / PX_PER_UNIT,
    stroke: 1.6,
    creation: 0,
  })

  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.swarm.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    this.flowing(1.5, Create(this.eye), Create(this.swarm))
    this.flowing(3)
    this.flowing(2.5, this.swarm.dissolve.to(1))
    this.flowing(1)
  }
}

if (import.meta.main) render(FieldDemoDream)
