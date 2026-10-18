/**
 * Spheres — the three realms of engineering (InterBrain film, 7:00–8:20):
 * "the first gives rise to our infrastructure, the second forms our social
 * structure, and the third influences our superstructure, the stories we
 * tell and live by … the biosphere, the social sphere and the noosphere".
 *
 *   BIOSPHERE     the Earth                         — `FragmentedEarth` (its
 *                 bare globe; ringed and struck when fragmented) and, healed,
 *                 the radiant `DreamTalkSymbol`
 *   SOCIAL SPHERE a circle filled with a hexagon of little busts (19, rows
 *                 3-4-5-4-3; f2056, f2236) — `Figure` in its bust form; this
 *                 holon's own drawing is only the circle, its triangle grid
 *                 and its petals
 *   NOOSPHERE     the geodesic lattice               — `Noosphere`
 *
 * In a ROW (f2056–f2236) with their labels underneath — three stages, the
 * narration's three namings: Physical / Social / Narrative Engineering →
 * Infra- / Social- / Super-structure → Biosphere / Social Sphere / Noosphere
 * — and the three rows of icons over them (f2161: airport, fire truck, train
 * · courthouse, gavel, mortarboard, school · ☪ ✡ ✝ ⚛; the Icons props).
 * Or STACKED (f2386–f2506), the noosphere largest on top, the Earth small at
 * the bottom, with the two arrows: the ORDER OF INFLUENCE flowing down (red,
 * right; 7:53) and the LADDER OF LEVERAGE climbing up (blue, left; 8:02).
 *
 * THE STATES, each one number so it scrubs and the automaton walks it:
 *   `stack`      0 the row … 1 the stack (the film moves one into the other,
 *                f2341 → f2386); the labels and icon rows belong to the row
 *   `labels`     0 none, 1 "… Engineering", 2 "…-structure", 3 "…sphere";
 *                between two stages the two namings cross-fade
 *   `icons`      the three icon rows, appearing in turn (f2111 → f2161)
 *   `arrows`     0 none … ½ the order of influence drawn … 1 the ladder too
 *   `fragmented` 0 the plain realms (ch2) … 1 the wounded ones of ch8
 *                (f12451): the noosphere narrative-engineered (blue flower
 *                sphere), the social sphere a blue square whose people are
 *                boxed into a triangle grid with bolts between them, the
 *                Earth fragmented in its blue ring
 *   `healed`     0 … 1 the healing trickles DOWN (f12451 → f12496): the
 *                noosphere turns vision-gardened (red) first, then the
 *                social sphere rounds into a red circle of petals, then the
 *                Earth becomes radiant — each in its window of the axis.
 *
 * MEASURED (1280×720 px; the unit is the row's sphere radius R = 125 px,
 * `size`; the origin the frame's centre):
 *   f2236  row: centres x 249.5 · 639.5 · 1027 (± 389 about 640), y 360;
 *          radii 125.5 · 125 · 123; labels' centre y ≈ 571, type ≈ 26 px
 *   f2236  social: busts on a triangular lattice 48 px across, 40 px between
 *          rows (0.387·R, 0.32·R), each ≈ 19–21 px tall (0.15·R; drawn a hair small, the film's busts read thin)
 *   f2161  icon rows: centre y ≈ 120, ≈ 0.55·R tall, over their spheres
 *   f2416  stack: noosphere (640, 187) r 166; social (640, 468) r 89;
 *          Earth (640, 644.5) r 42.5; the red arrow x 875, y 133 → 646,
 *          "Order of influence" at (1041, 392)
 *   f12496 the blue arrow x 405, y 645 → 140, "Ladder of leverage" at (235, 392)
 */

import { Group, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { color, completion, derive, length, scalar } from "../../src/params"
import { BLUE, RED, TAU, WHITE, rgb, type Color } from "../../src/constants"
import { lerp } from "../../src/math"
import { restage, together, type Anim } from "../../src/anim"
import { axis, toggle, type StateSpace } from "../../src/automaton"
import { Create } from "../../src/verbs"
import { Noosphere } from "../Noosphere/Noosphere"
import { FragmentedEarth } from "../FragmentedEarth/FragmentedEarth"
import { DreamTalkSymbol } from "../DreamTalkSymbol/DreamTalkSymbol"
import { Figure, Layer } from "../Figure/Figure"
import { Conflict } from "../Conflict/Conflict"
import { icon } from "../Icons/Icons"

/** The film's numbers (px). */
export const SPHERES = {
  R: 125,
  /** The row: centres (biosphere, social, noosphere) and radii. */
  row: { x: [-389, 0, 389], y: 0, r: [125, 125, 125] },
  /** The stack: centres and radii, same order. */
  stack: { x: [0, 0, 0], y: [284.5, 108, -173], r: [42.5, 89, 166] },
  labelY: 211,
  labelType: 26,
  /** The icon rows (f2161): per sphere, each icon's centre about the sphere's
   *  x and the frame's centre y, and its larger side — px. The gavel lies
   *  under the courthouse, the mortarboard tucked between it and the school. */
  icons: [
    [["airport", -120, -238, 70], ["fireTruck", 0, -233, 114], ["train", 110, -237, 81]],
    [["courthouse", -77, -237, 60], ["gavel", -50, -202, 74], ["mortarboard", -5, -257, 57], ["school", 70, -243, 78]],
    [["crescent", -108, -240, 61], ["starOfDavid", -28, -240, 61], ["cross", 46, -240, 64], ["atom", 117, -240, 62]],
  ] as const,
  /** The social sphere's lattice: spacing a (bust to bust) and the bust's height, × R. */
  lattice: 0.387,
  bust: 0.15,
  /** The arrows: x, from y, to y (px about the centre). Red flows down, blue climbs. */
  influence: { x: 235, y0: -227, y1: 286 },
  leverage: { x: -235, y0: 285, y1: -220 },
  arrowLabelX: 401,
  arrowLabelY: 32,
  /** The wounded Earth (f12451): its globe 0.87 of the plain one, the ring's share 0.62; the radiant ring 1.45 × the globe (f12496). */
  woundedGlobe: 0.87,
  globeOfRing: 0.62,
  radiantRing: 1.45,
  /** The noosphere's geodesic frequency: the plain lattice (f2236) and the flower sphere (f12451). */
  frequency: [4, 7],
  /** The healing's windows, top down: noosphere, social sphere, Earth. */
  heal: [[0, 0.5], [0.3, 0.75], [0.55, 1]] as const,
} as const

export const LABELS = [
  ["Physical\nEngineering", "Social\nEngineering", "Narrative\nEngineering"],
  ["Infra-structure", "Social-structure", "Super-structure"],
  ["Biosphere", "Social Sphere", "Noosphere"],
] as const

const LABEL_TINTS: readonly Color[] = [BLUE, WHITE, RED]
const BUST_GREY = rgb(0xb4, 0xb4, 0xb4)

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const mix = (a: Color, b: Color, t: number): Color => ({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) })

/** The social sphere's 19 seats (rows 3-4-5-4-3), in units of R, y up. */
export const seats = (): { x: number; y: number }[] => {
  const a = SPHERES.lattice
  const h = (a * Math.sqrt(3)) / 2
  const out: { x: number; y: number }[] = []
  ;[3, 4, 5, 4, 3].forEach((n, row) => {
    for (let i = 0; i < n; i++) out.push({ x: (i - (n - 1) / 2) * a, y: (2 - row) * h })
  })
  return out
}

/** Where the bolts sit: the down-triangles between neighbouring seats in a row, units of R. */
export const boltSeats = (): { x: number; y: number }[] => {
  const a = SPHERES.lattice
  const h = (a * Math.sqrt(3)) / 2
  const out: { x: number; y: number }[] = []
  ;[3, 4, 5, 4, 3].forEach((n, row) => {
    for (let i = 0; i < n - 1; i++) out.push({ x: (i + 0.5 - (n - 1) / 2) * a, y: (2 - row) * h + h / 3 })
  })
  return out
}

/** Clip a segment to the disk of radius r about the origin (null if it misses). */
const clipToDisk = (p: { x: number; y: number }, q: { x: number; y: number }, r: number): [Vec3Like, Vec3Like] | null => {
  const dx = q.x - p.x
  const dy = q.y - p.y
  const A = dx * dx + dy * dy
  const B = 2 * (p.x * dx + p.y * dy)
  const C = p.x * p.x + p.y * p.y - r * r
  const disc = B * B - 4 * A * C
  if (disc <= 0) return null
  const t0 = Math.max(0, (-B - Math.sqrt(disc)) / (2 * A))
  const t1 = Math.min(1, (-B + Math.sqrt(disc)) / (2 * A))
  if (t1 <= t0) return null
  return [
    { x: p.x + dx * t0, y: p.y + dy * t0, z: 0 },
    { x: p.x + dx * t1, y: p.y + dy * t1, z: 0 },
  ]
}

/** The triangle grid the busts sit in (each seat an up-triangle's centroid), clipped to radius `r`, units of R. */
export const triangleGrid = (r = 0.95): [Vec3Like, Vec3Like][] => {
  const a = SPHERES.lattice
  const h = (a * Math.sqrt(3)) / 2
  // The base line under the middle row: y = −h/3; vertices at x = i·a/2 offsets.
  const out: [Vec3Like, Vec3Like][] = []
  const far = 3
  for (let j = -6; j <= 6; j++) {
    const y = -h / 3 + j * h
    const s = clipToDisk({ x: -far, y }, { x: far, y }, r)
    if (s) out.push(s)
  }
  for (const dir of [1, -1]) {
    for (let j = -12; j <= 12; j++) {
      // Lines through the vertices of the base row, at ±60°.
      const x0 = a / 2 + j * a
      const y0 = -h / 3
      const ux = dir * Math.cos(TAU / 6)
      const uy = Math.sin(TAU / 6)
      const s = clipToDisk({ x: x0 - ux * far, y: y0 - uy * far }, { x: x0 + ux * far, y: y0 + uy * far }, r)
      if (s) out.push(s)
    }
  }
  return out
}

/** The healed sphere's petals: circles of radius a about the grid's vertices, clipped to radius `r`, units of R. */
export const petals = (r = 0.95): Vec3Like[][] => {
  const a = SPHERES.lattice
  const h = (a * Math.sqrt(3)) / 2
  const out: Vec3Like[][] = []
  for (let j = -4; j <= 4; j++) {
    for (let i = -5; i <= 5; i++) {
      const cx = a / 2 + i * a + (Math.abs(j) % 2 === 1 ? a / 2 : 0)
      const cy = -h / 3 + j * h
      if (Math.hypot(cx, cy) > r + a) continue
      let run: Vec3Like[] = []
      for (let k = 0; k <= 48; k++) {
        const t = (k / 48) * TAU
        const p = { x: cx + a * Math.cos(t), y: cy + a * Math.sin(t), z: 0 }
        if (Math.hypot(p.x, p.y) <= r) run.push(p)
        else {
          if (run.length > 1) out.push(run)
          run = []
        }
      }
      if (run.length > 1) out.push(run)
    }
  }
  return out
}

/** The social sphere's outline: a circle (rounding 1) … a square of the same half-side (rounding 0), units of R. */
export const socialOutline = (rounding: number, n = 16): Vec3Like[] => {
  const rr = clamp01(rounding)
  const c = 1 - rr // the straight half-length of each side
  const pts: Vec3Like[] = []
  const corners = [
    [c, c, 0],
    [-c, c, 1],
    [-c, -c, 2],
    [c, -c, 3],
  ] as const
  // Start at the top centre and go round counterclockwise.
  pts.push({ x: 0, y: 1, z: 0 })
  for (const [cx, cy, q] of [corners[1], corners[2], corners[3], corners[0]]) {
    for (let k = 0; k <= n; k++) {
      const t = ((q + k / n) * TAU) / 4
      pts.push({ x: cx + rr * Math.cos(t), y: cy + rr * Math.sin(t), z: 0 })
    }
  }
  pts.push({ x: 0, y: 1, z: 0 })
  // A square corner with rr = 0 collapses each quarter to its corner point.
  return pts
}

/**
 * The noosphere as this whole holds it: its looks are the Spheres' states
 * (bound), not axes of its own — and Noosphere's stateSpace() builds its
 * toggles before it filters bound params, so it would throw on them.
 */
class HeldNoosphere extends Noosphere {
  override stateSpace(): StateSpace | undefined {
    return undefined
  }
}

export class Spheres extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** R — the row's sphere radius; every measure derives from it. */
  size = length(125 / 0.48)
  /** 0 the row … 1 the stack. */
  stack = completion(0)
  /** 0 none … 1 Engineering … 2 structure … 3 sphere (the three namings). */
  labels = scalar(3)
  /** The three icon rows (row layout), in turn. */
  icons = completion(0)
  /** 0 none … ½ the order of influence … 1 the ladder of leverage too. */
  arrows = completion(0)
  /** 0 the plain realms … 1 the wounded ones (f12451). */
  fragmented = completion(0)
  /** 0 … 1 the healing, top down (f12451 → f12496). */
  healed = completion(0)
  /** Pen width in screen px. */
  stroke = length(2)

  biosphere!: Null
  earth!: FragmentedEarth
  radiant!: DreamTalkSymbol
  social!: Null
  socialRim!: Line
  grid!: Group
  bolts!: Group
  petalLines!: Group
  people!: Group
  noosphere!: Noosphere
  words!: Group
  iconRows!: Group
  influence!: Line
  leverage!: Line
  arrowWords!: Group

  /** Sphere i's (0 bio, 1 social, 2 noo) centre and radius in units, at the current `stack`. */
  placement(i: number): { x: number; y: number; r: number } {
    const k = this.size.value / SPHERES.R
    const s = this.stack.value
    return {
      x: lerp(SPHERES.row.x[i]!, SPHERES.stack.x[i]!, s) * k,
      y: -lerp(SPHERES.row.y, SPHERES.stack.y[i]!, s) * k,
      r: lerp(SPHERES.row.r[i]!, SPHERES.stack.r[i]!, s) * k,
    }
  }

  /** Sphere i's healing progress (top down: the noosphere first). */
  healOf(i: number): number {
    const [a, b] = SPHERES.heal[2 - i]!
    return clamp01((this.healed.value - a) / (b - a))
  }

  protected override compose(): void {
    const k = () => this.size.value / SPHERES.R
    const unitR = () => this.size.value
    const scaleOf = (i: number) => () => this.placement(i).r / unitR()
    const wounded = (i: number) => () => this.fragmented.value * (1 - this.healOf(i))

    // --- the biosphere: one globe of radius r; ringed when fragmented, radiant when healed.
    this.biosphere = this.add(new Null({ x: derive(() => this.placement(0).x), y: derive(() => this.placement(0).y), scale: derive(scaleOf(0)) }))
    // f12451: wounded, the globe shrinks to 0.87 of its plain size inside a
    // ring 1/0.62 of it; healed, the radiant Earth's ring sits at 1.45 × the globe.
    this.earth = new FragmentedEarth({
      radius: derive(() => (unitR() * lerp(1, SPHERES.woundedGlobe, wounded(0)())) / SPHERES.globeOfRing),
      globe: SPHERES.globeOfRing,
      decoration: derive(wounded(0)),
      limb: 1,
      boltTint: rgb(0x8c, 0x8c, 0x8c),
    })
    this.radiant = new DreamTalkSymbol({ radius: derive(() => unitR() * SPHERES.radiantRing), globe: 1 / SPHERES.radiantRing })
    this.biosphere.attach(new Layer({ members: [this.earth], presence: derive(() => 1 - this.healOf(0)) }))
    this.biosphere.attach(new Layer({ members: [this.radiant], presence: derive(() => this.healOf(0)) }))

    // --- the social sphere.
    this.social = this.add(new Null({ x: derive(() => this.placement(1).x), y: derive(() => this.placement(1).y), scale: derive(scaleOf(1)) }))
    const rimTint = derive(() => mix(mix(WHITE, BLUE, this.fragmented.value), RED, this.healOf(1)))
    this.socialRim = new Line({ tint: rimTint, stroke: this.stroke })
    derivePoints(
      this.socialRim,
      () => [unitR(), this.fragmented.value, this.healOf(1)],
      () => socialOutline(1 - wounded(1)()).map((p) => ({ x: p.x * unitR(), y: p.y * unitR(), z: 0 })),
    )
    const U = (p: Vec3Like) => ({ x: p.x * unitR(), y: p.y * unitR(), z: 0 })
    this.grid = this.social.attach(
      new Layer({
        members: triangleGrid().map(([p, q]) => new Line({ points: [U(p), U(q)], tint: BLUE, stroke: this.stroke.map((s) => s * 0.5) })),
        presence: derive(() => 0.7 * wounded(1)()),
      }),
    )
    this.petalLines = this.social.attach(
      new Layer({
        members: petals().map((run) => new Line({ points: run.map(U), tint: RED, stroke: this.stroke.map((s) => s * 0.5) })),
        presence: derive(() => 0.35 * this.healOf(1)),
      }),
    )
    this.social.attach(this.socialRim)
    this.people = this.social.attach(
      new Group({
        members: seats().map(
          (p) => new Figure({ form: 1, height: derive(() => SPHERES.bust * unitR()), x: p.x * unitR(), y: p.y * unitR(), tint: BUST_GREY, stroke: this.stroke.map((s) => s * 0.5), opaque: 1 }),
        ),
      }),
    )
    this.bolts = this.social.attach(
      new Layer({
        members: boltSeats().map((p) => new Conflict({ size: derive(() => 0.12 * unitR()), x: p.x * unitR(), y: p.y * unitR(), tint: BUST_GREY })),
        presence: derive(wounded(1)),
      }),
    )

    // --- the noosphere: the lattice; a flower sphere when wounded or healed.
    this.noosphere = this.add(
      new HeldNoosphere({
        radius: derive(() => this.placement(2).r),
        x: derive(() => this.placement(2).x),
        y: derive(() => this.placement(2).y),
        // The film cuts between the two spheres; the switch sits mid-bloom.
        frequency: derive(() => (Math.max(this.fragmented.value, this.healOf(2)) > 0.5 ? SPHERES.frequency[1] : SPHERES.frequency[0])),
        bloom: derive(() => Math.max(this.fragmented.value, this.healOf(2))),
        garden: derive(() => this.healOf(2)),
      }),
    )

    // --- the labels (the row's), three namings each.
    const rowShare = () => 1 - this.stack.value
    const words: Text[] = []
    LABELS.forEach((names, stage) =>
      names.forEach((content, i) =>
        words.push(
          new Text({
            content,
            font: "Times-Roman",
            size: derive(() => SPHERES.labelType * k()),
            lineHeight: 1.05,
            x: derive(() => this.placement(i).x),
            y: derive(() => -SPHERES.labelY * k()),
            tint: LABEL_TINTS[i]!,
            opacity: derive(() => rowShare() * clamp01(1 - Math.abs(this.labels.value - (stage + 1)))),
          }),
        ),
      ),
    )
    this.words = this.add(new Group({ members: words }))

    // --- the icon rows over the spheres (f2161), in turn.
    const rowTints: readonly Color[] = [BLUE, WHITE, RED]
    this.iconRows = this.add(
      new Group({
        members: SPHERES.icons.map(
          (row, i) =>
            new Layer({
              members: row.map(([name, dx, dy, side]) =>
                icon(name, { size: side * k(), tint: rowTints[i]!, x: (SPHERES.row.x[i]! + dx) * k(), y: -dy * k() }),
              ),
              presence: derive(() => rowShare() * clamp01(this.icons.value * 3 - i)),
            }),
        ),
      }),
    )

    // --- the arrows.
    const arrow = (a: { x: number; y0: number; y1: number }, tint: Color, from: number, to: number) =>
      new Line({
        points: [
          { x: a.x * k(), y: -a.y0 * k(), z: 0 },
          { x: a.x * k(), y: -a.y1 * k(), z: 0 },
        ],
        tint,
        stroke: this.stroke,
        arrowEnd: true,
        creation: derive(() => clamp01((this.arrows.value - from) / (to - from))),
      })
    this.influence = this.add(arrow(SPHERES.influence, RED, 0, 0.5))
    this.leverage = this.add(arrow(SPHERES.leverage, BLUE, 0.5, 1))
    const arrowWord = (content: string, side: 1 | -1, tint: Color, from: number, to: number) =>
      new Text({
        content,
        font: "Times-Roman",
        size: derive(() => SPHERES.labelType * k()),
        x: derive(() => side * SPHERES.arrowLabelX * k()),
        y: derive(() => -SPHERES.arrowLabelY * k()),
        tint,
        opacity: derive(() => clamp01((this.arrows.value - from) / (to - from))),
      })
    this.arrowWords = this.add(
      new Group({ members: [arrowWord("Order of influence", 1, RED, 0.3, 0.5), arrowWord("Ladder of leverage", -1, BLUE, 0.8, 1)] }),
    )
  }

  /** The Earth, then the social sphere, then the noosphere (the film's own order, f2026 → f2086). */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.biosphere), 0, 0.45),
      restage(Create(this.social), 0.25, 0.7),
      restage(Create(this.noosphere), 0.5, 1),
      restage(Create(this.words), 0.6, 1),
    )
  }

  /** Walkable (src/automaton.ts). */
  override stateSpace(): StateSpace | undefined {
    const h = [this]
    const axes = [
      toggle("stack", this.stack, { off: ["row", 0], on: ["stack", 1], duration: 2, handles: h }),
      axis("labels", this, { none: { labels: 0 }, engineering: { labels: 1 }, structure: { labels: 2 }, sphere: { labels: 3 } }, { duration: 1, handles: h }),
      toggle("icons", this.icons, { off: ["bare", 0], on: ["icons", 1], duration: 2, handles: h }),
      axis("arrows", this, { none: { arrows: 0 }, influence: { arrows: 0.5 }, leverage: { arrows: 1 } }, { duration: 1.5, handles: h }),
      toggle("fragmented", this.fragmented, { off: ["plain", 0], on: ["fragmented", 1], duration: 2, handles: h }),
      toggle("healed", this.healed, { off: ["wounded", 0], on: ["healed", 1], duration: 4, handles: h }),
    ].filter((a) => a.params().every((p) => !p.isBound))
    return { axes }
  }
}
