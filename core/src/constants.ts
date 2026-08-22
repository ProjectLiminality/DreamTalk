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

export const PI = Math.PI
export const TAU = 2 * Math.PI
export const FPS = 30
export const ASPECT_RATIO = 16 / 9

export const isColor = (v: unknown): v is Color =>
  typeof v === "object" && v !== null &&
  typeof (v as Color).r === "number" &&
  typeof (v as Color).g === "number" &&
  typeof (v as Color).b === "number"
