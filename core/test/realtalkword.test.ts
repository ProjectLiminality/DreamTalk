/**
 * RealTalkWord — ASSTALK in its cloud ↔ REALTALK on its line, one `real`.
 */

import { describe, expect, test } from "bun:test"
import { RealTalkWord } from "../vocabulary/RealTalkWord/RealTalkWord"
import { wordOutline } from "../src/geometry/glyphs"
import { ARIMO } from "../src/geometry/fonts/arimo"
import type { Word } from "../vocabulary/Word/Word"
import { Create } from "../src/verbs"
import { Timeline } from "../src/timeline"
import type { Vec3Like } from "../src/parts/primitives"

const SIZE = 120

/** A part Word's contour points where it stands (its local points + its position). */
const placed = (w: Word): Vec3Like[] => {
  void w.parts
  return w.contours.flatMap((l) => l.points.map((p) => ({ x: p.x + w.x.value, y: p.y + w.y.value, z: 0 })))
}

/** A point set, centred on its box and rounded — for comparing two layouts of one word. */
const normal = (ps: Vec3Like[]): string[] => {
  const xs = ps.map((p) => p.x)
  const ys = ps.map((p) => p.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  return ps.map((p) => `${(p.x - cx).toFixed(4)},${(p.y - cy).toFixed(4)}`).sort()
}

describe("RealTalkWord", () => {
  test("at 0 the parts spell ASSTALK, at 1 REALTALK, glyph for glyph", () => {
    const w = new RealTalkWord({ size: SIZE })
    void w.parts
    const ass = [w.a, w.ss, w.talk].flatMap(placed)
    expect(normal(ass)).toEqual(normal(wordOutline("ASSTALK", ARIMO, { size: SIZE }).flat()))
    w.real.value = 1
    const real = [w.re, w.a, w.l, w.talk].flatMap(placed)
    expect(normal(real)).toEqual(normal(wordOutline("REALTALK", ARIMO, { size: SIZE }).flat()))
  })

  test("the flying pieces start on the S's outlines and land on R, E and L's", () => {
    const w = new RealTalkWord({ size: SIZE })
    void w.parts
    const onto = (pieces: Vec3Like[], outline: Vec3Like[]) => {
      // Every piece endpoint lies on the outline (within a hair of one of its segments).
      const segs = outline.slice(1).map((b, i) => [outline[i]!, b] as const)
      const near = (p: Vec3Like) =>
        segs.some(([a, b]) => {
          const dx = b.x - a.x
          const dy = b.y - a.y
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
          return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y) < 1e-6
        })
      return pieces.every(near)
    }
    w.real.value = 0
    expect(onto(w.pieces.flatMap((l) => l.points), placed(w.ss))).toBe(true)
    w.real.value = 1
    expect(onto(w.pieces.flatMap((l) => l.points), [...placed(w.re), ...placed(w.l)])).toBe(true)
  })

  test("fills hand over at the ends; the cloud lies down into a line", () => {
    const w = new RealTalkWord({ size: SIZE })
    void w.parts
    w.real.value = 0
    expect([w.ss.opacity.value, w.re.opacity.value, w.pieces[0]!.opacity.value]).toEqual([1, 0, 0])
    const tall = (pts: Vec3Like[]) => Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y))
    expect(tall(w.cloud.points)).toBeGreaterThan(SIZE)
    w.real.value = 0.5
    expect([w.ss.opacity.value, w.re.opacity.value, w.pieces[0]!.opacity.value]).toEqual([0, 0, 1])
    w.real.value = 1
    expect([w.ss.opacity.value, w.re.opacity.value, w.re.fillOpacity.value, w.pieces[0]!.opacity.value]).toEqual([0, 1, 1, 0])
    expect(tall(w.cloud.points)).toBeLessThan(1e-9)
    expect(w.speech.every((s) => s.creation.value === 0)).toBe(true)
  })

  test("Create writes it: the cloud, then the letters, the voice last", () => {
    const w = new RealTalkWord({ size: SIZE })
    const tl = new Timeline([{ anim: Create(w), start: 0, duration: 1 }], 1)
    const at = (u: number) => tl.apply(u)
    at(0)
    expect([w.cloud.creation.value, w.a.creation.value, w.speech[0]!.creation.value]).toEqual([0, 0, 0])
    at(0.5)
    expect(w.cloud.creation.value).toBeGreaterThan(0.5)
    expect(w.speech[0]!.creation.value).toBe(0)
    at(1)
    expect([w.cloud.creation.value, w.a.creation.value, w.talk.creation.value, w.speech[0]!.creation.value]).toEqual([1, 1, 1, 1])
  })

  test("one walkable axis, ass ↔ real", () => {
    const axes = new RealTalkWord().stateSpace()!.axes
    expect(axes.map((a) => a.id)).toEqual(["real"])
    expect(axes[0]!.positions.map((x) => x.name)).toEqual(["ass", "real"])
  })
})
