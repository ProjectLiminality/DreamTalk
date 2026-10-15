/**
 * Live sessions — a walk through a song's state space, recorded, becoming
 * part of the song (David, 2026-10-15: "everything is recorded, so this
 * creates the basis for a DreamSong … a scripted DreamSong is one linear
 * path through the high-dimensional space of the state machine, accompanied
 * with the spoken word; you can also explore this in real time and trace a
 * linear path").
 *
 * ONE FOLDER PER SESSION, shared by every recorder (the walk's events, the
 * viewer camera, the voice, the hands): `refs/sessions/<id>/` — refs/ is
 * gitignored, so raw human input stays on this machine.
 *
 *   session.json   { version, id, scene, sceneFile, startedAt, heldAt,
 *                    duration, clocks, tracks: { fires, camera, focus,
 *                    transcript }, files: { audio?, hands? } }
 *   voice.webm     the microphone, from t = 0 of the session clock
 *   hands.jsonl    hand frames (the hands recorder), `{ t, … }` per line
 *
 * Every time is seconds since the session started — one clock for all.
 *
 * WRITING IT INTO THE SONG (`appendSession` op, scripts/ops.ts): the walk
 * becomes a passage inserted after the clip the song was held in, cut into
 * segments at every fire, every spoken line and every camera keyframe:
 *
 *   this.say("…", { voice: "live", duration: 2.1 })
 *   this.play(together(this.map.time.by(1.4, { easing: "linear" }),
 *                      [this.map.stateAxis("grain").to("categorised"), 0, 1],
 *                      this.observer.phi.to(0.31, { easing: "linear" })), 1.4)
 *
 * — the idiom ⌘K writes, at the times they happened. Each spoken line's
 * audio is cut from voice.webm into the voice cache under the line's own
 * key, so the player speaks the recording, not a synthesis. A fire the next
 * event interrupted lands at that event (the song is a sequence of beats; a
 * live retarget mid-flight is the one thing it does not reproduce).
 */

import { existsSync } from "node:fs"
import { appendFile, cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { utteranceKey } from "../src/narration"
import { VOICE_EXT, voiceCacheDir } from "../src/voice"

export interface SessionFire {
  t: number
  axis: string
  from: string
  to: string
  duration: number
  /** The axis owner as the scene's code names it (`this.map`), or null for a scene axis. */
  holon: string | null
  /** Where the axis's params stood as it fired (`this.map.grain` → 0.42). */
  pose?: Record<string, number>
}

export interface SessionSummon {
  t: number
  className: string
  dismiss?: boolean
  at?: { x: number; y: number; z: number }
  scale?: number
}

export interface CameraKey {
  t: number
  /** The observer's effective readings — only the ones that ever change matter. */
  [param: string]: number
}

export interface TranscriptLine {
  t0: number
  t1: number
  text: string
}

export interface Session {
  version: 1
  id: string
  scene: string
  sceneFile?: string
  startedAt: string
  /** The song time the world was held at. */
  heldAt: number
  duration: number
  /** Clock params the song runs (`this.map.time`) — they keep running through the passage. */
  clocks?: string[]
  /** The AUTHORED camera when the session began — where the passage hands the view back. */
  cameraBase?: Record<string, number>
  tracks: {
    fires: SessionFire[]
    camera?: CameraKey[]
    focus?: { t: number; holon: string | null }[]
    transcript?: TranscriptLine[]
    summons?: SessionSummon[]
  }
  files?: { audio?: string; hands?: string }
}

/** `2026-10-15T14-03-22` (+ an optional `-tag`) — nothing else names a session. */
const SESSION_ID = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(-[a-z0-9]+)?$/
const SESSION_FILE = /^[a-z0-9][a-z0-9._-]{0,63}$/

export const isSessionId = (id: string): boolean => SESSION_ID.test(id)

export const sessionsRoot = (repoRoot: string): string => join(repoRoot, "refs", "sessions")

export const sessionDir = (repoRoot: string, id: string): string | undefined =>
  isSessionId(id) ? join(sessionsRoot(repoRoot), id) : undefined

/** `GET|PUT /api/session/<id>/<file>` (PUT `?append=1` appends — hand frames stream in). */
export const sessionFileResponse = async (req: Request, repoRoot: string, rest: string): Promise<Response> => {
  const [id, file, ...more] = rest.split("/")
  const dir = id ? sessionDir(repoRoot, id) : undefined
  if (!dir || !file || more.length || !SESSION_FILE.test(file)) return new Response("bad session path", { status: 400 })
  const path = join(dir, file)
  if (req.method === "PUT") {
    await mkdir(dir, { recursive: true })
    const bytes = new Uint8Array(await req.arrayBuffer())
    if (new URL(req.url).searchParams.get("append") === "1") await appendFile(path, bytes)
    else await writeFile(path, bytes)
    // session.json names every track in the folder; hands.jsonl may arrive before or after it.
    const json = join(dir, "session.json")
    if ((file === "session.json" || file === "hands.jsonl") && existsSync(json)) {
      try {
        const s = JSON.parse(await readFile(json, "utf8")) as Session
        const next = withTracks(dir, s)
        if (next !== s) await writeFile(json, JSON.stringify(next, null, 2))
      } catch {}
    }
    return Response.json({ ok: true, bytes: bytes.length })
  }
  const blob = Bun.file(path)
  if (!(await blob.exists())) return new Response("not found", { status: 404 })
  return new Response(blob, { headers: { "Cache-Control": "no-store" } })
}

/** Files other recorders put in the folder (hands.jsonl), listed in `files` — their last append may follow stop(). */
const withTracks = (dir: string, s: Session): Session =>
  existsSync(join(dir, "hands.jsonl")) && !s.files?.hands ? { ...s, files: { ...s.files, hands: "hands.jsonl" } } : s

export const readSession = async (repoRoot: string, id: string): Promise<Session> => {
  const dir = sessionDir(repoRoot, id)
  if (!dir) throw new Error(`bad session id '${id}'`)
  const s = JSON.parse(await readFile(join(dir, "session.json"), "utf8")) as Session
  if (s.version !== 1 || s.id !== id) throw new Error("not a version-1 session")
  return withTracks(dir, s)
}

// --- The passage --------------------------------------------------------------------

const num = (n: number): string => String(Math.round(n * 1000) / 1000)
const CLASS = /^[A-Z][A-Za-z0-9]*$/
/** The draw-on (and draw-off) a summoned symbol is given in the song, seconds. */
const SUMMON_SECONDS = 1.2
/** How long the view takes to come home after a walk, seconds. */
const CAMERA_HOME = 1

/** One beat: a wait, one anim, or several together. */
const beat = (items: string[], dt: number): string =>
  items.length === 0
    ? `this.wait(${num(dt)})`
    : items.length === 1
      ? `this.play(${items[0]}, ${num(dt)})`
      : ["this.play(", "  together(", ...items.map((it) => `    ${it},`), "  ),", `  ${num(dt)},`, ")"].join("\n")

/** The classes a passage constructs (summoned symbols) — the imports it needs. */
export const passageClasses = (s: Session): string[] => [
  ...new Set((s.tracks.summons ?? []).filter((m) => !m.dismiss && CLASS.test(m.className)).map((m) => m.className)),
]
const PATH = /^this(\.[A-Za-z_$][A-Za-z0-9_$]*(\[\d+\])?)*$/
/** The camera readings a passage may author, and how close counts as "the same". */
const CAMERA: Record<string, number> = { phi: 0.01, theta: 0.01, radius: 1, zoom: 0.003, x: 1, y: 1, z: 1 }
/** The shortest beat a camera keyframe may cut — denser motion is decimated. */
const CAMERA_STEP = 0.4

/** The camera at time t, linearly between its samples. */
const cameraAt = (keys: readonly CameraKey[], t: number): Record<string, number> => {
  if (keys.length === 0) return {}
  if (t <= keys[0]!.t) return { ...keys[0]! }
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!
    const b = keys[i]!
    if (t <= b.t) {
      const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1
      const out: Record<string, number> = {}
      for (const k of Object.keys(CAMERA)) if (k in a && k in b) out[k] = a[k]! + (b[k]! - a[k]!) * u
      return out
    }
  }
  return { ...keys[keys.length - 1]! }
}

const moved = (a: Record<string, number>, b: Record<string, number>): boolean =>
  Object.entries(CAMERA).some(([k, eps]) => k in a && k in b && Math.abs(a[k]! - b[k]!) > eps)

/** Camera keyframe times: whenever the view has moved enough, at most every CAMERA_STEP. */
export const cameraBeats = (keys: readonly CameraKey[]): number[] => {
  const out: number[] = []
  let last = keys[0] ? cameraAt(keys, keys[0].t) : undefined
  let lastT = keys[0]?.t ?? 0
  for (const k of keys) {
    if (!last || k.t - lastT < CAMERA_STEP) continue
    const here = cameraAt(keys, k.t)
    if (moved(last, here)) {
      out.push(k.t)
      last = here
      lastT = k.t
    }
  }
  return out
}

export interface PassageOpts {
  /** Narration voice for the spoken lines. */
  voice?: string
  /** Which camera readings may be written (an observer a rig binds cannot be). */
  camera?: readonly string[]
}

/**
 * The session as statements for unfold() — pure, so it can be read and
 * tested without a daemon. Throws on a path that is not a `this.*` reference.
 */
export const passageOf = (s: Session, opts: PassageOpts = {}): string => {
  const voice = opts.voice ?? "live"
  const T = Math.max(0, s.duration)
  const fires = [...s.tracks.fires].filter((f) => f.t >= 0 && f.t < T).sort((a, b) => a.t - b.t)
  for (const f of fires) if (f.holon !== null && !PATH.test(f.holon)) throw new Error(`fire owner '${f.holon}' is not a this.* path`)
  for (const c of s.clocks ?? []) if (!PATH.test(c)) throw new Error(`clock '${c}' is not a this.* path`)
  const lines = [...(s.tracks.transcript ?? [])].filter((l) => l.text.trim() && l.t0 < T).sort((a, b) => a.t0 - b.t0)
  const keys = [...(s.tracks.camera ?? [])].sort((a, b) => a.t - b.t)
  const camParams = (opts.camera ?? Object.keys(CAMERA)).filter((k) => k in CAMERA && keys.some((key) => k in key))

  // Cuts at every fire — the beats a song is made of. A spoken line cuts too,
  // unless a transition is in flight then (a cut would land it early): it is
  // then said at the start of the beat it falls in. The camera never cuts —
  // its keyframes ride inside the beats as windowed linear moves.
  const inFlight = (t: number) => fires.some((f) => f.t < t && t < f.t + f.duration)
  const summons = [...(s.tracks.summons ?? [])].filter((m) => m.t >= 0 && m.t < T).sort((a, b) => a.t - b.t)
  for (const m of summons) if (!CLASS.test(m.className)) throw new Error(`summoned '${m.className}' is not a class name`)
  const cuts = new Set<number>([0, T])
  for (const f of fires) cuts.add(f.t)
  for (const m of summons) cuts.add(m.t)
  for (const l of lines) if (!inFlight(Math.max(0, l.t0))) cuts.add(Math.max(0, l.t0))
  const r3 = (t: number) => Math.round(t * 1000) / 1000
  const times = [...cuts].map(r3).filter((t, i, a) => a.indexOf(t) === i).sort((a, b) => a - b)
  const beats = cameraBeats(keys)

  const out: string[] = [
    `// Recorded live — refs/sessions/${s.id} (${num(T)} s from t = ${num(s.heldAt)}): a walk through the state space.`,
  ]
  /** Each summoned symbol's local name, per class, in order — a dismiss takes the last one standing. */
  const standing = new Map<string, string[]>()
  let summonCount = 0
  for (let i = 0; i + 1 < times.length; i++) {
    const a = times[i]!
    const b = times[i + 1]!
    const dt = b - a
    if (dt <= 0) continue
    for (const l of lines) {
      const t0 = r3(Math.max(0, l.t0))
      if (t0 >= a && (t0 < b || (b === T && t0 <= b)))
        out.push(`this.say(${JSON.stringify(l.text.trim())}, { voice: ${JSON.stringify(voice)}, duration: ${num(Math.max(0.1, l.t1 - l.t0))} })`)
    }
    const items: string[] = []
    for (const c of s.clocks ?? []) items.push(`${c}.by(${num(dt)}, { easing: "linear" })`)
    // A fire that interrupts one still in flight starts from where the walk
    // actually was — not from the interrupted one's goal, which is where a
    // song's next segment would otherwise begin.
    const restart: string[] = []
    for (const f of fires) {
      if (r3(f.t) !== a || !f.pose) continue
      const interrupted = fires.some(
        (g) => g !== f && g.t < f.t && f.t < g.t + g.duration && Object.keys(g.pose ?? {}).some((k) => k in f.pose!),
      )
      if (!interrupted) continue
      for (const [path, v] of Object.entries(f.pose)) {
        if (!PATH.test(path)) throw new Error(`pose path '${path}' is not a this.* param path`)
        restart.push(`${path}.to(${num(v)})`)
      }
    }
    if (restart.length) out.push(`this.set(${restart.join(", ")})`)
    for (const f of fires) {
      if (r3(f.t) !== a) continue
      const axis = `${f.holon ?? "this"}.stateAxis(${JSON.stringify(f.axis.replace(/#\d+$/, ""))}).to(${JSON.stringify(f.to)})`
      // Its own duration, even past this beat: a transition runs its course
      // across later beats unless a later fire takes its params over.
      const w = f.duration / dt
      items.push(Math.abs(w - 1) < 1e-6 ? axis : `[${axis}, 0, ${num(w)}]`)
    }
    // Symbols summoned (a mudra's invocation) and dismissed: a real holon,
    // staged where it appeared, drawn on (and off) by its own choreography.
    for (const m of summons) {
      if (r3(m.t) !== a) continue
      const list = standing.get(m.className) ?? []
      const w = num(SUMMON_SECONDS / dt)
      if (m.dismiss) {
        const name = list.pop()
        if (name) items.push(`[UnCreate(${name}), 0, ${w}]`)
        continue
      }
      const name = `summoned${m.className}${++summonCount}`
      list.push(name)
      standing.set(m.className, list)
      const at = m.at ?? { x: 0, y: 0, z: 0 }
      out.push(`const ${name} = new ${m.className}({ x: ${num(at.x)}, y: ${num(at.y)}, z: ${num(at.z)}, scale: ${num(m.scale ?? 1)} })`)
      out.push(`this.stage(${name})`)
      items.push(`[Create(${name}), 0, ${w}]`)
    }
    if (keys.length) {
      const stops = [a, ...beats.filter((t) => t > a && t < b), b]
      for (let k = 0; k + 1 < stops.length; k++) {
        const u0 = stops[k]!
        const u1 = stops[k + 1]!
        const from = cameraAt(keys, u0)
        const to = cameraAt(keys, u1)
        for (const p of camParams) {
          if (!(p in to) || Math.abs((to[p] ?? 0) - (from[p] ?? 0)) <= CAMERA[p]!) continue
          const move = `this.observer.${p}.to(${num(to[p]!)}, { easing: "linear" })`
          const w0 = (u0 - a) / dt
          const w1 = (u1 - a) / dt
          items.push(w0 <= 1e-6 && w1 >= 1 - 1e-6 ? move : `[${move}, ${num(w0)}, ${num(w1)}]`)
        }
      }
    }
    out.push(beat(items, dt))
  }
  // The view comes home: the walk's camera was a detour, and the song goes on
  // from the camera it had authored (TASTE: the timeline owns the camera).
  const base = s.cameraBase ?? {}
  if (keys.length) {
    const end = cameraAt(keys, T)
    const home = camParams
      .filter((p) => p in base && p in end && Math.abs(end[p]! - base[p]!) > CAMERA[p]!)
      .map((p) => `this.observer.${p}.to(${num(base[p]!)})`)
    if (home.length) out.push(beat(home, CAMERA_HOME))
  }
  return out.join("\n")
}

// --- The voice, cut into the narration cache ---------------------------------------

const ffmpeg = async (args: string[]): Promise<void> => {
  const p = Bun.spawn(["ffmpeg", "-y", "-loglevel", "error", ...args], { stdout: "ignore", stderr: "pipe" })
  const err = await new Response(p.stderr).text()
  if ((await p.exited) !== 0) throw new Error(`ffmpeg: ${err.trim().slice(0, 300)}`)
}

/**
 * Make the session's spoken lines playable: transcribe the recording when
 * no live transcript came with it (the local `whisper` CLI, segment times),
 * then cut each line's span into the voice cache under its own key — the
 * player then speaks the recording. Returns the session, transcript filled.
 */
export const prepareVoice = async (repoRoot: string, s: Session, voice = "live"): Promise<Session> => {
  const dir = sessionDir(repoRoot, s.id)!
  const audio = s.files?.audio ? join(dir, s.files.audio) : undefined
  if (!audio || !existsSync(audio)) return s
  const wav = join(dir, "voice.wav")
  if (!existsSync(wav)) await ffmpeg(["-i", audio, "-ac", "1", "-ar", "16000", wav])
  let lines = s.tracks.transcript?.filter((l) => l.text.trim()) ?? []
  if (lines.length === 0) {
    const out = join(dir, "whisper")
    await mkdir(out, { recursive: true })
    // mlx_whisper (large-v3-turbo, word timestamps) where installed — far better
    // on a real speaker's voice, and fast on Apple silicon; else openai-whisper.
    const mlx = join(homedir(), ".local/bin/mlx_whisper")
    const cmd = existsSync(mlx)
      ? [
          mlx, wav, "--model", "mlx-community/whisper-large-v3-turbo", "--word-timestamps", "True",
          // These two stop the "Yeah. Yeah." it otherwise hears in a speaker's silences.
          "--condition-on-previous-text", "False", "--hallucination-silence-threshold", "2",
          "-f", "json", "-o", out,
        ]
      : ["whisper", wav, "--model", "base", "--output_format", "json", "--output_dir", out, "--fp16", "False"]
    const p = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe" })
    await p.exited
    const json = join(out, "voice.json")
    if (existsSync(json)) {
      const w = JSON.parse(await readFile(json, "utf8")) as {
        segments?: {
          start: number
          end: number
          text: string
          no_speech_prob?: number
          words?: { start: number; end: number }[]
        }[]
      }
      // Whisper hears words in silence ("You"): a segment it doubts was speech is not a line.
      lines = (w.segments ?? [])
        .filter((g) => (g.no_speech_prob ?? 0) < 0.5)
        // Word timestamps, where given, say exactly when the line was spoken.
        .map((g) => ({ t0: g.words?.[0]?.start ?? g.start, t1: g.words?.at(-1)?.end ?? g.end, text: g.text.trim() }))
        .filter((l) => l.text)
    }
  }
  const cache = voiceCacheDir(repoRoot)
  await mkdir(cache, { recursive: true })
  for (const l of lines) {
    const key = utteranceKey(l.text.trim(), voice)
    const file = join(cache, `${key}.${VOICE_EXT}`)
    if (!existsSync(file)) await ffmpeg(["-i", wav, "-ss", num(l.t0), "-to", num(l.t1), "-b:a", "96k", file])
  }
  const next: Session = { ...s, tracks: { ...s.tracks, transcript: lines } }
  await writeFile(join(dir, "session.json"), JSON.stringify(next, null, 2))
  return next
}

/**
 * A song in a private local holon (holons/<Name>, its own repo) keeps the
 * raw session beside it — `inputs/<session id>/` — raw human input next to
 * the perfected output. A public song's session stays in refs/sessions
 * (gitignored): a person's raw voice never lands in a public repo's tree.
 * Returns where it was copied, if it was.
 */
export const keepSessionInputs = async (repoRoot: string, songFile: string, id: string): Promise<string | undefined> => {
  if (!songFile.startsWith("holons/") || songFile.includes("..")) return undefined
  const from = sessionDir(repoRoot, id)
  if (!from || !existsSync(from)) return undefined
  const to = join(repoRoot, dirname(songFile), "inputs", id)
  await mkdir(dirname(to), { recursive: true })
  await cp(from, to, { recursive: true })
  return to.slice(repoRoot.length)
}
