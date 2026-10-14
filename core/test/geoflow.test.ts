/**
 * GeoFlow — the geo ↔ abstract bridge, pinned at its two ends and its
 * hand-overs: what exists on the planet, that one param walks between the
 * worlds, and that a member's ring lands exactly on its seat.
 */

import { describe, expect, test } from "bun:test"
import { Observer } from "../src/dream"
import { toWorld } from "../src/parts/soliddrawing"
import { GeoFlow } from "../vocabulary/GeoFlow/GeoFlow"
import { MOCK_GEO } from "../vocabulary/GeoFlow/mockGeo"
import { MOCK_FLOWMAP } from "../vocabulary/FlowMap/FlowMap"
import { Circle } from "../src/parts/primitives"
import { completion } from "../src/params"
import { EarthView, viewPose } from "../vocabulary/Earth/EarthView"

const build = () => {
  const observer = new Observer()
  const g = new GeoFlow({ seenBy: () => observer })
  void g.parts
  g.descent.value = g.regionZoom()
  return { g, observer }
}

describe("GeoFlow", () => {
  test("every geolocated member is a site; its relation and the data's flows between placed ends are arcs", () => {
    const { g } = build()
    const placed = MOCK_FLOWMAP.members.filter((m) => MOCK_GEO.places[m.id])
    expect(g.sites.length).toBe(placed.length)
    expect(g.links.length).toBe(placed.length)
    const both = MOCK_FLOWMAP.flows.filter((f) => MOCK_GEO.places[f.from] && MOCK_GEO.places[f.to] && f.from !== f.to)
    expect(g.traffics.length).toBe(both.length)
    for (const t of g.traffics) expect(t.flow.length).toBeGreaterThan(0)
  })
  test("one axis, v: globe ↔ abstract", () => {
    const { g } = build()
    const [ax] = g.stateSpace().axes
    expect([ax!.id, ax!.key, ax!.positions.map((p) => p.name)]).toEqual(["view", "v", ["globe", "abstract"]])
  })
  test("at the globe the map is absent and the planet whole; at the abstract the reverse", () => {
    const { g } = build()
    g.view.value = 0
    expect(g.map.presence.value).toBe(0)
    expect(g.earth.ball.opacity.value).toBe(1)
    expect(g.links[0]!.opacity.value).toBeGreaterThan(0)
    g.view.value = 1
    expect(g.map.presence.value).toBe(1)
    expect(g.earth.ball.opacity.value).toBe(0)
    expect(g.earth.landOpacity.value).toBe(0)
  })
  test("a member's ring lifts off where its site is seen and lands exactly on its seat", () => {
    const { g } = build()
    const i = MOCK_FLOWMAP.members.findIndex((m) => MOCK_GEO.places[m.id])
    const seat = g.map.slices[0]!.sites[i]!
    const traveler = g.travelers[0]!
    // Late in its glide (u → 1) it stands on the seat.
    g.view.value = 0.79
    const t = toWorld(traveler, { x: 0, y: 0, z: 0 })
    const s = toWorld(seat, { x: 0, y: 0, z: 0 })
    expect(Math.hypot(t.x - s.x, t.y - s.y, t.z - s.z)).toBeLessThan(1e-3 * Math.hypot(s.x, s.y, s.z) + 1e-6)
  })
})

describe("GeoFlow's hooks for a song", () => {
  test("seat(id) finds a member's or partner's seat; inPlane adds to the map's own plane", () => {
    const { g } = build()
    expect(g.seat("A")).toBe(g.map.slices[0]!.sites[0]!)
    expect(g.seat("S1")).toBe(g.map.slices[0]!.partners[0]!)
    expect(() => g.seat("nope")).toThrow()
    const mark = new Circle({ radius: 10 })
    g.inPlane(mark)
    expect(mark.parent).toBe(g.map.parent)
  })
  test("viewExtras ride the v axis: one axis, both ends", () => {
    const observer = new Observer()
    const extra = completion(0)
    const g = new GeoFlow({ seenBy: () => observer, viewExtras: [[extra, 0, 1]] })
    void g.parts
    const [ax] = g.stateSpace().axes
    expect(ax!.positions.map((p) => p.values.get(extra))).toEqual([0, 1])
    expect(ax!.to("abstract").tracks.map((t) => t.param)).toContain(extra)
  })
})

describe("GeoFlow's options for a song", () => {
  test("stagger: the headquarters first, then the sites in turn; relateStagger: links in turn", () => {
    const observer = new Observer()
    const g = new GeoFlow({ seenBy: () => observer, stagger: 0.7, relateStagger: 0.5, rise: 0, relate: 0 })
    void g.parts
    g.rise.value = 0.3
    expect(g.hq.altitude.value).toBeCloseTo(0, 9) // fully up
    expect(g.sites[0]!.altitude.value).toBeLessThan(0) // still underground
    g.relate.value = 0.25
    expect(g.links[0]!.creation.value).toBeGreaterThan(g.links[g.links.length - 1]!.creation.value)
  })
  test("openFov: the lens narrows from openFov to fov over the descent", () => {
    const observer = new Observer()
    const wide = (53.13 * Math.PI) / 180
    const g = new GeoFlow({ seenBy: () => observer, openFov: wide, descent: 0 })
    void g.parts
    expect(observer.fov.value).toBeCloseTo(wide, 9)
    g.descent.value = g.regionZoom()
    expect(observer.fov.value).toBeCloseTo(g.fov, 9)
  })
  test("ortho: parallel once the planet has gone, framed to match at the plane; perspective again below", () => {
    const observer = new Observer()
    const g = new GeoFlow({ seenBy: () => observer, ortho: true })
    void g.parts
    g.descent.value = g.regionZoom()
    g.view.value = 0.5
    expect(observer.orthographic.value).toBe(false)
    expect(observer.zoom.value).toBe(1)
    g.view.value = 1
    expect(observer.orthographic.value).toBe(true)
    // The ortho half-height equals the perspective half-height at the plane.
    const half = 1023 / (2 * observer.zoom.value * (16 / 9))
    const H = (viewPose(g.earth, g.eye, g.fov).distance - HOVER(g)) * Math.tan(g.fov / 2)
    expect(half).toBeCloseTo(H, 6)
  })
  test("planeMembers join the plane; eyeDistance is the plane's distance in map units", () => {
    const observer = new Observer()
    const mark = new Circle({ radius: 5 })
    const g = new GeoFlow({ seenBy: () => observer, planeMembers: (geo: GeoFlow) => (void geo.map, [mark]) })
    void g.parts
    expect(mark.parent).toBe(g.map.parent)
    expect(g.eyeDistance()).toBeCloseTo(300 / (Math.tan(g.fov / 2) * g.fill.value), 9)
  })
})

/** The plane's hover from the focus (half the eye's height over the region). */
const HOVER = (g: GeoFlow) => 0.5 * viewPose(g.earth, (() => { const v = new EarthView({ lat: g.geo.region.lat, lon: g.geo.region.lon, tilt: g.tilt }); v.zoom.value = g.regionZoom(); return v })(), g.fov).distance
