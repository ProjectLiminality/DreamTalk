/**
 * RadioTower — BROADCAST: "the written word and broadcast" (InterBrain film,
 * 21:40), the second of the two innovations that changed the physics of the
 * medium. The lattice mast with three rings of signal round its tip, on the
 * Ancient → Modern arrow (f6496, f10441), standing on the open Book in the
 * red field (f6586), inside the coherence beacon's circle (f11071), and as
 * one of the arms race's generations (f931, f2836).
 *
 * THE DRAWING IS KEYNOTE'S, READ ONCE. The film's tower is Keynote's built-in
 * `Radio Tower` icon — the same one PL02's deck carries as bezier paths
 * (`Radio Tower_245`, slide 15): sixteen closed outlines, the three ring
 * bands first (outer → inner), then the mast with its ball, then the twelve
 * little triangles of the lattice. This file READS them from the generated
 * deck module rather than copying numbers, normalised: centred on the icon's
 * box, `size` its whole height, y up.
 *
 * The film draws the icon SOLID (f6496, f6586, f11071: the ring bands and the
 * mast read as white glyph, the lattice's little triangles as holes): `solid`
 * fills the outlines with the ink, even-odd, so the triangles stay open;
 * at 0 it is the outline alone.
 *
 * THE STATE (`broadcast`, 0..1) is the signal: at 0 the bare mast, then the
 * rings come on inner → outer, each in its third of the axis — the beacon's
 * rings going out (f11071). 1 is the icon as the film shows it.
 */

import { Group, Line, Null, Shape, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, derive, length } from "../../src/params"
import { WHITE } from "../../src/constants"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { toggle, type StateSpace } from "../../src/automaton"
import { slide15 } from "../Slides/assets/pl02/slide15"

type Raw = readonly number[]

const shape = slide15.shapes.find((s) => s.icon === "Radio Tower_245")!

/** The deck's sixteen outlines, slide units (y down). */
export const TOWER_RAW: readonly Raw[] = shape.subpaths
/** How many of them are the ring bands (outer → inner), the rest the mast. */
export const RING_COUNT = 3

const box = (() => {
  const xs = TOWER_RAW.flatMap((r) => r.filter((_, i) => i % 2 === 0))
  const ys = TOWER_RAW.flatMap((r) => r.filter((_, i) => i % 2 === 1))
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
})()

/** Width over height of the icon (≈ 0.69). */
export const TOWER_ASPECT = (box.x1 - box.x0) / (box.y1 - box.y0)

/** A raw deck outline → a closed polyline for a tower `size` tall, centred, y up. */
export const towerPath = (raw: Raw, size: number): Vec3Like[] => {
  const k = size / (box.y1 - box.y0)
  const cx = (box.x0 + box.x1) / 2
  const cy = (box.y0 + box.y1) / 2
  const pts: Vec3Like[] = []
  for (let i = 0; i + 1 < raw.length; i += 2) pts.push({ x: (raw[i]! - cx) * k, y: -(raw[i + 1]! - cy) * k, z: 0 })
  const a = pts[0]!
  const b = pts[pts.length - 1]!
  if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-9) pts.push({ ...a })
  return pts
}

/** Ring `i` (0 = inner … 2 = outer)'s presence at a given `broadcast`. */
export const ringPresence = (broadcast: number, i: number): number =>
  Math.min(1, Math.max(0, broadcast * RING_COUNT - i))

export class RadioTower extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The whole height, the outer ring's top to the legs' feet. */
  size = length(160)
  tint = color(WHITE)
  /** Pen width in screen px (f6496: the icon's fine outline). */
  stroke = length(2)
  /** 0 the outline alone … 1 the solid glyph (the film's). */
  solid = completion(1)
  /** The signal: 0 the bare mast … 1 all three rings (inner first). */
  broadcast = completion(1)

  body!: Group
  mast!: Group
  /** Inner → outer. */
  rings: Line[] = []

  protected override compose(): void {
    const ink = (raw: Raw, presence?: () => number) => {
      const line = new Line({ tint: this.tint, stroke: this.stroke, ...(presence ? { opacity: derive(presence) } : {}) })
      derivePoints(line, () => [this.size.value], () => towerPath(raw, this.size.value))
      return line
    }
    const ringIndex = (k: number) => RING_COUNT - 1 - k // the deck lists them outer → inner
    const outline = (raw: Raw) => {
      const l = new Line({})
      derivePoints(l, () => [this.size.value], () => towerPath(raw, this.size.value))
      return l
    }
    const fill = (raws: readonly Raw[], presence: () => number) =>
      new Shape({ tint: this.tint, fillOpacity: derive(() => this.solid.value * presence()), outlines: raws.map(outline) })
    // The mast's silhouette and its twelve triangles wash as ONE even-odd
    // area (the triangles are its holes); each ring band is its own.
    this.body = this.add(
      new Group({
        members: [
          fill(TOWER_RAW.slice(RING_COUNT), () => 1),
          ...TOWER_RAW.slice(0, RING_COUNT).map((raw, k) => fill([raw], () => ringPresence(this.broadcast.value, ringIndex(k)))),
        ],
      }),
    )
    this.mast = this.add(new Group({ members: TOWER_RAW.slice(RING_COUNT).map((raw) => ink(raw)) }))
    const rings = TOWER_RAW.slice(0, RING_COUNT).map((raw, k) => ink(raw, () => ringPresence(this.broadcast.value, ringIndex(k))))
    this.rings = rings.reverse()
    for (const r of this.rings) this.add(r)
  }

  /** The mast rises, then the rings go out from its tip, inner first. */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.body), 0, 0.4),
      restage(Create(this.mast), 0, 0.55),
      ...this.rings.map((r, i) => restage(r.creation.sequence(0, 1), 0.45 + i * 0.15, 0.75 + i * 0.08)),
    )
  }

  /** Walkable (src/automaton.ts): silent ↔ broadcasting. */
  override stateSpace(): StateSpace | undefined {
    if (this.broadcast.isBound) return undefined
    return { axes: [toggle("broadcast", this.broadcast, { off: ["silent", 0], on: ["broadcasting", 1], duration: 1.2, handles: [this] })] }
  }
}
