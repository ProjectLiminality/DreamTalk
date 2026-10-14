/**
 * Polylines — many lines as ONE stroke.
 *
 * A Line is one polyline, one ribbon, one draw call, one set of echoes —
 * right for a line with a pen of its own (a draw-on, an erase, an arrow).
 * A symbol drawn from dozens of edges that never move apart (a Grain's
 * reel, its pallet slats) would cost dozens of each. A Polylines holds
 * them all: one holon, drawn by one ribbon whose segments simply skip the
 * gaps between its loops (RibbonStroke.setLoops) — so its certainty blur,
 * its golden glow and its clip are one each, too.
 *
 * It has no pen front: `creation` shows it (> 0) or not, `erasure` hides it
 * (≥ 1). A loop that must draw on is a Line.
 *
 * Its geometry follows Line's contract: `loops` is an accessor whose every
 * write bumps `geomVersion` (the host's O(1) dirty-check), and
 * `deriveLoops` makes it a memoised function of a source key.
 */

import { bumpParamEpoch } from "../params"
import type { Overrides } from "../holon"
import { Stroke, type Vec3Like } from "./primitives"

const LOOPS = Symbol("dtPolylinesLoops")

export class Polylines extends Stroke {
  /** Bumped whenever `loops` change. Monotonic. */
  geomVersion = 0
  /** The polylines, local space; a closed one repeats its first point at the end. */
  loops: Vec3Like[][] = [];
  [LOOPS]: Vec3Like[][] = []

  constructor(overrides: Overrides = {}) {
    super(overrides)
    const initial = (this as { loops: Vec3Like[][] }).loops
    Object.defineProperty(this, "loops", {
      configurable: true,
      enumerable: true,
      get(this: Polylines): Vec3Like[][] {
        return (this[LOOPS] as Vec3Like[][] | undefined) ?? []
      },
      set(this: Polylines, v: Vec3Like[][]) {
        this[LOOPS] = v
        this.geomVersion++
        bumpParamEpoch()
      },
    })
    ;(this as { loops: Vec3Like[][] }).loops = initial
  }
}

/**
 * Give a Polylines DERIVED loops: `compute` runs only when `sourceKey`
 * changes (element-wise ===), and `geomVersion` bumps exactly then — the
 * same contract as `derivePoints` for a Line.
 */
export const deriveLoops = (
  lines: Polylines,
  sourceKey: () => readonly unknown[],
  compute: () => Vec3Like[][],
): void => {
  let key: readonly unknown[] | undefined
  let memo: Vec3Like[][] = []
  let version = lines.geomVersion
  // The host checks `geomVersion` before it reads `loops`, so the version
  // itself must refresh (soliddrawing.ts deriveSurface's shape).
  const refresh = () => {
    const next = sourceKey()
    if (!key || key.length !== next.length || next.some((v, i) => v !== key![i])) {
      key = next
      memo = compute()
      version++
    }
  }
  Object.defineProperty(lines, "geomVersion", {
    configurable: true,
    enumerable: true,
    get: () => (refresh(), version),
    set(_v: number) {},
  })
  Object.defineProperty(lines, "loops", {
    configurable: true,
    enumerable: true,
    get(): Vec3Like[][] {
      refresh()
      return memo
    },
    set(_v: Vec3Like[][]) {},
  })
}
