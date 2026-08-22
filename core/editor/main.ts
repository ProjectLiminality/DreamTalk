/**
 * The DreamTalk editor v0 (PLAN Ch 7, first breath).
 *
 * Viewport (realtime playback) · timeline (scrub, clip marks) · minimal
 * parameter panel (live values; drags are live-only until bidirectional
 * sync lands) · the backdrop instrument (image/video, timeline-synced,
 * overlay modes exploiting black-as-transparency).
 *
 * Claude drives this same page headless for overlay evaluation via
 * window.__dt (setT / setBackdrop / play / pause).
 */

import { ThreeHost } from "../src/render/three-host"
import { Holon } from "../src/holon"
import { Param, type ParamValue } from "../src/params"
import { isColor } from "../src/constants"
import { FoundingSmokeDream } from "../demo/FoundingSmoke"

declare global {
  interface Window {
    __dt?: {
      ready: boolean
      duration: number
      error?: string
      setT: (t: number) => Promise<void>
      play: () => void
      pause: () => void
      setBackdrop: (url: string, mode?: string, offset?: number) => void
    }
  }
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const canvas = $<HTMLCanvasElement>("stage")
const frame = $<HTMLDivElement>("frame")
const viewport = $<HTMLDivElement>("viewport")
const scrub = $<HTMLInputElement>("scrub")
const timecode = $<HTMLDivElement>("timecode")
const playpause = $<HTMLButtonElement>("playpause")
const paramsRoot = $<HTMLDivElement>("params")
const clipsBar = $<HTMLDivElement>("clips")
const bdMode = $<HTMLSelectElement>("bdmode")
const bdOffset = $<HTMLInputElement>("bdoffset")
const bdSource = $<HTMLSpanElement>("bdsource")

const SCRUB_MAX = 1000

const main = async () => {
  const dream = new FoundingSmokeDream()
  const host = await ThreeHost.mount(dream, canvas)
  const duration = dream.duration
  $("scenename").textContent = dream.constructor.name.replace(/Dream$/, "")
  $("scenemeta").textContent = `${duration.toFixed(2)}s · ${dream.roots.length} root holon(s)`

  // --- Backdrop instrument -------------------------------------------------
  let backdropEl: HTMLVideoElement | HTMLImageElement = $<HTMLVideoElement>("backdrop")
  let backdropIsVideo = false

  const setBackdrop = (url: string, mode = "under", offset = 0) => {
    const isVideo = /\.(mp4|mkv|webm|mov)(\?|$)/i.test(url) || url.startsWith("blob:video")
    const el = document.createElement(isVideo ? "video" : "img") as
      | HTMLVideoElement
      | HTMLImageElement
    el.id = "backdrop"
    if (el instanceof HTMLVideoElement) {
      el.muted = true
      el.playsInline = true
      el.preload = "auto"
    }
    el.src = url
    backdropEl.replaceWith(el)
    backdropEl = el
    backdropIsVideo = el instanceof HTMLVideoElement
    bdMode.value = mode
    bdOffset.value = String(offset)
    bdSource.textContent = url.split("/").pop() ?? url
    applyBackdropMode()
  }

  const applyBackdropMode = () => {
    frame.className = bdMode.value === "off" ? "" : `mode-${bdMode.value}`
  }
  bdMode.addEventListener("change", applyBackdropMode)

  const syncBackdrop = (t: number, playing: boolean) => {
    if (!backdropIsVideo) return
    const video = backdropEl as HTMLVideoElement
    const target = t + Number(bdOffset.value || 0)
    if (playing) {
      if (video.paused) void video.play().catch(() => {})
      if (Math.abs(video.currentTime - target) > 0.08) video.currentTime = target
    } else {
      if (!video.paused) video.pause()
      video.currentTime = Math.max(0, target)
    }
  }

  // Drag & drop a reference file (in-memory for now; the bidirectional
  // write-into-the-DreamWeaving arrives with EDITOR.md).
  viewport.addEventListener("dragover", (e) => {
    e.preventDefault()
    viewport.classList.add("dragging")
  })
  viewport.addEventListener("dragleave", () => viewport.classList.remove("dragging"))
  viewport.addEventListener("drop", (e) => {
    e.preventDefault()
    viewport.classList.remove("dragging")
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const isVideo = file.type.startsWith("video/")
    setBackdrop(isVideo ? `${url}#video` : url, "under")
    if (isVideo) backdropIsVideo = true
  })

  // --- Clip marks ----------------------------------------------------------
  for (const clip of dream.clips) {
    if (clip.duration <= 0) continue
    const mark = document.createElement("div")
    mark.className = "clipmark"
    mark.style.left = `${(clip.start / duration) * 100}%`
    mark.style.width = `${(clip.duration / duration) * 100}%`
    clipsBar.appendChild(mark)
  }

  // --- Parameter panel -----------------------------------------------------
  interface Row {
    param: Param<ParamValue>
    slider?: HTMLInputElement
    val: HTMLElement
    swatch?: HTMLElement
  }
  const rows: Row[] = []

  const sliderRange = (p: Param<ParamValue>): [number, number, number] => {
    if (p.kind === "bipolar") return [-1, 1, 0.01]
    if (p.kind === "completion") return [0, 1, 0.01]
    if (p.kind === "angle") return [-Math.PI, Math.PI, 0.01]
    if (p.kind === "length") return [0, 600, 1]
    return [-600, 600, 1]
  }

  const INTERESTING = new Set(["x", "y", "z", "scale", "creation", "opacity"])
  for (const root of dream.roots) {
    for (const holon of root.walk()) {
      const box = document.createElement("div")
      box.className = "holon"
      const title = document.createElement("div")
      title.className = "hname"
      title.textContent = holon.constructor.name
      box.appendChild(title)
      for (const [name, param] of holon.params) {
        const custom = !INTERESTING.has(name) && !["h", "p", "b"].includes(name)
        const animated = dream.build().params.includes(param)
        if (!custom && !animated && !INTERESTING.has(name)) continue
        if (["h", "p", "b"].includes(name) && !animated) continue
        const row = document.createElement("div")
        row.className = "param"
        const label = document.createElement("label")
        label.textContent = name
        row.appendChild(label)
        const val = document.createElement("div")
        val.className = "val"
        if (isColor(param.value)) {
          const swatch = document.createElement("div")
          swatch.className = "swatch"
          row.appendChild(swatch)
          val.textContent = ""
          row.appendChild(val)
          rows.push({ param, val, swatch })
        } else if (typeof param.value === "number") {
          const slider = document.createElement("input")
          slider.type = "range"
          const [min, max, step] = sliderRange(param)
          slider.min = String(min)
          slider.max = String(max)
          slider.step = String(step)
          slider.addEventListener("input", () => {
            pause()
            if (!param.isBound) param.value = Number(slider.value)
            void host.renderFrame(current).then(() => syncPanel())
          })
          row.appendChild(slider)
          row.appendChild(val)
          rows.push({ param, slider, val })
        } else {
          row.appendChild(document.createElement("span"))
          row.appendChild(val)
          rows.push({ param, val })
        }
        box.appendChild(row)
      }
      paramsRoot.appendChild(box)
    }
  }

  const syncPanel = () => {
    for (const { param, slider, val, swatch } of rows) {
      const v = param.value
      if (isColor(v)) {
        if (swatch)
          swatch.style.background = `rgb(${v.r * 255 | 0},${v.g * 255 | 0},${v.b * 255 | 0})`
      } else if (typeof v === "number") {
        if (slider && document.activeElement !== slider) slider.value = String(v)
        val.textContent = Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2)
      } else {
        val.textContent = String(v)
      }
    }
  }

  // --- Transport -----------------------------------------------------------
  let playing = false
  let current = 0
  let anchor = performance.now()

  const paint = async (t: number) => {
    current = t
    await host.renderFrame(t)
    syncBackdrop(t, playing)
    scrub.value = String((t / duration) * SCRUB_MAX)
    timecode.textContent = `${t.toFixed(2)} / ${duration.toFixed(2)}`
    syncPanel()
  }

  const play = () => {
    playing = true
    anchor = performance.now() - current * 1000
    playpause.textContent = "⏸"
  }
  const pause = () => {
    playing = false
    playpause.textContent = "▶"
    syncBackdrop(current, false)
  }

  playpause.addEventListener("click", () => (playing ? pause() : play()))
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault()
      playing ? pause() : play()
    }
  })
  scrub.addEventListener("input", () => {
    pause()
    void paint((Number(scrub.value) / SCRUB_MAX) * duration)
  })

  const loop = async (now: number) => {
    if (playing) {
      const t = ((now - anchor) / 1000) % duration
      await paint(t)
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  // --- Boot ---------------------------------------------------------------
  const q = new URLSearchParams(location.search)
  if (q.has("backdrop")) {
    setBackdrop(q.get("backdrop")!, q.get("mode") ?? "under", Number(q.get("offset") ?? 0))
  }
  await paint(Number(q.get("t") ?? 0))
  if (q.get("autoplay") !== "0" && !q.has("t")) play()

  window.__dt = {
    ready: true,
    duration,
    setT: async (t: number) => {
      pause()
      await paint(t)
    },
    play,
    pause,
    setBackdrop,
  }
}

main().catch((err) => {
  window.__dt = {
    ready: false,
    duration: 0,
    error: String(err?.stack ?? err),
    setT: async () => {},
    play: () => {},
    pause: () => {},
    setBackdrop: () => {},
  }
  document.body.innerHTML = `<pre style="color:#f66;padding:20px">${String(err?.stack ?? err)}</pre>`
})
