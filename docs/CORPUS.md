# CORPUS.md — The reproduction benchmark corpus

Every video on [youtube.com/@project-liminality](https://www.youtube.com/@project-liminality)
(15 videos, surveyed 2026-08-22), classified by production technique and rated
as a future reproduction benchmark for the new DreamTalk framework.

**Technique attribution method**: upload dates cross-referenced against the
known toolchain timeline (pydeation-legacy 2021–2022 → pydeation/DreamTalk
2023–2025 → Keynote assembly throughout), source repos on GitHub
(`InterfaceGuy/*`, `ProjectLiminality/*`), and thumbnail/frame inspection.
Entries marked ⚠ are inferred from thumbnails only — verify by frame-sampling
when that video's reproduction chapter begins.

**Difficulty tiers** (as reproduction benchmarks for the new framework):

- **T1 — Founding gauntlet**: pure line-art, known source code, finite scope.
- **T2 — Symbol animation**: crisp line-art symbols, mostly pydeation-era,
  source likely recoverable. The heart of the aesthetic.
- **T3 — Simulation/particles**: needs stateful holons (ping-pong buffers,
  baking) beyond pure functions of t.
- **T4 — Composite**: mixes DreamTalk symbols with external footage, Keynote
  assembly, or photoreal elements. Reproduce the symbolic layer only.
- **T5 — Non-goal**: predominantly external footage or talking-head; not a
  meaningful benchmark for the framework.

## The corpus

| # | Date | Title | Dur | Views | Technique | Tier |
|---|------|-------|-----|-------|-----------|------|
| 01 | 2021-10-22 | Dialectical Thinking | 2:37 | 41k | pydeation-legacy | **T1** |
| 02 | 2023-02-15 | Project Liminality | 15:04 | 5.7k | pydeation + Keynote ⚠ | T2 |
| 03 | 2023-05-07 | The Custodian of the Noosphere | 25:48 | 7.7k | pydeation symbols + Keynote ⚠ | T2 |
| 04 | 2023-08-16 | Love is that which enables Choice | 2:37 | 1.4k | external footage + symbol overlays ⚠ | T4 |
| 05 | 2023-08-16 | The Age of Miracles | 46:28 | 7k | pydeation symbols + Keynote ⚠ | T2 |
| 06 | 2023-11-07 | The ADAM Layer | 23:57 | 4k | pydeation symbols (flower-of-life eye) ⚠ | T2 |
| 07 | 2024-01-01 | The Dragon's Breath | 1:00 | 1.5k | photoreal earth/meteor — stock or manual C4D ⚠ | T5 |
| 08 | 2024-01-07 | Liminal Consulting – Deepening Visionary Service | 10:29 | 942 | Keynote + symbols ⚠ | T4 |
| 09 | 2024-01-11 | The Origins of Project Liminality | 6:18 | 1.6k | SVG sketch objects (line portrait) + symbols ⚠ | T2 |
| 10 | 2024-01-17 | Emergence – A Universal Love Story | 4:08 | 863 | pydeation symbol chain ⚠ | T2 |
| 11 | 2024-12-06 | Liminal Consulting – Decentralising Web3 Insights | 2:52 | 369 | particle text + symbols ⚠ | T3 |
| 12 | 2025-02-02 | Complicated vs Complex | 6:11 | 590 | DreamTalk symbols (repo: `ProjectLiminality/ComplicatedVsComplex`) ⚠ | T2 |
| 13 | 2025-05-12 | InterBrain Teaser | 0:52 | 458 | manual C4D (geodesic dome, gem materials) ⚠ | T4 |
| 14 | 2025-05-29 | The InterBrain – How Collective DreamWeaving Can Heal the World | 47:15 | 30k | composite: symbols + particles + manual C4D + Keynote ⚠ | T4 |
| 15 | 2025-05-30 | In Search of the Third Attractor | 5:47 | 1.4k | particle vortex/simulation ⚠ | T3 |

## Video 01 — Dialectical Thinking (the founding benchmark)

- **URL**: https://www.youtube.com/watch?v=3Fs4zS3COJQ
- **Local reference**: `refs/video-01/DialecticalThinking.mkv` (720p — best
  available; 2021 upload), frames at 1fps in `refs/video-01/frame_000..156.png`.
- **Source code**: [`InterfaceGuy/dialectical-thinking`](https://github.com/InterfaceGuy/dialectical-thinking)
  (2022) — cloned to `refs/video-01-source-2022/`. Ten scene classes
  (`Scene01`–`Scene10`) in `dialectical_thinking.py`, built on
  [`InterfaceGuy/pydeation-legacy`](https://github.com/InterfaceGuy/pydeation-legacy)
  (cloned to `refs/pydeation-legacy/`), with per-scene `tex/` asset folders.
- **DreamNode-era descendant**: [`InterfaceGuy/DialecticalThinking`](https://github.com/InterfaceGuy/DialecticalThinking)
  (2024) — cloned to `refs/video-01-symbol-2024/` — same scene code packaged
  as a symbol repo with rendered `.mov`/`.gif`/`.png` and a `.key` Keynote file.
- **Content inventory** (from source + frames): wireframe cylinder;
  circle (BLUE) and rectangle (RED) as its two projections; stylized eye
  creatures ("circler"/"rectangler"); perspective grid planes (`Axes` with
  grid); sight-line splines; 2D/3D camera moves; `Create`/`UnCreate`/
  `FadeIn`/`FadeOut`/`Transform` animation grammar; audio track per scene.
- **Why it is the founding benchmark**: it is literally the TASTE.md
  square+circle→cylinder parable — two partial views reconciled by a
  higher-dimensional whole — rendered in the exact crisp line-on-black
  aesthetic the framework must nail. It exercises: line/stroke rendering,
  draw-on animation, parametric primitives, grouping, camera as first-class
  participant, 2D↔3D unity (TwoDScene and ThreeDScene are both used), and
  scene sequencing. Note the 2022 source uses a *rectangle*; TASTE.md
  upgrades the founding holon to a **square** (simplicity over generality).

## Notes on the corpus as a whole

- **The May-2026 holon prototypes already exist**: `InterfaceGuy/Cylinder3`
  composes `Circle3` + `Square4` as git submodules with a `DreamSong.canvas`
  and `.udd` metadata (variants: Square/Square2/Square4/Square5, Circle/
  Circle2/Circle3, Cylinder1/Cylinder2/Cylinder3). The founding-holon chapter
  should study these before designing the manifest.
- **Symbol repos are abundant**: the Nov-2024 batch under `InterfaceGuy`
  (TaylorExpansion, MeaningCrisis, Galaxy, MolochSpreading, Synergy, …) and
  the Oct–Dec-2025 batch under `ProjectLiminality` (VectorEquilibrium,
  AcornMan, PhotoelectricEffect, MagicSquares, …) are DreamNode symbol repos
  that feed later corpus videos. Corpus-wide reproduction is really the
  reproduction of this symbol library plus composition.
- **External-footage segments are out of scope by definition**: TASTE.md says
  symbols cannot be meaningfully AI-generated, and stock/photoreal footage
  (Dragon's Breath, Avatar excerpts in Love/Choice) is not DreamTalk content.
  T4 reproductions target the symbolic layer only.
- **Audio is out of scope** for reproduction benchmarks: comparisons are
  frame-based; narration/music tracks are kept from the originals or omitted.

## Status

- [x] Channel surveyed, all 15 videos classified (thumbnail-level)
- [x] Video 01 downloaded, frames extracted, source recovered
- [ ] ⚠-marked classifications verified by frame sampling (per-chapter, lazy)
- [ ] Source recovery for videos 02–15 (per-chapter, lazy)
