import { describe, expect, test } from "bun:test"
import { OVERLAY_CSS, bufferToClient } from "../editor/overlay"

describe("the one stage → page mapping", () => {
  test("carries a buffer box through the canvas's stretch and offset", () => {
    // A 1280×720 buffer shown in a 640×400 box at (100, 50) in the page.
    const r = bufferToClient({ min: { x: 640, y: 360 }, max: { x: 1280, y: 720 } }, { left: 100, top: 50, width: 640, height: 400 }, { width: 1280, height: 720 })
    expect(r).toEqual({ x: 420, y: 250, w: 320, h: 200 })
  })

  test("full-window overlays pin their CSS size (inset alone leaves a canvas at its buffer size — 2× at DPR 2)", () => {
    expect(OVERLAY_CSS).toContain("width: 100vw")
    expect(OVERLAY_CSS).toContain("height: 100vh")
  })
})
