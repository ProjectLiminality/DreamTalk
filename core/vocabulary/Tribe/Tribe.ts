/**
 * Tribe — people bound into one body: the ancient tribe around its
 * campfires, or the modern "boxed web" of narrative-held minds.
 *
 * THE CONCEPT (InterBrain film).
 *   ANCIENT (`modern` 0, f6091, f6106, f6151): seven liminal minds in red
 *   circles on a hexagon — six round one — and on every edge between two of
 *   them a SandTalk: the Dunbar-scale community in which free speech round
 *   the campfire yields emergent order (20:14–21:00). Tribes gather into
 *   tribes of tribes (f6286, f6376: a hexagon of tribes, the far ones dim) —
 *   `depth`.
 *   MODERN (`modern` 1, f5221, f5341, f6736): "our contemporary
 *   communication media … tuned to amplify narrative engineering" (17:48) —
 *   the same lattice turned blue: domesticated minds (the cube round each
 *   head) in blue squares, joined by bare blue lines, growing into a huge
 *   web (`rings`); a narrative box can be clapped over the heads (`boxed`,
 *   f5221: a white cube in a blue ring, every head but the one in the
 *   middle).
 *   The film walks one into the other on its timeline (f6496: ancient →
 *   book → radio tower → modern), so the era is ONE number that scrubs: the
 *   minds turn domesticated, the circles square, red turns blue, the
 *   campfire bands narrow to a line and their SandTalks fade.
 *
 * COMPOSED, NEVER REDRAWN. Each person is `Mind` (liminal ↔ domesticated,
 * its own frame off — the tribe's node frame is the circle ↔ square), each
 * edge's campfire is `SandTalk` (no sand symbol, a flatter ring, measured),
 * the narrative box is `FoldableCube`. The node frame, its black body, the
 * edge band and the box's ring are this holon's own lines.
 *
 * THE LATTICE. Nodes are the triangular lattice inside a hexagon of
 * `rings` rings — axial (q, r) with max(|q|, |r|, |q + r|) ≤ rings, at
 * x = D(q + r/2), y = D·r·√3/2: rows run horizontally and the middle row
 * has a node at either end, as every frame shows. Every pair of neighbours
 * is an edge (rings 1: the six rim edges and six spokes of f6091 / f5221).
 *
 * TRIBES OF TRIBES. At depth k the tribe is the centre tribe and six more
 * round it at 2.9^k·D, the ring turned 30° (f6286: 2.82–2.92·D, at
 * 90° + 60°·i); the outer ones stand at `dim` (f6286: 0.29 of the middle one's
 * brightness, 55 vs 190 at the 99.5th percentile of red).
 *
 * MEASURED, in units of D = `size` (the distance between neighbouring
 * minds; f6091 266 px, f5221 272.6 px, f6736 106 px):
 *
 *   CIRCLE    the ancient node's circle radius 75.75 px → 0.285·D
 *   SQUARE    the modern node's half-side 72.5 px → 0.266·D
 *   BUST      the bust's height, ancient 76 px → 0.286·D, modern 97 px →
 *             0.356·D (the Mind is posed at its own size and scaled)
 *   BAND      the campfire band round each edge: an ellipse 0.455·D by
 *             0.137·D, tucked under both circles (f6091)
 *   CAMPFIRE  the SandTalk on it: ring half-width 57.5 px → 0.216·D, its
 *             ring flatter than the standalone's (12 / 57.5)
 *   BOX       the narrative box's ring radius 50 px → 0.183·D, its centre
 *             0.05·D below the node's; its cube's front 0.22·D (f5221)
 */

import { Circle, Ellipse, Group, Line, Null, Shape, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, derive, integer, length } from "../../src/params"
import { BLACK, BLUE, PI, RED, WHITE, type Color } from "../../src/constants"
import { lerp } from "../../src/math"
import type { Holon } from "../../src/holon"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { axis, type StateSpace } from "../../src/automaton"
import { Layer } from "../Figure/Figure"
import { MIND, Mind } from "../Mind/Mind"
import { SandTalk } from "../SandTalk/SandTalk"
import { FoldableCube } from "../FoldableCube/FoldableCube"

/** The construction, in units of D = `size` (see header). */
export const TRIBE = {
  circle: 75.75 / 266,
  square: 72.5 / 272.6,
  bustAncient: 76 / 266,
  bustModern: 97 / 272.6,
  bandX: 0.455,
  bandY: 36.5 / 266,
  campfire: 57.5 / 266,
  campfireAspect: 12 / 57.5,
  box: 50 / 272.6,
  boxY: -0.05,
  cube: 60 / 272.6,
  /** Tribes of tribes: the ring of tribes at SPACING^k·D (f6286: 2.82–2.92·D). */
  tribeSpacing: 2.9,
} as const

/** Samples round a node frame — a multiple of 4, so the square's corners are samples. */
const FRAME_SAMPLES = 96

/**
 * The node frame's closed outline at era `m` (0 circle … 1 square), for a
 * lattice spacing D: each sample a ray at angle θ from the node's centre,
 * its length sliding from the circle's radius to the square's
 * (half-side / max(|cos θ|, |sin θ|)). Starts and ends at the top.
 */
export const nodeOutline = (D: number, m: number): Vec3Like[] => {
  const rc = TRIBE.circle * D
  const hs = TRIBE.square * D
  const pts: Vec3Like[] = []
  for (let i = 0; i <= FRAME_SAMPLES; i++) {
    const a = PI / 2 + (2 * PI * i) / FRAME_SAMPLES
    const c = Math.cos(a)
    const s = Math.sin(a)
    const r = lerp(rc, hs / Math.max(Math.abs(c), Math.abs(s)), m)
    pts.push({ x: r * c, y: r * s, z: 0 })
  }
  return pts
}

/** The lattice's nodes (axial q, r) inside a hexagon of `rings` rings, centre first. */
export const latticeNodes = (rings: number): { q: number; r: number }[] => {
  const out: { q: number; r: number }[] = []
  for (let r = -rings; r <= rings; r++)
    for (let q = -rings; q <= rings; q++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= rings) out.push({ q, r })
  out.sort((a, b) => Math.max(Math.abs(a.q), Math.abs(a.r), Math.abs(a.q + a.r)) - Math.max(Math.abs(b.q), Math.abs(b.r), Math.abs(b.q + b.r)))
  return out
}

/** Every pair of neighbouring nodes, as index pairs into `latticeNodes(rings)`. */
export const latticeEdges = (rings: number): [number, number][] => {
  const nodes = latticeNodes(rings)
  const at = new Map(nodes.map((n, i) => [`${n.q},${n.r}`, i]))
  const edges: [number, number][] = []
  nodes.forEach((n, i) => {
    for (const [dq, dr] of [[1, 0], [0, 1], [-1, 1]] as const) {
      const j = at.get(`${n.q + dq},${n.r + dr}`)
      if (j !== undefined) edges.push([i, j])
    }
  })
  return edges
}

/** A node's place in the plane, for spacing D. */
export const nodePosition = (n: { q: number; r: number }, D: number): { x: number; y: number } => ({
  x: D * (n.q + n.r / 2),
  y: (D * n.r * Math.sqrt(3)) / 2,
})

/** The centres of the tribes in a tribe of `depth` levels, for spacing D (centre first). */
export const tribeCentres = (depth: number, D: number): { x: number; y: number }[] => {
  let centres = [{ x: 0, y: 0 }]
  for (let k = 1; k <= depth; k++) {
    const d = TRIBE.tribeSpacing ** k * D
    const turn = PI / 2 + (k - 1) * (PI / 6)
    const ring = [{ x: 0, y: 0 }, ...Array.from({ length: 6 }, (_, i) => ({ x: d * Math.cos(turn + (i * PI) / 3), y: d * Math.sin(turn + (i * PI) / 3) }))]
    centres = ring.flatMap((o) => centres.map((c) => ({ x: o.x + c.x, y: o.y + c.y })))
  }
  return centres
}

const mix = (a: Color, b: Color, u: number): Color => ({ r: lerp(a.r, b.r, u), g: lerp(a.g, b.g, u), b: lerp(a.b, b.b, u) })

export class Tribe extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** D — the distance between neighbouring minds; every measure derives from it. */
  size = length(300)
  /** 0 the ancient tribe … 1 the modern boxed web. Scrubs. */
  modern = completion(0)
  /** 0 bare heads … 1 the narrative box over every head but the middle one (modern, f5221). */
  boxed = completion(0)
  /** How many hexagonal rings of minds round the middle one (1: the tribe of seven). */
  rings = integer(1)
  /** Tribes of tribes: 0 one tribe, 1 a hexagon of tribes, … */
  depth = integer(0)
  /** How bright the tribes round the middle one stand (f6286: dim). */
  dim = completion(0.29)
  /** Pen width in screen px for frames and edges. */
  stroke = length(2.6)
  /**
   * Construction: what each node holds instead of a mind, made for a node
   * circle of the given radius — the tribe of InterBrains, "your unique
   * small tribe" scaled into the InterBrain lattice (f9966, f9991). Unset:
   * the minds.
   */
  face?: (radius: number) => Holon = undefined

  /** Walkable (src/automaton.ts): ancient ↔ modern, bare ↔ boxed. */
  override stateSpace(): StateSpace | undefined {
    const axes = []
    if (!this.modern.isBound)
      axes.push(axis("era", this, { ancient: { modern: 0 }, modern: { modern: 1 } }, { duration: 3, handles: [this] }))
    if (!this.boxed.isBound)
      axes.push(axis("boxed", this, { bare: { boxed: 0 }, boxed: { boxed: 1 } }, { duration: 1, handles: [this] }))
    return axes.length ? { axes } : undefined
  }

  /** One layer per tribe, the middle one first. */
  tribes!: Layer[]
  /** Every node's parts, every tribe's, in order. */
  minds!: Mind[]
  frames!: Line[]
  boxes!: Layer[]
  /** Every node and every edge as a whole (what Create draws), every tribe's, in order. */
  nodeGroups!: Group[]
  edgeGroups!: Group[]
  /** Every edge's band and its SandTalk. */
  bands!: Ellipse[]
  campfires!: SandTalk[]

  /** How far it reaches from its centre. */
  get reach(): number {
    const D = this.size.value
    const one = this.rings.value * D + TRIBE.circle * D
    let r = one
    for (let k = 1; k <= this.depth.value; k++) r += TRIBE.tribeSpacing ** k * D
    return r
  }

  protected override compose(): void {
    const D = this.size.value
    const m = this.modern
    const stroke = this.stroke
    const nodes = latticeNodes(this.rings.value)
    const edges = latticeEdges(this.rings.value)
    const ink = derive(() => mix(RED, BLUE, m.value))

    this.minds = []
    this.frames = []
    this.boxes = []
    this.bands = []
    this.campfires = []
    this.nodeGroups = []
    this.edgeGroups = []

    const centres = tribeCentres(this.depth.value, D)
    this.tribes = centres.map((c, t) => {
      const members = []
      const pos = nodes.map((n) => nodePosition(n, D))

      // The edges first: the nodes' black bodies cover their ends.
      for (const [i, j] of edges) {
        const a = pos[i]!
        const b = pos[j]!
        let angle = Math.atan2(b.y - a.y, b.x - a.x)
        if (angle > PI / 2) angle -= PI
        if (angle <= -PI / 2) angle += PI
        const band = new Ellipse({
          radiusX: TRIBE.bandX * D,
          radiusY: derive(() => lerp(TRIBE.bandY * D, 0, m.value)),
          tint: ink,
          stroke,
        })
        const campfire = new SandTalk({
          size: TRIBE.campfire * D,
          ringAspect: TRIBE.campfireAspect,
          symbol: null,
          vision: 0,
          stroke: this.stroke.map((w) => w * 0.5),
        })
        this.bands.push(band)
        this.campfires.push(campfire)
        const edge = new Group({
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          b: angle,
          members: [band, new Layer({ presence: derive(() => 1 - m.value), members: [campfire] })],
        })
        this.edgeGroups.push(edge)
        members.push(edge)
      }

      // The nodes: a black body, the frame, the mind, the box.
      nodes.forEach((n, i) => {
        const p = pos[i]!
        const outline = new Line({})
        const body = new Shape({ tint: BLACK, outlines: [outline] })
        const frame = new Line({ tint: ink, stroke })
        // Both follow the era; the body's edge is the frame's.
        for (const line of [outline, frame]) derivePoints(line, () => [m.value], () => nodeOutline(D, m.value))
        const bust = (u: number) => lerp(TRIBE.bustAncient, TRIBE.bustModern, u) * D
        const held = this.face?.(TRIBE.circle * D)
        const mind =
          held ??
          new Mind({
            size: TRIBE.bustAncient * D / MIND.bust,
            liminal: derive(() => 1 - m.value),
            framed: derive(() => 0),
            scale: derive(() => bust(m.value) / bust(0)),
            stroke: this.stroke.map((w) => w * 0.85),
          })
        const middle = n.q === 0 && n.r === 0
        const box = new Layer({
          y: TRIBE.boxY * D,
          presence: derive(() => (middle ? 0 : this.boxed.value * m.value)),
          members: [
            new Circle({ radius: TRIBE.box * D, tint: BLACK, stroke: 0, fillOpacity: 1 }),
            new FoldableCube({ size: TRIBE.cube * D, fold: derive(() => 1), p: PI / 2, z: -TRIBE.cube * D, tint: WHITE, stroke }),
            new Circle({ radius: TRIBE.box * D, tint: BLUE, stroke }),
          ],
        })
        if (mind instanceof Mind) this.minds.push(mind)
        this.frames.push(frame)
        this.boxes.push(box)
        const node = new Group({ x: p.x, y: p.y, members: [body, frame, mind, box] })
        this.nodeGroups.push(node)
        members.push(node)
      })

      // The far tribes are dimmed by a black veil over them, not faded: a
      // faded tribe would show its edges through its minds' black bodies.
      if (t > 0)
        members.push(
          new Circle({
            radius: (this.rings.value + TRIBE.circle) * D * 1.02,
            tint: BLACK,
            stroke: 0,
            // `dim` is the brightness SEEN; the veil blends in linear light.
            fillOpacity: this.dim.map((d) => 1 - d ** 2.2),
          }),
        )
      return this.add(new Layer({ x: c.x, y: c.y, members }))
    })
  }

  /** The minds come first, ring by ring; then the edges between them —
   *  the bands drawn, the campfires lit. */
  override createAnim(): Anim {
    void this.parts
    const items: Anim[] = []
    const nNodes = latticeNodes(this.rings.value).length
    const nEdges = latticeEdges(this.rings.value).length
    this.tribes.forEach((_, t) => {
      for (let i = 0; i < nNodes; i++) {
        const s = (0.5 * i) / Math.max(1, nNodes)
        items.push(restage(Create(this.nodeGroups[t * nNodes + i]!), s, s + 0.4))
      }
      for (let e = 0; e < nEdges; e++) {
        const s = 0.45 + (0.3 * e) / Math.max(1, nEdges)
        items.push(restage(Create(this.edgeGroups[t * nEdges + e]!), s, s + 0.25))
      }
    })
    return together(...items)
  }
}
