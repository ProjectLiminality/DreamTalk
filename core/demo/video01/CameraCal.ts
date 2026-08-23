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
 * which carries the whole 2021 rig: azimuth PI/4, elevation PI/8, the
 * 1000-unit distance, and the 36mm lens (see dream.ts for the derivation).
 *
 * Under that rig EVERY number below is the source's own, mapped by the fixed
 * axis dictionary (X, Y, Z)c4d -> (x, z, y) and its rotation counterpart
 * (h, p, b)c4d -> (b, p, h). Nothing is fitted. That is the point: with the
 * correct camera, the source coordinates ARE the reference pixels.
 *
 * Three dreams, three separate measurements, so no one number mixes concerns:
 *   CameraCalCylinderDream  the cylinder alone — THE camera proof
 *   CameraCalDream          plus both Eyes — the position check
 *   CameraCalGridDream      the two Axes — the grid-angle check
 */

import { Dream, render } from "../../src/index"
import { PI } from "../../src/constants"
import { Axes, Cylinder, Eye } from "../../src/parts/index"
import { BLUE, RED, WHITE, STROKE_GRID, STROKE_MAIN } from "./palette"

export class CameraCalDream extends Dream {
  // Cylinder(h=0.1, p=0.4) transformed to p=PI/2 by t=12s; C4D Ocylinder
  // defaults r=50 h=200, PRIM_AXIS=4. In C4D the composition R_H(0.1) *
  // R_P(PI/2) sends the +Z cylinder axis to exactly +Y_c4d (heading fixes
  // the vertical), i.e. our +z — the residual h=0.1 is a spin about the
  // cylinder's own axis and invisible. So: nominal size, p=PI/2, nothing
  // else. Predicted screen bbox under the rig: x[499.6, 771.5]
  // y[268.8, 462.1]; measured on f0080: x[498, 773] y[267, 463].
  cylinder = new Cylinder({
    radius: 50,
    height: 200,
    p: PI / 2,
    stroke: STROKE_MAIN,
  })

  // The two Eyes, scale 0.3, exactly where the source puts them. pydeation
  // is a top-view system: its ground plane is XZ_c4d (our xy) and its
  // "y=300" is OUT of that plane (our z) — the rectangler literally hovers
  // above the plane looking down at it. The 45-degree azimuth sees our +x
  // and +z symmetrically, which is why both Eyes render at the same screen
  // height, mirrored about the frame centre (f0080: blue apex measured
  // x=979 vs 977.7 predicted; red apex x=302 vs 302.3).
  //   Eye(scale=0.3, x=300, h=PI, color=BLUE) — "circler", in-plane,
  //   gazing back at the origin: legacy h (about the top-view vertical)
  //   is our b.
  circler = new Eye({ scale: 0.3, x: 300, b: PI, tint: BLUE, stroke: STROKE_MAIN })
  //   Eye(scale=0.3, y=300, b=PI/2, color=RED) — "rectangler", hovering at
  //   our z=300, gazing down along -z: legacy b (about Z_c4d) is our h.
  rectangler = new Eye({ scale: 0.3, z: 300, h: PI / 2, tint: RED, stroke: STROKE_MAIN })

  unfold() {
    this.observer.look("default")
    this.stage(this.cylinder)
    this.stage(this.circler)
    this.stage(this.rectangler)
    this.wait(1)
  }
}

/**
 * THE camera proof: the cylinder alone, under the settled camera, against
 * refs/video-01/frames5/f0080.png — the one landmark whose local geometry
 * we control exactly, so whatever the overlay reports is the projection,
 * not a vocabulary mismatch smuggled into the number.
 */
export class CameraCalCylinderDream extends Dream {
  cylinder = new Cylinder({
    radius: 50,
    height: 200,
    p: PI / 2,
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
 *
 * Both lattices are staged at once (the reference alternates them), but
 * they never share a hue: compare the blue channel against f0105 (t=21.0,
 * plane_circler fully drawn) and the red channel against f0140 (t=28.0,
 * plane_rectangler fully drawn).
 */
export class CameraCalGridDream extends Dream {
  // Axes(b=PI, mode="xz", ...): pydeation's grid lives in its ground plane
  // (our xy — the Axes part maps that over), its z extents become our
  // yStart/yEnd, and the legacy bank about Z_c4d is our h: a half-turn
  // about screen-up, so the long x arm swings to our -x — the lattice
  // recedes LEFT, exactly f0105's vanishing direction.
  planeCircler = new Axes({
    mode: "xy",
    h: PI,
    drawGrid: true,
    drawTicks: false,
    gridTint: BLUE,
    tint: WHITE,
    gridSpacing: 100,
    gridLineLength: 5000,
    xStart: -500,
    xEnd: 2100,
    yStart: -2000,
    yEnd: 400,
    stroke: STROKE_GRID * 2, // Axes halves it for the grid lines
  })
  // Axes(b=PI/2, ...): the quarter-turn about our y stands the lattice up
  // in the zy wall (x arm along -z, receding away from the camera to the
  // screen's upper right — f0140's vanishing direction).
  planeRectangler = new Axes({
    mode: "xy",
    h: PI / 2,
    drawGrid: true,
    drawTicks: false,
    gridTint: RED,
    tint: WHITE,
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
