/**
 * LightSpread — shot 13 of the Liminal Consulting Web3 video (106–116s): the
 * outline globe rotates, a hotspot lights one region, the land floods solid
 * white, and an arc-network sprouts off the surface and wraps the sphere. The
 * payoff of the decentralised argument — insight lighting up and travelling
 * the world.
 *
 * WHAT THE FRAMES SHOW, AND WHERE THEY SHARPEN THE RECON
 *
 * refs/web3/frames/f_00106..f_00116, read directly:
 *   f_00106–f_00108  a bare OUTLINE globe (white coastlines), Asia face, no
 *                    hotspot, no arcs. The land is not filled.
 *   f_00110          rotated to the Europe/Africa/Middle-East face; the land is
 *                    FLOODING SOLID WHITE from a bright radial HOTSPOT with
 *                    concentric ripple rings, sitting over the eastern
 *                    Mediterranean / Middle East.
 *   f_00112          Africa/Europe essentially solid white, the hotspot bloom
 *                    fading, the FIRST short arc-stubs lifting off the limb.
 *   f_00114          many thin white arcs now bow OUT from the surface, arching
 *                    well past the silhouette and looping around the sphere.
 *   f_00116          a dense arc network fully wrapping the globe — dozens of
 *                    long arcs bowing outward all around, an orbiting-band look.
 *
 * The recon (shot 13 row) is right in one line — "a glowing hotspot lights one
 * region and spreads across an arc-network wrapping the globe … globe fills
 * solid white". The frames add three things it compresses, and this scene
 * follows the FRAMES: (1) the globe visibly TRANSITIONS outline → solid-filled
 * DURING the shot, so this is not one static mode but a flood; (2) the hotspot
 * is a radial bloom with concentric ripple rings over one region, and it is
 * where the fill STARTS; (3) the arcs are not flat screen curves confined to
 * the disc — they leave the surface and bow outward in 3D, extending past the
 * limb, so they must be raised sphere arcs projected, not screen arcs.
 *
 * ARC GEOMETRY: RAISED GREAT-CIRCLE ARCS, NOT SCREEN CURVES — the decision.
 *
 * In f_00114/116 the arcs clearly arch ABOVE the sphere and reach beyond its
 * silhouette; a flat screen curve pinned to the disc could never do that. So an
 * arc is the great-circle path between two surface points, LIFTED off the
 * surface (radius 1 at the endpoints, bulging to `lift` at the apex) — the
 * Earth's own `greatCircleArc`, the curve its Connections draw. The arcs live
 * IN the Earth's frame (it adopts them as `places`), so they turn with it and
 * its horizon hides whatever passes behind it, per pixel; a loop lifted past
 * the limb stays seen.
 *
 * ONE EARTH (2026-10-13; it was two flat Globes, a fill under an outline)
 *
 * The Earth draws its coastlines over its land, so one sphere does both: the
 * coasts drawn throughout, `landOpacity` the flood, and the LIGHT on the land
 * (`lightTheLand`) spreading from the hotspot. It is set on the page
 * (Recede), so the hotspot's flat rings draw over it.
 *
 * ONE PARAM PER BEAT
 *
 *   spin    — the Earth's turn (`earth.h`), throughout (Asia → Africa/Europe).
 *   ignite  — the hotspot blooms and the land floods solid from it (108–112).
 *   spread  — the arc-network sprouts off the surface and wraps the globe
 *             (112–116). Each arc appears over its own slice, so the network
 *             wires up progressively rather than all at once.
 *
 * Every part is a pure function of these numbers (earth.h/ignite/spread), through
 * seeded hashes for the arc endpoints — no Math.random, no wall-clock — so the
 * scene scrubs backwards exactly (the FourierTrace `turn` / NodeNetwork shape).
 */


import { Dream } from "../../src/index"
import { Circle, Group, Line, Null } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { hashUnit } from "../../src/geometry/flower"
import { WHITE, rgb } from "../../src/constants"
import { rotHPB } from "../../src/parts/curves"
import { Recede } from "../../src/parts/recede"
import { Earth } from "../../vocabulary/Earth/Earth"
import { greatCircleArc } from "../../vocabulary/Earth/Connection"
import { clamp01 } from "../../src/math"

/** The globe's drawn size and lean — matched to GlobeDemo's outline globe so
 *  the sphere reads the same as the rest of the campaign. */
/** Re-measured (2026-10-04): the globe's limb is 124px at 640w, ~3% under
 *  the 200 it was drawn at. */
const GLOBE_R = 194
const TILT = 0.12

/** Where the shot starts and ends its rotation. 0 faces the prime meridian
 *  (Africa/Europe); the frames open on the Asia face and turn TO Africa/Europe
 *  as the hotspot fires, so we start east of the meridian and turn back to it. */
/**
 * Re-measured side by side at 1s steps (2026-10-04, second pass): China at
 * 108s, India at 110, Arabia at 112, the Sahara at 113, West Africa at 115,
 * the Atlantic at 116–117 — a steady ~14.5°/s over the 12s play 106–118.
 * (Stated against our own renders of the same faces, so any projection
 * offset is already folded in.)
 */
export const SPIN_START = -2.51
export const SPIN_END = 0.52

/**
 * The hotspot's location, in lon/lat degrees — the eastern Mediterranean /
 * Middle East, where f_00110's bloom sits and where the fill begins. It rides
 * the globe, so it is given in world coordinates and projected each frame with
 * the same spin as the land, keeping it pinned to its region as the sphere
 * turns. Roughly the Levant.
 */
/** Re-measured: the light first shows at the LEFT limb (110.5s) and is over
 *  North Africa by 112 — the Sahara, west of the Levant the 1fps frames
 *  suggested. */
const HOTSPOT_LON = 10
const HOTSPOT_LAT = 20

/** How many arcs wrap the globe by the end. The frames show dozens; this reads
 *  as the same dense band while staying well under the instancing threshold. */
const ARC_COUNT = 40
/** Deterministic seed for the arcs' endpoints — the same network every render. */
const SEED = 0x1197123

/** Points sampled along each arc's polyline. Enough for a smooth bow. */
const ARC_SEGMENTS = 40
/** The apex bulge: an arc's midpoint sits this many times the globe radius out
 *  from centre, so the arc arches clearly above the surface and past the limb
 *  as the frames show (endpoints sit on the surface, radius 1). */
/**
 * MEASURED, correcting an eyeballed 1.42. In f_00114 the total ink bbox
 * (508×522) is the SAME extent as the globe itself — ratio 1.00: the
 * reference's arcs hug the sphere and NEVER exceed its silhouette. At 1.42
 * they ballooned past the limb and buried the globe in a ball of wire; even
 * 1.06 measured 1.74× the land's span, because an arc lifted anywhere bows
 * furthest exactly at the limb, where it has the most room to escape.
 * 1.015 is barely off the surface — enough that an arc reads as passing in
 * FRONT of the land (which is what sells three dimensions) without leaving
 * the disc.
 */
/**
 * RE-MEASURED AGAIN (2026-10-04, the whole shot at 2fps): the ink's extent
 * is 1.00× the globe only as the first arcs start (113s); by 115s and on it
 * is ~1.19× — the arcs loop out past the limb like orbits. What ballooned
 * before was arcs drawn through the BACK of the sphere; that is now handled
 * by occlusion (below), so the lift can be the frames' own.
 */
const ARC_LIFT = 1.2

/** Hotspot ripple-ring count and their reach, in globe radii. */
const RIPPLE_RINGS = 4
const RIPPLE_REACH = 0.62

/** One arc's two endpoints, seeded and deterministic. One end near the hotspot
 *  region (the light originates there), the other anywhere on the globe — so the
 *  network reads as insight fanning out FROM the lit region across the world. */
const arcEndpoints = (i: number): { aLon: number; aLat: number; bLon: number; bLat: number } => {
  // Origin: jittered around the hotspot, so the arcs spring from the lit region.
  const aLon = HOTSPOT_LON + (hashUnit(i, 0, SEED) - 0.5) * 70
  const aLat = HOTSPOT_LAT + (hashUnit(i, 1, SEED) - 0.5) * 60
  // Destination: anywhere, uniform on the sphere (lon uniform, lat by acos so
  // it does not bunch at the poles).
  const bLon = -180 + hashUnit(i, 2, SEED) * 360
  const bLat = (Math.acos(2 * hashUnit(i, 3, SEED) - 1) * 180) / Math.PI - 90
  return { aLon, aLat, bLon, bLat }
}

export class LightSpreadDream extends Dream {
  /** The hotspot blooms and the land is lit from it. */
  ignite = new Null({ creation: 0 })
  /** The arc-network sprouts and wraps the sphere. */
  spread = new Null({ creation: 0 })

  arcs = new Group({
    members: Array.from({ length: ARC_COUNT }, (_, i) => {
      const ep = arcEndpoints(i)
      // A constant lift of (ARC_LIFT − 1)·R at the apex: greatCircleArc's
      // rise is per radian of reach, so divide the reach back out.
      const a = { lat: ep.aLat, lon: ep.aLon }
      const b = { lat: ep.bLat, lon: ep.bLon }
      const reach = Math.max(1e-6, angleBetween(a, b))
      return new Line({
        points: greatCircleArc(a, b, GLOBE_R, (ARC_LIFT - 1) / reach, 0, ARC_SEGMENTS),
        tint: WHITE,
        stroke: 1.3,
      })
    }),
  })

  /**
   * The Earth: white coastlines drawn throughout, its land lit and flooded
   * as `ignite` runs; the arcs ride it.
   */
  earth = new Earth({
    radius: GLOBE_R,
    land: WHITE,
    landOpacity: 0,
    coastStroke: 2.5,
    borderOpacity: 0,
    limbStroke: 1,
    limbTint: rgb(0x44, 0x44, 0x44),
    p: TILT,
    h: SPIN_START,
    places: [this.arcs],
  })
  globe = new Recede({ members: [this.earth], reach: GLOBE_R })

  hotspot!: Group

  constructor() {
    super()

    // --- the hotspot: a bright core disc + concentric ripple rings ---------
    // Flat on the page, standing where the hotspot's place on the turning
    // Earth shows. Opacity rides `ignite` up, then eases back as the light
    // takes over (the frames' bloom fades once the land is solid).
    const spin = this.earth.h
    const hotAt = () => {
      const local = this.earth.latLonToLocal(HOTSPOT_LAT, HOTSPOT_LON)
      return this.globe.toPage(rotHPB(local, this.earth.p.value, spin.value, 0))
    }

    const core = new Circle({ radius: GLOBE_R * 0.16, tint: WHITE, stroke: 0, fillOpacity: 1 })
    core.x.follow(spin.map(() => hotAt().x))
    core.y.follow(spin.map(() => hotAt().y))
    core.opacity.follow(this.ignite.creation.map((g) => this.bloom(g)))

    const rings: Circle[] = []
    for (let r = 0; r < RIPPLE_RINGS; r++) {
      const frac = (r + 1) / RIPPLE_RINGS
      const ring = new Circle({ radius: GLOBE_R * RIPPLE_REACH * frac, tint: WHITE, stroke: 1.6 })
      ring.x.follow(spin.map(() => hotAt().x))
      ring.y.follow(spin.map(() => hotAt().y))
      // Outer rings appear later and fainter — a ripple expanding outward.
      ring.opacity.follow(
        this.ignite.creation.map((g) => this.bloom(g) * clamp01((g - frac * 0.35) / 0.3) * 0.7),
      )
      rings.push(ring)
    }
    this.hotspot = new Group({ members: [...rings, core] })

    this.lightTheLand()

    // --- the arc-network ---------------------------------------------------
    // Each arc draws on over its own slice of the `spread` beat, so the
    // network wires up progressively — origin-region arcs first — and
    // nothing is drawn before its turn.
    const n = ARC_COUNT
    this.arcs.members.forEach((line, i) => {
      line.creation.follow(this.spread.creation.map((c) => clamp01((c - i / n) / (2 / n))))
      line.opacity.follow(this.spread.creation.map((c) => clamp01(c * 3)))
    })
  }

  /**
   * THE LIGHT ACROSS THE LAND (re-measured 2026-10-04 at full resolution).
   * The land does not flood grey → white: a white light spreads OUT OF the
   * hotspot, the land white at its heart and falling through grey to dark
   * across a ~180px band beyond its front (screen 252 → 208 → 176 → 143 →
   * 102 at 30px steps, 112.5–114s). The front stands ~30px out at 110.5 and
   * travels ~47px/s; by ~115 the whole face is white.
   *
   * The Earth's land light stands ON the hotspot's place, so it turns with
   * the land. Its time is "seconds since ignition": 2s of `ignite` (the
   * song's 110.5–112.5), then 5.5s of `spread`.
   */
  private lightTheLand(): void {
    const since = () => 2 * clamp01(this.ignite.creation.value) + 5.5 * clamp01(this.spread.creation.value)
    this.earth.lightLat.value = HOTSPOT_LAT
    this.earth.lightLon.value = HOTSPOT_LON
    // The front P (px), and the light half-strength at ~1.5 P (P + 60 at
    // 112.5s, a small spot at 111): smoothstep(0, R) halves at 0.54 R.
    this.earth.lightReach.follow(
      this.ignite.creation.map(() => (1.48 * (30 + 47 * since())) / 0.54 / 1.28),
    )
    // The light holds its falloff until the face is lit, then lets go
    // (114 → 115: the far side whitens).
    this.earth.lightFalloff.follow(this.ignite.creation.map(() => 1 - clamp01((since() - 3.5) / 1)))
  }

  /** The hotspot bloom envelope: rises with ignite, eases back as the fill
   *  takes over (peaks around the middle of the ignite beat). */
  private bloom(g: number): number {
    const up = clamp01(g / 0.4)
    const down = 1 - clamp01((g - 0.55) / 0.45)
    return up * down
  }

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.globe.seenFrom(this.observer)

    this.stage(this.globe)
    this.stage(this.hotspot)

    // Beat 1 — the globe turns from Asia toward Africa/Europe (106–110).
    this.say("The world turns.")
    this.play(this.earth.h.to(SPIN_START + (SPIN_END - SPIN_START) * 0.45, { easing: "linear" }), 4)

    // Beat 2 — a hotspot lights one region and the land floods solid (110–112).
    this.say("A single insight lights up — and floods the world.")
    this.play(
      together(
        this.ignite.creation.to(1),
        this.earth.landOpacity.to(1),
        this.earth.h.to(SPIN_START + (SPIN_END - SPIN_START) * 0.7, { easing: "linear" }),
      ),
      3,
    )

    // Beat 3 — arcs sprout off the surface and wrap the globe (112–116).
    this.say("And it travels the world, connection by connection.", { hold: true })
    this.play(
      together(
        this.spread.creation.to(1, { easing: "linear" }),
        this.earth.h.to(SPIN_END, { easing: "linear" }),
      ),
      4,
    )
    this.wait(1)
  }
}

/** The angle between two lat/lon points on the sphere, radians. */
const angleBetween = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number => {
  const D = Math.PI / 180
  const c =
    Math.sin(a.lat * D) * Math.sin(b.lat * D) +
    Math.cos(a.lat * D) * Math.cos(b.lat * D) * Math.cos((a.lon - b.lon) * D)
  return Math.acos(Math.max(-1, Math.min(1, c)))
}
