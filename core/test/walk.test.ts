/**
 * The walk (editor/walk.ts): the visual automaton inside the paused
 * editor, writing through the live layer — and the op that turns a walked
 * transition into an authored one (scripts/ops.ts appendCheckpoint, for a
 * song that plays through a helper).
 *
 * GameLoop builds a little DOM (HUD, overlay), so the DOM it touches is
 * stubbed here; everything asserted is the live layer and the automaton.
 */

import { describe, expect, test } from "bun:test"
import { Holon } from "../src/holon"
import { axis, toggle, type StateSpace } from "../src/automaton"
import { completion, scalar, state, type Param, type ParamValue } from "../src/params"
import { Timeline } from "../src/timeline"
import { Overrides } from "../editor/overrides"
import { EditorWalk } from "../editor/walk"
import { clipOrdinalAt } from "../editor/checkpoint"
import { __dt } from "../editor/anchors"
import type { Clip } from "../src/timeline"
import { applyAppendCheckpoint } from "../scripts/ops"

// --- A DOM just deep enough for GameLoop --------------------------------------

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
g.document ??= {
  getElementById: () => null,
  createElement: el,
  head: el(),
  body: el(),
}
g.window ??= { innerWidth: 100, innerHeight: 100, devicePixelRatio: 1 }

// --- A walkable holon and its song ------------------------------------------------

class Lamp extends Holon {
  grain = completion(0)
  shown = completion(0)
  time = scalar(0)
  override states = {
    plain: state({ grain: 0 }),
    sorted: state({ grain: 1 }),
  }
  override stateSpace(): StateSpace {
    return {
      axes: [
        axis("grain", this, { plain: this.states.plain, sorted: this.states.sorted }, { key: "g", duration: 1 }),
        toggle("shown", this.shown, { duration: 0.5 }),
      ],
      clocks: [this.time],
    }
  }
}

const P = (p: Param<number>) => p as unknown as Param<ParamValue>

const rig = () => {
  const lamp = new Lamp()
  // The song animates grain (rule 2: snaps back on time moves); shown and
  // time it never touches (rule 3).
  const tl = new Timeline([{ anim: lamp.grain.to(0), start: 0, duration: 1 }])
  const overrides = new Overrides(tl)
  const ctl = { t: 2, playing: false, suspended: false, now: 0 }
  const ac = new AbortController()
  const walk = new EditorWalk({
    canvas: el() as unknown as HTMLCanvasElement,
    pick: () => undefined,
    boundsOf: () => undefined,
    roots: [lamp],
    overrides,
    isPlaying: () => ctl.playing,
    suspended: () => ctl.suspended,
    currentT: () => ctl.t,
    pause: () => (ctl.playing = false),
    hud: false,
    signal: ac.signal,
  })
  /** The host's frame: the song, then the live layer (three-host's beforeSync). */
  const frame = () => {
    tl.apply(ctl.t)
    overrides.apply()
  }
  /** Advance wall time by `dt` seconds: the editor's loop, then a frame. */
  const run = (dt: number) => {
    ctl.now += dt * 1000
    const wrote = walk.step(ctl.now)
    frame()
    return wrote
  }
  // The automaton reads its clock from performance.now(): pin it to ours.
  const realNow = performance.now.bind(performance)
  performance.now = () => ctl.now
  frame()
  run(0)
  return { lamp, tl, overrides, ctl, walk, run, frame, restore: () => (performance.now = realNow) }
}

const key = (k: string) => ({ key: k, code: `Key${k.toUpperCase()}`, metaKey: false, ctrlKey: false, altKey: false }) as KeyboardEvent

describe("the walk — the state space through the live layer", () => {
  test("a fire while paused eases through the live layer and lands exactly", () => {
    const r = rig()
    try {
      expect(r.walk.axes().find((a) => a.id === "grain")!.position).toBe("plain")
      expect(r.walk.key(key("g"))).toBe(true)
      r.run(0.5)
      const mid = r.overrides.get(P(r.lamp.grain)) as number
      expect(mid).toBeGreaterThan(0.05)
      expect(mid).toBeLessThan(0.95)
      expect(r.lamp.grain.value).toBeCloseTo(mid, 9)
      r.run(0.6)
      r.run(0.1)
      expect(r.overrides.get(P(r.lamp.grain))).toBe(1)
      expect(r.lamp.grain.value).toBe(1)
      expect(r.walk.axes().find((a) => a.id === "grain")).toMatchObject({ position: "sorted", progress: 1 })
      // The capture's clip is the walked transition's own length.
      expect(r.walk.seconds).toBe(1)
      // At rest nothing is rewritten, so the loop stops repainting.
      expect(r.run(0.1)).toBe(false)
    } finally {
      r.restore()
    }
  })

  test("clocks stay still — a paused editor is a held world", () => {
    const r = rig()
    try {
      r.walk.fire("shown")
      r.run(2)
      expect(r.overrides.has(P(r.lamp.time))).toBe(false)
      expect(r.lamp.time.value).toBe(0)
    } finally {
      r.restore()
    }
  })

  test("Escape mid-flight is the honest stop: the walk re-grounds, nothing comes back", () => {
    const r = rig()
    try {
      r.walk.fire("grain", "sorted")
      r.run(0.4)
      expect(r.overrides.size).toBe(1)
      r.overrides.clearAll() // discardPose
      r.frame()
      r.run(0.1)
      r.run(0.5)
      expect(r.overrides.size).toBe(0)
      expect(r.lamp.grain.value).toBe(0)
      expect(r.walk.axes().find((a) => a.id === "grain")!.position).toBe("plain")
    } finally {
      r.restore()
    }
  })

  test("walked back to where it entered, the pose evaporates", () => {
    const r = rig()
    try {
      r.walk.fire("shown", "on")
      r.run(0.6)
      expect(r.overrides.get(P(r.lamp.shown))).toBe(1)
      r.walk.fire("shown", "off")
      r.run(0.6)
      r.run(0.1)
      expect(r.overrides.has(P(r.lamp.shown))).toBe(false)
      expect(r.lamp.shown.value).toBe(0)
    } finally {
      r.restore()
    }
  })

  test("the playhead moving re-enters from the new pose (time is truth)", () => {
    const r = rig()
    try {
      r.walk.fire("shown", "on")
      r.run(0.6)
      r.run(0.1)
      // A scrub: rule 3 keeps `shown` (the song never animates it).
      r.overrides.clearOnTimeMove()
      r.ctl.t = 0.5
      r.frame()
      r.run(0)
      expect(r.walk.axes().find((a) => a.id === "shown")!.position).toBe("on")
      expect(r.lamp.shown.value).toBe(1)
      // Firing from here reads the held world, not the stale one.
      r.walk.fire("shown")
      r.run(0.6)
      r.run(0.1)
      expect(r.lamp.shown.value).toBe(0)
    } finally {
      r.restore()
    }
  })

  test("playing or creator mode: keys and handles are not the walk's", () => {
    const r = rig()
    try {
      r.ctl.suspended = true
      expect(r.walk.key(key("g"))).toBe(false)
      expect(r.walk.owns(1, 1)).toBeUndefined()
      r.ctl.suspended = false
      r.ctl.playing = true
      expect(r.walk.key(key("g"))).toBe(false)
      expect(r.run(0.1)).toBe(false)
      expect(r.walk.game.on).toBe(false)
      // The inspector's fire pauses first, then walks.
      r.walk.fire("grain", "sorted")
      expect(r.ctl.playing).toBe(false)
      r.run(1.1)
      r.run(0.1)
      expect(r.lamp.grain.value).toBe(1)
    } finally {
      r.restore()
    }
  })
})

// --- Recording: the walked transition as an authored one -------------------------

const song = `import { Dream } from "../../src/index"
import { together } from "../../src/anim"

export class MapDream extends Dream {
  map = new FlowMap({ radius: 300 })

  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.map.time.by(dt), ...anims), dt)
  }

  unfold() {
    const m = this.map
    this.stage(m)
    this.flowing(3, Create(m))
    this.set(m.rim.to(1))
    this.flowing(2.5, m.grain.to(1))
    this.play(m.expand.to(1), 2)
    this.flowing(1.5)
  }
}
`
const helperSpan = (() => {
  const needle = "this.play(together(this.map.time.by(dt), ...anims), dt)"
  const start = song.indexOf(needle)
  return { start, end: start + needle.length }
})()

describe("recording — a walked transition becomes a this.play at the playhead", () => {
  test("clipOrdinalAt counts anchored clips in play order", () => {
    const clip = (start: number, duration: number, anchored = true): Clip => {
      const c = { start, duration } as unknown as Clip
      return anchored ? __dt(c, "core/demo/X.ts:1:2") : c
    }
    const clips = [clip(0, 3), clip(3, 0, false), clip(3, 2.5), clip(5.5, 2), clip(7.5, 1.5)]
    expect(clipOrdinalAt(clips, 0.5)).toBe(0)
    expect(clipOrdinalAt(clips, 4)).toBe(1)
    expect(clipOrdinalAt(clips, 6)).toBe(2)
    expect(clipOrdinalAt(clips, 99)).toBe(3)
  })

  test("a helper-played song: the ordinal names the unfold() statement", () => {
    const res = applyAppendCheckpoint(song, {
      op: "appendCheckpoint",
      placement: "after",
      anchor: helperSpan,
      ordinal: 1,
      targets: [{ path: "this.map.grain", value: 0 }],
      duration: 1.8,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toBe(
      song.replace(
        "    this.flowing(2.5, m.grain.to(1))\n",
        "    this.flowing(2.5, m.grain.to(1))\n    this.play(this.map.grain.to(0), 1.8)\n",
      ),
    )
    // A direct play() in between still counts as one.
    const later = applyAppendCheckpoint(song, {
      op: "appendCheckpoint",
      placement: "after",
      anchor: helperSpan,
      ordinal: 3,
      targets: [{ path: "this.map.grain", value: 0 }],
    })
    if (!later.ok) throw new Error(later.reason)
    expect(later.text).toContain("    this.flowing(1.5)\n    this.play(this.map.grain.to(0), 1)\n")
  })

  test("a play inside a loop makes the count indeterminate — refused, never guessed", () => {
    const looped = song.replace(
      "    this.flowing(1.5)\n",
      "    for (const s of [1, 2]) this.flowing(s)\n",
    )
    const res = applyAppendCheckpoint(looped, {
      op: "appendCheckpoint",
      placement: "after",
      anchor: {
        start: looped.indexOf("this.play(together"),
        end: looped.indexOf("this.play(together") + helperSpan.end - helperSpan.start,
      },
      ordinal: 3,
      targets: [{ path: "this.map.grain", value: 0 }],
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain("loop or branch")
  })

  test("without an ordinal a helper span is refused as before", () => {
    const res = applyAppendCheckpoint(song, {
      op: "appendCheckpoint",
      placement: "after",
      anchor: helperSpan,
      targets: [{ path: "this.map.grain", value: 0 }],
    })
    expect(res.ok).toBe(false)
  })
})

// --- The song as a path: state lanes and ghosts -----------------------------------

import { axisSegments, blockLabel } from "../editor/statelanes"
import { gatherStateSpace } from "../src/automaton"
import { applySetRunTime } from "../scripts/ops"

describe("state lanes — the song drawn as a walk through its axes", () => {
  test("a clip that moves an axis is a block from → to; holding or clock-only clips are not", () => {
    const lamp = new Lamp()
    const clip = (anim: Clip["anim"], start: number, duration: number) => ({ anim, start, duration }) as Clip
    const clips = [
      clip(lamp.time.to(3), 0, 3), // the clock alone: no axis moves
      clip(lamp.grain.to(1), 3, 2), // plain → sorted
      clip(lamp.grain.to(1), 5, 1), // holds: not a transition
      clip(lamp.grain.to(0), 6, 1.5), // sorted → plain
    ]
    const tl = new Timeline(clips.map((c) => ({ anim: c.anim, start: c.start, duration: c.duration })))
    const lanes = axisSegments(gatherStateSpace([lamp]).axes, clips, tl)
    expect(lanes.map((l) => l.axis.id)).toEqual(["grain"])
    expect(lanes[0]!.segments.map((s) => [s.start, s.duration, s.from, s.to])).toEqual([
      [3, 2, "plain", "sorted"],
      [6, 1.5, "sorted", "plain"],
    ])
    expect(blockLabel("plain", "sorted")).toBe("plain → sorted")
  })

  test("the walk's ghosts: fired, standing elsewhere than at entry, until Escape", () => {
    const r = rig()
    try {
      expect(r.walk.ghosts()).toEqual([])
      r.walk.fire("grain", "sorted")
      r.run(0.3)
      expect(r.walk.ghosts()).toMatchObject([{ axis: "grain", from: "plain", to: "sorted", seconds: 1 }])
      expect(r.walk.ghosts()[0]!.progress).toBeLessThan(1)
      // Walked back: nothing to write, no ghost.
      r.walk.fire("grain", "plain")
      r.run(1.2)
      expect(r.walk.ghosts()).toEqual([])
      r.walk.fire("shown", "on")
      r.run(0.6)
      expect(r.walk.ghosts().map((g) => g.axis)).toEqual(["shown"])
      r.overrides.clearAll()
      r.frame()
      r.run(0.1)
      expect(r.walk.ghosts()).toEqual([])
    } finally {
      r.restore()
    }
  })
})

describe("retiming a helper-played clip — the literal lives in unfold()'s call", () => {
  test("setRunTime with an ordinal rewrites the helper call's argument", () => {
    const res = applySetRunTime(song, { op: "setRunTime", span: helperSpan, runTime: 3.25, ordinal: 1 })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toBe(song.replace("this.flowing(2.5, m.grain.to(1))", "this.flowing(3.25, m.grain.to(1))"))
  })

  test("a direct play() still retimes in place; no ordinal on a parameter is refused", () => {
    const direct = applySetRunTime(song, {
      op: "setRunTime",
      span: { start: song.indexOf("this.play(m.expand"), end: song.indexOf("this.play(m.expand") + "this.play(m.expand.to(1), 2)".length },
      runTime: 4,
      ordinal: 2,
    })
    if (!direct.ok) throw new Error(direct.reason)
    expect(direct.text).toContain("this.play(m.expand.to(1), 4)")
    const bare = applySetRunTime(song, { op: "setRunTime", span: helperSpan, runTime: 3 })
    expect(bare.ok).toBe(false)
  })
})

// --- ⌘K in the song's idiom, with the clocks still running ------------------------

describe("capture — a walked transition written as the song would write it", () => {
  test("ghosts become holon.axis(…).to(…); their params are not repeated; the song's clocks run", () => {
    const r = rig()
    try {
      // The song animates the clock, like FlowMap's flowing().
      const animates = r.overrides.animates.bind(r.overrides)
      r.overrides.animates = (p) => p === P(r.lamp.time) || animates(p)
      r.walk.fire("grain", "sorted")
      r.run(1.2)
      const cap = r.walk.capture((h) => (h === r.lamp ? "lamp" : undefined))
      expect(cap.transitions).toEqual([{ holon: "this.lamp", axis: "grain", position: "sorted" }])
      expect(cap.covers.has(P(r.lamp.grain))).toBe(true)
      expect(cap.clocks).toEqual(["this.lamp.time"])
      // An owner the scene cannot spell falls back to the raw pose.
      expect(r.walk.capture(() => undefined).transitions).toEqual([])
    } finally {
      r.restore()
    }
  })

  test("appendCheckpoint spells clocks, axes and raw targets under one together", () => {
    const res = applyAppendCheckpoint(song, {
      op: "appendCheckpoint",
      placement: "after",
      anchor: helperSpan,
      ordinal: 1,
      transitions: [{ holon: "this.map", axis: "raw.open", position: "closed" }],
      clocks: ["this.map.time"],
      targets: [{ path: "this.map.labels", value: 0 }],
      duration: 1.2,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain(`    this.flowing(2.5, m.grain.to(1))
    this.play(
      together(
        this.map.time.by(1.2, { easing: "linear" }),
        this.map.stateAxis("raw.open").to("closed"),
        this.map.labels.to(0),
      ),
      1.2,
    )
`)
    const bad = applyAppendCheckpoint(song, {
      op: "appendCheckpoint",
      placement: "end",
      transitions: [{ holon: "globalThis", axis: "x", position: "y" }],
      targets: [],
    })
    expect(bad.ok).toBe(false)
  })
})

describe("the written line plays as walked", () => {
  test("holon.stateAxis(id).to(position) with the clock's by(): lands the axis, the clock never stops", async () => {
    const { together } = await import("../src/anim")
    const lamp = new Lamp()
    const anim = together(lamp.time.by(2, { easing: "linear" }), lamp.stateAxis("grain").to("sorted"))
    const tl = new Timeline([{ anim, start: 0, duration: 2 }])
    tl.apply(1)
    expect(lamp.time.value).toBeCloseTo(1, 9)
    tl.apply(2)
    expect(lamp.grain.value).toBe(1)
    expect(lamp.time.value).toBeCloseTo(2, 9)
    expect(() => lamp.stateAxis("nope")).toThrow(/no axis 'nope'/)
  })
})
