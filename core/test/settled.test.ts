/**
 * The settled contract.
 *
 * A holon's field scan exists to make declaration be registration: a Param
 * or Holon written to a class field registers itself, even though the
 * initializer runs after the constructor body. That scan costs an
 * Object.keys() on EVERY property read, and it kept paying that cost
 * forever — 26ms/frame of TheWall's scrub was holons re-scanning fields
 * that had not changed since boot.
 *
 * They cannot change, and this file is why: once construction and
 * compose() are behind a holon, its Param/part field set is FINAL.
 * Dynamic structure has its own door — compose() + this.add() — and a
 * late Param or Holon field is a mistake, so it throws and says so
 * rather than silently failing to register (which is what a settled
 * holon would otherwise do).
 *
 * What settling must NOT break, and each has a test below:
 *   - compose() itself, which legitimately assigns new Holon fields
 *     (Labyrinth's `this.citadel = this.add(new Circle(...))`);
 *   - lazy plain-data memo fields written per-frame long after settling
 *     (Cable._baked, MindVirus._segments, Cylinder.section);
 *   - re-binding or mutating params that already exist.
 */

import { describe, expect, test } from "bun:test"
import { Holon } from "../src/holon"
import { scalar } from "../src/params"
import { Circle, Square } from "../src/parts/index"

describe("the field set is final after construction + compose", () => {
  test("params and parts registered before settling are complete", () => {
    class Thing extends Holon {
      size = scalar(3)
      eye = new Circle({ radius: this.size })
    }
    const t = new Thing()
    expect(t.params.get("size")).toBe(t.size)
    expect(t.parts).toContain(t.eye)
    // The standard set survives settling too.
    for (const name of ["x", "y", "z", "h", "p", "b", "scale", "creation", "opacity"]) {
      expect(t.params.has(name)).toBe(true)
    }
  })

  test("compose() may still add parts, and they register", () => {
    class Composed extends Holon {
      count = scalar(3)
      ring!: Circle
      protected override compose(): void {
        // Both doors: a named field AND this.add(), the Labyrinth shape.
        this.ring = this.add(new Circle({ radius: this.count }))
        for (let i = 0; i < 2; i++) this.add(new Square({ size: this.count }))
      }
    }
    const c = new Composed()
    expect(c.parts.length).toBe(3)
    expect(c.ring).toBeInstanceOf(Circle)
    expect(c.ring.parent).toBe(c)
    // Settling happened after compose(), not during it.
    expect(c.parts.length).toBe(3)
  })

  test("a scan still runs mid-construction, so the next line sees overrides", () => {
    class Early extends Holon {
      size = scalar(1)
      seen?: number
      constructor(o: Record<string, unknown> = {}) {
        super(o)
        // Reading a param here forces a scan; the override must be live.
        this.seen = this.size.value
      }
    }
    expect(new Early({ size: 9 }).seen).toBe(9)
  })
})

describe("late structure is a mistake, and says so", () => {
  test("assigning a new Param field after settling throws, pointing to compose()", () => {
    class Plain extends Holon {
      size = scalar(1)
    }
    const p = new Plain()
    void p.params // settle
    expect(() => {
      ;(p as unknown as Record<string, unknown>).extra = scalar(5)
    }).toThrow(/Plain.*'extra'.*compose\(\)/s)
  })

  test("assigning a new Holon field after settling throws too", () => {
    class Plain extends Holon {
      size = scalar(1)
    }
    const p = new Plain()
    void p.parts // settle
    expect(() => {
      ;(p as unknown as Record<string, unknown>).limb = new Circle()
    }).toThrow(/Plain.*'limb'.*compose\(\)/s)
  })

  test("the error names the holon, the field, and the way through", () => {
    class Widget extends Holon {}
    const w = new Widget()
    void w.params
    let message = ""
    try {
      ;(w as unknown as Record<string, unknown>).knob = scalar(0)
    } catch (err) {
      message = String((err as Error).message)
    }
    expect(message).toContain("Widget")
    expect(message).toContain("knob")
    expect(message).toContain("compose()")
  })
})

describe("what settling must not break", () => {
  test("lazy plain-data memo fields may still appear after settling", () => {
    // Cable._baked / MindVirus._segments / Cylinder.section: created as new
    // own properties long after settling, every one of them plain data.
    class Memoizer extends Holon {
      size = scalar(2)
      private memo?: { points: number[] }
      compute(): number[] {
        this.memo ??= { points: [1, 2, 3] }
        return this.memo.points
      }
    }
    const m = new Memoizer()
    void m.params
    expect(() => m.compute()).not.toThrow()
    expect(m.compute()).toEqual([1, 2, 3])
  })

  test("writing an existing param field (rebinding) is allowed after settling", () => {
    class Plain extends Holon {
      size = scalar(1)
    }
    const p = new Plain()
    void p.params
    const other = scalar(7)
    expect(() => {
      p.size = other
    }).not.toThrow()
  })

  test("mutating params and plain fields is untouched", () => {
    class Config extends Holon {
      size = scalar(1)
      mode = "wide"
      flags: string[] = []
    }
    const c = new Config()
    void c.params
    c.size.value = 5
    c.mode = "narrow"
    c.flags.push("a")
    expect(c.size.value).toBe(5)
    expect(c.mode).toBe("narrow")
    expect(c.flags).toEqual(["a"])
  })

  test("a redefined accessor over an existing field still works (derivePoints)", () => {
    // curves.ts installs a pull-based `points` accessor from compose(),
    // via Object.defineProperty on an already-declared field.
    class Liner extends Holon {
      points: number[] = []
      protected override compose(): void {
        let memo = [4, 5]
        Object.defineProperty(this, "points", {
          configurable: true,
          enumerable: true,
          get: () => memo,
          set: (_v: number[]) => {},
        })
        void memo
      }
    }
    const l = new Liner()
    void l.parts
    expect(l.points).toEqual([4, 5])
    expect(() => {
      l.points = [9]
    }).not.toThrow()
  })

  test("parent and states stay writable after settling", () => {
    class Plain extends Holon {
      size = scalar(1)
    }
    const child = new Plain()
    const parent = new Plain()
    void child.params
    expect(() => {
      child.parent = parent
    }).not.toThrow()
    expect(child.root).toBe(parent)
  })
})

describe("settling actually stops the scan", () => {
  test("reads after settling allocate no key scan", () => {
    class Thing extends Holon {
      size = scalar(1)
      eye = new Circle({ radius: this.size })
    }
    const t = new Thing()
    void t.params

    // A settled holon must not consult Object.keys again: swap it for a
    // counter and read a hundred properties.
    const realKeys = Object.keys
    let calls = 0
    try {
      Object.keys = ((o: object) => {
        calls++
        return realKeys(o)
      }) as typeof Object.keys
      for (let i = 0; i < 100; i++) {
        void t.size
        void t.eye
        void t.x
      }
    } finally {
      Object.keys = realKeys
    }
    expect(calls).toBe(0)
  })

  test("an unsettled holon does scan (the counter is meaningful)", () => {
    class Thing extends Holon {
      size = scalar(1)
    }
    const t = new Thing()
    const realKeys = Object.keys
    let calls = 0
    try {
      Object.keys = ((o: object) => {
        calls++
        return realKeys(o)
      }) as typeof Object.keys
      void t.size
    } finally {
      Object.keys = realKeys
    }
    expect(calls).toBeGreaterThan(0)
  })
})
