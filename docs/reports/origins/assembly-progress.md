# Origins assembly — progress ledger

Resumable notes for the ORIGINS song assembly (a predecessor was killed
mid-render when the machine slept). Frames live in the scratchpad, not
the repo; the paths below are the ones a successor resumes from.

## Status

- [x] Boundary table derived from each scene file's own header
- [x] Scene12 inherited-decision applied
- [x] `core/demo/origins/OriginsPitch.ts` + registry entry `origins`
- [x] offset tests — `core/test/origins-song.test.ts`, 20/20, 51,203 asserts
- [x] `bun test` 954/954 (934 baseline + 20 mine)
- [x] spot-score — 127/175, and every chapter matches its standalone exactly
- [x] render — 11,337 frames, 9.9 min
- [x] assemble + sync check — in sync at v032 / v152 / v300
- [x] S04 gauntlet 6/6 (port 4535)

**ASSEMBLY COMPLETE.** Outputs:
`docs/reports/origins/OriginsPitch-repro.mp4` (1280x720, 377.9s),
`docs/reports/origins/OriginsPitch-sidebyside.mp4` (2560x720, ours left,
original right, reference audio), plus the three sync stills
`OriginsPitch-sync-v032/v152/v300.png`.

## Pre-existing gate failure NOT mine (report, do not fix)

`bunx tsc --noEmit` in `core/` emits two errors, both in
`demo/origins/Scene06.ts` (unmodified since HEAD, `git diff HEAD
--quiet` clean):

    demo/origins/Scene06.ts(922,11): error TS2304: Cannot find name 'Holon'.
    demo/origins/Scene06.ts(924,11): error TS2304: Cannot find name 'Holon'.

The `through()` helper at the file's foot annotates its `source` and
`target` parameters as `Holon` but the file never imports the type. The
one-line fix is adding `import type { Holon } from "../../src/holon"`.
Scene files are read-only for this agent.

## The boundary table (each t0 from the scene file's own header)

| ch | t0 (video) | own dur | ends | span | slack |
|---|---|---|---|---|---|
| o00 | 0 | 13.117 | 13.117 | 13.000 | −0.117 |
| o01 | 13.0 | 58.100 | 71.100 | 58.000 | −0.100 |
| o02 | 71.0 | 25.280 | 96.280 | 25.000 | −0.280 |
| o03 | 96.0 | 29.600 | 125.600 | 29.000 | −0.600 |
| o04 | 125.0 | 17.450 | 142.450 | 17.000 | −0.450 |
| o05 | 142.0 | 12.450 | 154.450 | 12.000 | −0.450 |
| o06 | 154.0 | 83.600 | 237.600 | 79.000 | −4.600 |
| o07 | 233.0 | 47.800 | 280.800 | 47.700 | −0.100 |
| o07_1 | 280.7 | 12.000 | 292.700 | 12.100 | +0.100 |
| o08 | 292.8 | 28.000 | 320.800 | 28.050 | +0.050 |
| o09 | 320.85 | 25.000 | 345.850 | 24.950 | −0.050 |
| o10 | 345.8 | 14.000 | 359.800 | 14.400 | +0.400 |
| o11 | 360.2 | 12.000 | 372.200 | 9.850 | −2.150 |
| o12 | 370.05 | 7.838 | 377.888 | 7.838 | 0 |

Sum of spans = 377.888 = the published video's duration.

## Song vs standalone — the composition changes nothing

Scored `origins` at t0=0, `--step 10` over video 5..370 (175 frames),
then scored each chapter STANDALONE at the same reference frames, so the
only variable is song-vs-standalone. Every chapter agrees frame for
frame — same verdicts, same coverage to four decimals:

| ch | frames | song PASS | solo PASS | covRef | covOurs | identical |
|---|---|---|---|---|---|---|
| o00 | 4 | 4/4 | 4/4 | 1.0000 | 0.9960 | yes |
| o01 | 28 | 17/28 | 17/28 | 0.8460 | 0.8378 | yes |
| o02 | 12 | 11/12 | 11/12 | 0.9648 | 0.9632 | yes |
| o03 | 14 | 8/14 | 8/14 | 0.9407 | 0.8796 | yes |
| o04 | 7 | 7/7 | 7/7 | 0.9994 | 0.9973 | yes |
| o05 | 5 | 5/5 | 5/5 | 0.9957 | 0.9931 | yes |
| o06 | 39 | 28/39 | 28/39 | 0.9131 | 0.9087 | yes |
| o07 | 21 | 10/21 | 10/21 | 0.8471 | 0.8350 | yes |
| o07_1 | 6 | 4/6 | 4/6 | 0.8023 | 0.8026 | yes |
| o08 | 14 | 14/14 | 14/14 | 0.9956 | 0.9580 | yes |
| o09 | 12 | 12/12 | 12/12 | 0.9999 | 1.0000 | yes |
| o10 | 7 | 3/7 | 3/7 | 0.8938 | 0.8300 | yes |
| o11 | 5 | 4/5 | 4/5 | 0.8107 | 0.8026 | yes |
| o12 | 0 | — | — | — | — | (past the 370s scoring window) |
| **all** | **175** | **127** | — | **0.9080** | **0.8934** | |

The per-chapter rates are each chapter's own fidelity, unchanged by the
assembly — they are what the chapter agents measured, and the song
inherits them exactly. That equality is the assembly's actual result.

## Scratchpad paths

- frames: `<scratchpad>/origins-frames/f%05d.png`
- resume: `bun scripts/render-song.ts origins <framesDir> --fps 30 --port <P>`
  re-renders from f00000; to resume, delete nothing and restart — the
  script overwrites, so note the last frame number reached here.

## Render stats (measured 2026-09-07)

11,337 frames at 30fps, 377.888s. Steady rate **~19.2 fps**, so the full
film takes about **10 minutes**. Rate measured from f300 onward (the
first 300 frames run slower while caches warm: 16.0 fps at f300, 19.2 by
f2400). The shared-material fix holds — this is ~10× what an unbatched
material would give.

## Last frame reached

Render completed all 11,337 frames in one pass; no resume was needed.
