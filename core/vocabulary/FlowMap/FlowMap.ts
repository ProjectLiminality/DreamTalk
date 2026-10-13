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
 *                    tilts to the side and becomes a stack of identical
 *                    slices along a depth axis — one per step of the chain —
 *                    and each stage's flows run from its slice to the next.
 *                    Inflow converges (contraction), outflow fans out
 *                    (expansion). Collapsing lays it flat and face-on again,
 *                    exactly.
 *   stage(id).open   one gap of the stack opened or closed — stages collapse
 *                    and expand individually but can never reorder: a slice's
 *                    depth is the running sum of the gaps before it.
 *   time             seconds of flow — particles are a pure f(time).
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
import { angle, choice, completion, derive, integer, length, scalar, state, type Readable } from "../../src/params"
import { BLUE, GREEN, PURPLE, RED, WHITE, YELLOW, rgb, type Color } from "../../src/constants"
import { certainty, wobble } from "../../src/certainty"
import {
  categoryDiscs,
  flowPoint,
  memberLayouts,
  partnerLayout,
  sliceDepths,
  smooth,
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
  dots: Circle[] = []
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
  /** The value chain's order: 0 flat and face-on, 1 tilted into the stage stack. */
  expand = completion(0)
  /** How far the expanded stack turns to the side, radians (the map's heading at expand 1). */
  tilt = angle(1.05)
  /** Depth between consecutive slices of the expanded stack. */
  gap = length(400)
  /** Seconds of flow — advance it linearly and the particles run. */
  time = scalar(0)
  /** Particle speed: fraction of a channel travelled per second. */
  speed = scalar(0.16)
  /** Particles per flow at rate 1 (construction: decides how many particles exist). */
  particles = integer(4)
  /** How faint a channel is beside its particles. */
  channel = completion(0.38)

  override states = {
    uncategorised: state({ grain: 0 }),
    categorised: state({ grain: 1 }),
    flat: state({ expand: 0 }),
    staged: state({ expand: 1 }),
  }

  /** The tilting frame — every slice and flow lives in it. */
  stack!: Group
  slices: FlowSlice[] = []
  stages: FlowStage[] = []
  flows: Flow[] = []

  /** A stage by id — its `shown`, `open`, `certainty` and `symbol` are the layer's controls. */
  stage(id: string): FlowStage {
    const s = this.stages.find((x) => x.stageId === id)
    if (!s) throw new Error(`FlowMap: no stage '${id}' (stages: ${this.stages.map((x) => x.stageId).join(", ")})`)
    return s
  }

  // --- the pure state of the picture, memoised per param change ---------------

  // Memo slots — plain fields, not #-private: the holon is a Proxy.
  private memoLayout?: { flat: Vec2[]; categorised: Vec2[]; partners: Vec2[]; R: number }
  private memoKey: number[] = []
  private memoFrame?: Frame

  private layout() {
    const R = this.radius.value
    if (this.memoLayout && this.memoLayout.R === R) return this.memoLayout
    const d = this.data
    const cats = d.categories ?? []
    const of = d.members.map((m) => (m.categories ?? []).map((c) => cats.findIndex((k) => k.id === c)).filter((i) => i >= 0))
    const { flat, categorised } = memberLayouts(of, cats.length, R, memberRadius(R))
    const partners = partnerLayout((d.partners ?? []).map((p) => p.side), R)
    this.memoLayout = { flat, categorised, partners, R }
    return this.memoLayout
  }

  /** Everything the picture's geometry depends on, except time. */
  frame(): Frame {
    const key = [this.radius.value, this.grain.value, this.expand.value, this.gap.value, ...this.stages.map((s) => s.open.value)]
    if (this.memoFrame && key.every((v, i) => v === this.memoKey[i]) && key.length === this.memoKey.length) return this.memoFrame
    this.memoKey = key
    const R = this.radius.value
    const g = this.grain.value
    const L = this.layout()
    const depths = sliceDepths(
      this.stages.map((s) => s.open.value),
      this.gap.value,
      this.expand.value,
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
      discs: categoryDiscs((this.data.categories ?? []).length, R, g),
      members,
      partners: L.partners,
    }
    return this.memoFrame
  }

  /** Where entity `id` sits in slice k, in the stack's frame. */
  private where(id: string, k: number): Vec3 {
    const f = this.frame()
    const m = this.data.members.findIndex((x) => x.id === id)
    const p = m >= 0 ? f.members[m]! : f.partners[(this.data.partners ?? []).findIndex((x) => x.id === id)]!
    return { x: p.x, y: p.y, z: f.depths[k]! }
  }

  protected override compose(): void {
    const d = this.data
    const cats = d.categories ?? []
    const partners = d.partners ?? []
    const ids = new Set([...d.members.map((m) => m.id), ...partners.map((p) => p.id)])
    for (const f of d.flows) {
      for (const end of [f.from, f.to]) if (!ids.has(end)) throw new Error(`FlowMap: flow names unknown entity '${end}'`)
      if (!d.stages.some((s) => s.id === f.stage)) throw new Error(`FlowMap: flow names unknown stage '${f.stage}'`)
    }

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

    const stageIndex = (id: string): number => d.stages.findIndex((s) => s.id === id)

    // --- the slices: one more than the stages (stage k runs k → k + 1) -------
    const R = () => this.radius.value
    const sliceCount = d.stages.length + 1
    const slices: FlowSlice[] = []
    for (let k = 0; k < sliceCount; k++) {
      const vis: Readable<number> = derive(() => this.frame().visible[k]!)
      const hull = new Circle({ radius: this.radius, stroke: 3, opacity: vis })
      const discs = cats.map(
        (c, i) =>
          new Circle({
            stroke: 3,
            radius: derive(() => this.frame().discs[i]!.radius),
            x: derive(() => this.frame().discs[i]!.x),
            y: derive(() => this.frame().discs[i]!.y),
            tint: derive(() => mix(WHITE, c.tint ?? CATEGORY_TINTS[i % CATEGORY_TINTS.length]!, smooth(0, 0.45, this.grain.value))),
            opacity: vis,
          }),
      )
      const members = d.members.map((m, i) => {
        const home = (m.categories ?? []).map((c) => cats.findIndex((x) => x.id === c)).filter((j) => j >= 0)
        const tint = home.length === 1 ? (cats[home[0]!]!.tint ?? CATEGORY_TINTS[home[0]! % CATEGORY_TINTS.length]!) : WHITE
        const ring = new Circle({
          radius: derive(() => memberRadius(R())),
          stroke: 2.5,
          tint: derive(() => mix(WHITE, tint, this.grain.value)),
          opacity: vis,
        })
        const e = new FlowEntity({
          members: [ring],
          certainty: m.certainty ?? 1,
          x: derive(() => this.frame().members[i]!.x),
          y: derive(() => this.frame().members[i]!.y),
        })
        e.ring = ring
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
          radius: derive(() => memberRadius(R())),
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
      const slice = new FlowSlice({
        members: [hull, ...discs, ...members, ...outer],
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
    const heading = derive(() => this.tilt.value * this.expand.value)
    const unturn = derive(() => -this.tilt.value * this.expand.value)
    const flows: Flow[] = []
    d.flows.forEach((f, fi) => {
      const si = d.stages.findIndex((s) => s.id === f.stage)
      const stage = stages[si]!
      const sd = d.stages[si]!
      const tint = sd.tint ?? STAGE_TINTS[si % STAGE_TINTS.length]!
      const flowCertainty = f.certainty ?? 1
      // Each flow bows its own way, so flows sharing ends stay apart.
      const bend = 0.16 * (fi % 2 === 0 ? 1 : -1)
      const ends = (): [Vec3, Vec3] => {
        const a0 = this.where(f.from, si)
        const b0 = this.where(f.to, si + 1)
        const rim = memberRadius(R()) * 1.9
        return [trimToRim(a0, b0, rim), trimToRim(b0, a0, rim)]
      }
      const at = (u: number): Vec3 => {
        const [a, b] = ends()
        return flowPoint(a, b, u, bend)
      }
      const line = new Line({
        tint,
        stroke: 2,
        arrowEnd: true,
        arrowSize: 1.3,
        opacity: derive(() => this.channel.value * smooth(0, 0.15, stage.shown.value)),
      })
      deriveChannel(line, () => [this.frame(), stage.shown.value], () => {
        // The channel draws on as its layer is shown: never empty, so the
        // host always has a ribbon and an arrowhead to drive.
        const reach = Math.max(0.02, stage.shown.value)
        const pts: Vec3Like[] = []
        const N = 32
        for (let j = 0; j <= N; j++) pts.push(at((j / N) * reach))
        return pts
      })

      const n = Math.max(1, Math.round(this.particles.value * (f.rate ?? 1)))
      const seed = fi * 7.31 + 0.37
      const dots: Circle[] = []
      for (let j = 0; j < n; j++) {
        // u along the channel: evenly spaced, running at `speed`.
        const u = (): number => {
          const v = this.time.value * this.speed.value + j / n + (seed % 1)
          return v - Math.floor(v)
        }
        const pos = (): Vec3 => {
          const p = at(u())
          const c = stage.certainty.value * flowCertainty
          const w = wobble(seed * 13 + j, this.time.value, c, R() * 0.035)
          return { x: p.x + w.x, y: p.y + w.y, z: p.z }
        }
        let memoT = Number.NaN
        let memoF: Frame | undefined
        let memoP: Vec3 = { x: 0, y: 0, z: 0 }
        const cur = (): Vec3 => {
          const fr = this.frame()
          if (memoT !== this.time.value || memoF !== fr) {
            memoT = this.time.value
            memoF = fr
            memoP = pos()
          }
          return memoP
        }
        dots.push(
          new Circle({
            radius: derive(() => R() * 0.02),
            stroke: 0,
            fillOpacity: 1,
            tint,
            x: derive(() => cur().x),
            y: derive(() => cur().y),
            z: derive(() => cur().z),
            // Particles face the camera however the stack turns.
            h: unturn,
            opacity: derive(() => {
              const s = stage.shown.value
              const v = u()
              // Only on the channel already drawn; soft at both ends.
              return smooth(0, 0.08, v) * smooth(1, 0.9, v) * smooth(0, 0.06, s - v)
            }),
          }),
        )
      }
      const flow = new Flow({ members: [line, ...dots], certainty: flowCertainty })
      flow.line = line
      flow.dots = dots
      flows.push(flow)
      ;(stage as unknown as { add(h: Flow): Flow }).add(flow)
      stage.flows.push(flow)
    })
    this.flows = flows

    this.stack = this.add(new Group({ members: [...slices, ...stages], h: heading }))
  }
}

/** A member's ring radius for a group of radius R. */
const memberRadius = (R: number): number => R * 0.058

interface Frame {
  R: number
  depths: number[]
  visible: number[]
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
 * A mock group: eight sites in two categories (two of them both), suppliers,
 * customers and two-way partners, and a three-step value chain whose first
 * step — raw material in — is conjecture (ghosted) while the rest is data.
 */
export const MOCK_FLOWMAP: FlowMapData = {
  categories: [
    { id: "extrusion", label: "Extrusion", tint: RED },
    { id: "conversion", label: "Conversion", tint: BLUE },
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
    { id: "semi", label: "semi-finished product" },
    { id: "finished", label: "finished product out" },
  ],
  flows: [
    // Raw material in: suppliers → the extruding sites. Conjecture for now.
    { from: "S1", to: "A", stage: "raw", rate: 1.5 },
    { from: "S2", to: "B", stage: "raw" },
    { from: "S2", to: "C", stage: "raw" },
    { from: "S3", to: "G", stage: "raw" },
    // Semi-finished: intercompany (extrusion → conversion), plus to and from outside.
    { from: "A", to: "D", stage: "semi", rate: 1.5 },
    { from: "B", to: "E", stage: "semi" },
    { from: "C", to: "F", stage: "semi" },
    { from: "G", to: "H", stage: "semi" },
    { from: "A", to: "P1", stage: "semi", rate: 0.5 },
    { from: "P2", to: "E", stage: "semi", rate: 0.5 },
    // Finished product out: conversion sites → customers.
    { from: "D", to: "K1", stage: "finished", rate: 1.5 },
    { from: "E", to: "K2", stage: "finished" },
    { from: "F", to: "K2", stage: "finished" },
    { from: "H", to: "K3", stage: "finished" },
    { from: "C", to: "K1", stage: "finished", rate: 0.5 },
  ],
}
