/**
 * Effect sound — the score's contract (src/sound.ts).
 *
 * What the rest of the system leans on: events are a pure, deterministic
 * function of the score; a holon's cue lands at its own arrival time, not on
 * a frame boundary; chimes are opt-in per dream; and the player fires only
 * what a forward-moving transport passes.
 */

import { describe, expect, test } from "bun:test"
import {
  creationChimes,
  gatherCues,
  pentatonicPitch,
  Soundtrack,
  type SoundEvent,
} from "../src/sound"
import { EffectPlayer, type FiredSound } from "../src/render/sfx"
import { Dream } from "../src/dream"
import { Circle, Null, Square } from "../src/parts/primitives"
import { Create, Move } from "../src/verbs"
import { together } from "../src/anim"
import { Cast, RayCaster } from "../vocabulary/Eye/RayCaster"
import { RayCasterDemoDream } from "../demo/RayCasterDemo"

const ev = (time: number, kind: SoundEvent["kind"] = "ping", pitch = 1): SoundEvent => ({
  time,
  kind,
  pitch,
  gain: 1,
})

describe("Soundtrack", () => {
  test("orders events, and merges a kind's twins at one moment", () => {
    const s = new Soundtrack([ev(2), ev(1), ev(1.01), ev(1.01, "ping", 2), ev(1, "chime")])
    expect(s.events.map((e) => [e.time, e.kind, e.pitch])).toEqual([
      [1, "chime", 1],
      [1, "ping", 1],
      [1.01, "ping", 2],
      [2, "ping", 1],
    ])
  })

  test("between is half-open: (t0, t1]", () => {
    const s = new Soundtrack([ev(1), ev(2)])
    expect(s.between(0, 1).length).toBe(1)
    expect(s.between(1, 2).map((e) => e.time)).toEqual([2])
    expect(s.between(2, 3).length).toBe(0)
  })
})

describe("pentatonicPitch", () => {
  test("spans one octave on the major pentatonic", () => {
    expect(pentatonicPitch(0)).toBe(1)
    expect(pentatonicPitch(1)).toBe(2)
    expect(pentatonicPitch(7 / 12)).toBeCloseTo(2 ** (7 / 12), 12)
    // 5 semitones is not in the scale; it lands on a neighbour.
    expect([2 ** (4 / 12), 2 ** (7 / 12)]).toContain(pentatonicPitch(5 / 12))
  })
})

describe("gatherCues", () => {
  test("finds the moment a condition becomes true, between samples", () => {
    let x = 0
    const events = gatherCues(
      [{ kind: "ping", sounded: () => x >= 0.4321 }],
      (t) => (x = t),
      1,
      0.1,
    )
    expect(events.length).toBe(1)
    expect(events[0]!.time).toBeCloseTo(0.4321, 4)
  })

  test("a cue already true at t = 0 never sounds; one that re-arms sounds again", () => {
    let x = 0
    const always = { kind: "ping" as const, sounded: () => true }
    const twice = { kind: "chime" as const, sounded: () => (x > 0.2 && x < 0.5) || x > 0.8 }
    const events = gatherCues([always, twice], (t) => (x = t), 1, 0.05)
    expect(events.map((e) => e.kind)).toEqual(["chime", "chime"])
    expect(events[0]!.time).toBeCloseTo(0.2, 4)
    expect(events[1]!.time).toBeCloseTo(0.8, 4)
  })
})

describe("RayCaster pings", () => {
  test("each ping lands where the ray front meets its hit", () => {
    const dream = new RayCasterDemoDream()
    const pings = dream.soundtrack.events.filter((e) => e.kind === "ping")
    expect(pings.length).toBeGreaterThan(0)
    const timeline = dream.build()
    for (const e of pings) {
      // At the event the front has reached SOME hit; a hair before, that
      // hit was not yet reached. Checked on the caster the ping belongs to.
      const reached = (t: number) => {
        timeline.apply(t)
        return [dream.caster, dream.burst].some((c) =>
          c.hits().some((h) => h.hit && Math.abs(c.cast.value * c.reach.value - h.hit.distance) < 0.5),
        )
      }
      expect(reached(e.time)).toBe(true)
      expect(e.time).toBeGreaterThan(2) // the casting begins after the 2s Create
      expect(e.time).toBeLessThan(5)
    }
  })

  test("nearer hits ring higher", () => {
    const emitter = new Null()
    const near = new Circle({ radius: 20, x: 100 })
    const far = new Circle({ radius: 20, x: -400 })
    const caster = new RayCaster(emitter, [near, far], { first: 0, last: Math.PI, steps: 2, reach: 500 })
    class D extends Dream {
      unfold() {
        this.play(Cast(caster), 2)
      }
    }
    const [first, second] = new D().soundtrack.events
    expect(first!.time).toBeLessThan(second!.time)
    expect(first!.pitch).toBeGreaterThan(second!.pitch)
  })

  test("deterministic: two builds give the same events, bit for bit", () => {
    const a = new RayCasterDemoDream().soundtrack.events
    const b = new RayCasterDemoDream().soundtrack.events
    expect(a).toEqual(b)
  })

  test("gathering leaves the live pose as it found it", () => {
    const dream = new RayCasterDemoDream()
    dream.applyAt(1.234)
    const before = dream.build().params.map((p) => p.value)
    void dream.soundtrack
    expect(dream.build().params.map((p) => p.value)).toEqual(before)
  })
})

describe("Dream.sound and chimes", () => {
  test("sound() places an event at the cursor without advancing it", () => {
    const c = new Circle()
    class D extends Dream {
      unfold() {
        this.play(Create(c), 1.5)
        this.sound("whoosh", { pitch: 1.5 })
        this.play(Move(c, { x: 100 }), 0.5)
      }
    }
    const d = new D()
    expect(d.duration).toBe(2)
    expect(d.soundtrack.events).toEqual([{ time: 1.5, kind: "whoosh", pitch: 1.5, gain: 1 }])
  })

  test("no chime unless the dream opts in — existing songs stay silent", () => {
    const c = new Circle()
    class Quiet extends Dream {
      unfold() {
        this.play(Create(c), 2)
      }
    }
    expect(new Quiet().soundtrack.isEmpty).toBe(true)
  })

  test("opted in: one chime per Create, when the symbol completes", () => {
    const a = new Circle()
    const b = new Square()
    const c = new Circle({ x: 200 })
    class Chiming extends Dream {
      unfold() {
        this.chimes()
        this.wait(0.5)
        this.play(together(Create(a), Create(b)), 2)
        this.play(Create(c), 1)
      }
    }
    expect(new Chiming().soundtrack.events.map((e) => [e.time, e.kind])).toEqual([
      [2.5, "chime"],
      [3.5, "chime"],
    ])
  })

  test("creationChimes ignores un-creation", () => {
    const a = new Circle()
    class D extends Dream {
      unfold() {
        this.play(Create(a), 1)
      }
    }
    const d = new D()
    expect(creationChimes(d.clips).length).toBe(1)
    expect(creationChimes([{ anim: a.creation.to(0), start: 0, duration: 1 }]).length).toBe(0)
  })
})

describe("EffectPlayer — the transport decides", () => {
  const run = (steps: [number, boolean][]): number[] => {
    const fired: FiredSound[] = []
    const p = new EffectPlayer(new Soundtrack([ev(1), ev(2), ev(3)]), { onFire: (f) => fired.push(f) })
    p.muted = true // no AudioContext under bun; the log is what we read
    for (const [t, playing] of steps) p.update(t, playing)
    return fired.map((f) => f.event.time)
  }

  test("playing forward fires what it passes, once", () => {
    expect(run([[0.9, true], [1.0, true], [1.2, true], [1.6, true], [2.05, true]])).toEqual([1, 2])
  })

  test("a jump, a held frame, or a backward step fires nothing", () => {
    expect(run([[0.5, true], [2.5, true]])).toEqual([]) // scrub across two
    expect(run([[0.9, false], [1.1, false]])).toEqual([]) // held/paused
    expect(run([[2.1, true], [1.9, true], [0.9, true]])).toEqual([]) // backwards
  })

  test("resuming from a held frame plays on from there", () => {
    expect(run([[2.9, false], [2.95, true], [3.05, true]])).toEqual([3])
  })
})
