/**
 * Figure — THE person. One symbol, used wherever a DreamSong needs a human.
 *
 * Promoted out of the agent-arena demo (where it was `AgentFigure`) on
 * David's instruction, and the instruction is the whole point of this file:
 *
 *   "everywhere we use a person that is always the same symbol so that we can
 *    update it once and it will be beautiful and updated across all
 *    DreamSongs, that's the whole idea."
 *
 * THE DRAWING (redrawn 2026-10-13, on David's ask for a beautiful platonic
 * person). His whiteboards draw people as a circle floating over an arch,
 * and that is the idea kept: a round head with air beneath it; ONE arch — a
 * half-ellipse — that rises over the shoulders and falls into both arms,
 * hands hanging beside the hips; a spine from the arch's crown to the hip;
 * two legs in a quiet stance. Four kinds of line, no sticks for arms: the
 * posture is open and at rest. It reads as "someone" from 40 px to a
 * thousand, and every song that shows a person was redrawn with it — which
 * is the whole point of the single point of definition.
 *
 * WHAT THAT DEMANDS OF THIS FILE
 *
 * Callers must depend on the SYMBOL, never on its internals. `height` is the
 * whole figure, crown to foot, so a caller states a size rather than nesting
 * a transform; `tint` colours it. Nothing else about the construction is
 * contract. A future redraw may replace every line here — different
 * proportions, a real silhouette, an SVG import — and no scene should break,
 * because no scene should ever have reached inside.
 *
 * (The parts are still named and exposed, because a scene occasionally has a
 * genuine reason to address one — the whiteboard song glows a figure's head.
 * Reaching for them is a signal that the symbol is missing an ability, not a
 * licence to depend on the anatomy.)
 *
 * TWO FORMS, ONE PERSON (2026-10-18, the InterBrain film). Every person in
 * that film is a head-and-shoulders bust — Keynote's "Head with Shoulders"
 * icon, David's 2024 `HeadWithShoulders` DreamNode — and the rule is one
 * person symbol, so the bust is a FORM of this one (abilities over separate
 * classes), not a second class. `form` is a number: 0 the whole body (the
 * default, every existing scene untouched), 1 the bust, and between them the
 * arch RISES — its two halves, which already start at the crown of the
 * shoulders and fall outward, slide up to become the head-and-shoulders
 * outline while the floating head, the spine and the legs fade into it. One
 * outline drawn crown-outward in both forms, so Create draws the bust the way
 * it draws the body.
 *
 * The bust in the same platonic hand: a round head, a neck, and a cubic
 * shoulder sweep — no ears, no jaw — fitted to the PL02 deck's own bezier of
 * the icon (`Head with Shoulders_826`, vocabulary/Slides/assets/pl02/
 * slide09.ts), which is the film's bust (f7021: width/height 1.17 there vs
 * 1.15 in the deck; head 0.50 of the shoulders' breadth vs 0.48). `height`
 * stays the whole symbol in each form: crown to feet, or crown to the
 * shoulders' ends.
 *
 * `opaque` gives the person a black silhouette under its ink — the film's
 * busts blot out the cube drawn behind the head (f7021) — washed inside the
 * outline, so whatever is attached BEFORE the figure is hidden by it.
 *
 * THE PROFILE (2026-10-18, SandTalk). Where two people talk across a fire
 * the film turns the bust side-on (f5941, f8656): Keynote's "Head" icon,
 * which PL02's deck carries on its own SandTalk slide (`Head_652`, slide 7)
 * and which this file reads from the generated deck module — the one
 * measured outline, never copied. It is the same person seen from the side,
 * so it is a param of the bust, not a third symbol: `profile` −1 … +1 turns
 * the bust's two halves onto the profile's (the back of the head and the
 * face, both from the crown down), +1 facing +x, −1 facing −x, 0 the front.
 * `height` stays crown to the bottom of the outline.
 *
 * ONE STROKE (2026-10-19, perf). The ink is one `Polylines` — the two arch
 * halves, the head, the spine and the legs are its loops — so a person is
 * one mesh (and one echo cloud when ghosted), not six. The head, spine and
 * legs fade with the form through their loops' own opacity; `creation`
 * draws every loop on at once, each as its own line would (`penPerLoop`).
 * The loops by name: `limbs`.
 */

import { Group, Line, Shape, Stroke, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { Polylines, deriveLoops } from "../../src/parts/polylines"
import { BLACK, RED } from "../../src/constants"
import { bipolar, color, completion, derive, length } from "../../src/params"
import { slide07 } from "../Slides/assets/pl02/slide07"
import { presence } from "../../src/certainty"
import { lerp } from "../../src/math"
import { axis, type StateSpace } from "../../src/automaton"

/**
 * The proportions — the whole person in a handful of ratios of its height
 * h, so the symbol is one idea at every size.
 *
 *   HEAD     the head's diameter: ~5½ heads tall, a person rather than an
 *            athlete — readable as "someone" at 40 px.
 *   GAP      air between head and shoulders: the head floats, the way the
 *            whiteboard's own people are drawn (a circle over an arch).
 *   ARCH     the shoulders-and-arms arch: one half-ellipse that rises over
 *            the shoulders and falls into both arms — ARCH_W its half-width
 *            (the shoulders' breadth), ARCH_H its height (the arms' length);
 *            SWEEP carries the hands a little past the ellipse's waist, so
 *            they hang beside the hips. One curve, not four sticks — the
 *            posture is open.
 *   HIP      where the spine ends and the legs begin, measured down from
 *            the arch's crown.
 *   STANCE   the feet's half-spread.
 */
const HEAD = 0.19
const GAP = 0.035
const ARCH_W = 0.15
const ARCH_H = 0.25
const SWEEP = (12 * Math.PI) / 180
const HIP = 0.36
const STANCE = 0.12

/** The head's outline segments — the host's own for a Circle (three-host STROKE_SEGMENTS). */
const HEAD_SEGMENTS = 128

/** Samples along each half of the arch — smooth at any size the symbol is drawn. */
const ARC_SAMPLES = 24

/**
 * The bust (form 1), in units of its height h, measured DOWN from the crown —
 * fitted to the PL02 "Head with Shoulders" bezier (its 38 points, normalised
 * to its own height; the shoulder cubic's rms error 0.0045·h).
 *
 *   BUST_HEAD       the head's radius: 0.6·h across, a touch past the icon's
 *                   breadth at the ears (0.556) — a round head has to carry
 *                   the jaw's mass too (the icon's head runs 0.63 deep).
 *   BUST_JAW        the head's circle hands over to the jaw where it is this
 *                   far from the axis; the jaw runs straight in to the neck
 *                   at depth BUST_CHIN (icon: the jaw's corner, 0.629) — so
 *                   the round head tapers into the neck as the icon's does,
 *                   rather than sitting on it like a ball on a stick.
 *   BUST_NECK       the neck's half-width (icon: 0.157 at the jaw's corner).
 *   BUST_NECK_BASE  where the neck meets the shoulders' sweep (icon: the
 *                   neck stands straight to ≈ 0.70).
 *   BUST_SHOULDER   the half-breadth at the shoulders' ends (icon: 0.577),
 *                   reached at depth 1 — the bottom of the symbol.
 *   BUST_SWEEP      the shoulder cubic's two inner control points (|x|,
 *                   depth): leaving the neck straight down, arriving at the
 *                   shoulder's end rolled steeply over.
 */
const BUST_HEAD = 0.3
const BUST_JAW = 0.21
const BUST_CHIN = 0.63
const BUST_NECK = 0.16
const BUST_NECK_BASE = 0.7
const BUST_SHOULDER = 0.577
const BUST_SWEEP: readonly [readonly [number, number], readonly [number, number]] = [
  [0.16, 0.91],
  [0.51, 0.77],
]

/** Samples along each half while the arch and the bust morph — and in the bust. */
const MORPH_SAMPLES = 72

type P2 = { x: number; y: number }

/** Resample an open polyline to n points evenly spaced by arc length. */
const resample = (pts: readonly P2[], n: number): P2[] => {
  const d = [0]
  for (let i = 1; i < pts.length; i++)
    d.push(d[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y))
  const total = d[d.length - 1]!
  const out: P2[] = []
  let j = 0
  for (let k = 0; k < n; k++) {
    const s = (total * k) / (n - 1)
    while (j < pts.length - 2 && d[j + 1]! < s) j++
    const span = d[j + 1]! - d[j]!
    const u = span > 0 ? (s - d[j]!) / span : 0
    out.push({ x: lerp(pts[j]!.x, pts[j + 1]!.x, u), y: lerp(pts[j]!.y, pts[j + 1]!.y, u) })
  }
  return out
}

/**
 * The bust's LEFT half for a symbol of height h, built about its middle
 * (crown +h/2, shoulders' ends −h/2): from the crown round the head, down
 * the neck, out over the shoulder — n points even in arc length. The right
 * half is its mirror. Exported for the test, which pins it against the
 * construction (not against copied numbers).
 */
export const bustHalf = (h: number, n = MORPH_SAMPLES): P2[] => {
  const top = h / 2
  const r = BUST_HEAD * h
  const cy = top - r
  const nx = BUST_NECK * h
  const jx = BUST_JAW * h
  // The jaw leaves the head where the circle is jx from the axis, below its centre.
  const end = Math.atan2(-Math.sqrt(r * r - jx * jx), -jx) + 2 * Math.PI
  const dense: P2[] = []
  for (let i = 0; i <= 96; i++) {
    const a = Math.PI / 2 + (end - Math.PI / 2) * (i / 96)
    dense.push({ x: r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  dense.push({ x: -nx, y: top - BUST_CHIN * h })
  const p0 = { x: -nx, y: top - BUST_NECK_BASE * h }
  const [c1, c2] = BUST_SWEEP
  const p1 = { x: -c1[0] * h, y: top - c1[1] * h }
  const p2 = { x: -c2[0] * h, y: top - c2[1] * h }
  const p3 = { x: -BUST_SHOULDER * h, y: -top }
  for (let i = 0; i <= 96; i++) {
    const t = i / 96
    const a = (1 - t) ** 3
    const b = 3 * (1 - t) ** 2 * t
    const c = 3 * (1 - t) * t * t
    const d = t ** 3
    dense.push({
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    })
  }
  return resample(dense, n)
}

/**
 * The profile's two halves for a symbol of height h, facing +x, built about
 * its middle (crown +h/2, the outline's bottom −h/2), x measured from the
 * crown: `back` from the crown round the back of the head down the nape,
 * `face` from the crown over the brow, nose, lips and chin down the throat —
 * n points each, even in arc length. Read from PL02's `Head_652` (slide 7),
 * a closed path that starts at the crown, runs back-first and closes along
 * the bottom; the bottom edge is the silhouette's, not ink.
 */
export const profileHalves = (h: number, n = MORPH_SAMPLES): { back: P2[]; face: P2[] } => {
  const raw = slide07.shapes.find((s) => s.icon === "Head_652")!.subpaths[0]!
  const pts: P2[] = []
  for (let i = 0; i < raw.length; i += 2) pts.push({ x: raw[i]!, y: raw[i + 1]! })
  const ys = pts.map((p) => p.y)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  const crown = pts[0]!
  const k = h / (bottom - top)
  const norm = (p: P2): P2 => ({ x: (p.x - crown.x) * k, y: h / 2 - (p.y - top) * k })
  const firstBottom = ys.findIndex((y) => y === bottom)
  const lastBottom = ys.lastIndexOf(bottom)
  const back = pts.slice(0, firstBottom + 1).map(norm)
  const face = pts.slice(lastBottom).reverse().map(norm)
  return { back: resample(back, n), face: resample(face, n) }
}

/**
 * A layer of the figure that one number fades as a whole (certainty.ts
 * `presence`, inherited by every leaf) — so the form can dissolve the body's
 * head, spine and legs without claiming the opacities FadeIn/FadeOut animate.
 * Exported because a whole built on the person (Mind) needs the same thing.
 */
export class Layer extends Group {
  presence = presence(1)
}

export class Figure extends Stroke {
  /**
   * Red by default — the whiteboard's agent colour, so the song this came
   * from is untouched. But every part now draws in `this.tint` rather than a
   * hardcoded RED, because a shared symbol that cannot be recoloured is not
   * shared: the infinite-patience song needs the same person blue, turning
   * red as it approaches the singularity.
   */
  override tint = color(RED)
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  height = length(120)

  /**
   * 0 the whole body (the default) … 1 the head-and-shoulders bust. Between,
   * the arch rises into the bust's outline while the body's head, spine and
   * legs fade into it — a morph that scrubs. Read once per frame; the
   * construction itself (height) is fixed at compose.
   */
  form = completion(0)

  /**
   * 0 the person is ink only (the default) … 1 a black silhouette under the
   * ink blots out what was drawn before it (the cube behind the film's busts).
   */
  opaque = completion(0)

  /**
   * The bust turned side-on (SandTalk, f8656): 0 the front (the default),
   * +1 the profile facing +x, −1 facing −x; between, the outline slides
   * point for point. Read once per frame; seen in full at `form` 1.
   */
  profile = bipolar(0)

  /** Walkable (src/automaton.ts): the two forms of the one person. */
  override stateSpace(): StateSpace | undefined {
    if (this.form.isBound) return undefined
    return { axes: [axis("form", this, { body: { form: 0 }, bust: { form: 1 } }, { duration: 1.4, handles: [this] })] }
  }

  /** The black wash inside the outline (`opaque`). */
  silhouette!: Shape
  /** The whole ink: one stroke whose loops are the limbs (`limbs`). */
  ink!: Polylines
  /** The body's head, spine and legs' opacity — 1 the body, 0 gone into the bust. */
  bodyPresence!: () => number

  /** The ink's loops by name (local points, this frame's form). */
  get limbs(): Record<"armLeft" | "armRight" | "head" | "spine" | "legLeft" | "legRight", Vec3Like[]> {
    void this.parts
    const [armLeft, armRight, head, spine, legLeft, legRight] = this.ink.loops as Vec3Like[][]
    return { armLeft: armLeft!, armRight: armRight!, head: head!, spine: spine!, legLeft: legLeft!, legRight: legRight! }
  }

  protected override compose(): void {
    const h = this.height.value
    const headR = (h * HEAD) / 2
    // Built about its own middle: crown at +h/2, feet at −h/2, so placing
    // the figure is placing its centre.
    const crown = h / 2
    const headCy = crown - headR
    const shoulderTop = headCy - headR - h * GAP
    const rx = h * ARCH_W
    const ry = h * ARCH_H
    const archCy = shoulderTop - ry
    const hip = shoulderTop - h * HIP
    const foot = -h / 2
    const stroke = this.stroke

    const form = this.form
    // The bust's two halves, mirrored — computed once (h is fixed at compose).
    const bustLeft = bustHalf(h)

    // The arch, as two halves from its crown out and down to each hand —
    // so the arms draw on from the shoulders, symmetrically. At form 0 the
    // polyline is exactly the original 25-point arch (no scene changes);
    // past it, the arch (sampled finer) slides point for point onto the
    // bust's half — the same crown-outward walk, risen.
    const archHalf = (side: -1 | 1, samples: number): P2[] => {
      const pts: P2[] = []
      const a0 = Math.PI / 2
      const a1 = side > 0 ? -SWEEP : Math.PI + SWEEP
      for (let i = 0; i <= samples; i++) {
        const a = a0 + (a1 - a0) * (i / samples)
        pts.push({ x: rx * Math.cos(a), y: archCy + ry * Math.sin(a) })
      }
      return pts
    }
    // The profile's halves: the side the face looks to takes the face.
    const prof = profileHalves(h)
    const turned = this.profile
    const halfAt = (side: -1 | 1, f: number, q = turned.value): Vec3Like[] => {
      if (f <= 0) return archHalf(side, ARC_SAMPLES).map((p) => ({ x: p.x, y: p.y, z: 0 }))
      const arch = archHalf(side, MORPH_SAMPLES - 1)
      const facing = q < 0 ? -1 : 1
      const pr = side === facing ? prof.face : prof.back
      const u = Math.abs(q)
      return arch.map((p, i) => {
        const b = bustLeft[i]!
        const tx = lerp(side * -b.x, facing * pr[i]!.x, u)
        const ty = lerp(b.y, pr[i]!.y, u)
        return { x: lerp(p.x, tx, f), y: lerp(p.y, ty, f), z: 0 }
      })
    }
    // The silhouette first: attach order is composite order, so the ink
    // draws over it and it covers whatever came before the figure.
    const outline = new Line({ tint: BLACK })
    derivePoints(outline, () => [form.value, turned.value], () => {
      const left = halfAt(-1, form.value)
      const right = halfAt(1, form.value)
      return [...left.slice().reverse(), ...right.slice(1), { ...left[left.length - 1]! }]
    })
    this.silhouette = this.add(new Shape({ tint: BLACK, fillOpacity: this.opaque.map((o) => o), outlines: [outline] }))

    // The ink: the two arch halves (crown outward), then the body's own
    // head, spine and legs — the head swells and drops onto the bust's head
    // as it fades, so it dissolves into the risen outline (the fade runs
    // ahead of the morph — (1 − form)² — so the legs are mostly gone by the
    // time the shoulders have risen).
    const bustR = BUST_HEAD * h
    const at = (x: number, y: number): Vec3Like => ({ x, y, z: 0 })
    const headLoop = (): Vec3Like[] => {
      const r = lerp(headR, bustR, form.value)
      const cy = lerp(headCy, crown - bustR, form.value)
      // The host's own circle: HEAD_SEGMENTS from angle 0, counter-clockwise.
      const pts: Vec3Like[] = []
      for (let i = 0; i <= HEAD_SEGMENTS; i++) {
        const a = (i / HEAD_SEGMENTS) * Math.PI * 2
        pts.push(at(Math.cos(a) * r, cy + Math.sin(a) * r))
      }
      return pts
    }
    const spine = [at(0, shoulderTop), at(0, hip)]
    // Legs from the hip, a quiet stance.
    const legLeft = [at(0, hip), at(-h * STANCE, foot)]
    const legRight = [at(0, hip), at(h * STANCE, foot)]
    this.bodyPresence = () => (1 - form.value) ** 2
    const alphas = new Float32Array(6)
    this.ink = this.add(
      new Polylines({
        tint: this.tint,
        stroke,
        penPerLoop: true,
        loopOpacity: () => {
          const b = this.bodyPresence()
          alphas[0] = 1
          alphas[1] = 1
          alphas[2] = alphas[3] = alphas[4] = alphas[5] = b
          return alphas
        },
      }),
    )
    deriveLoops(this.ink, () => [form.value, turned.value], () => [
      halfAt(-1, form.value),
      halfAt(1, form.value),
      headLoop(),
      spine,
      legLeft,
      legRight,
    ])
  }
}
