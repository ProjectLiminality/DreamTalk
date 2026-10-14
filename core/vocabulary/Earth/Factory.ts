/**
 * Factory — a hall under a sawtooth roof, drawn as lines in 3D.
 *
 * The sawtooth is the oldest pictogram of industry: north-light glazing on
 * every tooth, the vertical face of each one a window. Three teeth over a
 * long low hall, a prism (prism.ts) with true hidden lines, standing on
 * y = 0 so a `Place` (Earth.ts) stands it on the planet. On a map its
 * colour IS its meaning, so `tint` is the param that matters; `size` is the
 * hall's length and every other proportion follows from it.
 *
 * It is a morph target too: `worldCurves()` answers its VISIBLE edges in
 * world space (hidden-line removal on the prism's own mesh), seen from
 * `seenBy`'s observer — so Morph(truck, factory) lands on what the camera
 * shows, not on the edges its body hides.
 */

import type { Observer } from "../../src/dream"
import type { Holon } from "../../src/holon"
import { Null, type Vec3Like } from "../../src/parts/primitives"
import { color, length, paramEpoch } from "../../src/params"
import { WHITE } from "../../src/constants"
import { hiddenLineDrawing, type MeshSolid } from "../../src/geometry/hiddenline"
import { prepareMesh } from "../../src/geometry/meshlines"
import { localView, toWorld, viewOf, type View } from "../../src/geometry/frames"
import { BODY, prism, type P2 } from "./prism"

/** How tall the hall's walls are, and each tooth above them, per unit of length. */
const WALL = 0.3
const TOOTH = 0.22
const TEETH = 3
/** hiddenline.ts's default crease angle — the key its prepared mesh is cached under. */
const CREASE = 0.6

export class Factory extends Null {
  static sovereign = true
  tint = color(WHITE)
  stroke = length(1.5)
  body = color(BODY)
  size = length(8)

  /** The observer whose view decides which edges `worldCurves()` sees (default: the default eye). */
  seenBy: (() => Observer) | undefined = undefined

  /** The hall's full height (walls + teeth) at `size` — what a rising site must sink. */
  static heightFor = (size: number): number => size * (WALL + TOOTH)

  protected override compose(): void {
    const w = this.size.value
    const h = w * WALL
    const tooth = w * TOOTH
    const profile: P2[] = [
      [w / 2, 0],
      [w / 2, h],
    ]
    // Right to left: each tooth rises vertically (the glazing) and slopes
    // back down to the foot of the next.
    for (let i = TEETH; i > 0; i--) {
      profile.push([-w / 2 + (w * i) / TEETH, h + tooth], [-w / 2 + (w * (i - 1)) / TEETH, h])
    }
    profile.push([-w / 2, 0])
    this.mesh = prism(this, profile, w * 0.6, { tint: this.tint, stroke: this.stroke, body: this.body })
  }

  private mesh?: MeshSolid
  private curves?: { epoch: number; key: number[]; curves: Vec3Like[][] }

  private view(): View {
    const obs = this.seenBy?.()
    return obs ? viewOf(obs) : { eye: { x: 0, y: 0, z: 1500 } }
  }

  /** Numbers that move whenever `worldCurves()` would — the local view and the transform chain. */
  curveSignature(): number[] {
    const v = localView(this, this.view())
    const out = "eye" in v ? [0, v.eye.x, v.eye.y, v.eye.z] : [1, v.toward.x, v.toward.y, v.toward.z]
    out.push(this.size.value)
    for (let n: Holon | undefined = this; n; n = n.parent) {
      out.push(n.x.value, n.y.value, n.z.value, n.h.value, n.p.value, n.b.value, n.scale.value)
    }
    return out
  }

  /** The visible edges in WORLD space — what a morph lands on (MorphCurves `curvesOf`). */
  worldCurves(): Vec3Like[][] {
    void this.parts
    const epoch = paramEpoch()
    const m = this.curves
    if (m?.epoch === epoch) return m.curves
    const key = this.curveSignature()
    if (m && m.key.length === key.length && m.key.every((x, i) => x === key[i])) {
      m.epoch = epoch
      return m.curves
    }
    const view = localView(this, this.view())
    const lines = this.mesh ? hiddenLineDrawing([this.mesh], view).lines : []
    // The drawing lifts each point toward the eye by one facet along its own
    // sight line (so a ribbon never sinks into a fill); a morph wants the
    // edge itself, so step back by the same along the same line.
    const lift = this.mesh ? prepareMesh(this.mesh, CREASE).facet : 0
    const onEdge = (p: Vec3Like): Vec3Like => {
      const d = "eye" in view ? { x: view.eye.x - p.x, y: view.eye.y - p.y, z: view.eye.z - p.z } : view.toward
      const l = Math.hypot(d.x, d.y, d.z) || 1
      return { x: p.x - (d.x / l) * lift, y: p.y - (d.y / l) * lift, z: p.z - (d.z / l) * lift }
    }
    const curves = lines.map((l) => l.map((p) => toWorld(this, onEdge(p))))
    this.curves = { epoch, key, curves }
    return curves
  }
}
