/**
 * Demo host page driver — realtime playback loop + hooks for the
 * headless screenshot harness (window.__dt).
 */

import { ThreeHost } from "../src/render/three-host"
import { scenes, defaultScene } from "./scenes"

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

const main = async () => {
  const sceneName = new URLSearchParams(location.search).get("scene") ?? defaultScene
  const DreamCtor = scenes[sceneName] ?? scenes[defaultScene]!
  const dream = new DreamCtor()
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
