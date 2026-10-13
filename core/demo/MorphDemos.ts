/**
 * MorphDemos.ts — two DreamWeavings for the universal morph
 * (vocabulary/Morph/MorphCurves.ts).
 *
 * `morph-lines-circle`: twelve arcs of varied length, scattered, become
 * ONE circle — each arc a complementary piece of the circumference, in
 * proportion to its length, landing on the side of the circle it came
 * from — and come apart again.
 *
 * `morph-dot-truck`: a blue dot (a particle in a flow) lets go of its
 * fill, its outline splits into as many pieces as the truck has visible
 * edges, and the pieces fly onto the truck's 3D outline. The camera then
 * turns: the lines were never drawn on a plane, they stand where they
 * belong in space. It turns back, and the truck becomes the dot again.
 */

import { Dream, render } from "../src/index"
import { Create, together } from "../src/index"
import { BLUE, WHITE } from "../src/constants"
import { Circle, Group, Line, type Vec3Like } from "../src/parts/index"
import { Truck } from "../vocabulary/Truck/Truck"
import { MorphCurves, MorphMany } from "../vocabulary/Morph/MorphCurves"

/** An arc as an open polyline: centre, radius, start angle, sweep (radians). */
const arc = (cx: number, cy: number, r: number, a0: number, sweep: number): Vec3Like[] => {
  const n = Math.max(8, Math.ceil((Math.abs(sweep) * r) / 6))
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (sweep * i) / n
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), z: 0 }
  })
}

// Twelve arcs, hand-placed around the frame, lengths from ~60 to ~420.
const ARCS: [number, number, number, number, number][] = [
  [-820, 330, 90, 0.3, 1.6],
  [-540, 420, 140, 3.6, 1.2],
  [-180, 470, 60, 4.0, 2.4],
  [240, 430, 120, 3.3, 2.8],
  [640, 360, 70, 1.0, 1.5],
  [880, 120, 110, 2.2, 2.2],
  [760, -260, 160, 1.7, 1.4],
  [420, -440, 80, 0.4, 2.9],
  [0, -470, 190, 0.9, 1.0],
  [-430, -400, 100, 5.0, 2.0],
  [-800, -250, 130, 0.2, 2.6],
  [-900, 60, 50, 1.4, 3.6],
]

export class MorphLinesCircleDream extends Dream {
  arcs = ARCS.map(([cx, cy, r, a0, s]) => new Line({ points: arc(cx, cy, r, a0, s), tint: WHITE }))
  circle = new Circle({ radius: 230, tint: BLUE, opacity: 0 })
  // One closed target: snapping its seam onto an arc boundary costs no length,
  // and keeps every arc whole (twelve pieces, not thirteen).
  gather = new MorphCurves(this.arcs, [this.circle], { opacity: 0, snap: 0.05 })
  scatter = new MorphCurves([this.circle], this.arcs, { opacity: 0, snap: 0.05 })

  unfold() {
    this.stage(this.circle)
    this.stage(this.gather)
    this.stage(this.scatter)
    this.play(together(...this.arcs.map((a) => Create(a))), 1.5)
    this.wait(0.6)
    this.play(MorphMany(this.gather), 3)
    this.wait(1)
    this.play(MorphMany(this.scatter), 3)
    this.wait(1)
  }
}

// The camera's resting view: front-left of the truck, a little above.
const PHI = 0.62
const THETA = 0.3

export class MorphDotTruckDream extends Dream {
  // The dot faces the camera: tilted back by the elevation, then turned
  // by the azimuth (child p, parent h — rotHPB's order).
  dot = new Circle({ radius: 46, tint: BLUE, fillOpacity: 1, p: -THETA })
  facing = new Group({ members: [this.dot], h: PHI })
  truck = new Truck({ observer: this.observer, opacity: 0 })
  toTruck = new MorphCurves([this.dot], [this.truck], { observer: this.observer, opacity: 0 })
  toDot = new MorphCurves([this.truck], [this.dot], { observer: this.observer, opacity: 0 })

  unfold() {
    this.set(...this.observer.orbit({ phi: PHI, theta: THETA }), ...this.observer.dolly(950))
    this.stage(this.facing)
    this.stage(this.truck)
    this.stage(this.toTruck)
    this.stage(this.toDot)
    this.wait(1)
    this.play(MorphMany(this.toTruck), 4)
    this.wait(0.8)
    this.play(together(...this.observer.orbit({ phi: 1.35, theta: 0.5 })), 3)
    this.wait(0.6)
    this.play(together(...this.observer.orbit({ phi: PHI, theta: THETA })), 3)
    this.wait(0.6)
    this.play(MorphMany(this.toDot), 4)
    this.wait(1)
  }
}

if (import.meta.main) render(MorphDotTruckDream)
