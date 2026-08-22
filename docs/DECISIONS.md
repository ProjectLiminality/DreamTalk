# DECISIONS.md — Settled decisions, one line of rationale each

Append-only. TASTE-level decisions require David's sign-off before entry;
operational decisions are entered by the working agent. Format:
`YYYY-MM-DD · decision — rationale`.

## Settled

- 2026-08-22 · Reference material (videos, frames, cloned source repos) lives
  in `refs/`, gitignored — multi-GB binaries don't belong in the framework
  repo's history; recovery is scripted (yt-dlp + git clone).
- 2026-08-22 · Video-01 benchmark reference is the 720p YouTube encode at
  1fps (157 frames) — best surviving quality of the 2021 upload; comparisons
  must tolerate its compression artifacts.
- 2026-08-22 · Corpus classification is thumbnail-level first, verified by
  frame-sampling lazily per reproduction chapter — full frame extraction of
  15 videos up front buys nothing PLAN.md needs now.
- 2026-08-22 · Stack versions pinned at recon: three 0.185.1,
  troika-three-text 0.52.5, `three-text` (countertype) 0.6.5 as text
  fallback candidate — verified against npm/web, not memory.

## Pending David's sign-off (see docs/ANALYSIS.md)

- Q1 composition terminology (proposed: weaving — `strands`/weave between
  repos; scene-graph terms within a scene; genealogy at social layer only).
- Q2 SDF role (proposed: mesh-first; SDFs as TSL stroke technique, analytic
  primitive silhouettes, build-time CSG).
- Q3 host coupling (proposed: vanilla-Three core owning t; thin adapters).
- TASTE.md troika amendment (proposed: troika glyph/layout engine + our own
  TSL node material; stock troika material path breaks under WebGPURenderer).
