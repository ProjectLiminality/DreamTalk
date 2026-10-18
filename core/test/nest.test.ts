/**
 * Nesting (editor/nest.ts): pause a song, unpack a symbol into its own
 * song, come back to exactly the paused moment. The pure half: what a
 * symbol unpacks into, and that leaving restores the level as it was.
 */

import { describe, expect, test } from "bun:test"
import { Dream, type DreamClass } from "../src/dream"
import { Holon } from "../src/holon"
import { Observer } from "../src/dream"
import { ViewLayer } from "../src/view"
import { NestStack, symbolAt, watchMeOf, type LevelSurface } from "../editor/nest"

class Ring extends Holon {}
class Beacon extends Holon {
  static sovereign = true
  ring = new Ring()
}
class Lens extends Holon {
  static sovereign = true
}
class Shard extends Holon {
  static sovereign = true
}
class BeaconDemoDream extends Dream {
  unfold() {}
}
class LensDream extends Dream {
  unfold() {}
}

const scenes: Record<string, DreamClass> = { "ib-beacon": BeaconDemoDream, lens: LensDream }

describe("what a symbol unpacks into — its WatchMe", () => {
  test("a registered scene that explains it, by name; else the symbol alone with its state space", () => {
    expect(watchMeOf(scenes, new Beacon())).toMatchObject({ Dream: BeaconDemoDream, key: "ib-beacon", alone: false })
    expect(watchMeOf(scenes, new Lens())).toMatchObject({ Dream: LensDream, key: "lens", alone: false })
    const alone = watchMeOf(scenes, new Shard())
    expect(alone.alone).toBe(true)
    expect(new alone.Dream().roots[0]).toBeInstanceOf(Shard)
  })

  test("a touch on a part unpacks the symbol that holds it", () => {
    const b = new Beacon()
    expect(symbolAt(b.ring)).toBe(b)
  })
})

describe("the return is exact", () => {
  const surface = (view: ViewLayer, log: string[]): LevelSurface => ({
    canvas: undefined as unknown as HTMLCanvasElement,
    pick: () => undefined,
    clientBoxOf: () => ({ x: 10, y: 20, w: 30, h: 40 }),
    worldBoundsOf: () => undefined,
    view: () => view,
    hold: () => {
      log.push("hold")
      return () => log.push("resume")
    },
  })

  test("entering holds the level and remembers its view; leaving puts the view back to the value and resumes", () => {
    const view = new ViewLayer(new Observer())
    view.delta = { phi: 0.3, theta: -0.2, tilt: 0, dolly: 0.7, x: 12, y: -4, z: 1 }
    const before = { ...view.delta }
    const log: string[] = []
    const stack = new NestStack()
    const s = surface(view, log)
    const saved = stack.enter(s, new Beacon())
    expect(saved.box).toEqual({ x: 10, y: 20, w: 30, h: 40 })
    // Inside, the view flies into the symbol and on.
    view.delta = { ...view.delta, dolly: -3, x: 99 }
    const left = stack.leave(s)
    left!.resume()
    expect(view.delta).toEqual(before)
    expect(log).toEqual(["hold", "resume"])
    expect(stack.depth).toBe(0)
  })

  test("a glided return lands on exactly the saved value", () => {
    const view = new ViewLayer(new Observer())
    view.delta = { phi: 0.123456789, theta: 0, tilt: 0, dolly: 0.5, x: 1, y: 2, z: 3 }
    const before = { ...view.delta }
    const stack = new NestStack()
    const s = surface(view, [])
    stack.enter(s, new Beacon())
    view.delta = { ...view.delta, dolly: -4 }
    stack.leave(s, { glide: 0.8, now: 1000 })
    view.step(1400)
    expect(view.delta).not.toEqual(before)
    view.step(1800)
    expect(view.delta).toEqual(before)
  })

  test("as deep as you like: a stack, popped in reverse", () => {
    const stack = new NestStack()
    const s = surface(new ViewLayer(new Observer()), [])
    stack.enter(s, new Beacon())
    stack.enter(s, new Lens())
    expect(stack.path).toEqual(["Beacon", "Lens"])
    expect(stack.leave(s)!.name).toBe("Lens")
    expect(stack.leave(s)!.name).toBe("Beacon")
    expect(stack.leave(s)).toBeUndefined()
  })
})
