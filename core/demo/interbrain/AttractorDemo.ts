/**
 * AttractorDemo.ts — A DreamWeaving
 *
 * The freedom-order dialectic of the InterBrain film's first chapter
 * (0:56–5:14), walked through the Dialectic's states:
 *
 *   1. the dialectic — freedom ⚡ order (f346);
 *   2. the attack — both turn to triangles, freedom attacks order, then
 *      order attacks freedom (f391 → f420);
 *   3. the two pathological attractors — Chaos, then Oppression (f496, f541);
 *   4. the endless oscillation — the ball shuttles in the red field, the
 *      pulls on it, the sine it writes on the plane tilted back (f660, f781);
 *   5. the third axis — the eye under the ball, the cross, the cylinder and
 *      the liminal eye; the ball rises into the cylinder (f1381, f1501, f1530).
 *
 * Framing: the default eye projects z = 0 at 720/1500 = 0.48 px per unit.
 * f346: R = 84.5 px (176), the poles ±295 px (span 3.5R). f1501: R = 55 px
 * (115), span 5.05R, the line 186 px below the centre.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { Dialectic } from "../../vocabulary/Attractor/Dialectic"
import { Field } from "../../vocabulary/Field/Field"

const PX = 720 / 1500
/** The red field is a ground, not a figure (f660: dim behind the poles). */
const FIELD = 0.3
/** The plane tilted back while the trace is written (f781: the circle 0.7 as tall as wide). */
const TILT = -0.8

export class AttractorDemoDream extends Dream {
  field = new Field({ opacity: 0 })
  dialectic = new Dialectic({ size: 84.5 / PX })

  /** Play `anims` over `dt` while the ball keeps its cycle and the field flows. */
  private running(dt: number, ...anims: Anim[]): void {
    this.play(
      together(
        this.dialectic.phase.by(dt * 1.6, { easing: "linear" }),
        this.field.time.by(dt, { easing: "linear" }),
        ...anims,
      ),
      dt,
    )
  }

  unfold() {
    const d = this.dialectic
    // 1. The dialectic: freedom, order, and the conflict between them.
    this.play(Create(d), 1.6)
    this.play(d.conflict.to(1), 0.4)
    this.wait(1.2)
    // 2. The attack: freedom becomes an attack on order, order on freedom.
    this.play(together(d.armed.to(1), d.attack.to(1)), 1)
    this.wait(1)
    this.play(d.attack.to(-1), 1)
    this.wait(1)
    this.play(together(d.armed.to(0), d.attack.to(0)), 0.8)
    // 3. Freedom × fragmentation = Chaos; order × fragmentation = Oppression.
    this.play(together(d.chaos.to(1), d.attack.to(-1)), 1.2)
    this.wait(0.8)
    this.play(together(d.oppression.to(1), d.attack.to(1)), 1.2)
    this.play(d.conflict.to(0), 0.4)
    this.wait(1.2)
    // 4. The endless oscillation, in the red field of fragmentation.
    // The poles step back (f660: R 56 px, span ≈ 5R) and the ball appears.
    this.play(together(d.size.to(56 / PX), d.span.to(4.9)), 1)
    this.running(1.2, d.swing.to(1), this.field.opacity.to(FIELD))
    this.running(2)
    // The poles go bare, the plane tilts back and the ball writes its sine (f736, f781).
    this.running(1.4, d.chaos.to(0), d.oppression.to(0), d.labels.to(0), d.trace.to(1), d.p.to(TILT))
    this.running(4)
    // 5. The third axis: out of the red field, the eye under the ball, then up.
    this.running(1.5, this.field.opacity.to(0), d.trace.to(0), d.p.to(0), d.size.to(55 / PX), d.span.to(5.05), d.y.to(-186 / PX))
    this.running(1.2, d.gaze.to(1))
    this.running(2)
    this.running(2.5, d.third.to(0.5))
    this.running(1.5)
    this.running(3, d.third.to(1))
    this.running(1.5)
  }
}

if (import.meta.main) render(AttractorDemoDream)
