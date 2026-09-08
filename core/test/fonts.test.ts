/**
 * The face — how a deck's declared typeface reaches the renderer, and
 * what happens on a machine that does not have it.
 *
 * The subject of chapter P-2. Every expected value comes from the deck,
 * from the OpenType spec, or from macOS's own font file — never from the
 * code under test. Two of the suites are deliberately machine-dependent
 * in only ONE direction: the extraction tests skip where the system font
 * is absent (a Linux CI has no HelveticaNeue.ttc and never will), while
 * the CHAIN tests run everywhere, because the fallback is a behaviour to
 * be pinned rather than an accident of the checkout.
 */

import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  listFaces,
  extractFace,
  faceIndexOf,
  sfntChecksum,
} from "../src/render/ttc"
import {
  SYSTEM_FACES,
  systemFontPath,
  cachedFontUrl,
  fallbackFontUrl,
  fontChain,
  isSystemFace,
  FONT_CACHE_DIR,
} from "../src/render/fonts"
import {
  DEFAULT_FONT_URL,
  MONO_FONT_URL,
  resolveFont,
  fontCandidates,
} from "../src/render/text"
import { textBaseline, textAnchorX, type KeyText } from "../src/geometry/keynote"

const REPO = resolve(import.meta.dir, "../..")
const HELVETICA_NEUE = "/System/Library/Fonts/HelveticaNeue.ttc"

// ---------------------------------------------------------------------------
// The chain — runs everywhere, including where no system font exists
// ---------------------------------------------------------------------------

describe("the fallback chain", () => {
  test("a name the repo can source from the system yields cache THEN fallback", () => {
    // Two candidates, best first. This is the whole licensing
    // arrangement in one assertion: the real face when the machine has
    // it, the vendored one when it does not.
    expect(fontChain("HelveticaNeue-Bold")).toEqual([
      "/refs/fonts/HelveticaNeue-Bold.ttf",
      DEFAULT_FONT_URL,
    ])
  })

  test("every face the deck declares is in the chain", () => {
    // The recon's font inventory (docs/reports/pl02-vocabulary.md
    // §"Typography and palette"): HelveticaNeue regular, -Medium and
    // -Bold, plus one stray Helvetica.
    for (const name of ["HelveticaNeue", "HelveticaNeue-Medium", "HelveticaNeue-Bold", "Helvetica"]) {
      expect(fontChain(name)).toHaveLength(2)
      expect(fontChain(name)[0]).toBe(cachedFontUrl(name))
    }
  })

  test("an unknown name passes through unchanged — a URL is still a URL", () => {
    expect(fontChain("/some/other/Face.ttf")).toEqual(["/some/other/Face.ttf"])
  })

  test("nothing declared takes the default, and only the default", () => {
    expect(fontChain(undefined)).toEqual([DEFAULT_FONT_URL])
    expect(fontChain("")).toEqual([DEFAULT_FONT_URL])
  })

  test("a monospace name falls back to Cousine, not Arimo", () => {
    expect(fallbackFontUrl("Courier New")).toBe(MONO_FONT_URL)
    expect(fallbackFontUrl("Menlo-Regular")).toBe(MONO_FONT_URL)
    expect(fallbackFontUrl("HelveticaNeue-Bold")).toBe(DEFAULT_FONT_URL)
  })

  test("the cache lives under the gitignored refs/ tree", () => {
    // Apple's fonts may not be committed, so the cache MUST sit
    // somewhere .gitignore excludes. `refs/` is that shelf.
    expect(FONT_CACHE_DIR.startsWith("refs/")).toBe(true)
    expect(isSystemFace(cachedFontUrl("HelveticaNeue-Bold"))).toBe(true)
    expect(isSystemFace(DEFAULT_FONT_URL)).toBe(false)
  })

  test("SYSTEM_FACES names a real collection path for every entry", () => {
    for (const [name, path] of Object.entries(SYSTEM_FACES)) {
      expect(systemFontPath(name)).toBe(path)
      expect(path.endsWith(".ttc")).toBe(true)
    }
  })
})

describe("fontCandidates — the renderer's own resolution", () => {
  test("an alias resolves to ONE url, exactly as resolveFont always did", () => {
    // Byte-identity for every consumer written before P-2: an alias or
    // an unset font must take the same single await it always took.
    expect(fontCandidates(undefined)).toEqual([resolveFont(undefined)])
    expect(fontCandidates("mono")).toEqual([resolveFont("mono")])
    expect(fontCandidates("default")).toEqual([resolveFont("default")])
    expect(fontCandidates("/core/demo/fonts/Arimo-Regular.ttf")).toEqual([
      resolveFont("/core/demo/fonts/Arimo-Regular.ttf"),
    ])
  })

  test("only a SYSTEM_FACES name grows a second candidate", () => {
    expect(fontCandidates("HelveticaNeue-Bold")).toHaveLength(2)
    expect(fontCandidates("mono")).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// The extraction — a .ttc face repacked as a standalone .ttf
// ---------------------------------------------------------------------------

const haveSystemFont = existsSync(HELVETICA_NEUE)

describe.if(haveSystemFont)("extracting a face from the system collection", () => {
  // Read once, synchronously, so each test works on the same bytes and
  // none of them has to be async. Skipped wholesale where the
  // collection is absent (any non-macOS machine), which is why the
  // CHAIN suite above is the one that pins the fallback everywhere.
  const bytes = new Uint8Array(readFileSync(HELVETICA_NEUE))

  test("the collection holds the faces the deck names", () => {
    const names = listFaces(bytes).map((f) => f.postScriptName)
    // Not an assertion about macOS's whole font library — only that the
    // three faces PL02 declares are reachable, which is the claim the
    // font decision rests on.
    expect(names).toContain("HelveticaNeue")
    expect(names).toContain("HelveticaNeue-Medium")
    expect(names).toContain("HelveticaNeue-Bold")
  })

  test("Bold is NOT face 0 — which is why three-text alone cannot do this", () => {
    // three-text hardcodes `hb.createFace(blob, 0)`, so even if it
    // accepted a .ttc it would hand back Regular where the title card
    // wants Bold. This is the reason the extractor exists.
    expect(faceIndexOf(bytes, "HelveticaNeue")).toBe(0)
    expect(faceIndexOf(bytes, "HelveticaNeue-Bold")).toBeGreaterThan(0)
  })

  test("an extracted face is a valid single-face sfnt", () => {
    const out = extractFace(bytes, faceIndexOf(bytes, "HelveticaNeue-Bold"))
    const view = new DataView(out.buffer)
    // 0x00010000 is TrueType — the signature three-text's FontLoader
    // accepts and `ttcf` is not.
    expect(view.getUint32(0)).toBe(0x00010000)
    const numTables = view.getUint16(4)
    expect(numTables).toBeGreaterThan(8)
    // The spec's binary-search hints must describe the table count.
    const entrySelector = view.getUint16(8)
    expect(1 << entrySelector).toBeLessThanOrEqual(numTables)
    expect(1 << (entrySelector + 1)).toBeGreaterThan(numTables)
    expect(view.getUint16(6)).toBe((1 << entrySelector) * 16)
  })

  test("every table is 4-byte aligned and inside the file", () => {
    const out = extractFace(bytes, faceIndexOf(bytes, "HelveticaNeue-Bold"))
    const view = new DataView(out.buffer)
    const numTables = view.getUint16(4)
    for (let i = 0; i < numTables; i++) {
      const at = 12 + i * 16
      const offset = view.getUint32(at + 8)
      const length = view.getUint32(at + 12)
      expect(offset % 4).toBe(0)
      expect(offset + length).toBeLessThanOrEqual(out.length)
    }
  })

  test("the file checksum closes — head.checkSumAdjustment is right", () => {
    // OpenType, "head": the whole file's checksum plus
    // checkSumAdjustment must equal 0xB1B0AFBA. A reader that verifies
    // (and Apple's tools do) rejects a file where it does not.
    const out = extractFace(bytes, faceIndexOf(bytes, "HelveticaNeue-Bold"))
    expect(sfntChecksum(out, 0, out.length)).toBe(0xb1b0afba)
  })

  test("extraction is deterministic — the cache is a cache, not a build", () => {
    const index = faceIndexOf(bytes, "HelveticaNeue-Bold")
    const a = extractFace(bytes, index)
    const b = extractFace(bytes, index)
    expect(a.length).toBe(b.length)
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0)
  })

  test("the glyph outlines are Apple's bytes, not a re-encoding", () => {
    // The whole claim of the repack: table BODIES are copied verbatim.
    // Compare the extracted `glyf` against the same range in the
    // collection.
    const index = faceIndexOf(bytes, "HelveticaNeue-Bold")
    const out = extractFace(bytes, index)
    const srcView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const faceOffset = srcView.getUint32(12 + index * 4)
    const srcTables = srcView.getUint16(faceOffset + 4)
    let srcGlyf: { offset: number; length: number } | undefined
    for (let i = 0; i < srcTables; i++) {
      const at = faceOffset + 12 + i * 16
      const tag = String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!)
      if (tag === "glyf") srcGlyf = { offset: srcView.getUint32(at + 8), length: srcView.getUint32(at + 12) }
    }
    expect(srcGlyf).toBeDefined()

    const outView = new DataView(out.buffer)
    const outTables = outView.getUint16(4)
    let outGlyf: { offset: number; length: number } | undefined
    for (let i = 0; i < outTables; i++) {
      const at = 12 + i * 16
      const tag = String.fromCharCode(out[at]!, out[at + 1]!, out[at + 2]!, out[at + 3]!)
      if (tag === "glyf") outGlyf = { offset: outView.getUint32(at + 8), length: outView.getUint32(at + 12) }
    }
    expect(outGlyf).toBeDefined()
    expect(outGlyf!.length).toBe(srcGlyf!.length)
    expect(
      Buffer.compare(
        Buffer.from(out.subarray(outGlyf!.offset, outGlyf!.offset + outGlyf!.length)),
        Buffer.from(bytes.subarray(srcGlyf!.offset, srcGlyf!.offset + srcGlyf!.length)),
      ),
    ).toBe(0)
  })

  test("a face index past the end is an error, not a silent face 0", () => {
    expect(() => extractFace(bytes, 999)).toThrow(/out of range/)
  })
})

describe("the extractor rejects what is not a collection", () => {
  test("a single-face sfnt has no 'ttcf' tag", () => {
    // The vendored Arimo is an ordinary .ttf, and asking for its faces
    // must fail loudly rather than reading its header as a face table.
    const arimo = new Uint8Array(readFileSync(`${REPO}/core/demo/fonts/Arimo-Regular.ttf`))
    expect(() => listFaces(arimo)).toThrow(/TrueType Collection/)
  })
})

// ---------------------------------------------------------------------------
// The box → baseline conversion, at the two branches the chapter renders
// ---------------------------------------------------------------------------

/** A text record with the deck's own defaults, overridable per test. */
const record = (over: Partial<KeyText>): KeyText => ({
  kind: "text",
  id: "t",
  content: "x",
  frame: { position: { x: 0, y: 0 }, size: { width: 100, height: 100 }, angle: 0 },
  align: "center",
  verticalAlign: "middle",
  padding: { left: 4, top: 4, right: 4, bottom: 4 },
  lineSpacing: 1,
  fontSize: 50,
  fontName: "HelveticaNeue",
  bold: false,
  italic: false,
  color: { r: 1, g: 1, b: 1, a: 1 },
  opacity: 1,
  ...over,
})

describe("box alignment — the conversion Keynote's model needs", () => {
  test("the title card's baseline, from the deck's own numbers", () => {
    // The record as slide01.ts states it: box y 529.496, height 366,
    // padding 4, size 116, kFrameAlignBottom. The descent is the face's
    // published 0.212 em, so baseline = 529.496 + 366 - 4 - 0.212·116
    // = 866.9 slide units = 577.9 video px, against a measured 577.
    const title = record({
      frame: { position: { x: 95, y: 529.496 }, size: { width: 1730, height: 366 }, angle: 0 },
      verticalAlign: "bottom",
      lineSpacing: 0.8,
      fontSize: 116,
      fontName: "HelveticaNeue-Bold",
    })
    expect(textBaseline(title)).toBeCloseTo(529.496 + 366 - 4 - 0.212 * 116, 6)
    // …and in video pixels, which is the number the overlay sees.
    expect(textBaseline(title) / 1.5).toBeCloseTo(577.9, 1)
  })

  test("centre: the CAP BOX is centred, not the cap-plus-descent block", () => {
    const r = record({
      frame: { position: { x: 0, y: 100 }, size: { width: 200, height: 200 }, angle: 0 },
      verticalAlign: "middle",
      fontSize: 50,
    })
    const top = 100 + 4
    const bottom = 100 + 200 - 4
    const cap = 50 * 0.714
    expect(textBaseline(r)).toBeCloseTo((top + bottom) / 2 + cap / 2, 6)
  })

  test("…and the descent is NOT in it — the two differ by exactly descent/2", () => {
    // The identity that makes this a derivation rather than a nudge, and
    // the guard against the descent creeping back in. Checked at every
    // size the deck uses.
    for (const size of [24, 30, 32, 34, 37, 40, 50, 70, 116]) {
      const r = record({
        frame: { position: { x: 0, y: 100 }, size: { width: 200, height: 200 }, angle: 0 },
        verticalAlign: "middle",
        fontSize: size,
      })
      const top = 100 + 4
      const bottom = 100 + 200 - 4
      const cap = size * 0.714
      const descent = size * 0.212
      const withDescent = (top + bottom) / 2 - (cap + descent) / 2 + cap
      expect(textBaseline(r) - withDescent).toBeCloseTo(descent / 2, 9)
    }
  })

  test("the middle branch against the FOOTAGE, at four point sizes", () => {
    // The measurement that settled it (geometry/keynote.ts's header):
    // the bottom ink row of a descender-free glyph in the 1280x720
    // frame. These are reference numbers, not the code's own output —
    // three from P-5's chain slides, two measured here on deck slide 5.
    //
    // Every record involved is an autofit 0x0 box, so top == bottom ==
    // position.y and the padding cancels; that is why `y` is the whole
    // of the geometry each row needs.
    const measured: [string, number, number, number][] = [
      ["DiaLogos (D)", 70, 126.408, 101],
      ["Location A (L)", 30, 647.701, 439],
      ["non-contextual (n)", 30, 694.692, 470],
      ["Story (S)", 50, 540.0, 372],
      ["Dead Thing (D)", 40, 866.0, 587],
    ]
    for (const [label, fontSize, y, row] of measured) {
      const r = record({
        frame: { position: { x: 0, y }, size: { width: 0, height: 0 }, angle: 0 },
        verticalAlign: "middle",
        fontSize,
      })
      // Slide units -> video pixels at the deck's own 3:2 ratio.
      const predicted = textBaseline(r) / 1.5
      expect(Math.abs(predicted - row), label).toBeLessThan(0.5)
    }
  })

  test("top: the ascent hangs from the padded top, leading split above", () => {
    const r = record({
      frame: { position: { x: 0, y: 60 }, size: { width: 200, height: 200 }, angle: 0 },
      verticalAlign: "top",
      lineSpacing: 1.5,
      fontSize: 40,
    })
    const cap = 40 * 0.714
    const descent = 40 * 0.212
    const lineHeight = 40 * 1.5
    expect(textBaseline(r)).toBeCloseTo(60 + 4 + (lineHeight - cap - descent) / 2 + cap, 6)
  })

  test("padding moves the baseline by exactly the padding", () => {
    const base = record({ verticalAlign: "bottom", padding: { left: 4, top: 4, right: 4, bottom: 4 } })
    const padded = record({
      verticalAlign: "bottom",
      padding: { left: 4, top: 4, right: 4, bottom: 14 },
    })
    expect(textBaseline(base) - textBaseline(padded)).toBeCloseTo(10, 9)
  })

  test("the corners: each horizontal alignment picks its own padded edge", () => {
    const frame = { position: { x: 100, y: 0 }, size: { width: 300, height: 50 }, angle: 0 }
    const padding = { left: 6, top: 4, right: 10, bottom: 4 }
    expect(textAnchorX(record({ frame, padding, align: "left" }))).toBeCloseTo(106, 9)
    expect(textAnchorX(record({ frame, padding, align: "right" }))).toBeCloseTo(390, 9)
    expect(textAnchorX(record({ frame, padding, align: "center" }))).toBeCloseTo(248, 9)
    // `justify` reads as left — the deck's two justified styles render
    // that way at these widths (geometry/keynote.ts).
    expect(textAnchorX(record({ frame, padding, align: "justify" }))).toBeCloseTo(106, 9)
  })
})

describe("line spacing — the deck's multiple, stepping the baselines", () => {
  test("a multi-line block's FIRST baseline rises by one line per extra line", () => {
    // `bottom` alignment holds the LAST line against the padded bottom,
    // so an extra line pushes the first baseline up by exactly one line
    // height — which at lineSpacing L is L·size.
    const one = record({ verticalAlign: "bottom", lineSpacing: 0.9, fontSize: 30 })
    expect(textBaseline(one, 1) - textBaseline(one, 2)).toBeCloseTo(0.9 * 30, 9)
    expect(textBaseline(one, 1) - textBaseline(one, 3)).toBeCloseTo(2 * 0.9 * 30, 9)
  })

  test("under `middle` a taller block starts higher by half the growth", () => {
    // Centring the whole block means each added line raises the first
    // baseline by half a line height, not a full one.
    const r = record({ verticalAlign: "middle", lineSpacing: 1, fontSize: 40 })
    expect(textBaseline(r, 1) - textBaseline(r, 2)).toBeCloseTo(40 / 2, 9)
  })

  test("a zero/absent spacing reads as single — never as a collapsed block", () => {
    const zero = record({ verticalAlign: "bottom", lineSpacing: 0, fontSize: 50 })
    const one = record({ verticalAlign: "bottom", lineSpacing: 1, fontSize: 50 })
    expect(textBaseline(zero, 3)).toBeCloseTo(textBaseline(one, 3), 9)
  })

  test("the deck's own title spacing is 0.8, and it is read not assumed", async () => {
    const { slide01 } = await import("../vocabulary/Slides/assets/pl02/slide01")
    const title = slide01.texts[0]!
    expect(title.lineSpacing).toBe(0.8)
    expect(title.fontName).toBe("HelveticaNeue-Bold")
    expect(title.fontSize).toBe(116)
  })
})

describe("tracking — the deck's own, and the reason the card closes", () => {
  test("the title card declares -0.02 in the generated module", async () => {
    // Not a fit: it is in the theme stylesheet's 116-pt character style,
    // reached through the decoder's merged inheritance chain. At 720p it
    // is worth 30 px of word width — the difference between
    // HelveticaNeue-Bold's untracked 640 and the reference's 610.
    const { slide01 } = await import("../vocabulary/Slides/assets/pl02/slide01")
    expect(slide01.texts[0]!.tracking).toBe(-0.02)
  })

  test("no other slide in the chapter set carries one", async () => {
    // The emission is conditional, so an untracked record produces the
    // same bytes it always did. If this ever fails, a record gained a
    // tracking the deck does not declare.
    for (const name of ["slide03", "slide04", "slide05", "slide06"] as const) {
      const mod = (await import(`../vocabulary/Slides/assets/pl02/${name}`)) as Record<
        string,
        { texts: { tracking?: number }[] }
      >
      for (const text of mod[name]!.texts) {
        expect(text.tracking ?? 0).toBe(0)
      }
    }
  })
})
