/**
 * sources.ts — every hand source a page can open, chosen by the query:
 *
 *   ?hands=webcam[&fov=65][&camera=FaceTime]   MediaPipe on the camera (webcam.ts)
 *   ?hands=leap                                the Leap, via the daemon's /ws/hands (scripts/leap-bridge.ts)
 *   ?hands=replay&session=<id>[&loop=1]        a recorded session: refs/sessions/<id>/hands.jsonl,
 *                                              its voice.webm alongside (&voice=0 silences it)
 *   ?hands=replay&file=<url>                   any hands.jsonl by URL (fixtures)
 *   ?hands=sim[&script=pinch][&loop=1]         a scripted hand (sim.ts SIM_SCRIPTS)
 *
 * Replay and sim are deterministic: `at(t)` shows the frame at t and stops
 * their own clock (a host that requests time, as TASTE.md asks); `play()`
 * gives the clock back. Playing, they never skip: when the page stalls (a
 * shader prewarm, a long frame) every frame the stall swallowed is emitted on
 * the next tick, in order — the take reaches the gesture layer whole.
 */

import {
  decodeFrames,
  frameAt,
  HandEmitter,
  type HandFrame,
  type HandMessage,
  type HandSource,
} from "../src/hands"
import { SIM_FPS, SIM_SCRIPTS, simDuration, simFrameAt, type SimKey } from "./sim"
import { WebcamSource } from "./webcam"

/** The Leap, relayed by the studio daemon. */
export class LeapSource extends HandEmitter implements HandSource {
  readonly kind = "leap" as const
  #ws?: WebSocket
  #running = false
  #url: string
  constructor(url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/hands`) {
    super()
    this.#url = url
    this.say("leap: off")
  }
  async start(): Promise<void> {
    if (this.#running) return
    this.#running = true
    this.say("leap: connecting to the studio…")
    const connect = () => {
      if (!this.#running) return
      const ws = new WebSocket(this.#url)
      this.#ws = ws
      ws.onmessage = (e) => {
        let m: HandMessage
        try {
          m = JSON.parse(String(e.data)) as HandMessage
        } catch {
          return
        }
        if (m.kind === "status") this.say(`leap: ${m.text}`)
        else if (m.kind === "frame") {
          this.say(`leap: ${m.frame.hands.length ? `${m.frame.hands.length} hand${m.frame.hands.length > 1 ? "s" : ""}` : "no hands"}`)
          this.emit(m.frame)
        }
      }
      ws.onopen = () => this.say("leap: waiting for the bridge… (is `bun run studio` running?)")
      ws.onclose = () => {
        if (!this.#running) return
        this.say("leap: studio daemon not reachable — retrying")
        setTimeout(connect, 1000)
      }
    }
    connect()
  }
  stop(): void {
    this.#running = false
    this.#ws?.close()
    this.say("leap: off")
  }
}

/** Frames on a clock: the shared body of replay and sim. */
abstract class ClockedSource extends HandEmitter implements HandSource {
  abstract readonly kind: "replay" | "sim"
  protected loop: boolean
  #raf = 0
  #t0 = 0
  #playing = false
  constructor(loop: boolean) {
    super()
    this.loop = loop
  }
  /** The frame at t (seconds). */
  protected abstract frame(t: number): HandFrame | undefined
  /** Every frame in (t0, t1], in order — what a tick from t0 to t1 must not skip. */
  abstract framesIn(t0: number, t1: number): HandFrame[]
  abstract get duration(): number
  protected media(): HTMLMediaElement | undefined {
    return undefined
  }
  async start(): Promise<void> {
    await this.load()
    this.play()
  }
  protected async load(): Promise<void> {}
  /** Show the frame at t; the source's own clock stops. */
  at(t: number): HandFrame | undefined {
    this.pause()
    const f = this.frame(t)
    if (f) this.emit(f)
    const m = this.media()
    if (m) m.currentTime = t
    return f
  }
  pause() {
    this.#playing = false
    if (this.#raf) cancelAnimationFrame(this.#raf)
    this.media()?.pause()
  }
  play(from = 0) {
    this.pause()
    this.#playing = true
    this.#t0 = performance.now() - from * 1000
    const m = this.media()
    if (m) {
      m.currentTime = from
      void m.play().catch(() => {})
    }
    let lastT = from - 1e-9
    const step = () => {
      if (!this.#playing) return
      // With a voice playing, its clock is the clock: hands and words stay together.
      const t = m && !m.paused ? m.currentTime : (performance.now() - this.#t0) / 1000
      if (t > this.duration) {
        for (const f of this.framesIn(lastT, this.duration)) this.emit(f)
        if (!this.loop) return this.pause()
        this.play(0)
        return
      }
      for (const f of this.framesIn(lastT, t)) this.emit(f)
      lastT = t
      this.#raf = requestAnimationFrame(step)
    }
    this.#raf = requestAnimationFrame(step)
  }
  stop(): void {
    this.pause()
  }
}

/** A recorded session (or any hands.jsonl), played back. */
export class ReplaySource extends ClockedSource {
  readonly kind = "replay" as const
  frames: HandFrame[] = []
  #url: string
  #voiceUrl?: string
  #audio?: HTMLAudioElement
  constructor(opts: { session?: string; file?: string; loop?: boolean; voice?: boolean }) {
    super(opts.loop ?? false)
    this.#url = opts.file ?? `/api/session/${encodeURIComponent(opts.session ?? "")}/hands.jsonl`
    if (opts.session && opts.voice !== false) this.#voiceUrl = `/api/session/${encodeURIComponent(opts.session)}/voice.webm`
    this.say("replay: loading…")
  }
  /** Frames handed in directly (tests, a host that already holds them). */
  static of(frames: HandFrame[], loop = false): ReplaySource {
    const r = new ReplaySource({ file: "", loop })
    r.frames = frames
    r.say(`replay: ${frames.length} frames`)
    return r
  }
  get duration() {
    return this.frames.at(-1)?.t ?? 0
  }
  protected override media() {
    return this.#audio
  }
  protected override async load() {
    if (this.frames.length || !this.#url) return
    const res = await fetch(this.#url)
    if (!res.ok) return this.say(`replay: ${this.#url} → ${res.status}`)
    this.frames = decodeFrames(await res.text()).map((f) => ({ ...f, source: "replay" }))
    if (this.#voiceUrl && (await fetch(this.#voiceUrl, { method: "HEAD" })).ok) this.#audio = new Audio(this.#voiceUrl)
    this.say(`replay: ${this.frames.length} frames · ${this.duration.toFixed(1)} s${this.#audio ? " · with voice" : ""}`)
  }
  protected frame(t: number) {
    return frameAt(this.frames, t)
  }
  framesIn(t0: number, t1: number) {
    return this.frames.filter((f) => f.t > t0 && f.t <= t1)
  }
}

/** A scripted hand on its own clock. */
export class SimSource extends ClockedSource {
  readonly kind = "sim" as const
  #keys: SimKey[]
  constructor(script: string | SimKey[] = "pinch", loop = true) {
    super(loop)
    this.#keys = typeof script === "string" ? (SIM_SCRIPTS[script] ?? SIM_SCRIPTS.pinch!) : script
    this.say(`sim: ${typeof script === "string" ? script : "custom"}`)
  }
  get duration() {
    return simDuration(this.#keys)
  }
  protected frame(t: number) {
    return simFrameAt(this.#keys, t)
  }
  /** The script sampled on its own 60 fps grid, whatever the page's frame rate. */
  framesIn(t0: number, t1: number) {
    const out: HandFrame[] = []
    for (let k = Math.floor(t0 * SIM_FPS) + 1; k / SIM_FPS <= t1; k++) out.push(simFrameAt(this.#keys, k / SIM_FPS))
    return out
  }
}

/** The source the query asks for, or undefined when `?hands` is absent or off. */
export const handSourceFromQuery = (q: URLSearchParams): (HandSource & HandEmitter) | undefined => {
  const kind = q.get("hands")
  const loop = q.get("loop") === "1"
  switch (kind) {
    case "webcam":
      return new WebcamSource({ fov: Number(q.get("fov")) || undefined, camera: q.get("camera") ?? undefined })
    case "leap":
      return new LeapSource()
    case "replay":
      return new ReplaySource({ session: q.get("session") ?? undefined, file: q.get("file") ?? undefined, loop, voice: q.get("voice") !== "0" })
    case "sim":
      return new SimSource(q.get("script") ?? "pinch", q.get("loop") !== "0")
    default:
      return undefined
  }
}
