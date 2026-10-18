/**
 * LossyChain — information rising from the ground truth to the humans who
 * decide, through a chain of stages, each arrow a lossy projection.
 *
 * A vertical chain: the stages stand at equal spacing on one axis (shop
 * floor at the bottom, the people who decide at the top), each a quiet
 * circle with its name beside it. A stream of particles rises through it
 * continuously (`time`, a clock). At every arrow some of them peel away and
 * fade — deterministically, not at random: each particle carries a fixed
 * golden-ratio fate, and an arrow with more losses on it takes more of
 * them, so the stream visibly thins as it rises.
 *
 * What is lost is named by five small glyphs on the arrows (`LossKind`):
 *
 *   a notCaptured          a hollow circle, slashed — never recorded
 *   b capturedDifferently  a fork — one fact, two meanings
 *   c wrongPlace           a square shifted off its point — recorded elsewhere
 *   d droppedInExtraction  a line cut — lost on the way between systems
 *   e timing               a clock — true, but too late (or too early)
 *
 * One stage carries a note: "schema harmony ≠ semantic harmony" — the
 * columns line up, the meanings need not.
 *
 * The WRITE PATH — decisions going back down to where the work happens —
 * runs beside the chain, descending. Mostly unbuilt: drawn as a dashed
 * ghost (certainty low); built, it is a solid line and particles run down
 * it.
 *
 * THE DEGREES OF FREEDOM (params; walkable via stateSpace()):
 *
 *   losses  0 → 1   hidden: the stream looks lossless; shown: the glyphs
 *                   appear and the lost particles peel away.
 *   note    0 → 1   the note at its stage.
 *   write   0 → 1   unbuilt (dashed ghost) → built (solid, flowing).
 *   time            seconds of flow — a clock, keeps running in free play.
 *
 * Plain data in (`LossyChainData`); the mock is a generic data stack.
 */

import { Circle, DottedLine, Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { completion, derive, length, scalar, type Readable } from "../../src/params"
import { BLUE, RED, WHITE, rgb, type Color } from "../../src/constants"
import type { Holon } from "../../src/holon"
import { certainty, presence } from "../../src/certainty"
import { together, type Anim, type Windowed } from "../../src/anim"
import { toggle, type StateSpace } from "../../src/automaton"
import { atArcLength, smooth, streamArc } from "../../src/geometry/flowmap"

/** The five ways information is lost on its way up. */
export type LossKind = "notCaptured" | "capturedDifferently" | "wrongPlace" | "droppedInExtraction" | "timing"

export const LOSS_KINDS: { kind: LossKind; letter: string; label: string }[] = [
  { kind: "notCaptured", letter: "a", label: "not captured" },
  { kind: "capturedDifferently", letter: "b", label: "captured differently" },
  { kind: "wrongPlace", letter: "c", label: "in the wrong place" },
  { kind: "droppedInExtraction", letter: "d", label: "dropped in extraction" },
  { kind: "timing", letter: "e", label: "timing" },
]

export interface LossyChainData {
  /** Bottom (the ground truth) to top (the humans who decide). `certainty` < 1: a known unknown, ghosted. */
  stages: { id: string; label: string; certainty?: number }[]
  /** A loss on arrow `at` (the arrow from stage `at` up to stage `at + 1`). */
  losses: { at: number; kind: LossKind }[]
  /** A quiet note beside one stage. */
  note?: { at: string; text: string }
  /** The name of the channel back down. */
  write?: string
}

export const MOCK_LOSSY_CHAIN: LossyChainData = {
  stages: [
    { id: "floor", label: "shop floor" },
    { id: "erp", label: "ERP" },
    { id: "extraction", label: "extraction" },
    { id: "warehouse", label: "warehouse" },
    { id: "pipeline", label: "pipeline" },
    { id: "semantic", label: "semantic layer", certainty: 0.55 },
    { id: "ai", label: "AI layer", certainty: 0.3 },
    { id: "humans", label: "humans" },
  ],
  losses: [
    { at: 0, kind: "notCaptured" },
    { at: 0, kind: "capturedDifferently" },
    { at: 1, kind: "wrongPlace" },
    { at: 1, kind: "timing" },
    { at: 2, kind: "droppedInExtraction" },
    { at: 2, kind: "timing" },
    { at: 3, kind: "capturedDifferently" },
    { at: 4, kind: "droppedInExtraction" },
    { at: 5, kind: "capturedDifferently" },
    { at: 6, kind: "timing" },
  ],
  note: { at: "warehouse", text: "schema harmony ≠ semantic harmony" },
  write: "write back",
}

// --- the pure logic of loss ---------------------------------------------------

/** 1/φ — the most irrational step: consecutive particles' fates spread as evenly as numbers can. */
const PHI_INV = (Math.sqrt(5) - 1) / 2

/** Particle j's fixed place in [0, 1): the golden-ratio sequence. */
export const fateSeed = (j: number): number => {
  const v = ((j + 1) * PHI_INV) % 1
  return v < 0 ? v + 1 : v
}

/** The fraction each arrow takes: its loss count × `rate`, capped so no arrow empties the stream. */
export const arrowDrops = (arrows: number, losses: { at: number }[], rate: number): number[] => {
  const out = new Array<number>(arrows).fill(0)
  for (const l of losses) if (l.at >= 0 && l.at < arrows) out[l.at]! += rate
  return out.map((p) => Math.min(0.6, Math.max(0, p)))
}

/**
 * The arrow at which particle j is lost, or −1 if it reaches the top. The
 * stream surviving arrow a is Π(1 − p_k) for k ≤ a; a particle whose seed
 * lies at or above that is gone there. Equidistributed seeds make each
 * arrow take its share — deterministic, never random.
 */
export const lossFate = (j: number, drops: number[]): number => {
  const u = fateSeed(j)
  let survive = 1
  for (let a = 0; a < drops.length; a++) {
    survive *= 1 - drops[a]!
    if (u >= survive) return a
  }
  return -1
}

// --- the glyphs ----------------------------------------------------------------

/** A glyph's strokes in a box of half-size 1 (scaled by the caller). */
export const glyphStrokes = (kind: LossKind): Vec3Like[][] => {
  const P = (x: number, y: number): Vec3Like => ({ x, y, z: 0 })
  const ring = (cx: number, cy: number, r: number, from = 0, to = 2 * Math.PI, n = 40): Vec3Like[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = from + ((to - from) * i) / n
      return P(cx + r * Math.cos(t), cy + r * Math.sin(t))
    })
  const k = Math.SQRT1_2 * 0.82
  switch (kind) {
    case "notCaptured": // ∅ — nothing where something was
      return [ring(0, 0, 0.82), [P(-k * 1.25, -k * 1.25), P(k * 1.25, k * 1.25)]]
    case "capturedDifferently": // a fork — one stem, two meanings
      return [[P(0, -0.95), P(0, -0.1)], [P(-0.75, 0.9), P(0, -0.1), P(0.75, 0.9)]]
    case "wrongPlace": { // a square shifted off the point where it belongs
      const s = 0.55
      const cx = 0.38
      const cy = 0.38
      return [
        [P(cx - s, cy - s), P(cx + s, cy - s), P(cx + s, cy + s), P(cx - s, cy + s), P(cx - s, cy - s)],
        ring(-0.62, -0.62, 0.12, 0, 2 * Math.PI, 16),
      ]
    }
    case "droppedInExtraction": // a line cut: a break in it, two strokes of the blade
      return [[P(-1, 0), P(-0.42, 0)], [P(0.42, 0), P(1, 0)], [P(-0.4, -0.65), P(-0.08, 0.65)], [P(0.08, -0.65), P(0.4, 0.65)]]
    case "timing": // a clock: three o'clock — late
      return [ring(0, 0, 0.88), [P(0, 0.58), P(0, 0), P(0.46, 0)]]
  }
}

// --- the holon -----------------------------------------------------------------

const GREY = rgb(150, 150, 150)

const mix = (a: Color, b: Color, u: number): Color => ({
  r: a.r + (b.r - a.r) * u,
  g: a.g + (b.g - a.g) * u,
  b: a.b + (b.b - a.b) * u,
})

/** A group that fades as one (presence inherits). */
class Fade extends Group {
  presence = presence(1)
}

/** One stage: its node and its name; its certainty is how known it is. */
export class Stage extends Group {
  certainty = certainty(1)
  stageId = ""
  node!: Circle
  name!: Text
}

/** The channel back down: certainty follows how built it is. */
export class WritePath extends Group {
  certainty = certainty(1)
}

export class LossyChain extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  data: LossyChainData = MOCK_LOSSY_CHAIN

  /** Distance between stages (construction). */
  gap = length(165)
  /** Radius of a stage's node. */
  node = length(20)
  /** Seconds of flow. */
  time = scalar(0)
  /** Particle speed, scene units per second. */
  speed = scalar(85)
  /** Arc length between particles. */
  spacing = length(25)
  /** The fraction one loss takes from the stream at its arrow. */
  rate = completion(0.13)
  /** 0 hidden (the stream looks lossless), 1 shown (glyphs, particles peel away). */
  losses = completion(1)
  /** The note at its stage. */
  note = completion(1)
  /** 0 the write path unbuilt (dashed ghost), 1 built (solid, flowing). */
  write = completion(0)

  stages: Stage[] = []
  arrows: Line[] = []
  glyphs: Line[] = []
  noteText?: Text
  writePath!: WritePath
  writeLine!: Line
  dashes!: DottedLine

  /** A stage by id. */
  stage(id: string): Stage {
    const s = this.stages.find((x) => x.stageId === id)
    if (!s) throw new Error(`LossyChain: no stage '${id}' (stages: ${this.stages.map((x) => x.stageId).join(", ")})`)
    return s
  }

  protected override compose(): void {
    const d = this.data
    const N = d.stages.length
    if (N < 2) throw new Error("LossyChain: needs at least two stages")
    const gap = this.gap.value
    const r = this.node.value
    const L = (N - 1) * gap
    const y0 = -L / 2
    const yOf = (i: number) => y0 + i * gap
    const size = gap * 0.2
    const parts: Holon[] = []
    const text = (content: string, tint: Color, x: number, y: number, opacity: Readable<number>, scale = 1, align: "left" | "center" = "left") =>
      new Text({ content, size: size * scale, tint, align, opacity, x, y: y - size * scale * 0.35 })

    // --- the arrows (drawn first, beneath the nodes) -----------------------
    for (let a = 0; a < N - 1; a++) {
      const arrow = new Line({
        points: [
          { x: 0, y: yOf(a) + r + 8, z: 0 },
          { x: 0, y: yOf(a + 1) - r - 14, z: 0 },
        ],
        stroke: 1.6,
        tint: GREY,
        arrowEnd: true,
      })
      this.arrows.push(arrow)
      parts.push(arrow)
    }
    // How much of the chain is drawn at height s along it (Create runs the pen up).
    const drawnAt = (s: number): number => {
      const a = Math.min(N - 2, Math.max(0, Math.floor(s / gap)))
      return this.arrows[a]!.creation.value
    }

    // --- the stages ------------------------------------------------------------
    d.stages.forEach((st, i) => {
      const node = new Circle({ radius: r, stroke: 2.2, tint: WHITE, drawStart: 0.25, y: yOf(i) })
      const name = text(st.label, WHITE, r + size * 0.9, yOf(i), derive(() => 0.9 * node.creation.value), 1)
      const stage = new Stage({ stageId: st.id, members: [node, name], certainty: st.certainty ?? 1 })
      stage.node = node
      stage.name = name
      this.stages.push(stage)
      parts.push(stage)
      if (d.note && d.note.at === st.id) {
        this.noteText = text(d.note.text, GREY, r + size * 0.9, yOf(i) - size * 1.25, derive(() => this.note.value * node.creation.value), 0.72)
        parts.push(this.noteText)
      }
    })
    if (d.note && !this.noteText) throw new Error(`LossyChain: note names an unknown stage '${d.note.at}'`)

    // --- the loss glyphs, left of their arrows -----------------------------
    const G = gap * 0.12 // a glyph's half-size
    const glyphX = (q: number) => -(r + G * 2.4 + q * G * 2.9)
    const perArrow = new Map<number, number>()
    for (const l of d.losses) {
      if (l.at < 0 || l.at >= N - 1) throw new Error(`LossyChain: loss on arrow ${l.at}, but there are ${N - 1} arrows`)
      const q = perArrow.get(l.at) ?? 0
      perArrow.set(l.at, q + 1)
      const cx = glyphX(q)
      const cy = (yOf(l.at) + yOf(l.at + 1)) / 2
      const lines = glyphStrokes(l.kind).map((pts) => {
        const line = new Line({ points: pts.map((p) => ({ x: cx + p.x * G, y: cy + p.y * G, z: 0 })), stroke: 1.8, tint: RED })
        this.glyphs.push(line)
        return line
      })
      const arrow = this.arrows[l.at]!
      parts.push(new Fade({ members: lines, presence: derive(() => this.losses.value * smooth(0.6, 1, arrow.creation.value)) }))
    }

    // --- the legend: the five kinds, right of the names ----------------------
    const longest = Math.max(...d.stages.map((s) => s.label.length), d.note ? d.note.text.length * 0.72 : 0)
    const legendX = r + size * 0.9 + longest * 0.6 * size + gap * 0.55
    const legend: Holon[] = []
    LOSS_KINDS.forEach((k, i) => {
      const cy = (2 - i) * G * 3.2
      for (const pts of glyphStrokes(k.kind))
        legend.push(new Line({ points: pts.map((p) => ({ x: legendX + p.x * G, y: cy + p.y * G, z: 0 })), stroke: 1.8, tint: RED }))
      legend.push(text(`${k.letter}  ${k.label}`, GREY, legendX + G * 2.2, cy, scalar(1), 0.72))
    })
    parts.push(new Fade({ members: legend, presence: derive(() => this.losses.value * smooth(0.6, 1, this.arrows.at(-1)!.creation.value)) }))

    // --- the stream rising -------------------------------------------------------
    const drops = arrowDrops(N - 1, d.losses, this.rate.value)
    const n = Math.max(4, Math.round(L / this.spacing.value))
    const spacing = L / n
    for (let j = 0; j < n; j++) {
      const fate = lossFate(j, drops)
      // A lost particle leaves the chain a little above its arrow's foot and
      // is taken in by one of the arrow's glyphs (in turn): the loss named.
      const count = fate >= 0 ? perArrow.get(fate)! : 1
      const sm = (fate + 0.2) * gap
      const to = { x: glyphX(j % count), y: y0 + (fate + 0.5) * gap }
      const D = Math.hypot(to.x, to.y - (y0 + sm))
      let memoT = Number.NaN
      let memoL = Number.NaN
      let memo = { x: 0, y: 0, k: 0, o: 0 }
      const cur = () => {
        const t = this.time.value
        const lv = this.losses.value
        if (t === memoT && lv === memoL) return memo
        memoT = t
        memoL = lv
        const s = streamArc(j, n, spacing, this.speed.value, t, 0)
        const ends = smooth(0, spacing * 1.5, s) * smooth(L, L - spacing * 1.5, s)
        let x = 0
        let y = y0 + s
        let k = 0
        let o = ends
        if (fate >= 0 && s > sm) {
          const u = Math.min(1, (s - sm) / (2 * D)) // off the stream, it drifts at half its pace
          const e = smooth(0, 1, u)
          x = to.x * e * lv
          y = (y0 + sm + (to.y - y0 - sm) * e) * lv + (y0 + s) * (1 - lv)
          k = smooth(0, 0.45, u) * lv
          o *= 1 - lv * smooth(0.55, 1, u)
        }
        memo = { x, y, k, o: o * drawnAt(s) }
        return memo
      }
      parts.push(
        new Circle({
          radius: gap * 0.042,
          stroke: 0,
          fillOpacity: 1,
          tint: derive(() => mix(BLUE, RED, cur().k)),
          opacity: derive(() => cur().o),
          x: derive(() => cur().x),
          y: derive(() => cur().y),
        }),
      )
    }

    // --- the write path back down -------------------------------------------
    const W = -(r + G * 2.4 + 2 * G * 2.9 + gap * 0.75)
    const path: Vec3Like[] = [
      { x: -r - 6, y: yOf(N - 1), z: 0 },
      { x: W, y: yOf(N - 1), z: 0 },
      { x: W, y: yOf(0), z: 0 },
      { x: -r - 7, y: yOf(0), z: 0 },
    ]
    this.dashes = new DottedLine({ points: path, dash: gap * 0.07, gap: gap * 0.07, stroke: 1.5, tint: GREY })
    this.writeLine = new Line({ points: path, stroke: 1.8, tint: WHITE, arrowEnd: true, creation: this.write })
    const lengths = [0]
    for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y))
    const LW = lengths.at(-1)!
    const nw = Math.max(4, Math.round(LW / (this.spacing.value * 2)))
    const down: Holon[] = []
    for (let j = 0; j < nw; j++) {
      const at = () => {
        const s = streamArc(j, nw, LW / nw, this.speed.value, this.time.value, 0)
        return { p: atArcLength(path, lengths, s), o: smooth(0, 20, s) * smooth(LW, LW - 30, s) }
      }
      down.push(
        new Circle({
          radius: gap * 0.034,
          stroke: 0,
          fillOpacity: 1,
          tint: WHITE,
          opacity: derive(() => at().o * smooth(0.7, 1, this.write.value)),
          x: derive(() => at().p.x),
          y: derive(() => at().p.y),
        }),
      )
    }
    const top = this.stages.at(-1)!.node
    // Unbuilt: a crisp dashed outline of where it would run. Built: the
    // solid line draws on down, crystallising (its certainty follows), and
    // particles run down it.
    parts.push(new Fade({ members: [this.dashes], presence: derive(() => (1 - this.write.value) * top.creation.value) }))
    if (d.write) parts.push(text(d.write, GREY, W, yOf(N - 1) + size * 1.3, derive(() => top.creation.value), 0.72, "center"))
    this.writePath = new WritePath({ members: [this.writeLine, ...down] })
    this.writePath.certainty.follow(derive(() => 0.3 + 0.7 * this.write.value))
    parts.push(this.writePath)

    // Centred on the picture: from the write path to the legend's end.
    const right = legendX + G * 2.2 + 22 * 0.6 * size * 0.72
    this.add(new Group({ members: parts, x: -(W + right) / 2 }))
  }

  /** Create: the chain draws on from the ground up — each node, then the arrow above it. */
  override createAnim(): Anim {
    void this.parts
    const N = this.stages.length
    const items: Windowed[] = []
    for (let i = 0; i < N; i++) {
      const a = i / N
      items.push([this.stages[i]!.node.creation.sequence(0, 1), a, a + 0.6 / N])
      if (i < N - 1) items.push([this.arrows[i]!.creation.sequence(0, 1), a + 0.45 / N, a + 1.05 / N])
    }
    return together(...items)
  }

  override stateSpace(): StateSpace {
    return {
      axes: [
        toggle("losses", this.losses, { key: "x", off: ["hidden", 0], on: ["shown", 1], duration: 1.6, handles: () => this.glyphs }),
        toggle("note", this.note, { key: "n", off: ["hidden", 0], on: ["shown", 1], handles: () => (this.noteText ? [this.noteText] : []) }),
        toggle("write", this.write, { key: "w", off: ["unbuilt", 0], on: ["built", 1], duration: 2.2, handles: () => [this.writeLine, ...this.dashes.dashes] }),
      ],
      clocks: [this.time],
    }
  }
}
