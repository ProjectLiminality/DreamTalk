/**
 * RealTalkWord — ass talk becoming real talk: the word ASSTALK in a cloud,
 * babble going out from its side, resolves into REALTALK standing on a
 * line. One number, `real` 0..1.
 *
 * THE IDEA. Ass talk is association and babble — words that drift apart,
 * hot air. Real talk is plain speech about what is: words that make things
 * come together. So the morph CONDENSES: the cloud lets go of its billows
 * and settles into the ground line the word stands on, the voice going out
 * at its side is drawn in, and of A-S-S the A is kept — it steps over into
 * its place in R-E-A-L — while the two S's, the curving letters, are
 * re-cut into the straight ones, R, E and L. TALK stays TALK; it only
 * makes room.
 *
 * COMPOSED, NEVER REDRAWN. The letters are `Word`s (the framework's
 * writing, src/geometry/glyphs.ts): A, TALK, SS, RE and L, each placed so
 * its glyphs sit exactly where the whole word's layout puts them. The
 * S's → R, E, L flight is the core correspondence (src/geometry/correspond:
 * `planMorphDetailed` once, `blendTravel` per frame — the same plan and
 * travel `MorphToWord` uses): the S's outlines are cut in reading order
 * into pieces that fly as bodies and bend into the new letters' outlines;
 * the R's counter grows in where it is. Fills hand over at the ends: the
 * S's fill fades before their outlines leave, R, E and L fill once their
 * outlines have landed.
 *
 * THE PHASES of `real` (FILL = 0.15):
 *
 *   [0, FILL]          the S's fill fades; the cloud starts to settle
 *   [FILL, 1 − FILL]   the pieces fly, the A steps over (a low arc), TALK
 *                      slides into the longer word's place
 *   [0, CLOUD]         the cloud's billows and height go to 0: it lies down
 *                      as the line under REALTALK
 *   [0, SPEECH]        the speech arcs draw back in
 *   [1 − FILL, 1]      R, E and L fill
 *
 * Laid in its XY plane, the cap height centred on the origin. Every
 * arrangement is symmetric: the cloud's billows are equal arcs on an
 * ellipse (a billow at each end of both axes), the speech arcs concentric about
 * its right tip.
 */

import { Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, derive, length } from "../../src/params"
import { BLUE, RED, type Color } from "../../src/constants"
import { toggle, type StateSpace } from "../../src/automaton"
import { flattenContour, type FontData } from "../../src/geometry/glyphs"
import { ARIMO } from "../../src/geometry/fonts/arimo"
import { blendTravel, planMorphDetailed, type MorphPlan } from "../../src/geometry/correspond"
import { Word } from "../Word/Word"

/** The construction, in units of the cap height H (or of `real`, for the phases). */
export const REALTALK = {
  /** The fills' handover at each end of `real`. */
  fill: 0.15,
  /** When the cloud has lain down, and when the speech is drawn in. */
  cloud: 0.75,
  speech: 0.35,
  /** The cloud: billows round an ellipse, its half-axes past the word's ink
   *  (a multiple of 4, so a billow crowns each end of both axes). */
  billows: 16,
  billow: 0.3,
  padX: 0.6,
  padY: 0.85,
  /** The ground line's distance below the baseline. */
  ground: 0.32,
  /** The speech: arcs about the cloud's right tip — their count, the first's
   *  radius and the step between them, and their half-span (radians). */
  waves: 3,
  waveGap: 0.35,
  waveStep: 0.32,
  waveSpan: 0.6,
  /** How high the A's step over the S's rises. */
  step: 0.55,
} as const

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (u: number) => u * u * (3 - 2 * u)
const phase = (v: number, a: number, b: number) => clamp01((v - a) / (b - a))
const mix = (a: Color, b: Color, k: number): Color => ({ r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k })

/** A word's glyphs laid out at size `size`, baseline y = 0, the first pen at x = 0: per character its contours and pen. */
export const layoutGlyphs = (text: string, font: FontData, size: number): { pen: number; contours: Vec3Like[][] }[] => {
  const k = size / font.unitsPerEm
  const tol = 0.004 * font.unitsPerEm
  const out: { pen: number; contours: Vec3Like[][] }[] = []
  let pen = 0
  for (const ch of text) {
    const g = font.glyphs[ch.codePointAt(0)!]
    out.push({
      pen: pen * k,
      contours: (g?.[1] ?? []).map((c) => flattenContour(c, tol).map((p) => ({ x: (p.x + pen) * k, y: p.y * k, z: 0 }))),
    })
    pen += g?.[0] ?? font.unitsPerEm * 0.28
  }
  return out
}

/** The ink box of some contours. */
const inkBox = (cs: readonly Vec3Like[][]) => {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const c of cs)
    for (const p of c) {
      x0 = Math.min(x0, p.x)
      x1 = Math.max(x1, p.x)
      y0 = Math.min(y0, p.y)
      y1 = Math.max(y1, p.y)
    }
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
}

export class RealTalkWord extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The em size of the letters; every proportion follows from it. */
  size = length(120)
  /** 0 ass talk (the cloud word) … 1 real talk (the grounded word). The walkable axis. */
  real = completion(0)
  /** The two inks: ass talk's and real talk's; everything runs between them. */
  assTint = color(BLUE)
  realTint = color(RED)
  /** The letters' outline pen, and the cloud's, in screen px. */
  stroke = length(1.5)
  lineStroke = length(2.4)

  /** Walkable (src/automaton.ts): ass talk ↔ real talk. */
  override stateSpace(): StateSpace | undefined {
    if (this.real.isBound) return undefined
    return { axes: [toggle("real", this.real, { off: ["ass", 0], on: ["real", 1], duration: 2.4, handles: [this] })] }
  }

  a!: Word
  talk!: Word
  ss!: Word
  re!: Word
  l!: Word
  cloud!: Line
  speech: Line[] = []
  pieces: Line[] = []

  protected override compose(): void {
    const size = this.size.value
    const ass = layoutGlyphs("ASSTALK", ARIMO, size)
    const real = layoutGlyphs("REALTALK", ARIMO, size)
    const H = inkBox(layoutGlyphs("T", ARIMO, size)[0]!.contours).y1
    // Each word centred on its own ink, the cap height on the origin.
    const shift = (glyphs: typeof ass) => {
      const b = inkBox(glyphs.flatMap((g) => g.contours))
      return { x: -b.cx, y: -H / 2, w: b.x1 - b.x0 }
    }
    const sA = shift(ass)
    const sR = shift(real)
    const at = (glyphs: typeof ass, s: { x: number; y: number }, from: number, to: number) =>
      glyphs.slice(from, to).flatMap((g) => g.contours.map((c) => c.map((p) => ({ x: p.x + s.x, y: p.y + s.y, z: 0 }))))
    // Where a Word of these glyphs must stand so its centred ink lands on them.
    const place = (cs: Vec3Like[][]) => {
      const b = inkBox(cs)
      return { x: b.cx, y: b.cy }
    }

    const u = () => this.real.value
    const F = REALTALK.fill
    const travel = () => smooth(phase(u(), F, 1 - F))
    const ink = derive(() => mix(this.assTint.value, this.realTint.value, smooth(u())))
    const word = (text: string, extra: Record<string, unknown>) =>
      new Word(text, { size, tint: ink, stroke: this.stroke, ...extra })

    // A: from ASSTALK's first slot to REALTALK's third, stepping over the S's.
    const a0 = place(at(ass, sA, 0, 1))
    const a1 = place(at(real, sR, 2, 3))
    this.a = this.add(
      word("A", {
        x: derive(() => a0.x + (a1.x - a0.x) * travel()),
        y: derive(() => a0.y + (a1.y - a0.y) * travel() + REALTALK.step * H * Math.sin(Math.PI * travel())),
      }),
    )
    // TALK: slides into the longer word's place.
    const t0 = place(at(ass, sA, 3, 7))
    const t1 = place(at(real, sR, 4, 8))
    this.talk = this.add(
      word("TALK", { x: derive(() => t0.x + (t1.x - t0.x) * travel()), y: t0.y }),
    )
    // The S's and R, E, L: whole letters at the ends, filled; pieces between.
    const ssCurves = at(ass, sA, 1, 3)
    const reCurves = at(real, sR, 0, 2)
    const lCurves = at(real, sR, 3, 4)
    const sp = place(ssCurves)
    const rp = place(reCurves)
    const lp = place(lCurves)
    const outgoing = derive(() => (u() < F ? 1 : 0))
    const incoming = derive(() => (u() > 1 - F ? 1 : 0))
    this.ss = this.add(
      word("SS", { x: sp.x, y: sp.y, opacity: outgoing, fillOpacity: derive(() => 1 - smooth(phase(u(), 0, F))) }),
    )
    this.re = this.add(
      word("RE", { x: rp.x, y: rp.y, opacity: incoming, fillOpacity: derive(() => smooth(phase(u(), 1 - F, 1))) }),
    )
    this.l = this.add(
      word("L", { x: lp.x, y: lp.y, opacity: incoming, fillOpacity: derive(() => smooth(phase(u(), 1 - F, 1))) }),
    )
    const close = (c: Vec3Like[]) => (c.length && (c[0]!.x !== c.at(-1)!.x || c[0]!.y !== c.at(-1)!.y) ? [...c, { ...c[0]! }] : c)
    const plan: MorphPlan = planMorphDetailed(ssCurves.map(close), [...reCurves, ...lCurves].map(close), {
      order: "sweep-angular",
      axis: { x: 1, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      snap: 0.04,
      minor: 0.25,
    })
    let memo: { t: number; curves: Vec3Like[][] } | undefined
    const frame = (): Vec3Like[][] => {
      const t = travel()
      if (!memo || memo.t !== t)
        memo = { t, curves: blendTravel(plan, t, { stagger: 0.35, axis: { x: 1, y: 0, z: 0 }, arc: 0.15 }) }
      return memo.curves
    }
    const flying = derive(() => (u() > 0 && u() < 1 ? 1 : 0))
    plan.pieces.forEach((_, i) => {
      const line = new Line({ tint: ink, stroke: this.stroke, opacity: flying })
      derivePoints(line, () => [travel()], () => frame()[i]!)
      this.pieces.push(this.add(line))
    })

    // The cloud: billows on an ellipse round ASSTALK, lying down into the
    // line under REALTALK.
    const lie = () => smooth(phase(u(), 0, REALTALK.cloud))
    const ax0 = sA.w / 2 + REALTALK.padX * H
    const ax1 = sR.w / 2
    const by0 = H / 2 + REALTALK.padY * H
    const groundY = -H / 2 - REALTALK.ground * H
    const N = REALTALK.billows
    const samples = N * 12
    this.cloud = this.add(new Line({ tint: ink, stroke: this.lineStroke }))
    derivePoints(
      this.cloud,
      () => [lie()],
      () => {
        const k = lie()
        const ax = ax0 + (ax1 - ax0) * k
        const by = by0 * (1 - k)
        const bh = REALTALK.billow * H * (1 - k)
        const cy = groundY * k
        return Array.from({ length: samples + 1 }, (_, i) => {
          const th = (i / samples) * 2 * Math.PI
          const bump = bh * Math.abs(Math.cos((N * th) / 2))
          return { x: (ax + bump) * Math.cos(th), y: cy + (by + bump) * Math.sin(th), z: 0 }
        })
      },
    )
    // The speech: arcs about the cloud's right tip, widening outward (a
    // voice going out), symmetric about the word's axis, drawn back in.
    const voiced = derive(() => 1 - smooth(phase(u(), 0, REALTALK.speech)))
    const tip = ax0 + REALTALK.billow * H
    for (let i = 0; i < REALTALK.waves; i++) {
      const r = (REALTALK.waveGap + i * REALTALK.waveStep) * H
      const span = REALTALK.waveSpan
      const steps = 24
      const wave = new Line({
        points: Array.from({ length: steps + 1 }, (_, k) => {
          const a = -span + (2 * span * k) / steps
          return { x: tip + r * Math.cos(a), y: r * Math.sin(a), z: 0 }
        }),
        tint: ink,
        stroke: this.lineStroke,
        creation: voiced,
      })
      this.speech.push(this.add(wave))
    }
  }
}
