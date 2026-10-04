/**
 * Demo host page driver — realtime playback loop + hooks for the
 * headless screenshot harness (window.__dt).
 */

import * as THREE from "three/webgpu"
import { ThreeHost } from "../src/render/three-host"
import { onTextLayout } from "../src/render/text"
import { scenes, defaultScene } from "./scenes"
import { httpBakeCache } from "../src/bakecache"
import { httpVoiceCache } from "../src/voice"
import { Narrator } from "../src/render/narrator"
import { CreatorMode, isCreatorToggle } from "../editor/creator"
import { mountCreatorPanel } from "./creatorpanel"
import { resolvePlace } from "../editor/dreamnodes"
import { frameAlone, isExplorerToggle, mountExplorer } from "./explorer"

// Expose THREE for the instancing byte-identity harness (it reconstructs
// the oracle's modelView·local the way the shader does). Harness-only.
;(window as unknown as Record<string, unknown>).__THREE__ = THREE

declare global {
  interface Window {
    __dt?: {
      ready: boolean
      duration: number
      setT: (t: number) => Promise<void>
      play: () => void
      pause: () => void
      error?: string
    }
  }
}

const canvas = document.getElementById("stage") as HTMLCanvasElement
const readout = document.getElementById("readout") as HTMLDivElement

/**
 * Give any holon that can warm its bakes the chance to, before the
 * scene composes.
 *
 * A browser has no filesystem, so the daemon lends it one over
 * `/api/bake-cache` (src/bakecache.ts). This runs BEFORE mount because
 * composition is synchronous and a fetch is not: by the time the scene
 * builds, the tracks are either in hand or absent, and absent simply
 * means "simulate", exactly as before.
 *
 * Duck-typed on purpose. The demo boot has no business knowing which
 * holons bake — a scene without any is a no-op here, and a future
 * baking holon joins by having the method.
 */
const warmBakes = async (dream: object): Promise<void> => {
  const cache = httpBakeCache()
  const warmable = Object.values(dream).filter(
    (v): v is { warmCables(c: unknown): Promise<{ hits: number; total: number }> } =>
      typeof (v as { warmCables?: unknown })?.warmCables === "function",
  )
  for (const holon of warmable) {
    try {
      const { hits, total } = await holon.warmCables(cache)
      if (hits > 0) console.log(`[dreamtalk] bake cache: ${hits}/${total} tethers warm`)
    } catch {
      // The cache is an accelerator. Never a boot failure.
    }
  }
}

const main = async () => {
  const query = new URLSearchParams(location.search)
  const requested = query.get("scene") ?? defaultScene
  const sceneName = scenes[requested] ? requested : defaultScene
  // `path` walks down the holarchy from the scene (demo/explorer.ts): the
  // page IS the DreamNode at its end — window ≡ folder ≡ DreamNode.
  const place = resolvePlace(scenes, sceneName, query.get("path")?.split("/").filter(Boolean) ?? [])
  const DreamCtor = place.Dream
  const dream = new DreamCtor()
  await warmBakes(dream)
  // Optimization A: ribbon instancing, AUTO by default — the host counts the
  // scene's strokes and batches only above INSTANCE_THRESHOLD, where it wins
  // (walls); light scenes keep the per-mesh oracle. `?instanced=1|0` forces
  // it on/off (the byte-identity harness drives oracle vs batch at the same
  // t and compares).
  const q = new URLSearchParams(location.search).get("instanced")
  const useInstancedRibbons = q === "1" ? true : q === "0" ? false : "auto"
  const host = await ThreeHost.mount(dream, canvas, { useInstancedRibbons })
  if (place.alone) await frameAlone(host, dream, canvas)
  const duration = dream.duration

  // Narration, if the scene has any and the daemon has the audio. A scene
  // with no say() calls, or with nothing synthesized yet, simply plays
  // silently — see src/render/narrator.ts.
  const narrator = new Narrator(dream.narration, httpVoiceCache())

  // `?t=` starts the song there (the explorer's way back up; the editor's link).
  const startT = Math.max(0, Number(query.get("t")) || 0) % (duration || 1)
  let playing = true
  let t0 = performance.now() - startT * 1000
  /** The t on screen — where creator mode freezes the world, and resumes it. */
  let current = startT

  const frame = async (now: number) => {
    if (playing) {
      const t = ((now - t0) / 1000) % duration
      current = t
      await host.renderFrame(t)
      narrator.update(t, true)
      readout.textContent = `t = ${t.toFixed(2)}s / ${duration.toFixed(2)}s`
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  // A held frame (creator mode, or the harness's setT) draws nothing on its
  // own, so a Text whose string changed would keep its old glyphs until
  // something rendered again. Redraw the held t when a layout lands —
  // which is what makes a random-access setT across a rule change exact.
  onTextLayout(() => {
    if (!playing) void host.renderFrame(current)
  })

  // --- Creator mode (editor/creator.ts) ------------------------------------
  //
  // One key, from anywhere in the song: the world holds still at this t,
  // the arrow becomes the golden dot, and a click selects instead of
  // firing. The key again (or Esc) and the song carries on from where it
  // stood. Nothing here touches the Dream or the renderer — rims and dot
  // are an overlay — so the harness's captures are exactly what they were.
  const pickAt = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return undefined
    return host.pick(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    )
  }
  let resumeOnExit = false
  const ac = new AbortController()
  const creator: CreatorMode = new CreatorMode(
    { canvas, pick: pickAt, boundsOf: (h) => host.boundsOf(h) },
    {
      clickSelects: true,
      signal: ac.signal,
      onSelect: (holon) => panel.render(holon),
      onToggle: (on) => {
        panel.show(on)
        if (on) {
          resumeOnExit = playing
          playing = false
          narrator.update(Number.NaN, false)
          readout.textContent = `t = ${current.toFixed(2)}s (creator mode)`
        } else {
          creator.select(null)
          panel.render(null)
          if (resumeOnExit) {
            t0 = performance.now() - current * 1000
            playing = true
          }
        }
      },
    },
  )
  const panel = mountCreatorPanel(dream, sceneName, () => current, (holon) => {
    creator.select(holon)
    panel.render(holon)
  })

  // --- The Dream Explorer (demo/explorer.ts) -------------------------------
  //
  // `~`: the scene holds still and disassembles into its DreamNodes; a
  // click enters one. Holds the song exactly as creator mode does.
  let resumeOnHome = false
  const explorer = mountExplorer({
    host,
    dream,
    canvas,
    name: place.name,
    sceneKey: sceneName,
    path: place.crumbs.slice(1).map((c) => c.name),
    crumbs: place.crumbs,
    at: query.get("at") ?? undefined,
    signal: ac.signal,
    hold: () => {
      if (creator.on) creator.toggle(false)
      resumeOnHome = playing
      playing = false
      narrator.update(Number.NaN, false)
      readout.textContent = `t = ${current.toFixed(2)}s (dream explorer)`
      return current
    },
    release: () => {
      if (resumeOnHome) {
        t0 = performance.now() - current * 1000
        playing = true
      }
    },
  })
  ;(window as unknown as Record<string, unknown>).__dtExplorer = explorer
  if (query.get("explore") === "1") explorer.toggle(true)

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (isExplorerToggle(e) || (e.code === "Escape" && explorer.on)) {
      e.preventDefault()
      explorer.toggle(e.code === "Escape" ? false : undefined)
      return
    }
    if (isCreatorToggle(e) || (e.code === "Escape" && creator.on)) {
      e.preventDefault()
      creator.toggle(e.code === "Escape" ? false : undefined)
    }
  })
  ;(window as unknown as Record<string, unknown>).__dtCreator = creator

  ;(window as unknown as Record<string, unknown>).__dtHost = host
  window.__dt = {
    ready: true,
    duration,
    setT: async (t: number) => {
      playing = false
      current = t
      // Twice, deliberately: sync()'s screen-arc measurement projects with
      // the matrices/camera the PREVIOUS render left behind, so a single
      // render after a large jump in t (a scored frame, a chapter cut)
      // draws pen positions against a stale view. The second pass sees the
      // settled state — making setT a pure function of t, which is what
      // the harness assumes when it screenshots.
      await host.renderFrame(t)
      await host.renderFrame(t)
      // A held frame is silent: the gauntlet and every screenshot must sound
      // like nothing, because they are nothing.
      narrator.update(t, false)
      readout.textContent = `t = ${t.toFixed(2)}s (held)`
    },
    play: () => {
      t0 = performance.now()
      playing = true
    },
    pause: () => {
      playing = false
      narrator.update(Number.NaN, false)
    },
  }
}

main().catch((err) => {
  window.__dt = {
    ready: false,
    duration: 0,
    setT: async () => {},
    play: () => {},
    pause: () => {},
    error: String(err?.stack ?? err),
  }
  readout.textContent = String(err)
})
