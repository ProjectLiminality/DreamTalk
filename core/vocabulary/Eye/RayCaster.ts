/**
 * RayCaster — the eyes perceive.
 *
 * David's transmission (ONTOLOGY.md 2026-09-16): cast rays from a point;
 * where a ray hits a collider, it STOPS, a little "x" marks the
 * collision, and a SHOCKWAVE — a circle growing from the hit and fading,
 * ease-OUT, all energy at impact — spreads from it. The general form:
 *
 *     new RayCaster(emitter, [collider, …], { first, last, steps })
 *
 * casts from wherever `emitter` is, in the xy plane, `steps` rays fanned
 * from angle `first` to `last` (a full turn by default — isotropic). The
 * Dialectical-Thinking beat, three rays from an eye hitting a shape, is
 * the edge case `eye.rayCast([shape])` (Eye.ts): three rays across the
 * eye's own opening.
 *
 * WHY IT LIVES IN THE EYE'S DREAMNODE
 *
 * ONTOLOGY 2026-09-17: the caster is the Eye's latent ability — whoever
 * receives the Eye receives the looking, with nothing trailing behind it.
 * It is written general (any emitter, any colliders) but NOT popped out:
 * self-containment first, modularize on actual reuse (the gardening
 * rule). When a second symbol wants to cast, this file moves to its own
 * vocabulary folder unchanged.
 *
 * HOW IT IS BUILT
 *
 * Pure geometry (src/geometry/rays.ts — the transmission leaves the
 * implementation free). One parameter drives everything: `cast`, 0 → 1,
 * the ray FRONT travelling out to `reach`. A ray is drawn from the
 * emitter to the front, or to its hit if the front has passed it; the
 * hit's "x" appears the moment the front arrives; the shockwave runs over
 * the next `shockSpan` of the cast. So the whole effect is a pure f(t) —
 * scrub it either way. Like a MorphShape, the caster sits at the scene
 * root and works in world space; its rays follow the emitter and the
 * colliders wherever they move.
 *
 * NOT YET (named in the transmission, no infrastructure here to hang on):
 * the collision "ping" on the audio track — the framework has narration
 * clips but no effect-driven audio — and casting from an emitter's
 * surface normals or in 3D.
 */

import { Holon, type Overrides } from "../../src/holon"
import { angle, color, completion, derive, integer, length, scalar } from "../../src/params"
import {
  Circle,
  Ellipse,
  Line,
  Polygon,
  Rectangle,
  Square,
  Stroke,
  type Vec3Like,
} from "../../src/parts/primitives"
import { rotHPB } from "../../src/parts/curves"
import { worldOutlineOf } from "../../src/geometry/morph"
import { castRay, fanAngles, shockwave, type Vec2 } from "../../src/geometry/rays"
import { RED } from "../../src/constants"
import type { Anim } from "../../src/anim"

/** A local point of `holon` carried to world space through its chain. */
export const toWorld = (holon: Holon, local: Vec3Like): Vec3Like => {
  let out = local
  for (let node: Holon | undefined = holon; node; node = node.parent) {
    const s = node.scale.value
    out = rotHPB({ x: out.x * s, y: out.y * s, z: out.z * s }, node.p.value, node.h.value, node.b.value)
    out = { x: out.x + node.x.value, y: out.y + node.y.value, z: out.z + node.z.value }
  }
  return out
}

/**
 * Everything a collider's world outline depends on — its generator params
 * and every transform from it to the root — so the hits are recomputed
 * only when a collider (or the emitter) actually moved.
 */
const outlineReading = (shape: Stroke): number[] => {
  const out: number[] = []
  if (shape instanceof Circle) out.push(shape.radius.value)
  else if (shape instanceof Ellipse) out.push(shape.radiusX.value, shape.radiusY.value)
  else if (shape instanceof Square) out.push(shape.size.value)
  else if (shape instanceof Polygon) out.push(shape.radius.value, shape.sides.value, shape.phase.value)
  else if (shape instanceof Rectangle) out.push(shape.width.value, shape.height.value, shape.rounding.value)
  else if (shape instanceof Line) for (const p of shape.points) out.push(p.x, p.y, p.z)
  for (let node: Holon | undefined = shape; node; node = node.parent) {
    out.push(node.x.value, node.y.value, node.z.value, node.h.value, node.p.value, node.b.value, node.scale.value)
  }
  return out
}

/** One ray's outcome at the current pose: its direction and its hit, if any. */
interface RayHit {
  angle: number
  hit?: { distance: number; point: Vec2 }
}

/** Pull-based derived points with a memo — the idiom Morph and Connection use. */
const derivePoints = (line: Line, sourceKey: () => readonly number[], compute: () => Vec3Like[]): void => {
  let key: readonly number[] | undefined
  let memo: Vec3Like[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get(): Vec3Like[] {
      const next = sourceKey()
      if (!key || key.length !== next.length || next.some((v, i) => v !== key![i])) {
        key = next
        memo = compute()
        line.geomVersion++
      }
      return memo
    },
    set(_v: Vec3Like[]) {},
  })
}

export class RayCaster extends Stroke {
  /** ONTOLOGY.md: the Eye's latent ability — an agent that looks. */
  static sovereign = true
  /** The first ray's angle (radians, in the xy plane, 0 = +x). */
  first = angle(0)
  /** The last ray's angle. A full turn from `first` = isotropic. */
  last = angle(2 * Math.PI)
  /** How many rays. Read when the caster is built — it sizes the ray pool. */
  steps = integer(12)
  /** How far a ray travels when it meets nothing. */
  reach = length(600)
  /** The ray front: 0 = nothing cast, 1 = every ray at its reach or its hit. */
  cast = completion(0)
  /** Half the span of a hit's "x". */
  mark = length(10)
  /** The shockwave's full radius. */
  shock = length(60)
  /** How long the shockwave runs, as a share of the cast. */
  shockSpan = scalar(0.3)
  /** The collision colour — the "x" and the shockwave. Rays wear `tint`. */
  hitTint = color(RED)

  // REFERENCES to holons that live elsewhere in the scene, held off the
  // field scan (registering them would reparent them).
  private emitter!: Holon
  private colliders!: Stroke[]
  private hitsKey: readonly number[] | undefined
  private hitsMemo: RayHit[] = []

  constructor(emitter: Holon, colliders: readonly Stroke[], overrides: Overrides = {}) {
    super(overrides)
    for (const c of colliders) {
      if (!worldOutlineOf(c, 8)) {
        throw new Error(
          `RayCaster: ${c.constructor.name} cannot be a collider — a ray stops on an OUTLINE, and ` +
            `this has none of its own (a composite draws through its sub-strokes: pass those ` +
            `instead; an empty Line needs its points first). Colliders are: Circle, Ellipse, ` +
            `Square, Polygon, Rectangle, or a Line of two or more points.`,
        )
      }
    }
    this.emitter = emitter
    this.colliders = [...colliders]
  }

  /** Where the rays leave from — the emitter's world position. */
  origin(): Vec3Like {
    return toWorld(this.emitter, { x: 0, y: 0, z: 0 })
  }

  /** Every ray's direction and first hit, at the scene's current pose. */
  hits(): RayHit[] {
    const o = this.origin()
    const key = [
      o.x,
      o.y,
      o.z,
      this.first.value,
      this.last.value,
      this.steps.value,
      this.reach.value,
      ...this.colliders.flatMap(outlineReading),
    ]
    const k = this.hitsKey
    if (!k || k.length !== key.length || key.some((v, i) => v !== k[i])) {
      this.hitsKey = key
      const outlines = this.colliders.map((c) => worldOutlineOf(c) ?? [])
      this.hitsMemo = fanAngles(this.first.value, this.last.value, this.steps.value).map((a) => ({
        angle: a,
        hit: castRay(o, a, outlines, this.reach.value),
      }))
    }
    return this.hitsMemo
  }

  /** How far the ray front has travelled. */
  private front(): number {
    return this.cast.value * this.reach.value
  }

  protected override compose(): void {
    const count = Math.max(0, Math.floor(this.steps.value))
    const look = { stroke: this.stroke, opacity: this.opacity }
    // What a ray's marks depend on: the front, the marks' sizes, and the
    // hits (whose own memo absorbs the emitter's and colliders' motion).
    const key = () => [
      this.cast.value,
      this.mark.value,
      this.shockSpan.value,
      // A miss is a finite sentinel: NaN never equals itself, and the memo
      // would recompute on every read.
      ...this.hits().flatMap((h) => [h.angle, h.hit?.point.x ?? -1e300, h.hit?.point.y ?? -1e300]),
    ]
    for (let i = 0; i < count; i++) {
      const ray = this.add(new Line({ tint: this.tint, ...look }))
      derivePoints(ray, key, () => {
        const h = this.hits()[i]
        const front = this.front()
        if (!h || front <= 0) return []
        const o = this.origin()
        const d = Math.min(front, h.hit?.distance ?? this.reach.value)
        return [o, { x: o.x + Math.cos(h.angle) * d, y: o.y + Math.sin(h.angle) * d, z: o.z }]
      })
      // The "x": two strokes crossing on the hit, there from the instant
      // the front arrives.
      for (const tilt of [1, -1]) {
        const stroke = this.add(new Line({ tint: this.hitTint, ...look }))
        derivePoints(stroke, key, () => {
          const hit = this.hits()[i]?.hit
          if (!hit || this.front() < hit.distance) return []
          const m = this.mark.value / Math.SQRT2
          const z = this.origin().z
          return [
            { x: hit.point.x - m, y: hit.point.y - m * tilt, z },
            { x: hit.point.x + m, y: hit.point.y + m * tilt, z },
          ]
        })
      }
      // The shockwave: grows from the hit, all energy at impact.
      const wave = () => {
        const hit = this.hits()[i]?.hit
        if (!hit) return { radius: 0, strength: 0 }
        const span = Math.max(this.shockSpan.value * this.reach.value, 1e-9)
        return shockwave((this.front() - hit.distance) / span)
      }
      this.add(
        new Circle({
          tint: this.hitTint,
          stroke: this.stroke,
          x: derive(() => this.hits()[i]?.hit?.point.x ?? 0),
          y: derive(() => this.hits()[i]?.hit?.point.y ?? 0),
          z: derive(() => this.origin().z),
          radius: derive(() => Math.max(wave().radius * this.shock.value, 1e-3)),
          opacity: derive(() => wave().strength * this.opacity.value),
        }),
      )
    }
  }
}

/** The verb: send the rays out — `cast` 0 → 1. */
export const Cast = (caster: RayCaster): Anim => caster.cast.to(1)

