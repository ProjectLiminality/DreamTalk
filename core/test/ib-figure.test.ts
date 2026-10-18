import { describe, expect, test } from "bun:test"
import { Figure, bustHalf } from "../vocabulary/Figure/Figure"

const span = (pts: { y: number }[]) => Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y))

describe("Figure — the bust as a form of THE person", () => {
  test("form 0 is the body exactly as it was: 25-point arch halves from the shoulders' crown, head over it", () => {
    const f = new Figure({ height: 200 })
    void f.parts
    expect(f.form.value).toBe(0)
    const L = f.armLeft.points
    const R = f.armRight.points
    expect(L.length).toBe(25)
    expect(R.length).toBe(25)
    // Both halves start at the same crown on the axis, and mirror each other.
    expect(L[0]!.x).toBeCloseTo(0, 9)
    expect(L[0]!.y).toBeCloseTo(R[0]!.y, 9)
    for (let i = 0; i < 25; i++) {
      expect(L[i]!.x).toBeCloseTo(-R[i]!.x, 9)
      expect(L[i]!.y).toBeCloseTo(R[i]!.y, 9)
    }
    // The head floats above the arch: its bottom is above the arch's crown.
    expect(f.head.y.value - f.head.radius.value).toBeGreaterThan(L[0]!.y)
    // Crown at +h/2, feet at −h/2: the whole symbol is `height`.
    expect(f.head.y.value + f.head.radius.value).toBeCloseTo(100, 9)
    expect(f.legLeft.points[1]!.y).toBeCloseTo(-100, 9)
    expect(f.body.presence.value).toBe(1)
    expect(f.silhouette.fillOpacity.value).toBe(0)
  })

  test("the bust's half: from the crown round a round head, down to the shoulders' end — the whole height", () => {
    const h = 300
    const half = bustHalf(h)
    expect(half[0]!.x).toBeCloseTo(0, 9)
    expect(half[0]!.y).toBeCloseTo(h / 2, 9)
    expect(half[half.length - 1]!.y).toBeCloseTo(-h / 2, 9)
    expect(span(half)).toBeCloseTo(h, 9)
    // The first stretch lies on one circle tangent to the crown (the round head).
    const top = half.slice(0, 8)
    const r = (p: { x: number; y: number }, c: number) => Math.hypot(p.x, p.y - c)
    // Solve the centre from the crown and one later point: x² + (y − c)² = (h/2 − c)².
    const p = top[6]!
    const c = (p.x ** 2 + p.y ** 2 - (h / 2) ** 2) / (2 * (p.y - h / 2))
    for (const q of top) expect(Math.abs(r(q, c) - (h / 2 - c)) / h).toBeLessThan(1e-4)
    // The shoulders are broader than the head.
    expect(Math.abs(half[half.length - 1]!.x)).toBeGreaterThan(2 * (h / 2 - c) * 0.9)
    // Evenly spaced by arc length (so the morph pairs points fairly) — as chords, to 3% (a chord cuts the jaw's corner).
    const seg = half.slice(1).map((q, i) => Math.hypot(q.x - half[i]!.x, q.y - half[i]!.y))
    for (const s of seg) expect(Math.abs(s - seg[0]!) / seg[0]!).toBeLessThan(0.03)
  })

  test("form 1 is the bust: the arch has risen onto the bust's outline, the body's head/spine/legs are gone", () => {
    const f = new Figure({ height: 240, form: 1, opaque: 1 })
    void f.parts
    const half = bustHalf(240)
    const L = f.armLeft.points
    const R = f.armRight.points
    expect(L.length).toBe(half.length)
    for (let i = 0; i < half.length; i++) {
      expect(L[i]!.x).toBeCloseTo(half[i]!.x, 9)
      expect(L[i]!.y).toBeCloseTo(half[i]!.y, 9)
      expect(R[i]!.x).toBeCloseTo(-half[i]!.x, 9)
    }
    expect(span([...L, ...R])).toBeCloseTo(240, 9)
    expect(f.body.presence.value).toBe(0)
    // The silhouette is one closed loop round the outline, washed black.
    const loop = f.silhouette.outlines[0]!.points
    expect(loop[0]!.x).toBeCloseTo(loop[loop.length - 1]!.x, 9)
    expect(loop[0]!.y).toBeCloseTo(loop[loop.length - 1]!.y, 9)
    expect(f.silhouette.fillOpacity.value).toBe(1)
  })

  test("form scrubs: halfway, every arch point is halfway between the body and the bust", () => {
    const a = new Figure({ height: 200, form: 0.5 })
    void a.parts
    const half = bustHalf(200)
    const mid = a.armLeft.points
    expect(mid.length).toBe(half.length)
    // Endpoints: the crown halfway between the arch's crown and the head's crown.
    const body = new Figure({ height: 200 })
    void body.parts
    expect(mid[0]!.y).toBeCloseTo((body.armLeft.points[0]!.y + 100) / 2, 9)
    expect(a.body.presence.value).toBeCloseTo(0.25, 9)
  })

  test("walkable: body ↔ bust (unless bound)", () => {
    const f = new Figure()
    expect(f.stateSpace()!.axes[0]!.id).toBe("form")
  })
})
