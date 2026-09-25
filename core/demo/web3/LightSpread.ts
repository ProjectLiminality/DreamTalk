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
 * surface (radius 1 at the endpoints, bulging to `lift` at the apex), then spun
 * and tilted by the SAME projection the globe uses (`projectLatLon`, reused
 * from src/geometry/globe.ts) and orthographically projected. Reusing the
 * globe's own projection is what keeps the arcs locked to the turning sphere
 * rather than sliding independently.
 *
 * The slerp-and-lift itself lives HERE, in the scene, not in the Globe holon —
 * the campaign map and the Globe header both put the hotspot and arcs demo-side
 * as decoration (folding them in would make the globe "three things wearing one
 * name", the recon's own warning). It reuses `projectLatLon`; it does not touch
 * the holon.
 *
 * WHY TWO GLOBES
 *
 * `Globe.continents` is a CONSTRUCTION choice, not an animated one (the holon's
 * header: "To cross-fade the two, run two Globes"). The frames need exactly
 * that cross-fade — coastlines throughout, land flooding solid — so this scene
 * stacks a FILL globe (its `landOpacity` floods 0 → 1, the "fill spreads") under
 * an OUTLINE globe (coastlines always drawn), both sharing one spin via
 * `.follow()` so they turn as one sphere.
 *
 * ONE PARAM PER BEAT
 *
 *   spin    — the globe's rotation, turning throughout (Asia → Africa/Europe).
 *   ignite  — the hotspot blooms and the land floods solid from it (108–112).
 *   spread  — the arc-network sprouts off the surface and wraps the globe
 *             (112–116). Each arc appears over its own slice, so the network
 *             wires up progressively rather than all at once.
 *
 * Every part is a pure function of these numbers (spin/ignite/spread), through
 * seeded hashes for the arc endpoints — no Math.random, no wall-clock — so the
 * scene scrubs backwards exactly (the FourierTrace `turn` / NodeNetwork shape).
 */

import { Dream } from "../../src/index"
import { Circle, Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { hashUnit } from "../../src/geometry/flower"
import { projectLatLon } from "../../src/geometry/globe"
import { WHITE, TAU, rgb } from "../../src/constants"
import { Globe } from "../../vocabulary/Globe/Globe"

/** The globe's drawn size and lean — matched to GlobeDemo's outline globe so
 *  the sphere reads the same as the rest of the campaign. */
const GLOBE_R = 200
const TILT = 0.12

/** Where the shot starts and ends its rotation. 0 faces the prime meridian
 *  (Africa/Europe); the frames open on the Asia face and turn TO Africa/Europe
 *  as the hotspot fires, so we start east of the meridian and turn back to it. */
const SPIN_START = -1.15
const SPIN_END = 0.15

/**
 * The hotspot's location, in lon/lat degrees — the eastern Mediterranean /
 * Middle East, where f_00110's bloom sits and where the fill begins. It rides
 * the globe, so it is given in world coordinates and projected each frame with
 * the same spin as the land, keeping it pinned to its region as the sphere
 * turns. Roughly the Levant.
 */
const HOTSPOT_LON = 36
const HOTSPOT_LAT = 33

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
const ARC_LIFT = 1.015

/** Hotspot ripple-ring count and their reach, in globe radii. */
const RIPPLE_RINGS = 4
const RIPPLE_REACH = 0.62

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** A unit-sphere vector for a lon/lat in degrees (pre-spin, pre-tilt). */
const unitVec = (lonDeg: number, latDeg: number): [number, number, number] => {
  const lon = (lonDeg * Math.PI) / 180
  const lat = (latDeg * Math.PI) / 180
  const cosLat = Math.cos(lat)
  return [cosLat * Math.sin(lon), Math.sin(lat), cosLat * Math.cos(lon)]
}

/** Convert a unit-sphere vector back to lon/lat degrees, so a slerped point can
 *  be handed to the globe's own `projectLatLon` (spin + tilt + ortho) and the
 *  arc's radius applied as a scale on the returned screen point. */
const toLatLon = (v: [number, number, number]): { lon: number; lat: number } => {
  const [x, y, z] = v
  const lat = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI
  const lon = (Math.atan2(x, z) * 180) / Math.PI
  return { lon, lat }
}

/**
 * A raised great-circle arc between two lon/lat endpoints, spun and tilted like
 * the globe, orthographically projected to screen points. The path is the slerp
 * of the two unit vectors; each sampled point's distance from centre is scaled
 * from 1 (endpoints) up to `ARC_LIFT` (apex) by a sine bulge, so the arc bows
 * off the surface. Reuses `projectLatLon` for the spin/tilt/ortho so the arc
 * stays locked to the turning sphere.
 */
const raisedArc = (
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number,
  spin: number,
): Vec3Like[] => {
  const a = unitVec(aLon, aLat)
  const b = unitVec(bLon, bLat)
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  dot = Math.max(-1, Math.min(1, dot))
  const omega = Math.acos(dot)
  const sinOmega = Math.sin(omega)
  const pts: Vec3Like[] = []
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const t = i / ARC_SEGMENTS
    // Slerp a → b along the great circle (falls back to lerp when antipodal-safe).
    let vx: number, vy: number, vz: number
    if (sinOmega < 1e-6) {
      vx = a[0] + (b[0] - a[0]) * t
      vy = a[1] + (b[1] - a[1]) * t
      vz = a[2] + (b[2] - a[2]) * t
    } else {
      const s0 = Math.sin((1 - t) * omega) / sinOmega
      const s1 = Math.sin(t * omega) / sinOmega
      vx = a[0] * s0 + b[0] * s1
      vy = a[1] * s0 + b[1] * s1
      vz = a[2] * s0 + b[2] * s1
    }
    // Lift off the surface: 1 at the ends, ARC_LIFT at the apex.
    const bulge = 1 + (ARC_LIFT - 1) * Math.sin(t * Math.PI)
    const { lon, lat } = toLatLon([vx, vy, vz])
    const p = projectLatLon(lon, lat, GLOBE_R * bulge, spin, TILT)
    // NEAR FACE ONLY. projectLatLon returns the camera-facing z and this
    // scene was discarding it, so back-hemisphere points projected onto the
    // near side: arcs raked across the whole disc and bulged far past the
    // limb (measured 1.75x the globe's span, where the reference is 1.00).
    // Globe's own outline mode drops the far half for exactly this reason.
    // A break in the polyline is the honest rendering of an arc going behind
    // the sphere — the eye reads the gap as occlusion, which is what it is.
    if (p.z < 0) {
      if (pts.length > 1) break
      pts.length = 0
      continue
    }
    pts.push({ x: p.x, y: p.y, z: 0 })
  }
  return pts
}

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
  /**
   * `spin` drives BOTH globes (the outline follows it) and every arc. It is a
   * plain scalar animated across the take, not a Null — the two globes carry
   * their own `spin` params and the arcs read this one.
   */
  spin = new Null({ creation: 0 })
  /** The hotspot blooms and the land floods solid from it. */
  ignite = new Null({ creation: 0 })
  /** The arc-network sprouts and wraps the sphere. */
  spread = new Null({ creation: 0 })

  /**
   * FILL globe underneath: coastlines off (land reads as fill), its land
   * flooding solid white as `ignite` runs. `landOpacity` is the flood.
   */
  fill = new Globe({
    radius: GLOBE_R,
    continents: "fill",
    land: WHITE,
    tilt: TILT,
    spin: SPIN_START,
    landOpacity: 0,
  })

  /**
   * OUTLINE globe on top: white coastlines, drawn throughout (present in every
   * frame of the shot). Shares the fill globe's rotation via `.follow()` so the
   * two are one sphere.
   */
  outline = new Globe({
    radius: GLOBE_R,
    continents: "outline",
    land: WHITE,
    coastStroke: 2.5,
    limbStroke: 1,
    limbTint: rgb(0x44, 0x44, 0x44),
    tilt: TILT,
    spin: SPIN_START,
  })

  hotspot!: Group
  arcs!: Group

  private root = new Null()

  constructor() {
    super()

    // --- the hotspot: a bright core disc + concentric ripple rings ---------
    // All ride the globe: their centre is the hotspot lon/lat projected with
    // the live spin, so the bloom stays pinned to its region as the sphere
    // turns. Opacity rides `ignite` up, then eases back as the fill takes over
    // (the frames' bloom fades once the land is solid).
    const hotAt = (): { x: number; y: number; front: number } => {
      const p = projectLatLon(HOTSPOT_LON, HOTSPOT_LAT, GLOBE_R, this.spinValue, TILT)
      return { x: p.x, y: p.y, front: p.z >= 0 ? 1 : 0 }
    }

    const core = new Circle({ radius: GLOBE_R * 0.16, tint: WHITE, stroke: 0, fillOpacity: 1 })
    bindTo(core, this, () => {
      const h = hotAt()
      return { x: h.x, y: h.y }
    })
    core.opacity.follow(this.ignite.creation.map((g) => this.bloom(g)))

    const rings: Circle[] = []
    for (let r = 0; r < RIPPLE_RINGS; r++) {
      const frac = (r + 1) / RIPPLE_RINGS
      const ring = new Circle({ radius: GLOBE_R * RIPPLE_REACH * frac, tint: WHITE, stroke: 1.6 })
      bindTo(ring, this, () => {
        const h = hotAt()
        return { x: h.x, y: h.y }
      })
      // Outer rings appear later and fainter — a ripple expanding outward.
      ring.opacity.follow(
        this.ignite.creation.map((g) => this.bloom(g) * clamp01((g - frac * 0.35) / 0.3) * 0.7),
      )
      rings.push(ring)
    }
    this.hotspot = new Group({ members: [...rings, core] })

    // --- the arc-network ---------------------------------------------------
    // One Line per arc, its `points` DERIVED from `spin` (so it turns with the
    // sphere) and its `creation` windowed by index over the `spread` beat, so
    // arcs sprout progressively — origin-region arcs first — rather than all at
    // once. Opacity also rides `spread` so nothing is drawn before its turn.
    const n = ARC_COUNT
    const lines: Line[] = []
    for (let i = 0; i < n; i++) {
      const ep = arcEndpoints(i)
      const line = new Line({ tint: WHITE, stroke: 1.3 })
      deriveArc(line, this, () => raisedArc(ep.aLon, ep.aLat, ep.bLon, ep.bLat, this.spinValue))
      // Each arc draws on over its own slice of the spread beat.
      line.creation.follow(this.spread.creation.map((c) => clamp01((c - i / n) / (2 / n))))
      line.opacity.follow(this.spread.creation.map((c) => clamp01(c * 3)))
      lines.push(line)
    }
    this.arcs = new Group({ members: lines })
  }

  /** The live spin value both globes and the arcs read. */
  private get spinValue(): number {
    return this.spin.creation.map((c) => SPIN_START + (SPIN_END - SPIN_START) * c).value
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

    // The outline globe shares the fill globe's rotation — one sphere.
    this.outline.spin.follow(this.fill.spin.map((s) => s))

    this.stage(this.root)
    this.stage(this.fill)
    this.stage(this.outline)
    this.stage(this.hotspot)
    this.stage(this.arcs)

    // Beat 1 — the globe turns from Asia toward Africa/Europe (106–110).
    this.say("The world turns.")
    this.play(
      together(
        this.spin.creation.to(0.45, { easing: "linear" }),
        this.fill.spin.to(SPIN_START + (SPIN_END - SPIN_START) * 0.45, { easing: "linear" }),
      ),
      4,
    )

    // Beat 2 — a hotspot lights one region and the land floods solid (110–112).
    this.say("A single insight lights up — and floods the world.")
    this.play(
      together(
        this.ignite.creation.to(1),
        this.fill.landOpacity.to(1),
        this.spin.creation.to(0.7, { easing: "linear" }),
        this.fill.spin.to(SPIN_START + (SPIN_END - SPIN_START) * 0.7, { easing: "linear" }),
      ),
      3,
    )

    // Beat 3 — arcs sprout off the surface and wrap the globe (112–116).
    this.say("And it travels the world, connection by connection.", { hold: true })
    this.play(
      together(
        this.spread.creation.to(1, { easing: "linear" }),
        this.spin.creation.to(1, { easing: "linear" }),
        this.fill.spin.to(SPIN_END, { easing: "linear" }),
      ),
      4,
    )
    this.wait(1)
  }
}

/**
 * Bind a Circle's screen position (x, y) to a derived reading recomputed when
 * the Globe's spin changes — for the hotspot core and ripple rings, which ride
 * the turning sphere. Uses `.follow()` on the position params so the binding is
 * live and never replaced by a number (the `holon.x = 5` trap).
 */
const bindTo = (
  circle: Circle,
  dream: LightSpreadDream,
  compute: () => { x: number; y: number },
): void => {
  const spinSrc = (dream as unknown as { spin: Null }).spin.creation
  circle.x.follow(spinSrc.map(() => compute().x))
  circle.y.follow(spinSrc.map(() => compute().y))
}

/**
 * Give a Line derived `points` recomputed whenever the scene's spin changes,
 * bumping `geomVersion` so the host regenerates the ribbon — the same memo
 * pattern Globe's `deriveRing` and FourierTrace use, written the same way
 * deliberately. Keyed on the live spin value.
 */
const deriveArc = (line: Line, dream: LightSpreadDream, compute: () => Vec3Like[]): void => {
  let key: number | undefined
  let memo: Vec3Like[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get() {
      const next = (dream as unknown as { spinValue: number }).spinValue
      if (key === undefined || next !== key) {
        key = next
        memo = compute()
        line.geomVersion++
      }
      return memo
    },
    set(_v) {},
  })
}
