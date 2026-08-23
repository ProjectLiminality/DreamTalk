/**
 * The DreamTalk editor (EDITOR.md v1-v2 + EDITOR-V3 step 1 — SELECTION).
 *
 * Four Keynote regions: holarchy outline (left, cmd+shift+L) · viewport
 * with click-to-select · inspector showing ONLY the selected holon
 * (right) · timeline (bottom). The backdrop instrument lives with the
 * scene-level properties, which is what the inspector falls back to when
 * nothing is selected.
 *
 * Selection is shared editor state (EDITOR-V3 decision 1): one
 * `Selection` store that the viewport, the outline and the inspector all
 * read and all write. The host answers "what holon is under this pixel?"
 * (three-host pick/boundsOf); every holon carries its source anchor, so a
 * selection is also a file and a byte range — the bridge between the
 * visual and the code.
 *
 * Served by scripts/daemon.ts: code edits rebuild the bundle and arrive
 * as {type:"reload"} over /ws — the editor re-imports itself cache-busted
 * and remounts, preserving transport state AND the selection (matched by
 * part path, since holon identities do not survive a rebuild). Choosing a
 * reference in the Backdrop panel sends the setBackdrop semantic op,
 * which writes the `this.backdrop(...)` line into the DreamWeaving; the
 * loop closes back through the file. Drag-drop stays an ephemeral preview.
 *
 * Claude drives this same page headless for overlay evaluation via
 * window.__dt (setT / setBackdrop / play / pause / select / pick).
 */

import { ThreeHost } from "../src/render/three-host"
import { Holon } from "../src/holon"
import { Param, type ParamValue } from "../src/params"
import { isColor } from "../src/constants"
import { anchorOf, type SourceAnchor } from "./anchors"
import { scenes, defaultScene } from "../demo/scenes"
import { Selection, pathOf, type SelectionPath } from "./selection"
import { mountOutline, identityOf, rootIdentityOf } from "./outline"
import { Marquee } from "./marquee"
import { formatValue, inspectorGroups, sliderRange } from "./inspector"
import { classNameOf } from "./classname"

interface Transport {
  t: number
  playing: boolean
  bdMode?: string
  /** Where the selection sat, as a part path (holon identities are fresh). */
  selection?: SelectionPath
  /** Whether the holarchy outline was open. */
  outline?: boolean
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
      /** Selection, for headless verification and for agent-driven editing. */
      pick?: (ndcX: number, ndcY: number) => string | undefined
      selectAt?: (ndcX: number, ndcY: number) => string | undefined
      selected?: () => { className: string; identity?: string; anchor?: SourceAnchor } | undefined
      clearSelection?: () => void
      /** The selection's screen bounds in render pixels — headless checks. */
      bounds?: () => { minX: number; minY: number; maxX: number; maxY: number } | undefined
      /** Suppress the selection affordance entirely (never in a render). */
      setAffordance?: (on: boolean) => void
      toggleOutline?: () => boolean
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
  s01: "core/demo/video01/S01.ts",
  s02: "core/demo/video01/S02.ts",
  s03: "core/demo/video01/S03.ts",
  s04: "core/demo/video01/S04.ts",
  s06: "core/demo/video01/S06.ts",
  s09: "core/demo/video01/S09.ts",
  s05: "core/demo/video01/S05.ts",
  s10: "core/demo/video01/S10.ts",
  s07: "core/demo/video01/S07.ts",
  s08: "core/demo/video01/S08.ts",
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
  const treeRoot = $<HTMLDivElement>("tree")
  const app = $<HTMLDivElement>("app")
  const marquee = new Marquee($<HTMLCanvasElement>("marquee"))
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
  const sceneName = dream.constructor.name.replace(/Dream$/, "")

  // --- Selection: one store, read and written by every panel ---------------
  const selection = new Selection()

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

  // --- Inspector: the SELECTED holon's properties, and nothing else --------
  //
  // With a selection: exactly what the promotion protocol exposes for it
  // (editor/inspector.ts — declared params + standard params the timeline
  // animates, grouped). With none: the scene's own properties, which is
  // where the backdrop instrument lives.
  interface Row {
    param: Param<ParamValue>
    slider?: HTMLInputElement
    val: HTMLElement
    swatch?: HTMLElement
  }
  let rows: Row[] = []

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

  /** One param row, with the live/persisted split intact. */
  const buildRow = (
    holon: Holon,
    anchor: SourceAnchor | undefined,
    name: string,
    param: Param<ParamValue>,
  ): HTMLDivElement => {
    const row = document.createElement("div")
    row.className = "param"
    const label = document.createElement("label")
    label.textContent = name
    label.title = `${name} · ${param.kind}`
    row.appendChild(label)
    const val = document.createElement("div")
    val.className = "val"

    if (param.isBound) {
      // PARAMETERS rule: a bound param is read-only, and the panel says so.
      row.classList.add("bound")
      const bind = document.createElement("div")
      bind.className = "bind"
      bind.textContent = "bound"
      bind.title = "follows a derived binding — animate its source"
      row.appendChild(bind)
      val.textContent = formatValue(param.value)
      row.appendChild(val)
      rows.push({ param, val })
      return row
    }

    if (isColor(param.value)) {
      const swatch = document.createElement("div")
      swatch.className = "swatch"
      row.appendChild(swatch)
      val.textContent = ""
      row.appendChild(val)
      rows.push({ param, val, swatch })
      return row
    }

    if (typeof param.value === "number") {
      const slider = document.createElement("input")
      slider.type = "range"
      const [min, max, step] = sliderRange(param)
      slider.min = String(min)
      slider.max = String(max)
      slider.step = String(step)
      // Committable = the construction site is anchored; everything else
      // stays live-only, marked so.
      const target = anchor
      if (!target) {
        row.classList.add("liveonly")
        row.title = "live only — not written to code"
      }
      let pending: ReturnType<typeof setTimeout> | undefined
      slider.addEventListener("input", () => {
        pause()
        if (drag?.slider !== slider)
          drag = { row, slider, param, before: param.value as number, reverted: false }
        param.value = Number(slider.value)
        if (target) row.classList.add("diverged")
        void host.renderFrame(current).then(() => syncPanel())
      }, listen)
      slider.addEventListener("change", () => {
        const d = drag
        drag = null
        if (d?.reverted || !target) return
        if (pending !== undefined) clearTimeout(pending)
        pending = setTimeout(() => {
          void commitOverride(holon, target, name, Number(slider.value))
        }, 300)
      }, listen)
      row.appendChild(slider)
      row.appendChild(val)
      rows.push({ param, slider, val })
      return row
    }

    // Booleans and anything else: shown, read, not yet editable.
    row.appendChild(document.createElement("span"))
    val.textContent = formatValue(param.value)
    row.appendChild(val)
    rows.push({ param, val })
    return row
  }

  const backdropPanel = $<HTMLDivElement>("backdroppanel")
  const nameEl = $<HTMLHeadingElement>("scenename")
  const metaEl = $<HTMLDivElement>("scenemeta")

  /** Rebuild the whole inspector from the current selection. */
  const renderInspector = (holon: Holon | null) => {
    rows = []
    paramsRoot.textContent = ""
    // The backdrop instrument is a SCENE property (its line lives in
    // unfold()), so it belongs to the no-selection state — and it is
    // load-bearing for the gauntlet, so it must always be reachable.
    backdropPanel.style.display = holon ? "none" : ""

    if (!holon) {
      nameEl.textContent = sceneName
      nameEl.classList.remove("selected")
      metaEl.textContent = `${duration.toFixed(2)}s · ${dream.roots.length} root holon(s)`
      metaEl.title = sceneFileFor(sceneKey)
      const hint = document.createElement("div")
      hint.className = "empty"
      hint.textContent = "Nothing selected — click an object in the viewport."
      paramsRoot.appendChild(hint)
      return
    }

    const identity = holon.parent
      ? identityOf(holon)
      : rootIdentityOf(dream as unknown as object, holon)
    const anchor = anchorOf(holon)
    nameEl.textContent = classNameOf(holon)
    nameEl.classList.add("selected")
    // A selection knows its file and byte range — the bridge to the code.
    metaEl.textContent = identity
      ? `${identity}${anchor ? ` · ${anchor.file.split("/").pop()}` : ""}`
      : anchor
        ? anchor.file.split("/").pop()!
        : "—"
    metaEl.title = anchor ? `${anchor.file}:${anchor.start}:${anchor.end}` : ""

    const animated = dream.build().params
    const groups = inspectorGroups(holon, animated)
    if (groups.length === 0) {
      const hint = document.createElement("div")
      hint.className = "empty"
      hint.textContent = "No exposed parameters."
      paramsRoot.appendChild(hint)
      return
    }
    for (const group of groups) {
      const box = document.createElement("div")
      box.className = "group"
      const title = document.createElement("h3")
      title.textContent = group.title
      box.appendChild(title)
      for (const entry of group.entries) {
        box.appendChild(buildRow(holon, anchor, entry.name, entry.param))
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
        val.textContent = formatValue(v)
      } else {
        val.textContent = formatValue(v)
      }
    }
  }

  // --- Holarchy outline (cmd+shift+L) --------------------------------------
  mountOutline(treeRoot, dream as unknown as object, dream.roots, selection, ac.signal)

  let outlineOpen = resume?.outline ?? true
  const applyOutline = () => app.classList.toggle("no-outline", !outlineOpen)
  applyOutline()
  const toggleOutline = (): boolean => {
    outlineOpen = !outlineOpen
    applyOutline()
    return outlineOpen
  }

  // --- Click-to-select in the viewport -------------------------------------
  //
  // The canvas's CSS box maps to NDC; the host answers from its own
  // drawing buffer, so a scaled/letterboxed viewport picks correctly.
  const pickAt = (clientX: number, clientY: number): Holon | undefined => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return undefined
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1)
    return host.pick(ndcX, ndcY)
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return
      // Empty space clears — direct manipulation's own affordance.
      selection.set(pickAt(e.clientX, e.clientY) ?? null)
    },
    listen,
  )

  // The affordance rides the selection AND every repaint (a selected
  // holon that moves keeps its mark).
  const paintMarquee = () => {
    const holon = selection.current
    marquee.draw(
      holon ? host.boundsOf(holon) : undefined,
      host.renderer.domElement.width,
      host.renderer.domElement.height,
    )
  }

  selection.subscribe((holon) => {
    renderInspector(holon)
    syncPanel()
    paintMarquee()
  })

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
    // The mark follows the object, so a selected holon stays marked as
    // the scene animates. Drawn on its own canvas — never in the render.
    paintMarquee()
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
      // Keynote's outline toggle, on Keynote's chord.
      if (e.code === "KeyL" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleOutline()
      }
      if (e.code === "Escape") {
        if (drag && !drag.reverted) {
          // Drop the live override — nothing was ever written.
          const d = drag
          d.reverted = true
          if (!d.param.isBound) d.param.value = d.before
          d.slider.value = String(d.before)
          d.row.classList.remove("diverged")
          void host.renderFrame(current).then(() => syncPanel())
        } else {
          // …otherwise Escape means "nothing selected".
          selection.clear()
        }
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
    // The selection travels as a PART PATH: a rebuild makes fresh Holon
    // instances, so identity cannot survive, but "the third part of the
    // second root, still a Circle" can.
    const held = selection.current
    window.__dtTransport = {
      t: current,
      playing,
      bdMode: bdMode.value,
      selection: held ? pathOf(dream.roots, held) : undefined,
      outline: outlineOpen,
    }
    alive = false
    ac.abort()
    host.dispose()
    const next = `./main.js?v=${Date.now()}`
    void import(next).catch((err) => console.error("[dreamtalk] remount failed:", err))
  }

  // --- Boot ---------------------------------------------------------------
  // Nothing selected is the honest opening state (the inspector shows the
  // scene) — unless a remount is handing a selection back.
  selection.rehydrate(dream.roots, resume?.selection)
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
    pick: (ndcX, ndcY) => {
      const holon = host.pick(ndcX, ndcY)
      return holon ? classNameOf(holon) : undefined
    },
    selectAt: (ndcX, ndcY) => {
      const holon = host.pick(ndcX, ndcY) ?? null
      selection.set(holon)
      return holon ? classNameOf(holon) : undefined
    },
    selected: () => {
      const holon = selection.current
      if (!holon) return undefined
      return {
        className: classNameOf(holon),
        identity: holon.parent
          ? identityOf(holon)
          : rootIdentityOf(dream as unknown as object, holon),
        anchor: anchorOf(holon),
      }
    },
    clearSelection: () => selection.clear(),
    bounds: () => {
      const holon = selection.current
      const box = holon ? host.boundsOf(holon) : undefined
      if (!box) return undefined
      return { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y }
    },
    setAffordance: (on: boolean) => {
      marquee.enabled = on
      paintMarquee()
    },
    toggleOutline,
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
