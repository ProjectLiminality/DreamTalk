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
import { Text } from "../src/parts/text"
import type { Dream, DreamClass } from "../src/dream"
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
      const a = (i / n) * Math.PI * 2 + holon.phase.value
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
  if (holon instanceof Polygon) bits.push(String(holon.sides.value), String(holon.phase.value))
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

// --- Scene tiles (EDITOR-V3 step 2: the navigator's slide thumbnails) ------
//
// A scene's tile is drawn the same way a holon's glyph is — the scene's
// own polylines, flattened to the screen plane — but framed by the
// scene's OWN camera rather than fit to its bounds, so ten tiles in the
// rail share one visual scale the way ten Keynote slides do. The scene
// is sampled at 60% of its duration (t=0 is usually a blank stage; by
// 0.6·d the cast has arrived and nothing has been struck yet).
//
// Text is the one holon whose geometry lives in a shader, not in parts
// (parts/text.ts): its tile contribution is the string itself, drawn
// with the canvas's own text — an approximation in exactly the sense
// every tile is one, and far more honest than an empty rectangle where
// "trans-perspectival" should be.

/** Tile size in CSS pixels — 16:9, the stage's own ratio. */
export const TILE_W = 176
export const TILE_H = 99

/** Past this many outlines a 176px tile is a smear — stop and draw what reads. */
const TILE_MAX_PATHS = 240

interface TilePath {
  path: Path
  color: string
  /** A text marker: path is [origin, origin + size·ŷ]; draw the string. */
  text?: string
}

/** Whether a drawable front (creation up, erasure down) leaves ink at this t. */
const inkAlive = (holon: Stroke | Text): boolean =>
  holon.creation.value > 0.02 && holon.erasure.value < 0.98

/** The tile colour of a stroke/text: its real tint; white stays white here. */
const tileTint = (holon: Holon): string => {
  const tint = (holon as Partial<Stroke>).tint
  const v = tint?.value
  if (v !== undefined && isColor(v)) return toCss(v)
  return "#9a9aa4"
}

/**
 * Every outline a holon's subtree contributes at the CURRENT param
 * values, with colours — the scene-tile sibling of `collect()`. Skips
 * what the frame would not show: faded subtrees, strokes not yet created
 * or already erased.
 */
const collectTile = (holon: Holon, depth = 0): TilePath[] => {
  if (holon.opacity.value < 0.04) return []
  const out: TilePath[] = []
  if (holon instanceof Text) {
    if (inkAlive(holon)) {
      const size = holon.size.value
      const marker: Path = [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: size, z: 0 },
      ]
      out.push({ path: placed(holon, marker), color: tileTint(holon), text: holon.content })
    }
  } else if (!(holon instanceof Stroke) || inkAlive(holon)) {
    for (const p of outlinesOf(holon) ?? []) {
      out.push({ path: placed(holon, p), color: tileTint(holon) })
    }
  }
  if (depth > 7) return out
  for (const part of holon.parts) {
    if (out.length >= TILE_MAX_PATHS) break
    for (const tp of collectTile(part, depth + 1)) {
      if (out.length >= TILE_MAX_PATHS) break
      out.push({ ...tp, path: placed(holon, tp.path) })
    }
  }
  return out
}

/**
 * The world-space window the scene's camera frames at the focus plane —
 * the tile's viewport. Perspective: frustum height at the focus distance;
 * orthographic: the rig's reference height. Falls back to undefined when
 * the numbers are degenerate, in which case the tile fits its bounds.
 */
const cameraWindow = (
  dream: Dream,
  aspect: number,
): { cx: number; cy: number; w: number; h: number } | undefined => {
  const obs = dream.observer
  const h = obs.orthographic.value
    ? obs.baseHeight.value / Math.max(obs.zoom.value, 1e-6)
    : 2 * obs.radius.value * Math.tan(obs.fov.value / 2)
  if (!Number.isFinite(h) || h <= 0) return undefined
  return { cx: obs.x.value, cy: obs.y.value, w: h * aspect, h }
}

const drawTile = (
  ctx: CanvasRenderingContext2D,
  paths: TilePath[],
  w: number,
  h: number,
  win: { cx: number; cy: number; w: number; h: number } | undefined,
) => {
  // Project world → tile. With a camera window, one shared scale; without
  // (or when nothing lands inside it), fit the drawing's own bounds.
  let scale: number
  let cx: number
  let cy: number
  if (win) {
    scale = h / win.h
    cx = win.cx
    cy = win.cy
  } else {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const { path } of paths) {
      for (const p of path) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
    }
    if (!Number.isFinite(minX)) return
    const span = Math.max(maxX - minX, (maxY - minY) * (w / h), 1e-6)
    scale = (w * 0.8) / span
    cx = (minX + maxX) / 2
    cy = (minY + maxY) / 2
  }
  const px = (p: Pt) => ({ x: w / 2 + (p.x - cx) * scale, y: h / 2 - (p.y - cy) * scale })

  ctx.lineWidth = 1
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  for (const { path, color, text } of paths) {
    if (text !== undefined) {
      const a = px(path[0]!)
      const b = px(path[1]!)
      const size = Math.max(3, Math.hypot(b.x - a.x, b.y - a.y))
      ctx.fillStyle = color
      ctx.font = `${size}px -apple-system, "SF Pro", Inter, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(text, a.x, a.y)
      continue
    }
    if (path.length < 2) continue
    ctx.strokeStyle = color
    ctx.beginPath()
    const first = px(path[0]!)
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < path.length; i++) {
      const p = px(path[i]!)
      ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
  }
}

const tileCache = new Map<string, string>()

/**
 * The navigator tile for a registered scene, as a data URL. Cached by
 * key for the life of the module — a remount re-imports the module, so
 * a rebuild that changed a scene also refreshes its tile.
 */
export const sceneThumbnail = (key: string, DreamCtor: DreamClass): string => {
  const hit = tileCache.get(key)
  if (hit !== undefined) return hit

  let url = ""
  try {
    const dream = new DreamCtor()
    dream.applyAt(dream.duration * 0.6)
    const paths: TilePath[] = []
    for (const root of dream.roots) {
      if (paths.length >= TILE_MAX_PATHS) break
      for (const tp of collectTile(root)) {
        if (paths.length >= TILE_MAX_PATHS) break
        paths.push(tp)
      }
    }
    const dpr = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)))
    const canvas = document.createElement("canvas")
    canvas.width = TILE_W * dpr
    canvas.height = TILE_H * dpr
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, TILE_W, TILE_H)
      // Whether the camera window actually contains any of the drawing —
      // a scene staged far off-centre falls back to bounds rather than
      // presenting an empty black tile.
      let win = cameraWindow(dream, TILE_W / TILE_H)
      if (win) {
        const inside = paths.some(({ path }) =>
          path.some(
            (p) => Math.abs(p.x - win!.cx) < win!.w / 2 && Math.abs(p.y - win!.cy) < win!.h / 2,
          ),
        )
        if (!inside) win = undefined
      }
      drawTile(ctx, paths, TILE_W, TILE_H, win)
      url = canvas.toDataURL()
    }
  } catch (err) {
    console.warn(`[dreamtalk] tile for "${key}" failed:`, err)
  }
  tileCache.set(key, url)
  return url
}
