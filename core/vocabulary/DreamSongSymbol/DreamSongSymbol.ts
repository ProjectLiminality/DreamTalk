/**
 * DreamSong — DreamTalk symbols woven into a larger story, held in one
 * DreamNode.
 *
 * THE CONCEPT (InterBrain film, 36:14–36:42): "The corresponding DreamTalk
 * symbols can then be woven together to tell a larger story or dream song
 * … this new and ancient practice of integrating many DreamTalk symbols
 * into a single DreamSong as Dreamweaving. By compressing a DreamSong in
 * turn again into a single DreamTalk symbol, we can weave it into yet
 * another higher order DreamSong."
 *
 * THE IMAGE (f10906, f10966, labelled "DreamSong"): a DreamNode — the blue
 * ring — holding a page: symbols and blocks of text (stacks of horizontal
 * lines) in two columns, checkerboarded, three rows: the InterBrain, text /
 * text, the liminal eyes / the DreamTalk symbol, text. f10921 sets it
 * beside the DreamTalk symbols it weaves, each in its own small node. Then
 * the song COMPRESSES (f10981–f11011): the page is gone and the node holds
 * one symbol — the Logo — "a single DreamTalk symbol" again.
 *
 * COMPOSED, NEVER REDRAWN: the ring is `DreamNode` (a dream: blue), the
 * symbols are whatever the slots hold (default `InterBrain`, `Vision`,
 * `DreamTalkSymbol`), the compressed face is `Logo`. Only the text-line
 * blocks are this holon's own line work.
 *
 * MEASURED on f10906 (ring r 233 px, centre (640, 332)), in units of the
 * ring's radius:
 *
 *   COLUMN_X   the two columns' centres at ±0.355
 *   ROW_GAP    rows 0.52 apart (+0.53, +0.01, −0.51 — centred)
 *   SLOT_REACH a symbol reaches ≈ 0.22 (the InterBrain's crystal 95 px tall)
 *   TEXT       five lines, 0.54 wide, 0.0717 apart (126 px, 16.7 px)
 *
 * and on f10996 the Logo's blue circle is 168 / 236 = 0.712 of the ring.
 *
 * SLOTS (construction data): `slots` is the page in reading order, two to
 * a row: a holon is a symbol (fitted to SLOT_REACH by DreamNode's
 * `reachOf`), "text" is a block of lines. Undefined: the film's page.
 *
 * STATE: `compress` (0..1) — the song (0) folds into its single symbol
 * (1): the page shrinks into the heart and fades as the compressed face
 * grows out of it. Walkable: song ↔ symbol.
 */

import { Group, Null } from "../../src/parts/primitives"
import { Polylines } from "../../src/parts/polylines"
import { color, completion, integer, length, scalar } from "../../src/params"
import { BLUE, WHITE } from "../../src/constants"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { toggle, type StateSpace } from "../../src/automaton"
import type { Holon, Overrides } from "../../src/holon"
import { presence } from "../../src/certainty"
import { DreamNode, reachOf } from "../DreamNode/DreamNode"
import { DreamTalkSymbol } from "../DreamTalkSymbol/DreamTalkSymbol"
import { InterBrainGem } from "../InterBrain/InterBrainGem"
import { Vision } from "../Vision/Vision"
import { Logo } from "../Logo/Logo"

/** The page, in units of the ring's radius (see header). */
export const SONG = {
  columnX: 0.355,
  rowGap: 0.52,
  slotReach: 0.22,
  textWidth: 0.54,
  textGap: 0.0717,
  /** The compressed face's own circle as a share of the ring (f10996). */
  logo: 0.712,
} as const

/** The design unit the page is laid out in (the ring = U). */
const U = 100

export type Slot = Holon | "text"

/** The film's page (f10906). */
export const filmSlots = (): Slot[] => [
  new InterBrainGem({ radius: 100 }),
  "text",
  "text",
  new Vision({ radius: 100 }),
  new DreamTalkSymbol({ radius: 100, resolution: 0.25 }),
  "text",
]

/** Where slot `i` of `n` sits, in units of the ring: two columns, rows centred. */
export const slotSpot = (i: number, n: number): { x: number; y: number } => {
  const rows = Math.ceil(n / 2)
  const row = Math.floor(i / 2)
  return { x: (i % 2 === 0 ? -1 : 1) * SONG.columnX, y: ((rows - 1) / 2 - row) * SONG.rowGap }
}

/** A text block's lines, centred at the origin, in units of the ring. */
export const textLines = (count: number): { y: number; x0: number; x1: number }[] =>
  Array.from({ length: count }, (_, k) => ({
    y: ((count - 1) / 2 - k) * SONG.textGap,
    x0: -SONG.textWidth / 2,
    x1: SONG.textWidth / 2,
  }))

/** A layer whose presence (inherited) fades every stroke in it at once. */
class Layer extends Group {
  there = presence(1)
}

export class DreamSongSymbol extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The node's ring (f10906: 233 px at 720p → 485 units). */
  radius = length(485)
  /** 0 the song … 1 compressed into its single DreamTalk symbol. */
  compress = completion(0)
  ringTint = color(BLUE)
  ringStroke = length(3.5)
  /** Lines in a text block. */
  lines = integer(5)
  textTint = color(WHITE)
  textStroke = length(1.6)
  /** A symbol's reach as a share of the ring. */
  slotReach = scalar(SONG.slotReach)

  /** The page in reading order (construction data; undefined: the film's). */
  slots?: Slot[] = undefined
  /** The single symbol it compresses into (undefined: the Logo; null: none). */
  compressed?: Holon | null = undefined

  node!: DreamNode
  page!: Layer
  symbols: Holon[] = []
  texts: Polylines[] = []
  face?: Holon
  faceLayer!: Layer

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** How far it reaches: its ring. */
  get reach(): number {
    return this.radius.value
  }

  protected override compose(): void {
    const slots = this.slots ?? filmSlots()
    const n = slots.length

    this.node = this.add(
      new DreamNode({ radius: this.radius, dreamTint: this.ringTint, ringStroke: this.ringStroke, face: null }),
    )

    // The page, laid out with the ring = U, scaled to the ring and folded
    // into the heart by `compress`.
    const members: Holon[] = slots.map((slot, i) => {
      const at = slotSpot(i, n)
      if (slot === "text") {
        const block = new Polylines({ tint: this.textTint, stroke: this.textStroke, x: at.x * U, y: at.y * U })
        const count = Math.max(1, Math.round(this.lines.value))
        block.loops = textLines(count).map((l) => [
          { x: l.x0 * U, y: l.y * U, z: 0 },
          { x: l.x1 * U, y: l.y * U, z: 0 },
        ])
        this.texts.push(block)
        return block
      }
      slot.x.value = at.x * U
      slot.y.value = at.y * U
      slot.scale.follow(this.slotReach.map((r) => (r * U) / reachOf(slot)))
      this.symbols.push(slot)
      return slot
    })
    this.page = this.add(new Layer({ members }))
    this.page.scale.follow(this.radius.map((r) => (r / U) * (1 - this.compress.value)))
    this.page.there.follow(this.compress.map((c) => 1 - c))

    const face = this.compressed === undefined ? new Logo({ radius: 100 }) : this.compressed
    this.faceLayer = this.add(new Layer({ members: face ? [face] : [] }))
    if (face) {
      this.face = face
      face.scale.value = (SONG.logo * U) / reachOf(face)
    }
    this.faceLayer.scale.follow(this.radius.map((r) => (r / U) * this.compress.value))
    this.faceLayer.there.follow(this.compress.map((c) => c))
  }

  /** The ring draws, then the page fills in reading order. */
  override createAnim(): Anim {
    void this.parts
    const items: Holon[] = [...this.page.members]
    const n = items.length
    return together(
      restage(Create(this.node), 0, 0.45) as Anim,
      ...items.map((h, i) => restage(Create(h), 0.3 + (0.6 * i) / n, 0.45 + (0.55 * (i + 1)) / n) as Anim),
      ...(this.face ? [restage(Create(this.face), 0, 0.6) as Anim] : []),
    )
  }

  /** Walkable: the song ↔ its single symbol. */
  override stateSpace(): StateSpace | undefined {
    if (this.compress.isBound) return undefined
    void this.parts
    return {
      axes: [toggle("compress", this.compress, { key: "x", off: ["song", 0], on: ["symbol", 1], handles: [this.node.ring] })],
    }
  }
}

