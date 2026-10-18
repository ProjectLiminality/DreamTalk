/**
 * frames.ts — where an observer sees from, and how a point moves between a
 * holon's own frame and the world: the ONE implementation (consolidated
 * 2026-10-13 from soliddrawing.ts and the Earth's own copies).
 *
 * Plain arithmetic over the standard params — no three.js — composed in the
 * host's transform order (scale → rotation `rotHPB` → translation, up the
 * chain; three-host composes h/p/b as 'ZXY'). `viewOf` restates the host's
 * camera placement (three-host syncCamera), so CPU geometry can be
 * view-dependent: a solid's visible edges, a planet's horizon, a label that
 * faces the eye.
 */

import type { Observer } from "../dream"
import type { Holon } from "../holon"
import type { Vec3Like } from "../parts/primitives"
import { invRotHPB, rotHPB } from "../parts/curves"

/** Where a view sees from: a point (perspective) or, orthographic, only a direction toward the viewer. */
export type View = { eye: Vec3Like } | { toward: Vec3Like }

/**
 * Where an Observer sees from, in world space — the host's camera
 * placement (three-host.ts syncCamera), restated as plain arithmetic so
 * CPU geometry can be view-dependent: focus (x, y, z) plus the spherical
 * offset at radius/zoom, or, orthographic, only the direction.
 */
/** How far a perspective observer's eye stands from its focus (zoom is distance, dream.ts). */
export const eyeDistance = (obs: Observer): number => obs.radius.value / (obs.zoom.value || 1)

/**
 * The LIVE eye: the observer of the scene a host is rendering now (the host
 * names it every frame — three-host.ts renderFrame), so view-dependent CPU
 * geometry (a sphere's horizon, a disc facing the eye) follows the actual
 * camera — the song's rig, the free-play orbit, a nested level — without
 * every scene having to pass its observer in. Undefined outside a host
 * (tests, bun): callers fall back to the framework's default eye.
 */
let live: Observer | undefined
export const setLiveObserver = (obs: Observer | undefined): void => {
  live = obs
}
export const liveView = (): View | undefined => (live ? viewOf(live) : undefined)

export const viewOf = (obs: Observer): View => {
  const phi = obs.phi.value
  const theta = obs.theta.value
  const dir = { x: Math.sin(phi) * Math.cos(theta), y: Math.sin(theta), z: Math.cos(phi) * Math.cos(theta) }
  if (obs.orthographic.value) return { toward: dir }
  const r = eyeDistance(obs)
  return { eye: { x: obs.x.value + dir.x * r, y: obs.y.value + dir.y * r, z: obs.z.value + dir.z * r } }
}

/** A local point of `holon` carried to world space (scale → rotation → translation, up the chain). */
export const toWorld = (holon: Holon, p: Vec3Like): Vec3Like => {
  let out = p
  for (let node: Holon | undefined = holon; node; node = node.parent) {
    const s = node.scale.value
    out = rotHPB({ x: out.x * s, y: out.y * s, z: out.z * s }, node.p.value, node.h.value, node.b.value)
    out = { x: out.x + node.x.value, y: out.y + node.y.value, z: out.z + node.z.value }
  }
  return out
}

/** The inverse of `toWorld`: a world point in `holon`'s local space. */
export const toLocal = (holon: Holon, p: Vec3Like): Vec3Like => {
  const chain: Holon[] = []
  for (let node: Holon | undefined = holon; node; node = node.parent) chain.push(node)
  let out = p
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i]!
    out = { x: out.x - node.x.value, y: out.y - node.y.value, z: out.z - node.z.value }
    out = invRotHPB(out, node.p.value, node.h.value, node.b.value)
    const s = node.scale.value || 1
    out = { x: out.x / s, y: out.y / s, z: out.z / s }
  }
  return out
}

/** A world-space view carried into `holon`'s local space. */
export const localView = (holon: Holon, view: View): View => {
  if ("eye" in view) return { eye: toLocal(holon, view.eye) }
  // A direction: rotations only, root down — no translation, so a holon
  // that merely moves sees EXACTLY the same local direction (bit for bit),
  // and every memo keyed on it holds while it travels.
  const chain: Holon[] = []
  for (let node: Holon | undefined = holon; node; node = node.parent) chain.push(node)
  let t = view.toward
  for (let i = chain.length - 1; i >= 0; i--) t = invRotHPB(t, chain[i]!.p.value, chain[i]!.h.value, chain[i]!.b.value)
  const l = Math.hypot(t.x, t.y, t.z) || 1
  return { toward: { x: t.x / l, y: t.y / l, z: t.z / l } }
}
