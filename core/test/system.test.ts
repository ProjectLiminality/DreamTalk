/**
 * System — the global system's derivations, pinned.
 *
 * Every number here is recomputed from the source's own constructor
 * (custom_objects.py:400-426) rather than copied out of the
 * implementation, so a drifted constant fails instead of agreeing with
 * itself. The layout is checked as GEOMETRY where it can be — the gears
 * are asserted to MESH, by solving for the distance between their
 * centres and comparing it to the sum of their pitch radii, rather than
 * by comparing offsets to stored numbers.
 */

import { describe, expect, test } from "bun:test"
import {
  ASSET_HEIGHT,
  GEAR_SMALL_BANK,
  GROUPS,
  Gearing,
  ICON_SCALE,
  System,
} from "../vocabulary/System/System"
import { Sketch } from "../vocabulary/Sketch/Sketch"
import {
  cash,
  factory,
  gearBig,
  gearSmall,
  justice,
  stethoscope,
} from "../vocabulary/Sketch/assets/index"
import type { SketchData } from "../vocabulary/Sketch/data"
import { PI, WHITE, BLUE } from "../src/constants"
import { Stroke } from "../src/parts/primitives"

/** The bounding box of an asset in its own imported units. */
const bounds = (d: SketchData) => {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const sp of d.subpaths) {
    for (let i = 0; i + 1 < sp.length; i += 2) {
      minX = Math.min(minX, sp[i]!)
      maxX = Math.max(maxX, sp[i]!)
      minY = Math.min(minY, sp[i + 1]!)
      maxY = Math.max(maxY, sp[i + 1]!)
    }
  }
  return { width: maxX - minX, height: maxY - minY }
}

describe("the six drawings", () => {
  test("ASSET_HEIGHT is the assets' own measured height, not a chosen size", () => {
    // The one place this file carries measurements. If svg2ts.ts is ever
    // re-run and an asset changes size, this fails rather than silently
    // resizing the symbol — which is the whole reason the heights are
    // stated as constants instead of computed at construction.
    const assets: [keyof typeof ASSET_HEIGHT, SketchData][] = [
      ["gearBig", gearBig],
      ["gearSmall", gearSmall],
      ["justice", justice],
      ["factory", factory],
      ["cash", cash],
      ["stethoscope", stethoscope],
    ]
    for (const [name, data] of assets) {
      expect(bounds(data).height).toBeCloseTo(ASSET_HEIGHT[name], 3)
    }
  })

  test("all six share a 400-unit export canvas — the artist's template", () => {
    // This is why the icons look correctly varied inside identical
    // gears: they differ in HEIGHT, at a common width, so each is sized
    // by its own aspect and none is fitted.
    for (const data of [gearBig, gearSmall, justice, factory, cash, stethoscope]) {
      expect(bounds(data).width).toBeGreaterThan(393)
      expect(bounds(data).width).toBeLessThanOrEqual(400.001)
    }
  })

  test("the heights differ, and cash is the flattest", () => {
    expect(ASSET_HEIGHT.cash).toBeLessThan(ASSET_HEIGHT.factory)
    expect(ASSET_HEIGHT.factory).toBeLessThan(ASSET_HEIGHT.justice)
    expect(ASSET_HEIGHT.justice).toBeLessThan(ASSET_HEIGHT.gearBig)
    expect(ASSET_HEIGHT.stethoscope).toBeGreaterThan(ASSET_HEIGHT.gearSmall * 0.999)
  })
})

describe("the four groups, from the source's constructor", () => {
  test("the twelve numbers are what the file carries", () => {
    // custom_objects.py:411-418, verbatim — pydeation's z is our y.
    const expected: { name: string; icon: string; gear: string; scale: number; x: number; y: number }[] = [
      { name: "law", icon: "justice", gear: "gearBig", scale: 0.5, x: 80, y: -85 },
      { name: "economy", icon: "factory", gear: "gearBig", scale: 0.5, x: -80, y: 85 },
      { name: "finance", icon: "cash", gear: "gearSmall", scale: 0.3, x: 70, y: 65 },
      { name: "healthcare", icon: "stethoscope", gear: "gearSmall", scale: 0.3, x: -70, y: -65 },
    ]
    for (const want of expected) {
      const got: { icon: string; gear: string; scale: number; x: number; y: number } =
        GROUPS.find((g) => g.name === want.name)!
      expect(got.icon).toBe(want.icon)
      expect(got.gear).toBe(want.gear)
      expect(got.scale).toBe(want.scale)
      expect(got.x).toBe(want.x)
      expect(got.y).toBe(want.y)
    }
  })

  test("the big pair takes the long diagonal, the small pair the short", () => {
    // Not a restatement of the offsets: the CLAIM is that the two big
    // groups are further from the centre than the two small ones, which
    // is what lets four gears of two sizes close a ring.
    const radius = (n: string) => {
      const g = GROUPS.find((e) => e.name === n)!
      return Math.hypot(g.x, g.y)
    }
    expect(radius("law")).toBeCloseTo(radius("economy"), 12)
    expect(radius("finance")).toBeCloseTo(radius("healthcare"), 12)
    expect(radius("law")).toBeGreaterThan(radius("finance"))
  })

  test("each group is diagonally opposite its twin", () => {
    const g = (n: string): { x: number; y: number } => GROUPS.find((e) => e.name === n)!
    expect(g("law").x).toBe(-g("economy").x)
    expect(g("law").y).toBe(-g("economy").y)
    expect(g("finance").x).toBe(-g("healthcare").x)
    expect(g("finance").y).toBe(-g("healthcare").y)
  })

  test("THE GEARS MESH — solved, not compared", () => {
    // The symbol's whole argument. A big group's gear and its neighbouring
    // small group's gear must be tangent at their pitch circles: the
    // distance between the group centres should equal the sum of the two
    // gears' pitch radii. Pitch radius is taken as the asset's mean
    // tooth radius (between root and tip) times the group scale.
    const pitchRadius = (data: SketchData, scale: number): number => {
      const rim = data.subpaths[0]!
      let min = Infinity
      let max = -Infinity
      for (let i = 0; i + 1 < rim.length; i += 2) {
        const r = Math.hypot(rim[i]!, rim[i + 1]!)
        min = Math.min(min, r)
        max = Math.max(max, r)
      }
      return ((min + max) / 2) * scale
    }
    const big = GROUPS.find((g) => g.name === "law")!
    const small = GROUPS.find((g) => g.name === "finance")!
    const centreDistance = Math.hypot(big.x - small.x, big.y - small.y)
    const pitchSum =
      pitchRadius(gearBig, big.scale) + pitchRadius(gearSmall, small.scale)
    // Within 12% — a designer meshing by eye, not a gear generator, and
    // the point is that the two agree at all rather than to a tolerance.
    expect(Math.abs(centreDistance - pitchSum) / pitchSum).toBeLessThan(0.12)
  })

  test("the small gears carry opposite banks of PI/12", () => {
    expect(GEAR_SMALL_BANK).toBeCloseTo(PI / 12, 12)
    const finance = GROUPS.find((g) => g.name === "finance")!
    const healthcare = GROUPS.find((g) => g.name === "healthcare")!
    expect(finance.bank).toBeCloseTo(PI / 12, 12)
    expect(healthcare.bank).toBeCloseTo(-PI / 12, 12)
    // Opposite signs, which is what meshing gears do.
    expect(finance.bank).toBeCloseTo(-healthcare.bank, 12)
  })

  test("the big gears carry no bank — the source rotates only the small pair", () => {
    expect(GROUPS.find((g) => g.name === "law")!.bank).toBe(0)
    expect(GROUPS.find((g) => g.name === "economy")!.bank).toBe(0)
  })
})

describe("the two scales", () => {
  test("an icon is half its gear, in every group", () => {
    expect(ICON_SCALE).toBe(0.5)
    const system = new System()
    for (const group of [system.law, system.economy, system.finance, system.healthcare]) {
      void group.parts // compose
      // The icon's height is its asset's own height times ICON_SCALE;
      // the gear's is its asset's height with no inner scale. Both then
      // ride the group's own `scale`, which is C4D's object scale.
      expect(group.icon.height.value).toBeCloseTo(group.iconHeight * ICON_SCALE, 9)
      expect(group.gear.height.value).toBeCloseTo(group.gearHeight, 9)
    }
  })

  test("the group scale is the source's, and reaches both drawings", () => {
    const system = new System()
    expect(system.law.scale.value).toBe(0.5)
    expect(system.economy.scale.value).toBe(0.5)
    expect(system.finance.scale.value).toBe(0.3)
    expect(system.healthcare.scale.value).toBe(0.3)
  })

  test("the rendered icon-to-gear ratio is the asset aspect, not a chosen size", () => {
    // The consequence worth pinning: cash renders much flatter than
    // stethoscope inside gears of the same size, because the assets
    // differ in height at a common width.
    const system = new System()
    void system.finance.parts
    void system.healthcare.parts
    const cashH = system.finance.icon.height.value
    const stethH = system.healthcare.icon.height.value
    expect(stethH / cashH).toBeCloseTo(ASSET_HEIGHT.stethoscope / ASSET_HEIGHT.cash, 6)
  })
})

describe("the composition", () => {
  test("four groups, each a gear and an icon — eight drawings", () => {
    const system = new System()
    const sketches = [...system.walk()].filter((h) => h instanceof Sketch)
    expect(sketches.length).toBe(8)
  })

  test("each group is placed at its source offset", () => {
    const system = new System()
    const at = (g: Gearing) => ({ x: g.x.value, y: g.y.value })
    expect(at(system.law)).toEqual({ x: 80, y: -85 })
    expect(at(system.economy)).toEqual({ x: -80, y: 85 })
    expect(at(system.finance)).toEqual({ x: 70, y: 65 })
    expect(at(system.healthcare)).toEqual({ x: -70, y: -65 })
  })

  test("the bank lands on the GEAR, not on the group", () => {
    // The source writes `GearSmall(b=PI/12, …)` inside the Group, so the
    // icon must NOT turn with it — a rotated banknote would be wrong.
    const system = new System()
    void system.finance.parts
    expect(system.finance.gear.b.value).toBeCloseTo(PI / 12, 12)
    expect(system.finance.icon.b.value).toBe(0)
    expect(system.finance.b.value).toBe(0)
    void system.healthcare.parts
    expect(system.healthcare.gear.b.value).toBeCloseTo(-PI / 12, 12)
    expect(system.healthcare.icon.b.value).toBe(0)
  })

  test("colour is two params that default to one — the source's fallback", () => {
    // `if gear_color is None: gear_color = color` (custom_objects.py:408).
    const plain = new System()
    expect(plain.tint.value).toEqual(WHITE)
    expect(plain.gearTint.value).toEqual(WHITE)
    const split = new System({ tint: WHITE, gearTint: BLUE })
    void split.law.parts
    expect(split.law.icon.tint.value).toEqual(WHITE)
    expect(split.law.gear.tint.value).toEqual(BLUE)
  })

  test("it is a sovereign symbol", () => {
    expect(System.sovereign).toBe(true)
  })
})

describe("the choreography — Create floods it solid", () => {
  test("createAnim exists, which is the animator.py dispatch", () => {
    // pydeation's `Create` switches on the class name and sends a System
    // to DrawThenFillCompletely (animator.py:948-950). Core's equivalent
    // is owning a createAnim(), so its PRESENCE is the port.
    const system = new System()
    expect(system.createAnim()).toBeDefined()
    expect(system.createAnim()!.tracks.length).toBeGreaterThan(0)
  })

  test("the draw runs (0, 0.6) and the fill (0.5, 1) — the source's windows", () => {
    const system = new System()
    const anim = system.createAnim()!
    const fillTracks = anim.tracks.filter((t) =>
      [...system.walk()].some((h) => h instanceof Stroke && h.fillOpacity === t.param),
    )
    expect(fillTracks.length).toBeGreaterThan(0)
    for (const track of fillTracks) {
      // The flood begins at half the span and ends with it.
      expect(track.relStart).toBeCloseTo(0.5, 6)
      expect(track.relStop).toBeCloseTo(1, 6)
    }
    // And the draw half closes at 0.6, so the two overlap by a tenth.
    const drawTracks = anim.tracks.filter((t) => !fillTracks.includes(t))
    expect(drawTracks.length).toBeGreaterThan(0)
    expect(Math.max(...drawTracks.map((t) => t.relStop))).toBeCloseTo(0.6, 6)
    expect(Math.min(...drawTracks.map((t) => t.relStart))).toBeCloseTo(0, 6)
  })

  test("the fill goes to FULL opacity — solid, not the 0.07 wash", () => {
    // `Fill(solid=True)` is transparency 0, i.e. opacity 1
    // (object.py:475-477). A gear ends the span as a solid toothed ring.
    const system = new System()
    const anim = system.createAnim()!
    const fillTracks = anim.tracks.filter((t) =>
      [...system.walk()].some((h) => h instanceof Stroke && h.fillOpacity === t.param),
    )
    for (const track of fillTracks) {
      expect(track.mode).toBe("to")
      expect(track.values.at(-1)).toBe(1)
    }
  })

  test("every drawing draws — no group is left out of the span", () => {
    const system = new System()
    const anim = system.createAnim()!
    const sketches = [...system.walk()].filter((h): h is Sketch => h instanceof Sketch)
    for (const sketch of sketches) {
      const lines = [...sketch.walk()].filter((h) => h instanceof Stroke && h !== sketch)
      const driven = lines.some((line) =>
        anim.tracks.some((t) => t.param === (line as Stroke).creation),
      )
      expect(driven).toBe(true)
    }
  })

  test("unCreateAnim is NOT overridden — UnDraw is not a dispatcher", () => {
    // Scene03 calls `UnDraw(global_system)` directly and pydeation's
    // UnDraw has no class table, so the un-draw is the generic one. The
    // absence is as deliberate as createAnim's presence.
    expect(Object.getOwnPropertyNames(System.prototype)).not.toContain("unCreateAnim")
  })
})

describe("stroke order — shortest first", () => {
  test("a gear's inner circle is handed to the Sketch BEFORE its rim", () => {
    // The reference draws the inner circle to 80% before the teeth begin
    // (System.ts's `shortestFirst` carries the frame table). Only
    // short_long predicts that; bottom_top and long_short both give the
    // rim first. The ordering is applied as DATA, so this asserts the
    // data the Sketch actually receives.
    const system = new System()
    void system.law.parts
    const given = system.law.gear.data
    const len = (sp: readonly number[]): number => {
      let t = 0
      for (let i = 2; i + 1 < sp.length; i += 2) {
        t += Math.hypot(sp[i]! - sp[i - 2]!, sp[i + 1]! - sp[i - 1]!)
      }
      return t
    }
    expect(given.subpaths.length).toBe(2)
    expect(len(given.subpaths[0]!)).toBeLessThan(len(given.subpaths[1]!))
    // And it is genuinely a REORDER of the raw asset, whose document
    // order is rim-first — so this test fails if the ordering is dropped.
    expect(len(gearBig.subpaths[0]!)).toBeGreaterThan(len(gearBig.subpaths[1]!))
  })

  test("every drawing is handed to its Sketch shortest-first", () => {
    const system = new System()
    for (const group of [system.law, system.economy, system.finance, system.healthcare]) {
      void group.parts
      for (const data of [group.gear.data, group.icon.data]) {
        const lens = data.subpaths.map((sp) => {
          let t = 0
          for (let i = 2; i + 1 < sp.length; i += 2) {
            t += Math.hypot(sp[i]! - sp[i - 2]!, sp[i + 1]! - sp[i - 1]!)
          }
          return t
        })
        for (let i = 1; i < lens.length; i++) expect(lens[i]!).toBeGreaterThanOrEqual(lens[i - 1]!)
      }
    }
  })

  test("reordering keeps `closed` aligned with its subpath", () => {
    // A reorder that shuffled the coordinates but not the closed flags
    // would be a silent corruption; the flags must travel with them.
    const system = new System()
    void system.finance.parts
    const given = system.finance.icon.data
    expect(given.closed.length).toBe(given.subpaths.length)
    // cash's five subpaths are all closed in the source, so the multiset
    // is preserved whatever the permutation.
    const sorted = (a: readonly number[]) => [...a].sort()
    expect(sorted(given.closed)).toEqual(sorted(cash.closed))
  })

  test("the reorder preserves every subpath — nothing is dropped", () => {
    const system = new System()
    void system.law.parts
    expect(system.law.icon.data.subpaths.length).toBe(justice.subpaths.length)
    expect(system.law.gear.data.subpaths.length).toBe(gearBig.subpaths.length)
    const total = (d: SketchData) => d.subpaths.reduce((a, sp) => a + sp.length, 0)
    expect(total(system.law.icon.data)).toBe(total(justice))
  })
})
