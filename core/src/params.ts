/**
 * Parameters — the degrees of freedom of a holon.
 *
 * Semantic types are runtime VALUES (`fold = bipolar(0)`), not type
 * annotations: they introspect, serialize, drive the editor UI, and carry
 * range semantics. Passing a Param where a value is expected IS a binding
 * (see SYNTAX-TS.md — this replaces the Python canon's `<<` operator).
 */

import { isColor, type Color } from "./constants"
import type { Anim, Easing, Track } from "./anim"

export type ParamKind =
  | "scalar"
  | "length"
  | "angle"
  | "bipolar"
  | "completion"
  | "color"
  | "integer"
  | "bool"
  | "text"
  | "choice"

export type ParamValue = number | boolean | string | Color

/** Anything a part property can be fed: a literal, a Param, or a derived reading. */
export type Source<T extends ParamValue> = T | Readable<T>

export interface Readable<T extends ParamValue> {
  readonly value: T
}

let nextParamId = 1

/**
 * A counter that moves on every param write that CHANGES something (a new
 * value, a gate, a bias, a binding) — and on a Line's points being assigned
 * (parts/primitives.ts). Rewriting a param with the value it already holds
 * leaves it be, so a re-applied but unchanged frame reads as unchanged. Between two reads
 * with the same epoch, nothing any param could say has changed, so a
 * derived reading may answer from a memo: the per-frame fast path for
 * holons whose dirty-keys are expensive (a morph reading a solid's
 * visible edges). It never makes a memo stale — only cheaper to confirm.
 */
let epoch = 0
export const paramEpoch = (): number => epoch
export const bumpParamEpoch = (): void => {
  epoch++
}

export class Param<T extends ParamValue = number> implements Readable<T> {
  readonly id: number
  readonly kind: ParamKind
  readonly min: number | undefined
  readonly max: number | undefined
  /** A `choice` param's closed vocabulary — the only strings it may hold. */
  readonly options: readonly string[] | undefined
  /**
   * Set by `asData()`: the holon field holding this param READS AS ITS
   * VALUE through the holon (holon.ts records the field at scan). See
   * asData below.
   */
  asData = false
  /** The declared default — what the param is before any timeline touches it. */
  defaultValue: T
  /** Set when the owning holon scans its fields. */
  name?: string
  owner?: object

  #value: T
  #source?: Readable<T>
  #gate = 1
  #bias = 0
  #changedAt = 0

  constructor(
    kind: ParamKind,
    value: T,
    min?: number,
    max?: number,
    options?: readonly string[],
  ) {
    this.id = nextParamId++
    this.kind = kind
    this.min = min
    this.max = max
    this.options = options
    // Only a choice validates its default here; numeric defaults stay as
    // declared (clamping applies to what overrides and timelines write).
    this.defaultValue = options ? this.clamp(value) : value
    this.#value = this.defaultValue
  }

  /** The live value — written by Timeline.apply(t), the editor, or read through a binding. */
  get value(): T {
    const v = this.#source ? this.#source.value : this.#value
    if (typeof v !== "number" || (this.#gate === 1 && this.#bias === 0)) return v
    return (v * this.#gate + this.#bias) as unknown as T
  }

  /**
   * A multiplier over a NUMERIC param's reading, whoever produces it — the
   * timeline, the editor, or a binding. 1 (the default) is transparent.
   *
   * It exists for DreamSong's visibility gate: a song hides inactive chapters
   * and ramps crossfades by scaling every holon's opacity, and a BOUND
   * opacity (`.follow()`, or a reading passed at construction) cannot be
   * written. Gating the reading works the same for both, and never disturbs
   * the value or the binding underneath — set it back to 1 and the param
   * reads exactly what it would have.
   */
  get gate(): number {
    return this.#gate
  }

  set gate(k: number) {
    if (Object.is(k, this.#gate)) return
    this.#gate = k
    this.#changedAt = ++epoch
  }

  /**
   * An offset added to a NUMERIC param's reading, after the gate — 0 (the
   * default) is transparent. Like the gate it never touches the value or
   * the binding underneath, so it works on a bound param too.
   *
   * It exists for the VIEWER'S camera (src/view.ts): orbiting a paused or
   * free-play scene biases the observer's phi/theta/x/y/z (and gates its
   * radius or zoom), so the host's camera AND every holon that reads the
   * observer (Earth's horizon, a Lens, a Grain's facing) see the one
   * effective pose — even where a rig binds the observer (EarthView).
   * Nothing in a Dream sets it; exports and the gauntlet never see it.
   */
  get bias(): number {
    return this.#bias
  }

  set bias(d: number) {
    if (d === this.#bias) return
    this.#bias = d
    this.#changedAt = ++epoch
  }

  set value(v: T) {
    if (this.#source) {
      throw new Error(
        `Param '${this.name ?? this.id}' follows a derived binding; animate its source instead`,
      )
    }
    // An identical write changes nothing any memo could see: the epoch
    // moves only when a value does (the timeline re-applies every param on
    // every frame, and a held frame must read as held — three-host sync).
    if (Object.is(v, this.#value)) return
    this.#value = v
    this.#changedAt = ++epoch
  }

  /**
   * The paramEpoch of this param's last change of its OWN (a value, a gate,
   * a bias, a binding) — so a reader that remembers the epoch it last read
   * at can tell, with one integer compare and no reading, that an UNBOUND
   * param still says what it said (the host's per-holon dirty check). A
   * bound param's reading can change with no write of its own: ask
   * `isBound` and read it.
   */
  get changedAt(): number {
    return this.#changedAt
  }

  /** Delegate this param to a derived reading (a read-only binding). */
  follow(source: Readable<T>): void {
    this.#source = source
    this.#changedAt = ++epoch
  }

  get isBound(): boolean {
    return this.#source !== undefined
  }

  clamp(v: T): T {
    if (typeof v === "number") {
      let out: number = v
      if (this.min !== undefined) out = Math.max(this.min, out)
      if (this.max !== undefined) out = Math.min(this.max, out)
      if (this.kind === "integer") out = Math.round(out)
      return out as unknown as T
    }
    // A choice is a closed vocabulary: a string outside it is a typo in a
    // scene file or a stale override, and saying so beats rendering it.
    if (this.options && typeof v === "string" && !this.options.includes(v)) {
      throw new Error(
        `Param '${this.name ?? this.id}' is a choice of ${this.options.join(" ")} — not '${v}'`,
      )
    }
    return v
  }

  // --- Animation: params animate themselves (replaces the .animate proxy) ---

  /** Animate to an absolute value. */
  to(v: T, opts: AnimOpts = {}): Anim {
    return animOf(this.track("to", [v], opts))
  }

  /** Animate by a relative offset (numeric params only). */
  by(dv: number, opts: AnimOpts = {}): Anim {
    if (typeof this.defaultValue !== "number") {
      throw new Error(`Param '${this.name ?? this.id}' (${this.kind}) cannot animate .by()`)
    }
    return animOf(this.track("by", [dv as unknown as T], opts))
  }

  /** Animate through an explicit sequence of waypoints. */
  sequence(...values: T[]): Anim {
    if (values.length < 2) throw new Error("sequence() needs at least two waypoints")
    return animOf(this.track("sequence", values, {}))
  }

  private track(mode: Track["mode"], values: T[], opts: AnimOpts): Track {
    return {
      param: this as Param<ParamValue>,
      mode,
      values: values as ParamValue[],
      relStart: 0,
      relStop: 1,
      easing: opts.easing ?? "smooth",
    }
  }

  // --- Derived readings (read-only bindings) ---

  times(k: number): Readable<T> {
    return derive(() => scaleValue(this.value, k) as T)
  }

  plus(k: number): Readable<T> {
    const self = this
    return derive(() => {
      if (typeof self.value !== "number") throw new Error(".plus() needs a numeric param")
      return (self.value + k) as T
    })
  }

  map<U extends ParamValue>(fn: (v: T) => U): Readable<U> {
    return derive(() => fn(this.value))
  }
}

export interface AnimOpts {
  easing?: Easing
}

const animOf = (track: Track): Anim => ({ tracks: [track] })

const scaleValue = (v: ParamValue, k: number): ParamValue => {
  if (typeof v === "number") return v * k
  if (isColor(v)) return { r: v.r * k, g: v.g * k, b: v.b * k }
  throw new Error(`cannot scale a ${typeof v} value`)
}

/** A derived, read-only reading of one or more params. */
export const derive = <T extends ParamValue>(fn: () => T): Readable<T> => ({
  get value() {
    return fn()
  },
})

export const isReadable = (v: unknown): v is Readable<ParamValue> =>
  (typeof v === "object" && v !== null && "value" in (v as object)) &&
  !isColor(v)

/** Read any Source: literal, Param, or derived. */
export const read = <T extends ParamValue>(src: Source<T>): T =>
  isReadable(src) ? (src.value as T) : (src as T)

// --- Constructors (the vocabulary) ---

export const scalar = (v = 0) => new Param<number>("scalar", v)
export const length = (v = 0) => new Param<number>("length", v, 0)
export const angle = (v = 0) => new Param<number>("angle", v)
export const bipolar = (v = 0) => new Param<number>("bipolar", v, -1, 1)
export const completion = (v = 0) => new Param<number>("completion", v, 0, 1)
export const integer = (v = 0) => new Param<number>("integer", v)
export const bool = (v = false) => new Param<boolean>("bool", v)
export const color = (v: Color) => new Param<Color>("color", v)
/** A free string — what a Text says, a label, a name. Steps, never blends. */
export const text = (v = "") => new Param<string>("text", v)
/**
 * One of a closed set of strings — a rule picked from a vocabulary (the
 * calculator's operator). The editor offers exactly `options`, and a value
 * outside them is refused at construction rather than silently drawn.
 */
export const choice = (v: string, options: readonly string[]) =>
  new Param<string>("choice", v, undefined, undefined, options)

/**
 * Promote construction DATA to a param without changing what its readers see.
 *
 * `Text.content` was a plain string field read by the renderer, the
 * whiteboard and dozens of scenes. Declared as
 * `content = asData(text("Text"))` it is a full Param to the holon — it
 * registers, takes a literal, a shared Param or a derived reading at
 * construction, animates, and the editor can override it — while
 * `text.content` still reads as the string, because the holon's proxy
 * hands out the param's live VALUE for a field declared this way. The
 * Param itself is `holon.params.get("content")`.
 *
 * The cast is the point, and the one place it lives: the field's static
 * type is what every reader receives.
 */
export const asData = <T extends ParamValue>(param: Param<T>): T => {
  param.asData = true
  return param as unknown as T
}

// --- States: discrete relational configurations ---

export class State {
  constructor(readonly values: Record<string, ParamValue>) {}
}

export const state = (values: Record<string, ParamValue>): State => new State(values)

/** Explicit bidirectional constraint — the rare, deliberate act. */
export const link = (a: Param<ParamValue>, b: Param<ParamValue>): void => {
  throw new Error("link() is reserved: bidirectional constraints arrive with the relationship engine")
}
