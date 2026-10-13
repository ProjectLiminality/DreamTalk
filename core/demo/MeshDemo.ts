/**
 * MeshDemo.ts — general mesh silhouettes (src/geometry/meshlines.ts).
 *
 * A sphere, a cone, a torus, a vase turned on a lathe and a star prism,
 * drawn the platonic way: their creases and their smooth contours as real
 * 3D lines, hidden lines removed — the torus hides its own far side, the
 * vase the back of its rim. The camera turns, and every contour slides
 * round its surface as it must. Then a blue dot becomes the torus: any
 * mesh is a morph target.
 */

import { Dream, render } from "../src/index"
import { together } from "../src/index"
import { BLACK, BLUE } from "../src/constants"
import { Circle } from "../src/parts/index"
import type { Vec3Like } from "../src/parts/primitives"
import { SolidDrawing } from "../src/parts/soliddrawing"
import type { Solid } from "../src/geometry/hiddenline"
import { coneMesh, extrudeMesh, latheMesh, sphereMesh, torusMesh, type Mesh } from "../src/geometry/meshes"
import { MorphCurves, MorphMany } from "../vocabulary/Morph/MorphCurves"

const place = (m: Mesh, at: Vec3Like, tilt = 0): Mesh => ({
  positions: m.positions.map((p) => {
    const y = p.y * Math.cos(tilt) - p.z * Math.sin(tilt)
    const z = p.y * Math.sin(tilt) + p.z * Math.cos(tilt)
    return { x: p.x + at.x, y: y + at.y, z: z + at.z }
  }),
  triangles: m.triangles,
})

const star = Array.from({ length: 10 }, (_, i): [number, number] => {
  const a = (i / 10) * 2 * Math.PI + Math.PI / 2
  const r = i % 2 ? 26 : 62
  return [r * Math.cos(a), r * Math.sin(a)]
})

/** Five shapes on a row — the meshes built once, so their preparation is too. */
class Gallery extends SolidDrawing {
  private meshes = [
    { mesh: place(sphereMesh(70), { x: -480, y: 0, z: 0 }), fill: BLUE },
    { mesh: place(coneMesh(65, 0, 150), { x: -240, y: 0, z: 0 }) },
    { mesh: place(torusMesh(62, 22), { x: 0, y: 0, z: 0 }, 1.0), fill: BLACK },
    { mesh: place(latheMesh([[0, -75], [45, -75], [60, -35], [28, 25], [40, 75]], 64), { x: 240, y: 0, z: 0 }) },
    { mesh: place(extrudeMesh(star, 50), { x: 480, y: 0, z: 0 }, 0.5) },
  ]

  solids(): Solid[] {
    return this.meshes.map(({ mesh, fill }) => ({ kind: "mesh", positions: mesh.positions, triangles: mesh.triangles, fill }))
  }
}

export class MeshDream extends Dream {
  gallery = new Gallery({ observer: this.observer, lineSlots: 96 })

  unfold() {
    this.set(...this.observer.orbit({ phi: 0.35, theta: 0.32 }), ...this.observer.dolly(1050))
    this.stage(this.gallery)
    this.wait(0.8)
    this.play(together(...this.observer.orbit({ phi: -0.45, theta: 0.12 })), 5)
    this.play(together(...this.observer.orbit({ phi: 0.35, theta: 0.6 })), 4)
    this.wait(0.8)
  }
}

/** A blue dot becoming a torus: a mesh is a morph target like any other. */
class Torus extends SolidDrawing {
  private mesh = place(torusMesh(90, 32), { x: 0, y: 0, z: 0 }, 1.1)
  solids(): Solid[] {
    return [{ kind: "mesh", positions: this.mesh.positions, triangles: this.mesh.triangles, fill: BLACK }]
  }
}

export class MeshMorphDream extends Dream {
  torus = new Torus({ observer: this.observer, opacity: 0 })
  dot = new Circle({ radius: 40, tint: BLUE, fillOpacity: 1 })
  there = new MorphCurves([this.dot], [this.torus], { observer: this.observer, opacity: 0 })
  back = new MorphCurves([this.torus], [this.dot], { observer: this.observer, opacity: 0 })

  unfold() {
    this.set(...this.observer.dolly(900))
    this.stage(this.torus)
    this.stage(this.there)
    this.stage(this.back)
    this.wait(0.8)
    this.play(MorphMany(this.there), 3.5)
    this.play(together(...this.observer.orbit({ phi: 0.7, theta: 0.4 })), 3)
    this.play(together(...this.observer.orbit({ phi: 0, theta: 0 })), 3)
    this.play(MorphMany(this.back), 3.5)
    this.wait(0.8)
  }
}

if (import.meta.main) render(MeshDream)
