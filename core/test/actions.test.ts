/**
 * Holon actions (src/actions.ts, editor/actions.ts): every DreamNode opens
 * its source and dives one layer down; a holon adds its own skills.
 */

import { describe, expect, test } from "bun:test"
import { Holon } from "../src/holon"
import type { ActionContext, HolonAction } from "../src/actions"
import { actionsOf, placeUrl, sovereignAt } from "../editor/actions"

class Button extends Holon {}
class TV extends Holon {
  static sovereign = true
  power = new Button()
  on = false
  override actions(): HolonAction[] {
    return [{ id: "power", label: "switch on", run: () => void (this.on = !this.on) }]
  }
}
class Plain extends Holon {}

const ctx = (holon: Holon): ActionContext => ({ holon, note: () => {}, showSource: () => {}, dive: () => {}, open: () => {} })

describe("holon actions", () => {
  test("a sovereign symbol: open its DreamNode, dive in — then its own skills", async () => {
    const tv = new TV()
    const list = actionsOf(tv, { sceneKey: "room", path: [] })
    expect(list.map((a) => a.id)).toEqual(["open", "dive", "power"])
    await list.find((a) => a.id === "power")!.run(ctx(tv))
    expect(tv.on).toBe(true)
    // Already inside it, diving again is not offered.
    expect(actionsOf(tv, { sceneKey: "room", path: ["TV"] }).map((a) => a.id)).toEqual(["open", "power"])
  })

  test("a plain part offers nothing of its own; a press on it reaches the symbol that holds it", () => {
    const tv = new TV()
    expect(actionsOf(new Plain(), { sceneKey: "room", path: [] })).toEqual([])
    expect(sovereignAt(tv.power)).toBe(tv)
  })

  test("dive and climb are URLs: the Dream Explorer's own ?path=", () => {
    expect(placeUrl("?scene=earth&t=20&sel=0.1", "earth", ["Factory"])).toBe("?scene=earth&path=Factory")
    expect(placeUrl("?scene=earth&path=Factory", "earth", [])).toBe("?scene=earth")
  })
})
