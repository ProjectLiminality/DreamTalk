# GATES.md — Items awaiting David

Append-only queue (see AUTONOMY.md). Answer inline or in chat; sessions
consume answered items into DECISIONS.md and clear them here.

> **Paused 2026-08-23**: the gauntlet workflow and the autonomy cron are
> stopped at David's request (usage limits). Resume instructions are at
> the top of `docs/reports/video-01.md`. To re-enable unattended work,
> ask a session to "set up the autonomy cron per AUTONOMY.md".

## Open

1. **[Ch 9] Logo intro scope** — the video opens with a ~5.5s Project
   Liminality Logo intro not in the 10-scene source (construction fully
   specified in docs/reports/video-01-vocabulary.md). In gauntlet scope,
   or does reproduction start at Scene 1?
2. **[Ch 0/3] Doc reviews (light)** — MANIFEST.md (schema spec) and
   docs/reports/harness.md await a skim; nothing blocks on them unless
   something reads wrong to you.
3. **[Ch 8] Cylinder TASTE gate** — READY (2026-08-23). Claude's own
   overlay/visual evaluation passed; silhouette tangency unit-proven
   (<1e-6) and visually exact in renders. Evidence:
   `docs/reports/founding/` (cylinder-34-view.png — the frame_020 echo;
   cylinder-steep-orbit.png; thesis-antithesis.png; Cylinder-thumb.png);
   live: `bun core/scripts/daemon.ts` → `/demo/?scene=founding`.
   Three sub-decisions:
   a. **Choreography** (draft v0, ~15.6s): BLUE circle draws (thesis) →
      RED square draws (antithesis) → both turn WHITE taking their
      places (circle lies flat as top cap, square as mantle profile) →
      cylinder completes them (synthesis) → orbit + push-in proving the
      silhouette lives → 3/4 hold echoing frame_020. Approve/redirect.
   b. **The parable's proportions**: literal square-ness requires
      height = 2·radius, so the founding dream uses 100×200 (side view
      exactly the square) while the Cylinder class defaults stay 50×200
      (2021 canon, gauntlet-ready). Bless or choose one canon.
   c. **Repo template**: sovereign class = *identity subclass* of the
      core vocabulary part (`export class Square extends SquarePart {}`)
      — repo-owned consolidation point for future enrichment, geometry
      stays Layer-1, DreamWeaving reads pure SYNTAX-TS. Bless as the
      template for all symbol repos.

4. **[Ch 4] Stroke look TASTE gate** — READY (2026-08-23). The TSL
   ribbon replaced Line2: capsule-SDF anti-aliasing, round caps/joins,
   pen-like draw-front. Claude's 4× comparison vs the 2021 reference
   passed (docs/reports/strokes/: crop-ours-aa1.png vs
   crop-ref-circle.png, tip-251.png, tangency.png). Live:
   `bun core/scripts/daemon.ts` → `/demo/?scene=calibration` (and the
   founding scene now renders through the ribbon). The gate: approve the
   stroke look at 1080p — width default (3px), AA softness (AA_PX=1.0,
   one-line knob), overall pen feel. This calibrates every later
   benchmark.

6. **[TASTE amendment] Text engine** — TASTE.md mandates troika's glyph
   engine + our TSL material. In practice troika proved unusable under
   WebGPURenderer, so the recorded fallback (`three-text` 0.6.5,
   WebGPU/NodeMaterial-native) is what ships. Amend the TASTE text bullet
   at your next pass — flagged rather than edited, per the scope freeze.

## Answered (consumed into DECISIONS.md)

- ~~[Ch 9] Reproduction palette~~ — **David 2026-08-23: canonical
  colors.** Scenes render in #00A2FF/#FF644E; the evaluator is
  hue-tolerant against the 2021 reference hues, strict on everything
  else.

- (none yet)

## [Ontology] Recon-surfaced TASTE questions (2026-08-29) — batched for David

a. **Two kinds of DreamSong?** InterBrain's DreamSong is a visually
   authored .canvas scroll-document; ONTOLOGY.md's is a .ts film. Both
   satisfy David's abstract definition (ONE file, linear, relative
   imports/references). PROPOSAL: both are DreamSongs — .canvas for
   scroll-telling, .ts for films — and a node may carry either or both.
b. **Submodule layout**: InterBrain puts submodules FLAT at repo root
   (its click-back-to-source parser depends on it); DreamTalk/TheWall
   use submodules/<Name>/. Two live conventions — pick one or bless both.
c. **Manifest merge**: .udd (InterBrain, authoritative schema) vs
   dreamtalk.json (TASTE) — a DreamTalk node that InterBrain can display
   needs either a merge or a dual-reader. Also implied: .udd's single
   `dreamTalk` string → list, for multiple-symbols-per-node.
d. **TASTE amendments queued**: two-mode appreciator/creator framing →
   the three loops (LOOPS.md); DreamOS's Rust/wgpu/Vello prose is
   superseded by the TS decision (no action, note only).
