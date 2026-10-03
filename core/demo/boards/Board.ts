/**
 * Board.ts — a whiteboard page, as a DreamTalk scene.
 *
 * ONE SCENE, TWO WORKSPACES. A board is a file (`<name>.board.json`, see
 * sketch/board.ts) and this is the one generic Dream that stages it: each
 * placed symbol through the sketch vocabulary's `buildSymbol`, each raw
 * ink stroke as a Line (strokes ARE scene data, Grease-Pencil style), the
 * camera framing the page straight on — the same page → scene mapping
 * the whiteboard renders with, so the editor shows exactly what was
 * sketched. Blender's split, kept: the whiteboard (/sketch/?board=<name>)
 * is the 2D layout workspace on the tablet, the editor (/?scene=board:<name>)
 * is where it gets a camera, a timeline and choreography.
 *
 * WHO OWNS WHAT, and why the split is clean:
 *   - LAYOUT is owned by the whiteboard and lives in the board file
 *     (data). Where a circle sits and how big it is was decided by a hand
 *     on a page; the file records that decision and nothing else.
 *   - CHOREOGRAPHY is owned by code: `unfold()` here stays EMPTY. To
 *     animate a board, a DreamWeaving imports its file and extends the
 *     staged scene —
 *
 *         import scratch from "./scratch.board.json"
 *         class Opening extends boardDream("scratch", scratch) {
 *           override unfold() { super.unfold(); this.play(Create(this.symbols[0]!), 2) }
 *         }
 *
 *     so time lives where all DreamTalk time lives, in a file the editor's
 *     semantic ops already understand.
 *   - There is deliberately NO editor → board write-back. A drag in the
 *     editor on a board scene is a live preview (these holons carry no
 *     source anchors, so no op is ever sent). Writing it back would make
 *     two authorities over one position — the whiteboard's page and the
 *     editor's overrides — and every merge rule between them is a problem
 *     invented by having two. Edit layout on the board; it flows here
 *     (the daemon remounts the editor when the file changes).
 *
 * No `new` of a PascalCase class appears in this file on purpose: the
 * daemon anchors constructions under core/demo/ to their source span, and
 * a board's holons must not point the editor's ops at this generic file.
 */

import { Dream, type DreamClass } from "../../src/dream"
import type { Holon } from "../../src/holon"
import type { Line } from "../../src/parts/primitives"
import { buildSymbol, framePage, inkHolon } from "../../sketch/vocabulary"
import { BOARD_SUFFIX, isValidBoardName, parseBoard, type BoardFile } from "../../sketch/board"

/** A staged board: its symbols and ink, addressable from choreography. */
export abstract class BoardDream extends Dream {
  abstract readonly board: BoardFile
  /** One holon per placed symbol, in the board's order (unbuildable ones skipped). */
  symbols: Holon[] = []
  /** Symbol holons by their board id. */
  byId: Record<string, Holon> = {}
  /** One Line per raw ink stroke, in drawing order. */
  ink: Line[] = []

  unfold(): void {
    framePage(this)
    for (const s of this.board.symbols) {
      let h: Holon
      try {
        h = buildSymbol(s)
      } catch (err) {
        console.warn("[board] cannot build", s.symbol, err)
        continue
      }
      this.symbols.push(h)
      this.byId[s.id] = h
      this.stage(h)
    }
    for (const k of this.board.strokes) this.ink.push(this.stage(inkHolon(k)))
  }
}

/** The Dream class for one board's data. */
export const boardDream = (name: string, data: unknown): DreamClass => {
  const board = parseBoard(data) ?? { version: 1, page: { w: 0, h: 0 }, strokes: [], symbols: [] }
  const cls = class extends BoardDream {
    readonly board = board
  }
  // The editor names a scene after its class (minus "Dream").
  Object.defineProperty(cls, "name", { value: `Board ${name}Dream` })
  return cls
}

/** The scene-registry key a board appears under in the editor. */
export const boardSceneKey = (name: string): string => `board:${name}`

/**
 * Every board the daemon knows, as registry entries `board:<name>`. A
 * missing daemon (plain serve.ts) or a failed fetch is simply no boards.
 */
export const loadBoards = async (): Promise<Record<string, DreamClass>> => {
  const out: Record<string, DreamClass> = {}
  try {
    const res = await fetch("/api/boards")
    if (!res.ok) return out
    const list = (await res.json()) as { name: string; board: unknown }[]
    for (const { name, board } of list) {
      if (typeof name === "string" && isValidBoardName(name)) out[boardSceneKey(name)] = boardDream(name, board)
    }
  } catch {
    // no daemon — no boards
  }
  return out
}

export { BOARD_SUFFIX }
