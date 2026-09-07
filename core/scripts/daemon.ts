/**
 * The editor daemon (EDITOR.md, build order v1): bun scripts/daemon.ts [port]
 *
 * Serves the editor like serve.ts, plus the bidirectional loop:
 *   - watches core/demo + core/src, rebuilds the editor bundle (debounced
 *     ~50 ms), pushes {type:"reload"} to clients over /ws
 *   - GET /api/refs   → reference material under refs/ (JSON list)
 *   - GET /api/source → a DreamWeaving's text + sha256 (the op base hash)
 *   - GET/PUT /api/bake-cache/<hash> → baked tracks, so the browser gets
 *     the disk cache it cannot reach itself (accelerator, never required)
 *   - GET /api/face/<Name> → a holon's DreamTalk face png, for tooltips
 *   - WS  {type:"op"} → semantic ops applied via ts-morph (scripts/ops.ts),
 *     written atomically, echo-suppressed at the watcher, one queue
 */

import { watch } from "node:fs"
import { mkdir, readdir, rename } from "node:fs/promises"
import { bakeCacheDir, isValidHash } from "../src/bakecache"
import type { BunPlugin, ServerWebSocket } from "bun"
import {
  applyAppendCheckpoint,
  applyDeleteSpan,
  applyInsertSpan,
  applySetBackdrop,
  applySetOverride,
  applySetRunTime,
  injectAnchors,
  changedSpans,
  readBackdrop,
  readOverride,
  readRunTime,
  type AppendCheckpointOp,
  type DeleteSpanOp,
  type InsertSpanOp,
  type OpResult,
  type SetBackdropOp,
  type SetOverrideOp,
  type SetRunTimeOp,
} from "./ops"

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

// --- Baked-track cache (src/bakecache.ts's http side) ----------------------

/**
 * `/api/bake-cache/<hash>` — GET a stored bake, PUT one to store.
 *
 * The browser cannot reach the filesystem, so the daemon lends it one.
 * This is deliberately the dumbest possible blob store: the hash IS the
 * name, the client computed it, and we neither parse nor validate the
 * bytes (bake.ts verifies its own header on read — validating here would
 * duplicate that check and let the two drift). What we DO enforce is
 * that the hash is our own hex shape, so nothing here can address a path
 * outside the cache directory, and a size ceiling so a stray PUT cannot
 * fill the disk.
 *
 * Absent this route everything still works: the client treats a 404 as
 * "compute it", which is exactly what `serve.ts` gives it.
 */
const MAX_CACHED_BAKE_BYTES = 64 * 1024 * 1024

const bakeCacheResponse = async (req: Request, hash: string): Promise<Response> => {
  if (!isValidHash(hash)) return new Response("bad hash", { status: 400 })
  const path = `${bakeCacheDir(repoRoot)}/${hash}.bin`

  if (req.method === "GET") {
    const file = Bun.file(path)
    if (!(await file.exists())) return new Response("miss", { status: 404 })
    return new Response(file, {
      headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
    })
  }

  if (req.method === "PUT") {
    const bytes = new Uint8Array(await req.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_CACHED_BAKE_BYTES) {
      return new Response("bad size", { status: 413 })
    }
    try {
      await mkdir(bakeCacheDir(repoRoot), { recursive: true })
      const tmp = `${path}.${process.pid}.tmp`
      await Bun.write(tmp, bytes)
      await rename(tmp, path)
      return new Response("stored", { status: 204 })
    } catch (err) {
      log("bake-cache put failed:", err)
      return new Response("store failed", { status: 500 })
    }
  }

  return new Response("method not allowed", { status: 405 })
}

// --- Vocabulary faces ------------------------------------------------------

/**
 * `core/vocabulary/<Name>/<Name>.png` — the distilled face of each
 * sovereign holon, which the editor shows as a hover tooltip. Served
 * read-only, and only for that exact shape: a name, its own directory,
 * its own png. Nothing else under vocabulary/ is reachable through here.
 */
const FACE_PATH = /^\/api\/face\/([A-Za-z][A-Za-z0-9]*)$/

const faceResponse = async (name: string): Promise<Response> => {
  const file = Bun.file(`${repoRoot}core/vocabulary/${name}/${name}.png`)
  if (!(await file.exists())) return new Response("no face", { status: 404 })
  return new Response(file, { headers: { "Content-Type": "image/png" } })
}

// --- Build + reload --------------------------------------------------------

/**
 * DreamWeaving directories whose files get __dt span anchors at build
 * time (EDITOR.md "Anchoring"). Holon repos join this list later.
 */
const ANCHORED_DIRS = ["core/demo/"]

const anchorPlugin: BunPlugin = {
  name: "dreamtalk-anchors",
  setup(build) {
    build.onLoad({ filter: /\.ts$/ }, async (args) => {
      if (!args.path.startsWith(repoRoot)) return undefined
      const relFile = args.path.slice(repoRoot.length)
      if (!ANCHORED_DIRS.some((dir) => relFile.startsWith(dir))) return undefined
      const source = await Bun.file(args.path).text()
      return {
        contents: injectAnchors(source, relFile, `${repoRoot}core/editor/anchors.ts`),
        loader: "ts" as const,
      }
    })
  },
}

const buildEditor = async (): Promise<boolean> => {
  const started = performance.now()
  try {
    const result = await Bun.build({
      entrypoints: [`${repoRoot}core/editor/main.ts`],
      outdir: `${repoRoot}core/editor/dist`,
      target: "browser",
      format: "esm",
      plugins: [anchorPlugin],
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
  // This reload came from a write the daemon did NOT make (a hand edit, an
  // agent, a git checkout). The editor's undo stack holds inverses computed
  // against the bytes that write just replaced, so those inverses no longer
  // describe anything — the stack must clear. Op writes reach the editor
  // through rebuildAndReload() below with no such flag.
  await rebuildAndReload({
    external: external.map((p) => p.slice(repoRoot.length)),
  })
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

for (const dir of ["core/demo", "core/src", "core/editor"]) {
  watch(`${repoRoot}${dir}`, { recursive: true }, (_event, filename) =>
    noteChange(dir, filename),
  )
}

// --- Semantic ops (one queue, atomic writes) -------------------------------

type OpMessage = (
  | SetBackdropOp
  | SetOverrideOp
  | AppendCheckpointOp
  | SetRunTimeOp
  | DeleteSpanOp
  | InsertSpanOp
) & {
  type: "op"
  file?: string
  baseHash?: string
  /** Echoed back on the ack — the editor's undo stack correlates by it. */
  opId?: string
}

let opQueue: Promise<void> = Promise.resolve()

/**
 * THE UNDO HALF (EDITOR undo stack): the daemon is the only party that
 * sees both sides of a write, so it — not the editor — computes each op's
 * inverse, at the moment of application, against the text actually on
 * disk. The inverse is a plain op descriptor: undo is then just sending
 * an op, through the same queue, the same rebase, the same ack. That is
 * the whole design, and why the stack needs no file snapshots.
 *
 * Three of the four ops are their own inverse carrying the old value.
 * appendCheckpoint is the exception — it INSERTS — so its inverse is a
 * deleteSpan over the byte range the write actually produced, diffed from
 * the before/after text rather than predicted.
 *
 * `undefined` means "this op cannot be undone", and the editor must then
 * refuse rather than guess: an override INSERTED into a construction that
 * had no such property cannot be inverted by setOverride (which has no
 * "remove the property" form), and a run_time spelled as a named constant
 * was never a literal to restore.
 */
const inverseFor = (
  msg: OpMessage,
  file: string,
  before: string,
  after: string,
): Record<string, unknown> | undefined => {
  if (msg.op === "setOverride") {
    const previous = readOverride(before, msg)
    if (previous.kind === "literal") {
      // The property was already there: the inverse is the same op with
      // the old literal, which re-locates by span exactly as the forward
      // op did (a rewrite inside a construction moves its END, never its
      // START, so the start-anchored match still finds the same node).
      return {
        type: "op",
        op: "setOverride",
        file,
        span: msg.span,
        className: msg.className,
        name: msg.name,
        value: previous.value,
      }
    }
    if (previous.kind !== "absent") return undefined
    // The write INSERTED the property — the common case, since dragging
    // an object whose x/y the scene never spelled is exactly this. Its
    // inverse is not a literal but a restoration of bytes, and it cannot
    // be a single cut: inserting into a multi-line literal whose last
    // property had no trailing comma ADDS that comma too. So the inverse
    // is the general guarded span-edit, computed from the write's own
    // diff, which describes both regions and is byte-exact by
    // construction rather than by a rule about commas.
    return spanEditInverse(before, after, file)
  }
  if (msg.op === "setRunTime") {
    const previous = readRunTime(before, msg.span)
    if (previous.kind === "unreadable") return undefined
    return {
      type: "op",
      op: "setRunTime",
      file,
      span: msg.span,
      runTime: previous.kind === "default" ? 1 : previous.value,
    }
  }
  if (msg.op === "setBackdrop") {
    const previous = readBackdrop(before)
    // No backdrop line before → the op INSERTED one, and setBackdrop has
    // no removal form. Honest answer: not undoable through an op.
    if (previous.kind !== "spec") return undefined
    return { type: "op", op: "setBackdrop", file, path: previous.path, offset: previous.offset }
  }
  // appendCheckpoint INSERTS, and deleteSpan/insertSpan are undo's own
  // ops — all three invert as "put these exact byte ranges back".
  if (msg.op === "appendCheckpoint" || msg.op === "deleteSpan" || msg.op === "insertSpan")
    return spanEditInverse(before, after, file)
  return undefined
}

/**
 * The general inverse: one guarded, all-or-nothing op that puts back
 * exactly the bytes a write changed, derived from the write's own diff.
 *
 * Used wherever a value-carrying inverse cannot express the prior state —
 * a checkpoint's inserted statement, an override's inserted property (an
 * insertion into a multi-line literal also adds a comma to the property
 * above it, so no single cut describes it), and undo's own ops when they
 * are themselves undone.
 *
 * The direction of the change picks the op: regions the write ADDED are
 * cut by `deleteSpan`; a region it REMOVED is restored by `insertSpan`,
 * which carries the rest as guarded `also` edits. Both refuse rather than
 * write when a guard no longer matches, which is what keeps an undo from
 * landing on text it was never computed against.
 */
const spanEditInverse = (
  before: string,
  after: string,
  file: string,
): Record<string, unknown> | undefined => {
  const spans = changedSpans(before, after)
  if (spans.length === 0) return undefined
  const edits = spans.map((s) => ({
    span: { start: s.start, end: s.end },
    expect: s.text,
    replace: s.was.length > 0 ? s.was : undefined,
  }))
  // A region the write only REMOVED has an empty guard here, and
  // deleteSpan needs text to locate. insertSpan is the op for it.
  const removals = edits.filter((e) => e.expect.length === 0)
  if (removals.length > 1) return undefined
  if (removals.length === 1) {
    const span = spans[edits.indexOf(removals[0]!)]!
    return {
      type: "op",
      op: "insertSpan",
      file,
      at: span.start,
      text: span.was,
      // What follows the insertion point in the file as it stands now —
      // the guard that re-locates the offset if the file has moved.
      context: after.slice(span.start, span.start + 120),
      also: edits.filter((e) => e.expect.length > 0),
    }
  }
  const [first, ...rest] = edits
  return { type: "op", op: "deleteSpan", file, ...first!, also: rest.length ? rest : undefined }
}

const applyOp = async (ws: ServerWebSocket<unknown>, msg: OpMessage): Promise<void> => {
  const reject = (reason: string) => {
    log("op rejected:", reason)
    ws.send(JSON.stringify({ type: "opRejected", reason }))
  }
  const knownOps = [
    "setBackdrop",
    "setOverride",
    "appendCheckpoint",
    "setRunTime",
    "deleteSpan",
    "insertSpan",
  ]
  if (!knownOps.includes(msg.op))
    return reject(`unknown op: ${String((msg as { op?: string }).op)}`)

  const file = msg.file ?? "core/demo/FoundingSmoke.ts"
  const abs = resolveSourcePath(file)
  if (!abs || !(await Bun.file(abs).exists())) return reject(`no such DreamWeaving: ${file}`)

  const current = await Bun.file(abs).text()
  if (msg.baseHash && msg.baseHash !== sha256(current)) {
    // The file moved under the client (AI/human edit). Ops carry intent,
    // not text positions — re-locate the form and apply anyway.
    log("op base hash stale — rebasing onto current content")
  }

  const apply = (): OpResult => {
    switch (msg.op) {
      case "setBackdrop":
        return applySetBackdrop(current, { op: "setBackdrop", path: msg.path, offset: msg.offset })
      case "setRunTime":
        return applySetRunTime(current, { op: "setRunTime", span: msg.span, runTime: msg.runTime })
      case "appendCheckpoint":
        return applyAppendCheckpoint(current, {
          op: "appendCheckpoint",
          placement: msg.placement,
          anchor: msg.anchor,
          targets: msg.targets,
          duration: msg.duration,
          file,
        })
      case "deleteSpan":
        return applyDeleteSpan(current, {
          op: "deleteSpan",
          span: msg.span,
          expect: msg.expect,
          replace: msg.replace,
          also: msg.also,
        })
      case "insertSpan":
        return applyInsertSpan(current, {
          op: "insertSpan",
          at: msg.at,
          text: msg.text,
          context: msg.context,
          also: msg.also,
        })
      default:
        return applySetOverride(current, {
          op: "setOverride",
          span: msg.span,
          className: msg.className,
          name: msg.name,
          value: msg.value,
          remove: msg.remove,
        })
    }
  }
  const result = apply()
  if (!result.ok) return reject(result.reason)

  // Computed against the text the write was applied to, BEFORE the write
  // lands — the one moment both sides of the edit are known.
  const undo = inverseFor(msg, file, current, result.text)

  if (result.text !== current) {
    const tmp = `${abs}.tmp-${process.pid}`
    await Bun.write(tmp, result.text)
    await rename(tmp, abs)
    pendingEchoes.set(abs, sha256(result.text))
    log(`op ${msg.op} → ${file}`)
  }
  ws.send(
    JSON.stringify({
      type: "opApplied",
      file,
      hash: sha256(result.text),
      opId: msg.opId,
      // A no-op write changed nothing, so there is nothing to undo.
      undo: result.text === current ? undefined : undo,
    }),
  )
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
    if (url.pathname.startsWith("/api/bake-cache/")) {
      return bakeCacheResponse(req, url.pathname.slice("/api/bake-cache/".length))
    }
    const face = FACE_PATH.exec(url.pathname)
    if (face) return faceResponse(face[1]!)
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

const rebuildAndReload = async (cause?: { external: string[] }) => {
  if (await buildEditor())
    server.publish("editor", JSON.stringify({ type: "reload", external: cause?.external }))
}

await buildEditor()
log(`daemon at http://localhost:${port} · demo at /demo · ws at /ws`)
