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
 *
 * ...but that is only HALF the mapping, and the missing half is why
 * every line in the reproduction was ~1.76x too fat for ten scenes.
 * Every pydeation stroke also carries Sketch & Toon's distance-based
 * thickness attenuation:
 *
 *   sketch_mat[c4d.OUTLINEMAT_THICKNESS_DISTANCE] = True
 *   sketch_mat[c4d.OUTLINEMAT_THICKNESS_DISTANCE_STRENGTH] = 0.6
 *   sketch_mat[c4d.OUTLINEMAT_THICKNESS_DISTANCE_RANGE] = 1  # camera
 *      — refs/pydeation-legacy/object/object.py:207-209
 *
 * set on the material of EVERY object (set_sketch_mat is called from
 * the base __init__), so it is not a per-scene choice but a property of
 * the 2021 look itself. At video-01's camera distances it measures as a
 * near-constant 0.6 factor: the reference's stroke ink width is flat
 * across depth (S04 f0420, 370 isolated runs: p5 2.83px, p50 2.92px,
 * p75 3.21px), so we model it as the constant it behaves like rather
 * than reimplementing S&T's depth ramp.
 *
 * MEASUREMENT (the ground truth this mapping is now fitted to). Stroke
 * width must be measured as area/peak in LINEAR light — sum of the
 * cross-section divided by its peak. Half-max width (FWHM) is the wrong
 * ruler here: it is read off sRGB-encoded pixels, so it flatters a hard
 * plateau and penalises a soft falloff, and it was FWHM that made the
 * old numbers look defensible. In linear light, on refs/video-01/frames5:
 *
 *   family   thickness   measured ink      this mapping predicts
 *   main         5        2.92 px           5 * 720/700 * 0.6 = 3.09
 *   grid         3        1.85 px           3 * 720/700 * 0.6 = 1.85
 *
 * The renderer itself is exact — render/ribbon.ts converts `stroke = N`
 * into N px of linear ink to within 0.01px at every value tested (1–12),
 * so this file is the only place the 2021 units are interpreted.
 *
 * The trap that hid this: main:grid is 5/3 = 1.67, and the absolute
 * error was 1/0.6 = 1.67 too. The previous version of this comment
 * checked the RATIO, found it right, and concluded the mapping could
 * not be "off by a factor". Both numbers being 1.67 is a coincidence;
 * a ratio can never validate a scale.
 */

export { BLUE, RED, WHITE, BLACK, PURPLE, YELLOW, GREEN, type Color } from "../../src/constants"

/** Sketch & Toon's pixel-unit reference height (scene.py:74). */
export const PIXEL_UNITS_BASE_HEIGHT = 700

/**
 * S&T's distance-based thickness attenuation, set on every pydeation
 * sketch material (object.py:208). Constant here — see the header on why
 * a constant is faithful at video-01's camera distances.
 */
export const THICKNESS_DISTANCE_STRENGTH = 0.6

/** 2021 thickness units → rendered pixels at a given frame height. */
export const strokePx = (thickness: number, frameHeight: number): number =>
  thickness * (frameHeight / PIXEL_UNITS_BASE_HEIGHT) * THICKNESS_DISTANCE_STRENGTH

/** The two thicknesses video-01 uses, in 2021 units. */
export const THICKNESS_MAIN = 5
export const THICKNESS_GRID = 3

/**
 * Our stroke widths are screen pixels at the render height, so these are
 * just strokePx() evaluated at the two target heights. At 720p that is
 * 3.09px main / 1.85px grid, against the reference's measured 2.92 /
 * 1.85 — see the header for the measurement and its method.
 */
export const STROKE_MAIN_720 = strokePx(THICKNESS_MAIN, 720)
export const STROKE_GRID_720 = strokePx(THICKNESS_GRID, 720)
export const STROKE_MAIN_1080 = strokePx(THICKNESS_MAIN, 1080)
export const STROKE_GRID_1080 = strokePx(THICKNESS_GRID, 1080)

/** Defaults for scenes authored at the 720p reference size. */
export const STROKE_MAIN = STROKE_MAIN_720
export const STROKE_GRID = STROKE_GRID_720
