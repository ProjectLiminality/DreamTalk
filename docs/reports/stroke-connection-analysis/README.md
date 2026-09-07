# stroke-connection analysis scripts

Scratch analysis backing `docs/reports/stroke-connection.md`. Read-only on
`core/` — these only import the asset data and the silhouette math.

Requires: `bun`, `python3` with `PIL` and `numpy`, and the reference frames at
`refs/pitch/origins/frames5` (gitignored; recover per DECISIONS 2026-08-22).

## Run order

Some scripts consume a JSON intermediate from an earlier one. Set a scratch
dir first — the scripts have the path hardcoded to the session scratchpad, so
edit `OUT`/`GEOM` at the top of each if you are re-running elsewhere.

```bash
cd /Users/davidrug/RealDealVault/ProjectLiminality/DreamTalk

# 1. asset profile — 37 subpaths, lengths, closure, bboxes
bun run docs/reports/stroke-connection-analysis/subpaths.ts

# 2. project david to reference screen pixels  -> geom.json  (REQUIRED FIRST)
bun run docs/reports/stroke-connection-analysis/export-geom.ts > geom.json

# 3. the measurement: pen itinerary from the frames -> itin2.json
python3 docs/reports/stroke-connection-analysis/itinerary.py 13    # coarse, min/max spans
python3 docs/reports/stroke-connection-analysis/itinerary2.py 12   # binned arc intervals (the one used)

# 4. analysis (need itin2.json)
bun run docs/reports/stroke-connection-analysis/perstroke.ts     # per-subpath completion curves
bun run docs/reports/stroke-connection-analysis/onset.ts         # onset vs length rank, Spearman rho
bun run docs/reports/stroke-connection-analysis/window-fit.ts    # draw windows, per-stroke and aggregate rates

# 5. connection structure (need only geom.json / the asset)
bun run docs/reports/stroke-connection-analysis/endpoints.ts     # coincident subpath endpoints
bun run docs/reports/stroke-connection-analysis/chain.ts 3.5     # CONNECTIIONZ=3 chaining, 37 -> 25
python3 docs/reports/stroke-connection-analysis/frame1.py        # t=0.2 single-component forensics

# 6. hypotheses tested and REJECTED (kept so the negatives are re-checkable)
bun run docs/reports/stroke-connection-analysis/reversal-test.ts # split-at-angle sweep
bun run docs/reports/stroke-connection-analysis/all-mode.ts      # simultaneous-draw models
bun run docs/reports/stroke-connection-analysis/staggered.ts     # overlap-factor sweep
bun run docs/reports/stroke-connection-analysis/overlap-fit.ts   # stagger laws on onsets
bun run docs/reports/stroke-connection-analysis/predict.ts 3.5   # chained + sequential prediction
bun run docs/reports/stroke-connection-analysis/splitpoints.ts   # turn angles at measured boundaries

# 7. cylinder
bun run docs/reports/stroke-connection-analysis/cylinder.ts      # arc-length ordering is pose-independent
bun run docs/reports/stroke-connection-analysis/cylinder2.ts     # cap foreshortening, S01 vs S06
```

## What each one established

| script | result |
|---|---|
| `frame1.py` | t=0.2 is ONE connected mark spanning sp0 and sp6 — connection merges |
| `endpoints.ts` | 24 endpoint pairs under 6px; david's open subpaths form one chain |
| `chain.ts` | `CONNECTIIONZ=3` chaining gives 25 strokes from 37 subpaths |
| `itinerary2.py` | the pen's measured itinerary — the ground truth for everything else |
| `perstroke.ts` | per-subpath completion staircase, in length order |
| `onset.ts` | **Spearman ρ = 0.97** — the order is `long_short` on the subpaths as they are |
| `window-fit.ts` | per-stroke rate median 779 px/s; concurrent sum ≈ 10000 px/s (global budget) |
| `reversal-test.ts` | every split angle 30–180° scores ≤0.14 — splitting is not the mechanism |
| `staggered.ts` | overlap family peaks at 0.27 (φ=0.4, long_short) — right family, unfitted |
| `cylinder.ts` | away-facing arc is longer for EVERY pose — length ordering cannot flip |
| `cylinder2.ts` | S01/S06 sit at opposite extremes of cap foreshortening |

The validation that makes the itinerary trustworthy (100% of full-ink pixels
within 2px of the projected geometry, median 0.53px) is the sanity block at
the end of the report's §1; it re-runs as an inline snippet there.

## The C4D experiment scripts (written, not yet run)

`c4d-expA-scheduler.py` and `c4d-expB-cylinder.py` are the two controlled
renders that would close the report's remaining open questions — the draw
scheduler (§2.6) and the cylinder cap-arc order (§3.3). Unlike everything
above, they do not analyse the 2021 frames; they drive Cinema 4D directly.

They run under `c4dpy`, Maxon's headless Python — no GUI, no open document:

```bash
"/Applications/Maxon Cinema 4D 2025/c4dpy.app/Contents/MacOS/c4dpy" \
  docs/reports/stroke-connection-analysis/c4d-expA-scheduler.py /tmp/expA
```

**Both are blocked as of 2026-09-07 on `Error: License Expired`** — c4dpy
reaches the Maxon licence service and is refused. The full attempt log,
including why the failure first looked like a shader-parser hang, is in
stroke-connection.md §6. Assign a licence in the Maxon App Manager first.

| script | would establish |
|---|---|
| `c4d-expA-scheduler.py` | the concurrency law: 6 lines of known very-different lengths, per-stroke onset/rate under `stroke_method` 0 vs 1 and document order |
| `c4d-expB-cylinder.py` | the cap-arc flip point: one cylinder, `bottom_top`, pitch swept 0.1 → π/2 in ten steps |
