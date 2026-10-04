/**
 * mixdown.ts — write a registered scene's audio track as a WAV.
 *
 * Narration from the voice cache (.cache/voice, by voiceKey — the Narrator's
 * key) plus the effect sounds, mixed by src/mixdown.ts. No browser: the
 * Dream builds under Bun, and the score is all the audio needs. ffmpeg only
 * decodes the cached mp3s to mono float PCM.
 *
 * Usage:
 *   bun scripts/mixdown.ts <sceneKey> <out.wav>
 *
 * render-song.ts calls `songWav` itself, so a rendered song gets its track
 * without a second step.
 */

import { existsSync, writeFileSync } from "node:fs"
import { scenes } from "../demo/scenes"
import { encodeWav, mixdown, MIX_RATE } from "../src/mixdown"
import { voiceCacheDir, voiceKey, VOICE_EXT } from "../src/voice"

const REPO = new URL("../../", import.meta.url).pathname

/** An mp3 as mono float PCM at `rate`, or undefined if it is missing or undecodable. */
const decode = (path: string, rate: number): Float32Array | undefined => {
  if (!existsSync(path)) return undefined
  const r = Bun.spawnSync(
    ["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", String(rate), "-"],
    { stdout: "pipe", stderr: "pipe" },
  )
  if (r.exitCode !== 0) return undefined
  const buf = r.stdout
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
}

/** The scene's whole audio track, as WAV bytes — plus what went into it. */
export const songWav = (
  sceneKey: string,
): { wav: Uint8Array; duration: number; voiced: number; lines: number; events: number } => {
  const Ctor = scenes[sceneKey]
  if (!Ctor) throw new Error(`no scene '${sceneKey}'`)
  const dream = new Ctor()
  const dir = voiceCacheDir(REPO)
  const lines = dream.narration.lines.map((line) => ({
    line,
    pcm: decode(`${dir}/${voiceKey(line)}.${VOICE_EXT}`, MIX_RATE),
  }))
  const soundtrack = dream.soundtrack
  const samples = mixdown({ duration: dream.duration, lines, soundtrack })
  return {
    wav: encodeWav(samples),
    duration: dream.duration,
    voiced: lines.filter((l) => l.pcm).length,
    lines: lines.length,
    events: soundtrack.events.length,
  }
}

if (import.meta.main) {
  const [sceneKey, out] = process.argv.slice(2)
  if (!sceneKey || !out) {
    console.error("usage: bun scripts/mixdown.ts <sceneKey> <out.wav>")
    process.exit(2)
  }
  const r = songWav(sceneKey)
  writeFileSync(out, r.wav)
  console.log(
    `${sceneKey}: ${r.duration.toFixed(2)}s · narration ${r.voiced}/${r.lines} lines voiced · ` +
      `${r.events} effect sound(s) → ${out}`,
  )
}
