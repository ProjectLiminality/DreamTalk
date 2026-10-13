/**
 * Forms — one thing in several forms, and a morph between any two as a
 * walkable state: a dot, the truck it stands for, the word that names it.
 *
 *     dot = new Circle({ radius: 40, tint: BLUE, fillOpacity: 1 })
 *     truck = new Truck({ observer: this.observer, opacity: 0 })
 *     word = new Word("truck", { observer: this.observer, opacity: 0 })
 *     forms = new Forms({ dot: this.dot, truck: this.truck, word: this.word })
 *     …
 *     this.play(this.forms.morph("dot", "truck"), 4)   // the song's spelling
 *
 * In free play (?play=free) the forms are a STATE AXIS, "form", whose
 * positions are the forms themselves: click any of them (or press "f") and
 * it becomes the next, by the real morph between those two (`Morph(a, b)`
 * — its `via`). Interrupted mid-flight, the automaton retargets every
 * form's visibility smoothly toward the new position, so even a reversal
 * halfway lands somewhere true.
 *
 * Declare the forms as fields, the first visible and the rest hidden
 * (`opacity: 0`); Forms builds every pairwise morph up front, as its own
 * parts, so they exist when the scene mounts.
 */

import { together, type Anim } from "../../src/anim"
import type { Observer } from "../../src/dream"
import type { Holon, Overrides } from "../../src/holon"
import type { Axis, Position, StateSpace } from "../../src/automaton"
import type { Param, ParamValue } from "../../src/params"
import { Null } from "../../src/parts/primitives"
import { Word } from "../Word/Word"
import { ownParams } from "./MorphCurves"
import { morphAny, type MorphAnyOptions, type MorphResult } from "./universal"

export interface FormsOptions {
  observer?: Observer
  /** Seconds a free-play transition takes. Default 4. */
  duration?: number
  /** Key that steps to the next form. Default "f". */
  key?: string
  /** Options for every pairwise morph. */
  morph?: MorphAnyOptions
}

export class Forms extends Null {
  private set!: {
    names: string[]
    forms: Record<string, Holon>
    morphs: Map<string, MorphResult>
    opts: FormsOptions
  }

  constructor(forms: Record<string, Holon>, overrides: Overrides & FormsOptions = {}) {
    const { observer, duration, key, morph, ...rest } = overrides
    super(rest)
    this.set = { names: Object.keys(forms), forms, morphs: new Map(), opts: { observer, duration, key, morph } }
    if (this.set.names.length < 2) throw new Error("Forms: needs at least two forms to morph between")
  }

  /** The morph a → b (built up front), for the song: `this.play(forms.morph("dot", "truck"), 4)`. */
  morph(from: string, to: string): Anim {
    void this.parts
    const m = this.set.morphs.get(`${from}→${to}`)
    if (!m) throw new Error(`Forms: no form '${!this.set.forms[from] ? from : to}' (${this.set.names.join(", ")})`)
    return m.there()
  }

  protected override compose(): void {
    const { names, forms, morphs, opts } = this.set
    const own = new Set(Object.values(forms))
    // One Morph(a, b) per unordered pair carries both directions.
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i]!
        const b = names[j]!
        const m = morphAny(forms[a]!, forms[b]!, { observer: opts.observer, ...opts.morph })
        morphs.set(`${a}→${b}`, m)
        morphs.set(`${b}→${a}`, { ...m.back(), route: m.route, there: () => m.back(), back: () => m.there(), holons: m.holons })
        for (const h of m.holons) if (!own.has(h) && !(h instanceof Word && own.has(h))) this.add(h)
      }
  }

  /**
   * The axis "form": one position per form. Each position names EVERY
   * form's visibility — the form itself at what it was declared as (its
   * whole at 1), every other at 0 — and every morpher put away, so the
   * automaton's smooth retarget lands somewhere true even off the verb.
   */
  override stateSpace(): StateSpace {
    void this.parts
    const { names, forms, morphs, opts } = this.set
    const morphers = [...new Set([...morphs.values()].flatMap((m) => m.holons))].filter(
      (h) => !Object.values(forms).includes(h),
    )
    const positions: Position[] = names.map((name) => {
      const values = new Map<Param<ParamValue>, ParamValue>()
      for (const other of names) {
        const h = forms[other]!
        for (const p of ownParams(h, "opacity"))
          values.set(p as Param<ParamValue>, other === name ? (p === h.opacity ? 1 : p.defaultValue) : 0)
        for (const p of ownParams(h, "fillOpacity")) values.set(p as Param<ParamValue>, other === name ? p.defaultValue : 0)
      }
      for (const m of morphers) for (const p of ownParams(m, "opacity")) values.set(p as Param<ParamValue>, 0)
      return { name, values }
    })
    const axis: Axis = {
      id: "form",
      owner: this,
      label: "form",
      duration: opts.duration ?? 4,
      positions,
      key: opts.key ?? "f",
      via: (from, to) => this.morph(from, to),
      handles: () => Object.values(forms),
      to: (name) => {
        const pos = positions.find((p) => p.name === name)
        if (!pos) throw new Error(`Forms: no form '${name}' (${names.join(", ")})`)
        return together(...[...pos.values].map(([p, v]) => p.to(v)))
      },
      params: () => [...new Set(positions.flatMap((p) => [...p.values.keys()]))],
    }
    return { axes: [axis] }
  }
}
