/**
 * Holon — every whole is also a part.
 *
 * Parameters and parts are class fields; declaration is registration.
 * Constructor overrides either set a param's default (literal), BIND it
 * (pass a Param — shared reference), or delegate it to a derived reading
 * (pass p.times(k) etc.). Conditional/repeated parts use the compose()
 * hook with this.add().
 *
 * Mechanics: the constructor returns a transparent Proxy whose get-trap
 * runs an INCREMENTAL field scan, so overrides and bindings are applied
 * by the time anyone — including code on the very next line — observes
 * the instance. The scan only ever touches fields whose initializers have
 * already run, so mid-construction scans are harmless and repeatable.
 * Internals live in a WeakMap side-table because a Proxy'd `this` cannot
 * reach #-private fields.
 *
 * Once complete() has run (first .params/.parts access: overrides
 * verified, compose() done) the holon SETTLES: the field set is final,
 * reads bypass the scan entirely, and assigning a new Param/part field
 * throws — dynamic structure goes through compose() + this.add(), which
 * exist for exactly that. Pinned by test/settled.test.ts.
 */

import { together, type Anim } from "./anim"
import {
  angle,
  completion,
  isReadable,
  scalar,
  Param,
  State,
  type ParamValue,
  type Readable,
} from "./params"

export type Overrides = Record<string, unknown>

interface Internals {
  overrides: Map<string, unknown>
  params: Map<string, Param<ParamValue>>
  parts: Holon[]
  dynamicParts: Holon[]
  /** Object.keys count at last scan — cheap change detection. */
  scannedKeys: number
  composed: boolean
  /**
   * Structure is final — construction and compose() are behind us, so
   * property reads skip the scan (no Object.keys per get, ever again)
   * and the set trap rejects late Param/part fields. Flipped at the end
   * of the first complete().
   */
  settled: boolean
  /** The public identity (the proxy) — used for parent links. */
  self?: Holon
}

const INTERNALS = new WeakMap<object, Internals>()

const internalsOf = (h: object): Internals => {
  const found = INTERNALS.get(h)
  if (!found) throw new Error("Holon internals missing — was the constructor bypassed?")
  return found
}

/** Incremental scan: register params/parts and apply matured overrides. */
const scan = (target: Holon): void => {
  const int = internalsOf(target)
  const keys = Object.keys(target)
  if (keys.length === int.scannedKeys) return
  int.scannedKeys = keys.length

  for (const [name, value] of Object.entries(target)) {
    if (name === "parent" || name === "states") continue
    if (value instanceof Param) {
      const known = int.params.get(name)
      if (known === (value as Param<ParamValue>)) continue
      if (int.overrides.has(name)) {
        const o = int.overrides.get(name)
        int.overrides.delete(name)
        if (o instanceof Param) {
          ;(target as unknown as Record<string, unknown>)[name] = o
          int.params.set(name, o as Param<ParamValue>)
          continue
        }
        if (isReadable(o)) {
          value.follow(o as Readable<ParamValue>)
        } else {
          value.defaultValue = value.clamp(o as ParamValue)
          value.value = value.defaultValue
        }
      }
      if (value.name === undefined) {
        value.name = name
        value.owner = int.self ?? target
      }
      int.params.set(name, value as Param<ParamValue>)
    } else if (value instanceof Holon) {
      if (!int.parts.includes(value)) {
        value.parent = int.self ?? target
        int.parts.push(value)
      }
    } else if (int.overrides.has(name)) {
      // Plain config field (path, orientation, flags…) whose initializer has run.
      ;(target as unknown as Record<string, unknown>)[name] = int.overrides.get(name)
      int.overrides.delete(name)
    }
  }
}

/**
 * Post-construction completion: leftover overrides are typos; compose()
 * runs once; then the holon SETTLES.
 *
 * Settling is the last act, deliberately: compose() is where dynamic
 * structure belongs, and it assigns Holon-valued fields of its own
 * (Labyrinth's `this.citadel`), so the field set is only final once it
 * has returned. compose() re-enters here — reading `this.parts` inside
 * it is normal — and the `composed` guard makes the inner call a
 * no-op scan, leaving the outer call to settle exactly once.
 */
const complete = (self: Holon): void => {
  const int = internalsOf(self)
  if (int.settled) return
  scanViaProxy(self)
  if (int.overrides.size > 0) {
    const bad = [...int.overrides.keys()].join("', '")
    const valid = [...int.params.keys()].join(", ")
    throw new Error(
      `${self.constructor.name}: unknown constructor option '${bad}' (params: ${valid})`,
    )
  }
  if (!int.composed) {
    int.composed = true
    self["compose"]()
    // compose() may have declared fields of its own; catch them, then settle.
    scanViaProxy(self)
    int.settled = true
  }
}

// scan() takes the raw target; public accessors hold the proxy — resolve either.
const scanViaProxy = (h: Holon): void => scan(h)

export class Holon {
  // Standard parameters — on every holon, at every level, by default (TASTE)
  x = scalar(0)
  y = scalar(0)
  z = scalar(0)
  h = angle(0)
  p = angle(0)
  b = angle(0)
  scale = scalar(1)
  /** Draw-on completion: 0 = not yet manifest, 1 = fully drawn. */
  creation = completion(1)
  /** Fade opacity, orthogonal to creation. */
  opacity = completion(1)

  parent?: Holon
  /** States registry — assign `states = { idle: state({...}), ... }` in subclasses. */
  states: Record<string, State> = {}

  constructor(overrides: Overrides = {}) {
    const internals: Internals = {
      overrides: new Map(Object.entries(overrides)),
      params: new Map(),
      parts: [],
      dynamicParts: [],
      scannedKeys: -1,
      composed: false,
      settled: false,
    }
    INTERNALS.set(this, internals)
    const proxy = new Proxy(this, {
      get(target, prop, receiver) {
        // Settled holons skip the scan entirely — no Object.keys per read.
        if (typeof prop === "string" && !internals.settled) scan(target)
        return Reflect.get(target, prop, receiver)
      },
      set(target, prop, value, receiver) {
        if (
          internals.settled &&
          typeof prop === "string" &&
          (value instanceof Param || value instanceof Holon) &&
          !Object.prototype.hasOwnProperty.call(target, prop)
        ) {
          throw new Error(
            `${target.constructor.name}: cannot add '${prop}' after construction — ` +
              `the field set is final once compose() has run. Declare it as a class ` +
              `field, or add dynamic structure from compose() with this.add().`,
          )
        }
        return Reflect.set(target, prop, value, receiver)
      },
    })
    INTERNALS.set(proxy, internals)
    internals.self = proxy as unknown as Holon
    return proxy as unknown as this
  }

  /** Optional hook for conditional/repeated parts; use this.add(). */
  protected compose(): void {}

  /**
   * Optional per-class Create choreography. `Create(holon)` consults this
   * before falling back to the default deep-parallel draw-on — the classic
   * grammar's per-class dispatch (CreateEye, CreateAxes, …), owned by the
   * class itself. Return an Anim covering self and parts, or undefined
   * for the default.
   */
  createAnim(): Anim | undefined {
    return undefined
  }

  /**
   * Optional per-class UnCreate choreography — the mirror of createAnim().
   * The classic grammar dispatches destruction too (UnCreateEye's
   * iris-then-lids, UnCreateAxes' erase-from-the-start), and the two are
   * genuinely different verbs: UnCreateAxes is built on Erase, not on
   * UnDraw, so a grid sweeps away rather than retracting. Return an Anim
   * covering self and parts, or undefined for the default retract.
   */
  unCreateAnim(): Anim | undefined {
    return undefined
  }

  /** Register a dynamically composed part. */
  protected add<T extends Holon>(part: T): T {
    const int = internalsOf(this)
    part.parent = int.self ?? this
    int.dynamicParts.push(part)
    return part
  }

  get params(): ReadonlyMap<string, Param<ParamValue>> {
    complete(this)
    return internalsOf(this).params
  }

  get parts(): readonly Holon[] {
    complete(this)
    const int = internalsOf(this)
    return [...int.parts, ...int.dynamicParts]
  }

  /** Self and all descendants, depth-first. */
  *walk(): Generator<Holon> {
    yield internalsOf(this).self ?? this
    for (const part of this.parts) yield* part.walk()
  }

  /** Animate into a discrete relational configuration. */
  transitionTo(target: State): Anim {
    const params = this.params
    const anims: Anim[] = []
    for (const [name, value] of Object.entries(target.values)) {
      const param = params.get(name)
      if (!param) throw new Error(`${this.constructor.name}: state targets unknown param '${name}'`)
      anims.push(param.to(value))
    }
    return together(...anims)
  }

  get root(): Holon {
    let node: Holon = internalsOf(this).self ?? this
    while (node.parent) node = node.parent
    return node
  }
}
