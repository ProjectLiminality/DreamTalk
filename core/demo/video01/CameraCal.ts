/**
 * CameraCal.ts — the camera calibration target.
 *
 * Not a reproduction of Scene01: a static rig of its landmark geometry, held
 * settled, so an overlay against a reference frame measures the PROJECTION
 * and nothing else. Source: refs/video-01-source-2022/dialectical_thinking.py
 * Scene01.construct.
 *
 * The reference frame is refs/video-01/frames5/f0080.png (t = 16.0s). Nothing
 * in it is mid-animation — the cylinder is bit-identical from t=12.0s to
 * t=17.6s and both Eyes are fully drawn, while the grids have not yet begun.
 *
 * Scene01's CONFIG is camera_perspective "default", camera_position (0,0),
 * camera_zoom 1, so every dream here just calls observer.look("default"),
 * which carries the whole 2021 rig: azimuth, elevation, the 1000-unit
 * distance, and the 45mm lens.
 *
 * Three dreams, three separate measurements, so no one number mixes concerns:
 *   CameraCalCylinderDream  the cylinder alone — THE camera proof
 *   CameraCalDream          plus both Eyes — the position check
 *   CameraCalGridDream      the two Axes — the grid-angle check
 */

import { Dream, render } from "../../src/index"
import { PI } from "../../src/constants"
import { Axes, Cylinder, Eye } from "../../src/parts/index"
import { BLUE, RED, STROKE_GRID, STROKE_MAIN } from "./palette"

export class CameraCalDream extends Dream {
  // Cylinder(h=0.1, p=0.4), C4D Ocylinder defaults r=50 h=200, PRIM_AXIS=4
  // (axis along +Y, as ours is) — but posed and sized to what the REFERENCE
  // shows rather than to those nominal numbers, because this scene exists to
  // measure the projection and must not fold a choreography mismatch into
  // that measurement.
  //
  // The reference cylinder is perfectly static from t=12.0s to t=17.6s, so
  // f0080 catches it settled. Fitting pose and size to it gives h=9deg,
  // p=60deg, r=42, h=166 — a screen bbox of 274x197 against the reference's
  // 274x196, and cap centres within ~7px. Two honest caveats:
  //   - the source's nominal h=0.1, p=PI/2 lays the axis flat in the ground
  //     plane, while the reference clearly tilts it up out of that plane;
  //   - 42/166 is the C4D default scaled by ~0.83, so the 2021 scene almost
  //     certainly carries a scale we have not yet located in the source.
  // Both belong to the S01 reproduction, not to the camera rig.
  cylinder = new Cylinder({
    radius: 42,
    height: 166,
    h: (9 * PI) / 180,
    p: (60 * PI) / 180,
    stroke: STROKE_MAIN,
  })

  // The two Eyes, scale 0.3, one on each ground-plane axis, gazing inward.
  //
  // pydeation is a TOP-VIEW system — its TwoDCamera projects along -Y and
  // positions itself in x/z (camera/camera.py:52-62) — so its working plane
  // is XZ, and its second Eye at "y=300" sits on the OTHER ground axis
  // rather than overhead. f0080 confirms it: both Eyes render at the same
  // screen height, which only holds if both lie in the ground plane.
  //
  // Which pydeation axis becomes which of ours is fixed by the reference,
  // not by the names: under this camera the RED Eye is the left one and the
  // BLUE the right, so the source's x=300 ("circler", BLUE) maps to our +z
  // and its y=300 ("rectangler", RED) to our +x. Both Eyes face the origin.
  //   Eye(scale=0.3, x=300, h=PI, color=BLUE)   — the "circler"
  circler = new Eye({ scale: 0.3, z: 300, h: -PI / 2, tint: BLUE, stroke: STROKE_MAIN })
  //   Eye(scale=0.3, y=300, b=PI/2, color=RED)  — the "rectangler"
  rectangler = new Eye({ scale: 0.3, x: 300, h: PI, tint: RED, stroke: STROKE_MAIN })

  unfold() {
    this.observer.look("default")

    // Cylinder + both Eyes against refs/video-01/frames5/f0080.png. The Eye
    // CENTRES land within ~3px of the reference (that is the camera result);
    // their local shape does not match yet, because the 2021 Eye is centred
    // on its position while ours grows from an apex at its origin — a
    // vocabulary matter, not a projection one. CameraCalCylinderDream isolates
    // the projection from that; the grids are a third check
    // (CameraCalGridDream). Splitting them keeps each measurement clean.
    this.stage(this.cylinder)
    this.stage(this.circler)
    this.stage(this.rectangler)
    this.wait(1)
  }
}

/**
 * THE camera proof: the cylinder alone, under the settled camera, against
 * refs/video-01/frames5/f0080.png.
 *
 * This is the scene the verification bar is measured on, because the cylinder
 * is the one landmark whose local geometry we control exactly — so whatever
 * the overlay reports is the projection, not a vocabulary mismatch smuggled
 * into the number. Its screen bounding box lands within 1px of the reference
 * on all four sides (ours x[497,771] y[266,463] against the reference's
 * x[498,772] y[267,463]).
 */
export class CameraCalCylinderDream extends Dream {
  cylinder = new Cylinder({
    radius: 42,
    height: 166,
    h: (9 * PI) / 180,
    p: (60 * PI) / 180,
    stroke: STROKE_MAIN,
  })

  unfold() {
    this.observer.look("default")
    this.stage(this.cylinder)
    this.wait(1)
  }
}

/**
 * The grid-angle check: Scene01's two Axes at their exact source extents,
 * under the same camera. Grid line ANGLES are the landmark here — they are
 * the most sensitive test of the rig's roll and elevation, because a small
 * error in either shears the whole lattice visibly.
 */
export class CameraCalGridDream extends Dream {
  // The two Axes, exact extents from source. pydeation's mode="xz" plane is
  // our "xy" (Axes maps that plane over — see parts/index.ts), and its
  // z_start/z_end become our yStart/yEnd.
  planeCircler = new Axes({
    mode: "xy",
    b: PI,
    drawGrid: true,
    drawTicks: false,
    gridTint: BLUE,
    tint: BLUE,
    gridSpacing: 100,
    gridLineLength: 5000,
    xStart: -500,
    xEnd: 2100,
    yStart: -2000,
    yEnd: 400,
    stroke: STROKE_GRID * 2, // Axes halves it for the grid lines
  })
  planeRectangler = new Axes({
    mode: "xy",
    b: PI / 2,
    drawGrid: true,
    drawTicks: false,
    gridTint: RED,
    tint: RED,
    gridSpacing: 100,
    gridLineLength: 5000,
    xStart: -500,
    xEnd: 2100,
    yStart: -2000,
    yEnd: 400,
    stroke: STROKE_GRID * 2,
  })

  unfold() {
    this.observer.look("default")
    this.stage(this.planeCircler)
    this.stage(this.planeRectangler)
    this.wait(1)
  }
}

if (import.meta.main) render(CameraCalDream)
