/**
 * standalone.ts — ONE scene as a page of its own: the player without the
 * studio (scripts/build-standalone.ts bundles it).
 *
 * What a viewer of a single hyperobject needs and nothing else: the song,
 * free play (Space; `?play=free` opens there), Enter / Esc into and out of
 * a symbol's level, and the toolkit — links to any state, the scene's
 * slots on ⌥1–9, presenter mode (q) — and the settings (`,`), the scene's
 * degrees of freedom over its own preset (Dream.preset). No creator mode, explorer, hands,
 * recording, narration or sounds: they need the studio's daemon, which a
 * static host does not have. The registry holds only the scene the build
 * put in demo/localHolons.ts; the public scene list is never imported.
 */

import { ThreeHost } from "../src/render/three-host"
import { onTextLayout } from "../src/render/text"
import { localScenes } from "./localHolons"
import { GameLoop } from "./game"
import type { Param, ParamValue } from "../src/params"
import { inkQueries } from "./spark"
import { clientBox, levelsOf, mountNest } from "../editor/nest"
import { mountToolkit, type Toolkit } from "./toolkit"
import { dofsOf } from "../src/dof"
import { DOF_KEY, loadMask, mountDofPanel, type DofPanel } from "./dofpanel"
import type {} from "../editor/dt"

const canvas = document.getElementById("stage") as HTMLCanvasElement
const readout = document.getElementById("readout") as HTMLDivElement

const main = async () => {
  const query = new URLSearchParams(location.search)
  const [sceneName, DreamCtor] = Object.entries(localScenes)[0] ?? []
  if (!sceneName || !DreamCtor) throw new Error("no scene in this build")
  const dream = new DreamCtor()
  const host = await ThreeHost.mount(dream, canvas, { useInstancedRibbons: "auto", residency: true, at: Math.max(0, Number(query.get("t")) || 0) })
  const duration = dream.duration

  const startT = Math.max(0, Number(query.get("t")) || 0) % (duration || 1)
  let playing = true
  let t0 = performance.now() - startT * 1000
  let current = startT

  const animatedOf = () => (dream as { driven?: ReadonlySet<Param<ParamValue>> }).driven ?? new Set(dream.build().params)
  let walkedRoots = dream.roots
  const ac = new AbortController()
  const mask = loadMask(sceneName, dream.preset())
  const pickAt = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return undefined
    return host.pick(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1))
  }
  const game = new GameLoop(
    {
      canvas,
      pick: (x, y) => pickAt(x, y),
      boundsOf: (h) => host.boundsOf(h),
      worldBoundsOf: (h) => host.worldBoundsOf(h),
      worldBoundsOfEach: (hs) => host.worldBoundsOfEach(hs),
      ...inkQueries(host),
      setBeforeSync: (fn) => (host.beforeSync = fn),
      attend: (channel, holon, amount) => host.attend(channel, holon, amount),
    },
    {
      roots: dream.roots,
      space: dream.stateSpace(),
      observer: dream.observer,
      animated: animatedOf(),
      suspended: () => false,
      hud: query.get("hud") !== "0",
      signal: ac.signal,
      mask,
    },
  )
  const toggleGame = async () => {
    if (game.on) {
      game.leave()
      t0 = performance.now() - game.heldAt * 1000
      playing = true
      return
    }
    playing = false
    await host.renderFrame(current)
    game.enter(current)
  }

  let nestDepth = 0
  let toolkit: Toolkit | undefined
  let dofPanel: DofPanel | undefined
  const frame = async (now: number) => {
    game.hold(nestDepth > 0, now)
    game.tick(now)
    if (game.on) {
      await host.renderFrame(game.heldAt)
      readout.textContent = `t = ${game.heldAt.toFixed(2)}s · free (space: play)`
    } else if (playing) {
      const t = ((now - t0) / 1000) % duration
      current = t
      await host.renderFrame(t)
      readout.textContent = `t = ${t.toFixed(2)}s / ${duration.toFixed(2)}s`
    }
    if (dream.roots !== walkedRoots) {
      walkedRoots = dream.roots
      game.reroot({ roots: walkedRoots, space: dream.stateSpace(), animated: animatedOf() })
    }
    toolkit?.tick(now)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  // A held frame redraws when a Text's layout lands (as demo/main.ts does).
  let redrawing = false
  let redrawAgain = false
  onTextLayout(() => {
    if (playing) return
    if (redrawing) {
      redrawAgain = true
      return
    }
    redrawing = true
    void (async () => {
      try {
        do {
          redrawAgain = false
          await new Promise(requestAnimationFrame)
          if (!playing) await host.renderFrame(current)
        } while (redrawAgain && !playing)
      } finally {
        redrawing = false
      }
    })()
  })

  const nest = mountNest({
    outer: {
      canvas,
      roots: () => dream.roots,
      pick: (x, y) => pickAt(x, y),
      clientBoxOf: (h) => clientBox(host, canvas, h),
      worldBoundsOf: (h) => host.worldBoundsOf(h),
      view: () => game.view,
      hold: () => {
        const wasPlaying = !game.on
        if (!game.on) void toggleGame()
        game.covered = true
        return () => {
          game.covered = false
          if (wasPlaying && game.on) void toggleGame()
        }
      },
    },
    scenes: localScenes,
    note: () => {},
    onDepth: (d) => (nestDepth = d),
    allow: (name) => mask.levelOn(name),
    pageKeys: [DOF_KEY],
    signal: ac.signal,
  })

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (dofPanel?.key(e)) return
    if (toolkit?.key(e)) return
    if (e.code === "Space" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      void toggleGame()
      return
    }
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault()
      void nest.unpackHovered()
      return
    }
    game.key(e)
  })

  if (query.get("play") === "free") {
    playing = false
    current = query.has("t") ? startT : duration
    await host.renderFrame(current)
    await host.renderFrame(current)
    game.enter(current)
  }
  toolkit = mountToolkit({
    sceneKey: sceneName,
    game,
    view: () => game.view,
    nest,
    t: () => current,
    seek: async (t, free) => {
      current = t
      if (free) {
        host.beforeSync = undefined
        playing = false
        await host.renderFrame(t)
        await host.renderFrame(t)
        game.enter(t)
      } else {
        if (game.on) game.leave()
        t0 = performance.now() - t * 1000
        playing = true
      }
    },
    roots: dream.roots,
    space: dream.stateSpace(),
    slots: dream.slots(),
    mask,
    signal: ac.signal,
  })
  const dofs = () => dofsOf({ axes: game.automaton.axes, levels: levelsOf(dream.roots, localScenes), slots: dream.slots() })
  dofPanel = mountDofPanel({
    sceneKey: sceneName,
    mask,
    dofs,
    keyOf: (id) => game.state().find((s) => s.id === id)?.key,
    signal: ac.signal,
  })
  // The harness's handles (scripts/build-standalone.ts --check, any headless driver).
  ;(window as unknown as Record<string, unknown>).__dtGame = { game, state: () => game.state(), nest: { state: () => nest.state(), back: () => nest.back() } }
  ;(window as unknown as Record<string, unknown>).__dtToolkit = toolkit
  ;(window as unknown as Record<string, unknown>).__dtDof = { mask, panel: dofPanel, dofs }
  window.__dt = {
    ready: true,
    duration,
    setT: async (t: number) => {
      playing = false
      current = t
      await host.renderFrame(t)
      await host.renderFrame(t)
    },
    play: () => {
      t0 = performance.now()
      playing = true
    },
    pause: () => {
      playing = false
    },
  }
}

main().catch((err) => {
  window.__dt = { ready: false, duration: 0, setT: async () => {}, play: () => {}, pause: () => {}, error: String(err?.stack ?? err) }
  readout.textContent = String(err)
})
