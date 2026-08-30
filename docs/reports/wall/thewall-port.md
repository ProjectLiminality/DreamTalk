# TheWall — the journey/packing port and its measured fidelity

Date: 2026-08-30 · Agent session (wall layer) · Reference:
`refs/wall/thewall5` (84 frames @5fps, 1080², from TheWall.mp4).

## What landed

| File | What it is |
|---|---|
| `core/src/geometry/journey.ts` | The completion pipeline, pure. Cubic Bezier + arc-length LUT, `journeyState(completion, path) → {position, heading, fold, scale}`. |
| `core/src/geometry/packing.ts` | SAT oriented-square overlap, bisection `findNextBrickT`, `packSlots()` → owned slot data. Circle + 5-petal flower footprints. |
| `core/src/parts/thewall.ts` | `TheWall extends Holon`, `static sovereign = true`. One `growth` param drives N MindViruses. |
| `core/demo/wall/TheWall.ts` | The reproduction scene (circle r=1000, 4 rows, keyframed orbit). |
| `core/demo/wall/Flower.ts` | TheWall.py's own `__main__` — the 5-petal packing test. |
| `core/test/{journey,packing,thewall}.test.ts` | 95 tests. Suite: 447 pass, 0 fail; `tsc --noEmit` clean. |

## Line mapping (TheWall.py → journey.ts)

| Source | Ported to |
|---|---|
| `:1121-1129` bezier_point / bezier_tangent | `bezierPoint` / `bezierTangent` |
| `:1131-1154` build_bezier_path (p1 = spawn+spawnDir, p2 = slot+normal·dist·0.25) | `buildBezierPath` |
| `:1156-1189` arc-length LUT + binary search | `buildArcLut` / `arcLengthToT` |
| `:332-361` completion_to_spline_position | `travelToSplinePosition` |
| `:363-398` completion_to_fold | `travelToFold` |
| `:1294-1302` travel ease-out, TRAVEL_END | `completionToTravel` |
| `:1356-1386` the four scale phases | `completionToScale` |
| `:1283-1290` the growth wave | `completionOf` |
| `:1256` num_pulses = round(len/350) | `pulseCountFor` |
| `:1341-1355` virus faces −tangent | `journeyState().heading` |
| `:86-101` SAT / `:103-147` bisection / `:149-179` walk | `squaresOverlap` / `findNextBrickT` / `packFootprint` |

Every literal is a named, cited constant (`TRAVEL_END` 0.85, `THRUST_END`
0.8, `TRANSITION_WIDTH` 0.15, `DISTANCE_PER_THRUST` 350, `WALL_ROW_LAG`
1.66, …), per TASTE.

**The blackboard is dead.** The original computed the packing in
TheWall's generator and passed it to the per-clone journeys through a
hidden spline named `PackingLUT` (`:975-1000`), the clones finding the
wall by `doc.SearchObject` and reading params from userdata by string.
Here the packing is a pure function and the wall holon owns the array.

## Slot counts

| Footprint | Perimeter | Slots/row | Rows | Creatures |
|---|---|---|---|---|
| Circle r=1000 | 6283 | 59 | 4 | 236 |
| Flower 500/1000/5 petals | 7144 | 62 | 2 | 124 |

Flower spacing runs 100.6 → 149.0 units — a square held perpendicular to
a curve needs at least its own width and more the more the curve bends,
which is precisely why the source bisects instead of stepping uniformly.

## Two findings recorded (not fitted)

1. **The growth wave does not seal the wall at growth = 1.** The wave's
   range is stretched by the accumulated row lag but NOT by the
   smoothstep's own width, so at `growth = 1` every row is complete only
   out to `splineT = 1 − TRANSITION_WIDTH = 0.85`; 19 of 236 creatures
   are still in flight. Verified against the source's arithmetic run
   verbatim in Python — it yields the same 0.5936 / 0.0 at splineT = 1.
   A property of the original, pinned in `journey.test.ts`. Scenes that
   want a sealed wall drive growth slightly past 1.
2. **The reference's final frames are a fade-out.** f0084's max luma is
   136 vs 250 at f0072, and lit pixels collapse from 62k to 11k. It is a
   video outro, not choreography, so f0078 is the honest "finished wall"
   frame and f0084 is excluded from scoring.

## Measured fidelity

Mapping: our 1280×720 frame carries the same 53.13° horizontally that
C4D's 36mm lens gave the square reference, so the central 720² crop is
degree-for-degree the reference, resized to 1080². Reference frame N sits
at scene time (N−1)/5.

**The reference is 92–99.6% white cable ink.** Classifying lit reference
pixels by blue-dominance: at f0036/f0048 the wall is 0.4% of the image;
even at f0078, with the wall at its fullest, it is 7.8%. The cables we do
not draw are not a minor omission in this reference — they ARE the image.
Scores are therefore reported two ways.

### Against the full reference frame

| Phase | Frames | coverage_ref | coverage_ours | IoU |
|---|---|---|---|---|
| Cable-dominated (t 2.2–11.8) | 9 | 0.079 | 0.097 | 0.042 |
| Brick-dominated (t 13.0–15.4) | 3 | 0.829 | 0.648 | 0.450 |

Best single frame: f0078, coverage_ref **0.927**.

### Against the reference's BLUE (wall) ink only

The honest measure of what this stage claims — the white cable masked out
of the reference:

| Frame | t | ref blue px | coverage_ref | chamfer_ref |
|---|---|---|---|---|
| f0054 | 10.6 | 2057 | 0.347 | 8.20 px |
| f0060 | 11.8 | 2740 | 0.535 | 5.54 px |
| f0066 | 13.0 | 3505 | 0.654 | 4.25 px |
| f0072 | 14.2 | 4468 | **0.876** | **1.46 px** |
| f0078 | 15.4 | 5251 | **0.879** | **1.28 px** |

**The claim that verifies: our wall's lines land within ~1.3 px of where
the reference's wall lines are, once the wall is actually visible.** The
rising trend is the camera descending to edge-on — early on the reference
shows almost no wall at all (181 blue px at f0048), so those frames
measure nothing.

`coverage_ours` stays low (0.12 at f0078) for a structural reason: the
2021 render draws its bricks thin and faint (5.2k blue px) and buries
them under the cable mass, while ours is a bright dense wireframe (160k
lit px). Precision against a reference that mostly is not there is not a
meaningful number.

### Visual verdict

`thewall-composite-f078.png` (ref red / ours green) shows the two rings
sitting almost exactly on top of each other — radius, row count, brick
pitch, curvature and camera all agree; the red that remains is the cable
dandelion. `thewall-blue-composite-f078.png` isolates the wall ink.
`thewall-mid-t8.2.png` shows the choreography mid-build: the completed
arc with rows staggered diagonally (the 1.66 row lag reading as a stepped
edge), the wave front folding shut, and creatures in flight growing as
they approach. `thewall-flower.png` shows the 5-petal packing.

Known geometric residual, NOT fitted away: ours sits ~30 px lower and is
~7% taller in frame than the reference at f0072/f0078. A focus-height
probe (y = 0 vs y = 100) bracketed the reference without matching it
(dy −60 vs +34), so the remaining difference is real and unexplained;
tuning the camera to close it would be fitting around the missing cables,
which the brief forbids. Wall radius and horizontal extent already match
within ~2%.

## Camera audit (2026-08-30, prompted by the labyrinth agent)

Four flagged parameters, each re-read in the source. Three were already
applied and one is a no-op; **no scene change was needed** — re-scoring
after the audit returned bit-identical numbers (0.876 / 0.879).

| Flagged | Verdict |
|---|---|
| radius 3000, focus (0, 100, 0) | Already applied (`TheWall.ts` sets `observer.radius` and `observer.y`). Axis mapping checked: the host's focus is `(x, y, 0)` and lifts +y, the same axis C4D's `(0,100,0)` lifts. |
| spawn_direction (0, 300, 0) | Already applied. Confirmed vertical, not radial (`TheLabyrinth.py:489`). |
| clone_spacing 100, show_flight_paths false | Already the defaults (`WALL_BRICK_SIZE`/`WALL_ROW_HEIGHT` = 100); flight-path debug was never ported. |
| **frame_width 2500** | **A no-op for this rig.** The `zoom = 1023/frame_width` relation belongs to the 2D orthographic camera (`camera_objects.py:56-92`). The 3D `Observer` generator reads `FrameWidth` into a local and never applies it to `CAMERA_ZOOM` (`:195-235`) — its docstring's "ZoomFactor derived from FrameWidth/Radius" is stale. Framing comes from radius alone, on C4D's default 36mm lens. |

Two things the audit surfaced that are worth keeping:

1. **The scene's FOV is right, and the "2021 lens" would break it.** The
   reference is SQUARE, so its 36mm lens spans 53.13° on both axes. Our
   1280×720 frame at the framework default of 53.13° *vertical* puts
   exactly 53.13° across the central 720² crop — degree-for-degree the
   reference. Adopting `CAMERA_FOV_VERTICAL` (31.42°, correct for 16:9
   video-01 scenes) would have introduced a 1.78× framing error here.
   The lens is therefore NOT the cause of the ~7% residual.
2. **The host's azimuth convention is mirrored against the 2021 rig.**
   The 2021 offset is `z = −r·cosθ·cosφ` (`camera_objects.py:219`); the
   host uses `z = +r·cosφ·cosθ` (`three-host.ts:730-734`). Ours is the
   2021 rig turned 180° about Y — same elevation, same sweep, opposite
   side. Invisible for a rotationally symmetric circular wall (hence the
   already-high scores), but it WILL matter for any footprint with a
   distinguishable front, the flower included. Not changed here: the
   convention is documented and shared by every existing scene, so it is
   a framework-level decision, not this scene's to make.

## Performance — measured, no silent cap

The wall builds **every** creature; nothing is capped. But the first
build was unrenderable and the reason is worth recording.

A MindVirus is 89 holons, and **67 of them are its Cable's ring pool**
(`maxRings = 64`, pre-allocated in `compose()` regardless of use). With
cables off at this stage that pool is inert — it renders empty polylines
— but it still dominated the scene: 236 creatures = **21,005 holons**,
and the page did not reach `ready` in 10 minutes.

Emptying the pool before the cable composes (`virus.cable.maxRings = 0`,
using the Cable's own public field — no edit to `mindvirus.ts`) drops a
creature to 25 holons:

| | holons | boot | frame |
|---|---|---|---|
| 236 viruses, ring pool on | 21,005 | > 10 min (never ready) | — |
| 236 viruses, ring pool off | 5,901 | 12.7 s | **~95 ms** |

Scaling with the pool on was linear and steep (20 → 61 ms, 59 → 206 ms,
118 → 422 ms; ~3.6 ms per creature). With it off, the full 236-creature
scene renders at ~95 ms/frame — not realtime, but scrubs and captures
fine. The 124-creature flower scene runs ~50 ms/frame.

## The MindVirus driving seam (no diff needed)

MindVirus keeps `x/y/z/h/p/fold/scale` as ordinary Params and installs
its own bindings only when given a `journey` (its `compose()`). Left
without one, every param is free, so the wall binds them with
`follow(derive(...))` — the same mechanism the creature uses on itself.
**No change to `mindvirus.ts` was required.** A creature belongs to one
spelling of motion at a time: free-swimming, self-journeying, or
wall-driven.

Per-creature state is cached on `growth`, so a frame evaluates the
pipeline once per creature rather than once per bound param.

## What remains for the tether agent

- `TheWall.cables` (bool, default false) is the seam. Turning it on must
  also restore the ring pool — `thewall.ts` currently zeroes `maxRings`
  in exactly one place, guarded by `if (!this.cables.value)`.
- The XPBD tether itself (`:1404-1560`): 21 particles, gravity, drag,
  bending, collision against the cube faces, stiffening on settle. It is
  history-dependent, so per DECISIONS 2026-08-29 it is the baking case.
- The duplicated cube-collision model (`:400-470` re-derives the
  FoldableCube's faces analytically) should collapse into reading the one
  FoldableCube definition.
- **Perf will bite.** A tether is ~21 segments per creature on top of the
  25 holons a creature now costs; at 236 creatures that is the same order
  as the ring pool that made the scene unrenderable. Baking to
  time-sampled vertex data is not just an ontology preference here — it
  is what makes the cabled wall renderable at all.
