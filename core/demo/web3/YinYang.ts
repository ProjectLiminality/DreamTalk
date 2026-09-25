/**
 * YinYang — shots 2 and 3 of the Liminal Consulting Web3 video (4–20s): the
 * THESIS of the whole piece. The film is a yin-yang argument — Web2 centralised
 * against Web3 decentralised — and this is where that argument is STATED, as one
 * image, before anything else happens. It is also the richest single frame in
 * the video.
 *
 * WHAT THE FRAMES SHOW, AND WHERE THEY OVERRULE THE RECON
 *
 * refs/web3/frames/f_00005..f_00020, read directly (the recon rows 2–3 and even
 * the brief that sent me here UNDER-describe this, and one line of the brief is
 * simply wrong — the frames win, so this scene follows the frames):
 *
 *   f_00005 (~5s)   BIRTH. Two globes side by side, faces touching at the
 *                   centre, inside one large thin white circle. NO S-curve yet,
 *                   NO node decoration. The globes are white-continents-on-black
 *                   (Africa/Asia face), not the dark-grey globe of shot 1.
 *   f_00007–f_00011 DIVISION. The big circle holds; an S-CURVE draws in,
 *                   splitting it into the two teardrop lobes. Each lobe gains its
 *                   OWN node, and the two nodes are DIFFERENT constructions:
 *                     • LEFT lobe  — the BLUE node: a blue hexagonal
 *                       flower-of-life lattice ring, a ring of white
 *                       LIGHTNING-BOLT glyphs inside it, and RED curved
 *                       field-lines spiralling outward. Globe at centre. This is
 *                       Web2 / the centralised node.
 *                     • RIGHT lobe — the RED node: a red circle ring, a red
 *                       flower-of-life lattice, and ~14 long thin white
 *                       LIGHT-RAY spikes radiating out, with a bright white glow
 *                       behind the globe. This is Web3 / the spreading-light node.
 *                   In these frames the two nodes are ROUGHLY EQUAL in size, one
 *                   per lobe.
 *   f_00014 (~14s)  a MID-SWAP overlap: the blue node large near centre, the red
 *                   node tiny down in the tail. The brief read ONLY this frame
 *                   and concluded the big node is blue-flower and the small is a
 *                   miniature of the SAME construction. That is not so — it is a
 *                   transient of the swap, and the two nodes are distinct. Noted
 *                   and departed from deliberately.
 *   f_00016 (~16s)  blue node LARGE near centre, red node TINY up in the tail.
 *   f_00018 (~18s)  SWAPPED — red node now LARGE at the top lobe, blue node small
 *                   in the bottom-right tail. The classic yin-yang: a big dot in
 *                   one lobe, a small dot in the other.
 *   f_00020 (~20s)  red node large and high, blue node tiny in the bottom tail;
 *                   the whole figure has counter-rotated a good way round.
 *
 * So shot 3 is a genuine yin-yang in motion: two lobes, a node in each, the
 * nodes counter-rotating AROUND the S-curve centre while trading size (big↔small)
 * — the eternal exchange of the two principles. Web2 and Web3 are not two things
 * but two phases of one turning whole.
 *
 * THE S-CURVE — THE DECISION
 *
 * A yin-yang's divider is not a freehand squiggle: it is two half-circles of
 * radius R/2 stitched at the centre — the top half bulging into the right lobe,
 * the bottom half into the left — so the boundary runs from the top of the big
 * circle, curves through the centre, and reaches the bottom. Built here as a
 * single polyline (`sCurve`) sampled from those two semicircles, drawn on as one
 * stroke. It rotates rigidly with the whole figure (the `orbit` beat), because in
 * the frames the divider and the nodes turn together as one body.
 *
 * THE FIELD-LINES — THE DECISION
 *
 * The blue node's red field-lines (f_00007+) are curved arcs that spiral OUTWARD
 * from the globe, each bowing tangentially rather than running straight radial —
 * the look of a magnetic/dipole field around a centralised source. Built as
 * logarithmic-ish spiral arcs: N arcs evenly in angle, each a short polyline
 * whose radius grows while its angle advances, so they sweep out like the arms of
 * a pinwheel. Pure geometry, a handful of Lines per node.
 *
 * THE SIZE-SWAP WITHOUT A SCALE PARAM
 *
 * The host has no cascading scale. So each node is a Group whose PRIMITIVES'
 * geometry (radii, ray endpoints, spiral points) is a pure function of a per-node
 * `scale()` reading, bound with `.follow()` on the `orbit` source (never
 * `holon.r = 5`, the binding-killing trap). The node's screen POSITION does
 * cascade, so the Group's x/y are bound and the children ride along. The globe
 * inside cannot be scaled the same way (its radius drives derived continent
 * geometry), so it carries its own radius and I rebind `globe.radius` too.
 *
 * SIX TRAPS THE CAMPAIGN ALREADY PAID FOR — honoured here:
 *   1. `new Null()` has creation=1, so a driver Null starts at its END. Every
 *      driver below is `new Null({ creation: 0 })`.
 *   2. A `rgb()` Color is already 0–1; never re-feed blended parts through rgb().
 *   3. Opacity is per-primitive, not inherited by a Group — so every fade is set
 *      on the primitives, and Groups carry only position.
 *   4. `holon.x = 5` replaces the Param and kills bindings — `.value` for a
 *      constant, `.follow()` for a derived reading, everywhere.
 *   5. Anything on the sphere must cull `projectLatLon`'s z < 0 — but the node
 *      decoration here sits in the SCREEN plane around the globe, not ON it, so
 *      that trap does not apply to the rings/rays; the globes handle their own.
 *   6. Frame measurements exclude the demo HUD timecode (bottom-left).
 *
 * ONE PARAM PER BEAT
 *   birth   — the two globes brighten in and the big circle draws on (4–7s).
 *   divide  — the S-curve draws in and both nodes' decoration blooms (7–11s).
 *   orbit   — the whole figure counter-rotates and the nodes swap sizes (11–20s).
 *
 * Every part is a pure function of these three numbers (birth/divide/orbit)
 * through seeded, closed-form geometry — no Math.random, no wall-clock — so the
 * scene scrubs backwards exactly (the LightSpread / NodeNetwork shape).
 */

import { Dream } from "../../src/index"
import { Circle, Group, Line, Null } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { WHITE, RED, BLUE, TAU, rgb, type Color } from "../../src/constants"
import { Globe } from "../../vocabulary/Globe/Globe"

/** The big yin-yang circle's radius — it fills most of the frame height
 *  (f_00005: the outer ring spans ~y0.13→0.87, ~530px of 720, so ~265 at
 *  half-height; in scene units at zoom 1 that is close to this). */
const OUTER_R = 265

/** A lobe centre sits at half the outer radius from the centre, on the axis of
 *  the two semicircles — the yin-yang's two "dots" live here. */
const LOBE_R = OUTER_R / 2

/** The node globe's radius at FULL (large) size and at SMALL size. In
 *  f_00007–f_00011 the two are near-equal (~52px each); by f_00018 the big one
 *  is ~62px and the small ~14px. So the swap runs between these. */
/**
 * Enlarged from 46 after looking: at that size the globes rendered as faint
 * scribbles inside their halos, because a filled continent only READS as land
 * once it is more than a few pixels across. In f_00009 the globe is roughly
 * half the halo's diameter and its continents are unmistakably solid white.
 */
const GLOBE_BIG = 82
const GLOBE_SMALL = 15
/** The shared near-equal size fraction the two globes settle at after birth,
 *  before the orbit swaps them (f_00007–f_00011: two roughly equal nodes). */
const EQUAL = 0.7

/** A node's decoration reach, as a multiple of its globe radius — the flower
 *  ring sits ~2.4× the globe out (f_00009: blue lattice ~125px around a ~52px
 *  globe). */
/**
 * The halo's diameter as a multiple of the globe's. Measured against f_00009,
 * where the globe fills about half the red ring — so ~2, not the 2.45 that
 * left the globe looking lost inside its own decoration.
 */
const HALO_RATIO = 1.75

/** Blue-node lightning glyphs, and red-node light rays. */
const BOLT_COUNT = 8
const RAY_COUNT = 14
/** Blue-node field-line spirals. */
const FIELD_COUNT = 8

/** The blue lattice / lightning / field-line colours, sampled by eye from the
 *  frames. `BLUE` and `RED` are the house palette; the flower rings run a touch
 *  dimmer so the globe reads as the bright centre. */
const BLUE_LATTICE: Color = rgb(0x2f, 0x7f, 0xd6)
const RED_FIELD: Color = rgb(0xc0, 0x38, 0x2f)

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * The yin-yang divider as one polyline: the top semicircle (radius LOBE_R,
 * centred at the top lobe) from the crown of the big circle down to the centre,
 * then the bottom semicircle (centred at the bottom lobe) from the centre to the
 * base. Sampled fine enough to read as a smooth S. Local space, unrotated —
 * `orbit` rotates the whole figure that carries it.
 */
const sCurve = (segments = 48): { x: number; y: number; z: number }[] => {
  const pts: { x: number; y: number; z: number }[] = []
  // Top semicircle: centre (0, +LOBE_R), sweeping the RIGHT half, from the top
  // of the big circle (0, +OUTER_R) down to the centre (0, 0).
  for (let i = 0; i <= segments; i++) {
    const a = (Math.PI / 2) - (i / segments) * Math.PI // +90° → −90°
    pts.push({ x: Math.cos(a) * LOBE_R, y: LOBE_R + Math.sin(a) * LOBE_R, z: 0 })
  }
  // Bottom semicircle: centre (0, −LOBE_R), sweeping the LEFT half, from the
  // centre (0, 0) down to the base (0, −OUTER_R).
  for (let i = 1; i <= segments; i++) {
    const a = (Math.PI / 2) + (i / segments) * Math.PI // +90° → +270°
    pts.push({ x: Math.cos(a) * LOBE_R, y: -LOBE_R + Math.sin(a) * LOBE_R, z: 0 })
  }
  return pts
}

/** A ring of small flower-of-life circle centres at the given radius — a
 *  hexagonal rosette, the flower packing's simplest closed form (a central ring
 *  of six plus the inner overlaps read as the lattice at this scale). Returns
 *  unit-space offsets to be scaled per node. */
const flowerRing = (count: number, radius: number): { x: number; y: number }[] => {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU
    out.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius })
  }
  return out
}

/** A lightning-bolt glyph as a short zig-zag polyline, pointing radially outward
 *  at angle `a`, its base at radius `r0` and tip at `r1`. Local space. */
const bolt = (a: number, r0: number, r1: number): { x: number; y: number; z: number }[] => {
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  // Perpendicular for the zig-zag kinks.
  const px = -sa
  const py = ca
  const span = r1 - r0
  const k = span * 0.28 // kink amplitude
  const at = (t: number, side: number) => ({
    x: ca * (r0 + span * t) + px * side * k,
    y: sa * (r0 + span * t) + py * side * k,
    z: 0,
  })
  return [at(0, 0), at(0.35, +1), at(0.5, -0.4), at(0.65, +1), at(1, 0)]
}

/** One field-line: a spiral arc bowing outward from near the globe. Starts at
 *  angle `a0` and radius `r0`, sweeps `dTheta` while growing to `r1`. */
const fieldLine = (
  a0: number,
  r0: number,
  r1: number,
  dTheta: number,
  segments = 16,
): { x: number; y: number; z: number }[] => {
  const pts: { x: number; y: number; z: number }[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const a = a0 + dTheta * t
    const r = r0 + (r1 - r0) * t
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: 0 })
  }
  return pts
}

/** A light ray: a straight radial line from just outside the globe to well past
 *  the halo, at angle `a`. */
const ray = (a: number, r0: number, r1: number): { x: number; y: number; z: number }[] => [
  { x: Math.cos(a) * r0, y: Math.sin(a) * r0, z: 0 },
  { x: Math.cos(a) * r1, y: Math.sin(a) * r1, z: 0 },
]

export class YinYangDream extends Dream {
  /** Beat 1: the two globes brighten in and the big circle draws on. */
  birth = new Null({ creation: 0 })
  /** Beat 2: the S-curve draws in and both nodes' decoration blooms. */
  divide = new Null({ creation: 0 })
  /** Beat 3: the whole figure counter-rotates and the nodes swap sizes. */
  orbit = new Null({ creation: 0 })

  /** The two globes — one per lobe. Both bright, white land on black, spinning
   *  slowly. The blue node's globe faces Africa/Europe (spin 0); the red node's a
   *  touch turned, so the two are not identical. Their radius is REBOUND below to
   *  the size-swap, so the constructor value is only the starting size. */
  blueGlobe = new Globe({ radius: GLOBE_BIG, continents: "fill", land: WHITE, tilt: 0.12, spin: 0 })
  redGlobe = new Globe({ radius: GLOBE_BIG, continents: "fill", land: WHITE, tilt: 0.12, spin: 0.5 })

  /** The big outer circle — the yin-yang's boundary. Draws on over `birth`. */
  outer = new Circle({ radius: OUTER_R, tint: WHITE, stroke: 2, creation: 0 })

  /** The S-curve divider. Draws on over `divide`. */
  divider!: Line

  blueNode!: Group
  redNode!: Group

  constructor() {
    super()

    // The S-curve, rotated rigidly with the whole figure. Its points are derived
    // from `orbit` (the rotation) and its draw-on rides `divide`. It is staged at
    // the root, so the figure rotation is applied to its points HERE.
    this.divider = new Line({ tint: WHITE, stroke: 1.6 })
    deriveRot(this.divider, this, () => {
      const th = this.turn
      const c = Math.cos(th)
      const s = Math.sin(th)
      return sCurve().map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: 0 }))
    })
    this.divider.creation.follow(this.divide.creation.map((c) => clamp01(c)))

    // The two nodes. Each is a Group carrying its globe + decoration; the whole
    // Group's screen position is bound to its lobe (rotating with `orbit`), and
    // every primitive's geometry is a pure function of that node's `scale`.
    this.blueNode = this.buildBlueNode()
    this.redNode = this.buildRedNode()
  }

  // -- the two lobe readings, pure functions of `orbit` ---------------------

  /** How far round the figure has turned this frame (radians). The frames turn
   *  a bit past a quarter over shot 3; a little over π/2 reads right. */
  private get turn(): number {
    return this.orbit.creation.map((c) => c * (TAU * 0.35)).value
  }

  /** The blue node's lobe centre, screen space: it starts in the LEFT lobe and
   *  rotates around the centre with `turn`. In f_00005–f_00011 it sits left
   *  (angle π); it rotates from there. */
  private blueCentre(): { x: number; y: number } {
    const a = Math.PI + this.turn
    return { x: Math.cos(a) * LOBE_R, y: Math.sin(a) * LOBE_R }
  }

  /** The red node's lobe centre — diametrically opposite the blue one. Starts in
   *  the RIGHT lobe (angle 0) and counter-rotates with the same body. */
  private redCentre(): { x: number; y: number } {
    const a = 0 + this.turn
    return { x: Math.cos(a) * LOBE_R, y: Math.sin(a) * LOBE_R }
  }

  /**
   * The node size fraction is a three-beat blend. At BIRTH the two globes rise
   * to a shared near-equal size (`EQUAL`) — the frames open on two equal globes
   * (f_00005), before any decoration. `divide` holds them equal while the
   * decoration blooms. Then `orbit` swaps them: one eases toward small, the other
   * toward full (f_00018/20 — red big, blue small).
   */
  private blueScale01(): number {
    const b = clamp01(this.birth.creation.value)
    const o = clamp01(this.orbit.creation.value)
    const equal = EQUAL * b
    return equal * (1 - o) + 0 * o
  }

  /** The red node's size fraction — the mirror: rises to equal on birth, then
   *  grows to full (1) across `orbit` as the blue node shrinks. */
  private redScale01(): number {
    const b = clamp01(this.birth.creation.value)
    const o = clamp01(this.orbit.creation.value)
    const equal = EQUAL * b
    return equal * (1 - o) + 1 * o
  }

  /** Map a 0→1 size fraction to a globe radius. */
  private globeR(frac: number): number {
    return GLOBE_SMALL + (GLOBE_BIG - GLOBE_SMALL) * frac
  }

  // -- node construction ----------------------------------------------------

  /**
   * The BLUE / Web2 node: globe, blue flower-of-life lattice ring, a ring of
   * white lightning bolts, and red field-line spirals. Every primitive's
   * geometry follows `blueScale01`; the Group position follows `blueCentre`.
   */
  private buildBlueNode(): Group {
    const orbitSrc = this.orbit.creation
    const scale = () => this.blueScale01()
    const gr = () => this.globeR(scale())

    // The globe rides the node's size, and its land floods in on `birth` (Globe
    // has no single opacity — it composes its own strokes — so `landOpacity` is
    // the fade-in of the continents).
    this.blueGlobe.radius.follow(orbitSrc.map(() => gr()))
    this.blueGlobe.landOpacity.follow(this.birth.creation.map((b) => clamp01(b)))

    const members: (Circle | Line)[] = []

    // Flower-of-life lattice: overlapping circles in a hex rosette. A central
    // ring of six plus one at centre, each drawn as a thin blue circle whose
    // radius and offset ride the node scale.
    const latticeUnit = flowerRing(6, 1) // unit offsets
    for (let i = 0; i < latticeUnit.length; i++) {
      const u = latticeUnit[i]!
      const c = new Circle({ tint: BLUE_LATTICE, stroke: 1, opacity: 0 })
      c.radius.follow(orbitSrc.map(() => gr() * HALO_RATIO * 0.5))
      c.x.follow(orbitSrc.map(() => u.x * gr() * HALO_RATIO * 0.5))
      c.y.follow(orbitSrc.map(() => u.y * gr() * HALO_RATIO * 0.5))
      c.opacity.follow(this.divide.creation.map((d) => clamp01(d) * 0.85))
      members.push(c)
    }
    // Central lattice circle.
    {
      const c = new Circle({ tint: BLUE_LATTICE, stroke: 1, opacity: 0 })
      c.radius.follow(orbitSrc.map(() => gr() * HALO_RATIO * 0.5))
      c.opacity.follow(this.divide.creation.map((d) => clamp01(d) * 0.85))
      members.push(c)
    }
    // The bounding blue ring.
    {
      const ring = new Circle({ tint: BLUE, stroke: 2.4, opacity: 0 })
      ring.radius.follow(orbitSrc.map(() => gr() * HALO_RATIO))
      ring.opacity.follow(this.divide.creation.map((d) => clamp01(d)))
      members.push(ring)
    }

    // Lightning bolts, a ring of them between the globe and the flower.
    for (let i = 0; i < BOLT_COUNT; i++) {
      const a = (i / BOLT_COUNT) * TAU + Math.PI / BOLT_COUNT
      const line = new Line({ tint: WHITE, stroke: 1.6, opacity: 0 })
      deriveRot(line, this, () => bolt(a, gr() * 1.15, gr() * HALO_RATIO * 0.78))
      line.opacity.follow(this.divide.creation.map((d) => clamp01((d - 0.3) / 0.7)))
      members.push(line)
    }

    // Red field-line spirals sweeping outward past the flower.
    for (let i = 0; i < FIELD_COUNT; i++) {
      const a0 = (i / FIELD_COUNT) * TAU
      const line = new Line({ tint: RED_FIELD, stroke: 1.4, opacity: 0 })
      deriveRot(line, this, () =>
        fieldLine(a0, gr() * HALO_RATIO * 0.9, gr() * HALO_RATIO * 1.6, TAU * 0.16),
      )
      line.opacity.follow(this.divide.creation.map((d) => clamp01((d - 0.2) / 0.8) * 0.8))
      members.push(line)
    }

    const group = new Group({ members: [this.blueGlobe, ...members] })
    group.x.follow(orbitSrc.map(() => this.blueCentre().x))
    group.y.follow(orbitSrc.map(() => this.blueCentre().y))
    return group
  }

  /**
   * The RED / Web3 node: globe with a bright glow, red flower-of-life lattice, a
   * bold red ring, and long white light rays. Same binding pattern; follows
   * `redScale01` and `redCentre`.
   */
  private buildRedNode(): Group {
    const orbitSrc = this.orbit.creation
    const scale = () => this.redScale01()
    const gr = () => this.globeR(scale())

    this.redGlobe.radius.follow(orbitSrc.map(() => gr()))
    this.redGlobe.landOpacity.follow(this.birth.creation.map((b) => clamp01(b)))

    // The white bloom around the red node.
    //
    // A filled disc behind the globe was the obvious construction and it was
    // wrong: the globe's ocean is not opaque, so the disc showed THROUGH the
    // sphere as a flat grey wash over the continents rather than as light
    // around it. Drawn instead as a few concentric rings of falling opacity —
    // a halo that surrounds the globe without ever being behind it, which is
    // what the frames actually show (the land stays bright white, the bloom
    // sits outside the limb).
    const glowRings: Circle[] = []
    for (let i = 0; i < 4; i++) {
      const spread = 1.04 + i * 0.1
      const ring = new Circle({ tint: WHITE, stroke: 3 - i * 0.5, opacity: 0 })
      ring.radius.follow(orbitSrc.map(() => gr() * spread))
      ring.opacity.follow(this.divide.creation.map((d) => clamp01(d) * (0.4 - i * 0.08)))
      glowRings.push(ring)
    }

    const members: (Circle | Line)[] = []

    // Red flower-of-life lattice.
    const latticeUnit = flowerRing(6, 1)
    for (const u of latticeUnit) {
      const c = new Circle({ tint: RED_FIELD, stroke: 1, opacity: 0 })
      c.radius.follow(orbitSrc.map(() => gr() * HALO_RATIO * 0.5))
      c.x.follow(orbitSrc.map(() => u.x * gr() * HALO_RATIO * 0.5))
      c.y.follow(orbitSrc.map(() => u.y * gr() * HALO_RATIO * 0.5))
      c.opacity.follow(this.divide.creation.map((d) => clamp01(d) * 0.7))
      members.push(c)
    }
    {
      const c = new Circle({ tint: RED_FIELD, stroke: 1, opacity: 0 })
      c.radius.follow(orbitSrc.map(() => gr() * HALO_RATIO * 0.5))
      c.opacity.follow(this.divide.creation.map((d) => clamp01(d) * 0.7))
      members.push(c)
    }

    // The bold red ring.
    {
      const ring = new Circle({ tint: RED, stroke: 3, opacity: 0 })
      ring.radius.follow(orbitSrc.map(() => gr() * HALO_RATIO))
      ring.opacity.follow(this.divide.creation.map((d) => clamp01(d)))
      members.push(ring)
    }

    // Long white light rays.
    for (let i = 0; i < RAY_COUNT; i++) {
      const a = (i / RAY_COUNT) * TAU
      const line = new Line({ tint: WHITE, stroke: 1, opacity: 0 })
      deriveRot(line, this, () => ray(a, gr() * 1.1, gr() * HALO_RATIO * 1.45))
      line.opacity.follow(this.divide.creation.map((d) => clamp01((d - 0.2) / 0.8) * 0.85))
      members.push(line)
    }

    // Glow first (behind), then the globe, then the decoration on top.
    const group = new Group({ members: [...glowRings, this.redGlobe, ...members] })
    group.x.follow(orbitSrc.map(() => this.redCentre().x))
    group.y.follow(orbitSrc.map(() => this.redCentre().y))
    return group
  }

  /** The live rotation of the whole figure — the S-curve reads this. */
  get turnValue(): number {
    return this.turn
  }

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))

    // Draw order: the S-curve and outer ring under the nodes; the two globes
    // slowly turning throughout.
    this.stage(this.outer)
    this.stage(this.divider)
    this.stage(this.blueNode)
    this.stage(this.redNode)

    // Beat 1 — BIRTH: two globes brighten in, the big circle draws on (4–7s).
    this.say("Two worlds, one circle.")
    this.play(
      together(
        this.birth.creation.to(1),
        this.outer.creation.to(1, { easing: "linear" }),
        this.blueGlobe.spin.to(TAU * 0.08, { easing: "linear" }),
        this.redGlobe.spin.to(0.5 + TAU * 0.08, { easing: "linear" }),
      ),
      3,
    )

    // Beat 2 — DIVISION: the S-curve draws in, both nodes' decoration blooms
    // (7–11s). The two nodes settle near-equal, one per lobe.
    this.say("The line between them — centralised, and decentralised.")
    this.play(
      together(
        this.divide.creation.to(1, { easing: "linear" }),
        this.blueGlobe.spin.to(TAU * 0.16, { easing: "linear" }),
        this.redGlobe.spin.to(0.5 + TAU * 0.16, { easing: "linear" }),
      ),
      4,
    )
    this.wait(0.5)

    // Beat 3 — ORBIT: the whole figure counter-rotates and the nodes swap sizes
    // (11–20s) — the eternal exchange of the two principles.
    this.say("And they turn, each becoming the other.", { hold: true })
    this.play(
      together(
        this.orbit.creation.to(1, { easing: "smooth" }),
        this.blueGlobe.spin.to(TAU * 0.32, { easing: "linear" }),
        this.redGlobe.spin.to(0.5 + TAU * 0.32, { easing: "linear" }),
      ),
      6,
    )
    this.wait(1)
  }
}

/**
 * Give a Line derived `points` recomputed whenever the figure's rotation (the
 * `orbit`/`divide` readings the node geometry depends on) changes, bumping
 * `geomVersion` so the host regenerates the ribbon — the LightSpread/Globe memo
 * pattern, written the same way deliberately. Keyed on the live `turn` value AND
 * the two scale-driving beats, so a size-swap or a rotation both re-emit.
 */
const deriveRot = (
  line: Line,
  dream: YinYangDream,
  compute: () => { x: number; y: number; z: number }[],
): void => {
  let key: readonly number[] | undefined
  let memo: { x: number; y: number; z: number }[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get() {
      const d = dream as unknown as {
        turnValue: number
        birth: Null
        divide: Null
        orbit: Null
      }
      const next = [
        d.turnValue,
        d.birth.creation.value,
        d.divide.creation.value,
        d.orbit.creation.value,
      ]
      if (!key || next.some((v, i) => v !== key![i])) {
        key = next
        memo = compute()
        line.geomVersion++
      }
      return memo
    },
    set(_v) {},
  })
}
