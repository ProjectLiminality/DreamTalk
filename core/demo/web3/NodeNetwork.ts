/**
 * NodeNetwork — shots 10 and 11 of the Liminal Consulting Web3 video: the
 * quote clears, the field collapses to a cluster of white nodes, they wire
 * themselves into one dense decentralised graph, and that graph resolves into
 * four rotating Platonic-solid crystals — the decentralised answer to the Web2
 * triangle. Not one centre, but many nodes, each connected to many.
 *
 * WHAT THE FRAMES SHOW, AND WHERE THEY OVERRULE THE RECON
 *
 * refs/web3/frames/f_00077..f_00092, read directly:
 *   f_00077  the ClarityField still lingers (blue ring, flower-of-life).
 *   f_00080  it has collapsed to a loose cluster of ~40 white dots, no edges.
 *   f_00083–f_00086  a dispersed node cloud; still essentially NO edges.
 *   f_00088–f_00089  ONE dense interconnected graph — many straight thin white
 *                    edges through the cloud, tumbling in 3D.
 *   f_00090–f_00092  the FOUR solids, one per quadrant: octahedron TL,
 *                    icosahedron TR, tetrahedron BL, cube BR, each a glowing
 *                    wireframe rotating.
 *
 * The recon (shot 11 row) lists the four solids FIRST and the dense graph
 * after. The frames say the reverse: cloud → dense graph → the graph RESOLVES
 * into the four ordered crystals. The frames are the truth, so this scene
 * follows them — cluster, then connect-and-densify, then crystallise.
 *
 * All white (#fff) on black; the reference nodes carry a soft bloom, which the
 * host's glow supplies — no colour is lifted here (unlike ClarityField's red,
 * these dots ARE white ink on black, sampled and drawn as-is).
 *
 * WHY THIS IS A SCENE, NOT A HOLON
 *
 * The four crystals ARE holons (vocabulary/Platonic) — the parameterisation
 * over the five solids is the interesting thing, so it earns holon status. But
 * the CLOUD and its edges are a composition: a seeded scatter of dots and the
 * edges within a radius between them. Nothing there is a reusable capability
 * whose knobs would be interesting; it is this particular arrangement, which is
 * what a scene is for (the ClarityField test, applied again).
 *
 * ONE PARAM PER BEAT
 *
 *   gather      — the cluster fades in from nothing (shot 10).
 *   connect     — edges draw on and the graph densifies (shot 11a).
 *   crystallise — the cloud/edges fade out as the four crystals fade in (11b).
 *   spin        — the crystals' shared rotation, turning throughout 11b.
 */

import { Dream } from "../../src/index"
import { Circle, Group, Line, Null } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { hashUnit } from "../../src/geometry/flower"
import { WHITE, TAU } from "../../src/constants"
import { Platonic } from "../../vocabulary/Platonic/Platonic"

/** The seed for the cloud's deterministic scatter — same nodes every render. */
const SEED = 0x00c1a2d

/** How many nodes in the cloud. The frames show roughly forty. */
const NODE_COUNT = 44

/** The cloud's reach from centre, and how close in its densest core sits. */
const CLOUD_RADIUS = 175
const CLOUD_CORE = 28

/** An edge exists between two nodes within this screen distance (the mesh
 *  rule) — near-neighbour wiring, so the cloud reads as a graph and not a
 *  hairball. Capping by radius keeps the count sane: a fully-connected 44-node
 *  cloud is 946 edges; within-radius yields ~120, well under the instancing
 *  threshold and matching the reference's legible density. */
const EDGE_RADIUS = 74
/** No node keeps more than this many edges — trims the densest hubs so the
 *  graph stays even (decentralised), never a few over-connected centres. */
const MAX_DEGREE = 6

/** A cloud node's resting screen position, seeded and organic (anti-lattice).
 *  Radius uses sqrt of a hash so nodes spread by area rather than bunching at
 *  the centre; angle is a second hash. Deterministic — pure function of i. */
const nodeAt = (i: number): { x: number; y: number } => {
  const a = hashUnit(i, 0, SEED) * TAU
  const rr = hashUnit(i, 1, SEED)
  const r = CLOUD_CORE + (CLOUD_RADIUS - CLOUD_CORE) * Math.sqrt(rr)
  return { x: Math.cos(a) * r, y: Math.sin(a) * r }
}

/** The within-radius, degree-capped edge list of the cloud. Deterministic:
 *  pairs are considered in a fixed order and each node's degree is tracked, so
 *  the same nodes always yield the same mesh. */
const meshEdges = (positions: { x: number; y: number }[]): [number, number][] => {
  const degree = new Array(positions.length).fill(0)
  const edges: [number, number][] = []
  // Nearest pairs first, so the cap keeps a node's SHORTEST edges — the mesh
  // stays local and even rather than trimming arbitrarily.
  const candidates: [number, number, number][] = []
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const d = Math.hypot(positions[i]!.x - positions[j]!.x, positions[i]!.y - positions[j]!.y)
      if (d <= EDGE_RADIUS) candidates.push([d, i, j])
    }
  }
  candidates.sort((p, q) => p[0] - q[0])
  for (const [, i, j] of candidates) {
    if (degree[i] >= MAX_DEGREE || degree[j] >= MAX_DEGREE) continue
    edges.push([i, j])
    degree[i]++
    degree[j]++
  }
  return edges
}

/** Where the four crystals sit — the reference's quadrant layout (11b). */
const QUAD = 250 // half the gap between crystal centres, each axis
const QUAD_Y = 150

export class NodeNetworkDream extends Dream {
  /** Shot 10: the cluster fades in from nothing. */
  /**
   * `creation` defaults to 1, so a Null used as a DRIVER starts at its END
   * state. All three must be explicitly zeroed or the scene opens fully
   * formed — the same trap Web2Disintegrating and the patience song hit.
   */
  gather = new Null({ creation: 0 })
  /** Shot 11a: edges draw on and the graph densifies. */
  connect = new Null({ creation: 0 })
  /** Shot 11b: the cloud dissolves as the four crystals arrive. */
  crystallise = new Null({ creation: 0 })

  private positions = Array.from({ length: NODE_COUNT }, (_, i) => nodeAt(i))
  private edgeList = meshEdges(this.positions)

  cloud!: Group
  mesh!: Group

  // The four crystals, one per quadrant, matching the frames' arrangement.
  octa = new Platonic({ solid: "octahedron", radius: 78, x: -QUAD, y: QUAD_Y, opacity: 0 })
  icosa = new Platonic({ solid: "icosahedron", radius: 82, x: QUAD, y: QUAD_Y, opacity: 0 })
  tetra = new Platonic({ solid: "tetrahedron", radius: 82, x: -QUAD, y: -QUAD_Y, opacity: 0 })
  cube = new Platonic({ solid: "cube", radius: 74, x: QUAD, y: -QUAD_Y, opacity: 0 })

  constructor() {
    super()

    // --- the node cloud ---------------------------------------------------
    // A filled white dot at each seeded position; its opacity is the `gather`
    // beat, dimmed again by `crystallise` so the cloud recedes for the solids.
    const dots = this.positions.map(
      (p) =>
        new Circle({
          radius: 3.4,
          x: p.x,
          y: p.y,
          tint: WHITE,
          fillOpacity: 1,
          stroke: 0,
          opacity: this.cloudOpacity,
        }),
    )
    this.cloud = new Group({ members: dots })

    // --- the edges --------------------------------------------------------
    // One Line per mesh edge. Its own `creation` draws it on across the
    // `connect` beat, windowed by edge index so the graph wires up
    // progressively (near pairs first) rather than all at once; its `opacity`
    // rides `crystallise` down with the cloud.
    const n = this.edgeList.length
    const lines = this.edgeList.map(([i, j], e) => {
      const a = this.positions[i]!
      const b = this.positions[j]!
      return new Line({
        points: [
          { x: a.x, y: a.y, z: 0 },
          { x: b.x, y: b.y, z: 0 },
        ],
        tint: WHITE,
        stroke: 1,
        // Each edge appears over its own slice of the connect beat.
        creation: this.connect.creation.map((c) =>
          Math.max(0, Math.min(1, (c - e / n) / (1.4 / n))),
        ),
        opacity: this.meshOpacity,
      })
    })
    this.mesh = new Group({ members: lines })
  }

  /** The cloud dots' opacity: up on `gather`, down on `crystallise`. */
  private get cloudOpacity() {
    return this.gather.creation.map(
      (g) => Math.max(0, Math.min(1, g)) * (1 - this.crystallise.creation.value),
    )
  }

  /** The edges' opacity: present once wired, faded out on `crystallise`. */
  private get meshOpacity() {
    return this.crystallise.creation.map((c) => 1 - Math.max(0, Math.min(1, c)))
  }

  private get crystals(): Platonic[] {
    return [this.octa, this.icosa, this.tetra, this.cube]
  }

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.mesh)
    this.stage(this.cloud)
    for (const c of this.crystals) this.stage(c)

    // Shot 10 — the field collapses to a cluster of nodes.
    this.say("The field collapses to a cluster of nodes.")
    this.play(this.gather.creation.to(1), 3)
    this.wait(1)

    // Shot 11a — the nodes wire themselves into one dense decentralised graph.
    this.say("The nodes connect — one dense, decentralised graph.")
    this.play(this.connect.creation.to(1, { easing: "linear" }), 4)
    this.wait(0.5)

    // Shot 11b — the graph resolves into the four Platonic crystals, turning.
    this.say("And it resolves into the four crystals, each a whole.", { hold: true })
    this.play(
      together(
        this.crystallise.creation.to(1),
        // The crystals fade in as the cloud fades out.
        ...this.crystals.map((c) => c.opacity.to(1)),
        // …and turn throughout, so rotation-as-a-param is visible.
        ...this.crystals.map((c) => c.spin.to(TAU * 0.55, { easing: "linear" })),
      ),
      5,
    )
    this.wait(1)
  }
}
