/**
 * Live sessions → song (scripts/session.ts): a recorded walk becomes the
 * statements ⌘K would have written, at the times they happened.
 */

import { describe, expect, test } from "bun:test"
import { cameraBeats, isSessionId, passageOf, type Session } from "../scripts/session"
import { applyAppendPassage } from "../scripts/ops"
import { together } from "../src/anim"
import { scalar } from "../src/params"
import { Timeline } from "../src/timeline"

const session = (over: Partial<Session> = {}): Session => ({
  version: 1,
  id: "2026-10-15T14-03-22",
  scene: "flowmap",
  startedAt: "2026-10-15T12:03:22.000Z",
  heldAt: 19,
  duration: 5,
  clocks: ["this.map.time"],
  tracks: {
    fires: [
      { t: 0.5, axis: "grain", from: "uncategorised", to: "categorised", duration: 1.8, holon: "this.map" },
      { t: 3, axis: "look", from: "rest", to: "busy", duration: 1, holon: null },
    ],
    transcript: [{ t0: 1, t1: 2.5, text: "Here the categories appear." }],
  },
  ...over,
})

describe("passageOf — the walk as song code", () => {
  test("a beat at every fire; a line spoken mid-transition joins that beat instead of cutting it; clocks run throughout", () => {
    const code = passageOf(session())
    expect(code).toBe(
      [
        "// Recorded live — refs/sessions/2026-10-15T14-03-22 (5 s from t = 19): a walk through the state space.",
        'this.play(this.map.time.by(0.5, { easing: "linear" }), 0.5)',
        'this.say("Here the categories appear.", { voice: "live", duration: 1.5 })',
        "this.play(",
        "  together(",
        '    this.map.time.by(2.5, { easing: "linear" }),',
        '    [this.map.stateAxis("grain").to("categorised"), 0, 0.72],',
        "  ),",
        "  2.5,",
        ")",
        "this.play(",
        "  together(",
        '    this.map.time.by(2, { easing: "linear" }),',
        '    [this.stateAxis("look").to("busy"), 0, 0.5],',
        "  ),",
        "  2,",
        ")",
      ].join("\n"),
    )
    // Spoken when nothing is in flight, a line is its own beat.
    const quiet = passageOf(session({ tracks: { fires: [], transcript: [{ t0: 2, t1: 3, text: "Now." }] } }))
    expect(quiet).toContain('this.play(this.map.time.by(2, { easing: "linear" }), 2)\nthis.say("Now."')
  })

  test("without clocks a quiet stretch is a wait; the camera is authored where it moved, linearly", () => {
    const camera = [0, 1, 2, 3, 4, 5].map((t) => ({ t, phi: t * 0.1, zoom: 1 }))
    const code = passageOf(session({ clocks: [], tracks: { fires: [], camera } }))
    expect(cameraBeats(camera)).toEqual([1, 2, 3, 4, 5])
    expect(code).toContain('[this.observer.phi.to(0.1, { easing: "linear" }), 0, 0.2]')
    expect(code).toContain('[this.observer.phi.to(0.5, { easing: "linear" }), 0.8, 1]')
    expect(code).not.toContain("zoom")
    // Windowed moves of one param inside one beat play one after another.
    const phi = scalar(0)
    const tl = new Timeline([
      { anim: together([phi.to(1, { easing: "linear" }), 0, 0.5], [phi.to(3, { easing: "linear" }), 0.5, 1]), start: 0, duration: 2 },
    ])
    expect(tl.valueAt(phi, 0.5)).toBeCloseTo(0.5, 6)
    expect(tl.valueAt(phi, 1.5)).toBeCloseTo(2, 6)
    const still = passageOf(session({ clocks: [], tracks: { fires: [] } }))
    expect(still.split("\n")[1]).toBe("this.wait(5)")
  })

  test("refused: an owner or clock that is not a this.* path", () => {
    expect(() => passageOf(session({ clocks: ["globalThis.x"] }))).toThrow()
    const bad = session()
    bad.tracks.fires[0]!.holon = "require('fs')"
    expect(() => passageOf(bad)).toThrow()
  })

  test("session ids are the recorder's timestamps, nothing else", () => {
    expect(isSessionId("2026-10-15T14-03-22")).toBe(true)
    expect(isSessionId("2026-10-15T14-03-22-take2")).toBe(true)
    expect(isSessionId("../etc")).toBe(false)
  })
})

describe("applyAppendPassage — the passage lands where ⌘K would put a pose", () => {
  const song = `import { Dream } from "../src/index"

export class S extends Dream {
  unfold() {
    this.play(this.a.x.to(1), 2)
    this.play(this.a.x.to(0), 1)
  }
}
`
  test("after the anchored play, with the together import added", () => {
    const anchor = { start: song.indexOf("this.play(this.a.x.to(1), 2)"), end: song.indexOf("this.play(this.a.x.to(1), 2)") + 28 }
    const res = applyAppendPassage(song, { placement: "after", anchor, file: "core/demo/S.ts" }, passageOf(session()))
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain('import { Dream, together } from "../src/index"')
    const i = res.text.indexOf("this.play(this.a.x.to(1), 2)")
    const j = res.text.indexOf("// Recorded live")
    const k = res.text.indexOf("this.play(this.a.x.to(0), 1)")
    expect(i).toBeLessThan(j)
    expect(j).toBeLessThan(k)
  })
})
