/**
 * The SVG importer — parser grammar, frame changes, and the corpus.
 *
 * The parser is tested against paths whose answers are computable by
 * hand, so a failure names the command that broke rather than "the
 * drawing looks wrong". The corpus tests then pin the two facts the rest
 * of the Origins campaign leans on: david.svg is 37 pen strokes, and the
 * generated modules are what this parser produces today.
 */

import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
  FLATTEN_TOLERANCE,
  IDENTITY,
  applyMatrix,
  importSvg,
  multiply,
  parsePathData,
  parseTransform,
  type Vec2,
} from "../src/geometry/svg"
import { Sketch } from "../vocabulary/Sketch/Sketch"
import { david } from "../vocabulary/Sketch/assets/david"
import type { SketchData } from "../vocabulary/Sketch/data"

const SVG_DIR = join(import.meta.dir, "../../refs/pitch/svg-assets/svg")
const ASSET_DIR = join(import.meta.dir, "../vocabulary/Sketch/assets")

const readAsset = (name: string): string => readFileSync(join(SVG_DIR, `${name}.svg`), "utf8")

/** Wrap bare path data in a minimal document with a 1:1 viewBox. */
const doc = (d: string, extra = ""): string =>
  `<svg viewBox="0 0 100 100" width="100" height="100"${extra}><path d="${d}"/></svg>`

const near = (a: number, b: number, eps = 1e-6): void => expect(Math.abs(a - b) < eps).toBe(true)

const closeTo = (p: Vec2 | undefined, x: number, y: number, eps = 1e-6): void => {
  expect(p).toBeDefined()
  near(p!.x, x, eps)
  near(p!.y, y, eps)
}

describe("path grammar", () => {
  test("M/L absolute — one subpath, points verbatim", () => {
    const [sp] = parsePathData("M10 20 L30 40 L50 20")
    expect(sp!.points).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 20 },
    ])
    expect(sp!.closed).toBe(false)
  })

  test("m/l relative accumulate from the pen", () => {
    const [sp] = parsePathData("m10 20 l10 0 l0 10")
    expect(sp!.points).toEqual([
      { x: 10, y: 20 },
      { x: 20, y: 20 },
      { x: 20, y: 30 },
    ])
  })

  test("implicit repetition — a lone M then a stream of pairs is M then Ls", () => {
    const [sp] = parsePathData("M0 0 10 0 10 10 0 10")
    expect(sp!.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ])
  })

  test("H/V, absolute and relative", () => {
    const [sp] = parsePathData("M5 5 H15 V25 h-5 v-5")
    expect(sp!.points).toEqual([
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 15, y: 25 },
      { x: 10, y: 25 },
      { x: 10, y: 20 },
    ])
  })

  test("Z closes to the subpath start and marks it closed", () => {
    const [sp] = parsePathData("M0 0 L10 0 L10 10 Z")
    expect(sp!.closed).toBe(true)
    expect(sp!.points[sp!.points.length - 1]).toEqual({ x: 0, y: 0 })
  })

  test("a command after Z resumes from the closed subpath's start", () => {
    const sps = parsePathData("M10 10 L20 10 Z l0 10")
    expect(sps.length).toBe(2)
    // The second subpath begins at (10,10) — the start, not (20,10).
    expect(sps[1]!.points[0]).toEqual({ x: 10, y: 10 })
    expect(sps[1]!.points[1]).toEqual({ x: 10, y: 20 })
  })

  test("multiple M commands split into separate subpaths", () => {
    const sps = parsePathData("M0 0 L1 0 M5 5 L6 5 M9 9 L9 10")
    expect(sps.length).toBe(3)
  })

  test("a subpath of one point is dropped — nothing to draw", () => {
    expect(parsePathData("M3 3").length).toBe(0)
  })

  test("cubic C — endpoints exact, midpoint on the curve, all points between", () => {
    // A symmetric cubic from (0,0) to (100,0), controls pulling y to 75:
    // B(1/2) = (0+3·0+3·100+100)/8 x, (0+3·100+3·100+0)/8 y = (50, 75).
    const [sp] = parsePathData("M0 0 C0 100 100 100 100 0")
    const pts = sp!.points
    closeTo(pts[0], 0, 0)
    closeTo(pts[pts.length - 1], 100, 0)
    const mid = pts[Math.floor(pts.length / 2)]!
    // The parameter midpoint is the geometric apex here by symmetry.
    const apex = pts.reduce((best, p) => (p.y > best.y ? p : best), pts[0]!)
    closeTo(apex, 50, 75, 0.5)
    expect(mid.y).toBeGreaterThan(0)
    // Flatness: no point strays outside the control hull's y range.
    for (const p of pts) {
      expect(p.y).toBeGreaterThanOrEqual(-1e-9)
      expect(p.y).toBeLessThanOrEqual(75 + 1e-9)
    }
  })

  test("a degenerate cubic (all controls on the chord) is one segment", () => {
    const [sp] = parsePathData("M0 0 C10 0 20 0 30 0")
    expect(sp!.points.length).toBe(2)
    closeTo(sp!.points[1], 30, 0)
  })

  test("implicit repetition of C — the Pixelmator streaming form", () => {
    // One C carrying two triples is two curve segments, so the pen
    // reaches (200,0) via (100,0). This is the form david.svg is in.
    const [sp] = parsePathData("M0 0 C0 0 100 0 100 0 100 0 200 0 200 0")
    closeTo(sp!.points[sp!.points.length - 1], 200, 0)
  })

  test("S reflects the previous cubic's control through the pen", () => {
    // After C…(controls end at (40,60)) the pen is at (50,50); S's first
    // control is the reflection (60,40). An explicit C with that control
    // must produce identical geometry.
    const withS = parsePathData("M0 0 C10 40 40 60 50 50 S90 10 100 0")
    const withC = parsePathData("M0 0 C10 40 40 60 50 50 C60 40 90 10 100 0")
    expect(withS[0]!.points).toEqual(withC[0]!.points)
  })

  test("S with no preceding curve uses the pen as its first control", () => {
    const withS = parsePathData("M0 0 S50 50 100 0")
    const withC = parsePathData("M0 0 C0 0 50 50 100 0")
    expect(withS[0]!.points).toEqual(withC[0]!.points)
  })

  test("quadratic Q equals its cubic elevation", () => {
    // Q(p0,q,p2) ≡ C(p0 + 2/3(q-p0), p2 + 2/3(q-p2), p2).
    const q = parsePathData("M0 0 Q50 100 100 0")
    const c = parsePathData("M0 0 C33.333333333 66.666666667 66.666666667 66.666666667 100 0")
    expect(q[0]!.points.length).toBe(c[0]!.points.length)
    for (let i = 0; i < q[0]!.points.length; i++) {
      closeTo(q[0]!.points[i], c[0]!.points[i]!.x, c[0]!.points[i]!.y, 1e-4)
    }
  })

  test("T reflects the previous quadratic's control", () => {
    const withT = parsePathData("M0 0 Q50 50 100 0 T200 0")
    const withQ = parsePathData("M0 0 Q50 50 100 0 Q150 -50 200 0")
    expect(withT[0]!.points).toEqual(withQ[0]!.points)
  })

  test("arc A — a quarter circle passes through its expected midpoint", () => {
    // r=100 from (100,0) to (0,100), small arc, sweep 1 → centered on
    // the origin, so the arc's midpoint is (r/√2, r/√2).
    const [sp] = parsePathData("M100 0 A100 100 0 0 1 0 100")
    const pts = sp!.points
    closeTo(pts[pts.length - 1], 0, 100, 1e-6)
    for (const p of pts) near(Math.hypot(p.x, p.y), 100, 0.5)
    const mid = pts[Math.floor(pts.length / 2)]!
    closeTo(mid, 70.7106781, 70.7106781, 1)
  })

  test("arc A — the large-arc flag takes the long way round", () => {
    // Same endpoints, same sweep, different arc: the small one is the
    // quarter centered on the origin (radius 100, so x never exceeds
    // 100); the large one is the three-quarters centered on (100,100),
    // which bulges out past x = 198. Both verified against the SVG 1.1
    // F.6.5 procedure computed independently.
    const short = parsePathData("M100 0 A100 100 0 0 1 0 100")[0]!.points
    const long = parsePathData("M100 0 A100 100 0 1 1 0 100")[0]!.points
    expect(long.length).toBeGreaterThan(short.length)
    expect(Math.max(...short.map((p) => p.x))).toBeLessThan(100 + 1e-6)
    expect(Math.max(...long.map((p) => p.x))).toBeGreaterThan(190)
    for (const p of long) near(Math.hypot(p.x - 100, p.y - 100), 100, 0.5)
  })

  test("arc A — radii too small to reach are scaled up (spec F.6.6)", () => {
    // r=10 cannot span a 200-unit chord; the spec grows it to exactly 100.
    const [sp] = parsePathData("M-100 0 A10 10 0 0 1 100 0")
    for (const p of sp!.points) near(Math.hypot(p.x, p.y), 100, 1)
  })

  test("arc A — a zero radius degenerates to a line", () => {
    const [sp] = parsePathData("M0 0 A0 0 0 0 1 100 0")
    expect(sp!.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ])
  })

  test("arc flags may be written without separators", () => {
    // "011-100" is flag 0, flag 1, then the number 1 — the flags are
    // single characters and the coordinate runs on from there.
    const packed = parsePathData("M100 0a100 100 0 011-100")
    const spaced = parsePathData("M100 0 a100 100 0 0 1 1 -100")
    expect(packed[0]!.points).toEqual(spaced[0]!.points)
  })

  test("scientific notation and no-separator negatives scan as numbers", () => {
    const [sp] = parsePathData("M1e2 2.5e-1L-5-6")
    expect(sp!.points).toEqual([
      { x: 100, y: 0.25 },
      { x: -5, y: -6 },
    ])
  })

  test("a trailing 'e' that is not an exponent belongs to no number", () => {
    // ".5.5" is two numbers, not one — the classic scanner trap.
    const [sp] = parsePathData("M.5.5L1.5.5")
    expect(sp!.points).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 1.5, y: 0.5 },
    ])
  })

  test("finer tolerance yields more points on the same curve", () => {
    const coarse = parsePathData("M0 0 C0 100 100 100 100 0", 5)[0]!.points.length
    const fine = parsePathData("M0 0 C0 100 100 100 100 0", 0.01)[0]!.points.length
    expect(fine).toBeGreaterThan(coarse)
  })

  test("malformed data fails loudly, naming the offset", () => {
    expect(() => parsePathData("M0 0 L10")).toThrow(/expected a number/)
    expect(() => parsePathData("M0 0 X5 5")).toThrow()
    expect(() => parsePathData("M0 0 Z5")).toThrow(/closepath takes no arguments/)
    // Every error names the offset, so a 124KB attribute is debuggable.
    expect(() => parsePathData("M0 0 L10")).toThrow(/offset/)
  })

  test("path data must begin with a moveto", () => {
    // Spec 8.3.2 — anything else has no defined starting pen.
    expect(() => parsePathData("L10 10")).toThrow(/must begin with a moveto/)
    expect(() => parsePathData("C0 0 1 1 2 2")).toThrow(/must begin with a moveto/)
    expect(() => parsePathData("10 10 20 20")).toThrow(/must begin with a command/)
  })
})

describe("transforms", () => {
  test("translate, scale, rotate compose left-to-right (leftmost outermost)", () => {
    const m = parseTransform("translate(10, 20) scale(2)")
    // The point is scaled first, then translated.
    closeTo(applyMatrix(m, { x: 3, y: 4 }), 16, 28)
  })

  test("rotate(90) turns +x into +y (SVG's y-down frame)", () => {
    const m = parseTransform("rotate(90)")
    closeTo(applyMatrix(m, { x: 1, y: 0 }), 0, 1, 1e-9)
  })

  test("rotate about a center leaves that center fixed", () => {
    const m = parseTransform("rotate(37, 50, 60)")
    closeTo(applyMatrix(m, { x: 50, y: 60 }), 50, 60, 1e-9)
  })

  test("matrix() is taken verbatim", () => {
    const m = parseTransform("matrix(1 2 3 4 5 6)")
    expect(m).toEqual({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 })
    closeTo(applyMatrix(m, { x: 1, y: 1 }), 9, 12)
  })

  test("skewX shears x by the tangent of the angle", () => {
    const m = parseTransform("skewX(45)")
    closeTo(applyMatrix(m, { x: 0, y: 10 }), 10, 10, 1e-9)
  })

  test("multiply is associative with identity", () => {
    const m = parseTransform("translate(3,4) rotate(20) scale(1.5)")
    expect(multiply(m, IDENTITY)).toEqual(m)
    expect(multiply(IDENTITY, m)).toEqual(m)
  })

  test("an unsupported transform function is an error, not a silent skip", () => {
    expect(() => parseTransform("wobble(3)")).toThrow(/unsupported/)
  })

  test("nested group transforms accumulate outermost-first", () => {
    const svg =
      `<svg viewBox="0 0 100 100" width="100" height="100">` +
      `<g transform="translate(10,0)"><g transform="scale(2)">` +
      `<path d="M1 0 L2 0"/></g></g></svg>`
    const { subpaths } = importSvg(svg, { height: null, center: false })
    // scale then translate: x = 10 + 2·1 = 12 and 10 + 2·2 = 14; y flipped.
    closeTo(subpaths[0]![0]!, 12, 0)
    closeTo(subpaths[0]![1]!, 14, 0)
  })

  test("a transform on the shape itself applies under its group's", () => {
    const svg =
      `<svg viewBox="0 0 100 100" width="100" height="100">` +
      `<g transform="translate(100,0)"><path transform="scale(3)" d="M1 0 L2 0"/></g></svg>`
    const { subpaths } = importSvg(svg, { height: null, center: false })
    closeTo(subpaths[0]![0]!, 103, 0)
  })
})

describe("viewBox and the frame change", () => {
  test("a viewBox offset shifts the geometry to the viewport origin", () => {
    const svg = `<svg viewBox="50 50 100 100" width="100" height="100"><path d="M50 50 L60 50"/></svg>`
    const { subpaths } = importSvg(svg, { height: null, center: false })
    closeTo(subpaths[0]![0]!, 0, 0)
    closeTo(subpaths[0]![1]!, 10, 0)
  })

  test("a viewBox smaller than the viewport scales up uniformly", () => {
    const svg = `<svg viewBox="0 0 10 10" width="100" height="100"><path d="M0 0 L10 0"/></svg>`
    const { subpaths } = importSvg(svg, { height: null, center: false })
    closeTo(subpaths[0]![1]!, 100, 0)
  })

  test("a non-matching aspect uses meet — uniform scale, centered", () => {
    // A 10x10 box into a 100x50 viewport: scale 5, centered with 25 of
    // slack on each side in x.
    const svg = `<svg viewBox="0 0 10 10" width="100" height="50"><path d="M0 0 L10 10"/></svg>`
    const { subpaths } = importSvg(svg, { height: null, center: false })
    closeTo(subpaths[0]![0]!, 25, 0)
    closeTo(subpaths[0]![1]!, 75, -50)
  })

  test("y is flipped — SVG grows down, DreamTalk grows up", () => {
    const { subpaths } = importSvg(doc("M0 0 L0 50"), { height: null, center: false })
    closeTo(subpaths[0]![0]!, 0, 0)
    closeTo(subpaths[0]![1]!, 0, -50)
  })

  test("no viewBox at all is legal — user units pass through", () => {
    const { subpaths } = importSvg(`<svg><path d="M0 0 L7 0"/></svg>`, {
      height: null,
      center: false,
    })
    closeTo(subpaths[0]![1]!, 7, 0)
  })
})

describe("centering and scale (the pydeation contract)", () => {
  test("centering puts the bounding box's center on the origin", () => {
    // A 40x20 box sitting off-center in the document.
    const { subpaths, bounds } = importSvg(doc("M10 10 L50 10 L50 30 L10 30 Z"), { height: null })
    const xs = subpaths.flat().map((p) => p.x)
    const ys = subpaths.flat().map((p) => p.y)
    near((Math.min(...xs) + Math.max(...xs)) / 2, 0)
    near((Math.min(...ys) + Math.max(...ys)) / 2, 0)
    near(bounds.maxX - bounds.minX, 40)
    near(bounds.maxY - bounds.minY, 20)
  })

  test("height scales the bounding box to exactly that height", () => {
    const { subpaths, bounds } = importSvg(doc("M10 10 L50 10 L50 30 L10 30 Z"), { height: 100 })
    near(bounds.maxY - bounds.minY, 100)
    const ys = subpaths.flat().map((p) => p.y)
    near(Math.max(...ys) - Math.min(...ys), 100)
  })

  test("scaling preserves aspect — a 2:1 drawing stays 2:1", () => {
    const { bounds } = importSvg(doc("M0 0 L40 0 L40 20 L0 20 Z"), { height: 200 })
    near((bounds.maxX - bounds.minX) / (bounds.maxY - bounds.minY), 2)
  })

  test("center: false leaves the geometry where the document put it", () => {
    const { subpaths } = importSvg(doc("M10 10 L50 10"), { height: null, center: false })
    closeTo(subpaths[0]![0]!, 10, -10)
  })

  test("an empty document yields empty geometry, not a crash", () => {
    const g = importSvg(`<svg viewBox="0 0 10 10" width="10" height="10"></svg>`, { height: 100 })
    expect(g.subpaths).toEqual([])
    expect(g.bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 })
  })
})

describe("basic shape elements", () => {
  // No asset in the 2021 corpus uses one (man.svg's circle and rect are
  // COMMENTED OUT Inkscape guides), so these are the only coverage they
  // get — and the reason they exist is the next drawing, not this one.
  const wrap = (body: string): string =>
    `<svg viewBox="0 0 100 100" width="100" height="100">${body}</svg>`

  test("rect — four corners, closed", () => {
    const g = importSvg(wrap(`<rect x="10" y="20" width="30" height="40"/>`), {
      height: null,
      center: false,
    })
    expect(g.subpaths.length).toBe(1)
    expect(g.closedFlags[0]).toBe(true)
    closeTo(g.subpaths[0]![0]!, 10, -20)
    expect(g.subpaths[0]!.length).toBe(5)
  })

  test("rect with rx — corners become arcs", () => {
    const g = importSvg(wrap(`<rect x="0" y="0" width="40" height="40" rx="10"/>`), {
      height: null,
      center: false,
    })
    expect(g.subpaths[0]!.length).toBeGreaterThan(8)
    // No point escapes the rect.
    for (const p of g.subpaths[0]!) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6)
      expect(p.x).toBeLessThanOrEqual(40 + 1e-6)
    }
  })

  test("circle — every point at radius r from the center", () => {
    const g = importSvg(wrap(`<circle cx="50" cy="50" r="25"/>`), { height: null, center: false })
    expect(g.closedFlags[0]).toBe(true)
    for (const p of g.subpaths[0]!) near(Math.hypot(p.x - 50, p.y + 50), 25, 1e-9)
  })

  test("ellipse — radii honoured independently", () => {
    const g = importSvg(wrap(`<ellipse cx="0" cy="0" rx="30" ry="10"/>`), {
      height: null,
      center: false,
    })
    const xs = g.subpaths[0]!.map((p) => p.x)
    const ys = g.subpaths[0]!.map((p) => p.y)
    near(Math.max(...xs), 30, 1e-9)
    near(Math.max(...ys), 10, 1e-9)
  })

  test("line — two points, open", () => {
    const g = importSvg(wrap(`<line x1="1" y1="2" x2="3" y2="4"/>`), {
      height: null,
      center: false,
    })
    expect(g.closedFlags[0]).toBe(false)
    closeTo(g.subpaths[0]![0]!, 1, -2)
    closeTo(g.subpaths[0]![1]!, 3, -4)
  })

  test("polyline stays open; polygon closes back to its first point", () => {
    const poly = importSvg(wrap(`<polyline points="0,0 10,0 10,10"/>`), {
      height: null,
      center: false,
    })
    expect(poly.closedFlags[0]).toBe(false)
    expect(poly.subpaths[0]!.length).toBe(3)
    const gon = importSvg(wrap(`<polygon points="0,0 10,0 10,10"/>`), {
      height: null,
      center: false,
    })
    expect(gon.closedFlags[0]).toBe(true)
    expect(gon.subpaths[0]!.length).toBe(4)
    closeTo(gon.subpaths[0]![3]!, 0, 0)
  })

  test("defs content is not drawn", () => {
    const g = importSvg(wrap(`<defs><path d="M0 0 L9 9"/></defs><path d="M0 0 L1 0"/>`), {
      height: null,
      center: false,
    })
    expect(g.subpaths.length).toBe(1)
    closeTo(g.subpaths[0]![1]!, 1, 0)
  })

  test("an unconvertible drawable element is reported, not silently dropped", () => {
    const g = importSvg(wrap(`<text x="0" y="0">hi</text><path d="M0 0 L1 0"/>`), { height: null })
    expect(g.skipped).toContain("text")
    expect(g.subpaths.length).toBe(1)
  })

  test("comments are not markup — man.svg's guides stay out", () => {
    const g = importSvg(wrap(`<!-- <circle cx="0" cy="0" r="9"/> --><path d="M0 0 L1 0"/>`), {
      height: null,
    })
    expect(g.subpaths.length).toBe(1)
  })
})

describe("the 2021 corpus", () => {
  test("david.svg parses to exactly 37 subpaths — the 37 pen strokes", () => {
    const g = importSvg(readAsset("david"), { height: 400 })
    expect(g.subpaths.length).toBe(37)
    expect(g.skipped).toEqual([])
  })

  test("david's generated module matches the live parse, byte for byte", () => {
    // The checked-in data IS the parser's output; if the flattener
    // changes, this fails until svg2ts.ts is re-run.
    const g = importSvg(readAsset("david"), { height: null })
    expect(david.subpaths.length).toBe(g.subpaths.length)
    for (let i = 0; i < g.subpaths.length; i++) {
      expect(david.subpaths[i]!.length).toBe(g.subpaths[i]!.length * 2)
    }
  })

  test("david centers on the origin and honours its height", () => {
    const g = importSvg(readAsset("david"), { height: 500 })
    const pts = g.subpaths.flat()
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    near(Math.max(...ys) - Math.min(...ys), 500, 1e-6)
    near((Math.min(...xs) + Math.max(...xs)) / 2, 0, 1e-6)
    near((Math.min(...ys) + Math.max(...ys)) / 2, 0, 1e-6)
    // The portrait is taller than it is wide.
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(500)
  })

  test("parsing is deterministic — same input, identical output", () => {
    const a = importSvg(readAsset("david"), { height: 400 })
    const b = importSvg(readAsset("david"), { height: 400 })
    expect(JSON.stringify(a.subpaths)).toBe(JSON.stringify(b.subpaths))
  })

  test("every asset in the corpus parses, with nothing skipped", () => {
    const files = readdirSync(SVG_DIR).filter((f) => f.endsWith(".svg"))
    expect(files.length).toBe(32)
    for (const file of files) {
      const g = importSvg(readFileSync(join(SVG_DIR, file), "utf8"), { height: 400 })
      expect(g.subpaths.length).toBeGreaterThan(0)
      expect(g.skipped).toEqual([])
      // Nothing degenerate: every emitted stroke is at least a segment,
      // and no coordinate is NaN.
      for (const sp of g.subpaths) {
        expect(sp.length).toBeGreaterThanOrEqual(2)
        for (const p of sp) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
        }
      }
    }
  })

  test("every generated module is present and self-describing", () => {
    const modules = readdirSync(ASSET_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts")
    expect(modules.length).toBe(32)
  })

  test("flattening is finer than the tolerance is coarse", () => {
    expect(FLATTEN_TOLERANCE).toBeGreaterThan(0)
    // At this tolerance david's densest strokes stay under a point per
    // rendered pixel at the scene's scale — a sanity bound, not a fit.
    const g = importSvg(readAsset("david"), { height: null })
    const total = g.subpaths.reduce((n, sp) => n + sp.length, 0)
    expect(total).toBeGreaterThan(2000)
    expect(total).toBeLessThan(20000)
  })
})

describe("the Sketch holon", () => {
  const box: SketchData = {
    name: "box",
    source: "test",
    hash: "0",
    // A 40-wide, 20-tall rectangle, already centered.
    subpaths: [[-20, -10, 20, -10, 20, 10, -20, 10, -20, -10]],
    closed: [1],
  }

  test("composes one stroke per subpath", () => {
    const sketch = new Sketch({ data: david, height: 400 })
    void sketch.parts
    expect(sketch.strokes.length).toBe(37)
  })

  test("scales its strokes to `height`", () => {
    const sketch = new Sketch({ data: box, height: 100 })
    void sketch.parts
    const ys = sketch.strokes.flatMap((s) => s.points.map((p) => p.y))
    near(Math.max(...ys) - Math.min(...ys), 100)
    const xs = sketch.strokes.flatMap((s) => s.points.map((p) => p.x))
    near(Math.max(...xs) - Math.min(...xs), 200) // aspect preserved
  })

  test("an empty sketch is a valid, inert holon", () => {
    const sketch = new Sketch({})
    void sketch.parts
    expect(sketch.strokes.length).toBe(0)
    expect(sketch.createAnim().tracks).toEqual([])
  })

  test("draw windows are contiguous, cover [0,1], and weight by arc length", () => {
    const twoStrokes: SketchData = {
      name: "two",
      source: "test",
      hash: "0",
      // One stroke of length 30, one of length 10 — a 3:1 share.
      subpaths: [
        [0, 0, 30, 0],
        [0, 10, 10, 10],
      ],
      closed: [0, 0],
    }
    const sketch = new Sketch({ data: twoStrokes, height: null as never })
    // Use the data's own units so the lengths are the stated ones.
    const s = new Sketch({ data: twoStrokes, height: 10 })
    void s.parts
    void sketch
    const tracks = s.createAnim().tracks
    expect(tracks.length).toBe(2)
    near(tracks[0]!.relStart, 0)
    near(tracks[0]!.relStop, 0.75)
    near(tracks[1]!.relStart, 0.75)
    near(tracks[1]!.relStop, 1)
  })

  test("uncreate retracts in the mirror order", () => {
    const sketch = new Sketch({ data: box, height: 100 })
    void sketch.parts
    const tracks = sketch.unCreateAnim().tracks
    expect(tracks.length).toBe(1)
    near(tracks[0]!.relStart, 0)
    near(tracks[0]!.relStop, 1)
  })

  test("the whole drawing's draw spans exactly the full window", () => {
    const sketch = new Sketch({ data: david, height: 400 })
    void sketch.parts
    const tracks = sketch.createAnim().tracks
    expect(tracks.length).toBe(37)
    near(Math.min(...tracks.map((t) => t.relStart)), 0, 1e-9)
    near(Math.max(...tracks.map((t) => t.relStop)), 1, 1e-9)
  })
})
