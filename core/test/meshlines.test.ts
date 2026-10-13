/**
 * General mesh silhouettes (geometry/meshes.ts, meshlines.ts, hiddenline's
 * `mesh` solids).
 */

import { describe, expect, test } from "bun:test"
import { coneMesh, extrudeMesh, latheMesh, sphereMesh, torusMesh, type Mesh } from "../src/geometry/meshes"
import { meshLines, prepareMesh } from "../src/geometry/meshlines"
import { hiddenLineDrawing, solidBounds, type Solid } from "../src/geometry/hiddenline"
import type { Vec3Like } from "../src/parts/primitives"
import { BLUE } from "../src/constants"

const len = (l: Vec3Like[]) => l.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - l[i]!.x, p.y - l[i]!.y, p.z - l[i]!.z), 0)
const total = (ls: Vec3Like[][]) => ls.reduce((s, l) => s + len(l), 0)
const mesh = (m: Mesh, fill?: typeof BLUE): Solid => ({ kind: "mesh", positions: m.positions, triangles: m.triangles, fill })
const star: [number, number][] = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * 2 * Math.PI
  const r = i % 2 ? 20 : 50
  return [r * Math.cos(a), r * Math.sin(a)]
})

describe("generators", () => {
  const all: [string, Mesh, number?][] = [
    ["sphere", sphereMesh(50), (4 / 3) * Math.PI * 50 ** 3],
    ["cone", coneMesh(40, 0, 100), (Math.PI * 40 ** 2 * 100) / 3],
    ["frustum", coneMesh(40, 20, 100)],
    ["torus", torusMesh(50, 15), 2 * Math.PI ** 2 * 50 * 15 ** 2],
    ["lathe", latheMesh([[0, -50], [30, -50], [40, -20], [20, 20], [25, 50]])],
    ["extrusion", extrudeMesh(star, 30)],
  ]
  for (const [name, m, expected] of all) {
    test(`${name}: closed, consistently wound, outward`, () => {
      const dir = new Map<string, number>()
      for (const [a, b, c] of m.triangles)
        for (const [u, v] of [[a, b], [b, c], [c, a]] as const) dir.set(`${u},${v}`, (dir.get(`${u},${v}`) ?? 0) + 1)
      for (const [k, n] of dir) {
        const [u, v] = k.split(",")
        expect(n).toBe(1)
        expect(dir.get(`${v},${u}`)).toBe(1)
      }
      let vol = 0
      for (const [a, b, c] of m.triangles) {
        const p = m.positions[a]!
        const q = m.positions[b]!
        const r = m.positions[c]!
        vol += (p.x * (q.y * r.z - q.z * r.y) - p.y * (q.x * r.z - q.z * r.x) + p.z * (q.x * r.y - q.y * r.x)) / 6
      }
      expect(vol).toBeGreaterThan(0)
      if (expected) expect(vol / expected).toBeGreaterThan(0.97)
    })
  }
})

describe("contours", () => {
  test("a sphere's outline is one smooth loop at the true silhouette radius", () => {
    const eye = { x: 0, y: 0, z: 1000 }
    const lines = meshLines(prepareMesh(sphereMesh(50, 64, 32), 0.6), (p) => ({ x: eye.x - p.x, y: eye.y - p.y, z: eye.z - p.z }), 0.6)
    expect(lines.length).toBe(1)
    const loop = lines[0]!
    expect(loop[0]).toEqual(loop.at(-1)!)
    // The silhouette circle from an eye at distance D: radius r·√(1 − r²/D²), at z = r²/D.
    const rr = 50 * Math.sqrt(1 - 2500 / 1e6)
    for (const p of loop) expect(Math.abs(Math.hypot(p.x, p.y) - rr)).toBeLessThan(0.5)
  })

  test("a cone's contours run from its rim to its apex", () => {
    const eye = { x: 300, y: 250, z: 900 }
    const d = hiddenLineDrawing([mesh(coneMesh(65, 0, 150))], { eye })
    // Compared as SEEN (directions from the eye): mesh lines sit a facet
    // toward the eye along their own line of sight, which projects the same.
    const apex = { x: 0, y: 75, z: 0 }
    const dir = (p: Vec3Like) => {
      const v = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z }
      const l = Math.hypot(v.x, v.y, v.z)
      return { x: v.x / l, y: v.y / l, z: v.z / l }
    }
    const a = dir(apex)
    const touches = d.lines.some((l) => l.some((p) => { const q = dir(p); return Math.hypot(q.x - a.x, q.y - a.y, q.z - a.z) < 0.002 }))
    expect(touches).toBe(true)
    // rim front arc + the two generators (each ≈ the slant height 163.5)
    expect(total(d.lines)).toBeGreaterThan(2 * 160)
  })

  test("a torus hides part of itself", () => {
    const eye = { x: 0, y: 500, z: 900 }
    const m = torusMesh(62, 22)
    const raw = meshLines(prepareMesh(m, 0.6), (p) => ({ x: eye.x - p.x, y: eye.y - p.y, z: eye.z - p.z }), 0.6)
    const d = hiddenLineDrawing([mesh(m)], { eye })
    expect(total(d.lines)).toBeLessThan(total(raw) * 0.95)
    expect(total(d.lines)).toBeGreaterThan(total(raw) * 0.5)
  })

  test("an extrusion's edges are creases: a star prism seen from above draws its outline", () => {
    const d = hiddenLineDrawing([mesh(extrudeMesh(star, 30))], { toward: { x: 0, y: 1, z: 0 } })
    // Ten edges of √(50² + 20² − 2·50·20·cos 36°) each — the top cap, exactly.
    const edge = Math.sqrt(2500 + 400 - 2000 * Math.cos(Math.PI / 5))
    expect(total(d.lines)).toBeCloseTo(10 * edge, 3)
  })
})

describe("occlusion and fills", () => {
  test("a sphere hides a box behind it; the box does not hide the sphere", () => {
    const eye = { x: 0, y: 0, z: 1000 }
    const box: Solid = { kind: "box", center: { x: 0, y: 0, z: -200 }, size: { x: 40, y: 40, z: 40 } }
    const d = hiddenLineDrawing([mesh(sphereMesh(80)), box], { eye })
    // The box's edges all lie behind the sphere's disc: nothing of them is left.
    for (const l of d.lines) for (const p of l) expect(p.z).toBeGreaterThan(-170)
  })

  test("a filled mesh comes back as a surface, not as painter faces", () => {
    const d = hiddenLineDrawing([mesh(sphereMesh(30), BLUE)], { eye: { x: 0, y: 0, z: 1000 } })
    expect(d.faces.length).toBe(0)
    expect(d.surfaces?.length).toBe(1)
    expect(d.surfaces![0]!.fill).toEqual(BLUE)
  })

  test("solidBounds covers every kind", () => {
    const b = solidBounds(mesh(sphereMesh(30)))
    expect(b.hi.x).toBeCloseTo(30, 6)
    expect(b.lo.y).toBeCloseTo(-30, 6)
    const c = solidBounds({ kind: "cylinder", center: { x: 0, y: 0, z: 0 }, radius: 10, height: 40, axis: "y" })
    expect(c.hi).toEqual({ x: 10, y: 20, z: 10 })
  })
})
