/**
 * FlowMap — an organisation's value flows, as a visual automaton.
 *
 * A state machine whose internal state is mirrored by its display state
 * (David's "visual automata", after the CTMU's processing/display domains):
 * every degree of freedom of the knowledge is a param, and every param has
 * one smooth picture. Plain data in; nothing about any real organisation is
 * baked in.
 *
 * THE PICTURE. The GROUP is one circle — a holon — holding its MEMBERS
 * (subsidiaries, sites) as small rings: "the group is an entity and the
 * subsidiaries are sub-entities". PARTNERS ring it from outside: suppliers on
 * the left, where value enters; customers on the right, where it leaves;
 * two-way partners above and below.
 *
 * THE DEGREES OF FREEDOM (all params, all reversible, all addressable):
 *
 *   grain    0 → 1   the categorical dimension revealed. Each category's
 *                    disc shrinks in from the group's own circumference
 *                    (geometry/flowmap.ts) — two of them land on the vesica
 *                    piscis — and each member glides into the region of
 *                    exactly its categories, taking its category's colour.
 *                    Members of several categories sit in the overlap and
 *                    stay neutral: the overlap already says "both".
 *   stage(id).shown  a flow layer on/off — its channels draw on and its
 *                    particles start to run.
 *   expand   0 → 1   the value chain's order revealed. Flat, every flow is
 *                    overlaid in one plane, face-on. Expanded, the whole map
 *                    turns to the side — heading `tilt`, then dipping by
 *                    `pitch` into a 3/4 view, the turn leading and the
 *                    slices fanning out behind it — and becomes a stack of identical
 *                    slices along a depth axis — one per step of the chain —
 *                    and each stage's flows run from its slice to the next.
 *                    Inflow converges (contraction), outflow fans out
 *                    (expansion). Collapsing lays it flat and face-on again,
 *                    exactly.
 *   stage(id).open   one gap of the stack opened or closed — stages collapse
 *                    and expand individually but can never reorder: a slice's
 *                    depth is the running sum of the gaps before it.
 *   time             seconds of flow — particles are a pure f(time), spaced
 *                    evenly by ARC LENGTH (`spacing`, scaled by a flow's
 *                    rate) and running at `speed` units per second, so a
 *                    short channel carries few particles and a long one many.
 *   labels   0 → 1   stage names under the stack, category names by their
 *                    discs — quiet, and off-able.
 *
 * CERTAINTY (src/certainty.ts) is the universal visual language here: a
 * stage, a flow, a member or a partner can be declared conjectural in the
 * data, and is then drawn ghosted — translucent, and its particles hover
 * (`wobble`) instead of running a crisp line. Hard data is solid.
 *
 * SEAMS for other abilities (Morph, the truck lens): every slice's group
 * circle is `slices[k].hull`, a plain Circle; every flow's channel is
 * `flows[i].line`, a Line; every particle is `flows[i].dots[j]`, a filled
 * Circle — the neutral `symbol` "dot". A stage's `symbol` names what its
 * particles will become (pallets, reels…) once those symbols exist.
 */

import { Circle, Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { angle, choice, completion, derive, length, scalar, state, type Readable } from "../../src/params"
import { together, type Anim } from "../../src/anim"
import { BLUE, GREEN, PURPLE, RED, WHITE, YELLOW, rgb, type Color } from "../../src/constants"
import type { Holon } from "../../src/holon"
import { certainty, wobble } from "../../src/certainty"
import { axis, toggle, type Axis, type StateSpace } from "../../src/automaton"
import {
  arcTable,
  atArcLength,
  categoryDiscs,
  categoryDirection,
  flowPoint,
  memberLayouts,
  partnerLayout,
  sliceDepths,
  smooth,
  streamArc,
  streamFade,
  trimToRim,
  type Disc,
  type PartnerSide,
  type Vec2,
  type Vec3,
} from "../../src/geometry/flowmap"

// --- The data ---------------------------------------------------------------

export interface FlowMapData {
  /** The categorical dimension `grain` reveals. Order = placement: first at the top. */
  categories?: { id: string; label?: string; tint?: Color }[]
  /** The group's own entities. `categories` lists category ids (several = the overlap). */
  members: { id: string; label?: string; categories?: string[]; certainty?: number }[]
  /** Outside the group: "in" supplies it, "out" buys from it, "both" does either. */
  partners?: { id: string; label?: string; side: PartnerSide; certainty?: number }[]
  /**
   * The value chain, IN ORDER — the order is the point and never changes.
   * Stage k's flows run from slice k to slice k + 1 of the expanded stack.
   */
  stages: { id: string; label?: string; tint?: Color; certainty?: number; symbol?: ParticleSymbol }[]
  /** A flow of value from one entity (member or partner id) to another, in a stage. */
  flows: { from: string; to: string; stage: string; rate?: number; certainty?: number }[]
}

/** What a particle is drawn as. Only the neutral dot exists yet — the hook for pallets, reels, products. */
export const PARTICLE_SYMBOLS = ["dot"] as const
export type ParticleSymbol = (typeof PARTICLE_SYMBOLS)[number]

const CATEGORY_TINTS: Color[] = [RED, BLUE, GREEN, YELLOW, PURPLE]
const PARTNER_TINT = rgb(150, 150, 150)
const LABEL_TINT = rgb(170, 170, 170)

const mix = (a: Color, b: Color, u: number): Color => ({
  r: a.r + (b.r - a.r) * u,
  g: a.g + (b.g - a.g) * u,
  b: a.b + (b.b - a.b) * u,
})

// --- The parts ----------------------------------------------------------------

/** One of the organisation's entities — a member or a partner — as a ring. */
export class FlowEntity extends Group {
  /** Is this entity real data (1) or a placeholder we are painting (0)? */
  certainty = certainty(1)
  ring!: Circle
  /** Its name inside the ring (members with a `label`; shown by `memberLabels`). */
  label?: Text
}

/** One slice of the stage stack: the group circle, its category discs, members and partners. */
export class FlowSlice extends Group {
  hull!: Circle
  discs: Circle[] = []
  sites: FlowEntity[] = []
  partners: FlowEntity[] = []
}

/** One flow: its channel and the particles running down it. */
export class Flow extends Group {
  certainty = certainty(1)
  line!: Line
  /** The particles themselves — filled Circles, the neutral "dot" symbol. */
  dots: Circle[] = []
  /** Each particle's carrier: positioned on the channel, turned to face the camera. */
  carriers: Group[] = []
  /**
   * The channel's full path, in the STACK's frame (`FlowMap.stack` — compose
   * with its transform for world space), sampled evenly in parameter.
   */
  path: () => Vec3[] = () => []
  /**
   * Each particle's place along `path()` as a fraction of its arc length,
   * s ∈ [0, 1] — or −1 while it is hidden in the pipe. Pure f(time).
   */
  particles: () => number[] = () => []
}

/** One step of the value chain — a layer of flows that can be shown, opened, ghosted. */
export class FlowStage extends Group {
  /** The layer on (1) or off (0): channels draw on, particles run. */
  shown = completion(0)
  /** The gap before the NEXT slice opened (1) or closed (0) when the map is expanded. */
  open = completion(1)
  /** Is this stage's knowledge real data (1) or a picture we are painting (0)? */
  certainty = certainty(1)
  /** What its particles are — the neutral dot until a richer symbol is asked for. */
  symbol = choice("dot", PARTICLE_SYMBOLS)
  stageId = ""
  flows: Flow[] = []
  label?: Text
}

// --- The holon -----------------------------------------------------------------

export class FlowMap extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The organisation, as plain data. A construction choice: it decides the parts. */
  data: FlowMapData = MOCK_FLOWMAP

  /** The group circle's radius, scene units. */
  radius = length(300)
  /** The categorical dimension: 0 uncategorised, 1 every member in its category's region. */
  grain = completion(0)
  /** The value chain's order: 0 flat and face-on, 1 turned into the stage stack. */
  expand = completion(0)
  /** How far the expanded stack turns to the side, radians (its heading at expand 1). */
  tilt = angle(1.22)
  /** How far it then dips toward the viewer, radians — the 3/4 view (its pitch at expand 1). */
  pitch = angle(0.42)
  /** Depth between consecutive slices of the expanded stack. */
  gap = length(380)
  /** Seconds of flow — advance it linearly and the particles run. */
  time = scalar(0)
  /** Particle speed along a channel, scene units per second. */
  speed = scalar(70)
  /** Arc length between consecutive particles at rate 1 (a rate-2 flow runs twice as dense). */
  spacing = length(52)
  /** How faint a channel is beside its particles. */
  channel = completion(0.38)
  /** Stage and category names: 1 shown, 0 off. */
  labels = completion(1)
  /**
   * Member names (each member's `label`) as small text inside its ring,
   * tinted as the ring is: 1 shown, 0 off (the default). Shown flat; they
   * fade as the stack turns (a facing name outgrows a foreshortened ring).
   */
  memberLabels = completion(0)
  /** Member ring size as a multiple of the default — smaller fits more members per region. */
  memberScale = scalar(1)
  /**
   * The group circle's presence. 1 drawn; 0 absent — so a morph can bring
   * it from elsewhere (the opening's connection lines) and hand over.
   */
  rim = completion(1)

  override states = {
    uncategorised: state({ grain: 0 }),
    categorised: state({ grain: 1 }),
    flat: state({ expand: 0 }),
    staged: state({ expand: 1 }),
  }

  /** The turning frame — every slice and flow lives in it. */
  stack!: Group
  slices: FlowSlice[] = []
  stages: FlowStage[] = []
  flows: Flow[] = []
  categoryLabels: Text[] = []
  /** The categories' legend, shown while the map is staged (where names by the discs would crowd). */
  legend!: Group

  /** A stage by id — its `shown`, `open`, `certainty` and `symbol` are the layer's controls. */
  stage(id: string): FlowStage {
    const s = this.stages.find((x) => x.stageId === id)
    if (!s) throw new Error(`FlowMap: no stage '${id}' (stages: ${this.stages.map((x) => x.stageId).join(", ")})`)
    return s
  }

  /**
   * The walkable state space (src/automaton.ts) — the player's game loop
   * (`?scene=flowmap&play=free`). Click the group circle or a category disc:
   * the grain. Click a stage name: its layer off/on. Staged, click a flow:
   * its gap folds/unfolds; flat, click a conjectural flow: its certainty
   * collapses into data (and back). Keys: g grain, e expand, l labels, the
   * digits for the rest. `time` is the clock, so the particles keep running.
   *
   * SEAMS. A flow's handle lists its axes in priority order and the first
   * walkable one fires — a Lens axis prepended there (`when` a lens exists)
   * makes "click the arrow, the lens opens" one line.
   */
  override stateSpace(): StateSpace {
    const flat = () => this.expand.value < 0.5
    const axes: Axis[] = [
      axis("grain", this, { uncategorised: this.states.uncategorised, categorised: this.states.categorised }, {
        key: "g",
        duration: 1.8,
        handles: () => this.slices.flatMap((s) => [s.hull, ...s.discs]),
      }),
      axis("expand", this, { flat: this.states.flat, staged: this.states.staged }, { key: "e", duration: 2.4 }),
      toggle("labels", this.labels, {
        key: "l",
        off: ["hidden", 0],
        on: ["shown", 1],
        handles: () => [...this.categoryLabels, ...this.stages.flatMap((s) => (s.label ? [s.label] : []))],
      }),
    ]
    this.data.stages.forEach((sd, i) => {
      const stage = this.stages[i]!
      const name = sd.label ?? sd.id
      axes.push(
        toggle(sd.id, stage.shown, {
          label: name,
          key: String(i + 1),
          off: ["hidden", 0],
          on: ["shown", 1],
          handles: () => (stage.label ? [stage.label] : []),
        }),
      )
    })
    this.data.stages.forEach((sd, i) => {
      const stage = this.stages[i]!
      const name = sd.label ?? sd.id
      axes.push(
        toggle(`${sd.id}.open`, stage.open, {
          label: `${name} gap`,
          off: ["closed", 0],
          on: ["open", 1],
          when: () => !flat() && stage.shown.value > 0.5,
          handles: () => stage.flows,
        }),
      )
      const declared = sd.certainty ?? 1
      if (declared < 1) {
        axes.push(
          toggle(`${sd.id}.certainty`, stage.certainty, {
            label: `${name} certainty`,
            off: ["conjecture", declared],
            on: ["data", 1],
            duration: 2,
            when: () => stage.shown.value > 0.5,
            handles: () => stage.flows,
          }),
        )
      }
    })
    return { axes, clocks: [this.time] }
  }

  // --- the pure state of the picture, memoised per param change ---------------

  // Memo slots — plain fields, not #-private: the holon is a Proxy.
  private memoLayout?: { flat: Vec2[]; categorised: Vec2[]; partners: Vec2[]; R: number; scale: number }
  private memoKey: number[] = []
  private memoFrame?: Frame

  /** A member ring's radius now. */
  private memberSize(): number {
    return memberRadius(this.radius.value) * this.memberScale.value
  }

  private layout() {
    const R = this.radius.value
    const scale = this.memberScale.value
    if (this.memoLayout && this.memoLayout.R === R && this.memoLayout.scale === scale) return this.memoLayout
    const d = this.data
    const cats = d.categories ?? []
    const of = d.members.map((m) => (m.categories ?? []).map((c) => cats.findIndex((k) => k.id === c)).filter((i) => i >= 0))
    const { flat, categorised } = memberLayouts(of, cats.length, R, this.memberSize())
    const partners = partnerLayout((d.partners ?? []).map((p) => p.side), R)
    this.memoLayout = { flat, categorised, partners, R, scale }
    return this.memoLayout
  }

  /** Everything the picture's geometry depends on, except time. */
  frame(): Frame {
    const key = [
      this.radius.value,
      this.memberScale.value,
      this.grain.value,
      this.expand.value,
      this.gap.value,
      this.tilt.value,
      this.pitch.value,
      ...this.stages.map((s) => s.open.value),
    ]
    if (this.memoFrame && key.length === this.memoKey.length && key.every((v, i) => v === this.memoKey[i])) return this.memoFrame
    this.memoKey = key
    const R = this.radius.value
    const g = this.grain.value
    const e = this.expand.value
    const L = this.layout()
    // One continuous motion: the turn leads, the slices fan out behind it.
    // Both are exactly 0 at expand 0 and exactly 1 at expand 1.
    const turn = smooth(0, 0.7, e)
    const spread = smooth(0.2, 1, e)
    const depths = sliceDepths(
      this.stages.map((s) => s.open.value),
      this.gap.value,
      spread,
    )
    const members = L.flat.map((f, i) => {
      const c = L.categorised[i]!
      return { x: f.x + (c.x - f.x) * g, y: f.y + (c.y - f.y) * g }
    })
    const visible = depths.map((z, k) => (k === 0 ? 1 : smooth(0.04, 0.4, (z - depths[k - 1]!) / Math.max(1e-6, this.gap.value))))
    this.memoFrame = {
      R,
      depths,
      visible,
      spread,
      heading: this.tilt.value * turn,
      pitch: this.pitch.value * turn,
      discs: categoryDiscs((this.data.categories ?? []).length, R, g),
      members,
      partners: L.partners,
    }
    return this.memoFrame
  }

  /** Where entity `id` sits in slice k, in the stack's frame. */
  private where(id: string, k: number): Vec3 {
    const f = this.frame()
    const m = this.memberIndex.get(id)
    const p = m !== undefined ? f.members[m]! : f.partners[this.partnerIndex.get(id)!]!
    return { x: p.x, y: p.y, z: f.depths[k]! }
  }

  private memberIndex = new Map<string, number>()
  private partnerIndex = new Map<string, number>()

  /**
   * Wrap a part so it always faces the camera, however the stack turns: the
   * stack is Rx(pitch)·Ry(heading), so a carrier turned Ry(−heading) holding
   * the part turned Rx(−pitch) cancels it exactly. Position the carrier.
   */
  private facing(part: Holon, at: { x?: Readable<number>; y?: Readable<number>; z?: Readable<number> }): Group {
    const inner = new Group({ members: [part], p: derive(() => -this.frame().pitch) })
    return new Group({ members: [inner], h: derive(() => -this.frame().heading), ...at })
  }

  protected override compose(): void {
    const d = this.data
    const cats = d.categories ?? []
    const partners = d.partners ?? []
    d.members.forEach((m, i) => this.memberIndex.set(m.id, i))
    partners.forEach((p, i) => this.partnerIndex.set(p.id, i))
    for (const f of d.flows) {
      for (const end of [f.from, f.to])
        if (!this.memberIndex.has(end) && !this.partnerIndex.has(end)) throw new Error(`FlowMap: flow names unknown entity '${end}'`)
      if (!d.stages.some((s) => s.id === f.stage)) throw new Error(`FlowMap: flow names unknown stage '${f.stage}'`)
    }
    const R = () => this.radius.value
    const stageIndex = (id: string): number => d.stages.findIndex((s) => s.id === id)
    const labelSize = () => R() * 0.085

    // --- the stages first: the slices' depths read their `open` -------------
    const stages = d.stages.map(
      (s) =>
        new FlowStage({
          stageId: s.id,
          certainty: s.certainty ?? 1,
          symbol: s.symbol ?? "dot",
        }),
    )
    this.stages = stages

    // --- the slices: one more than the stages (stage k runs k → k + 1) -------
    const sliceCount = d.stages.length + 1
    const slices: FlowSlice[] = []
    for (let k = 0; k < sliceCount; k++) {
      const vis: Readable<number> = derive(() => this.frame().visible[k]!)
      const ringed: Readable<number> = derive(() => this.frame().visible[k]! * this.rim.value)
      const hull = new Circle({ radius: this.radius, stroke: 3, opacity: ringed })
      const discs = cats.map(
        (c, i) =>
          new Circle({
            stroke: 3,
            radius: derive(() => this.frame().discs[i]!.radius),
            x: derive(() => this.frame().discs[i]!.x),
            y: derive(() => this.frame().discs[i]!.y),
            tint: derive(() => mix(WHITE, c.tint ?? CATEGORY_TINTS[i % CATEGORY_TINTS.length]!, smooth(0, 0.45, this.grain.value))),
            // At grain 0 a disc IS the group circle, so it shares the rim's presence.
            opacity: derive(() => this.frame().visible[k]! * Math.max(this.rim.value, smooth(0, 0.3, this.grain.value))),
          }),
      )
      const members = d.members.map((m, i) => {
        const home = (m.categories ?? []).map((c) => cats.findIndex((x) => x.id === c)).filter((j) => j >= 0)
        const tint = home.length === 1 ? (cats[home[0]!]!.tint ?? CATEGORY_TINTS[home[0]! % CATEGORY_TINTS.length]!) : WHITE
        const ringTint = derive(() => mix(WHITE, tint, this.grain.value))
        const ring = new Circle({
          radius: derive(() => this.memberSize()),
          stroke: 2.5,
          tint: ringTint,
          opacity: vis,
        })
        // Its name, centred in the ring and facing the camera; it inherits
        // the entity's certainty like the ring does.
        const label = m.label
          ? new Text({
              content: m.label,
              size: derive(() => this.memberSize() * 0.7),
              tint: ringTint,
              // Read while flat; once the stack turns, a camera-facing name
              // outgrows its foreshortened ring, so it steps aside.
              opacity: derive(() => this.frame().visible[k]! * this.memberLabels.value * (1 - smooth(0, 0.4, this.expand.value))),
            })
          : undefined
        const e = new FlowEntity({
          members: label ? [ring, this.facing(label, { y: derive(() => -this.memberSize() * 0.25) })] : [ring],
          certainty: m.certainty ?? 1,
          x: derive(() => this.frame().members[i]!.x),
          y: derive(() => this.frame().members[i]!.y),
        })
        e.ring = ring
        e.label = label
        return e
      })
      const outer = partners.map((p, i) => {
        // A partner appears in the slices where it takes part — as the
        // source of stage k's flows or the target of stage k − 1's. Flat,
        // slice 0 stands for all of them, so it shows every partner until
        // the stack opens.
        const used = d.flows.some(
          (f) => (f.from === p.id && stageIndex(f.stage) === k) || (f.to === p.id && stageIndex(f.stage) === k - 1),
        )
        const ring = new Circle({
          radius: derive(() => this.memberSize()),
          stroke: 2.5,
          tint: PARTNER_TINT,
          opacity: used
            ? vis
            : k === 0
              ? derive(() => 1 - smooth(0, 0.5, this.expand.value))
              : 0,
        })
        const e = new FlowEntity({
          members: [ring],
          certainty: p.certainty ?? 1,
          x: derive(() => this.frame().partners[i]!.x),
          y: derive(() => this.frame().partners[i]!.y),
        })
        e.ring = ring
        return e
      })
      // Category names ride the front slice, by their discs, outside the rim
      // on the left (clear of the partners): shown with the grain.
      const named: Holon[] = []
      if (k === 0) {
        cats.forEach((c, i) => {
          if (!c.label) return
          const dir = categoryDirection(i, cats.length)
          const a = Math.atan2(dir.y, dir.x) + (dir.y >= 0 ? 0.62 : -0.62)
          const text = new Text({
            content: c.label,
            size: derive(labelSize),
            tint: c.tint ?? CATEGORY_TINTS[i % CATEGORY_TINTS.length]!,
            // By its disc while flat; the legend takes over once staged.
            opacity: derive(() => this.labels.value * smooth(0.5, 1, this.grain.value) * (1 - smooth(0, 0.5, this.expand.value))),
          })
          this.categoryLabels.push(text)
          named.push(
            this.facing(text, {
              x: derive(() => Math.cos(a) * R() * 1.28),
              y: derive(() => Math.sin(a) * R() * 1.28 - labelSize() * 0.35),
            }),
          )
        })
      }
      const slice = new FlowSlice({
        members: [hull, ...discs, ...members, ...outer, ...named],
        z: derive(() => this.frame().depths[k]!),
      })
      slice.hull = hull
      slice.discs = discs
      slice.sites = members
      slice.partners = outer
      slices.push(slice)
    }
    this.slices = slices

    // --- the flows: channel + particles, in their stage's layer -------------
    const flows: Flow[] = []
    d.flows.forEach((f, fi) => {
      const si = stageIndex(f.stage)
      const stage = stages[si]!
      const sd = d.stages[si]!
      const tint = sd.tint ?? STAGE_TINTS[si % STAGE_TINTS.length]!
      const flowCertainty = f.certainty ?? 1
      // Each flow bows its own way, so flows sharing ends stay apart; staged,
      // a gap's flows also fan apart vertically at their middles (rank in
      // the stage, by source height), so a bundle reads as separate strands
      // instead of funnelling through one spot.
      const bend = 0.16 * (fi % 2 === 0 ? 1 : -1)
      const peers = d.flows.filter((g) => g.stage === f.stage)
      const height = (id: string): number => {
        const m = this.memberIndex.get(id)
        const L = this.layout()
        return m !== undefined ? L.categorised[m]!.y : L.partners[this.partnerIndex.get(id)!]!.y
      }
      const order = peers.map((g, i) => ({ i, y: height(g.from) + 0.5 * height(g.to) })).sort((x, y) => y.y - x.y || x.i - y.i)
      const rank = order.findIndex((o) => peers[o.i] === f)
      const fan = (rank - (peers.length - 1) / 2) / Math.max(1, peers.length - 1)
      const ends = (): [Vec3, Vec3] => {
        const a0 = this.where(f.from, si)
        const b0 = this.where(f.to, si + 1)
        const rim = this.memberSize() * 1.9
        return [trimToRim(a0, b0, rim), trimToRim(b0, a0, rim)]
      }
      // The channel's arc-length table, once per frame of the picture.
      let tableFrame: Frame | undefined
      let table: { points: Vec3[]; lengths: number[] } = { points: [], lengths: [0] }
      const channel = () => {
        const fr = this.frame()
        if (tableFrame !== fr) {
          tableFrame = fr
          const [a, b] = ends()
          const lift = fan * R() * 1.5 * fr.spread
          table = arcTable((u) => flowPoint(a, b, u, bend, lift), 48)
        }
        return table
      }
      const line = new Line({
        tint,
        stroke: 2,
        arrowEnd: true,
        arrowSize: 1.05,
        opacity: derive(() => this.channel.value * smooth(0, 0.15, stage.shown.value)),
      })
      // The channel draws on from source to target as its layer is shown —
      // never empty, so the host always has a ribbon and an arrowhead.
      deriveChannel(line, () => [this.frame(), stage.shown.value], () => {
        const { points, lengths } = channel()
        const total = lengths[lengths.length - 1]!
        const reach = Math.max(0.02, stage.shown.value) * total
        const pts: Vec3Like[] = []
        const N = 32
        for (let j = 0; j <= N; j++) pts.push(atArcLength(points, lengths, (j / N) * reach))
        return pts
      })

      // Particles: evenly spaced by arc length, `spacing / rate` apart, at
      // `speed`. The pool covers the longest this channel can get; particles
      // past its current end are "in the pipe" and hidden, so a short channel
      // simply carries fewer, at the same spacing.
      const rate = f.rate ?? 1
      const sp = () => this.spacing.value / rate
      const longest = 1.15 * Math.hypot(2.9 * this.radius.value, this.gap.value)
      const n = Math.max(2, Math.ceil(longest / (this.spacing.value / rate)))
      const seed = fi * 7.31 + 0.37
      const dots: Circle[] = []
      const carriers: Group[] = []
      for (let j = 0; j < n; j++) {
        let memoT = Number.NaN
        let memoF: Frame | undefined
        let memoShown = Number.NaN
        let memo = { x: 0, y: 0, z: 0, o: 0 }
        const cur = () => {
          const fr = this.frame()
          const shown = stage.shown.value
          if (memoT === this.time.value && memoF === fr && memoShown === shown) return memo
          memoT = this.time.value
          memoF = fr
          memoShown = shown
          const { points, lengths } = channel()
          const L = lengths[lengths.length - 1]!
          const s = streamArc(j, n, sp(), this.speed.value, this.time.value, seed % 1)
          const o = streamFade(s, L, shown)
          const p = atArcLength(points, lengths, Math.min(s, L))
          const c = stage.certainty.value * flowCertainty
          const w = wobble(seed * 13 + j, this.time.value, c, R() * 0.035)
          memo = { x: p.x + w.x, y: p.y + w.y, z: p.z, o }
          return memo
        }
        const dot = new Circle({
          radius: derive(() => R() * 0.02),
          stroke: 0,
          fillOpacity: 1,
          tint,
          opacity: derive(() => cur().o),
        })
        dots.push(dot)
        carriers.push(
          this.facing(dot, {
            x: derive(() => cur().x),
            y: derive(() => cur().y),
            z: derive(() => cur().z),
          }),
        )
      }
      const flow = new Flow({ members: [line, ...carriers], certainty: flowCertainty })
      flow.line = line
      flow.dots = dots
      flow.carriers = carriers
      flow.path = () => channel().points
      flow.particles = () => {
        const { lengths } = channel()
        const L = lengths[lengths.length - 1]!
        return dots.map((_, j) => {
          const s = streamArc(j, n, sp(), this.speed.value, this.time.value, seed % 1)
          return s > L || L <= 0 ? -1 : s / L
        })
      }
      flows.push(flow)
      ;(stage as unknown as { add(h: Holon): Holon }).add(flow)
      stage.flows.push(flow)
    })
    this.flows = flows

    // --- stage names under the stack, between the slices they join ----------
    d.stages.forEach((sd, si) => {
      if (!sd.label) return
      const stage = stages[si]!
      const text = new Text({
        content: sd.label,
        size: derive(labelSize),
        tint: LABEL_TINT,
        opacity: derive(() => this.labels.value * stage.shown.value * smooth(0.6, 1, this.expand.value)),
      })
      stage.label = text
      ;(stage as unknown as { add(h: Holon): Holon }).add(
        this.facing(text, {
          y: derive(() => -R() * 1.5),
          z: derive(() => (this.frame().depths[si]! + this.frame().depths[si + 1]!) / 2),
        }),
      )
    })

    // --- the legend: categories, top left, while staged --------------------
    const legendRows: Holon[] = []
    cats.forEach((c, i) => {
      const tint = c.tint ?? CATEGORY_TINTS[i % CATEGORY_TINTS.length]!
      const shown = derive(() => this.labels.value * smooth(0.5, 1, this.grain.value) * smooth(0.5, 1, this.expand.value))
      const y = derive(() => R() * (1.62 - 0.16 * i))
      legendRows.push(
        new Circle({ radius: derive(() => R() * 0.03), stroke: 0, fillOpacity: 1, tint, opacity: shown, x: derive(() => -R() * 2.05), y }),
        new Text({
          content: c.label ?? c.id,
          size: derive(labelSize),
          tint,
          align: "left",
          opacity: shown,
          x: derive(() => -R() * 1.97),
          y: derive(() => R() * (1.62 - 0.16 * i) - labelSize() * 0.35),
        }),
      )
    })
    this.legend = this.add(new Group({ members: legendRows }))

    this.stack = this.add(
      new Group({
        members: [...slices, ...stages],
        h: derive(() => this.frame().heading),
        p: derive(() => this.frame().pitch),
      }),
    )
  }

  /**
   * Create: the group circle draws first, its category discs with it; the
   * members ripple in from the centre outward; the partners after them,
   * round the ring. Flows are not created — they are shown, layer by layer.
   */
  override createAnim(): Anim {
    void this.parts // the parts exist once compose() has run
    const L = this.layout()
    const byDistance = (pts: readonly Vec2[]) => {
      const order = pts.map((p, i) => ({ i, d: Math.hypot(p.x, p.y) })).sort((a, b) => a.d - b.d || a.i - b.i)
      const rank = new Array<number>(pts.length)
      order.forEach((o, r) => (rank[o.i] = r))
      return rank
    }
    const memberRank = byDistance(L.flat)
    const partnerAngle = L.partners.map((p) => Math.atan2(p.y, p.x))
    const partnerOrder = partnerAngle.map((a, i) => ({ a: (Math.PI - a + 2 * Math.PI) % (2 * Math.PI), i })).sort((x, y) => x.a - y.a || x.i - y.i)
    const partnerRank = new Array<number>(L.partners.length)
    partnerOrder.forEach((o, r) => (partnerRank[o.i] = r))
    const parts: [Anim, number, number][] = []
    const nm = Math.max(1, this.data.members.length)
    const np = Math.max(1, L.partners.length)
    for (const slice of this.slices) {
      parts.push([slice.hull.creation.sequence(0, 1), 0, 0.45])
      for (const disc of slice.discs) parts.push([disc.creation.sequence(0, 1), 0, 0.45])
      slice.sites.forEach((e, i) => {
        const a = 0.25 + 0.4 * (memberRank[i]! / nm)
        parts.push([e.ring.creation.sequence(0, 1), a, a + 0.18])
      })
      slice.partners.forEach((e, i) => {
        const a = 0.55 + 0.3 * (partnerRank[i]! / np)
        parts.push([e.ring.creation.sequence(0, 1), a, a + 0.15])
      })
    }
    return together(...parts)
  }
}

/** A member's ring radius for a group of radius R. */
const memberRadius = (R: number): number => R * 0.058

interface Frame {
  R: number
  depths: number[]
  visible: number[]
  /** How far the slices have fanned out (0 flat … 1 staged). */
  spread: number
  /** The stack's turn this frame: heading, then pitch (radians). */
  heading: number
  pitch: number
  discs: Disc[]
  members: Vec2[]
  partners: Vec2[]
}

/** The board's own colours: raw material blue, semi-finished white, finished red. */
const STAGE_TINTS: Color[] = [BLUE, WHITE, RED]

/**
 * Give a Line derived `points`, recomputed when any of `deps` changes —
 * bumping `geomVersion` so the host regenerates its ribbon (the memo pattern
 * of Globe's deriveRing and curves.ts's derivePoints).
 */
const deriveChannel = (line: Line, deps: () => unknown[], compute: () => Vec3Like[]): void => {
  let key: unknown[] | undefined
  let memo: Vec3Like[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get() {
      const next = deps()
      if (!key || next.length !== key.length || next.some((v, i) => v !== key![i])) {
        key = next
        memo = compute()
        line.geomVersion++
      }
      return memo
    },
    set(_v) {},
  })
}

// --- Mock data: generic, illustrative, no real organisation ---------------------

/**
 * A mock group: eleven sites in two categories (three of them both),
 * suppliers, customers and two-way partners, and a three-step value chain
 * whose first step — raw material in — is conjecture (ghosted) while the
 * rest is data.
 */
export const MOCK_FLOWMAP: FlowMapData = {
  categories: [
    { id: "extrusion", label: "extrusion", tint: RED },
    { id: "conversion", label: "conversion", tint: BLUE },
  ],
  members: [
    { id: "A", label: "Site A", categories: ["extrusion"] },
    { id: "B", label: "Site B", categories: ["extrusion"] },
    { id: "C", label: "Site C", categories: ["extrusion", "conversion"] },
    { id: "D", label: "Site D", categories: ["conversion"] },
    { id: "E", label: "Site E", categories: ["conversion"] },
    { id: "F", label: "Site F", categories: ["conversion"] },
    { id: "G", label: "Site G", categories: ["extrusion", "conversion"] },
    { id: "H", label: "Site H", categories: ["conversion"] },
    { id: "I", label: "Site I", categories: ["extrusion"] },
    { id: "J", label: "Site J", categories: ["conversion"] },
    { id: "K", label: "Site K", categories: ["extrusion", "conversion"] },
  ],
  partners: [
    { id: "S1", label: "Supplier 1", side: "in" },
    { id: "S2", label: "Supplier 2", side: "in" },
    { id: "S3", label: "Supplier 3", side: "in" },
    { id: "P1", label: "Partner 1", side: "both" },
    { id: "P2", label: "Partner 2", side: "both" },
    { id: "K1", label: "Customer 1", side: "out" },
    { id: "K2", label: "Customer 2", side: "out" },
    { id: "K3", label: "Customer 3", side: "out" },
  ],
  stages: [
    { id: "raw", label: "raw material in", certainty: 0.15 },
    { id: "semi", label: "semi-finished" },
    { id: "finished", label: "finished product out" },
  ],
  flows: [
    // Raw material in: suppliers → the extruding sites. Conjecture for now.
    { from: "S1", to: "A", stage: "raw", rate: 1.5 },
    { from: "S1", to: "I", stage: "raw" },
    { from: "S2", to: "B", stage: "raw" },
    { from: "S2", to: "C", stage: "raw" },
    { from: "S3", to: "G", stage: "raw" },
    { from: "S3", to: "K", stage: "raw", rate: 0.5 },
    // Semi-finished: intercompany (extrusion → conversion), plus to and from outside.
    { from: "A", to: "D", stage: "semi", rate: 1.5 },
    { from: "B", to: "E", stage: "semi" },
    { from: "C", to: "F", stage: "semi" },
    { from: "G", to: "H", stage: "semi" },
    { from: "I", to: "J", stage: "semi" },
    { from: "A", to: "P1", stage: "semi", rate: 0.5 },
    { from: "P2", to: "E", stage: "semi", rate: 0.5 },
    // Finished product out: conversion sites → customers.
    { from: "D", to: "K1", stage: "finished", rate: 1.5 },
    { from: "E", to: "K2", stage: "finished" },
    { from: "F", to: "K2", stage: "finished" },
    { from: "H", to: "K3", stage: "finished" },
    { from: "J", to: "K3", stage: "finished" },
    { from: "C", to: "K1", stage: "finished", rate: 0.5 },
    { from: "K", to: "K2", stage: "finished", rate: 0.5 },
  ],
}
