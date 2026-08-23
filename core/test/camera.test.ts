import { describe, expect, test } from "bun:test"
import {
  CAMERA_APERTURE_MM,
  CAMERA_FOCAL_MM,
  CAMERA_FOV,
  DEFAULT_DISTANCE,
  Observer,
  PERSPECTIVES,
  CAMERA_FOV_VERTICAL,
  ZOOM_REFERENCE_WIDTH,
  distanceForZoom,
  orthoHalfHeight,
} from "../src/dream"
import { PI } from "../src/constants"

describe("orthographic zoom (pydeation TwoDCamera CAMERA_ZOOM)", () => {
  test("zoom 1 frames the reference width", () => {
    const aspect = 16 / 9
    expect(orthoHalfHeight(1, aspect) * 2 * aspect).toBeCloseTo(ZOOM_REFERENCE_WIDTH, 9)
  })

  test("zoom is inverse in the framed width — 2x zoom halves it", () => {
    const aspect = 16 / 9
    expect(orthoHalfHeight(2, aspect)).toBeCloseTo(orthoHalfHeight(1, aspect) / 2, 9)
    expect(orthoHalfHeight(4, aspect)).toBeCloseTo(orthoHalfHeight(1, aspect) / 4, 9)
  })

  test("the S02 zoom sequence 1 -> 7/4 -> 1 returns to its start", () => {
    const aspect = 16 / 9
    const start = orthoHalfHeight(1, aspect)
    const zoomed = orthoHalfHeight(7 / 4, aspect)
    expect(zoomed).toBeLessThan(start)
    expect(zoomed).toBeCloseTo(start * (4 / 7), 9)
    expect(orthoHalfHeight(1, aspect)).toBeCloseTo(start, 12)
  })

  test("half-height respects aspect: wider frame, shorter half-height", () => {
    expect(orthoHalfHeight(1, 16 / 9)).toBeLessThan(orthoHalfHeight(1, 4 / 3))
  })
})

describe("perspective zoom is distance (pydeation ThreeDCamera pos_y = 1000/zoom)", () => {
  test("zoom 1 sits at the default distance", () => {
    expect(distanceForZoom(1)).toBe(DEFAULT_DISTANCE)
  })

  test("the video-01 zooms map to their 2021 distances", () => {
    // S03 camera_zoom 3/2, S09/S10 camera_zoom 5/4.
    expect(distanceForZoom(3 / 2)).toBeCloseTo(2000 / 3, 9)
    expect(distanceForZoom(5 / 4)).toBe(800)
  })

  test("zooming in moves the camera closer, never changes the lens", () => {
    expect(distanceForZoom(2)).toBeLessThan(distanceForZoom(1))
  })
})

describe("the 2021 lens", () => {
  test("fov is the horizontal angle of a 45mm lens on a 36mm aperture", () => {
    expect(CAMERA_FOV).toBeCloseTo(2 * Math.atan(CAMERA_APERTURE_MM / (2 * CAMERA_FOCAL_MM)), 12)
    expect((CAMERA_FOV * 180) / PI).toBeCloseTo(43.6028, 3)
  })

  test("it is not C4D's other common default (36mm, hfov 53.13)", () => {
    expect((CAMERA_FOV * 180) / PI).not.toBeCloseTo(53.13, 1)
  })

  test("the vertical form is the same lens at 16:9", () => {
    expect((CAMERA_FOV_VERTICAL * 180) / PI).toBeCloseTo(25.361, 3)
    expect(CAMERA_FOV_VERTICAL).toBeLessThan(CAMERA_FOV)
  })
})

describe("named perspectives (pydeation camera_perspective)", () => {
  test('"front" is straight on', () => {
    expect(PERSPECTIVES.front).toEqual({ phi: 0, theta: 0 })
  })

  test('"default" is the frozen bank as azimuth and the pitch as elevation', () => {
    // 45 degrees of azimuth off the -Z axis, expressed in the framework's
    // convention where phi = 0 puts the camera on +Z.
    expect(PERSPECTIVES.default.phi).toBeCloseTo((-3 * PI) / 4, 12)
    expect(PERSPECTIVES.default.theta).toBeCloseTo(-PI / 8, 12)
  })

  test("neither perspective rolls the camera", () => {
    const observer = new Observer()
    for (const name of ["front", "default"] as const) {
      observer.look(name)
      expect(observer.tilt.value).toBe(0)
    }
  })
})

describe("Observer", () => {
  test("defaults are the framework's, NOT the 2021 rig's", () => {
    // Existing scenes were framed against these; adopting the 2021 lens by
    // default would silently recrop every one of them.
    const observer = new Observer()
    expect(observer.phi.value).toBe(0)
    expect(observer.theta.value).toBe(0)
    expect(observer.tilt.value).toBe(0)
    expect(observer.zoom.value).toBe(1)
    expect(observer.radius.value).toBe(1500)
    expect(observer.orthographic.value).toBe(false)
    expect((observer.fov.value * 180) / PI).toBeCloseTo(53.13, 6)
  })

  test("look() sets both angles, and is switchable back and forth", () => {
    const observer = new Observer()
    observer.look("default")
    expect(observer.phi.value).toBeCloseTo((-3 * PI) / 4, 12)
    expect(observer.theta.value).toBeCloseTo(-PI / 8, 12)
    observer.look("front")
    expect(observer.phi.value).toBe(0)
    expect(observer.theta.value).toBe(0)
  })

  test("look() adopts the WHOLE 2021 rig — distance and lens too", () => {
    const observer = new Observer()
    observer.look("default")
    expect(observer.radius.value).toBe(DEFAULT_DISTANCE)
    expect(observer.fov.value).toBeCloseTo(CAMERA_FOV_VERTICAL, 12)
  })

  test("look() moves the DEFAULT too, so the pose survives a timeline reset", () => {
    const observer = new Observer()
    observer.look("default")
    expect(observer.phi.defaultValue).toBeCloseTo((-3 * PI) / 4, 12)
    expect(observer.theta.defaultValue).toBeCloseTo(-PI / 8, 12)
  })

  test("orbit() animates only the angles it is given", () => {
    const observer = new Observer()
    expect(observer.orbit({ phi: 1 })).toHaveLength(1)
    expect(observer.orbit({ phi: 1, theta: 0.5, tilt: 0.25 })).toHaveLength(3)
    expect(observer.orbit({})).toHaveLength(0)
  })

  test("pan() and dolly() produce one anim per axis", () => {
    const observer = new Observer()
    expect(observer.pan({ x: 100 })).toHaveLength(1)
    expect(observer.pan({ x: 100, y: 50 })).toHaveLength(2)
    expect(observer.dolly(500)).toHaveLength(1)
  })
})
