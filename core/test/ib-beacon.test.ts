/**
 * ib-beacon.test.ts — the CoherenceBeacon (vocabulary/CoherenceBeacon):
 * reach coupled to coherence; the beacon's cylinder IS the founding
 * circle × square; the incoherent node fades.
 */

import { describe, expect, test } from "bun:test"
import { BEACON, CoherenceBeacon, coherentFace } from "../vocabulary/CoherenceBeacon/CoherenceBeacon"
import { Cylinder } from "../vocabulary/Cylinder/Cylinder"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe("CoherenceBeacon", () => {
  test("reach grows the broadcast rings to the film's radii, innermost first", () => {
    const b = new CoherenceBeacon({ size: 50, reach: 1 })
    void b.parts
    b.rings.forEach((r, i) => {
      near(r.radius.value, BEACON.rings[i]! * 50)
      near(r.y.value, BEACON.ringsY * 50)
    })
    b.reach.value = 0
    expect(b.rings.map((r) => r.radius.value)).toEqual([0, 0, 0])
    b.reach.value = 0.5
    near(b.rings[0]!.radius.value, BEACON.rings[0] * 50)
    near(b.rings[1]!.radius.value, BEACON.rings[1] * 50 * 0.5)
    near(b.rings[2]!.radius.value, 0)
  })

  test("coherence is the rays' density and the rings' brightness; noise is the rival's presence", () => {
    const b = new CoherenceBeacon({ size: 50, coherence: 0.3, noise: 0 })
    void b.parts
    near(b.burst.density.value, 0.3)
    near(b.rings[2]!.opacity.value, 0.3)
    near(b.noiseLayer.there.value, 0)
    b.noise.value = 1
    near(b.noiseLayer.there.value, 1)
    near(b.noiseNode.y.value, BEACON.noiseY * 50)
  })

  test("the beacon's face is the circle × square cylinder, at the film's share of the ring", () => {
    const c = coherentFace(50)
    expect(c).toBeInstanceOf(Cylinder)
    near(c.radius.value, BEACON.cylinder * 50)
    near(c.height.value, 2 * BEACON.cylinder * 50)
    const b = new CoherenceBeacon({ size: 50 })
    void b.parts
    void b.node.parts
    expect(b.node.faces[0]).toBeInstanceOf(Cylinder)
    expect(b.stateAxis("coherence").positions.map((p) => p.name)).toEqual(["faint", "beacon"])
  })
})
