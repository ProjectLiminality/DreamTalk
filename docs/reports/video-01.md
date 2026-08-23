# video-01 reproduction — Dialectical Thinking

The gauntlet's living record. Ground truth: `refs/video-01/frames5/`
(783 frames @ 5fps). Scoring: `core/scripts/overlay.py` (hue-tolerant,
geometry-strict) driven by `core/scripts/gauntlet.ts`.

**Directive (David, 2026-08-23): reproduce until flawless.** Canonical
palette; the evaluator ignores the 2021 hue delta and stays strict on
geometry, timing, and line quality.

## The bar

A frame PASSes at coverage_ref ≥ 0.90 AND coverage_ours ≥ 0.90 within
3px, with both chamfer means ≤ 3px. A scene passes when every scored
frame passes. Thresholds tighten as reproduction converges — the floor is
set by YouTube encode blur and 1px AA differences, not by our geometry.

## Scene status

| Scene | Video span | Frames | Status | Pass rate | Mean cov (ref/ours) |
|-------|-----------|--------|--------|-----------|---------------------|
| Intro (logo) | 0–6s | f0000–f0030 | blocked (GATES #1: in scope?) | — | — |
| S01 | 6–32s | f0030–f0160 | not started | — | — |
| S02 | 32–58s | f0160–f0290 | not started | — | — |
| S03 | 58–82s | f0290–f0410 | not started | — | — |
| S04 | 82–89s | f0410–f0445 | not started | — | — |
| S05 | 89–98.5s | f0445–f0492 | not started | — | — |
| S06 | 98.5–114.5s | f0492–f0572 | not started | — | — |
| S07 | 114.5–120.5s | f0572–f0602 | not started | — | — |
| S08 | 120.5–140s | f0602–f0700 | not started | — | — |
| S09 | 140–150.5s | f0700–f0752 | not started | — | — |
| S10 | 150.5–157s | f0752–f0782 | not started | — | — |

Build order (vocab report §4, easiest → hardest): S04, S10, S09, S07,
S05, S01, S03, S02, S06, S08.

## Prerequisites

| Item | Status |
|------|--------|
| Stroke pipeline (TSL ribbon) | done (Ch 4) |
| Cylinder + analytic silhouette | done (Ch 8) |
| Rectangle / Axes+grid / Eye / fills / Create dispatch / Erase | done (batch 1) |
| Camera calibration (2021 projection) | in progress |
| Text + Write | in progress |
| Section curves (S03/S06) + Connection (S10) | in progress |
| Overlay comparator + gauntlet harness | done |

## Round-1 findings (2026-08-23)

**Harness bug, fixed mid-round** (found by the S04 builder): the demo page
letterboxed the canvas into the top 720px of a 1280×760 viewport, and
overlay.py then resized 760→720, squashing our geometry by 5.3%. Every
composite scored before the fix understated fidelity badly (S04 mean
coverage went 0.37 → 0.85 on the fix alone, 4 of 6 frames flipping to
PASS). Fix: the demo canvas fills the viewport and the comparator's
resize undoes the stretch exactly (core/demo/index.html). **Any
calibration measured against pre-fix composites must be re-measured.**

**RESOLVED 2026-08-23 (see DECISIONS): the lens is 36mm.**
`refs/pydeation-legacy/camera/camera.py` builds a bare
`c4d.CameraObject()` and never sets focal length → C4D's factory 36mm
(hfov 53.13°) → 1.280 px/unit at d=1000, exactly the measured value.
Our rig's 45mm was imported from the modern C4D port. Apply between
rounds (`Observer.fov` default) and re-score every scene together;
scene-local dollies that compensated for the old scale must be removed
in the same pass. Original finding below.

**The lens question (as first observed).** Four independent measurements off the
reference (tick pitch, two object centres, rectangle extents) all give
1.280 px/world-unit at the rig's 1000-unit distance; our rig projects
1.600 — i.e. the 2021 camera behaves like a 36mm lens (hfov 53.13°), not
the 45mm the ported rig assumes. CameraCal.ts independently flagged the
same ~0.83 factor on the S01 cylinder. Deliberately NOT changed during a
live round (it would invalidate every scene's in-flight calibration);
scenes compensate scene-locally via dolly, which is how pydeation
expressed zoom anyway. **Decide between rounds, then re-score all scenes
together.**

## Per-scene records

_(Each scene gets its metrics table, composite paths, and the list of
capabilities it forced into the framework as it is attempted.)_
