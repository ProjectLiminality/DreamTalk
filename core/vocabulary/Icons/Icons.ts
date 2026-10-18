/**
 * Icons — the InterBrain film's PROPS: the small line icons that dress a
 * diagram without carrying a concept of their own.
 *
 * This is an INVISIBLE ASSET, not a sovereign symbol (ONTOLOGY.md,
 * "Vocabulary vs. invisible assets" — the same reason Sketch and Slides carry
 * no `static sovereign`): a tank on the arms-race curve, a bus over the
 * biosphere, a film strip beside the GitRepo are weak ways an idea presents
 * itself. They never appear in the vocabulary bar. An icon that comes to
 * carry a concept the narration NAMES graduates out of this table into its
 * own holon — which is what `RadioTower` (broadcast) and `Book` (the written
 * word) already did; their entries here only hand those holons out, so a
 * contact sheet or a band of icons can ask for them by name.
 *
 * WHERE THE GEOMETRY COMES FROM (translate, never invent):
 *   - PL02's deck carries Keynote's own icon paths (vocabulary/Slides/assets/
 *     pl02): wherever the film's icon is one of them it is READ from there —
 *     `laptop` (Keynote `Notebook_109`), `musicNote` (`Music Note_217`),
 *     `gameController` (`Game Controller_92`).
 *   - Everything else is minimal line-art drawn off the frames (zoomed):
 *     the arms race (f931, f1801) and the generations-of-warfare bands
 *     (f2746–f2836): `pistol` (the flintlock), `tank`, `bomb`, `satellite`,
 *     `flag`, `medals`, `compass`, `phone`; the psy-war (f2986, f3031):
 *     `mushroomCloud`; the three rows over the spheres (f2161, f2191):
 *     `airport`, `fireTruck`, `train` · `courthouse`, `gavel`,
 *     `mortarboard`, `school` · `crescent`, `starOfDavid`, `cross`, `atom`;
 *     the media round the GitRepo (f8971): `filmStrip`; the Vault's
 *     documents (f8281–f8326): `document`, `article`; and `notes` — the
 *     neutral face that stands where the film shows a second-brain app's
 *     mark (f7726, f7801, f8131), drawn as f8536 shows "Second Brain": a
 *     document page in a blue square. (The app's own mark, and the
 *     third-party logos on the film's phone and laptop screens, are NOT
 *     redrawn — their screens are left blank.)
 *   - Entries that are already holons are composed, never redrawn:
 *     `radioTower` → RadioTower, `book` → Book, `warMachine` (the eye in its
 *     triangle on the bands, f2836) → HyperAgent at depth 0, `person` →
 *     Figure's bust.
 *
 * The arms race in the film has exactly these generations — flintlock,
 * tank, radio tower, bomb, satellite, phone + laptop; no spear, catapult,
 * cannon or drone appears in its frames, so none is drawn here.
 *
 * Every drawn glyph is authored in its own small frame (y down, ≈ 100 units)
 * and normalised at compose: centred on its box, `size` its larger side, y up.
 */

import { Group, Line, Null, Shape, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, length } from "../../src/params"
import { BLACK, TAU, WHITE, type Color } from "../../src/constants"
import { restage, together, type Anim } from "../../src/anim"
import { presence } from "../../src/certainty"
import { Create } from "../../src/verbs"
import type { Holon, Overrides } from "../../src/holon"
import { slide22 } from "../Slides/assets/pl02/slide22"
import { slide24 } from "../Slides/assets/pl02/slide24"
import { RadioTower } from "../RadioTower/RadioTower"
import { Book } from "../Book/Book"
import { HyperAgent } from "../HyperAgent/HyperAgent"
import { Figure } from "../Figure/Figure"

// -- authoring --------------------------------------------------------------

type P = readonly [number, number]
/** One run of a glyph: its points (y down), closed or open, and whether the tint fills it. */
export interface GlyphPath {
  pts: P[]
  closed: boolean
  fill?: boolean
}
type Glyph = GlyphPath[]

const poly = (pts: P[], closed = true): GlyphPath => ({ pts, closed })
const open = (...pts: P[]): GlyphPath => ({ pts, closed: false })
const rect = (x0: number, y0: number, x1: number, y1: number): GlyphPath => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
const arcPts = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): P[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as const
  })
const circle = (cx: number, cy: number, r: number, n = 40): GlyphPath => poly(arcPts(cx, cy, r, r, 0, TAU, n).slice(0, n))
const ellipse = (cx: number, cy: number, rx: number, ry: number, rot = 0, n = 48): GlyphPath =>
  rotate([poly(arcPts(cx, cy, rx, ry, 0, TAU, n).slice(0, n))], rot, [cx, cy])[0]!
const rrect = (x0: number, y0: number, x1: number, y1: number, r: number): GlyphPath => {
  const q = TAU / 4
  return poly([
    ...arcPts(x1 - r, y0 + r, r, r, -q, 0, 6),
    ...arcPts(x1 - r, y1 - r, r, r, 0, q, 6),
    ...arcPts(x0 + r, y1 - r, r, r, q, 2 * q, 6),
    ...arcPts(x0 + r, y0 + r, r, r, 2 * q, 3 * q, 6),
  ])
}
/** A bar of height h along y, rounded at both ends (the documents' text lines). */
const capsule = (x0: number, x1: number, y: number, h: number): GlyphPath => rrect(x0, y - h / 2, x1, y + h / 2, h / 2)
/** An n-pointed star, outer radius ro, inner ri, first point at `rot` (default straight up). */
const star = (cx: number, cy: number, ro: number, ri: number, n: number, rot = -TAU / 4): GlyphPath =>
  poly(
    Array.from({ length: 2 * n }, (_, i) => {
      const r = i % 2 === 0 ? ro : ri
      const a = rot + (i * Math.PI) / n
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
    }),
  )
/** An annular sector about (cx, cy), radii r0..r1, centred on angle a, `w` wide. */
const sector = (cx: number, cy: number, r0: number, r1: number, a: number, w: number): GlyphPath =>
  poly([...arcPts(cx, cy, r1, r1, a - w / 2, a + w / 2, 10), ...arcPts(cx, cy, r0, r0, a + w / 2, a - w / 2, 10)])
/** Turn runs by `deg` (clockwise on the page, y down) about `about` (default their box centre). */
const rotate = (paths: Glyph, deg: number, about?: P): Glyph => {
  if (deg === 0) return paths
  const [cx, cy] = about ?? centre(paths)
  const c = Math.cos((deg * Math.PI) / 180)
  const s = Math.sin((deg * Math.PI) / 180)
  return paths.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c] as const) }))
}
const boxOf = (paths: Glyph) => {
  const xs = paths.flatMap((p) => p.pts.map((q) => q[0]))
  const ys = paths.flatMap((p) => p.pts.map((q) => q[1]))
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}
const centre = (paths: Glyph): P => {
  const b = boxOf(paths)
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]
}
/** A deck shape's flat runs → glyph runs (slide units are already y down). */
const fromDeck = (subpaths: readonly (readonly number[])[], closed: readonly number[]): Glyph =>
  subpaths.map((raw, k) => ({
    pts: Array.from({ length: Math.floor(raw.length / 2) }, (_, i) => [raw[2 * i]!, raw[2 * i + 1]!] as const),
    closed: closed[k] === 1,
  }))
const deckIcon = (slide: typeof slide22, name: string): Glyph => {
  const s = slide.shapes.find((sh) => sh.icon === name)!
  return fromDeck(s.subpaths, s.closed)
}

// -- the documents (f8326: 56 × 74 px, the fold 0.29 of the width) ----------

const page = (): Glyph => [
  poly([[0, 0], [39.7, 0], [56, 18], [56, 74], [0, 74]]),
  open([39.7, 0], [39.7, 18], [56, 18]),
]
/** The plain page: four long text lines (f8326's second document). */
const documentGlyph = (): Glyph => [...page(), ...[29, 38, 47, 56.5].map((y) => capsule(9, 46, y, 4.5))]
/** The page with a picture box, two short lines beside it, two long below (f8326's first). */
const articleGlyph = (): Glyph => [
  ...page(),
  rect(10, 25, 25, 39),
  capsule(29, 46, 28.5, 4.5),
  capsule(29, 46, 36, 4.5),
  capsule(9, 46, 47, 4.5),
  capsule(9, 46, 56.5, 4.5),
]

// -- the table ---------------------------------------------------------------

const DRAWN = {
  // The arms race and the generations of warfare (f931, f2836).
  pistol: () =>
    rotate(
      [
        poly([[36, 20], [100, 20], [100, 30], [48, 30], [44, 38], [38, 48], [34, 60], [32, 70], [24, 77], [13, 75], [9, 67], [13, 55], [19, 43], [24, 31], [29, 23]]),
        rect(94, 18, 100, 32),
        poly([[34, 20], [29, 10], [35, 7], [40, 13], [39, 20]], false),
        open([37, 34], [38, 44], [47, 44], [49, 30]),
        open([8, 58], [21, 67]),
        open([60, 25], [92, 25]),
      ],
      -35,
    ),
  tank: () => [
    rrect(6, 62, 94, 82, 10),
    ...[22, 36, 50, 64, 78].map((x) => circle(x, 72, 5.5, 20)),
    poly([[2, 62], [10, 47], [90, 47], [98, 62]]),
    poly([[32, 47], [34, 31], [42, 24], [58, 24], [64, 31], [66, 47]]),
    rect(64, 31, 94, 37),
    rect(92, 29, 99, 39),
    rect(18, 40, 30, 47),
  ],
  bomb: () =>
    rotate(
      [
        poly([[30, 42], ...arcPts(50, 70, 20, 20, TAU / 2, 0, 16), [70, 42], [62, 30], [38, 30]]),
        poly([[37, 30], [30, 8], [70, 8], [63, 30]]),
        open([34, 18], [66, 18]),
        circle(50, 62, 2.6, 14),
        ...[-TAU / 4, -TAU / 4 + TAU / 3, -TAU / 4 + (2 * TAU) / 3].map((a) => sector(50, 62, 5, 13, a + TAU / 2, TAU / 6)),
      ],
      40,
    ),
  satellite: () =>
    rotate(
      [
        rect(42, 38, 58, 62),
        rect(4, 42, 38, 58),
        rect(62, 42, 96, 58),
        ...[15.3, 26.6, 73.3, 84.6].map((x) => open([x, 42], [x, 58])),
        open([38, 50], [42, 50]),
        open([58, 50], [62, 50]),
        open([50, 62], [50, 70]),
        open([40, 77], [50, 70], [60, 77]),
        open([50, 70], [50, 80]),
      ],
      45,
    ),
  flag: () => {
    const wave = (y: number, dir: 1 | -1): P[] =>
      Array.from({ length: 17 }, (_, i) => {
        const t = i / 16
        const x = 12 + t * 66
        return [dir === 1 ? x : 90 - x, y + 4 * Math.sin((dir === 1 ? t : 1 - t) * TAU)] as const
      })
    return [open([10, 9], [10, 96]), circle(10, 6, 3, 16), poly([...wave(16, 1), ...wave(60, -1)])]
  },
  medals: () => {
    const ribbon = (x: number, top: number): Glyph => [
      poly([[x - 12, top], [x + 12, top], [x + 12, 50], [x, 60], [x - 12, 50]]),
      open([x - 4, top], [x - 4, 54]),
      open([x + 4, top], [x + 4, 54]),
    ]
    return [
      ...ribbon(22, 10),
      ...ribbon(50, 2),
      ...ribbon(78, 10),
      circle(22, 76, 12, 32),
      open(...arcPts(22, 76, 7, 7, TAU / 2, (3 * TAU) / 4, 8)),
      star(50, 76, 13, 7.5, 6),
      poly([[74, 64], [82, 64], [80, 72], [90, 70], [90, 78], [80, 76], [82, 86], [74, 86], [76, 76], [66, 78], [66, 70], [76, 72]]),
    ]
  },
  compass: () => [
    circle(50, 50, 30, 48),
    circle(50, 50, 23, 48),
    star(50, 50, 48, 9, 4),
    star(50, 50, 27, 8, 4, -TAU / 8),
    ...[0, 1, 2, 3].map((k) => open([50, 50], [50 + 48 * Math.cos((k * TAU) / 4), 50 + 48 * Math.sin((k * TAU) / 4)])),
  ],
  phone: () => [rrect(0, 0, 40, 78, 6), rect(4, 12, 36, 66), capsule(14, 26, 6, 3)],
  // The psy-war's nuke (f2986).
  mushroomCloud: () => {
    const cap: P[] = Array.from({ length: 97 }, (_, i) => {
      const a = (i / 96) * TAU
      const bump = 1 + 0.1 * Math.abs(Math.sin(a * 5.5))
      return [50 + 50 * bump * Math.cos(a) * 0.92, 28 + 24 * bump * Math.sin(a) * 0.92] as const
    })
    return [
      poly(cap.slice(0, 96)),
      open(...Array.from({ length: 13 }, (_, i) => [24 + i * 4.33, 58 + 3 * Math.sin(i * 1.4)] as const)),
      open([44, 60], [42, 82], [30, 100]),
      open([56, 60], [58, 82], [70, 100]),
      // The ground ring, broken where the stem stands in front of it.
      ...[[0, 79], [101, 259], [281, 360]].map(([a, b]) => open(...arcPts(50, 88, 42, 8, (a! * TAU) / 360, (b! * TAU) / 360, 16))),
    ]
  },
  // The three rows over the spheres (f2161): infrastructure…
  airport: () => [
    poly([[10, 86], [10, 24], [6, 24], [8, 14], [12, 14], [12, 8], [18, 8], [18, 14], [22, 14], [24, 24], [20, 24], [20, 64], [80, 64], [80, 86]]),
    open([2, 92], [80, 92]),
    open([15, 8], [15, 2]),
    ...rotate(
      [poly([[36, 36], [34, 22], [39, 22], [45, 29], [56, 29], [48, 18], [54, 18], [68, 29], [84, 27], [90, 29], [84, 32], [68, 33], [56, 44], [50, 44], [57, 34], [40, 36]])],
      -15,
    ),
  ],
  fireTruck: () => [
    rect(4, 26, 62, 62),
    poly([[62, 30], [80, 30], [94, 48], [94, 62], [62, 62]]),
    rect(66, 34, 78, 46),
    poly([[82, 34], [84, 34], [90, 46], [82, 46]]),
    rect(4, 14, 92, 22),
    ...Array.from({ length: 14 }, (_, i) => open([10 + i * 6, 14], [10 + i * 6, 22])),
    rect(50, 34, 58, 56),
    circle(22, 64, 8, 24),
    circle(22, 64, 3, 12),
    circle(78, 64, 8, 24),
    circle(78, 64, 3, 12),
  ],
  train: () => [
    rrect(10, 8, 90, 78, 12),
    rect(20, 18, 47, 44),
    rect(53, 18, 80, 44),
    circle(28, 60, 5, 16),
    circle(72, 60, 5, 16),
    rect(40, 2, 60, 8),
    open([24, 78], [14, 98]),
    open([76, 78], [86, 98]),
    open([20, 86], [80, 86]),
    open([16, 94], [84, 94]),
  ],
  // …social structure…
  courthouse: () => [
    poly([[4, 22], [50, 4], [96, 22]]),
    rect(8, 22, 92, 30),
    ...[16, 35, 54, 73].map((x) => rect(x, 33, x + 11, 72)),
    rect(6, 74, 94, 80),
    rect(2, 80, 98, 86),
  ],
  gavel: () => [rrect(0, 38, 62, 44, 3), rrect(60, 22, 78, 60, 3), open([60, 30], [78, 30]), open([60, 52], [78, 52])],
  mortarboard: () => [
    poly([[0, 20], [50, 2], [100, 20], [50, 38]]),
    poly([[22, 30], [22, 48], [50, 56], [78, 48], [78, 30]], false),
    open([90, 24], [90, 50]),
    rect(87, 50, 93, 62),
    circle(50, 20, 2, 10),
  ],
  school: () => [
    rect(4, 40, 96, 96),
    rect(0, 36, 100, 40),
    poly([[34, 36], [34, 28], [50, 18], [66, 28], [66, 36]], false),
    circle(50, 30, 4.5, 16),
    open([50, 18], [50, 4]),
    poly([[50, 4], [58, 6.5], [50, 9]], false),
    ...[48, 62, 76].flatMap((y) => [12, 28, 64, 80].map((x) => rect(x, y, x + 9, y + 7))),
    ...[48, 62].map((y) => rect(45.5, y, 54.5, y + 7)),
    poly([[42, 96], [42, 82], ...arcPts(50, 82, 8, 6, TAU / 2, TAU, 8), [58, 96]], false),
  ],
  // …superstructure.
  crescent: () => {
    const R = 40
    const d = 14
    const r2 = 33
    const th = Math.acos((R * R + d * d - r2 * r2) / (2 * R * d))
    const ph = Math.acos((R * Math.cos(th) - d) / r2)
    return [
      poly([...arcPts(40, 50, R, R, th, TAU - th, 40), ...arcPts(40 + d, 50, r2, r2, TAU - ph, ph, 40)]),
      star(88, 56, 12, 5, 5),
    ]
  },
  starOfDavid: () => {
    const outer = star(50, 50, 48, 48 / Math.sqrt(3), 6)
    return [outer, star(50, 50, 32, 32 / Math.sqrt(3), 6), poly(Array.from({ length: 6 }, (_, i) => [50 + 18 * Math.cos(-TAU / 4 + TAU / 12 + (i * TAU) / 6), 50 + 18 * Math.sin(-TAU / 4 + TAU / 12 + (i * TAU) / 6)] as const))]
  },
  cross: () => [poly([[44, 0], [56, 0], [56, 24], [80, 24], [80, 36], [56, 36], [56, 100], [44, 100], [44, 36], [20, 36], [20, 24], [44, 24]])],
  atom: () => [ellipse(50, 50, 48, 17, 0), ellipse(50, 50, 48, 17, 60), ellipse(50, 50, 48, 17, 120), circle(50, 50, 7, 20), circle(50, 50, 11, 24)],
  // The media round the GitRepo (f8971).
  filmStrip: () => [
    rrect(0, 0, 100, 66, 4),
    rect(7, 14, 93, 52),
    ...[0, 1, 2, 3, 4, 5].flatMap((i) => [rect(9 + i * 14.4, 4, 16 + i * 14.4, 10), rect(9 + i * 14.4, 56, 16 + i * 14.4, 62)]),
  ],
  // The Vault's documents (f8326) and the second brain's neutral face (f8536).
  document: documentGlyph,
  article: articleGlyph,
  notes: () => {
    const doc = articleGlyph().map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x + 22, y + 13] as const) }))
    return [rect(0, 0, 100, 100), ...doc]
  },
  // Keynote's own (PL02's deck paths, exact geometry).
  laptop: () => deckIcon(slide24, "Notebook_109"),
  musicNote: () => deckIcon(slide22, "Music Note_217"),
  gameController: () => deckIcon(slide22, "Game Controller_92"),
} satisfies Record<string, () => Glyph>

export type DrawnIconName = keyof typeof DRAWN
/** The entries that are holons of their own (composed, never redrawn). */
export const COMPOSED = ["radioTower", "book", "warMachine", "person"] as const
export type IconName = DrawnIconName | (typeof COMPOSED)[number]
export const DRAWN_ICONS = Object.keys(DRAWN) as DrawnIconName[]
export const ICON_NAMES: readonly IconName[] = [...DRAWN_ICONS, ...COMPOSED]

/** The three rows over the spheres (f2161), left to right; the film inks them blue · white · red. */
export const ICON_ROWS = {
  /** f2161, over the Biosphere: infrastructure (blue). */
  infra: ["airport", "fireTruck", "train"],
  /** over the Social Sphere: social structure (white). */
  social: ["courthouse", "gavel", "mortarboard", "school"],
  /** over the Noosphere: superstructure (red). */
  super: ["crescent", "starOfDavid", "cross", "atom"],
} as const satisfies Record<string, readonly DrawnIconName[]>

/**
 * A drawn icon's runs, normalised: centred on its box, its larger side
 * `size`, y up. Exposed for tests and composers.
 */
export const glyphPaths = (name: DrawnIconName, size = 1): { points: Vec3Like[]; closed: boolean; fill: boolean }[] => {
  const g = DRAWN[name]()
  const b = boxOf(g)
  const k = size / Math.max(b.x1 - b.x0, b.y1 - b.y0)
  const cx = (b.x0 + b.x1) / 2
  const cy = (b.y0 + b.y1) / 2
  return g.map((p) => {
    const points = p.pts.map(([x, y]) => ({ x: (x - cx) * k, y: -(y - cy) * k, z: 0 }))
    if (p.closed && points.length > 1) points.push({ ...points[0]! })
    return { points, closed: p.closed, fill: p.fill ?? false }
  })
}

/** Width over height of a drawn icon. */
export const glyphAspect = (name: DrawnIconName): number => {
  const b = boxOf(DRAWN[name]())
  return (b.x1 - b.x0) / (b.y1 - b.y0)
}

/** One drawn icon. Not sovereign: a prop, an invisible asset. */
export class Icon extends Null {
  /** Which icon. Construction data, not a parameter. */
  glyph: DrawnIconName = "document"
  /** Its larger side. */
  size = length(80)
  tint = color(WHITE)
  /** Pen width in screen px — the film's icons are fine outlines. */
  stroke = length(1.6)
  /** 0 ink only … 1 a black body under each closed outline (hides what lies behind). */
  opaque = completion(0)
  /** Fades the whole icon, ink and body (inherited by every leaf). */
  presence = presence(1)

  body!: Group
  ink!: Group

  protected override compose(): void {
    const runs = glyphPaths(this.glyph, this.size.value)
    const closed = runs.filter((r) => r.closed)
    this.body = this.add(
      new Group({
        members: closed.map((r) => new Shape({ tint: BLACK, fillOpacity: this.opaque.map((o) => o), outlines: [new Line({ points: r.points })] })),
      }),
    )
    this.ink = this.add(new Group({ members: runs.map((r) => new Line({ points: r.points, tint: this.tint, stroke: this.stroke })) }))
  }

  override createAnim(): Anim {
    void this.parts
    return together(restage(Create(this.body), 0, 0.4), restage(Create(this.ink), 0, 1))
  }
}

export interface IconOpts {
  size?: number
  tint?: Color
  stroke?: number
  opaque?: number
  x?: number
  y?: number
  z?: number
}

/**
 * An icon by name, as a holon. Drawn icons are an `Icon`; the composed
 * entries hand out their own holon (RadioTower, Book, HyperAgent at depth 0,
 * Figure's bust) at the same `size` (their whole height; the War Machine's
 * triangle side).
 */
export const icon = (name: IconName, opts: IconOpts = {}): Holon => {
  const { size = 80, tint, stroke, opaque, ...place } = opts
  const look: Overrides = { ...(tint ? { tint } : {}), ...(stroke !== undefined ? { stroke } : {}) }
  switch (name) {
    case "radioTower":
      return new RadioTower({ size, ...look, ...place })
    case "book":
      return new Book({ size, ...look, ...(opaque !== undefined ? { opaque } : {}), ...place })
    case "warMachine":
      return new HyperAgent({ size, depth: 0, power: 0, ...place })
    case "person":
      return new Figure({ height: size, form: 1, tint: WHITE, ...look, ...(opaque !== undefined ? { opaque } : {}), ...place })
    default:
      return new Icon({ glyph: name, size, ...look, ...(opaque !== undefined ? { opaque } : {}), ...place })
  }
}
