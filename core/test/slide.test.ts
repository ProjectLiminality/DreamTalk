/**
 * slide(d) — Keynote's Push as a DreamSong transition (src/song.ts).
 *
 * The outgoing chapter's roots rise one frame-height while the incoming
 * chapter's rise from one frame-height below to rest, eased C4D-smooth,
 * nothing fading. A pure layer like the others: outside the window every
 * carried y is restored, so a scrub is bit-identical both ways.
 */

import { describe, expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { DreamSong } from "../src/song"
import { Group, Circle } from "../src/parts/primitives"
import { slide, smooth } from "../src/transitions"

/**
 * A frames 500 units tall (radius 500 at the default 53.13° vertical fov:
 * 2·500·tan(26.565°) = 500); B frames 900. A's dot sits at y = 20 and is
 * driven in x; A's ring is ALSO a member of a Group the scene stages, so
 * it is listed as a root and must not be carried twice.
 */
class SceneA extends Dream {
  dot = new Circle({ y: 20 })
  ring = new Circle()
  group = new Group({ members: [this.ring] })
  unfold(): void {
    this.set(...this.observer.dolly(500))
    this.play(this.dot.x.to(10, { easing: "linear" }), 2)
    this.stage(this.ring)
    this.stage(this.group)
  }
}

/** B drives its dot's y 0 → 50 over its 2s. */
class SceneB extends Dream {
  dot = new Circle()
  unfold(): void {
    this.set(...this.observer.dolly(900))
    this.play(this.dot.y.to(50, { easing: "linear" }), 2)
  }
}

const song = () => {
  const s = new DreamSong([SceneA, [SceneB, slide(1)]])
  return { s, a: s.chapters[0]!.dream as SceneA, b: s.chapters[1]!.dream as SceneB }
}

describe("slide", () => {
  test("the spec", () => {
    expect(slide(1.5)).toEqual({ kind: "slide", duration: 1.5 })
  })

  test("A rises a frame-height of its own; B rises from a frame-height of its own below", () => {
    const { s, a, b } = song()
    s.applyAt(1.5) // window 1–2, midpoint
    const e = smooth(0.5)
    expect(a.dot.y.value).toBeCloseTo(20 + e * 500, 2)
    // B's driven y (12.5 at its local 0.5) carried down by (1 − e)·900.
    expect(b.dot.y.value).toBeCloseTo(12.5 - (1 - e) * 900, 2)
  })

  test("nothing fades: both pictures are whole for the whole window", () => {
    const { s, a, b } = song()
    for (const t of [1, 1.25, 1.5, 1.75]) {
      s.applyAt(t)
      expect(a.dot.opacity.value).toBe(1)
      expect(b.dot.opacity.value).toBe(1)
    }
  })

  test("a Group's member that the scene also lists is carried once, by its whole", () => {
    const { s, a } = song()
    s.applyAt(1.5)
    expect(a.ring.y.value).toBe(0)
    expect(a.group.y.value).toBeCloseTo(smooth(0.5) * 500, 2)
  })

  test("pure: outside the window every carried y is what it was, either way round", () => {
    const { s, a, b } = song()
    s.applyAt(1.5)
    s.applyAt(0.5)
    expect(a.dot.y.value).toBe(20)
    expect(a.group.y.value).toBe(0)
    s.applyAt(1.5)
    s.applyAt(3) // B's local 2: its own ramp's end, nothing added
    expect(b.dot.y.value).toBe(50)
    const forward = (s.applyAt(1.25), b.dot.y.value)
    s.applyAt(1.9)
    expect((s.applyAt(1.25), b.dot.y.value)).toBe(forward)
  })
})
