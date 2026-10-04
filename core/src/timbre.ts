/**
 * timbre.ts — what each DreamTalk sound IS, written once.
 *
 * Two things play the effect sounds: the live player (src/render/sfx.ts),
 * which builds WebAudio nodes as the playhead passes an event, and the
 * mixdown (src/mixdown.ts), which renders the same events sample by sample
 * into an exported song's audio track. If each held its own copy of the
 * recipe, the movie would drift from the editor the first time anyone tuned
 * a ping. So the recipe is DATA, here, and both read it.
 *
 * A sound is a few partials, each either
 *
 *   - a **tone** — a sine at `ratio` × the kind's base note, rising linearly
 *     to `peak` over `attack` and falling exponentially to silence (1e-4)
 *     over `decay` — exactly WebAudio's linearRamp + exponentialRamp; or
 *   - **noise** — seeded white noise through a band-pass (RBJ cookbook, the
 *     same filter WebAudio's BiquadFilter "bandpass" is) whose centre sweeps
 *     exponentially `from` → `to` over `span`, under a linear rise-and-fall.
 *
 * This module is pure: no AudioContext, no clock. `renderPartial` is the
 * offline half; sfx.ts is the live half of the same equations.
 */

import type { SoundKind } from "./sound"

export interface TonePartial {
  readonly type: "tone"
  readonly ratio: number
  readonly peak: number
  readonly attack: number
  readonly decay: number
}

export interface NoisePartial {
  readonly type: "noise"
  /** Band-pass centre, Hz, at the start and end of the sweep (× pitch). */
  readonly from: number
  readonly to: number
  readonly q: number
  readonly span: number
  readonly peak: number
  /** Where the envelope peaks, as a share of `span`. */
  readonly rise: number
}

export type SoundPartial = TonePartial | NoisePartial

export interface Timbre {
  /** The base note, Hz — a SoundEvent's `pitch` multiplies it. */
  readonly base: number
  readonly partials: readonly SoundPartial[]
}

export const TIMBRE: Record<SoundKind, Timbre> = {
  // Impact: bright, short, bell-like (2.76 is a struck bar's partial).
  ping: {
    base: 660,
    partials: [
      { type: "tone", ratio: 1, peak: 0.5, attack: 0.004, decay: 0.45 },
      { type: "tone", ratio: 2.76, peak: 0.12, attack: 0.002, decay: 0.18 },
    ],
  },
  // Completion: soft, open, a fifth, lingering.
  chime: {
    base: 523.25,
    partials: [
      { type: "tone", ratio: 1, peak: 0.32, attack: 0.02, decay: 1.6 },
      { type: "tone", ratio: 1.5, peak: 0.2, attack: 0.03, decay: 1.3 },
      { type: "tone", ratio: 2, peak: 0.06, attack: 0.02, decay: 0.9 },
    ],
  },
  // Motion: air moving past — noise through a rising band-pass.
  whoosh: {
    base: 1,
    partials: [{ type: "noise", from: 350, to: 2200, q: 1.2, span: 0.5, peak: 0.5, rise: 0.45 }],
  },
}

/** The whole effects bus — well under a narration clip at unity. */
export const MASTER_GAIN = 0.35

/** While a line is being spoken, effects step further back. */
export const UNDER_VOICE = 0.55

/** Where an exponential decay is considered silent (WebAudio needs a non-zero target). */
export const SILENT = 1e-4

/** How long the noise source is, in seconds — longer than any noise partial. */
export const NOISE_SECONDS = 0.55

/**
 * The noise, seeded: the same whoosh every time, live and offline. xorshift32
 * — tiny, fast, and identical in every JS engine.
 */
export const noiseSamples = (n: number): Float32Array => {
  const out = new Float32Array(n)
  let s = 0x2545f491
  for (let i = 0; i < n; i++) {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    out[i] = ((s >>> 0) / 0xffffffff) * 2 - 1
  }
  return out
}

/** How long a partial sounds, in seconds. */
export const partialSeconds = (p: SoundPartial): number =>
  p.type === "tone" ? p.attack + p.decay : p.span

/**
 * One partial of one sound, rendered offline at `sampleRate`, scaled by
 * `level` (the event's gain, ducking and the bus already folded in).
 * Deterministic: the same arguments give the same samples.
 */
export const renderPartial = (
  p: SoundPartial,
  base: number,
  pitch: number,
  level: number,
  sampleRate: number,
): Float32Array => {
  const n = Math.ceil(partialSeconds(p) * sampleRate)
  const out = new Float32Array(n)
  if (p.type === "tone") {
    const peak = p.peak * level
    if (!(peak > 0)) return out
    const w = (2 * Math.PI * base * pitch * p.ratio) / sampleRate
    const fall = SILENT / peak
    for (let i = 0; i < n; i++) {
      const tau = i / sampleRate
      const env = tau < p.attack ? (peak * tau) / p.attack : peak * fall ** ((tau - p.attack) / p.decay)
      out[i] = env * Math.sin(w * i)
    }
    return out
  }
  const noise = noiseSamples(Math.ceil(NOISE_SECONDS * sampleRate))
  const peak = p.peak * level
  const top = p.rise * p.span
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < n; i++) {
    const tau = i / sampleRate
    const f = p.from * pitch * ((p.to * pitch) / (p.from * pitch)) ** (tau / p.span)
    const w0 = (2 * Math.PI * Math.min(f, sampleRate / 2 - 1)) / sampleRate
    const alpha = Math.sin(w0) / (2 * p.q)
    const a0 = 1 + alpha
    const x0 = noise[i] ?? 0
    const y0 = (alpha * x0 - alpha * x2 + 2 * Math.cos(w0) * y1 - (1 - alpha) * y2) / a0
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
    const env = tau < top ? (peak * tau) / top : (peak * (p.span - tau)) / (p.span - top)
    out[i] = Math.max(0, env) * y0
  }
  return out
}
