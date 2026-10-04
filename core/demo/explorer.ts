/**
 * THE DREAM EXPLORER — the third mode (docs/transmissions/2026-09-20-creator-mode.md).
 *
 *   "the unified lens where a scene disassembles into the set of
 *    DreamNodes that compose it … like Finder showing every file the
 *    same way (name under a symbol) however differently each opens."
 *
 * Game mode plays within the rules, creator mode plays with them; the
 * explorer shows what the rules are MADE OF. One chord, `~` (shift and
 * the creator key — the same key under Esc): the world holds still, and
 * every sovereign symbol flies out of the composition to its place in a
 * constellation around the scene, rendered as itself, its name and its
 * file beneath it, a line to the whole that holds it. `~` or Esc again
 * and everything flies home. `~` is also the oldest name for "home" there
 * is — the root every path starts from.
 *
 * WINDOW ≡ FOLDER ≡ DREAMNODE. Clicking a node ENTERS it: the page
 * becomes that DreamNode (its own scene, else the symbol framed alone)
 * and the breadcrumb — scene › node › node — is the URL's `path`, so
 * back is back and every crumb is a place you can stand. Each node shows
 * the file that defines it (the daemon's /api/where): the PWD, visible.
 *
 * THE FLIGHT IS A PURE FUNCTION OF u ∈ [0, 1]. Each node N is a world
 * similarity A_N(u): scale by k_N(u) about its ink's centre, translate
 * toward its disc. A moved holon is re-placed so its world transform is
 * A_N ∘ (where it was), corrected for whatever its carrier (the nearest
 * moved ancestor) already did — so nested nodes compose exactly, at any
 * u, scrubbed either way. Writes go through `Param.gate` (a multiplier
 * that also reaches a BOUND param — YinYang's orbiting groups follow
 * derived readings) and are all undone on the way out. Nothing here
 * touches the renderer: the host's `beforeSync` hook is the one seam.
 */

import * as THREE from "three/webgpu"
import type { ThreeHost } from "../src/render/three-host"
import type { Dream } from "../src/dream"
import type { Holon } from "../src/holon"
import type { Param } from "../src/params"
import {
  carrierOf,
  dreamNodesOf,
  flatten,
  inkOf,
  layoutOf,
  moversOf,
  ownHolonsOf,
  type Crumb,
  type Disc,
  type DreamNode,
} from "../editor/dreamnodes"

/** `~` — shift + the creator key. Unmodified otherwise, so ⌘~ still cycles windows. */
export const isExplorerToggle = (e: Pick<KeyboardEvent, "code" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey">): boolean =>
  e.code === "Backquote" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey

/** How long the disassembly takes, and the reassembly (s). */
const FLIGHT_S = 1.25
/** How long entering a node takes to go dark before the page becomes it (ms). */
const ENTER_MS = 420
/** Stroke widths are screen pixels; they follow a node's scale this far (0 = not at all). */
const STROKE_FOLLOW = 0.6
/**
 * The most a node's ink is enlarged to fill its ring. A cursor or a dot is
 * small because it IS small; blown up to a disc it would stop being itself.
 */
const MAX_GROW = 2

const BLUE = "0, 162, 255"
const WHITE = "255, 255, 255"

const STYLE = `
#dt-explorer { position: fixed; inset: 0; pointer-events: none; z-index: 50; }
#dt-crumbs { position: fixed; top: 14px; left: 16px; z-index: 72; color: #777;
  font: 12px/1.5 -apple-system, system-ui, sans-serif; opacity: 0; transition: opacity .35s; pointer-events: none; }
#dt-crumbs.on { opacity: 1; pointer-events: auto; }
#dt-crumbs a { color: #888; text-decoration: none; cursor: pointer; }
#dt-crumbs a:hover { color: #fff; }
#dt-crumbs .here { color: #eee; }
#dt-crumbs .home { color: rgb(${BLUE}); margin-right: 6px; }
#dt-crumbs .sep { color: #444; margin: 0 6px; }
#dt-crumbs .hint { color: #555; font-size: 11px; margin-top: 2px; }
#dt-dark { position: fixed; inset: 0; background: #000; z-index: 80; opacity: 0; pointer-events: none;
  transition: opacity ${ENTER_MS}ms ease; }
#dt-dark.on { opacity: 1; }
canvas.dt-exploring.dt-over { cursor: pointer; }
`

/** Ease in and out — the flight starts and lands softly. */
const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const ramp = (u: number, a: number, b: number) => ease((u - a) / (b - a))

interface Flight {
  node: DreamNode
  disc: Disc
  /** Ink centre on screen (buffer px) and half its diagonal. */
  from: { x: number; y: number; half: number }
  /** World centre of the ink, and where it goes. */
  centre: THREE.Vector3
  target: THREE.Vector3
  k: number
  /** Repo-relative source file, once the daemon has said. */
  file?: string
  /** The path segments that ARE this node, from the scene. */
  path: string[]
  /** The depth (NDC z) the node travels at — its anchor's. */
  ndcZ: number
}

/** A param's gate as found, so it can be put back exactly. */
interface Held {
  param: Param<number>
  gate: number
  reading: number
}

export interface ExplorerOpts {
  host: ThreeHost
  dream: Dream
  canvas: HTMLCanvasElement
  /** The node this page IS — the scene's name or the path's last step. */
  name: string
  sceneKey: string
  /** The path from the scene to here (empty at the scene itself). */
  path: readonly string[]
  crumbs: readonly Crumb[]
  /** The parent's t when this node was entered — where going up returns to. */
  at?: string
  /** Freeze the song and say at which t (the explorer holds it there). */
  hold: () => number
  /** Let the song carry on from where it was held. */
  release: () => void
  signal: AbortSignal
}

export interface Explorer {
  readonly on: boolean
  readonly u: number
  toggle(on?: boolean): void
  /** Scrub the disassembly (harness): the flight at u, rendered. */
  setU(u: number): Promise<void>
  /** Enter a node by name, as a click would. */
  enter(name: string): boolean
  /** The constellation as laid out — names, counts, files, discs (client px). */
  state(): { on: boolean; u: number; nodes: { name: string; count: number; file?: string; depth: number; x: number; y: number; r: number }[] }
}

const queryOf = (sceneKey: string, path: readonly string[], explore = false): string => {
  const q = new URLSearchParams({ scene: sceneKey })
  if (path.length) q.set("path", path.join("/"))
  if (explore) q.set("explore", "1")
  return q.toString()
}

export const mountExplorer = (opts: ExplorerOpts): Explorer => {
  const { host, dream, canvas, signal } = opts
  if (!document.getElementById("dt-explorer-style")) {
    const style = document.createElement("style")
    style.id = "dt-explorer-style"
    style.textContent = STYLE
    document.head.append(style)
  }
  const overlay = document.createElement("canvas")
  overlay.id = "dt-explorer"
  const crumbsEl = document.createElement("div")
  crumbsEl.id = "dt-crumbs"
  const dark = document.createElement("div")
  dark.id = "dt-dark"
  document.body.append(overlay, crumbsEl, dark)
  signal.addEventListener("abort", () => {
    overlay.remove()
    crumbsEl.remove()
    dark.remove()
  })

  let on = false
  let u = 0
  /** Where u is headed, and when the flight toward it began. */
  let goal = 0
  let flightFrom = 0
  let flightStart = 0
  let raf = 0
  let flights: Flight[] = []
  let root: DreamNode | undefined
  let hovered: Flight | undefined
  let entering: Flight | undefined
  /** Every gate the flight writes, as found. */
  let held: Held[] = []
  /** Per frame: put the scene where u says. */
  let apply: (() => void) | undefined

  // --- The breadcrumb: the path IS the place ------------------------------

  const renderCrumbs = () => {
    crumbsEl.textContent = ""
    const home = document.createElement("span")
    home.className = "home"
    home.textContent = "~"
    crumbsEl.append(home)
    opts.crumbs.forEach((c, i) => {
      if (i > 0) {
        const sep = document.createElement("span")
        sep.className = "sep"
        sep.textContent = "›"
        crumbsEl.append(sep)
      }
      if (i === opts.crumbs.length - 1) {
        const here = document.createElement("span")
        here.className = "here"
        here.textContent = c.name
        crumbsEl.append(here)
      } else {
        const a = document.createElement("a")
        a.textContent = c.name
        // Going up lands in the explorer: you see the whole you came out of,
        // and the whole just above at the moment you left it (`at`).
        const at = i === opts.crumbs.length - 2 ? opts.at : undefined
        a.href = `?${c.query}&explore=1${at !== undefined ? `&t=${at}` : ""}`
        crumbsEl.append(a)
      }
    })
    const hint = document.createElement("div")
    hint.className = "hint"
    hint.textContent = on ? "click a DreamNode to enter it · ~ or esc reassembles" : "~ explore"
    crumbsEl.append(hint)
    // Always legible below the scene's own node; at the top, only while exploring.
    crumbsEl.classList.toggle("on", on || opts.path.length > 0)
  }
  renderCrumbs()

  // --- The model, measured once at the held t -----------------------------

  const buffer = () => ({ w: canvas.width || 1280, h: canvas.height || 720 })

  /** Is any of this subtree on screen? (A song's inactive chapters are gated to 0.) */
  const isLive = (r: Holon) => {
    for (const h of r.walk()) if (h.opacity.value > 0.01) return true
    return false
  }
  const visible = (h: Holon) => h.opacity.value > 0.01

  const unproject = (x: number, y: number, ndcZ: number) => {
    const { w, h } = buffer()
    return new THREE.Vector3((x / w) * 2 - 1, 1 - (y / h) * 2, ndcZ).unproject(host.camera)
  }

  /** A node's own visible ink on screen, in buffer px (empty if none). */
  const inkBox = (node: DreamNode): THREE.Box3 => {
    const box = new THREE.Box3().makeEmpty()
    for (const holon of inkOf(node, visible)) {
      const b = host.boundsOf(holon)
      if (b && !b.isEmpty() && b.max.x - b.min.x + (b.max.y - b.min.y) >= 1) box.union(b)
    }
    return box
  }

  /**
   * Land each node where its ring is. The first aim treats the ink as if
   * it sat at its anchor's depth; in a perspective scene it does not (a
   * MindVirus's cable runs off into the distance), so look where it
   * actually landed and correct — target by the miss, scale by the misfit.
   * A few looks converge; the flight stays the same pure f(u), only aimed
   * better.
   */
  const refine = async () => {
    const { w, h } = buffer()
    for (let pass = 0; pass < 3; pass++) {
      u = 1
      host.beforeSync = apply
      await host.renderFrame(heldT)
      for (const f of flights) {
        const box = inkBox(f.node)
        if (box.isEmpty()) continue
        const cx = (box.min.x + box.max.x) / 2
        const cy = (box.min.y + box.max.y) / 2
        const half = Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y) / 2
        const aim = f.target.clone().project(host.camera)
        const sx = ((aim.x + 1) / 2) * w + (f.disc.x - cx)
        const sy = ((1 - aim.y) / 2) * h + (f.disc.y - cy)
        f.target = unproject(sx, sy, f.ndcZ)
        if (half > 0) f.k = Math.min(MAX_GROW, (f.k * 0.85 * f.disc.r) / half)
      }
    }
    // Back to the whole before the browser can present a looked-at frame:
    // all of this runs in one task, so nobody ever sees the aiming.
    u = 0
    await host.renderFrame(heldT)
  }

  const measure = () => {
    root = dreamNodesOf(dream.roots, opts.name, isLive)
    const { w, h } = buffer()
    const layout = layoutOf(root, w, h)
    const pathOf = (n: DreamNode): string[] => {
      const chain: string[] = []
      for (let m: DreamNode | undefined = n; m && m !== root; m = m.parent) chain.unshift(m.name)
      return [...opts.path, ...chain]
    }
    flights = flatten(root).map((node) => {
      const disc = layout.get(node)!
      const box = inkBox(node)
      const anchor = node.members[0] ? host.worldOriginOf(node.members[0]) : undefined
      const ndcZ = (anchor ?? new THREE.Vector3()).clone().project(host.camera).z
      let from: Flight["from"]
      if (box.isEmpty()) {
        // No ink of its own: a pure whole. Its ring is still a place.
        const p = (anchor ?? new THREE.Vector3()).clone().project(host.camera)
        from = { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, half: 0 }
      } else {
        from = {
          x: (box.min.x + box.max.x) / 2,
          y: (box.min.y + box.max.y) / 2,
          half: Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y) / 2,
        }
      }
      // The ink's diagonal sits on 85% of the ring's diameter.
      const k = from.half > 0 ? Math.min(MAX_GROW, (0.85 * disc.r) / from.half) : 1
      return {
        node,
        disc,
        from,
        centre: unproject(from.x, from.y, ndcZ),
        target: unproject(disc.x, disc.y, ndcZ),
        k,
        path: pathOf(node),
        ndcZ,
      }
    })
    const byNode = new Map(flights.map((f) => [f.node, f]))
    const movers = moversOf(root)

    // Every gate this flight will write, captured as found.
    held = []
    const hold = (param: Param<number>): Held => {
      const h: Held = { param, gate: param.gate, reading: param.value }
      held.push(h)
      return h
    }
    const similarity = (f: Flight | undefined, e: number) => ({
      k: f ? 1 + (f.k - 1) * e : 1,
      at: (p: THREE.Vector3) => {
        if (!f) return p.clone()
        const s = 1 + (f.k - 1) * e
        return p.clone().sub(f.centre).multiplyScalar(s).add(f.centre).addScaledVector(f.target.clone().sub(f.centre), e)
      },
      back: (p: THREE.Vector3) => {
        if (!f) return p.clone()
        const s = 1 + (f.k - 1) * e
        return p.clone().addScaledVector(f.target.clone().sub(f.centre), -e).sub(f.centre).divideScalar(s).add(f.centre)
      },
    })

    /** Set a param's reading through its gate (or its value, if it reads 0 and is free). */
    const write = (h: Held, v: number) => {
      if (Math.abs(h.reading) > 1e-6) h.param.gate = (h.gate * v) / h.reading
      else if (!h.param.isBound) h.param.value = v / (h.gate || 1)
    }

    const placements = [...movers].map(([holon, node]) => {
      const flight = byNode.get(node)!
      const carrier = carrierOf(holon, movers)
      const origin = host.worldOriginOf(holon) ?? new THREE.Vector3()
      const parentInverse = (host.parentWorldMatrixOf(holon) ?? new THREE.Matrix4()).clone().invert()
      return {
        flight,
        carrier: carrier && byNode.get(carrier),
        origin,
        parentInverse,
        x: hold(holon.x),
        y: hold(holon.y),
        z: hold(holon.z),
        scale: hold(holon.scale),
      }
    })
    const fades = flights.flatMap((f) =>
      f.node.others.flatMap((other) => [...other.walk()].map((h) => hold(h.opacity))),
    )
    const strokes = flights.map((f) => ({
      flight: f,
      gates: ownHolonsOf(f.node).flatMap((h) => {
        const p = h.params.get("stroke")
        return p && typeof p.value === "number" ? [hold(p as Param<number>)] : []
      }),
    }))

    apply = () => {
      const e = ease(u)
      for (const pl of placements) {
        const mine = similarity(pl.flight, e)
        const theirs = similarity(pl.carrier, e)
        const local = theirs.back(mine.at(pl.origin)).applyMatrix4(pl.parentInverse)
        write(pl.x, local.x)
        write(pl.y, local.y)
        write(pl.z, local.z)
        write(pl.scale, pl.scale.reading * (mine.k / theirs.k))
      }
      for (const g of fades) g.param.gate = g.gate * (1 - e)
      for (const { flight, gates } of strokes) {
        // Thinner as a node shrinks, never heavier as it grows.
        const s = Math.min(1, Math.pow(1 + (flight.k - 1) * e, STROKE_FOLLOW))
        for (const g of gates) g.param.gate = g.gate * s
      }
    }

    // Where each DreamNode lives — asked of the daemon, shown when it answers.
    for (const f of flights) {
      const cls = f.node.ctor || f.node.rep ? f.node.name : `${f.node.name}Dream`
      fetch(`/api/where?name=${encodeURIComponent(cls)}`)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((j: { file?: string } | undefined) => {
          if (j?.file) {
            f.file = j.file
            paint()
          }
        })
        .catch(() => {})
    }
  }

  const restore = () => {
    for (const h of held) h.param.gate = h.gate
    held = []
    apply = undefined
    host.beforeSync = undefined
  }

  // --- The overlay: rings, threads, names ----------------------------------

  const toClient = () => {
    const rect = canvas.getBoundingClientRect()
    const { w, h } = buffer()
    const sx = rect.width / w
    const sy = rect.height / h
    return { rect, sx, sy, s: (sx + sy) / 2 }
  }

  /** A node's ring right now, in client px. */
  const ringOf = (f: Flight, e: number) => {
    const { rect, sx, sy, s } = toClient()
    const x = f.from.x + (f.disc.x - f.from.x) * e
    const y = f.from.y + (f.disc.y - f.from.y) * e
    const r0 = f.from.half > 0 ? f.from.half / 0.85 : f.disc.r * 0.4
    return { x: rect.left + x * sx, y: rect.top + y * sy, r: (r0 + (f.disc.r - r0) * e) * s }
  }

  const paint = () => {
    const dpr = window.devicePixelRatio || 1
    const W = Math.round(window.innerWidth * dpr)
    const H = Math.round(window.innerHeight * dpr)
    if (overlay.width !== W || overlay.height !== H) {
      overlay.width = W
      overlay.height = H
    }
    const ctx = overlay.getContext("2d")
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, W, H)
    if (u <= 0 || flights.length === 0) return
    ctx.scale(dpr, dpr)
    const e = ease(u)
    const rings = new Map(flights.map((f) => [f.node, ringOf(f, e)]))

    // Threads: each node to the whole that holds it, rim to rim.
    const threads = ramp(u, 0.45, 1)
    ctx.lineWidth = 1
    for (const f of flights) {
      const parent = f.node.parent
      if (!parent) continue
      const a = rings.get(parent)!
      const b = rings.get(f.node)!
      const d = Math.hypot(b.x - a.x, b.y - a.y)
      if (d <= a.r + b.r + 4) continue
      const ux = (b.x - a.x) / d
      const uy = (b.y - a.y) / d
      const lit = hovered === f || hovered?.node === parent
      ctx.strokeStyle = `rgba(${WHITE}, ${(lit ? 0.45 : 0.2) * threads})`
      ctx.beginPath()
      ctx.moveTo(a.x + ux * (a.r + 3), a.y + uy * (a.r + 3))
      ctx.lineTo(b.x - ux * (b.r + 3), b.y - uy * (b.r + 3))
      ctx.stroke()
    }

    // Rings: blue is where you stand (this page's node), white the rest.
    const rings_ = ramp(u, 0.4, 1)
    for (const f of flights) {
      const ring = rings.get(f.node)!
      const here = f.node === root
      const lit = hovered === f || entering === f
      ctx.save()
      ctx.beginPath()
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2)
      const rgb = here ? BLUE : WHITE
      if (lit) {
        ctx.shadowColor = `rgba(${rgb}, 0.8)`
        ctx.shadowBlur = 16
      }
      ctx.strokeStyle = `rgba(${rgb}, ${(lit ? 0.95 : here ? 0.6 : 0.32) * rings_})`
      ctx.lineWidth = lit ? 1.75 : 1.25
      ctx.stroke()
      ctx.restore()
    }

    // Names, and under each the file that defines it.
    const names = ramp(u, 0.6, 1)
    const { s } = toClient()
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    for (const f of flights) {
      const ring = rings.get(f.node)!
      const lit = hovered === f
      const y = ring.y + ring.r + 9 * s
      ctx.font = `${Math.round(13 * s)}px -apple-system, system-ui, sans-serif`
      const name = f.node.name
      const count = f.node.count > 1 ? `  ×${f.node.count}` : ""
      const wName = ctx.measureText(name).width
      const wCount = count ? ctx.measureText(count).width : 0
      ctx.textAlign = "left"
      const x0 = ring.x - (wName + wCount) / 2
      ctx.fillStyle = `rgba(${WHITE}, ${(lit ? 1 : 0.88) * names})`
      ctx.fillText(name, x0, y)
      if (count) {
        ctx.fillStyle = `rgba(${WHITE}, ${0.4 * names})`
        ctx.fillText(count, x0 + wName, y)
      }
      ctx.textAlign = "center"
      if (f.file) {
        ctx.font = `${Math.round(10.5 * s)}px ui-monospace, Menlo, monospace`
        ctx.fillStyle = `rgba(${WHITE}, ${(lit ? 0.6 : 0.36) * names})`
        ctx.fillText(f.file, ring.x, y + 18 * s)
      }
    }
  }

  // --- Time: the flight's own clock, the scene's t held ---------------------

  const render = async () => {
    host.beforeSync = apply
    await host.renderFrame(heldT)
    paint()
  }
  let heldT = 0

  const tick = (now: number) => {
    const span = Math.abs(goal - flightFrom) * FLIGHT_S * 1000
    const p = span > 0 ? Math.min(1, (now - flightStart) / span) : 1
    u = flightFrom + (goal - flightFrom) * p
    void render().then(() => {
      if (p < 1) {
        raf = requestAnimationFrame(tick)
        return
      }
      if (goal === 0) {
        // Home: every gate as it was, the song free to carry on.
        restore()
        void host.renderFrame(heldT).then(() => {
          paint()
          opts.release()
        })
      }
    })
  }

  const fly = (to: number) => {
    cancelAnimationFrame(raf)
    goal = to
    flightFrom = u
    flightStart = performance.now()
    raf = requestAnimationFrame(tick)
  }

  const begin = async () => {
    heldT = opts.hold()
    // Measure the scene exactly as it stands at the held t.
    host.beforeSync = undefined
    await host.renderFrame(heldT)
    measure()
    await refine()
  }

  const toggle = (want = !on) => {
    if (want === on) return
    on = want
    canvas.classList.toggle("dt-exploring", on)
    renderCrumbs()
    if (on) {
      if (u === 0) void begin().then(() => on && fly(1))
      else fly(1)
    } else {
      hovered = undefined
      canvas.classList.remove("dt-over")
      fly(0)
    }
  }

  // --- The hand: hover lights a node, a click enters it --------------------

  const flightAt = (x: number, y: number): Flight | undefined => {
    if (!on || u < 0.95) return undefined
    let best: Flight | undefined
    let bestD = Infinity
    for (const f of flights) {
      const ring = ringOf(f, ease(u))
      const d = Math.hypot(x - ring.x, y - ring.y)
      if (d <= ring.r + 6 && d < bestD) {
        best = f
        bestD = d
      }
    }
    return best
  }

  const enterFlight = (f: Flight) => {
    // Standing here already: the click is "back to it" — reassemble.
    if (f.node === root) {
      toggle(false)
      return
    }
    entering = f
    paint()
    dark.classList.add("on")
    const at = `&at=${heldT.toFixed(2)}`
    setTimeout(() => location.assign(`?${queryOf(opts.sceneKey, f.path)}${at}`), ENTER_MS)
  }

  window.addEventListener(
    "pointermove",
    (e) => {
      const f = flightAt(e.clientX, e.clientY)
      if (f === hovered) return
      hovered = f
      canvas.classList.toggle("dt-over", f !== undefined)
      paint()
    },
    { signal },
  )
  canvas.addEventListener(
    "click",
    (e) => {
      if (!on) return
      const f = flightAt(e.clientX, e.clientY)
      if (f) enterFlight(f)
      else toggle(false)
    },
    { signal },
  )
  window.addEventListener("resize", () => paint(), { signal })

  return {
    get on() {
      return on
    },
    get u() {
      return u
    },
    toggle,
    async setU(to: number) {
      if (!on) {
        on = true
        canvas.classList.add("dt-exploring")
        renderCrumbs()
        await begin()
      }
      cancelAnimationFrame(raf)
      u = Math.max(0, Math.min(1, to))
      goal = u
      await render()
    },
    enter(name: string) {
      const f = flights.find((x) => x.node.name === name)
      if (!f) return false
      enterFlight(f)
      return true
    },
    state() {
      return {
        on,
        u,
        nodes: flights.map((f) => {
          const ring = ringOf(f, ease(u))
          return { name: f.node.name, count: f.node.count, file: f.file, depth: f.node.depth, ...ring }
        }),
      }
    },
  }
}

/**
 * Frame a DreamNode standing alone (dreamnodes.ts aloneDream): look at
 * its ink, centred, filling ~60% of the frame. The observer's focus and
 * distance are the only things moved — nothing in the holon.
 */
export const frameAlone = async (host: ThreeHost, dream: Dream, canvas: HTMLCanvasElement): Promise<void> => {
  const holon = dream.roots[0]
  if (!holon) return
  await host.renderFrame(dream.duration)
  const box = host.boundsOf(holon)
  if (!box || box.isEmpty()) return
  const w = canvas.width || 1280
  const h = canvas.height || 720
  const origin = host.worldOriginOf(holon) ?? new THREE.Vector3()
  const z = origin.clone().project(host.camera).z
  const cx = (box.min.x + box.max.x) / 2
  const cy = (box.min.y + box.max.y) / 2
  const centre = new THREE.Vector3((cx / w) * 2 - 1, 1 - (cy / h) * 2, z).unproject(host.camera)
  const obs = dream.observer
  obs.x.value = centre.x
  obs.y.value = centre.y
  const fill = Math.max((box.max.x - box.min.x) / w, (box.max.y - box.min.y) / h) / 0.6
  if (fill > 0) obs.radius.value = obs.radius.value * fill
  await host.renderFrame(0)
}
