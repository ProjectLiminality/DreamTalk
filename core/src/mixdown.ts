/**
 * mixdown.ts — a song's whole audio track, rendered offline.
 *
 * The live players (src/render/narrator.ts, src/render/sfx.ts) make sound as
 * the playhead passes; an exported video has no playhead, so its track is
 * rendered here instead, sample by sample, under the same rules:
 *
 *   - **narration** — each line's audio placed at its `start`, at unity, and
 *     cut at the end of its slot (`duration`), exactly as the Narrator stops a
 *     line when t leaves it. A line with no audio is silence.
 *   - **effects** — each event rendered from the shared recipe
 *     (src/timbre.ts) at its exact time, through the same bus gain, and ducked
 *     under any line whose slot covers it — the live player's rule.
 *
 * The track is exactly as long as the song (`round(duration × rate)`
 * samples), so it muxes against `round(duration × fps)` frames without
 * either running over.
 *
 * Pure and deterministic: decoded PCM in, samples out, then a 16-bit WAV with
 * no dither and no timestamps — the same song gives the same bytes. Decoding
 * mp3 is the caller's job (scripts/mixdown.ts asks ffmpeg), which keeps this
 * file testable with no audio stack at all.
 */

import type { Utterance } from "./narration"
import type { Soundtrack } from "./sound"
import { MASTER_GAIN, renderPartial, TIMBRE, UNDER_VOICE } from "./timbre"

export const MIX_RATE = 48000

export interface MixInput {
  /** The song's length in seconds — the track's length. */
  duration: number
  /** Narration lines, each with its decoded mono PCM at `sampleRate` (or none). */
  lines: readonly { line: Utterance; pcm?: Float32Array }[]
  soundtrack: Soundtrack
  sampleRate?: number
}

/** Add `src` into `out` from sample `at`, scaled, clipped at both ends. */
const addInto = (out: Float32Array, src: Float32Array, at: number, limit = src.length, gain = 1): void => {
  const from = Math.max(0, -at)
  const to = Math.min(limit, src.length, out.length - at)
  for (let i = from; i < to; i++) out[at + i]! += src[i]! * gain
}

/** The mixed mono track, unclipped floats. */
export const mixdown = ({ duration, lines, soundtrack, sampleRate = MIX_RATE }: MixInput): Float32Array => {
  const out = new Float32Array(Math.max(0, Math.round(duration * sampleRate)))
  for (const { line, pcm } of lines) {
    if (!pcm) continue
    addInto(out, pcm, Math.round(line.start * sampleRate), Math.round(line.duration * sampleRate))
  }
  const speaking = (t: number) => lines.some(({ line }) => t >= line.start && t < line.start + line.duration)
  for (const e of soundtrack.events) {
    const timbre = TIMBRE[e.kind]
    const level = e.gain * (speaking(e.time) ? UNDER_VOICE : 1) * MASTER_GAIN
    const at = Math.round(e.time * sampleRate)
    for (const p of timbre.partials) {
      addInto(out, renderPartial(p, timbre.base, e.pitch, level, sampleRate), at)
    }
  }
  return out
}

/** A mono 16-bit PCM WAV, hard-clipped at full scale — byte-for-byte deterministic. */
export const encodeWav = (samples: Float32Array, sampleRate = MIX_RATE): Uint8Array => {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const v = new DataView(bytes.buffer)
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i))
  }
  ascii(0, "RIFF")
  v.setUint32(4, 36 + samples.length * 2, true)
  ascii(8, "WAVE")
  ascii(12, "fmt ")
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  ascii(36, "data")
  v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]!))
    v.setInt16(44 + i * 2, Math.round(x * 32767), true)
  }
  return bytes
}
