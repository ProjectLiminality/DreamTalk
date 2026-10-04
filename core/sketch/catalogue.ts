/**
 * catalogue.ts — the WHOLE vocabulary a board can import from.
 *
 * vocabulary.ts holds the hand-written entries: each states its own
 * degrees of freedom on the page and a description tuned for the
 * recognizer. Everything else in core/vocabulary — every sovereign symbol
 * (`static sovereign = true`) — is importable too, through ONE generic
 * adapter that needs nothing written for it:
 *
 *   cx, cy     where it sits (the centre of its own drawn extent)
 *   size       how big — a uniform scale fitted to its own bounds, so
 *              `size` is its largest extent on the page, whatever its
 *              native units are
 *   rotation   a page angle, like every flat symbol's
 *   + its own numeric Params, as the symbol declares them (shape, not
 *     place: a Globe's spin, a Labyrinth's seed). They carry no transform
 *     role — `size` already scales the whole, so an own length is a
 *     proportion and a page rotation must not turn an own angle twice.
 *
 * A hand-written entry that names a class (`holon: "Eye"`) speaks for it
 * and the generic one steps aside. The recognizer reads a generic entry's
 * description from its README (scripts/catalogue.ts, `describeGeneric`).
 *
 * THE SHELF is explicit: a browser bundle cannot scan a directory, and an
 * import is what puts a class in the bundle. test/sketch-catalogue.test.ts
 * holds it to the folder — every sovereign class there is either on the
 * shelf or named below as not a symbol, so the shelf cannot drift.
 */

import type { Holon } from "../src/holon"
import { Group, Stroke, type Vec3Like } from "../src/parts/primitives"
import { rotHPB } from "../src/parts/curves"
import { polyline } from "../src/render/three-host"
import { Axes } from "../vocabulary/Axes/Axes"
import { Cylinder } from "../vocabulary/Cylinder/Cylinder"
import { Eye } from "../vocabulary/Eye/Eye"
import { Figure } from "../vocabulary/Figure/Figure"
import { FoldableCube } from "../vocabulary/FoldableCube/FoldableCube"
import { Globe } from "../vocabulary/Globe/Globe"
import { Labyrinth } from "../vocabulary/Labyrinth/Labyrinth"
import { Logo } from "../vocabulary/Logo/Logo"
import { MindVirus } from "../vocabulary/MindVirus/MindVirus"
import { MolochEye } from "../vocabulary/MolochEye/MolochEye"
import { Platonic } from "../vocabulary/Platonic/Platonic"
import { Plot } from "../vocabulary/Plot/Plot"
import { Regenaissance } from "../vocabulary/Regenaissance/Regenaissance"
import { SMark } from "../vocabulary/Regenaissance/SMark"
import { RightTriangle } from "../vocabulary/RightTriangle/RightTriangle"
import { System } from "../vocabulary/System/System"
import { TheWall } from "../vocabulary/TheWall/TheWall"
import { DEFAULT_IMPORTS, VOCABULARY, type ParamSpec, type VocabEntry } from "./vocabulary"
import type { SketchState } from "./state"

type HolonClass = new (overrides?: Record<string, unknown>) => Holon

/** Every sovereign symbol, by class name, with the folder it lives in. */
export const SHELF: readonly { className: string; folder: string; cls: HolonClass }[] = [
  { className: "Axes", folder: "Axes", cls: Axes },
  { className: "Cylinder", folder: "Cylinder", cls: Cylinder },
  { className: "Eye", folder: "Eye", cls: Eye },
  { className: "Figure", folder: "Figure", cls: Figure },
  { className: "FoldableCube", folder: "FoldableCube", cls: FoldableCube },
  { className: "Globe", folder: "Globe", cls: Globe },
  { className: "Labyrinth", folder: "Labyrinth", cls: Labyrinth },
  { className: "Logo", folder: "Logo", cls: Logo },
  { className: "MindVirus", folder: "MindVirus", cls: MindVirus },
  { className: "MolochEye", folder: "MolochEye", cls: MolochEye },
  { className: "Platonic", folder: "Platonic", cls: Platonic },
  { className: "Plot", folder: "Plot", cls: Plot },
  { className: "Regenaissance", folder: "Regenaissance", cls: Regenaissance },
  { className: "SMark", folder: "Regenaissance", cls: SMark },
  { className: "RightTriangle", folder: "RightTriangle", cls: RightTriangle },
  { className: "System", folder: "System", cls: System },
  { className: "TheWall", folder: "TheWall", cls: TheWall },
]

/**
 * Sovereign classes that are not symbols you can put on a page from
 * nothing — each needs something only a scene can hand it.
 */
export const NOT_SYMBOLS: Readonly<Record<string, string>> = {
  Cable: "a trail needs a carrier to follow",
  RayCaster: "casts rays at colliders an Eye is given",
  GeometrySketch: "an ability: annotates a shape it is handed",
  FourierTrace: "traces a path it is handed",
  Quote: "typesets words it is handed",
  FlowerText: "settles circles into words it is handed",
}

// -- the generic adapter ------------------------------------------------------

/**
 * Own params a symbol is SHOWN at on a page, where its class default is a
 * scene's starting point rather than its face (TheWall at growth 0 is
 * still empty; its README's face is the wall grown).
 */
const FACE_PARAMS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  TheWall: { growth: 1 },
}

/** Every holon's own transform and lifecycle — never a symbol's own param. */
const STANDARD = new Set(["x", "y", "z", "h", "p", "b", "scale", "creation", "opacity"])
/** A Stroke's pen and paint — the board's look, not the symbol's shape. */
const PEN = new Set(["erasure", "drawStart", "drawReversed", "fillOpacity", "clock"])
const isPenWidth = (name: string) => name === "stroke" || /Stroke$/.test(name)
const NUMERIC = new Set(["scalar", "length", "angle", "bipolar", "completion", "integer"])

/** What `size` is when nothing says: a comfortable symbol on the page. */
export const DEFAULT_SIZE = 220

const ANGLE = "radians, page angle: 0 = +x (right), increasing CLOCKWISE on the page (y is down)"

const num = (p: Record<string, unknown>, key: string, fallback: number): number => {
  const v = Number(p[key])
  return Number.isFinite(v) ? v : fallback
}

/** `Globe` → `globe`, `TheWall` → `theWall`, `SMark` → `sMark`. */
const idOf = (className: string) => className[0]!.toLowerCase() + className.slice(1)

/** The 2D extent of a holon's drawn lines in its OWN frame (its own
 *  transform excluded), scene units, y up. */
export interface Extent {
  cx: number
  cy: number
  w: number
  h: number
}

/** A point in `h`'s local frame → its parent's (scale → rotate → translate). */
const toParent = (h: Holon, v: Vec3Like): Vec3Like => {
  const s = h.scale.value
  let out = s === 1 ? v : { x: v.x * s, y: v.y * s, z: v.z * s }
  out = rotHPB(out, h.p.value, h.h.value, h.b.value)
  return { x: out.x + h.x.value, y: out.y + h.y.value, z: out.z + h.z.value }
}

/**
 * Where a holon's ink actually is: every stroke's polyline — the one the
 * host draws (three-host.ts `polyline`) — carried up through its parts'
 * transforms into the root's frame. A Cylinder, whose outline the host
 * derives per frame from the camera, contributes its solid's corners.
 */
export const extentOf = (root: Holon): Extent | undefined => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const visit = (h: Holon, up: (v: Vec3Like) => Vec3Like) => {
    const add = (v: Vec3Like) => {
      const q = up(v)
      if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) return
      if (q.x < x0) x0 = q.x
      if (q.x > x1) x1 = q.x
      if (q.y < y0) y0 = q.y
      if (q.y > y1) y1 = q.y
    }
    if (h instanceof Cylinder) {
      const r = h.radius.value
      const half = h.height.value / 2
      for (const x of [-r, r]) for (const y of [-half, half]) for (const z of [-r, r]) add({ x, y, z })
    } else if (h instanceof Stroke) {
      for (const v of polyline(h) ?? []) add(v)
    }
    for (const part of h.parts) visit(part, (v) => up(toParent(part, v)))
  }
  visit(root, (v) => v)
  if (!Number.isFinite(x0)) return undefined
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 }
}

interface Generic {
  entry: VocabEntry
  cls: HolonClass
  /** The symbol's own params: name → kind and the value it is shown at. */
  own: Map<string, { kind: string; shown: number }>
}

/** The holon a generic placement makes, unpositioned, with its own params. */
const makeOwn = (g: Generic, p: Record<string, unknown>): Holon => {
  const overrides: Record<string, number> = {}
  for (const [k, { kind, shown }] of g.own) {
    const given = Number(p[k])
    const v = Number.isFinite(given) ? given : shown
    overrides[k] = kind === "integer" ? Math.round(v) : v
  }
  return new g.cls(overrides)
}

const extents = new Map<string, Extent | null>()
/** The extent of a class at these own params — measured once, then remembered. */
const measured = (g: Generic, p: Record<string, unknown>, holon?: Holon): Extent | undefined => {
  const key = `${g.entry.id}${JSON.stringify([...g.own.keys()].map((k) => p[k] ?? null))}`
  if (!extents.has(key)) {
    if (extents.size > 256) extents.clear()
    let e: Extent | undefined
    try {
      e = extentOf(holon ?? makeOwn(g, p))
    } catch {
      e = undefined
    }
    extents.set(key, e && e.w + e.h > 1e-6 ? e : null)
  }
  return extents.get(key) ?? undefined
}

const ownSpec = (name: string, kind: string, value: number, min?: number, max?: number): ParamSpec => {
  const range = min !== undefined && max !== undefined ? `, ${min}..${max}` : ""
  const r = Math.round(value * 1000) / 1000
  return {
    type: "number",
    default: value,
    description: `the symbol's own ${kind}${range} (default ${r}); shape only — leave it at its default unless the drawing clearly says otherwise`,
  }
}

const genericFor = (shelf: (typeof SHELF)[number]): Generic | undefined => {
  let sample: Holon
  try {
    sample = new shelf.cls()
  } catch {
    return undefined
  }
  const own = new Map<string, { kind: string; shown: number }>()
  const params: Record<string, ParamSpec> = {
    cx: { type: "number", role: "x", description: "centre x of the symbol's drawn extent, page units" },
    cy: { type: "number", role: "y", description: "centre y of the symbol's drawn extent, page units" },
    size: { type: "number", role: "length", default: DEFAULT_SIZE, description: "its largest extent (width or height, whichever is bigger), page units" },
    rotation: { type: "number", role: "angle", description: `${ANGLE}; 0 = as the symbol stands by default` },
  }
  for (const [name, param] of sample.params) {
    if (STANDARD.has(name) || PEN.has(name) || isPenWidth(name) || name in params) continue
    if (!NUMERIC.has(param.kind) || typeof param.defaultValue !== "number") continue
    const shown = FACE_PARAMS[shelf.className]?.[name] ?? param.defaultValue
    own.set(name, { kind: param.kind, shown })
    params[name] = ownSpec(name, param.kind, shown, param.min, param.max)
  }
  const g: Generic = {
    cls: shelf.cls,
    own,
    entry: {
      id: idOf(shelf.className),
      name: shelf.className,
      holon: shelf.className,
      description: `The ${shelf.className} — a sovereign DreamTalk symbol (core/vocabulary/${shelf.folder}).`,
      params,
      build: (p) => {
        const holon = makeOwn(g, p)
        const e = measured(g, p, holon) ?? { cx: 0, cy: 0, w: DEFAULT_SIZE, h: DEFAULT_SIZE }
        const k = Math.max(1, num(p, "size", DEFAULT_SIZE)) / Math.max(e.w, e.h, 1e-6)
        // Its drawn centre on the origin, then fitted and placed.
        return new Group({
          members: [new Group({ members: [holon], x: -e.cx, y: -e.cy })],
          x: num(p, "cx", 0),
          y: -num(p, "cy", 0),
          scale: k,
          b: -num(p, "rotation", 0),
        })
      },
      footprint: (p) => {
        const size = Math.max(1, num(p, "size", DEFAULT_SIZE))
        const e = measured(g, p)
        if (!e) return { w: size, h: size }
        const m = Math.max(e.w, e.h, 1e-6)
        return { w: (size * e.w) / m, h: (size * e.h) / m }
      },
    },
  }
  return g
}

let generics: Map<string, Generic> | undefined
const allGenerics = (): Map<string, Generic> => {
  if (generics) return generics
  const covered = new Set(VOCABULARY.map((e) => e.holon).filter(Boolean))
  generics = new Map()
  for (const s of SHELF) {
    if (covered.has(s.className)) continue
    const g = genericFor(s)
    if (g) generics.set(g.entry.id, g)
  }
  return generics
}

/** The generic entry for an id, if the shelf has one (vocabulary.ts vocabById). */
export const genericById = (id: string): VocabEntry | undefined => allGenerics().get(id)?.entry

/**
 * Hand the generic entries their real descriptions — the README's first
 * paragraph, or the class's own doc comment (scripts/catalogue.ts reads
 * them from disk; the page fetches them from `/api/catalogue`).
 */
export const describeGeneric = (byClass: Readonly<Record<string, { description?: string }>>): void => {
  for (const g of allGenerics().values()) {
    const d = byClass[g.entry.holon!]?.description
    if (d) g.entry.description = d
  }
}

// -- the catalogue ------------------------------------------------------------

export interface CatalogueItem {
  entry: VocabEntry
  /** The sovereign class behind it, if any (its folder holds README + face). */
  className?: string
  folder?: string
  /** `shape` — the plain geometry; `symbol` — a sovereign DreamNode. */
  kind: "shape" | "symbol"
}

/** Everything a board can import: the shapes, then every symbol by name. */
export const catalogue = (): CatalogueItem[] => {
  const folderOf = new Map(SHELF.map((s) => [s.className, s.folder]))
  const items: CatalogueItem[] = VOCABULARY.map((entry) => ({
    entry,
    className: entry.holon,
    folder: entry.holon ? folderOf.get(entry.holon) : undefined,
    kind: entry.holon && folderOf.has(entry.holon) ? "symbol" : "shape",
  }))
  for (const g of allGenerics().values())
    items.push({ entry: g.entry, className: g.entry.holon, folder: folderOf.get(g.entry.holon!), kind: "symbol" })
  const shapes = items.filter((i) => i.kind === "shape")
  const symbols = items.filter((i) => i.kind === "symbol").sort((a, b) => a.entry.name.localeCompare(b.entry.name))
  return [...shapes, ...symbols]
}

/** The ids a board imports: its own list, or the defaults it was drawn with. */
export const importsOf = (s: Pick<SketchState, "vocabulary">): string[] => [...(s.vocabulary ?? DEFAULT_IMPORTS)]

/** A length when a symbol is placed from nothing: by entry, else by its
 *  conventional name, else the default size. */
const PLACE_LENGTH: Record<string, number> = {
  "text.size": 64,
  "flowerOfLife.r": 60,
  "regenaissance.r": 200,
  "mindVirus.size": 110,
  "sMark.size": 120,
  "cylinder.radius": 70,
  "cylinder.height": 180,
  r: 90,
  radius: 90,
}

/**
 * A symbol placed from nothing — dropped from the catalogue — at a page
 * point: every param at its default, its centre on the point, its lengths
 * a comfortable size. The same params the recognizer would have read off a
 * drawing of it there.
 */
export const placeParams = (entry: VocabEntry, at: { x: number; y: number }): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [k, spec] of Object.entries(entry.params)) {
    if (spec.role === "x") out[k] = at.x
    else if (spec.role === "y") out[k] = at.y
    else if (spec.role === "length") out[k] = PLACE_LENGTH[`${entry.id}.${k}`] ?? PLACE_LENGTH[k] ?? spec.default ?? DEFAULT_SIZE
    else if (spec.role === "content") out[k] = entry.name
    else if (spec.type === "enum") out[k] = spec.options?.[0]
    else if (spec.type === "points") continue
    else if (spec.default !== undefined) out[k] = spec.default
    else if (spec.role === "angle") out[k] = 0
  }
  return out
}
