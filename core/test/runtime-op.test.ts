/**
 * Timeline editing (EDITOR-V3 leftovers): the setRunTime op as a pure
 * source transformation, and the transport's frame-step math.
 *
 * The op's contract mirrors setOverride's: exact span first, then
 * start-anchored (edits inside a call move its END, never its START);
 * anything less determinate is rejected with a reason. Only a numeric
 * literal is ever rewritten — a named constant or expression is intent
 * the editor must not flatten.
 */

import { describe, expect, test } from "bun:test"
import { applySetRunTime } from "../scripts/ops"
import { FRAME_SECONDS, MIN_RUN_TIME, stepTime } from "../editor/timeline"

const scene = `import { Dream } from "../src/index"

export class S01Dream extends Dream {
  unfold() {
    this.play(Create(this.cylinder), 3)
    this.play(this.cylinder.p.to(PI / 2), 3)
    this.play(together(Create(this.circler), Create(this.rectangler)), 5)
    this.play(FadeIn(this.circle))
    this.play(eased("linear", this.fan()), SIGHT_RUN_TIME)
  }
}
`

/** The byte span of a play() call, located by its exact text. */
const spanOf = (snippet: string): { start: number; end: number } => {
  const start = scene.indexOf(snippet)
  if (start < 0) throw new Error(`snippet not in scene: ${snippet}`)
  return { start, end: start + snippet.length }
}

describe("applySetRunTime", () => {
  test("rewrites the run_time literal of the play() at the exact span", () => {
    const span = spanOf("this.play(together(Create(this.circler), Create(this.rectangler)), 5)")
    const res = applySetRunTime(scene, { op: "setRunTime", span, runTime: 3 })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toBe(
      scene.replace(
        "this.play(together(Create(this.circler), Create(this.rectangler)), 5)",
        "this.play(together(Create(this.circler), Create(this.rectangler)), 3)",
      ),
    )
  })

  test("touches only the targeted call — twins with the same literal survive", () => {
    const span = spanOf("this.play(this.cylinder.p.to(PI / 2), 3)")
    const res = applySetRunTime(scene, { op: "setRunTime", span, runTime: 1.5 })
    if (!res.ok) throw new Error(res.reason)
    // The FIRST play's `, 3)` is untouched; only the second changed.
    expect(res.text).toContain("this.play(Create(this.cylinder), 3)")
    expect(res.text).toContain("this.play(this.cylinder.p.to(PI / 2), 1.5)")
  })

  test("relocates start-anchored when the span's END drifted", () => {
    const span = spanOf("this.play(Create(this.cylinder), 3)")
    const res = applySetRunTime(scene, {
      op: "setRunTime",
      span: { start: span.start, end: span.end + 7 },
      runTime: 2,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain("this.play(Create(this.cylinder), 2)")
  })

  test("makes the default explicit when play() has no run_time argument", () => {
    const span = spanOf("this.play(FadeIn(this.circle))")
    const res = applySetRunTime(scene, { op: "setRunTime", span, runTime: 2.5 })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain("this.play(FadeIn(this.circle), 2.5)")
  })

  test("refuses a non-literal run_time rather than flattening it", () => {
    const span = spanOf('this.play(eased("linear", this.fan()), SIGHT_RUN_TIME)')
    const res = applySetRunTime(scene, { op: "setRunTime", span, runTime: 2 })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toContain("SIGHT_RUN_TIME")
    expect(res.reason).toContain("not a numeric literal")
  })

  test("rejects a span that matches no play() call", () => {
    const res = applySetRunTime(scene, {
      op: "setRunTime",
      span: { start: 1, end: 2 },
      runTime: 2,
    })
    expect(res.ok).toBe(false)
  })

  test("clamps to the minimum duration and rounds to the centisecond", () => {
    const span = spanOf("this.play(Create(this.cylinder), 3)")
    const tiny = applySetRunTime(scene, { op: "setRunTime", span, runTime: 0.01 })
    if (!tiny.ok) throw new Error(tiny.reason)
    expect(tiny.text).toContain(`this.play(Create(this.cylinder), ${MIN_RUN_TIME})`)

    const noisy = applySetRunTime(scene, { op: "setRunTime", span, runTime: 2.3456789 })
    if (!noisy.ok) throw new Error(noisy.reason)
    expect(noisy.text).toContain("this.play(Create(this.cylinder), 2.35)")
  })

  test("rejects a non-finite runTime", () => {
    const span = spanOf("this.play(Create(this.cylinder), 3)")
    expect(applySetRunTime(scene, { op: "setRunTime", span, runTime: NaN }).ok).toBe(false)
    expect(applySetRunTime(scene, { op: "setRunTime", span, runTime: Infinity }).ok).toBe(false)
  })
})

describe("stepTime", () => {
  test("steps exactly one thirtieth of a second", () => {
    expect(stepTime(3, 1, 26)).toBeCloseTo(3 + 1 / 30, 12)
    expect(stepTime(3, -1, 26)).toBeCloseTo(3 - 1 / 30, 12)
    expect(FRAME_SECONDS).toBeCloseTo(1 / 30, 12)
  })

  test("shift steps one second", () => {
    expect(stepTime(3, 1, 26, true)).toBe(4)
    expect(stepTime(3, -1, 26, true)).toBe(2)
  })

  test("clamps at the scene's edges", () => {
    expect(stepTime(0.01, -1, 26)).toBe(0)
    expect(stepTime(0, -1, 26, true)).toBe(0)
    expect(stepTime(25.99, 1, 26)).toBe(26)
    expect(stepTime(26, 1, 26, true)).toBe(26)
  })
})
