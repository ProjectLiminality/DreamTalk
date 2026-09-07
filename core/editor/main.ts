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
 * THE LIVE LAYER (EDITOR-V4.md): the frame path is
 * `apply(t) -> overlay overrides -> sync -> render`, wired through the
 * host's `beforeSync` hook. Tweaking a param no longer writes into the
 * param (which `Timeline.apply(t)` would destroy on the next frame) — it
 * writes an override, so a tweak takes effect even while PLAYING, and
 * snaps back the moment the playhead moves. Flying the camera is the same
 * mechanism on the Observer's spherical params, with an eased return to
 * the timeline's pose on play. Overrides live here, never in the Dream:
 * the gauntlet and export always sample the pure timeline.
 *
 * Claude drives this same page headless for overlay evaluation via
 * window.__dt (setT / setBackdrop / play / pause / select / pick / fly).
 */

import { ThreeHost } from "../src/render/three-host"
import { Holon } from "../src/holon"
import { Param, type ParamValue } from "../src/params"
import { isColor } from "../src/constants"
import { anchorOf, type SourceAnchor } from "./anchors"
import { scenes, defaultScene } from "../demo/scenes"
import { Selection, pathOf, type SelectionPath } from "./selection"
import { mountOutline, identityOf, rootIdentityOf } from "./outline"
import { mountNavigator } from "./navigator"
import { mountCast } from "./cast"
import { Marquee } from "./marquee"
import { MoveGesture, cameraFrameOf, movable } from "./manipulate"
import { buildParamRow, formatValue, inspectorGroups } from "./inspector"
import type { NumericFieldHandle } from "./numeric"
import { classNameOf } from "./classname"
import { mountCodeView } from "./codeview"
import { mountTimeline, stepTime, type ClipRow, type TimelineHandle } from "./timeline"
import { mountCheckpoint, type CaptureTarget, type CheckpointHandle } from "./checkpoint"
import { exitUrl, isPlayerMode, mountPlayerTransport, type PlayerTransport } from "./player"
import { thumbnailEl } from "./thumbnails"
import { UndoStack, undoAction, type OpDescriptor } from "./undo"
import {
  Overrides,
  RETURN_SECONDS,
  clampTheta,
  dollyRadius,
  lerpPose,
  ORBIT_PER_WIDTH,
  type Pose,
} from "./overrides"

interface Transport {
  t: number
  playing: boolean
  bdMode?: string
  /** Where the selection sat, as a part path (holon identities are fresh). */
  selection?: SelectionPath
  /** Whether the holarchy outline was open. */
  outline?: boolean
  /** Whether the code view was open (its content re-fetches either way). */
  code?: boolean
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
      /** The open scene's registry key, and the rail's switch — headless. */
      sceneKey?: string
      openScene?: (key: string) => void
      /** The cast bar's members (sovereign classes), for verification. */
      cast?: () => string[]
      /** Hover glow (LOOPS.md game-loop seed): glow the sovereign under a
       *  point / read what glows — headless driving and verification. */
      hoverAt?: (ndcX: number, ndcY: number) => string | undefined
      hovered?: () => string | undefined
      // --- The live layer (EDITOR-V4), exposed for headless verification ---
      /** Overlay a value on a named param of the selected holon. */
      setOverride?: (name: string, value: number) => boolean
      /** How many live overrides stand right now, and on what. */
      overrides?: () => { name: string; value: number; animated: boolean }[]
      /** Fly the observer as a drag/scroll would, in viewport pixels. */
      fly?: (dx: number, dy: number, mode?: "orbit" | "pan") => void
      dolly?: (deltaY: number) => void
      /** The observer's live pose — flown or from the timeline. */
      pose?: () => Pose
      /** The code view (ctrl+/), for headless verification. */
      toggleCode?: () => boolean
      /** Select the nth play() clip — the timeline's rows, headlessly. */
      selectClip?: (index: number) => string | undefined
      // --- Checkpoint capture (EDITOR-V5), exposed for headless driving ---
      /** The current pose as the op would spell it. */
      captureTargets?: () => CaptureTarget[]
      /** Where a capture would land right now — headless diagnostics. */
      capturePlacement?: () => Record<string, unknown>
      /** Capture the pose into the scene file; resolves to the op sent. */
      capture?: (duration?: number) => Promise<Record<string, unknown> | undefined>
      /** Release every live override without writing — the pose evaporates. */
      discardPose?: () => void
      /** The playhead's current t — headless verification (frame stepping). */
      currentT?: () => number
      // --- The undo stack (cmd+Z / shift+cmd+Z), exposed for headless driving ---
      /** Release the live layer, or send the newest inverse op. */
      undo?: () => void
      redo?: () => void
      /** How deep each stack is right now. */
      history?: () => { undo: number; redo: number }
    }
    /** Transport state handed from the outgoing module to the incoming one. */
    __dtTransport?: Transport
    /** The current mount's teardown-and-reimport, called on daemon reloads. */
    __dtRemount?: () => void
    /** The daemon link — a singleton that survives remounts. */
    __dtWs?: WebSocket
    /** The undo stack — a singleton too: ops outlive the module that sent them. */
    __dtUndo?: UndoStack
    /** A note parked for the mount the current reload is about to build. */
    __dtNote?: string
  }
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

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
  video01: "core/demo/video01/DialecticalThinking.ts",
}
const sceneFileFor = (key: string): string =>
  SCENE_FILES[key] ?? "core/demo/FoundingSmoke.ts"

// --- Daemon link (module-independent singleton) ----------------------------

// --- The undo stack (a singleton, like the socket) -------------------------
//
// Every op write is followed by a daemon reload, which REMOUNTS the editor
// module — so anything that must remember what happened across edits
// cannot live inside boot(). The stack sits beside the socket for the same
// reason, and for the same lifetime: one browser session.
const undoStack = (window.__dtUndo ??= new UndoStack())

/** Set by boot() so ack/reload handling can reach the current mount's UI. */
let historyNote: ((text: string) => void) | undefined

/**
 * A note that must outlive the remount it was raised by. The external-edit
 * clear happens on the OUTGOING module — the same reload then rebuilds the
 * DOM, so a note shown now is wiped before it can be read. Parking it here
 * lets the fresh mount pick it up and say it, which is the only way the
 * user ever learns their history is gone.
 */
const setPendingNote = (text: string) => {
  window.__dtNote = text
}

const ensureWs = () => {
  const existing = window.__dtWs
  if (existing && existing.readyState <= WebSocket.OPEN) return
  const ws = new WebSocket(`ws://${location.host}/ws`)
  window.__dtWs = ws
  ws.addEventListener("message", (e) => {
    let msg: {
      type?: string
      reason?: string
      opId?: string
      undo?: OpDescriptor
      external?: string[]
    }
    try {
      msg = JSON.parse(String(e.data)) as typeof msg
    } catch {
      return
    }
    if (msg.type === "reload") {
      // A reload the daemon attributes to a write it did not make: every
      // inverse on the stack was computed against bytes that no longer
      // stand, so history is void. Saying so is part of the contract —
      // silently emptying the stack would be worse than not having one.
      // Parked rather than shown: this same reload rebuilds the DOM, so
      // the fresh mount is what actually says it.
      if (msg.external?.length && undoStack.clear())
        setPendingNote("history cleared (file edited)")
      window.__dtRemount?.()
    } else if (msg.type === "opApplied") {
      undoStack.applied(msg)
    } else if (msg.type === "opRejected") {
      undoStack.rejected(msg.opId)
      console.warn("[dreamtalk] op rejected:", msg.reason)
      historyNote?.(`refused: ${msg.reason ?? "unknown"}`)
    }
  })
  ws.addEventListener("close", () => {
    window.__dtWs = undefined
    setTimeout(ensureWs, 1000)
  })
}

/**
 * Send an op, stamped with the id its ack will carry back. Every write
 * path in the editor goes through here, which is exactly why the stack
 * needs no per-gesture bookkeeping: an op is an op.
 */
const sendOp = (op: Record<string, unknown>) => {
  const ws = window.__dtWs
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("[dreamtalk] daemon not connected — op dropped")
    return
  }
  ws.send(JSON.stringify({ opId: undoStack.nextOpId(), ...op }))
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
  const timecode = $<HTMLDivElement>("timecode")
  const playpause = $<HTMLButtonElement>("playpause")
  const paramsRoot = $<HTMLDivElement>("params")
  const treeRoot = $<HTMLDivElement>("tree")
  const app = $<HTMLDivElement>("app")
  const marquee = new Marquee($<HTMLCanvasElement>("marquee"))
  const clipsBar = $<HTMLDivElement>("clips")
  const rulerEl = $<HTMLDivElement>("ruler")
  const codePanel = $<HTMLDivElement>("codeview")
  const codeBody = $<HTMLPreElement>("codebody")
  const codeFile = $<HTMLDivElement>("codefile")
  const bdMode = $<HTMLSelectElement>("bdmode")
  const bdOffset = $<HTMLInputElement>("bdoffset")
  const bdSource = $<HTMLSpanElement>("bdsource")
  const bdRef = $<HTMLSelectElement>("bdref")
  paramsRoot.textContent = ""
  clipsBar.textContent = ""
  frame.className = ""

  const ac = new AbortController()
  const listen = { signal: ac.signal }

  // The presentation mode (LOOPS.md): `?mode=player` is the cutscene+game
  // presentation — the same engine with the creator tooling unmounted and
  // the creator chrome hidden. One flag, two chromes.
  const playerMode = isPlayerMode(location.search)
  document.body.classList.toggle("player", playerMode)
  if (playerMode) marquee.enabled = false

  // Which DreamWeaving the editor is editing: /?scene=s04 (registry in
  // demo/scenes.ts). Reproduction scenes carry their own backdrop line.
  const sceneKey = new URLSearchParams(location.search).get("scene") ?? defaultScene
  const DreamCtor = scenes[sceneKey] ?? scenes[defaultScene]!
  const dream = new DreamCtor()
  const host = await ThreeHost.mount(dream, canvas)
  const duration = dream.duration
  const sceneName = dream.constructor.name.replace(/Dream$/, "")

  // --- The live layer (EDITOR-V4) ------------------------------------------
  //
  // Rule 1 made mechanical: the host samples the timeline, then calls this
  // hook, then syncs. Everything downstream — geometry, camera, picker,
  // the inspector's readouts — reads params that already carry the
  // overlay, so nothing else in the editor or the renderer has to know
  // the live layer exists. The Dream is untouched.
  const overrides = new Overrides(dream.build())
  host.beforeSync = () => overrides.apply()

  // --- Selection: one store, read and written by every panel ---------------
  const selection = new Selection()

  // --- Hover glow (LOOPS.md: the game loop's first seed) --------------------
  //
  // A sovereign symbol is a BUTTON (game loop), and the glow is its
  // affordance: pointer over any of its ink — however deep the hit, a
  // grid line is still the Axes' ink — lifts the SOVEREIGN's strokes.
  // Non-sovereign parts alone never glow: invisible assets are not
  // buttons. Editor-only by construction: the lift lives in the host's
  // per-frame tint/width values (three-host highlight()), never in the
  // Dream, and nothing in the demo or gauntlet path ever calls it.

  /** The nearest sovereign at-or-above a hit — the symbol that is the button. */
  const sovereignOf = (holon: Holon | undefined): Holon | undefined => {
    for (let node: Holon | null | undefined = holon; node; node = node.parent) {
      if ((node.constructor as { sovereign?: boolean }).sovereign === true) return node
    }
    return undefined
  }

  /** What glows right now: a sovereign under the pointer, or a cast chip's instances. */
  let glowing: Holon | readonly Holon[] | null = null
  const applyGlow = (target: Holon | readonly Holon[] | null) => {
    if (target === glowing) return
    glowing = target
    host.highlight(target)
    canvas.classList.toggle("hoverable", !!target)
    void host.renderFrame(current)
  }

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

  // Code → UI: the backdrop line in unfold() is the truth. The player
  // never shows it — the reference layer is a creator instrument.
  const spec = dream.backdropSpec
  if (spec && !playerMode) setBackdrop(`/${spec.path}`, resume?.bdMode ?? "under", spec.offset)

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
  if (!playerMode) void populateRefs().catch(() => {})

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

  // --- The code view and the timeline, which know about each other ---------
  //
  // Both are mounted below (they need `paint`, defined with the transport),
  // but the clip selection they share is declared here because the
  // inspector's header reads it too: selecting a clip is a selection in
  // exactly the sense selecting a holon is, and only one of the two can
  // stand at a time.
  const code = playerMode ? undefined : mountCodeView(codePanel, codeBody, codeFile)
  let selectedClip: ClipRow | null = null
  // Mounted with the transport (it needs `paint`); referenced before then
  // by paint() and the selection subscription, both of which run after.
  let timeline: TimelineHandle | undefined
  // Mounted beside the timeline; referenced from paint() and Escape.
  let checkpoint: CheckpointHandle | undefined
  // The player's own chrome — mounted only under ?mode=player.
  let ptransport: PlayerTransport | undefined

  // --- Inspector: the SELECTED holon's properties, and nothing else --------
  //
  // With a selection: exactly what the promotion protocol exposes for it
  // (editor/inspector.ts — declared params + standard params the timeline
  // animates, grouped). With none: the scene's own properties, which is
  // where the backdrop instrument lives.
  interface Row {
    param: Param<ParamValue>
    slider?: HTMLInputElement
    field?: NumericFieldHandle
    val?: HTMLElement
    swatch?: HTMLElement
    /** The row element, so a cleared override can un-mark it. */
    el?: HTMLDivElement
  }
  let rows: Row[] = []

  // Live/persisted split (EDITOR.md): a gesture writes the live layer
  // only, with the row marked diverged; release commits one setOverride
  // op at the holon's anchored construction site; Escape drops the
  // gesture. The divergence clears when the reload round-trip remounts.
  interface Drag {
    row: HTMLDivElement
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

  /**
   * One param row. The row's CONSTRUCTION lives in editor/inspector.ts
   * (which owns what a row is — a C4D numeric field, a slider only where a
   * bounded range means something, a swatch, a bound annotation); what
   * stays here is the only part this module can own: where the value GOES.
   * On input it goes into the live layer; on commit it goes into the file.
   */
  const buildRow = (
    holon: Holon,
    anchor: SourceAnchor | undefined,
    name: string,
    param: Param<ParamValue>,
  ): HTMLDivElement => {
    const target = anchor
    let pending: ReturnType<typeof setTimeout> | undefined

    const built = buildParamRow(name, param, {
      committable: target !== undefined,
      signal: ac.signal,
      onInput: (p, _n, value) => {
        // No pause(): the live layer survives a frame, so a tweak takes
        // effect WHILE PLAYING — until the playhead moves past it.
        if (drag?.param !== p)
          drag = { row: built.el, param: p, before: p.value as number, reverted: false }
        overrides.set(p, value)
        built.el.classList.add(target ? "diverged" : "live")
        void host.renderFrame(current).then(() => syncPanel())
      },
      onCommit: (_p, n, value) => {
        const d = drag
        drag = null
        if (d?.reverted || !target) return
        if (pending !== undefined) clearTimeout(pending)
        pending = setTimeout(() => {
          void commitOverride(holon, target, n, value)
        }, 300)
      },
    })

    if (!target && typeof param.value === "number" && !param.isBound) {
      built.el.title = "live only — not written to code"
    }
    rows.push({
      param: built.param,
      slider: built.slider,
      field: built.field,
      val: built.val,
      swatch: built.swatch,
      el: built.el,
    })
    return built.el
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
    nameEl.textContent = ""
    // The symbol's own face beside its name — the same glyph the outline
    // row carries, so the two panels name the selection identically.
    nameEl.appendChild(thumbnailEl(holon, 15))
    nameEl.appendChild(document.createTextNode(classNameOf(holon)))
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
    for (const { param, slider, field, val, swatch } of rows) {
      const v = param.value
      if (isColor(v)) {
        if (swatch)
          swatch.style.background = `rgb(${v.r * 255 | 0},${v.g * 255 | 0},${v.b * 255 | 0})`
      } else if (typeof v === "number") {
        if (slider && document.activeElement !== slider) slider.value = String(v)
        // The field refuses the write while it is being dragged or typed
        // into, so a scrubbing timeline never fights the hand on the field.
        field?.set(v)
        if (val) val.textContent = formatValue(v)
      } else if (val) {
        val.textContent = formatValue(v)
      }
    }
  }

  // --- Holarchy outline (cmd+shift+L) --------------------------------------
  if (!playerMode)
    mountOutline(treeRoot, dream as unknown as object, dream.roots, selection, ac.signal)

  // --- Scene navigator + cast bar (EDITOR-V3 step 2) ------------------------
  //
  // Switching scenes is the daemon-reload remount minus the handover:
  // same teardown, fresh boot, and NOTHING resumes — a different scene
  // means fresh transport, selection and backdrop. The URL is kept
  // honest via history.replaceState, so ?scene= deep links keep working
  // and a browser reload lands where the rail left you.
  const teardown = () => {
    alive = false
    ac.abort()
    navigator?.dispose()
    castBar?.dispose()
    checkpoint?.dispose()
    ptransport?.dispose()
    host.dispose()
  }

  const switchScene = (key: string) => {
    if (key === sceneKey || !scenes[key]) return
    const q = new URLSearchParams(location.search)
    q.set("scene", key)
    q.delete("t")
    q.delete("backdrop")
    q.delete("mode")
    q.delete("offset")
    history.replaceState(null, "", `${location.pathname}?${q.toString()}`)
    window.__dtRemount = undefined
    teardown()
    void boot().catch((err) => console.error("[dreamtalk] scene switch failed:", err))
  }

  const navigator = playerMode
    ? undefined
    : mountNavigator($("rail"), scenes, sceneKey, switchScene, ac.signal)
  // A chip is the class in person: hovering it glows every instance in
  // the viewport — the same affordance as hovering the ink itself.
  const castBar = playerMode
    ? undefined
    : mountCast($("cast"), dream.roots, selection, ac.signal, applyGlow)

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
  const ndcAt = (clientX: number, clientY: number): { x: number; y: number } | undefined => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return undefined
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((clientY - rect.top) / rect.height) * 2 - 1),
    }
  }
  const pickAt = (clientX: number, clientY: number): Holon | undefined => {
    const ndc = ndcAt(clientX, clientY)
    return ndc ? host.pick(ndc.x, ndc.y) : undefined
  }

  // --- Moving the selection (EDITOR-V5, "Direct manipulation") --------------
  //
  // Keynote semantics: you drag what you SELECTED. A press on the current
  // selection (any of its ink, however deep the hit) arms a move; a press
  // on anything else keeps the old contract — select what was hit, and let
  // a drag fly the camera. The two gestures are disambiguated entirely by
  // what the pointerdown lands on, so the flying Observer loses nothing:
  // empty space still orbits.
  //
  // The gesture rides the live layer exactly as the inspector's rows do
  // (EDITOR-V4): drag → overrides on x/y; release → one setOverride per
  // changed param through the same commitOverride; Escape → revert, no
  // write. Engaging pauses playback (decision 3) — overrides clear on
  // playhead motion, and pausing is what makes the gesture honest.

  /** How far a press travels before it stops being a click (CSS px). */
  const MOVE_THRESHOLD = 3

  /** How far the idle pointer travels before the hover re-picks (CSS px). */
  const HOVER_STEP = 4
  let probe: { x: number; y: number } | null = null

  interface Move {
    holon: Holon
    pointerId: number
    startClientX: number
    startClientY: number
    startNdc: { x: number; y: number }
    /** What the press actually hit — the click fallback selects it. */
    hit: Holon
    /** Set once the pointer clears the threshold and the gesture engages. */
    gesture?: MoveGesture
    /** The last x/y written live — what pointerup commits. */
    last?: { x: number; y: number }
  }
  let move: Move | null = null

  /** Is `holon` the selection itself or ink inside it? */
  const withinSelection = (holon: Holon, selected: Holon): boolean => {
    for (let node: Holon | undefined = holon; node; node = node.parent) {
      if (node === selected) return true
    }
    return false
  }

  /** Decision 1's refusal: bound x/y — the cue, never the move. */
  const refuseMove = () => {
    canvas.classList.add("refused")
    marquee.canvas.classList.add("shake")
    setTimeout(() => {
      canvas.classList.remove("refused")
      marquee.canvas.classList.remove("shake")
    }, 360)
  }

  const markMoveRows = (m: Move, cls: "diverged" | "live") => {
    for (const row of rows) {
      if (row.param === m.holon.x || row.param === m.holon.y) row.el?.classList.add(cls)
    }
  }

  /** End the gesture without writing anything (Escape, pointercancel). */
  const cancelMove = (): boolean => {
    if (!move) return false
    const m = move
    move = null
    try {
      canvas.releasePointerCapture?.(m.pointerId)
    } catch {}
    canvas.classList.remove("moving")
    if (m.gesture) {
      // Drop the live overrides — the object returns, the file was never touched.
      overrides.release([m.holon.x as Param<ParamValue>, m.holon.y as Param<ParamValue>])
      for (const row of rows) {
        if (row.param === m.holon.x || row.param === m.holon.y)
          row.el?.classList.remove("diverged", "live")
      }
      void host.renderFrame(current).then(() => {
        syncPanel()
        paintMarquee()
      })
    }
    return true
  }

  /** Pointer released: a click that never travelled, or a move to commit. */
  const endMove = (e: PointerEvent): boolean => {
    if (!move || e.pointerId !== move.pointerId) return false
    const m = move
    move = null
    try {
      canvas.releasePointerCapture?.(e.pointerId)
    } catch {}
    canvas.classList.remove("moving")
    if (!m.gesture) {
      // Never engaged — this press was a CLICK, and a click means what it
      // always did: select what it hit (pressing a selected whole's part
      // again drills into the part).
      selection.set(m.hit)
      return true
    }
    if (!m.last) return true
    const anchor = anchorOf(m.holon)
    if (!anchor) return true
    // One setOverride per changed param (decision 3), rounded to the
    // centi-unit — sub-pixel noise has no business becoming a literal.
    const round = (v: number) => Math.round(v * 100) / 100
    const [x, y] = [round(m.last.x), round(m.last.y)]
    if (Math.abs(x - m.gesture.baseX) > 1e-6) void commitOverride(m.holon, anchor, "x", x)
    if (Math.abs(y - m.gesture.baseY) > 1e-6) void commitOverride(m.holon, anchor, "y", y)
    return true
  }

  // --- The player's click: TRAVEL, not selection (LOOPS.md game loop) ------
  //
  // In the player a sovereign symbol is a BUTTON whose click travels you
  // to that holon's home. Homes (githubPagesUrl → githubRepoUrl →
  // Radicle) are gated on the manifest's `home` field (GATES #3c), so
  // today the click LOGS the would-be travel and names the symbol for a
  // second — the affordance is real, the destination is pending.
  const nameChip = $<HTMLDivElement>("namechip")
  let chipTimer: ReturnType<typeof setTimeout> | undefined
  /**
   * The editor's one transient status line, already in the palette and
   * already the right shape for a word that appears and goes. Undo speaks
   * through it too — "history cleared (file edited)" has to be SAID, and
   * a second chrome element for one sentence would be more, not less.
   */
  const showNote = (text: string) => {
    nameChip.textContent = text
    nameChip.classList.add("shown")
    if (chipTimer !== undefined) clearTimeout(chipTimer)
    chipTimer = setTimeout(() => nameChip.classList.remove("shown"), 1600)
  }
  historyNote = showNote
  // A note raised by the reload that built this mount — say it now that
  // there is a DOM to say it in.
  const parked = window.__dtNote
  if (parked) {
    window.__dtNote = undefined
    setTimeout(() => showNote(parked), 0)
  }
  const travel = (sovereign: Holon) => {
    const name = classNameOf(sovereign)
    console.info(
      `[dreamtalk] travel → ${name} (home URL gated; resolution: githubPagesUrl → githubRepoUrl → Radicle)`,
    )
    nameChip.textContent = name
    nameChip.classList.add("shown")
    if (chipTimer !== undefined) clearTimeout(chipTimer)
    chipTimer = setTimeout(() => nameChip.classList.remove("shown"), 1000)
  }
  /** Where a player press began — a release that never travelled is a click. */
  let playerPress: { x: number; y: number } | null = null

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return
      if (playerMode) {
        // No selection, no move gesture: paused, a drag flies; a click
        // (resolved on pointerup) is reserved for travel.
        playerPress = { x: e.clientX, y: e.clientY }
        if (playing) return
        flight = { x: e.clientX, y: e.clientY, pan: e.shiftKey }
        try {
          canvas.setPointerCapture?.(e.pointerId)
        } catch {}
        canvas.classList.add("flying")
        return
      }
      const hit = pickAt(e.clientX, e.clientY)
      const selected = selection.current
      if (hit && selected && withinSelection(hit, selected)) {
        // A press on the selection is a move (or its refusal), never a fly.
        if (!movable(selected)) {
          refuseMove()
          return
        }
        const startNdc = ndcAt(e.clientX, e.clientY)
        if (!startNdc) return
        move = {
          holon: selected,
          pointerId: e.pointerId,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startNdc,
          hit,
        }
        try {
          canvas.setPointerCapture?.(e.pointerId)
        } catch {}
        return
      }
      // Empty space clears — direct manipulation's own affordance.
      selection.set(hit ?? null)
      // …and the same press begins a flight, if the scene is paused.
      // Selection is a click; flying is a drag; one press serves both,
      // because the flight only does anything once the pointer moves.
      if (playing) return
      flight = { x: e.clientX, y: e.clientY, pan: e.shiftKey }
      try {
        canvas.setPointerCapture?.(e.pointerId)
      } catch {}
      canvas.classList.add("flying")
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
    // Selecting an object un-selects any clip: one selection at a time,
    // and the code view shows whichever it is. `new X({...})` for a holon,
    // `this.play(...)` for a clip — the same anchor mechanism either way.
    if (holon) {
      selectedClip = null
      timeline?.select(null)
      code?.show(anchorOf(holon))
    }
  })

  // --- Flying the Observer (EDITOR-V4, "Flying the Observer") --------------
  //
  // The Observer is a Holon like any other (rule 5), so flying it is just
  // overrides on its spherical params — no camera state anywhere, no
  // special case in the host, and the scene file is never touched.
  //
  //   drag        → phi / theta   (orbit)
  //   shift+drag  → x / y         (pan the focus point)
  //   scroll      → radius        (dolly)
  //
  // On play the flown pose falls back to the timeline's pose at the
  // current t over RETURN_SECONDS, eased, and only then are the overrides
  // released — David's "a quick interpolation of the current view towards
  // the camera perspective and then the scene should be played further."
  const obs = dream.observer
  const observerParams = new Set<Param<ParamValue>>([
    obs.phi as Param<ParamValue>,
    obs.theta as Param<ParamValue>,
    obs.radius as Param<ParamValue>,
    obs.x as Param<ParamValue>,
    obs.y as Param<ParamValue>,
  ])

  /** The pose the timeline alone would put the observer in at time t. */
  const timelinePose = (t: number): Pose => {
    const tl = dream.build()
    return {
      phi: tl.valueAt(obs.phi, t),
      theta: tl.valueAt(obs.theta, t),
      radius: tl.valueAt(obs.radius, t),
      x: tl.valueAt(obs.x, t),
      y: tl.valueAt(obs.y, t),
    }
  }

  /** The pose actually on screen: the flown one if flying, else the timeline's. */
  const livePose = (): Pose =>
    flown ?? {
      phi: obs.phi.value,
      theta: obs.theta.value,
      radius: obs.radius.value,
      x: obs.x.value,
      y: obs.y.value,
    }

  /** The flown pose, or null when the observer is following the timeline. */
  let flown: Pose | null = null
  /** An in-flight return, if play() started one. */
  let returning: { from: Pose; to: Pose; startedAt: number } | null = null

  const overlayPose = (pose: Pose) => {
    overrides.set(obs.phi as Param<ParamValue>, pose.phi, "observer")
    overrides.set(obs.theta as Param<ParamValue>, clampTheta(pose.theta), "observer")
    overrides.set(obs.radius as Param<ParamValue>, pose.radius, "observer")
    overrides.set(obs.x as Param<ParamValue>, pose.x, "observer")
    overrides.set(obs.y as Param<ParamValue>, pose.y, "observer")
  }

  const releaseObserver = () => {
    flown = null
    returning = null
    overrides.release(observerParams)
  }

  /** Fly by a pixel delta — the same entry point the pointer and __dt use. */
  const fly = (dx: number, dy: number, mode: "orbit" | "pan") => {
    returning = null
    const pose = { ...livePose() }
    const width = canvas.getBoundingClientRect().width || canvas.width
    if (mode === "pan") {
      // Pan moves the focus point across the view plane, so it must track
      // the cursor at every distance: one screen width is the world width
      // the frustum spans at the focus, which for a perspective rig is
      // proportional to the radius.
      const worldPerPixel = (2 * pose.radius * Math.tan(obs.fov.value / 2)) /
        (canvas.getBoundingClientRect().height || canvas.height)
      pose.x -= dx * worldPerPixel
      pose.y += dy * worldPerPixel
    } else {
      // Angular rate is radius-independent — C4D orbits the sphere, not
      // the distance, so the gesture feels identical near and far.
      pose.phi -= (dx / width) * ORBIT_PER_WIDTH
      pose.theta = clampTheta(pose.theta + (dy / width) * ORBIT_PER_WIDTH)
    }
    flown = pose
    overlayPose(pose)
  }

  const dolly = (deltaY: number) => {
    returning = null
    const pose = { ...livePose() }
    pose.radius = dollyRadius(pose.radius, deltaY)
    flown = pose
    overlayPose(pose)
  }

  /** Start the eased fall back to the timeline's pose. No-op if not flying. */
  const beginReturn = () => {
    if (!flown) return
    returning = { from: { ...flown }, to: timelinePose(current), startedAt: performance.now() }
  }

  /**
   * One step of the return, run from the frame loop. Returns true while
   * the tween still owns the observer — the loop repaints for it even
   * when nothing else would.
   */
  const stepReturn = (now: number, t = current): boolean => {
    if (!returning) return false
    const u = (now - returning.startedAt) / (RETURN_SECONDS * 1000)
    if (u >= 1) {
      releaseObserver()
      return false
    }
    // The target keeps up with the playhead: the timeline's pose at the t
    // about to be drawn, so the tween lands on a moving camera smoothly.
    returning.to = timelinePose(t)
    const pose = lerpPose(returning.from, returning.to, u)
    flown = pose
    overlayPose(pose)
    return true
  }

  // Drag in the viewport orbits; shift+drag pans; the wheel dollies.
  // Only while PAUSED — playing, the timeline owns the camera.
  let flight: { x: number; y: number; pan: boolean } | null = null

  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (move) {
        e.preventDefault()
        if (!move.gesture) {
          // Still a click until the pointer commits to travelling.
          const travelled = Math.hypot(
            e.clientX - move.startClientX,
            e.clientY - move.startClientY,
          )
          if (travelled < MOVE_THRESHOLD) return
          // Dragstart: pause FIRST (decision 3), then freeze the plane and
          // the base pose — the values the paused frame actually shows.
          pause()
          const origin = host.worldOriginOf(move.holon)
          const parentWorld = host.parentWorldMatrixOf(move.holon)
          const gesture =
            origin && parentWorld
              ? MoveGesture.create(
                  cameraFrameOf(host.camera),
                  move.startNdc,
                  origin,
                  parentWorld.elements,
                  move.holon.x.value,
                  move.holon.y.value,
                )
              : undefined
          if (!gesture) {
            move = null
            return
          }
          move.gesture = gesture
          canvas.classList.add("moving")
        }
        const ndc = ndcAt(e.clientX, e.clientY)
        const target = ndc && move.gesture.target(cameraFrameOf(host.camera), ndc, e.shiftKey)
        if (!target) return
        overrides.set(move.holon.x as Param<ParamValue>, target.x)
        overrides.set(move.holon.y as Param<ParamValue>, target.y)
        markMoveRows(move, anchorOf(move.holon) ? "diverged" : "live")
        move.last = target
        void host.renderFrame(current).then(() => {
          syncPanel()
          paintMarquee()
        })
        return
      }
      if (flight) {
        e.preventDefault()
        const dx = e.clientX - flight.x
        const dy = e.clientY - flight.y
        flight.x = e.clientX
        flight.y = e.clientY
        if (dx === 0 && dy === 0) return
        fly(dx, dy, flight.pan ? "pan" : "orbit")
        void host.renderFrame(current).then(() => {
          syncPanel()
          paintMarquee()
        })
        return
      }
      // At rest, one pick — throttled to HOVER_STEP pixels of travel —
      // serves both idle affordances: the cursor says what a press would
      // do (move over the selection's own ink, pointer over a sovereign's),
      // and the sovereign under the pointer glows.
      if (probe && Math.hypot(e.clientX - probe.x, e.clientY - probe.y) < HOVER_STEP) return
      probe = { x: e.clientX, y: e.clientY }
      const hit = pickAt(e.clientX, e.clientY)
      const selected = selection.current
      canvas.classList.toggle(
        "moveable",
        !!hit && !!selected && movable(selected) && withinSelection(hit, selected),
      )
      applyGlow(sovereignOf(hit) ?? null)
    },
    listen,
  )
  canvas.addEventListener(
    "pointerleave",
    () => {
      probe = null
      canvas.classList.remove("moveable")
      applyGlow(null)
    },
    listen,
  )
  const endFlight = (e: PointerEvent) => {
    if (!flight) return
    flight = null
    try {
      canvas.releasePointerCapture?.(e.pointerId)
    } catch {}
    canvas.classList.remove("flying")
  }
  canvas.addEventListener(
    "pointerup",
    (e) => {
      if (playerMode) {
        const press = playerPress
        playerPress = null
        endFlight(e)
        if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < MOVE_THRESHOLD) {
          const sovereign = sovereignOf(pickAt(e.clientX, e.clientY))
          if (sovereign) travel(sovereign)
        }
        return
      }
      if (!endMove(e)) endFlight(e)
    },
    listen,
  )
  canvas.addEventListener(
    "pointercancel",
    (e) => {
      if (!cancelMove()) endFlight(e)
    },
    listen,
  )
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (playing) return
      e.preventDefault()
      dolly(e.deltaY)
      void host.renderFrame(current).then(() => {
        syncPanel()
        paintMarquee()
      })
    },
    { ...listen, passive: false },
  )

  // --- Transport -----------------------------------------------------------
  let playing = false
  let current = 0
  let anchor = performance.now()
  let alive = true

  /**
   * Rule 2 + rule 3: the playhead moved, so overrides on params the
   * timeline animates snap back; overrides on params it never touches
   * survive. The panel's divergence marks come off with them, and a
   * gesture still in flight is ended (its value is gone — continuing to
   * commit it would write a number the user can no longer see).
   */
  const clearOverridesForTimeMove = () => {
    if (overrides.size === 0) return
    // A return tween owns the observer for its 0.4s: it is the snap-back,
    // stretched, so time moving does not also yank the camera.
    const cleared = overrides.clearOnTimeMove(returning ? observerParams : undefined)
    if (cleared.length === 0) return
    const gone = new Set(cleared)
    for (const row of rows) {
      if (row.el && gone.has(row.param)) row.el.classList.remove("diverged", "live")
    }
    if (drag && gone.has(drag.param)) {
      drag.reverted = true
      drag = null
    }
    if (cleared.some((p) => observerParams.has(p))) flown = null
  }

  /**
   * Time is truth (rule 2): a repaint at a DIFFERENT t releases the live
   * layer first, so the frame that appears is the timeline's own. The
   * observer's own overrides are exempt while a return tween is in
   * flight — that tween IS the snap-back, taking 0.4s instead of one
   * frame, and it releases them itself when it lands.
   */
  const paint = async (t: number) => {
    if (t !== current) clearOverridesForTimeMove()
    current = t
    await host.renderFrame(t)
    syncBackdrop(t, playing)
    timeline?.setPlayhead(t)
    ptransport?.sync(t, playing)
    checkpoint?.sync()
    timecode.textContent = `${t.toFixed(2)} / ${duration.toFixed(2)}`
    syncPanel()
    // The mark follows the object, so a selected holon stays marked as
    // the scene animates. Drawn on its own canvas — never in the render.
    paintMarquee()
  }

  const play = () => {
    // A flown camera does not snap: it falls back to the timeline's pose
    // over RETURN_SECONDS, and the overrides are released at the end of
    // that (beginReturn owns them meanwhile). Everything else clears now,
    // because the playhead is about to move.
    beginReturn()
    clearOverridesForTimeMove()
    playing = true
    anchor = performance.now() - current * 1000
    playpause.textContent = "⏸"
  }
  const pause = () => {
    playing = false
    playpause.textContent = "▶"
    syncBackdrop(current, false)
    checkpoint?.sync()
  }

  playpause.addEventListener("click", () => (playing ? pause() : play()), listen)
  document.addEventListener(
    "keydown",
    (e) => {
      // A key aimed at a text control is typing, not transport.
      const target = e.target as HTMLElement | null
      const typing =
        !!target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target.isContentEditable)
      if (e.code === "Space") {
        e.preventDefault()
        playing ? pause() : play()
      }
      // Frame stepping: `,`/`.` one frame (1/30s), shift+ one second —
      // "fine-tweak" made literal. Pauses first; the playhead is truth.
      if (
        (e.code === "Comma" || e.code === "Period") &&
        !typing &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault()
        pause()
        void paint(stepTime(current, e.code === "Period" ? 1 : -1, duration, e.shiftKey))
      }
      if (playerMode) {
        // Esc / `e` return to the creator editor — same scene, same t
        // (LOOPS: the player and the editor are two presentations of one
        // engine; the switch is a URL swap). No creator chords beyond.
        if (e.code === "Escape" || (e.code === "KeyE" && !typing && !e.metaKey && !e.ctrlKey)) {
          e.preventDefault()
          location.search = exitUrl(location.search, current)
        }
        return
      }
      // Keynote's outline toggle, on Keynote's chord.
      if (e.code === "KeyL" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleOutline()
      }
      // The code view, on the chord every editor uses for "show me the
      // source of this": ctrl+/ . Deliberately not cmd+shift+L (Keynote's
      // outline, already taken) and not cmd+/ (the browser's own).
      if (e.code === "Slash" && e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        toggleCode()
      }
      // Undo / redo, on the chord every application uses.
      if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey) && !typing) {
        e.preventDefault()
        if (e.shiftKey) doRedo()
        else doUndo()
      }
      if (e.code === "Escape") {
        if (cancelMove()) {
          // A move in flight dies here — overrides reverted, nothing written.
        } else if (drag && !drag.reverted) {
          // Drop the live override — nothing was ever written.
          const d = drag
          d.reverted = true
          overrides.delete(d.param)
          d.row.classList.remove("diverged", "live")
          void host.renderFrame(current).then(() => syncPanel())
        } else if (flown) {
          // …or, mid-flight, put the camera back where the scene has it.
          releaseObserver()
          void host.renderFrame(current).then(() => syncPanel())
          checkpoint?.sync()
        } else if (discardPose()) {
          // …or a standing pose evaporates — every override released,
          // the file never touched (checkpoint capture's cancel).
        } else {
          // …otherwise Escape means "nothing selected".
          selection.clear()
        }
      }
    },
    listen,
  )
  // --- The minimal timeline (EDITOR-V4) ------------------------------------
  //
  // One row per play() clip, its WIDTH its run_time. Clicking a row selects
  // that clip, which shows its `this.play(...)` line in the code view —
  // the same anchor bridge the object selection uses, on the other half of
  // what the build anchors.
  const selectClip = (row: ClipRow) => {
    selectedClip = row
    selection.set(null)
    timeline?.select(row.clip)
    code?.show(anchorOf(row.clip as unknown as object))
    // A clip is a span of time, so selecting one puts the playhead at its
    // start: what the row describes is then what the viewport shows.
    pause()
    void paint(row.clip.start)
  }

  /**
   * A clip's right edge released (timeline.ts's drag preview): rewrite
   * THAT play() call's run_time literal. Dream.play returns its Clip and
   * the build wraps play() calls in __dt, so the row's clip carries the
   * exact source span — the op targets it the way setOverride targets a
   * construction, and the reload round-trip re-lays the bar out from the
   * file's new truth (playhead preserved, as on any remount).
   */
  const commitRunTime = async (row: ClipRow, seconds: number) => {
    const anchor = anchorOf(row.clip as unknown as object)
    if (!anchor) return
    const res = await fetch(`/api/source?file=${encodeURIComponent(anchor.file)}`)
    const baseHash = res.ok ? ((await res.json()) as { hash: string }).hash : undefined
    sendOp({
      type: "op",
      op: "setRunTime",
      file: anchor.file,
      span: { start: anchor.start, end: anchor.end },
      runTime: seconds,
      baseHash,
    })
  }

  if (!playerMode)
    timeline = mountTimeline(clipsBar, rulerEl, dream.clips, duration, {
      signal: ac.signal,
      onScrub: (t) => {
        pause()
        void paint(t)
      },
      onSelect: selectClip,
      onResize: (row, seconds) => void commitRunTime(row, seconds),
    })

  // --- Checkpoint capture (EDITOR-V5 "Checkpoint capture") -----------------
  //
  // The live layer holds the pose; the chip appears on the playhead the
  // moment a capturable pose exists while paused. Capturing sends ONE
  // appendCheckpoint op; the reload round-trip then remounts with a fresh
  // (empty) override store — the timeline owns the pose from then on.
  if (!playerMode)
    checkpoint = mountCheckpoint({
      dream,
      overrides,
      track: $("track"),
      isPlaying: () => playing,
      currentT: () => current,
      sceneFile: () => sceneFileFor(sceneKey),
      send: sendOp,
      signal: ac.signal,
    })

  // The player's one piece of chrome: play/pause + a scrub line that
  // fades after ~2s of stillness while playing (Keynote-presenter style).
  if (playerMode)
    ptransport = mountPlayerTransport($("ptransport"), {
      duration,
      isPlaying: () => playing,
      onToggle: () => (playing ? pause() : play()),
      onScrub: (t) => {
        pause()
        void paint(t)
      },
      signal: ac.signal,
    })

  /**
   * The pose's Escape: every live override released, nothing written —
   * the file was never touched, so nothing needs undoing. The divergence
   * marks and any gesture bookkeeping go with it.
   */
  const discardPose = (): boolean => {
    if (overrides.size === 0) return false
    if (drag) {
      drag.reverted = true
      drag = null
    }
    overrides.clearAll()
    flown = null
    returning = null
    for (const row of rows) row.el?.classList.remove("diverged", "live")
    void host.renderFrame(current).then(() => {
      syncPanel()
      paintMarquee()
    })
    checkpoint?.sync()
    return true
  }

  // --- Undo / redo (cmd+Z, shift+cmd+Z) -------------------------------------
  //
  // LIVE FIRST (undo.ts rule 1): the live layer holds whatever the hand
  // just did and has not committed — a posed checkpoint, a flown camera,
  // a mid-drag tweak. That is the most recent edit, so cmd+Z releases it
  // before it reaches into the file's history. Only with nothing live
  // does the stack pop, and then undo is just another op down the same
  // socket: the daemon re-locates the form and rewrites it, the reload
  // round-trip remounts, and the editor shows the file's new truth.
  const doUndo = () => {
    switch (undoAction(overrides, undoStack)) {
      case "release":
        discardPose()
        showNote("live tweak released")
        return
      case "pop": {
        const outcome = undoStack.undo()
        if (outcome.kind !== "sent") return
        sendOp(outcome.op)
        showNote(`undo ${outcome.label}`)
        return
      }
      default:
        showNote("nothing to undo")
    }
  }

  const doRedo = () => {
    const outcome = undoStack.redo()
    if (outcome.kind !== "sent") {
      showNote("nothing to redo")
      return
    }
    sendOp(outcome.op)
    showNote(`redo ${outcome.label}`)
  }

  const toggleCode = (): boolean => {
    if (!code) return false
    const open = code.toggle()
    app.classList.toggle("code-open", open)
    if (open) {
      // Opening with something selected shows THAT; with nothing, the
      // scene's own source, which is the honest default.
      const holon = selection.current
      if (holon) code.show(anchorOf(holon))
      else if (selectedClip) code.show(anchorOf(selectedClip.clip as unknown as object))
      else void code.load(sceneFileFor(sceneKey))
    }
    return open
  }

  const loop = async (now: number) => {
    if (!alive) return
    if (playing) {
      const t = ((now - anchor) / 1000) % duration
      // The tween runs BEFORE the frame is drawn, so the overlay it
      // writes is what this frame renders; paint() then holds the
      // observer back from the time-move clear while it is in flight.
      stepReturn(now, t)
      await paint(t)
    } else if (stepReturn(now)) {
      // A return that outlives a pause still finishes, quietly.
      await host.renderFrame(current)
      syncPanel()
      paintMarquee()
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
      code: code?.open,
    }
    teardown()
    const next = `./main.js?v=${Date.now()}`
    void import(next).catch((err) => console.error("[dreamtalk] remount failed:", err))
  }

  // --- Boot ---------------------------------------------------------------
  // Nothing selected is the honest opening state (the inspector shows the
  // scene) — unless a remount is handing a selection back.
  selection.rehydrate(dream.roots, resume?.selection)
  // The code view survives a rebuild as a MODE, not as content: its file
  // is re-fetched (the daemon just rewrote it), so reopening it shows the
  // new source rather than the bytes the anchors were taken against.
  // ?code=1 opens it from a cold boot — headless verification, and a
  // shareable URL for "look at this line".
  if (resume?.code || new URLSearchParams(location.search).get("code") === "1") toggleCode()
  /**
   * First-frame settle (the demo path's documented double render in
   * setT, applied to mount): sync()'s screen-arc measurement projects
   * with the matrices the PREVIOUS render left behind, and at mount
   * there is no previous render — the first frame would draw every
   * camera-relative cap split and pen position against a stale view.
   * One throwaway render before the visible paint settles the matrices,
   * so the first frame anyone sees (or screenshots) is already correct.
   * Daemon remounts and navigator scene switches come back through
   * boot(), so they inherit the same settle.
   */
  const settled = async (t: number) => {
    await host.renderFrame(t)
    await paint(t)
  }
  if (resume) {
    await settled(resume.t)
    if (resume.playing) play()
  } else {
    const q = new URLSearchParams(location.search)
    if (q.has("backdrop") && !playerMode) {
      setBackdrop(q.get("backdrop")!, q.get("mode") ?? "under", Number(q.get("offset") ?? 0))
    }
    await settled(Number(q.get("t") ?? 0))
    // The player is the cutscene loop: it plays unless told not to. The
    // creator editor holds still on a ?t= deep link.
    if (q.get("autoplay") !== "0" && (playerMode || !q.has("t"))) play()
  }

  // What headless driving can reach: the transport, the camera and the
  // hover pass exist in BOTH presentations; everything that edits — the
  // selection, overrides, capture, the scene rail — exists only in the
  // creator editor. In the player those entries are simply absent, which
  // is the verifiable form of "no ops from here".
  window.__dt = {
    ready: true,
    duration,
    setT: async (t: number) => {
      pause()
      await paint(t)
      // The settle pass (see settled() above): a large jump projects the
      // screen-arc measurement against the outgoing view, so render once
      // more — setT is a pure function of t, as headless callers assume.
      await host.renderFrame(t)
      paintMarquee()
    },
    play,
    pause,
    setBackdrop,
    currentT: () => current,
    pose: () => livePose(),
    fly: (dx, dy, mode = "orbit") => {
      fly(dx, dy, mode)
      void host.renderFrame(current).then(() => syncPanel())
    },
    dolly: (deltaY) => {
      dolly(deltaY)
      void host.renderFrame(current).then(() => syncPanel())
    },
    pick: (ndcX, ndcY) => {
      const holon = host.pick(ndcX, ndcY)
      return holon ? classNameOf(holon) : undefined
    },
    hoverAt: (ndcX: number, ndcY: number) => {
      const sovereign = sovereignOf(host.pick(ndcX, ndcY)) ?? null
      applyGlow(sovereign)
      return sovereign ? classNameOf(sovereign) : undefined
    },
    hovered: () => {
      if (!glowing) return undefined
      const first = Array.isArray(glowing) ? (glowing[0] as Holon | undefined) : (glowing as Holon)
      return first ? classNameOf(first) : undefined
    },
    sceneKey,
  }
  if (playerMode) return

  Object.assign(window.__dt, {
    selectAt: (ndcX: number, ndcY: number) => {
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
    toggleCode,
    openScene: switchScene,
    cast: () =>
      Array.from($("cast").querySelectorAll(".castname"), (el) => el.textContent ?? ""),
    selectClip: (index: number) => {
      const row = timeline?.rows[index]
      if (!row) return undefined
      selectClip(row)
      return row.label
    },
    // --- The live layer, driven headlessly ---------------------------------
    setOverride: (name: string, value: number): boolean => {
      const holon = selection.current
      const param = holon?.params.get(name) as Param<ParamValue> | undefined
      if (!param) return false
      overrides.set(param, value)
      for (const row of rows) {
        if (row.param === param && row.el) row.el.classList.add("diverged")
      }
      void host.renderFrame(current).then(() => syncPanel())
      return true
    },
    overrides: () =>
      overrides.entries().map(({ param, value }) => ({
        name: param.name ?? String(param.id),
        value: typeof value === "number" ? value : NaN,
        animated: overrides.animates(param),
      })),
    captureTargets: () => checkpoint?.targets() ?? [],
    capturePlacement: () => checkpoint?.placement() ?? {},
    capture: (clipSeconds?: number) =>
      checkpoint?.capture(clipSeconds) ?? Promise.resolve(undefined),
    discardPose: () => void discardPose(),
    // --- The undo stack, driven headlessly ---------------------------------
    undo: () => doUndo(),
    redo: () => doRedo(),
    history: () => undoStack.depth,
  })
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
