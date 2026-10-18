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
 * Circle — the neutral `symbol` "dot". A stage whose data names a material
 * `symbol` (pallet, octabin, reel, pouch, sheets) carries Grains instead
 * (vocabulary/Grain): at its `rung` 1 a Grain IS the dot in the stage's
 * colour; `rung` 2 morphs every particle into that material's symbol.
 */

import { derivePoints, Circle, Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { invRotHPB } from "../../src/parts/curves"
import { angle, choice, completion, derive, length, noteReads, quietEpoch, scalar, state, trackReads, type Param, type Readable, type Reads } from "../../src/params"
import { together, type Anim } from "../../src/anim"
import { BLUE, GREEN, PURPLE, RED, WHITE, YELLOW, rgb, type Color } from "../../src/constants"
import type { Holon } from "../../src/holon"
import { certainty, presence, presencesOf, wobble } from "../../src/certainty"
import type { Observer } from "../../src/dream"
import type { SolidDrawing } from "../../src/parts/soliddrawing"
import { Grain, NEUTRAL } from "../Grain/Grain"
import { FlowRoad } from "../Road/FlowRoad"
import { Pallet } from "../Pallet/Pallet"
import { FilmReel } from "../FilmReel/FilmReel"
import { Pouch } from "../Pouch/Pouch"
import { SheetStack } from "../SheetStack/SheetStack"
import { Carton } from "../Carton/Carton"
import { Sack } from "../Sack/Sack"
import { LabelRoll } from "../LabelRoll/LabelRoll"
import { Drum } from "../Drum/Drum"
import { Coin } from "../Coin/Coin"
import { axis, toggle, type Axis, type StateSpace } from "../../src/automaton"
import { peakValue, peakVolume, seriesAt, thinning } from "./table"
import {
  arcTable,
  atArcLength,
  categoryDiscs,
  categoryDirection,
  flowPoint,
  memberLayouts,
  partnerRing,
  sliceDepths,
  smooth,
  streamArc,
  streamFade,
  trimToRim,
  facingAngles,
  clearYaw,
  fiberRings,
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
  partners?: {
    id: string
    label?: string
    side: PartnerSide
    certainty?: number
    /**
     * Its class on the ring (default: its side). Each class is spread round
     * the whole circle as its own regular polygon (geometry partnerRing).
     */
    class?: string
  }[]
  /**
   * The value chain, IN ORDER — the order is the point and never changes.
   * Stage k's flows run from slice k to slice k + 1 of the expanded stack.
   */
  stages: {
    id: string
    label?: string
    tint?: Color
    certainty?: number
    symbol?: ParticleSymbol
    /**
     * How sure the material TYPE is (its symbol) — Grain's rung-2
     * certainty: below 1 a guessed type ghosts at rung 2 while the dot
     * rungs stay solid. Default 1.
     */
    typeKnown?: number
  }[]
  /** A flow of value from one entity (member or partner id) to another, in a stage. */
  flows: {
    from: string
    to: string
    stage: string
    rate?: number
    certainty?: number
    /**
     * Volume per period (in `periods` order): a number is data (0 = nothing
     * moved), null is no data — drawn as conjecture. With a series, the
     * flow's density and width follow its volume at `period`, and its
     * certainty follows the data's coverage. See table.ts.
     */
    series?: (number | null)[]
    /**
     * Money per period for the same flow (in `currency`), when the table
     * had a value or price. Money runs the OTHER way down the channel —
     * every value flow comes with its inverse money flow. Without it, the
     * money lane is drawn as conjecture.
     */
    valueSeries?: (number | null)[]
  }[]
  /** The time axis the flows' series run along, in order ("2026-01", …). */
  periods?: string[]
  /** What the series measure ("t", "pallets", …). */
  unit?: string
  /** What `valueSeries` is counted in ("EUR", "k€", …). */
  currency?: string
}

/** What a particle is drawn as: the neutral dot, or a material it can become (a Grain's type symbol). */
export const PARTICLE_SYMBOLS = [
  "dot",
  "pallet",
  "octabin",
  "reel",
  "pouch",
  "sheets",
  "carton",
  "sack",
  "labels",
  "drum",
  "coin",
] as const
export type ParticleSymbol = (typeof PARTICLE_SYMBOLS)[number]

/** The material symbols, by name (vocabulary/Pallet, FilmReel, Pouch, SheetStack, Carton, Sack, LabelRoll, Drum, Coin). */
const MATERIALS: Record<Exclude<ParticleSymbol, "dot">, (o: ConstructorParameters<typeof Pallet>[0]) => SolidDrawing> = {
  pallet: (o) => new Pallet(o),
  octabin: (o) => new Pallet({ ...o, load: "octabin" }),
  reel: (o) => new FilmReel(o),
  pouch: (o) => new Pouch(o),
  sheets: (o) => new SheetStack(o),
  carton: (o) => new Carton(o),
  sack: (o) => new Sack(o),
  labels: (o) => new LabelRoll(o),
  drum: (o) => new Drum(o),
  coin: (o) => new Coin({ ...o, count: 3 }),
}

/** Symbols that must not be seen down an axis (their class's `spindle`), by name. */
const SPINDLES: Partial<Record<ParticleSymbol, { x: number; z: number }>> = {
  reel: FilmReel.spindle,
  labels: LabelRoll.spindle,
}

const CATEGORY_TINTS: Color[] = [RED, BLUE, GREEN, YELLOW, PURPLE]
const PARTNER_TINT = rgb(150, 150, 150)
const LABEL_TINT = rgb(170, 170, 170)
/** Money's colour — the coins and their lane. */
const GOLD = rgb(236, 190, 72)
const GOLD_DEEP = rgb(150, 110, 30)

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
  /** There (1) or gone (0) — a site focus keeps only its fiber. */
  presence = presence(1)
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
  /** There (1) or gone (0) — a site focus keeps only its fiber's flows. */
  presence = presence(1)
  line!: Line
  /** The particles themselves — filled Circles (the neutral "dot"), or Grains in a material stage. */
  dots: (Circle | Grain)[] = []
  /** Each particle's carrier: positioned on the channel, turned to face the camera. */
  carriers: Group[] = []
  /** The inverse flow: money, back down the same channel (see FlowMap.money). */
  money?: MoneyLane
  /** The flow made concrete: its road and trucks (stage(id).concrete) — when the map was built with `roads`. */
  road?: FlowRoad
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

/** A flow's money lane: its channel (pointing back) and its coins. Its certainty is the money data's coverage. */
export class MoneyLane extends Group {
  certainty = certainty(1)
  line!: Line
  coins: Group[] = []
}

/** One step of the value chain — a layer of flows that can be shown, opened, ghosted. */
export class FlowStage extends Group {
  /** The layer on (1) or off (0): channels draw on, particles run. */
  shown = completion(0)
  /** The gap before the NEXT slice opened (1) or closed (0) when the map is expanded. */
  open = completion(1)
  /** Is this stage's knowledge real data (1) or a picture we are painting (0)? */
  certainty = certainty(1)
  /** How sure its particles' material type is — a guess (low) ghosts the symbol, not the dot. */
  typeKnown = completion(1)
  /**
   * Abstract (0) or concrete (1): each flow's channel becomes a road and
   * each particle a truck, one to one (vocabulary/Road FlowRoad — the
   * universal morph, line → road edges, dot → truck).
   */
  concrete = completion(0)
  /** What its particles are — the neutral dot until a richer symbol is asked for. */
  symbol = choice("dot", PARTICLE_SYMBOLS)
  /**
   * How much of its particles' kind shows, when its data names a material
   * symbol (vocabulary/Grain's rungs): 0 = a neutral grey dot (mass only),
   * 1 = the dot in the stage's colour, 2 = each particle morphed into the
   * material's symbol.
   */
  rung = scalar(1)
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
  /**
   * Who sees the map — `() => this.observer` from the Dream. A material
   * stage's particle symbols draw their visible 3D edges for this camera.
   */
  seenBy: (() => Observer) | undefined = undefined

  /**
   * Everything the map draws, at once: 1 present, 0 gone — strokes, fills,
   * text, particles alike (src/certainty.ts `presence`, inherited by every
   * leaf). For blending the whole map with another view.
   */
  presence = presence(1)

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
   * Value ↔ money: 0 the material/value flows (as drawn so far); 1 the
   * MONEY flows — the same channels, coins running the other way, the
   * inverse of every value flow; ½ both at once, counter-flowing in paired
   * lanes that part sideways so they never collide.
   */
  money = completion(0)
  /**
   * Build the money lanes? Undefined (the default): only when the data
   * carries money (any flow's `valueSeries`). true: always — unpriced flows
   * then show their money as conjecture. false: never. A construction choice:
   * a lane per flow doubles the particles.
   */
  moneyLanes: boolean | undefined = undefined
  /**
   * Build each flow's road (vocabulary/Road FlowRoad), walked per stage by
   * `stage(id).concrete`: the channel becomes a road, each particle a truck.
   * A construction choice — a road per flow is a holon tree of its own.
   */
  roads = false
  private lanesWanted(): boolean {
    return this.moneyLanes ?? this.data.flows.some((f) => f.valueSeries !== undefined)
  }
  /** A material symbol's turn off its channel's heading — a 3/4 view, so one coming toward you is never seen end-on. */
  symbolYaw = angle(0.5)
  /** A material symbol's extent as a share of the arc between particles. */
  particleSize = scalar(0.75)
  /** The largest a material symbol may be, as a share of the map's radius (the cap on sparse flows). */
  particleMax = scalar(0.14)
  /**
   * Where along the data's periods the map stands — continuous (0 … P−1):
   * between two periods every flow's volume and coverage are interpolated,
   * so scrubbing or animating it is smooth. Only meaningful with `periods`.
   */
  period = scalar(0)
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
          // Letters, not digits (1–9 are the player's view slots).
          key: STAGE_KEYS[i],
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
      // A guessed material type: guess ↔ data, walkable once its symbols show.
      const typeKnown = sd.typeKnown ?? 1
      if (typeKnown < 1 && sd.symbol && sd.symbol !== "dot") {
        axes.push(
          toggle(`${sd.id}.type`, stage.typeKnown, {
            label: `${name} type`,
            off: ["guess", typeKnown],
            on: ["data", 1],
            duration: 2,
            when: () => stage.shown.value > 0.5 && stage.rung.value > 1.5,
            handles: () => stage.flows,
          }),
        )
      }
    })
    // Site focus — the fiber: none, or one member; each member ring stands
    // for its own site (touch it to focus there; touch the focused site to
    // return).
    const sites = this.data.members
    const focusPositions: Record<string, Record<string, number>> = { none: Object.fromEntries(sites.map((_, i) => [`focus_${i}`, 0])) }
    sites.forEach((m, i) => (focusPositions[m.id] = Object.fromEntries(sites.map((_, j) => [`focus_${j}`, j === i ? 1 : 0]))))
    const ringsOf = new Map<Holon, string>()
    for (const sl of this.slices) sl.sites.forEach((e, i) => (ringsOf.set(e, sites[i]!.id), ringsOf.set(e.ring, sites[i]!.id)))
    axes.push(
      axis("focus", this, focusPositions, {
        key: "z",
        // Esc returns to the whole map.
        escape: "none",
        duration: 1.6,
        handles: () => [...ringsOf.keys()],
        at: (h) => {
          const id = ringsOf.get(h)
          if (!id) return undefined
          const i = sites.findIndex((m) => m.id === id)
          return this.focusWeights[i]!.value > 0.5 ? "none" : id
        },
      }),
    )
    if (this.lanesWanted())
      axes.push(
        axis("money", this, { value: { money: 0 }, both: { money: 0.5 }, money: { money: 1 } }, {
          key: "k",
          duration: 1.6,
          handles: () => this.flows.map((f) => f.line),
        }),
      )
    const periods = this.data.periods ?? []
    if (periods.length > 1)
      axes.push(
        axis("period", this, Object.fromEntries(periods.map((name, i) => [name, { period: i }])), {
          key: "p",
          duration: 1.2,
        }),
      )
    // Lines ↔ roads, per stage, once its flows show.
    if (this.roads) this.data.stages.forEach((sd, i) => {
      const stage = this.stages[i]!
      axes.push(
        toggle(`${sd.id}.concrete`, stage.concrete, {
          label: `${sd.label ?? sd.id} as roads`,
          off: ["lines", 0],
          on: ["roads", 1],
          duration: 3,
          when: () => stage.shown.value > 0.5,
          handles: () => stage.flows,
        }),
      )
    })
    return { axes, clocks: [this.time] }
  }

  // --- the pure state of the picture, memoised per param change ---------------

  // Memo slots — plain fields, not #-private: the holon is a Proxy.
  private memoLayout?: { flat: Vec2[]; categorised: Vec2[]; partners: Vec2[]; R: number; scale: number; fibers: Fiber[] }
  private memoKey: number[] = []
  private memoFrame?: Frame
  private warnedRing = false
  private frameMemo = quietMemo(() => this.computeFrame())
  /** Every presence on the map and above it (resolved at first use — a wrapper may adopt the map late). */
  private presences?: Param<number>[]
  /** Is anything of the map visible at all? Particles skip their work when not. */
  private present(): boolean {
    this.presences ??= presencesOf(this)
    for (const p of this.presences) if (p.value <= 0) return false
    return true
  }

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
    // Partners on one ring, kinds as mirrored sectors (partnerRing). When the
    // counts cannot be mirror-exact the lattice stands, and we say so once.
    const ring = partnerRing((d.partners ?? []).map((p) => p.class ?? p.side), R)
    const partners = ring.points
    if (!ring.exact && !this.warnedRing) {
      this.warnedRing = true
      console.warn(
        "FlowMap: partner classes cannot each be a regular polygon on the n-slot ring (every class size must divide n, and the classes must interleave) — each keeps as even a spread as the free slots allow.",
      )
    }
    this.memoLayout = { flat, categorised, partners, R, scale, fibers: this.fibers(R, categorised, partners) }
    return this.memoLayout
  }

  /**
   * Everything the picture's geometry depends on, except time. O(1) after
   * the first call per param change (quietMemo): every particle reads this
   * several times a frame, and the key below reads ~10 params through the
   * holon proxy.
   */
  frame(): Frame {
    return this.frameMemo()
  }

  private computeFrame(): Frame {
    const key = [
      this.radius.value,
      this.memberScale.value,
      this.grain.value,
      this.expand.value,
      this.gap.value,
      this.tilt.value,
      this.pitch.value,
      ...this.stages.map((s) => s.open.value),
      ...this.focusWeights.map((w) => w.value),
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
    const focus = this.focusBlend(members, L.partners, L.fibers, spread, depths.length)
    this.memoFrame = {
      R,
      depths,
      visible,
      spread,
      heading: this.tilt.value * turn,
      pitch: this.pitch.value * turn,
      discs: categoryDiscs((this.data.categories ?? []).length, R, g),
      members: focus.members,
      partners: focus.partners,
      unfocused: focus.unfocused,
      zoom: focus.zoom,
      memberPresence: focus.memberPresence,
      partnerPresence: focus.partnerPresence,
      flowPresence: focus.flowPresence,
    }
    return this.memoFrame
  }

  // --- site focus: the fiber ---------------------------------------------------

  /** One weight per member (`focus_<i>`): how far the map is focused on that site. Declared in compose. */
  private focusWeights: Param<number>[] = []

  /**
   * Each member's FIBER: the site at the centre, every entity flowing into
   * it and every entity it flows out to — each class its own regular polygon
   * (sites on an inner ring, partners on an outer), their flows, and which
   * of them act in which slice of the stack.
   */
  private fibers(R: number, categorised: Vec2[], partnerPos: Vec2[]): Fiber[] {
    const d = this.data
    // Its own id maps: a layout may be asked for before compose has run.
    const mIndex = new Map(d.members.map((m, i) => [m.id, i]))
    const pIndex = new Map((d.partners ?? []).map((p, i) => [p.id, i]))
    const posOf = (id: string): Vec2 => {
      const m = mIndex.get(id)
      return m !== undefined ? categorised[m]! : partnerPos[pIndex.get(id)!]!
    }
    const stageOf = (id: string) => d.stages.findIndex((s) => s.id === id)
    return d.members.map((site) => {
      const ins: string[] = []
      const outs: string[] = []
      const flows = new Set<number>()
      d.flows.forEach((f, fi) => {
        if (f.to === site.id && f.from !== site.id) {
          flows.add(fi)
          if (!ins.includes(f.from)) ins.push(f.from)
        }
        if (f.from === site.id && f.to !== site.id) {
          flows.add(fi)
          if (!outs.includes(f.to) && !ins.includes(f.to)) outs.push(f.to)
        }
      })
      // The same rule as the ring (David): no left/right halves — each CLASS
      // (sites sending, sites receiving, each partner class) its own regular
      // polygon round the site, the whole fiber symmetric (fiberRings);
      // within a class, in order of angle in the full picture.
      const angleOf = (id: string) => Math.atan2(posOf(id).y, posOf(id).x)
      const entities = [...ins.map((id) => ({ id, dir: "in" })), ...outs.map((id) => ({ id, dir: "out" }))]
      entities.sort((a, b) => angleOf(a.id) - angleOf(b.id) || a.id.localeCompare(b.id))
      const pclass = new Map((d.partners ?? []).map((p) => [p.id, p.class ?? p.side]))
      const rings = fiberRings(
        entities.map((e) => (mIndex.has(e.id) ? { cls: `sites-${e.dir}`, site: true } : { cls: pclass.get(e.id)!, site: false })),
        R,
      )
      const target = new Map<string, Vec2>([[site.id, { x: 0, y: 0 }]])
      entities.forEach((e, j) => target.set(e.id, rings.points[j]!))
      // One in and one out: the whole fiber is a single level diameter,
      // exactly symmetric either way round — so choose the turn that reads
      // in reading direction, in → site → out. Not a left/right SYSTEM
      // (David rejected that); every other fiber stays class polygons.
      if (entities.length === 2 && entities[0]!.dir !== entities[1]!.dir) {
        for (const e of entities) target.set(e.id, { x: (e.dir === "in" ? -1 : 1) * rings.outer, y: 0 })
      }
      // The fiber fills the view: the stack scales so its outer ring glides
      // out past where the whole map's partner ring stood (capped, so a lone
      // pair is not huge).
      const zoom = Math.min(3.5, Math.max(1, (R * 1.6) / rings.outer))
      // Which fiber entities act in slice k: a flow of stage s acts at its
      // source in slice s and at its target in slice s + 1.
      const slices = d.stages.map(() => new Set<string>()).concat([new Set<string>()])
      for (const fi of flows) {
        const f = d.flows[fi]!
        const st = stageOf(f.stage)
        slices[st]!.add(f.from)
        slices[st + 1]!.add(f.to)
      }
      return { site: site.id, target, flows, slices, zoom }
    })
  }

  /** Positions and presences with the focus weights applied (pure in the frame's inputs). */
  private focusBlend(members: Vec2[], partners: Vec2[], fibers: Fiber[], spread: number, sliceCount: number) {
    const d = this.data
    const w = this.focusWeights.map((p) => Math.max(0, p.value))
    const total = w.reduce((a, b) => a + b, 0)
    const k = total > 1 ? 1 / total : 1
    const ws = w.map((x) => x * k)
    const unfocused = Math.max(0, 1 - ws.reduce((a, b) => a + b, 0))
    const focused = 1 - unfocused
    // The fiber gathers round its site on the first 60% of the focus, so it
    // is centred before the zoom (the last 60%) carries it out to fill the
    // view — the zoom never scales a half-gathered fiber off-centre.
    const gathered = smooth(0, 0.6, focused)
    const fiberWeight = (i: number) => (focused > 1e-9 ? (ws[i]! * gathered) / focused : 0)
    // Fiber to fiber: two weighted fibers, A going and B coming.
    const live = ws.flatMap((x, i) => (x > 1e-9 ? [i] : []))
    const split = live.length > 1
    const place = (id: string, full: Vec2): Vec2 => {
      let x = full.x * (1 - gathered)
      let y = full.y * (1 - gathered)
      let sum = 1 - gathered
      fibers.forEach((fb, i) => {
        const t = fb.target.get(id)
        if (!t || ws[i]! <= 0) return
        x += t.x * fiberWeight(i)
        y += t.y * fiberWeight(i)
        sum += fiberWeight(i)
      })
      if (sum <= 1e-9) return full
      x /= sum
      y /= sum
      // Moving between two fibers' seats it swings aside (left of its way),
      // so two entities trading places — the old site leaving the centre,
      // the new one arriving — pass each other instead of meeting midway.
      if (live.length === 2) {
        const [i, j] = live as [number, number]
        const ti = fibers[i]!.target.get(id)
        const tj = fibers[j]!.target.get(id)
        if (ti && tj) {
          const a = ws[j]! / (ws[i]! + ws[j]!)
          const bow = 0.3 * 4 * a * (1 - a)
          x += -(tj.y - ti.y) * bow
          y += (tj.x - ti.x) * bow
        }
      }
      return { x, y }
    }
    // In order, never at once (valueflow): going in, the outsiders fade on
    // the first 40% of the focus and the zoom follows on the rest; coming
    // back the same, reversed — the fiber zooms out first, the whole map
    // fades in at full scale. `shown` is what the whole picture keeps;
    // fiber to fiber (focused throughout) it stays 0, so nothing outside
    // either fiber flashes in at zoom.
    const shown = 1 - smooth(0, 0.4, focused)
    // How much a fiber holds `of`: the focus weights' share, as a fraction of the focus.
    const held = (of: (fb: Fiber) => number) => (focused > 1e-9 ? fibers.reduce((a, fb, i) => a + (ws[i]! > 0 ? ws[i]! * of(fb) : 0), 0) / focused : 0)
    // Fiber to fiber, what only one of them holds crossfades in turn — the
    // going fiber's own gone by halfway, the coming one's after — so two
    // centre sites (and their labels) never stack.
    const present = (fiberShare: number) => shown + (1 - shown) * (split ? smooth(0.5, 1, fiberShare) : fiberShare)
    // Present in slice k: everything when unfocused; in a fiber, only what
    // acts there — slice 0 stands for the whole flat picture until the
    // stack opens.
    const presentIn = (id: string, slice: number) =>
      present(
        held((fb) => {
          const any = fb.target.has(id) ? 1 : 0
          const at = fb.slices[slice]?.has(id) ? 1 : 0
          return slice === 0 ? any + (at - any) * spread : at
        }),
      )
    const slices = Array.from({ length: sliceCount }, (_, s) => s)
    return {
      unfocused: shown,
      zoom: 1 + (held((fb) => fb.zoom) - 1) * smooth(0.4, 1, focused),
      members: members.map((p, i) => place(d.members[i]!.id, p)),
      partners: partners.map((p, i) => place((d.partners ?? [])[i]!.id, p)),
      memberPresence: slices.map((s) => d.members.map((m) => presentIn(m.id, s))),
      partnerPresence: slices.map((s) => (d.partners ?? []).map((p) => presentIn(p.id, s))),
      flowPresence: d.flows.map((_, fi) => present(held((fb) => (fb.flows.has(fi) ? 1 : 0)))),
    }
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
   * the part turned Rx(−pitch) cancels it exactly. When the map knows who
   * sees it (`seenBy`), two more turns, Ry(φ)·Rx(−θ) of that observer, face
   * the part toward the camera as the viewer orbits (the host composes
   * Rz(b)·Rx(p)·Ry(h)); without, nothing extra is built. Position the carrier.
   */
  private facing(part: Holon, at: { x?: Readable<number>; y?: Readable<number>; z?: Readable<number> }): Group {
    // ONE carrier, not a nest of four: the turn it needs is the product of
    // the stack's inverse turn and the observer's, decomposed once per param
    // change (shared by every carrier) into the host's own h/p/b order.
    return new Group({
      members: [part],
      ...at,
      h: derive(() => this.facingTurn().h),
      p: derive(() => this.facingTurn().p),
      b: derive(() => this.facingTurn().b),
    })
  }

  private viewMemo = quietMemo(() => {
    const f = this.frame()
    const o = this.seenBy?.()
    const phi = o ? o.phi.value : 0
    const th = o ? o.theta.value : 0
    const world = { x: Math.cos(th) * Math.sin(phi), y: Math.sin(th), z: Math.cos(th) * Math.cos(phi) }
    const v = invRotHPB(world, f.pitch, f.heading, 0)
    return { x: v.x, z: v.z }
  })
  /** The direction toward the camera, in the stack's frame, on its ground (xz) plane. */
  private viewInStack(): { x: number; z: number } {
    return this.viewMemo()
  }

  private turnMemo = quietMemo(() => {
    const f = this.frame()
    const o = this.seenBy?.()
    return facingAngles(f.heading, f.pitch, o ? o.phi.value : 0, o ? o.theta.value : 0)
  })
  /** The carriers' common turn: Ry(−heading)·Rx(−pitch)·Ry(φ)·Rx(−θ) as h/p/b (see geometry/flowmap facingAngles). */
  private facingTurn(): { h: number; p: number; b: number } {
    return this.turnMemo()
  }

  protected override compose(): void {
    const d = this.data
    const cats = d.categories ?? []
    const partners = d.partners ?? []
    // One focus weight per member — a param of this map, so an axis can
    // walk it (stateSpace "focus").
    d.members.forEach((_, i) => {
      const w = completion(0)
      ;(this as unknown as Record<string, Param<number>>)[`focus_${i}`] = w
      this.focusWeights.push(w)
    })
    d.members.forEach((m, i) => this.memberIndex.set(m.id, i))
    partners.forEach((p, i) => this.partnerIndex.set(p.id, i))
    for (const f of d.flows) {
      for (const end of [f.from, f.to])
        if (!this.memberIndex.has(end) && !this.partnerIndex.has(end)) throw new Error(`FlowMap: flow names unknown entity '${end}'`)
      if (!d.stages.some((s) => s.id === f.stage)) throw new Error(`FlowMap: flow names unknown stage '${f.stage}'`)
    }
    // Readings every leaf shares, memoised per param change: each would
    // otherwise cross the holon proxy thousands of times a frame.
    const R = quietMemo(() => this.radius.value)
    const stageIndex = (id: string): number => d.stages.findIndex((s) => s.id === id)
    const labelSize = () => R() * 0.085

    // --- the stages first: the slices' depths read their `open` -------------
    const stages = d.stages.map(
      (s) =>
        new FlowStage({
          stageId: s.id,
          certainty: s.certainty ?? 1,
          symbol: s.symbol ?? "dot",
          typeKnown: s.typeKnown ?? 1,
        }),
    )
    this.stages = stages

    // --- the slices: one more than the stages (stage k runs k → k + 1) -------
    const sliceCount = d.stages.length + 1
    const slices: FlowSlice[] = []
    for (let k = 0; k < sliceCount; k++) {
      const vis: Readable<number> = derive(() => this.frame().visible[k]!)
      const ringed: Readable<number> = derive(() => this.frame().visible[k]! * this.rim.value * this.frame().unfocused)
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
            opacity: derive(() => this.frame().visible[k]! * Math.max(this.rim.value, smooth(0, 0.3, this.grain.value)) * this.frame().unfocused),
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
        e.presence.follow(derive(() => this.frame().memberPresence[k]![i]!))
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
        e.presence.follow(derive(() => this.frame().partnerPresence[k]![i]!))
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
            opacity: derive(() => this.labels.value * smooth(0.5, 1, this.grain.value) * (1 - smooth(0, 0.5, this.expand.value)) * this.frame().unfocused),
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
      // Its road (built once the particles exist, below); read lazily.
      let road: FlowRoad | undefined
      // Over time: the flow's volume (as a share of the busiest flow's
      // busiest period) and its data coverage at the current `period`.
      const series = f.series && this.data.periods ? f.series : undefined
      const peak = series ? peakVolume(this.data) : 1
      const reading = () => (series ? seriesAt(series, this.period.value) : { volume: peak, coverage: 1 })
      const share = () => Math.min(1, reading().volume / peak)
      // What the data says about this flow now: covered = as declared,
      // uncovered = conjecture (but never below the floor of a ghost).
      const sure = () => flowCertainty * (series ? 0.15 + 0.85 * reading().coverage : 1)
      // The money side: its own series if the table had value/price, else
      // the value lane's level as conjecture.
      const valueSeries = f.valueSeries && this.data.periods ? f.valueSeries : undefined
      const peakMoney = valueSeries ? peakValue(this.data) : 1
      const moneyReading = () => (valueSeries ? seriesAt(valueSeries, this.period.value) : { volume: 0, coverage: 0 })
      const moneyShare = () => (valueSeries ? Math.min(1, moneyReading().volume / peakMoney) : share())
      const moneySure = () => (valueSeries ? 0.15 + 0.85 * moneyReading().coverage : 0.15)
      // Lanes: value on one side, money on the other, parted only while
      // both show (money = ½); each alone runs down the middle.
      const both = () => 1 - Math.abs(2 * this.money.value - 1)
      const valueShown = () => 1 - smooth(0.5, 1, this.money.value)
      const moneyShown = () => smooth(0, 0.5, this.money.value)
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
      // The lane offset: sideways in the picture's plane, across the chord.
      const lane = (side: 1 | -1) => {
        const { points } = channel()
        const a = points[0]!
        const b = points[points.length - 1]!
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const k = side * R() * 0.035 * both()
        return { x: (-(b.y - a.y) / L) * k, y: ((b.x - a.x) / L) * k }
      }
      const line = new Line({
        tint,
        // Width follows volume when there is a series: a trickle is a hair,
        // the busiest flow a band.
        stroke: series ? derive(() => 1 + 4.5 * share()) : 2,
        arrowEnd: true,
        arrowSize: 1.05,
        // A flow whose data says nothing moved draws nothing; it appears as
        // volume arrives (a conjectured flow keeps its typical level).
        opacity: derive(
          () =>
            this.channel.value *
            smooth(0, 0.15, stage.shown.value) *
            (series ? smooth(0, 0.05, share()) : 1) *
            valueShown() *
            (road ? road.abstractShown() : 1),
        ),
      })
      // The channel draws on from source to target as its layer is shown —
      // never empty, so the host always has a ribbon and an arrowhead.
      const lanePoints = (side: 1 | -1, reversed: boolean) => {
        const { points, lengths } = channel()
        const total = lengths[lengths.length - 1]!
        const reach = Math.max(0.02, stage.shown.value) * total
        const o = lane(side)
        const pts: Vec3Like[] = []
        const N = 32
        for (let j = 0; j <= N; j++) {
          const p = atArcLength(points, lengths, (j / N) * reach)
          pts.push({ x: p.x + o.x, y: p.y + o.y, z: p.z })
        }
        return reversed ? pts.reverse() : pts
      }
      derivePoints(line, () => [this.frame(), stage.shown.value, this.money.value], () => lanePoints(1, false))

      // Particles: evenly spaced by arc length, `spacing / rate` apart, at
      // `speed`. The pool covers the longest this channel can get; particles
      // past its current end are "in the pipe" and hidden, so a short channel
      // simply carries fewer, at the same spacing.
      const rate = f.rate ?? 1
      const sp = () => this.spacing.value / rate
      const longest = 1.15 * Math.hypot(2.9 * this.radius.value, this.gap.value)
      const n = Math.max(2, Math.ceil(longest / (this.spacing.value / rate)))
      const seed = fi * 7.31 + 0.37
      const dots: (Circle | Grain)[] = []
      // Each particle's visibility BEFORE a road hides it — what a truck is
      // for (one per visible particle). Read through `particles()`.
      const seen: (() => number)[] = []
      const carriers: Group[] = []
      const material = sd.symbol && sd.symbol !== "dot" ? MATERIALS[sd.symbol] : undefined
      const spindle = sd.symbol ? SPINDLES[sd.symbol] : undefined
      const stageRate = Math.max(...d.flows.filter((g) => g.stage === f.stage).map((g) => g.rate ?? 1))
      for (let j = 0; j < n; j++) {
        let memo = { x: 0, y: 0, z: 0, o: 0, heading: 0, vis: 0 }
        const cur = quietMemo(() => {
          const shown = stage.shown.value
          // Nothing to see: keep the last place, show nothing, skip the work.
          if (shown <= 0 || !this.present()) {
            memo = { ...memo, o: 0 }
            return memo
          }
          const { points, lengths } = channel()
          const L = lengths[lengths.length - 1]!
          const s = streamArc(j, n, sp(), this.speed.value, this.time.value, seed % 1)
          const vis = streamFade(s, L, shown) * (series ? thinning(j, share()) : 1) * valueShown()
          const o = vis * (road ? road.abstractShown() : 1)
          const p = atArcLength(points, lengths, Math.min(s, L))
          const c = stage.certainty.value * sure()
          const w = wobble(seed * 13 + j, this.time.value, c, R() * 0.035)
          const off = lane(1)
          // The channel's heading here (about the vertical), for a material
          // symbol to ride along it: from a little behind to a little ahead.
          let heading = 0
          if (material) {
            const q = atArcLength(points, lengths, Math.min(s + 2, L))
            const b = atArcLength(points, lengths, Math.max(s - 2, 0))
            heading = Math.atan2(-(q.z - b.z), q.x - b.x) + this.symbolYaw.value
            // A reel is never seen down its spindle: the view, brought into
            // the stack's frame, keeps the turned spindle ≥ 35° off it.
            if (spindle) heading = clearYaw(heading, spindle, this.viewInStack())
          }
          memo = { x: p.x + w.x + off.x, y: p.y + w.y + off.y, z: p.z, o, heading, vis }
          return memo
        })
        const dot = material
          ? new Grain({
              observer: this.seenBy?.(),
              radius: derive(() => R() * 0.02),
              // As large as the gap the stage's DENSEST flow allows — so the
              // stage's symbols match and never overlap; a scene that wants
              // them bigger raises `spacing`.
              // …and never larger than `particleMax` of the map's radius:
              // sparse (low-rate) flows would otherwise grow symbols that
              // bury the map.
              size: derive(() => Math.min((this.particleSize.value * this.spacing.value) / stageRate, this.particleMax.value * R())),
              category: tint,
              // Rung 0 is a neutral grey dot — mass only, kind unknown — so a
              // material stage can climb the whole ladder (stage(id).rung 0 → 2).
              neutral: NEUTRAL,
              symbol: material,
              grain: derive(() => stage.rung.value),
              typeKnown: stage.typeKnown,
              opacity: derive(() => cur().o),
            })
          : new Circle({
              radius: derive(() => R() * 0.02),
              stroke: 0,
              // As the road comes, the dot lets go of its fill first.
              fillOpacity: derive(() => (road ? road.dotFill() : 1)),
              tint,
              opacity: derive(() => cur().o),
            })
        dots.push(dot)
        seen.push(() => cur().vis)
        const at = { x: derive(() => cur().x), y: derive(() => cur().y), z: derive(() => cur().z) }
        carriers.push(
          material
            ? // A material symbol is a solid: it rides ALONG the channel,
              // upright, turned by the channel's heading plus a fixed 3/4
              // (`symbolYaw`), so it shows its 3D side as the stack turns. A
              // Grain turns its own dot and label to the camera, so it needs
              // no billboard.
              new Group({ members: [dot], ...at, h: derive(() => cur().heading) })
            : this.facing(dot, at),
        )
      }
      // --- the money lane: the same channel, back the other way -------------
      // Built only where money can be shown (see `moneyLanes`): a lane per
      // flow doubles the particles.
      let moneyLane: MoneyLane | undefined
      if (this.lanesWanted()) {
        const moneyLine = new Line({
          tint: GOLD,
          stroke: derive(() => 1 + 4.5 * moneyShare()),
          arrowEnd: true,
          arrowSize: 1.05,
          opacity: derive(() => this.channel.value * smooth(0, 0.15, stage.shown.value) * smooth(0, 0.05, moneyShare()) * moneyShown()),
        })
        derivePoints(moneyLine, () => [this.frame(), stage.shown.value, this.money.value], () => lanePoints(-1, true))
        const coins: Group[] = []
        for (let j = 0; j < n; j++) {
          let memo = { x: 0, y: 0, z: 0, o: 0 }
          const cur = quietMemo(() => {
            if (stage.shown.value <= 0 || this.money.value <= 0 || !this.present()) {
              memo = { ...memo, o: 0 }
              return memo
            }
            const { points, lengths } = channel()
            const L = lengths[lengths.length - 1]!
            // Money runs from the flow's target back to its source: the arc
            // position counts down from the end.
            const s = streamArc(j, n, sp(), this.speed.value, this.time.value, (seed + 0.5) % 1)
            const o = streamFade(s, L, stage.shown.value) * thinning(j, moneyShare()) * moneyShown()
            const p = atArcLength(points, lengths, Math.max(0, L - Math.min(s, L)))
            const c = stage.certainty.value * moneySure()
            const w = wobble(seed * 17 + j, this.time.value, c, R() * 0.035)
            const off = lane(-1)
            memo = { x: p.x + w.x + off.x, y: p.y + w.y + off.y, z: p.z, o }
            return memo
          })
          // A coin: a gold disc with a deeper ring struck inside it.
          const face = new Circle({
            radius: derive(() => R() * 0.024),
            stroke: 0,
            fillOpacity: 1,
            tint: GOLD,
            opacity: derive(() => cur().o),
          })
          const ring = new Circle({
            radius: derive(() => R() * 0.014),
            stroke: 1.2,
            tint: GOLD_DEEP,
            opacity: derive(() => cur().o),
          })
          coins.push(
            this.facing(new Group({ members: [face, ring] }), {
              x: derive(() => cur().x),
              y: derive(() => cur().y),
              z: derive(() => cur().z),
            }),
          )
        }
        moneyLane = new MoneyLane({ members: [moneyLine, ...coins] })
        moneyLane.certainty.follow(derive(moneySure))
        moneyLane.line = moneyLine
        moneyLane.coins = coins
      }

      // --- the concrete flow: a road with trucks, one per visible particle ----
      const particles = () => {
        const { lengths } = channel()
        const L = lengths[lengths.length - 1]!
        return dots.map((_, j) => {
          const s = streamArc(j, n, sp(), this.speed.value, this.time.value, seed % 1)
          return s > L || L <= 0 || seen[j]!() <= 0.01 ? -1 : s / L
        })
      }
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const map = this
      if (this.roads) road = new FlowRoad(
        {
          path: () => channel().points,
          particles,
          // The channel is stated in the stack's frame (built below).
          get frame() {
            return map.stack
          },
          certainty: () => stage.certainty.value * sure(),
        },
        {
          seenBy: this.seenBy,
          dotTint: tint,
          concrete: stage.concrete,
          cargo: tint,
          dotRadius: derive(() => R() * 0.02),
          truckLength: derive(() => R() * 0.11),
          width: derive(() => R() * 0.07),
        },
      )
      const flow = new Flow({
        members: [line, ...carriers, ...(moneyLane ? [moneyLane] : []), ...(road ? [road] : [])],
        certainty: flowCertainty,
      })
      flow.road = road
      flow.money = moneyLane
      flow.presence.follow(derive(() => this.frame().flowPresence[fi]!))
      if (series) flow.certainty.follow(derive(sure))
      flow.line = line
      flow.dots = dots
      flow.carriers = carriers
      flow.path = () => channel().points
      flow.particles = particles
      flows.push(flow)
      stage.attach(flow)
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
      stage.attach(
        this.facing(text, {
          y: derive(() => -R() * 1.5),
          z: derive(() => (this.frame().depths[si]! + this.frame().depths[si + 1]!) / 2),
        }),
      )
    })

    // --- the period: a readout above, a small axis below --------------------
    const periods = d.periods ?? []
    if (periods.length > 1) {
      const P = periods.length
      const left = () => -R() * 1.4
      const right = () => R() * 1.4
      const axisY = () => -R() * 1.72
      const xAt = (i: number) => left() + ((right() - left()) * i) / (P - 1)
      const timeline: Holon[] = []
      const track = new Line({ stroke: 1.5, tint: LABEL_TINT, opacity: this.labels })
      derivePoints(track, () => [this.radius.value], () => [
        { x: left(), y: axisY(), z: 0 },
        { x: right(), y: axisY(), z: 0 },
      ])
      timeline.push(track)
      for (let i = 0; i < P; i++) {
        const tick = new Line({ stroke: 1.5, tint: LABEL_TINT, opacity: this.labels })
        derivePoints(tick, () => [this.radius.value], () => [
          { x: xAt(i), y: axisY() - R() * 0.025, z: 0 },
          { x: xAt(i), y: axisY() + R() * 0.025, z: 0 },
        ])
        timeline.push(tick)
      }
      // The marker rides the continuous period.
      timeline.push(
        new Circle({
          radius: derive(() => R() * 0.028),
          stroke: 0,
          fillOpacity: 1,
          tint: WHITE,
          opacity: this.labels,
          x: derive(() => left() + ((right() - left()) * Math.min(P - 1, Math.max(0, this.period.value))) / (P - 1)),
          y: derive(axisY),
        }),
      )
      const ends = (i: number) =>
        new Text({
          content: periods[i]!,
          size: derive(() => labelSize() * 0.75),
          tint: LABEL_TINT,
          opacity: this.labels,
          x: derive(() => xAt(i)),
          y: derive(() => axisY() - R() * 0.1 - labelSize() * 0.75 * 0.35),
        })
      timeline.push(ends(0), ends(P - 1))
      // The readout: the nearest period's name, large, above the map.
      timeline.push(
        new Text({
          content: derive(() => periods[Math.min(P - 1, Math.max(0, Math.round(this.period.value)))]! + (this.money.value > 0.5 ? (d.currency ? `  ·  value in ${d.currency}` : "  ·  value") : d.unit ? `  ·  volume in ${d.unit}` : "")),
          size: derive(() => labelSize() * 1.3),
          tint: WHITE,
          opacity: this.labels,
          y: derive(() => R() * 1.62 - labelSize() * 1.3 * 0.35),
        }),
      )
      this.add(new Group({ members: timeline }))
    }

    // --- the legend: categories, top left, while staged --------------------
    const legendRows: Holon[] = []
    cats.forEach((c, i) => {
      const tint = c.tint ?? CATEGORY_TINTS[i % CATEGORY_TINTS.length]!
      const shown = derive(() => this.labels.value * smooth(0.5, 1, this.grain.value) * smooth(0.5, 1, this.expand.value) * this.frame().unfocused)
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
        scale: derive(() => this.frame().zoom),
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

/**
 * A reading memoised per param change that stays transparent to the host's
 * skip (params.ts READS): it keeps the reads it was computed from and
 * replays them (noteReads) on every cached answer, so a stroke reading it
 * is skipped while none of them moved — where a memo keyed on paramEpoch()
 * would make the stroke opaque.
 */
const quietMemo = <T,>(f: () => T): (() => T) => {
  let epoch = -1
  let value!: T
  let reads: Reads = { deps: [], opaque: false }
  return () => {
    const now = quietEpoch()
    if (now !== epoch) {
      epoch = now
      reads = { deps: [], opaque: false }
      value = trackReads(reads, f)
      // Each param once: the host skips only a short list (MAX_READS).
      reads.deps = [...new Set(reads.deps)]
    }
    noteReads(reads.deps, reads.opaque)
    return value
  }
}

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
  /** 1 with no site focused … 0 fully in a fiber: what the whole picture keeps (gone by 40% of the focus, so it never shows at zoom). */
  unfocused: number
  /** The stack's scale under the focus: 1 unfocused … the fiber's own zoom, so it fills the view. */
  zoom: number
  /** Per slice, per member / partner: there (1) or gone (0) under the focus. */
  memberPresence: number[][]
  partnerPresence: number[][]
  flowPresence: number[]
}

/** A member's fiber: its own targets in the focused picture, its flows, who acts in which slice. */
interface Fiber {
  site: string
  target: Map<string, Vec2>
  flows: Set<number>
  slices: Set<string>[]
  /** How far the stack scales up to fill the view with this fiber. */
  zoom: number
}

/** Free-play keys for the stage layers — letters clear of the player's reserved set and this map's own keys. */
const STAGE_KEYS = ["a", "s", "d", "j", "x", "b", "n", "v"]

/** The board's own colours: raw material blue, semi-finished white, finished red. */
const STAGE_TINTS: Color[] = [BLUE, WHITE, RED]


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
    // Each class its own regular polygon on one 18-slot ring: six raw
    // suppliers and six finished buyers (two hexagons), three semi-finished
    // suppliers and three semi-finished buyers (two triangles).
    ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: `S${i}`, label: `Supplier ${i}`, side: "in" as const, class: "raw" })),
    ...[1, 2, 3].map((i) => ({ id: `P${i}`, label: `Partner ${i}`, side: "in" as const, class: "semi-in" })),
    ...[1, 2, 3].map((i) => ({ id: `Q${i}`, label: `Partner ${i + 3}`, side: "out" as const, class: "semi-out" })),
    ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: `K${i}`, label: `Customer ${i}`, side: "out" as const, class: "finished" })),
  ],
  stages: [
    { id: "raw", label: "raw material in", certainty: 0.15 },
    { id: "semi", label: "semi-finished" },
    { id: "finished", label: "finished product out" },
  ],
  flows: [
    // Raw material in: six suppliers → the extruding sites. Conjecture for now.
    { from: "S1", to: "A", stage: "raw", rate: 1.5 },
    { from: "S2", to: "B", stage: "raw" },
    { from: "S3", to: "G", stage: "raw" },
    { from: "S4", to: "I", stage: "raw" },
    { from: "S5", to: "C", stage: "raw" },
    { from: "S6", to: "K", stage: "raw", rate: 0.5 },
    // Semi-finished: intercompany (extrusion → conversion), in from three
    // partners and out to three.
    { from: "A", to: "D", stage: "semi", rate: 1.5 },
    { from: "B", to: "E", stage: "semi" },
    { from: "C", to: "F", stage: "semi" },
    { from: "G", to: "H", stage: "semi" },
    { from: "I", to: "J", stage: "semi" },
    { from: "P1", to: "E", stage: "semi", rate: 0.5 },
    { from: "P2", to: "F", stage: "semi", rate: 0.5 },
    { from: "P3", to: "H", stage: "semi", rate: 0.5 },
    { from: "A", to: "Q1", stage: "semi", rate: 0.5 },
    { from: "B", to: "Q2", stage: "semi", rate: 0.5 },
    { from: "I", to: "Q3", stage: "semi", rate: 0.5 },
    // Finished product out: conversion sites → six customers.
    { from: "D", to: "K1", stage: "finished", rate: 1.5 },
    { from: "E", to: "K2", stage: "finished" },
    { from: "F", to: "K3", stage: "finished" },
    { from: "H", to: "K4", stage: "finished" },
    { from: "J", to: "K5", stage: "finished" },
    { from: "K", to: "K6", stage: "finished", rate: 0.5 },
  ],
}
