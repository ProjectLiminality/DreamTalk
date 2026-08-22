/**
 * The editor daemon (EDITOR.md, build order v1): bun scripts/daemon.ts [port]
 *
 * Serves the editor like serve.ts, plus the bidirectional loop:
 *   - watches core/demo + core/src, rebuilds the editor bundle (debounced
 *     ~50 ms), pushes {type:"reload"} to clients over /ws
 *   - GET /api/refs   → reference material under refs/ (JSON list)
 *   - GET /api/source → a DreamWeaving's text + sha256 (the op base hash)
 *   - WS  {type:"op"} → semantic ops applied via ts-morph (scripts/ops.ts),
 *     written atomically, echo-suppressed at the watcher, one queue
 */

import { watch } from "node:fs"
import { readdir, rename } from "node:fs/promises"
import type { ServerWebSocket } from "bun"
import { applySetBackdrop, type SetBackdropOp } from "./ops"

const port = Number(process.argv[2] ?? 4174)
const repoRoot = new URL("../../", import.meta.url).pathname

const log = (...args: unknown[]) => console.log("[dreamtalk]", ...args)

const sha256 = (data: string): string => {
  const hasher = new Bun.CryptoHasher("sha256")
  hasher.update(data)
  return hasher.digest("hex")
}

// --- Static serving (serve.ts's role, unchanged routes) --------------------

const routes: Record<string, string> = {
  "/": "core/editor/index.html",
  "/demo": "core/demo/index.html",
  "/demo/": "core/demo/index.html",
}

const serveStatic = async (pathname: string): Promise<Response> => {
  let path = decodeURIComponent(pathname)
  path = routes[path] ?? path.slice(1)
  // page-relative asset paths
  if (path.startsWith("dist/")) path = `core/editor/${path}`
  if (path.startsWith("demo/")) path = `core/${path}`
  const file = Bun.file(repoRoot + path)
  if (await file.exists())
    return new Response(file, { headers: { "Cache-Control": "no-store" } })
  return new Response(`not found: ${path}`, { status: 404 })
}

// --- API -------------------------------------------------------------------

const REF_EXTENSIONS = /\.(png|jpg|mp4|mkv|webm|mov)$/i

const listRefs = async (): Promise<string[]> => {
  const entries = await readdir(`${repoRoot}refs`, { recursive: true })
  return entries
    .filter((p) => REF_EXTENSIONS.test(p))
    .map((p) => `refs/${p}`)
    .sort()
}

/** Repo-relative .ts path → absolute, or undefined if outside the repo. */
const resolveSourcePath = (file: string): string | undefined => {
  if (!file.endsWith(".ts") || file.includes("..") || file.startsWith("/")) return undefined
  return repoRoot + file
}

const sourceResponse = async (file: string | null): Promise<Response> => {
  const abs = file ? resolveSourcePath(file) : undefined
  if (!file || !abs) return Response.json({ error: "bad file" }, { status: 400 })
  const blob = Bun.file(abs)
  if (!(await blob.exists())) return Response.json({ error: "not found" }, { status: 404 })
  const source = await blob.text()
  return Response.json({ file, hash: sha256(source), source })
}

// --- Build + reload --------------------------------------------------------

const buildEditor = async (): Promise<boolean> => {
  const started = performance.now()
  try {
    const result = await Bun.build({
      entrypoints: [`${repoRoot}core/editor/main.ts`],
      outdir: `${repoRoot}core/editor/dist`,
      target: "browser",
      format: "esm",
    })
    if (!result.success) {
      for (const message of result.logs) console.error(message)
      return false
    }
  } catch (err) {
    // A broken tree must never kill the daemon — report and keep watching.
    console.error("[dreamtalk] bundle build failed:", err)
    return false
  }
  log(`bundle rebuilt in ${(performance.now() - started).toFixed(0)}ms`)
  return true
}

// --- Watcher with echo suppression -----------------------------------------

/** Daemon-written content hashes, consumed by exactly one watcher event each. */
const pendingEchoes = new Map<string, string>()

const changed = new Set<string>()
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const flushChanges = async () => {
  debounceTimer = undefined
  const files = [...changed]
  changed.clear()
  const external: string[] = []
  for (const abs of files) {
    const expected = pendingEchoes.get(abs)
    if (expected !== undefined && sha256(await Bun.file(abs).text().catch(() => "")) === expected) {
      pendingEchoes.delete(abs) // the one self-echo event — skip it
      continue
    }
    external.push(abs)
  }
  if (external.length === 0) return
  log("change:", external.map((p) => p.slice(repoRoot.length)).join(", "))
  await rebuildAndReload()
}

const scheduleFlush = () => {
  if (debounceTimer !== undefined) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void flushChanges(), 50)
}

const noteChange = (dir: string, filename: string | null) => {
  if (!filename || !filename.endsWith(".ts")) return
  changed.add(`${repoRoot}${dir}/${filename}`)
  scheduleFlush()
}

for (const dir of ["core/demo", "core/src"]) {
  watch(`${repoRoot}${dir}`, { recursive: true }, (_event, filename) =>
    noteChange(dir, filename),
  )
}

// --- Semantic ops (one queue, atomic writes) -------------------------------

interface OpMessage extends SetBackdropOp {
  type: "op"
  file?: string
  baseHash?: string
}

let opQueue: Promise<void> = Promise.resolve()

const applyOp = async (ws: ServerWebSocket<unknown>, msg: OpMessage): Promise<void> => {
  const reject = (reason: string) => {
    log("op rejected:", reason)
    ws.send(JSON.stringify({ type: "opRejected", reason }))
  }
  if (msg.op !== "setBackdrop") return reject(`unknown op: ${String(msg.op)}`)

  const file = msg.file ?? "core/demo/FoundingSmoke.ts"
  const abs = resolveSourcePath(file)
  if (!abs || !(await Bun.file(abs).exists())) return reject(`no such DreamWeaving: ${file}`)

  const current = await Bun.file(abs).text()
  if (msg.baseHash && msg.baseHash !== sha256(current)) {
    // The file moved under the client (AI/human edit). Ops carry intent,
    // not text positions — re-locate the form and apply anyway.
    log("op base hash stale — rebasing onto current content")
  }

  const result = applySetBackdrop(current, { op: "setBackdrop", path: msg.path, offset: msg.offset })
  if (!result.ok) return reject(result.reason)

  if (result.text !== current) {
    const tmp = `${abs}.tmp-${process.pid}`
    await Bun.write(tmp, result.text)
    await rename(tmp, abs)
    pendingEchoes.set(abs, sha256(result.text))
    log(`op setBackdrop → ${file}`)
  }
  ws.send(JSON.stringify({ type: "opApplied", file, hash: sha256(result.text) }))
  // The write's own watcher event is the suppressed echo; reload explicitly
  // so editor edits close the loop through the same rebuild path.
  await rebuildAndReload()
}

// --- Server ----------------------------------------------------------------

const server = Bun.serve({
  port,
  async fetch(req, srv) {
    const url = new URL(req.url)
    if (url.pathname === "/ws") {
      return srv.upgrade(req) ? undefined : new Response("upgrade failed", { status: 400 })
    }
    if (url.pathname === "/api/refs") return Response.json(await listRefs())
    if (url.pathname === "/api/source") return sourceResponse(url.searchParams.get("file"))
    return serveStatic(url.pathname)
  },
  websocket: {
    open(ws) {
      ws.subscribe("editor")
    },
    message(ws, raw) {
      let msg: OpMessage
      try {
        msg = JSON.parse(String(raw)) as OpMessage
      } catch {
        ws.send(JSON.stringify({ type: "opRejected", reason: "malformed message" }))
        return
      }
      if (msg.type !== "op") return
      opQueue = opQueue.then(() => applyOp(ws, msg)).catch((err) => log("op error:", err))
    },
    close(ws) {
      ws.unsubscribe("editor")
    },
  },
})

const rebuildAndReload = async () => {
  if (await buildEditor()) server.publish("editor", JSON.stringify({ type: "reload" }))
}

await buildEditor()
log(`daemon at http://localhost:${port} · demo at /demo · ws at /ws`)
