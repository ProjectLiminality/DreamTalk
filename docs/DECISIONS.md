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

- 2026-08-22 · **Composition terminology: holonic whole/part** (David;
  weaving-as-schema rejected) — `parts` is the manifest field; it's the
  holon vocabulary itself, already native via `specify_parts()`, and part-of
  naturally forms the rootless graph that keeps cycles legal.
- 2026-08-22 · **SDF role: mesh-first, SDF as technique** (David) — baking
  is vertex data, so meshes must be native; SDFs serve stroke AA, analytic
  primitive silhouettes, and build-time CSG only.
- 2026-08-22 · **Host coupling: vanilla-Three core owns t; thin adapters**
  (David) — the headless gauntlet needs deterministic `renderFrame(t)`, and
  hosts request time rather than tick it.
- 2026-08-22 · **TS core lives in `core/` of this repo** (David) — the repo
  stays the Layer-1 DreamTalk holon; Python remains as C4D authoring backend
  until the gauntlet proves the core, then moves to `legacy/`.
- 2026-08-22 · **Text = troika glyph/layout engine + our own TSL node
  material** (TASTE.md amended) — troika's stock material path breaks under
  WebGPURenderer; `three-text` 0.6.5 is the recorded fallback.
- 2026-08-22 · Tree-vs-rootless-graph standing problem closed by the Q1
  verdict — part-of is a rootless associative graph; each scene's transform
  hierarchy is a tree.
- 2026-08-22 · **Founding holons build local-first, publish on approval**
  (David) — Square/Circle/Cylinder iterate as local git repos; public repos
  under ProjectLiminality are created only after the cylinder passes TASTE.
- 2026-08-22 · **GitHub authority: ask before creating any new repo**
  (David) — pushes to this existing repo stay autonomous; new public repos
  always wait for a go.
- 2026-08-22 · **Evaluation is editor-centric and Claude-evaluated first**
  (David) — the DreamTalk editor (TASTE: The Editor) with timeline-synced
  mp4/image backdrops and black-as-transparency stroke overlays is the
  fidelity instrument; Claude screenshots and judges before anything
  reaches David. Async batch rendering is plumbing, not the workflow.
- 2026-08-22 · **Runtime: Bun** (David) — matches the wider ecosystem;
  headless Chrome only where the editor screenshot loop needs driving.
- 2026-08-23 · **The 2021 lens is 36mm (hfov 53.13°), not 45mm** — settled
  by source + arithmetic, not estimation: `refs/pydeation-legacy/camera/
  camera.py` constructs a bare `c4d.CameraObject()` and never touches
  focal length, so it runs C4D's factory 36mm default; 36mm at d=1000
  projects 1.280 px/world-unit, matching the S04 builder's four
  independent reference measurements (1.280) and CameraCal's independent
  ~0.83 flag. The 45mm in our rig came from the MODERN C4D port
  (objects/camera_objects.py), not the 2021 code. Apply BETWEEN rounds
  (Observer.fov default → 2·atan(0.5)) and re-score all scenes together;
  never mid-round, which would invalidate in-flight calibrations.
- 2026-08-23 · **Text renders via `three-text` 0.6.5, not troika** — the
  ANALYSIS.md fallback (option b) taken after troika proved unusable under
  WebGPURenderer in practice; three-text is WebGPU/NodeMaterial-native
  (ships a HarfBuzz wasm for shaping). TASTE.md's text bullet should be
  amended at David's next pass.
- 2026-08-23 · **Reproduction uses the CANONICAL palette** (David:
  "canonical colors pls") — video-01 scenes render in today's TASTE
  colors (#00A2FF/#FF644E); the overlay evaluator treats the reference's
  2021 hues (#0099CC/#FF7E79) as equivalent (hue-tolerant comparison on
  the blue/red channels; geometry/timing/line-quality remain strict).
  Stroke widths still calibrate to the 2021 values. GATES #5 answered.
- 2026-08-23 · **Video-01 scenes live in core/demo/video01/** until the
  repo-template gate (GATES #3c) is answered — graduation to sovereign
  holon repos is a later mechanical move.
- 2026-08-23 · **Parametric silhouette case solved** — analytic
  view-dependent cylinder silhouette (θ = φ ± acos(r/|d|)) as real
  per-frame stroke geometry, tangency unit-proven; the TASTE standing
  problem remains open only for arbitrary meshes (compute-shader path,
  PLAN Ch 14).
- 2026-08-22 · **Multi-agent orchestration opted in** (David) — parallel
  subagents for heterogeneous build chapters now; the dynamic
  workflow/gauntlet harness deploys at Chapter 9 (builder / evaluator /
  adversarial-verify per scene, loop-until-dry) and fans out again for
  Chapter 10.
