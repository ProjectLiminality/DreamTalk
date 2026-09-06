# EDITOR-V5.md — Direct manipulation, and the night of coherence

David's mandate (2026-09-06): use the two proven axes — the horizontal
(the Dialectical Thinking vocabulary) and the vertical (the TheWall
holarchy) — to organize the whole into a coherent set of holons, and
ship the obvious editor fruit: things you select, you can MOVE, the way
Keynote and C4D move things. Commit granularly so anything that drifts
is easily corrected.

## Direct manipulation — the settled architecture

The deep insight: **every piece already exists.** Selection (picking +
store), the live layer (overrides that yield to the timeline), and
setOverride (AST write-back through span anchors) are the three legs;
dragging is just the gesture that connects them. No new state, no new
persistence path.

1. **What moves: the selection.** Keynote semantics — you drag what you
   selected, however deep. If the holon's x/y are BOUND (derived
   params), the drag refuses with the binding shown in the inspector —
   never silently move an ancestor instead.
2. **Screen→world: the view plane.** The pointer delta maps through the
   camera onto the plane through the object's origin perpendicular to
   the view axis (C4D's default move). For front/ortho scenes this is
   exactly x/y. No gizmo in v1 — Keynote has none; axes come later if
   ever needed.
3. **The write path is the live/persisted split, verbatim.**
   dragstart → pause playback (predictable; our overrides clear on
   playhead motion — pausing makes the gesture honest). drag → live
   overrides on x/y. pointer-up → one setOverride op per changed param
   (literals into the construction site). Escape mid-drag → revert
   overrides, no write. Undo = the file-level undo the daemon already
   provides (git + editor history).
4. **Modifiers**: shift constrains to the dominant axis. Nothing else
   in v1 — no snapping, no duplication-drag; TASTE-minimal.
5. **Animated params**: identical to the inspector's existing behavior —
   the written literal is the construction-site value (the base the
   timeline animates FROM); the divergence mark shows while live.

## The vocabulary — organizing the space the two axes span

The sovereign symbols currently live mixed into core (parts/index.ts
and parts/*.ts). Until the repo-template gate (GATES #3c) they cannot
become repos — but they CAN take their DreamNode shape now, making
pop-out mechanical later:

```
core/vocabulary/
  MolochEye/    MolochEye.ts   README.md   MolochEye.png
  FoldableCube/ …              (the trap as its own symbol)
  Cable/        …              (trail + tether sources)
  MindVirus/    …
  TheWall/      …
  Labyrinth/    …
  Eye/          …              (extracted from parts/index.ts)
  Cylinder/     …
  Axes/         …
```

- One symbol file per holon (the single-file pattern), a short README
  (what it is, params, lineage), and its canonical FACE render — the
  thumbnail test made real for every sovereign symbol.
- `core/src/parts/` shrinks to Layer-1 primitives (invisible assets:
  Line, Circle, Arc, Rectangle, Ellipse, Square, Polygon, Stroke,
  curves, text) — exactly the vocabulary rule from ONTOLOGY.md.
- Imports update mechanically; the test suite is the safety net.
- video01 scenes keep working unchanged (they import the vocabulary
  from its new home).

## Checkpoint capture (Magic Move, within scenes)

Re-blessed by tonight's mandate ("the keynote-like style where you can
manipulate scenes and fine-tweak"): with direct manipulation landed,
the pose→capture flow from ONTOLOGY.md becomes reachable — pause,
arrange by hand (drag + camera), CAPTURE: a semantic op writes a State
of the changed params into the scene and a `transitionTo` clip after
the playhead. The live layer is the posing instrument; committing a
pose IS authoring animation.

## Night queue

1. Direct manipulation (agent A — editor).
2. Vocabulary reorganization + faces (agent B — parts/vocabulary).
3. Checkpoint capture (agent C — after A, editor + ops).
4. Polish: holarchy outline grouping of generated parts; hover-glow on
   sovereign symbols (the game loop's first visible seed).
5. Regressions after each merge (S04, molocheye, thewall spots);
   granular commits; morning report.
