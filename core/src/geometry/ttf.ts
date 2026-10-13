/**
 * TTF — a minimal TrueType outline reader: the glyph contours of a font
 * file as data, nothing else (no hinting, no shaping, no GPOS).
 *
 * Why it exists: a written word has to be CURVES a morph can land on
 * (vocabulary/Word), synchronously — and the framework's text renderer
 * shapes asynchronously (render/text.ts), out of reach of a holon. So the
 * outlines are read from the font file itself, once, at build time
 * (scripts/font2ts.ts bakes them into src/geometry/fonts/), and the
 * runtime reads plain arrays.
 *
 * Reads: head (unitsPerEm, loca format), maxp, hhea + hmtx (advances),
 * cmap (format 4, Unicode BMP), loca + glyf (simple AND composite
 * glyphs — accented letters are composites of a base and a mark).
 */

export interface GlyphPoint {
  x: number
  y: number
  /** On-curve (a TrueType quadratic B-spline's anchor) or off-curve (its control). */
  on: boolean
}

export interface Glyph {
  advance: number
  contours: GlyphPoint[][]
}

export interface Font {
  unitsPerEm: number
  ascender: number
  descender: number
  /** Unicode code point → glyph. */
  glyphs: Map<number, Glyph>
}

/** Parse a TTF and return the glyphs for the given code points (all mapped BMP points if omitted). */
export const readTTF = (buf: ArrayBuffer | Uint8Array, codePoints?: readonly number[]): Font => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (o: number) => dv.getUint16(o)
  const i16 = (o: number) => dv.getInt16(o)
  const u32 = (o: number) => dv.getUint32(o)

  const tables = new Map<string, number>()
  const numTables = u16(4)
  for (let i = 0; i < numTables; i++) {
    const r = 12 + i * 16
    const tag = String.fromCharCode(bytes[r]!, bytes[r + 1]!, bytes[r + 2]!, bytes[r + 3]!)
    tables.set(tag, u32(r + 8))
  }
  const need = (tag: string) => {
    const o = tables.get(tag)
    if (o === undefined) throw new Error(`readTTF: no '${tag}' table — only TrueType-outline fonts are read`)
    return o
  }
  const head = need("head")
  const unitsPerEm = u16(head + 18)
  const longLoca = i16(head + 50) === 1
  const numGlyphs = u16(need("maxp") + 4)
  const hhea = need("hhea")
  const ascender = i16(hhea + 4)
  const descender = i16(hhea + 6)
  const numHMetrics = u16(hhea + 34)
  const hmtx = need("hmtx")
  const advanceOf = (g: number) => u16(hmtx + 4 * Math.min(g, numHMetrics - 1))
  const loca = need("loca")
  const glyf = need("glyf")
  const glyphOffset = (g: number): [number, number] =>
    longLoca ? [u32(loca + 4 * g), u32(loca + 4 * g + 4)] : [u16(loca + 2 * g) * 2, u16(loca + 2 * g + 2) * 2]

  // cmap: the Unicode BMP subtable (3,1) or (0,*), format 4.
  const cmap = need("cmap")
  let sub = -1
  for (let i = 0; i < u16(cmap + 2); i++) {
    const r = cmap + 4 + i * 8
    const pid = u16(r)
    const eid = u16(r + 2)
    const off = cmap + u32(r + 4)
    if (u16(off) === 4 && ((pid === 3 && eid === 1) || pid === 0)) {
      sub = off
      if (pid === 3) break
    }
  }
  if (sub < 0) throw new Error("readTTF: no format-4 Unicode cmap")
  const segX2 = u16(sub + 6)
  const ends = sub + 14
  const starts = ends + segX2 + 2
  const deltas = starts + segX2
  const ranges = deltas + segX2
  const glyphIndex = (cp: number): number => {
    for (let s = 0; s < segX2 / 2; s++) {
      const end = u16(ends + 2 * s)
      if (cp > end) continue
      const start = u16(starts + 2 * s)
      if (cp < start) return 0
      const delta = i16(deltas + 2 * s)
      const ro = u16(ranges + 2 * s)
      if (ro === 0) return (cp + delta) & 0xffff
      const g = u16(ranges + 2 * s + ro + 2 * (cp - start))
      return g === 0 ? 0 : (g + delta) & 0xffff
    }
    return 0
  }

  const parse = (g: number, depth = 0): GlyphPoint[][] => {
    if (g >= numGlyphs || depth > 8) return []
    const [a, b] = glyphOffset(g)
    if (b <= a) return [] // an empty glyph (space)
    const o = glyf + a
    const nContours = i16(o)
    if (nContours >= 0) {
      const endPts: number[] = []
      for (let i = 0; i < nContours; i++) endPts.push(u16(o + 10 + 2 * i))
      const nPts = nContours ? endPts[nContours - 1]! + 1 : 0
      let p = o + 10 + 2 * nContours
      p += 2 + u16(p) // skip instructions
      const flags: number[] = []
      while (flags.length < nPts) {
        const f = bytes[p++]!
        flags.push(f)
        if (f & 8) {
          const n = bytes[p++]!
          for (let k = 0; k < n; k++) flags.push(f)
        }
      }
      const coords = (short: number, same: number): number[] => {
        const out: number[] = []
        let v = 0
        for (const f of flags) {
          if (f & short) {
            const d = bytes[p++]!
            v += f & same ? d : -d
          } else if (!(f & same)) {
            v += i16(p)
            p += 2
          }
          out.push(v)
        }
        return out
      }
      const xs = coords(2, 16)
      const ys = coords(4, 32)
      const contours: GlyphPoint[][] = []
      let start = 0
      for (const end of endPts) {
        const c: GlyphPoint[] = []
        for (let i = start; i <= end; i++) c.push({ x: xs[i]!, y: ys[i]!, on: (flags[i]! & 1) === 1 })
        contours.push(c)
        start = end + 1
      }
      return contours
    }
    // Composite: components placed by offset (and an optional scale/matrix).
    const out: GlyphPoint[][] = []
    let p = o + 10
    for (;;) {
      const flags = u16(p)
      const comp = u16(p + 2)
      p += 4
      let dx = 0
      let dy = 0
      if (flags & 1) {
        dx = i16(p)
        dy = i16(p + 2)
        p += 4
      } else {
        dx = dv.getInt8(p)
        dy = dv.getInt8(p + 1)
        p += 2
      }
      let m = [1, 0, 0, 1]
      const f2 = (q: number) => i16(q) / 16384
      if (flags & 8) {
        const s = f2(p)
        m = [s, 0, 0, s]
        p += 2
      } else if (flags & 0x40) {
        m = [f2(p), 0, 0, f2(p + 2)]
        p += 4
      } else if (flags & 0x80) {
        m = [f2(p), f2(p + 2), f2(p + 4), f2(p + 6)]
        p += 8
      }
      // Only offsets as x/y values (flag 2) — point matching is not used by text faces.
      for (const c of parse(comp, depth + 1))
        out.push(c.map((q) => ({ x: m[0]! * q.x + m[2]! * q.y + dx, y: m[1]! * q.x + m[3]! * q.y + dy, on: q.on })))
      if (!(flags & 0x20)) break
    }
    return out
  }

  const glyphs = new Map<number, Glyph>()
  const cps = codePoints ?? Array.from({ length: 0xffff }, (_, i) => i)
  for (const cp of cps) {
    const g = glyphIndex(cp)
    if (g === 0 && cp !== 0) continue
    glyphs.set(cp, { advance: advanceOf(g), contours: parse(g) })
  }
  return { unitsPerEm, ascender, descender, glyphs }
}
