/**
 * sound.ts — effect sound as part of the score.
 *
 * Narration (src/narration.ts) gave DreamTalk the spoken word. This is the
 * other half of the audio dimension: the small sounds the picture makes — a
 * ray's ping as it meets a wall, a soft chime as a symbol finishes drawing
 * itself, a whoosh under a fast move. RayCaster's header named the gap: the
 * collision "ping" could not be built because nothing drove an effect track.
 *
 * THE SAME DISCIPLINE AS NARRATION
 *
 * An effect sound is an EVENT ON THE SAME TIMELINE — a time, a kind, and a
 * couple of numbers that colour it. Never an audio file, never a second
 * clock. Everything in this module is pure: the events are a function of the
 * score, gathered once, identical on every machine, with or without an
 * AudioContext. `src/render/sfx.ts` is the only place they become sound, and
 * every failure there is silence.
 *
 * THREE WAYS A SOUND ENTERS THE SCORE
 *
 *   - **Stated** — `this.sound("whoosh")` in `unfold()`, at the cursor, like
 *     `say()`. The author's own beat.
 *   - **Declared by a holon** — an ability that knows when it makes a sound
 *     exposes `soundCues()`: conditions on its own pose ("the ray front has
 *     reached this hit"). The Dream finds the moment each one BECOMES true by
 *     sampling the timeline, so the time is derived from the holon's params
 *     and follows them: lengthen the cast and the pings move with it.
 *   - **Opted into by the Dream** — `this.chimes()` gives every symbol a soft
 *     chime as its draw-on completes. Opt-in per dream, so no existing song
 *     starts chiming because this file exists.
 */

import type { Clip } from "./timeline"
import { Holon } from "./holon"

/** The DreamTalk sound vocabulary — small on purpose. */
export type SoundKind = "ping" | "chime" | "whoosh"

/** One effect sound, placed on the dream's timeline. */
export interface SoundEvent {
  /** When it sounds, in scene seconds. */
  readonly time: number
  readonly kind: SoundKind
  /** Frequency ratio against the kind's base note: 1 = base, 2 = an octave up. */
  readonly pitch: number
  /** 0..1, against the kind's own (already quiet) level. */
  readonly gain: number
}

/** How a sound is coloured when it is stated or cued. */
export interface SoundVoice {
  pitch?: number
  gain?: number
}

/**
 * A holon's sound, as a condition on its pose.
 *
 * `sounded()` must be a pure function of the scene's current param values —
 * false before the moment, true after it. The sound is the moment it turns
 * true going forward. (`voice()` is read at that moment.)
 */
export interface SoundCue {
  readonly kind: SoundKind
  sounded(): boolean
  voice?(): SoundVoice
}

/** A holon that makes sounds of its own. Duck-typed: no base-class change. */
export interface Sounding {
  soundCues(): SoundCue[]
}

export const isSounding = (h: unknown): h is Sounding =>
  typeof (h as Partial<Sounding> | undefined)?.soundCues === "function"

/**
 * A distance, a ratio or any 0..1 reading, as a pitch on the major
 * pentatonic over one octave. Quantized on purpose: a burst of sixteen rays
 * hitting a square at sixteen distances then sounds like a chord, not a
 * cluster — calm is a design requirement, not a side effect.
 */
const PENTATONIC = [0, 2, 4, 7, 9, 12]
export const pentatonicPitch = (u: number): number => {
  const semis = Math.max(0, Math.min(1, u)) * 12
  let best = PENTATONIC[0]!
  for (const s of PENTATONIC) if (Math.abs(s - semis) < Math.abs(best - semis)) best = s
  return 2 ** (best / 12)
}

/**
 * Two sounds of the same kind and pitch closer than this are one sound.
 * Symmetric geometry (a square's rays hit in mirrored pairs) would otherwise
 * double every ping — louder, never better.
 */
const MERGE_SECONDS = 0.03

/** How finely the timeline is sampled looking for a cue's moment. */
export const CUE_STEP = 1 / 120

/** How exactly a cue's moment is pinned once bracketed (bisection). */
const CUE_EPSILON = 1e-5

/**
 * Find the moments each cue becomes true, going forward through [0, duration].
 *
 * `applyAt` poses the scene at a time (the Timeline's pure `apply`). The scan
 * samples every `step`, and a false → true step is bisected down to
 * `CUE_EPSILON`, so the event's time is the holon's own arrival time, not a
 * frame boundary. A cue already true at t = 0 never sounds: nothing crossed.
 *
 * Deterministic: the same score gives the same events, bit for bit.
 */
export const gatherCues = (
  cues: readonly SoundCue[],
  applyAt: (t: number) => void,
  duration: number,
  step = CUE_STEP,
): SoundEvent[] => {
  if (cues.length === 0 || !(duration > 0)) return []
  const out: SoundEvent[] = []
  applyAt(0)
  let was = cues.map((c) => c.sounded())
  let prevT = 0
  const n = Math.ceil(duration / step)
  for (let k = 1; k <= n; k++) {
    const t = Math.min(k * step, duration)
    applyAt(t)
    const now = cues.map((c) => c.sounded())
    for (let i = 0; i < cues.length; i++) {
      if (was[i] || !now[i]) continue
      const cue = cues[i]!
      let lo = prevT
      let hi = t
      while (hi - lo > CUE_EPSILON) {
        const mid = (lo + hi) / 2
        applyAt(mid)
        if (cue.sounded()) hi = mid
        else lo = mid
      }
      applyAt(hi)
      const v = cue.voice?.() ?? {}
      out.push({ time: hi, kind: cue.kind, pitch: v.pitch ?? 1, gain: v.gain ?? 1 })
      // Bisection moved the pose; put it back for the remaining cues.
      applyAt(t)
    }
    was = now
    prevT = t
  }
  return out
}

/**
 * The chime for each symbol completing its draw-on.
 *
 * Read off the clips directly — no sampling: within one `play()`, every
 * track that carries a holon's `creation` to 1 belongs to that holon's
 * symbol (its root), and the symbol is complete when the last of them lands.
 * `together(Create(a), Create(b))` is two symbols, finishing together: the
 * merge folds them into one chime.
 */
export const creationChimes = (clips: readonly Clip[]): SoundEvent[] => {
  const out: SoundEvent[] = []
  for (const clip of clips) {
    if (clip.duration <= 0) continue
    const done = new Map<Holon, number>()
    for (const track of clip.anim.tracks) {
      const owner = track.param.owner
      if (!(owner instanceof Holon) || track.param !== owner.creation) continue
      if (track.mode === "by" || track.values[track.values.length - 1] !== 1) continue
      const end = clip.start + track.relStop * clip.duration
      const root = owner.root
      done.set(root, Math.max(done.get(root) ?? -Infinity, end))
    }
    for (const time of done.values()) out.push({ time, kind: "chime", pitch: 1, gain: 1 })
  }
  return out
}

/**
 * The effect sounds of one dream, in time order. A plain data record, like
 * Narration: it can be serialized, diffed and inspected without a browser.
 */
export class Soundtrack {
  readonly events: readonly SoundEvent[]

  constructor(events: Iterable<SoundEvent>) {
    const sorted = [...events]
      .filter((e) => Number.isFinite(e.time) && e.time >= 0)
      .sort((a, b) => a.time - b.time || a.kind.localeCompare(b.kind) || a.pitch - b.pitch)
    const merged: SoundEvent[] = []
    for (const e of sorted) {
      let twin = -1
      for (let i = merged.length - 1; i >= 0 && e.time - merged[i]!.time < MERGE_SECONDS; i--) {
        if (merged[i]!.kind === e.kind && merged[i]!.pitch === e.pitch) twin = i
      }
      if (twin >= 0) {
        const m = merged[twin]!
        merged[twin] = { ...m, gain: Math.min(1, m.gain + e.gain * 0.25) }
      } else merged.push(e)
    }
    this.events = merged
  }

  get isEmpty(): boolean {
    return this.events.length === 0
  }

  /** The sounds the transport passes moving from t0 to t1: t0 < time ≤ t1. */
  between(t0: number, t1: number): SoundEvent[] {
    return this.events.filter((e) => e.time > t0 && e.time <= t1)
  }

  /** One line per sound, with its time — the human-checkable artifact. */
  transcript(): string {
    return this.events
      .map((e) => `[${e.time.toFixed(3)}] ${e.kind} ×${e.pitch.toFixed(3)} @${e.gain.toFixed(2)}`)
      .join("\n")
  }
}
