/**
 * Symbol thumbnails (EDITOR-V4 "Symbol thumbnails").
 *
 * "A symbol should be recognisable by its shape, not only its name." A
 * holon's glyph is drawn from the holon's OWN geometry — the same
 * polylines the renderer strokes, walked recursively through its parts,
 * flattened to the screen plane and fitted to a ~18px box. An Eye reads
 * as an eye; an Axes reads as a cross with a lattice; a Circle is a
 * circle. Nothing is illustrated by hand.
 *
 * ## Why this does not go through the renderer
 *
 * The obvious implementation — mount a second ThreeHost per class and
 * screenshot it — costs a WebGPU context and a full frame per glyph, for
 * an 18px image. The brief's constraint is explicit ("this must not cost
 * frame time in the main render loop"), so the glyph is a plain 2D-canvas
 * path over the holon's parametric outline: a few hundred line segments,
 * once per distinct class+size, drawn synchronously in well under a
 * millisecond and then cached as a data URL.
 *
 * The geometry reader below deliberately duplicates the shape cases from
 * render/three-host.ts rather than importing them (they are private to
 * that module, and core/src is not this agent's to edit). The duplication
 * is bounded and honest: a thumbnail is an APPROXIMATION of the render by
 * construction — it is flat, unstroked, untinted by depth — so it does
 * not need to track the renderer's silhouette work, only its outlines.
 * If a class grows geometry the reader does not know, its glyph falls
 * back to the monogram rather than lying.
 *
 * ## Caching
 *
 * Keyed by class name + a signature of the params that change the SHAPE
 * (the reader's own inputs, plus the part count). Two Circles of
 * different radius share a glyph — a thumbnail is a symbol's face, not
 * its measurements, and normalising to the box makes radius invisible
 * anyway; the signature exists so that a genuinely different
 * configuration (an Axes with and without its grid) gets its own.
 */

import { Holon } from "../src/holon"
import {
  Arc,
  Axes,
  Circle,
  Cylinder,
  Ellipse,
  Line,
  Polygon,
  Rectangle,
  Square,
  Stroke,
} from "../src/parts/index"
import { isColor, type Color } from "../src/constants"
import { classNameOf } from "./classname"

/** Rendered glyph size in CSS pixels. Device pixels are 2x this. */
export const THUMB_SIZE = 18

/** How finely a curve is sampled for an 18px glyph — smooth enough, cheap. */
const CURVE_SEGMENTS = 48

interface Pt {
  x: number
  y: number
  z: number
}

/** One drawable outline in the holon's own local space. */
type Path = Pt[]

// --- Geometry: a holon's outlines, in its own local space ------------------

const circlePath = (rx: number, ry: number, from = 0, to = Math.PI * 2): Path => {
  const pts: Path = []
  for (let i = 0; i <= CURVE_SEGMENTS; i++) {
    const a = from + (i / CURVE_SEGMENTS) * (to - from)
    pts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry, z: 0 })
  }
  return pts
}

/**
 * The outline(s) a single stroke holon contributes, in ITS local space.
 * Returns undefined for a holon whose shape this reader does not know —
 * which is the signal to fall back, not an error.
 */
const outlinesOf = (holon: Holon): Path[] | undefined => {
  if (holon instanceof Circle) return [circlePath(holon.radius.value, holon.radius.value)]
  if (holon instanceof Ellipse) return [circlePath(holon.radiusX.value, holon.radiusY.value)]
  if (holon instanceof Arc)
    return [
      circlePath(
        holon.radius.value,
        holon.radius.value,
        holon.startAngle.value,
        holon.endAngle.value,
      ),
    ]
  if (holon instanceof Square) {
    const s = holon.size.value / 2
    return [
      [
        { x: -s, y: -s, z: 0 },
        { x: s, y: -s, z: 0 },
        { x: s, y: s, z: 0 },
        { x: -s, y: s, z: 0 },
        { x: -s, y: -s, z: 0 },
      ],
    ]
  }
  if (holon instanceof Rectangle) {
    const w = holon.width.value / 2
    const h = holon.height.value / 2
    return [
      [
        { x: -w, y: -h, z: 0 },
        { x: w, y: -h, z: 0 },
        { x: w, y: h, z: 0 },
        { x: -w, y: h, z: 0 },
        { x: -w, y: -h, z: 0 },
      ],
    ]
  }
  if (holon instanceof Polygon) {
    const pts: Path = []
    const n = Math.max(3, holon.sides.value)
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 2
      pts.push({ x: Math.cos(a) * holon.radius.value, y: Math.sin(a) * holon.radius.value, z: 0 })
    }
    return [pts]
  }
  if (holon instanceof Cylinder) {
    // The 2021 read of a cylinder: two cap circles and two generators.
    // Drawn axis-aligned (the glyph has no camera to take a silhouette
    // from), which is the canonical way the symbol is recognised anyway.
    const r = holon.radius.value
    const h = holon.height.value / 2
    const cap = (y: number): Path => circlePath(r, r * 0.34).map((p) => ({ ...p, y: p.y + y }))
    return [
      cap(h),
      cap(-h),
      [
        { x: -r, y: -h, z: 0 },
        { x: -r, y: h, z: 0 },
      ],
      [
        { x: r, y: -h, z: 0 },
        { x: r, y: h, z: 0 },
      ],
    ]
  }
  if (holon instanceof Line) {
    if (holon.points.length < 2) return undefined
    return [holon.points.map((p) => ({ x: p.x, y: p.y, z: p.z }))]
  }
  return undefined
}

/**
 * A holon's local transform, flattened. Only translation, scale and the
 * bank (h) are honoured: a glyph is a flat symbol, and applying the full
 * three-axis rotation to an 18px picture mostly destroys it — an Eye
 * turned to face away would render as a line. Deliberate: this is the
 * symbol's FACE, the pose it is recognised in.
 */
const placed = (holon: Holon, path: Path): Path => {
  const s = holon.scale.value
  const cos = Math.cos(holon.h.value)
  const sin = Math.sin(holon.h.value)
  return path.map(({ x, y, z }) => ({
    x: (x * cos - y * sin) * s + holon.x.value,
    y: (x * sin + y * cos) * s + holon.y.value,
    z: z * s + holon.z.value,
  }))
}

/**
 * Every outline a whole contributes, its parts included, in the whole's
 * own space. An Axes is its arms plus its grid; an Eye its arcs and its
 * pupil — the composite's glyph is the composite, not its first part.
 */
const collect = (holon: Holon, depth = 0): Path[] => {
  // A guard against a symbol whose parts run to the hundreds (a grid
  // with a 5000-unit lattice): past this many outlines the glyph is a
  // grey smear anyway, so stop and draw what reads.
  const MAX_PATHS = 64
  const own = outlinesOf(holon) ?? []
  const out: Path[] = own.map((p) => placed(holon, p))
  if (depth > 6) return out
  for (const part of holon.parts) {
    if (out.length >= MAX_PATHS) break
    for (const path of collect(part, depth + 1)) {
      if (out.length >= MAX_PATHS) break
      out.push(placed(holon, path))
    }
  }
  return out
}

// --- Drawing ---------------------------------------------------------------

const toCss = (c: Color): string =>
  `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`

/**
 * The colour a glyph is drawn in: the holon's own tint when it has one
 * and it is not plain white, otherwise a quiet grey that sits at the
 * outline's text weight. Using the real tint is what makes S01's blue
 * and red creatures distinguishable at 18px — the palette doing the work
 * names alone cannot.
 */
const tintOf = (holon: Holon): string => {
  if (holon instanceof Stroke) {
    const v = holon.tint.value
    if (isColor(v) && !(v.r > 0.95 && v.g > 0.95 && v.b > 0.95)) return toCss(v)
  }
  return "#9a9aa4"
}

/** Draw the paths into a square canvas, fitted with a small margin. */
const drawPaths = (ctx: CanvasRenderingContext2D, paths: Path[], size: number, color: string) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const path of paths) {
    for (const p of path) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  if (!Number.isFinite(minX) || maxX === minX) return false

  const margin = size * 0.12
  const box = size - margin * 2
  const span = Math.max(maxX - minX, maxY - minY, 1e-6)
  const scale = box / span
  // Centre the drawing's own bounds in the box, so a lopsided symbol
  // (an Axes, whose arms run one way) sits where the eye expects it.
  const offX = margin + (box - (maxX - minX) * scale) / 2
  const offY = margin + (box - (maxY - minY) * scale) / 2
  // y flips: scene up is +y, canvas up is -y.
  const px = (p: Pt) => ({
    x: offX + (p.x - minX) * scale,
    y: size - (offY + (p.y - minY) * scale),
  })

  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, size / 16)
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  for (const path of paths) {
    if (path.length < 2) continue
    ctx.beginPath()
    const first = px(path[0]!)
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < path.length; i++) {
      const p = px(path[i]!)
      ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
  }
  return true
}

/**
 * The fallback: the class's initials in its own tint. A monogram is an
 * honest admission that the shape is not known — it never pretends to be
 * geometry. Two letters at most (`Ax`, `Cy`), because three do not fit.
 */
const drawMonogram = (
  ctx: CanvasRenderingContext2D,
  name: string,
  size: number,
  color: string,
) => {
  // Initials of a CamelCase name (DottedLine → DL), else its first letter.
  const capitals = name.match(/[A-Z]/g)
  const text = capitals && capitals.length > 1 ? capitals.slice(0, 2).join("") : name.slice(0, 2)
  ctx.fillStyle = color
  ctx.font = `600 ${Math.round(size * (text.length > 1 ? 0.5 : 0.62))}px -apple-system, "SF Pro", Inter, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, size / 2, size / 2 + size * 0.04)
}

// --- The cache -------------------------------------------------------------

const cache = new Map<string, string>()

/**
 * The signature that decides whether two holons of a class share a glyph:
 * the class, the part count, and the switches that change what is drawn.
 * Sizes are excluded on purpose (the glyph is normalised to its box), so
 * fifty grid Lines of different lengths all hit one cache entry.
 */
const signatureOf = (holon: Holon): string => {
  const bits: string[] = [classNameOf(holon), String(holon.parts.length)]
  if (holon instanceof Axes) {
    bits.push(holon.drawGrid.value ? "grid" : "-", holon.drawTicks.value ? "ticks" : "-")
  }
  if (holon instanceof Polygon) bits.push(String(holon.sides.value))
  if (holon instanceof Ellipse) bits.push(holon.filled.value ? "filled" : "-")
  if (holon instanceof Line) bits.push(String(holon.points.length))
  if (holon instanceof Stroke) {
    const v = holon.tint.value
    if (isColor(v)) bits.push(toCss(v))
  }
  return bits.join(":")
}

/**
 * The glyph for a holon, as a data URL. Cached — the second Circle in a
 * scene costs a Map lookup.
 */
export const thumbnailFor = (holon: Holon, size = THUMB_SIZE): string => {
  const key = `${signatureOf(holon)}@${size}`
  const hit = cache.get(key)
  if (hit) return hit

  const dpr = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)))
  const canvas = document.createElement("canvas")
  canvas.width = size * dpr
  canvas.height = size * dpr
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""
  ctx.scale(dpr, dpr)

  const color = tintOf(holon)
  const paths = collect(holon)
  if (!paths.length || !drawPaths(ctx, paths, size, color)) {
    drawMonogram(ctx, classNameOf(holon), size, color)
  }

  const url = canvas.toDataURL()
  cache.set(key, url)
  return url
}

/** An `<img>` glyph ready to drop into a row. */
export const thumbnailEl = (holon: Holon, size = THUMB_SIZE): HTMLImageElement => {
  const img = document.createElement("img")
  img.className = "thumb"
  img.width = size
  img.height = size
  img.src = thumbnailFor(holon, size)
  img.alt = ""
  return img
}

/** Drop the cache — a rebuild may have changed what a class looks like. */
export const clearThumbnailCache = (): void => cache.clear()
