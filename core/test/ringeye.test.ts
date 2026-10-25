/**
 * RingEye — the watchtower's eye ↔ the clear eye, framed by one ring.
 */

import { describe, expect, test } from "bun:test"
import { RINGEYE, RingEye, calmAt, fireAt, flameOutline, pupilOutline } from "../vocabulary/RingEye/RingEye"
import { derive } from "../src/params"

const at = (gaze: number) => {
  const r = new RingEye()
  void r.parts
  r.gaze.value = gaze
  return r
}

describe("RingEye", () => {
  test("one walkable axis, watchtower ↔ clear; none when a whole drives it", () => {
    const axes = at(0).stateSpace()!.axes
    expect(axes.map((a) => a.id)).toEqual(["gaze"])
    expect(axes[0]!.positions.map((p) => p.name)).toEqual(["watchtower", "clear"])
    const held = new RingEye()
    held.gaze.follow(derive(() => 0.5))
    expect(held.stateSpace()).toBeUndefined()
  })

  test("all fire at the watchtower, all calm at clear", () => {
    expect(fireAt(0)).toBe(1)
    expect(calmAt(0)).toBe(0)
    expect(fireAt(1)).toBe(0)
    expect(calmAt(1)).toBe(1)
    const watch = at(0)
    expect(watch.flames.every((f) => f.points.length > 0)).toBe(true)
    expect(watch.world.presence.value).toBe(0)
    const clear = at(1)
    expect(clear.flames.every((f) => f.points.length === 0)).toBe(true)
    expect(clear.world.presence.value).toBe(1)
    expect(clear.towerLayer.presence.value).toBe(0)
  })

  test("the pupil: a pointed slit at the watchtower, a circle at clear", () => {
    const h = 100
    const extent = (pts: { x: number; y: number }[]) => ({
      w: Math.max(...pts.map((p) => Math.abs(p.x))),
      v: Math.max(...pts.map((p) => Math.abs(p.y))),
    })
    const slit = extent(pupilOutline(0, h))
    expect(slit.v / slit.w).toBeCloseTo(RINGEYE.slitH / RINGEYE.slitW, 1)
    for (const p of pupilOutline(1, h)) expect(Math.hypot(p.x, p.y)).toBeCloseTo(RINGEYE.pupil * h, 6)
  })

  test("the whole eye, fire and all, stands inside the ring's opening", () => {
    const r = at(0)
    const R = r.radius.value
    const opening = (1 - RINGEYE.tube) * R
    const h = RINGEYE.h * R
    for (const line of [r.lidTop, r.lidBottom, r.iris, r.pupil, ...r.flames])
      for (const p of line.points) expect(Math.hypot(p.x, p.y)).toBeLessThan(opening)
    // The almond is MolochEye's: its corners at ±2h.
    expect(Math.max(...r.lidTop.points.map((p) => Math.abs(p.x)))).toBeCloseTo(2 * h, 6)
  })

  test("the corona is mirror-symmetric, each flame a closed teardrop", () => {
    const f = flameOutline({ x: 0, y: 0, z: 0 }, { x: 0, y: 1 }, 50, 8, 0)
    expect(f[0]).toEqual(f.at(-1)!)
    for (let i = 0; i < f.length; i++) expect(f[i]!.x).toBeCloseTo(-f[f.length - 1 - i]!.x)
    const flames = at(0).flames
    const centroid = (pts: { x: number; y: number }[]) => ({
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    })
    const cs = flames.map((l) => centroid(l.points))
    for (const c of cs) expect(cs.some((d) => Math.abs(d.x + c.x) < 1e-6 && Math.abs(d.y - c.y) < 1e-6)).toBe(true)
  })

  test("the tower holds the upright ring as an occluder only", () => {
    const r = at(0)
    const solids = r.tower.solids()
    expect(solids.length).toBe(2)
    expect(solids[1]!.kind === "mesh" && solids[1]!.lines).toBe(false)
    r.turn.value = 0.5
    expect(r.tower.solids().length).toBe(1)
  })
})
