/**
 * InterBrain — David's InterBrain symbol: "the flower-of-life sphere
 * arrangement with the obsidian crystals and the Project Liminality logo
 * inside" (2026-10-18, docs/VISION-HYPEROBJECT.md). The red geodesic flower
 * of life, a gem in every node, the Logo at its heart — and, folded inside
 * it, what it holds: the symbol UNFOLDS into the UI.
 *
 * THE CONCEPT (InterBrain film, 27:07, 39:27): "a collectively
 * interconnected inter-brain in which we all participate as equals" — "a
 * collective knowledge garden". The film's InterBrain sphere (f11896,
 * f11941, f12796, f13201), the teaser (2025-05-12, 0:33–0:38: the blue
 * narrative lattice with a crystal boxed in each node turning into the red
 * flower of life, a crystal in each node) and the 2025 C4D work
 * (DreamTalkVocabulary/FlowerOfLife/FlowerOfLifeSphere, the end of
 * TreeOfLifeOpening) are all this one sphere.
 *
 * ONE IMPLEMENTATION. The sphere IS the Noosphere in its InterBrain state
 * (bloom 1, garden 1, interbrain 1 — imported, its states held here); the
 * gems are `InterBrainGem` (this DreamNode's own part: OUR crystal, the
 * Logo at its heart — the small icon the film rings as a DreamNode); the
 * heart is a `DreamNode` holding the `Logo`.
 *
 * THE UNFOLD (VISION-HYPEROBJECT, "The symbol unfolds into the UI"): one
 * number, `unfold` 0..1, so it scrubs and the automaton walks it — clicking
 * the symbol in free play is the transition into what it holds, not a
 * zoom-and-fade. Along it:
 *
 *   [0, RELEASE]       the gems facing you release a DreamNode each — a ring
 *                      drawing round the gem (a gem is a node in potential)
 *   [FLY0, FLY1]       they fly out to a liminal web round the heart: friends
 *                      (dreamers, red) and the dreams you hold with them
 *                      (blue), alternating (LiminalWeb's `webLayout`); the
 *                      heart's ring draws on and grows into the web's centre;
 *                      the sphere opens (swells, fades) behind them
 *   [SONG0, 1]         the song's chapters arrive as a SongLine beside the
 *                      web — the DreamSong that IS using the InterBrain
 *
 * A song is one path through this axis; free play is every other path.
 *
 * MEASURED: f11941 — the InterBrain sphere's geodesic is ν 2 (Noosphere's
 * header). The heart's size has no frame yet (the film never shows the Logo
 * in the sphere): HEART = 0.3 of the sphere's radius, chosen so the Logo
 * sits inside the central ring of nodes; `heart` scales it, 0 hides it.
 */

import { Group, Line, Null, derivePoints } from "../../src/parts/primitives"
import type { Observer } from "../../src/dream"
import { liveView, localView, viewOf, type View } from "../../src/geometry/frames"
import { facingTurn } from "../Noosphere/geodesic"
import { completion, derive, integer, length, scalar } from "../../src/params"
import { presence } from "../../src/certainty"
import { restage, together, type Anim } from "../../src/anim"
import { toggle, type StateSpace } from "../../src/automaton"
import type { Holon, Overrides } from "../../src/holon"
import { Create } from "../../src/verbs"
import { Logo } from "../Logo/Logo"
import { Noosphere } from "../Noosphere/Noosphere"
import { DreamNode, FACE_FILL } from "../DreamNode/DreamNode"
import { DREAM_FACES, DREAMER_FACES } from "../DreamGarden/DreamGarden"
import { webLayout, type Relations } from "../LiminalWeb/LiminalWeb"
import { SongLine } from "../SongLine/SongLine"

// The gem is this DreamNode's part — re-exported so `InterBrain/InterBrain`
// stays the one door into the folder.
export { CRYSTAL, InterBrainGem, crystalCorners, crystalEdges, crystalFacets, facetLight } from "./InterBrainGem"

/** The construction, in units of the sphere's radius R (see header). */
export const INTERBRAIN = {
  /** The geodesic frequency of the InterBrain sphere (f11941). */
  frequency: 2,
  /** The heart Logo's ring. */
  heart: 0.3,
  /** The web's centre ring, unfolded. */
  web: 0.5,
  /** The sphere's swell as it opens. */
  swell: 0.35,
  /** The SongLine: its node's ring, and where the node sits. */
  song: 0.11,
  songX: 1.45,
  songY: -0.85,
} as const

/** The unfold's phases. */
export const RELEASE = 0.3
export const FLY0 = 0.15
export const FLY1 = 0.75
export const SONG0 = 0.65

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const phase = (v: number, a: number, b: number) => clamp01((v - a) / (b - a))
const smooth = (u: number) => u * u * (3 - 2 * u)
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

/** Hold every walkable param in `h` (itself and its parts) where it stands:
 *  a param a whole drives is not walkable (src/automaton.ts — Noosphere's
 *  `free`, Earth's, Mind's, Conflict's, DreamNode's guards). */
export const holdStates = (h: Holon): void => {
  for (const part of h.walk()) {
    for (const a of part.stateSpace()?.axes ?? []) {
      for (const p of a.params()) {
        if (p.isBound) continue
        const v = p.value
        p.follow(derive(() => v))
      }
    }
  }
}

/** A holder whose presence fades all it holds. */
class Layer extends Group {
  there = presence(1)
}

/** What the InterBrain holds, unfolded: the heart (node 0) and its ring,
 *  friends and dreams alternating from the top, clockwise. Friends are
 *  DREAMER_FACES 1–3 (0 is David: the one holding it), dreams the
 *  DreamTalk symbol, the Vision, the liminal Mind. */
export const held = (heart: () => Holon): Relations => {
  const [, kin, peer, friend] = DREAMER_FACES
  const [, , dreamtalk, vision, , mind] = DREAM_FACES
  return {
    nodes: [
      { name: "liminality", kind: "dream", face: heart },
      { name: "friend", kind: "dreamer", face: friend! },
      { name: "dreamtalk", kind: "dream", face: dreamtalk! },
      { name: "kin", kind: "dreamer", face: kin! },
      { name: "vision", kind: "dream", face: vision! },
      { name: "peer", kind: "dreamer", face: peer! },
      { name: "mind", kind: "dream", face: mind! },
    ],
    // The heart holds them all: what the InterBrain holds is what is tied to it.
    ties: [1, 2, 3, 4, 5, 6].map((i) => [0, i] as [number, number]),
  }
}

/** The octahedron's six vertices, in the order the web's six take them:
 *  friend, dream, friend, dream, … — each friend opposite a dream. */
const OCTAHEDRON: readonly [number, number, number][] = [
  [0, 1, 0],
  [1, 0, 0],
  [0, 0, 1],
  [0, -1, 0],
  [-1, 0, 0],
  [0, 0, -1],
]

export class InterBrain extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The sphere's radius — the symbol's one size (and its reach, folded). */
  radius = length(400)
  /** The geodesic frequency (construction; f11941: 2). */
  frequency = integer(INTERBRAIN.frequency)
  /** The heart Logo's ring, × `radius` (0 hides it). */
  heart = scalar(INTERBRAIN.heart)
  /** How many chapters the song line holds (construction). */
  chapters = integer(8)
  /** 0 the symbol … 1 unfolded into what it holds (see header). */
  unfold = completion(0)

  sphere!: Noosphere
  shell!: Layer
  core!: DreamNode
  nodes: DreamNode[] = []
  strands: Layer[] = []
  songline!: SongLine
  song!: Layer

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** The eye the symbol is seen from (`seenFrom`), else the default eye. */
  eye?: () => View
  seenFrom(observer: Observer): void {
    this.eye = () => viewOf(observer)
    this.sphere?.seenFrom(observer)
  }
  /** The eye in this symbol's own frame. */
  localEye(): { x: number; y: number; z: number } {
    const v = localView(this, this.eye?.() ?? liveView() ?? { eye: { x: 0, y: 0, z: 1500 } })
    if ("eye" in v) return v.eye
    return { x: v.toward.x * 1e6, y: v.toward.y * 1e6, z: v.toward.z * 1e6 }
  }

  private eyeKey(): number[] {
    const e = this.localEye()
    return [Math.round(e.x), Math.round(e.y), Math.round(e.z)]
  }

  /** How far the symbol reaches from its centre: the sphere's limb. */
  get reach(): number {
    return this.radius.value
  }

  protected override compose(): void {
    const R = () => this.radius.value
    const u = () => this.unfold.value
    const release = () => smooth(phase(u(), 0, RELEASE))
    const fly = () => smooth(phase(u(), FLY0, FLY1))
    const open = () => smooth(phase(u(), 0.1, 0.6))
    // A node's disc turns to face the eye wherever it stands (a disc in
    // 3-D: from the side it would be a sliver, as a sign never is).
    const faceTheEye = (n: DreamNode) => {
      const turn = () => {
        const e = this.localEye()
        const d = [e.x - n.x.value, e.y - n.y.value, e.z - n.z.value] as [number, number, number]
        const l = Math.hypot(...d) || 1
        return facingTurn([d[0] / l, d[1] / l, d[2] / l])
      }
      n.h.follow(this.unfold.map(() => turn().h))
      n.p.follow(this.unfold.map(() => turn().p))
    }

    // THE SPHERE: the Noosphere in its InterBrain state, held there (its
    // own axes stand down — they are not this symbol's); it swells and
    // fades as the symbol opens.
    this.sphere = new Noosphere({ radius: this.radius.value, frequency: this.frequency.value })
    const hold = (v: number) => derive(() => v)
    this.sphere.bloom.follow(hold(1))
    this.sphere.garden.follow(hold(1))
    this.sphere.interbrain.follow(hold(1))
    this.sphere.flat.follow(hold(0))
    this.sphere.fragment.follow(hold(0))
    this.sphere.lens.follow(hold(0))
    this.sphere.radius.follow(this.unfold.map(() => R() * (1 + INTERBRAIN.swell * open())))
    // The heart is INSIDE: drawn first, so the near face's lines and gems
    // pass over it as the sphere turns.
    const inside = this.add(new Group())
    this.shell = this.add(new Layer({ members: [this.sphere] }))
    this.shell.there.follow(this.unfold.map(() => 1 - open()))
    void this.sphere.parts

    // THE WEB the symbol holds: node 0 is the heart, the Logo in a ring
    // that is hidden while folded.
    const relations = held(() => new Logo({ radius: 200 }))
    const C = () => INTERBRAIN.web * R()
    let memo: { key: number; v: ReturnType<typeof webLayout> } | undefined
    const places = () => {
      if (memo?.key !== R()) memo = { key: R(), v: webLayout(relations, 0) }
      return memo.v
    }
    // Each satellite leaves from a gem facing you, the one nearest its
    // bearing (chosen at compose: the sphere's initial turn).
    // (A slot's own x/y are in the turning ball's frame; its place in the
    // sphere's frame is slotPoint — real 3-D, turned.)
    const near = this.sphere.slots
      .map((slot, i) => ({ slot, i, ...this.sphere.slotPoint(i) }))
      .filter(({ slot }) => slot.there.value > 0.5 && slot.scale.value > 0)
      .filter(({ x, y }) => Math.hypot(x, y) > INTERBRAIN.heart * R() * 1.1)
    const taken = new Set<number>()
    const origin = (place: { x: number; y: number }) => {
      const bearing = Math.atan2(place.y, place.x)
      let best: (typeof near)[number] | undefined
      let bestD = Infinity
      for (const c of near) {
        if (taken.has(c.i)) continue
        let d = Math.abs(Math.atan2(c.y, c.x) - bearing)
        d = Math.min(d, 2 * Math.PI - d)
        if (d < bestD) (bestD = d), (best = c)
      }
      if (best) taken.add(best.i)
      return best
    }

    relations.nodes.forEach((spec, i) => {
      const node = new DreamNode({ kind: spec.kind, face: spec.face(), ringStroke: 2 })
      const place = () => places()[i]!
      if (i === 0) {
        // The heart: the Logo at HEART × R, folded; the web's centre, unfolded.
        const r0 = () => (this.heart.value * R()) / FACE_FILL
        node.radius.follow(this.unfold.map(() => lerp(r0(), C(), fly())))
        node.ringOpacity.follow(this.unfold.map(() => fly()))
        this.core = node
        faceTheEye(node)
        inside.attach(node)
        this.nodes.push(node)
        return
      }
      const slot = origin(place())
      // Where the gem is now (it turns and swells with the sphere), and its ring's size.
      const gx = () => (slot ? this.sphere.slotPoint(slot.i).x : 0)
      const gy = () => (slot ? this.sphere.slotPoint(slot.i).y : 0)
      const gz = () => (slot ? this.sphere.slotPoint(slot.i).z : 0)
      // Unfolded, the web is a SOLID round the heart, not a page: the six
      // sit on an octahedron's vertices, friends and dreams alternating, so
      // every friend's antipode is a dream and it reads from any side.
      const o = OCTAHEDRON[(i - 1) % 6]!
      const at3 = () => {
        const orbit = Math.hypot(place().x, place().y) * C()
        return { x: o[0] * orbit, y: o[1] * orbit, z: o[2] * orbit }
      }
      const gr = () => (slot ? (slot.slot.scale.value * 100) / FACE_FILL : 0)
      node.x.follow(this.unfold.map(() => lerp(gx(), at3().x, fly())))
      node.y.follow(this.unfold.map(() => lerp(gy(), at3().y, fly())))
      node.z.follow(this.unfold.map(() => lerp(gz(), at3().z, fly())))
      faceTheEye(node)
      // The tie: a real 3-D line from the heart's ring to this node's.
      const tie = new Line({ tint: derive(() => (node.kind.value > 0.5 ? node.dreamerTint.value : node.dreamTint.value)), stroke: 1.4, opacity: derive(() => fly()) })
      derivePoints(tie, () => [u(), R(), ...this.eyeKey()], () => {
        const p = { x: node.x.value, y: node.y.value, z: node.z.value }
        const d = Math.hypot(p.x, p.y, p.z)
        if (d < 1e-6) return []
        const r0 = this.core.radius.value / d
        const r1 = 1 - node.radius.value / d
        return [
          { x: p.x * r0, y: p.y * r0, z: p.z * r0 },
          { x: p.x * r1, y: p.y * r1, z: p.z * r1 },
        ]
      })
      this.add(new Layer({ members: [tie] })).there.follow(this.unfold.map(() => release()))
      node.radius.follow(this.unfold.map(() => lerp(gr(), place().r * C(), fly())))
      const strand = this.add(new Layer({ members: [node] }))
      strand.there.follow(this.unfold.map(() => release()))
      this.nodes.push(node)
      this.strands.push(strand)
    })

    // THE SONG: its chapters as a song line, beside the web.
    this.songline = new SongLine({
      size: derive(() => INTERBRAIN.song * R()),
      count: this.chapters.value,
      x: derive(() => INTERBRAIN.songX * R()),
      y: derive(() => INTERBRAIN.songY * R()),
    })
    {
      const sl = this.songline
      const turn = () => {
        const e = this.localEye()
        const d = [e.x - sl.x.value, e.y - sl.y.value, e.z - sl.z.value] as [number, number, number]
        const l = Math.hypot(...d) || 1
        return facingTurn([d[0] / l, d[1] / l, d[2] / l])
      }
      sl.h.follow(this.unfold.map(() => turn().h))
      sl.p.follow(this.unfold.map(() => turn().p))
    }
    this.songline.grow.follow(this.unfold.map(() => smooth(phase(u(), SONG0, 1))))
    this.song = this.add(new Layer({ members: [this.songline] }))
    this.song.there.follow(this.unfold.map(() => smooth(phase(u(), SONG0 - 0.1, SONG0 + 0.05))))

    // What it holds is the symbol's, not walkable on its own: every state of
    // its parts (the sphere's bolts, a node's kind, a face's axes, the song
    // line's node) is held where it stands, so `unfold` is its one axis —
    // the HUD lists it, and a click anywhere on the symbol, folded or
    // unfolded, is the symbol's. (Unpack a face to walk it on its own.)
    for (const part of [this.sphere, ...this.nodes, this.songline]) holdStates(part)
  }

  /** The sphere draws on from the top, then the Logo makes itself at its
   *  heart; what it holds stays folded (`unfold` walks it). */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.sphere), 0, 0.75),
      restage(Create(this.core), 0.45, 1),
      ...this.nodes.slice(1).map((n) => restage(Create(n), 0.9, 1)),
      restage(Create(this.songline), 0.9, 1),
    )
  }

  /** Walkable: click the symbol (or `u`) — it unfolds into what it holds. */
  override stateSpace(): StateSpace | undefined {
    void this.parts
    if (this.unfold.isBound) return undefined
    return {
      axes: [toggle("unfold", this.unfold, { key: "u", off: ["symbol", 0], on: ["unfolded", 1], duration: 3, handles: [this] })],
    }
  }
}
