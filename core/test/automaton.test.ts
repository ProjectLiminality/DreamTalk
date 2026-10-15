import { describe, expect, test } from "bun:test"
import { Holon } from "../src/holon"
import { Automaton, axis, gatherStateSpace, toggle, type StateSpace } from "../src/automaton"
import { completion, scalar, state } from "../src/params"
import { Timeline } from "../src/timeline"

/** A tiny walkable holon: a grain axis over named States, a toggle, a clock. */
class Lamp extends Holon {
  grain = completion(0)
  shown = completion(1)
  time = scalar(0)
  override states = {
    plain: state({ grain: 0 }),
    sorted: state({ grain: 1 }),
  }
  override stateSpace(): StateSpace {
    return {
      axes: [
        axis("grain", this, { plain: this.states.plain, sorted: this.states.sorted }, { duration: 1 }),
        toggle("shown", this.shown, { duration: 0.5, when: () => this.grain.value > 0.5 }),
      ],
      clocks: [this.time],
    }
  }
}

const walk = (fires: [number, string, string?][], until: number, step: number) => {
  const lamp = new Lamp()
  const a = new Automaton(gatherStateSpace([lamp]))
  a.enter()
  const out: number[] = []
  let k = 0
  for (let c = 0; c <= until + 1e-9; c += step) {
    while (k < fires.length && fires[k]![0] <= c + 1e-9) {
      a.clock = fires[k]![0]
      a.fire(fires[k]![1], fires[k]![2])
      k++
    }
    a.clock = c
    a.apply()
    out.push(lamp.grain.value)
  }
  return { lamp, a, out }
}

describe("automaton", () => {
  test("entry reads positions off the live pose; clocks run", () => {
    const lamp = new Lamp({ grain: 1 })
    const a = new Automaton(gatherStateSpace([lamp]))
    a.enter()
    expect(a.position("grain")).toBe("sorted")
    expect(a.position("shown")).toBe("on")
    expect(a.next("grain")).toBe("plain")
    a.clock = 2.5
    a.apply()
    expect(lamp.time.value).toBeCloseTo(2.5, 9)
    expect(lamp.grain.value).toBe(1)
  })

  test("from rest a transition is the song's own ease (same curve as param.to)", () => {
    const lamp = new Lamp()
    const a = new Automaton(gatherStateSpace([lamp]))
    a.enter()
    a.fire("grain", "sorted")
    const tl = new Timeline([{ anim: lamp.grain.to(1), start: 0, duration: 1 }])
    for (const c of [0, 0.1, 0.33, 0.5, 0.8, 1, 1.4]) {
      expect(a.valueAt(lamp.grain, c) as number).toBeCloseTo(tl.valueAt(lamp.grain, c), 9)
    }
    // The song's spelling of the same position is exactly transitionTo.
    expect(a.axis("grain").to("sorted").tracks[0]!.values).toEqual([1])
  })

  test("deterministic: display = f(fires, clock), independent of sampling rate", () => {
    const fires: [number, string, string?][] = [
      [0.1, "grain", "sorted"],
      [0.55, "grain", "plain"],
      [0.8, "grain", "sorted"],
    ]
    const coarse = walk(fires, 2, 0.05)
    const fine = walk(fires, 2, 0.001)
    for (let i = 0; i < coarse.out.length; i++) expect(fine.out[i * 50]!).toBeCloseTo(coarse.out[i]!, 9)
    // And a fresh automaton queried directly, no frames at all, agrees.
    expect(coarse.a.journal.map((f) => f.position)).toEqual(["sorted", "plain", "sorted"])
    expect(coarse.out.at(-1)).toBe(1)
  })

  test("reversal mid-flight is continuous in value and velocity (no pop, no kink)", () => {
    const lamp = new Lamp()
    const a = new Automaton(gatherStateSpace([lamp]))
    a.enter()
    a.fire("grain", "sorted")
    const tr = 0.4
    const before = a.valueAt(lamp.grain, tr) as number
    const vBefore = ((a.valueAt(lamp.grain, tr) as number) - (a.valueAt(lamp.grain, tr - 1e-4) as number)) / 1e-4
    a.clock = tr
    a.fire("grain") // the next position: back to plain
    expect(a.position("grain")).toBe("plain")
    const after = a.valueAt(lamp.grain, tr) as number
    const vAfter = ((a.valueAt(lamp.grain, tr + 1e-4) as number) - after) / 1e-4
    expect(after).toBeCloseTo(before, 12)
    expect(vBefore).toBeGreaterThan(0.5) // it was really moving
    expect(Math.abs(vAfter - vBefore)).toBeLessThan(0.02 * vBefore)
    // It swings on a little, turns, and arrives home at rest.
    expect(a.valueAt(lamp.grain, tr + 0.1) as number).toBeGreaterThan(before)
    expect(a.valueAt(lamp.grain, tr + 1)).toBe(0)
    // Every sample on the way stays inside the param's range.
    for (let c = tr; c <= tr + 1; c += 0.01) {
      a.clock = c
      a.apply()
      expect(lamp.grain.value).toBeGreaterThanOrEqual(0)
      expect(lamp.grain.value).toBeLessThanOrEqual(1)
    }
  })

  test("the adjacent possible: `when` reads the display state", () => {
    const lamp = new Lamp()
    const a = new Automaton(gatherStateSpace([lamp]))
    a.enter()
    expect(a.enabled("shown")).toBe(false)
    a.fire("grain", "sorted")
    a.clock = 1
    a.apply()
    expect(a.enabled("shown")).toBe(true)
    expect(a.progress("grain")).toBe(1)
  })

  test("a verb plays from rest; interrupted, it hands over continuously", () => {
    class Verb extends Lamp {
      override stateSpace(): StateSpace {
        return {
          axes: [
            axis("grain", this, { plain: { grain: 0 }, sorted: { grain: 1 } }, {
              duration: 1,
              // Overshoot-free two-step: sweep `shown` down while grain rises.
              via: (_f, to) =>
                to === "sorted" ? { tracks: [...this.grain.to(1).tracks, ...this.shown.sequence(1, 0, 1).tracks] } : this.grain.to(0),
            }),
          ],
        }
      }
    }
    const v = new Verb()
    const a = new Automaton(gatherStateSpace([v]))
    a.enter()
    a.fire("grain", "sorted")
    expect(a.valueAt(v.shown, 0.5) as number).toBeCloseTo(0, 6)
    const s = a.valueAt(v.shown, 0.3) as number
    a.clock = 0.3
    a.fire("grain", "plain")
    expect(a.valueAt(v.shown, 0.3) as number).toBeCloseTo(s, 9)
    // The verb's extra param goes home to its entry value.
    expect(a.valueAt(v.shown, 1.3)).toBe(1)
    expect(a.valueAt(v.grain, 1.3)).toBe(0)
  })

  test("two of the same holon get distinct axis ids", () => {
    const space = gatherStateSpace([new Lamp(), new Lamp()])
    expect(space.axes.map((x) => x.id)).toEqual(["grain", "shown", "grain#2", "shown#2"])
  })
})

describe("FlowMap as the first citizen", () => {
  test("declares its axes; the adjacent possible follows the picture", async () => {
    const { FlowMap } = await import("../vocabulary/FlowMap/FlowMap")
    const m = new FlowMap({ radius: 300 })
    void m.parts
    const a = new Automaton(gatherStateSpace([m]))
    expect(a.axes.map((x) => x.id)).toEqual([
      "grain", "expand", "labels", "raw", "semi", "finished",
      "raw.open", "raw.certainty", "semi.open", "finished.open",
    ])
    a.enter()
    expect(a.position("expand")).toBe("flat")
    expect(a.position("raw.certainty")).toBe("conjecture")
    expect(a.enabled("raw.open")).toBe(false) // a gap exists only once staged
    a.fire("raw", "shown")
    a.fire("expand", "staged")
    a.clock = 3
    a.apply()
    expect(m.expand.value).toBe(1)
    expect(a.enabled("raw.open")).toBe(true)
    expect(m.time.value).toBeCloseTo(3, 9) // the particles kept running
    // Every handle a flow offers is one of its own stage's axes.
    expect(a.axis("raw.open").handles()).toEqual(m.stage("raw").flows)
  })
})

describe("one param, one axis", () => {
  test("a part sharing its whole's param is walked by the whole only", async () => {
    const { MindVirus } = await import("../vocabulary/MindVirus/MindVirus")
    const v = new MindVirus()
    void v.parts
    const ids = gatherStateSpace([v]).axes.map((a) => `${a.owner?.constructor.name}:${a.id}`)
    expect(ids).toEqual(["MindVirus:state"])
  })
})

describe("the vocabulary's own state spaces", () => {
  test("each symbol walks exactly the states its params already express", async () => {
    const { Eye } = await import("../vocabulary/Eye/Eye")
    const { FoldableCube } = await import("../vocabulary/FoldableCube/FoldableCube")
    const { Road } = await import("../vocabulary/Road/Road")
    const { Quote } = await import("../vocabulary/Quote/Quote")
    const { TheWall } = await import("../vocabulary/TheWall/TheWall")
    const { Calculator } = await import("../demo/creatormode/Calculator")
    const cases: [object, string[]][] = [
      [new Eye(), ["opening:closed,open"]],
      [new FoldableCube(), ["fold:flat,cup,wrapped"]],
      [new Road(), ["horizon:road,landscape"]],
      [new Quote({ lines: ["a"] }), ["quote:blank,written,credited"]],
      [new TheWall(), ["growth:unbuilt,built"]],
      [new Calculator(), ["op:+,−,×,÷"]],
    ]
    for (const [h, want] of cases) {
      const holon = h as import("../src/holon").Holon
      void holon.parts
      const space = gatherStateSpace([holon])
      expect(space.axes.map((a) => `${a.id}:${a.positions.map((p) => p.name).join(",")}`)).toEqual(want)
      // Every axis fires and lands on its position's values.
      const auto = new Automaton(space)
      auto.enter()
      for (const a of space.axes) {
        const to = auto.next(a.id)
        auto.fire(a.id, to)
      }
      auto.clock = 10
      auto.apply()
      for (const a of space.axes) {
        const pos = a.positions.find((p) => p.name === auto.position(a.id))!
        for (const [p, v] of pos.values) expect(p.value).toEqual(v)
      }
    }
  })
})

describe("scrub — a hand dragging an axis", () => {
  test("holds the axis at a continuous blend, then settles to the nearest position without a jump", () => {
    const lamp = new Lamp()
    const a = new Automaton(gatherStateSpace([lamp]))
    a.enter()
    a.clock = 1
    a.scrub("grain", 0.3)
    a.apply()
    expect(lamp.grain.value).toBeCloseTo(0.3, 12)
    expect(a.position("grain")).toBe("plain")
    a.scrub("grain", 0.8)
    a.apply()
    expect(lamp.grain.value).toBeCloseTo(0.8, 12)
    expect(a.position("grain")).toBe("sorted")
    a.settle("grain")
    expect(a.valueAt(lamp.grain, 1) as number).toBeCloseTo(0.8, 12) // no jump at release
    expect(a.valueAt(lamp.grain, 3)).toBe(1) // eased on to the nearest position
  })
})
