# The TheWall stack — deep study (2026-08-29, recon agent)

Ground truth for recreating the holarchy MolochEye → MindVirus →
MindVirusJourney → TheWall → TheLabyrinth in the TS framework. Full
anatomy with file:line citations lives in the agent report (this file
is the working distillation; measurements verified against the PNG).

## Layers

- **MolochEye** — sovereign repo at DreamTalkVocabulary/MolochEye
  (.udd eb9890de). Canonical face: MolochEye.png (3316×1660, alpha),
  derived from MolochEye.key (Keynote!). A pydeation MolochEye.py
  exists with DIFFERENT proportions (√3:1 lens, 120° arcs, flat 0.667
  pupil) — treat the PNG as canonical geometry, the .py as grammar.
- **MindVirus** — repo TheWall/MindVirus (.udd 1021d9dd). MindVirus.py:
  fold Bipolar (−1 wrapped … +1 open), states idle/hunting/attached =
  fold 1/0.5/−1; parts: moloch_eye as ImagePlane(PNG) [the hack to
  replace] + FoldableCube (5 Rectangles, 4 hinged at fold·PI/2, open
  top); momentum physics baked to keyframes; thrust_pulse jellyfish
  (open 30%/thrust 20%/glide 50%).
- **DoubleWall does not exist** — backlog item only. The intermediate
  holon is **MindVirusJourney** (class inside TheWall.py:1019).
- **TheWall** — TheWall.py: SAT packing along a footprint spline,
  Grid-Array cloner used ONLY as a transform stamper, per-clone pure
  completion pipeline. **TheLabyrinth.py**'s __main__ is the actual
  TheWall.mp4 scene (circle r=1000, 4 rows, cables ON, row_lag 1.66).
  TheWall.png is actually the LABYRINTH's face (maze + 8 red spirals +
  MolochEye at center, pure lines on black).

## MolochEye — the platonic recipe (pixel-measured)

Unit h = lens half-height. Aspect exactly 2:1 (tips ±2h, apexes ±h).
1. **Lens**: two circular arcs, R = 2.5h, centers (0, ∓1.5h) — a 3-4-5
   construction (sin(half-span)=0.8, each arc sweeps 106.26°). White
   stroke ≈ 0.026h.
2. **Iris**: white ring r = h (kisses the apexes) + BLACK-FILLED disk
   r = 0.974h — the black disk IS the "black filling plane"; sclera
   transparent.
3. **Pupil**: wireframe cube in true one-point perspective, BLUE
   (#00A2FF canonical). Front square 1.209h, back/front = 0.5617,
   stroke ratio 0.5625 — the SAME factor, so it is a genuine cube with
   camera distance d = 1.282·edge (the C4D 36mm rig again). Derive
   k = d/(d+L), never hard-code 0.562.
Poetic option (gate for David): make the pupil literally the
FoldableCube part seen head-on — the eye contains the image of its own
trap.

## The cable — two ontologies today

- **Standalone (MindVirus.py)**: a TRAIL — C4D Tracer records the
  eye's position history; ~12 smoothed control points → SweepNurbs
  tube (r=4, tapered) + contour rings sliced every contour_step,
  phase-offset by travel. Kinematic; follows; anchored to nothing.
- **Wall (TheWall.py XPBD)**: a TETHER — 21-particle XPBD chain from
  spawn anchor to virus tip; gravity, drag, bending, collision against
  cube faces RE-DERIVED analytically (duplicated model!), stiffens on
  settle; flat tapered ribbon. State persisted in hidden splines.
Both are history-dependent (neither is pure f(t)); the wall sim breaks
under scrubbing — exactly ONTOLOGY.md's baking case.

## What ports cleanly vs what dies

Clean (~80%, dumb-vec3 math): SAT packing + bisection, Bezier +
arc-length LUTs, ALL completion/fold/scale piecewise mappings, growth
wave, XPBD solver, Catmull-Rom, cube-fold trig, ring slicing, maze
generation, MolochEye grammar. **The per-clone completion pipeline is
already pure f(growth, index) — preserve verbatim; best code in the
stack.**
Dies: Python-generator-in-cloner (→ CPU loop deciding what exists),
blackboard smuggling (PackingLUT spline, CableState_* splines,
SearchObject-by-name, userdata strings → holon-owned data + promoted
params), Tracer/SweepNurbs/ImagePlane/luminance materials/CTrack
baking, the hand-rolled camera-facing stroke quads (TSL replaces).
Duplications to kill: spline-sampling code inlined twice; cube faces
modeled twice; two motion systems.

## Improvement queue (agent's, endorsed)

1. MolochEye parametric rebuild (recipe above).
2. ONE Cable holon, two SOURCES (see DECISIONS verdict).
3. Preserve the completion pipeline verbatim.
4. Kill the blackboard → owned data + promoted params.
5. One FoldableCube definition, collision derived from it.
6. Magic numbers → named promotable params.
7. When TheLabyrinth pops out it takes TheWall.png; TheWall's own face
   candidate: the t≈13s cable-dandelion frame.
