import { describe, expect, test } from "bun:test"
import { MudraRecogniser, dtw, learn, normalise, poseDistance, type MudraLibrary } from "../src/gesture/mudra"
import type { Hand, HandFrame, Joint } from "../src/gesture/hand"

/**
 * A hand with each finger extended (1) or curled (0): thumb, index, middle,
 * ring, pinky. Placed at (x, y), size s, turned by `angle` in the image
 * plane; `side` mirrors it.
 */
const hand = (fingers: number[], o: { x?: number; y?: number; s?: number; angle?: number; side?: "left" | "right"; id?: number } = {}): Hand => {
  const s = o.s ?? 0.1
  const side = o.side ?? "right"
  const mirror = side === "left" ? -1 : 1
  const local: Joint[] = Array.from({ length: 21 }, () => [0, 0, 0] as Joint)
  // in hand units: wrist at 0, fingers up (−y on screen), across = +x (index → pinky)
  const roots = [
    [1, -0.35, -0.3],
    [5, -0.3, -1],
    [9, -0.1, -1.05],
    [13, 0.1, -1],
    [17, 0.3, -0.9],
  ] as const
  roots.forEach(([i, x, y], f) => {
    const ext = fingers[f] ?? 1
    const len = f === 0 ? 0.6 : 0.8
    for (let k = 1; k <= 3; k++) {
      // extended: straight up; curled: folding back toward the palm
      const a = (1 - ext) * (k * 1.0)
      const px = f === 0 ? x - 0.25 * k * len * (0.4 + 0.6 * ext) : x
      local[i + k] = [px, y - Math.cos(a) * len * (k / 3) * 1.0, Math.sin(a) * len * (k / 3)] as Joint
    }
    local[i] = [x, y, 0]
  })
  const c = Math.cos(o.angle ?? 0)
  const sn = Math.sin(o.angle ?? 0)
  const joints = local.map(([x, y, z]) => [(o.x ?? 0.5) + s * (mirror * x * c - y * sn), (o.y ?? 0.6) + s * (mirror * x * sn + y * c), s * z] as Joint)
  return { id: o.id ?? 1, side, confidence: 1, joints, scale: s }
}

const F = { open: [1, 1, 1, 1, 1], fist: [0, 0, 0, 0, 0], peace: [0, 1, 1, 0, 0], point: [0, 1, 0, 0, 0], horns: [0, 1, 0, 0, 1] }
const held = (fingers: number[], seconds: number, o: Parameters<typeof hand>[1] = {}, t0 = 0): HandFrame[] =>
  Array.from({ length: Math.round(seconds * 60) }, (_, k) => ({ t: t0 + k / 60, source: "test", hands: [hand(fingers, o)] }))

const library = (): MudraLibrary => ({
  mudras: (Object.keys(F) as (keyof typeof F)[]).map((name) => learn(name, "pose", [held(F[name], 0.5), held(F[name], 0.5, { angle: 0.2, s: 0.12 })])),
})

describe("mudra normalisation", () => {
  test("the same mudra is the same pose near or far, turned or not, left or right", () => {
    const a = normalise(hand(F.peace))
    expect(poseDistance(a, normalise(hand(F.peace, { x: 0.2, y: 0.3, s: 0.2, angle: 0.7 })))).toBeLessThan(1e-9)
    expect(poseDistance(a, normalise(hand(F.peace, { side: "left", angle: -0.4 })))).toBeLessThan(1e-9)
    expect(poseDistance(a, normalise(hand(F.point)))).toBeGreaterThan(0.05)
  })
})

describe("mudra recogniser", () => {
  test("a held pose invokes once it has been held, once per refractory period", () => {
    const r = new MudraRecogniser(library())
    const out = held(F.horns, 2, { x: 0.3, s: 0.09, angle: -0.3, side: "left" }).map((f) => r.update(f))
    const invoked = out.filter((o) => o.invoked)
    expect(invoked.map((o) => o.invoked!.name)).toEqual(["horns", "horns"]) // at ~0.35 s and again after 1.5 s
    expect(invoked[0]!.invoked!.t).toBeGreaterThanOrEqual(0.35)
    expect(out[5]!.candidates[0]!.name).toBe("horns") // a candidate from the first frames, before it invokes
  })

  test("every pose of the library is told apart", () => {
    for (const name of Object.keys(F) as (keyof typeof F)[]) {
      const r = new MudraRecogniser(library())
      const out = held(F[name], 1, { angle: 0.4 }).map((f) => r.update(f))
      expect(out.find((o) => o.invoked)?.invoked?.name).toBe(name)
    }
  })

  test("a shape halfway between two mudras is only a candidate — it never invokes on its own", () => {
    const r = new MudraRecogniser(library())
    const between = [0, 1, 0.5, 0, 0] // half peace, half point
    const out = held(between, 1).map((f) => r.update(f))
    expect(out.some((o) => o.invoked)).toBe(false)
    expect(out.at(-1)!.candidates.length).toBeGreaterThan(0)
  })

  test("a motion mudra is recognised by its path, wherever and however fast it is drawn", () => {
    const wave = (t0: number, x0: number, speed: number): HandFrame[] =>
      Array.from({ length: Math.round(60 / speed) }, (_, k) => {
        const u = (k * speed) / 60
        return { t: t0 + k / 60, source: "test", hands: [hand(F.open, { x: x0 + 0.08 * Math.sin(u * 2 * Math.PI) })] }
      })
    const push = (t0: number): HandFrame[] =>
      Array.from({ length: 60 }, (_, k) => ({ t: t0 + k / 60, source: "test", hands: [hand(F.open, { y: 0.6 - 0.15 * (k / 60) })] }))
    const lib: MudraLibrary = { mudras: [learn("wave", "motion", [wave(0, 0.5, 1)]), learn("rise", "motion", [push(0)])] }
    const r = new MudraRecogniser(lib, { window: 1.2, invokeAt: 0.3 })
    const out = wave(10, 0.3, 1.25).map((f) => r.update(f))
    expect(out.find((o) => o.invoked)?.invoked?.name).toBe("wave")
  })

  test("deterministic: the same take, the same invocations", () => {
    const take = () => {
      const r = new MudraRecogniser(library())
      return held(F.peace, 1.2).map((f) => r.update(f).invoked?.name ?? "")
    }
    expect(take()).toEqual(take())
  })

  test("dtw aligns sequences drawn at different speeds", () => {
    const slow = [0, 0, 1, 1, 2, 2, 3, 3]
    const fast = [0, 1, 2, 3]
    expect(dtw(slow, fast, (a, b) => Math.abs(a - b))).toBe(0)
  })
})
