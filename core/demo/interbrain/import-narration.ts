/**
 * import-narration.ts — cut every narration line out of the film's own
 * soundtrack into the voice cache (see narration.ts).
 *
 *   bun demo/interbrain/import-narration.ts [--force]
 *
 * Needs refs/interbrain/audio.m4a (gitignored; made by the recon from the
 * YouTube download). Idempotent: lines already cached are skipped.
 */

import { mkdir, access } from "node:fs/promises"
import { join } from "node:path"
import { VOICE_EXT, voiceCacheDir } from "../../src/voice"
import { utteranceKey } from "../../src/narration"
import { NARRATION, NARRATION_VOICE } from "./narration"

const REPO = join(import.meta.dir, "../../..")
const AUDIO = join(REPO, "refs/interbrain/audio.m4a")
const force = process.argv.includes("--force")
const dir = voiceCacheDir(REPO)
await mkdir(dir, { recursive: true })

let stored = 0
for (const [start, duration, text] of NARRATION) {
  const out = join(dir, `${utteranceKey(text, NARRATION_VOICE)}.${VOICE_EXT}`)
  if (!force && (await access(out).then(() => true, () => false))) continue
  const cut = Bun.spawnSync([
    "ffmpeg", "-y", "-loglevel", "error", "-ss", String(start), "-t", String(duration),
    "-i", AUDIO, "-ac", "1", "-b:a", "96k", out,
  ])
  if (cut.exitCode !== 0) {
    console.error(`ffmpeg failed at ${start}s: ${new TextDecoder().decode(cut.stderr).trim()}`)
    process.exit(1)
  }
  stored++
}
console.log(`narration: ${stored} line(s) stored, ${NARRATION.length - stored} already cached → ${dir}`)
