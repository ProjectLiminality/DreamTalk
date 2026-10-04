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
 * seeded noise buffer at the moment it fires, from the recipe in
 * src/timbre.ts — the same recipe the exported song's mixdown renders
 * offline (src/mixdown.ts), so the movie sounds like the editor. The set is
 * small and calm —
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
import {
  MASTER_GAIN,
  NOISE_SECONDS,
  noiseSamples,
  SILENT,
  TIMBRE,
  UNDER_VOICE,
  type SoundPartial,
} from "../timbre"

/** How far t may move in one frame and still count as "playing forward". */
const CONTINUOUS_SECONDS = 0.5

/** Below this, t has not really moved — a held frame, not playback. */
const STILL_SECONDS = 1e-4

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
    const level = event.gain * (this.opts.narration?.at(event.time) ? UNDER_VOICE : 1)
    const timbre = TIMBRE[event.kind]
    try {
      for (const p of timbre.partials) this.partial(ctx, p, timbre.base, event.pitch, level)
    } catch {
      // A node that will not build or start: this sound is silence.
    }
  }

  /** One partial of the recipe (src/timbre.ts), as WebAudio nodes into the bus. */
  private partial(ctx: AudioContext, p: SoundPartial, base: number, pitch: number, level: number): void {
    const now = ctx.currentTime
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, now)
    if (p.type === "tone") {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = base * pitch * p.ratio
      env.gain.linearRampToValueAtTime(p.peak * level, now + p.attack)
      env.gain.exponentialRampToValueAtTime(SILENT, now + p.attack + p.decay)
      osc.connect(env).connect(this.bus!)
      osc.start(now)
      osc.stop(now + p.attack + p.decay + 0.05)
      return
    }
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(ctx)
    const band = ctx.createBiquadFilter()
    band.type = "bandpass"
    band.Q.value = p.q
    band.frequency.setValueAtTime(p.from * pitch, now)
    band.frequency.exponentialRampToValueAtTime(p.to * pitch, now + p.span)
    env.gain.linearRampToValueAtTime(p.peak * level, now + p.span * p.rise)
    env.gain.linearRampToValueAtTime(0, now + p.span)
    src.connect(band).connect(env).connect(this.bus!)
    src.start(now)
    src.stop(now + p.span + 0.02)
  }

  /** The recipe's seeded noise as a buffer — the same whoosh every time. */
  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise
    const samples = noiseSamples(Math.ceil(ctx.sampleRate * NOISE_SECONDS))
    const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate)
    buf.getChannelData(0).set(samples)
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
