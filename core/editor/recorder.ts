/**
 * The session recorder — a live walk through the state space, kept
 * (scripts/session.ts holds the format and turns it into song code).
 *
 * ⇧R starts and stops it, in the paused editor and in the player's free
 * play alike. While it runs it samples, each frame, what the walk does —
 * the fires (read off the automaton's own journal: nothing to hook), the
 * effective camera, the holon in focus — and records the microphone (and,
 * where the browser has one, a live transcript). Stopping writes the
 * session folder through the daemon: `refs/sessions/<id>/` (session.json,
 * voice.webm). Other recorders (hand frames) join the same folder and the
 * same clock: `recorder.clock()` is seconds since the session started.
 *
 * It never writes the song. Writing the walk into the song is a separate,
 * undoable act (the editor's `appendSession` op).
 */

import type { Automaton } from "../src/automaton"
import type { Holon } from "../src/holon"
import type { Observer } from "../src/dream"
import type { Param, ParamValue } from "../src/params"

export interface RecorderOpts {
  /** The registry key and the scene's file. */
  scene: string
  sceneFile: () => string | undefined
  /** The walk's automaton right now (it is rebuilt with the scene). */
  automaton: () => Automaton | undefined
  observer: Observer
  /** The song time the world is held at. */
  heldAt: () => number
  /** An axis owner as the scene's code names it (`this.map`), or undefined. */
  pathOf: (h: Holon) => string | undefined
  /** The holon in focus (the player's gallery), if any. */
  focus?: () => Holon | null
  /** Clock params the song runs, as `this.…` paths. */
  clocks: () => string[]
  /** Record the microphone (true by default). */
  mic?: boolean
  note: (text: string) => void
}

export interface SessionTrackFire {
  t: number
  axis: string
  from: string
  to: string
  duration: number
  holon: string | null
}

const CAMERA_PARAMS = ["phi", "theta", "radius", "zoom", "x", "y", "z"] as const
/** Camera samples at most this often (s) — the passage decimates further. */
const CAMERA_EVERY = 0.1

/** `2026-10-15T14-03-22` — the session's name, in local time. */
export const sessionId = (d = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}

type Recognition = {
  continuous: boolean
  interimResults: boolean
  onresult: (e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void
  onerror: () => void
  start(): void
  stop(): void
}

export class SessionRecorder {
  #opts: RecorderOpts
  #id: string | undefined
  #t0 = 0
  #startedAt = ""
  #heldAt = 0
  #seen = 0
  #lastCamera = -Infinity
  #fires: SessionTrackFire[] = []
  #entry = new Map<string, string>()
  #camera: Record<string, number>[] = []
  #focus: { t: number; holon: string | null }[] = []
  #lastFocus: Holon | null | undefined
  #transcript: { t0: number; t1: number; text: string }[] = []
  #media: MediaRecorder | undefined
  #chunks: Blob[] = []
  #recognition: Recognition | undefined

  constructor(opts: RecorderOpts) {
    this.#opts = opts
  }

  /**
   * Point a running recorder at a fresh mount (the editor remounts on every
   * daemon reload — agents edit the repo all the time — and a session must
   * outlive that: the mic keeps recording, the clock keeps its origin).
   */
  rebind(opts: RecorderOpts): void {
    this.#opts = opts
    this.#seen = opts.automaton()?.journal.length ?? 0
    this.#lastFocus = undefined
  }

  readonly #hear = new Set<(line: { text: string; final: boolean; t: number }) => void>()

  /**
   * Hear what is said while a session records (the browser allows one
   * recognition at a time, so this is THE voice): interim lines as they
   * form, finals as they settle; `t` on the session clock. Returns unsubscribe.
   */
  onTranscript(fn: (line: { text: string; final: boolean; t: number }) => void): () => void {
    this.#hear.add(fn)
    return () => this.#hear.delete(fn)
  }

  /** The last session this recorder wrote (kept across remounts, like the recorder). */
  lastId: string | undefined
  lastSeconds: number | undefined

  get recording(): boolean {
    return this.#id !== undefined
  }

  get id(): string | undefined {
    return this.#id
  }

  /** Seconds since the session started — the one clock every track shares. */
  clock(now = performance.now()): number {
    return (now - this.#t0) / 1000
  }

  async start(): Promise<string> {
    if (this.#id) return this.#id
    this.#id = sessionId()
    this.#t0 = performance.now()
    this.#startedAt = new Date().toISOString()
    this.#heldAt = this.#opts.heldAt()
    const a = this.#opts.automaton()
    this.#seen = a?.journal.length ?? 0
    this.#entry = new Map(a?.axes.map((x) => [x.id, a.position(x.id)]) ?? [])
    this.#fires = []
    this.#camera = []
    this.#focus = []
    this.#transcript = []
    this.#lastFocus = undefined
    this.#lastCamera = -Infinity
    this.#chunks = []
    if (this.#opts.mic !== false) await this.#startMic()
    this.tick()
    return this.#id
  }

  /** One frame: fires since the last look, the camera, the focus. */
  tick(now = performance.now()): void {
    if (!this.#id) return
    const t = this.clock(now)
    const a = this.#opts.automaton()
    if (a) {
      // The journal is the walk, in order; anything past what we saw is new.
      if (a.journal.length < this.#seen) this.#seen = 0 // re-entered: a fresh journal
      for (const f of a.journal.slice(this.#seen)) {
        const axis = a.axis(f.axis)
        const from = [...this.#fires].reverse().find((x) => x.axis === f.axis)?.to
        this.#fires.push({
          t,
          axis: f.axis,
          // Where it came from: its last fire here, else where the walk entered it.
          from: from ?? this.#entry.get(f.axis) ?? "",
          to: f.position,
          duration: axis.duration,
          holon: axis.owner ? (this.#opts.pathOf(axis.owner) ?? null) : null,
        })
      }
      this.#seen = a.journal.length
    }
    if (t - this.#lastCamera >= CAMERA_EVERY) {
      this.#lastCamera = t
      const o = this.#opts.observer as unknown as Record<string, Param<ParamValue>>
      const key: Record<string, number> = { t }
      for (const p of CAMERA_PARAMS) {
        const param = o[p]
        // A bound reading (a rig) cannot be authored: leave it to its binding.
        if (param && !param.isBound && typeof param.value === "number") key[p] = param.value
      }
      this.#camera.push(key)
    }
    const f = this.#opts.focus?.() ?? null
    if (f !== this.#lastFocus) {
      this.#lastFocus = f
      this.#focus.push({ t, holon: f ? (this.#opts.pathOf(f) ?? null) : null })
    }
  }

  /** Stop, and write the session folder. Resolves to its id. */
  async stop(): Promise<string | undefined> {
    const id = this.#id
    if (!id) return undefined
    this.tick()
    const duration = this.clock()
    const audio = await this.#stopMic()
    this.#id = undefined
    const put = (file: string, body: BodyInit) => fetch(`/api/session/${id}/${file}`, { method: "PUT", body })
    if (audio) await put("voice.webm", audio)
    const session = {
      version: 1,
      id,
      scene: this.#opts.scene,
      sceneFile: this.#opts.sceneFile(),
      startedAt: this.#startedAt,
      heldAt: this.#heldAt,
      duration,
      clocks: this.#opts.clocks(),
      tracks: { fires: this.#fires, camera: this.#camera, focus: this.#focus, transcript: this.#transcript },
      // Other recorders' tracks in this folder (hands.jsonl) are listed by
      // the daemon when it reads the session — their last chunk may land later.
      files: audio ? { audio: "voice.webm" } : {},
    }
    await put("session.json", JSON.stringify(session, null, 2))
    this.lastId = id
    this.lastSeconds = duration
    return id
  }

  async #startMic(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const media = new MediaRecorder(stream)
      media.ondataavailable = (e) => e.data.size && this.#chunks.push(e.data)
      media.start(1000)
      this.#media = media
    } catch {
      this.#opts.note("recording without the microphone")
    }
    const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
    const R = Ctor.SpeechRecognition ?? Ctor.webkitSpeechRecognition
    if (!R || !this.#media) return
    try {
      const r = new R()
      r.continuous = true
      r.interimResults = true
      r.onresult = (e) => {
        const t = this.clock()
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]!
          const text = res[0]!.transcript.trim()
          if (!text) continue
          for (const fn of this.#hear) fn({ text, final: res.isFinal, t })
          if (!res.isFinal) continue
          // A final result lands at its END; its start is the previous line's end, or a guess.
          const words = text.split(/\s+/).length
          const t0 = Math.max(this.#transcript.at(-1)?.t1 ?? 0, t - words * 0.4)
          this.#transcript.push({ t0, t1: t, text })
        }
      }
      r.onerror = () => {}
      r.start()
      this.#recognition = r
    } catch {}
  }

  async #stopMic(): Promise<Blob | undefined> {
    this.#recognition?.stop()
    this.#recognition = undefined
    const media = this.#media
    this.#media = undefined
    if (!media) return undefined
    await new Promise<void>((done) => {
      media.onstop = () => done()
      media.stop()
    })
    for (const track of media.stream.getTracks()) track.stop()
    return this.#chunks.length ? new Blob(this.#chunks, { type: media.mimeType || "audio/webm" }) : undefined
  }
}
