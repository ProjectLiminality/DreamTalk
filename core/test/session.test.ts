/**
 * Live sessions → song (scripts/session.ts): a recorded walk becomes the
 * statements ⌘K would have written, at the times they happened.
 */

import { describe, expect, test } from "bun:test"
import { cameraBeats, isSessionId, passageClasses, passageOf, type Session } from "../scripts/session"
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

describe("a private holon song keeps its raw session beside it", () => {
  test("holons/<Name>/… → inputs/<id>/; a public song's stays in refs/sessions", async () => {
    const { keepSessionInputs } = await import("../scripts/session")
    const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises")
    const { tmpdir } = await import("node:os")
    const root = (await mkdtemp(`${tmpdir()}/dt-session-`)) + "/"
    const id = "2026-10-15T14-03-22"
    await mkdir(`${root}refs/sessions/${id}`, { recursive: true })
    await writeFile(`${root}refs/sessions/${id}/session.json`, "{}")
    expect(await keepSessionInputs(root, "holons/Song/Song.ts", id)).toBe(`holons/Song/inputs/${id}`)
    expect(await Bun.file(`${root}holons/Song/inputs/${id}/session.json`).exists()).toBe(true)
    expect(await keepSessionInputs(root, "core/demo/vocabulary/FlowMap.ts", id)).toBeUndefined()
  })
})

describe("passage polish — retargets, summons, the view coming home", () => {
  test("a fire that interrupts one in flight restarts from where the walk was; transitions keep their own length across beats", () => {
    const code = passageOf(
      session({
        clocks: [],
        tracks: {
          fires: [
            { t: 0.5, axis: "grain", from: "uncategorised", to: "categorised", duration: 1.8, holon: "this.map", pose: { "this.map.grain": 0 } },
            { t: 1, axis: "grain", from: "categorised", to: "uncategorised", duration: 1.8, holon: "this.map", pose: { "this.map.grain": 0.21 } },
          ],
        },
      }),
    )
    expect(code).toContain('[this.map.stateAxis("grain").to("categorised"), 0, 3.6]')
    expect(code).toContain('this.set(this.map.grain.to(0.21))\nthis.play([this.map.stateAxis("grain").to("uncategorised"), 0, 0.45], 4)')
  })

  test("the written restart is what the timeline plays: the overhanging ease up to the cut, then on from the walked value", () => {
    const g = scalar(0)
    const first = together([g.to(1), 0, 3.6])
    const tl = new Timeline([
      { anim: first, start: 0, duration: 0.5 },
      { anim: g.to(0.21), start: 0.5, duration: 0 },
      { anim: together([g.to(0), 0, 0.45]), start: 0.5, duration: 4 },
    ])
    const alone = new Timeline([{ anim: g.to(1), start: 0, duration: 1.8 }])
    expect(tl.valueAt(g, 0.4)).toBeCloseTo(alone.valueAt(g, 0.4), 6)
    expect(tl.valueAt(g, 0.5001)).toBeCloseTo(0.21, 2)
    expect(tl.valueAt(g, 2.4)).toBeCloseTo(0, 6)
  })

  test("a summoned symbol is a real holon: constructed where it appeared, staged, drawn on — and off when dismissed", () => {
    const s = session({
      clocks: [],
      tracks: {
        fires: [],
        summons: [
          { t: 1, className: "Eye", at: { x: 10, y: 20, z: 0 }, scale: 0.5 },
          { t: 3, className: "Eye", dismiss: true },
        ],
      },
    })
    const code = passageOf(s)
    expect(code).toContain("const summonedEye1 = new Eye({ x: 10, y: 20, z: 0, scale: 0.5 })\nthis.stage(summonedEye1)\nthis.play([Create(summonedEye1), 0, 0.6], 2)")
    expect(code).toContain("this.play([UnCreate(summonedEye1), 0, 0.6], 2)")
    expect(passageClasses(s)).toEqual(["Eye"])
    const song = `import { Dream } from "../../src/index"\n\nexport class S extends Dream {\n  unfold() {\n    this.wait(1)\n  }\n}\n`
    const res = applyAppendPassage(song, { placement: "end", file: "core/demo/vocabulary/S.ts" }, code, [{ name: "Eye", file: "core/vocabulary/Eye/Eye.ts" }])
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain('import { Eye } from "../../vocabulary/Eye/Eye"')
    expect(res.text).toMatch(/import \{ Create, UnCreate \} from "..\/..\/src\/verbs"|Create, UnCreate/)
    expect(() => passageOf(session({ tracks: { fires: [], summons: [{ t: 1, className: "evil()" }] } }))).toThrow()
  })

  test("after the walk the view comes home to the camera the song had authored", () => {
    const camera = [0, 1, 2, 3, 4, 5].map((t) => ({ t, phi: t * 0.1 }))
    const code = passageOf(session({ clocks: [], cameraBase: { phi: 0 }, tracks: { fires: [], camera } }))
    expect(code.split("\n").at(-1)).toBe("this.play(this.observer.phi.to(0), 1)")
    const stay = passageOf(session({ clocks: [], cameraBase: { phi: 0.5 }, tracks: { fires: [], camera } }))
    expect(stay).not.toContain("this.observer.phi.to(0.5), 1)")
  })
})

test("an event whose time rounds onto its beat still lands in it (a dismiss at 6.9765 s once vanished)", () => {
  const code = passageOf(
    session({
      clocks: [],
      tracks: {
        fires: [{ t: 2.0005, axis: "grain", from: "a", to: "b", duration: 1, holon: "this.map" }],
        summons: [
          { t: 1.0005, className: "Eye", at: { x: 0, y: 0, z: 0 }, scale: 1 },
          { t: 3.0005, className: "Eye", dismiss: true },
        ],
      },
    }),
  )
  expect(code).toContain("Create(summonedEye1)")
  expect(code).toContain("UnCreate(summonedEye1)")
  expect(code).toContain('stateAxis("grain").to("b")')
})
