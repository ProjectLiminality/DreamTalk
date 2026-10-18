/**
 * Links to any state (demo/toolkit.ts): the state a link holds survives the
 * URL unchanged, and a broken link is no state rather than a wrong one.
 */

import { describe, expect, test } from "bun:test"
import { decodeState, encodeState, SHIFTED_DIGITS, PRESENTER_KEY, MINIMAP_KEY, type LinkState } from "../demo/toolkit"
import { RESERVED_KEYS } from "../src/automaton"

describe("a link to a state", () => {
  test("encodes URL-safe and decodes to the same state, nest names and all", () => {
    const s: LinkState = { t: 225.5, f: { c: 3.25, j: [[1.5, 0, 2], [2.75, 3, 0]] }, v: [0.3, 0, 0, 0.2, 0, 0, 0], n: ["CoherenceBeacon", "Earth ◇"] }
    const code = encodeState(s)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeState(code)).toEqual(s)
  })

  test("a broken or missing code is no state", () => {
    expect(decodeState(null)).toBeUndefined()
    expect(decodeState("not-a-state")).toBeUndefined()
    expect(decodeState(encodeState({ t: 1 }).slice(0, 3))).toBeUndefined()
  })

  test("its keys are the player's own", () => {
    for (const k of [PRESENTER_KEY, MINIMAP_KEY, ...SHIFTED_DIGITS]) expect(RESERVED_KEYS).toContain(k)
  })
})
