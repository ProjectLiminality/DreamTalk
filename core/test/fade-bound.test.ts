/**
 * A whole fades as one, even where a part's opacity is bound.
 *
 * FadeIn/FadeOut run holon-deep and used to write every leaf's opacity —
 * which threw "follows a derived binding" the moment a composed holon held
 * a part whose opacity follows a derivation (RadioTower's lines, a
 * DreamNode's rings). The fade now goes through the bound param's fader:
 * the binding keeps running underneath, and its reading is scaled.
 */

import { describe, expect, test } from "bun:test"
import { completion, derive } from "../src/params"
import { Group, Line } from "../src/parts/primitives"
import { Timeline } from "../src/timeline"
import { FadeIn, FadeOut } from "../src/verbs"
import { seenOpacity } from "../src/certainty"

const pts = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
]

const build = () => {
  const presence = completion(0.8)
  const bound = new Line({ points: pts, opacity: derive(() => presence.value) })
  const free = new Line({ points: pts })
  const whole = new Group({ members: [bound, free] })
  return { presence, bound, free, whole }
}

describe("FadeIn / FadeOut on a holon with a bound-opacity part", () => {
  test("FadeOut builds, samples, and fades the bound part through its fader", () => {
    const { presence, bound, free, whole } = build()
    expect(bound.opacity.isBound).toBe(true)
    const tl = new Timeline([{ anim: FadeOut(whole), start: 0, duration: 1 }])
    expect(() => tl.apply(0)).not.toThrow()
    expect(bound.opacity.value).toBeCloseTo(0.8, 9)
    tl.apply(0.5)
    const mid = free.opacity.value
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    // The bound part fades in step with its free sibling, times its own reading.
    expect(bound.opacity.value).toBeCloseTo(0.8 * mid, 9)
    tl.apply(1)
    expect(free.opacity.value).toBe(0)
    expect(bound.opacity.value).toBe(0)
    expect(whole.opacity.value).toBe(0)
    // The renderer's reading (seenOpacity) sees the fade too.
    expect(seenOpacity(bound).value).toBe(0)
    // The derivation underneath is untouched: restoring the fade restores it.
    tl.apply(0)
    presence.value = 0.3
    expect(bound.opacity.value).toBeCloseTo(0.3, 9)
  })

  test("FadeIn rises the bound part from 0 to its live derived reading", () => {
    const { presence, bound, whole } = build()
    const tl = new Timeline([{ anim: FadeIn(whole), start: 0, duration: 1 }])
    tl.apply(0)
    expect(bound.opacity.value).toBe(0)
    tl.apply(1)
    expect(bound.opacity.value).toBeCloseTo(0.8, 9)
    presence.value = 0.5
    expect(bound.opacity.value).toBeCloseTo(0.5, 9)
  })

  test("an unbound opacity is still faded by its own value (no fader made)", () => {
    const { free, whole } = build()
    const anim = FadeOut(whole)
    expect(anim.tracks.some((t) => t.param === free.opacity)).toBe(true)
  })

  test("the fader composes with DreamSong's gate", () => {
    const { bound, whole } = build()
    const tl = new Timeline([{ anim: FadeOut(whole), start: 0, duration: 1 }])
    tl.apply(0)
    bound.opacity.gate = 0.5
    expect(bound.opacity.value).toBeCloseTo(0.4, 9)
    tl.apply(1)
    expect(bound.opacity.value).toBe(0)
  })
})
