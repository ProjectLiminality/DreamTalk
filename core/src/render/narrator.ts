/**
 * narrator.ts — playing the spoken score against a scrubable timeline.
 *
 * The hard part of narration is not making sound; it is that a DreamSong's
 * time is not a tape. The author scrubs, jumps between beats, holds a frame,
 * plays backwards, reloads at t=41.2. Audio is the one part of the system
 * that has its own clock, and every bug here is the two clocks disagreeing.
 *
 * THE RULE: THE TIMELINE IS THE TRUTH
 *
 * The scene's `t` is authoritative, always. This class never tells the scene
 * what time it is; it is told, and it makes the audio agree:
 *
 *   - **t moves forward normally** → let the clip run; do nothing.
 *   - **t jumps** (a scrub, a beat click) → re-seek into the line at the
 *     right offset, or stop if the jump landed in silence.
 *   - **t is held** (a screenshot, a paused frame) → nothing plays. A still
 *     frame is silent; the gauntlet and the editor's held frames must sound
 *     like nothing, because they ARE nothing.
 *   - **t runs backwards** → stop. Speech reversed is noise, and pretending
 *     otherwise would be a party trick, not a feature.
 *
 * WHY IT DECODES ONCE AND KEEPS THE BUFFER
 *
 * Scrubbing across a line re-seeks it constantly. Re-fetching or re-decoding
 * per seek would stutter, so each utterance is fetched and decoded once, then
 * played from a fresh source node per seek (Web Audio buffers are reusable;
 * source nodes are single-use). Decode is lazy — a line nobody reaches is
 * never fetched, which matters for a long song opened at its end.
 *
 * SILENCE IS ALWAYS ACCEPTABLE
 *
 * Missing audio, a blocked AudioContext (browsers refuse one before a user
 * gesture), a failed decode, no daemon: all of these mean the scene plays
 * silently. Narration is a layer over a DreamSong, never a dependency of it.
 */

import type { Narration, Utterance } from "../narration"
import { voiceKey, type VoiceCache } from "../voice"

/** How far t may move in one frame and still count as "playing forward". */
const CONTINUOUS_SECONDS = 0.5

/** Below this, t has not really moved — a held frame, not playback. */
const STILL_SECONDS = 1e-4

interface Voiced {
  readonly line: Utterance
  /** Decoded audio, once fetched. `null` = tried and unavailable. */
  buffer?: AudioBuffer | null
  /** In-flight fetch, so a scrub cannot start ten of them. */
  loading?: Promise<void>
}

export class Narrator {
  private ctx?: AudioContext
  private readonly voiced: Voiced[]
  private playing?: { source: AudioBufferSourceNode; index: number }
  /** The previous t, to tell playback from a jump. NaN until the first frame. */
  private lastT = Number.NaN

  constructor(
    narration: Narration,
    private readonly cache: VoiceCache,
    private readonly voice?: string,
  ) {
    this.voiced = narration.lines.map((line) => ({ line }))
  }

  get isEmpty(): boolean {
    return this.voiced.length === 0
  }

  /**
   * Bring the audio into agreement with the scene's time.
   *
   * Called once per frame with the scene's t and whether the transport is
   * running. Everything this class does happens here — there is no separate
   * play/pause API, because there is no second clock to control.
   */
  update(t: number, transportPlaying: boolean): void {
    const prev = this.lastT
    this.lastT = t

    // A still or paused frame is silent, and so is any backwards step.
    const delta = t - prev
    if (!transportPlaying || !Number.isFinite(prev) || delta < 0 || Math.abs(delta) < STILL_SECONDS) {
      this.stop()
      if (!transportPlaying) return
      // A jump while playing still needs the new line started below.
      if (delta < 0 || !Number.isFinite(prev)) {
        this.startAt(t)
      }
      return
    }

    const index = this.voiced.findIndex(
      (v) => t >= v.line.start && t < v.line.start + v.line.duration,
    )

    // Playing on through the same line: leave it alone. This is the common
    // case and it must cost nothing, or narration would re-seek every frame.
    if (this.playing && this.playing.index === index && delta <= CONTINUOUS_SECONDS) return

    this.stop()
    if (index >= 0) this.startAt(t, index)
  }

  /** Start whichever line covers t, at the right offset into it. */
  private startAt(t: number, known?: number): void {
    const index =
      known ??
      this.voiced.findIndex((v) => t >= v.line.start && t < v.line.start + v.line.duration)
    if (index < 0) return
    const v = this.voiced[index]!
    const offset = t - v.line.start

    if (v.buffer === undefined) {
      // Not loaded yet. Kick it off; the next frame that still wants this
      // line will start it. Deliberately not awaited — a frame must never
      // block on the network.
      void this.load(index)
      return
    }
    if (v.buffer === null) return // known-unavailable: silence

    const ctx = this.audio()
    if (!ctx) return
    const source = ctx.createBufferSource()
    source.buffer = v.buffer
    source.connect(ctx.destination)
    try {
      source.start(0, Math.max(0, offset))
    } catch {
      return // an offset past the buffer's end: nothing to say
    }
    this.playing = { source, index }
  }

  private stop(): void {
    if (!this.playing) return
    try {
      this.playing.source.stop()
    } catch {
      // Already ended. Stopping a finished source throws; that is fine.
    }
    this.playing = undefined
  }

  /** Fetch and decode one line, once. Failure is remembered as silence. */
  private async load(index: number): Promise<void> {
    const v = this.voiced[index]!
    if (v.loading) return v.loading
    v.loading = (async () => {
      const ctx = this.audio()
      if (!ctx) {
        v.buffer = null
        return
      }
      try {
        const bytes = await this.cache.get(voiceKey(v.line, this.voice))
        v.buffer = bytes ? await ctx.decodeAudioData(bytes) : null
      } catch {
        v.buffer = null
      }
    })()
    return v.loading
  }

  /**
   * The AudioContext, created on first need.
   *
   * Browsers refuse to start one before a user gesture, so this can fail and
   * must be allowed to: a scene that autoplays in a headless screenshot has
   * no audio and no error, which is exactly right.
   */
  private audio(): AudioContext | undefined {
    if (this.ctx) return this.ctx
    try {
      const Ctor =
        (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return undefined
      this.ctx = new Ctor()
      return this.ctx
    } catch {
      return undefined
    }
  }

  /** Release everything — a scene switch or an editor remount. */
  dispose(): void {
    this.stop()
    try {
      void this.ctx?.close()
    } catch {
      // Closing a context that never opened is not an error worth having.
    }
    this.ctx = undefined
  }
}
