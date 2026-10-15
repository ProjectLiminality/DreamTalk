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

import { PinchCursor, fitCalibration, type PinchSample } from "../src/gesture/pinch"
import { MudraRecogniser, learn } from "../src/gesture/mudra"
import type { HandFrame as ScreenHandFrame } from "../src/gesture/hand"

const screen = (name: string) => fixture(name).map(screenFrame)
const truths = JSON.parse(readFileSync(new URL("./fixtures/hands/pinch-targets.json", import.meta.url), "utf8")) as { contacts: { x: number; y: number; t: number }[] }

/** Each press of a take: where it clicked, and the onset sample. */
const presses = (frames: ScreenHandFrame[], cursor: PinchCursor) => {
  const out: { x: number; y: number; t: number; sample?: PinchSample }[] = []
  for (const f of frames) {
    const s = cursor.update(f.hands[0], f.t)
    if (s.pressed) out.push({ x: s.x, y: s.y, t: f.t })
    if (s.released && out.length) out[out.length - 1]!.sample = s.sample
  }
  return out
}

describe("thumb-bias calibration on a recorded take (pinch-targets.jsonl)", () => {
  test("the fit recovers the bias: after calibration every click lands on its target", () => {
    const frames = screen("pinch-targets")
    const err = (ps: { x: number; y: number }[]) => ps.map((p, i) => Math.hypot(p.x - truths.contacts[i]!.x, p.y - truths.contacts[i]!.y))
    // An uncalibrated midpoint cursor misses by the bias (> 0.02 by construction of the take)…
    const naive = presses(frames, new PinchCursor({ calibration: { w: 0.5, ox: 0, oy: 0 }, lookback: 0 }))
    expect(naive.length).toBe(5)
    expect(Math.max(...err(naive))).toBeGreaterThan(0.01)
    // …the fit, from the take's own onsets, recovers it,
    const fit = fitCalibration(presses(frames, new PinchCursor()).map((p) => p.sample!))
    const calibrated = presses(frames, new PinchCursor({ calibration: fit }))
    expect(calibrated.length).toBe(5)
    // and every click then lands on its target.
    expect(Math.max(...err(calibrated))).toBeLessThan(0.005)
    expect(Math.max(...err(calibrated))).toBeLessThan(Math.min(...err(naive).filter((e) => e > 0.01)) / 4)
  })
})

describe("grab on recorded takes", () => {
  test("grab-move.jsonl turns the scene; spread.jsonl zooms in", () => {
    const move = run(fixture("grab-move"))
    expect(move.some((i) => i.click || i.press)).toBe(false)
    expect(Math.abs(move.reduce((s, i) => s + i.grab.orbit.x, 0))).toBeGreaterThan(0.2)
    expect(run(fixture("spread")).reduce((s, i) => s + i.grab.dolly, 0)).toBeLessThan(-0.5)
  })
})

describe("hand talk on recorded takes", () => {
  const takes = (frames: ScreenHandFrame[], windows: [number, number][]) => windows.map(([a, b]) => frames.filter((f) => f.t >= a && f.t <= b))

  test("gyan, learned from its first take, is recognised in the other two — and told from pointing", () => {
    const gyan = screen("mudra-gyan")
    const point = screen("mudra-point-circle")
    const lib = {
      mudras: [
        learn("gyan", "pose", takes(gyan, [[0.5, 1.1]])),
        learn("point", "pose", takes(point, [[0.6, 1.4]])),
        // the hand at rest between takes: competes, never invokes
        learn("_rest", "pose", takes(gyan, [[1.75, 1.95]])),
      ],
    }
    const r = new MudraRecogniser(lib)
    const invoked = gyan.filter((f) => f.t > 1.9).map((f) => [f.t, r.update(f).invoked?.name] as const).filter(([, n]) => n)
    expect(invoked.map(([, n]) => n)).toEqual(["gyan", "gyan"]) // takes 2 and 3, once each
    // each inside its own take (2.0–3.6 s, 4.0–5.6 s), never in the rest between
    expect(invoked[0]![0]).toBeGreaterThan(2)
    expect(invoked[0]![0]).toBeLessThan(3.6)
    expect(invoked[1]![0]).toBeGreaterThan(4)
  })

  test("the point-circle, learned as a motion from its first circle, is recognised in the next ones", () => {
    const frames = screen("mudra-point-circle")
    const lib = { mudras: [learn("circle", "motion", takes(frames, [[0.4, 1.6]])), learn("gyan", "pose", takes(screen("mudra-gyan"), [[0.5, 1.1]]))] }
    const r = new MudraRecogniser(lib, { invokeAt: 0.3 })
    const invoked = frames.filter((f) => f.t > 1.6).map((f) => r.update(f).invoked?.name).filter(Boolean)
    expect(invoked.length).toBeGreaterThan(0)
    expect(new Set(invoked)).toEqual(new Set(["circle"]))
  })
})
