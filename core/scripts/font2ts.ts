/**
 * Bake a TrueType face's glyph outlines into a TypeScript module:
 *   bun scripts/font2ts.ts <font.ttf> <out.ts> <ExportName>
 *
 * Printable ASCII and Latin-1 (U+0020–007E, U+00A0–00FF). Each glyph is
 * its advance and its contours as flat [x, y, on, x, y, on, …] arrays in
 * font units — TrueType's quadratic B-splines, unflattened, so the runtime
 * (src/geometry/glyphs.ts) chooses the resolution.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { basename } from "node:path"
import { readTTF } from "../src/geometry/ttf"

const [src, out, name = "FONT"] = process.argv.slice(2)
if (!src || !out) {
  console.error("usage: bun scripts/font2ts.ts <font.ttf> <out.ts> <ExportName>")
  process.exit(1)
}
const cps = [
  ...Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => 0x20 + i),
  ...Array.from({ length: 0xff - 0xa0 + 1 }, (_, i) => 0xa0 + i),
]
const font = readTTF(readFileSync(src), cps)
const lines: string[] = []
for (const [cp, g] of [...font.glyphs].sort((a, b) => a[0] - b[0])) {
  const contours = g.contours.map((c) => `[${c.map((p) => `${p.x},${p.y},${p.on ? 1 : 0}`).join(",")}]`)
  lines.push(`  ${cp}: [${g.advance}, [${contours.join(",")}]],`)
}
writeFileSync(
  out,
  `/**
 * ${basename(src)} — glyph outlines as data, baked by scripts/font2ts.ts
 * (do not edit). Printable ASCII + Latin-1; per code point: [advance,
 * contours], each contour a flat [x, y, on, …] TrueType quadratic
 * B-spline in font units. Read through src/geometry/glyphs.ts.
 */

import type { FontData } from "../glyphs"

export const ${name}: FontData = {
  unitsPerEm: ${font.unitsPerEm},
  ascender: ${font.ascender},
  descender: ${font.descender},
  glyphs: {
${lines.join("\n")}
  },
}
`,
)
console.log(`wrote ${out}: ${font.glyphs.size} glyphs`)
