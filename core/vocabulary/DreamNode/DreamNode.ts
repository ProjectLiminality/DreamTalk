/**
 * DreamNode — the digital vehicle of a DreamTalk symbol: ANY symbol inside a
 * ring.
 *
 * THE CONCEPT (InterBrain film, 29:14–30:52). "A DreamTalk symbol needs a
 * digital vehicle, one that is able to hold space for the living, evolving
 * knowledge the symbol represents" — a git repository, generalised to "the
 * entire class of knowledge itself"; "let's refer to this generalized
 * digital vehicle as a dream node". The film draws it as the symbol ringed:
 * the ring draws on when "GitRepo" is said (f8812–f8820). Two complementary
 * kinds (30:44, f9271): the DREAMS we share (a blue ring) and the DREAMERS
 * we share them with (a red ring, holding a portrait). And they nest
 * (35:43): "take any number of dream nodes and combine them into larger
 * wholes by importing them into a higher-order dream node" (f10760, f10846).
 *
 * ONE SIZE: `radius` is the ring's. The face is fitted to it live, so a
 * scene grows or shrinks the whole node with one param.
 *
 * MEASURED on f9076 (the DreamTalk symbol in its blue ring, 1280×720):
 *
 *   ring            r 211.5 px, centre (640.5, 309)
 *   symbol's ring   r 142.5 px  → 0.674 of the node's ring
 *   axis-ray tips   r ≈ 177 px  → FACE_FILL = 0.84 of the node's ring
 *
 * and on f9271 the dreamer's portrait spans 0.83 of its ring half-height —
 * the same fill. So the face rule is one number: whatever the symbol, its
 * outermost reach sits at FACE_FILL × the ring. A face states its reach with
 * a `reach` getter (DreamTalkSymbol: its ray tips); otherwise its `radius`;
 * otherwise half its `height` (a Sketch); otherwise 100.
 *
 * THE RING DRAWS ON from one o'clock, clockwise, over ~2 s (f8812–f8820).
 *
 * KIND is ONE number (0 = dream, 1 = dreamer) so it scrubs: the ring's tint
 * runs `dreamTint` → `dreamerTint`, and when the node keeps its DEFAULT
 * faces (a DreamTalkSymbol for a dream, David's portrait for a dreamer —
 * vocabulary/Sketch `david`, a line drawing like the one f9271 shows) the
 * two faces swap on it: one shrinks into the heart as the other grows out. `kind: "dream" | "dreamer"` reads at construction.
 *
 * HOLARCHY. `children` are DreamNodes held inside, `childShare` of the ring
 * each, evenly round an orbit of `childOrbit` × the ring, the first at the
 * bottom (f10760: three children at ≈ 0.27 of the parent, ≈ 0.55 out, one
 * below and two above). A node that holds children shows no face unless it
 * is given one (f10760's parent is empty but for its children). Each child
 * is a full DreamNode — sovereign, recursive.
 *
 * IMPORT LINES. The film connects a node to its imported copy with the two
 * outer tangent lines of their rings (f10760: each outside node to its copy
 * inside the parent; f10846: one node to its copies inside three parents).
 * `ImportLines` draws them between any two DreamNodes, measured in any
 * common frame — so the parent and the source may sit anywhere in a scene.
 */

import { Circle, Group, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, length, scalar } from "../../src/params"
import { BLUE, RED, TAU, type Color } from "../../src/constants"
import { together, restage, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { toggle, type StateSpace } from "../../src/automaton"
import type { Holon, Overrides } from "../../src/holon"
import { presence } from "../../src/certainty"
import { DreamTalkSymbol } from "../DreamTalkSymbol/DreamTalkSymbol"
import { Sketch } from "../Sketch/Sketch"
import { david } from "../Sketch/assets/david"

/** The face's outermost reach as a share of the ring (f9076, f9271). */
export const FACE_FILL = 0.84
/** A child node's ring, and its orbit, as shares of the parent's (f10760). */
export const CHILD_SHARE = 0.27
export const CHILD_ORBIT = 0.55
/** Where the ring's pen comes down: one o'clock, as a share of the perimeter
 *  from +x (f8812). */
export const RING_START = 55 / 360

export const DREAM = 0
export const DREAMER = 1
export type Kind = "dream" | "dreamer"

const kindValue = (k: unknown): unknown => (k === "dream" ? DREAM : k === "dreamer" ? DREAMER : k)

const mix = (a: Color, b: Color, u: number): Color => ({
  r: a.r + (b.r - a.r) * u,
  g: a.g + (b.g - a.g) * u,
  b: a.b + (b.b - a.b) * u,
})

/** How far a face reaches from its centre, in its own units (see header). */
export const reachOf = (face: Holon): number => {
  const f = face as unknown as { reach?: unknown; radius?: { value: unknown }; height?: { value: unknown } }
  if (typeof f.reach === "number" && f.reach > 0) return f.reach
  if (typeof f.radius?.value === "number" && f.radius.value > 0) return f.radius.value
  if (typeof f.height?.value === "number" && f.height.value > 0) return f.height.value / 2
  return 100
}

/** The default dream face: a DreamTalk symbol. */
const dreamFace = (): Holon => new DreamTalkSymbol({ radius: 100, resolution: 0.5 })
/** The default dreamer face: David's portrait (f9271). */
const dreamerFace = (): Holon => new Sketch({ data: david, height: 200, stroke: 1.2 })

/** A default face's holder: its presence (inherited, unlike opacity) is
 *  the share of `kind` that face stands for. */
class FaceSlot extends Group {
  there = presence(1)
}

export class DreamNode extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The ring's radius — the node's one size (f9076's 211.5 px at 720p). */
  radius = length(440)
  /** 0 = a dream (blue ring), 1 = a dreamer (red ring); scrubs between. */
  kind = completion(DREAM)
  dreamTint = color(BLUE)
  dreamerTint = color(RED)
  ringStroke = length(3.5)
  ringOpacity = completion(1)
  /** The face's reach as a share of the ring. */
  faceFill = scalar(FACE_FILL)
  /** Children: their ring and their orbit as shares of this ring, and where
   *  the first one sits (radians from +x; −90° = the bottom). */
  childShare = scalar(CHILD_SHARE)
  childOrbit = scalar(CHILD_ORBIT)
  childPhase = scalar(-TAU / 4)

  /**
   * What the ring holds. Undefined: the default face of its kind (and
   * both, cross-fading on `kind`); null: nothing but its children.
   */
  face?: Holon | null = undefined
  /** DreamNodes imported into this one (construction data). */
  children: DreamNode[] = []

  ring!: Circle
  /** The faces actually held: [face] or, by default, [dream, dreamer]. */
  faces: Holon[] = []

  constructor(overrides: Overrides = {}) {
    super("kind" in overrides ? { ...overrides, kind: kindValue(overrides.kind) } : overrides)
  }

  /** Walkable: dream ↔ dreamer — click the node, or `k`. */
  override stateSpace(): StateSpace | undefined {
    void this.parts
    // A whole that drives the kind (InterBrain's held web) owns it.
    if (this.kind.isBound) return undefined
    return {
      axes: [toggle("kind", this.kind, { key: "k", off: ["dream", DREAM], on: ["dreamer", DREAMER], handles: [this.ring] })],
    }
  }

  /** The ring in the frame `frame` (an ancestor, or the node itself): centre and radius. */
  circleIn(frame?: Holon): { x: number; y: number; r: number } {
    let x = 0
    let y = 0
    let r = this.radius.value
    let h: Holon | undefined = this as unknown as Holon
    while (h && h !== frame) {
      const s = h.scale.value
      const b = h.b.value
      const c = Math.cos(b)
      const n = Math.sin(b)
      ;[x, y] = [h.x.value + s * (c * x - n * y), h.y.value + s * (n * x + c * y)]
      r *= s
      h = h.parent
    }
    return { x, y, r }
  }

  protected override compose(): void {
    const R = () => this.radius.value

    if (this.face) this.faces = [this.face]
    else if (this.face === undefined && this.children.length === 0) this.faces = [dreamFace(), dreamerFace()]
    const crossfade = this.face === undefined && this.faces.length === 2
    this.faces.forEach((f, i) => {
      const share = () => (crossfade ? (i === 0 ? 1 - this.kind.value : this.kind.value) : 1)
      f.scale.follow(this.radius.map((r) => (r * this.faceFill.value * share()) / reachOf(f)))
      if (!crossfade) return void this.add(f)
      // The faces SWAP: one shrinks into the heart as the other grows out
      // of it. Opacity is per leaf, so a presence (inherited) fades every
      // stroke of the face at once; the scale takes what a presence does
      // not reach (the Earth's surfaces, a drawing's washes).
      const slot = this.add(new FaceSlot({ members: [f] }))
      slot.there.follow(this.kind.map(() => share()))
    })

    const n = this.children.length
    this.children.forEach((child, i) => {
      this.add(child)
      const a = () => this.childPhase.value + (i / n) * TAU
      const orbit = () => (n === 1 ? 0 : R() * this.childOrbit.value)
      child.radius.follow(this.radius.map((r) => r * this.childShare.value))
      child.x.follow(this.radius.map(() => Math.cos(a()) * orbit()))
      child.y.follow(this.radius.map(() => Math.sin(a()) * orbit()))
    })

    const ringTint = color(this.dreamTint.value)
    ringTint.follow(this.kind.map((k) => mix(this.dreamTint.value, this.dreamerTint.value, k)))
    this.ring = this.add(
      new Circle({
        radius: this.radius,
        tint: ringTint,
        stroke: this.ringStroke,
        opacity: this.ringOpacity,
        drawStart: RING_START,
        drawReversed: true,
      }),
    )
  }

  /** The face comes up, the ring draws round it (f8812–f8820), the children
   *  arrive one after another. */
  override createAnim(): Anim {
    void this.parts
    const n = this.children.length
    return together(
      ...this.faces.map((f) => restage(Create(f), 0, 0.6) as Anim),
      restage(this.ring.creation.sequence(0, 1), this.faces.length ? 0.35 : 0, 1),
      ...this.children.map((c, i) => restage(Create(c), 0.3 + (0.6 * i) / n, 0.4 + (0.6 * (i + 1)) / n)),
    )
  }
}

/**
 * The two outer tangent lines of two rings — the film's mark of an import
 * (f10760, f10846): a node and its copy inside a higher-order node, joined
 * like a cone. Both nodes are read in `frame` (their common ancestor, or the
 * scene's root when it is left out), live, so either may move or grow.
 * Not a symbol of its own: a mark between two of them.
 */
export class ImportLines extends Null {
  tint = color(BLUE)
  stroke = length(1.4)

  /** [the node, its copy inside the higher-order node] — references, not
   *  parts (each has its own parent in the scene). */
  between: DreamNode[] = []
  /** The frame both are read in (default: the scene's root). It must be
   *  this part's own frame — put ImportLines where `frame` puts its parts. */
  frame?: () => Holon | undefined = undefined

  left!: Line
  right!: Line

  protected override compose(): void {
    const circles = () => {
      const [a, b] = this.between
      const f = this.frame?.()
      return a && b ? [a.circleIn(f), b.circleIn(f)] as const : undefined
    }
    const ends = (side: 1 | -1): Vec3Like[] => {
      const c = circles()
      return c ? outerTangent(c[0], c[1], side) : []
    }
    const key = () => {
      const c = circles()
      return c ? [c[0].x, c[0].y, c[0].r, c[1].x, c[1].y, c[1].r] : []
    }
    this.left = this.add(new Line({ tint: this.tint, stroke: this.stroke }))
    derivePoints(this.left, key, () => ends(1))
    this.right = this.add(new Line({ tint: this.tint, stroke: this.stroke }))
    derivePoints(this.right, key, () => ends(-1))
  }
}

/**
 * One outer common tangent of circles a and b, from a's touching point to
 * b's. `side` picks which (±1). Empty when one circle holds the other — they
 * have no outer tangent then.
 *
 * With d the centres' distance and u the unit from a to b, the tangent's
 * normal n makes cos θ = (ra − rb)/d with u; the touching points are
 * a + ra·n and b + rb·n.
 */
export const outerTangent = (
  a: { x: number; y: number; r: number },
  b: { x: number; y: number; r: number },
  side: 1 | -1,
): Vec3Like[] => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  if (d <= Math.abs(a.r - b.r) + 1e-9) return []
  const base = Math.atan2(dy, dx)
  const t = Math.acos((a.r - b.r) / d)
  const nx = Math.cos(base + side * t)
  const ny = Math.sin(base + side * t)
  return [
    { x: a.x + a.r * nx, y: a.y + a.r * ny, z: 0 },
    { x: b.x + b.r * nx, y: b.y + b.r * ny, z: 0 },
  ]
}
