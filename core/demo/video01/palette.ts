/**
 * video-01 presets — the canonical palette and the stroke-width mapping.
 *
 * COLOR: David ruled CANONICAL — the reproduction uses core's constants,
 * not the 2021 hues as they survive in the YouTube encode. These are
 * re-exports so a video-01 scene never hand-rolls an rgb().
 *
 * WIDTH: the 2021 scenes state stroke thickness in Sketch & Toon "pixel
 * units", which are pixels at a reference frame height, not at the render
 * height. pydeation pins that reference explicitly:
 *
 *   sketch_vp[c4d.OUTLINEMAT_PIXELUNITS_INDEPENDENT] = True
 *   sketch_vp[c4d.OUTLINEMAT_PIXELUNITS_BASEW] = 1280
 *   sketch_vp[c4d.OUTLINEMAT_PIXELUNITS_BASEH] = 700
 *      — refs/pydeation-legacy/scene/scene.py:69-74
 *
 * so a thickness of T renders T * (height / 700) pixels. The two
 * thicknesses video-01 actually uses are 5 (axes, primitives, the Eye —
 * pydeation's PRIM_THICKNESS and the Axes default) and 3 (grid lines,
 * which Axes derives as thickness / 2 — custom_objects.py:221-222 — and
 * which video-01's Axes calls leave at that default).
 */

export { BLUE, RED, WHITE, BLACK, PURPLE, YELLOW, GREEN, type Color } from "../../src/constants"

/** Sketch & Toon's pixel-unit reference height (scene.py:74). */
export const PIXEL_UNITS_BASE_HEIGHT = 700

/** 2021 thickness units → rendered pixels at a given frame height. */
export const strokePx = (thickness: number, frameHeight: number): number =>
  thickness * (frameHeight / PIXEL_UNITS_BASE_HEIGHT)

/** The two thicknesses video-01 uses, in 2021 units. */
export const THICKNESS_MAIN = 5
export const THICKNESS_GRID = 3

/**
 * Our stroke widths are screen pixels at the render height, so these are
 * just strokePx() evaluated at the two target heights.
 *
 * Measured against refs/video-01/frames5 (1280x720) for sanity: main
 * strokes read ~4px wide at half-max and grid lines ~1.5px. Both run
 * under the nominal 5.14 / 3.09 because the reference is a YouTube encode
 * of an anti-aliased render — the half-max core of a soft line is
 * narrower than the line. The nominal values are the faithful ones; the
 * measurement confirms the ~1.7x main:grid ratio and rules out any
 * mapping that is off by a factor.
 */
export const STROKE_MAIN_720 = strokePx(THICKNESS_MAIN, 720)
export const STROKE_GRID_720 = strokePx(THICKNESS_GRID, 720)
export const STROKE_MAIN_1080 = strokePx(THICKNESS_MAIN, 1080)
export const STROKE_GRID_1080 = strokePx(THICKNESS_GRID, 1080)

/** Defaults for scenes authored at the 720p reference size. */
export const STROKE_MAIN = STROKE_MAIN_720
export const STROKE_GRID = STROKE_GRID_720
