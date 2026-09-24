/**
 * import-voice.ts — put a REAL recording into the voice cache.
 *
 *   bun scripts/import-voice.ts "<the exact line>" <audio-file> [--voice <name>]
 *
 * `scripts/say.ts` synthesizes narration. This is its counterpart for audio
 * that already exists and should never be synthesized: someone's actual
 * voice, saying the thing they actually said.
 *
 * The first case is Vitalik Buterin's line in the Liminal Consulting Web3
 * video, whose recording lives at
 * `~/RealDealVault/LiminalConsultingWeb3/Video/Audio/VitalikQuote.mp3`.
 * David asked the Quote holon to "play the audio of something someone said
 * while writing out the text", and a quotation is exactly the case where a
 * synthesized voice would be wrong — the point is that a specific person
 * said it.
 *
 * HOW IT FITS
 *
 * The cache is content-addressed on (text, voice), so a recording is stored
 * under the key its TEXT would hash to. Nothing downstream needs to know the
 * difference: the player asks the cache for the line's key and gets Vitalik,
 * exactly as it would have got the synthesized narrator. That is the whole
 * benefit of having made the cache the seam — real and synthetic audio are
 * the same kind of thing to everyone above it.
 *
 * `--voice` names WHOSE voice it is, and it must match what the scene asks
 * for. Defaults to the speaker-agnostic default so the common case is one
 * argument shorter.
 */

import { mkdir, writeFile, access } from "node:fs/promises"
import { join } from "node:path"
import { DEFAULT_VOICE, VOICE_EXT, voiceCacheDir } from "../src/voice"
import { utteranceKey } from "../src/narration"

const CORE = join(import.meta.dir, "..")
const REPO = join(CORE, "..")

const args = process.argv.slice(2)
const voiceIdx = args.indexOf("--voice")
const voice = voiceIdx >= 0 ? args[voiceIdx + 1]! : DEFAULT_VOICE
const positional = args.filter((a, i) => {
  if (a === "--voice") return false
  if (voiceIdx >= 0 && i === voiceIdx + 1) return false
  return !a.startsWith("--")
})
const [text, source] = positional

if (!text || !source) {
  console.error('usage: bun scripts/import-voice.ts "<line>" <audio-file> [--voice <name>]')
  process.exit(2)
}

const file = Bun.file(source)
if (!(await file.exists())) {
  console.error(`no such audio file: ${source}`)
  process.exit(1)
}

// mp3 is what the player decodes; anything else is transcoded on the way in,
// so a caller never has to care what format their recording happened to be.
const dir = voiceCacheDir(REPO)
await mkdir(dir, { recursive: true })
const key = utteranceKey(text, voice)
const out = join(dir, `${key}.${VOICE_EXT}`)

let bytes: Uint8Array
if (source.toLowerCase().endsWith(`.${VOICE_EXT}`)) {
  bytes = new Uint8Array(await file.arrayBuffer())
} else {
  const tmp = join(REPO, ".cache", `import-${process.pid}.${VOICE_EXT}`)
  const conv = Bun.spawnSync(["ffmpeg", "-y", "-loglevel", "error", "-i", source, "-b:a", "96k", tmp])
  if (conv.exitCode !== 0) {
    console.error(`ffmpeg failed: ${new TextDecoder().decode(conv.stderr).trim()}`)
    process.exit(1)
  }
  bytes = new Uint8Array(await Bun.file(tmp).arrayBuffer())
  await Bun.$`rm -f ${tmp}`.quiet().nothrow()
}

const existed = await access(out).then(
  () => true,
  () => false,
)
await writeFile(out, bytes)

// The duration is reported because it is the one number the author has to
// reconcile by hand: the score's slot for this line is ESTIMATED from the
// text (src/narration.ts), and a real recording has whatever length it has.
const probe = Bun.spawnSync([
  "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out,
])
const seconds = parseFloat(new TextDecoder().decode(probe.stdout).trim())

console.log(`${existed ? "replaced" : "stored"} ${key}.${VOICE_EXT} (${(bytes.length / 1024).toFixed(0)}kb${Number.isFinite(seconds) ? `, ${seconds.toFixed(2)}s` : ""})`)
console.log(`  voice: ${voice}`)
console.log(`  text:  "${text.length > 70 ? text.slice(0, 70) + "…" : text}"`)
if (Number.isFinite(seconds)) {
  const { spokenSeconds } = await import("../src/narration")
  const est = spokenSeconds(text)
  console.log(`  the score allows ${est.toFixed(2)}s for this line; the recording is ${seconds.toFixed(2)}s`)
  if (seconds > est) {
    console.log(`  ⚠ the recording OVERRUNS its slot by ${(seconds - est).toFixed(2)}s — lengthen the beat.`)
  }
}
