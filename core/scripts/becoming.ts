/**
 * The becoming — a DreamSong's git history, walkable (David: "the becoming
 * is the git history of the DreamSong; you can see the knowledge
 * crystallise outward into the adjacent possible").
 *
 * Two halves, both read-only on every repo:
 *
 *   history(scene file) → the commits that touched the song and the holons
 *     it stands on: its own file, every DreamWeaving file it imports, and
 *     every vocabulary holon directory it reaches (core/src — the framework
 *     — is not "its" history). A song inside a local holon repo
 *     (holons/<Name>, its own git) reads that repo's log, the same way.
 *
 *   materialise(commit) → that commit's tree, copied out with `git archive`
 *     into a cache dir (NEVER a checkout or a worktree: DreamTalk is a
 *     submodule whose core.worktree points at the live tree — a checkout
 *     "elsewhere" can act on the main tree), and that version's PLAYER
 *     built from it, once per sha. The editor shows it in a frame at
 *     /becoming/<key>/demo/?scene=…&t=… — the song as it was, by the code
 *     that made it then.
 */

import { existsSync } from "node:fs"
import { mkdir, readdir, rm, symlink } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import { tmpdir } from "node:os"
import { localHolonsPlugin, type LocalScene } from "./local-holons"

export interface BecomingCommit {
  /** The repo the commit lives in: "" for DreamTalk, `holons/<Name>` for a local holon. */
  repo: string
  sha: string
  /** Seconds since the epoch (committer time). */
  time: number
  subject: string
  /** Which of the song's files it touched (repo-relative). */
  files: string[]
}

const run = async (cmd: string[], cwd: string): Promise<{ ok: boolean; out: string; err: string }> => {
  const p = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" })
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()])
  return { ok: (await p.exited) === 0, out, err }
}

const RELATIVE = /^\.\.?\//

/**
 * The song's own sources: the scene file, every file it imports under the
 * DreamWeaving dirs (transitively), and each vocabulary / local-holon
 * directory it reaches — as absolute paths. The framework (core/src) and
 * the editor are left out: their history is everyone's, not this song's.
 */
export const songSources = async (repoRoot: string, sceneAbs: string): Promise<string[]> => {
  const transpiler = new Bun.Transpiler({ loader: "ts" })
  const seen = new Set<string>()
  const dirs = new Set<string>()
  const files = new Set<string>()
  const queue = [sceneAbs]
  const vocab = `${repoRoot}core/vocabulary/`
  const holons = `${repoRoot}holons/`
  const demo = `${repoRoot}core/demo/`
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    let code: string
    try {
      code = await Bun.file(file).text()
    } catch {
      continue
    }
    if (file.startsWith(vocab)) dirs.add(file.slice(0, vocab.length + file.slice(vocab.length).indexOf("/") + 1))
    else if (file.startsWith(holons)) dirs.add(file.slice(0, holons.length + file.slice(holons.length).indexOf("/") + 1))
    else if (file.startsWith(demo)) files.add(file)
    else continue // core/src, editor, node_modules: not this song's history
    let imports: { path: string }[] = []
    try {
      imports = transpiler.scanImports(code)
    } catch {}
    for (const { path } of imports) {
      if (!RELATIVE.test(path)) continue
      const base = resolve(dirname(file), path)
      for (const candidate of [base, `${base}.ts`, join(base, "index.ts")])
        if (candidate.endsWith(".ts") && existsSync(candidate)) {
          queue.push(candidate)
          break
        }
    }
  }
  return [...files, ...dirs].sort()
}

/** The git repo a path lives in: a local holon's own, else DreamTalk's. */
const repoOf = (repoRoot: string, abs: string): string => {
  const holons = `${repoRoot}holons/`
  if (abs.startsWith(holons)) return `holons/${abs.slice(holons.length).split("/")[0]}`
  return ""
}

/** The commits that touched the song's sources, newest first, across its repos. */
export const history = async (repoRoot: string, sceneFile: string, limit = 200): Promise<BecomingCommit[]> => {
  const sceneAbs = resolve(repoRoot, sceneFile)
  if (!sceneAbs.startsWith(repoRoot)) throw new Error("scene file outside the repo")
  const sources = await songSources(repoRoot, sceneAbs)
  const byRepo = new Map<string, string[]>()
  for (const s of sources) {
    const repo = repoOf(repoRoot, s)
    const list = byRepo.get(repo) ?? []
    list.push(s)
    byRepo.set(repo, list)
  }
  const out: BecomingCommit[] = []
  for (const [repo, paths] of byRepo) {
    const cwd = repo ? `${repoRoot}${repo}` : repoRoot
    if (repo && !existsSync(`${cwd}/.git`)) continue
    const rel = paths.map((p) => relative(cwd, p) || ".")
    const res = await run(
      ["git", "log", `-n${limit}`, "--name-only", "--format=%x01%H%x09%ct%x09%s", "--", ...rel],
      cwd,
    )
    if (!res.ok) continue
    for (const block of res.out.split("\x01").slice(1)) {
      const [head, ...rest] = block.split("\n")
      const [sha, time, ...subject] = head!.split("\t")
      out.push({
        repo,
        sha: sha!,
        time: Number(time),
        subject: subject.join("\t"),
        files: rest.map((l) => l.trim()).filter(Boolean),
      })
    }
  }
  // The song's becoming starts with the song: commits to its holons from
  // before its own file existed made other things, not it.
  const sceneRepo = repoOf(repoRoot, sceneAbs)
  const sceneCwd = sceneRepo ? `${repoRoot}${sceneRepo}` : repoRoot
  const born = await run(["git", "log", "--diff-filter=A", "--format=%ct", "--", relative(sceneCwd, sceneAbs)], sceneCwd)
  const birth = Math.min(...born.out.split("\n").filter(Boolean).map(Number))
  const since = Number.isFinite(birth) ? birth : -Infinity
  return out
    .filter((c) => c.time >= since)
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
}

// --- Materialising a commit ---------------------------------------------------------

/** Where materialised trees live — outside every repo. */
export const cacheRoot = join(tmpdir(), "dreamtalk-becoming")

const SHA = /^[0-9a-f]{7,40}$/
const REPO = /^(|holons\/[A-Za-z0-9_.-]+)$/

/** A commit's cache key: the repo and sha, filesystem-safe. */
export const keyOf = (repo: string, sha: string): string => `${repo ? repo.replace("/", "-") : "main"}-${sha}`

const building = new Map<string, Promise<string>>()

/** Copy `sha:path` of the repo at `cwd` into `dest` — git archive, never a checkout. */
const archive = async (cwd: string, sha: string, path: string, dest: string): Promise<void> => {
  await mkdir(dest, { recursive: true })
  const tar = `${dest}/.archive.tar`
  const a = await run(["git", "archive", "--format=tar", "-o", tar, sha, ...(path ? [path] : [])], cwd)
  if (!a.ok) throw new Error(`git archive ${sha}: ${a.err.trim()}`)
  const x = await run(["tar", "-xf", tar, "-C", dest], cwd)
  await rm(tar, { force: true })
  if (!x.ok) throw new Error(`untar ${sha}: ${x.err.trim()}`)
}

/**
 * That commit's tree and its player bundle, built once (cached by key).
 * Resolves to the cache dir holding `core/demo/index.html` + `dist/`.
 *   DreamTalk commit → `core/` at that sha.
 *   Local holon commit → the holon at that sha beside DreamTalk's `core/`
 *     at HEAD (the holon's history, played by today's framework — its
 *     commits do not say which framework they ran on).
 */
export const materialise = (repoRoot: string, repo: string, sha: string): Promise<string> => {
  if (!SHA.test(sha) || !REPO.test(repo)) return Promise.reject(new Error("bad commit"))
  const key = keyOf(repo, sha)
  const hit = building.get(key)
  if (hit) return hit
  const job = (async () => {
    const dir = join(cacheRoot, key)
    if (existsSync(join(dir, "core/demo/dist/main.js"))) return dir
    await rm(dir, { recursive: true, force: true })
    let scenes: LocalScene[] = []
    if (!repo) {
      await archive(repoRoot, sha, "core", dir)
    } else {
      await archive(repoRoot, "HEAD", "core", dir)
      await archive(`${repoRoot}${repo}`, sha, "", join(dir, repo))
      const manifest = (await Bun.file(join(dir, repo, "dreamtalk.json")).json().catch(() => ({}))) as {
        entry?: string
        scene?: { id?: string; export?: string; entry?: string }
      }
      const entry = manifest.scene?.entry ?? manifest.entry
      if (manifest.scene?.id && manifest.scene.export && entry)
        scenes = [{ id: manifest.scene.id, exportName: manifest.scene.export, file: join(dir, repo, entry) }]
    }
    // Resolve packages from the live install — the archive carries no node_modules.
    await symlink(`${repoRoot}core/node_modules`, join(dir, "core/node_modules")).catch(() => {})
    // The local holons (gitignored, each its own repo) the scene registry imports:
    // today's, beside the one being walked back.
    await mkdir(join(dir, "holons"), { recursive: true })
    for (const name of await readdir(`${repoRoot}holons`).catch(() => [] as string[])) {
      if (repo === `holons/${name}`) continue
      await symlink(`${repoRoot}holons/${name}`, join(dir, "holons", name)).catch(() => {})
    }
    const result = await Bun.build({
      entrypoints: [join(dir, "core/demo/main.ts")],
      outdir: join(dir, "core/demo/dist"),
      target: "browser",
      format: "esm",
      plugins: [localHolonsPlugin(scenes)],
    })
    if (!result.success) {
      building.delete(key)
      throw new Error(result.logs.map((l) => String(l)).join("\n").slice(0, 2000) || "build failed")
    }
    return dir
  })()
  building.set(key, job)
  job.catch(() => building.delete(key))
  return job
}

/**
 * `/becoming/<key>/<path>` → a file of that commit's player: `demo/` maps to
 * its `core/demo/`. Builds on first request. Undefined: not a becoming path.
 */
export const becomingResponse = async (repoRoot: string, pathname: string): Promise<Response | undefined> => {
  const m = /^\/becoming\/(main|holons-[A-Za-z0-9_.-]+)-([0-9a-f]{7,40})\/(.*)$/.exec(pathname)
  if (!m) return undefined
  const repo = m[1] === "main" ? "" : m[1]!.replace("holons-", "holons/")
  let dir: string
  try {
    dir = await materialise(repoRoot, repo, m[2]!)
  } catch (err) {
    return new Response(`becoming: ${String((err as Error).message ?? err)}`, { status: 500 })
  }
  let rest = decodeURIComponent(m[3]!)
  if (rest === "demo" || rest === "demo/") rest = "demo/index.html"
  if (!rest.startsWith("demo/") || rest.includes("..")) return new Response("not found", { status: 404 })
  const file = Bun.file(join(dir, "core", rest))
  if (!(await file.exists())) return new Response(`not found: ${rest}`, { status: 404 })
  return new Response(file, { headers: { "Cache-Control": "max-age=31536000, immutable" } })
}

/** Forget every materialised tree (a maintenance hook; never called on a path). */
export const clearCache = async (): Promise<string[]> => {
  const names = await readdir(cacheRoot).catch(() => [] as string[])
  await rm(cacheRoot, { recursive: true, force: true })
  return names
}
