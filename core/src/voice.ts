/**
 * voice.ts — where a line of narration becomes sound.
 *
 * `src/narration.ts` is pure: it knows what is said and when, and nothing
 * about audio. This file is the other half — it turns an utterance into bytes
 * and keeps them. The split is what lets a DreamSong be authored, scored,
 * scrubbed and gauntlet-scored with no voice backend present at all.
 *
 * MODELLED ON THE BAKE CACHE, ON PURPOSE
 *
 * Synthesis is slow, costs money, and its result never changes for a given
 * (text, voice). That is exactly the bake cache's problem, so this is exactly
 * the bake cache's answer (src/bakecache.ts):
 *
 *   - **content-addressed** — the key is a hash of text + voice, so editing
 *     one sentence re-synthesizes one sentence, not a song;
 *   - **two backends** — `fs` for scripts and tests, `http` for the browser,
 *     which has no filesystem and borrows the daemon's;
 *   - **every failure mode is silence.** A 404, a daemon that is not running,
 *     a missing API key, a machine that has never synthesized anything: each
 *     returns undefined, and the scene plays without narration. A DreamSong
 *     must never fail to render because it could not speak.
 *
 * WHY THE VOICE IS NAMED IN THE KEY
 *
 * Changing voice changes the sound, so it must change the key, or a scene
 * would keep playing the old narrator forever. It also means several voices
 * can coexist in one cache — which is what makes it cheap to audition one.
 */

import { utteranceKey, type Utterance } from "./narration"

/** Where the bytes for one utterance live, by key. Both backends implement it. */
export interface VoiceCache {
  /** The audio for `key`, or undefined if it has never been synthesized. */
  get(key: string): Promise<ArrayBuffer | undefined>
  /** Store audio for `key`. Failure is silent — a cache is an accelerator. */
  put(key: string, bytes: ArrayBuffer): Promise<void>
}

/**
 * The default narrator.
 *
 * A name, not a model id: which engine produces it is `scripts/say.ts`'s
 * business, and a scene should not have to be edited because a provider was
 * swapped. Scenes that want a different narrator pass their own.
 */
export const DEFAULT_VOICE = "narrator"

/**
 * The cache key for an utterance — the one place this is derived.
 *
 * A line's OWN voice wins over the caller's default, so a quotation read by
 * the person who said it keeps its recording no matter what narrator the
 * scene is otherwise using.
 */
export const voiceKey = (u: Utterance, fallback = DEFAULT_VOICE): string =>
  utteranceKey(u.text, u.voice ?? fallback)

/** Audio files are mp3: small, universally decodable, good enough for speech. */
export const VOICE_EXT = "mp3"

/**
 * The repo's voice directory, given a repo root — one place, so the daemon,
 * the scripts and the tests cannot drift apart on it. Gitignored and
 * disposable, exactly like `.cache/bakes`: deleting it costs a re-synthesis
 * and nothing else.
 */
export const voiceCacheDir = (repoRoot: string): string =>
  `${repoRoot.replace(/\/$/, "")}/.cache/voice`

/** Keys are our own hex; nothing else may become a path segment. */
const VALID_KEY = /^[0-9a-f]{16}$/
export const isValidVoiceKey = (key: string): boolean => VALID_KEY.test(key)

/**
 * Cache over the daemon's `/api/voice/<key>` — for the browser.
 *
 * Mirrors `httpBakeCache` line for line, including its silence: without the
 * route (a bare `serve.ts`, say) every get 404s and every scene simply plays
 * without narration.
 */
export const httpVoiceCache = (base = "/api/voice"): VoiceCache => ({
  async get(key) {
    if (!isValidVoiceKey(key)) return undefined
    try {
      const res = await fetch(`${base}/${key}.${VOICE_EXT}`)
      if (!res.ok) return undefined
      return await res.arrayBuffer()
    } catch {
      return undefined
    }
  },
  async put(key, bytes) {
    if (!isValidVoiceKey(key)) return
    try {
      await fetch(`${base}/${key}.${VOICE_EXT}`, { method: "PUT", body: bytes })
    } catch {
      // An accelerator that cannot write is still an accelerator.
    }
  },
})
