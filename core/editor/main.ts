/**
 * The DreamTalk editor v1 (EDITOR.md, build order v1 — the loop exists).
 *
 * Viewport (realtime playback) · timeline (scrub, clip marks) · minimal
 * parameter panel (live values; persisted commits land in v2) · the
 * backdrop instrument (image/video, timeline-synced, overlay modes).
 *
 * Served by scripts/daemon.ts: code edits rebuild the bundle and arrive
 * as {type:"reload"} over /ws — the editor re-imports itself cache-busted
 * and remounts, preserving transport state. Choosing a reference in the
 * Backdrop panel sends the setBackdrop semantic op, which writes the
 * `this.backdrop(...)` line into the DreamWeaving; the loop closes back
 * through the file. Drag-drop stays an ephemeral preview.
 *
 * Claude drives this same page headless for overlay evaluation via
 * window.__dt (setT / setBackdrop / play / pause).
 */

import { ThreeHost } from "../src/render/three-host"
import { Holon } from "../src/holon"
import { Param, type ParamValue } from "../src/params"
import { isColor } from "../src/constants"
import { anchorOf, type SourceAnchor } from "./anchors"
import { scenes, defaultScene } from "../demo/scenes"

interface Transport {
  t: number
  playing: boolean
  bdMode?: string
}

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
    /** Transport state handed from the outgoing module to the incoming one. */
    __dtTransport?: Transport
    /** The current mount's teardown-and-reimport, called on daemon reloads. */
    __dtRemount?: () => void
    /** The daemon link — a singleton that survives remounts. */
    __dtWs?: WebSocket
  }
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const SCRUB_MAX = 1000
/** Source file per registry key — semantic ops (setBackdrop/setOverride) target this. */
const SCENE_FILES: Record<string, string> = {
  smoke: "core/demo/FoundingSmoke.ts",
  calibration: "core/demo/StrokeCalibration.ts",
  vocab: "core/demo/VocabShowcase.ts",
  curves: "core/demo/CurvesShowcase.ts",
  text: "core/demo/TextShowcase.ts",
  cameracal: "core/demo/video01/CameraCal.ts",
  s04: "core/demo/video01/S04.ts",
}
const sceneFileFor = (key: string): string =>
  SCENE_FILES[key] ?? "core/demo/FoundingSmoke.ts"

// --- Daemon link (module-independent singleton) ----------------------------

const ensureWs = () => {
  const existing = window.__dtWs
  if (existing && existing.readyState <= WebSocket.OPEN) return
  const ws = new WebSocket(`ws://${location.host}/ws`)
  window.__dtWs = ws
  ws.addEventListener("message", (e) => {
    let msg: { type?: string; reason?: string }
    try {
      msg = JSON.parse(String(e.data)) as { type?: string; reason?: string }
    } catch {
      return
    }
    if (msg.type === "reload") window.__dtRemount?.()
    else if (msg.type === "opRejected") console.warn("[dreamtalk] op rejected:", msg.reason)
  })
  ws.addEventListener("close", () => {
    window.__dtWs = undefined
    setTimeout(ensureWs, 1000)
  })
}

const sendOp = (op: Record<string, unknown>) => {
  const ws = window.__dtWs
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("[dreamtalk] daemon not connected — op dropped")
    return
  }
  ws.send(JSON.stringify(op))
}

// --- The (re)mountable editor ----------------------------------------------

const boot = async (resume?: Transport) => {
  // Fresh stage + backdrop nodes: WebGPU contexts and media elements don't
  // carry across remounts, and the rest of the DOM re-derives below.
  const staleCanvas = $<HTMLCanvasElement>("stage")
  const canvas = document.createElement("canvas")
  canvas.id = "stage"
  canvas.width = 1280
  canvas.height = 720
  staleCanvas.replaceWith(canvas)

  const staleBackdrop = $<HTMLElement>("backdrop")
  const freshBackdrop = document.createElement("video")
  freshBackdrop.id = "backdrop"
  freshBackdrop.muted = true
  freshBackdrop.playsInline = true
  staleBackdrop.replaceWith(freshBackdrop)

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
  const bdRef = $<HTMLSelectElement>("bdref")
  paramsRoot.textContent = ""
  clipsBar.textContent = ""
  frame.className = ""

  const ac = new AbortController()
  const listen = { signal: ac.signal }

  // Which DreamWeaving the editor is editing: /?scene=s04 (registry in
  // demo/scenes.ts). Reproduction scenes carry their own backdrop line.
  const sceneKey = new URLSearchParams(location.search).get("scene") ?? defaultScene
  const DreamCtor = scenes[sceneKey] ?? scenes[defaultScene]!
  const dream = new DreamCtor()
  const host = await ThreeHost.mount(dream, canvas)
  const duration = dream.duration
  $("scenename").textContent = dream.constructor.name.replace(/Dream$/, "")
  $("scenemeta").textContent = `${duration.toFixed(2)}s · ${dream.roots.length} root holon(s)`

  // --- Backdrop instrument -------------------------------------------------
  let backdropEl: HTMLVideoElement | HTMLImageElement = freshBackdrop
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
  bdMode.addEventListener("change", applyBackdropMode, listen)

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

  // Code → UI: the backdrop line in unfold() is the truth.
  const spec = dream.backdropSpec
  if (spec) setBackdrop(`/${spec.path}`, resume?.bdMode ?? "under", spec.offset)

  // The reference list — choosing here commits to code (UI → code).
  const populateRefs = async () => {
    const res = await fetch("/api/refs")
    if (!res.ok) return
    const refs = (await res.json()) as string[]
    bdRef.textContent = ""
    const blank = document.createElement("option")
    blank.value = ""
    blank.textContent = "—"
    bdRef.appendChild(blank)
    for (const path of refs) {
      const option = document.createElement("option")
      option.value = path
      option.textContent = path.replace(/^refs\//, "")
      bdRef.appendChild(option)
    }
    if (spec) bdRef.value = spec.path
  }
  void populateRefs().catch(() => {})

  const commitBackdrop = async (path: string, offset: number) => {
    const res = await fetch(`/api/source?file=${encodeURIComponent(sceneFileFor(sceneKey))}`)
    const baseHash = res.ok ? ((await res.json()) as { hash: string }).hash : undefined
    sendOp({ type: "op", op: "setBackdrop", path, offset, baseHash, file: sceneFileFor(sceneKey) })
  }

  bdRef.addEventListener(
    "change",
    () => {
      const path = bdRef.value
      if (!path) return
      const offset = Number(bdOffset.value) || 0
      // Instant preview; the op loops through the file and re-derives it.
      setBackdrop(`/${path}`, bdMode.value === "off" ? "under" : bdMode.value, offset)
      void commitBackdrop(path, offset)
    },
    listen,
  )
  bdOffset.addEventListener(
    "change",
    () => {
      if (bdRef.value) void commitBackdrop(bdRef.value, Number(bdOffset.value) || 0)
    },
    listen,
  )

  // Drag & drop stays an ephemeral preview — only the reference list writes
  // into the DreamWeaving.
  viewport.addEventListener(
    "dragover",
    (e) => {
      e.preventDefault()
      viewport.classList.add("dragging")
    },
    listen,
  )
  viewport.addEventListener("dragleave", () => viewport.classList.remove("dragging"), listen)
  viewport.addEventListener(
    "drop",
    (e) => {
      e.preventDefault()
      viewport.classList.remove("dragging")
      const file = e.dataTransfer?.files?.[0]
      if (!file) return
      const url = URL.createObjectURL(file)
      const isVideo = file.type.startsWith("video/")
      setBackdrop(isVideo ? `${url}#video` : url, "under")
      if (isVideo) backdropIsVideo = true
      bdSource.textContent = `${file.name} · preview only`
      bdRef.value = ""
    },
    listen,
  )

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

  // Live/persisted split (EDITOR.md): a drag writes the in-memory param
  // only, with the row marked diverged; release commits one setOverride
  // op at the holon's anchored construction site; Escape drops the
  // gesture. The divergence clears when the reload round-trip remounts.
  interface Drag {
    row: HTMLDivElement
    slider: HTMLInputElement
    param: Param<ParamValue>
    before: number
    reverted: boolean
  }
  let drag: Drag | null = null

  const commitOverride = async (
    holon: Holon,
    anchor: SourceAnchor,
    name: string,
    value: number,
  ) => {
    const res = await fetch(`/api/source?file=${encodeURIComponent(anchor.file)}`)
    const baseHash = res.ok ? ((await res.json()) as { hash: string }).hash : undefined
    sendOp({
      type: "op",
      op: "setOverride",
      file: anchor.file,
      span: { start: anchor.start, end: anchor.end },
      className: holon.constructor.name,
      name,
      value,
      baseHash,
    })
  }

  const INTERESTING = new Set(["x", "y", "z", "scale", "creation", "opacity"])
  for (const root of dream.roots) {
    for (const holon of root.walk()) {
      const anchor = anchorOf(holon)
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
          // Committable = the construction site is anchored and the param
          // accepts writes; everything else stays live-only, marked so.
          const target = param.isBound ? undefined : anchor
          if (!target) {
            row.classList.add("liveonly")
            row.title = "live only — not written to code"
          }
          let pending: ReturnType<typeof setTimeout> | undefined
          slider.addEventListener("input", () => {
            pause()
            if (drag?.slider !== slider)
              drag = { row, slider, param, before: param.value as number, reverted: false }
            if (!param.isBound) param.value = Number(slider.value)
            if (target) row.classList.add("diverged")
            void host.renderFrame(current).then(() => syncPanel())
          })
          slider.addEventListener("change", () => {
            const d = drag
            drag = null
            if (d?.reverted || !target) return
            if (pending !== undefined) clearTimeout(pending)
            pending = setTimeout(() => {
              void commitOverride(holon, target, name, Number(slider.value))
            }, 300)
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
  let alive = true

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

  playpause.addEventListener("click", () => (playing ? pause() : play()), listen)
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.code === "Space") {
        e.preventDefault()
        playing ? pause() : play()
      }
      if (e.code === "Escape" && drag && !drag.reverted) {
        // Drop the live override — nothing was ever written.
        const d = drag
        d.reverted = true
        if (!d.param.isBound) d.param.value = d.before
        d.slider.value = String(d.before)
        d.row.classList.remove("diverged")
        void host.renderFrame(current).then(() => syncPanel())
      }
    },
    listen,
  )
  scrub.addEventListener(
    "input",
    () => {
      pause()
      void paint((Number(scrub.value) / SCRUB_MAX) * duration)
    },
    listen,
  )

  const loop = async (now: number) => {
    if (!alive) return
    if (playing) {
      const t = ((now - anchor) / 1000) % duration
      await paint(t)
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  // Code → UI closes here: tear down, hand transport to the fresh module,
  // re-import the rebuilt bundle cache-busted.
  window.__dtRemount = () => {
    window.__dtRemount = undefined
    window.__dtTransport = { t: current, playing, bdMode: bdMode.value }
    alive = false
    ac.abort()
    host.dispose()
    const next = `./main.js?v=${Date.now()}`
    void import(next).catch((err) => console.error("[dreamtalk] remount failed:", err))
  }

  // --- Boot ---------------------------------------------------------------
  if (resume) {
    await paint(resume.t)
    if (resume.playing) play()
  } else {
    const q = new URLSearchParams(location.search)
    if (q.has("backdrop")) {
      setBackdrop(q.get("backdrop")!, q.get("mode") ?? "under", Number(q.get("offset") ?? 0))
    }
    await paint(Number(q.get("t") ?? 0))
    if (q.get("autoplay") !== "0" && !q.has("t")) play()
  }

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

ensureWs()
const resume = window.__dtTransport
window.__dtTransport = undefined

boot(resume).catch((err) => {
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
