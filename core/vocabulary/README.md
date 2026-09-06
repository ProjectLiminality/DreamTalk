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
