import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { decodeFrames } from "../src/hands"
import { screenFrame } from "../hands/screen"
import { SIM_SCRIPTS, simFrames } from "../hands/sim"
import { GestureController } from "../src/gesture/controller"

/** A take as the gesture layer sees it: the hands layer's frames in screen space, through the controller. */
const run = (frames: ReturnType<typeof decodeFrames>) => {
  const c = new GestureController()
  return frames.map((f) => c.update(screenFrame(f)))
}
const fixture = (name: string) => decodeFrames(readFileSync(new URL(`./fixtures/hands/${name}.jsonl`, import.meta.url), "utf8"))

describe("gesture on the hands layer's recorded fixtures", () => {
  test("pinch.jsonl: two still pinches are two clicks, where the cursor hovered — no drag", () => {
    const out = run(fixture("pinch"))
    const clicks = out.filter((i) => i.click)
    expect(clicks.length).toBe(2)
    expect(out.some((i) => i.drag)).toBe(false)
    const hover = out.find((i) => i.t >= 0.7)!.cursor
    for (const c of clicks) expect(Math.hypot(c.click!.x - hover.x, c.click!.y - hover.y)).toBeLessThan(0.01)
  })

  test("drag.jsonl: a pinch carried 120 mm is one drag of about half the box, then released — no click", () => {
    const out = run(fixture("drag"))
    expect(out.filter((i) => i.press).length).toBe(1)
    expect(out.some((i) => i.click)).toBe(false)
    const last = out.filter((i) => i.drag).at(-1)!.drag!
    expect(last.dx).toBeGreaterThan(0.35) // 120 mm over a 260 mm box ≈ 0.46
    expect(Math.abs(last.dy)).toBeLessThan(0.05)
    expect(out.filter((i) => i.dragEnd).length).toBe(1)
  })

  test("sim grab-turn: a fist sweeping right turns the scene; sim spread: two fists drawing apart dolly in", () => {
    const turn = run(simFrames(SIM_SCRIPTS["grab-turn"]!))
    expect(turn.some((i) => i.click || i.press)).toBe(false)
    expect(turn.reduce((s, i) => s + i.grab.orbit.x, 0)).toBeGreaterThan(0.2)
    const spread = run(simFrames(SIM_SCRIPTS.spread!))
    expect(spread.reduce((s, i) => s + i.grab.dolly, 0)).toBeLessThan(-0.5)
  })

  test("deterministic on replay: the same take, the same intents", () => {
    expect(JSON.stringify(run(fixture("drag")))).toBe(JSON.stringify(run(fixture("drag"))))
  })
})
