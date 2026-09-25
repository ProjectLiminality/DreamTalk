/**
 * platonic.ts — the five Platonic solids as unit-radius vertex/edge data, and
 * a rotate-then-orthographically-project step that turns a 3D wireframe into
 * screen lines. Pure math: solids in, screen segments out; knows nothing about
 * drawing. `vocabulary/Platonic/` turns the segments into strokes and glowing
 * nodes.
 *
 * Four of the five appear at once in the Liminal Consulting Web3 video
 * (docs/reports/web3-recon.md, shot 11, 82–92s): an octahedron top-left, an
 * icosahedron top-right, a tetrahedron bottom-left, a cube bottom-right, each a
 * rotating wireframe with a bright node at every vertex. They are the
 * decentralised answer to the Web2 triangle — many centres, each a whole.
 *
 * WHY FIVE-IN-ONE EARNS ITS PLACE HERE
 *
 * The campaign map flagged a five-solid parameterisation as "wait for a second
 * use" — a single solid does not justify a family. But shot 11 puts FOUR of
 * them on screen together, in one shot, differing only by which solid. That is
 * the second use and the third and the fourth at once: the interesting thing
 * IS the parameterisation (`solid`), exactly DreamTalk's "abilities over
 * classes" test. So all five are built (the dodecahedron never appears in the
 * video, but the family is only honest — and only testable against the classic
 * 4/6/8/12/20 counts — if it is complete). This sits in the
 * fourier.ts / flower.ts / globe.ts tradition: the pure figure, stated once.
 *
 * THE FIGURES ARE EXACT, NOT SAMPLED
 *
 * Every solid's vertices are its closed-form coordinates (the golden ratio φ
 * for the icosahedron and dodecahedron; ±1 corners for the cube; and so on),
 * then each is scaled so its circumradius is exactly 1 — so `radius` in the
 * holon means the same thing for every solid, and the "all vertices are unit
 * distance from the centre" test holds for all five. Edges are the pairs of
 * vertices at the solid's (unique, shortest) edge length, found by distance
 * rather than typed out by hand: the edge SET is a property of the figure, and
 * deriving it means a wrong vertex cannot hide behind a hand-matched edge list.
 *
 * THE PROJECTION, AND WHY BACK EDGES ARE KEPT
 *
 * `project` rotates a solid about two axes (a yaw about y, a pitch about x) and
 * orthographically drops z, returning screen segments plus each endpoint's
 * camera-facing z (so a holon that WANTED to fade far nodes could). Rotation is
 * a pure function of one angle pair, so the holon can make rotation a single
 * `spin` param and scrub backwards exactly — the globe.ts `spin` shape.
 *
 * Unlike the globe, the reference does NOT hide the far side: shot 11's cube
 * shows all twelve edges and its icosahedron is a full tangle of thirty, the
 * classic "wireframe crystal" look where the whole cage is visible at once.
 * So this file culls nothing; every edge projects and the holon draws them all.
 * The near/far z is still returned, unused by the reference look but there for
 * any scene that wants depth-fading — kept because it is free and honest, not
 * because the video needs it.
 */

/** A point in 3D, before projection. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

/** A point in the screen plane. x right, y up. */
export interface Vec2 {
  x: number
  y: number
}

/** One Platonic solid as unit-circumradius data. */
export interface Solid {
  /** Vertices, each exactly distance 1 from the centre. */
  vertices: Vec3[]
  /** Edges as index pairs into `vertices`; i < j, each pair once. */
  edges: [number, number][]
  /** The face count (Euler check / test pinning) — V − E + F = 2. */
  faces: number
}

export type SolidName = "tetrahedron" | "cube" | "octahedron" | "dodecahedron" | "icosahedron"

/** The golden ratio, the icosahedron's and dodecahedron's defining constant. */
const PHI = (1 + Math.sqrt(5)) / 2

/** Scale every vertex so its distance from the origin is exactly 1. */
const toUnit = (verts: Vec3[]): Vec3[] => {
  const r = Math.hypot(verts[0]!.x, verts[0]!.y, verts[0]!.z)
  const k = r > 0 ? 1 / r : 1
  return verts.map((v) => ({ x: v.x * k, y: v.y * k, z: v.z * k }))
}

/**
 * The edge set of a vertex list: every pair at the MINIMUM inter-vertex
 * distance (the edge length), which for a Platonic solid is unique. Found by
 * distance rather than declared, so the edges are a consequence of the
 * vertices and a mistyped coordinate cannot be masked by a matching edge list.
 * `i < j` and each pair appears once.
 */
const edgesByLength = (verts: Vec3[]): [number, number][] => {
  const dist2 = (a: Vec3, b: Vec3) =>
    (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
  // The shortest non-zero pairwise distance is the edge length.
  let min = Infinity
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const d = dist2(verts[i]!, verts[j]!)
      if (d < min) min = d
    }
  }
  // Everything within a small tolerance of that length is an edge (floating
  // point spreads a solid's one true edge length over a few ulps).
  const tol = min * 1e-6
  const edges: [number, number][] = []
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      if (Math.abs(dist2(verts[i]!, verts[j]!) - min) <= tol) edges.push([i, j])
    }
  }
  return edges
}

/** Build a solid from raw vertices: unit-scale them, derive edges, record F. */
const solidFrom = (raw: Vec3[], faces: number): Solid => {
  const vertices = toUnit(raw)
  return { vertices, edges: edgesByLength(vertices), faces }
}

// --- The five figures, as closed-form coordinates --------------------------

/** Tetrahedron: four alternating corners of a cube. 4 V, 6 E, 4 F. */
const tetrahedron = (): Solid =>
  solidFrom(
    [
      { x: 1, y: 1, z: 1 },
      { x: 1, y: -1, z: -1 },
      { x: -1, y: 1, z: -1 },
      { x: -1, y: -1, z: 1 },
    ],
    4,
  )

/** Cube: the eight ±1 corners. 8 V, 12 E, 6 F. */
const cube = (): Solid => {
  const v: Vec3[] = []
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push({ x, y, z })
  return solidFrom(v, 6)
}

/** Octahedron: the six ±axis points. 6 V, 12 E, 8 F. */
const octahedron = (): Solid =>
  solidFrom(
    [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
    ],
    8,
  )

/**
 * Icosahedron: the twelve (0, ±1, ±φ) even permutations. 12 V, 30 E, 20 F.
 */
const icosahedron = (): Solid => {
  const v: Vec3[] = []
  for (const a of [-1, 1]) {
    for (const b of [-PHI, PHI]) {
      v.push({ x: 0, y: a, z: b })
      v.push({ x: a, y: b, z: 0 })
      v.push({ x: b, y: 0, z: a })
    }
  }
  return solidFrom(v, 20)
}

/**
 * Dodecahedron: the icosahedron's dual — the eight cube corners (±1, ±1, ±1)
 * plus the twelve even permutations of (0, ±1/φ, ±φ). 20 V, 30 E, 12 F.
 */
const dodecahedron = (): Solid => {
  const v: Vec3[] = []
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push({ x, y, z })
  const invPhi = 1 / PHI
  for (const a of [-invPhi, invPhi]) {
    for (const b of [-PHI, PHI]) {
      v.push({ x: 0, y: a, z: b })
      v.push({ x: a, y: b, z: 0 })
      v.push({ x: b, y: 0, z: a })
    }
  }
  return solidFrom(v, 12)
}

/** All five, built once and frozen. Keyed by name for the `solid` param. */
export const SOLIDS: Record<SolidName, Solid> = {
  tetrahedron: tetrahedron(),
  cube: cube(),
  octahedron: octahedron(),
  dodecahedron: dodecahedron(),
  icosahedron: icosahedron(),
}

// --- Rotation + orthographic projection ------------------------------------

/**
 * Rotate a point by `yaw` about the y axis then `pitch` about the x axis
 * (radians). Both together give the reference's slow 3D tumble; a holon drives
 * them from one `spin`, so the whole figure is a pure function of one number.
 */
export const rotate = (p: Vec3, yaw: number, pitch: number): Vec3 => {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  // Yaw about y: x/z turn.
  const x1 = p.x * cy + p.z * sy
  const z1 = -p.x * sy + p.z * cy
  const y1 = p.y
  const cx = Math.cos(pitch)
  const sx = Math.sin(pitch)
  // Pitch about x: y/z turn.
  const y2 = y1 * cx - z1 * sx
  const z2 = y1 * sx + z1 * cx
  return { x: x1, y: y2, z: z2 }
}

/** A projected vertex: screen position (scaled by radius) and camera-facing z. */
export interface ProjectedVertex extends Vec2 {
  /** > 0 toward the camera (near face), < 0 away. */
  z: number
}

/** A projected edge: its two screen endpoints and their z (for optional depth). */
export interface ProjectedEdge {
  a: ProjectedVertex
  b: ProjectedVertex
}

/**
 * Rotate a solid by (`yaw`, `pitch`), scale by `radius`, and orthographically
 * drop z — returning both the projected vertices and the projected edges.
 * Nothing is culled: every edge is returned (see the header). z is kept so a
 * caller may fade by depth if it wants; the reference does not.
 */
export const project = (
  solid: Solid,
  radius: number,
  yaw: number,
  pitch: number,
): { vertices: ProjectedVertex[]; edges: ProjectedEdge[] } => {
  const vertices: ProjectedVertex[] = solid.vertices.map((v) => {
    const r = rotate(v, yaw, pitch)
    return { x: r.x * radius, y: r.y * radius, z: r.z }
  })
  const edges: ProjectedEdge[] = solid.edges.map(([i, j]) => ({
    a: vertices[i]!,
    b: vertices[j]!,
  }))
  return { vertices, edges }
}
