/**
 * Flower.ts — A DreamWeaving
 *
 * The same self-assembling wall, built along a five-petal flower
 * instead of a circle: TheWall.py's own __main__ (:1572-1688), the
 * scene its author used to test the packing against BOTH kinds of
 * curvature at once. Convex lobes need more arc length per brick than
 * a straight run; concave valleys need less — a wall stepped at a
 * fixed spacing would overlap itself on the lobes and gap in the
 * valleys, which is why the packing bisects for exact contact
 * (geometry/packing.ts).
 *
 * Two rows, growth 0 → 1 over 500 frames at 30 fps (:1602-1617), the
 * creatures launching straight up out of the origin on a 500-unit
 * departure vector (:1580).
 *
 * The camera is the framework default rather than the reference orbit
 * — this scene is the packing's own portrait, not a reproduction
 * target; the reproduction scene is TheWall.ts.
 */

import { Dream, render } from "../../src/index"
import { eased } from "../../src/anim"
import { PI } from "../../src/constants"
import { TheWall } from "../../src/parts/thewall"
import { flowerFootprint } from "../../src/geometry/packing"

/** :1601 — the same 500-frame span as the circle scene. */
export const FLOWER_DURATION = 500 / 30

export class FlowerDream extends Dream {
  wall = new TheWall({
    rowCount: 2,
    // C4D's Flower spline: inner 500, outer 1000, 5 petals (:1595-1597).
    footprint: flowerFootprint({ innerRadius: 500, outerRadius: 1000, petals: 5 }),
    spawn: { x: 0, y: 0, z: 0 },
    spawnDirection: { x: 0, y: 500, z: 0 },
  })

  unfold() {
    const observer = this.observer
    observer.radius.defaultValue = 3000
    observer.radius.value = 3000
    // High enough to read the petals as petals.
    observer.theta.defaultValue = PI / 3
    observer.theta.value = PI / 3

    this.play(eased("linear", this.wall.growth.to(1)), FLOWER_DURATION)
  }
}

if (import.meta.main) render(FlowerDream)
