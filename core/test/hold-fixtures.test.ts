import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { decodeFrames, type HandFrame } from "../src/hands"
import { screenFrame } from "../hands/screen"
import { GestureController } from "../src/gesture/controller"
import { applyT, compose, handBasis, holdPose, PoseFilter, transpose, twoHandMotion, type Basis, type V } from "../src/gesture/hold"
import type { Pose } from "../src/view"

/**
 * The hold, end to end on the hands layer's 6-DoF takes (hands/sim.ts
 * fist-turn, fist-carry, two-fists): the left fist holds (one job per
 * hand), its palm pose comes through the screen projection, and the turn
 * the scene takes is the turn the hand took — with the signs the scripts
 * document (yaw − = clockwise seen from above, pitch + = knuckles up, roll
 * + = counter-clockwise seen along the fingers).
 */

const fixture = (name: string) => decodeFrames(readFileSync(new URL(`./fixtures/hands/${name}.jsonl`, import.meta.url), "utf8"))
const v = (x: number, y: number, z: number): V => ({ x, y, z })
const deg = (r: number) => (r * 180) / Math.PI

/** Axis and angle of a rotation. */
const axisAngle = (R: Basis): { axis: V; angle: number } => {
  const tr = R[0].x + R[1].y + R[2].z
  const angle = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)))
  const a = v(R[1].z - R[2].y, R[2].x - R[0].z, R[0].y - R[1].x)
  const n = Math.hypot(a.x, a.y, a.z) || 1
  return { axis: v(a.x / n, a.y / n, a.z / n), angle }
}

/** Run a take: the frames at which the left hand holds, with the hand's smoothed rotation since the grab. */
const holdTake = (frames: HandFrame[]) => {
  const c = new GestureController({ grabHand: "left" })
  const f = new PoseFilter()
  let grab: Basis | undefined
  const out: { t: number; dR: Basis; palm: V }[] = []
  for (const raw of frames) {
    const s = screenFrame(raw)
    c.update(s)
    const h = s.hands.find((x) => c.grab.isHolding(x.id))
    if (!h) {
      grab = undefined
      continue
    }
    const B = f.update(s.t, v(h.palm.at[0], h.palm.at[1], h.palm.at[2]), handBasis(h.palm.normal, h.palm.direction)).basis
    grab ??= B
    const canon = raw.hands.find((x) => x.id === h.id)!.palm.position
    out.push({ t: s.t, dR: compose(B, transpose(grab)), palm: v(canon[0], canon[1], canon[2]) })
  }
  return out
}
const at = (take: ReturnType<typeof holdTake>, t: number) => take.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a))

describe("holding on the 6-DoF takes", () => {
  const take = holdTake(fixture("fist-turn"))

  test("the left fist holds through the whole turn", () => {
    expect(take.length).toBeGreaterThan(0)
    expect(take[0]!.t).toBeLessThan(1)
    expect(take.at(-1)!.t).toBeGreaterThan(6.8)
  })

  test("yaw: clockwise from above (−40° about +y) — the scene turns the same", () => {
    const { axis, angle } = axisAngle(at(take, 1.75).dR)
    expect(deg(angle)).toBeGreaterThan(35)
    expect(deg(angle)).toBeLessThan(45)
    expect(axis.y).toBeLessThan(-0.95) // about −y: clockwise seen from above
  })

  test("pitch: knuckles up (+30° about +x)", () => {
    const { axis, angle } = axisAngle(at(take, 3.75).dR)
    expect(deg(angle)).toBeGreaterThan(25)
    expect(deg(angle)).toBeLessThan(35)
    expect(axis.x).toBeGreaterThan(0.95)
  })

  test("roll: counter-clockwise seen along the fingers (+30° about the fingers' backward axis, +z)", () => {
    const { axis, angle } = axisAngle(at(take, 5.75).dR)
    expect(deg(angle)).toBeGreaterThan(25)
    expect(deg(angle)).toBeLessThan(35)
    expect(axis.z).toBeGreaterThan(0.9)
  })

  test("back where it started between the turns", () => {
    for (const t of [2.75, 4.75]) expect(deg(axisAngle(at(take, t).dR).angle)).toBeLessThan(3)
  })

  test("the eye: a point to the right of the grab comes toward the viewer when the hand turns clockwise", () => {
    const cam: Pose = { eye: v(0, 0, 1000), right: v(1, 0, 0), up: v(0, 1, 0), back: v(0, 0, 1) }
    const B0 = handBasis([0, -1, 0], [0, 0, -1])
    const held = holdPose(cam, v(0, 0, 0), v(0, 0, 0), B0, compose(at(take, 1.75).dR, B0))
    const right = applyT([held.right, held.up, held.back], v(100 - held.eye.x, -held.eye.y, -held.eye.z))
    expect(right.z).toBeGreaterThan(-1000 + 30) // nearer the eye than it was (−1000 deep)
  })
})

describe("carrying", () => {
  test("a held fist carries: the palm's travel is what the scene follows (+60 x, +40 y, −50 z mm)", () => {
    const take = holdTake(fixture("fist-carry"))
    const a = take[0]!.palm
    const b = at(take, 2.3).palm
    expect(b.x - a.x).toBeCloseTo(60, -1)
    expect(b.y - a.y).toBeCloseTo(40, -1)
    expect(b.z - a.z).toBeCloseTo(-50, -1)
  })
})

describe("both fists", () => {
  test("spread ×2, steer 30° counter-clockwise from above, twist 25° about the line: scale 2, the turns as taken", () => {
    const frames = fixture("two-fists")
    const c = new GestureController({ grabHand: "left" })
    let start: { a: V; b: V; na: V; nb: V } | undefined
    let last: ReturnType<typeof twoHandMotion> | undefined
    let both = 0
    const take: { t: number; m: ReturnType<typeof twoHandMotion> }[] = []
    for (const raw of frames) {
      const s = screenFrame(raw)
      c.update(s)
      const held = raw.hands.filter((h) => c.grab.isHolding(h.id)).sort((x, y) => (x.side === "left" ? -1 : 1) - (y.side === "left" ? -1 : 1))
      if (held.length !== 2) continue
      both++
      const [L, R] = held as [(typeof held)[0], (typeof held)[0]]
      const p = (q: readonly number[]) => v(q[0]!, q[1]!, q[2]!)
      const now = { a: p(L.palm.position), b: p(R.palm.position), na: p(L.palm.normal), nb: p(R.palm.normal) }
      start ??= now
      last = twoHandMotion(start.a, start.b, now.a, now.b, start.na, start.nb, now.na, now.nb)
      take.push({ t: raw.t, m: last })
    }
    expect(both).toBeGreaterThan(100)
    const near = (t: number) => take.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a)).m
    expect(near(2.35).s).toBeCloseTo(2, 1)
    const steer = axisAngle(near(3.55).W)
    expect(deg(steer.angle)).toBeGreaterThan(27)
    expect(deg(steer.angle)).toBeLessThan(33)
    expect(steer.axis.y).toBeGreaterThan(0.95) // counter-clockwise from above
    const all = axisAngle(near(4.5).W)
    // steering and twist together: more than either alone
    expect(deg(all.angle)).toBeGreaterThan(33)
    expect(last).toBeDefined()
  })
})
