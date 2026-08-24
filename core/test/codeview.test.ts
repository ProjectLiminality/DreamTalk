/**
 * The code view's byte→index mapping, and its tokenizer.
 *
 * The mapping is the load-bearing part: anchors are BYTE offsets into the
 * file on disk, the panel renders a UTF-16 string, and a DreamWeaving's
 * prose comments carry em-dashes and Greek letters by the dozen. An
 * off-by-one here does not fail loudly — it silently highlights the wrong
 * bytes, which is exactly the quietly-wrong the anchors exist to prevent.
 * So it is pinned against the real S04 source, not a synthetic string.
 */

import { expect, test, describe } from "bun:test"
import { byteToIndexMapper, tokenize } from "../editor/codeview"

/** The reference implementation: encode the prefix, count its bytes. */
const byteOffsetOf = (src: string, index: number): number =>
  new TextEncoder().encode(src.slice(0, index)).length

describe("byteToIndexMapper", () => {
  test("is the identity on pure ASCII", () => {
    const src = "const x = new Circle({ radius: 50 })\n"
    const map = byteToIndexMapper(src)
    for (let i = 0; i <= src.length; i++) expect(map(byteOffsetOf(src, i))).toBe(i)
  })

  test("round-trips every character position of a multi-byte source", () => {
    // Two-byte (é), three-byte (— and π), four-byte (an astral emoji):
    // one of each width, which is the whole space the encoder has.
    const src = `// café — π\nconst 🌀 = new Circle({ radius: 50 })\n// ——— tail\n`
    const map = byteToIndexMapper(src)
    for (let i = 0; i <= src.length; i++) {
      // Only positions on a character boundary are meaningful; a surrogate
      // pair's midpoint is not a place an anchor can name.
      if (i > 0 && i < src.length) {
        const code = src.charCodeAt(i)
        if (code >= 0xdc00 && code <= 0xdfff) continue
      }
      expect(map(byteOffsetOf(src, i))).toBe(i)
    }
  })

  test("maps a real DreamWeaving's construction span exactly", async () => {
    const src = await Bun.file(new URL("../demo/video01/S04.ts", import.meta.url)).text()
    const map = byteToIndexMapper(src)
    // The file genuinely carries non-ASCII before this point — otherwise
    // the test proves nothing about the drift it exists to catch.
    const index = src.indexOf("rectangle = new Rectangle")
    expect(index).toBeGreaterThan(0)
    const bytes = byteOffsetOf(src, index)
    expect(bytes).not.toBe(index)
    expect(map(bytes)).toBe(index)
    // And the span's end, which is what bounds the highlight.
    const end = src.indexOf("})", index) + 2
    expect(map(byteOffsetOf(src, end))).toBe(end)
  })

  test("maps every construction site in a scene that has many", async () => {
    const src = await Bun.file(new URL("../demo/video01/S01.ts", import.meta.url)).text()
    const map = byteToIndexMapper(src)
    let from = 0
    let checked = 0
    for (;;) {
      const at = src.indexOf("new ", from)
      if (at < 0) break
      expect(map(byteOffsetOf(src, at))).toBe(at)
      checked++
      from = at + 4
    }
    expect(checked).toBeGreaterThan(5)
  })
})

/**
 * The fact the code view's highlight depends on, pinned so it cannot
 * change under the panel silently.
 *
 * anchors.ts calls its spans "byte offsets". They are not: injectAnchors
 * takes them from ts-morph's getStart()/getEnd(), which are UTF-16 string
 * positions. Reading them as bytes shifted S04's highlight 28 characters
 * early — onto the tail of the comment above the construction — because
 * that file carries fourteen non-ASCII characters before the span. If a
 * writer ever does start emitting real byte offsets, this test fails and
 * says which conversion to reinstate.
 */
describe("anchor offsets are UTF-16 indices, not bytes", () => {
  test("injectAnchors' spans index the string directly", async () => {
    const { injectAnchors } = await import("../scripts/ops")
    const src = await Bun.file(new URL("../demo/video01/S04.ts", import.meta.url)).text()
    const injected = injectAnchors(src, "core/demo/video01/S04.ts", "../../editor/anchors")

    // Pull the anchors back out of the injected text and check each one
    // names, in the ORIGINAL string, an expression that starts where it says.
    const spans = [...injected.matchAll(/"core\/demo\/video01\/S04\.ts:(\d+):(\d+)"/g)].map((m) => ({
      start: Number(m[1]),
      end: Number(m[2]),
    }))
    expect(spans.length).toBeGreaterThan(3)

    let sawNonAscii = false
    for (const { start, end } of spans) {
      const text = src.slice(start, end)
      // Every anchored span is a construction or a play/backdrop call.
      expect(text).toMatch(/^(new [A-Z]|this\.(play|backdrop)\()/)
      // Balanced, i.e. the end index lands where the expression really ends.
      expect(text.endsWith(")") || text.endsWith("})")).toBe(true)
      if (/[^\x00-\x7F]/.test(src.slice(0, start))) sawNonAscii = true
    }
    // The test is only meaningful if some span sits after non-ASCII text.
    expect(sawNonAscii).toBe(true)

    // And concretely: the byte offset of the same point is DIFFERENT, which
    // is exactly why treating these as bytes broke the highlight.
    const index = src.indexOf("new Rectangle")
    expect(spans.some((s) => s.start === index)).toBe(true)
    expect(byteOffsetOf(src, index)).not.toBe(index)
  })
})

describe("tokenize", () => {
  test("a line comment swallows a quote", () => {
    const src = `// it's fine\nconst a = 1`
    const tokens = tokenize(src)
    expect(tokens[0]!.cls).toBe("c-com")
    expect(src.slice(tokens[0]!.start, tokens[0]!.end)).toBe("// it's fine")
    // …and the string never starts, so `const` is still seen as a keyword.
    expect(tokens.some((t) => t.cls === "c-str")).toBe(false)
    expect(tokens.some((t) => t.cls === "c-kw" && src.slice(t.start, t.end) === "const")).toBe(true)
  })

  test("a string swallows a comment opener", () => {
    const src = `const a = "// not a comment"\n// yes a comment`
    const tokens = tokenize(src)
    const strings = tokens.filter((t) => t.cls === "c-str")
    expect(strings).toHaveLength(1)
    expect(src.slice(strings[0]!.start, strings[0]!.end)).toBe(`"// not a comment"`)
    expect(tokens.filter((t) => t.cls === "c-com")).toHaveLength(1)
  })

  test("block comments span lines and PascalCase reads as vocabulary", () => {
    const src = `/* a\n   b */\nconst c = new Circle({ radius: 50 })`
    const tokens = tokenize(src)
    expect(tokens[0]!.cls).toBe("c-com")
    expect(src.slice(tokens[0]!.start, tokens[0]!.end)).toBe("/* a\n   b */")
    const types = tokens.filter((t) => t.cls === "c-type").map((t) => src.slice(t.start, t.end))
    expect(types).toContain("Circle")
    const nums = tokens.filter((t) => t.cls === "c-num").map((t) => src.slice(t.start, t.end))
    expect(nums).toContain("50")
  })

  test("tokens are ordered, disjoint, and inside the source", () => {
    const src = `// c\nconst x = "s" + 1.5 // trailing\nclass Y extends Z {}`
    const tokens = tokenize(src)
    let last = 0
    for (const t of tokens) {
      expect(t.start).toBeGreaterThanOrEqual(last)
      expect(t.end).toBeGreaterThan(t.start)
      expect(t.end).toBeLessThanOrEqual(src.length)
      last = t.end
    }
  })

  test("an unterminated string does not run past the end", () => {
    const src = `const a = "oops`
    const tokens = tokenize(src)
    for (const t of tokens) expect(t.end).toBeLessThanOrEqual(src.length)
  })
})
