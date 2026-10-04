/**
 * The offline mixdown (src/mixdown.ts) and the shared recipe it renders
 * (src/timbre.ts) — an exported song's audio track.
 *
 * What a movie leans on: the track is exactly the song's length; a line sits
 * at its start and stops at its slot's end, as the Narrator stops it; an
 * effect begins on its own sample; effects duck under narration by the live
 * player's factor; and the same song gives the same bytes.
 */

import { describe, expect, test } from "bun:test"
import { encodeWav, mixdown } from "../src/mixdown"
import { Soundtrack, type SoundEvent } from "../src/sound"
import { MASTER_GAIN, noiseSamples, renderPartial, SILENT, TIMBRE, UNDER_VOICE } from "../src/timbre"
import type { Utterance } from "../src/narration"
import { RayCasterDemoDream } from "../demo/RayCasterDemo"

const RATE = 8000
const line = (start: number, duration: number): Utterance => ({ text: "x", start, duration })
const ping = (time: number, gain = 1): SoundEvent => ({ time, kind: "ping", pitch: 1, gain })
const firstNonZero = (x: Float32Array, from = 0) => {
  for (let i = from; i < x.length; i++) if (x[i] !== 0) return i
  return -1
}

describe("mixdown — placement", () => {
  test("the track is exactly the song's length", () => {
    const out = mixdown({ duration: 2.5, lines: [], soundtrack: new Soundtrack([]), sampleRate: RATE })
    expect(out.length).toBe(2.5 * RATE)
  })

  test("a line sits at its start, at unity, and is cut at its slot's end", () => {
    const pcm = new Float32Array(RATE).fill(0.5) // 1s of audio in a 0.25s slot
    const out = mixdown({
      duration: 2,
      lines: [{ line: line(0.5, 0.25), pcm }],
      soundtrack: new Soundtrack([]),
      sampleRate: RATE,
    })
    expect(firstNonZero(out)).toBe(0.5 * RATE)
    expect(out[0.5 * RATE]).toBe(0.5)
    expect(out[0.75 * RATE - 1]).toBe(0.5)
    expect(out[0.75 * RATE]).toBe(0)
  })

  test("a line past the end is clipped to the track; a missing recording is silence", () => {
    const out = mixdown({
      duration: 1,
      lines: [{ line: line(0.9, 1), pcm: new Float32Array(RATE).fill(0.1) }, { line: line(0, 0.5) }],
      soundtrack: new Soundtrack([]),
      sampleRate: RATE,
    })
    expect(out.length).toBe(RATE)
    expect(firstNonZero(out)).toBe(Math.round(0.9 * RATE))
  })

  test("each effect begins on its own sample (a sine's first sample is zero)", () => {
    const times = [0.1234, 0.6, 1.3]
    const out = mixdown({ duration: 2, lines: [], soundtrack: new Soundtrack(times.map((t) => ping(t))), sampleRate: RATE })
    // Isolate each event by subtracting the mix without it.
    for (const t of times) {
      const without = mixdown({
        duration: 2,
        lines: [],
        soundtrack: new Soundtrack(times.filter((x) => x !== t).map((x) => ping(x))),
        sampleRate: RATE,
      })
      const diff = out.map((v, i) => v - without[i]!)
      expect(firstNonZero(diff)).toBe(Math.round(t * RATE) + 1)
    }
  })

  test("effects duck under a speaking line by the live player's factor", () => {
    const at = (lines: { line: Utterance; pcm?: Float32Array }[]) =>
      mixdown({ duration: 1, lines, soundtrack: new Soundtrack([ping(0.2)]), sampleRate: RATE })
    const clear = at([])
    const under = at([{ line: line(0, 0.5) }]) // speaking, but no audio: only the ducking shows
    // Inside the attack, where the envelope is linear in level. (The decay
    // falls to an ABSOLUTE silence, so its shape depends on level — exactly
    // as WebAudio's exponentialRamp does live.)
    const i = Math.round(0.2 * RATE) + 10
    expect(under[i]! / clear[i]!).toBeCloseTo(UNDER_VOICE, 6)
  })

  test("the bus gain matches the live player's", () => {
    const out = mixdown({ duration: 1, lines: [], soundtrack: new Soundtrack([ping(0)]), sampleRate: RATE })
    const solo = TIMBRE.ping.partials.map((p) => renderPartial(p, TIMBRE.ping.base, 1, MASTER_GAIN, RATE))
    expect(out[50]).toBeCloseTo(solo.reduce((s, x) => s + (x[50] ?? 0), 0), 6)
  })
})

describe("timbre — the shared recipe", () => {
  test("a tone rises to its peak over the attack and decays to silence", () => {
    const p = { type: "tone", ratio: 1, peak: 0.5, attack: 0.01, decay: 0.2 } as const
    const x = renderPartial(p, 100, 1, 1, RATE) // a slow sine, so the envelope reads cleanly
    expect(x.length).toBe(Math.ceil((0.01 + 0.2) * RATE))
    const peak = Math.max(...x.map(Math.abs))
    expect(peak).toBeLessThanOrEqual(0.5)
    expect(peak).toBeGreaterThan(0.4)
    expect(Math.abs(x[x.length - 1]!)).toBeLessThan(SILENT * 2)
  })

  test("noise is seeded: the same samples every time, in [-1, 1]", () => {
    const a = noiseSamples(1000)
    expect(a).toEqual(noiseSamples(1000))
    expect(Math.max(...a)).toBeLessThanOrEqual(1)
    expect(Math.min(...a)).toBeGreaterThanOrEqual(-1)
  })

  test("a whoosh renders, finite and bounded", () => {
    const w = TIMBRE.whoosh
    const x = renderPartial(w.partials[0]!, w.base, 1, 1, 48000)
    expect(x.every(Number.isFinite)).toBe(true)
    expect(Math.max(...x.map(Math.abs))).toBeGreaterThan(0.01)
    expect(Math.max(...x.map(Math.abs))).toBeLessThan(1)
  })
})

describe("encodeWav", () => {
  test("a valid mono 16-bit header, clipped samples", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2, -2, 0.5]), 48000)
    const v = new DataView(wav.buffer)
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF")
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE")
    expect(v.getUint16(22, true)).toBe(1)
    expect(v.getUint32(24, true)).toBe(48000)
    expect(v.getUint32(40, true)).toBe(12)
    expect([0, 1, 2, 3, 4, 5].map((i) => v.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32767, 32767, -32767, 16384])
  })

  test("the same song gives the same bytes", () => {
    const render = () => {
      const d = new RayCasterDemoDream()
      return encodeWav(mixdown({ duration: d.duration, lines: [], soundtrack: d.soundtrack }))
    }
    const a = render()
    expect(a.length).toBe(44 + 6 * 48000 * 2)
    expect(Buffer.from(a).equals(Buffer.from(render()))).toBe(true)
  })
})
