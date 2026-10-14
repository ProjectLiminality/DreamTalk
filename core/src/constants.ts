/**
 * DreamTalk constants — the faithful palette and math constants,
 * carried over from the pydeation era (constants.py).
 */

export interface Color {
  r: number
  g: number
  b: number
}

export const rgb = (r: number, g: number, b: number): Color => ({
  r: r / 255,
  g: g / 255,
  b: b / 255,
})

/** sRGB decode: the linear light a display value (0–1) stands for. */
export const decodeSrgb = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

/**
 * A colour as the SCREEN shows it (0–255 per channel, sampled off a
 * frame), handed to the host decoded — the host treats a tint as linear
 * light and encodes it for display, so a sampled colour lands as sampled.
 * The one place that assumption lives for scene colours (OPEN-THREADS,
 * the colour-space question).
 */
export const seen = (r: number, g: number, b: number): Color => ({
  r: decodeSrgb(r / 255),
  g: decodeSrgb(g / 255),
  b: decodeSrgb(b / 255),
})

export const BLUE: Color = rgb(0, 162, 255)
export const RED: Color = rgb(255, 100, 78)
export const PURPLE: Color = {
  r: (BLUE.r + RED.r) / 2,
  g: (BLUE.g + RED.g) / 2,
  b: (BLUE.b + RED.b) / 2,
}
export const YELLOW: Color = rgb(218, 218, 88)
export const GREEN: Color = rgb(71, 196, 143)
export const WHITE: Color = rgb(255, 255, 255)
export const BLACK: Color = rgb(0, 0, 0)
/**
 * Attention's gold — not of the symbols' palette but of the light laid on
 * them: the glow (src/glow.ts), creator mode's dot and panel. Warm,
 * high-value, unmistakably not the blue/red of the arena.
 */
export const GOLD: Color = rgb(255, 199, 84)

/** A palette colour as CSS — for the overlays that speak the same gold. */
export const cssOf = (c: Color, alpha = 1): string =>
  `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`

export const PI = Math.PI
export const TAU = 2 * Math.PI
export const FPS = 30
export const ASPECT_RATIO = 16 / 9

export const isColor = (v: unknown): v is Color =>
  typeof v === "object" && v !== null &&
  typeof (v as Color).r === "number" &&
  typeof (v as Color).g === "number" &&
  typeof (v as Color).b === "number"
