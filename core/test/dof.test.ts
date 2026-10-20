/**
 * Degrees of freedom (src/dof.ts): the mask over the walkable space — a
 * switched-off axis is walkable from nowhere (no key, no handle) and holds,
 * its digit goes to the next; slots and levels switched off are refused.
 */

import { describe, expect, test } from "bun:test"
import { Dream, type DreamClass } from "../src/dream"
import { Holon } from "../src/holon"
import { Automaton, gatherStateSpace, toggle, unmasked, type StateSpace } from "../src/automaton"
import { DofMask, decodeDof, dofsOf, encodeDof, slotOpen } from "../src/dof"
import { completion } from "../src/params"

// --- A DOM just deep enough for GameLoop and mountNest (as test/game-reroot.test.ts) ---
const el = (): Record<string, unknown> => ({
  style: {},
  className: "",
  innerHTML: "",
  addEventListener: () => {},
  append: () => {},
  remove: () => {},
  getContext: () => null,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, x: 0, y: 0 }),
})
const g = globalThis as Record<string, unknown>
g.document ??= { getElementById: () => null, createElement: el, head: el(), body: el() }
g.window ??= { innerWidth: 100, innerHeight: 100, devicePixelRatio: 1 }
const doc = g.document as Record<string, unknown>
doc.addEventListener ??= () => {}
const win = g.window as Record<string, unknown>
win.addEventListener ??= () => {}
win.dispatchEvent ??= () => {}
const { GameLoop } = await import("../demo/game")
const { mountNest, levelsOf } = await import("../editor/nest")

class Knob extends Holon {}
class Lamp extends Holon {
  on = completion(0)
  dim = completion(0)
  tint = completion(0)
  knob = new Knob()
  override stateSpace(): StateSpace {
    return {
      axes: [
        toggle("on", this.on, { handles: [this.knob] }),
        toggle("dim", this.dim, { escape: "off" }),
        toggle("tint", this.tint),
      ],
    }
  }
}

const loop = (lamp: Lamp, mask: DofMask, pick: () => Holon | undefined = () => undefined) =>
  new GameLoop(
    { canvas: el() as unknown as HTMLCanvasElement, pick, boundsOf: () => undefined, setBeforeSync: () => {} },
    { roots: [lamp], animated: new Set(), suspended: () => false, hud: false, signal: new AbortController().signal, mask },
  )
const press = (game: InstanceType<typeof GameLoop>, key: string) =>
  game.key({ key, code: `Digit${key}`, metaKey: false, ctrlKey: false, altKey: false })

describe("the mask (DofMask)", () => {
  test("an exact id beats its kind's `*`, which beats `*`; unnamed is on", () => {
    const m = new DofMask({ "*": false, "axis:*": true, "axis:dim": false })
    expect(m.on("axis:on")).toBe(true)
    expect(m.on("axis:dim")).toBe(false)
    expect(m.on("slot:1")).toBe(false)
    expect(new DofMask().on("level:Anything")).toBe(true)
  })

  test("the viewer's toggles are overrides of the preset, compact in a URL and back", () => {
    const m = new DofMask({ "slot:2": false })
    m.set("axis:dim", false)
    m.set("slot:2", true)
    m.set("axis:on", true) // already on by the preset: no override
    expect(m.overrides()).toEqual({ "axis:dim": false, "slot:2": true })
    const code = encodeDof(m.overrides())
    expect(code).toBe("-axis:dim,slot:2")
    expect(decodeDof(code)).toEqual(m.overrides())
    const again = new DofMask({ "slot:2": false }, decodeDof(code))
    expect(again.on("axis:dim")).toBe(false)
    expect(again.on("slot:2")).toBe(true)
    let changes = 0
    again.subscribe(() => changes++)
    again.setAll(["axis:on", "axis:tint", "axis:dim"], false)
    expect(changes).toBe(1)
    again.reset()
    expect(again.overrides()).toEqual({})
    expect(again.on("slot:2")).toBe(false)
    expect(changes).toBe(2)
  })
})

describe("a disabled axis is not walkable", () => {
  test("gathered under the mask: disabled at once and live, dropped from what a lattice draws, kept by the automaton", () => {
    const lamp = new Lamp()
    const mask = new DofMask({ "axis:dim": false })
    const space = gatherStateSpace([lamp], undefined, mask)
    const a = new Automaton(space)
    a.enter()
    expect(a.enabled("dim")).toBe(false)
    expect(a.enabled("on")).toBe(true)
    expect(unmasked(space).axes.map((x) => x.id)).toEqual(["on", "tint"])
    // The automaton keeps every axis (a link's journal indexes them), and the mask is live.
    expect(a.axes.map((x) => x.id)).toEqual(["on", "dim", "tint"])
    mask.set("axis:dim", true)
    expect(a.enabled("dim")).toBe(true)
    expect(unmasked(space).axes.length).toBe(3)
  })

  test("its key is freed (the next axis takes its digit), the key and its handle fire nothing; a change rebinds live", () => {
    const lamp = new Lamp()
    const mask = new DofMask()
    const game = loop(lamp, mask, () => lamp.knob)
    game.enter(0)
    const keys = () => Object.fromEntries(game.state().map((s) => [s.id, s.key]))
    expect(keys()).toEqual({ on: "1", dim: "2", tint: "3" })

    mask.set("axis:on", false)
    expect(keys()).toEqual({ on: undefined, dim: "1", tint: "2" })
    expect(game.state().find((s) => s.id === "on")!.enabled).toBe(false)
    // The knob is on's handle: it no longer answers a hover or a click.
    expect(game.hoverAt(5, 5)).toBeUndefined()
    expect(game.clickAt(5, 5)).toBeUndefined()
    expect(game.axisAt(5, 5)).toBeUndefined()
    game.fire("on")
    expect(game.automaton.journal.length).toBe(0)
    // Its old digit now fires the next axis.
    expect(press(game, "1")).toBe(true)
    expect(game.automaton.journal.at(-1)!.axis).toBe("dim")

    mask.set("axis:on", true)
    expect(keys()).toEqual({ on: "1", dim: "2", tint: "3" })
    expect(game.clickAt(5, 5)).toBe("on")
  })

  test("switched off mid-walk it holds where it stands — or goes home when it has one", () => {
    const lamp = new Lamp()
    const mask = new DofMask()
    const game = loop(lamp, mask)
    game.enter(0)
    game.at(0)
    game.fire("tint", "on")
    game.fire("dim", "on")
    game.at(5)
    mask.set("axis:tint", false)
    mask.set("axis:dim", false)
    expect(game.automaton.position("tint")).toBe("on") // no home: held
    expect(game.automaton.position("dim")).toBe("off") // escape: home
    game.at(10)
    game.automaton.apply()
    expect(lamp.tint.value).toBe(1)
    expect(lamp.dim.value).toBe(0)
  })
})

describe("slots and levels", () => {
  test("a slot switched off does not recall, nor one that opens a level switched off", () => {
    const m = new DofMask({ "slot:2": false, "level:SiteDream": false })
    expect(slotOpen(m, 1, { nest: [] })).toBe(true)
    expect(slotOpen(m, 2)).toBe(false)
    expect(slotOpen(m, 3, { nest: ["SiteDream"] })).toBe(false)
    m.set("level:SiteDream", true)
    expect(slotOpen(m, 3, { nest: ["SiteDream"] })).toBe(true)
  })

  test("an unpack of a level switched off is refused (and its state space): nothing opens, nothing is built", async () => {
    class SiteDream extends Dream {
      unfold() {}
    }
    class Site extends Holon {
      override unpack(): DreamClass {
        return SiteDream
      }
    }
    const site = new Site()
    const mask = new DofMask({ "level:SiteDream": false })
    const nest = mountNest({
      outer: {
        canvas: el() as unknown as HTMLCanvasElement,
        roots: () => [site],
        pick: () => site,
        clientBoxOf: () => undefined,
        worldBoundsOf: () => undefined,
        view: () => undefined,
        hold: () => () => {},
      },
      scenes: {},
      note: () => {},
      allow: (name) => mask.levelOn(name),
      signal: new AbortController().signal,
    })
    expect(levelsOf([site], {})).toEqual(["SiteDream"])
    expect(await nest.unpack(site)).toBe(false)
    expect(await nest.states(site)).toBe(false)
    expect(await nest.openByName("SiteDream")).toBe(false)
    nest.prewarm(site)
    expect(nest.state()).toMatchObject({ depth: 0, kept: 0 })
  })

  test("the panel's list: the scene's axes first, then each owner class's, then levels and slots — ids stable", () => {
    const a = new Lamp()
    const b = new Lamp()
    const scene = { id: "look", label: "look" }
    const axes = [...gatherStateSpace([a, b], { axes: [] }).axes.slice(0, 2), scene]
    const ds = dofsOf({ axes, levels: ["SiteDream"], slots: [{ name: "the globe" }] })
    expect(ds.map((d) => [d.id, d.group, d.label])).toEqual([
      ["axis:look", "scene", "look"],
      ["axis:on", "Lamp", "on"],
      ["axis:dim", "Lamp", "dim"],
      ["level:SiteDream", "levels", "Site"],
      ["slot:1", "slots", "1 · the globe"],
    ])
    const repeat = dofsOf({ axes: gatherStateSpace([a, b]).axes.filter((x) => x.id.startsWith("on")) })
    expect(repeat.map((d) => `${d.id} ${d.group} ${d.label}`)).toEqual(["axis:on Lamp on", "axis:on#2 Lamp on #2"])
  })
})
