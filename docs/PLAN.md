# PLAN.md — The DreamTalk framework roadmap

The complete journey: build the DreamTalk animation framework per TASTE.md
(law) and HISTORY.md (decision record), then reproduce the YouTube corpus
(CORPUS.md) as benchmarks, ending with the framework packaged as a skill any
Claude can drive.

**Involvement tags**: `AUTONOMOUS` (agent runs without David) ·
`REVIEW` (David approves a document or render) · `TASTE` (a decision only
David can make).
**Status markers**: `[ ]` not started · `[~]` in progress · `[x]` done.
Update markers at the end of every working session — a cold session must be
able to resume from the docs alone (read TASTE.md → HISTORY.md → this file →
DECISIONS.md, then the current chapter).

## Session protocol (every session)

1. Read TASTE.md, then this file's status markers, then DECISIONS.md.
2. Bias to action; batch questions; only stop for TASTE decisions.
3. Generalizable answers become proposed TASTE.md/CLAUDE.md edits.
4. Settled decisions → one line in DECISIONS.md.
5. Commit early and often. End by updating status markers here.

## Standing risks (watch these; don't rediscover them)

- **troika × WebGPU**: stock troika material path is broken under
  WebGPURenderer (no `onBeforeCompile`). Mitigation chosen in ANALYSIS.md
  (troika glyph engine + our TSL node material; `three-text` 0.6.5 fallback).
- **Headless determinism**: the gauntlet needs bit-stable `renderFrame(t)`
  in headless Chrome (WebGPU). GPU/driver variance across runs must be
  measured in Chapter 2 before the gauntlet assumes exact comparability.
- **Reference quality**: video-01 reference is a 720p YouTube encode —
  comparisons are perceptual, never pixel-exact.
- **Timing alignment**: reproduced scene timing will drift from the 2021
  edit (audio-driven `wait()`s). Evaluation compares per-scene key moments,
  not strict frame indices.
- **WGSL law** (TASTE): no recursion, no dynamic allocation, f32 — holonic
  traversal flattens CPU-side; worst-case preallocation.

---

## Chapter 0 — Reconnaissance & governing documents

**Goal**: ground the journey in verified reality.
**Involvement**: AUTONOMOUS (done) + REVIEW (this plan) + TASTE (ANALYSIS).

- [x] Repo surveyed → **docs/SURVEY.md** (~21k LOC Python, zero TS; verdicts
      per component). Headlines: `xpresso/types.py`+`states.py` port
      near-mechanically; `docs/reference/MindVirus_canonical.py` is the
      target-syntax design brief; the animation grammar's relative-time
      algebra and the introspection diff loop are the key design prior art;
      and a **working CPU-side silhouette implementation exists**
      (`abstract_objects.py:881-1041` + `stroke_objects.py`) for the
      standing open problem. Housekeeping backlog recorded in SURVEY.md.
- [x] Video-01 source recovered: `InterfaceGuy/dialectical-thinking` (2022,
      10 scenes) + `pydeation-legacy` + private archives `PydeationProjects`
      (working project incl. per-scene audio) and `PydeationContent` — all
      cloned under `refs/`.
- [x] Video-01 downloaded (720p) + 157 frames at 1fps → `refs/video-01/`.
- [x] Channel surveyed → docs/CORPUS.md (15 videos, tiered).
- [x] Stack verified (2026-08-22): three 0.185.1, WebGPURenderer
      production-grade, WebGPU universal in browsers (incl. Safari 26);
      troika 0.52.5 with the WebGPU incompatibility flagged above.
- [x] docs/ANALYSIS.md drafted; docs/DECISIONS.md started.
- [ ] **Definition of done**: David signs off on ANALYSIS.md's three
      verdicts + troika amendment (checklist at bottom of ANALYSIS.md), and
      on this plan.

## Chapter 1 — Foundations sign-off (TASTE gate)

**Goal**: lock the decisions everything downstream builds on.
**Involvement**: TASTE.
**Resolved 2026-08-22** (see DECISIONS.md): whole/part terminology
(`parts`); mesh-first SDF-as-technique; vanilla core owning t with thin
adapters; TS core in `core/` of this repo; troika amendment applied.
**Still open, deferred to Chapter 7 start** (TASTE): founding-holon repos —
fresh `Square`/`Circle`/`Cylinder` under `ProjectLiminality` vs. continuing
the May-2026 `InterfaceGuy/Cylinder3` numbered-variant prototypes.

**Definition of done**: met — zero open questions blocking Chapter 2.

## Chapter 2 — Core scaffold & the time contract

**Goal**: a running WebGPU canvas owned by the framework, plus the headless
render harness the whole gauntlet depends on.
**Involvement**: AUTONOMOUS, then REVIEW (harness report).

**Deliverables**:
- `core/` TypeScript package (strict, relative imports, plain fs): renderer
  bootstrap (`three/webgpu`), scene root, the host contract
  `mount / advance / renderFrame(t) / dispose / params` (framework owns t).
- First semantic ports (per SURVEY.md): the parameter types
  (`Length`/`Angle`/`Bipolar`/`Completion`/`Color`…) and
  `State`/`StateMachine` from `xpresso/types.py`/`states.py`.
- Headless harness: CLI that renders frame(s) at given t values to PNG via
  headless Chrome (puppeteer) — deterministic-output measurement across 3
  runs and 2 machines documented in `docs/reports/harness.md`.
- A trivial reference scene (white line square on black) as harness smoke test.

**Definition of done**: `dreamtalk render --scene <manifest> --t 0..5 --fps 1`
emits PNGs; determinism report exists; REVIEW passed.

## Chapter 3 — Manifest schema & part resolution

**Goal**: the scene format (TASTE: thin JSON manifest) and holon loading.
**Involvement**: AUTONOMOUS, then REVIEW (schema doc).

**Deliverables**:
- Manifest JSON schema: `parts` (repo references), parameters, transform
  hierarchy (`children` within a scene), versioned.
- Loader with lazy part resolution (nothing instantiates until used;
  cycles legal — dream.lock spirit), local-path and git-URL parts.
- `docs/MANIFEST.md` — the schema spec, written for both humans and LLMs.

**Definition of done**: a manifest referencing a part renders through the
Chapter-2 harness; a deliberately circular part pair loads without
infinite regress; REVIEW of MANIFEST.md.

## Chapter 4 — Stroke rendering & the draw-on grammar

**Goal**: the aesthetic core — crisp GPU ribbon strokes with SDF
anti-aliasing in TSL, and the `Create`/draw-on grammar.
**Involvement**: AUTONOMOUS iterations, REVIEW renders, TASTE on final look.

**Deliverables**:
- Curve → ribbon expansion (Three curve classes as source; width, joins,
  caps); TSL stroke material (SDF AA, color, opacity); draw parameter
  (0→1 draw-on, the pydeation `Create` equivalent); `UnCreate`, `FadeIn/Out`.
- Side-by-side render vs. pydeation output for a circle, a square, an arc.

**Definition of done**: David TASTE-approves the stroke look at 1080p on the
three test shapes (this calibrates every later benchmark).

## Chapter 5 — Parameter system & promotion protocol

**Goal**: TASTE's parameter rules as working machinery.
**Involvement**: AUTONOMOUS, then REVIEW (protocol doc).

**Deliverables**:
- Standard params (position/rotation/scale/t) on every holon by default;
  custom params promoted explicitly in the manifest; no reaching into
  unexposed internals (enforced by the loader).
- Promotion as manifest editing, designed agent-drivable ("happiness
  slider" flow): `docs/PARAMETERS.md` specifying the protocol + the
  animation layer (keyframing a param over t; easing; the `play()` grammar).
- Design sources (SURVEY.md): `MindVirus_canonical.py` as the target-syntax
  brief; the `AnimationGroup` relative-time algebra (nested renormalizing
  `rel_start`/`rel_stop`) ported as design; the introspection snapshot/diff
  loop as the model for agent-driven promotion.

**Definition of done**: a composed scene animates a promoted strand
parameter via manifest-only edits; REVIEW of PARAMETERS.md.

## Chapter 6 — Compute unit: pure / stateful / symbolic + baking

**Goal**: the three holon classes (TASTE) and the baking bridge.
**Involvement**: AUTONOMOUS, then REVIEW (report + demo renders).

**Deliverables**:
- Pure holon: TSL compute evaluating geometry as f(t, params) (spline
  sampling in compute per HISTORY).
- Stateful holon: ping-pong buffer stepping; bake-to-time-sampled-vertex-
  data pipeline; baked playback as a pure f(t) (the bridge).
- Symbolic holon: CPU-side topology/allocation contract with zero-copy
  buffer handoff to compute/render.
- CPU/GPU split rule enforced: small-N stays CPU.

**Definition of done**: a particle-ish demo runs live, bakes, and replays
identically from the bake; REVIEW.

## Chapter 7 — The founding holon: Square + Circle → Cylinder

**Goal**: the TASTE benchmark — a cylinder born of a square and a circle —
as three real holon repos woven into one.
**Involvement**: AUTONOMOUS build, TASTE sign-off (it's the aesthetic north
star and the first real DreamNodes).

**Deliverables**:
- `Square`, `Circle` holon repos (manifest + curve construction + README —
  the three faces); `Cylinder` repo with both as parts; construction
  animation (square extrudes to the mantle, circles cap it — final
  choreography is a TASTE conversation); analytic view-dependent silhouette
  for the cylinder (ANALYSIS Q2 technique #2).
- Rendered thumbnail per repo (the thumbnail test).

**Definition of done**: David TASTE-approves the Cylinder render and repo
structure; this becomes the template for all symbol repos.

## Chapter 8 — The video-01 gauntlet (Dialectical Thinking)

**Goal**: reproduce the founding video scene-by-scene until an evaluator
judges the delta acceptable — the framework's trial by fire.
**Involvement**: AUTONOMOUS (the loop), REVIEW (per-scene render batches),
TASTE (final full-video verdict).

**Method** (per scene, 10 scenes):
1. Translate the pydeation scene (source in `refs/video-01-source-2022/`,
   working assets in `refs/PydeationProjects/.../dialectical_thinking/`)
   into manifests + holons. New capabilities discovered → consolidated into
   the right holon repo (gardening rule), never into scene scripts.
2. Subagent loop: render key moments at matching t → compare against
   `refs/video-01/` frames (structural metrics + vision-agent rubric:
   geometry, composition, line quality, color, motion character) → iterate.
3. An evaluator agent (not the builder) judges "delta acceptable" per the
   rubric; disagreements escalate to REVIEW.
4. Missing vocabulary expected and welcomed: Eye creature (sovereign symbol
   repo), Axes/grid, sight-line splines, camera moves, 2D/3D scene unity,
   per-scene sequencing.

**Deliverables**: all 10 scenes reproduced; full 2:37 re-render (MP4 +
frames); `docs/reports/video-01.md` (per-scene deltas, capabilities added,
evaluator verdicts); new holon repos (Eye, Axes/Grid at minimum).

**Definition of done**: evaluator passes all scenes; David TASTE-approves
the full render side-by-side with the original.

## Chapter 9 — Corpus reproduction: T2 (the symbol library)

**Goal**: the crisp line-art videos (CORPUS tier T2: Project Liminality,
Custodian, Age of Miracles, ADAM Layer, Origins, Emergence, Complicated vs
Complex) — which really means rebuilding the symbol library as holon repos.
**Involvement**: AUTONOMOUS per symbol, REVIEW per video, TASTE only on
aesthetic disputes.

**Method**: per video — verify CORPUS ⚠ classification by frame-sampling;
recover source (InterfaceGuy/ProjectLiminality symbol repos); reproduce via
the Chapter-8 loop. Prioritize by symbol reuse (flower-of-life, eye,
Vitruvian, network motifs recur — build once, weave everywhere).

**Definition of done per video**: evaluator pass + REVIEW. Chapter done when
all T2 videos pass; `docs/reports/corpus-t2.md` tracks the symbol matrix
(which symbols exist, which videos consume them).

## Chapter 10 — Corpus reproduction: T3 (stateful/particles)

**Goal**: the particle/simulation videos (Web3 particle text, Third
Attractor vortex) on the Chapter-6 stateful machinery, with baking.
**Involvement**: AUTONOMOUS, REVIEW per video.

**Definition of done**: both T3 videos pass the evaluator; baked replays
match live simulation; `docs/reports/corpus-t3.md`.

## Chapter 11 — Corpus T4 symbolic layers & the DreamSong player

**Goal**: reproduce the symbolic layer of the composite videos (LC
Deepening, InterBrain teaser + main, Love/Choice) and build the appreciator/
creator duality: authored camera path over t vs. free scrub/explore.
**Involvement**: AUTONOMOUS, REVIEW, TASTE on the player UX.

**Deliverables**: DreamSong player (appreciator mode = authored path;
creator mode = scrub + orbit + param access); T4 symbolic-layer
reproductions; export pipeline (PNG stills, MP4/MOV per HISTORY render
table, glTF snapshot per TASTE).

**Definition of done**: InterBrain-main's symbolic segments play in both
modes; exports verified in Keynote (MOV alpha) and web (MP4).

## Chapter 12 — SKILL.md: packaging the framework for any Claude

**Goal**: `dreamtalk/SKILL.md` so any Claude (including Claude Design) can
drive the framework — create holons, weave scenes, promote parameters,
render, run the benchmark loop.
**Involvement**: AUTONOMOUS draft, REVIEW, then a TASTE live test.

**Deliverables**: SKILL.md (workflow, manifest reference, holon-repo
template, render CLI, evaluation loop recipe); host adapters per ANALYSIS
Q3 (Obsidian/R3F adapter; Claude Design adapter honoring the time
contract); a fresh-session acceptance test: a Claude with only the skill +
docs builds a novel symbol end-to-end.

**Definition of done**: the acceptance test passes without David's help;
TASTE sign-off on the resulting symbol's repo quality.

## Chapter 13 — Hardening & the standing problems

**Goal**: close or consciously park what remains.
**Involvement**: AUTONOMOUS research spikes, TASTE on any aesthetic calls.

- General mesh silhouette extraction (compute-shader edge method) — build
  when a corpus symbol actually needs it; spike report first. Reference
  implementation exists CPU-side in C4D
  (`objects/abstract_objects.py:881-1041`, `objects/stroke_objects.py`).
- GS fallback renderer — parked unless a scene exceeds real-time mesh
  budgets (TASTE: never default).
- Performance passes, WGSL constraint audits, cross-browser verification.

**Definition of done**: every TASTE "standing open problem" has a DECISIONS
line: solved (with pointer) or parked (with trigger condition).

---

## Status ledger

| Ch | Title | Status |
|----|-------|--------|
| 0 | Reconnaissance & governing docs | [x] done 2026-08-22 |
| 1 | Foundations sign-off | [x] done 2026-08-22 (founding-holon repo question deferred to Ch 7 start) |
| 2 | Core scaffold & time contract | [ ] |
| 3 | Manifest schema & weave resolution | [ ] |
| 4 | Stroke rendering & draw-on grammar | [ ] |
| 5 | Parameter system & promotion | [ ] |
| 6 | Compute unit & baking | [ ] |
| 7 | Founding holon (Square+Circle→Cylinder) | [ ] |
| 8 | Video-01 gauntlet | [ ] |
| 9 | Corpus T2 (symbol library) | [ ] |
| 10 | Corpus T3 (stateful) | [ ] |
| 11 | Corpus T4 & DreamSong player | [ ] |
| 12 | SKILL.md packaging | [ ] |
| 13 | Hardening & standing problems | [ ] |

Chapters 2–6 are parallelizable in pairs (2+3, then 4+5+6); 7 needs 2–5;
8 needs 7; 9–11 need 8; 12 needs 9; 13 floats.
