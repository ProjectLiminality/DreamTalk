/**
 * FlowRoad — a flow made concrete: the line becomes a road, each particle
 * its truck, one to one, by one param — and back.
 */

import { describe, expect, test } from "bun:test"
import { Observer } from "../src/dream"
import { bumpParamEpoch } from "../src/params"
import { Stream } from "../vocabulary/Stream/Stream"
import { FlowRoad } from "../vocabulary/Road/FlowRoad"
import type { Vec3Like } from "../src/parts/primitives"
import type { Polylines } from "../src/parts/polylines"
import type { Surface } from "../src/parts/surface"

const path: Vec3Like[] = Array.from({ length: 41 }, (_, i) => {
  const u = i / 40
  return { x: 300 * Math.cos(u), y: 300 * Math.sin(u), z: -150 + 300 * u }
})

const build = (n = 12) => {
  const observer = new Observer({ phi: 0.7, theta: 0.4 })
  observer.orthographic.value = true
  const stream = new Stream({ path, count: n, spacing: 50, speed: 45, time: 3 })
  const road = new FlowRoad(
    { path: () => stream.path(), particles: () => stream.particles(), frame: stream },
    { seenBy: () => observer, up: { x: 0, y: 0, z: 1 } },
  )
  void road.parts
  const [cargo, body, edges, fleet] = road.parts as [Surface, Surface, Polylines, Polylines]
  return { stream, road, cargo, body, edges, fleet, observer }
}

describe("FlowRoad", () => {
  test("at 0 it draws nothing of its own; the source's line and dots show, full", () => {
    const { road, edges, fleet, cargo } = build()
    expect(road.abstractShown()).toBe(1)
    expect(road.dotFill()).toBe(1)
    expect(edges.loops.length).toBe(0)
    expect(fleet.loops.length).toBe(0)
    expect(cargo.indices.length).toBe(0)
  })

  test("the phases: dot fill fades, then the morph takes over from the source, then the trucks fill", () => {
    const { road, edges, cargo } = build()
    road.concrete.value = 0.1
    expect(road.dotFill()).toBeCloseTo(0.5, 6)
    expect(road.abstractShown()).toBe(1)
    road.concrete.value = 0.5
    expect(road.abstractShown()).toBe(0)
    expect(edges.loops.length).toBe(2)
    expect(cargo.indices.length).toBe(0)
    road.concrete.value = 1
    expect(cargo.indices.length).toBeGreaterThan(0)
  })

  test("one truck per visible particle, standing on the path where the particle is", () => {
    const { stream, road } = build()
    road.concrete.value = 1
    const visible = stream.particles().filter((s) => s >= 0)
    const riders = (road as unknown as { state(): { riders: { at: Vec3Like }[] } }).state().riders
    expect(visible.length).toBeGreaterThan(3)
    expect(riders.length).toBe(visible.length)
    // Each truck's ground point is ON the path (the road's centre line).
    const near = (p: Vec3Like) => Math.min(...path.map((q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)))
    for (const r of riders) expect(near(r.at)).toBeLessThan(8)
  })

  test("at the morph's ends the edges are the line (start) and the road's width apart (end)", () => {
    const { road, edges } = build()
    road.concrete.value = 0.2 + 1e-6
    const [a0, b0] = edges.loops
    expect(Math.hypot(a0![20]!.x - b0![20]!.x, a0![20]!.y - b0![20]!.y, a0![20]!.z - b0![20]!.z)).toBeLessThan(0.01)
    road.concrete.value = 0.8
    const [a1, b1] = edges.loops
    expect(Math.hypot(a1![20]!.x - b1![20]!.x, a1![20]!.y - b1![20]!.y, a1![20]!.z - b1![20]!.z)).toBeCloseTo(road.width.value, 3)
  })

  test("reversible: what it draws is a function of the moment, not the way there", () => {
    const { road, fleet } = build()
    road.concrete.value = 0.55
    const first = JSON.stringify(fleet.loops)
    road.concrete.value = 1
    void fleet.loops
    road.concrete.value = 0.55
    expect(JSON.stringify(fleet.loops)).toBe(first)
  })

  test("cheap: twenty flows of their trucks, riding, in a few ms a frame (shared drawings warm)", () => {
    const flows = Array.from({ length: 20 }, () => build(14))
    for (const f of flows) f.road.concrete.value = 1
    const frame = () => {
      for (const f of flows) {
        f.stream.time.value += 1 / 30
        bumpParamEpoch()
        void f.fleet.loops
        void f.cargo.positions
        void f.body.positions
        void f.edges.loops
      }
    }
    for (let i = 0; i < 60; i++) frame() // warm: the views met so far are drawn once, for every flow
    const t0 = performance.now()
    for (let i = 0; i < 30; i++) frame()
    const ms = (performance.now() - t0) / 30
    const trucks = flows.reduce((a, f) => a + f.stream.particles().filter((s) => s >= 0).length, 0)
    console.log(`flowroad: ${trucks} trucks on 20 flows, ${ms.toFixed(2)} ms a frame (geometry only)`)
    expect(trucks).toBeGreaterThan(100)
    expect(ms).toBeLessThan(60) // a loaded machine must not fail it; typically a few ms
  })
})
