/**
 * Player mode (?mode=player) — the pure halves of the mode switch.
 *
 * The player is a strip-down of the editor (LOOPS.md), and the switch
 * between the two presentations is a URL swap. What is pinned here:
 * mode detection, and that leaving the player lands the creator editor
 * on the SAME scene at the SAME t with every other param preserved.
 */

import { describe, expect, test } from "bun:test"
import { exitUrl, isPlayerMode } from "../editor/player"

describe("isPlayerMode", () => {
  test("only ?mode=player is the player", () => {
    expect(isPlayerMode("?mode=player")).toBe(true)
    expect(isPlayerMode("?scene=s02&mode=player")).toBe(true)
    expect(isPlayerMode("?scene=s02")).toBe(false)
    // `mode` doubles as the backdrop blend mode in creator URLs — those
    // must never be read as the player.
    expect(isPlayerMode("?backdrop=/refs/x.png&mode=overlay")).toBe(false)
    expect(isPlayerMode("")).toBe(false)
  })
})

describe("exitUrl", () => {
  test("drops the mode, pins t, keeps the scene", () => {
    const url = exitUrl("?scene=s02&mode=player", 3.2)
    const q = new URLSearchParams(url)
    expect(q.get("mode")).toBeNull()
    expect(q.get("scene")).toBe("s02")
    expect(q.get("t")).toBe("3.20")
  })

  test("overwrites a stale t and drops autoplay", () => {
    const q = new URLSearchParams(exitUrl("?scene=s01&mode=player&t=0.00&autoplay=0", 14))
    expect(q.get("t")).toBe("14.00")
    expect(q.get("autoplay")).toBeNull()
    expect(q.get("mode")).toBeNull()
  })

  test("preserves params it does not own", () => {
    const q = new URLSearchParams(exitUrl("?scene=s04&mode=player&code=1", 1.5))
    expect(q.get("code")).toBe("1")
    expect(q.get("scene")).toBe("s04")
  })
})
