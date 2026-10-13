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
