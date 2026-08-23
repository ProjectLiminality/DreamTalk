/**
 * The h/p/b composition order.
 *
 * h/p/b are C4D's HPB triple. C4D composes them M = R_H · R_P · R_B about
 * its OWN axes; under the fixed axis dictionary (X, Y, Z)c4d → (x, z, y)
 * that reads Rz(b) · Rx(p) · Ry(h) in ours — three's 'ZXY' Euler order.
 *
 * Single-axis poses cannot tell the orders apart, which is why the wrong
 * one survived until video-01 Scene 09 turned a rectangle about two axes
 * at once (h=PI/2, p=PI/4 in the source). These tests pin the composition
 * against three's own 'ZXY' Euler and against the S09 landmark the
 * reference frames measure.
 */

import { describe, expect, test } from "bun:test"
import * as THREE from "three"
import { rotHPB, invRotHPB } from "../src/parts/curves"
import { PI } from "../src/constants"

const near = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe("rotHPB", () => {
  test("agrees with three's ZXY Euler for a two-axis pose", () => {
    const p = PI / 4
    const h = 0.31
    const b = PI / 2
    const v = { x: 50, y: 100, z: 0 }
    const got = rotHPB(v, p, h, b)
    const want = new THREE.Vector3(v.x, v.y, v.z).applyEuler(
      new THREE.Euler(p, h, b, "ZXY"),
    )
    near(got.x, want.x, 1e-9)
    near(got.y, want.y, 1e-9)
    near(got.z, want.z, 1e-9)
  })

  test("invRotHPB undoes rotHPB", () => {
    const v = { x: 13, y: -7, z: 41 }
    const back = invRotHPB(rotHPB(v, 0.4, -1.1, 0.9), 0.4, -1.1, 0.9)
    near(back.x, v.x, 1e-9)
    near(back.y, v.y, 1e-9)
    near(back.z, v.z, 1e-9)
  })

  test("the S09 rectangle lands where the reference measures it", () => {
    // Rectangle 100x200 at b=PI/2, p=PI/4, y=25 — the source's
    // Transform(rectangle, h=PI/2, p=PI/4) under the axis mapping. C4D's
    // order sends the top-right corner to (-70.71, 50, 70.71), i.e.
    // (-70.71, 75, 70.71) once the y=25 offset is added; three's XYZ
    // default would send it to (-100, 60.4, 35.4), which the reference
    // frames rule out by ~43px at the calibrated camera.
    const corner = rotHPB({ x: 50, y: 100, z: 0 }, PI / 4, 0, PI / 2)
    near(corner.x, -100 / Math.SQRT2, 1e-9)
    near(corner.y, 50, 1e-9)
    near(corner.z, 100 / Math.SQRT2, 1e-9)
  })
})
