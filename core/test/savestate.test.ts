/**
 * Save as state: a pose becomes a position on one of the SCENE's own axes
 * — the saveState op's code (scripts/ops.ts), the scene-level axis it
 * writes (`poses`, Dream.stateSpace / stateAxis), and the pose it reads
 * off the live layer (editor/savestate.ts).
 */

import { describe, expect, test } from "bun:test"
import { applySaveState } from "../scripts/ops"
import { poses, gatherStateSpace, type StateSpace } from "../src/automaton"
import { Dream } from "../src/dream"
import { Holon } from "../src/holon"
import { completion, type Param, type ParamValue } from "../src/params"
import { Timeline } from "../src/timeline"
import { Overrides } from "../editor/overrides"
import { poseParams } from "../editor/savestate"

const scene = `import { Dream, render } from "../../src/index"
import { FlowMap } from "../../vocabulary/FlowMap/FlowMap"

export class MapDream extends Dream {
  map = new FlowMap({ radius: 300 })

  unfold() {
    this.play(this.map.grain.to(1), 2)
  }
}
`
const op = (axis: string, position: string, params: { path: string; value: number | boolean; base: number | boolean }[]) =>
  ({ op: "saveState", axis, position, params, file: "core/demo/vocabulary/Map.ts" }) as const

describe("saveState — the pose written as the scene's own state", () => {
  test("a first state creates stateSpace() with a two-position axis, and its imports", () => {
    const res = applySaveState(scene, op("look", "busy", [
      { path: "this.map.grain", value: 1, base: 0 },
      { path: "this.map.expand", value: 1, base: 0 },
    ]))
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain(`import { poses, type StateSpace } from "../../src/automaton"\n`)
    expect(res.text).toContain(`  /** The scene's own states — authored in the editor ("save as state"). */
  override stateSpace(): StateSpace {
    return {
      axes: [
        poses("look", {
          rest: [[this.map.grain, 0], [this.map.expand, 0]],
          busy: [[this.map.grain, 1], [this.map.expand, 1]],
        }),
      ],
    }
  }

  unfold() {`)
  })

  test("more states: added to the axis (others learn the base of a new param), replaced by name, or a new axis", () => {
    let text = scene
    const apply = (o: ReturnType<typeof op>) => {
      const r = applySaveState(text, o)
      if (!r.ok) throw new Error(r.reason)
      text = r.text
    }
    apply(op("look", "busy", [{ path: "this.map.grain", value: 1, base: 0 }]))
    apply(op("look", "quiet", [{ path: "this.map.labels", value: 0, base: 1 }]))
    expect(text).toContain("rest: [[this.map.grain, 0], [this.map.labels, 1]]")
    expect(text).toContain("busy: [[this.map.grain, 1], [this.map.labels, 1]]")
    expect(text).toContain("quiet: [[this.map.labels, 0]]")
    apply(op("look", "busy", [{ path: "this.map.grain", value: 0.5, base: 0 }]))
    expect(text).toContain("busy: [[this.map.grain, 0.5]]")
    apply(op("data", "known", [{ path: "this.map.stack.members[4].certainty", value: 1, base: 0.15 }]))
    expect(text).toContain(`poses("data", {`)
    expect(text.match(/override stateSpace/g)?.length).toBe(1)
    expect(text.match(/from "..\/..\/src\/automaton"/g)?.length).toBe(1)
  })

  test("names that are not identifiers are quoted; bad input is refused, never guessed", () => {
    const r = applySaveState(scene, op("look", "tilted labels", [{ path: "this.map.labels", value: 0, base: 1 }]))
    if (!r.ok) throw new Error(r.reason)
    expect(r.text).toContain(`"tilted labels": [[this.map.labels, 0]]`)
    expect(applySaveState(scene, op("look", "x", [])).ok).toBe(false)
    expect(applySaveState(scene, op("look", "x", [{ path: "globalThis.x", value: 1, base: 0 }])).ok).toBe(false)
    expect(applySaveState(scene, op("look", "rest", [{ path: "this.map.grain", value: 1, base: 0 }])).ok).toBe(false)
    const handWritten = scene.replace("  unfold() {", "  override stateSpace() {\n    return makeSpace()\n  }\n\n  unfold() {")
    expect(applySaveState(handWritten, op("look", "busy", [{ path: "this.map.grain", value: 1, base: 0 }])).ok).toBe(false)
  })
})

// --- The written code, alive -------------------------------------------------------

class Lamp extends Holon {
  grain = completion(0)
  shown = completion(1)
}

class LampDream extends Dream {
  lamp = new Lamp()
  override stateSpace(): StateSpace {
    return {
      axes: [
        poses("look", {
          rest: [[this.lamp.grain, 0], [this.lamp.shown, 1]],
          busy: [[this.lamp.grain, 1], [this.lamp.shown, 0]],
        }),
      ],
    }
  }
  unfold() {
    this.stage(this.lamp)
    this.play(this.lamp.grain.to(0), 1)
  }
}

const P = (p: Param<number>) => p as unknown as Param<ParamValue>

describe("a scene axis — poses across holons, spelled this.stateAxis(id)", () => {
  test("poses() positions name params of any holon; stateAxis plays them", () => {
    const d = new LampDream()
    d.build()
    const look = d.stateAxis("look")
    expect(look.positions.map((p) => p.name)).toEqual(["rest", "busy"])
    const tl = new Timeline([{ anim: look.to("busy"), start: 0, duration: 1 }])
    tl.apply(1)
    expect(d.lamp.grain.value).toBe(1)
    expect(d.lamp.shown.value).toBe(0)
    expect(() => d.stateAxis("nope")).toThrow(/no scene axis 'nope'/)
    // The scene's axes walk first, owner-less, and never lose to "one param,
    // one axis": the holon's own axis over the same param stays too.
    const holonAxis = class extends Lamp {
      override stateSpace(): StateSpace {
        return { axes: [poses("grain", { off: [[this.grain, 0]], on: [[this.grain, 1]] })] }
      }
    }
    const lit = new holonAxis()
    const space = gatherStateSpace([lit], d.stateSpace())
    expect(space.axes.map((a) => [a.id, a.owner === undefined])).toEqual([["look", true], ["grain", false]])
  })

  test("poseParams reads the live layer: posed vs base, only what differs", () => {
    const d = new LampDream()
    const tl = d.build()
    const ov = new Overrides(tl)
    ov.set(P(d.lamp.grain), 0.756)
    ov.set(P(d.lamp.shown), 1) // equal to its base: not part of the pose
    tl.apply(0.5)
    ov.apply()
    expect(poseParams(d, ov, 0.5)).toEqual([{ path: "this.lamp.grain", value: 0.76, base: 0 }])
  })
})

describe("a scene axis and the holon axes it overlaps stay in agreement", () => {
  test("firing look → busy moves the holon's own grain axis to 'on' as well", async () => {
    const { Automaton } = await import("../src/automaton")
    const d = new LampDream()
    d.build()
    const lit = new (class extends Lamp {
      override stateSpace(): StateSpace {
        return { axes: [poses("grain", { off: [[this.grain, 0]], on: [[this.grain, 1]] })] }
      }
    })()
    // The scene's look poses THIS lamp's grain.
    const look = poses("look", { rest: [[lit.grain as unknown as Param<ParamValue>, 0]], busy: [[lit.grain as unknown as Param<ParamValue>, 1]] })
    const a = new Automaton(gatherStateSpace([lit], { axes: [look] }))
    a.enter()
    expect(a.position("grain")).toBe("off")
    a.fire("look", "busy")
    expect(a.position("grain")).toBe("on")
    a.clock = 2
    a.apply()
    expect(lit.grain.value).toBe(1)
  })
})
