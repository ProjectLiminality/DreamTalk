/**
 * The live eye (frames.ts liveView): view-dependent geometry follows the
 * camera a host renders with, with no scene passing its observer in.
 */
import { afterEach, describe, expect, test } from "bun:test"
import { Observer } from "../src/dream"
import { liveView, setLiveObserver } from "../src/geometry/frames"
import { Noosphere } from "../vocabulary/Noosphere/Noosphere"

afterEach(() => setLiveObserver(undefined))

describe("the live eye", () => {
  test("outside a host there is none; the sphere falls back to the default eye", () => {
    expect(liveView()).toBeUndefined()
    const n = new Noosphere({ radius: 400, spin: 0, pitch: 0 })
    void n.parts
    const e = n.sphereEyeNow()!
    expect(e.toward[2]).toBeCloseTo(1, 9)
    expect(e.k).toBeCloseTo(400 / 1500, 9)
  })

  test("named by the host, the sphere's horizon follows the observer's orbit", () => {
    const obs = new Observer()
    setLiveObserver(obs)
    const n = new Noosphere({ radius: 400, spin: 0, pitch: 0 })
    void n.parts
    const front = n.sphereEyeNow()!
    expect(front.toward[2]).toBeCloseTo(1, 6)
    obs.phi.value = Math.PI / 2 // orbit a quarter turn: the eye now on +x
    const side = n.sphereEyeNow()!
    expect(side.toward[0]).toBeCloseTo(1, 6)
    expect(Math.abs(side.toward[2])).toBeLessThan(1e-6)
    // An explicit seenFrom still wins.
    const other = new Observer()
    n.seenFrom(other)
    expect(n.sphereEyeNow()!.toward[2]).toBeCloseTo(1, 6)
  })
})
