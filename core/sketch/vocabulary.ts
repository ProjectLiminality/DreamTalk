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
 * Params arrive in PAGE units (protocol.ts: PAGE_W × PAGE_H, origin top-left,
 * y DOWN). `build` returns a holon already positioned in a scene frame
 * where
 *
 *     scene x = page x        scene y = −page y        z = 0
 *
 * and every length is in page units (1 page unit = 1 scene unit). The
 * sketch page's camera frames the rectangle x ∈ [0, PAGE_W], y ∈ [−PAGE_H, 0]
 * and maps nothing else.
 *
 * Angles in params are PAGE angles: radians, measured from +x and turning
 * CLOCKWISE on the page (the y-down reading of atan2(dy, dx)), so an angle
 * computed directly from page coordinates is the right number. `build`
 * negates them into the scene's counter-clockwise `b`.
 */

import type { Holon } from "../src/holon"
import { Circle, Group, Line, Polygon, Rectangle, Square, type Vec3Like } from "../src/parts/primitives"
import { derive } from "../src/params"
import { FoldableCube } from "../vocabulary/FoldableCube/FoldableCube"
import { MindVirus, type PulseSpec } from "../vocabulary/MindVirus/MindVirus"
import { Eye } from "../vocabulary/Eye/Eye"
import { Figure } from "../vocabulary/Figure/Figure"
import { Cylinder } from "../vocabulary/Cylinder/Cylinder"
import { Regenaissance } from "../vocabulary/Regenaissance/Regenaissance"
import { SMARK, SMark } from "../vocabulary/Regenaissance/SMark"
import { Text } from "../src/parts/text"
import { WHITE } from "../src/constants"
import type { Dream } from "../src/dream"
import { PAGE_H, PAGE_W, type InkStroke, type PlacedSymbol } from "./protocol"
import { eulerToMat3, isMat3Identity, mat3Apply, mat3Mul, mat3ToEuler, wrapAngle, xfOf, xfPoint, type Mat3, type Xf } from "./xform"
import { rotHPB } from "../src/parts/curves"
import { genericById } from "./catalogue"

/**
 * What a param MEANS geometrically — which is all a whiteboard transform
 * needs to know (transformSymbol). Unstated means "shape, not place": a
 * fold, a ring count.
 *
 *  - `content` — the symbol's DATA (a Text's string): what it says, which
 *    no transform touches.
 *  - `yaw` / `pitch` — 3D Euler angles in the holon's own h/p (radians,
 *    scene convention); with the entry's `angle` param as the roll (b,
 *    page-angle sign) they are the symbol's full orientation, which a
 *    TUMBLE turns (xform.ts Mat3). The page plane's own rotate leaves
 *    them alone.
 *  - `tilt` — the elevation of a DIRECTION out of the page, toward the
 *    viewer positive (radians); the entry's `angle` param is that
 *    direction's azimuth on the page. A tumble turns the direction.
 *
 * An entry with a yaw, pitch or tilt param is TUMBLEABLE; every other
 * symbol is flat and ignores a tumble.
 */
export type ParamRole = "x" | "y" | "length" | "angle" | "points" | "content" | "yaw" | "pitch" | "tilt"

export interface ParamSpec {
  type: "number" | "points" | "enum" | "string"
  description: string
  options?: string[]
  role?: ParamRole
  /** What `build` assumes when the param is missing — transforms start from it too. */
  default?: number
}

export interface VocabEntry {
  id: string
  name: string
  description: string
  /** One plain line for the catalogue tile — `description` is for the model. */
  blurb?: string
  /** The sovereign class (core/vocabulary) this entry speaks for: the
   *  catalogue offers it here instead of through the generic adapter. */
  holon?: string
  params: Record<string, ParamSpec>
  build(params: Record<string, unknown>): Holon
  /** The symbol's page footprint (w × h about its x/y), when the generic
   *  reading of its params would be wrong (state.ts symbolBox). */
  footprint?(params: Record<string, unknown>): { w: number; h: number }
}

// -- param readers (the recognizer validates, but build must never throw) ---

const num = (p: Record<string, unknown>, key: string, fallback: number): number => {
  const v = Number(p[key])
  return Number.isFinite(v) ? v : fallback
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** A page point, lifted off the page by `z` (scene z, toward the viewer)
 *  once a tumble has turned it out of the plane. */
export interface PagePt {
  x: number
  y: number
  z?: number
}

/** `[{x,y,z?}…]` or `[[x,y,z?]…]` → page points; anything else → []. A
 *  drawn path is flat (no z); a tumbled one carries its depth. */
export const readPoints = (v: unknown): PagePt[] => {
  if (!Array.isArray(v)) return []
  const out: PagePt[] = []
  for (const p of v) {
    const x = Array.isArray(p) ? Number(p[0]) : Number((p as { x?: unknown })?.x)
    const y = Array.isArray(p) ? Number(p[1]) : Number((p as { y?: unknown })?.y)
    const z = Array.isArray(p) ? Number(p[2]) : Number((p as { z?: unknown })?.z)
    if (Number.isFinite(x) && Number.isFinite(y)) out.push(Number.isFinite(z) && z !== 0 ? { x, y, z } : { x, y })
  }
  return out
}

/** Page point → scene point. */
const scenePt = (x: number, y: number, z = 0): Vec3Like => ({ x, y: -y, z })

/** A point in `h`'s PARENT frame → world, through every ancestor's
 *  transform (scale → rotate → translate, the host's order — the inverse
 *  of Cable's toLocal). */
const parentToWorld = (h: Holon, v: Vec3Like): Vec3Like => {
  let out = v
  for (let node = h.parent; node; node = node.parent) {
    const s = node.scale.value
    if (s !== 1) out = { x: out.x * s, y: out.y * s, z: out.z * s }
    out = rotHPB(out, node.p.value, node.h.value, node.b.value)
    out = { x: out.x + node.x.value, y: out.y + node.y.value, z: out.z + node.z.value }
  }
  return out
}

// -- MindVirus: the cable is a journey ---------------------------------------

/** The Cable samples its trail at 12 equal-time control points (Cable.ts
 *  CTRL_POINTS). 11 equal pulses over equal arc lengths of the drawn cable
 *  put every control point exactly on a pulse boundary — on the line. */
const CABLE_PULSES = 11
const PULSE_SECONDS = 0.5
/** MindVirus's native cube edge (FoldableCube default size). */
const MV_NATIVE = 100

/** Resample a polyline to `n + 1` points at equal arc length (in 3D when
 *  its points carry depth; the result has z only if the input does). */
export const resampleByArcLength = (pts: readonly PagePt[], n: number): PagePt[] => {
  if (pts.length < 2) return [...pts]
  const deep = pts.some((p) => p.z !== undefined)
  const zOf = (p: PagePt) => p.z ?? 0
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, zOf(b) - zOf(a)))
  }
  const total = cum[cum.length - 1]!
  if (total < 1e-6) return [pts[0]!, pts[pts.length - 1]!]
  const out: PagePt[] = []
  let j = 1
  for (let k = 0; k <= n; k++) {
    const s = (k / n) * total
    while (j < pts.length - 1 && cum[j]! < s) j++
    const seg = cum[j]! - cum[j - 1]!
    const u = seg < 1e-9 ? 0 : (s - cum[j - 1]!) / seg
    const a = pts[j - 1]!
    const b = pts[j]!
    const q: PagePt = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
    if (deep) q.z = zOf(a) + (zOf(b) - zOf(a)) * u
    out.push(q)
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
  // Tilt: the heading lifted out of the page toward the viewer (a tumble).
  const tilt = clamp(num(p, "tilt", 0), -Math.PI / 2, Math.PI / 2)
  // Forward on the page, and the creature's ORIGIN: MindVirus is built
  // about its face (the cube's bottom), its bell trailing a full edge
  // behind — so the body centre (x, y) sits half an edge aft of it.
  const fx = Math.cos(heading) * Math.cos(tilt)
  const fy = Math.sin(heading) * Math.cos(tilt)
  const fz = Math.sin(tilt)
  const ox = cx + fx * size * 0.5
  const oy = cy + fy * size * 0.5
  const oz = fz * size * 0.5
  const forward = { x: fx, y: -fy, z: fz }

  if (cable.length < 2) {
    const mv = new MindVirus({ x: ox, y: -oy, z: oz, scale: s, fold })
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
    to: scenePt(q.x, q.y, q.z),
  }))
  const tCable = CABLE_PULSES * PULSE_SECONDS
  pulses.push({ start: tCable, duration: PULSE_SECONDS, to: { x: ox, y: -oy, z: oz }, heading: forward })
  const T = tCable + PULSE_SECONDS
  const mv = new MindVirus({ scale: s, clock: T })
  mv.journey = { origin: scenePt(walk[0]!.x, walk[0]!.y, walk[0]!.z), pulses }
  void mv.parts // compose(): position/heading/fold now follow the clock
  // At rest the journey's bell is closed; the drawing says how open it is.
  mv.fold.follow(derive(() => fold))
  // The window [0, T] read as cable time [0, tCable]: the 12 equal-time
  // control points still land on pulse boundaries — on the drawn line.
  // The journey is stated in the creature's PARENT frame (its x/y/z follow
  // it), the cable's trail in WORLD: carried through the ancestors, the
  // tail turns with whatever turns the creature (the whiteboard's tumble
  // pivot) instead of staying behind on the page.
  mv.cable.trail((t) => parentToWorld(mv, mv.pathAt((t * tCable) / T)), { since: 0, window: T })
  mv.cable.width.value = mv.cable.width.value * s
  mv.cable.ringStep.value = mv.cable.ringStep.value * s
  return mv
}

// -- Text: the words as written, made platonic ---------------------------------

/**
 * The top of the band a hand writes words in, as a fraction of Arimo's em
 * (the bundled default face, render/text.ts), measured off the glyph
 * outlines themselves (test/sketch-mirror-text.test.ts holds them to it):
 *
 *   capitals and digits — `H D T E 1 4 7` — stand 1409 of its 2048 (the
 *   font's OS/2 capHeight, exactly);
 *   ascenders — `b d f h k l` — stand 1484, a twentieth taller.
 *
 * The vocabulary's `size` is that height — what a hand writing a word
 * actually controls — and the Text holon's `size` is the em. Which top the
 * hand drew depends on what it wrote: words with a capital were sized by
 * their capitals (a written D and l stand alike; type's l overshoots), words
 * without one by their tall letters (textBandEm).
 */
export const TEXT_CAP_EM = 1409 / 2048
export const TEXT_ASCENDER_EM = 1484 / 2048

/** The band top the written `content` was measured to, in em. */
export const textBandEm = (content: string): number =>
  !/[\p{Lu}\p{Nd}]/u.test(content) && /[bdfhklß]/.test(content) ? TEXT_ASCENDER_EM : TEXT_CAP_EM
/** Baseline to baseline, in caps, for a written block of several lines. */
const TEXT_LINE_STEP_EM = 1.2
/** Arimo's mean advance per character, in em — a footprint, not a layout. */
const TEXT_ADVANCE_EM = 0.55

const textLines = (p: Record<string, unknown>): string[] =>
  String(typeof p.content === "string" || typeof p.content === "number" ? p.content : "").split("\n")

/**
 * The words as a Text holon, placed so the CAP BAND of the block — baseline
 * to capital top, descenders not counted, every line included — is centred
 * on (cx, cy) and turned by `rotation` about that centre. The holon itself
 * anchors on its first line's baseline middle (render/text.ts: the 2021 C4D
 * spline's origin), so that anchor is offset from the centre, in the
 * text's own turned frame. Returned bare — not wrapped — so a board's
 * choreography can `Write(this.symbols[i] as Text)` directly.
 */
const buildText = (p: Record<string, unknown>): Text => {
  const cap = Math.max(1, num(p, "size", 60))
  const lines = textLines(p)
  const em = cap / textBandEm(lines.join("\n"))
  const step = em * TEXT_LINE_STEP_EM
  // Page offset of the first baseline below the block's centre, unturned.
  const down = cap / 2 - ((lines.length - 1) * step) / 2
  const r = num(p, "rotation", 0)
  const cx = num(p, "cx", 0)
  const cy = num(p, "cy", 0)
  // (0, down) turned clockwise by r on the page.
  const ax = cx - Math.sin(r) * down
  const ay = cy + Math.cos(r) * down
  return new Text({
    content: lines.join("\n"),
    size: em,
    tint: WHITE,
    ...(lines.length > 1 ? { lineHeight: TEXT_LINE_STEP_EM } : {}),
    x: ax,
    y: -ay,
    b: -r,
  })
}

const textFootprint = (p: Record<string, unknown>): { w: number; h: number } => {
  const cap = Math.max(1, num(p, "size", 60))
  const lines = textLines(p)
  const em = cap / textBandEm(lines.join("\n"))
  const longest = Math.max(1, ...lines.map((l) => l.length))
  return { w: longest * TEXT_ADVANCE_EM * em, h: cap + (lines.length - 1) * em * TEXT_LINE_STEP_EM }
}

// -- the vocabulary -----------------------------------------------------------

const ANGLE = "radians, page angle: 0 = +x (right), increasing CLOCKWISE on the page (y is down)"

export const VOCABULARY: VocabEntry[] = [
  {
    id: "circle",
    name: "Circle",
    blurb: "A single circle.",
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
    blurb: "Four equal sides, four corners.",
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
    blurb: "An equilateral triangle.",
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
    holon: "FoldableCube",
    blurb: "A wireframe cube, turnable in 3D.",
    description:
      "A 3D wireframe cube — a square with a second offset square and connecting edges, or any drawn box in perspective. A flat square with no depth is `square`, not `cube`.",
    params: {
      cx: { type: "number", role: "x", description: "centre x, page units" },
      cy: { type: "number", role: "y", description: "centre y, page units" },
      size: { type: "number", role: "length", description: "edge length, page units (roughly the front face's side)" },
      h: { type: "number", role: "yaw", default: 0.6, description: "heading (turn about the vertical axis), radians; ~0.6 shows a side face" },
      p: { type: "number", role: "pitch", default: 0.4, description: "pitch (tilt about the horizontal axis), radians; ~0.4 shows the top face" },
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
    id: "cylinder",
    name: "Cylinder",
    holon: "Cylinder",
    blurb: "Born of a square and a circle.",
    description:
      "A 3D wireframe cylinder: two ellipses (the caps) joined by two straight parallel sides — or a rectangle with an elliptical cap at each end, or a tall box whose top and bottom are ovals. A flat rectangle with no curved caps is not a cylinder; a single ellipse is a circle.",
    params: {
      cx: { type: "number", role: "x", description: "centre x (midway between the two caps' centres), page units" },
      cy: { type: "number", role: "y", description: "centre y (midway between the two caps' centres), page units" },
      radius: { type: "number", role: "length", description: "cap radius: HALF the caps' long (widest) axis, page units" },
      height: { type: "number", role: "length", description: "axis length: distance between the two caps' centres, page units" },
      h: { type: "number", role: "yaw", default: 0, description: "heading (turn about the axis), radians; 0 for any drawing (a cylinder looks the same turned about its axis)" },
      p: {
        type: "number",
        role: "pitch",
        default: 0.4,
        description: "pitch, radians: how far the top cap tips toward the viewer — the caps' short/long axis ratio is sin(p) (a thin oval ≈ 0.25, a round-ish one ≈ 0.8; 0 = caps seen edge-on as lines)",
      },
      b: { type: "number", role: "angle", description: `${ANGLE}; the lean of the axis: 0 = upright (caps above each other), ±π/2 = lying on its side` },
    },
    build: (p) => {
      const radius = Math.max(1, num(p, "radius", 60))
      const height = Math.max(1, num(p, "height", 160))
      // The cylinder a rectangle and a circle are both views of — its
      // radius and height read off them (Cylinder.of), never copied.
      const cylinder = Cylinder.of(new Rectangle({ width: 2 * radius, height }), new Circle({ radius }), { tint: WHITE })
      return new Group({
        members: [cylinder],
        x: num(p, "cx", 0),
        y: -num(p, "cy", 0),
        h: num(p, "h", 0),
        p: num(p, "p", 0.4),
        b: -num(p, "b", 0),
      })
    },
  },
  {
    id: "flowerOfLife",
    name: "Flower of Life",
    blurb: "Equal circles on a hexagonal lattice.",
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
    holon: "MindVirus",
    blurb: "The eye and the cube, swimming on its cable.",
    description:
      "A MindVirus: a creature whose body is a cube (often drawn as an open box / cup, its walls flaring like a jellyfish bell) with an eye on its front face, trailing a long wavy CABLE (tail) behind it. Any box/cube shape with a squiggly line trailing off one side = this. The creature swims AWAY from its cable: the heading points from where the cable attaches through the body.",
    params: {
      x: { type: "number", role: "x", description: "body (cube) centre x, page units" },
      y: { type: "number", role: "y", description: "body (cube) centre y, page units" },
      size: { type: "number", role: "length", description: "cube edge length, page units" },
      heading: { type: "number", role: "angle", description: `${ANGLE}; the direction the creature faces/swims (away from the cable)` },
      tilt: {
        type: "number",
        role: "tilt",
        default: 0,
        description: "radians, how far the heading lifts out of the page toward the viewer; 0 for any drawing (a flat page shows no tilt)",
      },
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
    holon: "Eye",
    blurb: "The watcher of video-01, in profile.",
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
    holon: "Figure",
    blurb: "A person, as a stick figure.",
    description: "A person: a stick figure (round head, body line, arms, legs).",
    params: {
      cx: { type: "number", role: "x", description: "centre x (the figure's middle), page units" },
      cy: { type: "number", role: "y", description: "centre y (halfway between crown and feet), page units" },
      height: { type: "number", role: "length", description: "crown-to-feet height, page units" },
    },
    build: (p) =>
      new Figure({ x: num(p, "cx", 0), y: -num(p, "cy", 0), height: Math.max(1, num(p, "height", 120)) }),
  },
  {
    id: "text",
    name: "Text",
    blurb: "Handwriting, typeset — it writes itself on.",
    description:
      "WORDS — handwriting that reads as text and is the whole selection (no drawn shape it labels). It becomes typeset DreamTalk text that writes itself on. The input is the string; the symbol is the act of writing it.",
    params: {
      content: {
        type: "string",
        role: "content",
        description:
          "the words EXACTLY as handwritten — same spelling (even if misspelt), same upper/lower case, no added or dropped punctuation; a new written line is \\n",
      },
      cx: { type: "number", role: "x", description: "centre x of the written words (middle of their left..right extent), page units" },
      cy: {
        type: "number",
        role: "y",
        description: "centre y of the CAP BAND: halfway between the baseline the letters sit on and the top of the capitals — or, if no capital was written, of the tall letters (d, l, k) — ignoring descenders like g, y, p; for several lines, the middle of the whole block",
      },
      size: {
        type: "number",
        role: "length",
        description: "cap height: baseline to the top of the CAPITALS as written (D, T, H…); if no capital was written, to the top of the tall letters (d, l, k) instead. Page units — NOT the full bbox height when descenders hang below",
      },
      rotation: { type: "number", role: "angle", description: `${ANGLE}; the baseline's direction. 0 = written level, left to right` },
    },
    build: buildText,
    footprint: textFootprint,
  },
  {
    id: "regenaissance",
    name: "Regenaissance",
    holon: "Regenaissance",
    blurb: "The noosphere stacked over the biosphere.",
    description:
      "The Regenaissance: TWO EQUAL CIRCLES STACKED VERTICALLY and overlapping, so an almond / eye shape (a vesica) forms where they meet; the TOP circle is a globe drawn as a LATTICE (crossing curved lines — meridians, parallels, a web or grid); the BOTTOM circle is the EARTH (wobbly continent outlines inside it); in the eye sits a small circle holding an S-curve with a small square and a dot (yin-yang-like); and ONE BIG OUTER RING wraps the whole stack. Hand-drawn, every circle is usually MANY overlapping rough loops traced round and round — a bundle of loops is ONE circle, and the outermost bundle is the outer ring. Any two stacked overlapping globes inside a ring = this, even if some parts are rough or missing.",
    params: {
      cx: { type: "number", role: "x", description: "centre x of the OUTER RING (≈ the middle of the eye), page units" },
      cy: { type: "number", role: "y", description: "centre y of the OUTER RING (≈ the middle of the eye), page units" },
      r: {
        type: "number",
        role: "length",
        description: "radius of the OUTER RING, page units — the mean distance of the outermost loops from the centre (use the circle fits of the biggest strokes)",
      },
      rotation: { type: "number", role: "angle", description: `${ANGLE}; 0 = upright (lattice globe on top, Earth below)` },
    },
    build: (p) => {
      const regen = new Regenaissance({ radius: Math.max(1, num(p, "r", 300)) })
      return new Group({ members: [regen], x: num(p, "cx", 0), y: -num(p, "cy", 0), b: -num(p, "rotation", 0) })
    },
  },
  {
    id: "sMark",
    name: "S-mark",
    holon: "SMark",
    blurb: "The S with its dot and square.",
    description:
      "The S-mark ALONE (no globes around it): an S-shaped curve — two half-circle bowls, like the dividing line of a yin-yang — with a small DOT in its upper bowl and a small SQUARE in its lower bowl. Usually small, often traced over several times. It may sit inside its own drawn circle (then `framed` is yes). If it is the centre of two stacked globes, the whole drawing is `regenaissance`, not this.",
    params: {
      cx: { type: "number", role: "x", description: "centre x of the S (where its two bowls meet), page units" },
      cy: { type: "number", role: "y", description: "centre y of the S, page units" },
      size: { type: "number", role: "length", description: "height of the S from its top bowl to its bottom bowl (its bbox height, dot and square included), page units" },
      rotation: { type: "number", role: "angle", description: `${ANGLE}; 0 = upright like the letter S (dot upper-right, square lower-left)` },
      framed: { type: "enum", options: ["no", "yes"], description: "yes if the S is drawn inside its own circle" },
    },
    build: (p) => {
      // The mark's radius R is its frame circle's; the S band's bbox is
      // 1.378·R tall (SMark.ts: bowl top at 0.38·R/√2 + 0.38·R + 0.04·R).
      const R = Math.max(1, num(p, "size", 100)) / SMARK_HEIGHT
      const members: Holon[] = [new SMark({ radius: R })]
      if (p.framed === "yes") members.push(new Circle({ radius: R, tint: WHITE }))
      return new Group({ members, x: num(p, "cx", 0), y: -num(p, "cy", 0), b: -num(p, "rotation", 0) })
    },
  },
]

/** The S band's bbox height in units of the mark's radius (SMark.ts). */
const SMARK_HEIGHT = 2 * (SMARK.offset * Math.SQRT1_2 + SMARK.offset + SMARK.band / 2)

const BY_ID = new Map(VOCABULARY.map((e) => [e.id, e]))

/**
 * What a board imports until it says otherwise — the vocabulary every
 * board had before imports were a board's own (board.ts `vocabulary`).
 */
export const DEFAULT_IMPORTS: readonly string[] = [
  "circle",
  "square",
  "triangle",
  "cube",
  "flowerOfLife",
  "mindVirus",
  "eye",
  "figure",
  "text",
  "regenaissance",
  "sMark",
  "cylinder",
]

/** A hand-written entry, else the catalogue's generic one (catalogue.ts). */
export const vocabById = (id: string): VocabEntry | undefined => BY_ID.get(id) ?? genericById(id)

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
  content: "content",
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
  // The tumble first — it turns the symbol about its own centre, which
  // the page transform then carries along like everything else.
  const base = xf.tumble && entry ? tumbleParams(entry, s.params, xf.tumble) : s.params
  const params: Record<string, unknown> = { ...base }
  const keys = Object.keys(base)
  const xKey = keys.find((k) => roleOf(entry, k) === "x")
  const yKey = keys.find((k) => roleOf(entry, k) === "y")
  if (xKey && yKey) {
    const x = Number(base[xKey])
    const y = Number(base[yKey])
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const q = xfPoint(xf, { x, y })
      params[xKey] = q.x
      params[yKey] = q.y
    }
  }
  for (const k of keys) {
    const v = base[k]
    const role = roleOf(entry, k)
    if (role === "length" && typeof v === "number" && Number.isFinite(v)) params[k] = v * xf.scale
    else if (role === "angle" && typeof v === "number" && Number.isFinite(v))
      params[k] = xf.rotate === 0 ? v : wrapAngle(v + xf.rotate)
    else if ((role === "points" || role === undefined) && Array.isArray(v) && v.length > 0 && v.every(isPointLike))
      params[k] = v.map((e) => {
        // A tumbled path's depth scales with the page (the pivot is on
        // the page, z = 0) and no in-plane turn touches it.
        if (Array.isArray(e)) {
          const q = xfPoint(xf, { x: e[0] as number, y: e[1] as number })
          return typeof e[2] === "number" ? [q.x, q.y, e[2] * xf.scale] : [q.x, q.y]
        }
        const pt = e as { x: number; y: number; z?: unknown }
        const q = { ...pt, ...xfPoint(xf, pt) }
        if (typeof pt.z === "number") q.z = pt.z * xf.scale
        return q
      })
  }
  return { ...s, params }
}

/** Does this symbol have a 3D orientation a tumble can turn? */
export const canTumble = (s: PlacedSymbol): boolean => {
  const entry = vocabById(s.symbol)
  return !!entry && Object.values(entry.params).some((p) => p.role === "yaw" || p.role === "pitch" || p.role === "tilt")
}

/** The page point a tumble turns a symbol about: its x/y params. */
export const tumbleCentre = (s: PlacedSymbol): { x: number; y: number } | undefined => {
  const entry = vocabById(s.symbol)
  if (!entry) return undefined
  const x = Number(s.params[keyOfRole(entry, "x") ?? ""])
  const y = Number(s.params[keyOfRole(entry, "y") ?? ""])
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined
}

const keyOfRole = (entry: VocabEntry, role: ParamRole): string | undefined =>
  Object.keys(entry.params).find((k) => entry.params[k]!.role === role)

/** A direction symbol's built body frame: headingFor's h/p (MindVirus.ts)
 *  — local +z on `f`, no roll — as a matrix. */
const directionFrame = (f: { x: number; y: number; z: number }): Mat3 =>
  eulerToMat3(Math.atan2(f.x, Math.hypot(f.y, f.z)), Math.atan2(-f.y, f.z), 0)

/**
 * The rotation a symbol's body ACTUALLY undergoes when tumbled by `m` —
 * what the live preview turns its pivot by, and what its own paths turn
 * by, so preview and commit are one picture.
 *
 * For an Euler symbol (a cube) that is `m` itself: h/p/b carry any
 * orientation. A DIRECTION symbol (a MindVirus) has no roll about its
 * heading — it is built heading-first, roll-free — so a trackball turn
 * that rolls it cannot be committed; its body turns by the roll-free
 * rotation carrying the old built frame onto the new one instead. Same
 * new heading, and nothing on screen the params cannot say.
 */
export const tumbleTurn = (entry: VocabEntry, given: Record<string, unknown>, m: Mat3): Mat3 => {
  const tilt = keyOfRole(entry, "tilt")
  const yaw = keyOfRole(entry, "yaw")
  const pitch = keyOfRole(entry, "pitch")
  if (!tilt || yaw || pitch) return m
  const read = (k: string | undefined): number => {
    if (!k) return 0
    const v = Number(given[k])
    return Number.isFinite(v) ? v : (entry.params[k]!.default ?? 0)
  }
  const a = read(keyOfRole(entry, "angle"))
  const tl = read(tilt)
  const f = { x: Math.cos(a) * Math.cos(tl), y: -Math.sin(a) * Math.cos(tl), z: Math.sin(tl) }
  const from = directionFrame(f)
  const to = directionFrame(mat3Apply(m, f))
  // to · fromᵀ (a rotation's inverse is its transpose).
  const fromT = [from[0], from[3], from[6], from[1], from[4], from[7], from[2], from[5], from[8]] as const
  return mat3Mul(to, fromT)
}

/**
 * A symbol's orientation params turned by a scene-axes rotation (xform.ts
 * Mat3), read back into the SAME params — Euler entries (yaw/pitch, the
 * `angle` param as roll) through the renderer's own h/p/b composition,
 * direction entries (`angle` azimuth + tilt) by turning the direction.
 * Flat symbols come back untouched. Missing params start from their spec's
 * default, as `build` would.
 */
export const tumbleParams = (
  entry: VocabEntry,
  given: Record<string, unknown>,
  m: Parameters<typeof mat3Apply>[0],
): Record<string, unknown> => {
  if (isMat3Identity(m, 1e-12)) return given
  const read = (k: string | undefined): number => {
    if (!k) return 0
    const v = Number(given[k])
    return Number.isFinite(v) ? v : (entry.params[k]!.default ?? 0)
  }
  const yaw = keyOfRole(entry, "yaw")
  const pitch = keyOfRole(entry, "pitch")
  const tilt = keyOfRole(entry, "tilt")
  const angle = keyOfRole(entry, "angle")
  const out = { ...given }
  const turn = tumbleTurn(entry, given, m)
  if (yaw || pitch) {
    // The roll is a PAGE angle (clockwise); the holon's b is its negation.
    const e = mat3ToEuler(mat3Mul(m, eulerToMat3(read(yaw), read(pitch), -read(angle))))
    if (yaw) out[yaw] = e.h
    if (pitch) out[pitch] = e.p
    if (angle) out[angle] = wrapAngle(-e.b)
  } else if (tilt) {
    const a = read(angle)
    const tl = read(tilt)
    // Scene direction: page azimuth a (clockwise) is scene (cos a, −sin a).
    const v = mat3Apply(m, { x: Math.cos(a) * Math.cos(tl), y: -Math.sin(a) * Math.cos(tl), z: Math.sin(tl) })
    out[tilt] = Math.asin(Math.max(-1, Math.min(1, v.z)))
    // Pointing straight at the viewer, the azimuth is undefined: keep it.
    if (angle && Math.hypot(v.x, v.y) > 1e-9) out[angle] = Math.atan2(-v.y, v.x)
  }
  // A path the symbol owns (a MindVirus's cable) is part of the body: it
  // turns rigidly with it about the centre, by the turn the body actually
  // took, and the points that leave the page keep their depth as z.
  const cx = Number(given[keyOfRole(entry, "x") ?? ""])
  const cy = Number(given[keyOfRole(entry, "y") ?? ""])
  if (Number.isFinite(cx) && Number.isFinite(cy)) {
    for (const k of Object.keys(entry.params)) {
      if (entry.params[k]!.role !== "points" || !Array.isArray(given[k])) continue
      out[k] = (given[k] as unknown[]).map((e) => {
        const [q] = readPoints([e])
        if (!q) return e
        const v = mat3Apply(turn, { x: q.x - cx, y: -(q.y - cy), z: q.z ?? 0 })
        const x = cx + v.x
        const y = cy - v.y
        if (Array.isArray(e)) return [x, y, v.z]
        return { ...(e as object), x, y, z: v.z }
      })
    }
  }
  return out
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
 * frame (the host is 16:9; the 4:3 page sits in the middle of the wider
 * frame, and whoever shows it clips the sides).
 */
export const framePage = (dream: Dream, frame = { cx: PAGE_W / 2, cy: PAGE_H / 2, h: PAGE_H }): void => {
  const o = dream.observer
  o.x.defaultValue = o.x.value = frame.cx
  o.y.defaultValue = o.y.value = -frame.cy
  // The default vertical fov is 53.13°, tan(fov/2) = 0.5, so distance = height.
  const r = frame.h / (2 * Math.tan(o.fov.value / 2))
  o.radius.defaultValue = o.radius.value = r
}
