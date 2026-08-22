/**
 * The vocabulary — Layer-1 primitive holons.
 * Geometry construction arrives with the renderer (PLAN Chapter 4);
 * here each part declares its parameters, which is already enough for
 * timelines, binding, and the editor's parameter panel.
 */

import { Holon } from "../holon"
import { color, length, integer } from "../params"
import { WHITE } from "../constants"

/** A circle — radius and stroke color. */
export class Circle extends Holon {
  radius = length(100)
  tint = color(WHITE)
}

/** A square — the founding simplicity (square, not rectangle). */
export class Square extends Holon {
  size = length(200)
  tint = color(WHITE)
}

/** A regular polygon. */
export class Polygon extends Holon {
  radius = length(100)
  sides = integer(6)
  tint = color(WHITE)
}

/** An invisible locator — pure transform. */
export class Null extends Holon {}
