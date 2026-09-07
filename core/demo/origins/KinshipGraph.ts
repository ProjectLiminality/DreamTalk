/**
 * KinshipGraph.ts — the seven-node graph Scene01 states and Scene11
 * states again, word for word.
 *
 * The source declares this construction TWICE, identically: Scene01 at
 * pitch.py:30-84 and Scene11 at pitch.py:986-1049 — the same seven
 * circles, the same 42 directed edges, the same four hand-picked index
 * lists. That is not a coincidence to be tidied away; it is the video's
 * whole architecture. Scene01 splits the graph and Scene11, five and a
 * half minutes later, rebuilds it and heals the split, and the rhyme
 * only lands because nothing about the figure has moved in between.
 *
 * So it lives here once, and both scenes construct it. What each scene
 * OWNS is the choreography over it.
 *
 *
 * THE FIGURE
 *
 *   central_node = Circle(radius=20)                          at origin
 *   angles       = [(i+1)·2π/6 + π/2 + π/6  for i in 0..5]
 *   node_i       = Circle(radius=20, x=200·cos θ, z=200·sin θ, y=2)
 *
 * Those six angles are 180, 240, 300, 0, 60 and 120 degrees, so the ring
 * is a plain hexagon with a node dead LEFT and a node dead RIGHT — which
 * is what makes the vertical separator of Scene01 a clean cut through
 * the middle rather than a line through a vertex.
 *
 * pydeation's out-of-plane axis is y and its in-plane vertical is z, so
 * the source's `z` is our `y` and its `y=2` is a 2-unit lift toward the
 * camera in our `z`. That lift is depth ordering, not geometry: the
 * nodes ride 2 units in FRONT of the edges' `y=-1`, so a filled node
 * always covers the lines that end inside it. The reference shows the
 * effect directly — on f_00090 every edge is cleanly occluded by the
 * discs at both of its ends.
 *
 *
 * THE EDGES, AND THE FOUR LISTS
 *
 * All 42 DIRECTED edges are built — every ordered pair of distinct nodes
 * — in the source's own nested-loop order:
 *
 *   for node in nodes:  for neighbour in nodes minus node:  edge
 *
 * so index = 6·from + (to adjusted for the skipped self-pair). The
 * source then partitions them by hand-written index:
 *
 *   left      7, 11, 13, 17, 37, 38
 *   right     21, 22, 27, 28, 33, 34
 *   middle    0..5 and 6, 12, 18, 24, 30, 36
 *   remaining the other eighteen
 *
 * Those look arbitrary and are not. Resolved against the loop order they
 * come out perfectly clean:
 *
 *   left      = all six ordered pairs WITHIN {1, 2, 6} — the left triad
 *   right     = all six ordered pairs WITHIN {3, 4, 5} — the right triad
 *   middle    = all twelve spokes to or from the centre
 *   remaining = all eighteen edges that CROSS between the two triads
 *
 * and the node partition matches: `nodes_left = [1, 2, 6]` are the three
 * on the −x side, `nodes_right = [3, 4, 5]` the three on the +x side.
 * So the four lists are the graph's own semantic decomposition, and the
 * eighteen "remaining" edges — the ones Scene01 deletes and Scene11
 * brings back — are exactly the relationships that cross the divide.
 * That is the thesis of the video stated in an index list.
 *
 * They are nevertheless reproduced as the source's literal indices, not
 * as the clean predicate, because the literal list is what was rendered
 * and a predicate is an interpretation of it. The test asserts the two
 * agree; if they ever diverge, the indices win.
 */

import { Circle, Group } from "../../src/parts/primitives"
import { Connection } from "../../src/parts/curves"
import { Holon } from "../../src/holon"
import { PI } from "../../src/constants"
import { STROKE_MAIN } from "../video01/palette"

/** The ring's radius and the nodes' own, from the source. */
export const RING_RADIUS = 200
export const NODE_RADIUS = 20

/** The six outer headings — `(i+1)·2π/6 + π/2 + π/6`, verbatim. */
export const NODE_ANGLES = Array.from(
  { length: 6 },
  (_, i) => ((i + 1) * 2 * PI) / 6 + PI / 2 + PI / 6,
)

/** The source's four edge-index lists, copied literally (pitch.py:66-73). */
export const EDGE_INDICES = {
  left: [7, 11, 13, 17, 37, 38],
  right: [21, 22, 27, 28, 33, 34],
  middle: [0, 1, 2, 3, 4, 5, 6, 12, 18, 24, 30, 36],
  remaining: [
    8, 9, 10, 14, 15, 16, 19, 20, 23, 25, 26, 29, 31, 32, 35, 39, 40, 41,
  ],
} as const

/** The source's node partition: indices into `nodes`, centre first. */
export const NODE_INDICES = {
  left: [1, 2, 6],
  right: [3, 4, 5],
  middle: [0],
} as const

export interface KinshipGraph {
  /** All seven, centre at index 0 then the ring in the source's order. */
  nodes: Circle[]
  /** All 42 directed edges, in the source's nested-loop order. */
  edges: Connection[]
  relatives: Group
  relativesLeft: Group
  relativesRight: Group
  relativesMiddle: Group
  relationships: Group
  relationshipsLeft: Group
  relationshipsRight: Group
  relationshipsMiddle: Group
  relationshipsRemaining: Group
}

/**
 * Build the figure. Both scenes call this and then diverge — the graph
 * is the noun, the play is the verb.
 */
export const kinshipGraph = (): KinshipGraph => {
  const nodes: Circle[] = [new Circle({ radius: NODE_RADIUS, stroke: STROKE_MAIN })]
  for (const angle of NODE_ANGLES) {
    nodes.push(
      new Circle({
        radius: NODE_RADIUS,
        x: RING_RADIUS * Math.cos(angle),
        // the source's z is our y; its y=2 is our z — the depth lift.
        y: RING_RADIUS * Math.sin(angle),
        z: 2,
        stroke: STROKE_MAIN,
      }),
    )
  }

  // The nested loop, exactly: for each node, an edge to every other, in
  // order. `offset_start=0` / `offset_end=0` mean the line runs from
  // centre to centre — the nodes' own fills are what hide the overlap.
  const edges: Connection[] = []
  for (const node of nodes) {
    for (const neighbour of nodes) {
      if (neighbour === node) continue
      edges.push(
        new Connection(node, neighbour, {
          offsetStart: 0,
          offsetEnd: 0,
          z: -1,
          stroke: STROKE_MAIN,
        }),
      )
    }
  }
  for (const edge of edges) edge.line.arrowEnd.value = false

  const pick = <T>(items: T[], idx: readonly number[]): T[] => idx.map((i) => items[i]!)
  const group = (members: Holon[]): Group => new Group({ members })

  const relativesLeft = group(pick(nodes, NODE_INDICES.left))
  const relativesRight = group(pick(nodes, NODE_INDICES.right))
  const relativesMiddle = group(pick(nodes, NODE_INDICES.middle))
  const relationshipsLeft = group(pick(edges, EDGE_INDICES.left))
  const relationshipsRight = group(pick(edges, EDGE_INDICES.right))
  const relationshipsMiddle = group(pick(edges, EDGE_INDICES.middle))
  const relationshipsRemaining = group(pick(edges, EDGE_INDICES.remaining))

  return {
    nodes,
    edges,
    relatives: group([relativesLeft, relativesRight, relativesMiddle]),
    relativesLeft,
    relativesRight,
    relativesMiddle,
    relationships: group([
      relationshipsLeft,
      relationshipsRight,
      relationshipsMiddle,
      relationshipsRemaining,
    ]),
    relationshipsLeft,
    relationshipsRight,
    relationshipsMiddle,
    relationshipsRemaining,
  }
}
