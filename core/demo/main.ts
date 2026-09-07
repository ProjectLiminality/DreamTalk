/**
 * Demo host page driver — realtime playback loop + hooks for the
 * headless screenshot harness (window.__dt).
 */

import { ThreeHost } from "../src/render/three-host"
import { scenes, defaultScene } from "./scenes"
import { httpBakeCache } from "../src/bakecache"

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
  const sceneName = new URLSearchParams(location.search).get("scene") ?? defaultScene
  const DreamCtor = scenes[sceneName] ?? scenes[defaultScene]!
  const dream = new DreamCtor()
  await warmBakes(dream)
  const host = await ThreeHost.mount(dream, canvas)
  const duration = dream.duration

  let playing = true
  let t0 = performance.now()

  const frame = async (now: number) => {
    if (playing) {
      const t = ((now - t0) / 1000) % duration
      await host.renderFrame(t)
      readout.textContent = `t = ${t.toFixed(2)}s / ${duration.toFixed(2)}s`
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  ;(window as unknown as Record<string, unknown>).__dtHost = host
  window.__dt = {
    ready: true,
    duration,
    setT: async (t: number) => {
      playing = false
      // Twice, deliberately: sync()'s screen-arc measurement projects with
      // the matrices/camera the PREVIOUS render left behind, so a single
      // render after a large jump in t (a scored frame, a chapter cut)
      // draws pen positions against a stale view. The second pass sees the
      // settled state — making setT a pure function of t, which is what
      // the harness assumes when it screenshots.
      await host.renderFrame(t)
      await host.renderFrame(t)
      readout.textContent = `t = ${t.toFixed(2)}s (held)`
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
