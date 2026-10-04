/**
 * boards.test.ts — a whiteboard page as a scene file (sketch/board.ts),
 * staged as a Dream (demo/boards/Board.ts), stored by the daemon
 * (scripts/boards.ts).
 */

import { afterAll, describe, expect, test } from "bun:test"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { isValidBoardName, parseBoard, serializeBoard } from "../sketch/board"
import { BoardDream, boardDream } from "../demo/boards/Board"
import { boardNameOf, boardResponse, listBoards } from "../scripts/boards"
import { Line } from "../src/parts/primitives"
import { PAGE_H, PAGE_W } from "../sketch/protocol"

const board = {
  strokes: [{ id: "k1", points: [{ x: 10.123456, y: 20, pressure: 0.51234, t: 3.6 }, { x: 30, y: 40, pressure: 0.5, t: 9 }] }],
  symbols: [{ id: "c1", symbol: "circle", params: { cx: 600, cy: 700, r: 180.000001 }, fromStrokes: ["k0"] }],
}

describe("board file", () => {
  test("names are file stems — nothing that walks a path", () => {
    expect(isValidBoardName("scratch")).toBe(true)
    expect(isValidBoardName("Labyrinth_v2-a")).toBe(true)
    for (const bad of ["", "../x", "a/b", ".hidden", "a b", "x".repeat(65)]) expect(isValidBoardName(bad)).toBe(false)
  })

  test("serialise → parse round-trips, rounded, one entry per line", () => {
    const text = serializeBoard(board)
    const back = parseBoard(JSON.parse(text))!
    expect(back.strokes[0]!.points[0]).toEqual({ x: 10.12, y: 20, pressure: 0.512, t: 4 })
    expect(back.symbols[0]!.params).toEqual({ cx: 600, cy: 700, r: 180 })
    expect(back.symbols[0]!.fromStrokes).toEqual(["k0"])
    expect(text.split("\n").filter((l) => l.includes('"id":')).length).toBe(2)
  })

  test("a malformed entry is dropped, not fatal; a non-board is undefined", () => {
    const b = parseBoard({ strokes: [{ id: 1 }, board.strokes[0]], symbols: [null, board.symbols[0]] })!
    expect(b.strokes.length).toBe(1)
    expect(b.symbols.length).toBe(1)
    expect(parseBoard({ strokes: [] })).toBeUndefined()
    expect(parseBoard("nope")).toBeUndefined()
  })
})

describe("the board as a scene", () => {
  test("stages every symbol and every stroke, page → scene, camera on the page", () => {
    const Ctor = boardDream("scratch", JSON.parse(serializeBoard(board)))
    const dream = new Ctor() as BoardDream
    expect(dream.roots.length).toBe(2)
    expect(dream.symbols.length).toBe(1)
    expect(dream.byId.c1).toBe(dream.symbols[0])
    const c = dream.symbols[0]! as unknown as { x: { value: number }; y: { value: number } }
    expect(c.x.value).toBe(600)
    expect(c.y.value).toBe(-700)
    expect(dream.ink.length).toBe(1)
    expect(dream.ink[0]).toBeInstanceOf(Line)
    expect(dream.ink[0]!.points[1]).toEqual({ x: 30, y: -40, z: 0 })
    expect(dream.observer.x.value).toBe(PAGE_W / 2)
    expect(dream.observer.y.value).toBe(-PAGE_H / 2)
    expect(dream.duration).toBe(0) // choreography belongs to code
    expect(Ctor.name).toBe("Board scratchDream")
  })

  test("an unknown symbol is skipped, the rest still stage", () => {
    const Ctor = boardDream("x", { strokes: [], symbols: [{ id: "a", symbol: "nope", params: {} }, board.symbols[0]] })
    expect(new Ctor().roots.length).toBe(1)
  })
})

describe("the daemon's board store", () => {
  let root = ""
  const dirs: string[] = []
  afterAll(async () => {
    for (const d of dirs) await rm(d, { recursive: true, force: true })
  })
  const fresh = async () => {
    root = `${await mkdtemp(`${tmpdir()}/boards-`)}/`
    dirs.push(root)
    return root
  }
  const req = (method: string, body?: string) => new Request("http://x/api/board/b", { method, body })

  test("PUT writes the canonical form atomically; GET and the list read it back", async () => {
    const r = await fresh()
    expect((await boardResponse(req("GET"), r, "scratch")).status).toBe(404)
    const put = await boardResponse(req("PUT", JSON.stringify(board)), r, "scratch")
    expect(put.status).toBe(200)
    const files = await readdir(`${r}core/demo/boards`)
    expect(files).toEqual(["scratch.board.json"]) // no temp file left behind
    const got = await (await boardResponse(req("GET"), r, "scratch")).text()
    expect(got).toBe(serializeBoard(parseBoard(board)!))
    const list = await listBoards(r)
    expect(list.map((b) => b.name)).toEqual(["scratch"])
  })

  test("bad names and bad bodies are refused", async () => {
    const r = await fresh()
    expect((await boardResponse(req("GET"), r, "../etc")).status).toBe(400)
    expect((await boardResponse(req("PUT", "{"), r, "a")).status).toBe(400)
    expect((await boardResponse(req("PUT", JSON.stringify({ strokes: 1 })), r, "a")).status).toBe(400)
    expect((await boardResponse(req("DELETE"), r, "a")).status).toBe(405)
  })

  test("the watcher recognises board files and nothing else", () => {
    expect(boardNameOf("boards/scratch.board.json")).toBe("scratch")
    expect(boardNameOf("boards/scratch.board.json.123.tmp")).toBeUndefined()
    expect(boardNameOf("boards/Board.ts")).toBeUndefined()
  })
})
