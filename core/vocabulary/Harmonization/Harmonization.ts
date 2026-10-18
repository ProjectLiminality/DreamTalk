/**
 * Harmonization — hub vs pairwise: how N source systems are made to speak
 * one language.
 *
 * The systems (databases — the founding Cylinder, tilted so its caps show)
 * stand on a regular polygon. PAIRWISE, every pair is mapped directly: the
 * complete graph, N(N−1)/2 red chords, growing as N². HUB, one canonical
 * model stands at the centre and each system is mapped once: N blue
 * spokes. A spoke's length is its cost — in the hub picture each system
 * sits at the radius its distance to the model demands, on the same
 * regular angles, so the figure stays radially symmetric.
 *
 * Onboarding is ordered: the first system DEFINES the model (the hub
 * crystallises out of it, so it costs the whole reach), every next one
 * costs its own distance. A system not yet onboarded is drawn in the
 * certainty language — a ghost of the mapping still to be built.
 *
 * THE DEGREES OF FREEDOM (params; walkable via stateSpace()):
 *
 *   topology   0 → 1     pairwise → hub. Each chord a–b bends through the
 *                        centre until it lies along two spokes; the
 *                        systems move in to their cost radii; the
 *                        red web hands over to the blue spokes.
 *   onboarded  0 … N     systems onboarded, in order (integer positions;
 *                        between two, the next spoke is drawing).
 *   costs      0 → 1     each system's cost, written under its name.
 *   labels     0 → 1     names and the mapping count.
 *   radius               the ring.
 *
 * Plain data in (`HarmonizationData`); the mock is generic ("System A…F").
 */

import { derivePoints, Circle, Group, Line, Null } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { completion, derive, length, scalar, type Readable } from "../../src/params"
import { BLUE, RED, WHITE, rgb, type Color } from "../../src/constants"
import type { Holon } from "../../src/holon"
import { certainty, presence } from "../../src/certainty"
import { together, type Anim, type Windowed } from "../../src/anim"
import { axis, toggle, type StateSpace } from "../../src/automaton"
import { smooth } from "../../src/geometry/flowmap"
import {
  chordPolyline,
  hubRadius,
  mappings,
  onboardedness,
  onboardPositions,
  pairs,
  ringDir,
  systemCost,
  type Pt,
} from "../../src/geometry/harmonization"
import { Cylinder } from "../Cylinder/Cylinder"

export interface HarmonizationData {
  /** Around the ring, in onboarding order. `distance` ∈ [0, 1]: how far from the canonical model. */
  systems: { id: string; label: string; distance: number; certainty?: number }[]
  /** The centre's name. */
  model?: string
}

export const MOCK_HARMONIZATION: HarmonizationData = {
  systems: [
    { id: "a", label: "System A", distance: 0.55 },
    { id: "b", label: "System B", distance: 0.3 },
    { id: "c", label: "System C", distance: 0.7 },
    { id: "d", label: "System D", distance: 0.45 },
    { id: "e", label: "System E", distance: 0.85 },
    { id: "f", label: "System F", distance: 0.2 },
  ],
  model: "canonical model",
}

const GREY = rgb(150, 150, 150)
/** About how far the default camera stands (53° fov, a ring this size framed): for the databases' tilt. */
const EYE = 1800
/** How certain a system or spoke not yet onboarded looks: pure conjecture. */
const UNBUILT = 0

/** A layer whose presence fades everything under it at once. */
class Layer extends Group {
  presence = presence(1)
}

/** A spoke not yet built: conjecture. */
class SpokeGhost extends Group {
  certainty = certainty(0)
  presence = presence(1)
}

/** One source system: its database, its name, its cost. */
export class SystemNode extends Group {
  /** Mapped (1) or still a plan (0). */
  certainty = certainty(1)
  systemId = ""
  db!: Cylinder
  name!: Text
  cost!: Text
}

/** The canonical model at the centre. */
export class Hub extends Group {
  certainty = certainty(1)
  presence = presence(1)
  ring!: Circle
  core!: Circle
}

export class Harmonization extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  data: HarmonizationData = MOCK_HARMONIZATION

  /** The ring the systems stand on. */
  radius = length(470)
  /** 0 pairwise (every pair mapped), 1 hub (one canonical model). */
  topology = completion(0)
  /** How many systems are onboarded to the hub, in order (0 … N). */
  onboarded = scalar(0)
  /** Costs written under the names: 1 shown, 0 hidden. */
  costs = completion(0)
  /** Names and the mapping count: 1 shown, 0 off. */
  labels = completion(1)

  systems: SystemNode[] = []
  chords: Line[] = []
  spokes: Line[] = []
  hub!: Hub

  /** A system by id. */
  system(id: string): SystemNode {
    const s = this.systems.find((x) => x.systemId === id)
    if (!s) throw new Error(`Harmonization: no system '${id}' (systems: ${this.systems.map((x) => x.systemId).join(", ")})`)
    return s
  }

  protected override compose(): void {
    const d = this.data
    const N = d.systems.length
    const distances = d.systems.map((s) => s.distance)
    const R = () => this.radius.value
    const hubR = () => R() * 0.16
    const dbR = () => R() * 0.085
    const size = () => R() * 0.052
    // The three phases of the one transition: chords bend in, systems move
    // to their cost, the red web hands over to the blue spokes.
    const bend = () => smooth(0, 0.7, this.topology.value)
    const move = () => smooth(0.3, 0.9, this.topology.value)
    const handover = () => smooth(0.72, 1, this.topology.value)

    /** Where system i stands now. */
    const at = (i: number): Pt => {
      const u = ringDir(i, N)
      const r = R() + (hubRadius(systemCost(distances, i), hubR() + dbR() * 1.6, R()) - R()) * move()
      return { x: u.x * r, y: u.y * r }
    }
    const key = () => [R(), this.topology.value]
    const parts: Holon[] = []

    // --- pairwise: the complete graph ----------------------------------------
    for (const [i, j] of pairs(N)) {
      const chord = new Line({ stroke: 1.6, tint: RED })
      derivePoints(chord, key, () => {
        // Each chord ends at the systems' edges, not their centres.
        const a = at(i), b = at(j)
        const pts = chordPolyline(a, b, bend())
        const trim = (p: Pt, q: Pt): Pt => {
          const dx = q.x - p.x, dy = q.y - p.y
          const l = Math.hypot(dx, dy) || 1
          const r = dbR() * 1.25
          return { x: p.x + (dx / l) * r, y: p.y + (dy / l) * r }
        }
        return [trim(a, pts[1]!), pts[1]!, trim(b, pts[1]!)].map((p) => ({ x: p.x, y: p.y, z: 0 }))
      })
      this.chords.push(chord)
    }
    parts.push(new Layer({ presence: derive(() => 1 - handover()), members: this.chords }))

    // --- hub: the canonical model and its spokes -----------------------------
    const first = () => onboardedness(0, this.onboarded.value)
    const hubSide: Holon[] = []
    d.systems.forEach((_, i) => {
      const built = () => onboardedness(i, this.onboarded.value)
      const ends = () => {
        const p = at(i), u = ringDir(i, N)
        const r = Math.hypot(p.x, p.y)
        return [
          { x: u.x * (r - dbR() * 1.25), y: u.y * (r - dbR() * 1.25), z: 0 },
          { x: u.x * hubR(), y: u.y * hubR(), z: 0 },
        ]
      }
      // The plan: a ghost of the mapping still to build, fading as it is built.
      const ghostLine = new Line({ stroke: 2, tint: BLUE })
      derivePoints(ghostLine, key, ends)
      const plan = new SpokeGhost({ certainty: UNBUILT, presence: derive(() => 1 - smooth(0.5, 1, built())), members: [ghostLine] })
      // The mapping, drawn from the system inward as it is onboarded.
      const spoke = new Line({ stroke: 3, tint: BLUE, creation: derive(() => smooth(0, 0.7, built())) })
      derivePoints(spoke, key, ends)
      this.spokes.push(spoke)
      hubSide.push(plan, spoke)
    })
    parts.push(new Layer({ presence: derive(handover), members: hubSide }))

    const ring = new Circle({ radius: derive(hubR), tint: BLUE, stroke: 3 })
    // The model crystallises out of the first system: its core grows as the first spoke arrives.
    const core = new Circle({
      radius: derive(() => hubR() * 0.6),
      tint: BLUE,
      fillOpacity: 1,
      stroke: 0,
      scale: derive(() => smooth(0.45, 1, first())),
    })
    const modelName = d.model
      ? new Text({
          content: d.model.replace(" ", "\n"),
          size: derive(() => size() * 0.85),
          tint: GREY,
          opacity: derive(() => this.labels.value),
          y: derive(() => -hubR() - size() * 2.7),
        })
      : undefined
    this.hub = new Hub({
      members: modelName ? [ring, core, modelName] : [ring, core],
      presence: derive(() => smooth(0.45, 1, this.topology.value)),
      certainty: derive(() => smooth(0.3, 1, first())),
    })
    this.hub.ring = ring
    this.hub.core = core
    parts.push(this.hub)

    // --- the systems ---------------------------------------------------------
    d.systems.forEach((sys, i) => {
      const u = ringDir(i, N)
      const db = new Cylinder({
        radius: derive(dbR),
        height: derive(() => dbR() * 1.25),
        // Tilted toward the eye so the caps read as a database — and by the
        // angle the default camera sees it from, so every one on the ring
        // shows the same face (perspective would flatten those below).
        p: derive(() => -0.34 + Math.atan(at(i).y / EYE)),
        tint: WHITE,
        stroke: 2.5,
      })
      // Names stand centred over the systems of the upper half and under
      // the rest — a mirror-symmetric reading, the name nearest its database.
      const above = u.y > 0.05
      const text = (content: string, tint: Color, line: number, opacity: Readable<number>, scale: number) =>
        new Text({
          content,
          size: derive(() => size() * scale),
          tint,
          opacity,
          y: derive(() => {
            const c = dbR() * 1.45 + size() * (0.75 + line * 1.2)
            return (above ? c : -c) - size() * scale * 0.35
          }),
        })
      const name = text(sys.label, WHITE, 0, derive(() => this.labels.value * 0.9), 1)
      const cost = text(
        i === 0 ? "defines the model" : `cost ${systemCost(distances, i).toFixed(2)}`,
        RED,
        1,
        derive(() => this.costs.value),
        0.8,
      )
      const known = sys.certainty ?? 1
      const node = new SystemNode({
        systemId: sys.id,
        members: [db, name, cost],
        x: derive(() => at(i).x),
        y: derive(() => at(i).y),
        // Pairwise, every system is mapped (expensively); in the hub picture,
        // only as far as it has been onboarded.
        certainty: derive(() => known * (1 - this.topology.value * (1 - onboardedness(i, this.onboarded.value)))),
      })
      node.db = db
      node.name = name
      node.cost = cost
      this.systems.push(node)
      parts.push(node)
    })

    // --- the count, quietly ----------------------------------------------------
    const m = mappings(N)
    const count = (content: string, shown: () => number) =>
      new Text({
        content,
        size: derive(() => size() * 0.95),
        tint: GREY,
        opacity: derive(() => this.labels.value * shown()),
        y: derive(() => -R() - size() * 4.6),
      })
    parts.push(count(`${m.pairwise} mappings · every pair · N²`, () => 1 - smooth(0.3, 0.7, this.topology.value)))
    parts.push(count(`${m.hub} mappings · one each · N`, () => smooth(0.5, 0.9, this.topology.value)))

    for (const p of parts) this.add(p)
  }

  /** Create: the databases draw on, then the web between them. */
  override createAnim(): Anim {
    void this.parts
    return together(
      ...this.systems.map((s): Windowed => [s.db.creation.sequence(0, 1), 0, 0.55]),
      ...this.chords.map((c): Windowed => [c.creation.sequence(0, 1), 0.4, 1]),
    )
  }

  override stateSpace(): StateSpace {
    const positions: Record<string, { onboarded: number }> = {}
    for (const [name, v] of Object.entries(onboardPositions(this.data.systems.length))) positions[name] = { onboarded: v }
    return {
      axes: [
        axis("topology", this, { pairwise: { topology: 0 }, hub: { topology: 1 } }, {
          key: "t",
          duration: 2.6,
          handles: () => [...this.chords, this.hub],
        }),
        axis("onboarded", this, positions, {
          key: "o",
          duration: 2,
          when: () => this.topology.value > 0.5,
          handles: () => this.systems.map((s) => s.db),
        }),
        toggle("costs", this.costs, { key: "k", off: ["hidden", 0], on: ["shown", 1] }),
      ],
    }
  }
}
