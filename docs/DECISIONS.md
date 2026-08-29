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

- 2026-08-24 · **A cylinder is FIVE contour strokes, not four** — the two
  silhouette generators cut each cap; the NEAR cap's two arcs are strokes
  in their own right while the FAR cap survives as one closed loop, and
  which cap is "near" is CAMERA-relative (sign of camLocal.y), not
  local-axis relative. Independently measured by the S01 and S06 builders
  from different poses. This is why a single closed cap stroke could never
  reproduce the 2021 draw: a closed stroke cannot leave and return.
- 2026-08-24 · **KNOWN GAP: near-cap arc order is pose-dependent and
  unexplained.** S06 (static, p=PI/2) measures the CAMERA-FACING arc drawn
  first; S01 (p=0.4, b=0.1) measures the AWAY-facing arc first. Both
  readings were verified against their own reference frames, and each
  builder confirmed the other's reading was correct for the other's scene.
  pydeation's `stroke_order="bottom_top"` (object.py:90 → S&T mode 3)
  sequences whole strokes and does NOT explain which arc becomes the first
  stroke; that is decided earlier, when S&T chains contour edges into
  strokes (OUTLINEMAT_JOIN_ANGLE_LIMIT=PI, CLOSECONNECTION=True —
  object.py:204-205). The S01 rule is what ships, because it is the
  calibrated one and the arc choice costs neither scene its remaining
  frame (S06 fails f0498 either way, at 0.15 with S01's rule and 0.53 with
  S06's). Both builders REFUSED to invent a fitted rule bridging the two
  poses. Recorded as an open framework question, not papered over.
  **CORRECTION 2026-08-24 (integrator, measured):** the step-5 claim that
  the choice is cost-neutral was WRONG — an artifact of step 5 scoring
  only one frame inside each Create. At --step 1 the two readings separate
  decisively, and the swap was run BOTH ways on the real tree:
    S06 Create — S01 rule 0.559/0.530 (worst 0.017, chamfer 13.7px)
                 S06 rule 0.960/0.872 (cov_ref pins at 1.000)
    S01 Create — S01 rule 0.905/0.840 (worst 0.386)
                 S06 rule 0.735/0.744 (three frames at ZERO)
  So each scene genuinely requires the OPPOSITE arc: neither reading is
  universally right, and whichever ships costs real frames in the other
  scene. This is a true pose-dependent gap, not a tie. The S01 rule stays
  (it is the calibrated one and S01 is the more exposed scene — its near
  cap is alone on screen while drawn). The distinguishing variable, per
  the S06 builder: S06's cylinder lies nearly perpendicular to the view
  axis (p=PI/2, axis almost in the image plane) while S01's stands nearly
  upright (p=0.4, b=0.1) — poses that put the generators on opposite sides
  of the cap's projected ellipse, exactly what a screen-space join rule
  would flip on. Next round: derive the chaining rule from S&T's contour
  join behaviour; do NOT fit it.
  **FINAL MEASUREMENT 2026-08-24 (integrator, both scenes, both rules,
  full spans at step 5):**
    away-facing first — S01 23/25 mean 0.9818/0.9684 · S06 12/13 0.9341/0.9275
    camera-facing first — S01 23/25 mean 0.9433/0.9503 (f35 drops to 0.047)
                          S06 12/13 0.9998/0.9614
  PASS COUNTS ARE IDENTICAL either way, which is why a step-5 read called
  it indifferent; mean coverage moves in OPPOSITE directions, which is why
  a step-1 read of a Create phase called it decisive. Both were right about
  what they measured. Away-facing SHIPS: it is S01's calibrated reading,
  S01 is the more exposed scene (its near cap is alone on screen while
  drawn, and camera-facing puts one S01 frame at 0.047), and S06 loses only
  mean coverage, no frames. The S06 builder's full measurement is preserved
  in S06.ts as an open question so the next session inherits the evidence
  rather than the conclusion.
- 2026-08-24 · **Grid thickness derives from ONE thickness, not two** —
  the source computes `grid_thickness = thickness/2` from
  `PRIM_THICKNESS = 5` (custom_objects.py:221-222, constants.py:51), i.e.
  2.5 units. Scenes passing `STROKE_GRID * 2` were asking for 3. Fixing
  S06 to `STROKE_MAIN` unmodified lifted four mid-scene frames from ~0.96
  to 1.00. Applies to any scene still doubling its grid stroke.
- 2026-08-24 · **Tests must pin the SHIPPED path, not a parallel
  convention** — silhouette.test.ts exercised `capArc` only with NEGATIVE
  sweeps while `syncCylinder` calls it with POSITIVE ones, so three green
  tests coexisted with an inverted near-cap arc order that only a
  composite caught. Fixed by `core/test/cap-arc-order.test.ts`, which
  makes exactly the calls the renderer makes and pins which arc is drawn
  FIRST. Generalise: when a test and its subject use different conventions
  for the same helper, the test proves nothing about the subject.
- 2026-08-24 · **Ontology transmission recorded → docs/ONTOLOGY.md**
  (David). Headline decisions, all David-sourced: (a) **Dream = Holon +
  chronology** as direction — new machinery treats scenes as
  holons-with-chronologies; the class unification itself rides Ch 12;
  (b) **a DreamSong is ONE file** with relative imports, scenes as
  non-sovereign chapters; dreamsong.json demoted to manifest face;
  (c) **vocabulary rule**: core Layer-1 primitives are invisible assets,
  anything imported from outside core is vocabulary (shown in the
  editor's cast bar), overridable; (d) **Magic Move = one operator**
  — interpolation between two States over the pure timeline; within a
  scene via captured checkpoints (posed with the live layer, committed
  as States), across scenes as the identical operation one holon level
  up with matching instead of identity; (e) **baking scoped honestly**:
  never for render cost, only to make history-dependent holons samplable
  at arbitrary t; (f) **pop-out** named as the first-class holon-birth
  operation (asset/chapter/symbol → own repo, import rewritten).
- 2026-08-29 · **Three loops recorded → docs/LOOPS.md** (David) —
  cutscene/game/creator with DreamOS's containment law (Creator ⊃ Game ⊃
  Cutscene); fullscreen for cutscene+game; symbols as buttons with
  hover-glow; travel via InterBrain's existing UUID resolver priority
  (Pages → repo → Radicle); the comment-field-as-prompt portal (original
  increment); player = editor strip-down.
- 2026-08-29 · **Steal from InterBrain, verbatim** — (a) distance-
  invariant hover scaling (dreamNodeStyles.ts:106: growth ∝ |z|/focusZ,
  so apparent size change is constant at any depth); (b) the intent
  funnel + "escape always rolls back to bedrock" for mode switching
  (orchestration/ARCHITECTURE.md: transitions are imperative commands,
  NEVER useEffect-derived — it documents the exact trap). DreamTalk's
  loop switching adopts both.
- 2026-08-29 · **Embedding path: standalone static bundle, not iframe**
  — InterBrain's dreamsong-standalone pattern (dependency-free bundle,
  data as inline script, identical in Obsidian and on Pages) matches
  TASTE's thin-adapter contract; the CustomUIFullScreenView iframe+blob
  socket exists as fallback. WebGPU availability in Obsidian's Electron
  is UNVERIFIED — test before promising the game loop inside InterBrain.
- 2026-08-29 · **InterBrain has NO timeline/animation machinery** — its
  DreamSongs are .canvas scroll-documents with GIFs for motion. DreamTalk
  fills that exact hole; no duplication anywhere.
- 2026-08-29 · **The cable verdict (David asked; study instantiated
  it)** — ONE Cable holon whose IDENTITY is the rendered face (tapered
  tube, optional sliding contour rings, one param surface: width,
  taper, ringStep, slack) and whose CONTEXT supplies the control-
  polyline SOURCE: `trail(of, window)` — kinematic position history —
  standalone; `tether(anchor, tip, slack)` — constrained chain — in
  TheWall. Two named sources on one holon, not two cables and not one
  forced universal behavior. Both sources are history-dependent, so
  both are the Ch 6 baking case: simulate once at authoring, bake to
  pure f(t), scrubbing and the gauntlet keep working. The wall code's
  duplicated cube-collision model collapses into reading the one
  FoldableCube definition.
- 2026-08-29 · **TheWall stack is the next benchmark track** (David) —
  reproduce AND improve: MolochEye (pure lines + black fill disk,
  measured vs the canonical PNG) → FoldableCube + MindVirus (needs
  Ch 6 for the trail) → MindVirusJourney/TheWall (completion pipeline
  ports verbatim — already pure) → TheLabyrinth. The PNG-as-eye
  ImagePlane hack is precisely what the rebuild replaces.
- 2026-08-29 · **A trail of a pure motion is itself pure** — the cable's
  `trail(of, window)` source is samples of the carrier's PAST positions;
  when position is f(t), trail(t) = {position(t−s) : s ∈ window} is a
  pure function of t. No baking needed for MindVirus standalone (its
  jellyfish pulses express as pure timeline, Journey-style). Baking (Ch 6)
  is first genuinely required by the XPBD tether at the TheWall layer.
