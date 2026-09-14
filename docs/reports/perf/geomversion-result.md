# Geometry version counter — result

**Date:** 2026-09-14 · **Optimization #1** from `thewall-profile.md` (the
`shapeKey` recompute) · **Scope:** universal — the geometry dirty-check runs for
every stroke in every scene · **Host:** vanilla-Three WebGPU
(`src/render/three-host.ts`).

## The one-line verdict

The host's per-frame geometry dirty-check no longer flattens a Line's polyline
into a fresh `number[]` and compares it element-wise every frame. A Line now
carries a monotonic **`geomVersion`** that bumps iff its polyline changed, and
the host keys on that plus the two phase scalars — an **O(1) integer/float
compare** in place of an O(pointCount) alloc + compare. Proven **byte-identical**
across 13 scenes (126k in-process geometry assertions) and — decisively — by two
rendered gauntlets (s06 section curve, s01 morphs) scoring bit-for-bit the
baseline. The isolated dirty-check cost on TheWall's stroke mix drops **~1.2 ms →
~0.06 ms per frame (95%)**, removing **~184,000 number allocations per frame**.

The change is **Line-scoped by design** (correctness first): the parametric
shapes keep their small value-array keys, because their params may be BOUND and a
value-write version would miss a derived change. See "Why Line-scoped".

## The design — a version that changes iff the geometry does

A `Line`'s rendered polyline is `rephasePolyline(line.points, drawStart,
drawReversed)`. So the dirty signature is exactly `(geomVersion, drawStart,
drawReversed)`:

- **`Line.geomVersion`** (`src/parts/primitives.ts`) — a monotonic counter.
  `points` became an enumerable accessor over a symbol-keyed backing whose
  **setter bumps the version**; so a static Line (`new Line({ points })`,
  AnnularSector's edge assignment, any `line.points = …`) bumps on every write.
- **Derived Lines** bump the version **when their memo recomputes**, at each of
  the three places the derived-`points` pattern lives:
  - `src/parts/curves.ts` (`derivePoints`) — SectionCurve, Connection.
  - `vocabulary/Morph/Morph.ts` (`derivePoints`) — MorphShape's blend.
  - `vocabulary/Cable/Cable.ts` (`derivedLine`) — the cable edges/rings. This one
    keys on the `geometry()` memo's OBJECT IDENTITY (stable while unchanged, fresh
    when `geometryKey()` moves), so the Line's version bumps exactly when the
    cable geometry recomputes.
- **The host** (`src/render/three-host.ts`) replaces `shapeKey(holon)` +
  `keysEqual` with `sigChanged(holon, binding.sig)`. For a Line it reads
  `holon.points` FIRST (forcing a derived recompute so the version is current for
  this frame), then compares the version+phase triple. For a parametric shape it
  compares the small value array exactly as before. The `drawingWashes` loop
  (Sketch subpaths) uses `drawingSig` — the sum of the subpath Lines' versions
  plus their count — in place of flattening every subpath every frame. **The regen
  path itself (`polyline`, `setPoints`, `setPolygon`) is completely unchanged.**

### The byte-identity argument (why it cannot stale)

`polyline(Line)` output changes only if `line.points` or the phase changed. The
phase is in the signature. `line.points` changing ⟺ `geomVersion` bumped: the
setter bumps on every static write (no code mutates a Line's `points` array in
place — verified by grep), and a derived getter bumps whenever it recomputes. And
a derived memo is a pure function of its sourceKey, so **output-differs ⟹
sourceKey-differs ⟹ version-bumped** — the new regen set is a **superset** of the
old array-compare's, never fewer. Under-signalling (stale ink) is therefore
impossible; the only cost the change can add is a redundant regen (correct
pixels), which the tests confirm is rare.

### Why Line-scoped, not universal to params

The Line case is ~95% of the cost — cables, morphs, sketches and section curves
are the many-point derived geometry; the parametric shapes (Circle/Square/
Polygon/Arc/AnnularSector/Rectangle/Ellipse) key on 2–5 scalar Param VALUES. A
Param can be BOUND (`follow`) to a derived reading (`params.ts` `#source`), whose
value changes without any `set value` call — so a version bumped only in the
setter would **miss** a bound param's change and stale the geometry. The small
value array is already cheap and always correct, so those cases keep it, with a
comment. This is the task's "if the Param-version path risks correctness, do the
Line case properly and leave the parametric arrays as-is" — taken deliberately.

One residual, noted not fixed: `Cable.view` is read by `computeGeometry` but not
in `geometryKey`. It is a build-time constant (`{0,0,1}`, never animated in the
corpus), so the memo — and thus the version — is complete today; an animated
`view` would have to enter `geometryKey` exactly as the memo already needs.

## Gates

### Byte-identity — the decisive proof

**In-process geometry equivalence (`test/geomversion.test.ts`, 19 tests, 126k
assertions).** For a sweep of t across each scene, for every Line: whenever the
dirty signature is unchanged from the previous frame, the rendered polyline
`rephasePolyline(points, drawStart, reversed)` is byte-identical; and a given
signature VALUE names exactly one geometry over the whole sweep. Scenes covered:

```
S01 (morphs), S03 (spinning section plane), S06 (cylinder section),
S04 (axes/arrows/parametric), S05 (recede + drawStart/reversed),
Scene01 (origins morphs), mindvirus (cables + moloch), molocheye,
labyrinth, sketch (subpath drawings), curves (connections),
magicmove (morph transitions), thewall (236 moving cables).
```

This directly proves no stale geometry — the strongest test available, and it is
what exposed the Cable gap (its derived Line did not carry a version; fixed).

**Rendered gauntlets — bit-for-bit vs baseline.** Baseline (HEAD, changes
stashed) vs this change, same Chrome, `scripts/gauntlet.ts`, per-frame metrics
(iou, chamfer_ours/ref, coverage_ours/ref):

| Scene | frames | per-frame metrics identical |
|---|---|---|
| **s06** (section curve, derived Line) | 8 | **YES — all identical** |
| **s01** (morphs, derived Line) | 6 | **YES — all identical** |

s06 mine == base: `cov_ours` 0.7384 / 0.9904 / 1 / 0.9966 / 1 / 1 / 1 / 1 and
every chamfer identical; mean 0.9657 both. s01 mine == base: 6/6 PASS, mean
0.9958 both. (The only `summary.json` difference was the output file paths.)

### tsc / tests

- **tsc:** clean (`bunx tsc --noEmit`); vocabulary/Cable + Morph typecheck clean
  under the same flags.
- **bun test:** **1267 pass / 0 fail** across 63 files (was 1248; +19 new in
  `test/geomversion.test.ts`): the static-setter bump; a derived Line bumping on
  source change and NOT on a re-read at rest; a SectionCurve tracking its plane;
  the `{ points }` override reaching the versioned setter; no-stale across the 13
  scenes; a static Line NOT re-signalling under transform-only animation; S04's
  static Lines regenerating a handful of times, not every frame.

## Measurement

**Isolated dirty-check cost (the clean number).** A pure-JS micro-bench of
exactly what changed, at TheWall's stroke mix (472 cable-edge Lines @ ~130 pts +
3,304 parametric shapes), 500 frames, 3 reps:

```
OLD (flatMap + keysEqual every frame): ~1.20 ms/frame
NEW (version+phase triple compare):    ~0.06 ms/frame
saved:                                 ~1.2 ms/frame (95% of the dirty-check)
allocations removed:  472 arrays × 390 numbers ≈ 184,000 numbers / frame → ~0
```

**Whole `sync()` at t=3.33 on TheWall** (puppeteer, `scripts/sync-bench.ts`,
Chrome `--use-angle=metal`, 1280×720, 60–80 reps, cull disabled to isolate the
stroke loop):

| build | sync() mean | median |
|---|---|---|
| baseline (HEAD) | ~23.4 ms | 23.4 ms |
| this change | ~23.7 ms | 23.5 ms |

The whole-`sync()` delta is within run-to-run noise, and honestly so: on **this
scene** the ~1.2 ms the dirty-check saves is buried under the stroke loop's
dominant cost, which is the **two `screenArc` calls + `style()` per stroke** that
this change does not touch (the profile's own "that plus two screenArc calls per
stroke is the bulk of the ~9 ms"). The dirty-check flatMap was a real but minority
slice of that loop. Where the win is largest is scenes of **static many-point
Lines** (Sketches, section-curve/DreamSong geometry that does not move every
frame): there the version gate skips the regen ENTIRELY, not merely the compare —
and removes the per-frame allocation everywhere.

## Files

- `src/parts/primitives.ts` — `Line.geomVersion` + the versioned `points`
  accessor (symbol-keyed backing; constructor installs the enumerable accessor so
  the `{ points }` override still scans).
- `src/parts/curves.ts`, `vocabulary/Morph/Morph.ts` — derived getters bump on
  memo recompute.
- `vocabulary/Cable/Cable.ts` — derived Line bumps on `geometry()` memo identity
  change.
- `src/render/three-host.ts` — `ShapeSig` + `freshSig`/`sigChanged`/`drawingSig`
  replace the per-frame `shapeKey` flatMap on the Line path; regen path unchanged.
- `test/geomversion.test.ts` — the counter contract + no-stale gate + skip proof.
- `scripts/sync-bench.ts` — the whole-`sync()` timing harness.

## Constraints honoured

Additive/surgical (only the dirty-CHECK mechanism changed; all geometry math and
the regen path untouched), no new deps, **no commits** (the lead integrates), the
:4190 dev server was killed. `editor/dist/main.js` shows modified in git — a
build artifact this work did not intentionally touch (fresh.ts builds only the
gitignored `demo/dist`); left for the lead.
