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
| [Morph](Morph/) | mid-morph, `?scene=o01` t≈25 | THE FIRST ABILITY MODULE — importing it grafts `.morphTo()` onto every Stroke | o6 scenes + 46 morph/ability tests; f_00190 leaning-quads vindication |
| [Morph](Morph/) | circle mid-becoming-rectangle, `?scene=o01` | primitives (+geometry/morph) | morph tests (46, incl. the graft + gate); Scene01's six morphs |

The last row is not a noun. **Morph is the first pluggable ABILITY** — a
verb rather than a thing, which contributes no geometry of its own and
instead teaches every `Stroke` in the process to morph when the module is
imported (docs/DECISIONS.md 2026-09-07, "Abilities are pluggable
DreamNodes"). Its folder is the TEMPLATE every later ability copies:
`Write`, steering behaviours, `Trace`. See [Morph/README.md](Morph/) for
the pattern's seven rules.
