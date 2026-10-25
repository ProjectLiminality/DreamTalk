/**
 * feedback-pull.ts — a shared song's viewer notes, pulled into its DreamNode.
 *
 *   bun scripts/feedback-pull.ts --song <id> [--into <dir>] [--all]
 *
 * A song published with a feedback sink (build-standalone --feedback,
 * demo/feedback.ts) sends each viewer's note to the dashboard's inbox
 * (GET /api/feedback). This pulls them into the DreamNode the song lives
 * in — by default the local holon whose dreamtalk.json declares scene
 * `<id>`, under `inputs/feedback/` — one folder per note:
 *
 *   <date>-<id>/note.json      the note: who, the text, the song t, the
 *                              object (path, class, field name, wholes), its
 *                              screen box, the walked state and the link
 *                              that reopens it, and `source` — the file:line
 *                              that makes that object and the one that
 *                              declares its class (scripts/where.ts)
 *              voice.<ext>     the spoken note; transcript.txt its Whisper text
 *              photo.jpg       a photo the viewer attached (a paper sketch)
 *              frame.jpg       what was on screen, the selection glowing
 *
 * and `README.md` beside them, every note pulled so far in song order —
 * what an agent reads first, then opens the folders it needs. A voice note
 * still waiting for its transcript is transcribed on the way (the worker's
 * POST /api/feedback/:id/transcribe). Pulling twice rewrites the same
 * folders. Notes stay open in the inbox until the agent that acted on them
 * marks them processed (`bun run pl done <fb_id…> --note "…"` in the dashboard).
 *
 * --into  any folder; a private DreamNode's inputs/ is the usual place
 *         (viewers' words are not for a public repo).
 * --all   processed notes too.
 *
 * Config, first match wins: PL_API_BASE / PL_API_KEY in the environment,
 * then SYNC_API_BASE / SYNC_API_KEY in the `.env` of the folder this repo
 * sits in (the dashboard checkout's, which the `pl` CLI reads).
 */

import { existsSync, readFileSync } from "node:fs"
import { mkdir, readdir } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { findLocalScenes } from "./local-holons"
import { fieldSiteOf, whereIsAt, type SourceLine } from "./where"

const repoRoot = resolve(new URL("../../", import.meta.url).pathname) + "/"

const args = process.argv.slice(2)
const opt = (name: string): string | undefined => {
  const eq = args.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith("--") ? args[i + 1] : undefined
}

/** A note as the inbox returns it (the dashboard's routers/feedback.ts). */
interface Note {
  id: string
  song: string
  created_at: string
  viewer: string | null
  text: string | null
  t: number | null
  holon: { path: { root: number; indices: number[]; className: string } | null; className: string | null; name: string | null; owners: string[] | null } | null
  state: string | null
  link: string | null
  walk: { free: boolean; positions: Record<string, string> } | null
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null
  frame: { w: number; h: number } | null
  voice: { url: string; mime: string | null; duration_ms: number | null; transcription: string | null; transcription_status: string; transcription_error: string | null } | null
  image: { url: string; mime: string | null } | null
  shot: { url: string; mime: string } | null
  processed: boolean
  process_note: string | null
}

const config = (): { base: string; key: string } => {
  const dot: Record<string, string> = {}
  const envFile = join(dirname(repoRoot.replace(/\/$/, "")), ".env")
  if (existsSync(envFile))
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const m = /^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/.exec(line)
      if (m && !line.trim().startsWith("#")) dot[m[1]!] = m[2]!
    }
  const key = process.env.PL_API_KEY ?? process.env.SYNC_API_KEY ?? dot.PL_API_KEY ?? dot.SYNC_API_KEY ?? ""
  const base = process.env.PL_API_BASE ?? process.env.SYNC_API_BASE ?? dot.PL_API_BASE ?? dot.SYNC_API_BASE ?? ""
  if (!key || !base) throw new Error(`no inbox configured: set PL_API_BASE and PL_API_KEY (or SYNC_API_* in ${envFile})`)
  return { base: base.replace(/\/+$/, ""), key }
}

const song = opt("song")
if (!song) throw new Error("--song <id> is required")
const { base, key } = config()
const auth = { Authorization: `Bearer ${key}` }
const get = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...auth, ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res
}

// Where they go: --into, else the holon that declares the scene.
const scene = (await findLocalScenes()).find((s) => s.id === song)
const into = resolve(opt("into") ?? (scene ? join(dirname(scene.file), "inputs", "feedback") : ""))
if (!opt("into") && !scene) throw new Error(`no local holon declares scene "${song}" — pass --into <dir>`)

const qs = new URLSearchParams({ song })
if (args.includes("--all")) qs.set("all", "1")
const notes = ((await (await get(`/api/feedback?${qs}`)).json()) as { feedback: Note[] }).feedback

/**
 * A class by the name the page saw. The bundle renames a class whose name
 * another module's top level also uses (`Line` → `Line2`), and the page
 * reads `constructor.name` — so a miss is tried again without the suffix.
 */
const classAt = async (name: string): Promise<SourceLine | undefined> =>
  (await whereIsAt(repoRoot, name)) ?? (/\D\d+$/.test(name) ? await whereIsAt(repoRoot, name.replace(/\d+$/, "")) : undefined)

/** The file:line that makes the object (its field in the nearest whole that names it) and the one declaring its class. */
const sourceOf = async (n: Note): Promise<{ site?: SourceLine; decl?: SourceLine }> => {
  const out: { site?: SourceLine; decl?: SourceLine } = {}
  const name = n.holon?.name
  if (name) {
    const wholes: string[] = []
    // Each whole, and the classes it extends — a field is often declared
    // in a superclass (a song's `Triangle extends Triad`).
    for (const owner of n.holon?.owners ?? []) {
      let at = await classAt(owner)
      for (let depth = 0; at && depth < 4; depth++) {
        wholes.push(at.file)
        const parent = /\bextends\s+(\w+)/.exec(at.text)?.[1]
        at = parent ? await classAt(parent) : undefined
      }
    }
    // A root is a field of the Dream itself — the holon's own entry.
    if (scene) wholes.push(scene.file.slice(repoRoot.length))
    for (const file of wholes) {
      const site = await fieldSiteOf(repoRoot, file, name)
      if (site) {
        out.site = site
        break
      }
    }
  }
  if (n.holon?.className) out.decl = await classAt(n.holon.className)
  return out
}

const extOf = (mime: string | null): string =>
  !mime ? "bin" : mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("webm") ? "webm" : mime.includes("png") ? "png" : "jpg"

await mkdir(into, { recursive: true })
for (let n of notes) {
  if (n.voice && n.voice.transcription_status !== "done") {
    n = (await (await get(`/api/feedback/${n.id}/transcribe`, { method: "POST" })).json()) as Note
  }
  const dir = join(into, `${n.created_at.slice(0, 10)}-${n.id}`)
  await mkdir(dir, { recursive: true })
  const save = async (url: string, file: string) => {
    await Bun.write(join(dir, file), await (await get(url)).arrayBuffer())
    return file
  }
  const files: Record<string, string> = {}
  if (n.voice) files.voice = await save(n.voice.url, `voice.${extOf(n.voice.mime)}`)
  if (n.voice?.transcription) {
    await Bun.write(join(dir, "transcript.txt"), `${n.voice.transcription}\n`)
    files.transcript = "transcript.txt"
  }
  if (n.image) files.photo = await save(n.image.url, `photo.${extOf(n.image.mime)}`)
  if (n.shot) files.frame = await save(n.shot.url, "frame.jpg")
  await Bun.write(join(dir, "note.json"), `${JSON.stringify({ ...n, source: await sourceOf(n), files }, null, 2)}\n`)
}

// The index: every note pulled so far, in song order.
const all: (Note & { source?: { site?: SourceLine; decl?: SourceLine }; files?: Record<string, string> })[] = []
for (const d of (await readdir(into, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)) {
  const f = Bun.file(join(into, d, "note.json"))
  if (await f.exists()) all.push(await f.json())
}
all.sort((a, b) => (a.t ?? 0) - (b.t ?? 0) || a.created_at.localeCompare(b.created_at))
const clock = (t: number | null) => (t === null ? "—" : `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`)
const at = (s?: SourceLine) => (s ? `\`${s.file}:${s.line}\`` : "")
const lines = [
  `# Viewer notes — ${song}`,
  "",
  `Pulled from the song's feedback inbox (scripts/feedback-pull.ts); ${all.length} note${all.length === 1 ? "" : "s"}, in song order.`,
  "Each folder holds note.json (object, t, walked state, source lines) and the note's voice / transcript / photo / frame.",
  "",
]
for (const n of all) {
  const on = n.holon ? `**${n.holon.name ?? n.holon.className}** (${n.holon.className})` : "the whole scene"
  lines.push(`## ${clock(n.t)} · ${on} · ${n.viewer ?? "a viewer"}${n.processed ? " · processed" : ""}`)
  lines.push("")
  lines.push(`\`${n.id}\` · ${n.created_at.slice(0, 16).replace("T", " ")} · [${n.created_at.slice(0, 10)}-${n.id}/](${n.created_at.slice(0, 10)}-${n.id}/)`)
  if (n.source?.site || n.source?.decl) lines.push(`made at ${at(n.source.site) || "?"} · class ${at(n.source.decl) || "?"}`)
  if (n.walk) lines.push(`${n.walk.free ? "free play" : "song"} · ${Object.entries(n.walk.positions).map(([a, p]) => `${a}=${p}`).join(" ")}`)
  if (n.link) lines.push(`reopen: ${n.link}`)
  lines.push("")
  if (n.text) lines.push(`> ${n.text.replace(/\n/g, "\n> ")}`, "")
  if (n.voice) lines.push(n.voice.transcription ? `> 🎙 ${n.voice.transcription.replace(/\n/g, "\n> ")}` : `> 🎙 _transcript ${n.voice.transcription_status}_`, "")
  if (n.files?.photo) lines.push(`![photo](${n.created_at.slice(0, 10)}-${n.id}/${n.files.photo})`, "")
  if (n.process_note) lines.push(`_processed: ${n.process_note}_`, "")
}
await Bun.write(join(into, "README.md"), lines.join("\n"))
console.log(`${song}: ${notes.length} note${notes.length === 1 ? "" : "s"} → ${into} (${all.length} on disk)`)
