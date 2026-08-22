/**
 * The vocabulary — Layer-1 primitive holons.
 * Geometry construction arrives with the renderer (PLAN Chapter 4);
 * here each part declares its parameters, which is already enough for
 * timelines, binding, and the editor's parameter panel.
 */

import { Holon } from "../holon"
import { color, length, angle, integer } from "../params"
import { WHITE, PI } from "../constants"

/**
 * Base of all stroke-rendered primitives: a stroke color and a stroke
 * width. Width is in SCREEN PIXELS (worldUnits: false in the host) —
 * the 2021 C4D Sketch & Toon look draws constant-pixel-width lines
 * regardless of depth (see refs/video-01/frame_020.png: the grid stays
 * uniformly thin into the distance). Default 3px reads right at 1080p;
 * the 720p reference lines are ~2px.
 */
export class Stroke extends Holon {
  tint = color(WHITE)
  stroke = length(3)
}

/** A circle — radius and stroke color. */
export class Circle extends Stroke {
  radius = length(100)
}

/** A square — the founding simplicity (square, not rectangle). */
export class Square extends Stroke {
  size = length(200)
}

/** A regular polygon. */
export class Polygon extends Stroke {
  radius = length(100)
  sides = integer(6)
}

/** A circular arc — radius, startAngle → endAngle (radians, CCW). */
export class Arc extends Stroke {
  radius = length(100)
  startAngle = angle(0)
  endAngle = angle(PI / 2)
}

/** An invisible locator — pure transform. */
export class Null extends Holon {}
