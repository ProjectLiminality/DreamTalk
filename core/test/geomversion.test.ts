/**
 * Geometry version counter (perf) — the byte-identity gate.
 *
 * The host's per-frame geometry dirty-check no longer flattens a Line's
 * polyline into a fresh number[] and compares it element-wise; it keys on
 * `Line.geomVersion`, a monotonic counter that bumps iff the polyline
 * changed (setter for a static Line, derived-getter recompute for a
 * curve/morph — primitives.ts, curves.ts, Morph.ts), plus the two phase
 * scalars `drawStart`/`drawReversed` the host re-applies in `polyline()`.
 *
 * The contract the render output rests on is EXACTLY this: whenever the
 * dirty-check says "unchanged" it must be right — the rendered polyline
 * `rephasePolyline(line.points, drawStart, reversed)` must be byte-for-byte
 * what it was the previous frame. Under-signalling would leave stale
 * geometry (WRONG pixels); over-signalling is a redundant regen (right
 * pixels, wasted work) and is allowed. This file pins the no-stale
 * property directly, both as a unit contract on the counter and — the
 * decisive test — across a BROAD set of real scenes swept over t.
 */

import { describe, expect, test } from "bun:test"
import { Line, rephasePolyline, type Vec3Like } from "../src/parts/index"
import { Connection, SectionCurve, SectionPlane } from "../src/parts/curves"
import { PI } from "../src/constants"
import type { Dream } from "../src/dream"

// The scene set — chosen to exercise every derived-Line path (morphs,
// section curves, cables, sketches) plus the static-Line and parametric
// cases, per the perf brief's byte-identity scope.
import { S01Dream } from "../demo/video01/S01"
import { S03Dream } from "../demo/video01/S03"
import { S06Dream } from "../demo/video01/S06"
import { S04Dream } from "../demo/video01/S04"
import { S05Dream } from "../demo/video01/S05"
import { Scene01Dream } from "../demo/origins/Scene01"
import { MindVirusDream } from "../demo/wall/MindVirus"
import { MolochEyeDream } from "../demo/wall/MolochEye"
import { LabyrinthDream } from "../demo/wall/Labyrinth"
import { SketchDream } from "../demo/vocabulary/Sketch"
import { CurvesShowcaseDream } from "../demo/CurvesShowcase"
import { MagicMoveDemoDream } from "../demo/MagicMoveDemo"
import { TheWallDream } from "../demo/wall/TheWall"

// ─── 1. THE COUNTER CONTRACT (unit) ─────────────────────────────────

describe("Line.geomVersion — the counter", () => {
  test("a static Line bumps its version on every setter write, and only then", () => {
    const line = new Line({ points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] })
    const v0 = line.geomVersion
    // A read does not bump.
    void line.points
    void line.points
    expect(line.geomVersion).toBe(v0)
    // A write bumps.
    line.points = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }]
    expect(line.geomVersion).toBe(v0 + 1)
    line.points = [{ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }]
    expect(line.geomVersion).toBe(v0 + 2)
    // The value round-trips through the accessor.
    expect(line.points.map((p) => p.x)).toEqual([0, 3])
  })

  test("the { points } override reaches the versioned setter", () => {
    const line = new Line({ points: [{ x: 5, y: 6, z: 7 }] })
    // The override applied through the scan, so the backing holds it…
    expect(line.points).toEqual([{ x: 5, y: 6, z: 7 }])
    // …and it went through the setter (version advanced past the default 0).
    expect(line.geomVersion).toBeGreaterThan(0)
  })

  test("a derived Line bumps its version when its source changes, NOT when read twice at rest", () => {
    // A Connection's derived Line recomputes when either anchor moves.
    const src = new Line({ points: [{ x: 0, y: 0, z: 0 }] })
    const tgt = new Line({ points: [{ x: 0, y: 0, z: 0 }] })
    src.x.value = -100
    tgt.x.value = 100
    const conn = new Connection(src, tgt)
    void conn.parts // force compose() → installs the derived accessor
    const line = conn.line
    // First read computes once.
    void line.points
    const v1 = line.geomVersion
    // Re-reading at the SAME state does not bump (the memo is honoured).
    void line.points
    void line.points
    expect(line.geomVersion).toBe(v1)
    // Moving an anchor changes the sourceKey → next read recomputes and bumps.
    tgt.x.value = 300
    void line.points
    expect(line.geomVersion).toBe(v1 + 1)
    // And again, stable at the new state.
    void line.points
    expect(line.geomVersion).toBe(v1 + 1)
  })

  test("a SectionCurve's derived Line tracks the plane it is cut by", () => {
    const plane = new SectionPlane({ b: PI / 2 })
    const curve = new SectionCurve({ radius: 50, height: 200 }).cutBy(plane)
    void curve.parts
    const line = curve.line
    void line.points
    const v1 = line.geomVersion
    void line.points
    expect(line.geomVersion).toBe(v1)
    // Turn the plane: the section changes, so the next read recomputes.
    plane.h.value = 0.5
    void line.points
    expect(line.geomVersion).toBe(v1 + 1)
  })
})

// ─── 2. THE NO-STALE GATE, ACROSS SCENES (the decisive test) ────────

/**
 * The rendered polyline of a Line, exactly as the host builds it in
 * `polyline()`: the raw points re-phased to `drawStart`/`drawReversed`.
 * Serialised so two frames can be compared byte-for-byte.
 */
const renderedGeometry = (line: Line): string => {
  const phase = line.drawStart.value
  const reversed = line.drawReversed.value
  const pts =
    phase === 0 && !reversed ? line.points : rephasePolyline(line.points, phase, reversed)
  return JSON.stringify(pts)
}

/** The host's Line dirty signature — version + the two phase scalars. It
 *  reads `points` FIRST (as the host does) so a derived Line's version is
 *  current for this frame before it is read. */
const dirtySig = (line: Line): string => {
  void line.points
  return `${line.geomVersion}|${line.drawStart.value}|${line.drawReversed.value ? 1 : 0}`
}

const lineHolonsOf = (dream: Dream): Line[] => {
  const lines: Line[] = []
  for (const root of dream.roots) for (const h of root.walk()) if (h instanceof Line) lines.push(h)
  return lines
}

/**
 * Sweep t across a scene and assert the gate is honest: whenever a Line's
 * dirty signature is unchanged from the previous frame, its rendered
 * polyline is byte-identical to the previous frame. If it ever held the
 * signature while the geometry moved, that Line would render one frame
 * stale in the host — the exact failure this counter must never allow.
 *
 * Also asserts the stronger statement the counter is meant to guarantee:
 * a given signature VALUE maps to exactly one geometry over the whole
 * sweep (a signature is a faithful name for a geometry — the host can
 * cache on it). Since the version is monotonic, each distinct signature
 * corresponds to one moment of the geometry's life, so any signature that
 * ever named two geometries would be a stale-cache hazard.
 */
const assertHonestGate = (make: () => Dream, samples = 60): void => {
  const dream = make()
  const lines = lineHolonsOf(dream)
  const duration = dream.duration || 1
  const prevSig = new Map<Line, string>()
  const prevGeom = new Map<Line, string>()
  // Per (line, signature): the one geometry that signature must always name.
  const bySig = new Map<Line, Map<string, string>>()

  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * duration
    dream.applyAt(t)
    for (const line of lines) {
      const sig = dirtySig(line)
      const geom = renderedGeometry(line)
      const hadSig = prevSig.get(line)
      if (hadSig !== undefined && hadSig === sig) {
        // Signature unchanged since the previous frame → the host would
        // NOT regenerate, so the geometry MUST be unchanged (no stale ink).
        expect(geom).toBe(prevGeom.get(line)!)
      }
      // A signature value must name one geometry for this Line's whole life.
      let seen = bySig.get(line)
      if (!seen) bySig.set(line, (seen = new Map()))
      const first = seen.get(sig)
      if (first === undefined) seen.set(sig, geom)
      else expect(geom).toBe(first)
      prevSig.set(line, sig)
      prevGeom.set(line, geom)
    }
  }
}

describe("no-stale gate across scenes", () => {
  const scenes: [string, () => Dream][] = [
    ["S01 (morphs)", () => new S01Dream()],
    ["S03 (spinning section plane)", () => new S03Dream()],
    ["S06 (cylinder section)", () => new S06Dream()],
    ["S04 (axes, arrows, parametric)", () => new S04Dream()],
    ["S05 (recede, drawStart/reversed)", () => new S05Dream()],
    ["Scene01 (origins morphs)", () => new Scene01Dream()],
    ["mindvirus (cables, moloch)", () => new MindVirusDream()],
    ["molocheye", () => new MolochEyeDream()],
    ["labyrinth", () => new LabyrinthDream()],
    ["sketch (subpath drawings)", () => new SketchDream()],
    ["curves showcase (connections)", () => new CurvesShowcaseDream()],
    ["magicmove (morph transitions)", () => new MagicMoveDemoDream()],
  ]
  for (const [name, make] of scenes) {
    test(`${name}: signature held ⟹ geometry unchanged`, () => {
      assertHonestGate(make)
    })
  }

  test("thewall (236 moving cables): signature held ⟹ geometry unchanged", () => {
    // The wall bakes its cables at build (~2.3s), so it runs once with a
    // coarser sweep — still every cable Line, across the whole flight.
    assertHonestGate(() => new TheWallDream(), 24)
  }, 60000)
})

// ─── 3. THE OPTIMIZATION ACTUALLY SKIPS (regen count) ───────────────

/**
 * Count, per Line, how many times its dirty signature CHANGES across a
 * sweep — i.e. how many times the host would call setPoints(). The old
 * per-frame flatten+compare cost was paid every frame regardless; the
 * version gate must let a Line that does not move be regenerated a
 * handful of times, not once per frame.
 */
const signatureChanges = (make: () => Dream, samples: number): Map<Line, number> => {
  const dream = make()
  const lines = lineHolonsOf(dream)
  const duration = dream.duration || 1
  const prev = new Map<Line, string>()
  const changes = new Map<Line, number>()
  for (const l of lines) changes.set(l, 0)
  for (let i = 0; i <= samples; i++) {
    dream.applyAt((i / samples) * duration)
    for (const line of lines) {
      const sig = dirtySig(line)
      const had = prev.get(line)
      if (had !== undefined && had !== sig) changes.set(line, changes.get(line)! + 1)
      prev.set(line, sig)
    }
  }
  return changes
}

describe("the gate skips unchanged geometry", () => {
  test("S04's static axis Lines regenerate a handful of times, not every frame", () => {
    const samples = 120
    const changes = signatureChanges(() => new S04Dream(), samples)
    // S04's geometry is fixed (axes, a curve, a gradient); only draw fronts
    // and transforms animate. No Line's shape should churn every frame — the
    // whole point of the counter. A generous ceiling well under `samples`.
    let maxChanges = 0
    for (const [, n] of changes) maxChanges = Math.max(maxChanges, n)
    expect(changes.size).toBeGreaterThan(0)
    expect(maxChanges).toBeLessThan(samples / 4)
  })

  test("a purely static Line never re-signals under transform-only animation", () => {
    // A Line whose points are set once; moving its holon (x/scale) must NOT
    // bump its geomVersion — transforms live on the group, not the polyline.
    const line = new Line({ points: [{ x: -50, y: 0, z: 0 }, { x: 50, y: 0, z: 0 }] })
    const v0 = line.geomVersion
    line.x.value = 100
    line.scale.value = 3
    line.h.value = 1
    void line.points
    expect(line.geomVersion).toBe(v0)
  })
})
