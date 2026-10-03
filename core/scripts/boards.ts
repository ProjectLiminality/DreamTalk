/**
 * boards.ts — the daemon's whiteboard store (sketch/board.ts on disk).
 *
 *   GET /api/boards        → [{ name, board }] for every board file
 *   GET /api/board/<name>  → one board, or 404 (a new board is just empty)
 *   PUT /api/board/<name>  → validate, normalise, write atomically
 *
 * Boards live in core/demo/boards/ beside the DreamWeavings, because a
 * board IS a scene (demo/boards/Board.ts) and belongs in the repo. The
 * name is checked against the same file-stem shape everywhere, so nothing
 * here can address a path outside that directory; a PUT is re-serialised
 * from the parsed board rather than written as received, so the file on
 * disk is always the canonical, diff-friendly form.
 */

import { mkdir, readdir, rename } from "node:fs/promises"
import { BOARD_SUFFIX, isValidBoardName, parseBoard, serializeBoard } from "../sketch/board"

export const boardsDir = (repoRoot: string): string => `${repoRoot}core/demo/boards`

const boardPath = (repoRoot: string, name: string): string => `${boardsDir(repoRoot)}/${name}${BOARD_SUFFIX}`

/** A watcher filename → the board it names, or undefined if it is not one. */
export const boardNameOf = (filename: string): string | undefined => {
  const base = filename.split("/").pop() ?? ""
  if (!base.endsWith(BOARD_SUFFIX)) return undefined
  const name = base.slice(0, -BOARD_SUFFIX.length)
  return isValidBoardName(name) ? name : undefined
}

const MAX_BOARD_BYTES = 16 * 1024 * 1024

export const listBoards = async (repoRoot: string): Promise<{ name: string; board: unknown }[]> => {
  let entries: string[]
  try {
    entries = await readdir(boardsDir(repoRoot))
  } catch {
    return []
  }
  const out: { name: string; board: unknown }[] = []
  for (const f of entries.sort()) {
    const name = boardNameOf(f)
    if (!name) continue
    try {
      const board = parseBoard(JSON.parse(await Bun.file(boardPath(repoRoot, name)).text()))
      if (board) out.push({ name, board })
    } catch {
      // an unreadable board is skipped, never fatal
    }
  }
  return out
}

export const boardResponse = async (req: Request, repoRoot: string, name: string): Promise<Response> => {
  if (!isValidBoardName(name)) return Response.json({ error: "bad board name" }, { status: 400 })
  const path = boardPath(repoRoot, name)

  if (req.method === "GET") {
    const file = Bun.file(path)
    if (!(await file.exists())) return Response.json({ error: "no such board" }, { status: 404 })
    return new Response(file, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
  }

  if (req.method === "PUT") {
    const text = await req.text()
    if (text.length === 0 || text.length > MAX_BOARD_BYTES) return Response.json({ error: "bad size" }, { status: 413 })
    let board
    try {
      board = parseBoard(JSON.parse(text))
    } catch {
      return Response.json({ error: "malformed JSON" }, { status: 400 })
    }
    if (!board) return Response.json({ error: "not a board (need strokes, symbols)" }, { status: 400 })
    try {
      await mkdir(boardsDir(repoRoot), { recursive: true })
      const tmp = `${path}.${process.pid}.tmp`
      await Bun.write(tmp, serializeBoard(board))
      await rename(tmp, path)
      return Response.json({ ok: true, strokes: board.strokes.length, symbols: board.symbols.length })
    } catch (err) {
      console.error("[dreamtalk] board write failed:", err)
      return Response.json({ error: "write failed" }, { status: 500 })
    }
  }

  return Response.json({ error: "method not allowed" }, { status: 405 })
}
