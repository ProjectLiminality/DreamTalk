/**
 * One parent per holon.
 *
 * A holon that is both a FIELD of a whole and a MEMBER of a Group inside
 * it used to be registered twice — once by the whole's field scan, once
 * by the Group's add — so a walk reached it twice and the host attached
 * (and drew) it twice: once inside its Group, and once directly under the
 * whole, where the Group's transform never reached it. Calculator's nine
 * holons, ~8.5k on pl02. The rule now: a holon has exactly one parent. An
 * adoption (`add`, a Group's members) MOVES the part out of its previous
 * whole; a field scan registers only a holon nobody owns yet.
 */

import { describe, expect, test } from "bun:test"
import { Holon } from "../src/holon"
import { Circle, Group, Null } from "../src/parts/primitives"
import { Calculator } from "../demo/creatormode/Calculator"
import { scenes } from "../demo/scenes"

/** Occurrences reached by walking, vs the holons behind them. */
const census = (roots: Iterable<Holon>) => {
  let attached = 0
  const unique = new Set<Holon>()
  for (const r of roots) {
    for (const h of r.walk()) {
      attached++
      unique.add(h)
    }
  }
  return { attached, unique: unique.size }
}

/** The member is a field, read (and so scanned) before the Group adopts it. */
class FieldThenMember extends Holon {
  dot = new Circle()
  group = new Group({ x: 50, members: [this.dot] })
}

/** The Group adopts first; the field is a reference to its member. */
class MemberThenField extends Holon {
  group = new Group({ x: 50, members: [new Circle()] })
  dot = this.group.members[0]!
}

/** A whole that adopts one of its own fields from compose(). */
class AddsItsField extends Holon {
  dot = new Circle()
  protected override compose(): void {
    this.add(this.dot)
  }
}

/** The chain of wholes above a holon — what its world transform composes. */
const chain = (h: Holon): Holon[] => {
  const out: Holon[] = []
  for (let n = h.parent; n; n = n.parent) out.push(n)
  return out
}

describe("one parent per holon", () => {
  test("a field that is also a Group member hangs under the Group only", () => {
    const w = new FieldThenMember()
    expect(census([w])).toEqual({ attached: 3, unique: 3 })
    expect(w.parts).toEqual([w.group])
    expect(w.group.parts).toEqual([w.dot])
    // The Group is off the origin: the member's transform must pass through it.
    expect(chain(w.dot)).toEqual([w.group, w])
  })

  test("nor when the Group adopted it before the field was declared", () => {
    const w = new MemberThenField()
    expect(census([w])).toEqual({ attached: 3, unique: 3 })
    expect(w.parts).toEqual([w.group])
    expect(chain(w.dot)).toEqual([w.group, w])
  })

  test("a whole that adds its own field holds it once", () => {
    const w = new AddsItsField()
    expect(w.parts).toEqual([w.dot])
    expect(census([w])).toEqual({ attached: 2, unique: 2 })
  })

  test("a holon adopted by a second Group moves to it", () => {
    const dot = new Circle()
    const a = new Group({ members: [dot] })
    const b = new Group({ members: [dot] })
    expect(a.parts).toEqual([])
    expect(b.parts).toEqual([dot])
    expect(dot.parent).toBe(b)
  })

  test("Calculator: every holon attached once", () => {
    const calc = new Calculator()
    expect(census([calc])).toEqual({ attached: 11, unique: 11 })
    expect(calc.parts).toEqual([calc.all])
    for (const m of calc.all.members) expect(m.parent).toBe(calc.all)
  })

  test("a Null's plain field is still its part", () => {
    class Holder extends Null {
      dot = new Circle()
    }
    const n = new Holder()
    expect(n.parts).toEqual([n.dot])
    expect(n.dot.parent).toBe(n)
  })

  for (const key of ["creatormode", "slide32", "p02g", "pl02"]) {
    test(`${key}: no holon reached twice from the roots`, () => {
      const { attached, unique } = census(new scenes[key]!().roots)
      expect(attached).toBe(unique)
    })
  }
})
