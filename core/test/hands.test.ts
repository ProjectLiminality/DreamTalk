import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import {
  decodeFrames,
  dist,
  encodeFrame,
  frameAt,
  HandEmitter,
  J,
  LEAP_BOX,
  sub,
  toNdc,
  WEBCAM_DEPTH,
  type HandFrame,
  type Vec3,
} from "../src/hands"
import { LEAP_BONE_SIZE, LEAP_DIGIT_SIZE, LEAP_HAND_SIZE, LEAP_OFF, leapHands } from "../hands/leap"
import { PINCH_BIAS, PINCH_GAP, poseHand, poseJoints, SIM_SCRIPTS, simFrameAt, simFrames } from "../hands/sim"
import { placeHand, webcamHand, type Landmark } from "../hands/webcam"
import { HandsRecorder, type SessionLink } from "../hands/recorder"
import { ReplaySource } from "../hands/sources"
import { screenFrame } from "../hands/screen"

const close = (a: Vec3, b: Vec3, eps: number) => expect(dist(a, b)).toBeLessThan(eps)

describe("the hand frame", () => {
  test("toNdc maps a source's box onto [-1, 1]³", () => {
    expect(toNdc(LEAP_BOX.center, LEAP_BOX)).toEqual([0, 0, 0])
    const c = LEAP_BOX.center
    const s = LEAP_BOX.size
    expect(toNdc([c[0] + s[0] / 2, c[1] - s[1] / 2, c[2] + s[2] / 2], LEAP_BOX)).toEqual([1, -1, 1])
  })

  test("frames survive the JSONL round trip, to 0.1 mm", () => {
    const frames = simFrames(SIM_SCRIPTS.drag!, 30)
    const back = decodeFrames(frames.map(encodeFrame).join("\n") + "\n{broken")
    expect(back.length).toBe(frames.length)
    const a = frames[40]!.hands[0]!
    const b = back[40]!.hands[0]!
    for (let k = 0; k < 21; k++) close(a.joints[k]!, b.joints[k]!, 0.1)
    expect(b.side).toBe("right")
  })

  test("frameAt is the last frame at or before t", () => {
    const frames = [0, 0.1, 0.2].map((t): HandFrame => ({ t, source: "sim", hands: [], box: LEAP_BOX }))
    expect(frameAt(frames, -1)).toBeUndefined()
    expect(frameAt(frames, 0.15)!.t).toBe(0.1)
    expect(frameAt(frames, 9)!.t).toBe(0.2)
  })
})

describe("the Leap's structs", () => {
  test("a packed LEAP_HAND maps onto the 21-joint skeleton", () => {
    const buf = new DataView(new ArrayBuffer(2 * LEAP_HAND_SIZE))
    const put = (at: number, v: Vec3) => v.forEach((x, k) => buf.setFloat32(at + k * 4, x, true))
    const base = LEAP_HAND_SIZE // the second hand
    buf.setUint32(base + LEAP_OFF.id, 7, true)
    buf.setUint32(base + LEAP_OFF.type, 1, true)
    buf.setFloat32(base + LEAP_OFF.confidence, 0.9, true)
    buf.setFloat32(base + LEAP_OFF.pinchStrength, 0.75, true)
    buf.setFloat32(base + LEAP_OFF.grabStrength, 0.25, true)
    put(base + LEAP_OFF.palm + LEAP_OFF.palmPosition, [1, 200, 3])
    put(base + LEAP_OFF.palm + LEAP_OFF.palmNormal, [0, -1, 0])
    put(base + LEAP_OFF.palm + LEAP_OFF.palmDirection, [0, 0, -1])
    buf.setFloat32(base + LEAP_OFF.palm + LEAP_OFF.palmWidth, 85, true)
    put(base + LEAP_OFF.arm + LEAP_OFF.boneNext, [0, 190, 60])
    for (let d = 0; d < 5; d++)
      for (let b = 0; b < 4; b++) {
        const at = base + LEAP_OFF.digits + d * LEAP_DIGIT_SIZE + LEAP_OFF.digitBones + b * LEAP_BONE_SIZE
        put(at, [d, b, 0]) // prev joint
        put(at + LEAP_OFF.boneNext, [d, b + 1, 0]) // next joint
      }
    const [, h] = leapHands(buf, 2)
    expect(h!.id).toBe(7)
    expect(h!.side).toBe("right")
    expect(h!.pinch).toBeCloseTo(0.75)
    expect(h!.grab).toBeCloseTo(0.25)
    expect(h!.palm.width).toBe(85)
    expect(h!.joints.length).toBe(21)
    expect(h!.joints[J.wrist]).toEqual([0, 190, 60])
    // digit d: proximal.prev, intermediate.prev, distal.prev, distal.next
    expect(h!.joints[J.thumbCmc]).toEqual([0, 1, 0])
    expect(h!.joints[J.thumbTip]).toEqual([0, 4, 0])
    expect(h!.joints[J.indexMcp]).toEqual([1, 1, 0])
    expect(h!.joints[J.indexTip]).toEqual([1, 4, 0])
    expect(h!.joints[J.pinkyDip]).toEqual([4, 3, 0])
  })
})

describe("the webcam's placement", () => {
  // A known hand in camera space (mm; x right, y down, z away), seen through a 65° lens.
  const W = 1280
  const H = 720
  const FOV = 65
  const f = W / 2 / Math.tan(((FOV * Math.PI) / 180) / 2)
  const shape = poseJoints({ side: "right", at: [0, 0, 0], pinch: 0.3, grab: 0, yaw: 0.4, pitch: 0.5 })
  const centre = shape.reduce((s, p) => [s[0] + p[0] / 21, s[1] + p[1] / 21, s[2] + p[2] / 21] as Vec3, [0, 0, 0] as Vec3)
  // world landmarks: the shape about its centre, in metres, camera axes (the frame's x and y flipped)
  const world: Landmark[] = shape.map((p) => ({ x: -(p[0] - centre[0]) / 1000, y: -(p[1] - centre[1]) / 1000, z: (p[2] - centre[2]) / 1000 }))
  const T: Vec3 = [-80, 120, 430]
  const image: Landmark[] = world.map((w) => {
    const X = w.x * 1000 + T[0]
    const Y = w.y * 1000 + T[1]
    const Z = w.z * 1000 + T[2]
    return { x: (f * X) / Z / W + 0.5, y: (f * Y) / Z / H + 0.5, z: 0 }
  })

  test("recovers where the hand is from its shape and its image", () => {
    close(placeHand(image, world, W, H, FOV), T, 0.5)
  })

  test("lands in the hand frame: user's right is +x, up is +y, toward the user is +z", () => {
    const h = webcamHand(image, world, "Left", 0.95, W, H, FOV, 3)
    expect(h.side).toBe("right") // MediaPipe's labels assume a mirror
    const wrist = h.joints[J.wrist]!
    const w0 = world[J.wrist]!
    close(wrist, [-(w0.x * 1000 + T[0]), -(w0.y * 1000 + T[1]), w0.z * 1000 + T[2] - WEBCAM_DEPTH], 0.5)
    // The hand image-left (x_cam < 0) is on the user's right; above the axis (y_cam < 0) is up.
    expect(h.palm.position[0]).toBeGreaterThan(0)
    expect(h.palm.position[1]).toBeLessThan(0)
  })
})

describe("the simulated hand", () => {
  test("a full pinch closes the tips to the gap, nearer the thumb", () => {
    const at: Vec3 = [0, 200, 0]
    const rest = poseJoints({ side: "right", at, pinch: 0, grab: 0 })
    const pinched = poseJoints({ side: "right", at, pinch: 1, grab: 0 })
    expect(dist(pinched[J.thumbTip]!, pinched[J.indexTip]!)).toBeCloseTo(PINCH_GAP, 0)
    const thumbTravel = dist(rest[J.thumbTip]!, pinched[J.thumbTip]!)
    const indexTravel = dist(rest[J.indexTip]!, pinched[J.indexTip]!)
    expect(thumbTravel).toBeLessThan(indexTravel)
    expect(PINCH_BIAS).toBeLessThan(0.5)
  })

  test("palm-down hands of either side face down; a fist pulls the tips in", () => {
    for (const side of ["left", "right"] as const) {
      const h = poseHand({ side, at: [0, 200, 0], pinch: 0, grab: 0 })
      expect(h.palm.normal[1]).toBeLessThan(-0.9)
      expect(h.palm.direction[2]).toBeLessThan(-0.9)
      const fist = poseHand({ side, at: [0, 200, 0], pinch: 0, grab: 1 })
      expect(dist(fist.joints[J.middleTip]!, fist.palm.position)).toBeLessThan(dist(h.joints[J.middleTip]!, h.palm.position) * 0.6)
    }
    expect(poseHand({ side: "left", at: [0, 0, 0], pinch: 0, grab: 0 }).joints[J.thumbTip]![0]).toBeGreaterThan(0)
  })

  test("scripts are deterministic and carry what they say", () => {
    expect(simFrameAt(SIM_SCRIPTS.pinch!, 1.2)).toEqual(simFrameAt(SIM_SCRIPTS.pinch!, 1.2))
    expect(simFrameAt(SIM_SCRIPTS.pinch!, 1.2).hands[0]!.pinch).toBeCloseTo(1)
    expect(simFrameAt(SIM_SCRIPTS.pinch!, 0.2).hands[0]!.pinch).toBeCloseTo(0)
    const drag = SIM_SCRIPTS.drag!
    const moved = sub(simFrameAt(drag, 2.0).hands[0]!.palm.position, simFrameAt(drag, 0.8).hands[0]!.palm.position)
    expect(moved[0]).toBeCloseTo(120, 0)
    expect(simFrameAt(SIM_SCRIPTS.spread!, 1).hands.map((h) => h.side)).toEqual(["left", "right"])
  })
})

describe("recording and replay", () => {
  test("frames follow the live session onto its clock, and stop with it", async () => {
    const source = new HandEmitter()
    let session: SessionLink | undefined
    let clock = 0
    const puts: [string, string][] = []
    const rec = new HandsRecorder(source, () => session, async (url, body) => void puts.push([url, body]))
    const frames = simFrames(SIM_SCRIPTS.pinch!, 10)
    source.emit(frames[0]!) // no session: ignored
    session = { recording: true, id: "2026-10-15T12-00-00", clock: () => clock }
    for (const f of frames.slice(1, 6)) {
      clock += 0.25
      source.emit(f)
    }
    session = { recording: false, id: undefined, clock: () => clock }
    source.emit(frames[6]!)
    await rec.flush()
    rec.dispose()
    expect(puts.length).toBe(1)
    expect(puts[0]![0]).toBe("/api/session/2026-10-15T12-00-00/hands.jsonl?append=1")
    const back = decodeFrames(puts[0]![1])
    expect(back.map((f) => f.t)).toEqual([0.25, 0.5, 0.75, 1, 1.25])
    expect(rec.recording).toBe(false)
  })

  test("a replay shows exactly the recorded frame at any t", () => {
    const frames = decodeFrames(readFileSync(new URL("./fixtures/hands/drag.jsonl", import.meta.url), "utf8"))
    expect(frames.length).toBeGreaterThan(100)
    const r = ReplaySource.of(frames)
    const seen: HandFrame[] = []
    r.onFrame((f) => seen.push(f))
    expect(r.at(1.5)!.t).toBe(frameAt(frames, 1.5)!.t)
    expect(seen.length).toBe(1)
    expect(seen[0]!.hands[0]!.pinch).toBeCloseTo(1, 1)
    expect(r.duration).toBeCloseTo(2.8, 1)
  })
})

describe("the gesture layer's screen space", () => {
  test("the box spans the screen; up is up, toward the screen is +z, scale is the hand", () => {
    const f = simFrameAt(SIM_SCRIPTS.pinch!, 0)
    const s = screenFrame({ ...f, hands: [poseHand({ side: "right", at: LEAP_BOX.center, pinch: 0, grab: 0 })] })
    const h = s.hands[0]!
    expect(h.joints[J.wrist]![0]).toBeCloseTo(0.5)
    expect(h.joints[J.wrist]![1]).toBeCloseTo(0.5)
    // fingers point at the screen (−z in the frame) → +z here
    expect(h.joints[J.middleTip]![2]).toBeGreaterThan(h.joints[J.wrist]![2])
    const up = screenFrame({ ...f, hands: [poseHand({ side: "right", at: [0, LEAP_BOX.center[1] + 60, 0], pinch: 0, grab: 0 })] })
    expect(up.hands[0]!.joints[J.wrist]![1]).toBeLessThan(0.5) // higher hand, higher on screen (y down)
    expect(h.scale).toBeGreaterThan(0.2)
    expect(h.scale).toBeLessThan(0.6)
  })
})
