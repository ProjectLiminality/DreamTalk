/**
 * CoherenceBeacon — a medium that couples reach to coherence.
 *
 * THE CONCEPT (InterBrain film, 37:14–38:14): resonance is "the best
 * measure for the coherence of the song" — signal interferes
 * constructively, noise destructively (35:28) — and the InterBrain makes
 * that the law of broadcast: what is coherent travels, what is not fades.
 * "A medium that couples reach to coherence. Let's refer to this simple
 * yet powerful mechanism as the coherence beacon" (38:10–38:14).
 *
 * THE IMAGE (f11446–f11506, f11491 labelled "Coherence Beacon"): two
 * DreamNodes on one line. Above, the COHERENT one — circle × square =
 * cylinder, the founding holon's resolved dialectic (f11311) — bursting
 * with cyan rays; a radio tower stands on it and blue broadcast rings
 * spread round the tower. Below, the INCOHERENT one — circle + square = a
 * muddied square (f11401) — in a red swarm; it fails, and by f11506 it is
 * gone while the beacon still stands.
 *
 * COMPOSED, NEVER REDRAWN: the nodes are `DreamNode`, the coherent face is
 * the `Cylinder` (made of `holons/Circle` and `holons/Square` through
 * `Cylinder.of` — it IS their intersection), the rays and the swarm are
 * `Field` (burst / swarm). The broadcast rings and the link are this
 * holon's own line work. The radio tower is NOT drawn here: `tower` is a
 * slot (empty by default) that places any holon — `vocabulary/RadioTower`
 * in the film, BEACON.tower·S tall — standing on the node.
 *
 * MEASURED on f11491 (1280×720), in units of S — the nodes' ring radius
 * (33 px), which is `size`. The origin is the coherent node's centre.
 *
 *   RAYS       the burst reaches 67 px from the centre (1 S past the rim);
 *              Field's burst sizes a ray's length off how far it travels,
 *              so `rays` is 1.6 S of travel to get the film's ray length
 *   TOWER      63 px tall, its centre 65 px above the node → 1.9 S, 1.97 S
 *   RINGS      three, radii 48 / 92 / 140 px → 1.45, 2.79, 4.24 S, centred
 *              75 px above the node → 2.27 S (the tower's top)
 *   CYLINDER   lying on its side, 42 × 32 px → its circle 0.48 S
 *   NOISE      the incoherent node 300 px below → 9.1 S; its square 40 px
 *              (rounded) → half-size 0.61 S; the swarm ≈ 1 S deep
 *
 * PARAMS / STATE
 *   coherence  0..1  the beacon's strength: the rays' density and the
 *                    rings' brightness (0: a bare node).
 *   reach      0..1  how far the broadcast has spread: the rings grow out
 *                    from the tower to their radii, innermost first.
 *   noise      0..1  the incoherent node's presence (1 there, 0 faded —
 *                    f11506).
 *   time       a clock: the rays and the swarm flow as it advances.
 */

import { Circle, Group, Line, Null, Rectangle } from "../../src/parts/primitives"
import { color, completion, derive, length, scalar } from "../../src/params"
import { BLACK, BLUE, WHITE, seen } from "../../src/constants"
import { clamp01 } from "../../src/math"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { axis, type StateSpace } from "../../src/automaton"
import type { Holon, Overrides } from "../../src/holon"
import { presence } from "../../src/certainty"
import { DreamNode } from "../DreamNode/DreamNode"
import { Field } from "../Field/Field"
import { Cylinder } from "../Cylinder/Cylinder"
import { Circle as FoundingCircle } from "../../../holons/Circle/Circle"
import { Square as FoundingSquare } from "../../../holons/Square/Square"

/** The construction, in units of S = `size` (see header). */
export const BEACON = {
  rays: 1.6,
  rings: [48 / 33, 92 / 33, 140 / 33] as const,
  ringsY: 75 / 33,
  /** The tower's centre above the node (its height ≈ 63 px → 1.9 S). */
  towerY: 65 / 33,
  tower: 63 / 33,
  cylinder: 16 / 33,
  noiseY: -300 / 33,
  square: 20 / 33,
  swarm: 0.7,
} as const

/** The muddied square (f11401, f11491), sampled off the frame. */
export const MUDDIED = seen(220, 106, 166)

/** A layer whose presence (inherited) fades every stroke in it at once. */
class Layer extends Group {
  there = presence(1)
}

/** The coherent face: the cylinder that IS a circle × a square, lying down. */
export const coherentFace = (S: number): Cylinder => {
  const r = BEACON.cylinder * S
  const circle = new FoundingCircle({ radius: r })
  const square = new FoundingSquare({ size: 2 * r })
  return Cylinder.of(square, circle, { tint: WHITE, stroke: 2.2, b: Math.PI / 2, p: -0.5 })
}

/** The incoherent face: a muddied, rounded square. */
export const incoherentFace = (S: number): Rectangle =>
  new Rectangle({ width: 2 * BEACON.square * S, height: 2 * BEACON.square * S, rounding: 0.35, tint: MUDDIED, stroke: 2 })

export class CoherenceBeacon extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** S — the nodes' ring radius (f11491: 33 px at 720p → 69 units). */
  size = length(69)
  coherence = completion(1)
  reach = completion(1)
  noise = completion(1)
  /** The clock the rays and the swarm flow on. */
  time = scalar(0)
  ringTint = color(BLUE)
  ringStroke = length(2.4)
  linkTint = color(WHITE)

  /** The radio tower standing on the beacon (an icon holon; none by default). */
  tower?: Holon | null = null
  /** Overrides for the two faces (undefined: the film's). */
  face?: Holon = undefined
  noiseFace?: Holon = undefined

  node!: DreamNode
  burst!: Field
  rings: Circle[] = []
  link!: Line
  noiseLayer!: Layer
  noiseNode!: DreamNode
  swarm!: Field

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  protected override compose(): void {
    const S = this.size.value

    // The incoherent node first: the beacon's rays draw over the line.
    this.noiseNode = new DreamNode({
      radius: S,
      face: this.noiseFace ?? incoherentFace(S),
      ...(this.noiseFace ? {} : { faceFill: BEACON.square }),
      ringStroke: 2.4,
    })
    this.swarm = new Field({
      mode: "swarm",
      radius: S * 1.05,
      reach: BEACON.swarm * S,
      stroke: 1.1,
      count: 260,
      time: this.time,
    })
    this.link = new Line({
      tint: this.linkTint,
      stroke: 1.4,
      points: [
        { x: 0, y: -S, z: 0 },
        { x: 0, y: BEACON.noiseY * S + S, z: 0 },
      ],
    })
    // The faltering node's face is black (f11491): its swarm never crosses
    // the ring. (The beacon's cannot be: a fill hides the 3D cylinder.)
    const disc = (y: number) => new Circle({ radius: S, y, tint: BLACK, fillOpacity: 1, stroke: 0 })
    this.noiseLayer = this.add(
      new Layer({ members: [this.link, this.swarm, disc(BEACON.noiseY * S), this.noiseNode] }),
    )
    this.swarm.y.value = BEACON.noiseY * S
    this.noiseNode.y.value = BEACON.noiseY * S
    this.noiseLayer.there.follow(this.noise.map((n) => n))

    this.burst = this.add(
      new Field({
        mode: "burst",
        wholeness: 1,
        radius: S,
        reach: BEACON.rays * S,
        stroke: 1.6,
        count: 3600,
        time: this.time,
        density: derive(() => this.coherence.value),
      }),
    )
    this.node = this.add(
      new DreamNode({
        radius: S,
        face: this.face ?? coherentFace(S),
        ...(this.face ? {} : { faceFill: BEACON.cylinder }),
        ringStroke: 2.4,
      }),
    )

    if (this.tower) {
      this.tower.y.value = BEACON.towerY * S
      this.add(this.tower)
    }

    const n = BEACON.rings.length
    BEACON.rings.forEach((r, i) => {
      // Ring i grows from the tower over its share of `reach`, innermost first.
      const grown = () => clamp01(this.reach.value * n - i)
      const ring = this.add(
        new Circle({
          radius: derive(() => r * S * grown()),
          y: BEACON.ringsY * S,
          tint: this.ringTint,
          stroke: this.ringStroke,
          opacity: derive(() => (grown() > 0 ? this.coherence.value : 0)),
        }),
      )
      this.rings.push(ring)
    })
  }

  /** The beacon's node, its rays, the link and the faltering node, then the rings spread. */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.node), 0, 0.4) as Anim,
      restage(Create(this.burst), 0.2, 0.6) as Anim,
      restage(this.link.creation.sequence(0, 1), 0.3, 0.6) as Anim,
      restage(Create(this.noiseNode), 0.4, 0.75) as Anim,
      restage(Create(this.swarm), 0.5, 0.8) as Anim,
      ...(this.tower ? [restage(Create(this.tower), 0.55, 0.8) as Anim] : []),
      ...this.rings.map((r) => restage(r.creation.sequence(0, 1), 0.6, 1) as Anim),
    )
  }

  /** Walkable: incoherent (dark, gathered, the rival there) ↔ a beacon (bright, spread, the rival gone). */
  override stateSpace(): StateSpace | undefined {
    if (this.coherence.isBound || this.reach.isBound || this.noise.isBound) return undefined
    return {
      axes: [
        axis("coherence", this, {
          faint: { coherence: 0.15, reach: 0.2 },
          beacon: { coherence: 1, reach: 1 },
        }),
        axis("noise", this, { gone: { noise: 0 }, there: { noise: 1 } }),
      ],
    }
  }
}
