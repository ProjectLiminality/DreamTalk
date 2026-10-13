/**
 * GeoFlow — a FlowMap that lives on the Earth: the same organisation seen
 * where it is, and seen as what it is, with ONE param between the two.
 *
 * Any `FlowMapData` whose members and partners carry a lat/lon (`geo`)
 * becomes, at `view` 0, sites on the planet — the group's own place a
 * Headquarters, each geolocated member a Factory, each geolocated partner a
 * ring on the ground — every member reporting home along a great-circle
 * arc, and the data's flows running between their places as traffic
 * (Connection particles). At `view` 1 it is the abstract FlowMap. Between,
 * one transition, the same both ways:
 *
 *   0    → 0.27  the eye pulls back from the region
 *   0.12 → 0.6   the planet dims; the buildings sink back into the ground;
 *                the traffic on the globe fades (the map's own flows take
 *                over once it is whole)
 *   0.18 → 0.6   the relation arcs morph (MorphCurves) into ONE circle —
 *                the group; at 0.6 the map's own rim takes over from it
 *   0.24 → 0.8   each member lifts off its place as a ring and glides to its
 *                seat in the circle (staggered); it IS the member on landing
 *   0.6  → 0.88  the planet goes
 *   0.74 → 0.95  the partners appear round the group (geolocated ones
 *                glide from their places, the rest draw in)
 *
 * THE ABSTRACT PLANE hovers between the eye and the region, facing the eye
 * at the end of the descent, and is scaled every frame so the group circle
 * fills `fill` of the half-frame wherever the eye is. A member's ring
 * starts its glide where the member is SEEN — the eye's ray through its
 * place, met with the plane — so it lifts off the planet exactly where it
 * stands.
 *
 * It drives the camera (EarthView + followEarth, the observer's lens set to
 * `fov`), so a scene gives it the observer (`seenBy`) and animates its
 * beats: `landIn`, `rise`, `relate`, `traffic`, `descent`, then `view`.
 * In free play, `v` walks globe ↔ abstract (interruptible, reversible).
 *
 * The technique was proved by a private DreamSong and consolidated here,
 * generic: nothing of that song's data travels with it.
 */

import type { Holon, Overrides } from "../../src/holon"
import type { Observer } from "../../src/dream"
import { Text } from "../../src/parts/text"
import { toLocal, toWorld } from "../../src/parts/soliddrawing"
import { Circle, Group, Null } from "../../src/parts/primitives"
import { rgb, WHITE, type Color } from "../../src/constants"
import { completion, derive, length, scalar } from "../../src/params"
import { axis, type StateSpace } from "../../src/automaton"
import { certainty } from "../../src/certainty"
import { BALL_INSET, Earth, Place } from "../Earth/Earth"
import { EarthView, followEarth, viewPose, zoomForSpan } from "../Earth/EarthView"
import { Factory } from "../Earth/Factory"
import { Headquarters } from "../Earth/Headquarters"
import { Connection } from "../Earth/Connection"
import { FlowEntity, FlowMap, MOCK_FLOWMAP, type FlowMapData } from "../FlowMap/FlowMap"
import { MorphCurves } from "../Morph/MorphCurves"
import { MOCK_GEO } from "./mockGeo"

/** A place on the planet, and how sure we are of it (0 = a guess, ghosted). */
export interface GeoPoint {
  lat: number
  lon: number
  certainty?: number
}

/** Where a FlowMap's organisation is on the planet. */
export interface GeoFlowGeo {
  /** The group's own place (its headquarters). */
  group: GeoPoint
  /** The region the eye descends to: centre and half-extent on the ground, degrees. */
  region: { lat: number; lon: number; span: number }
  /** Member and partner ids → their places. Any id may be missing (it simply has no place). */
  places: Readonly<Record<string, GeoPoint>>
}

/** The view windows (module header). */
const W = { pull: [0, 0.27], morph: [0.18, 0.6], dim: [0.12, 0.6], sink: [0.24, 0.57], gone: [0.6, 0.88], partners: [0.74, 0.95] } as const
const GLIDE = 0.36
const PARTNER_GLIDE = 0.14
/** The map's own radius (FlowMap's native units). */
const MAP_R = 300
const EARTH_R = 400
/** How far the abstract plane hovers off the ground, as a fraction of the eye's height. */
const HOVER_K = 0.5

const ss = (a: number, b: number, x: number): number => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}
const mix = (a: Color, b: Color, u: number): Color => ({
  r: a.r + (b.r - a.r) * u,
  g: a.g + (b.g - a.g) * u,
  b: a.b + (b.b - a.b) * u,
})
const sunkBy = (height: number) => -(height + BALL_INSET * EARTH_R * 4)

/** A site on the planet: a Place that knows how sure we are of where it is. */
class Site extends Place {
  certainty = certainty(1)
}
/** A ring in flight from the planet to its seat: as sure of its place as the data, until seated. */
class Traveler extends Group {
  certainty = certainty(1)
}

export class GeoFlow extends Null {
  static sovereign = true

  /** The organisation and its flows. Construction-time. */
  data: FlowMapData = MOCK_FLOWMAP
  /** Where it is on the planet. Construction-time. */
  geo: GeoFlowGeo = MOCK_GEO
  /** The scene's observer — GeoFlow flies it. */
  seenBy: (() => Observer) | undefined = undefined
  /** The lens of the descent and the abstract map (vertical, radians). Construction-time. */
  fov = (26 * Math.PI) / 180
  /** The eye's lean over the region, degrees. Construction-time. */
  tilt = 34

  /** THE axis: 0 = the globe, 1 = the abstract map. */
  view = completion(0)
  /** The land's own presence as a song floods it in. */
  landIn = completion(1)
  /** How far the buildings have risen out of the ground. */
  rise = completion(1)
  /** The members' relation arcs, drawn home. */
  relate = completion(1)
  /** The traffic on the globe, drawn on. */
  traffic = completion(1)
  /** The descent's zoom over the region (the view pulls back from it). */
  descent = scalar(0)
  /** The clock every flow runs on — the globe's traffic and the map's particles. */
  time = scalar(0)
  /** The fraction of the half-frame the group circle fills. */
  fill = completion(0.64)
  /** The eye's step back (the stage stack is wider than the flat map). */
  breadth = scalar(1)
  /** Building size on the planet, scene units. */
  siteSize = length(9)

  earth!: Earth
  eye!: EarthView
  map!: FlowMap
  hq!: Site
  /** Geolocated members' sites, and the members' indices into `data.members`. */
  sites: Site[] = []
  partnerSites: Site[] = []
  links: Connection[] = []
  traffics: Connection[] = []
  relations!: MorphCurves
  travelers: Traveler[] = []
  plane!: Group

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** The zoom that frames the region (what `descent` usually goes to). */
  regionZoom(): number {
    return zoomForSpan(EARTH_R, this.geo.region.span, 0.8, this.fov)
  }

  override stateSpace(): StateSpace {
    if (this.view.isBound) return { axes: [] }
    return { axes: [axis("view", this, { globe: { view: 0 }, abstract: { view: 1 } }, { key: "v", duration: 6.6 })] }
  }

  protected override compose(): void {
    const observer = this.seenBy?.()
    if (!observer) throw new Error("GeoFlow: give it the scene's observer (seenBy: () => this.observer)")
    const a = () => this.view.value
    const data = this.data
    const geo = this.geo

    // --- the abstract map (built first: the sites read its grain) ---------
    const map = new FlowMap({
      radius: MAP_R,
      data,
      rim: 0,
      labels: 0,
      memberLabels: 1,
      memberScale: 0.85,
      time: this.time,
      seenBy: () => observer,
    })
    this.map = map
    const tintOf = new Map((data.categories ?? []).map((c) => [c.id, c.tint ?? WHITE]))
    const memberTint = (cats: readonly string[] | undefined): Color => {
      if (!cats || cats.length !== 1) return WHITE
      return mix(WHITE, tintOf.get(cats[0]!) ?? WHITE, map.grain.value)
    }

    // --- the planet's sites ------------------------------------------------
    const located = data.members.map((m, i) => ({ m, i, at: geo.places[m.id] })).filter((x) => x.at)
    const n = located.length
    const sinkStart = (k: number) => W.sink[0] + (W.sink[1] - W.sink[0]) * 0.5 * (n <= 1 ? 0 : k / (n - 1))
    const altitude = (height: number, a0: number) =>
      derive(() => sunkBy(height) * (1 - this.rise.value * (1 - ss(a0, a0 + (W.sink[1] - W.sink[0]) * 0.5, a()))))

    const hqSize = this.siteSize.value * 1.2
    this.hq = new Site({
      lat: geo.group.lat,
      lon: geo.group.lon,
      certainty: geo.group.certainty ?? 1,
      altitude: altitude(Headquarters.heightFor(hqSize), sinkStart(0)),
      members: [new Headquarters({ tint: WHITE, size: hqSize })],
    })
    this.sites = located.map(
      ({ m, at }, k) =>
        new Site({
          lat: at!.lat,
          lon: at!.lon,
          certainty: at!.certainty ?? 1,
          altitude: altitude(Factory.heightFor(this.siteSize.value), sinkStart(k)),
          members: [new Factory({ size: this.siteSize.value, tint: derive(() => memberTint(m.categories)) })],
        }),
    )
    const partnersLocated = (data.partners ?? []).map((p, j) => ({ p, j, at: geo.places[p.id] })).filter((x) => x.at)
    this.partnerSites = partnersLocated.map(
      ({ at }) =>
        new Site({
          lat: at!.lat,
          lon: at!.lon,
          certainty: at!.certainty ?? 1,
          members: [
            new Circle({
              radius: this.siteSize.value * 0.45,
              stroke: 1.4,
              tint: rgb(0xb0, 0xb0, 0xb0),
              p: -Math.PI / 2,
              y: 0.4,
              opacity: derive(() => 1 - ss(W.dim[0], W.dim[1], a())),
            }),
          ],
        }),
    )

    // --- every member reports home; the flows run between places -----------
    const morphAt = derive(() => ss(W.morph[0], W.morph[1], a()))
    this.links = this.sites.map(
      (site) =>
        new Connection({
          ends: [site, this.hq],
          stroke: 1.4,
          creation: this.relate,
          opacity: derive(() => (morphAt.value > 0 ? 0 : 0.85)),
        }),
    )
    const placeOf = new Map<string, Site>()
    located.forEach(({ m }, k) => placeOf.set(m.id, this.sites[k]!))
    partnersLocated.forEach(({ p }, k) => placeOf.set(p.id, this.partnerSites[k]!))
    const stageTint = new Map(data.stages.map((s) => [s.id, s.tint ?? WHITE]))
    const maxRate = Math.max(1, ...data.flows.map((f) => f.rate ?? 1))
    for (const f of data.flows) {
      const from = placeOf.get(f.from)
      const to = placeOf.get(f.to)
      if (!from || !to || from === to) continue
      this.traffics.push(
        new Connection({
          ends: [from, to],
          particles: 10,
          volume: (f.rate ?? 1) / maxRate,
          time: this.time,
          stroke: 0.8,
          tint: rgb(0x50, 0x50, 0x50),
          particleTint: stageTint.get(f.stage) ?? WHITE,
          creation: this.traffic,
          opacity: derive(() => 1 - ss(W.dim[0], W.dim[1], a())),
        }),
      )
    }

    // --- the planet and the eye -------------------------------------------
    const fade = (dim: number) => (1 - (1 - dim) * ss(W.dim[0], W.dim[1], a())) * (1 - ss(W.gone[0], W.gone[1], a()))
    this.earth = new Earth({
      radius: EARTH_R,
      limbStroke: 1.2,
      land: rgb(0x0e, 0x0e, 0x0e),
      landOpacity: derive(() => this.landIn.value * fade(0.35)),
      coastOpacity: derive(() => fade(0.35)),
      borderOpacity: derive(() => fade(0.25)),
      limbOpacity: derive(() => fade(1)),
      places: [this.hq, ...this.sites, ...this.partnerSites, ...this.links, ...this.traffics],
    })
    this.eye = new EarthView({
      lat: geo.region.lat,
      lon: geo.region.lon,
      tilt: this.tilt,
      zoom: derive(() => this.descent.value - 1.1 * ss(W.pull[0], W.pull[1], a())),
    })
    observer.fov.defaultValue = this.fov
    observer.fov.value = this.fov
    followEarth(observer, this.earth, this.eye, { detail: 2 })

    // --- the abstract plane: hovering over the region, facing the eye -----
    const pose = (() => {
      const v = new EarthView({ lat: geo.region.lat, lon: geo.region.lon, tilt: this.tilt })
      v.zoom.value = this.regionZoom()
      return viewPose(this.earth, v, this.fov)
    })()
    const hover = HOVER_K * pose.distance
    const mapScale = derive(() => {
      const d = Math.max(1, observer.radius.value / (observer.zoom.value || 1) - hover)
      return (d * Math.tan(observer.fov.value / 2) * this.fill.value * this.breadth.value) / MAP_R
    })
    const twin = new Circle({ radius: MAP_R, stroke: 3, opacity: 0 })
    void map.parts
    const front = map.slices[0]!

    /** Where a place is SEEN on the plane (map-local): the eye's ray through it, met with the plane. */
    let scaled: Group | undefined
    const onPlane = (place: Place): { x: number; y: number } => {
      const P = toWorld(place, { x: 0, y: 0, z: 0 })
      const { focus: F, dir } = pose
      const dist = observer.radius.value / (observer.zoom.value || 1)
      const C = { x: F.x + dir.x * dist, y: F.y + dir.y * dist, z: F.z + dir.z * dist }
      const along = (v: { x: number; y: number; z: number }) => v.x * dir.x + v.y * dir.y + v.z * dir.z
      const t = (hover - dist) / Math.min(-1e-6, along({ x: P.x - C.x, y: P.y - C.y, z: P.z - C.z }))
      const X = { x: C.x + (P.x - C.x) * t, y: C.y + (P.y - C.y) * t, z: C.z + (P.z - C.z) * t }
      const L = toLocal(scaled!, X)
      return { x: L.x, y: L.y }
    }

    const travel = (site: Site, seat: () => FlowEntity, start: number, glide: number, label: string, tint: () => Color, sure: number) => {
      const t0 = start + 0.04
      const u = () => ss(t0, t0 + glide, a())
      const flying = () => a() >= start && a() < t0 + glide
      const at = () => {
        const k = u()
        const from = onPlane(site)
        const e = seat()
        return { x: from.x + (e.x.value - from.x) * k, y: from.y + (e.y.value - from.y) * k }
      }
      const presence = derive(() => (flying() ? ss(start, t0, a()) : 0))
      const ink = derive(tint)
      return new Traveler({
        certainty: derive(() => sure + (1 - sure) * u()),
        x: derive(() => at().x),
        y: derive(() => at().y),
        members: [
          new Circle({ radius: derive(() => seat().ring.radius.value), stroke: 2.5, tint: ink, opacity: presence }),
          new Text({
            content: label,
            size: derive(() => seat().ring.radius.value * 0.7),
            tint: ink,
            y: derive(() => -seat().ring.radius.value * 0.25),
            opacity: presence,
          }),
        ],
      })
    }
    const landAt: number[] = []
    this.travelers = located.map(({ m, i, at }, k) => {
      landAt.push(sinkStart(k) + 0.04 + GLIDE)
      return travel(this.sites[k]!, () => front.sites[i]!, sinkStart(k), GLIDE, m.label ?? m.id, () => memberTint(m.categories), at!.certainty ?? 1)
    })
    const partnerStart = (j: number, count: number) =>
      W.partners[0] + (W.partners[1] - W.partners[0] - PARTNER_GLIDE) * (j / Math.max(1, count - 1))
    const partnerCount = (data.partners ?? []).length
    partnersLocated.forEach(({ p, j, at }, k) => {
      this.travelers.push(
        travel(this.partnerSites[k]!, () => front.partners[j]!, partnerStart(j, partnerCount) - 0.06, PARTNER_GLIDE, p.label ?? p.id, () => WHITE, at!.certainty ?? 1),
      )
    })

    scaled = new Group({ members: [map, twin, ...this.travelers], scale: mapScale })
    const anchor = { x: pose.focus.x + pose.dir.x * hover, y: pose.focus.y + pose.dir.y * hover, z: pose.focus.z + pose.dir.z * hover }
    const phi = Math.atan2(pose.dir.x, pose.dir.z)
    const theta = Math.asin(Math.max(-1, Math.min(1, pose.dir.y)))
    this.plane = new Group({ members: [new Group({ members: [scaled], p: -theta })], h: phi, ...anchor })

    this.relations = new MorphCurves(this.links, [twin], {
      observer,
      stroke: 3,
      morph: morphAt,
      opacity: derive(() => (morphAt.value > 0 && morphAt.value < 1 ? 1 : 0)),
    })

    this.add(this.earth)
    this.add(this.eye)
    this.add(this.plane)
    this.add(this.relations)

    // --- the abstract world's presence along the view ----------------------
    const on = derive(() => (a() >= W.morph[1] ? 1 : 0))
    map.rim.follow(on)
    map.presence.follow(on)
    void this.earth.parts
    const ground = derive(() => (a() < W.gone[1] ? 1 : 0))
    this.earth.ball.opacity.follow(ground)
    this.earth.horizon.opacity.follow(ground)
    const bury = (h: Holon) => {
      if (!h.opacity.isBound) h.opacity.follow(ground)
      for (const p of h.parts) bury(p)
    }
    for (const site of [this.hq, ...this.sites]) bury(site)
    const entities: FlowEntity[] = []
    const walk = (h: Holon) => {
      if (h instanceof FlowEntity) return void entities.push(h)
      if (!(h instanceof Text) && !h.creation.isBound) h.creation.follow(on)
      for (const p of h.parts) walk(p)
    }
    walk(map)
    const drawIn = (h: Holon, c: { value: number }) => {
      if (!h.creation.isBound) h.creation.follow(c)
      for (const p of h.parts) drawIn(p, c)
    }
    const seated = new Set<FlowEntity>()
    located.forEach(({ i }, k) => {
      const e = front.sites[i]!
      seated.add(e)
      drawIn(e, derive(() => (a() >= landAt[k]! ? 1 : 0)))
    })
    front.partners.forEach((e, j) => {
      seated.add(e)
      const s = partnerStart(j, partnerCount)
      drawIn(e, derive(() => Math.max(0, Math.min(1, (a() - s) / 0.08))))
    })
    for (const e of entities) if (!seated.has(e)) drawIn(e, on)
  }
}
