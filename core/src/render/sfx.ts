/**
 * sfx.ts — playing the effect sounds against a scrubable timeline.
 *
 * The Narrator's sibling (narrator.ts), under the same rule: THE TIMELINE IS
 * THE TRUTH. This class is told what time it is once per frame and decides
 * which sounds the transport just passed:
 *
 *   - **t moves forward normally** → every event in (previous t, t] sounds.
 *   - **t jumps** (a scrub, a beat click, the loop wrapping) → nothing. A
 *     scrub across a burst of pings must not fire all of them at once.
 *   - **t is held, or runs backwards** → nothing. A still frame is silent.
 *
 * An effect is an instant, not a clip, so unlike narration there is nothing
 * to re-seek: a sound either fires as the playhead crosses it or not at all.
 *
 * SYNTHESIZED, NOT SAMPLED
 *
 * No audio files and no assets: every sound is built from oscillators and a
 * seeded noise buffer at the moment it fires. The set is small and calm —
 *
 *   - **ping** — a bell-like sine with one inharmonic partial, short decay;
 *   - **chime** — two soft sines a fifth apart, long decay;
 *   - **whoosh** — band-passed noise sweeping upward and fading;
 *
 * all of them quiet, and quieter still while a narration line is speaking:
 * effects sit under the voice, never over it.
 *
 * SILENCE IS ALWAYS ACCEPTABLE
 *
 * No AudioContext, one the browser refuses before a gesture, a node that will
 * not start: all silence, never an error. `onFire` still reports what the
 * score asked for — which is how a headless harness, which cannot hear,
 * checks that the right sounds fire at the right times.
 */

import type { Narration } from "../narration"
import type { SoundEvent, Soundtrack } from "../sound"

/** How far t may move in one frame and still count as "playing forward". */
const CONTINUOUS_SECONDS = 0.5

/** Below this, t has not really moved — a held frame, not playback. */
const STILL_SECONDS = 1e-4

/** The whole effects bus — well under a narration clip at unity. */
const MASTER_GAIN = 0.35

/** While a line is being spoken, effects step further back. */
const UNDER_VOICE = 0.55

/** One fired sound, as the harness sees it. */
export interface FiredSound {
  readonly event: SoundEvent
  /** The scene t of the frame that fired it (≥ event.time, by under a frame). */
  readonly at: number
  readonly muted: boolean
}

export interface EffectPlayerOptions {
  /** Narration to duck under. */
  narration?: Narration
  /** Every sound the score asked for, audible or not. */
  onFire?: (fired: FiredSound) => void
}

export class EffectPlayer {
  private ctx?: AudioContext
  private bus?: GainNode
  private noise?: AudioBuffer
  private lastT = Number.NaN
  /** Muted sounds still "fire" (and report) — they are simply not heard. */
  muted = false

  constructor(
    private readonly track: Soundtrack,
    private readonly opts: EffectPlayerOptions = {},
  ) {}

  get isEmpty(): boolean {
    return this.track.isEmpty
  }

  /** Once per frame, with the scene's t and whether the transport is running. */
  update(t: number, transportPlaying: boolean): void {
    const prev = this.lastT
    this.lastT = t
    if (!transportPlaying || !Number.isFinite(prev) || !Number.isFinite(t)) return
    const delta = t - prev
    if (delta < STILL_SECONDS || delta > CONTINUOUS_SECONDS) return
    for (const event of this.track.between(prev, t)) this.fire(event, t)
  }

  private fire(event: SoundEvent, at: number): void {
    this.opts.onFire?.({ event, at, muted: this.muted })
    if (this.muted) return
    const ctx = this.audio()
    if (!ctx || !this.bus) return
    if (ctx.state === "suspended") void ctx.resume().catch(() => {})
    const level = event.gain * (this.opts.narration?.at(at) ? UNDER_VOICE : 1)
    try {
      if (event.kind === "ping") this.ping(ctx, event.pitch, level)
      else if (event.kind === "chime") this.chime(ctx, event.pitch, level)
      else this.whoosh(ctx, event.pitch, level)
    } catch {
      // A node that will not build or start: this sound is silence.
    }
  }

  /** A sine with an exponential tail, into the bus. */
  private tone(ctx: AudioContext, freq: number, peak: number, attack: number, decay: number): void {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.value = freq
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(peak, now + attack)
    env.gain.exponentialRampToValueAtTime(1e-4, now + attack + decay)
    osc.connect(env).connect(this.bus!)
    osc.start(now)
    osc.stop(now + attack + decay + 0.05)
  }

  /** Impact: bright, short, bell-like (the 2.76 partial is a struck bar's). */
  private ping(ctx: AudioContext, pitch: number, level: number): void {
    const f = 660 * pitch
    this.tone(ctx, f, 0.5 * level, 0.004, 0.45)
    this.tone(ctx, f * 2.76, 0.12 * level, 0.002, 0.18)
  }

  /** Completion: soft, open, a fifth, lingering. */
  private chime(ctx: AudioContext, pitch: number, level: number): void {
    const f = 523.25 * pitch
    this.tone(ctx, f, 0.32 * level, 0.02, 1.6)
    this.tone(ctx, f * 1.5, 0.2 * level, 0.03, 1.3)
    this.tone(ctx, f * 2, 0.06 * level, 0.02, 0.9)
  }

  /** Motion: air moving past — noise through a rising band-pass. */
  private whoosh(ctx: AudioContext, pitch: number, level: number): void {
    const now = ctx.currentTime
    const span = 0.5
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(ctx)
    const band = ctx.createBiquadFilter()
    band.type = "bandpass"
    band.Q.value = 1.2
    band.frequency.setValueAtTime(350 * pitch, now)
    band.frequency.exponentialRampToValueAtTime(2200 * pitch, now + span)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(0.5 * level, now + span * 0.45)
    env.gain.linearRampToValueAtTime(0, now + span)
    src.connect(band).connect(env).connect(this.bus!)
    src.start(now)
    src.stop(now + span + 0.02)
  }

  /** Half a second of white noise, seeded — the same whoosh every time. */
  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.55), ctx.sampleRate)
    const data = buf.getChannelData(0)
    let s = 0x2545f491
    for (let i = 0; i < data.length; i++) {
      s ^= s << 13
      s ^= s >>> 17
      s ^= s << 5
      data[i] = ((s >>> 0) / 0xffffffff) * 2 - 1
    }
    this.noise = buf
    return buf
  }

  /** The AudioContext and its bus, created on first need; may fail, silently. */
  private audio(): AudioContext | undefined {
    if (this.ctx) return this.ctx
    try {
      const Ctor =
        (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return undefined
      const ctx = new Ctor()
      const bus = ctx.createGain()
      bus.gain.value = MASTER_GAIN
      bus.connect(ctx.destination)
      this.ctx = ctx
      this.bus = bus
      return ctx
    } catch {
      return undefined
    }
  }

  /** Release everything — a scene switch or an editor remount. */
  dispose(): void {
    try {
      void this.ctx?.close()
    } catch {
      // Closing a context that never opened is not an error worth having.
    }
    this.ctx = undefined
    this.bus = undefined
    this.noise = undefined
  }
}
