/**
 * SiteSystems — inside a site: its systems.
 *
 * The zoom level you enter when you unpack one production site of an
 * organisation. At the centre stands the ERP — the system of record — as a
 * database: three stacked tiers, labelled with its family. Behind it, a
 * ghost of the same stack standing straight: the FAMILY'S STANDARD form.
 * The site's own stack drifts off it tier by tier — the foundation shared,
 * each layer above used a little more the site's own way — by how far this
 * site's usage convention departs from the standard (`usage`, 0 … 1). Two
 * sites on the same family stand side by side and visibly differ.
 *
 * Around it, on a ring on the ground, what lives OUTSIDE the system of
 * record: spreadsheets (a sheet with its cell grid), local tools (an app
 * window), warehouse systems (a rack with cartons), anything else (a box).
 * Equal angular spacing, mirror-symmetric about the view, never hidden
 * directly behind the ERP (TASTE § arrangements are never random). Each
 * hangs off the ERP by a thin dashed line at most — a hand-off, not an
 * interface. One we only suspect is drawn in the certainty language: a
 * ghost (src/certainty.ts).
 *
 * THE DEGREES OF FREEDOM (params; walkable via stateSpace()):
 *
 *   outside  0 → 1   hidden · shown — the satellites fly out from behind
 *                    the ERP to their places on the ring, one after another.
 *   usage    0 → 1   standard · local — the site's stack stands on the
 *                    family's standard (0) or drifts to its own convention
 *                    (1 = the data's `usage`).
 *   labels   0 → 1   every name on the picture.
 *
 * Built in 3D: the ERP and the satellites are SolidDrawings (visible edges
 * and fills, recomputed for the observer — pass `observer:`), the ring lies
 * on the ground (xz), up is +y. Generic data in (`SiteSystemsData`); the
 * mock is "Site 1" on "ERP A".
 */

import type { Observer } from "../../src/dream"
import { BLUE, RED, WHITE, rgb, type Color } from "../../src/constants"
import { color, completion, derive, scalar, type Readable } from "../../src/params"
import { Group, Line, Null, dashRuns, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { SolidDrawing } from "../../src/parts/soliddrawing"
import type { Solid } from "../../src/geometry/hiddenline"
import { certainty } from "../../src/certainty"
import { together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { toggle, type StateSpace } from "../../src/automaton"
import type { Holon, Overrides } from "../../src/holon"

export type OutsideKind = "spreadsheet" | "localTool" | "warehouse" | "other"

export interface SiteSystemsData {
  site: { label: string; kind?: string }
  /** The system of record: its family (shared across sites), and an optional own name. */
  erp: { family: string; label?: string; certainty?: number }
  /** How far this site's usage convention departs from the family's standard, 0 … 1. */
  usage?: number
  /** What lives outside the system of record. `link` false: not even a hand-off line (default: linked if certain ≥ 0.5). */
  outside: { kind: OutsideKind; label: string; certainty?: number; link?: boolean }[]
}

export const MOCK_SITE_SYSTEMS: SiteSystemsData = {
  site: { label: "Site 1", kind: "production" },
  erp: { family: "ERP A" },
  usage: 0.4,
  outside: [
    { kind: "spreadsheet", label: "capacity" },
    { kind: "spreadsheet", label: "product → machine" },
    { kind: "warehouse", label: "item stock" },
    { kind: "spreadsheet", label: "planning comments" },
    { kind: "localTool", label: "local tool?", certainty: 0.15 },
  ],
}

const GREY = rgb(150, 150, 150)
const DIM = rgb(110, 110, 110)

// ─── Pure layout ────────────────────────────────────────────────────

/** Tier radius, height and the seam between tiers. */
const R = 62
const TIER = 34
const SEAM = 7
const TIERS = 3
const STACK = TIERS * TIER + (TIERS - 1) * SEAM

/**
 * The satellites' angles on the ring, radians from the front (+z, toward
 * the viewer) turning toward +x. Equal spacing, mirror-symmetric about the
 * view axis, and never directly BEHIND the ERP (where it would hide): an
 * even count sits off-axis (4 on the diagonals, 6 on a hexagon at 30°); an
 * odd count puts its last one at the front.
 */
export const ringAngles = (n: number): number[] =>
  Array.from({ length: n }, (_, k) => (2 * Math.PI * (k + (n % 2 === 0 ? 0.5 : 1))) / n)

/** A point on the ground ring (y = 0) at angle `a` from the front. */
export const onRing = (a: number, radius: number): { x: number; z: number } => ({
  x: radius * Math.sin(a),
  z: radius * Math.cos(a),
})

/**
 * Each tier's sideways drift from the family's standard: the foundation
 * (tier 0) stays where the standard stands; each tier above drifts one more
 * `step` × departure. 0 departure → every tier on the standard.
 */
export const tierDrift = (departure: number, tiers: number, step: number): number[] =>
  Array.from({ length: tiers }, (_, k) => k * step * Math.max(0, Math.min(1, departure)))

/**
 * Where a hand-off line starts, as a radius from the ERP's axis: the same
 * for every satellite (the ring stays symmetric), clear of the stack at its
 * full drift (`drift` = the top tier's offset) and, seen from above, clear
 * of the stack's height for the ones behind it — so a line on the ground
 * never runs into the tiers. It points at the system of record; it never
 * plugs into it.
 */
export const linkStart = (ring: number, drift: number): number => Math.max(R * 1.4 + drift, ring * 0.6)

/** How far satellite k of n has flown out at `outside` (0 … 1): staggered, overlapping. */
export const flight = (k: number, n: number, outside: number): number => {
  const span = 0.55
  const start = n > 1 ? (k / (n - 1)) * (1 - span) : 0
  const u = Math.max(0, Math.min(1, (outside - start) / span))
  return u * u * (3 - 2 * u)
}

const smooth = (e0: number, e1: number, x: number): number => {
  const u = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return u * u * (3 - 2 * u)
}

// ─── The ERP: a database of stacked tiers ───────────────────────────

/**
 * The system of record as a database: three discs stacked, each `drift`
 * further to the side than the one below (0: a straight stack — the
 * family's standard form). Base on y = 0, centred on the standard's axis.
 */
export class ErpStack extends SolidDrawing {
  /** Each tier's sideways step from the one below, in units. */
  drift = scalar(0)
  /** The tiers' fill. */
  material = color(BLUE)
  /** Filled (1) or a bare outline (0) — the standard's ghost is bare. */
  filled = completion(1)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 48, faceSlots: 16, ...overrides })
  }

  solids(): Solid[] {
    const fill = this.filled.value > 0.5 ? this.material.value : undefined
    return tierDrift(1, TIERS, this.drift.value).map((dx, k): Solid => ({
      kind: "cylinder",
      center: { x: dx, y: k * (TIER + SEAM) + TIER / 2, z: 0 },
      radius: R,
      height: TIER,
      axis: "y",
      fill,
    }))
  }
}

// ─── The satellites ─────────────────────────────────────────────────

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, fill?: Color): Solid => ({
  kind: "box",
  center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 },
  size: { x: x1 - x0, y: y1 - y0, z: z1 - z0 },
  fill,
})

const panel = (cx: number, cy: number, w: number, h: number, z: number): Solid => ({
  kind: "panel",
  center: { x: cx, y: cy, z },
  size: { x: w, y: h, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
})

/**
 * One thing outside the system of record, by kind — small, standing on the
 * ground (base at y = 0), facing the viewer (+z), about 80 across.
 */
export class OutsideSystem extends SolidDrawing {
  kind: OutsideKind = "spreadsheet"
  material = color(RED)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] & { kind?: OutsideKind } = {}) {
    super({ lineSlots: 72, faceSlots: 24, ...overrides })
  }

  solids(): Solid[] {
    const m = this.material.value
    switch (this.kind) {
      case "spreadsheet": {
        // A sheet standing on its edge, its cell grid on the face: a header
        // row and a key column, then cells.
        const W = 72
        const H = 88
        const D = 5
        const out: Solid[] = [box(-W / 2, W / 2, 0, H, -D / 2, D / 2, m)]
        const cols = 3
        const rows = 4
        const inset = 7
        const cw = (W - 2 * inset) / cols
        const ch = (H - 2 * inset) / rows
        for (let c = 0; c < cols; c++)
          for (let r = 0; r < rows; r++)
            out.push(panel(-W / 2 + inset + (c + 0.5) * cw, inset + (r + 0.5) * ch, cw, ch, D / 2))
        return out
      }
      case "localTool": {
        // An app window: a shallow box, its title bar and its pane.
        const W = 84
        const H = 64
        const D = 16
        const bar = 12
        const inset = 6
        return [
          box(-W / 2, W / 2, 0, H, -D / 2, D / 2, m),
          panel(0, H - inset / 2 - bar / 2, W - 2 * inset, bar, D / 2),
          panel(0, (H - bar - inset) / 2, W - 2 * inset, H - bar - 2 * inset, D / 2),
        ]
      }
      case "warehouse": {
        // A rack: two uprights, three shelves, cartons on the lower two.
        const W = 88
        const H = 92
        const D = 36
        const post = 6
        const deck = 4
        const levels = [0, 42, 84]
        const out: Solid[] = [box(-W / 2, -W / 2 + post, 0, H, -D / 2, D / 2), box(W / 2 - post, W / 2, 0, H, -D / 2, D / 2)]
        for (const y of levels) out.push(box(-W / 2 + post, W / 2 - post, y + 2, y + 2 + deck, -D / 2, D / 2))
        const inner = W - 2 * post
        for (const [y, n] of [[levels[0]! + 2 + deck, 2], [levels[1]! + 2 + deck, 3]] as const) {
          const cw = inner / n
          for (let i = 0; i < n; i++) {
            const x0 = -W / 2 + post + i * cw + 3
            out.push(box(x0, x0 + cw - 6, y, y + 28, -D / 2 + 5, D / 2 - 5, m))
          }
        }
        return out
      }
      default: {
        const S = 56
        return [box(-S / 2, S / 2, 0, S, -S / 2, S / 2, m)]
      }
    }
  }
}

/** A group with one certainty for everything under it (src/certainty.ts). */
export class Known extends Group {
  /** Do we know it is there (1), or only suspect it (→ 0, a ghost)? */
  certainty = certainty(1)
}

/** A satellite: its symbol, its name and its hand-off line — one certainty for all. */
export class Satellite extends Known {
  symbol!: OutsideSystem
  name!: Text
  links: Line[] = []
}

// ─── The symbol ─────────────────────────────────────────────────────

export class SiteSystems extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  data: SiteSystemsData = MOCK_SITE_SYSTEMS

  /** The ring's radius on the ground. */
  ring = scalar(360)
  /** The satellites: hidden behind the ERP (0) or out on the ring (1). */
  outside = completion(1)
  /** The site's usage convention shown (1) or the family's standard (0). */
  usage = completion(1)
  /** Names: 1 shown, 0 off. */
  labels = completion(1)

  erp!: ErpStack
  standard!: ErpStack
  satellites: Satellite[] = []
  titles: Text[] = []
  // Off the field scan (a reference, not a part — registering the observer
  // would reparent it).
  private seen!: { observer?: Observer }

  constructor(overrides: Overrides & { observer?: Observer } = {}) {
    const { observer, ...rest } = overrides
    super(rest)
    this.seen = { observer }
  }

  protected override compose(): void {
    const observer = () => this.seen.observer
    const d = this.data
    const departure = d.usage ?? 0
    const G = -STACK / 2 - 20 // the ground: the picture centred
    const parts: Holon[] = []

    // --- the ERP and its family's standard ---------------------------------
    const erpSure = d.erp.certainty ?? 1
    this.standard = new ErpStack({
      observer: observer(),
      filled: 0,
      tint: GREY,
      stroke: 1.5,
      opacity: derive(() => 0.55 * smooth(0, 0.08, this.usage.value * departure)),
      y: G,
    })
    this.erp = new ErpStack({
      observer: observer(),
      material: BLUE,
      tint: WHITE,
      stroke: 2.5,
      drift: derive(() => R * 0.7 * this.usage.value * departure),
      y: G,
    })
    parts.push(new Known({ members: [this.standard, this.erp], certainty: erpSure }))

    const text = (content: string, tint: Color, size: number, at: () => Vec3Like, opacity: Readable<number>) =>
      new Text({
        content,
        size,
        tint,
        opacity,
        x: derive(() => at().x),
        y: derive(() => at().y),
        z: derive(() => at().z),
      })
    const topDrift = () => tierDrift(1, TIERS, R * 0.7 * this.usage.value * departure).at(-1)!
    const named = derive(() => this.labels.value)
    const family = text(d.erp.label ? `${d.erp.label}\n${d.erp.family}` : d.erp.family, BLUE, 26, () => ({ x: topDrift(), y: G + STACK + 72, z: 0 }), named)
    // The site's name stands at the back of its ring, above it — where no
    // satellite stands (they keep off the axis behind the ERP).
    const site = text(d.site.label, WHITE, 40, () => ({ x: 0, y: G + STACK + 40, z: -this.ring.value - 40 }), named)
    this.titles.push(site, family)
    parts.push(family, site)

    // --- the outside, on the ring --------------------------------------------
    const n = d.outside.length
    const angles = ringAngles(n)
    d.outside.forEach((o, k) => {
      const a = angles[k]!
      const p = derive(() => flight(k, n, this.outside.value))
      const home = () => onRing(a, this.ring.value)
      // From behind the ERP (a little back of its axis) out to its place.
      const at = () => {
        const h = home()
        const t = p.value
        const from = { x: 0, z: -R * 0.6 }
        return { x: from.x + (h.x - from.x) * t, z: from.z + (h.z - from.z) * t }
      }
      const symbol = new OutsideSystem({
        observer: observer(),
        kind: o.kind,
        tint: WHITE,
        stroke: 2,
        opacity: derive(() => smooth(0.25, 0.55, p.value)),
        scale: derive(() => 0.35 + 0.65 * p.value),
      })
      const name = new Text({
        content: o.label,
        size: 20,
        tint: WHITE,
        opacity: derive(() => this.labels.value * smooth(0.7, 1, p.value) * 0.85),
        // In front of its symbol, at its foot: never behind its fill.
        y: -14,
        z: 48,
      })
      // The hand-off: a thin dashed line on the ground, ERP rim → satellite.
      const links: Line[] = []
      // A thing we only suspect has no hand-off we know of: unlinked by default.
      if (o.link ?? (o.certainty ?? 1) >= 0.5) {
        const rim = onRing(a, linkStart(this.ring.value, tierDrift(1, TIERS, R * 0.7 * departure).at(-1)!))
        const end = () => onRing(a, this.ring.value - 52)
        const e = end()
        for (const [s, t] of dashRuns({ x: rim.x, y: 0, z: rim.z }, { x: e.x, y: 0, z: e.z }, 7, 9)) {
          links.push(
            new Line({
              points: [s, t],
              tint: DIM,
              stroke: 1.5,
              opacity: derive(() => smooth(0.8, 1, p.value)),
            }),
          )
        }
      }
      const placed = new Group({ members: [symbol, name], x: derive(() => at().x), z: derive(() => at().z) })
      const sat = new Satellite({
        members: [placed, new Group({ members: links })],
        certainty: o.certainty ?? 1,
        y: G,
      })
      sat.symbol = symbol
      sat.name = name
      sat.links = links
      this.satellites.push(sat)
      parts.push(sat)
    })

    this.add(new Group({ members: parts }))
  }

  /** Create: the site's stack fades up, its names write on (the standard follows `usage`). */
  override createAnim(): Anim {
    void this.parts
    return together(
      [this.erp.opacity.sequence(0, 1), 0, 0.6],
      ...this.titles.map((t, i): [Anim, number, number] => [Create(t), 0.3 + i * 0.15, 0.85 + i * 0.15]),
    )
  }

  override stateSpace(): StateSpace {
    return {
      axes: [
        toggle("outside", this.outside, {
          key: "o",
          duration: 2,
          off: ["hidden", 0],
          on: ["shown", 1],
          handles: () => [this.erp, ...this.satellites],
        }),
        toggle("usage", this.usage, {
          key: "u",
          duration: 1.4,
          off: ["standard", 0],
          on: ["local", 1],
          handles: () => [this.erp, this.standard],
        }),
        toggle("labels", this.labels, { key: "l", off: ["hidden", 0], on: ["shown", 1] }),
      ],
    }
  }
}

