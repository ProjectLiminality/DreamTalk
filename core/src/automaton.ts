/**
 * The visual automaton — a holon's STATE SPACE, walkable.
 *
 * David (2026-10-13): "A DreamTalk symbol is a visual automaton: a state
 * machine whose internal process state is mirrored by an external display
 * state (CTMU: processing domain ↔ display domain) … every state has an
 * adjacent possible." A DreamSong is a high-dimensional one.
 *
 * THE ONE IDEA. The state space is not a second system beside params and
 * the timeline — it is a NAMING of what is already there:
 *
 *   - an AXIS is a set of named positions, each a `State` (params.ts) —
 *     the "discrete relational configurations" every holon could already
 *     declare. A toggle is an axis with two positions.
 *   - the TIMELINE is one authored path through that space:
 *     `this.play(axis.to("categorised"), 2.5)` is exactly
 *     `holon.transitionTo(state)`, the same tracks the song always wrote.
 *   - the AUTOMATON is the other way through it: the world held at a t, the
 *     viewer firing axes in any order. Its writes sit ABOVE the timeline as
 *     a live layer (the player installs it as the host's `beforeSync`, the
 *     editor-overrides seam), so nothing in the Dream ever knows.
 *
 * DETERMINISM. The display is a pure function of the event log and the
 * automaton's clock: every param in motion carries one `Motion` — from where
 * it was, at the velocity it had, to where it is going, over a duration —
 * and `valueAt(clock)` samples it. Firing reads the current value AND
 * velocity analytically from the motion it interrupts, never from frames,
 * so the picture is frame-rate independent: the same fires at the same
 * clocks give the same pixels however often anything was sampled between.
 *
 * INTERRUPTIBLE, REVERSIBLE. A fire mid-flight starts the new motion from
 * the current value with the current velocity (C¹: no pop, no kink) and
 * eases into the target with zero velocity — reversing a half-done grain
 * swings through and comes back like something with mass. From rest it is
 * EXACTLY the framework's C4D ease, so a free-play transition and the
 * song's `param.to()` of the same duration draw the same curve.
 *
 * VERBS. An axis may name a `via` — an Anim (Morph, Create, a Lens opening)
 * that plays the transition instead of the plain ease. It plays from rest
 * only; interrupted, it hands over to the continuous retarget toward the
 * new position's State, from wherever each param stands.
 */

import { together, type Anim } from "./anim"
import { isColor } from "./constants"
import type { Holon } from "./holon"
import { State, type Param, type ParamValue } from "./params"
import { C4D_SMOOTHING, c4dEaseWith, Timeline } from "./timeline"

// --- Declaration ---------------------------------------------------------------

export interface AxisOpts {
  /** What the HUD calls it. Default: the id. */
  label?: string
  /** Seconds a transition along this axis takes. Default 1.2. */
  duration?: number
  /**
   * The in-scene elements that OWN this axis: hovering one (or anything
   * inside it) affords the transition, clicking fires it. Holons, or a
   * thunk for parts that exist only after compose().
   */
  handles?: Holon[] | (() => Holon[])
  /**
   * A single-character key that fires it. Unset: the player assigns a
   * digit. Never one of RESERVED_KEYS — the player's own (a declared one
   * is refused, loudly, and replaced by a digit).
   */
  key?: string
  /**
   * The adjacent possible: is this axis walkable from the CURRENT display
   * state? (A stage gap opens only once the map is staged.) Default: always.
   */
  when?: () => boolean
  /** A verb that plays the transition `from → to` instead of the plain ease. */
  via?: (from: string, to: string) => Anim
  /**
   * A handle that stands for ONE position: touching it goes there, not to
   * the next — a button per state (HyperCard), a lattice node
   * (vocabulary/StateLattice). Undefined for a handle: the next, as ever.
   */
  at?: (handle: Holon) => string | undefined
  /**
   * Where Esc takes this axis back to (its "home" — a focus's `none`): in
   * free play, Esc walks every live axis that is elsewhere back to its
   * escape position (demo/game.ts), after the game's own pinch-focus and
   * never while a nested level is open (nest's Esc is its own). Unset: Esc
   * leaves the axis be.
   */
  escape?: string
}

/**
 * The keys the player and the editor keep for themselves in free play:
 * Space (song ↔ free), ` (creator mode), ~ (explorer), m (sound), h (HUD),
 * r (view home), f (frame), c (calibrate the hands' pinch), i (hand talk —
 * demo/handui.ts), Enter (unpack the symbol under the pointer into its own
 * song; ⇧Enter its state space — editor/nest.ts), q (presenter mode), y (the
 * minimap), `,` (the player's settings: degrees of freedom on and off —
 * demo/dofpanel.ts; the editor's frame step) and ⇧1–9 (! @ # $ % ^ & * ( —
 * save the state to a slot; demo/toolkit.ts).
 * An axis may not declare one
 * (test/reservedkeys.test.ts scans every shipped holon). Esc and the
 * arrows are named keys, not characters, so no axis can collide with them.
 */
export const RESERVED_KEYS: readonly string[] = [" ", "`", "~", "m", "h", "r", "f", "c", "i", "Enter", "q", "y", ",", "!", "@", "#", "$", "%", "^", "&", "*", "("]

export interface Position {
  name: string
  values: Map<Param<ParamValue>, ParamValue>
}

export interface Axis {
  readonly id: string
  /** The holon that declared it (set by gatherStateSpace) — focus and key groups read it. */
  readonly owner?: Holon
  readonly label: string
  readonly duration: number
  readonly positions: readonly Position[]
  readonly key?: string
  readonly when?: () => boolean
  readonly via?: (from: string, to: string) => Anim
  /** The position a handle stands for, if it stands for one (AxisOpts.at). */
  readonly at?: (handle: Holon) => string | undefined
  readonly escape?: string
  /**
   * Switched off by the scene's degrees of freedom (src/dof.ts) — live. A
   * masked axis stays in the automaton (it holds where it stands, a link's
   * journal keeps its indices) but is walkable from nowhere: no key, no
   * handle, no row, no lattice node. Set by gatherStateSpace's mask.
   */
  readonly masked?: () => boolean
  /** The owning elements (resolved). */
  handles(): Holon[]
  /** The song's spelling: an Anim into this position, for `this.play(…)`. */
  to(position: string): Anim
  /** Every param any position names. */
  params(): Param<ParamValue>[]
}

/**
 * A holon's walkable state space: its axes, and its CLOCKS — params that
 * run with wall time while the automaton holds the world (FlowMap's
 * `time`, so the particles keep flowing in free play).
 */
export interface StateSpace {
  axes: Axis[]
  clocks?: Param<number>[]
}

const resolve = (owner: Holon, values: Record<string, ParamValue>): Map<Param<ParamValue>, ParamValue> => {
  const params = owner.params
  const out = new Map<Param<ParamValue>, ParamValue>()
  for (const [name, v] of Object.entries(values)) {
    const p = params.get(name)
    if (!p) throw new Error(`${owner.constructor.name}: axis position names unknown param '${name}'`)
    if (p.isBound) throw new Error(`${owner.constructor.name}: '${name}' follows a binding — an axis must target its source`)
    out.set(p, p.clamp(v))
  }
  return out
}

const makeAxis = (id: string, positions: Position[], opts: AxisOpts): Axis => {
  if (positions.length < 2) throw new Error(`axis '${id}' needs at least two positions`)
  const { handles } = opts
  return {
    id,
    label: opts.label ?? id,
    duration: opts.duration ?? 1.2,
    positions,
    key: opts.key,
    when: opts.when,
    via: opts.via,
    at: opts.at,
    escape: opts.escape,
    handles: () => (typeof handles === "function" ? handles() : (handles ?? [])),
    to(name) {
      const pos = positions.find((p) => p.name === name)
      if (!pos) throw new Error(`axis '${id}' has no position '${name}' (${positions.map((p) => p.name).join(", ")})`)
      return together(...[...pos.values].map(([p, v]) => p.to(v)))
    },
    params: () => [...new Set(positions.flatMap((p) => [...p.values.keys()]))],
  }
}

/**
 * An axis over a holon's named States — `axis("grain", map, { uncategorised:
 * map.states.uncategorised, categorised: map.states.categorised })`, or
 * plain `{ param: value }` records. Order is the cycle order.
 */
export const axis = (
  id: string,
  owner: Holon,
  positions: Record<string, State | Record<string, ParamValue>>,
  opts: AxisOpts = {},
): Axis =>
  makeAxis(
    id,
    Object.entries(positions).map(([name, s]) => ({
      name,
      values: resolve(owner, s instanceof State ? s.values : s),
    })),
    opts,
  )

/**
 * An axis over explicit params of ANY holons — the scene's own states
 * (Dream.stateSpace()), where one position may pose several symbols at
 * once: `poses("look", { rest: [[map.grain, 0]], busy: [[map.grain, 1], [map.expand, 1]] })`.
 * The editor's "save as state" writes exactly this.
 */
export const poses = (
  id: string,
  positions: Record<string, ReadonlyArray<readonly [Param<ParamValue>, ParamValue]>>,
  opts: AxisOpts = {},
): Axis =>
  makeAxis(
    id,
    Object.entries(positions).map(([name, pairs]) => ({
      name,
      values: new Map(
        pairs.map(([p, v]) => {
          if (p.isBound) throw new Error(`poses '${id}': '${p.name ?? p.id}' follows a binding — target its source`)
          return [p, p.clamp(v)] as [Param<ParamValue>, ParamValue]
        }),
      ),
    })),
    opts,
  )

/**
 * The common case: one param, two positions — `off`/`on` at 0/1 unless
 * stated (`{ off: ["conjecture", 0.15], on: ["data", 1] }`).
 */
export const toggle = (
  id: string,
  param: Param<ParamValue>,
  opts: AxisOpts & { off?: [string, ParamValue]; on?: [string, ParamValue] } = {},
): Axis => {
  if (param.isBound) throw new Error(`toggle '${id}': its param follows a binding — target the source`)
  const [offName, offValue] = opts.off ?? ["off", 0]
  const [onName, onValue] = opts.on ?? ["on", 1]
  return makeAxis(
    id,
    [
      { name: offName, values: new Map([[param, param.clamp(offValue)]]) },
      { name: onName, values: new Map([[param, param.clamp(onValue)]]) },
    ],
    opts,
  )
}

/**
 * One param's closed vocabulary as an axis — a `choice` param's options
 * (or a given list of values) are its positions, in order.
 */
export const choices = (
  id: string,
  param: Param<ParamValue>,
  opts: AxisOpts & { values?: readonly ParamValue[] } = {},
): Axis => {
  if (param.isBound) throw new Error(`choices '${id}': its param follows a binding — target the source`)
  const values = opts.values ?? param.options
  if (!values || values.length < 2) throw new Error(`choices '${id}': needs a choice param or at least two values`)
  return makeAxis(
    id,
    values.map((v) => ({ name: String(v), values: new Map([[param, param.clamp(v)]]) })),
    opts,
  )
}

/** Which gathered axes are on (src/dof.ts DofMask), asked live, by gathered id. */
export interface AxisMask {
  axisOn(id: string): boolean
}

/**
 * Every state space declared under these roots (Holon.stateSpace()), one
 * space. Ids stay as declared; a repeat (two FlowMaps) gets `#2`, `#3`.
 * With a `mask`, each axis is masked by it (as rekey masks: `when` ANDed),
 * live — what it says now is what is walkable now.
 */
export const gatherStateSpace = (roots: readonly Holon[], scene?: StateSpace, mask?: AxisMask): StateSpace => {
  const axes: Axis[] = []
  const clocks = new Set<Param<number>>()
  const seen = new Map<string, number>()
  const visited = new Set<Holon>()
  const walked = new Set<Param<ParamValue>>()
  // The SCENE's own axes first, owner-less (Dream.stateSpace(), `poses`):
  // they compose holons' params by design, so they never take part in
  // "one param, one axis" — the holons' own axes over the same params stay.
  for (const a of scene?.axes ?? []) {
    const n = (seen.get(a.id) ?? 0) + 1
    seen.set(a.id, n)
    axes.push(n === 1 ? a : { ...a, id: `${a.id}#${n}`, label: `${a.label} #${n}` })
  }
  for (const c of scene?.clocks ?? []) clocks.add(c)
  for (const root of roots) {
    for (const h of root.walk()) {
      if (visited.has(h)) continue
      visited.add(h)
      const space = h.stateSpace()
      if (!space) continue
      for (const a of space.axes) {
        // One param, one axis: a part that shares its whole's param (a
        // MindVirus's FoldableCube folds with it) is already walked by the
        // whole, which declared first (walk is whole-first).
        const ps = a.params()
        if (ps.length > 0 && ps.every((p) => walked.has(p))) continue
        for (const p of ps) walked.add(p)
        const n = (seen.get(a.id) ?? 0) + 1
        seen.set(a.id, n)
        axes.push(n === 1 ? { ...a, owner: h } : { ...a, owner: h, id: `${a.id}#${n}`, label: `${a.label} #${n}` })
      }
      for (const c of space.clocks ?? []) clocks.add(c)
    }
  }
  if (!mask) return { axes, clocks: [...clocks] }
  return {
    axes: axes.map((a) => ({
      ...a,
      masked: () => !mask.axisOn(a.id),
      when: () => mask.axisOn(a.id) && (a.when?.() ?? true),
    })),
    clocks: [...clocks],
  }
}

/** The space without its masked axes — what a lattice draws (the minimap's machine). */
export const unmasked = (space: StateSpace): StateSpace => ({ ...space, axes: space.axes.filter((a) => !a.masked?.()) })

/**
 * A symbol JOINING a larger machine (a RoleMap inside a lens): its state
 * space with each axis's key replaced by `keys[id]` where given — the keys
 * the larger machine has free — the axes whose `keys[id]` is null dropped
 * (the larger machine already has one: its labels), and `when` ANDed into
 * every axis's own, so it is walkable only where it is seen. The axes stay
 * the same axes otherwise (positions, params, handles, verbs).
 */
export const rekey = (space: StateSpace, keys: Record<string, string | null>, when?: () => boolean): StateSpace => ({
  ...space,
  axes: space.axes
    .filter((a) => keys[a.id] !== null)
    .map((a) => ({
      ...a,
      key: keys[a.id] ?? a.key,
      when: when ? () => when() && (a.when?.() ?? true) : a.when,
    })),
})

// --- Motion: continuous, deterministic retargeting -------------------------------

/** A value as a vector (numbers, colours); undefined for the discrete (steps). */
const vec = (v: ParamValue): number[] | undefined =>
  typeof v === "number" ? [v] : isColor(v) ? [v.r, v.g, v.b] : undefined

const unvec = (like: ParamValue, a: number[]): ParamValue =>
  typeof like === "number" ? a[0]! : { r: a[0]!, g: a[1]!, b: a[2]! }

/** The framework's ease (timeline.ts), so free play and the song draw the same curve. */
const ease = (u: number): number => c4dEaseWith(u, C4D_SMOOTHING, C4D_SMOOTHING)

/**
 * The velocity-carrying basis: zero at both ends, slope 1 at u = 0, slope 0
 * at u = 1 (the Hermite h10). Added to the ease, it lets a motion LEAVE at
 * the velocity the interrupted one had while still arriving at rest.
 */
const carry = (u: number): number => u * (1 - u) * (1 - u)

type Motion =
  | {
      kind: "ease"
      from: ParamValue
      /** Velocity at t0, per second, per component (vector values only). */
      v0: number[]
      to: ParamValue
      t0: number
      d: number
    }
  | {
      kind: "via"
      /** The verb, laid out as a one-clip timeline starting at t0. */
      timeline: Timeline
      param: Param<ParamValue>
      t0: number
      d: number
      to: ParamValue
    }

const H = 1e-4

const sample = (m: Motion, t: number): ParamValue => {
  if (m.kind === "via") {
    if (t >= m.t0 + m.d) return m.to
    return m.timeline.valueAt(m.param, Math.max(0, t - m.t0))
  }
  // Arrival is decided in time, not in u: (t0 + d − t0) / d need not be 1.
  if (t >= m.t0 + m.d || m.d <= 0) return m.to
  const u = Math.max(0, (t - m.t0) / m.d)
  const a = vec(m.from)
  const b = vec(m.to)
  if (!a || !b) return m.from
  const e = ease(u)
  const c = carry(u) * m.d
  return unvec(m.from, a.map((ai, i) => ai + (b[i]! - ai) * e + (m.v0[i] ?? 0) * c))
}

/** Velocity per second at t — a central difference of the pure sample. */
const velocity = (m: Motion, t: number): number[] => {
  const end = m.t0 + m.d
  if (t <= m.t0 && m.kind === "ease") return m.v0
  if (t >= end) return vec(m.to)?.map(() => 0) ?? []
  const lo = Math.max(m.t0, t - H)
  const hi = Math.min(end, t + H)
  const a = vec(sample(m, lo))
  const b = vec(sample(m, hi))
  if (!a || !b || hi <= lo) return []
  return a.map((ai, i) => (b[i]! - ai) / (hi - lo))
}

// --- The automaton ----------------------------------------------------------------

export interface Fired {
  clock: number
  axis: string
  position: string
}

/**
 * The runtime: a state space, a clock, and the motions in flight. Pure
 * apart from `apply()`, which writes the display into the params.
 */
export class Automaton {
  readonly space: StateSpace
  /** Seconds since entry — advanced by the host (wall time) or by a test. */
  clock = 0
  /** Every fire, in order — the path walked (a song is one such path). */
  readonly journal: Fired[] = []

  readonly #axes = new Map<string, Axis>()
  readonly #position = new Map<string, string>()
  /** Which axis last set each param's motion (so a fire can retarget a verb's extras). */
  readonly #motion = new Map<Param<ParamValue>, Motion>()
  readonly #motionAxis = new Map<Param<ParamValue>, string>()
  /** Every param this automaton writes, with its value at entry. */
  readonly #base = new Map<Param<ParamValue>, ParamValue>()
  readonly #clockBase = new Map<Param<number>, number>()

  constructor(space: StateSpace) {
    this.space = space
    for (const a of space.axes) this.#axes.set(a.id, a)
  }

  get axes(): readonly Axis[] {
    return this.space.axes
  }

  axis(id: string): Axis {
    const a = this.#axes.get(id)
    if (!a) throw new Error(`no axis '${id}' (axes: ${[...this.#axes.keys()].join(", ")})`)
    return a
  }

  /**
   * Take hold of the world as it stands (the params' live values — the
   * timeline's pose at the held t), and read off each axis's position as
   * the nearest one. Resets the clock and the journal.
   */
  enter(): void {
    this.clock = 0
    this.journal.length = 0
    this.#motion.clear()
    this.#motionAxis.clear()
    this.#base.clear()
    this.#clockBase.clear()
    for (const a of this.space.axes) {
      for (const p of a.params()) this.#base.set(p, p.value)
      this.#position.set(a.id, nearestPosition(a))
    }
    for (const c of this.space.clocks ?? []) this.#clockBase.set(c, c.value)
  }

  /** The position an axis is at, or heading to. */
  position(id: string): string {
    return this.#position.get(id) ?? this.axis(id).positions[0]!.name
  }

  /** Is the axis walkable from the current display state (its `when`)? */
  enabled(id: string): boolean {
    const a = this.axis(id)
    return a.when ? a.when() : true
  }

  /** How far the axis's current transition has come, 0 → 1 (1 at rest). */
  progress(id: string): number {
    let lo = 1
    for (const [p, m] of this.#motion) {
      if (this.#motionAxis.get(p) !== id || m.d <= 0) continue
      lo = Math.min(lo, Math.min(1, Math.max(0, (this.clock - m.t0) / m.d)))
    }
    return lo
  }

  /** The position a fire without one goes to: the next in cycle order. */
  next(id: string): string {
    const a = this.axis(id)
    const i = a.positions.findIndex((p) => p.name === this.position(id))
    return a.positions[(i + 1) % a.positions.length]!.name
  }

  /** The displayed value of a param this automaton drives, at `clock`. */
  valueAt(param: Param<ParamValue>, clock = this.clock): ParamValue | undefined {
    const cb = this.#clockBase.get(param as Param<number>)
    if (cb !== undefined) return cb + clock
    const m = this.#motion.get(param)
    if (m) return sample(m, clock)
    return this.#base.get(param)
  }

  /**
   * Fire an axis toward `position` (default: the next) at the current
   * clock. Mid-flight is fine — it retargets continuously.
   */
  fire(id: string, position?: string): void {
    const a = this.axis(id)
    const to = position ?? this.next(id)
    const target = a.positions.find((p) => p.name === to)
    if (!target) throw new Error(`axis '${id}' has no position '${to}'`)
    const from = this.position(id)
    const t = this.clock
    this.journal.push({ clock: t, axis: id, position: to })
    this.#position.set(id, to)
    // Axes that share a param with this one (a scene's `poses` over a
    // holon's own axes) now head somewhere too: read where, off the goals.
    for (const other of this.space.axes) {
      if (other.id === id || !other.params().some((p) => target.values.has(p))) continue
      this.#position.set(other.id, nearestPosition(other, (p) => target.values.get(p) ?? this.#goal(p)))
    }

    // At rest along every param this axis touches? Then a verb may play.
    const touched = [...this.#motionAxis].filter(([, ax]) => ax === id).map(([p]) => p)
    const atRest = [...a.params(), ...touched].every((p) => {
      const m = this.#motion.get(p)
      return !m || t >= m.t0 + m.d
    })
    if (a.via && atRest && from !== to) {
      this.#playVia(a, from, to, target, t)
      return
    }
    // The continuous retarget: every param of the target position, plus any
    // a verb of this axis set moving (those go home to their entry value).
    const goals = new Map(target.values)
    for (const p of touched) if (!goals.has(p)) goals.set(p, this.#base.get(p) ?? p.value)
    for (const [p, goal] of goals) this.#retarget(p, goal, a, t)
  }

  /**
   * Hold an axis at a CONTINUOUS point of its positions — `u` ∈ [0, n − 1]
   * in cycle order (u = 1.5: halfway from the second position to the
   * third) — the hand's pinch-and-drag on a handle. Every param of the axis
   * stands still at the blend (numbers and colours interpolate; a flag or a
   * word steps at the halfway); the axis reads as its nearest position.
   * Let go with `settle`, which eases on from where it stands.
   */
  scrub(id: string, u: number): void {
    const a = this.axis(id)
    const n = a.positions.length
    const k = Math.min(Math.max(u, 0), n - 1)
    const i = Math.min(Math.floor(k), n - 2)
    const f = k - i
    const A = a.positions[i]!
    const B = a.positions[i + 1]!
    const t = this.clock
    for (const p of a.params()) {
      const va = A.values.get(p) ?? this.#goal(p)
      const vb = B.values.get(p) ?? this.#goal(p)
      const x = vec(va)
      const y = vec(vb)
      const v = x && y ? unvec(va, x.map((xi, j) => xi + (y[j]! - xi) * f)) : f < 0.5 ? va : vb
      if (!this.#base.has(p)) this.#base.set(p, p.value)
      this.#motion.set(p, { kind: "ease", from: v, v0: x ? x.map(() => 0) : [], to: v, t0: t, d: 0 })
      this.#motionAxis.set(p, a.id)
    }
    this.#position.set(id, a.positions[Math.round(k)]!.name)
  }

  /** End a scrub: ease on to the nearest position (or `position`), from where it stands. */
  settle(id: string, position?: string): void {
    this.fire(id, position ?? this.position(id))
  }

  /** Where a param is heading: its motion's end, else where it stands. */
  #goal(p: Param<ParamValue>): ParamValue {
    return this.#motion.get(p)?.to ?? this.#base.get(p) ?? p.value
  }

  #retarget(p: Param<ParamValue>, goal: ParamValue, a: Axis, t: number): void {
    const m = this.#motion.get(p)
    const now = m ? sample(m, t) : (this.#base.get(p) ?? p.value)
    const v0 = m ? velocity(m, t) : (vec(now)?.map(() => 0) ?? [])
    if (!this.#base.has(p)) this.#base.set(p, p.value)
    this.#motion.set(p, { kind: "ease", from: now, v0, to: goal, t0: t, d: a.duration })
    this.#motionAxis.set(p, a.id)
  }

  #playVia(a: Axis, from: string, to: string, target: Position, t: number): void {
    const anim = a.via!(from, to)
    // The verb's `to` tracks start from where each param STANDS: the
    // timeline resolves a first segment from the declared default, so lend
    // it the current value for the moment of construction.
    const params = [...new Set(anim.tracks.map((tr) => tr.param))]
    const saved = params.map((p) => p.defaultValue)
    params.forEach((p) => (p.defaultValue = this.valueAt(p, t) ?? p.value))
    let timeline: Timeline
    try {
      timeline = new Timeline([{ anim, start: 0, duration: a.duration }])
    } finally {
      params.forEach((p, i) => (p.defaultValue = saved[i]!))
    }
    for (const p of params) {
      if (!this.#base.has(p)) this.#base.set(p, p.value)
      const end = target.values.get(p) ?? timeline.valueAt(p, a.duration)
      this.#motion.set(p, { kind: "via", timeline, param: p, t0: t, d: a.duration, to: end })
      this.#motionAxis.set(p, a.id)
    }
    // Position params the verb does not move still arrive by the plain ease.
    for (const [p, goal] of target.values) if (!params.includes(p)) this.#retarget(p, goal, a, t)
  }

  /** Every param this automaton writes. */
  get params(): Param<ParamValue>[] {
    return [...new Set([...this.#base.keys(), ...this.#clockBase.keys()])] as Param<ParamValue>[]
  }

  /** The value each driven param had at entry — what a release returns to. */
  entryValue(p: Param<ParamValue>): ParamValue | undefined {
    return this.#clockBase.get(p as Param<number>) ?? this.#base.get(p)
  }

  /** Write the display at `clock` into the params (the live layer's one act). */
  apply(clock = this.clock): void {
    for (const p of this.params) {
      if (p.isBound) continue
      const v = this.valueAt(p, clock)
      if (v !== undefined) p.value = typeof v === "number" ? p.clamp(v) : v
    }
  }
}

/** The position whose values lie nearest the params' live values. */
/** The position of an axis nearest these values (live values by default) — what `enter` reads, and the lattice (src/lattice.ts). */
export const nearestPosition = (a: Axis, valueOf: (p: Param<ParamValue>) => ParamValue = (p) => p.value): string => {
  let best = a.positions[0]!.name
  let bestD = Infinity
  for (const pos of a.positions) {
    let d = 0
    for (const [p, v] of pos.values) {
      const x = vec(valueOf(p))
      const y = vec(v)
      d += x && y ? x.reduce((s, xi, i) => s + Math.abs(xi - y[i]!), 0) : valueOf(p) === v ? 0 : 1
    }
    if (d < bestD) {
      bestD = d
      best = pos.name
    }
  }
  return best
}
