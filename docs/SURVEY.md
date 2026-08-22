# SURVEY.md — Repo reconnaissance snapshot (2026-08-22)

Full survey of this repo at the moment the new-framework journey began.
Verdicts follow TASTE.md's frame: old code is archaeology + authoring
backend, not authority. Summary here; the load-bearing conclusions are
folded into PLAN.md chapters.

## Headline numbers

134 tracked files, ~21,000 LOC of Python bound to the `c4d` module.
**Zero TypeScript/JavaScript** — TASTE.md is a specification with no
implementation behind it yet. No symbol-repo submodules (`.gitmodules`
absent; `.udd` lists empty submodules): the holarchy CLAUDE.md describes
lives outside this repo.

## What ports to the TS core (near-mechanically, as data/semantics)

- **`xpresso/types.py` + `xpresso/states.py`** (392 LOC) — `Length`,
  `Angle`, `Bipolar`, `Completion`, `Color`, `Integer`, `Bool` semantic
  parameter types and `State`/`StateMachine`. Almost no C4D coupling.
  These should be among the first TS files written (Chapter 2/5). The
  `xpresso/` directory name is a lie about what they are — they're the
  parameter system.
- **`assets/svg/`** (32 hand-drawn symbols: fire, tree, dna, head_front,
  logos…) — format-neutral content; Three.js curves load these directly.

## The concentrated prior art (port the design, not the code)

- **`docs/reference/MindVirus_canonical.py`** — the target syntax, already
  written: class-annotation parameters (`fold: Bipolar = 0`), `class
  States`, `specify_parts()` with inline `<<` bindings, behavior methods
  returning `AnimationGroup`s, Kronos `__main__` dream. The TS API should
  read as a transcription of this file; its 7 migration notes are a design
  brief. (Imports an aspirational `dreamtalk` package layout that never
  got built.)
- **Animation grammar** (`animation/`, ~1,400 LOC) — the verb vocabulary
  (`Create`/`Draw`/`Morph`/`Connect`) plus the relative-time algebra in
  `AnimationGroup` (nested groups renormalizing `rel_start`/`rel_stop`,
  `scale_relative_run_time`) — real design work the new framework hits
  immediately in Chapter 5.
- **Holon lifecycle** (`objects/abstract_objects.py`, `CustomObject` aliased
  `Holon`): `specify_parts → specify_parameters → specify_relationships`,
  with `_collect_annotated_parameters()` reading class annotations. Third
  iteration of this contract; the third one is good.
- **`introspection/`** (2,263 LOC; `hierarchy.py` snapshot/diff/console-
  delta engine, `detect_dreamtalk_class`, AI-readable formatting) — the
  working *mechanism* behind TASTE's "parameter promotion is an agent-driven
  editing act": human tweaks a slider, `describe_scene()` surfaces the
  changed parameter, agent promotes it. Chapter 5 needs an equivalent.
- **⭐ Silhouettes** — `objects/abstract_objects.py:881-1041`
  (`silhouette_spline_generator_code`) + `objects/stroke_objects.py`
  (`SilhouetteSplineGen`, `StrokeGen`, `MeshStroke`): a **working CPU-side
  implementation of perspective-dependent silhouette extraction as real
  stroke geometry** — the very thing TASTE.md lists as a standing open
  problem for the WebGPU stack. The natural reference for the
  compute-shader version (Chapters 7 and 13).
- **The C4D pipeline as authoring backend** — `run_dreamtalk` +
  `viewport_preview` + `describe_scene` over TCP :5555 is a working
  agent-driven authoring loop. Keep operational. (Server plugin is 7,165
  LOC of which ~6,000 are inherited generic handlers no DreamTalk tool
  calls.)
- **`docs/mograph-generator-rnd.md`** — why geometry-generators beat
  Sketch & Toon; the reasoning that bent the C4D pipeline toward
  web-exportability.

## Obsolete (archaeology only)

`legacy/` (2,023 LOC) · `xpresso/xpressions.py` + `xpresso.py` (2,062 LOC,
XPresso node graphs — dead in both directions; `bindings.py`'s `<<`
*concept* survives, its implementation doesn't) · `generator.py` + embedded
generator-code strings (C4D workaround, no TSL analog) ·
`docs/xpresso-migration-plan.md`, `docs/MIGRATION_TO_CANONICAL_SYNTAX.md`,
`docs/ai/dreamtalk_api.md` (describe the Python library) ·
`templates/SovereignSymbol/` (actively misleading — teaches the pre-v2
XPresso lifecycle) · sublime editor cruft.

## Housekeeping backlog (fix opportunistically, none blocking)

1. `imports.py` + `xpresso-migration-plan.md` claim "no XPresso
   dependencies," but 13 live modules import from `xpresso/` — the
   parameter system never moved out of that package.
2. `objects/custom_objects.py` defines `Membrane` twice (lines ~988 and
   ~1832); the second silently shadows the first.
3. `.mcp.json.template` hardcodes stale paths
   (`/Users/davidrug/ProjectLiminality/...` — pre-RealDealVault). MCP
   setup from the template will fail.
4. `mcp-servers/mcp-server-gemini-image-generator/` is an empty dir —
   broken submodule reference with no `.gitmodules` entry. Delete or fix.
5. `.claude/worktrees/create-history-docs-e2aa60/` is a stale full-repo
   duplicate worktree; safe to remove.
6. ~78 MB of binaries in git (`DreamTalk.key` 66 MB, `DreamTalk.gif`
   12 MB) + ~715 KB sublime workspace files.
7. `logs/` (untracked tooling artifact) — now gitignored.
