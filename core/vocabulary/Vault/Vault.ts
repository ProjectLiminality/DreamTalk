/**
 * Vault — knowledge as MANAGED: "represented in the fundamental unit of
 * written documents and structured in a hierarchy of categories" (InterBrain
 * film, 27:24–27:36). The way a second brain keeps what it knows — the
 * picture the InterBrain is the answer to (f8281, f8296, f8326, and again in
 * the closing recap, f12346).
 *
 * THE DRAWING (f8326, 1280×720): a blue frame; at its head a large blue
 * "Vault" box; under it a white bus with five drops — Category, a document,
 * Category, a document, Category; under each Category the same five again,
 * smaller ("Category" in small type), and so on. The documents alternate
 * the two pages the film uses: an `article` (a picture box and lines) then
 * a plain `document` (lines only) — both are Icons props, imported.
 *
 * THE RECURSION (`depth`, structural): how many levels hang below the Vault
 * (the film: 2). Every level is the level above's pattern again; the film's
 * two levels are measured, deeper ones continue level 2's proportions
 * (spacing × 0.345 at most, tighter where the parents are crowded), so
 * they stay self-similar and never overlap.
 *
 * THE GROWTH (`grow`, 0..1): the hierarchy fills in level by level, top
 * down — the film draws the first level, then the second hangs from it
 * (f8281 → f8296). Each level owns an equal share of the axis: its lines
 * drop first, then its boxes and pages appear, then its words. `Create`
 * runs the same cascade up to where `grow` stands (the reveal is
 * `creation × (1 + grow·depth) / (depth + 1)` of the levels).
 *
 * MEASURED off f8326, in px; the unit is the frame's width W = 1064.5 px
 * (`size`), the origin the frame's centre (639.75, 359.75) px:
 *   FRAME     x 107.5 … 1172, y 51.5 … 668 (27 px under the lowest box)
 *   VAULT     box 181.5 px, centre y 173.75; "Vault" ≈ 25 px type
 *   LEVEL 1   bus y 304; centres y 406.25; Category box 121 px, 26.7 px
 *             type; the five 174.5 px apart; pages 74 px tall
 *   LEVEL 2   bus y 535.5; centres y 609.75; box 63 px, 13.6 px type; the
 *             five 60.25 px apart under each Category; pages 38.5 px tall
 *   PAGE      0.61 of its level's box tall (both levels)
 */

import { Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { color, derive, integer, length, completion } from "../../src/params"
import { BLUE, WHITE, rgb } from "../../src/constants"
import { eased, type Anim } from "../../src/anim"
import { toggle, type StateSpace } from "../../src/automaton"
import { Icon, type DrawnIconName } from "../Icons/Icons"

/** The film's numbers (px, f8326). */
export const VAULT = {
  frameW: 1064.5,
  origin: [639.75, 359.75] as const,
  frameTop: 51.5,
  frameMargin: 27,
  frameX: [107.5, 1172] as const,
  vault: { box: 181.5, y: 173.75, type: 25 },
  levels: [
    { bus: 304, y: 406.25, box: 121, spacing: 174.5, type: 26.7 },
    { bus: 535.5, y: 609.75, box: 63, spacing: 60.25, type: 13.6 },
  ],
  /** Beyond the film: level 2's proportions, scaled by this per level. */
  deeper: 0.345,
  page: 0.61,
} as const

/** The five drops under every box, left to right. */
export const PATTERN: readonly ("category" | DrawnIconName)[] = ["category", "article", "category", "document", "category"]

export type VaultItem =
  | { kind: "vault" | "category"; level: number; x: number; y: number; box: number; type: number }
  | { kind: "page"; glyph: DrawnIconName; level: number; x: number; y: number; height: number }

export interface VaultLayout {
  items: VaultItem[]
  /** Open polylines, each tagged with the level it feeds. */
  links: { level: number; points: [number, number][] }[]
  frame: { x0: number; x1: number; y0: number; y1: number }
}

/**
 * Level ℓ's geometry (ℓ ≥ 1): measured for 1–2; beyond, level 2's shape
 * again, its spacing set so the five drops under the most crowded parents
 * still clear their neighbours' (box 1.046 × spacing as at level 2; the
 * vertical gaps and the type in proportion to the box).
 */
export const levelOf = (l: number): { bus: number; y: number; box: number; spacing: number; type: number; crowd: number } => {
  const m = VAULT.levels
  if (l <= m.length) {
    const g = m[l - 1]!
    // The nearest two Categories on this level: within a group 2·spacing,
    // across groups the parents' nearest gap less the two half-spans.
    const parentCrowd = l === 1 ? Infinity : levelOf(l - 1).crowd
    return { ...g, crowd: Math.min(2 * g.spacing, parentCrowd - 4 * g.spacing) }
  }
  const last = m[m.length - 1]!
  const up = levelOf(l - 1)
  const boxPerSpacing = last.box / last.spacing
  // 4 spacings of span + a box of clearance must fit in the parents' crowd.
  const spacing = Math.min(up.spacing * VAULT.deeper, up.crowd / (4 + 2 * boxPerSpacing))
  const box = spacing * boxPerSpacing
  const prev = m[m.length - 2]!
  const gapDown = (last.bus - (prev.y + prev.box / 2)) * (box / last.box)
  const gapIn = (last.y - last.box / 2 - last.bus) * (box / last.box)
  const bus = up.y + up.box / 2 + gapDown
  const y = bus + gapIn + box / 2
  return { bus, y, box, spacing, type: last.type * (box / last.box), crowd: Math.min(2 * spacing, up.crowd - 4 * spacing) }
}

/** The whole hierarchy for `depth` levels, in frame px (y down). */
export const vaultLayout = (depth: number): VaultLayout => {
  const [ox] = VAULT.origin
  const v = VAULT.vault
  const items: VaultItem[] = [{ kind: "vault", level: 0, x: ox, y: v.y, box: v.box, type: v.type }]
  const links: VaultLayout["links"] = []
  let parents: { x: number; y: number; box: number }[] = [{ x: ox, y: v.y, box: v.box }]
  let lowest = v.y + v.box / 2
  for (let l = 1; l <= depth; l++) {
    const g = levelOf(l)
    const next: typeof parents = []
    for (const p of parents) {
      const xs = PATTERN.map((_, j) => p.x + (j - 2) * g.spacing)
      links.push({ level: l, points: [[p.x, p.y + p.box / 2], [p.x, g.bus]] })
      links.push({ level: l, points: [[xs[0]!, g.bus], [xs[xs.length - 1]!, g.bus]] })
      PATTERN.forEach((kind, j) => {
        const x = xs[j]!
        if (kind === "category") {
          items.push({ kind: "category", level: l, x, y: g.y, box: g.box, type: g.type })
          links.push({ level: l, points: [[x, g.bus], [x, g.y - g.box / 2]] })
          next.push({ x, y: g.y, box: g.box })
        } else {
          const height = g.box * VAULT.page
          items.push({ kind: "page", glyph: kind, level: l, x, y: g.y, height })
          links.push({ level: l, points: [[x, g.bus], [x, g.y - height / 2]] })
        }
      })
    }
    parents = next
    lowest = g.y + g.box / 2
  }
  return { items, links, frame: { x0: VAULT.frameX[0], x1: VAULT.frameX[1], y0: VAULT.frameTop, y1: lowest + VAULT.frameMargin } }
}

/** A level's progress at reveal r ∈ [0, 1], `depth` levels below the Vault. */
export const levelProgress = (r: number, level: number, depth: number): number => {
  const n = depth + 1
  return Math.min(1, Math.max(0, r * n - level))
}

const LINK_GREY = rgb(0xd2, 0xd2, 0xd2)

export class Vault extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** W — the frame's width; everything is in units of it. */
  size = length(1064.5 / 0.48)
  /** Levels below the Vault (the film: 2). Structural. */
  depth = integer(2)
  /** 0 the Vault alone … 1 every level grown, top down. */
  grow = completion(1)
  tint = color(BLUE)
  linkTint = color(LINK_GREY)
  textTint = color(WHITE)
  stroke = length(2)
  linkStroke = length(1.5)

  frame!: Line
  boxes!: Group
  pages!: Group
  links!: Group
  words!: Group

  protected override compose(): void {
    const D = Math.max(0, Math.round(this.depth.value))
    const lay = vaultLayout(D)
    const k = () => this.size.value / VAULT.frameW
    const [ox, oy] = VAULT.origin
    const P = (x: number, y: number): Vec3Like => ({ x: (x - ox) * k(), y: (oy - y) * k(), z: 0 })
    // grow 0 is the Vault alone (level 0), 1 every level.
    const reveal = () => (this.creation.value * (1 + this.grow.value * D)) / (D + 1)
    const phase = (level: number, a: number, b: number) => () => {
      const p = levelProgress(reveal(), level, D)
      return Math.min(1, Math.max(0, (p - a) / (b - a)))
    }
    /** A closed square starting at its top centre (where its drop arrives). */
    const square = (x: number, y: number, b: number): Vec3Like[] => {
      const h = b / 2
      return [P(x, y - h), P(x + h, y - h), P(x + h, y + h), P(x - h, y + h), P(x - h, y - h), P(x, y - h)]
    }
    const f = lay.frame
    this.frame = this.add(
      new Line({
        points: [P(ox, f.y0), P(f.x1, f.y0), P(f.x1, f.y1), P(f.x0, f.y1), P(f.x0, f.y0), P(ox, f.y0)],
        tint: this.tint,
        stroke: this.stroke,
        creation: derive(phase(0, 0, 0.6)),
      }),
    )
    this.links = this.add(
      new Group({
        members: lay.links.map(
          (l) =>
            new Line({
              points: l.points.map(([x, y]) => P(x, y)),
              tint: this.linkTint,
              stroke: this.linkStroke,
              creation: derive(phase(l.level, 0, 0.45)),
            }),
        ),
      }),
    )
    const boxes: Line[] = []
    const pages: Icon[] = []
    const words: Text[] = []
    for (const it of lay.items) {
      if (it.kind === "page") {
        const c = P(it.x, it.y)
        pages.push(
          new Icon({
            glyph: it.glyph,
            size: it.height * k(),
            x: c.x,
            y: c.y,
            tint: this.tint,
            stroke: this.stroke.map((s) => s * 0.8),
            presence: derive(phase(it.level, 0.4, 0.8)),
          }),
        )
        continue
      }
      boxes.push(new Line({ points: square(it.x, it.y, it.box), tint: this.tint, stroke: this.stroke, creation: derive(phase(it.level, it.level === 0 ? 0 : 0.4, it.level === 0 ? 0.6 : 0.85)) }))
      const c = P(it.x, it.y)
      words.push(
        new Text({
          content: it.kind === "vault" ? "Vault" : "Category",
          font: "Times-Roman",
          size: it.type * k(),
          x: c.x,
          // The glyphs' box sits a little high of the holon's y: the film
          // centres the word's x-height in the box (f8326).
          y: c.y - 0.37 * it.type * k(),
          tint: this.textTint,
          opacity: derive(phase(it.level, 0.75, 1)),
        }),
      )
    }
    this.boxes = this.add(new Group({ members: boxes }))
    this.pages = this.add(new Group({ members: pages }))
    this.words = this.add(new Group({ members: words }))
  }

  /** The cascade: the reveal runs `creation` 0 → 1 (× `grow`). */
  override createAnim(): Anim {
    return eased("linear", this.creation.sequence(0, 1))
  }

  override unCreateAnim(): Anim {
    return this.creation.to(0)
  }

  /** Walkable (src/automaton.ts): the Vault alone ↔ the hierarchy grown. */
  override stateSpace(): StateSpace | undefined {
    if (this.grow.isBound) return undefined
    return { axes: [toggle("grow", this.grow, { off: ["vault", 0], on: ["grown", 1], duration: 2.5, handles: [this] })] }
  }
}
