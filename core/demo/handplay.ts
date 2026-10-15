/**
 * Hands in the player and the paused editor — the gesture layer
 * (src/gesture) wired to a host: the pinch cursor hovers, a pinch clicks the
 * symbol part under it (its axis fires), a pinch-and-drag on a handle scrubs
 * that axis, a double pinch frames, and closed hands grab the whole scene
 * through the view layer (keep-outs and surface orbit included).
 *
 * THE CURSOR. Like the reMarkable's pen hovering above the glass: a small
 * gold point where a pinch would land, growing as the fingers approach,
 * solid when they touch. It drives the host's own hover affordance (the
 * golden glow), so a symbol part lights up before it is clicked.
 *
 * FRAMES IN. Any HandFrame source — the webcam, a Leap, a recorded take, the
 * simulator (src/hands) — subscribes, or frames are pushed (`push`, the
 * harness's `window.__dtHands.push`). Every decision runs on the frame's own
 * clock, so a replay clicks the same parts at the same moments.
 *
 * CALIBRATION. `calibrate()` asks for a few pinches at gold rings around the
 * screen and fits this user's thumb bias (pinch.ts fitCalibration), stored
 * in this browser (localStorage) and applied at once.
 */

import { GestureController, type Intent } from "../src/gesture/controller"
import { DEFAULT_CALIBRATION, fitCalibration, type PinchCalibration, type PinchSample } from "../src/gesture/pinch"
import type { HandFrame } from "../src/gesture/hand"
import { DOLLY_PER_NOTCH, type ViewLayer } from "../src/view"
import { GOLD, cssOf } from "../src/constants"
import { beginOverlay, makeOverlay } from "../editor/overlay"
import { MudraRecogniser, learn, type Candidate, type MudraLibrary } from "../src/gesture/mudra"
import { Jev, httpJev, type JevDecision } from "../src/gesture/jev"

/** What a host offers the hands — the GameLoop in the player, the walk + view in the editor. */
export interface HandTarget {
  /** May the hands act now (free play on; editor paused)? */
  live(): boolean
  hoverAt(clientX: number, clientY: number): unknown
  /** A click, with the host's double-click rule (a double pinch frames). */
  click(clientX: number, clientY: number): unknown
  axisAt(clientX: number, clientY: number): string | undefined
  axisIndex(id: string): { i: number; n: number }
  scrubAxis(id: string, u: number): void
  settleAxis(id: string): void
  view(): ViewLayer | undefined
  /** Fire an axis (a mudra's or Jev's action), to a position or the next. */
  fire?(id: string, position?: string): void
  /** A pinch held still opens the holon-action menu here (the editor's __dt.actions.menuAt). */
  menuAt?(clientX: number, clientY: number): void
  /** The walkable axes, for Jev's action list. */
  axes?(): { id: string; label: string }[]
  /** The view or a pose changed: a host that only paints on demand repaints. */
  changed?(): void
}

export interface HandSource {
  subscribe(fn: (frame: HandFrame) => void): () => void
}

/** How far the hand travels (screen widths) to scrub one position along an axis. */
const SCRUB_STEP = 0.25
/**
 * The cursor re-picks only after moving this far (client px), as the mouse
 * does (demo/game.ts HOVER_STEP): a tracked hand always jitters, and a pick
 * is the page's dearest call.
 */
const HOVER_STEP = 4
const CALIBRATION_KEY = "dreamtalk.pinch-calibration"
const MUDRA_KEY = "dreamtalk.mudras"

/** The stored hand-talk: learned mudras and the action each invokes. */
interface MudraStore {
  library: MudraLibrary
  /** mudra name → action: `fire:<axis>[=<position>]`, `home`, or `invoke:<name>` (a `dreamtalk:invoke` event). */
  bindings: Record<string, string>
}

const loadMudras = (): MudraStore => {
  try {
    const raw = localStorage.getItem(MUDRA_KEY)
    if (raw) {
      const m = JSON.parse(raw) as MudraStore
      if (Array.isArray(m.library?.mudras)) return { library: m.library, bindings: m.bindings ?? {} }
    }
  } catch {}
  return { library: { mudras: [] }, bindings: {} }
}
/** Where calibration asks for pinches: spread over the screen. */
const CALIBRATION_TARGETS = [
  { x: 0.5, y: 0.5 },
  { x: 0.25, y: 0.3 },
  { x: 0.75, y: 0.3 },
  { x: 0.25, y: 0.7 },
  { x: 0.75, y: 0.7 },
  { x: 0.5, y: 0.2 },
]

const loadCalibration = (): PinchCalibration => {
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY)
    if (raw) {
      const c = JSON.parse(raw) as PinchCalibration
      if ([c.w, c.ox, c.oy].every(Number.isFinite)) return c
    }
  } catch {}
  return { ...DEFAULT_CALIBRATION }
}

/** Hand talk in the browser (recording, binding, the stream's last candidates). */
export interface Mudras {
  /** Record one take of a mudra from the live stream for `seconds`, then learn from every take so far. */
  record(name: string, kind: "pose" | "motion", seconds?: number): Promise<number>
  /** Bind a mudra to an action (see MudraStore.bindings). */
  bind(name: string, action: string): void
  forget(name: string): void
  readonly store: MudraStore
  /** This frame's candidates. */
  readonly candidates: readonly Candidate[]
  /** The last action invoked (by a sure mudra, or by Jev), for a HUD or a test. */
  readonly last?: { action: string; by: string; t: number; decision?: JevDecision }
}

export type Gesture = "point" | "pinch" | "fist" | "fists"

export interface HandPlay {
  /** Feed one frame (any source). Returns the intents it produced. */
  push(frame: HandFrame): Intent
  /** Ask for pinches at gold rings and fit this user's thumb bias (undefined if cancelled). */
  calibrate(): Promise<PinchCalibration | undefined>
  cancelCalibration(): void
  readonly calibrating: boolean
  /** Has this browser a fitted calibration? */
  readonly calibrationStored: boolean
  /** Has a hand been seen in the last few seconds? */
  readonly handsActive: boolean
  /** What the hands are doing now, for the legend: pointing, pinching, one fist, two fists. */
  readonly gesture: Gesture | undefined
  readonly controller: GestureController
  readonly mudras: Mudras
  /**
   * What is being said — heard by Jev. Any source (the session recorder, a
   * replay's transcript, the page's own listener): the line is stamped onto
   * the HAND clock (the latest frame's t), so words and gestures share one.
   */
  hear(line: { text: string; final: boolean }): void
  /** Is the page's own speech listener running (`listen`)? */
  readonly listening: boolean
  /** Run an action by name. */
  act(action: string, by?: string): boolean
  /** Every action a mudra can be bound to here: the scene's axes, home, dismiss. */
  actionNames(): string[]
}

export const mountHands = (opts: {
  target: HandTarget
  signal: AbortSignal
  source?: HandSource
  /** Ask the intent layer (POST /api/jev) about uncertain mudras. Off by default. */
  jev?: boolean
  /**
   * Listen with the browser's own speech recognition and feed Jev — for a
   * page with no other voice (the player). Off when a recorder supplies the
   * transcript: a browser runs one recognition at a time.
   */
  listen?: boolean
  /**
   * A replayed session's id (`?hands=replay&session=…`): its recorded
   * transcript (session.json tracks.transcript, on the session clock — the
   * replay's frame clock) is heard as playback passes each line.
   */
  session?: string
}): HandPlay => {
  const { target } = opts
  const controller = new GestureController({ pinch: { calibration: loadCalibration() } })
  const overlay = makeOverlay("dt-hand-cursor", 70)
  document.body.append(overlay)
  opts.signal.addEventListener("abort", () => overlay.remove())

  // --- hand talk -------------------------------------------------------------
  const store = loadMudras()
  const takes = new Map<string, HandFrame[][]>()
  let recording: { name: string; kind: "pose" | "motion"; seconds: number; until: number; frames: HandFrame[]; done: (n: number) => void } | undefined
  let recogniser = new MudraRecogniser(store.library)
  const jev = new Jev({ backend: opts.jev ? httpJev() : undefined })
  let candidates: readonly Candidate[] = []
  /** The latest frame's time — what a heard line is stamped with. */
  let handClock = 0
  /** Where the cursor last was (client px), while a hand is tracked. */
  const pointAt = { x: 0, y: 0 }
  let pointSeen = false
  const hear = (line: { text: string; final: boolean }) => jev.hear({ t: handClock, text: line.text, final: line.final })
  let listening = false
  let recorderLinked = false
  // A replayed session's words, delivered as its frames pass them.
  let lines: { t0: number; t1: number; text: string }[] = []
  let nextLine = 0
  let lastFrameT = -Infinity
  if (opts.session) {
    fetch(`/api/session/${encodeURIComponent(opts.session)}/session.json`)
      .then((r) => (r.ok ? r.json() : undefined))
      .then((j: { tracks?: { transcript?: { t0: number; t1: number; text: string }[] } } | undefined) => {
        lines = [...(j?.tracks?.transcript ?? [])].sort((a, b) => a.t1 - b.t1)
      })
      .catch(() => {})
  }
  if (opts.jev && opts.listen) {
    type Rec = {
      continuous: boolean
      interimResults: boolean
      onresult: (e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void
      onend: () => void
      start(): void
      stop(): void
    }
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
    const R = W.SpeechRecognition ?? W.webkitSpeechRecognition
    if (R) {
      try {
        const r = new R()
        r.continuous = true
        r.interimResults = true
        r.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i]!
            const text = res[0]?.transcript.trim()
            if (text) hear({ text, final: res.isFinal })
          }
        }
        // Recognition stops on its own after a silence; keep listening while mounted.
        r.onend = () => {
          if (listening && !opts.signal.aborted) {
            try {
              r.start()
            } catch {}
          }
        }
        r.start()
        listening = true
        opts.signal.addEventListener("abort", () => {
          listening = false
          r.stop()
        })
      } catch {}
    }
  }
  let last: Mudras["last"]
  const save = () => {
    try {
      localStorage.setItem(MUDRA_KEY, JSON.stringify(store))
    } catch {}
  }
  const actionsFor = (): { name: string; description: string }[] => [
    ...Object.entries(store.bindings).map(([m, a]) => ({ name: a, description: `what the mudra "${m}" invokes` })),
    ...(target.axes?.() ?? []).map((a) => ({ name: `fire:${a.id}`, description: `change "${a.label}" to its next state` })),
  ]
  const act = (action: string, by = "hand"): boolean => {
    const [verb, rest = ""] = action.split(/:(.*)/s)
    if (verb === "fire" && target.fire) {
      const [id, position] = rest.split("=")
      try {
        target.fire(id!, position || undefined)
      } catch {
        return false
      }
    } else if (verb === "home") target.view()?.reset(performance.now())
    // `at`: where the hand was (client px) — a summoned symbol appears there.
    else if (verb === "invoke") window.dispatchEvent(new CustomEvent("dreamtalk:invoke", { detail: { name: rest, by, at: pointSeen ? { ...pointAt } : undefined } }))
    else return false
    last = { action, by, t: performance.now() / 1000 }
    target.changed?.()
    return true
  }

  let scrub: { id: string; i: number; n: number; moved: boolean } | undefined
  /**
   * A mudra invoked while the fingers were pinched (gyan IS a pinch): that
   * pinch was hand talk, not a click — its release does not click.
   */
  let pinchSpoke = false
  /** A pinch held still this long (s, frame clock) is a long press: the actions menu. */
  const HOLD = 0.55
  let held: { t: number; at: { x: number; y: number }; opened: boolean } | undefined
  let calibration: { k: number; samples: PinchSample[]; done: (c: PinchCalibration | undefined) => void } | undefined
  /** The last fit, for the on-screen "calibrated ✓". */
  let calibrated: { fit: PinchCalibration; at: number } | undefined
  /** Is a calibration stored in this browser? */
  let stored = (() => {
    try {
      return localStorage.getItem(CALIBRATION_KEY) !== null
    } catch {
      return false
    }
  })()
  /** When a hand was last tracked (ms) — the UI shows only while hands are in play. */
  let lastSeen = -Infinity
  let gesture: Gesture | undefined
  const client = (p: { x: number; y: number }) => ({ x: p.x * window.innerWidth, y: p.y * window.innerHeight })

  const paint = (it: Intent) => {
    const ctx = beginOverlay(overlay)
    if (!ctx) return
    const gold = (a: number) => cssOf(GOLD, a)
    ctx.textAlign = "center"
    ctx.font = "13px -apple-system, system-ui, sans-serif"
    if (calibration) {
      const tg = CALIBRATION_TARGETS[calibration.k]!
      const p = client(tg)
      // The ring fills as the fingers close over it — the pinch is felt before it lands.
      const a = it.cursor.tracked ? it.cursor.approach : 0
      ctx.fillStyle = gold(0.08 + 0.35 * a)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 20, 0, 2 * Math.PI)
      ctx.fill()
      ctx.strokeStyle = gold(0.9)
      ctx.lineWidth = 2
      ctx.stroke()
      // A dark plate under the words: legible over any scene.
      ctx.fillStyle = "rgba(0,0,0,0.75)"
      ctx.fillRect(p.x - 110, p.y + 28, 220, 42)
      ctx.fillStyle = gold(0.95)
      ctx.fillText(`pinch on the ring  ${calibration.k + 1} / ${CALIBRATION_TARGETS.length}`, p.x, p.y + 44)
      ctx.fillStyle = "rgba(170,170,170,0.9)"
      ctx.fillText(it.cursor.tracked ? "Esc to cancel" : "show your hand", p.x, p.y + 62)
    } else if (calibrated && performance.now() - calibrated.at < 2500) {
      ctx.fillStyle = gold(0.9)
      ctx.fillText(`calibrated ✓   thumb weight ${calibrated.fit.w.toFixed(2)}   (C to redo)`, window.innerWidth / 2, window.innerHeight - 48)
    }
    ctx.textAlign = "left"
    const c = it.cursor
    if (!c.tracked || it.grab.holding) return
    const p = client(c)
    // The pen above the glass: small and faint far off, larger and brighter
    // as the fingers close, solid when they touch.
    const r = 3 + 7 * c.approach
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, 2 * Math.PI)
    if (c.pinched) {
      ctx.fillStyle = gold(0.95)
      ctx.fill()
    } else {
      ctx.fillStyle = gold(0.15 + 0.45 * c.approach)
      ctx.fill()
      ctx.strokeStyle = gold(0.5 + 0.5 * c.approach)
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  // --- one display frame's worth of screen work -------------------------------
  // A hand source may deliver several frames per display frame (a replay
  // catching up, a fast device): the gesture state follows every one, but the
  // paint, the pick under the cursor and the re-render happen once per
  // animation frame, for the latest — and the pick only when the cursor moved.
  let latest: Intent | undefined
  let raf = 0
  let hoverWanted = false
  const hoverAt = { x: 0, y: 0 }
  const picked = { x: Number.NaN, y: Number.NaN }
  /** The view turned since the last pick: what is under a still cursor may have changed. */
  let viewMoved = false
  const onFrame = () => {
    raf = 0
    if (latest) paint(latest)
    if (viewMoved) target.changed?.()
    if (hoverWanted && target.live() && (viewMoved || Math.hypot(hoverAt.x - picked.x, hoverAt.y - picked.y) >= HOVER_STEP)) {
      target.hoverAt(hoverAt.x, hoverAt.y)
      picked.x = hoverAt.x
      picked.y = hoverAt.y
    }
    viewMoved = false
  }
  opts.signal.addEventListener("abort", () => cancelAnimationFrame(raf))
  const later = (it: Intent): Intent => {
    latest = it
    if (!raf) raf = requestAnimationFrame(onFrame)
    return it
  }

  const push = (frame: HandFrame): Intent => {
    const it = controller.update(frame)
    handClock = frame.t
    if (lines.length) {
      // A seek or a loop goes back: start again from the first line still ahead.
      if (frame.t < lastFrameT) {
        const i = lines.findIndex((l) => l.t1 > frame.t)
        nextLine = i === -1 ? lines.length : i
      }
      while (nextLine < lines.length && lines[nextLine]!.t1 <= frame.t) hear({ text: lines[nextLine++]!.text, final: true })
      lastFrameT = frame.t
    }
    if (it.cursor.tracked || frame.hands.length > 0) lastSeen = performance.now()
    let fists = 0
    for (const h of frame.hands) if (controller.grab.isHolding(h.id)) fists++
    gesture = fists > 1 ? "fists" : fists ? "fist" : it.cursor.pinched ? "pinch" : it.cursor.tracked ? "point" : undefined
    // The session recorder's voice, when one records (editor/recorder.ts onTranscript).
    if (!recorderLinked) {
      const rec = (window as unknown as { __dtRecorder?: { onTranscript?(fn: (l: { text: string; final: boolean }) => void): () => void } }).__dtRecorder
      if (rec?.onTranscript) {
        recorderLinked = true
        const off = rec.onTranscript((l) => hear(l))
        opts.signal.addEventListener("abort", off)
      }
    }
    if (it.cursor.tracked) {
      pointAt.x = it.cursor.x * window.innerWidth
      pointAt.y = it.cursor.y * window.innerHeight
      pointSeen = true
    }
    // Hand talk runs whether or not the scene is walkable: recording and
    // recognising do not need free play.
    if (recording) {
      // A take is timed on the frames' own clock, from the first it sees.
      if (recording.frames.length === 0) recording.until = frame.t + recording.seconds
      recording.frames.push(frame)
      if (frame.t >= recording.until) {
        const r = recording
        recording = undefined
        const list = [...(takes.get(r.name) ?? []), r.frames]
        takes.set(r.name, list)
        const others = store.library.mudras.filter((m) => m.name !== r.name)
        store.library = { mudras: [...others, learn(r.name, r.kind, list)] }
        recogniser = new MudraRecogniser(store.library)
        save()
        r.done(list.length)
      }
    } else if (store.library.mudras.length > 0) {
      const rec = recogniser.update(frame)
      candidates = rec.candidates
      if (rec.invoked && it.cursor.pinched) pinchSpoke = true
      if (rec.invoked && store.bindings[rec.invoked.name]) act(store.bindings[rec.invoked.name]!, `mudra:${rec.invoked.name}`)
      jev.see(rec.candidates)
      jev.actions = actionsFor()
      void jev.maybeAsk(frame.t).then((d) => {
        if (d?.action) {
          act(d.action, "jev")
          if (last) last = { ...last, decision: d }
        }
      })
    }
    // Calibration runs on its own, whatever the scene is doing: the pinches
    // are calibration, not clicks.
    if (calibration) {
      const cur = it.cursor
      if (cur.released && cur.sample) {
        calibration.samples.push(cur.sample)
        calibration.k++
        if (calibration.k >= CALIBRATION_TARGETS.length) {
          const fit = fitCalibration(calibration.samples)
          controller.cursor.calibration = fit
          try {
            localStorage.setItem(CALIBRATION_KEY, JSON.stringify(fit))
          } catch {}
          const done = calibration.done
          calibration = undefined
          calibrated = { fit, at: performance.now() }
          done(fit)
        }
      }
      return later(it)
    }
    if (!target.live()) return later(it)
    const c = it.cursor
    hoverWanted = c.tracked && !it.grab.holding
    if (hoverWanted) {
      hoverAt.x = c.x * window.innerWidth
      hoverAt.y = c.y * window.innerHeight
    }
    {
      if (it.press) {
        const p = client(it.press)
        const id = target.axisAt(p.x, p.y)
        scrub = id ? { id, ...target.axisIndex(id), moved: false } : undefined
      }
      if (it.drag && scrub) {
        scrub.moved = true
        target.scrubAxis(scrub.id, scrub.i + it.drag.dx / SCRUB_STEP)
      }
      if (it.dragEnd) {
        if (scrub?.moved) target.settleAxis(scrub.id)
        scrub = undefined
      }
      if (it.press) held = { t: frame.t, at: client(it.press), opened: false }
      if (it.drag) held = undefined // it travelled: a drag, not a long press
      if (held && !held.opened && c.pinched && target.menuAt && frame.t - held.t >= HOLD) {
        held.opened = true
        target.menuAt(held.at.x, held.at.y)
      }
      if (it.click) {
        const p = client(it.click)
        if (!pinchSpoke && !held?.opened) target.click(p.x, p.y)
        scrub = undefined
      }
      if (it.press || c.released) pinchSpoke = false
      if (c.released) held = undefined
    }
    // Grab: the scene in the hands, through the view layer like any gesture.
    const view = target.view()
    const g = it.grab
    if (view && (g.orbit.x || g.orbit.y || g.pan.x || g.pan.y || g.dolly)) {
      const W = window.innerWidth
      const H = window.innerHeight
      if (g.orbit.x || g.orbit.y) view.orbit(g.orbit.x * W, g.orbit.y * W, W)
      if (g.pan.x || g.pan.y) view.pan(g.pan.x * W, g.pan.y * H, H)
      if (g.dolly) view.dolly(g.dolly / DOLLY_PER_NOTCH)
      viewMoved = true
    }
    return later(it)
  }

  const unsubscribe = opts.source?.subscribe(push)
  if (unsubscribe) opts.signal.addEventListener("abort", unsubscribe)

  const mudras: Mudras = {
    record: (name, kind, seconds = kind === "pose" ? 1 : 1.5) =>
      new Promise((resolve) => {
        recording = { name, kind, seconds, until: Number.POSITIVE_INFINITY, frames: [], done: resolve }
      }),
    bind: (name, action) => {
      store.bindings[name] = action
      save()
    },
    forget: (name) => {
      store.library = { mudras: store.library.mudras.filter((m) => m.name !== name) }
      delete store.bindings[name]
      takes.delete(name)
      recogniser = new MudraRecogniser(store.library)
      save()
    },
    store,
    get candidates() {
      return candidates
    },
    get last() {
      return last
    },
  }

  return {
    push,
    controller,
    mudras,
    hear,
    get listening() {
      return listening
    },
    act,
    calibrate: () =>
      new Promise<PinchCalibration | undefined>((resolve) => {
        calibration?.done(undefined)
        calibration = { k: 0, samples: [], done: resolve }
      }),
    actionNames: () => ["home", "invoke:dismiss", ...(target.axes?.() ?? []).map((a) => `fire:${a.id}`)],
    cancelCalibration: () => {
      const c = calibration
      calibration = undefined
      beginOverlay(overlay) // the ring goes at once, not at the next hand frame
      c?.done(undefined)
    },
    get calibrating() {
      return calibration !== undefined
    },
    get calibrationStored() {
      return stored || calibrated !== undefined
    },
    get handsActive() {
      return performance.now() - lastSeen < 3000
    },
    get gesture() {
      return gesture
    },
  }
}
