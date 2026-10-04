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
 * THE SPIN AND THE EXCHANGE, MEASURED (2026-10-04)
 *
 * Read off the final render at 30fps, 10–21.5s, by fitting a circle to each
 * node's ring in every frame (the 1fps frames above cannot see this — the
 * figure turns ~40° between quarter-seconds):
 *
 *  - The figure turns FOUR AND A FIFTH times (1515°), counter-clockwise, from
 *    11.0 to 21.5 — one C4D ease-in whose left tangent is 0.18 of that span,
 *    leaving at full speed (~170°/s) straight into the dive. RMS 5° over 300
 *    frames.
 *  - The lobes are not fixed halves. Each node sits at the centre of its own
 *    lobe — a circle inside the big one, the two tangent to each other — and
 *    the blue lobe's share of the diameter is 0.5 + 0.375·sin(turn/4): blue
 *    swells to 0.875 at the first full turn (14.4s), the two are equal at the
 *    second (16.7s), red holds 0.875 at the third (19.0s). Within 0.01.
 *  - Each node's ring is 0.56 of its lobe's radius, at every size — the node
 *    IS its lobe's dot, scaled with it.
 *
 * THE S-CURVE — THE DECISION
 *
 * A yin-yang's divider is not a freehand squiggle: it is the two lobes' own
 * half-circles stitched where they touch — from the blue lobe's rim point,
 * under the blue node, to the tangent point, then over the red node to the red
 * rim point. At an equal split that is the classic two R/2 semicircles; as the
 * split moves the S leans with it. One polyline (`sCurve`), drawn on as one
 * stroke, rotating rigidly with the nodes — in the frames they are one body.
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
 * geometry (radii, ray endpoints, spiral points) is a pure function of its
 * lobe's share, bound with `.follow()` on the `orbit` source (never
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
 *   orbit   — the whole figure spins and the lobes trade sizes (11–21.5s).
 *
 * Every part is a pure function of these three numbers (birth/divide/orbit)
 * through seeded, closed-form geometry — no Math.random, no wall-clock — so the
 * scene scrubs backwards exactly (the LightSpread / NodeNetwork shape).
 */

import { Dream } from "../../src/index"
import { Circle, Group, Line, Null, Stroke } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { WHITE, TAU, rgb, type Color } from "../../src/constants"
import { hexPack } from "../../src/geometry/flower"
import { c4dEaseWith } from "../../src/timeline"
import { Globe } from "../../vocabulary/Globe/Globe"

/** The big yin-yang circle's radius — it fills most of the frame height
 *  (f_00005: the outer ring spans ~y0.13→0.87, ~530px of 720, so ~265 at
 *  half-height; in scene units at zoom 1 that is close to this). */
const OUTER_R = 265

/** The whole spin (see THE SPIN AND THE EXCHANGE): 1515°, on a C4D ease-in
 *  with a 0.18 left tangent, leaving at full speed. */
const ORBIT_TURN = TAU * (1515 / 360)
const SPIN_EASE = 0.18

/** How far the blue lobe's share swings from half: 0.5 ± 0.375. */
const SWAP = 0.375

/**
 * The two nodes, measured at full resolution (14.4s blue at its largest,
 * 19.0s red at its largest; ring radii fitted per frame 10–21.5s):
 *
 *   ring / lobe radius   blue 0.547   red 0.577   — at every size
 *   globe / ring         blue 0.46    red 0.415
 *
 * The red node is the hero's construction (Shot15Hero) at its own scale: a
 * black-sea globe sitting IN a white bloom, a flower of life of circles a
 * third of the ring, twelve rays to 1.25× the ring (the axes) and 1.17×
 * (the rest). The blue node's lattice is not circles but a triangular grid
 * of straight lines, four to a family, 0.42 of the ring apart, laid only in
 * the band between the globe and the ring.
 */
const BLUE_RING_PER_LOBE = 0.547
const RED_RING_PER_LOBE = 0.577
const BLUE_GLOBE_OF_RING = 0.46
const RED_GLOBE_OF_RING = 0.415
/** The globes' size before birth has brought them in. */
const GLOBE_SMALL = 15

/** Blue-node lightning glyphs, red-node light rays, blue field-line spirals. */
const BOLT_COUNT = 8
const RAY_COUNT = 12
const FIELD_COUNT = 8
/** The blue grid's line spacing, as a fraction of the ring's radius. */
const GRID_SPACING = 0.42
/** Concentric rings make the red bloom; enough that they read as one glow
 *  (Shot15Hero's recipe). */
const BLOOM_RINGS = 18

/**
 * A colour as the frames SHOW it. The host treats a tint as linear light and
 * encodes it for the screen (0x14 0x95 0xee drew as 79 201 247), so a
 * sampled screen colour is handed over decoded, and lands as sampled.
 */
const seen = (r: number, g: number, b: number): Color => {
  const decode = (v: number) => {
    const c = v / 255
    return 255 * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  }
  return rgb(decode(r), decode(g), decode(b))
}

/** Colours sampled from the full-resolution frames (14.4s, 19.0s). */
const BLUE_RING = seen(2, 148, 246)
const BLUE_LATTICE = seen(40, 120, 190)
const RED_FIELD = seen(212, 76, 60)
const RED_RING = seen(250, 86, 65)
const LATTICE_RED = seen(150, 60, 52)

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * The yin-yang divider as one polyline, for a blue-lobe share `split`: the
 * blue lobe (radius split·R, centred on −x) from its rim point under the blue
 * node to where the lobes touch, then the red lobe (the rest, centred on +x)
 * over the red node to its rim point. Local space, unrotated — `orbit`
 * rotates the whole figure that carries it.
 */
const sCurve = (split: number, segments = 48): { x: number; y: number; z: number }[] => {
  const pts: { x: number; y: number; z: number }[] = []
  const rb = split * OUTER_R
  const rr = OUTER_R - rb
  // Blue lobe's lower half: centre (−rr, 0), from (−R, 0) round the bottom.
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI + (i / segments) * Math.PI // 180° → 360°
    pts.push({ x: -rr + Math.cos(a) * rb, y: Math.sin(a) * rb, z: 0 })
  }
  // Red lobe's upper half: centre (rb, 0), from the touch point over the top.
  for (let i = 1; i <= segments; i++) {
    const a = Math.PI - (i / segments) * Math.PI // 180° → 0°
    pts.push({ x: rb + Math.cos(a) * rr, y: Math.sin(a) * rr, z: 0 })
  }
  return pts
}

/** The red flower of life: circle centres hex-packed inside a unit ring,
 *  each circle a third of the ring (Shot15Hero's lattice). Unit space. */
const LATTICE_UNIT = 1 / 3
const FLOWER_UNIT = hexPack(
  [Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * TAU
    return { x: Math.cos(a) * (1 - LATTICE_UNIT * 0.9), y: Math.sin(a) * (1 - LATTICE_UNIT * 0.9) }
  })],
  { spacing: LATTICE_UNIT },
)

/**
 * One grid line's two pieces inside the band r0 < |p| < r1: the line runs
 * along angle `phi`, offset `c` from the centre. A line that clears the
 * inner circle is split at its middle so every line is two pieces.
 */
const gridPieces = (
  phi: number,
  c: number,
  r0: number,
  r1: number,
): [{ x: number; y: number; z: number }[], { x: number; y: number; z: number }[]] => {
  const dx = Math.cos(phi)
  const dy = Math.sin(phi)
  const at = (s: number) => ({ x: -dy * c + dx * s, y: dx * c + dy * s, z: 0 })
  const so = Math.sqrt(Math.max(r1 * r1 - c * c, 0))
  const si = Math.abs(c) < r0 ? Math.sqrt(r0 * r0 - c * c) : 0
  return [
    [at(-so), at(-si)],
    [at(si), at(so)],
  ]
}

/**
 * The lightning-bolt glyph, traced off the 14.4s frame at full resolution
 * (the top bolt): a FILLED ⚡ — a thick slanted stroke,
 * a jog back across, a thinner stroke down to an arrowhead. Stated as
 * [inward, lateral] in units of its length, from the middle of its wide end;
 * the tip points at the globe. Every bolt is this one, turned.
 */
const BOLT_OUTLINE: readonly (readonly [number, number])[] = [
  [0, -0.091], [0, 0.091], [0.364, -0.055], [0.309, 0.164], [0.509, 0.109],
  [0.836, 0.055], [0.873, 0.091], [1, -0.018], [0.873, -0.073], [0.836, -0.036],
  [0.564, 0], [0.6, -0.236],
]
/** Where the bolts sit: wide end at 0.78 of the ring's radius, 0.24 long
 *  (antialiased edge included — the traced mask's hard threshold reads ~12%
 *  short, and the first render showed it). */
const BOLT_OUTER = 0.78
const BOLT_LENGTH = 0.24

/** A bolt's closed outline at angle `a`, for a ring of radius `ring`. */
const bolt = (a: number, ring: number): { x: number; y: number; z: number }[] => {
  const dx = -Math.cos(a) // inward
  const dy = -Math.sin(a)
  const L = ring * BOLT_LENGTH
  const ox = Math.cos(a) * ring * BOLT_OUTER
  const oy = Math.sin(a) * ring * BOLT_OUTER
  const pts = BOLT_OUTLINE.map(([u, v]) => ({
    x: ox + dx * u * L - dy * v * L,
    y: oy + dy * u * L + dx * v * L,
    z: 0,
  }))
  return [...pts, pts[0]!]
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
  blueGlobe = new Globe({
    radius: GLOBE_SMALL,
    continents: "fill",
    land: WHITE,
    oceanTint: rgb(0, 0, 0),
    tilt: 0.12,
    spin: 0,
  })
  redGlobe = new Globe({
    radius: GLOBE_SMALL,
    continents: "fill",
    land: WHITE,
    oceanTint: rgb(0, 0, 0),
    tilt: 0.12,
    spin: 0.5,
  })

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
      return sCurve(this.split()).map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: 0 }))
    })
    this.divider.creation.follow(this.divide.creation.map((c) => clamp01(c)))

    // The two nodes. Each is a Group carrying its globe + decoration; the whole
    // Group's screen position is bound to its lobe (rotating with `orbit`), and
    // every primitive's geometry is a pure function of that node's `scale`.
    this.blueNode = this.buildBlueNode()
    this.redNode = this.buildRedNode()
  }

  // -- the two lobe readings, pure functions of `orbit` ---------------------

  /** How far round the figure has turned this frame (radians): `orbit` is the
   *  spin's linear progress, read through its measured ease-in. */
  private get turn(): number {
    return ORBIT_TURN * c4dEaseWith(clamp01(this.orbit.creation.value), SPIN_EASE, 0)
  }

  /** The blue lobe's share of the diameter — half until the spin begins, then
   *  swelling and shrinking once per four turns. The red lobe has the rest. */
  private split(): number {
    return 0.5 + SWAP * Math.sin(this.turn / 4)
  }

  /** The blue node's lobe centre, screen space: it starts LEFT (angle π) and
   *  rides the turn, as far from the centre as the red lobe is wide. */
  private blueCentre(): { x: number; y: number } {
    const a = Math.PI + this.turn
    const d = (1 - this.split()) * OUTER_R
    return { x: Math.cos(a) * d, y: Math.sin(a) * d }
  }

  /** The red node's lobe centre — across the centre from the blue one, as far
   *  out as the blue lobe is wide. Starts RIGHT (angle 0). */
  private redCentre(): { x: number; y: number } {
    const a = this.turn
    const d = this.split() * OUTER_R
    return { x: Math.cos(a) * d, y: Math.sin(a) * d }
  }

  /** The blue and red lobes' shares (the two sum to 1). */
  private blueScale01(): number {
    return this.split()
  }

  private redScale01(): number {
    return 1 - this.split()
  }

  /** A node's ring radius for a lobe share: the lobe's dot, scaled with it,
   *  rising in from a small globe over `birth` (the frames open on two equal
   *  globes, f_00005). */
  private ringR(share: number, perLobe: number, globeOfRing: number): number {
    const full = share * OUTER_R * perLobe
    const small = GLOBE_SMALL / globeOfRing
    return small + (full - small) * clamp01(this.birth.creation.value)
  }

  // -- node construction ----------------------------------------------------

  /**
   * The BLUE / Web2 node: a black-sea globe, a triangular grid in the band
   * around it, the blue ring, a ring of white lightning bolts, and red
   * field-line spirals. Every primitive's geometry follows the blue lobe's
   * share; the Group position follows `blueCentre`.
   */
  private buildBlueNode(): Group {
    const orbitSrc = this.orbit.creation
    const ring = () => this.ringR(this.blueScale01(), BLUE_RING_PER_LOBE, BLUE_GLOBE_OF_RING)
    const gr = () => ring() * BLUE_GLOBE_OF_RING

    // The globe rides the node's size; its land and black sea come in on
    // `birth` (Globe has no single opacity — it composes its own strokes).
    this.blueGlobe.radius.follow(orbitSrc.map(() => gr()))
    this.blueGlobe.landOpacity.follow(this.birth.creation.map((b) => clamp01(b)))
    this.blueGlobe.oceanOpacity.follow(this.birth.creation.map((b) => clamp01(b)))

    const members: Stroke[] = []

    // The grid: three families of four lines, 60° apart, only in the band.
    for (let f = 0; f < 3; f++) {
      const phi = (f * Math.PI) / 3
      for (let k = 0; k < 4; k++) {
        const c = (k - 1.5) * GRID_SPACING
        for (const piece of [0, 1] as const) {
          const line = new Line({ tint: BLUE_LATTICE, stroke: 1, opacity: 0 })
          deriveRot(line, this, () => gridPieces(phi, c * ring(), gr(), ring())[piece])
          line.opacity.follow(this.divide.creation.map((d) => clamp01(d) * 0.85))
          members.push(line)
        }
      }
    }
    // The bounding blue ring.
    {
      const c = new Circle({ tint: BLUE_RING, stroke: 2.4, opacity: 0 })
      c.radius.follow(orbitSrc.map(() => ring()))
      c.opacity.follow(this.divide.creation.map((d) => clamp01(d)))
      members.push(c)
    }

    // Lightning bolts in the band, one on each axis and diagonal. Each is
    // a DRAWING — a Stroke whose one child is the closed outline — because
    // that is the wash the host fills properly for a concave shape (SMark's
    // band); the outline itself is never inked.
    for (let i = 0; i < BOLT_COUNT; i++) {
      const a = (i / BOLT_COUNT) * TAU
      const glyph = new Stroke({ tint: WHITE, stroke: 0, fillOpacity: 0 })
      glyph.fillOpacity.follow(this.divide.creation.map((d) => clamp01((d - 0.3) / 0.7)))
      const outline = new Line({ tint: WHITE, stroke: 0, opacity: 0 })
      deriveRot(outline, this, () => bolt(a, ring()))
      ;(glyph as unknown as { add(h: Line): Line }).add(outline)
      members.push(glyph)
    }

    // Red field-line spirals sweeping outward past the ring.
    for (let i = 0; i < FIELD_COUNT; i++) {
      const a0 = (i / FIELD_COUNT) * TAU
      const line = new Line({ tint: RED_FIELD, stroke: 1.4, opacity: 0 })
      deriveRot(line, this, () => fieldLine(a0, ring() * 0.9, ring() * 1.6, TAU * 0.16))
      line.opacity.follow(this.divide.creation.map((d) => clamp01((d - 0.2) / 0.8) * 0.8))
      members.push(line)
    }

    const group = new Group({ members: [this.blueGlobe, ...members] })
    group.x.follow(orbitSrc.map(() => this.blueCentre().x))
    group.y.follow(orbitSrc.map(() => this.blueCentre().y))
    return group
  }

  /**
   * The RED / Web3 node — the hero's construction at the lobe's scale: a
   * black-sea globe IN a white bloom, a red flower of life, the red ring,
   * twelve white rays. Follows the red lobe's share and `redCentre`.
   */
  private buildRedNode(): Group {
    const orbitSrc = this.orbit.creation
    const ring = () => this.ringR(this.redScale01(), RED_RING_PER_LOBE, RED_GLOBE_OF_RING)
    const gr = () => ring() * RED_GLOBE_OF_RING

    this.redGlobe.radius.follow(orbitSrc.map(() => gr()))
    this.redGlobe.landOpacity.follow(this.birth.creation.map((b) => clamp01(b)))
    this.redGlobe.oceanOpacity.follow(this.birth.creation.map((b) => clamp01(b)))

    // The bloom: concentric rings of falling opacity from the limb out, not
    // a filled disc — the globe's black sea is drawn over its inner edge.
    // Spaced a touch wider than the hero's: its whiteness at 0.5/0.6/0.7/0.8
    // of the ring reads 146/92/25/0 against the frame's 150/80/27/0.
    const bloom: Circle[] = []
    for (let i = 0; i < BLOOM_RINGS; i++) {
      const c = new Circle({ tint: WHITE, stroke: 4, opacity: 0 })
      c.radius.follow(orbitSrc.map(() => gr() * (1.02 + i * 0.045)))
      const level = 0.5 * (1 - i / BLOOM_RINGS) ** 2.2
      c.opacity.follow(this.divide.creation.map((d) => clamp01(d) * level))
      bloom.push(c)
    }

    // The flower of life inside the ring.
    const lattice: Circle[] = []
    for (const u of FLOWER_UNIT) {
      const c = new Circle({ tint: LATTICE_RED, stroke: 1.1, opacity: 0 })
      c.radius.follow(orbitSrc.map(() => ring() * LATTICE_UNIT))
      c.x.follow(orbitSrc.map(() => u.x * ring()))
      c.y.follow(orbitSrc.map(() => u.y * ring()))
      c.opacity.follow(this.divide.creation.map((d) => clamp01(d) * 0.55))
      lattice.push(c)
    }

    // Twelve rays from the limb, the four on the axes reaching further.
    const rays: Line[] = []
    for (let i = 0; i < RAY_COUNT; i++) {
      const a = (i / RAY_COUNT) * TAU
      const reach = i % 3 === 0 ? 1.25 : 1.17
      const line = new Line({ tint: WHITE, stroke: 1.2, opacity: 0 })
      deriveRot(line, this, () => ray(a, gr() * 1.1, ring() * reach))
      line.opacity.follow(this.divide.creation.map((d) => clamp01((d - 0.2) / 0.8) * 0.85))
      rays.push(line)
    }

    // The red ring, on top.
    const redRing = new Circle({ tint: RED_RING, stroke: 3, opacity: 0 })
    redRing.radius.follow(orbitSrc.map(() => ring()))
    redRing.opacity.follow(this.divide.creation.map((d) => clamp01(d)))

    // Bloom behind, then the lattice, rays, globe and ring (Shot15Hero's order).
    const group = new Group({ members: [...bloom, ...lattice, ...rays, this.redGlobe, redRing] })
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
    // 0.82, not 1: measured against f_00009 the big circle's radius is
    // ~280px at 1280w, and at zoom 1 OUTER_R draws it at ~340px. The whole
    // figure was built at one consistent scale, so the camera corrects it.
    this.set(this.observer.zoom.to(0.82))

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
    // (7–11s). The two nodes settle equal, one per lobe.
    this.say("The line between them — centralised, and decentralised.")
    this.play(
      together(
        this.divide.creation.to(1, { easing: "linear" }),
        this.blueGlobe.spin.to(TAU * 0.16, { easing: "linear" }),
        this.redGlobe.spin.to(0.5 + TAU * 0.16, { easing: "linear" }),
      ),
      4,
    )

    // Beat 3 — ORBIT: the figure spins up and the lobes trade sizes
    // (11–21.5s) — the eternal exchange of the two principles. Linear
    // progress; the spin's ease lives in `turn`. It is still at full speed
    // when the film dives into it. The line is spoken OVER the spin, not
    // before it: the film's turn begins at 11.0 on the dot.
    this.say("And they turn, each becoming the other.")
    this.play(
      together(
        this.orbit.creation.to(1, { easing: "linear" }),
        this.blueGlobe.spin.to(TAU * 0.32, { easing: "linear" }),
        this.redGlobe.spin.to(0.5 + TAU * 0.32, { easing: "linear" }),
      ),
      10.5,
    )
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
