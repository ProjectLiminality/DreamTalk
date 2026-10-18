/**
 * ib-dreamsong.test.ts — the DreamSong (vocabulary/DreamSong): a page of
 * symbols and text in a DreamNode, and `compress` folding it into one
 * symbol.
 */

import { describe, expect, test } from "bun:test"
import { DreamSongSymbol, SONG, slotSpot, textLines } from "../vocabulary/DreamSongSymbol/DreamSongSymbol"
import { reachOf } from "../vocabulary/DreamNode/DreamNode"
import { Logo } from "../vocabulary/Logo/Logo"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe("DreamSong", () => {
  test("the page: two columns, rows centred, checkerboarded as the film lays it", () => {
    const spots = Array.from({ length: 6 }, (_, i) => slotSpot(i, 6))
    expect(spots.map((s) => Math.sign(s.x))).toEqual([-1, 1, -1, 1, -1, 1])
    near(spots[0]!.y, SONG.rowGap)
    near(spots[2]!.y, 0)
    near(spots[4]!.y, -SONG.rowGap)
    const lines = textLines(5)
    near(lines[0]!.y - lines[1]!.y, SONG.textGap)
    near(lines[2]!.y, 0)
  })

  test("compress 0: the page fills the ring, symbols fitted to their slot; the face is folded away", () => {
    const s = new DreamSongSymbol({ radius: 400 })
    void s.parts
    expect(s.symbols.length).toBe(3)
    expect(s.texts.length).toBe(3)
    near(s.page.scale.value, 4)
    near(s.page.there.value, 1)
    near(s.faceLayer.scale.value, 0)
    for (const sym of s.symbols) near(sym.scale.value * reachOf(sym) * s.page.scale.value, SONG.slotReach * 400)
    expect(s.node.radius.value).toBe(400)
  })

  test("compress 1: the song is one symbol — the Logo at the film's share of the ring", () => {
    const s = new DreamSongSymbol({ radius: 400, compress: 1 })
    void s.parts
    expect(s.face).toBeInstanceOf(Logo)
    near(s.page.scale.value, 0)
    near(s.page.there.value, 0)
    const logo = s.face as Logo
    near(logo.radius.value * logo.scale.value * s.faceLayer.scale.value, SONG.logo * 400)
    s.compress.value = 0.5
    near(s.page.there.value, 0.5)
    expect(s.stateAxis("compress").positions.map((p) => p.name)).toEqual(["song", "symbol"])
  })
})
