/**
 * DreamGarden — your DreamNodes held together without any imposed
 * structure: a large red ring, the nodes packed inside it as they come.
 *
 * THE CONCEPT (InterBrain film, 31:10–31:54). "Rather than organizing our
 * dream nodes in a hierarchy of categories in our vault, we store them
 * without any imposed structure in what we might call our dream garden.
 * Here, we simply let the web of relationships emerge organically … by
 * cross-pollinating our dream garden with those of others" — meeting
 * around the campfire, where "for every DreamTalk symbol we invoke, the
 * corresponding dream node is cloned into each other's dream garden"
 * (31:43). The film draws it as one red ring of dreams (blue rings) and
 * dreamers (red rings), no node above another (f9346, f9406, f9616).
 *
 * NO HIERARCHY, ONE PACKING. The nodes sit on a hexagonal lattice — the
 * closest packing of equal circles, the shape a heap of seeds takes by
 * itself — filled from the middle outward, which node goes where decided
 * by `seed` alone. The lattice's columns are vertical (f9406: a column of
 * five through the middle, four either side, three at the edges — 19).
 *
 * MEASURED on f9406 (1280×720):
 *
 *   garden ring     r 259.6 px, centre (640, 359.6)
 *   lattice step    106.5 px    (node (733, 308) off the centre)
 *   node ring       r 33.5 px   → NODE = 33.5 / 106.5 of the step
 *   outermost node  2 steps + its ring = 246.5 px → FIT = 0.9495 of the garden
 *
 * so the step is FIT·R / (outermost lattice distance + NODE): any `count`
 * fills the same ring, and 19 gives the film's 0.410·R exactly. The rim is
 * dimmer (f9406: the six two-step corners fade, the √3-step ring stays lit):
 * a node whose outer edge passes RIM_FROM of the garden fades towards `rim`.
 *
 * FACES are other symbols, imported, never redrawn — dreams: the Logo, the
 * InterBrain, a DreamTalk symbol, the Vision, the liminal eye (MolochEye
 * iris 1), the liminal Mind; dreamers: David's portrait and the other
 * Sketch portraits, the Figure's bust. `plants` overrides the lot.
 *
 * CROSS-POLLINATION. `crossPollinate(i, other, frame)` returns a
 * `Pollen`: a clone of node i that flies (one number, `flight`) from its
 * place here to the first free slot of `other` — a garden built with
 * `room` keeps slots free for what it will receive.
 */

import { Circle, Group, Null } from "../../src/parts/primitives"
import { color, completion, derive, integer, length, scalar } from "../../src/params"
import { RED, TAU, rgb } from "../../src/constants"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import type { Holon } from "../../src/holon"
import { presence } from "../../src/certainty"
import { DreamNode, type Kind } from "../DreamNode/DreamNode"
import { DreamTalkSymbol } from "../DreamTalkSymbol/DreamTalkSymbol"
import { InterBrainGem } from "../InterBrain/InterBrainGem"
import { Logo } from "../Logo/Logo"
import { Vision } from "../Vision/Vision"
import { MolochEye } from "../MolochEye/MolochEye"
import { Mind } from "../Mind/Mind"
import { Figure } from "../Figure/Figure"
import { Sketch } from "../Sketch/Sketch"
import { david } from "../Sketch/assets/david"
import { individual } from "../Sketch/assets/individual"
import { headFront } from "../Sketch/assets/head_front"

/** The construction, measured on f9406 (see header). */
export const GARDEN = {
  /** The node ring as a share of the lattice step. */
  node: 33.5 / 106.5,
  /** The outermost node's outer edge as a share of the garden ring. */
  fit: 246.5 / 259.6,
  /** Where the rim fade begins and ends (a node's outer edge / R). */
  rimFrom: 0.86,
  rimTo: 0.93,
} as const

const SQ3 = Math.sqrt(3)

/**
 * The hexagonal lattice's points at unit step, vertical columns, in the
 * order a garden fills them: by distance from the middle, then clockwise
 * from the top. Enough for `n` slots.
 */
const LATTICE = new Map<number, { x: number; y: number; d: number }[]>()
export const latticeSlots = (n: number): { x: number; y: number; d: number }[] => {
  const hit = LATTICE.get(n)
  if (hit) return hit
  const made = buildLattice(n)
  LATTICE.set(n, made)
  return made
}
const buildLattice = (n: number): { x: number; y: number; d: number }[] => {
  let k = 0
  while (3 * k * (k + 1) + 1 < n) k++
  k += 1
  const out: { x: number; y: number; d: number; a: number }[] = []
  for (let q = -k; q <= k; q++) {
    for (let r = -k; r <= k; r++) {
      if (Math.abs(q + r) > k) continue
      const x = (SQ3 / 2) * q
      const y = r + q / 2
      const d = Math.hypot(x, y)
      // clockwise from the top
      const a = ((Math.atan2(x, y) % TAU) + TAU) % TAU
      out.push({ x, y, d, a })
    }
  }
  out.sort((p, s) => Math.round((p.d - s.d) * 1e6) || p.a - s.a)
  return out.slice(0, n).map(({ x, y, d }) => ({ x, y, d }))
}

/** The lattice step, as a share of the garden ring, for `n` filled slots. */
export const gardenStep = (n: number): number => {
  const slots = latticeSlots(Math.max(1, n))
  const far = slots[slots.length - 1]!.d
  return GARDEN.fit / (far + GARDEN.node)
}

/** A node to plant: its kind and a factory for its face. */
export interface Plant {
  kind: Kind
  face: () => Holon
}

/** A face fitted by an explicit reach (for symbols whose own measure is
 *  not their reach — the eye's `height` is its half-height, its tips at 2h). */
class Reach extends Group {
  span = 100
  get reach(): number {
    return this.span
  }
}

/** The portraits' ink: the film draws them faint (f9406). */
const FACE_GREY = rgb(0x80, 0x80, 0x80)
const portrait = (data: typeof david) => () => new Sketch({ data, height: 200, stroke: 0.9, tint: FACE_GREY })

/** The dreams the film's garden holds (f9406), each a symbol of its own. */
export const DREAM_FACES: (() => Holon)[] = [
  () => new Logo({ radius: 100 }),
  () => new InterBrainGem({ radius: 100, logoStroke: 1.4 }),
  // a garden's (and a web's) faces are a few px: the coarse globe
  () => new DreamTalkSymbol({ radius: 100, resolution: 0.25 }),
  () => new Vision({ radius: 100, ring: 1 }),
  () => new Reach({ span: 200, members: [new MolochEye({ height: 100, iris: 1 })] }),
  () => new Mind({ size: 160, liminal: 1, framed: 0 }),
]
/** The dreamers: portraits. */
export const DREAMER_FACES: (() => Holon)[] = [
  portrait(david),
  portrait(individual),
  portrait(headFront),
  () => new Figure({ height: 200, form: derive(() => 1), tint: FACE_GREY, stroke: 0.9 }),
]

/** A small deterministic generator (mulberry32). */
export const rng = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `count` plants from `seed`: about `dreamers` of them dreamers, the
 *  faces dealt round so neighbours rarely repeat. */
export const sow = (count: number, seed: number, dreamers: number): Plant[] => {
  const next = rng(seed * 7919 + 1)
  const out: Plant[] = []
  let d = Math.floor(next() * DREAM_FACES.length)
  let p = Math.floor(next() * DREAMER_FACES.length)
  for (let i = 0; i < count; i++) {
    if (next() < dreamers) out.push({ kind: "dreamer", face: DREAMER_FACES[p++ % DREAMER_FACES.length]! })
    else out.push({ kind: "dream", face: DREAM_FACES[d++ % DREAM_FACES.length]! })
  }
  return out
}

/** A node's holder: its presence is the rim fade (inherited by the whole node). */
export class Bed extends Group {
  there = presence(1)
}

/** A point and radius carried from `h`'s own frame up into `frame`. */
export const carry = (h: Holon, frame: Holon | undefined, x: number, y: number, r: number) => {
  let node: Holon | undefined = h
  while (node && node !== frame) {
    const s = node.scale.value
    const b = node.b.value
    const c = Math.cos(b)
    const n = Math.sin(b)
    ;[x, y] = [node.x.value + s * (c * x - n * y), node.y.value + s * (n * x + c * y)]
    r *= s
    node = node.parent
  }
  return { x, y, r }
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export class DreamGarden extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The garden ring's radius (f9406: 259.6 px at 720p). */
  radius = length(259.6 / 0.48)
  /** How many nodes it holds (read at construction: it is what is planted). */
  count = integer(19)
  /** Which node goes where, and which face it wears (construction). */
  seed = integer(1)
  /** Slots kept free past `count`, for nodes cross-pollinated in (construction). */
  room = integer(0)
  /** About this share of the planted nodes are dreamers (construction). */
  dreamers = scalar(0.4)
  ringTint = color(RED)
  ringStroke = length(3)
  ringOpacity = completion(1)
  nodeStroke = length(2)
  /** What the dimmest rim node keeps of its ink (f9406). */
  rim = completion(0.4)

  /** What to plant, overriding `count`/`seed`/`dreamers` (construction data). */
  plants?: Plant[] = undefined

  ring!: Circle
  nodes: DreamNode[] = []
  beds: Bed[] = []
  /** The plants actually planted, in slot order. */
  planted: Plant[] = []

  /** The lattice step as a share of R (fitted to count + room). */
  get step(): number {
    return gardenStep(this.capacity)
  }

  get capacity(): number {
    return (this.plants?.length ?? this.count.value) + this.room.value
  }

  /** Slot i's centre and node radius, in the garden's own frame. */
  slot(i: number): { x: number; y: number; r: number } {
    const R = this.radius.value
    const step = this.step * R
    const s = latticeSlots(Math.max(i + 1, this.capacity))[i]!
    return { x: s.x * step, y: s.y * step, r: GARDEN.node * step }
  }

  /** Slot i carried into `frame` (an ancestor; default the scene's root). */
  slotIn(i: number, frame?: Holon): { x: number; y: number; r: number } {
    const s = this.slot(i)
    return carry(this as unknown as Holon, frame, s.x, s.y, s.r)
  }

  /** The rim fade for a node at slot i: 1 inside, `rim` at the edge. */
  rimAt(i: number): number {
    const s = this.slot(i)
    const edge = (Math.hypot(s.x, s.y) + s.r) / this.radius.value
    return 1 - (1 - this.rim.value) * smooth(GARDEN.rimFrom, GARDEN.rimTo, edge)
  }

  protected override compose(): void {
    this.planted = this.plants ?? sow(this.count.value, this.seed.value, this.dreamers.value)
    this.planted.forEach((plant, i) => {
      const node = new DreamNode({ kind: plant.kind, face: plant.face(), ringStroke: this.nodeStroke })
      node.radius.follow(this.radius.map(() => this.slot(i).r))
      node.x.follow(this.radius.map(() => this.slot(i).x))
      node.y.follow(this.radius.map(() => this.slot(i).y))
      const bed = this.add(new Bed({ members: [node] }))
      bed.there.follow(this.rim.map(() => this.rimAt(i)))
      this.nodes.push(node)
      this.beds.push(bed)
    })
    this.ring = this.add(
      new Circle({
        radius: this.radius,
        tint: this.ringTint,
        stroke: this.ringStroke,
        opacity: this.ringOpacity,
        drawStart: 0.25,
        drawReversed: true,
      }),
    )
  }

  /** The ring draws from the top; the nodes come up from the middle out. */
  override createAnim(): Anim {
    void this.parts
    const n = this.nodes.length
    return together(
      restage(this.ring.creation.sequence(0, 1), 0, 0.5),
      ...this.nodes.map((node, i) => restage(Create(node), 0.15 + (0.6 * i) / n, 0.4 + (0.6 * (i + 1)) / n)),
    )
  }

  /**
   * Cross-pollination (31:43): a clone of node `i` that flies from here to
   * `to`'s slot `slot` (default its first free one). Both gardens are read
   * in `frame`, live; the Pollen must be placed in that same frame.
   */
  crossPollinate(i: number, to: DreamGarden, frame: () => Holon | undefined, slot?: number): Pollen {
    return new Pollen({ between: [this, to], index: i, slot, frame })
  }
}

/**
 * A node cloned from one garden into another (31:43). `flight` 0 sits
 * exactly on the source node, 1 in the target slot; between, it rises on
 * an arc (`lift`, a share of the distance) and takes the target's size.
 * Not a symbol of its own: a gesture between two gardens.
 */
export class Pollen extends Null {
  flight = completion(0)
  lift = scalar(0.2)

  /** [the source garden, the target garden] — references, not parts
   *  (each has its own place in the scene). */
  between: DreamGarden[] = []
  index = 0
  slot?: number = undefined
  frame: () => Holon | undefined = () => undefined

  node!: DreamNode

  get from(): DreamGarden {
    return this.between[0]!
  }
  get to(): DreamGarden {
    return this.between[1]!
  }

  /** Where the clone is at `flight` u, in the frame. */
  at(u: number): { x: number; y: number; r: number } {
    void this.from.parts
    void this.to.parts
    const src = this.from.nodes[this.index]!.circleIn(this.frame())
    const dst = this.to.slotIn(this.slot ?? this.to.nodes.length, this.frame())
    const e = u
    const dx = dst.x - src.x
    const dy = dst.y - src.y
    const arc = 4 * e * (1 - e) * this.lift.value * Math.hypot(dx, dy)
    return { x: src.x + dx * e, y: src.y + dy * e + arc, r: src.r + (dst.r - src.r) * e }
  }

  protected override compose(): void {
    void this.from.parts
    const plant = this.from.planted[this.index]!
    this.node = this.add(
      new DreamNode({ kind: plant.kind, face: plant.face(), ringStroke: this.from.nodeStroke.value }),
    )
    this.node.radius.follow(this.flight.map((u) => this.at(u).r))
    this.node.x.follow(this.flight.map((u) => this.at(u).x))
    this.node.y.follow(this.flight.map((u) => this.at(u).y))
  }

  /** The clone comes up on the source, then flies. */
  override createAnim(): Anim {
    void this.parts
    return together(restage(Create(this.node), 0, 0.3), restage(this.flight.sequence(0, 1), 0.3, 1))
  }
}
