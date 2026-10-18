/**
 * FlowRoadDemo — twenty flows become roads, their particles trucks.
 *
 * Three stages stacked along the view's depth (rings at z = −280, 0, 280),
 * ten flows across each gap in radial symmetry, every flow a Stream of
 * blue dots. One param per flow, `concrete`, walks it from line and dots
 * to road and trucks (vocabulary/Road/FlowRoad.ts) — the flows never
 * stop. Orthographic, as the abstract plane is. Mock geometry only.
 *
 * `?scene=flow-road`. Free play: the streams' clocks keep running.
 */

import { Dream, render } from "../src/index"
import { Create, together, type Anim } from "../src/index"
import { BLUE, WHITE } from "../src/constants"
import { derive } from "../src/params"
import { Circle, Line, type Vec3Like } from "../src/parts/index"
import { Stream } from "../vocabulary/Stream/Stream"
import { FlowRoad } from "../vocabulary/Road/FlowRoad"

const R = 230
const GAP = 280
const PER_GAP = 10

/** A flow across one gap: from angle θ on one ring to θ + a tenth of a turn on the next, bowing outward. */
const channel = (z0: number, theta: number): Vec3Like[] => {
  const t1 = theta + Math.PI / PER_GAP
  return Array.from({ length: 41 }, (_, i) => {
    const u = i / 40
    const a = theta + (t1 - theta) * u
    const r = R + 70 * Math.sin(Math.PI * u)
    return { x: r * Math.cos(a), y: r * Math.sin(a), z: z0 + GAP * u }
  })
}

const flows = [-GAP, 0].flatMap((z0, g) =>
  Array.from({ length: PER_GAP }, (_, k) => ({ z0, theta: ((k + g * 0.5) / PER_GAP) * 2 * Math.PI })),
)

export class FlowRoadDream extends Dream {
  rings = [-GAP, 0, GAP].map((z) => new Circle({ radius: R, z, tint: WHITE, opacity: 0.6 }))

  roads: FlowRoad[] = []
  streams: Stream[] = flows.map(({ z0, theta }, k) => {
    const road = () => this.roads[k]!
    return new Stream({
      path: channel(z0, theta),
      count: 14,
      spacing: 50,
      speed: 45,
      radius: 6,
      tint: BLUE,
      // The abstract flow hands over to the road as the morph begins.
      opacity: derive(() => road().abstractShown()),
      symbol: (o) =>
        new Circle({ radius: 6, tint: BLUE, stroke: 0, fillOpacity: derive(() => road().dotFill()), ...o }),
    })
  })
  lines = flows.map(({ z0, theta }, k) => new Line({ points: channel(z0, theta), tint: WHITE, stroke: 2, opacity: derive(() => this.roads[k]!.abstractShown()) }))

  constructor() {
    super()
    this.roads = flows.map(({ theta }, k) => {
      const s = this.streams[k]!
      const mid = theta + Math.PI / PER_GAP / 2
      return new FlowRoad(
        { path: () => s.path(), particles: () => s.particles(), frame: s },
        // Upright on the outside of the drum the flows run around.
        { seenBy: () => this.observer, up: { x: Math.cos(mid), y: Math.sin(mid), z: 0 }, truckLength: 34, width: 22 },
      )
    })
  }

  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(...this.streams.map((s) => s.time.by(dt, { easing: "linear" })), ...anims), dt)
  }

  unfold() {
    const o = this.observer
    o.orthographic.value = o.orthographic.defaultValue = true
    o.zoom.value = o.zoom.defaultValue = 0.72
    this.set(...o.orbit({ phi: 0.7, theta: 0.42 }))
    for (const r of this.rings) this.stage(r)
    for (const l of this.lines) this.stage(l)
    for (const s of this.streams) this.stage(s)
    for (const r of this.roads) this.stage(r)
    this.flowing(2, ...this.lines.map((l) => Create(l)))
    this.flowing(2)
    this.flowing(3, ...this.roads.map((r) => r.concrete.to(1)))
    this.flowing(4)
    this.flowing(2, ...this.roads.map((r) => r.concrete.to(0)))
    this.flowing(1.5)
  }
}

if (import.meta.main) render(FlowRoadDream)
