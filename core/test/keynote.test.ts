/**
 * The .key importer — the frame, the fit, and the deck's own numbers.
 *
 * Every expected value here comes from one of two places, and never
 * from the code under test: docs/reports/pl02-vocabulary.md (which
 * cross-validated its geometry against the footage to sub-pixel), or an
 * arithmetic consequence of the format's own definitions. That is the
 * whole point of the file — the importer is the gate on ten chapters,
 * and a test that agreed with whatever the importer happened to do would
 * gate nothing.
 */

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join, resolve } from "node:path"
import {
  SLIDE_WIDTH,
  SLIDE_HEIGHT,
  SLIDE_UNITS_PER_VIDEO_PIXEL,
  slideToWorld,
  slidePointToWorld,
  flattenElements,
  FLATTEN_TOLERANCE_SLIDE,
  fitToFrame,
  importShapePath,
  textBaseline,
  textAnchorX,
  colorToHex,
  HELVETICA_CAP_HEIGHT,
  HELVETICA_DESCENT,
  DECK_BLUE,
  DECK_RED,
  type KeyPathElement,
  type KeyGeometry,
  type KeyText,
} from "../src/geometry/keynote"
import { slide01 } from "../vocabulary/Slides/assets/pl02/slide01"
import { Slide, hexToColor } from "../vocabulary/Slides/Slides"
import { BLUE, RED } from "../src/constants"

const REPO = resolve(import.meta.dir, "../..")

// ---------------------------------------------------------------------------
// The frame
// ---------------------------------------------------------------------------

describe("the slide frame", () => {
  test("the canvas is the deck's own 1920x1080", () => {
    expect(SLIDE_WIDTH).toBe(1920)
    expect(SLIDE_HEIGHT).toBe(1080)
  })

  test("a slide unit is 2/3 of a 720p video pixel, exactly", () => {
    // 1920/1280 = 1080/720 = 3/2: the canvas maps onto the frame with no
    // letterbox and no crop, which is what makes the recon's sub-pixel
    // agreement possible at all.
    expect(SLIDE_UNITS_PER_VIDEO_PIXEL).toBe(3 / 2)
    expect(SLIDE_WIDTH / 1280).toBe(SLIDE_UNITS_PER_VIDEO_PIXEL)
    expect(SLIDE_HEIGHT / 720).toBe(SLIDE_UNITS_PER_VIDEO_PIXEL)
  })

  test("the corners map to the frame's corners, y flipped", () => {
    // The framework's 36mm rig at 1000 units sees 562.4987 of height.
    const frameHeight = 562.4987439260904
    const s = slideToWorld(frameHeight)
    const w = (SLIDE_WIDTH / 2) * s
    const h = frameHeight / 2

    // Top-left of the canvas is up-and-left in world coordinates…
    const topLeft = slidePointToWorld({ x: 0, y: 0 }, s)
    expect(topLeft.x).toBeCloseTo(-w, 6)
    expect(topLeft.y).toBeCloseTo(h, 6)
    // …and bottom-right is down-and-right. The y SIGN is the flip.
    const bottomRight = slidePointToWorld({ x: SLIDE_WIDTH, y: SLIDE_HEIGHT }, s)
    expect(bottomRight.x).toBeCloseTo(w, 6)
    expect(bottomRight.y).toBeCloseTo(-h, 6)
  })

  test("the canvas centre is the world origin", () => {
    const s = slideToWorld(562.4987439260904)
    const centre = slidePointToWorld({ x: SLIDE_WIDTH / 2, y: SLIDE_HEIGHT / 2 }, s)
    expect(centre.x).toBeCloseTo(0, 9)
    expect(centre.y).toBeCloseTo(0, 9)
  })

  test("the aspect survives: a canvas-square is square in world units", () => {
    const s = slideToWorld(562.4987439260904)
    const a = slidePointToWorld({ x: 100, y: 100 }, s)
    const b = slidePointToWorld({ x: 200, y: 200 }, s)
    expect(Math.abs(b.x - a.x)).toBeCloseTo(Math.abs(b.y - a.y), 9)
  })
})

// ---------------------------------------------------------------------------
// Flattening — the reuse of svg.ts's math
// ---------------------------------------------------------------------------

describe("flattenElements", () => {
  test("a known cubic flattens onto the curve, not the control polygon", () => {
    // A quarter-circle-ish cubic from (0,0) to (100,100) whose controls
    // pull it well away from the chord. Every emitted point must lie on
    // the true bezier, which is checkable in closed form.
    const els: KeyPathElement[] = [
      { type: "moveTo", points: [{ x: 0, y: 0 }] },
      {
        type: "curveTo",
        points: [
          { x: 55.228, y: 0 },
          { x: 100, y: 44.772 },
          { x: 100, y: 100 },
        ],
      },
    ]
    const [sub] = flattenElements(els, 0.05)
    expect(sub).toBeDefined()
    const pts = sub!.points
    expect(pts.length).toBeGreaterThan(8)
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(pts[pts.length - 1]!.x).toBeCloseTo(100, 6)
    expect(pts[pts.length - 1]!.y).toBeCloseTo(100, 6)

    // Every point sits on the cubic to within the tolerance: find the
    // nearest parameter by a fine scan and check the distance.
    const at = (t: number) => {
      const u = 1 - t
      return {
        x: 3 * u * u * t * 55.228 + 3 * u * t * t * 100 + t * t * t * 100,
        y: 3 * u * t * t * 44.772 + t * t * t * 100,
      }
    }
    for (const p of pts) {
      let best = Infinity
      for (let i = 0; i <= 2000; i++) {
        const q = at(i / 2000)
        best = Math.min(best, Math.hypot(q.x - p.x, q.y - p.y))
      }
      expect(best).toBeLessThan(0.05)
    }
  })

  test("a finer tolerance produces strictly more points", () => {
    const els: KeyPathElement[] = [
      { type: "moveTo", points: [{ x: 0, y: 0 }] },
      {
        type: "curveTo",
        points: [
          { x: 0, y: 100 },
          { x: 100, y: 100 },
          { x: 100, y: 0 },
        ],
      },
    ]
    const coarse = flattenElements(els, 2)[0]!.points.length
    const fine = flattenElements(els, 0.01)[0]!.points.length
    expect(fine).toBeGreaterThan(coarse)
  })

  test("closeSubpath returns to the start and marks the run closed", () => {
    const els: KeyPathElement[] = [
      { type: "moveTo", points: [{ x: 0, y: 0 }] },
      { type: "lineTo", points: [{ x: 10, y: 0 }] },
      { type: "lineTo", points: [{ x: 10, y: 10 }] },
      { type: "closeSubpath" },
    ]
    const subs = flattenElements(els, 0.25)
    expect(subs).toHaveLength(1)
    expect(subs[0]!.closed).toBe(true)
    const pts = subs[0]!.points
    expect(pts[pts.length - 1]).toEqual({ x: 0, y: 0 })
  })

  test("Keynote's redundant trailing moveTo does not become a subpath", () => {
    // Every built-in shape emits `closeSubpath` and then a `moveTo` back
    // to the start. A 1-point run is not a stroke, and the built-in
    // circle must import as ONE subpath.
    const els: KeyPathElement[] = [
      { type: "moveTo", points: [{ x: 0, y: 0 }] },
      { type: "lineTo", points: [{ x: 10, y: 0 }] },
      { type: "closeSubpath" },
      { type: "moveTo", points: [{ x: 0, y: 0 }] },
    ]
    expect(flattenElements(els, 0.25)).toHaveLength(1)
  })

  test("a quadratic converts to the cubic that shares its curve", () => {
    const quad: KeyPathElement[] = [
      { type: "moveTo", points: [{ x: 0, y: 0 }] },
      {
        type: "quadCurveTo",
        points: [
          { x: 50, y: 100 },
          { x: 100, y: 0 },
        ],
      },
    ]
    const cubic: KeyPathElement[] = [
      { type: "moveTo", points: [{ x: 0, y: 0 }] },
      {
        type: "curveTo",
        points: [
          { x: 100 / 3, y: 200 / 3 },
          { x: 200 / 3, y: 200 / 3 },
          { x: 100, y: 0 },
        ],
      },
    ]
    const a = flattenElements(quad, 0.05)[0]!.points
    const b = flattenElements(cubic, 0.05)[0]!.points
    expect(a.length).toBe(b.length)
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.x).toBeCloseTo(b[i]!.x, 9)
      expect(a[i]!.y).toBeCloseTo(b[i]!.y, 9)
    }
  })
})

// ---------------------------------------------------------------------------
// The fit — the format's one non-obvious rule
// ---------------------------------------------------------------------------

describe("fitToFrame", () => {
  const unitSquare = [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ],
  ]

  test("maps the path's own box onto [position, position + size]", () => {
    const frame: KeyGeometry = { position: { x: 200, y: 300 }, size: { width: 40, height: 80 } }
    const [out] = fitToFrame(unitSquare, frame)
    expect(out![0]).toEqual({ x: 200, y: 300 })
    expect(out![2]!.x).toBeCloseTo(240, 9)
    expect(out![2]!.y).toBeCloseTo(380, 9)
  })

  test("a design box of any scale lands identically", () => {
    // The icon library authors in 0…400 and the built-in shapes in
    // 0…100; both must fit the same geometry box the same way.
    const big = unitSquare.map((sp) => sp.map((p) => ({ x: p.x * 4, y: p.y * 4 })))
    const frame: KeyGeometry = { position: { x: 10, y: 20 }, size: { width: 50, height: 60 } }
    const a = fitToFrame(unitSquare, frame)[0]!
    const b = fitToFrame(big, frame)[0]!
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.x).toBeCloseTo(a[i]!.x, 9)
      expect(b[i]!.y).toBeCloseTo(a[i]!.y, 9)
    }
  })

  test("rotation turns about the box's centre, counterclockwise on a y-down canvas", () => {
    const frame: KeyGeometry = {
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      angle: 90,
    }
    const [out] = fitToFrame(unitSquare, frame)
    // The top-left corner swings to the bottom-left under a CCW turn in
    // a y-down frame, and the box's centre is fixed.
    expect(out![0]!.x).toBeCloseTo(0, 6)
    expect(out![0]!.y).toBeCloseTo(100, 6)
  })

  test("a zero-height box does not divide by zero", () => {
    // The title card's two Λ legs are exactly this: size 340.5 x 0.0.
    const line = [
      [
        { x: 0, y: 0 },
        { x: 141.42136, y: 0 },
      ],
    ]
    const frame: KeyGeometry = {
      position: { x: 721.48285, y: 465.0141 },
      size: { width: 340.53683, height: 0 },
      angle: 67.04865,
    }
    const [out] = fitToFrame(line, frame)
    for (const p of out!) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
    // A rotated 340.5-unit line still has that length.
    const a = out![0]!
    const b = out![out!.length - 1]!
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(340.53683, 4)
  })

  test("flip bits mirror within the box", () => {
    const frame: KeyGeometry = {
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      flags: 1,
    }
    const [out] = fitToFrame(unitSquare, frame)
    expect(out![0]!.x).toBeCloseTo(100, 6)
    expect(out![1]!.x).toBeCloseTo(0, 6)
  })
})

// ---------------------------------------------------------------------------
// The deck's own numbers — the cross-validated ones
// ---------------------------------------------------------------------------

describe("the title slide against the recon's measurements", () => {
  test("the module carries the four shapes and the one string", () => {
    expect(slide01.index).toBe(1)
    expect(slide01.shapes).toHaveLength(4)
    expect(slide01.texts).toHaveLength(1)
    expect(slide01.texts[0]!.content).toBe("Project Liminality")
  })

  /** A shape's flattened points, as {x,y}. */
  const pointsOf = (i: number) => {
    const out: { x: number; y: number }[] = []
    for (const flat of slide01.shapes[i]!.subpaths) {
      for (let k = 0; k + 1 < flat.length; k += 2) out.push({ x: flat[k]!, y: flat[k + 1]! })
    }
    return out
  }
  const bbox = (pts: { x: number; y: number }[]) => ({
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  })

  test("the main circle is centre (960, 435.095) r 229.5884", () => {
    // Report §1: "position (730.4116, 205.50696), size 459.17673 →
    // centre (960.000, 435.095), r = 229.5884" — and the footage
    // measures the implied 153.06 px at 720p.
    const main = slide01.shapes.findIndex((s) => s.stroke === DECK_BLUE)
    expect(main).toBeGreaterThanOrEqual(0)
    const b = bbox(pointsOf(main))
    expect((b.minX + b.maxX) / 2).toBeCloseTo(960.0, 1)
    expect((b.minY + b.maxY) / 2).toBeCloseTo(435.095, 1)
    expect((b.maxX - b.minX) / 2).toBeCloseTo(229.5884, 1)
    // …and therefore 153.06 px in the encode.
    expect(((b.maxX - b.minX) / 2 / SLIDE_UNITS_PER_VIDEO_PIXEL)).toBeCloseTo(153.06, 1)
  })

  test("the small circle is centre (960, 357.029) r 149.0074", () => {
    const small = slide01.shapes.findIndex((s) => s.stroke === DECK_RED)
    expect(small).toBeGreaterThanOrEqual(0)
    const b = bbox(pointsOf(small))
    expect((b.minX + b.maxX) / 2).toBeCloseTo(960.0, 1)
    expect((b.minY + b.maxY) / 2).toBeCloseTo(357.029, 1)
    expect((b.maxX - b.minX) / 2).toBeCloseTo(149.0074, 1)
  })

  test("the deck's mark is NOT the pydeation Logo, and the difference is measurable", () => {
    // Report §1: r_small/r_main is 0.64902 here versus pydeation's 0.61,
    // and the centre offset 0.34003·r_main versus 0.36. This test is the
    // guard on the substitution P-2 must not make.
    const mainBox = bbox(pointsOf(slide01.shapes.findIndex((s) => s.stroke === DECK_BLUE)))
    const smallBox = bbox(pointsOf(slide01.shapes.findIndex((s) => s.stroke === DECK_RED)))
    const rMain = (mainBox.maxX - mainBox.minX) / 2
    const rSmall = (smallBox.maxX - smallBox.minX) / 2
    expect(rSmall / rMain).toBeCloseTo(0.64902, 3)
    expect(rSmall / rMain).not.toBeCloseTo(0.61, 2)
    const offset =
      ((mainBox.minY + mainBox.maxY) / 2 - (smallBox.minY + smallBox.maxY) / 2) / rMain
    expect(offset).toBeCloseTo(0.34003, 3)
  })

  test("the two legs are 340.54 and 341.43 units long, at 67.05 and 113.56 degrees", () => {
    // Report §1's third bullet, verbatim.
    const legs = slide01.shapes.filter((s) => s.stroke === "#ffffff")
    expect(legs).toHaveLength(2)
    const lengths = legs.map((leg) => {
      const flat = leg.subpaths[0]!
      const n = flat.length
      return Math.hypot(flat[n - 2]! - flat[0]!, flat[n - 1]! - flat[1]!)
    })
    expect(Math.min(...lengths)).toBeCloseTo(340.53683, 2)
    expect(Math.max(...lengths)).toBeCloseTo(341.42834, 2)
  })

  test("the deck's blue and red ARE the framework's BLUE and RED", () => {
    // Not a coincidence and not a tolerance: the deck's stylesheet
    // carries #00A2FF and #FF644E, which are constants.ts's own values
    // to the byte. (The recon report's #00A1FF / #EE220C are the ENCODE's
    // quantised hues and a one-off outlier respectively — see the
    // DECK_BLUE header.)
    expect(hexToColor(DECK_BLUE)).toEqual(BLUE)
    expect(hexToColor(DECK_RED)).toEqual(RED)
    expect(colorToHex({ ...BLUE, a: 1 })).toBe(DECK_BLUE)
    expect(colorToHex({ ...RED, a: 1 })).toBe(DECK_RED)
    // And the title card actually wears them.
    expect(slide01.shapes.map((s) => s.stroke).sort()).toEqual([
      DECK_BLUE,
      DECK_RED,
      "#ffffff",
      "#ffffff",
    ])
  })

  test("the shapes carry the deck's 6-unit stroke", () => {
    for (const shape of slide01.shapes) expect(shape.strokeWidth).toBe(6)
  })

  test("dotted strokes are RoundCap, and that is what sets the dot period", async () => {
    const { slide02 } = await import("../vocabulary/Slides/assets/pl02/slide02")
    const dotted = slide02.shapes.filter((s) => s.dash)
    expect(dotted.length).toBeGreaterThan(0)
    for (const shape of dotted) {
      // The deck splits perfectly: every (0.001, 2.0) dotted pattern is
      // RoundCap, every other dash pattern is ButtCap. A 0.001 dash is a
      // deliberate zero — "paint nothing but the cap" — which is only
      // visible under a round cap at all.
      expect(shape.dash).toEqual([0.001, 2])
      expect(shape.cap).toBe("RoundCap")
    }
    // And the period follows from it. A round cap paints a half-disc
    // past each end, so a dash of length d occupies d + w on the line:
    //   butt  (0.001 + 2) * 7.333 = 14.674 px  — 33% short
    //   round (0.001 + 2 + 1) * 7.333 = 22.007 px — 0.5% off
    // against P-3's measured 21.9 px in the eagle corridor.
    const w = dotted[0]!.strokeWidth! / SLIDE_UNITS_PER_VIDEO_PIXEL
    const [dash, gap] = dotted[0]!.dash as [number, number]
    expect((dash + gap + 1) * w).toBeCloseTo(22.007, 2)
    expect(Math.abs((dash + gap + 1) * w - 21.9) / 21.9).toBeLessThan(0.01)
    expect(Math.abs((dash + gap) * w - 21.9) / 21.9).toBeGreaterThan(0.3)
  })
})

// ---------------------------------------------------------------------------
// The census — the importer against the recon's independent count
// ---------------------------------------------------------------------------

describe("the shape census", () => {
  /**
   * The recon counted the deck's drawables by walking the archives with
   * its own (Python) reader, and published the result per slide
   * (docs/reports/pl02-vocabulary.md §1, the sh/cn/gr column). This
   * checks the importer's count against that INDEPENDENT one, so a walk
   * that silently dropped a group or a connection line shows up here
   * rather than as geometry that is merely thin.
   *
   * The report's `sh` and `cn` columns are separate (shapes vs
   * connection lines); both arrive as `shapes` here, because a
   * connection line is a path like any other once it is flattened — so
   * the comparison is against sh + cn.
   */
  const census: Record<number, { drawables: number; groups: number; builds: number }> = {
    // slide: sh + cn (+ the text boxes the report folded into `sh`), gr, builds
    1: { drawables: 5, groups: 0, builds: 0 },
    2: { drawables: 8, groups: 0, builds: 13 },
    3: { drawables: 6, groups: 0, builds: 5 },
    4: { drawables: 9, groups: 0, builds: 4 },
    5: { drawables: 7, groups: 0, builds: 3 },
    6: { drawables: 5, groups: 0, builds: 0 },
  }

  test("slide 1 matches the report's 4 shapes plus its one string", () => {
    // Report §1: slide 1 is "4/0/0" with the text "Project Liminality".
    expect(slide01.shapes.length + slide01.texts.length).toBe(census[1]!.drawables)
    expect(slide01.groups).toHaveLength(census[1]!.groups)
    expect(slide01.builds).toHaveLength(census[1]!.builds)
  })

  test("the opening arc's slides match the report's counts", async () => {
    const { slide02 } = await import("../vocabulary/Slides/assets/pl02/slide02")
    const { slide03 } = await import("../vocabulary/Slides/assets/pl02/slide03")
    const { slide04 } = await import("../vocabulary/Slides/assets/pl02/slide04")
    const { slide05 } = await import("../vocabulary/Slides/assets/pl02/slide05")
    const { slide06 } = await import("../vocabulary/Slides/assets/pl02/slide06")
    for (const data of [slide02, slide03, slide04, slide05, slide06]) {
      const want = census[data.index]!
      expect(data.shapes.length + data.texts.length).toBe(want.drawables)
      expect(data.groups).toHaveLength(want.groups)
      expect(data.builds).toHaveLength(want.builds)
    }
  })

  test("the deck's declared transitions and builds survive", async () => {
    const { slide02 } = await import("../vocabulary/Slides/assets/pl02/slide02")
    // Report §0: 41 Magic Moves at 2.0s with 0.5 delay, ease-in-ease-out.
    expect(slide02.transition?.effect).toBe("apple:magic-move-implied-motion-path")
    expect(slide02.transition?.duration).toBe(2)
    expect(slide02.transition?.delay).toBe(0.5)
    // …and LineDrawForLine is the dominant build.
    const draws = slide02.builds.filter(
      (b) => b.effect === "com.apple.iWork.Keynote.LineDrawForLine",
    )
    expect(draws.length).toBeGreaterThan(0)
    for (const build of slide02.builds) expect(build.delay).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Groups — the offset bug P-2 caught
// ---------------------------------------------------------------------------

describe("group children are lifted onto the canvas", () => {
  /**
   * Group children are stored RELATIVE to their parent group, and groups
   * nest. P-1 originally claimed they were absolute; the title slide has
   * no groups, so its gate never exercised the claim and it shipped
   * false. These tests are the guard.
   *
   * The landmark is slide 32's "InterLogos" text box: geometry
   * (118.41, 121.54) inside group 5688069 at (841.59, 773.70), summing
   * to (960.00, 895.24) — horizontally dead centre on the 1920 canvas,
   * which is where frame f_02826 draws it. Taken as absolute it would
   * sit against the top-left corner.
   */
  test("a grouped text box lands where the footage draws it", async () => {
    const { slide32 } = await import("../vocabulary/Slides/assets/pl02/slide32")
    const interlogos = slide32.texts.find((t) => t.content === "InterLogos")
    expect(interlogos).toBeDefined()
    expect(interlogos!.frame.position.x).toBeCloseTo(960.0, 1)
    expect(interlogos!.frame.position.y).toBeCloseTo(895.24, 1)
    // The un-lifted value, which is what the bug produced.
    expect(interlogos!.frame.position.x).not.toBeCloseTo(118.41, 1)
  })

  test("no drawable on a grouped slide is stranded at the canvas corner", () => {
    // The bug's signature: the whole tableau collapsed toward the origin.
    // Nothing in this deck is authored against the very corner, so a
    // cluster of drawables in the top-left 5% is the tell.
    return import("../vocabulary/Slides/assets/pl02/slide32").then(({ slide32 }) => {
      const stranded = [...slide32.shapes, ...slide32.texts].filter((d) => {
        const p = "frame" in d ? d.frame.position : null
        if (p) return p.x < SLIDE_WIDTH * 0.05 && p.y < SLIDE_HEIGHT * 0.05
        const flat = (d as { subpaths: number[][] }).subpaths[0]
        return flat ? flat[0]! < SLIDE_WIDTH * 0.05 && flat[1]! < SLIDE_HEIGHT * 0.05 : false
      })
      expect(stranded).toHaveLength(0)
    })
  })

  test("the slide's drawables span the canvas the way a composed tableau does", async () => {
    const { slide32 } = await import("../vocabulary/Slides/assets/pl02/slide32")
    let minX = Infinity
    let maxX = -Infinity
    for (const shape of slide32.shapes) {
      for (const flat of shape.subpaths) {
        for (let i = 0; i + 1 < flat.length; i += 2) {
          minX = Math.min(minX, flat[i]!)
          maxX = Math.max(maxX, flat[i]!)
        }
      }
    }
    // Centred composition: the ink straddles the canvas midline rather
    // than hugging one edge.
    expect(minX).toBeLessThan(SLIDE_WIDTH / 2)
    expect(maxX).toBeGreaterThan(SLIDE_WIDTH / 2)
  })

  test("groups record membership and every member resolves", async () => {
    const { slide32 } = await import("../vocabulary/Slides/assets/pl02/slide32")
    expect(slide32.groups.length).toBeGreaterThan(0)
    const ids = new Set([
      ...slide32.shapes.map((s) => s.id),
      ...slide32.texts.map((t) => t.id),
      ...slide32.groups.map((g) => g.id),
    ])
    for (const group of slide32.groups) {
      expect(group.members.length).toBeGreaterThan(0)
      for (const member of group.members) expect(ids.has(member)).toBe(true)
    }
  })

  test("the title card, having no groups, is untouched by the lift", () => {
    // The fix must be scoped to grouped drawables: slide 1's geometry is
    // already validated against the footage to sub-pixel and must not
    // move. (§ the main-circle test above pins the actual numbers; this
    // pins the structural fact that produced them.)
    expect(slide01.groups).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Builds — order, direction, and the click model (P-3)
// ---------------------------------------------------------------------------

describe("builds", () => {
  test("arrive in the deck's declared order, not sorted", async () => {
    const { slide02 } = await import("../vocabulary/Slides/assets/pl02/slide02")
    // The slide's own `builds` list opens with a LineDrawForLine on
    // 4514353 and closes with one on 4514292, with dissolves between —
    // an order the old (target, effect) sort destroyed.
    expect(slide02.builds[0]!.target).toBe("4514353")
    expect(slide02.builds[slide02.builds.length - 1]!.target).toBe("4514292")
    const targets = slide02.builds.map((b) => b.target)
    expect(targets).not.toEqual([...targets].sort())
  })

  test("LineDrawForLine carries its direction, uninterpreted", async () => {
    const { slide02 } = await import("../vocabulary/Slides/assets/pl02/slide02")
    // P-3 measured these four against the footage: all draw
    // centre-outward, two against their stored point order.
    const dirs = Object.fromEntries(
      slide02.builds
        .filter((b) => b.effect === "com.apple.iWork.Keynote.LineDrawForLine")
        .map((b) => [b.target, b.direction]),
    )
    expect(dirs).toEqual({
      "4514353": 51,
      "4514420": 52,
      "4514184": 52,
      "4514292": 52,
    })
  })

  test("direction is absent where the deck omits it — absence is the default", async () => {
    const { slide03 } = await import("../vocabulary/Slides/assets/pl02/slide03")
    // Only 5 of the 58 slides state a direction at all; 114 of the 158
    // LineDrawForLine builds have none. A consumer must handle absence.
    for (const build of slide03.builds) {
      if (build.effect !== "com.apple.iWork.Keynote.LineDrawForLine") {
        expect(build.direction).toBeUndefined()
      }
    }
  })

  test("every build has an id a chunk can refer to", async () => {
    const { slide02 } = await import("../vocabulary/Slides/assets/pl02/slide02")
    const ids = new Set(slide02.builds.map((b) => b.id))
    expect(ids.size).toBe(slide02.builds.length)
    for (const chunk of slide02.buildChunks ?? []) expect(ids.has(chunk.build)).toBe(true)
  })

  test("both firing fields are carried, and they disagree", async () => {
    const { slide02 } = await import("../vocabulary/Slides/assets/pl02/slide02")
    const chunks = slide02.buildChunks ?? []
    expect(chunks.length).toBe(slide02.builds.length)
    // The firing model is UNRESOLVED (see KeyBuildChunk's header): the
    // chunk's `automatic` says this slide fires as one cascade, while
    // every build's `eventTrigger` says on-click. P-3 measured 7 events
    // in the segment, which the first reading cannot produce. Both are
    // carried uninterpreted; this test pins that they disagree, so a
    // future reader cannot mistake either for settled.
    expect(chunks.filter((c) => !c.automatic)).toHaveLength(1)
    for (const build of slide02.builds) expect(build.eventTrigger).toBe(1)
  })

  test("chunk order is the deck's firing order, not the builds list order", async () => {
    const { slide02 } = await import("../vocabulary/Slides/assets/pl02/slide02")
    const chunkOrder = (slide02.buildChunks ?? []).map((c) => c.build)
    const buildOrder = slide02.builds.map((b) => b.id)
    // Same set, different sequence — the chunks interleave lines with
    // the dissolves of the icons they reach, which the builds list does
    // not. Both orders are the archive's own; neither is sorted.
    expect([...chunkOrder].sort()).toEqual([...buildOrder].sort())
    expect(chunkOrder).not.toEqual(buildOrder)
  })

  test("a motion-path build carries its declared offset", async () => {
    const { slide03 } = await import("../vocabulary/Slides/assets/pl02/slide03")
    const move = slide03.builds.find((b) => b.effect === "apple:action-motion-path")
    expect(move).toBeDefined()
    expect(move!.target).toBe("4516215") // the "Story" label
    expect(move!.motionPath).toBeDefined()
    // Flattens to the straight (-1.388, -229.910) P-3 measured against
    // the footage: the label's 485.569 becomes 255.66 slide units, which
    // is video row 170 against the reference's glyph band at 158-189.
    const flat = flattenElements(move!.motionPath!, FLATTEN_TOLERANCE_SLIDE)
    const pts = flat[0]!.points
    const end = pts[pts.length - 1]!
    expect(end.x).toBeCloseTo(-1.388, 2)
    expect(end.y).toBeCloseTo(-229.91, 2)
    const label = slide03.texts.find((t) => t.id === "4516215")
    expect(label).toBeDefined()
    expect((label!.frame.position.y + end.y) / SLIDE_UNITS_PER_VIDEO_PIXEL).toBeCloseTo(170, 0)
  })

  test("image boxes are carried, because they are load-bearing for scoring", async () => {
    const { slide02 } = await import("../vocabulary/Slides/assets/pl02/slide02")
    const { slide03 } = await import("../vocabulary/Slides/assets/pl02/slide03")
    // The recon called the deck's images "none load-bearing"; P-3
    // measured slide 2's five at 46.9% of that frame's reference ink.
    // 12 images fall inside slides 1-58, on slides 2, 3, 17 and 18.
    expect(slide02.images).toHaveLength(5)
    expect(slide03.images).toHaveLength(1)
    // The Vitruvian figure — the largest single drawable on the opening
    // tableau, and the reason slide 2 has a coverage_ref ceiling.
    const vitruvian = slide02.images!.find((i) => i.id === "4513444")
    expect(vitruvian).toBeDefined()
    expect(vitruvian!.frame.size.width).toBeCloseTo(480.953, 2)
    expect(vitruvian!.frame.size.height).toBeCloseTo(480.953, 2)
    // Slides without images carry none rather than an empty array.
    expect(slide01.images).toBeUndefined()
  })

  test("connection lines carry their endpoints, because stored paths can be stale", async () => {
    const { slide03 } = await import("../vocabulary/Slides/assets/pl02/slide03")
    // P-3's case: line 4515938 joins the tree to the Vitruvian image.
    // Its stored path fits to a short lower-left diagonal the footage
    // does not contain; the endpoints' box centres are both at slide
    // y 540 — video row 360, where the reference draws a long
    // horizontal. 15 of the deck's 547 connection lines are stale like
    // this, so the endpoints are the recourse.
    const line = slide03.shapes.find((s) => s.id === "4515938")
    expect(line).toBeDefined()
    expect(line!.connects).toEqual({ from: "4515966", to: "4515878" })
    // The stale one connects TO an image, so deriving it needs the image
    // boxes as well — which is the interaction that makes this case
    // awkward and the reason KeyImage exists.
    expect(slide03.images!.some((i) => i.id === "4515878")).toBe(true)
    // And the endpoint it comes FROM is an ordinary shape on the slide.
    expect(slide03.shapes.some((s) => s.id === "4515966")).toBe(true)
  })

  test("no build in the deck delivers per character", async () => {
    // All 384 builds across slides 1-58 are "All at Once", including
    // all 121 `dissolve character` ones — so `dissolve character` is a
    // uniform opacity ramp here and no DissolveCharacters verb is owed.
    const mods = await Promise.all([
      import("../vocabulary/Slides/assets/pl02/slide02"),
      import("../vocabulary/Slides/assets/pl02/slide03"),
      import("../vocabulary/Slides/assets/pl02/slide04"),
      import("../vocabulary/Slides/assets/pl02/slide05"),
    ])
    const all = [slide01, ...mods.map((m) => Object.values(m)[0] as typeof slide01)]
    for (const data of all) {
      for (const build of data.builds) expect(build.delivery).toBe("All at Once")
    }
  })

  test("chunk duration agrees with its build's — the chunk adds firing, not timing", async () => {
    const { slide02 } = await import("../vocabulary/Slides/assets/pl02/slide02")
    // Checked across the whole deck: all 384 chunks agree with the
    // `animationAttributes.duration` of the build they fire. So a chunk
    // contributes the WHEN (click or cascade) and never a second
    // duration to reconcile. (The 0.0 that looks like a disagreement is
    // KN.BuildArchive's own outer `duration` field, which is not the
    // animation's and which this importer does not read.)
    for (const chunk of slide02.buildChunks ?? []) {
      const build = slide02.builds.find((b) => b.id === chunk.build)
      expect(build).toBeDefined()
      expect(chunk.duration).toBeCloseTo(build!.duration, 9)
    }
  })
})

// ---------------------------------------------------------------------------
// Text records
// ---------------------------------------------------------------------------

describe("text records", () => {
  const title = slide01.texts[0]!

  test("the title card's face, size and box survive the import", () => {
    expect(title.fontName).toBe("HelveticaNeue-Bold")
    expect(title.bold).toBe(true)
    expect(title.fontSize).toBe(116) // report §1: "116 for the title card"
    expect(title.align).toBe("center")
    expect(title.verticalAlign).toBe("bottom")
    expect(title.frame.size.width).toBeCloseTo(1730.0002, 3)
    expect(title.frame.size.height).toBeCloseTo(366, 3)
    expect(title.color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
  })

  test("the deck's tracking survives, and only the title style carries it", () => {
    // P-2: tracking is an em fraction of extra advance after each glyph,
    // and the title card's -0.02 is the difference between an untracked
    // 640 px word and the deck's 610 at 720p. Across the whole
    // stylesheet exactly ONE style carries a nonzero value — the 116-pt
    // title — so it can perturb no other chapter's geometry.
    expect(title.tracking).toBeCloseTo(-0.02, 6)
    for (const data of [slide01]) {
      for (const text of data.texts) {
        if (text.fontSize !== 116) expect(text.tracking ?? 0).toBe(0)
      }
    }
  })

  test("the block anchors on the box's horizontal centre", () => {
    // 95 + 1730/2 = 960 — the canvas centre, which is where the
    // reference frame puts the word.
    expect(textAnchorX(title)).toBeCloseTo(960, 1)
  })

  test("the baseline is derived from the face's metrics and matches the footage", () => {
    // Bottom-aligned: baseline = boxBottom − padding − descent.
    // 529.496 + 366 − 4 − 0.212·116 = 866.9 slide units = 577.9 video px.
    // The reference's dense-glyph band ends at row 577.
    const baseline = textBaseline(title)
    expect(baseline).toBeCloseTo(866.9, 0)
    expect(baseline / SLIDE_UNITS_PER_VIDEO_PIXEL).toBeCloseTo(577.9, 0)
  })

  test("the cap height the metrics predict is the one the encode shows", () => {
    // 0.714 em at 116 slide units is 55.2 video px; the reference's
    // dense band runs rows 522…577, i.e. 55 px.
    const capPx = (title.fontSize * HELVETICA_CAP_HEIGHT) / SLIDE_UNITS_PER_VIDEO_PIXEL
    expect(capPx).toBeCloseTo(55.2, 1)
    expect(HELVETICA_DESCENT).toBeCloseTo(0.212, 6)
  })

  test("top and middle alignment place the block inside the box", () => {
    const box = { position: { x: 0, y: 0 }, size: { width: 100, height: 200 } }
    const base = { ...title, frame: box, padding: { left: 0, top: 0, right: 0, bottom: 0 } }
    const top = textBaseline({ ...base, verticalAlign: "top" } as KeyText)
    const middle = textBaseline({ ...base, verticalAlign: "middle" } as KeyText)
    const bottom = textBaseline({ ...base, verticalAlign: "bottom" } as KeyText)
    expect(top).toBeLessThan(middle)
    expect(middle).toBeLessThan(bottom)
    expect(bottom).toBeCloseTo(200 - title.fontSize * HELVETICA_DESCENT, 6)
  })
})

// ---------------------------------------------------------------------------
// The holon
// ---------------------------------------------------------------------------

describe("the Slide holon", () => {
  test("composes one stroke per subpath and one label per text", () => {
    const slide = new Slide({ data: slide01 })
    void slide.parts
    const subpaths = slide01.shapes.reduce((n, s) => n + s.subpaths.length, 0)
    expect(slide.strokes).toHaveLength(subpaths)
    expect(slide.labels).toHaveLength(1)
  })

  test("the main circle lands at the world radius the frame implies", () => {
    // 229.5884 slide units at the 36mm rig's 562.4987 of visible height
    // is 119.577 world units, which renders back to 153.06 px at 720p.
    const slide = new Slide({ data: slide01 })
    void slide.parts
    const blue = slide.strokes.find((s) => Math.abs(s.tint.value.b - 1) < 1e-6 && s.tint.value.r === 0)
    expect(blue).toBeDefined()
    const pts = (blue as unknown as { points: { x: number; y: number }[] }).points
    const xs = pts.map((p) => p.x)
    expect((Math.max(...xs) - Math.min(...xs)) / 2).toBeCloseTo(119.577, 1)
  })

  test("the mark is centred on the world x axis and above the origin", () => {
    const slide = new Slide({ data: slide01 })
    void slide.parts
    const blue = slide.strokes.find((s) => s.tint.value.r === 0 && s.tint.value.b === 1)!
    const pts = (blue as unknown as { points: { x: number; y: number }[] }).points
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(0, 3)
    // Canvas y 435.095 is above the canvas centre (540), so world y > 0.
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeGreaterThan(0)
  })

  test("height rescales the whole page uniformly", () => {
    const a = new Slide({ data: slide01, height: 562.4987439260904 })
    const b = new Slide({ data: slide01, height: 1124.9974878521808 })
    void a.parts
    void b.parts
    const span = (s: Slide) => {
      const pts = (s.strokes[0] as unknown as { points: { x: number }[] }).points
      return Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x))
    }
    expect(span(b) / span(a)).toBeCloseTo(2, 6)
  })

  test("stroke width converts from slide units to rendered pixels", () => {
    // A 6-unit stroke on a 1080-unit canvas framed to 562.4987 world
    // units is 3.125 — which at the rig's 1.28 px/unit is 4 px at 720p,
    // and 6 × 2/3 = 4. The two derivations agree.
    const slide = new Slide({ data: slide01 })
    void slide.parts
    expect(slide.strokes[0]!.stroke.value).toBeCloseTo((6 * 562.4987439260904) / 1080, 6)
    expect(slide.strokes[0]!.stroke.value * 1.28).toBeCloseTo(4, 1)
  })
})

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("key2ts determinism", () => {
  test("re-running the codegen reproduces the module byte for byte", () => {
    const path = join(REPO, "core/vocabulary/Slides/assets/pl02/slide01.ts")
    const before = readFileSync(path, "utf8")
    execFileSync("bun", [join(REPO, "core/scripts/key2ts.ts"), "--slides", "1"], {
      cwd: REPO,
      stdio: "ignore",
    })
    expect(readFileSync(path, "utf8")).toBe(before)
    // Re-emit the chapter set so the working tree is left as it was.
    execFileSync("bun", [join(REPO, "core/scripts/key2ts.ts")], { cwd: REPO, stdio: "ignore" })
  }, 60000)

  test("the module records its source and hash for drift detection", () => {
    expect(slide01.source).toContain("refs/pitch/pl02/key/Index/Slide-")
    expect(slide01.hash).toMatch(/^[0-9a-f]{16}$/)
    expect(slide01.id).toBe("4512547")
  })

  test("importShapePath is pure — the same input gives the same output", () => {
    const els: KeyPathElement[] = [
      { type: "moveTo", points: [{ x: 0, y: 0 }] },
      {
        type: "curveTo",
        points: [
          { x: 30, y: 0 },
          { x: 60, y: 30 },
          { x: 60, y: 60 },
        ],
      },
    ]
    const frame: KeyGeometry = { position: { x: 5, y: 7 }, size: { width: 120, height: 240 } }
    expect(importShapePath(els, frame)).toEqual(importShapePath(els, frame))
  })
})
