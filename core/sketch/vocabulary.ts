/**
 * vocabulary.ts — the visual vocabulary a sketch scene can IMPORT.
 *
 * "The same way a programmer imports modules, you import visual vocabulary
 * into your scene, and you invoke it by drawing." Each entry is one symbol
 * the recognizer may answer with: an id, a description written FOR THE
 * MODEL (it reads these verbatim — scripts/recognize.ts), the symbol's own
 * degrees of freedom, and a `build` that turns a reading into a holon.
 *
 * ## The coordinate convention (the one mapping in the sketchpad)
 *
 * Params arrive in PAGE units (protocol.ts: 1404 × 1872, origin top-left,
 * y DOWN). `build` returns a holon already positioned in a scene frame
 * where
 *
 *     scene x = page x        scene y = −page y        z = 0
 *
 * and every length is in page units (1 page unit = 1 scene unit). The
 * sketch page's camera frames the rectangle x ∈ [0, 1404], y ∈ [−1872, 0]
 * and maps nothing else.
 *
 * Angles in params are PAGE angles: radians, measured from +x and turning
 * CLOCKWISE on the page (the y-down reading of atan2(dy, dx)), so an angle
 * computed directly from page coordinates is the right number. `build`
 * negates them into the scene's counter-clockwise `b`.
 */

import type { Holon } from "../src/holon"
import { Circle, Group, Line, Polygon, Square, type Vec3Like } from "../src/parts/primitives"
import { derive } from "../src/params"
import { FoldableCube } from "../vocabulary/FoldableCube/FoldableCube"
import { MindVirus, type PulseSpec } from "../vocabulary/MindVirus/MindVirus"
import { Eye } from "../vocabulary/Eye/Eye"
import { Figure } from "../vocabulary/Figure/Figure"
import { WHITE } from "../src/constants"
import type { Dream } from "../src/dream"
import { PAGE_H, PAGE_W, type InkStroke, type PlacedSymbol } from "./protocol"
import { wrapAngle, xfOf, xfPoint, type Xf } from "./xform"

/**
 * What a param MEANS geometrically — which is all a whiteboard transform
 * needs to know (transformSymbol). Unstated means "shape, not place": a
 * fold, a ring count, a 3D heading/pitch the page plane does not turn.
 */
export type ParamRole = "x" | "y" | "length" | "angle" | "points"

export interface ParamSpec {
  type: "number" | "points" | "enum"
  description: string
  options?: string[]
  role?: ParamRole
}

export interface VocabEntry {
  id: string
  name: string
  description: string
  params: Record<string, ParamSpec>
  build(params: Record<string, unknown>): Holon
}

// -- param readers (the recognizer validates, but build must never throw) ---

const num = (p: Record<string, unknown>, key: string, fallback: number): number => {
  const v = Number(p[key])
  return Number.isFinite(v) ? v : fallback
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** `[{x,y}…]` or `[[x,y]…]` → page points; anything else → []. */
export const readPoints = (v: unknown): { x: number; y: number }[] => {
  if (!Array.isArray(v)) return []
  const out: { x: number; y: number }[] = []
  for (const p of v) {
    const x = Array.isArray(p) ? Number(p[0]) : Number((p as { x?: unknown })?.x)
    const y = Array.isArray(p) ? Number(p[1]) : Number((p as { y?: unknown })?.y)
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y })
  }
  return out
}

/** Page point → scene point. */
const scenePt = (x: number, y: number): Vec3Like => ({ x, y: -y, z: 0 })

// -- MindVirus: the cable is a journey ---------------------------------------

/** The Cable samples its trail at 12 equal-time control points (Cable.ts
 *  CTRL_POINTS). 11 equal pulses over equal arc lengths of the drawn cable
 *  put every control point exactly on a pulse boundary — on the line. */
const CABLE_PULSES = 11
const PULSE_SECONDS = 0.5
/** MindVirus's native cube edge (FoldableCube default size). */
const MV_NATIVE = 100

/** Resample a polyline to `n + 1` points at equal arc length. */
export const resampleByArcLength = (
  pts: readonly { x: number; y: number }[],
  n: number,
): { x: number; y: number }[] => {
  if (pts.length < 2) return [...pts]
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y))
  }
  const total = cum[cum.length - 1]!
  if (total < 1e-6) return [pts[0]!, pts[pts.length - 1]!]
  const out: { x: number; y: number }[] = []
  let j = 1
  for (let k = 0; k <= n; k++) {
    const s = (k / n) * total
    while (j < pts.length - 1 && cum[j]! < s) j++
    const seg = cum[j]! - cum[j - 1]!
    const u = seg < 1e-9 ? 0 : (s - cum[j - 1]!) / seg
    out.push({
      x: pts[j - 1]!.x + (pts[j]!.x - pts[j - 1]!.x) * u,
      y: pts[j - 1]!.y + (pts[j]!.y - pts[j - 1]!.y) * u,
    })
  }
  return out
}

const buildMindVirus = (p: Record<string, unknown>): Holon => {
  const size = Math.max(5, num(p, "size", 100))
  const s = size / MV_NATIVE
  const fold = clamp(num(p, "fold", 1), -1, 1)
  const cx = num(p, "x", 0)
  const cy = num(p, "y", 0)
  const cable = readPoints(p.cable)
  // Heading: stated, or else the cable's last direction (it swims away
  // from its trail), or else facing right.
  let heading = num(p, "heading", NaN)
  if (!Number.isFinite(heading) && cable.length >= 2) {
    const a = cable[cable.length - 2]!
    const b = cable[cable.length - 1]!
    heading = Math.atan2(cy - a.y, cx - a.x)
    if (Math.hypot(cx - a.x, cy - a.y) < 1e-6) heading = Math.atan2(b.y - a.y, b.x - a.x)
  }
  if (!Number.isFinite(heading)) heading = 0
  // Forward on the page, and the creature's ORIGIN: MindVirus is built
  // about its face (the cube's bottom), its bell trailing a full edge
  // behind — so the body centre (x, y) sits half an edge aft of it.
  const fx = Math.cos(heading)
  const fy = Math.sin(heading)
  const ox = cx + fx * size * 0.5
  const oy = cy + fy * size * 0.5
  const forward = { x: fx, y: -fy, z: 0 }

  if (cable.length < 2) {
    const mv = new MindVirus({ x: ox, y: -oy, scale: s, fold })
    // headingFor's convention, inline (h/p that put local +z on `forward`).
    mv.h.value = Math.atan2(forward.x, Math.hypot(forward.y, forward.z))
    mv.p.value = Math.atan2(-forward.y, forward.z)
    return mv
  }

  // Journey mode: the creature swims the drawn cable, then one last pulse
  // from where the cable meets the body to its resting pose. The TRAIL is
  // installed on the cable part only — re-timed so the whole window maps
  // onto the drawn line, never through the body (the journey's own path
  // would run on through the cube to the face).
  const walk = resampleByArcLength(cable, CABLE_PULSES)
  const pulses: PulseSpec[] = walk.slice(1).map((q, i) => ({
    start: i * PULSE_SECONDS,
    duration: PULSE_SECONDS,
    to: scenePt(q.x, q.y),
  }))
  const tCable = CABLE_PULSES * PULSE_SECONDS
  pulses.push({ start: tCable, duration: PULSE_SECONDS, to: scenePt(ox, oy), heading: forward })
  const T = tCable + PULSE_SECONDS
  const mv = new MindVirus({ scale: s, clock: T })
  mv.journey = { origin: scenePt(walk[0]!.x, walk[0]!.y), pulses }
  void mv.parts // compose(): position/heading/fold now follow the clock
  // At rest the journey's bell is closed; the drawing says how open it is.
  mv.fold.follow(derive(() => fold))
  // The window [0, T] read as cable time [0, tCable]: the 12 equal-time
  // control points still land on pulse boundaries — on the drawn line.
  mv.cable.trail((t) => mv.pathAt((t * tCable) / T), { since: 0, window: T })
  mv.cable.width.value = mv.cable.width.value * s
  mv.cable.ringStep.value = mv.cable.ringStep.value * s
  return mv
}

// -- the vocabulary -----------------------------------------------------------

const ANGLE = "radians, page angle: 0 = +x (right), increasing CLOCKWISE on the page (y is down)"

export const VOCABULARY: VocabEntry[] = [
  {
    id: "circle",
    name: "Circle",
    description: "A single circle. Any closed round loop — a wobbly hand-drawn circle or ellipse-ish oval is still a circle.",
    params: {
      cx: { type: "number", role: "x", description: "centre x, page units" },
      cy: { type: "number", role: "y", description: "centre y, page units" },
      r: { type: "number", role: "length", description: "radius, page units (mean distance of the loop from its centre)" },
    },
    build: (p) =>
      new Circle({ x: num(p, "cx", 0), y: -num(p, "cy", 0), radius: Math.max(1, num(p, "r", 50)), tint: WHITE }),
  },
  {
    id: "square",
    name: "Square",
    description: "A square (four roughly equal sides, four corners). A drawn rectangle that is roughly square counts.",
    params: {
      cx: { type: "number", role: "x", description: "centre x, page units" },
      cy: { type: "number", role: "y", description: "centre y, page units" },
      size: { type: "number", role: "length", description: "side length, page units" },
      rotation: { type: "number", role: "angle", description: `${ANGLE}; 0 = axis-aligned. Use the smallest equivalent angle in (−π/4, π/4]` },
    },
    build: (p) =>
      new Square({
        x: num(p, "cx", 0),
        y: -num(p, "cy", 0),
        size: Math.max(1, num(p, "size", 100)),
        b: -num(p, "rotation", 0),
      }),
  },
  {
    id: "triangle",
    name: "Triangle",
    description: "An equilateral-ish triangle (three corners).",
    params: {
      cx: { type: "number", role: "x", description: "centre x (centroid), page units" },
      cy: { type: "number", role: "y", description: "centre y (centroid), page units" },
      r: { type: "number", role: "length", description: "circumradius: centroid-to-corner distance, page units" },
      rotation: {
        type: "number",
        role: "angle",
        description: `${ANGLE}; 0 = one corner pointing straight UP (flat bottom); π/3 (or π) = pointing DOWN`,
      },
    },
    build: (p) =>
      new Polygon({
        x: num(p, "cx", 0),
        y: -num(p, "cy", 0),
        radius: Math.max(1, num(p, "r", 50)),
        sides: 3,
        // Polygon's vertex 0 sits at `phase` (CCW from +x); up is π/2.
        phase: Math.PI / 2 - num(p, "rotation", 0),
      }),
  },
  {
    id: "cube",
    name: "Cube",
    description:
      "A 3D wireframe cube — a square with a second offset square and connecting edges, or any drawn box in perspective. A flat square with no depth is `square`, not `cube`.",
    params: {
      cx: { type: "number", role: "x", description: "centre x, page units" },
      cy: { type: "number", role: "y", description: "centre y, page units" },
      size: { type: "number", role: "length", description: "edge length, page units (roughly the front face's side)" },
      h: { type: "number", description: "heading (turn about the vertical axis), radians; ~0.6 shows a side face" },
      p: { type: "number", description: "pitch (tilt about the horizontal axis), radians; ~0.4 shows the top face" },
      b: { type: "number", role: "angle", description: "bank (in-plane roll), page angle (clockwise-positive), radians; usually 0" },
    },
    build: (p) => {
      const size = Math.max(1, num(p, "size", 100))
      // The FoldableCube's bottom face is its origin; lift it half an
      // edge so the group pivots about the cube's centre. Fold 1 = the
      // closed-reading cup (each wall's top edge supplies the lid).
      const cube = new FoldableCube({ size, fold: 1, y: -size / 2 })
      return new Group({
        members: [cube],
        x: num(p, "cx", 0),
        y: -num(p, "cy", 0),
        h: num(p, "h", 0.6),
        p: num(p, "p", 0.4),
        b: -num(p, "b", 0),
      })
    },
  },
  {
    id: "flowerOfLife",
    name: "Flower of Life",
    description:
      "The sacred-geometry Flower of Life: equal circles of radius r whose centres sit on a hexagonal lattice of spacing r — a centre circle and 6 around it (rings 1, the 'seed', 7 circles), optionally 12 more (rings 2, 19 circles). Many overlapping equal circles drawn in a rosette = this.",
    params: {
      cx: { type: "number", role: "x", description: "centre of the middle circle x, page units" },
      cy: { type: "number", role: "y", description: "centre of the middle circle y, page units" },
      r: { type: "number", role: "length", description: "radius of EACH circle (= the spacing between neighbouring centres), page units" },
      rings: { type: "enum", options: ["1", "2"], description: "1 → 7 circles, 2 → 19 circles" },
      rotation: { type: "number", role: "angle", description: `${ANGLE}; 0 = outer centres at 0°, 60°, … (one on the +x axis)` },
    },
    build: (p) => {
      const r = Math.max(1, num(p, "r", 50))
      const rings = num(p, "rings", 1) >= 2 ? 2 : 1
      const rot = -num(p, "rotation", 0)
      const centres: { x: number; y: number }[] = [{ x: 0, y: 0 }]
      for (let k = 0; k < 6; k++) {
        const a = rot + (k * Math.PI) / 3
        centres.push({ x: r * Math.cos(a), y: r * Math.sin(a) })
      }
      if (rings === 2) {
        for (let k = 0; k < 6; k++) {
          const a = rot + (k * Math.PI) / 3
          centres.push({ x: 2 * r * Math.cos(a), y: 2 * r * Math.sin(a) })
          const b = a + Math.PI / 6
          centres.push({ x: Math.sqrt(3) * r * Math.cos(b), y: Math.sqrt(3) * r * Math.sin(b) })
        }
      }
      return new Group({
        members: centres.map((c) => new Circle({ x: c.x, y: c.y, radius: r })),
        x: num(p, "cx", 0),
        y: -num(p, "cy", 0),
      })
    },
  },
  {
    id: "mindVirus",
    name: "MindVirus",
    description:
      "A MindVirus: a creature whose body is a cube (often drawn as an open box / cup, its walls flaring like a jellyfish bell) with an eye on its front face, trailing a long wavy CABLE (tail) behind it. Any box/cube shape with a squiggly line trailing off one side = this. The creature swims AWAY from its cable: the heading points from where the cable attaches through the body.",
    params: {
      x: { type: "number", role: "x", description: "body (cube) centre x, page units" },
      y: { type: "number", role: "y", description: "body (cube) centre y, page units" },
      size: { type: "number", role: "length", description: "cube edge length, page units" },
      heading: { type: "number", role: "angle", description: `${ANGLE}; the direction the creature faces/swims (away from the cable)` },
      fold: {
        type: "number",
        description:
          "−1..1, how the cube's walls sit: 1 = closed box (walls upright, reads as a plain cube), ~0.5 = walls half open, 0 = walls splayed flat (an open cross/flower), negative = walls folded forward around something (wrapping a victim)",
      },
      cable: {
        type: "points",
        role: "points",
        description:
          "the drawn tail as page points [[x,y],…] ordered from the FREE TAIL END to where it touches the body; follow the actual drawn line (8–20 points). Omit or [] if no tail was drawn",
      },
    },
    build: buildMindVirus,
  },
  {
    id: "eye",
    name: "Eye",
    description:
      "The DreamTalk Eye seen in profile: a sideways V / wedge (two eyelid lines meeting at an apex) closed by an arc, with an iris near the arc — like a '<' with a ')' on its open side. A plain almond eye shape also counts.",
    params: {
      cx: { type: "number", role: "x", description: "centre x of the eye's bounding box, page units" },
      cy: { type: "number", role: "y", description: "centre y, page units" },
      size: { type: "number", role: "length", description: "length from apex to the far arc, page units" },
      rotation: { type: "number", role: "angle", description: `${ANGLE}; the gaze direction (apex → arc). 0 = looking right` },
    },
    build: (p) => {
      // Native Eye: apex at the origin, gazing +x, lids reaching x = 230.
      const size = Math.max(1, num(p, "size", 100))
      const k = size / 230
      const rot = -num(p, "rotation", 0)
      const eye = new Eye({ scale: k, x: -115 * k })
      return new Group({ members: [eye], x: num(p, "cx", 0), y: -num(p, "cy", 0), b: rot })
    },
  },
  {
    id: "figure",
    name: "Figure",
    description: "A person: a stick figure (round head, body line, arms, legs).",
    params: {
      cx: { type: "number", role: "x", description: "centre x (the figure's middle), page units" },
      cy: { type: "number", role: "y", description: "centre y (halfway between crown and feet), page units" },
      height: { type: "number", role: "length", description: "crown-to-feet height, page units" },
    },
    build: (p) =>
      new Figure({ x: num(p, "cx", 0), y: -num(p, "cy", 0), height: Math.max(1, num(p, "height", 120)) }),
  },
]

const BY_ID = new Map(VOCABULARY.map((e) => [e.id, e]))

export const vocabById = (id: string): VocabEntry | undefined => BY_ID.get(id)

/** A placed symbol → its holon, in the scene frame stated above. Unknown
 *  symbol ids throw (the recognizer never returns them). */
export const buildSymbol = (s: PlacedSymbol): Holon => {
  const entry = vocabById(s.symbol)
  if (!entry) throw new Error(`sketch vocabulary: unknown symbol '${s.symbol}'`)
  return entry.build(s.params ?? {})
}

// -- transforms: move / rotate / scale a placed symbol ------------------------

/** The conventional names, for params whose entry states no role (or a
 *  symbol this vocabulary no longer knows — a board outlives its imports). */
const ROLE_BY_NAME: Record<string, ParamRole> = {
  x: "x",
  cx: "x",
  y: "y",
  cy: "y",
  r: "length",
  radius: "length",
  size: "length",
  width: "length",
  height: "length",
  rotation: "angle",
  heading: "angle",
}

const roleOf = (entry: VocabEntry | undefined, key: string): ParamRole | undefined =>
  entry ? entry.params[key]?.role : ROLE_BY_NAME[key]

const isPointLike = (e: unknown): boolean =>
  (Array.isArray(e) && typeof e[0] === "number" && typeof e[1] === "number") ||
  (typeof e === "object" && e !== null && typeof (e as { x?: unknown }).x === "number" &&
    typeof (e as { y?: unknown }).y === "number")

/**
 * A placed symbol under a whiteboard transform (xform.ts): its position
 * (the x/y pair) moves about the pivot, lengths scale, PAGE angles turn
 * (clockwise-positive, the convention above), and point paths — the
 * MindVirus cable — move point by point, keeping whichever spelling
 * ([x, y] or {x, y}) they arrived in. Everything else is shape and stays.
 *
 * A symbol with no angle (a Figure stands upright) still orbits a pivot
 * it does not sit on: its centre moves, it simply does not tilt. Unknown
 * symbols fall back to the conventional param names, so a board never
 * becomes unmovable because its vocabulary changed.
 */
export const transformSymbol = (s: PlacedSymbol, t: Partial<Xf>): PlacedSymbol => {
  const xf = xfOf(t)
  const entry = vocabById(s.symbol)
  const params: Record<string, unknown> = { ...s.params }
  const keys = Object.keys(s.params)
  const xKey = keys.find((k) => roleOf(entry, k) === "x")
  const yKey = keys.find((k) => roleOf(entry, k) === "y")
  if (xKey && yKey) {
    const x = Number(s.params[xKey])
    const y = Number(s.params[yKey])
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const q = xfPoint(xf, { x, y })
      params[xKey] = q.x
      params[yKey] = q.y
    }
  }
  for (const k of keys) {
    const v = s.params[k]
    const role = roleOf(entry, k)
    if (role === "length" && typeof v === "number" && Number.isFinite(v)) params[k] = v * xf.scale
    else if (role === "angle" && typeof v === "number" && Number.isFinite(v))
      params[k] = xf.rotate === 0 ? v : wrapAngle(v + xf.rotate)
    else if ((role === "points" || role === undefined) && Array.isArray(v) && v.length > 0 && v.every(isPointLike))
      params[k] = v.map((e) => {
        if (Array.isArray(e)) {
          const q = xfPoint(xf, { x: e[0] as number, y: e[1] as number })
          return [q.x, q.y]
        }
        const pt = e as { x: number; y: number }
        return { ...pt, ...xfPoint(xf, pt) }
      })
  }
  return { ...s, params }
}

// -- ink: a raw stroke as scene data -------------------------------------------

/**
 * One ink stroke as a scene holon — a Line in the same page → scene
 * mapping as every symbol (x, −y, 0). The whiteboard's Grease Pencil: a
 * scribble that was never "made real" is still first-class scene data the
 * editor can select, and that choreography can Create, Erase or tint.
 */
export const inkHolon = (k: InkStroke): Line =>
  new Line({ points: k.points.map((p) => scenePt(p.x, p.y)), tint: WHITE, stroke: 2 })

/**
 * Frame a dream's observer on a page rectangle, straight on, so scene
 * (x, −y) lands on page (x, y) and the rectangle's HEIGHT fills the
 * frame (the host is 16:9; a portrait page is clipped at the sides by
 * whoever shows it, or sits in the middle of a wider frame).
 */
export const framePage = (dream: Dream, frame = { cx: PAGE_W / 2, cy: PAGE_H / 2, h: PAGE_H }): void => {
  const o = dream.observer
  o.x.defaultValue = o.x.value = frame.cx
  o.y.defaultValue = o.y.value = -frame.cy
  // The default vertical fov is 53.13°, tan(fov/2) = 0.5, so distance = height.
  const r = frame.h / (2 * Math.tan(o.fov.value / 2))
  o.radius.defaultValue = o.radius.value = r
}
