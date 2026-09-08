/**
 * Bundled into the repo tree and loaded by a bare page, so three-text +
 * HarfBuzz + the vendored fonts resolve exactly as the renderer resolves
 * them. Writes its numbers to window.__probe.
 */
import { Text as ThreeText } from "three-text"
// Mirrored from core/src/render/text.ts (a probe cannot reach across
// into the repo tree from the scratchpad).
const DEFAULT_FONT_URL = "/core/demo/fonts/Arimo-Regular.ttf"
const MONO_FONT_URL = "/core/demo/fonts/Cousine-Regular.ttf"
const DEFAULT_HARFBUZZ_URL = "/core/demo/wasm/hb.wasm"

declare global {
  interface Window { __probe?: unknown }
}

const size = Number(new URL(location.href).searchParams.get("size") ?? "12.7")

const inkWidth = async (font: string, text: string): Promise<number> => {
  const h = (await ThreeText.create({
    text, font, size, depth: 0, perGlyphAttributes: true,
    removeOverlaps: true, layout: { align: "center" },
  })) as unknown as { geometry: { computeBoundingBox(): void; boundingBox: { min: { x: number }; max: { x: number } } }; dispose?(): void }
  h.geometry.computeBoundingBox()
  const w = h.geometry.boundingBox.max.x - h.geometry.boundingBox.min.x
  h.dispose?.()
  return w
}

const inkHeight = async (font: string, text: string): Promise<number> => {
  const h = (await ThreeText.create({
    text, font, size, depth: 0, perGlyphAttributes: true,
    removeOverlaps: true, layout: { align: "center" },
  })) as unknown as { geometry: { computeBoundingBox(): void; boundingBox: { min: { y: number }; max: { y: number } } }; dispose?(): void }
  h.geometry.computeBoundingBox()
  const v = h.geometry.boundingBox.max.y - h.geometry.boundingBox.min.y
  h.dispose?.()
  return v
}

const run = async () => {
  ThreeText.setHarfBuzzPath(DEFAULT_HARFBUZZ_URL)
  const out: Record<string, Record<string, number>> = {}
  for (const [name, font] of [["mono", MONO_FONT_URL], ["arimo", DEFAULT_FONT_URL]] as const) {
    const w10 = await inkWidth(font, "x".repeat(10))
    const w40 = await inkWidth(font, "x".repeat(40))
    const line = "self.play(Create(cylinder))"
    const wLine = await inkWidth(font, line)
    out[name] = {
      advance_slope: (w40 - w10) / 30,
      line_ink: wLine,
      line_chars: line.length,
      line_per_char: wLine / line.length,
      w_iiii: await inkWidth(font, "iiiiiiiiii"),
      w_MMMM: await inkWidth(font, "MMMMMMMMMM"),
      band_h: await inkHeight(font, line),
      band_h_noDesc: await inkHeight(font, "self.add(cylinder)"),
    }
  }
  window.__probe = out
}
void run().catch((e) => { window.__probe = { error: String(e) } })
