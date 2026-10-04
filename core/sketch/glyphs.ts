/**
 * glyphs.ts — a Text holon's letterforms as OUTLINES, for the tablet's
 * screen (mirror.ts).
 *
 * The Mac draws text as triangulated glyph meshes (render/text.ts): three-
 * text shapes the string with HarfBuzz, draws each glyph's contours, and
 * tessellates them. The e-ink needs the contours themselves, as filled
 * polygons with their counters — the hole of an `o`, the bowl of an `a`.
 * So this takes the same road up to the fork: the SAME layout (three-text's
 * core, the same options render/text.ts passes), the SAME glyph contours
 * (HarfBuzz's draw callbacks, the very ones the mesh builder collects), the
 * same per-glyph placement ((contour + glyph position) · pixelsPerFontUnit,
 * as the mesh and vector builders both place it), and the same anchoring
 * afterwards: each line re-centred for a centred multi-line block, then the
 * block's ink box put on the holon's x (its middle, or its left edge for
 * `align: "left"`). Only the curves are flattened here instead of
 * tessellated.
 *
 * Layout is asynchronous (HarfBuzz and the font load on first use), the
 * display list is not: `textOutline` answers from a cache and starts the
 * layout on a miss; `onGlyphs` says when one lands, so the page can send
 * the letters a moment later. Coordinates are the holon's LOCAL space (the
 * mesh's), so the mirror carries them through the holon's transform and
 * the page's camera like any other geometry.
 */

import { Text as CoreText, getSharedDrawCallbackHandler } from "three-text/core"
import { DEFAULT_HARFBUZZ_URL, fontCandidates } from "../src/render/text"
import type { Text } from "../src/parts/text"

export interface Pt2 {
  x: number
  y: number
}

/** One glyph: its closed contours (outer rings and counters, as the font winds them). */
export type GlyphRings = Pt2[][]

/** Where a font's bytes come from: the URL itself (the browser fetches it,
 *  sharing three-text's font cache with the renderer), or a loader. */
type FontSource = (url: string) => string | Promise<ArrayBuffer>

let fontSource: FontSource = (url) => url
let harfBuzzReady = false

/**
 * Point the outlines somewhere other than the page's own URLs — a test or a
 * script under bun hands over the HarfBuzz binary and reads fonts from disk.
 */
export const configureGlyphs = (opts: { harfBuzz?: ArrayBuffer; fontSource?: FontSource }): void => {
  if (opts.harfBuzz) {
    CoreText.setHarfBuzzBuffer(opts.harfBuzz)
    harfBuzzReady = true
  }
  if (opts.fontSource) fontSource = opts.fontSource
}

const ensureHarfBuzz = () => {
  if (harfBuzzReady) return
  CoreText.setHarfBuzzPath(DEFAULT_HARFBUZZ_URL)
  harfBuzzReady = true
}

/** What a Text's letters depend on — render/text.ts `layoutKey`, the same fields. */
const keyOf = (t: Text): string =>
  `${t.content} ${t.font ?? ""} ${t.align} ${t.size.value} ${t.lineHeight ?? ""} ${t.tracking}`

const cache = new Map<string, GlyphRings[]>()
const pending = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

/** Called whenever a layout lands (or fails for good). */
export const onGlyphs = (cb: () => void): (() => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Resolves once every layout started so far has landed. */
export const whenGlyphsSettled = async (): Promise<void> => {
  while (pending.size) await Promise.all([...pending.values()])
}

/** The holon's letters, if laid out — else undefined, and the layout starts. */
export const textOutline = (t: Text): GlyphRings[] | undefined => {
  const key = keyOf(t)
  const hit = cache.get(key)
  if (hit) return hit
  if (!pending.has(key)) {
    const job = layout(t)
      .then((rings) => {
        if (cache.size > 128) cache.clear()
        cache.set(key, rings)
      })
      .catch((err: unknown) => {
        // As on the Mac: an unshapeable string stays invisible, never fatal.
        console.warn("[mirror] text outline failed:", err)
        cache.set(key, [])
      })
      .finally(() => {
        pending.delete(key)
        for (const cb of listeners) cb()
      })
    pending.set(key, job)
  }
  return undefined
}

// --- the layout --------------------------------------------------------------------

/** Points per flattened curve: well under a page unit off the true curve at any written size. */
const QUAD_STEPS = 8
const CUBIC_STEPS = 12

const layout = async (t: Text): Promise<GlyphRings[]> => {
  ensureHarfBuzz()
  let last: unknown
  for (const url of fontCandidates(t.font)) {
    try {
      return await layoutWith(t, await fontSource(url))
    } catch (err) {
      last = err
    }
  }
  throw last
}

const layoutWith = async (t: Text, font: string | ArrayBuffer): Promise<GlyphRings[]> => {
  // render/text.ts layoutText's options, field for field.
  const handle = await CoreText.create({
    text: t.content,
    font,
    size: t.size.value,
    depth: 0,
    perGlyphAttributes: true,
    removeOverlaps: true,
    ...(t.lineHeight === undefined ? {} : { lineHeight: t.lineHeight }),
    ...(t.tracking === 0 ? {} : { letterSpacing: t.tracking }),
    layout: { align: "center" },
  })
  try {
    const font = handle.loadedFont
    const draw = getSharedDrawCallbackHandler(font)
    let rings: Pt2[][] = []
    let cur: Pt2[] = []
    let at: Pt2 = { x: 0, y: 0 }
    const close = () => {
      if (cur.length > 2) rings.push(cur)
      cur = []
    }
    const collector = {
      setPosition() {},
      updatePosition() {},
      onMoveTo(x: number, y: number) {
        close()
        at = { x, y }
        cur = [at]
      },
      onLineTo(x: number, y: number) {
        at = { x, y }
        cur.push(at)
      },
      onQuadTo(cx: number, cy: number, x: number, y: number) {
        const p0 = at
        for (let i = 1; i <= QUAD_STEPS; i++) {
          const u = i / QUAD_STEPS
          const a = (1 - u) * (1 - u)
          const b = 2 * u * (1 - u)
          const c = u * u
          cur.push({ x: a * p0.x + b * cx + c * x, y: a * p0.y + b * cy + c * y })
        }
        at = { x, y }
      },
      onCubicTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
        const p0 = at
        for (let i = 1; i <= CUBIC_STEPS; i++) {
          const u = i / CUBIC_STEPS
          const v = 1 - u
          const a = v * v * v
          const b = 3 * u * v * v
          const c = 3 * u * u * v
          const d = u * u * u
          cur.push({ x: a * p0.x + b * c1x + c * c2x + d * x, y: a * p0.y + b * c1y + c * c2y + d * y })
        }
        at = { x, y }
      },
      onClosePath: close,
    }
    // The handler is shared with the mesh builder: claim it for each draw, as three-text's own vector path does.
    draw.createDrawFuncs(font, collector)
    const scale = handle.layoutData.pixelsPerFontUnit
    const glyphs: { line: number; rings: Pt2[][] }[] = []
    for (const line of handle.clustersByLine) {
      for (const cluster of line) {
        for (const g of cluster.glyphs) {
          draw.setCollector(collector)
          rings = []
          cur = []
          font.module.exports.hb_font_draw_glyph(font.font.ptr, g.g, draw.getDrawFuncsPtr(), 0)
          close()
          if (!rings.length) continue
          const px = cluster.position.x + (g.x ?? 0)
          const py = cluster.position.y + (g.y ?? 0)
          glyphs.push({ line: g.lineIndex, rings: rings.map((r) => r.map((p) => ({ x: (p.x + px) * scale, y: (p.y + py) * scale }))) })
        }
      }
    }
    anchor(glyphs, t.align, t.content.includes("\n"))
    return glyphs.map((g) => g.rings)
  } finally {
    handle.dispose()
  }
}

const xRange = (rings: readonly Pt2[][]): [number, number] => {
  let lo = Infinity
  let hi = -Infinity
  for (const r of rings) for (const p of r) (lo = Math.min(lo, p.x)), (hi = Math.max(hi, p.x))
  return [lo, hi]
}

const shiftX = (rings: Pt2[][], dx: number) => {
  for (const r of rings) for (const p of r) p.x += dx
}

/** render/text.ts after layout: per-line centring (centred multi-line), then the block's ink box on x = 0. */
const anchor = (glyphs: { line: number; rings: Pt2[][] }[], align: "center" | "left", multiLine: boolean) => {
  if (align === "center" && multiLine) {
    const lines = new Map<number, Pt2[][]>()
    for (const g of glyphs) lines.set(g.line, [...(lines.get(g.line) ?? []), ...g.rings])
    for (const rings of lines.values()) {
      const [lo, hi] = xRange(rings)
      shiftX(rings, -(lo + hi) / 2)
    }
  }
  const all = glyphs.flatMap((g) => g.rings)
  if (!all.length) return
  const [lo, hi] = xRange(all)
  shiftX(all, -(align === "left" ? lo : (lo + hi) / 2))
}
