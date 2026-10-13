/**
 * Headquarters — a tower with floor lines on a wide podium, drawn as lines
 * in 3D.
 *
 * Unmistakably an office from any side: the podium says "a place people
 * arrive", the tower and its floors say "the many who work here". Two
 * prisms (prism.ts) with true hidden lines, standing on y = 0 so a `Place`
 * (Earth.ts) stands it on the planet. `size` is the podium's width; the
 * floor rings are drawn thinner than the edges, as a building's own
 * hierarchy of lines asks.
 */

import { Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { color, length } from "../../src/params"
import { WHITE } from "../../src/constants"
import { BODY, prism, rect } from "./prism"

const PODIUM = 0.22
const TOWER_W = 0.42
const TOWER_H = 1.15

export class Headquarters extends Null {
  static sovereign = true
  tint = color(WHITE)
  stroke = length(1.5)
  body = color(BODY)
  size = length(9)
  floors = length(6)

  /** Podium + tower height at `size` — what a rising site must sink. */
  static heightFor = (size: number): number => size * (PODIUM + TOWER_H)

  protected override compose(): void {
    const w = this.size.value
    const ink = { tint: this.tint, stroke: this.stroke, body: this.body }
    const podiumH = w * PODIUM
    const towerW = w * TOWER_W
    const towerH = w * TOWER_H
    prism(this, rect(w, podiumH), w * 0.7, ink)
    prism(this, rect(towerW, towerH), towerW, ink, { x: 0, y: podiumH, z: 0 })
    // A ring round the tower's faces at every floor.
    const n = Math.max(0, Math.round(this.floors.value))
    const t = towerW / 2
    for (let f = 1; f < n; f++) {
      const y = podiumH + (towerH * f) / n
      const ring: Vec3Like[] = [
        { x: -t, y, z: t },
        { x: t, y, z: t },
        { x: t, y, z: -t },
        { x: -t, y, z: -t },
        { x: -t, y, z: t },
      ]
      this.add(new Line({ tint: this.tint, stroke: this.stroke.times(0.6), points: ring }))
    }
  }
}
