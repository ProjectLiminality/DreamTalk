/**
 * Fire — the campfire: a flame over two crossed logs.
 *
 * THE CONCEPT (InterBrain film, 19:38): "we would meet around the campfire
 * to freely exchange our knowledge" — the fire people gather round, the
 * hearth of SandTalk and of every tribe (f5941, f6091, f8656), and later
 * the "digital campfire" of the video call (32:51).
 *
 * THE DRAWING IS KEYNOTE'S, READ ONCE. The film's flame is Keynote's built-in
 * `Fire` icon, grouped with a pair of crossed logs — the same group PL02's
 * deck carries as bezier paths (slide 7, the deck's own SandTalk: the
 * `Fire_80` shape and the log outline it is grouped with). Those paths are
 * the measured reference and this file READS them from the generated deck
 * module rather than copying numbers, so the one campfire every DreamSong
 * imports is the deck's, normalised: centred on the group's box, `size` the
 * whole height (flame tip to the logs' underside), y up.
 *
 * In the film the icon is red ink over a black body (the circle of
 * conversation passes BEHIND it, f8656), which is the deck's own fill:
 * `opaque` washes each outline black under its ink, so whatever was drawn
 * before the fire is hidden by it.
 */

import { Group, Line, Null, Shape, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, length } from "../../src/params"
import { BLACK, RED } from "../../src/constants"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { slide07 } from "../Slides/assets/pl02/slide07"

type Raw = readonly number[]

/** The flame (Keynote `Fire_80`) and the logs grouped with it, from PL02 slide 7. */
const flameShape = slide07.shapes.find((s) => s.icon === "Fire_80")!
const fireGroup = slide07.groups.find((g) => g.members.includes(flameShape.id))!
const logShape = slide07.shapes.find((s) => s.id !== flameShape.id && fireGroup.members.includes(s.id))!

export const FLAME_RAW: Raw = flameShape.subpaths[0]!
export const LOGS_RAW: Raw = logShape.subpaths[0]!

/** The group's box, in slide units (y down). */
const box = (() => {
  const all = [...FLAME_RAW, ...LOGS_RAW]
  const xs = all.filter((_, i) => i % 2 === 0)
  const ys = all.filter((_, i) => i % 2 === 1)
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
})()

/** Width over height of the whole campfire (≈ 0.81). */
export const FIRE_ASPECT = (box.x1 - box.x0) / (box.y1 - box.y0)

/** A raw slide path → a closed polyline for a fire of height `size`, centred, y up. */
export const firePath = (raw: Raw, size: number): Vec3Like[] => {
  const k = size / (box.y1 - box.y0)
  const cx = (box.x0 + box.x1) / 2
  const cy = (box.y0 + box.y1) / 2
  const pts: Vec3Like[] = []
  for (let i = 0; i < raw.length; i += 2) pts.push({ x: (raw[i]! - cx) * k, y: -(raw[i + 1]! - cy) * k, z: 0 })
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  if (Math.hypot(first.x - last.x, first.y - last.y) > 1e-9) pts.push({ ...first })
  return pts
}

export class Fire extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The whole height, flame tip to the logs' underside. */
  size = length(120)
  /** The film's red (f8656); the deck draws it white. */
  tint = color(RED)
  /** Pen width in screen px (the film's fine line). */
  stroke = length(2.2)
  /** 0 ink only … 1 a black body under the ink hides what lies behind. */
  opaque = completion(1)

  logs!: Line
  flame!: Line
  body!: Group

  /** Half its height — how far it reaches from its centre. */
  get reach(): number {
    return this.size.value / 2
  }

  protected override compose(): void {
    const s = this.size.value
    const wash = (raw: Raw) =>
      new Shape({ tint: BLACK, fillOpacity: this.opaque.map((o) => o), outlines: [new Line({ points: firePath(raw, s) })] })
    // The bodies first: attach order is composite order.
    this.body = this.add(new Group({ members: [wash(LOGS_RAW), wash(FLAME_RAW)] }))
    this.logs = this.add(new Line({ points: firePath(LOGS_RAW, s), tint: this.tint, stroke: this.stroke }))
    this.flame = this.add(new Line({ points: firePath(FLAME_RAW, s), tint: this.tint, stroke: this.stroke }))
  }

  /** The logs are laid, then the flame rises from them. */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.body), 0, 0.3),
      restage(this.logs.creation.sequence(0, 1), 0, 0.5),
      restage(this.flame.creation.sequence(0, 1), 0.35, 1),
    )
  }
}
