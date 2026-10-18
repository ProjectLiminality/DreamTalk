/**
 * Summoning — a mudra invokes a symbol into the scene.
 *
 * David (2026-10-15): "with those you can invoke symbols … a form of
 * incantation … you invoke a digital spirit." The generic answer to the
 * hands' `dreamtalk:invoke` event (demo/handplay.ts `invoke:<name>`):
 *
 *   invoke:<Symbol>   — any class on the shelf (sketch/catalogue.ts SHELF:
 *                       Eye, MindVirus, FlowMap, Earth …) appears AT THE
 *                       POINT the hand was at, on the plane of the view's
 *                       focus, sized to a fifth of the view, and draws
 *                       itself on with its own Create choreography;
 *   invoke:dismiss    — the last summoned symbol draws itself off again
 *                       (its UnCreate) and is gone.
 *
 * A summoned symbol is LIVE, not authored: it lives in the host (adopt),
 * pickable and glowable, outside the Dream and its timeline. It is announced
 * as a `dreamtalk:summoned` event — class, world position, scale, when — so
 * whoever authors (the editor's ⌘K, the session recorder) can write it into
 * the DreamWeaving; until then it is a pose of the moment.
 *
 * The draw-on runs on wall time (it is a flourish, not a pose): Create's
 * tracks sampled as a small timeline over `drawSeconds`.
 */

import * as THREE from "three/webgpu"
import type { Holon } from "../src/holon"
import type { ThreeHost } from "../src/render/three-host"
import { Timeline } from "../src/timeline"
import { Create, UnCreate } from "../src/verbs"
import { SHELF, extentOf } from "../sketch/catalogue"

type Vec = { x: number; y: number; z: number }

export interface SummonOpts {
  host: ThreeHost
  canvas: HTMLCanvasElement
  signal: AbortSignal
  /** A host that paints only on demand (the paused editor) repaints. */
  changed?(): void
  /**
   * Where a summon lands NOW, when not here: the topmost level unpacked over
   * this scene (editor/nest.ts) — a symbol summoned inside a level is that
   * level's, and leaves with it.
   */
  site?: () => { host: ThreeHost; canvas: HTMLCanvasElement; changed?(): void } | undefined
  /** Seconds the draw-on (and the draw-off) takes. */
  drawSeconds?: number
  /** How much of the view's height a summoned symbol fills. */
  fill?: number
}

export interface Summoned {
  className: string
  holon: Holon
  release: () => void
  /** The host it lives in. */
  host: ThreeHost
}

export interface Summoning {
  /** Summon a shelf symbol at a client point (centre of the stage if omitted). */
  summon(className: string, at?: { x: number; y: number }, world?: Vec): Summoned | undefined
  /** Draw off and remove the last summoned symbol (or this one). */
  dismiss(which?: Summoned): Promise<void>
  readonly summoned: readonly Summoned[]
}

/** The shelf class a name means — `mindvirus`, `MindVirus`, `mind virus` alike. */
const shelfClass = (name: string) => {
  const key = name.replace(/[\s_-]/g, "").toLowerCase()
  return SHELF.find((s) => s.className.toLowerCase() === key)
}

export const mountSummoning = (opts: SummonOpts): Summoning => {
  /** The host and canvas a summon lands in now (see SummonOpts.site). */
  const here = () => opts.site?.() ?? { host: opts.host, canvas: opts.canvas, changed: opts.changed }
  const seconds = opts.drawSeconds ?? 1.2
  const fill = opts.fill ?? 0.2
  const summoned: Summoned[] = []

  /** Play an anim over `seconds` of wall time, writing its tracks each frame. */
  const animate = (anim: ReturnType<typeof Create>, changed = opts.changed) =>
    new Promise<void>((resolve) => {
      const tl = new Timeline([{ anim, start: 0, duration: seconds }])
      tl.apply(0)
      const t0 = performance.now()
      const step = () => {
        if (opts.signal.aborted) return resolve()
        const t = Math.min(seconds, (performance.now() - t0) / 1000)
        tl.apply(t)
        changed?.()
        if (t < seconds) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })

  /** A client point → the world point on the plane through the view's focus, facing the camera. */
  const worldAt = (host: ThreeHost, canvas: HTMLCanvasElement, at: { x: number; y: number }) => {
    const r = canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(((at.x - r.left) / r.width) * 2 - 1, -(((at.y - r.top) / r.height) * 2 - 1))
    const cam = host.camera
    cam.updateMatrixWorld()
    const o = host.dream.observer
    const focus = new THREE.Vector3(o.x.value, o.y.value, o.z.value)
    const normal = cam.getWorldDirection(new THREE.Vector3())
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, cam)
    const hit = ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal, focus), new THREE.Vector3())
    return { point: hit ?? focus, distance: (hit ?? focus).distanceTo(cam.position) }
  }

  /** World units spanned by the view's height at a point this far from the camera. */
  const viewHeightAt = (host: ThreeHost, distance: number) => {
    const cam = host.camera
    if (cam instanceof THREE.OrthographicCamera) return (cam.top - cam.bottom) / cam.zoom
    return 2 * distance * Math.tan(THREE.MathUtils.degToRad((cam as THREE.PerspectiveCamera).fov) / 2)
  }

  const summon = (className: string, at?: { x: number; y: number }, world?: Vec): Summoned | undefined => {
    const entry = shelfClass(className)
    if (!entry) return undefined
    const holon = new (entry.cls as unknown as new () => Holon)()
    void holon.parts
    const { host, canvas, changed } = here()
    const r = canvas.getBoundingClientRect()
    // Where the hand's spark stands (depth and all), else on the focus plane under the point.
    const { point, distance } = world
      ? { point: new THREE.Vector3(world.x, world.y, world.z), distance: host.camera.position.distanceTo(new THREE.Vector3(world.x, world.y, world.z)) }
      : worldAt(host, canvas, at ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 })
    // Sized to the view: its own drawn extent scaled to `fill` of the view's height.
    const ext = extentOf(holon)
    const size = Math.max(ext?.w ?? 0, ext?.h ?? 0) || 200
    const scale = (fill * viewHeightAt(host, distance)) / size
    holon.scale.value = scale
    // Centred on the point: its own extent's centre lands there.
    holon.x.value = point.x - (ext?.cx ?? 0) * scale
    holon.y.value = point.y - (ext?.cy ?? 0) * scale
    holon.z.value = point.z
    const anim = Create(holon)
    new Timeline([{ anim, start: 0, duration: seconds }]).apply(0) // undrawn before its first frame
    const release = host.adopt(holon)
    const s: Summoned = { className: entry.className, holon, release, host }
    summoned.push(s)
    void animate(anim, changed)
    window.dispatchEvent(
      new CustomEvent("dreamtalk:summoned", {
        detail: { className: entry.className, at: { x: holon.x.value, y: holon.y.value, z: holon.z.value }, scale, t: performance.now() / 1000 },
      }),
    )
    return s
  }

  /** The summoned symbol the spark is in or nearest to (within a view's tenth), else none. */
  const summonedNear = (p: Vec): Summoned | undefined => {
    const { host } = here()
    let best: { s: Summoned; d: number } | undefined
    for (const s of summoned) {
      if (s.host !== host) continue // only what lives where the hand is
      const b = host.worldBoundsOf(s.holon)
      if (!b) continue
      const d = Math.hypot(
        Math.max(b.min.x - p.x, 0, p.x - b.max.x),
        Math.max(b.min.y - p.y, 0, p.y - b.max.y),
        Math.max(b.min.z - p.z, 0, p.z - b.max.z),
      )
      if (!best || d < best.d) best = { s, d }
    }
    const reach = 0.1 * viewHeightAt(host, host.camera.position.distanceTo(new THREE.Vector3(p.x, p.y, p.z)))
    return best && best.d <= reach ? best.s : undefined
  }

  const dismiss = async (which?: Summoned) => {
    const where = here()
    const s = which ?? summoned.filter((x) => x.host === where.host).at(-1)
    if (!s) return
    summoned.splice(summoned.indexOf(s), 1)
    const changed = s.host === where.host ? where.changed : opts.changed
    await animate(UnCreate(s.holon), changed)
    s.release()
    changed?.()
    window.dispatchEvent(new CustomEvent("dreamtalk:dismissed", { detail: { className: s.className } }))
  }

  window.addEventListener(
    "dreamtalk:invoke",
    (e) => {
      const { name, at, world } = (e as CustomEvent<{ name: string; at?: { x: number; y: number }; world?: Vec }>).detail
      // Dismiss what the spark is at — else the latest summoned.
      if (name === "dismiss") void dismiss(world ? summonedNear(world) : undefined)
      else summon(name, at, world)
    },
    { signal: opts.signal },
  )

  return {
    summon,
    dismiss,
    get summoned() {
      return summoned
    },
  }
}
