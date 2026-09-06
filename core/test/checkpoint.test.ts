/**
 * Checkpoint capture (ONTOLOGY.md "Magic Move", case 1) — the pose→code
 * pipeline as pure functions.
 *
 * Two halves, matching where the logic lives:
 *   - editor/checkpoint.ts: an override set becomes addressable targets
 *     (`this.circle.x` → 241.5), filtered against the timeline's own
 *     values, and the playhead maps to the clip the checkpoint follows;
 *   - scripts/ops.ts: applyAppendCheckpoint emits exactly the statement
 *     a hand would have written, in exactly the right place.
 */

import { describe, expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { Holon } from "../src/holon"
import { scalar } from "../src/params"
import type { Param, ParamValue } from "../src/params"
import { together } from "../src/anim"
import { Overrides } from "../editor/overrides"
import { captureTargets, holonPathOf, placementAt } from "../editor/checkpoint"
import { __dt } from "../editor/anchors"
import { applyAppendCheckpoint } from "../scripts/ops"

const anyParam = (p: Param<number>) => p as unknown as Param<ParamValue>

// --- A small dream to pose --------------------------------------------------

class Pair extends Holon {
  left = new Holon()
  right = new Holon()
}

class PoseDream extends Dream {
  circle = new Holon()
  pair = new Pair()

  unfold() {
    this.play(this.circle.x.to(100), 2)
    this.wait(1)
    this.play(together(this.circle.y.to(50), this.observer.zoom.to(2)), 1)
  }
}

describe("holonPathOf — the identity a hand would write", () => {
  test("a Dream field, a nested part, and the observer", () => {
    const dream = new PoseDream()
    dream.build()
    expect(holonPathOf(dream, dream.circle)).toBe("circle")
    expect(holonPathOf(dream, dream.pair.left as Holon)).toBe("pair.left")
    expect(holonPathOf(dream, dream.observer)).toBe("observer")
  })

  test("an anonymous holon has no path", () => {
    const dream = new PoseDream()
    dream.build()
    expect(holonPathOf(dream, new Holon())).toBeUndefined()
  })

  test("a part living in an array field is indexed", () => {
    class Fan extends Holon {
      blades: Holon[] = []
      protected override compose(): void {
        this.blades.push(this.add(new Holon()), this.add(new Holon()))
      }
    }
    class FanDream extends Dream {
      fan = new Fan()
      unfold() {
        this.play(this.fan.x.to(1), 1)
      }
    }
    const dream = new FanDream()
    dream.build()
    void dream.fan.parts // compose() runs on demand — force the blades into being
    expect(holonPathOf(dream, dream.fan.blades[1]!)).toBe("fan.blades[1]")
  })
})

describe("captureTargets — the pose is the diff against the timeline", () => {
  const posed = () => {
    const dream = new PoseDream()
    const overrides = new Overrides(dream.build())
    return { dream, overrides }
  }

  test("an overridden animated param becomes one target, addressed and rounded", () => {
    const { dream, overrides } = posed()
    dream.applyAt(1)
    overrides.set(anyParam(dream.circle.x), 241.503921)
    expect(captureTargets(dream, overrides, 1)).toEqual([
      { path: "this.circle.x", value: 241.5 },
    ])
  })

  test("an override equal to the timeline's own value at t is no pose", () => {
    const { dream, overrides } = posed()
    dream.applyAt(2) // circle.x has arrived at 100
    overrides.set(anyParam(dream.circle.x), 100)
    expect(captureTargets(dream, overrides, 2)).toEqual([])
  })

  test("observer params round finer — angles are radians", () => {
    const { dream, overrides } = posed()
    dream.applyAt(1)
    overrides.set(anyParam(dream.observer.phi), 0.41237, "observer")
    expect(captureTargets(dream, overrides, 1)).toEqual([
      { path: "this.observer.phi", value: 0.4124 },
    ])
  })

  test("a never-animated param is measured against what it displaced", () => {
    const { dream, overrides } = posed()
    dream.applyAt(1)
    const z = dream.circle.z
    overrides.set(anyParam(z), 30)
    // Displaced 0 → 30 is a pose; overriding back to 0 is not.
    expect(captureTargets(dream, overrides, 1)).toEqual([{ path: "this.circle.z", value: 30 }])
    overrides.set(anyParam(z), 0)
    expect(captureTargets(dream, overrides, 1)).toEqual([])
  })

  test("an unaddressable owner is skipped, not mis-spelled", () => {
    const { dream, overrides } = posed()
    const stray = new Holon()
    overrides.set(anyParam(stray.x), 5)
    expect(captureTargets(dream, overrides, 0)).toEqual([])
  })
})

describe("placementAt — the playhead names the clip the checkpoint follows", () => {
  const clip = (start: number, duration: number, span?: [number, number]) => {
    const c = { anim: { tracks: [] }, start, duration }
    if (span) __dt(c, `core/demo/X.ts:${span[0]}:${span[1]}`)
    return c
  }

  test("inside a clip → after that clip's play statement", () => {
    const clips = [clip(0, 4, [10, 40]), clip(6, 1, [50, 90])]
    expect(placementAt(clips, 2)).toEqual({
      placement: "after",
      anchor: { file: "core/demo/X.ts", start: 10, end: 40 },
    })
  })

  test("in a wait between clips → after the clip already played", () => {
    const clips = [clip(0, 4, [10, 40]), clip(6, 1, [50, 90])]
    expect(placementAt(clips, 5)).toEqual({
      placement: "after",
      anchor: { file: "core/demo/X.ts", start: 10, end: 40 },
    })
  })

  test("past every clip → after the last one", () => {
    const clips = [clip(0, 4, [10, 40]), clip(6, 1, [50, 90])]
    expect(placementAt(clips, 30)).toEqual({
      placement: "after",
      anchor: { file: "core/demo/X.ts", start: 50, end: 90 },
    })
  })

  test("before every clip → before the first", () => {
    const clips = [clip(2, 4, [10, 40])]
    expect(placementAt(clips, 0.5)).toEqual({
      placement: "before",
      anchor: { file: "core/demo/X.ts", start: 10, end: 40 },
    })
  })

  test("no anchored clips at all → the end of unfold", () => {
    expect(placementAt([clip(0, 2)], 1)).toEqual({ placement: "end" })
  })

  test("an unanchored set() clip never becomes the anchor", () => {
    const clips = [clip(0, 4, [10, 40]), clip(4, 0), clip(6, 1, [50, 90])]
    expect(placementAt(clips, 5)).toEqual({
      placement: "after",
      anchor: { file: "core/demo/X.ts", start: 10, end: 40 },
    })
  })
})

// --- The op: source in, source out ------------------------------------------

const scene = `/**
 * S.ts — A DreamWeaving
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Create } from "../../src/verbs"

export class SDream extends Dream {
  unfold() {
    this.play(Create(this.circle), 4)
    this.wait(2)
    this.play(this.observer.zoom.to(7 / 4), 1)
    this.wait(1)
  }
}

if (import.meta.main) render(SDream)
`

const spanOf = (text: string, needle: string): { start: number; end: number } => {
  const start = text.indexOf(needle)
  if (start < 0) throw new Error(`needle not in text: ${needle}`)
  return { start, end: start + needle.length }
}

describe("applyAppendCheckpoint — the emitted code", () => {
  test("one target: a single line after the anchored play, all other bytes intact", () => {
    const res = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "after",
      anchor: spanOf(scene, "this.play(Create(this.circle), 4)"),
      targets: [{ path: "this.circle.x", value: 241.5 }],
    })
    if (!res.ok) throw new Error(res.reason)
    const inserted = `    this.play(this.circle.x.to(241.5), 1)\n`
    expect(res.text).toBe(
      scene.replace(
        "    this.play(Create(this.circle), 4)\n",
        `    this.play(Create(this.circle), 4)\n${inserted}`,
      ),
    )
  })

  test("several targets: the together spelling, multi-line, scene idiom", () => {
    const res = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "after",
      anchor: spanOf(scene, "this.play(this.observer.zoom.to(7 / 4), 1)"),
      targets: [
        { path: "this.circle.x", value: 241.5 },
        { path: "this.circle.y", value: 40.6 },
        { path: "this.observer.phi", value: 0.4124 },
      ],
      duration: 1,
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toBe(
      scene.replace(
        "    this.play(this.observer.zoom.to(7 / 4), 1)\n",
        `    this.play(this.observer.zoom.to(7 / 4), 1)
    this.play(
      together(
        this.circle.x.to(241.5),
        this.circle.y.to(40.6),
        this.observer.phi.to(0.4124),
      ),
      1,
    )
`,
      ),
    )
  })

  test("a missing together import joins the existing index import", () => {
    const bare = scene.replace(`import { together } from "../../src/anim"\n`, "")
    const res = applyAppendCheckpoint(bare, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [
        { path: "this.circle.x", value: 1 },
        { path: "this.circle.y", value: 2 },
      ],
      file: "core/demo/video01/S.ts",
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain(`import { Dream, render, together } from "../../src/index"`)
  })

  test("no extensible import at all: a fresh one, path computed from the file", () => {
    const bare = scene
      .replace(`import { together } from "../../src/anim"\n`, "")
      .replace(`import { Dream, render } from "../../src/index"\n`, "")
    const res = applyAppendCheckpoint(bare, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [
        { path: "this.circle.x", value: 1 },
        { path: "this.circle.y", value: 2 },
      ],
      file: "core/demo/video01/S.ts",
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain(`import { together } from "../../src/anim"`)
  })

  test("placement 'before' and placement 'end'", () => {
    const before = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "before",
      anchor: spanOf(scene, "this.play(Create(this.circle), 4)"),
      targets: [{ path: "this.circle.x", value: 5 }],
    })
    if (!before.ok) throw new Error(before.reason)
    expect(before.text).toContain(
      `  unfold() {\n    this.play(this.circle.x.to(5), 1)\n    this.play(Create(this.circle), 4)`,
    )

    const end = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [{ path: "this.circle.x", value: 5 }],
    })
    if (!end.ok) throw new Error(end.reason)
    expect(end.text).toContain(`    this.wait(1)\n    this.play(this.circle.x.to(5), 1)\n  }`)
  })

  test("sequential captures accumulate — the second lands after its own clip", () => {
    const first = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "after",
      anchor: spanOf(scene, "this.play(Create(this.circle), 4)"),
      targets: [{ path: "this.circle.x", value: 10 }],
    })
    if (!first.ok) throw new Error(first.reason)
    // After the reload round-trip the client re-anchors; the second capture
    // targets the checkpoint clip itself, exactly as it would any play().
    const second = applyAppendCheckpoint(first.text, {
      op: "appendCheckpoint",
      placement: "after",
      anchor: spanOf(first.text, "this.play(this.circle.x.to(10), 1)"),
      targets: [{ path: "this.circle.y", value: 20 }],
    })
    if (!second.ok) throw new Error(second.reason)
    expect(second.text).toContain(
      `    this.play(this.circle.x.to(10), 1)\n    this.play(this.circle.y.to(20), 1)\n`,
    )
  })

  test("a comment above the anchored play does not shift the insertion", () => {
    // The bug this pins: insertStatements() counts comment nodes as
    // statements, so the index must be found in the with-comments list —
    // otherwise every prose comment above the anchor moves the checkpoint
    // up by one, landing it BEFORE the clip it should follow.
    const commented = scene.replace(
      "    this.play(Create(this.circle), 4)",
      "    // the opening build, straight from the 2021 source\n    this.play(Create(this.circle), 4)",
    )
    const res = applyAppendCheckpoint(commented, {
      op: "appendCheckpoint",
      placement: "after",
      anchor: spanOf(commented, "this.play(Create(this.circle), 4)"),
      targets: [{ path: "this.circle.x", value: 7 }],
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain(
      `    this.play(Create(this.circle), 4)\n    this.play(this.circle.x.to(7), 1)\n    this.wait(2)`,
    )
  })

  test("booleans spell as literals", () => {
    const res = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [{ path: "this.circle.visibleFlag", value: true }],
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toContain(`this.play(this.circle.visibleFlag.to(true), 1)`)
  })

  test("refusals: empty pose, foul path, drifted span, non-finite value", () => {
    const empty = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [],
    })
    expect(empty.ok).toBe(false)

    const foul = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [{ path: "this.circle.x); doEvil(", value: 1 }],
    })
    expect(foul.ok).toBe(false)

    const drifted = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "after",
      anchor: { start: 100000, end: 100040 },
      targets: [{ path: "this.circle.x", value: 1 }],
    })
    expect(drifted.ok).toBe(false)

    const nan = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [{ path: "this.circle.x", value: Number.NaN }],
    })
    expect(nan.ok).toBe(false)
  })
})
