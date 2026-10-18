/**
 * LiminalWeb — one DreamNode at the centre, every node it is related to on
 * a ring around it; the focus moves from node to node.
 *
 * THE CONCEPT (InterBrain film, 32:01–32:21). "Your dream garden will
 * self-organize over time into your unique liminal web, connecting each
 * dream to the dreamers you share it with, and each fellow dreamer with
 * the dreams you share. Said differently, a story becomes a place where
 * you can meet your peers, and for each peer you see all the stories that
 * mediate your relationship." The film walks it: a dream at the centre with
 * its dreamers round it (f9646), a dreamer with her six dreams (f9676), a
 * dream with its four dreamers (f9691), a dreamer — David — with his four
 * (f9721, f9751); between, the nodes fly to their new places (f9646, f9661).
 *
 * THE RELATIONS are data: `relations` = { nodes, ties }, each tie a dream
 * and a dreamer who share it (`neighbours` reads it either way). The web
 * imposes no category: what is round the centre is only what is tied to it.
 *
 * FOCUS is ONE number: an index into `tour` (the order the centre moves
 * through), fractional between stops. The layout at a stop is a pure
 * function (`webLayout`); between stops every node's place, size and
 * presence blend, so a focus change scrubs and the automaton walks it.
 * Nodes not tied to the centre wait outside the ring, faded and folded away.
 *
 * MEASURED (1280×720):
 *
 *   f9721  centre ring r 137.8 px; satellites r 45–47.5; orbit 238–250
 *   f9676  centre ring r 137; six satellites r 45 at orbit 235
 *
 *   SATELLITE = 46 / 137.5 of the centre ring; ORBIT = 242 / 137.5.
 */

import { Group, Null } from "../../src/parts/primitives"
import { completion, length, scalar } from "../../src/params"
import { TAU } from "../../src/constants"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { axis, type StateSpace } from "../../src/automaton"
import { presence } from "../../src/certainty"
import type { Holon } from "../../src/holon"
import { DreamNode, type Kind } from "../DreamNode/DreamNode"
import { DREAM_FACES, DREAMER_FACES } from "../DreamGarden/DreamGarden"

/** Measured on f9721 / f9676 (see header). */
export const WEB = {
  satellite: 46 / 137.5,
  orbit: 242 / 137.5,
  /** Where an untied node waits: this many orbits out. */
  away: 2.2,
} as const

/** One node of the web: its kind, its face, a name for the focus axis. */
export interface WebNode {
  name: string
  kind: Kind
  face: () => Holon
}

/** The web's data: nodes, and ties [dream, dreamer] between them. */
export interface Relations {
  nodes: WebNode[]
  ties: [number, number][]
}

/** Every node tied to node i, in the order the ties list them. */
export const neighbours = (g: Relations, i: number): number[] => {
  const out: number[] = []
  for (const [a, b] of g.ties) {
    const o = a === i ? b : b === i ? a : -1
    if (o >= 0 && !out.includes(o)) out.push(o)
  }
  return out
}

/** A node's place at one stop, in units of the centre ring's radius. */
export interface Place {
  x: number
  y: number
  r: number
  there: number
}

/**
 * The layout with node `centre` in the middle: it at the origin, radius 1;
 * its neighbours round the orbit clockwise from the top; every other node
 * waiting `away` orbits out on its own bearing, faded.
 */
export const webLayout = (g: Relations, centre: number, orbit = WEB.orbit, satellite = WEB.satellite): Place[] => {
  const ring = neighbours(g, centre)
  return g.nodes.map((_, i) => {
    if (i === centre) return { x: 0, y: 0, r: 1, there: 1 }
    const k = ring.indexOf(i)
    if (k >= 0) {
      const a = TAU / 4 - (k / ring.length) * TAU
      return { x: orbit * Math.cos(a), y: orbit * Math.sin(a), r: satellite, there: 1 }
    }
    // A bearing of its own (the golden angle), so the waiting nodes spread;
    // folded to nothing as well as faded (a presence does not reach a
    // globe's surfaces), so a node flies in growing.
    const a = TAU / 4 + i * 2.39996323
    return { x: WEB.away * orbit * Math.cos(a), y: WEB.away * orbit * Math.sin(a), r: 0, there: 0 }
  })
}

const [LOGO, INTERBRAIN, DREAMTALK, VISION, EYE, MIND] = DREAM_FACES as [
  () => Holon, () => Holon, () => Holon, () => Holon, () => Holon, () => Holon,
]
const [DAVID, KIN, PEER, FRIEND] = DREAMER_FACES as [() => Holon, () => Holon, () => Holon, () => Holon]

/**
 * The film's web, as far as its frames show it (f9646–f9751): the Logo
 * with three dreamers; a friend with six dreams; the liminal eye with four
 * dreamers (the film's node is a pair of white eyes under the Vision, a
 * face no holon draws yet — MolochEye's liminal iris stands in); David
 * with four dreams.
 */
export const FILM_WEB: Relations = {
  nodes: [
    { name: "liminality", kind: "dream", face: LOGO },
    { name: "interbrain", kind: "dream", face: INTERBRAIN },
    { name: "dreamtalk", kind: "dream", face: DREAMTALK },
    { name: "vision", kind: "dream", face: VISION },
    { name: "eye", kind: "dream", face: EYE },
    { name: "mind", kind: "dream", face: MIND },
    { name: "david", kind: "dreamer", face: DAVID },
    { name: "friend", kind: "dreamer", face: FRIEND },
    { name: "peer", kind: "dreamer", face: KIN },
    { name: "elder", kind: "dreamer", face: PEER },
  ],
  ties: [
    // the friend's six (f9676), from the top round clockwise
    [4, 7], [3, 7], [5, 7], [0, 7], [2, 7], [1, 7],
    // David's four (f9721): the DreamTalk symbol, the Logo, the eye, the Mind
    [2, 6], [0, 6], [4, 6], [5, 6],
    // the Logo's third dreamer (f9646), the eye's other two (f9691)
    [0, 8], [4, 8], [4, 9],
  ],
}
/** The film's walk: the Logo, the friend, the liminal eye, David. */
export const FILM_TOUR = [0, 7, 4, 6]

/** A node's holder: its presence fades it in and out of the web. */
export class Strand extends Group {
  there = presence(1)
}

export class LiminalWeb extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The centre node's ring (f9721: 137.5 px at 720p). */
  radius = length(137.5 / 0.48)
  /** The ring the related nodes sit on, as a share of `radius`. */
  orbit = scalar(WEB.orbit)
  /** A related node's ring as a share of `radius`. */
  satellite = scalar(WEB.satellite)
  /** Which node is the centre: an index into `tour`; between stops, the blend. */
  focus = scalar(0)
  nodeStroke = length(2)

  /** The web's data (construction). */
  relations: Relations = FILM_WEB
  /** The order the focus walks the nodes (construction): node indices. */
  tour: number[] = FILM_TOUR

  nodes: DreamNode[] = []
  strands: Strand[] = []

  /** Every node's place at `focus` f, in scene units. */
  placesAt(f: number): Place[] {
    const n = this.tour.length
    const t = Math.min(n - 1, Math.max(0, f))
    const k = Math.min(n - 2, Math.floor(t))
    const u = n === 1 ? 0 : t - k
    const R = this.radius.value
    const at = (stop: number) => webLayout(this.relations, this.tour[stop]!, this.orbit.value, this.satellite.value)
    const A = at(Math.max(0, k))
    const B = n === 1 ? A : at(k + 1)
    return A.map((a, i) => {
      const b = B[i]!
      const l = (p: number, q: number) => p + (q - p) * u
      return { x: R * l(a.x, b.x), y: R * l(a.y, b.y), r: R * l(a.r, b.r), there: l(a.there, b.there) }
    })
  }

  /** Walkable: the centre moves stop to stop — `w`. */
  override stateSpace(): StateSpace {
    void this.parts
    const positions: Record<string, Record<string, number>> = {}
    this.tour.forEach((node, k) => (positions[this.relations.nodes[node]!.name] = { focus: k }))
    return { axes: [axis("focus", this, positions, { key: "w", duration: 2, handles: () => this.nodes })] }
  }

  protected override compose(): void {
    for (const stop of this.tour) {
      if (!this.relations.nodes[stop]) throw new Error(`LiminalWeb: tour names node ${stop}, which is not in the web`)
    }
    // Memoised per focus: every node reads the same layout.
    let key = NaN
    let memo: Place[] = []
    const places = () => {
      const k = this.focus.value + 1e3 * this.radius.value + 1e6 * this.orbit.value + 1e7 * this.satellite.value
      if (k !== key) {
        key = k
        memo = this.placesAt(this.focus.value)
      }
      return memo
    }
    this.relations.nodes.forEach((spec, i) => {
      const node = new DreamNode({ kind: spec.kind, face: spec.face(), ringStroke: this.nodeStroke })
      node.radius.follow(this.focus.map(() => places()[i]!.r))
      node.x.follow(this.focus.map(() => places()[i]!.x))
      node.y.follow(this.focus.map(() => places()[i]!.y))
      const strand = this.add(new Strand({ members: [node] }))
      strand.there.follow(this.focus.map(() => places()[i]!.there))
      this.nodes.push(node)
      this.strands.push(strand)
    })
  }

  /** The centre comes up, then its ring of relations, clockwise from the top. */
  override createAnim(): Anim {
    void this.parts
    const centre = this.tour[Math.round(Math.min(this.tour.length - 1, Math.max(0, this.focus.value)))]!
    const ring = neighbours(this.relations, centre)
    const others = this.nodes.filter((_, i) => i !== centre && !ring.includes(i))
    return together(
      restage(Create(this.nodes[centre]!), 0, 0.5),
      ...ring.map((j, k) => restage(Create(this.nodes[j]!), 0.35 + (0.5 * k) / ring.length, 0.6 + (0.4 * (k + 1)) / ring.length)),
      ...others.map((h) => restage(Create(h), 0.9, 1)),
    )
  }
}
