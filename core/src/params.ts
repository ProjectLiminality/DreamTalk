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

export type ParamValue = number | boolean | Color

/** Anything a part property can be fed: a literal, a Param, or a derived reading. */
export type Source<T extends ParamValue> = T | Readable<T>

export interface Readable<T extends ParamValue> {
  readonly value: T
}

let nextParamId = 1

export class Param<T extends ParamValue = number> implements Readable<T> {
  readonly id: number
  readonly kind: ParamKind
  readonly min: number | undefined
  readonly max: number | undefined
  /** The declared default — what the param is before any timeline touches it. */
  defaultValue: T
  /** Set when the owning holon scans its fields. */
  name?: string
  owner?: object

  #value: T
  #source?: Readable<T>

  constructor(kind: ParamKind, value: T, min?: number, max?: number) {
    this.id = nextParamId++
    this.kind = kind
    this.defaultValue = value
    this.#value = value
    this.min = min
    this.max = max
  }

  /** The live value — written by Timeline.apply(t), the editor, or read through a binding. */
  get value(): T {
    return this.#source ? this.#source.value : this.#value
  }

  set value(v: T) {
    if (this.#source) {
      throw new Error(
        `Param '${this.name ?? this.id}' follows a derived binding; animate its source instead`,
      )
    }
    this.#value = v
  }

  /** Delegate this param to a derived reading (a read-only binding). */
  follow(source: Readable<T>): void {
    this.#source = source
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
    return v
  }

  // --- Animation: params animate themselves (replaces the .animate proxy) ---

  /** Animate to an absolute value. */
  to(v: T, opts: AnimOpts = {}): Anim {
    return animOf(this.track("to", [v], opts))
  }

  /** Animate by a relative offset (numeric params only). */
  by(dv: number, opts: AnimOpts = {}): Anim {
    if (this.kind === "color" || this.kind === "bool") {
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
  throw new Error("cannot scale a boolean value")
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

// --- States: discrete relational configurations ---

export class State {
  constructor(readonly values: Record<string, ParamValue>) {}
}

export const state = (values: Record<string, ParamValue>): State => new State(values)

/** Explicit bidirectional constraint — the rare, deliberate act. */
export const link = (a: Param<ParamValue>, b: Param<ParamValue>): void => {
  throw new Error("link() is reserved: bidirectional constraints arrive with the relationship engine")
}
