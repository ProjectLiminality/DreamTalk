/**
 * Vision (the InterBrain film's name for the red S-mark) and the MolochEye's
 * `iris` — the construction's relations, derived; the rename's re-export;
 * the iris endpoints (iris = 0 is the eye exactly as before).
 */

import { describe, expect, test } from "bun:test"
import {
  FILM_BAND,
  LIGHT_LAYERS,
  MARK_RED,
  RING_RATIO,
  VISION,
  VISION_PEN,
  Vision,
  sBandOutline,
  sCentreline,
} from "../vocabulary/Vision/Vision"
import * as Old from "../vocabulary/Regenaissance/SMark"
import { Regenaissance } from "../vocabulary/Regenaissance/Regenaissance"
import { MolochEye, VISION_IRIS_RATIO, cubeAt, visionAt } from "../vocabulary/MolochEye/MolochEye"
import { MindVirus } from "../vocabulary/MindVirus/MindVirus"
import { gatherStateSpace } from "../src/automaton"
import { RED } from "../src/constants"

describe("Vision: two semicircles, a dot and a square", () => {
  test("the S's bowls kiss at the centre, and the dot and square sit at their centres", () => {
    const R = 100
    const v = new Vision({ radius: R })
    void v.parts
    const k = VISION.offset * R
    const d = k * Math.SQRT1_2
    // dot at +D, square centred on −D (the bowls' own centres)
    expect(v.dot.x.value).toBeCloseTo(d, 9)
    expect(v.dot.y.value).toBeCloseTo(d, 9)
    expect(v.dot.radius.value).toBeCloseTo(VISION.dot * R, 9)
    const xs = v.square.points.map((p) => p.x)
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(-d, 9)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(VISION.square * R, 9)
    // every centreline point lies on one of the two bowls, and the line passes the centre
    const c = sCentreline(R)
    for (const p of c) {
      const onD = Math.abs(Math.hypot(p.x - d, p.y - d) - k) < 1e-9
      const onQ = Math.abs(Math.hypot(p.x + d, p.y + d) - k) < 1e-9
      expect(onD || onQ).toBe(true)
    }
    expect(c.some((p) => Math.hypot(p.x, p.y) < 1e-9)).toBe(true)
  })

  test("`weight` is the band's width in units of R; the pen stays a screen weight", () => {
    const R = 100
    // every outline point is half the band off one bowl's centreline circle
    const band = (w: number) => {
      const k = VISION.offset * R
      const d = k * Math.SQRT1_2
      const offs = sBandOutline(R, 40, w).map((p) =>
        Math.min(Math.abs(Math.hypot(p.x - d, p.y - d) - k), Math.abs(Math.hypot(p.x + d, p.y + d) - k)),
      )
      return 2 * Math.max(...offs)
    }
    expect(band(VISION.band)).toBeCloseTo(VISION.band * R, 9)
    expect(band(FILM_BAND)).toBeCloseTo(FILM_BAND * R, 9)
    const thin = new Vision({ radius: R, weight: FILM_BAND })
    void thin.parts
    expect((thin.band.parts[0] as import("../src/parts/primitives").Line).points).toEqual(sBandOutline(R, 40, FILM_BAND))
    expect(thin.spine.stroke.value).toBe(VISION_PEN)
  })

  test("the ring: RING_RATIO·R, drawn on by `ring`, absent at 0", () => {
    const v = new Vision({ radius: 150 })
    void v.parts
    // f5821: ring 157 px about a mark of R = 150 px
    expect(RING_RATIO).toBeCloseTo(157 / 150, 3)
    expect(v.ringCircle.radius.value).toBeCloseTo(RING_RATIO * 150, 9)
    expect(v.ringCircle.creation.value).toBe(0)
    v.ring.value = 1
    expect(v.ringCircle.creation.value).toBe(1)
  })

  test("the light: a core under a halo, both following `light`, beneath the mark", () => {
    const v = new Vision({ radius: 100 })
    void v.parts
    expect(v.core.fillOpacity.value).toBe(0)
    expect(v.halo.fillOpacity.value).toBe(0)
    v.light.value = 1
    expect(v.core.fillOpacity.value).toBe(LIGHT_LAYERS[0]![2])
    expect(v.halo.fillOpacity.value).toBe(LIGHT_LAYERS[1]![2])
    // the core is opaque (the halo mixes over it), and both lie inside the ring
    expect(LIGHT_LAYERS[0]![2]).toBe(1)
    for (const [r] of LIGHT_LAYERS) expect(r).toBeLessThan(RING_RATIO)
    // attach order: light first, then the ring, then the mark (fills composite in that order)
    const order = v.parts
    expect(order.indexOf(v.core)).toBeLessThan(order.indexOf(v.halo))
    expect(order.indexOf(v.halo)).toBeLessThan(order.indexOf(v.band))
  })

  test("sovereign; Create writes the mark (spine, band, eyes) and leaves ring and light to their params", () => {
    expect(Vision.sovereign).toBe(true)
    const v = new Vision()
    const params = new Set(v.createAnim().tracks.map((t) => t.param))
    expect(params.size).toBe(4)
    expect(params.has(v.ring as never)).toBe(false)
  })
})

describe("the rename: SMark is Vision", () => {
  test("the old module re-exports the one implementation under its old names", () => {
    expect(Old.SMark).toBe(Vision)
    expect(Old.SMARK).toBe(VISION)
    expect(Old.SMARK_PEN).toBe(VISION_PEN)
    expect(Old.MARK_RED).toBe(MARK_RED)
    expect(Old.sCentreline).toBe(sCentreline)
    expect(Old.sBandOutline).toBe(sBandOutline)
  })

  test("Regenaissance holds a Vision, in its own red", () => {
    const regen = new Regenaissance({ radius: 300 })
    void regen.parts
    expect(regen.sMark).toBeInstanceOf(Vision)
    expect(regen.sMark!.tint.value).toEqual(MARK_RED)
    expect(regen.sMark!.weight.value).toBe(VISION.band)
  })
})

describe("MolochEye's iris: cube (0) ↔ Vision (1)", () => {
  test("the crossfade's endpoints", () => {
    expect(cubeAt(0)).toBe(1)
    expect(cubeAt(1)).toBe(0)
    expect(visionAt(0)).toBe(0)
    expect(visionAt(1)).toBe(1)
  })

  test("iris = 0 (the default) is the eye as before: the cube whole, the mark nowhere", () => {
    const eye = new MolochEye({ height: 100 })
    void eye.parts
    expect(eye.iris.value).toBe(0)
    for (const p of [eye.pupilBack, eye.pupilFront, ...eye.connectors]) {
      expect(p.opacity.value).toBe(1)
      expect(p.scale.value).toBe(1)
    }
    expect(eye.vision!.presence.value).toBe(0)
    // the same Create as before: 10 params, the mark not among them
    expect(new Set(eye.createAnim().tracks.map((t) => t.param)).size).toBe(10)
  })

  test("iris = 1 is the liminal eye: the cube gone, the red mark filling the iris ring", () => {
    const eye = new MolochEye({ height: 102, iris: 1 })
    void eye.parts
    for (const p of [eye.pupilBack, eye.pupilFront, ...eye.connectors]) expect(p.opacity.value).toBe(0)
    expect(eye.vision!.presence.value).toBe(1)
    expect(eye.vision!.scale.value).toBe(1)
    // f12691: R = 100.2 px in an iris ring of h = 102 px
    expect(VISION_IRIS_RATIO).toBeCloseTo(100.2 / 102, 2)
    expect(eye.vision!.radius.value).toBeCloseTo(VISION_IRIS_RATIO * eye.irisRing.radius.value, 9)
    expect(eye.vision!.tint.value).toEqual(RED)
    expect(eye.vision!.weight.value).toBe(FILM_BAND)
    // a liminal eye's Create writes its mark too
    expect(new Set(eye.createAnim().tracks.map((t) => t.param)).size).toBe(14)
  })

  test("standing alone it walks cube ↔ vision; as MindVirus's gaze it yields to the whole", () => {
    const eye = new MolochEye()
    void eye.parts
    const space = gatherStateSpace([eye])
    expect(space.axes.map((a) => `${a.id}:${a.positions.map((p) => p.name).join(",")}`)).toEqual(["iris:cube,vision"])
    const virus = new MindVirus()
    void virus.parts
    expect(gatherStateSpace([virus]).axes.map((a) => a.id)).toEqual(["state"])
    // …and, quiet (iris 0, unbound), it carries no mark at all: TheWall's gazes stay light
    void virus.molochEye.parts
    expect(virus.molochEye.vision).toBeUndefined()
    expect(virus.molochEye.pupilFront.opacity.isBound).toBe(false)
  })
})
