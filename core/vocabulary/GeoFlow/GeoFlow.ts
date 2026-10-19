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
import { eyeDistance, toLocal, toWorld } from "../../src/geometry/frames"
import { Circle, Group, Null } from "../../src/parts/primitives"
import { rgb, WHITE, type Color } from "../../src/constants"
import { completion, derive, length, paramEpoch, scalar, type Param, type ParamValue } from "../../src/params"
import { together } from "../../src/anim"
import { axis, type StateSpace } from "../../src/automaton"
import { certainty, presence } from "../../src/certainty"
import { BALL_INSET, Earth, Place } from "../Earth/Earth"
import { EarthView, followEarth, viewPose, zoomForSpan } from "../Earth/EarthView"
import { Factory } from "../Earth/Factory"
import { Headquarters } from "../Earth/Headquarters"
import { Connection } from "../Earth/Connection"
import { FlowEntity, FlowMap, MOCK_FLOWMAP, type FlowMapData } from "../FlowMap/FlowMap"
import { MorphCurves } from "../Morph/MorphCurves"
import { MOCK_GEO } from "./mockGeo"

/**
 * A reading that is the same until some param is written: computed once
 * per paramEpoch. For pose maths read many times a frame (every stroke's
 * camera read reaches the observer's zoom; every traveler reads x and y).
 */
const perEpoch = <T>(f: () => T): (() => T) => {
  let seen = Number.NaN
  let v: T
  return () => {
    const e = paramEpoch()
    if (e !== seen) {
      v = f()
      seen = e
    }
    return v
  }
}

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

/** The view windows (module header) — exported so a song can time its own beats against them. */
export const GEOFLOW_WINDOWS = { pull: [0, 0.27], morph: [0.18, 0.6], dim: [0.12, 0.6], sink: [0.24, 0.57], gone: [0.6, 0.88], partners: [0.74, 0.95] } as const
const W = GEOFLOW_WINDOWS
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
  /** Exactly 0 outside its flight, so the host lets it sleep there. */
  presence = presence(1)
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

  /**
   * Extra params the `v` axis also walks: [param, value at the globe, value
   * at the abstract map] — a song's own abstract-world pieces (a lens) come
   * and go with the view. Construction-time.
   */
  viewExtras: [Param<ParamValue>, ParamValue, ParamValue][] = []

  /**
   * A song's own abstract-world pieces, built once GeoFlow is composed (they
   * may read `geo.map`): returned holons join the plane beside the map, in
   * map-local units. The same as calling `inPlane` for each. Construction-time.
   */
  planeMembers: ((geo: GeoFlow) => Holon[]) | undefined = undefined

  /**
   * Options for the FlowMap GeoFlow builds, merged over its own defaults
   * (`{ roads: true, particleMax: 0.09 }`, …). Construction-time.
   */
  mapOptions: Overrides | undefined = undefined

  /**
   * Stagger the rise: the headquarters over the first 30% of `rise`, the
   * sites over the rest, spread by this fraction (0 = all together, as one).
   * Construction-time.
   */
  stagger = 0
  /** Stagger the relation arcs over `relate` by this fraction (0 = all together). Construction-time. */
  relateStagger = 0

  /**
   * The lens to OPEN at: if set, the observer's field of view flies from
   * this to `fov` as `descent` goes 0 → regionZoom() — a wider whole Earth
   * narrowing onto the region. Unset: `fov` throughout. Construction-time.
   */
  openFov: number | undefined = undefined

  /**
   * Hand the camera to an ORTHOGRAPHIC projection once the planet has gone
   * (view ≥ the end of its `gone` window), framed to match: the ortho
   * half-height is the perspective half-height at the plane. The flat map
   * faces the eye on its axis, so the switch is invisible; walking back,
   * the camera returns to perspective. For maps whose stage stack and
   * particles are meant for a parallel view. Construction-time.
   */
  ortho = false

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
    const base = axis("view", this, { globe: { view: 0 }, abstract: { view: 1 } }, { key: "v", duration: 6.6 })
    const extras = this.viewExtras.filter(([p]) => !p.isBound)
    if (extras.length === 0) return { axes: [base] }
    // One axis over several holons' params: the view, and the song's extras.
    const positions = base.positions.map((pos, i) => ({
      name: pos.name,
      values: new Map([...pos.values, ...extras.map(([p, g, ab]): [Param<ParamValue>, ParamValue] => [p, i === 0 ? g : ab])]),
    }))
    return {
      axes: [
        {
          ...base,
          positions,
          to: (name: string) => together(...[...positions.find((p) => p.name === name)!.values].map(([p, v]) => p.to(v))),
          params: () => [...positions[0]!.values.keys()],
        },
      ],
    }
  }

  /** The abstract plane's own group (map-local units: the FlowMap's frame). */
  private scaledGroup?: Group

  /**
   * Put a holon into the abstract plane, beside the map, in the map's own
   * units — a lens on a flow, a mark round a seat. Call after composition
   * (`void geo.parts`); the holon then rides the plane wherever the eye is.
   */
  inPlane<T extends Holon>(h: T): T {
    void this.parts
    return this.scaledGroup!.attach(h)
  }

  /**
   * The eye's distance to the abstract plane in MAP units — a constant,
   * because the plane is scaled every frame to keep the group circle at
   * `fill` of the half-frame: MAP_R / (tan(fov/2) · fill · breadth).
   */
  eyeDistance(): number {
    return MAP_R / (Math.tan(this.fov / 2) * this.fill.value * this.breadth.value)
  }

  /**
   * The observer's orthographic zoom that matches the perspective framing at
   * the plane (dream.ts orthoHalfHeight = 1023 / (2 · zoom · aspect)).
   */
  orthoZoom(): number {
    void this.parts
    return this.orthoZoomNow()
  }
  private orthoZoomNow = perEpoch(() => {
    // The eye's distance from the view's own pose, never through the
    // observer (whose zoom this very number drives in ortho).
    const d = viewPose(this.earth, this.eye, this.fov).distance
    const H = Math.max(1e-6, d - this.hoverDistance) * Math.tan(this.fov / 2)
    return 1023 / (2 * H * (16 / 9))
  })

  /** How far the abstract plane hovers from the focus (set at composition). */
  private hoverDistance = 0

  /** A member's or partner's seat in the group circle (front slice), by id. */
  seat(id: string): FlowEntity {
    void this.parts
    const front = this.map.slices[0]!
    const m = this.data.members.findIndex((x) => x.id === id)
    if (m >= 0) return front.sites[m]!
    const p = (this.data.partners ?? []).findIndex((x) => x.id === id)
    if (p >= 0) return front.partners[p]!
    throw new Error(`GeoFlow: no member or partner '${id}'`)
  }

  protected override compose(): void {
    const observer = this.seenBy?.()
    if (!observer) throw new Error("GeoFlow: give it the scene's observer (seenBy: () => this.observer)")
    // Hot readings capture their params once: a derived reading runs every
    // frame, and a read through the holon proxy costs more than the param.
    const viewParam = this.view
    const descentParam = this.descent
    const landInParam = this.landIn
    const a = () => viewParam.value
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
      ...this.mapOptions,
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
    const riseParam = this.rise
    /** Site k's own share of `rise` (k = -1: the headquarters). */
    const riseOf = (k: number): (() => number) => {
      const s = this.stagger
      if (!(s > 0)) return () => riseParam.value
      if (k < 0) return () => Math.max(0, Math.min(1, riseParam.value / 0.3))
      const f = n <= 1 ? 0 : k / (n - 1)
      const lo = 0.3 + 0.7 * f * s
      const hi = lo + 0.7 * (1 - s)
      return () => Math.max(0, Math.min(1, (riseParam.value - lo) / Math.max(1e-6, hi - lo)))
    }
    const altitude = (height: number, a0: number, k: number) => {
      const risen = riseOf(k)
      return derive(() => sunkBy(height) * (1 - risen() * (1 - ss(a0, a0 + (W.sink[1] - W.sink[0]) * 0.5, a()))))
    }

    const hqSize = this.siteSize.value * 1.2
    this.hq = new Site({
      lat: geo.group.lat,
      lon: geo.group.lon,
      certainty: geo.group.certainty ?? 1,
      altitude: altitude(Headquarters.heightFor(hqSize), sinkStart(0), -1),
      members: [new Headquarters({ tint: WHITE, size: hqSize })],
    })
    this.sites = located.map(
      ({ m, at }, k) =>
        new Site({
          lat: at!.lat,
          lon: at!.lon,
          certainty: at!.certainty ?? 1,
          altitude: altitude(Factory.heightFor(this.siteSize.value), sinkStart(k), k),
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
    const relateParam = this.relate
    const rs = this.relateStagger
    this.links = this.sites.map(
      (site, k) =>
        new Connection({
          ends: [site, this.hq],
          stroke: 1.4,
          creation:
            rs > 0
              ? derive(() => {
                  const lo = (n <= 1 ? 0 : k / (n - 1)) * rs
                  return Math.max(0, Math.min(1, (relateParam.value - lo) / Math.max(1e-6, 1 - rs)))
                })
              : relateParam,
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
      landOpacity: derive(() => landInParam.value * fade(0.35)),
      coastOpacity: derive(() => fade(0.35)),
      borderOpacity: derive(() => fade(0.25)),
      limbOpacity: derive(() => fade(1)),
      places: [this.hq, ...this.sites, ...this.partnerSites, ...this.links, ...this.traffics],
    })
    this.eye = new EarthView({
      lat: geo.region.lat,
      lon: geo.region.lon,
      tilt: this.tilt,
      zoom: derive(() => descentParam.value - 1.1 * ss(W.pull[0], W.pull[1], a())),
    })
    const openFov = this.openFov
    if (openFov !== undefined) {
      const target = this.fov
      const zoomEnd = this.regionZoom()
      observer.fov.follow(
        derive(() => openFov + (target - openFov) * Math.max(0, Math.min(1, descentParam.value / Math.max(1e-6, zoomEnd)))),
      )
    } else {
      observer.fov.defaultValue = this.fov
      observer.fov.value = this.fov
    }
    followEarth(observer, this.earth, this.eye, { detail: 2 })

    // --- the abstract plane: hovering over the region, facing the eye -----
    const pose = (() => {
      const v = new EarthView({ lat: geo.region.lat, lon: geo.region.lon, tilt: this.tilt })
      v.zoom.value = this.regionZoom()
      return viewPose(this.earth, v, this.fov)
    })()
    const hover = HOVER_K * pose.distance
    this.hoverDistance = hover
    if (this.ortho) {
      // Past the planet's going, the camera turns parallel, framed to match
      // the perspective at the plane (orthoZoom); back below, perspective.
      const flat = () => a() >= W.gone[1]
      observer.orthographic.follow(derive(flat))
      observer.zoom.follow(derive(() => (flat() ? this.orthoZoom() : 1)))
    }
    const mapScale = derive(
      perEpoch(() => {
        const d = Math.max(1, eyeDistance(observer) - hover)
        return (d * Math.tan(observer.fov.value / 2) * this.fill.value * this.breadth.value) / MAP_R
      }),
    )
    const twin = new Circle({ radius: MAP_R, stroke: 3, opacity: 0 })
    void map.parts
    const front = map.slices[0]!

    /** Where a place is SEEN on the plane (map-local): the eye's ray through it, met with the plane. */
    let scaled: Group | undefined
    const onPlane = (place: Place): { x: number; y: number } => {
      const P = toWorld(place, { x: 0, y: 0, z: 0 })
      const { focus: F, dir } = pose
      const dist = eyeDistance(observer)
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
      const from = perEpoch(() => onPlane(site))
      const at = perEpoch(() => {
        const k = u()
        const f = from()
        const e = seat()
        return { x: f.x + (e.x.value - f.x) * k, y: f.y + (e.y.value - f.y) * k }
      })
      const shown = derive(() => (flying() ? ss(start, t0, a()) : 0))
      const ink = derive(tint)
      return new Traveler({
        certainty: derive(() => sure + (1 - sure) * u()),
        presence: derive(() => (flying() ? 1 : 0)),
        x: derive(() => at().x),
        y: derive(() => at().y),
        members: [
          new Circle({ radius: derive(() => seat().ring.radius.value), stroke: 2.5, tint: ink, opacity: shown }),
          new Text({
            content: label,
            size: derive(() => seat().ring.radius.value * 0.7),
            tint: ink,
            y: derive(() => -seat().ring.radius.value * 0.25),
            opacity: shown,
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
    this.scaledGroup = scaled
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

    for (const h of this.planeMembers?.(this) ?? []) scaled.attach(h)
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
    // Gone, the planet is absent as a whole (exactly 0): its subtree sleeps.
    this.earth.presence.follow(ground)
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
