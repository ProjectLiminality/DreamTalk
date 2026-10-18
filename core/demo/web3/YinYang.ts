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
 *   birth   — shot 1's globe divides in two and the halves draw apart into
 *             their lobes while the circle widens (4.0–6.05; THE BIRTH).
 *   divide  — the S-curve draws in and both nodes' decoration blooms
 *             (5.75–7.0); the figure then holds until the spin.
 *   orbit   — the whole figure spins and the lobes trade sizes (11–21.5s).
 *
 * Every part is a pure function of these three numbers (birth/divide/orbit)
 * through seeded, closed-form geometry — no Math.random, no wall-clock — so the
 * scene scrubs backwards exactly (the LightSpread / NodeNetwork shape).
 */

import { Dream } from "../../src/index"
import { Circle, Group, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { WHITE, TAU, seen, type Color } from "../../src/constants"
import { c4dEaseWith } from "../../src/timeline"
import { DreamTalkSymbol } from "../../vocabulary/DreamTalkSymbol/DreamTalkSymbol"
import { clamp01 } from "../../src/math"
import { FragmentedEarth } from "../../vocabulary/FragmentedEarth/FragmentedEarth"

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
const RED_GLOBE_OF_RING = 0.415
/**
 * THE BIRTH, measured at 30fps (2026-10-04). The film's yin-yang does not
 * draw on: shot 1's globe SHRINKS and divides into the two, and the outer
 * circle is its limb, pushed outward as the globe draws in. In pixels at
 * 1280w, against song time (this chapter opens at 4.0):
 *
 *   globe radius   258.5 → 35, 3.0 → 5.95, C4D tangents 0.35 / 0.35
 *   separation     0 → the lobe centres, 3.35 → 6.05, tangents 0.2 / 0.4
 *   outer circle   259 → 280, 3.0 → 6.0, smooth
 *
 * `birth` is this chapter's share of that (4.0 → 6.05), read through the
 * three curves; at 0 the two globes lie one on the other at the size shot
 * 1 hands over, at 1 they sit in their lobes at the size the spin starts
 * from.
 */
const BIRTH_SPAN = 2.05

/**
 * The globes' faces: [song time, centre longitude °E], read off the frames
 * at full resolution. The two globes show the SAME face throughout (they
 * are one globe, divided) and it drifts steadily west — India as they part,
 * Africa by 6–7s, South America at 11, the Pacific at 14, Australia by 17,
 * Asia at 20. The centre longitude is −spin.
 */
const FACES: readonly (readonly [number, number])[] = [
  [4, 100], [4.5, 85], [5, 60], [5.5, 45], [6, 25], [7, 10], [8, -5], [9, -20],
  [10, -35], [11, -55], [12, -80], [13, -110], [14, -140], [15, -160], [16, -195],
  [17, -220], [18, -230], [19, -245], [20, -255], [21.5, -265],
]
/** Pixels per scene unit at this figure's framing: OUTER_R draws at 280. */
const PX = 280 / OUTER_R
const globePx = (tl: number) => 258.5 - 223.5 * c4dEaseWith((tl + 1) / 2.95, 0.35, 0.35)
const separation = (tl: number) => c4dEaseWith((tl + 0.65) / 2.7, 0.2, 0.4)
const outerPx = (tl: number) => 259 + 21 * c4dEaseWith((tl + 1) / 3, 0.25, 0.25)

/** Colours sampled from the full-resolution frames (19.0s). */
const RED_RING = seen(250, 86, 65)
const LATTICE_RED = seen(150, 60, 52)

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


export class YinYangDream extends Dream {
  /** Beat 1: the one globe divides into two and the circle widens. */
  birth = new Null({ creation: 0 })
  /** Beat 2: the S-curve draws in and both nodes' decoration blooms. */
  divide = new Null({ creation: 0 })
  /** Beat 3: the whole figure counter-rotates and the nodes swap sizes. */
  orbit = new Null({ creation: 0 })

  /** The two globes — one per lobe. Both bright, white land on black, spinning
   *  slowly. The blue node's globe faces Africa/Europe (spin 0); the red node's a
   *  touch turned, so the two are not identical. Their radius is REBOUND below to
   *  the size-swap, so the constructor value is only the starting size. */
  /** The blue node is the fragmented Earth (vocabulary/FragmentedEarth) at the lobe's scale. */
  blueEarth = new FragmentedEarth({ spin: 0, tilt: 0.12, decoration: 0 })
  /** The red node is the hero's DreamTalkSymbol at the lobe's scale (its Earth a touch turned). */
  redLight = new DreamTalkSymbol({
    globe: RED_GLOBE_OF_RING,
    spin: 0.5,
    tilt: 0.12,
    ringTint: RED_RING,
    latticeTint: LATTICE_RED,
    bloomSpread: 0.045,
    bloomOpacity: 0,
    latticeOpacity: 0,
    rayOpacity: 0,
    ringOpacity: 0,
  })

  /** The big outer circle — the yin-yang's boundary: shot 1's limb, pushed
   *  outward over `birth`. */
  outer = new Circle({ radius: OUTER_R, tint: WHITE, stroke: 2 })

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
    this.outer.radius.follow(this.birth.creation.map(() => outerPx(this.birthTime()) / PX))

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
    const d = (1 - this.split()) * OUTER_R * separation(this.birthTime())
    return { x: Math.cos(a) * d, y: Math.sin(a) * d }
  }

  /** The red node's lobe centre — across the centre from the blue one, as far
   *  out as the blue lobe is wide. Starts RIGHT (angle 0). */
  private redCentre(): { x: number; y: number } {
    const a = this.turn
    const d = this.split() * OUTER_R * separation(this.birthTime())
    return { x: Math.cos(a) * d, y: Math.sin(a) * d }
  }

  /** The blue and red lobes' shares (the two sum to 1). */
  private blueScale01(): number {
    return this.split()
  }

  private redScale01(): number {
    return 1 - this.split()
  }

  /** This chapter's time into the birth (0 → BIRTH_SPAN). */
  private birthTime(): number {
    return clamp01(this.birth.creation.value) * BIRTH_SPAN
  }

  /** A node's ring radius for a lobe share: the lobe's dot, scaled with it —
   *  and, through the birth, with the one globe the two are dividing from. */
  private ringR(share: number, perLobe: number): number {
    const k = globePx(this.birthTime()) / globePx(BIRTH_SPAN)
    return share * OUTER_R * perLobe * k
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
    const node = this.blueEarth
    node.radius.follow(orbitSrc.map(() => this.ringR(this.blueScale01(), BLUE_RING_PER_LOBE)))
    node.decoration.follow(this.divide.creation.map((d) => clamp01(d)))
    const group = new Group({ members: [node] })
    group.x.follow(orbitSrc.map(() => this.blueCentre().x))
    group.y.follow(orbitSrc.map(() => this.blueCentre().y))
    return group
  }

  /**
   * The RED / Web3 node — the DreamTalkSymbol (the hero's construction) at the
   * lobe's scale: it swells and shrinks with the red lobe's share and comes
   * up layer by layer on `divide`. The bloom is spaced a touch wider than
   * the hero's: its whiteness at 0.5/0.6/0.7/0.8 of the ring reads
   * 146/92/25/0 against the frame's 150/80/27/0.
   */
  private buildRedNode(): Group {
    const orbitSrc = this.orbit.creation
    const node = this.redLight
    node.radius.follow(orbitSrc.map(() => this.ringR(this.redScale01(), RED_RING_PER_LOBE)))
    const d = this.divide.creation
    node.bloomOpacity.follow(d.map((v) => clamp01(v)))
    node.latticeOpacity.follow(d.map((v) => clamp01(v) * 0.55))
    node.rayOpacity.follow(d.map((v) => clamp01((v - 0.2) / 0.8) * 0.85))
    node.ringOpacity.follow(d.map((v) => clamp01(v)))
    const group = new Group({ members: [node] })
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
    this.blueEarth.seenFrom(this.observer)
    this.redLight.seenFrom(this.observer)

    // Draw order: the S-curve and outer ring under the nodes; the two globes
    // slowly turning throughout.
    this.stage(this.outer)
    this.stage(this.divider)
    this.stage(this.blueNode)
    this.stage(this.redNode)

    // The globes' faces, scored first across the whole chapter and then the
    // cursor returns to 0. Both globes turn together, westward, on the
    // measured keys (FACES).
    let at = 0
    for (const [t, lon] of FACES) {
      const local = t - 4
      const spin = (-lon * Math.PI) / 180
      if (local <= 0) {
        this.set(this.blueEarth.spin.to(spin), this.redLight.spin.to(spin))
        continue
      }
      this.play(
        together(
          this.blueEarth.spin.to(spin, { easing: "linear" }),
          this.redLight.spin.to(spin, { easing: "linear" }),
        ),
        local - at,
      )
      at = local
    }
    this.wait(-at)

    // Beat 1 — BIRTH: the one globe divides into two, which draw apart into
    // their lobes as the circle around them widens (4.0–6.05). Linear
    // progress; the measured curves live in the readings.
    this.say("Two worlds, one circle.")
    this.play(this.birth.creation.to(1, { easing: "linear" }), BIRTH_SPAN)

    // Beat 2 — DIVISION: the S-curve draws in and both nodes' decoration
    // blooms, overlapping the birth's last moments (5.75–7.0). Then the
    // figure holds until the spin.
    this.wait(-0.3)
    this.say("The line between them — centralised, and decentralised.")
    this.play(this.divide.creation.to(1, { easing: "linear" }), 1.25)
    this.wait(4)

    // Beat 3 — ORBIT: the figure spins up and the lobes trade sizes
    // (11–21.5s) — the eternal exchange of the two principles. Linear
    // progress; the spin's ease lives in `turn`. It is still at full speed
    // when the film dives into it. The line is spoken OVER the spin, not
    // before it: the film's turn begins at 11.0 on the dot.
    this.say("And they turn, each becoming the other.")
    this.play(
      this.orbit.creation.to(1, { easing: "linear" }),
      10.5,
    )
  }
}

/**
 * Give a Line derived `points` (primitives.ts derivePoints), keyed on the
 * live `turn` AND the three beats that drive the nodes' sizes, so a
 * size-swap or a rotation both re-emit.
 */
const deriveRot = (line: Line, dream: YinYangDream, compute: () => Vec3Like[]): void =>
  derivePoints(
    line,
    () => [dream.turnValue, dream.birth.creation.value, dream.divide.creation.value, dream.orbit.creation.value],
    compute,
  )
