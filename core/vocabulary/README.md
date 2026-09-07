# The vocabulary — sovereign symbols

Every directory here is a symbol in its DreamNode shape: one symbol
file (the single-file pattern), a short README (the linguistic face),
and its canonical PNG (the geometric face — the thumbnail test made
real). When the repo-template gate opens (GATES #3c), pop-out is
mechanical: each of these becomes its own git repo.

**The rule** (ONTOLOGY.md): Layer-1 primitives — Line, Circle, Arc,
Rectangle, Ellipse, Square, Polygon, Stroke, curves, text — are
invisible assets and stay in `src/parts/`. Anything MEANINGFUL — the
cast, not the props — lives here and appears in the vocabulary bar.
`src/parts/index.ts` still re-exports all nine for one release (the
compatibility block); new code imports from the vocabulary paths.

## The holarchy

```
Labyrinth ──────────────── the outermost ring (maze + citadel)
TheWall ─┬─ MindVirus ─┬─ MolochEye      (the gaze)
         │             ├─ FoldableCube   (the trap)
         │             └─ Cable (trail)  (the past, made visible)
         └─ Cable (tether) × each creature

Eye · Cylinder · Axes ──── the video-01 vocabulary (leaf symbols)
```

## The table

| Symbol | Face | Composes | Proven by |
|---|---|---|---|
| [Cylinder](Cylinder/) | founding scene, complete | primitives | S01/S03/S05/S06/S09/S10 gauntlets; `holons/Cylinder` parable |
| [Eye](Eye/) | full open, `?scene=eye` | primitives | S01/S02/S08 gauntlets; vocab tests |
| [Axes](Axes/) | mid-cascade, `?scene=axes` | primitives | S02/S04/S05/S06/S08 gauntlets; vocab tests |
| [MolochEye](MolochEye/) | canonical overlay PASS | primitives | docs/reports/wall/molocheye-final.png + report.json |
| [FoldableCube](FoldableCube/) | mid-flare, `?scene=foldablecube` | primitives | foldablecube tests; MindVirus.mp4 frames |
| [Cable](Cable/) | trail + rings, `?scene=cable` | primitives (+xpbd/bake) | cable tests; wall composites |
| [MindVirus](MindVirus/) | swim pose + trail, `?scene=mindvirus` | MolochEye + FoldableCube + Cable | mindvirus-scores.json + overlays |
| [TheWall](TheWall/) | the dandelion (t≈8.4), `?scene=thewall` | MindVirus (+ tether Cables) | wall-gauntlet vs refs/wall/thewall5 |
| [Labyrinth](Labyrinth/) | fully drawn, `?scene=labyrinth` | primitives (geometry/labyrinth) | labyrinth-sidebyside-cell40.png; tests |
| [Sketch](Sketch/) | david portrait, `?scene=sketch` | primitives (geometry/svg; 32 assets) | svg tests (37 subpaths); o1/o2 composites |
| [Logo](Logo/) | finished mark, `?scene=o09` | primitives | o3 scores 30/30 + 25/26; logo tests (Cramer) |
| [System](System/) | gears+icon, `?scene=o03` | Sketch (six assets) | o5: 16/16 pixel-exact layout predictions; system tests |

## Abilities

One entry so far, and it is a different KIND of thing: not a symbol you
instantiate but a capability the whole space gains by importing it.

| Ability | Grafts | Onto | Proven by |
|---|---|---|---|
| [Morph](Morph/) | `.morphTo()` + the `Morph` verb | every `Stroke` | face: mid-morph, `?scene=o01` t=24.4; Scene01's six simultaneous morphs; 46 morph tests |

An ability is a self-contained DreamNode in `vocabulary/<Ability>/` that
grafts itself onto all eligible objects when imported — TS declaration
merging plus prototype augmentation, the one sanctioned side-effect
import (DECISIONS.md 2026-09-07, "Abilities are pluggable DreamNodes").
Pure mathematics stays in `src/geometry/`; math is infrastructure, not
ability. `Morph/README.md` §"The template" is what the next one copies —
its seven rules are the pattern every later ability (`Write`, steering
behaviours, `Trace`) inherits.
