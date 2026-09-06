/**
 * Selection (EDITOR-V3 step 1): the two pure pieces the editor rests on.
 *
 *  - the selection PATH, which is what carries a selection across a
 *    code→UI remount (holon identities do not survive a rebuild);
 *  - what the inspector decides to SHOW, which is the promotion protocol
 *    (PARAMETERS.md) made mechanical.
 *
 * The picking itself needs a GPU and is verified headless against the
 * live editor; everything here runs on the CPU with no host at all.
 */

import { describe, expect, test } from "bun:test"
import { Holon } from "../src/holon"
import { Dream } from "../src/dream"
import { Create } from "../src/verbs"
import { PI, BLUE } from "../src/constants"
import { Circle, Rectangle, Square } from "../src/parts/index"
import { Cylinder } from "../vocabulary/Cylinder/Cylinder"
import { Eye } from "../vocabulary/Eye/Eye"
import { length } from "../src/params"
import { pathOf, Selection } from "../editor/selection"
import { inspectorGroups, STANDARD_PARAMS } from "../editor/inspector"
import { identityOf, rootIdentityOf } from "../editor/outline"

class Pair extends Holon {
  left = new Circle({ radius: 40 })
  right = new Square({ size: 60 })
}

class PairDream extends Dream {
  pair = new Pair()
  lone = new Cylinder({ radius: 20 })

  unfold() {
    this.play(Create(this.pair), 1)
    this.play(this.lone.p.to(PI / 2), 2)
  }
}

describe("the selection store", () => {
  test("notifies on change, and only on change", () => {
    const selection = new Selection()
    const seen: (string | null)[] = []
    selection.subscribe((h) => seen.push(h ? h.constructor.name : null))
    expect(seen).toEqual([null]) // subscribe fires immediately

    const circle = new Circle()
    selection.set(circle)
    selection.set(circle) // same holon — no second notification
    selection.clear()
    selection.clear()
    expect(seen).toEqual([null, "Circle", null])
  })

  test("unsubscribing stops notifications", () => {
    const selection = new Selection()
    let count = 0
    const off = selection.subscribe(() => count++)
    selection.set(new Circle())
    off()
    selection.set(new Square())
    expect(count).toBe(2) // immediate + one change
  })
})

describe("selection paths (surviving a remount)", () => {
  test("a part resolves back to its counterpart in a fresh Dream", () => {
    const before = new PairDream()
    const target = before.pair.right
    const path = pathOf(before.roots, target)
    expect(path).toBeDefined()
    expect(path!.className).toBe("Square")

    // A rebuild: new instances, same structure.
    const after = new PairDream()
    const selection = new Selection()
    selection.rehydrate(after.roots, path)
    expect(selection.current).toBe(after.pair.right)
    expect(selection.current).not.toBe(target)
  })

  test("a root resolves to itself", () => {
    const dream = new PairDream()
    const path = pathOf(dream.roots, dream.lone)
    expect(path!.indices).toEqual([])
    const fresh = new PairDream()
    const selection = new Selection()
    selection.rehydrate(fresh.roots, path)
    expect(selection.current).toBe(fresh.lone)
  })

  test("a path whose destination changed class resolves to nothing", () => {
    const dream = new PairDream()
    const path = { ...pathOf(dream.roots, dream.pair.left)!, className: "Rectangle" }
    const selection = new Selection()
    selection.rehydrate(dream.roots, path)
    expect(selection.current).toBeNull()
  })

  test("a holon outside the root list has no path", () => {
    const dream = new PairDream()
    expect(pathOf(dream.roots, new Circle())).toBeUndefined()
  })
})

describe("what the inspector shows (the promotion protocol)", () => {
  test("declared params appear; untouched standard params do not", () => {
    const dream = new PairDream()
    const animated = dream.build().params
    const names = inspectorGroups(dream.lone, animated).flatMap((g) =>
      g.entries.map((e) => e.name),
    )
    // Cylinder declares radius/height on top of Stroke's own set…
    expect(names).toContain("radius")
    expect(names).toContain("height")
    expect(names).toContain("tint")
    // …its p is animated by this Dream, so it shows…
    expect(names).toContain("p")
    // …and its untouched standard params stay hidden. No dumps.
    expect(names).not.toContain("x")
    expect(names).not.toContain("h")
    expect(names).not.toContain("scale")
  })

  test("the same holon in a Dream that animates nothing shows no transform", () => {
    class StillDream extends Dream {
      cyl = new Cylinder()
      unfold() {
        this.stage(this.cyl)
        this.wait(1)
      }
    }
    const dream = new StillDream()
    const groups = inspectorGroups(dream.cyl, dream.build().params)
    expect(groups.map((g) => g.title)).not.toContain("Transform")
  })

  test("every shown standard param is one the timeline animates", () => {
    const dream = new PairDream()
    const animated = dream.build().params
    for (const holon of dream.lone.walk()) {
      for (const group of inspectorGroups(holon, animated)) {
        for (const { name, param, reason } of group.entries) {
          if (STANDARD_PARAMS.has(name)) {
            expect(reason).toBe("animated")
            expect(animated).toContain(param)
          } else {
            expect(reason).toBe("declared")
          }
        }
      }
    }
  })

  test("each param appears exactly once, in exactly one group", () => {
    const dream = new PairDream()
    const names = inspectorGroups(dream.lone, dream.build().params).flatMap((g) =>
      g.entries.map((e) => e.name),
    )
    expect(new Set(names).size).toBe(names.length)
  })

  test("a bound param is still shown — read-only is the panel's job", () => {
    class Whole extends Holon {
      size = length(200)
      ring = new Circle({ radius: this.size.times(0.5) })
    }
    const whole = new Whole()
    expect(whole.ring.radius.isBound).toBe(true)
    const names = inspectorGroups(whole.ring, []).flatMap((g) => g.entries.map((e) => e.name))
    expect(names).toContain("radius")
  })
})

describe("identities (the name a human wrote)", () => {
  test("a part is known by its field name in its whole", () => {
    const pair = new Pair()
    expect(identityOf(pair.left)).toBe("left")
    expect(identityOf(pair.right)).toBe("right")
  })

  test("a root is known by its field name in the Dream", () => {
    const dream = new PairDream()
    expect(rootIdentityOf(dream, dream.lone)).toBe("lone")
    expect(rootIdentityOf(dream, dream.pair)).toBe("pair")
  })

  test("an anonymous holon has no identity, and that is fine", () => {
    expect(identityOf(new Circle())).toBeUndefined()
  })

  test("the vocabulary's composed parts carry their authored names", () => {
    const eye = new Eye()
    const named = eye.parts.map((p) => identityOf(p))
    expect(named).toContain("iris")
    expect(named).toContain("pupil")
    void new Rectangle({ tint: BLUE })
  })
})
