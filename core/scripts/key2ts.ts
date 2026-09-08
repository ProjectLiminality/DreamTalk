/**
 * key2ts — convert decoded Keynote slides into checked-in TypeScript
 * data modules. The sibling of core/scripts/svg2ts.ts, in the same mold.
 *
 *   bun core/scripts/key2ts.ts --slides 1,2,3,4,5,6,19
 *   bun core/scripts/key2ts.ts --all
 *   bun core/scripts/key2ts.ts --decode          # re-run the Python half first
 *
 * Why a build step and not a fetch: the framework runs in a browser,
 * which cannot read a .key off disk — and could not decode Apple's .iwa
 * protobuf if it could. The deck is frozen (2023-02-14, one day before
 * the upload), so flattening it once at author time and committing the
 * result makes the polylines part of the source the way every other
 * construction is: reviewable, diffable, and identical on every machine.
 *
 * THE PIPELINE HAS TWO HALVES, AND THE SPLIT IS THE LANGUAGE BOUNDARY
 *
 *   .key/Index/*.iwa
 *      --[core/scripts/keydecode.py, keynote-parser]-->  slides.json
 *      --[this script + core/src/geometry/keynote.ts]-->  *.ts
 *
 * The Python half DECODES ONLY: it walks archives, resolves style
 * inheritance, and emits typed path elements untouched. Every geometric
 * act — flattening, the design-box fit, the frame — is TypeScript, in
 * core/src/geometry/keynote.ts, where the tests can reach it. That is
 * the same division svg2ts.ts keeps with svg.ts, and it is the reason a
 * bug in the fit rule is a unit test rather than a re-decode.
 *
 * The intermediate slides.json is NOT checked in (9 MB of protobuf
 * echo); the generated modules are. Each carries the source archive's
 * SHA-256 so a drifted deck is visible in a diff, and the emission is
 * deterministic — same slides.json, byte-identical modules.
 *
 * Coordinates are emitted in SLIDE units (1920x1080, y DOWN, origin
 * top-left) with no scaling and no flip: those are the `Slide` holon's,
 * and baking them in would freeze a scene-level decision into an asset
 * — and would make every number in docs/reports/pl02-vocabulary.md
 * unreadable against the modules.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join, resolve } from "node:path"
import {
  importShapePath,
  colorToHex,
  type KeyPathElement,
  type KeyGeometry,
  type KeyColor,
  type KeyStroke,
  type KeyBuild,
  type KeyBuildChunk,
  type KeyGroup,
  type KeyTransition,
} from "../src/geometry/keynote"

const REPO = resolve(import.meta.dir, "../..")
const KEY_DIR = join(REPO, "refs/pitch/pl02/key")
const DECODED = join(REPO, "refs/pitch/pl02/analysis/keyslides.json")
const OUT_DIR = join(REPO, "core/vocabulary/Slides/assets/pl02")
/** keynote-parser's own interpreter — the system python3 lacks the library. */
const KEY_PYTHON = "/Users/davidrug/.local/pipx/venvs/keynote-parser/bin/python"

/** Decimal places kept per coordinate — 1/1000 of a slide unit is
 *  1/1500 of a video pixel, far below anything the encode records. */
const PRECISION = 3

/**
 * The size budget for the checked-in corpus, in KB of TypeScript.
 *
 * MEASURED: `--all` emits all 58 slides as **1,825 KB**. So the whole
 * deck fits inside a 2 MB budget and nothing forces a partial emission
 * — the reason the default is nevertheless the chapter set (154 KB) is
 * editorial, not technical. Slide 11 alone (the density peak: 210
 * shapes, 105 groups, 105 builds) and slide 17 (172 shapes, 102
 * connection lines) are a large fraction of that 1.8 MB, and neither is
 * needed before chapters P-9 and P-10. Committing them now would put
 * ~1.7 MB of generated geometry into the history eight chapters before
 * anything reads it.
 *
 * So: `--all` is one flag away and costs nothing structural, and each
 * later chapter emits the slides it actually opens. The budget stays as
 * the guard against the case that would matter — a flattener change
 * that quietly multiplies the point count.
 */
const SIZE_BUDGET_KB = 2048

/**
 * The slides the campaign has emitted so far — the CHECKED-IN set, and
 * therefore what a bare run must reproduce.
 *
 * 1 (the title card, reused as the 19th segment and the closing frame)
 * and 2-6 (the opening arc) for P-2 and P-3; deck 19 alongside; 32 as
 * P-2's grouped-slide proof, the one that caught the group-offset bug.
 *
 * KEEP THIS IN SYNC when a chapter emits a new slide. `--slides N`
 * rewrites index.ts to hold exactly what that run emitted, so running
 * `--slides 32` alone would drop the other seven from the barrel; adding
 * N here and re-running bare is what puts the set back. (The alternative
 * — merging into the existing barrel — was rejected: it would make the
 * generated directory depend on what happened to be on disk, and the
 * whole point of the codegen is that the same input gives the same
 * output on every machine.)
 */
const CHAPTER_SLIDES = [1, 2, 3, 4, 5, 6, 19, 32]

const fmt = (n: number): string => {
  const s = n.toFixed(PRECISION)
  const trimmed = s.includes(".") ? s.replace(/\.?0+$/, "") : s
  return trimmed === "-0" || trimmed === "" ? "0" : trimmed
}

// ---------------------------------------------------------------------------
// What keydecode.py hands us
// ---------------------------------------------------------------------------

interface DecodedShape {
  kind: "shape"
  id: string
  icon?: string
  frame: KeyGeometry
  elements: KeyPathElement[]
  opacity: number
  stroke?: KeyStroke
  fill?: { color: KeyColor }
}

interface DecodedText {
  kind: "text"
  id: string
  content: string
  frame: KeyGeometry
  align: string
  verticalAlign: string
  padding: { left: number; top: number; right: number; bottom: number }
  lineSpacing: number
  tracking?: number
  fontSize: number
  fontName: string
  bold: boolean
  italic: boolean
  color: KeyColor
  opacity: number
}

interface DecodedSlide {
  index: number
  id: string
  source: string
  hash: string
  drawables: (DecodedShape | DecodedText)[]
  groups: KeyGroup[]
  builds: KeyBuild[]
  buildChunks: KeyBuildChunk[]
  transition?: KeyTransition | null
  skipped: string[]
}

// ---------------------------------------------------------------------------
// Emission
// ---------------------------------------------------------------------------

/**
 * A dash array in STROKE-WIDTH multiples, or undefined when solid.
 *
 * Keynote states dashes as multiples of the stroke width (a
 * `TSDPattern` of (0.001, 2.0) on a 1pt line is the deck's fine dotted
 * mesh; (6, 6) is the coarse dash), which is also how core's
 * `DottedLine` wants them, so the numbers pass straight through.
 */
const dashOf = (stroke: KeyStroke | undefined): number[] | undefined => {
  if (!stroke) return undefined
  if (stroke.patternType !== "TSDPattern") return undefined
  const pattern = stroke.pattern.filter((n) => Number.isFinite(n))
  return pattern.length > 0 ? pattern : undefined
}

/**
 * Drop the keys the decoder left null.
 *
 * A Keynote archive omits a field it has no value for, and the Python
 * side faithfully carries that through as `null` — but the TypeScript
 * interfaces state those fields as OPTIONAL (`acceleration?`), so a
 * literal `null` is a type error rather than an absence. Stripping them
 * at emission keeps the generated modules assignable and keeps the
 * absence honest: a build with no declared acceleration has no key,
 * not a key holding nothing.
 */
const dropNulls = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null)) as Partial<T>

const emitShape = (shape: DecodedShape): string[] => {
  const { subpaths, closed } = importShapePath(shape.elements, shape.frame)
  const lines: string[] = []
  lines.push("    {")
  lines.push(`      id: ${JSON.stringify(shape.id)},`)
  if (shape.icon) lines.push(`      icon: ${JSON.stringify(shape.icon)},`)
  lines.push("      subpaths: [")
  for (const sp of subpaths) {
    lines.push(`        [${sp.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(", ")}],`)
  }
  lines.push("      ],")
  lines.push(`      closed: [${closed.map((c) => (c ? "1" : "0")).join(",")}],`)
  if (shape.stroke) {
    lines.push(`      stroke: ${JSON.stringify(colorToHex(shape.stroke.color))},`)
    lines.push(`      strokeWidth: ${fmt(shape.stroke.width)},`)
    const dash = dashOf(shape.stroke)
    if (dash) {
      lines.push(`      dash: [${dash.map(fmt).join(", ")}],`)
      // The cap is emitted only alongside a dash, because that is where
      // it changes the geometry: a round cap adds one stroke width to
      // the period. See SlideShapeData.cap.
      lines.push(`      cap: ${JSON.stringify(shape.stroke.cap)},`)
    }
  }
  if (shape.fill) lines.push(`      fill: ${JSON.stringify(colorToHex(shape.fill.color))},`)
  lines.push(`      opacity: ${fmt(shape.opacity * (shape.stroke?.color.a ?? 1))},`)
  lines.push("    },")
  return lines
}

const emitText = (text: DecodedText): string[] => [
  "    {",
  '      kind: "text",',
  `      id: ${JSON.stringify(text.id)},`,
  `      content: ${JSON.stringify(text.content)},`,
  `      frame: { position: { x: ${fmt(text.frame.position.x)}, y: ${fmt(text.frame.position.y)} },` +
    ` size: { width: ${fmt(text.frame.size.width)}, height: ${fmt(text.frame.size.height)} },` +
    ` angle: ${fmt(text.frame.angle ?? 0)} },`,
  `      align: ${JSON.stringify(text.align)},`,
  `      verticalAlign: ${JSON.stringify(text.verticalAlign)},`,
  `      padding: { left: ${fmt(text.padding.left)}, top: ${fmt(text.padding.top)},` +
    ` right: ${fmt(text.padding.right)}, bottom: ${fmt(text.padding.bottom)} },`,
  `      lineSpacing: ${fmt(text.lineSpacing)},`,
  // Tracking is emitted only when the deck declares one, so a record
  // that never had it produces the same bytes it always did — and an
  // untracked record reads as the face's own advance either way.
  ...(text.tracking ? [`      tracking: ${fmt(text.tracking)},`] : []),
  `      fontSize: ${fmt(text.fontSize)},`,
  `      fontName: ${JSON.stringify(text.fontName)},`,
  `      bold: ${text.bold},`,
  `      italic: ${text.italic},`,
  `      color: { r: ${fmt(text.color.r)}, g: ${fmt(text.color.g)},` +
    ` b: ${fmt(text.color.b)}, a: ${fmt(text.color.a)} },`,
  `      opacity: ${fmt(text.opacity)},`,
  "    },",
]

const moduleName = (index: number): string => `slide${String(index).padStart(2, "0")}`

const convert = (slide: DecodedSlide): { name: string; bytes: number } => {
  const shapes = slide.drawables.filter((d): d is DecodedShape => d.kind === "shape")
  const texts = slide.drawables.filter((d): d is DecodedText => d.kind === "text")
  const name = moduleName(slide.index)

  const lines: string[] = []
  lines.push("/**")
  lines.push(` * PL02 slide ${slide.index} — generated by core/scripts/key2ts.ts.`)
  lines.push(" * Do not edit by hand.")
  lines.push(" *")
  lines.push(` * Source: ${slide.source}`)
  lines.push(` * SHA-256 (first 16): ${slide.hash}`)
  lines.push(
    ` * ${shapes.length} shapes, ${texts.length} texts, ${slide.groups.length} groups,` +
      ` ${slide.builds.length} builds.`,
  )
  lines.push(" * Coordinates are in SLIDE units (1920x1080, y down, origin top-left);")
  lines.push(" * the frame change to world is the Slide holon's.")
  if (slide.skipped.length > 0) {
    lines.push(` * Skipped archive types: ${slide.skipped.join(", ")}`)
  }
  lines.push(" */")
  lines.push("")
  lines.push('import type { SlideData } from "../../../../src/geometry/keynote"')
  lines.push("")
  lines.push(`export const ${name}: SlideData = {`)
  lines.push(`  index: ${slide.index},`)
  lines.push(`  id: ${JSON.stringify(slide.id)},`)
  lines.push(`  source: ${JSON.stringify(slide.source)},`)
  lines.push(`  hash: ${JSON.stringify(slide.hash)},`)
  lines.push("  shapes: [")
  for (const shape of shapes) lines.push(...emitShape(shape))
  lines.push("  ],")
  lines.push("  texts: [")
  for (const text of texts) lines.push(...emitText(text))
  lines.push("  ],")
  lines.push(`  groups: ${JSON.stringify(slide.groups)},`)
  // Builds in the deck's declared order — NOT sorted. The order is the
  // slide's own `builds` list and P-3 reads it as the build sequence.
  lines.push("  builds: [")
  for (const build of slide.builds) lines.push(`    ${JSON.stringify(dropNulls(build))},`)
  lines.push("  ],")
  // The click grouping, in click order. Emitted only when the slide has
  // one, so a build-free slide stays terse.
  if (slide.buildChunks?.length) {
    lines.push("  buildChunks: [")
    for (const chunk of slide.buildChunks) lines.push(`    ${JSON.stringify(chunk)},`)
    lines.push("  ],")
  }
  if (slide.transition) {
    lines.push(`  transition: ${JSON.stringify(dropNulls(slide.transition))},`)
  }
  lines.push("}")
  lines.push("")

  const body = lines.join("\n")
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `${name}.ts`), body)
  const points = shapes.reduce(
    (n, s) => n + importShapePath(s.elements, s.frame).subpaths.reduce((m, sp) => m + sp.length, 0),
    0,
  )
  console.log(
    `slide ${String(slide.index).padStart(2)}  ${String(shapes.length).padStart(4)} shapes` +
      ` ${String(texts.length).padStart(3)} texts ${String(points).padStart(7)} points` +
      ` ${String(Math.round(body.length / 1024)).padStart(5)} KB`,
  )
  return { name, bytes: body.length }
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
if (args.includes("--help") || args.includes("-h")) {
  console.error("usage: bun core/scripts/key2ts.ts [--decode] [--all | --slides 1,2,19]")
  process.exit(1)
}

if (args.includes("--decode") || !existsSync(DECODED)) {
  console.log("decoding the deck (keynote-parser)…")
  execFileSync(KEY_PYTHON, [join(REPO, "core/scripts/keydecode.py"), KEY_DIR, DECODED], {
    stdio: ["ignore", "inherit", "inherit"],
    cwd: REPO,
  })
}

const decoded = JSON.parse(readFileSync(DECODED, "utf8")) as { slides: DecodedSlide[] }

const slideArg = args.indexOf("--slides")
const wanted = args.includes("--all")
  ? decoded.slides.map((s) => s.index)
  : slideArg >= 0 && args[slideArg + 1]
    ? args[slideArg + 1]!.split(",").map(Number)
    : CHAPTER_SLIDES

const selected = decoded.slides.filter((s) => wanted.includes(s.index))
if (selected.length === 0) {
  console.error(`no slides matched ${wanted.join(",")}`)
  process.exit(1)
}

const emitted = selected.map(convert)
const totalKb = emitted.reduce((n, e) => n + e.bytes, 0) / 1024
console.log(`\n${emitted.length} slide module(s), ${totalKb.toFixed(0)} KB total`)
if (totalKb > SIZE_BUDGET_KB) {
  console.warn(
    `WARNING: ${totalKb.toFixed(0)} KB exceeds the ${SIZE_BUDGET_KB} KB budget —` +
      " emit fewer slides, or raise the budget deliberately.",
  )
}

// The barrel: one import site, and the record of which slides exist.
const index: string[] = [
  "/**",
  " * The PL02 deck's slide modules — generated by core/scripts/key2ts.ts.",
  " * Do not edit by hand.",
  " *",
  ' * "Project Liminality" (2023-02-15), the 88-slide production deck that',
  " * IS the video — 100% Keynote, no pydeation, no footage",
  " * (docs/reports/pl02-vocabulary.md). Only slides 1-58 are in scope:",
  " * 59-83 are later additions that appear nowhere in the video.",
  " *",
  ` * Emitted here: ${emitted.map((e) => e.name).join(", ")}.`,
  " * The rest generate on demand — `bun core/scripts/key2ts.ts --slides N`.",
  " */",
  "",
  ...emitted.map((e) => `export { ${e.name} } from "./${e.name}"`),
  "",
]
writeFileSync(join(OUT_DIR, "index.ts"), index.join("\n"))
console.log(`written to ${OUT_DIR}`)
