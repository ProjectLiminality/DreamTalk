/**
 * Platonic — one of the five Platonic solids as a rotating wireframe crystal:
 * a bright node at every vertex, thin white edges between them, turning about a
 * tilted axis. `solid` picks which of the five; ONE `spin` param drives the
 * rotation, so the whole figure is a pure function of one number and scrubs
 * backwards exactly (the globe.ts / FourierTrace `spin` shape).
 *
 * Four of these stand in the Liminal Consulting Web3 video at once
 * (docs/reports/web3-recon.md, shot 11, 82–92s), one per quadrant —
 * octahedron, icosahedron, tetrahedron, cube — the decentralised crystals that
 * answer the Web2 triangle. The maths (vertices, edges, projection) is
 * src/geometry/platonic.ts; this holon turns projected segments into strokes
 * and nodes.
 *
 * FIVE SOLIDS, ONE HOLON — "abilities over classes".
 *
 * `solid` is a CONSTRUCTION param (like Globe's `continents`): it decides which
 * figure's vertices and edges are built, so it is set once at construction and
 * not animated. To cross-fade one solid into another, run two Platonics. The
 * campaign map asked this family to "wait for a second use"; shot 11 supplies
 * four uses in one frame, so the family is built now, and complete — the
 * dodecahedron rides along even though the video never shows it, because a
 * five-solid holon that omitted one would be a worse thing than a whole one.
 *
 * BACK EDGES ARE DRAWN — the decision the task asked me to make and justify.
 *
 * The globe hides its far side; this holon does NOT. The reference wireframes
 * are transparent crystals: shot 11's cube shows all twelve edges crossing,
 * its icosahedron is the full tangle of thirty. Hiding back edges would turn
 * the "wireframe crystal" look into a solid-shaded blob, which is the opposite
 * of what the frames show. So every edge and every node is drawn, front and
 * back alike. The projection still reports each point's camera-facing z (unused
 * here), so a scene that wanted depth-fading could add it without touching this
 * holon — but the video wants the whole cage lit, and that is what it gets.
 *
 * THE NODES ARE FILLED DOTS. Each vertex is a small white filled Circle; the
 * host's bloom gives it the soft glow the reference nodes carry. The edges are
 * Lines whose endpoints are DERIVED from `spin`, so the whole cage re-projects
 * as it turns — the same derived-geometry pattern Globe uses for coastlines.
 */

import { Circle, Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { color, length, scalar, angle } from "../../src/params"
import { type Color, WHITE } from "../../src/constants"
import { SOLIDS, project, type SolidName } from "../../src/geometry/platonic"

export class Platonic extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /**
   * Which of the five. A construction choice — it decides which vertices and
   * edges the holon is built from — so it is set once and not animated.
   */
  solid: SolidName = "icosahedron"

  /** The circumradius in scene units: the drawn crystal's size. */
  radius = length(120)

  /**
   * Rotation about the tilted axis, radians — THE param to animate. Every
   * node and edge is a pure function of this (and the fixed `pitch` lean), so
   * `platonic.spin.to(TAU)` turns the crystal once and scrubs back exactly.
   */
  spin = scalar(0)

  /**
   * A fixed lean of the rotation axis toward the camera (radians), so the
   * crystal tumbles in three dimensions rather than spinning flat. Set once,
   * not animated — it frames the figure, like Globe's `tilt`. The reference
   * solids sit a little off-axis; a small value matches that.
   */
  pitch = angle(0.42)

  /** The wireframe colour — white on black in the reference. */
  edgeTint = color(WHITE)
  /** Edge stroke width — the reference lines are hairline. */
  edgeStroke = length(1.4)

  /** The node colour and radius — bright filled dots at every vertex. */
  nodeTint = color(WHITE)
  nodeRadius = length(4)

  edges!: Group
  nodes!: Group

  protected override compose(): void {
    const data = SOLIDS[this.solid]

    // --- the edges, derived from spin -------------------------------------
    // One Line per edge; its two points recompute whenever spin (or radius /
    // pitch) changes, bumping geomVersion so the host regenerates the ribbon.
    const edgeLines = data.edges.map((_, e) => {
      const line = new Line({ tint: this.edgeTint, stroke: this.edgeStroke })
      deriveEdge(line, this, e)
      return line
    })
    this.edges = this.add(new Group({ members: edgeLines }))

    // --- the nodes: a filled dot at each vertex ---------------------------
    // Circles carry a POSITION, not a `points` polyline, so they cannot be
    // derived the same way; each node's x/y follows its projected vertex
    // through a bound reading of spin instead (position, unlike a Line's
    // points, IS a param the host reads every frame).
    const nodeCircles = data.vertices.map(
      (_, i) =>
        new Circle({
          radius: this.nodeRadius,
          tint: this.nodeTint,
          fillOpacity: 1,
          stroke: 0,
          // Bind x/y to the projected vertex — position IS a param the host
          // reads every frame, so a derived reading keeps the node on its
          // vertex as the crystal turns (passed as an override, the scan's
          // `follow` path).
          x: this.spin.map(() => this.projectedVertex(i).x),
          y: this.spin.map(() => this.projectedVertex(i).y),
        }),
    )
    this.nodes = this.add(new Group({ members: nodeCircles }))
  }

  /** Vertex `i` projected at the current spin — shared by nodes and edges. */
  private projectedVertex(i: number) {
    const data = SOLIDS[this.solid]
    const { vertices } = project(data, this.radius.value, this.spin.value, this.pitch.value)
    return vertices[i]!
  }
}

/**
 * Give an edge Line derived `points` recomputed whenever the Platonic's spin
 * (or radius / pitch) changes — the Globe.deriveRing pattern. The memo keys on
 * the source scalars and bumps geomVersion on every recompute, so the host's
 * O(1) dirty-check regenerates exactly when the cage turns and never otherwise.
 */
const deriveEdge = (line: Line, holon: Platonic, edgeIndex: number): void => {
  let key: readonly number[] | undefined
  let memo: Vec3Like[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get() {
      const spin = holon.spin.value
      const radius = holon.radius.value
      const pitch = holon.pitch.value
      const next = [spin, radius, pitch]
      if (!key || next.some((v, i) => v !== key![i])) {
        key = next
        const data = SOLIDS[holon.solid]
        const { edges } = project(data, radius, spin, pitch)
        const e = edges[edgeIndex]!
        memo = [
          { x: e.a.x, y: e.a.y, z: 0 },
          { x: e.b.x, y: e.b.y, z: 0 },
        ]
        line.geomVersion++
      }
      return memo
    },
    set(_v) {},
  })
}

/** The white the reference nodes and edges are drawn in. */
export const CRYSTAL_WHITE: Color = WHITE
