/**
 * say.ts — give a DreamSong its voice.
 *
 *   bun scripts/say.ts <scene>            # synthesize every line not cached
 *   bun scripts/say.ts <scene> --script   # print the transcript, synthesize nothing
 *   bun scripts/say.ts <scene> --voice Daniel
 *   bun scripts/say.ts --all              # every narrated scene
 *
 * Reads a scene's narration (the `say()` calls in its `unfold()`), synthesizes
 * whatever is not already cached, and writes mp3s into `.cache/voice/` under
 * the content-addressed key `src/voice.ts` defines. The daemon serves that
 * directory; the browser plays from it.
 *
 * BACKENDS, AND WHY THE DEFAULT IS THE LOCAL ONE
 *
 * The default is macOS `say`: it is already installed, it is free, it works
 * offline, and it needs no key. That matters more than voice quality here,
 * because the purpose of narration right now is the LOOP David described —
 * watch a narrated explainer of your own evolving vision, pause it, correct
 * it. A loop you can run a hundred times today beats a better voice you have
 * to configure first. The synthesis seam is one function (`synthesize`), so a
 * better narrator is a small, local change when one is wanted — the cache
 * keys carry the voice name, so several can coexist and be auditioned.
 *
 * Idempotent: a line already in the cache is skipped. Editing one sentence
 * re-synthesizes one sentence.
 */

import { mkdir, writeFile, access } from "node:fs/promises"
import { join } from "node:path"
import { scenes } from "../demo/scenes"
import { voiceCacheDir, voiceKey, DEFAULT_VOICE, VOICE_EXT } from "../src/voice"
import type { Utterance } from "../src/narration"

const CORE = join(import.meta.dir, "..")
const REPO = join(CORE, "..")

const args = process.argv.slice(2)
const scriptOnly = args.includes("--script")
const doAll = args.includes("--all")
const voiceIdx = args.indexOf("--voice")
/**
 * Which system voice speaks. "narrator" is the cache-key name for whatever
 * the default is; `--voice Daniel` both selects the system voice and changes
 * the key, so auditioning a voice never overwrites another's audio.
 */
const systemVoice = voiceIdx >= 0 ? args[voiceIdx + 1]! : "Samantha"
const voiceName = voiceIdx >= 0 ? systemVoice : DEFAULT_VOICE
const sceneKeys = doAll
  ? Object.keys(scenes)
  : [args.find((a) => !a.startsWith("--") && a !== systemVoice)].filter(Boolean as unknown as (s: string | undefined) => s is string)

if (sceneKeys.length === 0) {
  console.error("usage: bun scripts/say.ts <scene> [--script] [--voice <name>] | --all")
  process.exit(2)
}

/**
 * Text → mp3 bytes.
 *
 * THE SEAM. Everything above and below is backend-agnostic; swapping
 * narrators means changing this one function. macOS `say` writes aiff (its
 * default AIFF-C; passing --data-format makes it refuse the file outright),
 * so ffmpeg transcodes to mp3 — what the player expects, and far smaller.
 */
const synthesize = async (text: string): Promise<Uint8Array | undefined> => {
  const tmpAiff = join(REPO, ".cache", `say-${process.pid}.aiff`)
  const tmpMp3 = join(REPO, ".cache", `say-${process.pid}.${VOICE_EXT}`)
  try {
    const spoken = Bun.spawnSync(["say", "-v", systemVoice, "-o", tmpAiff, text])
    if (spoken.exitCode !== 0) {
      console.error(`  say failed: ${new TextDecoder().decode(spoken.stderr).trim()}`)
      return undefined
    }
    const conv = Bun.spawnSync(["ffmpeg", "-y", "-loglevel", "error", "-i", tmpAiff, "-b:a", "96k", tmpMp3])
    if (conv.exitCode !== 0) {
      console.error(`  ffmpeg failed: ${new TextDecoder().decode(conv.stderr).trim()}`)
      return undefined
    }
    return new Uint8Array(await Bun.file(tmpMp3).arrayBuffer())
  } finally {
    // Best-effort cleanup; a leftover temp file is not worth failing over.
    await Bun.$`rm -f ${tmpAiff} ${tmpMp3}`.quiet().nothrow()
  }
}

const exists = async (p: string): Promise<boolean> => {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

const dir = voiceCacheDir(REPO)
await mkdir(dir, { recursive: true })

let totalLines = 0
let synthesized = 0
let cached = 0

for (const key of sceneKeys) {
  const Ctor = scenes[key]
  if (!Ctor) {
    console.error(`unknown scene '${key}'`)
    process.exit(1)
  }
  const dream = new Ctor()
  const narration = dream.narration
  if (narration.isEmpty) {
    if (!doAll) console.log(`'${key}' has no narration (no say() calls).`)
    continue
  }

  console.log(`\n=== ${key} — ${narration.lines.length} lines, ${narration.spokenDuration.toFixed(1)}s spoken ===`)
  // Collisions are reported, never silently fixed: reflowing the animation
  // would make the score unreproducible, and clipping speech would eat
  // words. The author tightens the line or lengthens the beat.
  const overlaps = narration.overlaps()
  if (overlaps.length > 0) {
    console.log(`  ⚠ ${overlaps.length} line(s) would be spoken over each other:`)
    for (const o of overlaps) {
      console.log(
        `    [${o.previous.start.toFixed(2)}] "${o.previous.text.slice(0, 40)}…" overruns [${o.next.start.toFixed(2)}] by ${o.by.toFixed(2)}s`,
      )
    }
  }

  if (scriptOnly) {
    console.log(narration.transcript())
    continue
  }

  for (const line of narration.lines as Utterance[]) {
    totalLines++
    const k = voiceKey(line, voiceName)
    const out = join(dir, `${k}.${VOICE_EXT}`)
    if (await exists(out)) {
      cached++
      continue
    }
    process.stdout.write(`  [${line.start.toFixed(2)}] ${line.text.slice(0, 58)}${line.text.length > 58 ? "…" : ""} `)
    const bytes = await synthesize(line.text)
    if (!bytes) {
      console.log("— FAILED")
      continue
    }
    await writeFile(out, bytes)
    synthesized++
    console.log(`→ ${(bytes.length / 1024).toFixed(0)}kb`)
  }
}

if (!scriptOnly) {
  console.log(
    `\n${synthesized} synthesized, ${cached} already cached, ${totalLines} total → ${dir}`,
  )
}
