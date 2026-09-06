/**
 * CurvesShowcase.ts — A DreamWeaving
 *
 * The two DERIVED curves, side by side, each proving itself.
 *
 * Screen right: the Scene-03 construction — a Cylinder with a
 * SectionCurve pinned to the same pose and the same radius/height, the
 * tilted plane cutting a truncated ellipse across its mantle and top
 * cap (refs/video-01/frames5/f0390.png). The proof is geometric, not
 * aesthetic: the curve must sit ON the surface from EVERY viewpoint, so
 * the scene ends by orbiting the observer a quarter turn — a curve that
 * merely looked right in projection would peel off the silhouette.
 * Mid-scene the plane sweeps its `spin` (S03's h 0→2PI on the plane) and
 * flattens its `tilt` toward the cap-parallel circle, exercising the
 * live recompute path through the host's shape dirty-check.
 *
 * Screen left: the Scene-10 construction — three Circles linked by
 * Connection arrows Creating in sequence, each a Catmull-Rom through the
 * anchors' world positions, trimmed 15%/20% off its ends so the head
 * floats clear of the shape it points at (refs/.../f0770.png).
 */

import { Dream, render } from "../src/index"
import { together } from "../src/anim"
import { Create } from "../src/verbs"
import { Circle } from "../src/parts/index"
import { Cylinder } from "../vocabulary/Cylinder/Cylinder"
import { SectionCurve, Connection } from "../src/parts/curves"
import { BLUE, RED, PI } from "../src/constants"

const R = 60
const H = 240

export class CurvesShowcaseDream extends Dream {
  // --- The section construction (S03) ---------------------------------
  // Cylinder and curve share pose AND dimensions — the curve is expressed
  // in cylinder-local space, so an identical transform is what makes
  // "on the surface" mean the same thing for both.
  cylinder = new Cylinder({ x: 260, radius: R, height: H, p: 0.35, b: 0.25 })
  section = new SectionCurve({
    x: 260,
    radius: R,
    height: H,
    p: 0.35,
    b: 0.25,
    // r·tan(1.2) ≈ 154 > halfH 120 → truncated by BOTH caps: the
    // mantle arcs plus the two cap chords, the S03 look (f0390.png).
    tilt: 1.2,
    // Turn the cut's normal into the local Y–Z plane so the ellipse
    // faces the front camera. At spin 0 (normal in local X–Y) this
    // cylinder's pose puts the section EDGE-ON to the default view and
    // it collapses to a straight line — geometrically honest, but it
    // hides the shape until the closing orbit.
    spin: PI / 2,
    tint: BLUE,
  })

  // --- The connection construction (S10) ------------------------------
  thesis = new Circle({ x: -420, y: -120, radius: 46, tint: BLUE })
  antithesis = new Circle({ x: -140, y: -120, radius: 46, tint: RED })
  synthesis = new Circle({ x: -280, y: 150, radius: 46 })

  // Waypoints are absolute (the source made them nulls in world space);
  // the Connection itself stays at the identity transform.
  fromThesis = new Connection(this.thesis, this.synthesis, {
    via: [{ x: -280, y: -120, z: 0 }],
    offsetStart: 0.15,
    offsetEnd: 0.2,
  })
  fromAntithesis = new Connection(this.antithesis, this.synthesis, {
    via: [{ x: -280, y: -120, z: 0 }],
    offsetStart: 0.15,
    offsetEnd: 0.2,
  })

  unfold() {
    this.set(...this.observer.dolly(1150))

    this.play(Create(this.cylinder), 2)
    this.play(Create(this.section), 1.5)
    this.wait(0.4)

    // The three shapes and their arrows, in dialectical sequence.
    this.play(Create(this.thesis), 0.8)
    this.play(Create(this.antithesis), 0.8)
    this.play(Create(this.fromThesis), 0.9)
    this.play(Create(this.fromAntithesis), 0.9)
    this.play(Create(this.synthesis), 0.8)
    this.wait(0.5)

    // Live recompute — every step below reshapes the polyline, so the
    // host's shapeKey dirty-check has to see it. NOTE a centered plane
    // spun about the axis maps the ellipse onto ITSELF (same point set,
    // different parameterization) — visually a no-op, which is why the
    // morph drives `offset` and `tilt` instead.
    //
    // Slide the plane along its normal: the truncated section travels up
    // the cylinder, its cap chords shortening until it clears the rim.
    this.play(this.section.offset.to(70), 2)
    this.play(this.section.offset.to(-70), 2.5)
    this.play(this.section.offset.to(0), 1.5)
    // Flatten to the cap-parallel circle and back: truncated → ellipse →
    // circle → ellipse → truncated, all four kinds in one motion.
    this.play(this.section.tilt.to(0.001), 2)
    this.play(this.section.tilt.to(1.2), 2)
    this.wait(0.3)

    // The geometric proof: same instant, different viewpoint.
    this.play(together(...this.observer.orbit({ phi: PI / 2.4 })), 3)
    this.wait(0.6)
  }
}

if (import.meta.main) render(CurvesShowcaseDream)
