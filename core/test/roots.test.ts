/**
 * Dream.roots — every tree once, each by its true root.
 *
 * A Group gathers its members only when it composes (the first time its
 * parts are read), so a member that the scene ALSO touches — animates it,
 * or stages it — has no parent yet when the scene lists what it touches,
 * and used to be listed as a root of its own. The host attaches every
 * root, so such a member was drawn twice: once inside its Group, once
 * loose at the origin (YinYang's two Globes, Hero's flower lattice).
 */

import { describe, expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { Circle, Group } from "../src/parts/primitives"
import { scenes } from "../demo/scenes"

/** A member that is animated and staged — and only gathered later. */
class Gathered extends Dream {
  dot = new Circle()
  group = new Group({ members: [this.dot] })
  unfold() {
    this.stage(this.group)
    this.play(this.dot.x.to(10), 1)
  }
}

/** Order must not matter: the member touched BEFORE its whole is staged. */
class MemberFirst extends Dream {
  dot = new Circle()
  group = new Group({ members: [this.dot] })
  unfold() {
    this.play(this.dot.x.to(10), 1)
    this.stage(this.dot)
    this.stage(this.group)
  }
}

/** Every holon reachable from the roots, counted — none may be reached twice via two roots. */
const reachedTwice = (roots: readonly { walk(): Iterable<object> }[]) => {
  const owner = new Map<object, number>()
  let twice = 0
  roots.forEach((r, i) => {
    for (const h of r.walk()) {
      const seen = owner.get(h)
      if (seen !== undefined && seen !== i) twice++
      owner.set(h, i)
    }
  })
  return twice
}

describe("Dream.roots", () => {
  test("a Group's member is not a root, though the scene animates it", () => {
    const d = new Gathered()
    expect(d.roots).toEqual([d.group])
  })

  test("nor when the member is touched before its whole", () => {
    const d = new MemberFirst()
    expect(d.roots).toEqual([d.group])
  })

  for (const key of ["yinyang", "globe", "web3s15", "o06", "o07"]) {
    test(`${key}: every root is a true root, and no holon hangs under two`, () => {
      const roots = new scenes[key]!().roots
      expect(roots.filter((r) => r.parent !== undefined)).toEqual([])
      expect(reachedTwice(roots)).toBe(0)
    })
  }
})
