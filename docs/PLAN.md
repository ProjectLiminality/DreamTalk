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
6. GitHub: pushes to this repo are autonomous; creating any NEW repo always
   waits for David's go (DECISIONS 2026-08-22).

## The evaluation doctrine (governs Chapters 4 and 8–12)

Per TASTE "The Editor": fidelity is judged in the DreamTalk editor, not in
batch pipelines. The reference image/mp4 loads as a timeline-synced backdrop;
an overlay mode exploits the black background as transparency so reference
strokes and reproduced strokes overlap directly (tint reference and
reproduction differently — e.g. red vs. green, overlap reads white/yellow,
deviation reads as colored fringe). **Claude screenshots the editor and
evaluates the overlap itself, iterating until its own verdict passes; only
then does a gate go to David.** Realtime playback, never async preview, is
the working mode; deterministic `renderFrame(t)` stills exist as plumbing
underneath the overlay and the CI loop.

## Standing risks (watch these; don't rediscover them)

- **troika × WebGPU**: stock troika material path is broken under
  WebGPURenderer (no `onBeforeCompile`). Mitigation chosen in ANALYSIS.md
  (troika glyph engine + our TSL node material; `three-text` 0.6.5 fallback).
- **Bidirectional sync robustness** (editor ↔ source): the file is the
  single source of truth; UI gestures write the file, file watches update
  the UI. Design for echo-loop prevention, debounce, and versioned
  last-writer-wins *before* building (Chapter 7's EDITOR.md).
- **Determinism**: `renderFrame(t)` must be stable enough for overlay
  comparison; measure GPU variance in Chapter 2 before the gauntlet
  assumes comparability.
- **Reference quality**: video-01 reference is a 720p YouTube encode —
  comparisons are perceptual, never pixel-exact.
- **Timing alignment**: reproduced scene timing will drift from the 2021
  edit (audio-driven `wait()`s). The mp4-backdrop timeline sync needs a
  per-scene time-offset/warp control for honest comparison.
- **WGSL law** (TASTE): no recursion, no dynamic allocation, f32 — holonic
  traversal flattens CPU-side; worst-case preallocation.

---

## Chapter 0 — Reconnaissance & governing documents

**Goal**: ground the journey in verified reality.
**Involvement**: AUTONOMOUS (done) + REVIEW + TASTE.

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
- [x] docs/ANALYSIS.md resolved; docs/DECISIONS.md started.
- [x] **Definition of done**: met 2026-08-22.

## Chapter 1 — Foundations sign-off (TASTE gate)

**Goal**: lock the decisions everything downstream builds on.
**Involvement**: TASTE.
**Resolved 2026-08-22** (see DECISIONS.md): whole/part terminology
(`parts`); mesh-first SDF-as-technique; vanilla core owning t with thin
adapters; TS core in `core/` of this repo; troika amendment; Bun runtime;
founding holons local-first with publish-on-approval; ask before any new
repo creation; editor-centric Claude-first evaluation (TASTE "The Editor").

- [x] **Definition of done**: met — zero open TASTE questions block
      Chapters 2–7.

## Chapter 2 — Core scaffold & the time contract

**Goal**: a running WebGPU canvas owned by the framework, plus deterministic
frame plumbing.
**Involvement**: AUTONOMOUS, then REVIEW (report).

**Deliverables**:
- `core/` TypeScript package (strict, relative imports, plain fs, Bun):
  renderer bootstrap (`three/webgpu`), scene root, the host contract
  `mount / advance / renderFrame(t) / dispose / params` (framework owns t).
- First semantic ports (per SURVEY.md): the parameter types
  (`Length`/`Angle`/`Bipolar`/`Completion`/`Color`…) and
  `State`/`StateMachine` from `xpresso/types.py`/`states.py`.
- Determinism plumbing: `renderFrame(t)` → PNG via headless Chrome;
  variance measured across runs and documented in `docs/reports/harness.md`
  (this is plumbing for the editor overlay + CI, not the workflow).
- A trivial reference scene (white line square on black) as smoke test.

**Definition of done**: smoke-test frames render identically across 3 runs
(or measured variance documented); REVIEW passed.

## Chapter 3 — Manifest schema & part resolution

**Goal**: the scene format (TASTE: thin JSON manifest) and holon loading.
**Involvement**: AUTONOMOUS, then REVIEW (schema doc).

**Deliverables**:
- Manifest JSON schema: `parts` (repo references), parameters, transform
  hierarchy (`children` within a scene), versioned. Designed from day one
  for bidirectional editing (stable ordering, comment-preserving writes or
  a format that needs none, line-addressable entries) — the editor will
  write it.
- Loader with lazy part resolution (nothing instantiates until used;
  cycles legal — dream.lock spirit), local-path and git-URL parts.
- `docs/MANIFEST.md` — the schema spec, written for both humans and LLMs.

**Definition of done**: a manifest referencing a part renders through the
Chapter-2 plumbing; a deliberately circular part pair loads without
infinite regress; REVIEW of MANIFEST.md.

## Chapter 4 — Stroke rendering & the draw-on grammar

**Goal**: the aesthetic core — crisp GPU ribbon strokes with SDF
anti-aliasing in TSL, and the `Create`/draw-on grammar.
**Involvement**: AUTONOMOUS iterations with self-evaluation, then TASTE.

**Deliverables**:
- Curve → ribbon expansion (Three curve classes as source; width, joins,
  caps); TSL stroke material (SDF AA, color, opacity); draw parameter
  (0→1 draw-on, the pydeation `Create` equivalent); `UnCreate`, `FadeIn/Out`.
- Overlay self-evaluation against pydeation renders of a circle, a square,
  an arc (black-as-transparency stroke overlap, per the doctrine — using
  the Chapter-2 plumbing until the editor exists).

**Definition of done**: Claude's overlay evaluation passes, then David
TASTE-approves the stroke look at 1080p (this calibrates every later
benchmark).

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
- The promotion protocol doubles as the editor's parameter-panel contract:
  what is promoted is exactly what the UI shows (TASTE: minimal meaningful
  set, no parameter dumps).

**Definition of done**: a composed scene animates a promoted part parameter
via manifest-only edits; REVIEW of PARAMETERS.md.

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

## Chapter 7 — The DreamTalk Editor

**Goal**: the minimalist editor per TASTE "The Editor" — the arena where
scenes are made and fidelity is judged. Web-first (Bun + Vite dev server),
architected from day one to package as a Tauri app.
**Involvement**: AUTONOMOUS build, REVIEW milestones, TASTE on UX feel.

**Deliverables**:
1. `docs/EDITOR.md` **first** — the deep-thinking design doc for
   bidirectional sync: file as single source of truth; UI gestures write
   the source (drag-drop backdrop → backdrop line appears in the script);
   file watcher updates UI live; echo-loop prevention, debounce, versioned
   last-writer-wins; performance budget for realtime playback. REVIEW
   before building.
2. Editor shell: scene viewport (the vanilla core mounted via its host
   contract — the editor is just a host), timeline with scrub + realtime
   playback, minimal parameter panel (exactly the promoted set),
   play/pause, t display.
3. **Backdrop system**: reference image or full mp4 as backdrop,
   timeline-synced to scene t with per-scene offset/warp control; overlay
   toggle with blend modes exploiting black-as-transparency (tinted
   reference vs. reproduction); clean toggle UI.
4. Screenshot-evaluation loop: Claude drives the editor (browser tools),
   sets t, toggles overlay, screenshots, judges — documented as a recipe
   so any session/subagent can run it.
5. Tauri packaging spike (window, fs access path for the file-watcher) —
   proving the architecture ports; full app polish deferred.

**Definition of done**: a scene plays in realtime with an mp4 backdrop
overlay-synced to t; dragging a video onto the scene writes the manifest
line and editing that line updates the UI; Claude completes one full
screenshot-evaluation cycle; David TASTE-passes the editor feel.

## Chapter 8 — The founding holon: Square + Circle → Cylinder

**Goal**: the TASTE benchmark — a cylinder born of a square and a circle —
as three real holon repos composed into one.
**Involvement**: AUTONOMOUS build + self-evaluation, TASTE sign-off.

**Deliverables**:
- `Square`, `Circle` holon repos (manifest + curve construction + README —
  the three faces); `Cylinder` repo with both as parts; construction
  animation (square extrudes to the mantle, circles cap it — final
  choreography is a TASTE conversation); analytic view-dependent silhouette
  for the cylinder (ANALYSIS Q2 technique #2; C4D reference implementation
  per SURVEY.md).
- **Local-first**: repos live in a local workspace; public repos under
  ProjectLiminality are created only after TASTE approval (and only after
  asking — DECISIONS 2026-08-22). Study, don't continue, the May-2026
  `InterfaceGuy/Cylinder3` prototypes.
- Rendered thumbnail per repo (the thumbnail test).

**Definition of done**: David TASTE-approves the Cylinder render and repo
structure in the editor; on his go, repos publish; this becomes the
template for all symbol repos.

## Chapter 9 — The video-01 gauntlet (Dialectical Thinking)

**Goal**: reproduce the founding video scene-by-scene until the overlay
evaluation passes — the framework's trial by fire.
**Involvement**: AUTONOMOUS (the loop), TASTE (final full-video verdict).

**Ground truth**: docs/reports/video-01-vocabulary.md (2026-08-22) — scene
boundaries solved via per-scene audio durations (intro [0-6s] + S01..S10,
no editing gaps), all constructions extracted with exact numbers, verb
semantics pinned, build order: stroke draw-on → Circle/Rectangle →
Cylinder silhouette (gates 7 of 10 scenes) → Axes/Grid → Eye →
Text/Write → intersection curves → Connection. Difficulty: S04 easiest →
S08 hardest. 12 risks with resolution paths in §5.
**Batched TASTE question**: the video opens with a Project Liminality
Logo intro (pydeation Logo class, construction in the report) that is not
part of the 10-scene source — in gauntlet scope or not?

**Orchestration**: this chapter runs as a dynamic multi-agent workflow
(David opted in 2026-08-22): per scene, a builder agent, a separate
overlay-evaluator agent (never the builder), and adversarial verification
of "delta acceptable" verdicts; a loop-until-dry pass sweeps missed
details across the whole video before the final TASTE gate. Chapter 10
reuses the same harness fanned out over symbols.

**Vocabulary batch 1 done 2026-08-23** (subagent): Rectangle(+rounding
morphs, S03-ready), Axes/Grid(domino cascade, faithful port), Eye(lids/
arc/iris/pupil with animatable `opening`; fill capability entered via
render/fill.ts — normal blending, explicit renderOrder), Line + Ellipse
parts, arrowheads, Create per-class dispatch (`createAnim()` hook),
Erase(front-to-back, ribbon `erased` window)/UnDraw asymmetry. Founding
scene proven bit-identical pre/post. Evidence:
docs/reports/vocab-fidelity-compare.png; `/demo/?scene=vocab`. Still
missing for scenes: Text/Write (troika), camera calibration (risk #1),
2021-stroke-width calibration, Connection/bezier tracer, plane
intersection curves (S03/S06), UnCreate mirror choreographies.

**Method** (per scene, 10 scenes):
1. Translate the pydeation scene (source in `refs/video-01-source-2022/`,
   working assets in `refs/PydeationProjects/.../dialectical_thinking/`)
   into manifests + holons. New capabilities discovered → consolidated into
   the right holon repo (gardening rule), never into scene scripts.
2. Load the original video as timeline-synced backdrop in the editor;
   subagent loop: set t at key moments → overlay screenshot → judge stroke
   overlap → iterate. An evaluator agent (not the builder) issues the
   verdict per rubric (geometry, composition, line quality, color, motion
   character); disagreements escalate to David.
3. Missing vocabulary expected and welcomed: Eye creature (sovereign symbol
   repo), Axes/grid, sight-line splines, camera moves, 2D/3D scene unity,
   per-scene sequencing.

**Deliverables**: all 10 scenes reproduced; full 2:37 re-render (MP4 +
frames); `docs/reports/video-01.md` (per-scene overlay verdicts,
capabilities added); new holon repos (Eye, Axes/Grid at minimum, local
until approved).

**Definition of done**: evaluator passes all scenes; David TASTE-approves
the full render side-by-side with the original.

## Chapter 10 — Corpus reproduction: T2 (the symbol library)

**Goal**: the crisp line-art videos (CORPUS tier T2: Project Liminality,
Custodian, Age of Miracles, ADAM Layer, Origins, Emergence, Complicated vs
Complex) — which really means rebuilding the symbol library as holon repos.
**Involvement**: AUTONOMOUS per symbol, REVIEW per video, TASTE only on
aesthetic disputes.

**Method**: per video — verify CORPUS ⚠ classification by frame-sampling;
recover source (InterfaceGuy/ProjectLiminality symbol repos); reproduce via
the Chapter-9 loop. Prioritize by symbol reuse (flower-of-life, eye,
Vitruvian, network motifs recur — build once, compose everywhere).

**Definition of done per video**: evaluator pass + REVIEW. Chapter done when
all T2 videos pass; `docs/reports/corpus-t2.md` tracks the symbol matrix
(which symbols exist, which videos consume them).

## Chapter 11 — Corpus reproduction: T3 (stateful/particles)

**Goal**: the particle/simulation videos (Web3 particle text, Third
Attractor vortex) on the Chapter-6 stateful machinery, with baking.
**Involvement**: AUTONOMOUS, REVIEW per video.

**Definition of done**: both T3 videos pass the evaluator; baked replays
match live simulation; `docs/reports/corpus-t3.md`.

## Chapter 12 — Corpus T4 symbolic layers & appreciator mode

**Goal**: reproduce the symbolic layer of the composite videos (LC
Deepening, InterBrain teaser + main, Love/Choice) and complete the
appreciator/creator duality — appreciator mode (authored camera path over
t) joins the editor's creator mode (scrub/explore), largely as an editor
view mode.
**Involvement**: AUTONOMOUS, REVIEW, TASTE on the appreciator UX.

**Deliverables**: appreciator mode in the editor; T4 symbolic-layer
reproductions; export pipeline (PNG stills, MP4/MOV per HISTORY render
table, glTF snapshot per TASTE).

**Definition of done**: InterBrain-main's symbolic segments play in both
modes; exports verified in Keynote (MOV alpha) and web (MP4).

## Chapter 13 — SKILL.md: packaging the framework for any Claude

**Goal**: `dreamtalk/SKILL.md` so any Claude (including Claude Design) can
drive the framework — create holons, compose scenes, promote parameters,
drive the editor, run the overlay-evaluation loop.
**Involvement**: AUTONOMOUS draft, REVIEW, then a TASTE live test.

**Deliverables**: SKILL.md (workflow, manifest reference, holon-repo
template, editor-driving recipe incl. screenshot evaluation, render/export
CLI); host adapters per ANALYSIS Q3 (Obsidian/R3F adapter; Claude Design
adapter honoring the time contract); a fresh-session acceptance test: a
Claude with only the skill + docs builds a novel symbol end-to-end.

**Definition of done**: the acceptance test passes without David's help;
TASTE sign-off on the resulting symbol's repo quality.

## Chapter 14 — Hardening & the standing problems

**Goal**: close or consciously park what remains.
**Involvement**: AUTONOMOUS research spikes, TASTE on any aesthetic calls.

- General mesh silhouette extraction (compute-shader edge method) — build
  when a corpus symbol actually needs it; spike report first. Reference
  implementation exists CPU-side in C4D
  (`objects/abstract_objects.py:881-1041`, `objects/stroke_objects.py`).
- GS fallback renderer — parked unless a scene exceeds real-time mesh
  budgets (TASTE: never default).
- Full Tauri app polish (Chapter 7 ships the spike + web app).
- Performance passes, WGSL constraint audits, cross-browser verification.

**Definition of done**: every TASTE "standing open problem" has a DECISIONS
line: solved (with pointer) or parked (with trigger condition).

---

## Status ledger

| Ch | Title | Status |
|----|-------|--------|
| 0 | Reconnaissance & governing docs | [x] done 2026-08-22 |
| 1 | Foundations sign-off | [x] done 2026-08-22 |
| 2 | Core scaffold & time contract | [~] built+verified 2026-08-22; REVIEW pending. `core/` lives: params/timeline/holon/dream (26 tests green, tsc clean), ThreeHost (WebGPU) renders FoundingSmoke, headless capture byte-identical ×3 (docs/reports/harness.md). SYNTAX-TS.md defines the target syntax. |
| 3 | Manifest schema & part resolution | [~] built 2026-08-22 (subagent); REVIEW of MANIFEST.md pending. `dreamtalk.json` (separate from `.udd`), lazy loader with proven legal cycles, 20 tests. Open threads for Ch 5: promotion metadata in the face?, internals-enforcement point (build transform vs lint), manifest-regen trigger, shared-core rule for git parts. |
| 4 | Stroke rendering & draw-on grammar | [~] groundwork done 2026-08-23 (subagent): smooth arc-length draw-on via dash technique (`dashSizeNode` TSL uniform — plain `dashSize` freezes on static transforms: NodeMaterialObserver doesn't watch dash uniforms and shares observers across identical materials; any node property forces per-frame refresh), `Stroke` base (tint+stroke px) + `Arc` part, calibration scene (`/demo/?scene=calibration`), sub-segment smoothness proven (~0.95° steps vs 2.81° segment quantum), determinism re-verified. **TSL ribbon complete 2026-08-23** (subagent): capsule-SDF body AA (soft falloff matches 2021 profile; stair-stepping gone), round caps/joins/pen-tip from one SDF, MAX blending (idempotent same-color overlap; different-color crossing + true transparency deferred with a plan), all animated values as uniform nodes, live width animation, param-driven geometry regen, Line2 removed, determinism byte-exact, 74 tests. TSL/WGSL gotchas recorded in ribbon.ts + agent report. **Stroke TASTE gate open** (GATES.md #4; AA_PX=1.0 is the one-line calibration knob). |
| 5 | Parameter system & promotion | [ ] |
| 6 | Compute unit & baking | [ ] |
| 7 | DreamTalk Editor | [~] v0 live 2026-08-22 (`core/editor/`): viewport w/ realtime playback, timeline scrub + clip marks, live param panel, backdrop instrument (image/video, under + red/green overlay modes, drag-drop, URL-driven for headless evaluation via `scripts/editor-shot.ts`). EDITOR.md designed; **v1 sync loop live** (subagent, 2026-08-23): daemon (`core/scripts/daemon.ts`, port 4174 — watch/rebuild/WS-reload, echo suppression, op queue) + setBackdrop semantic op end-to-end (UI reference-select → AST write into unfold() → watcher → remount preserving t), 7 op tests. v1 deviation: structural re-location instead of __dt span anchors (fine while ops target unique forms; anchors become load-bearing at v2 setOverride). **v2 live** (2026-08-23): __dt span anchors via Bun.build onLoad plugin (original-file offsets, fail-open, ANCHORED_DIRS extensible to holons/), setOverride op with span-then-structure rebase, live/persisted split (drag = live + red divergence mark; release commits one literal; Escape reverts; live-only params dotted), 17 op tests. Dream.play now returns its Clip (v3 enabler). Remaining: v3 setRunTime + clip-edge drag + frame-stepping + un-diverge-on-reject, mp4 sync polish, Tauri spike, TASTE pass. |
| 8 | Founding holon (Square+Circle→Cylinder) | [~] built 2026-08-23 (subagent); **TASTE gate open** (GATES.md #3: choreography, height=2r proportions, identity-subclass repo template). Analytic silhouette θ=φ±acos(r/\|d\|) unit-proven, DynamicPolyline per-frame stroke mechanism, three local sovereign repos verified through the manifest loader, founding scene registered. Open threads: shared-core rule, initial-observer-state idiom, sequential Create verb (needed by Ch 9), animated stroke width. |
| 9 | Video-01 gauntlet | [~] all ten scenes built 2026-08-24. Scorecard: S02 S03 S04 S05 S07 S09 S10 PASS; S01 23/25, S06 12/13, S08 17/18 CLOSE. Framework findings recorded in DECISIONS (36mm lens, S&T 0.6 width attenuation, C4D auto-tangent easing incl. asymmetric, screen-arc draw parametrisation, five-stroke cylinder, pose-dependent arc-order KNOWN GAP). Remaining defects are characterised per scene in docs/reports/video-01.md + agent reports. |
| 10 | Corpus T2 (symbol library) | [ ] |
| 11 | Corpus T3 (stateful) | [ ] |
| 12 | Corpus T4 & appreciator mode | [ ] |
| 13 | SKILL.md packaging | [ ] |
| 14 | Hardening & standing problems | [ ] |

Dependencies: 2+3 pair, then 4+5+6 in parallel; 7 (editor) needs 2–5 and
informs 3's write-format design early — start EDITOR.md's design doc during
Chapter 3. 8 needs 4–7; 9 needs 8; 10–12 need 9; 13 needs 10; 14 floats.


## Post-transmission queue (2026-08-24, see docs/ONTOLOGY.md)

1. Scene navigator + vocabulary/cast bar (one window).
2. DreamSong pilot: DialecticalThinking.ts — ten chapters, cuts, 157s
   composite timeline, full MP4 exported beside the original.
3. Checkpoint capture: pose via live layer → State → semantic op →
   transitionTo clip (Magic Move within scenes).
4. Cross-scene Magic Move v1 (matching; morphs later).
5. Dream/Holon unification with Ch 12; until then, new code treats
   scenes as holons-with-chronologies.

## Overnight run 2026-08-29→30 (David: "keep going until truly exhausted")

Work the TheWall stack bottom-up; verify each layer with the overlay
harness before the next; commit early/often; honest scores. If a Fable 5
usage limit hits agents, relaunch them with model "opus" (David's
explicit instruction). Queue:

1. [~] MindVirus layer (in flight): FoldableCube + Cable(trail) +
   MindVirus, scored vs MindVirus.mp4 (28 frames @5fps).
2. [~] TheLabyrinth maze math (parallel, disjoint): polar-cell maze +
   wall chains as pure TS + tests (port of TheLabyrinth.py:75-456).
3. [ ] MindVirusJourney + TheWall: SAT packing, Bezier flight,
   completion pipeline (ports verbatim — already pure f(growth,index)),
   growth wave; flower scene as intermediate check; cables OFF.
4. [ ] Ch 6 first real work: the tether — XPBD port + bake-to-f(t)
   (simulate once, sample), Cable gains `tether` source.
5. [x] The benchmark: 0.933 mean coverage_ref at 0.86px chamfer over
   the real choreography (pre-roll and fade-out excluded — both proven
   reference artifacts). Side-by-side MP4 in docs/reports/wall/.
6. [x] FIDELITY-LEDGER.md (17 entries) + morning report delivered.
   Items 1-4 also [x] — see commits 54f136c..9637daa.
Stop condition: queue exhausted, or three-strikes on any layer (record
and move on), or nothing actionable remains (standing-army rule).

## Night of coherence 2026-09-06→07 — CLOSED

All six queue items landed (EDITOR-V5): [x] direct manipulation
(c47401d) · [x] vocabulary homes, nine sovereigns with faces (128048a)
· [x] checkpoint capture / Magic Move within scenes (b3e1512) · [x]
outline grouping + hover glow (391e962) · [x] reflection pass items
2-4: timeline editing, settle fix, PLAYER MODE (a813460) · [x]
reflection item 1: the shared-material fix, boot 11.9s→1.9s, scrub
collapse everywhere (88f409f). 565 tests. Ledgered for next: editor
undo stack, cable-bake disk cache, Holon settled-flag (pinning-test
plan in reflection append), cross-scene Magic Move, face tooltips.

## Ledger round 2026-09-07 (dawn) — CLOSED

All three remaining ledger items landed on Opus successors after the
Fable reset: [x] editor undo stack — daemon-computed inverses, cmd+Z /
shift+cmd+Z, live-first, refusal-is-a-feature (06a7803) · [x] Holon
settled contract — field set final after construction+compose, scan
ends (709k Object.keys/frame → 18), thewall scrub −24.7ms (20da44e) ·
[x] cross-scene Magic Move — overlap windows, identity matching,
observer glide, one-token boundary upgrade (63bc8d9). 661 tests.
Remaining ledger: cable-bake disk cache, face tooltips, shape morphs
(true Magic Move morphing), editor transition-authoring op.

## Campaign: the pitch corpus (2026-09-07, David)

Push done (61e5a5f live). Target: reproduce corpus #09 "The Origins of
Project Liminality" (fully source-backed — recon proved NO Keynote in
it; production source = refs/PydeationProjects/pitch/InterfaceGuy/pitch/
pitch.py, 16 scenes; the GitHub pydeation-PL-pitch is a different 2022
sketch). All 32 SVG assets recovered from the C4D prefs folder (were
outside version control). Then the visual-only trio #02/#03/#05
(Key2SVG is an empty stub — trio needs .key files or by-eye; #03 lead:
PyTalk-CustodianOfTheNoosphere repo; #02 lead: the local seed/ project
beside the pitch source — seed.py, 339 lines, 6 scenes, per-scene .m4a;
head.svg gap resolved: head_side.svg is the match). Ground truth:
docs/reports/origins-vocabulary.md (chapter plan O-1..O-11 §6; missing-
core list §5 — headline: SVG importer, DrawSteady, TRUE MORPHS (the
ONTOLOGY-deferred item, now corpus-demanded), Fill/ChangeColor verbs,
rel-window choreography, camera-as-target). Fidelity: first half frame-
exact vs frames5; from Scene06 vs source choreography (published video
is a re-cut). Status 2026-09-07 evening: O-1..O-7 LANDED (see commits 2fe41d8..
ed92a01 + the winding trilogy). Scorecard: o00 11/13 · o01 17/29 full,
23/29 dense over the morphs (post-wash, summaries refreshed) · o02 32/45 · o03 45/71 · o04
24/30 · o05 30/30 · o07 22/38 (22/26 excl. reasoned bands) · o07_1
10/12 · o09 25/26 · o11 47/50. The three S&T-ordering-gated bands
(o01 draw, o02/o04 sub-strokes, o03 un-draw) await the Maxon licence.
[~] O-8/O-9 (cameras) in flight — WITH the finding that Scene08_1 +
08_2 are CUT from the published video (the missing 66s; full segment
map closed). O-10 is REFRAMED: no reference footage exists — buildable
from source choreography only, never scoreable; demoted to optional
post-campaign work. O-11 (Scene06, in the video, trimmed) remains the
queued finale.