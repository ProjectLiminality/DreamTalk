/**
 * Nesting — pause a DreamSong, unpack a symbol on screen into its own song
 * or state space, explore it, and come back to the exact paused moment
 * (docs/VISION-HYPEROBJECT.md: "READMEs become nested DreamSongs,
 * subspaces of the machine: pause the explaining song, unpack e.g. the
 * CoherenceBeacon, go as deep as you like, then return and continue the
 * choreography").
 *
 * ONE STATE MACHINE, A STACK. Level 0 is the song being watched; unpacking
 * pushes a level, coming back pops one, as deep as you like. Entering and
 * leaving are transitions of that machine, and they read as "inside of":
 * the outer view glides INTO the symbol (it is framed, then passed
 * through), while the symbol's own song grows out of the box the symbol
 * occupied on screen. Coming back plays it in reverse — the inner world
 * shrinks back into the symbol, the outer view glides back out.
 *
 * FRAME-EXACT RETURN, BY CONSTRUCTION. The outer level is never disposed,
 * re-timed or re-posed: it is HELD (its own pause), the inner level is a
 * second host on a canvas laid over it, and coming back restores exactly
 * the view delta it had (`view.delta`, a value, not a re-framing) and
 * resumes whatever it was doing. Nothing in the outer song moved.
 *
 * WHAT A SYMBOL UNPACKS INTO — its WatchMe: the registered scene that
 * explains it, found by name (`<Class>WatchMeDream`, `<Class>Dream`,
 * `<Class>DemoDream`, or a registry key equal to the class name), else
 * the symbol itself framed alone, its state space walkable (aloneDream).
 * Each inner level runs the player's GameLoop: Space holds the world and
 * makes it walkable (orbit, axes), Space again plays on; Enter unpacks the
 * symbol under the pointer one level deeper; Esc comes back.
 */

import type { Dream, DreamClass } from "../src/dream"
import type { Holon } from "../src/holon"
import type { Param, ParamValue } from "../src/params"
import type { ViewDelta, ViewLayer } from "../src/view"
import { ThreeHost } from "../src/render/three-host"
import { GameLoop } from "../demo/game"
import { aloneDream, isSovereign, nodeNameOf } from "./dreamnodes"

// --- What a symbol unpacks into ----------------------------------------------------

export interface WatchMe {
  Dream: DreamClass
  /** The registry key, when the WatchMe is a registered scene. */
  key?: string
  /** True when no scene explains it: the symbol is framed alone. */
  alone: boolean
}

/** A holon's WatchMe: the scene that explains it, else the symbol alone. */
export const watchMeOf = (scenes: Record<string, DreamClass>, holon: Holon): WatchMe => {
  const name = nodeNameOf(holon)
  const entries = Object.entries(scenes)
  for (const suffix of ["WatchMeDream", "Dream", "DemoDream"]) {
    const hit = entries.find(([, Ctor]) => Ctor.name === `${name}${suffix}`)
    if (hit) return { Dream: hit[1], key: hit[0], alone: false }
  }
  const byKey = entries.find(([key]) => key === name.toLowerCase())
  if (byKey) return { Dream: byKey[1], key: byKey[0], alone: false }
  return { Dream: aloneDream(holon.constructor as new () => Holon, name), alone: true }
}

/** The symbol touched: the nearest sovereign at-or-above a hit. */
export const symbolAt = (hit: Holon | undefined): Holon | undefined => {
  for (let h: Holon | null | undefined = hit; h; h = h.parent) if (isSovereign(h)) return h
  return undefined
}

// --- The stack ---------------------------------------------------------------------

/** What a level needs of whoever shows it. */
export interface LevelSurface {
  canvas: HTMLCanvasElement
  pick(clientX: number, clientY: number): Holon | undefined
  /** The symbol's box on the canvas, in client px. */
  clientBoxOf(holon: Holon): { x: number; y: number; w: number; h: number } | undefined
  /** World ink bounds — where the view glides into. */
  worldBoundsOf(holon: Holon): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | undefined
  /** The level's viewer camera (src/view.ts). */
  view(): ViewLayer | undefined
  /** Hold the level still; the returned resume puts it back as it was. */
  hold(): () => void
}

/** What an unpack remembered, so coming back is exact. */
export interface Saved {
  holon: Holon
  name: string
  box?: { x: number; y: number; w: number; h: number }
  delta?: ViewDelta
  resume: () => void
}

/**
 * The pure half of the machine (testable without a browser): what entering
 * saves and what leaving restores. `enter` holds the level and remembers
 * its view; `leave` puts the view delta back exactly and resumes.
 */
export class NestStack {
  readonly #saved: Saved[] = []

  get depth(): number {
    return this.#saved.length
  }

  get top(): Saved | undefined {
    return this.#saved[this.#saved.length - 1]
  }

  /** The names from the song down to here (a breadcrumb). */
  get path(): string[] {
    return this.#saved.map((s) => s.name)
  }

  enter(surface: LevelSurface, holon: Holon): Saved {
    const view = surface.view()
    const saved: Saved = {
      holon,
      name: nodeNameOf(holon),
      box: surface.clientBoxOf(holon),
      delta: view ? { ...view.delta } : undefined,
      resume: surface.hold(),
    }
    this.#saved.push(saved)
    return saved
  }

  /** Pop a level: the view comes back to exactly where it stood, then the level resumes. */
  leave(surface: LevelSurface, opts: { glide?: number; now?: number } = {}): Saved | undefined {
    const saved = this.#saved.pop()
    if (!saved) return undefined
    const view = surface.view()
    if (view && saved.delta) {
      if (opts.glide) view.glideTo({ ...saved.delta }, opts.now ?? performance.now(), opts.glide)
      else view.delta = { ...saved.delta }
    }
    return saved
  }
}

// --- The machine, mounted ------------------------------------------------------------

export interface NestOpts {
  /** Level 0 — the song being watched (the player's or the editor's). */
  outer: LevelSurface
  scenes: Record<string, DreamClass>
  note(text: string): void
  /** The outer's pointer / key handlers are suspended while a level is open. */
  onDepth?(depth: number): void
  signal: AbortSignal
}

export interface Nest {
  readonly depth: number
  readonly path: string[]
  /** Unpack a symbol of the TOP level (the outer song when nothing is open). */
  unpack(holon: Holon): Promise<boolean>
  /** Unpack the symbol under a point of the top level. */
  unpackAt(clientX: number, clientY: number): Promise<boolean>
  /** Unpack the symbol under the pointer (the Enter key). */
  unpackHovered(): Promise<boolean>
  /** Come back one level. Resolves when the transition has landed. */
  back(): Promise<boolean>
  /** The top level's state (headless): its t, whether it plays, its song. */
  state(): { depth: number; path: string[]; t?: number; playing?: boolean; song?: string }
}

/** How long entering and leaving take, seconds. */
export const TRANSITION = 0.8

interface Inner {
  dream: Dream
  host: ThreeHost
  canvas: HTMLCanvasElement
  game: GameLoop
  surface: LevelSurface
  ac: AbortController
  t: number
  playing: boolean
  anchor: number
  key?: string
}

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000))

/**
 * The machine is also on the page as `window.__dtNest` — the named actions a
 * hand gesture binds to (demo/handplay.ts): `unpackHovered()` (or
 * `unpack(holon)`) and `back()`.
 */
export const mountNest = (opts: NestOpts): Nest => {
  const stack = new NestStack()
  const inners: Inner[] = []
  let busy = false
  /** Esc pressed while a level was still opening: honoured the moment it has. */
  let pendingBack: (() => void) | undefined
  let pointer: { x: number; y: number } | undefined

  const top = (): LevelSurface => inners[inners.length - 1]?.surface ?? opts.outer
  const track = (canvas: HTMLCanvasElement, signal: AbortSignal) =>
    canvas.addEventListener("pointermove", (e) => (pointer = { x: e.clientX, y: e.clientY }), { signal })
  track(opts.outer.canvas, opts.signal)

  /** A box (client px) as the transform that lays the full canvas onto it. */
  const onto = (canvas: HTMLCanvasElement, box?: { x: number; y: number; w: number; h: number }): string => {
    const r = canvas.getBoundingClientRect()
    if (!box || r.width <= 0) return "scale(0.05)"
    const s = Math.max(0.02, Math.max(box.w / r.width, box.h / r.height))
    const dx = box.x + box.w / 2 - (r.left + r.width / 2)
    const dy = box.y + box.h / 2 - (r.top + r.height / 2)
    return `translate(${dx}px, ${dy}px) scale(${s})`
  }

  const mountInner = async (wm: WatchMe, under: HTMLCanvasElement): Promise<Inner> => {
    const ac = new AbortController()
    opts.signal.addEventListener("abort", () => ac.abort())
    const canvas = document.createElement("canvas")
    canvas.className = "nestlevel"
    canvas.width = under.width
    canvas.height = under.height
    // Laid exactly over the level beneath — same box, same buffer size.
    const r = under.getBoundingClientRect()
    canvas.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:${30 + inners.length};background:#000;opacity:0;transition:transform ${TRANSITION}s cubic-bezier(.4,0,.2,1), opacity ${TRANSITION}s ease;`
    document.body.appendChild(canvas)
    const dream = new wm.Dream()
    const host = await ThreeHost.mount(dream, canvas)
    const pickAt = (x: number, y: number) => {
      const b = canvas.getBoundingClientRect()
      if (b.width <= 0) return undefined
      return host.pick(((x - b.left) / b.width) * 2 - 1, -(((y - b.top) / b.height) * 2 - 1))
    }
    const game = new GameLoop(
      {
        canvas,
        pick: pickAt,
        boundsOf: (h) => host.boundsOf(h),
        worldBoundsOf: (h) => host.worldBoundsOf(h),
        setBeforeSync: (fn) => (host.beforeSync = fn),
        attend: (c, h, a) => void host.attend(c, h, a),
      },
      {
        roots: dream.roots,
        space: dream.stateSpace(),
        observer: dream.observer,
        animated: new Set(dream.build().params as Param<ParamValue>[]),
        suspended: () => busy || inners[inners.length - 1]?.canvas !== canvas,
        hud: true,
        signal: ac.signal,
      },
    )
    const inner: Inner = {
      dream,
      host,
      canvas,
      game,
      ac,
      t: 0,
      playing: true,
      anchor: performance.now(),
      key: wm.key,
      surface: {
        canvas,
        pick: pickAt,
        clientBoxOf: (h) => clientBox(host, canvas, h),
        worldBoundsOf: (h) => host.worldBoundsOf(h),
        view: () => game.view,
        hold: () => {
          const was = inner.playing && !game.on
          if (!game.on) {
            inner.playing = false
            game.enter(inner.t)
          }
          return () => {
            if (!was) return
            game.leave()
            inner.anchor = performance.now() - game.heldAt * 1000
            inner.playing = true
          }
        },
      },
    }
    track(canvas, ac.signal)
    // Its own clock: the WatchMe plays through once and holds its last pose.
    const frame = async (now: number) => {
      if (ac.signal.aborted) return
      game.tick(now)
      if (game.on) await host.renderFrame(game.heldAt)
      else {
        if (inner.playing) {
          inner.t = Math.min(dream.duration, (now - inner.anchor) / 1000)
          if (inner.t >= dream.duration) inner.playing = false
        }
        await host.renderFrame(inner.t)
      }
      requestAnimationFrame(frame)
    }
    await host.renderFrame(0)
    requestAnimationFrame(frame)
    return inner
  }

  const unpack = async (holon: Holon): Promise<boolean> => {
    if (busy) return false
    const symbol = symbolAt(holon) ?? holon
    const surface = top()
    const under = surface.canvas
    busy = true
    try {
      const wm = watchMeOf(opts.scenes, symbol)
      const saved = stack.enter(surface, symbol)
      opts.onDepth?.(stack.depth)
      opts.note(`↓ ${saved.name}${wm.alone ? " (its state space)" : ""} · esc comes back`)
      // "Inside of": the view glides into the symbol and past it…
      const view = surface.view()
      const b = surface.worldBoundsOf(symbol)
      if (view && b) {
        const c = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 }
        const R = Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) / 2
        // frameSphere glides at its own pace: take its target, glide there at ours.
        const from = { ...view.delta }
        const now = performance.now()
        view.frameSphere(c, Math.max(R * 0.15, 1e-3), now)
        view.step(Number.POSITIVE_INFINITY)
        const into = { ...view.delta }
        view.delta = from
        view.glideTo(into, now, TRANSITION)
      }
      // …while its own world grows out of the box it occupied.
      const inner = await mountInner(wm, under)
      inner.canvas.style.transition = "none"
      inner.canvas.style.transform = onto(inner.canvas, saved.box)
      void inner.canvas.offsetWidth
      inner.canvas.style.transition = `transform ${TRANSITION}s cubic-bezier(.4,0,.2,1), opacity ${TRANSITION}s ease`
      inner.canvas.style.transform = "none"
      inner.canvas.style.opacity = "1"
      inners.push(inner)
      opts.onDepth?.(stack.depth)
      await sleep(TRANSITION)
      return true
    } finally {
      busy = false
      const queued = pendingBack
      pendingBack = undefined
      queued?.()
    }
  }

  const back = async (): Promise<boolean> => {
    // Still opening (the WatchMe mounts, the view glides in): come back as soon as it has.
    if (busy && stack.depth > 0) return new Promise((done) => (pendingBack = () => void back().then(done)))
    const inner = inners[inners.length - 1]
    if (busy || !inner) return false
    busy = true
    try {
      const saved = stack.top!
      // The inner world shrinks back into the symbol; the outer view glides out to where it stood.
      inner.canvas.style.transform = onto(inner.canvas, saved.box)
      inner.canvas.style.opacity = "0"
      const below = inners[inners.length - 2]?.surface ?? opts.outer
      stack.leave(below, { glide: TRANSITION })
      await sleep(TRANSITION + 0.05)
      inners.pop()
      inner.ac.abort()
      inner.canvas.remove()
      inner.host.dispose()
      // The glide has landed: the delta is the saved value exactly.
      const view = below.view()
      if (view && saved.delta) view.delta = { ...saved.delta }
      saved.resume()
      opts.onDepth?.(stack.depth)
      opts.note(stack.depth ? `↑ ${stack.top!.name}` : "↑ back in the song")
      return true
    } finally {
      busy = false
    }
  }

  // Keys while a level is open: Space holds/plays it, Enter unpacks deeper, Esc
  // comes back — and nothing reaches the level beneath.
  document.addEventListener(
    "keydown",
    (e) => {
      const inner = inners[inners.length - 1]
      if (!inner) {
        // A level is still opening (its song mounting): Esc already means "back".
        if (stack.depth > 0 && e.code === "Escape") {
          e.stopImmediatePropagation()
          e.preventDefault()
          void back()
        }
        return
      }
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (typing) return
      e.stopImmediatePropagation()
      if (e.code === "Escape") {
        e.preventDefault()
        void back()
      } else if (e.code === "Space") {
        e.preventDefault()
        if (inner.game.on) {
          inner.game.leave()
          inner.anchor = performance.now() - inner.game.heldAt * 1000
          inner.playing = true
        } else {
          inner.playing = false
          inner.game.enter(inner.t)
        }
      } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && pointer) {
        e.preventDefault()
        void unpackAt(pointer.x, pointer.y)
      } else inner.game.key(e)
    },
    { signal: opts.signal, capture: true },
  )

  const unpackAt = async (x: number, y: number): Promise<boolean> => {
    const hit = symbolAt(top().pick(x, y))
    if (!hit) return false
    return unpack(hit)
  }

  const nest: Nest = {
    get depth() {
      return stack.depth
    },
    get path() {
      return stack.path
    },
    unpack,
    unpackAt,
    unpackHovered: () => (pointer ? unpackAt(pointer.x, pointer.y) : Promise.resolve(false)),
    back,
    state() {
      const inner = inners[inners.length - 1]
      return {
        depth: stack.depth,
        path: stack.path,
        t: inner ? (inner.game.on ? inner.game.heldAt : inner.t) : undefined,
        playing: inner ? inner.playing && !inner.game.on : undefined,
        song: inner?.key ?? inner?.dream.constructor.name,
      }
    },
  }
  ;(window as unknown as { __dtNest?: Nest }).__dtNest = nest
  opts.signal.addEventListener("abort", () => {
    const w = window as unknown as { __dtNest?: Nest }
    if (w.__dtNest === nest) w.__dtNest = undefined
  })
  return nest
}

/** A holon's box on a canvas in client px (host.boundsOf is drawing-buffer px). */
export const clientBox = (
  host: ThreeHost,
  canvas: HTMLCanvasElement,
  holon: Holon,
): { x: number; y: number; w: number; h: number } | undefined => {
  const b = host.boundsOf(holon)
  if (!b) return undefined
  const r = canvas.getBoundingClientRect()
  const sx = r.width / (canvas.width || 1)
  const sy = r.height / (canvas.height || 1)
  return { x: r.left + b.min.x * sx, y: r.top + b.min.y * sy, w: (b.max.x - b.min.x) * sx, h: (b.max.y - b.min.y) * sy }
}
