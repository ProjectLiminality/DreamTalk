# Video-01 Vocabulary Report — "Dialectical Thinking" (2021)

Reconnaissance analysis for the Chapter-9 gauntlet. Everything the builder
agents need to reproduce the ten scenes without re-reading the pydeation
source.

**Sources analyzed** (read-only):
- `refs/video-01-source-2022/dialectical_thinking.py` — all 10 scenes (verified
  byte-identical to the working copy in
  `refs/PydeationProjects/diverse/InterfaceGuy/dialectical_thinking/dialectical_thinking.py`)
- `refs/pydeation-legacy/` — `object/object.py`, `object/custom_objects.py`,
  `object/mograph.py`, `animation/animator.py`, `animation/animation.py`,
  `scene/scene.py`, `camera/camera.py`, `constants.py`
- `refs/video-01/frame_000..156.png` — ground truth at 1fps (frame_N ≈ t=N s),
  ~35 frames viewed
- Per-scene audio in `refs/PydeationProjects/.../dialectical_thinking/SceneNN/tex/`

## 0. Timing model (measured — the video has NO editing gaps)

Audio durations (afinfo, seconds): S01 26.38 · S02 26.05 · S03 24.19 ·
S04 6.94 · S05 9.43 · S06 16.04 · S07 5.85 · S08 19.71 · S09 10.38 ·
S10 6.50. Sum = 151.5s. Video = 2:37 = 157s. The remainder (~5.5s) is a
**logo intro** not present in the 10-scene source. The video is intro +
scenes concatenated back-to-back; scene boundaries below are frame-verified
and consistent with the audio sums to ±1s.

| Segment | [start, end] (s) | Audio |
|---|---|---|
| Intro (logo + title) | [0, ~6] | none |
| Scene01 | [6, 32] | 26.4s |
| Scene02 | [32, 58] | 26.1s |
| Scene03 | [58, 82] | 24.2s (offset 1) |
| Scene04 | [82, 89] | 6.9s (offset 0.5) |
| Scene05 | [89, 98.5] | 9.4s |
| Scene06 | [98.5, 114.5] | 16.0s (offset 0.5) |
| Scene07 | [114.5, 120.5] | 5.8s |
| Scene08 | [120.5, 140] | 19.7s |
| Scene09 | [140, 150.5] | 10.4s |
| Scene10 | [150.5, 157] | 6.5s |

In-scene timing comes from the `play(run_time=…)` / `wait(…)` calls in the
source (they are exact — the C4D timeline was driven by them), so each scene's
internal choreography is fully determined; only the scene-start offset needs
the table above.

## 1. Scene map

### Intro [0–6] — Logo + title (NOT in the 10-scene source; optional for the gauntlet)
The pydeation `Logo` CustomObject draws on: BLUE main circle (r=200), two
white lines from the bottom of the circle converging to a focal point (the
"Λ"), RED small circle (r=122, center z=+72.2, focal z=+85.6), then white
text "Project Liminality" below. Then everything fades for Scene01.
Key frames: **000** (main circle drawing), **005** (complete logo + title).

### Scene01 [6–32] — ThreeDScene, "default" perspective, zoom 1
The cylinder is drawn tilted (h=0.1, p=0.4), then rotates to p=PI/2 (axis
out-of-plane). Two Eye creatures draw on: BLUE at x=300 (screen right,
looking left), RED at y=300 (screen left, looking right). The BLUE
full-screen perspective grid (plane_circler) draws on with white arrowed
axes; the BLUE circle fades in seen end-on inside the cylinder; grid
un-creates. The RED grid (plane_rectangler, perpendicular orientation)
draws on; RED rectangle fades in around the mantle; then everything fades/
un-creates. This is the thesis statement of the whole video.
Key frames: **008** (tilted cylinder ~drawn), **010/012** (horizontal),
**015** (both eyes complete), **020** (blue grid + white axes full), **021**
(blue circle faded in on grid), **025** (transition: red grid drawing, blue
circle in cylinder), **028** (red grid full), **030** (red rectangle wireframe
on cylinder, grid erasing).

### Scene02 [32–58] — TwoDScene (top orthographic), zoom 1→7/4→1
Split-screen tableau: white separator line (vertical, full height), BLUE
circle (r=50) at x=−150, RED rectangle 100×200 (h=PI/2) at x=+150, BLUE eye
at x=−400 facing right, RED eye at x=+400 facing left (h=PI). Sight lines
(3 splines per side) draw steadily from each eye to its shape, intersection
crosses glimpse (draw-then-erase) at the contact points — "empiricism".
Camera zooms to 7/4 while eyes un-create; "mathematics" appears: unit-circle
axes + radial line + dotted sin/cos lines + "sin"/"cos" labels on the circle
side; four right-angle arcs + four straight lines on the rectangle side.
Un-create, zoom back to 1. A WHITE eye (cylinderer, b=PI) creates at center
and moves along an elliptical arc path (MoveAlongSpline, tangential), then
un-creates. Separator un-creates, then circle and rectangle.
Key frames: **033** (draw-on), **036/040/042** (full tableau), **041–44**
(sight lines + crosses — transient, needs sub-second scrub), **045** (zoomed
math: sin/cos + right angles), **050** (white cylinderer eye mid-path),
**055** (end state), **057** (fade to black).

### Scene03 [58–82] — ThreeDScene, "front" perspective, zoom 3/2
Flip-flop: RED rectangle (x=+150) and BLUE circle (x=−150) alternately flash
(FadeIn/FadeOut 0.1s, pause 1/3s, ×2). Both fade in; both Transform to
center overlapping and ChangeColor to PURPLE (2s); separate again to x=±200
regaining BLUE/RED (3s). Then rounded_rectangle & cornered_circle fade in at
center, morph to a shared rounded-rect (height 150, width 100, rounding 1/2,
PURPLE); the purple rounded-rect moves left (x=−150) while a WHITE cylinder
(x=+150, standing, scale-2 plane assigned as intersection partner) fades in;
the intersection plane rotates h: 0→2PI while moving x→+200 — the
white intersection ellipse sweeps around the cylinder. All fade out.
Key frames: **060** (flipflop, rectangle alone), **063** (both apart), **066**
(purple merged pair at center), **070** (apart at x=±200), **074** (rounded
morgh mid — circle, purple rounded pair, rectangle all visible), **078**
(purple rounded-rect left + vertical cylinder right with diagonal
intersection ellipse), **081** (fadeout).

### Scene04 [82–89] — ThreeDScene, "front", zoom 1
BLUE circle (x=−250, z=+50) and RED rectangle (x=+250, z=+50) draw on
(2s); a single white x-axis with arrowhead (the "gradient", length 500,
z=−100, i.e. below them, pointing right) draws on (2s); everything
un-creates with overlapped timing.
Key frames: **084** (complete: circle, rectangle, arrow between/below),
**087** (retracting).

### Scene05 [89–98.5] — ThreeDScene, "default", camera_position (0,50), zoom 1
Corner axes (mode "xy", 0→300 both, b=PI, arrows) draw as a "V" at center
(the y-axis is out-of-plane so it renders diagonally in the default view).
BLUE circle at y=−300 (screen right, seen obliquely as a standing ellipse)
and RED rectangle at x=−300 (h=PI/2, p=PI/2 — screen left, seen as a
parallelogram) draw on with staggered rel windows. The WHITE cylinder
(p=PI/2, at origin between them) fades in — the two shapes are its two
orthogonal projections. Fade out / un-create staggered.
Key frames: **090** (V axes alone), **093** (axes + both projections),
**096** (cylinder faded in), **098** (empty).

### Scene06 [98.5–114.5] — ThreeDScene, "default", zoom 1
Large horizontal WHITE cylinder (p=PI/2, scale 2) draws on over 2s. A huge
BLUE floor grid (Axes xz, p=−PI/2, scale 5/2, positioned far x=−5000,
y=+5000) draws on (3s). A RED intersection-only cylinder (contour=False,
intersects_with a hidden vertical plane at z=1) fades in: a red rectangle
appears on the white cylinder (the plane cuts it lengthwise). Both cylinders
Transform p by +2PI over 5s while the white cylinder fades out — the red
cross-section morphs rectangle → circle → rectangle as the cylinder turns
through the fixed plane. Fade out, grid un-creates.
Key frames: **100** (cylinder half-drawn), **104** (horizontal cylinder +
red rectangle intersection + blue grid), **108** (cylinder vertical, red
circle intersection), **112** (red rectangle flat, fading, grid gone).

### Scene07 [114.5–120.5] — TwoDScene
Black; the words "trans-perspectival" (Text height 50, centered) Write on
per-letter (domino draw-then-fill-solid), hold ~1s, UnWrite.
Key frame: **116** (text fully on).

### Scene08 [120.5–140] — ThreeDScene, "default", zoom 1
Scene01's setup revisited with ONE eye: BLUE eye (x=300, h=PI) creates.
BOTH grids (blue + red) draw on simultaneously while circle + rectangle fade
in on the cylinder position (cylinder not yet visible). The creature
Transforms b=−PI/2 (orbits around the scene center, 2s), ChangeColor to RED
(2s) — seeing the other projection. Grids un-create. Then over 7s: cylinder
fades in, creature Transforms b=+4PI (two full orbits), circle/rectangle
fade out, creature ChangeColor to WHITE (in the first quarter) — the
synthesis: seeing the whole from every angle. Fade out cylinder, un-create
creature.
Key frames: **119** (eye fill starting, near-black), **122** (both grids
drawing + faint circle), **126** (full double grid, circle+rectangle at
center, eye mid-orbit left, whitening), **130** (cylinder + blue circle +
red rectangle overlaid, pink eye orbiting low), **134** (white eye upper
right of bare cylinder), **138** (black).

### Scene09 [140–150.5] — ThreeDScene, "front", zoom 5/4
BLUE circle (x=−200, z=+50) draws with "thesis" (height 30, x=−200,
z=−120) below it. RED rectangle (x=+200, z=+50) draws with "anti-thesis".
Both shapes Transform to center (x=0, z=25) rotating to oblique poses
(circle b=−PI/4; rectangle h=PI/2, p=PI/4) while the texts un-create; the
cylinder (h=−PI/2, z=25, p=−PI/4 — diagonal pose) fades in as the shapes
fade out, "syn-thesis" writes at center bottom. UnWrite + fade out.
Key frames: **141** (circle + "thesis"), **144** (both + "anti-thesis"),
**147** (merged: circle+rectangle+cylinder superimposed, "syn-t" writing),
**149** (bare cylinder + "syn-thesis").

### Scene10 [150.5–157] — ThreeDScene, "front", zoom 5/4
The summary diagram at half scale: BLUE circle (x=−100, z=−50, scale 1/2),
RED rectangle (x=+100, z=−50, scale 1/2) draw on; two white bezier
Connection arrows draw from each shape via waypoints to the cylinder
(h=−PI/2, z=+100, p=−PI/4, scale 1/2, above center) — they merge into a
single upward trunk with one visible arrowhead; cylinder fades in;
"dialectical thinking" (height 30, z=−150) draws below. Un-create text; end.
Key frames: **151** (circle + rectangle drawing), **153** (T-shaped arrows +
cylinder, pre-text), **155** (complete diagram + "dialectical thinking").

## 2. Vocabulary inventory

World model (critical for reproduction): **all spline content lives in the
XZ plane** (pydeation sets every spline primitive to plane "XZ"); the camera
looks down the −Y axis from y = 1000/zoom. Screen-right = +x, screen-up = +z
in "front"/2D views. +y is *out of the screen toward the camera*. Rotations
are C4D HPB: **h** about Y, **p** about X, **b** about Z (rotation-vector
components X=h, Y=p, Z=b).

### 2.1 Colors, thickness, fill (constants.py)

| Constant | Value |
|---|---|
| BLUE | rgb(0, 153, 204) = #0099CC |
| RED | rgb(255, 126, 121) = #FF7E79 |
| PURPLE | `average(RED, BLUE)` with the non-physical formula `(a²+b²)/√2` per channel ≈ (0.707, 0.427, 0.612) ≈ #B46D9C — **measure from frame_066** (see Risks) |
| WHITE / BLACK | #FFFFFF / #000000 |
| PRIM_THICKNESS | 5 (closed spline primitives, Eye parts, axes) |
| SPLINE_THICKNESS | 3 (open Splines: sight lines, separator, grid at thickness/2=2.5) |
| TEXT_THICKNESS | 5 |
| FILLER_TRANSPARENCY | 0.93 (default fill when `fill="default"`; almost everything in video-01 has fill transparency 1 = no fill; only Eye iris/pupil and written text are `solid`) |

Thickness is in Sketch&Toon screen-space units with "independent pixel
units" at a custom base of **1280×700** (render is 1280×720), and
**distance-based thickness rescaling ON at strength 0.6** (camera-range
mode) — strokes farther from camera render thinner. Line join behavior:
strokes connect when touching (Match World), join limit 180°, self-blend
"average" for overlaps.

### 2.2 Circle (`object.py:689`)
- **pydeation**: C4D circle spline primitive, XZ plane, 32 subdivisions,
  ellipse+ring enabled (radius_x=radius, radius_y=radius·ellipse_ratio,
  inner=radius·ring_ratio). A Loft parent gives it a fillable surface.
- **Used as**: `Circle(radius=50, color=BLUE)` everywhere (plus positions);
  `Dot` subclass = Circle at scale 0.05 (r=10), solid fill.
- **DreamTalk holon** `Circle`: `radius = length(50)`, `tint = color(BLUE)`,
  optional `ellipseRatio = completion(1)`, `fill = completion(0)`. Standard
  transform params. (Founding holon — Chapter 8 already plans it.)

### 2.3 Rectangle (`object.py:639`)
- **pydeation**: C4D rectangle spline, XZ plane. `rounding` 0–1 maps to
  corner radius `min(w,h)/2 · rounding`.
- **Used as**: `Rectangle(width=200, height=100, b=PI/2, color=RED)`
  (Scene01/08 — b=PI/2 swaps visual w/h to 100 wide × 200 tall);
  `Rectangle(width=100, height=200, color=RED)` (Scenes 03,04,09,10);
  rounded variants in Scene03 (`rounding` 0→1, `height` animated 150,
  `width` 100 — rounding=1/2 gives corner radius 25; rounding=1 on a
  100×100 gives a circle — "cornered_circle" is literally
  `Rectangle(width=100, height=100, rounding=1)`).
- **DreamTalk holon** `Rectangle`: `width = length(100)`,
  `height = length(200)`, `rounding = completion(0)`, `tint = color(RED)`.
  Note TASTE upgrades the *founding* holon to Square; for gauntlet fidelity
  a Rectangle (or Square with non-uniform scale) is required — keep Square
  as the Chapter-8 sovereign symbol and let Rectangle be its
  generalization or a sibling; do not force 100×200 through a Square.

### 2.4 Cylinder (`object.py:860`) — the star
- **pydeation**: C4D **parametric solid** cylinder — radius 50, height 200
  (C4D defaults; the code never overrides them — they intentionally match
  circle r=50 and rectangle 100×200), 64 rotation segments, 1 height
  segment, axis **+Z** (in-plane "up"). Its wireframe look is *entirely*
  Sketch&Toon: contour/fold/crease/border lines render the two cap circles
  plus the **view-dependent silhouette** lines of the mantle. There is no
  explicit spline construction.
- **Used as**: `Cylinder(h=0.1, p=0.4)`→Transform p=PI/2 (S01);
  `Cylinder(p=PI/2)` (S05, S08); `Cylinder(p=PI/2, scale=2)` (S06);
  `Cylinder(x=150, intersects_with=[plane])` (S03);
  `Cylinder(color=RED, p=PI/2, intersects_with=[plane], contour=False, scale=2)` (S06);
  `Cylinder(h=-PI/2, z=25, p=-PI/4)` (S09); same h/p at z=100, scale=1/2 (S10).
  With p=PI/2 the +Z axis pitches to −Y: the cylinder points *into the
  screen*; in the "default" orbit view this renders as the classic
  two-ellipses-plus-two-lines wireframe.
- **Intersection ability**: S&T "line intersection" mode draws the curve
  where the cylinder surface meets a listed Plane object. `contour=False`
  disables outline so ONLY the intersection curve shows (Scene06's red
  cross-section). The intersection of a plane with a cylinder is an
  analytic curve (ellipse / rectangle+arcs / two lines depending on angle) —
  DreamTalk should compute it analytically, not via mesh booleans.
- **DreamTalk holon** `Cylinder`: `radius = length(50)`,
  `height = length(200)`, `tint = color(WHITE)`,
  `contour = bool(true)` (silhouette+caps on/off),
  `sectionPlane` (optional part/reference → emits the intersection curve
  as a stroke). Parts: two `Circle` caps + analytic silhouette strokes
  (per TASTE: mesh-first with analytic silhouette for parametric
  primitives — this is exactly ANALYSIS Q2 technique #2 and the Chapter-8
  deliverable). The silhouette must update per-frame with the observer.

### 2.5 Eye (`custom_objects.py:58`) — the creature ("circler"/"rectangler"/"cylinderer")
Local construction (XZ plane, gaze along +x, all before instance scale):
- **eyelids**: open 3-point linear Spline `[(212.5, 0, −88.0), (0,0,0),
  (212.5, 0, +88.0)]` — a wedge, apex at origin, half-angle 22.5°
  (opening_angle PI/4, endpoints at radius 230). (In code the points are
  built as 2-tuples `polar2cartesian(230, ∓PI/8)` promoted to vectors with
  y=0, and the spline is rotated p=PI/2, landing the wedge in XZ.)
- **eyeball**: Arc, radius **200** (default — NOT 230; the eyelid lines
  deliberately overshoot past the arc, giving the little tick at the lid
  tips), angle PI/4, rotated h=−PI/8 so it spans ±22.5° symmetric about the
  gaze axis. Thickness 5.
- **iris**: `Dot(x=180, scale_z=3, scale=2, color=<eye color>, clipping="inside")`
  → filled ellipse, x-extent r=20, z-extent r=60 (Dot = Circle r=200 at
  scale 0.05·2=0.1; scale_z multiplies to 0.3) — the almond.
- **pupil**: two black Dots at `x=190, y=±1, scale_z=3, scale=4/5` →
  filled ellipse r=8 × r=24, doubled on both sides of the plane to defeat
  z-order. Solid black.
- **Colors**: eyelids/eyeball/iris take the eye color; pupil BLACK.
- **Every instance in the video uses `scale=0.3`** → eyeball r=60, lids to
  r=69, iris at x=54, on screen.
- Orientations used: `h=PI` mirrors gaze to −x (blue S01 at x=300; red S02
  at x=400); `b=PI/2` (red S01 at y=300); `b=PI` (white cylinderer S02).
- **DreamTalk holon** `Eye`: `tint = color(WHITE)`,
  `opening = completion(1)` (the legacy code stubs an opening param —
  promote it properly), parts `eyelids` (polyline), `eyeball` (Arc),
  `iris`/`pupil` (filled ellipses). Sovereign symbol repo (PLAN Chapter 9
  names it explicitly).

### 2.6 Axes / Grid (`custom_objects.py:182`)
Generated entirely from open 2-point Splines:
- **axes**: one Spline per active axis from `(start,0,0)`→`(end,0,0)` (x),
  `(0,start,0)`→`(0,end,0)` (y), `(0,0,start)`→`(0,0,end)` (z);
  `arrow_end=True` by default → S&T end-cap arrowhead (line-end style 4,
  cap 7×5). Thickness 5.
- **ticks** (off in every video-01 use): short perpendicular splines every
  `tick_distance`.
- **grid**: for each axis, splines of length `grid_line_length`
  perpendicular to that axis at every `grid_line_distance` from start to
  end (positions at integer multiples, 0 excluded), thickness = 5/2,
  color `grid_color`. A "xz" grid = x-positioned lines running in z, plus
  z-positioned lines running in x.
- **Uses**:
  - S01/S08 walls: `Axes(b=PI [or b=PI/2], mode="xz", draw_grid=True,
    draw_ticks=False, grid_color=BLUE [RED], x_grid_line_distance=100,
    z_grid_line_distance=100, grid_line_length=5000, x_start=-500,
    x_end=2100, z_start=-2000, z_end=400)` — white arrowed axes + colored
    grid; b rotations stand the two grids perpendicular to each other.
  - S02 math axes: `Axes(mode="xz", length_x=120, length_z=120,
    draw_ticks=False, thickness=3)`.
  - S04 gradient: `Axes(mode="x", length_x=500, z=-100)` — one arrowed line.
  - S05 corner: `Axes(mode="xy", x_start=0, x_end=300, y_start=0,
    y_end=300, b=PI, draw_ticks=False)`.
  - S06 floor: `Axes(mode="xz", x=-5000, y=5000, x_start=0, x_end=4000,
    z_start=0, z_end=4000, grid_line_length=100000, scale=5/2, p=-PI/2,
    draw_ticks=False, draw_grid=True, grid_color=BLUE)`.
- **Create/UnCreate choreography is special-cased** (see §3): axes draw
  0→80% of the span, grid lines draw as a **domino cascade** (rel_duration
  0.3 each, staggered via inverse-smoothstep midpoints), ticks 30%→100%.
- **DreamTalk holon** `Axes`: `mode` (enum/string), per-axis
  `start`/`end = length(…)`, `gridSpacing = length(30)`,
  `gridLineLength = length(1000)`, `drawGrid`/`drawTicks = bool`,
  `tint = color(WHITE)`, `gridTint = color(...)`, `thickness = length(5)`,
  `arrowEnd = bool(true)`. Compose() loop generates line parts (symbolic
  holon: CPU decides what exists).

### 2.7 Spline (open polyline, `object.py:581`)
Linear interpolation unless stated; thickness 3; used for: separator
`[(0,0,-500),(0,0,500)]` (S02); sight lines (3 per eye, S02, y=1 to float
above): e.g. `[(240,0,0),(85.36,0,35.36)]`, `[(240,0,0),(85.36,0,-35.36)]`,
`[(240,0,0),(100,0,0)]` (circle side; 50/√2≈35.36); rectangle side from
(−240,0,0) to (−100,0,±35.36)/(−100,0,0); radial/sin/cos lines (S02 math,
sin/cos with `line_style="dotted"` → S&T pattern preset 2); rectangle-math
straight lines (±110/±100, ±50/±60 combinations, y=2). Also the Eye lids.
- **DreamTalk holon** `Line`/`Polyline`: `points` (data), `lineStyle`
  (enum solid/dashed/dotted), `thickness = length(3)`, `tint`,
  `arrowStart/arrowEnd = bool(false)`.

### 2.8 Arc (`object.py:771`)
C4D arc spline, XZ plane, radius default 200, start angle 0 → end angle
`angle` (or ±angle/2 if `symmetrical`), adaptive interpolation. Uses:
Eye eyeball (angle=PI/4, h=−PI/8); S02 right-angle marks
`Arc(radius=20, x=±100, z=±50, y=2, h=k·PI/2)` (four corners); S02 motion
path `Arc(angle=PI, h=PI, scale_x=2, scale_z=1.3)` → half-ellipse
400×260 (helper, never drawn — only a rail).
- **DreamTalk holon** `Arc`: `radius = length(200)`,
  `angle = angle(PI/2)`, `symmetrical = bool(false)`, `tint`.

### 2.9 Cross marker (`custom_objects.py:148`)
`Cross(h=PI/4, scale=0.03, from_center=True, …)`: four outward 2-point
splines of length 200 from origin (+z, +x, −z, −x), scaled to 6 units,
rotated 45° → a 12-unit "×". Used only in S02 as the sight-line
intersection points, animated with Glimpse (draw 0→50%, erase 50→100%).
- **DreamTalk**: a `CrossMarker` part (or generic `Marker` holon):
  `size = length(6)`, `fromCenter = bool(true)`.

### 2.10 Text (`object.py:874` + `scene.py:405` text pipeline)
`Text` is a C4D text spline (align=center, separate letters). The scene's
`self.text()` makes it editable and wraps EVERY LETTER as an individual
Spline (clipping "inside", stroke_order "left_right", thickness 5), grouped
into a `CustomText`. `Write` = per-letter domino of DrawThenFillCompletely
(draw 0→60% of the letter window, solid fill 50→100%), rel_overlap 0.7,
inverse-smoothstep stagger; `UnWrite` = domino UnFillThenUnDraw.
Uses: "trans-perspectival" (height 50 default, S07); "thesis"/"anti-thesis"/
"syn-thesis" (height 30, z=−120, S09); "dialectical thinking" (height 30,
z=−150, S10). Font is the C4D default (Helvetica-like) — see Risks.
- **DreamTalk holon** `Text`: `content` (string data), `height = length(50)`,
  `tint = color(WHITE)`; parts = per-glyph stroke groups (troika glyph
  engine per TASTE), each glyph independently drawable+fillable so Write's
  domino cascade works.

### 2.11 Connection arrow (`mograph.py:97`)
`Connection(rectangle, (20,0,-50), (0,0,-30), cylinder, offset_start=0.15,
offset_end=0.2)` (and mirrored for the circle): a MoGraph **Tracer** spline
through [shape object, null(±20,0,−50), null(0,0,−30), cylinder object] in
**bezier** mode, arrowhead at end, stroke trimmed to 15%→80% of its length
(so it starts outside the shape and stops short of the cylinder). The two
arrows share nearly the same trunk → render as the single T-shaped branch
with one visible arrowhead (frames 153–155).
- **DreamTalk holon** `Connection`: `from`/`to` (holon refs), `waypoints`
  (data), `offsetStart/offsetEnd = completion`, `arrowEnd = bool(true)` —
  a bezier through anchor positions, evaluated from the referenced holons'
  transforms (live, so it follows movement).

### 2.12 Plane (`object.py:938`) — intersection helper
C4D plane primitive (400×400 default). S03: `Plane(b=PI/2, b_frozen=PI/4,
scale=2, x=1)` — invisible until `Show`, serves as the intersection partner
that sweeps h 0→2PI. S06: `Plane(z=1, p=PI/2, show=True)` — static vertical
cutting plane (it renders? — its S&T contour is white; in frames the plane
itself is invisible against black except via the intersection curve; treat
as helper geometry). In DreamTalk: not a visual holon, just a parameterized
plane reference for `Cylinder.sectionPlane`.

### 2.13 Group (`custom_objects.py:7`)
Null parent + children; transform params apply to the group pivot (world
origin unless positioned). Animation verbs flatten groups to leaves except
Transform, which by default moves the group object itself
(`transform_group_object=True`) — that is how Scene08's
`Transform(creature, b=4·PI)` orbits the eye around the world origin:
the eye sits at x=300 inside a group whose pivot is at origin.
In DreamTalk this is just a Holon with parts.

### 2.14 Logo (`custom_objects.py:115`) — intro only
main BLUE circle r=200; small RED circle r=200·0.61=122 at z=+72.2
(=200−122−6); two white lines from `polar2cartesian(200, −PI/2 ± PI/5)` =
(±117.6, 0, −161.8) to focal (0, 0, +85.6) (=72.2+0.11·122). CreateLogo:
fade main 0→40%, draw lines 40→70%, small circle grows radius 0→122 while
translating from focal to its center and fading, 70→100%. Optional for the
gauntlet (not part of the 10 scenes).

## 3. Animation grammar

### 3.1 Verb semantics (from `animator.py` — what the TS verbs must do)

| Verb | Semantics |
|---|---|
| `Draw` (generic Create) | S&T draw mode, stroke completion 0→1; strokes drawn sequentially ("single" method) in stroke order (default bottom_top; text left_right). Group input flattens to leaves. |
| `Create` | Dispatches per class: Eye→CreateEye, Axes→CreateAxes, Logo→CreateLogo, CustomText→Write, else Draw. **CreateEye**: pupil fills instantly (0→1%), lids+eyeball draw 0→50%, iris fills 30→100%. **CreateAxes**: axes draw 0→80%, grid domino (each line rel_duration 0.3, staggered) 0→100%, ticks 30→100%. |
| `UnCreate` | Mirror dispatch; **UnCreateEye**: iris unfills 0→50%, pupil unfills 50→60%, lids+eyeball undraw 30→100%. **UnCreateAxes** uses Erase (strokes retract from their start) rather than UnDraw. |
| `UnDraw` | completion →0 (stroke retracts from its end backwards). |
| `Erase` | erase-from-start: strokes disappear in draw direction (erase amount 0→1, then completion reset). Visually distinct from UnDraw — grids "sweep away". |
| `DrawSteady` | draw at constant pixel speed (S02 sight lines: draw_speed=200 px/s) instead of completion easing. |
| `Glimpse` | Draw 0→50% then Erase 50→100% within one play (S02 crosses; used with rel_end_point=1/4 → the whole glimpse squeezed into the first quarter of the run_time). |
| `FadeIn` / `FadeOut` | S&T opacity mode, all strokes simultaneously, opacity completion 0→1 / →0. FadeOut forces completion=1 first (a fully-drawn object can fade regardless of draw state). |
| `Fill` / `UnFill` | fill transparency → 1−fill (solid: 0) / → 1. Luminance-colored fill (self-lit, no lighting). |
| `Transform(obj, x/y/z/h/p/b/scale…, relative=True)` | keyframes position/rotation/scale. **relative=True (default) adds** to current values (S06 `p=2·PI` = one extra full turn; S08 `b=4·PI` = two orbits; S03 `x=-200` on a rounded-rect at ~x=+50 → moves left); **relative=False sets absolute** (S01 `p=PI/2`; S03 merge `Transform(circle, rectangle, relative=False)` → both to identity pose at origin-ish; S09 to x=0, z=25 with absolute rotations). Group input transforms the group pivot. |
| `ChangeParams(obj, …)` | animates object-specific parameters (S03: height/width/rounding; camera zoom). |
| `ChangeColor` | sketch+fill color crossfade; Eye-aware (recolors lids/eyeball/iris, not pupil). |
| `Morph` (unused in video-01) | mospline-cloner blend — ignore for the gauntlet. |
| `MoveAlongSpline(obj, spline, start=0, end=1)` | align-to-spline constraint, position parameter 0→1, tangential=True (object rotates to follow the path) — S02 cylinderer flight. |
| `Write` / `UnWrite` | per-letter domino (rel_overlap 0.7, global_smoothing 0.7): each letter DrawThenFillCompletely (draw 0→0.6, solid fill 0.5→1 of its window) / UnFillThenUnDraw. |
| `Show` / `Hide` | instant visibility toggles (keyframed step). |

**Relative-time algebra**: every verb accepts `rel_start_point` /
`rel_end_point` (sub-window of the play's run_time) and returns nested
AnimationGroups whose windows renormalize recursively — this is exactly the
`together(a, [b, 0.3, 1])` sub-window form in SYNTAX-TS.

**Easing**: every keyframe pair uses C4D spline interpolation with tangent
lengths `smoothing × run_time` on both sides, default smoothing **0.25**,
flat value tangents → a smoothstep-like ease-in-out. `smoothing_left=0` /
`smoothing_right=0` make the start/end linear (used in S02 Glimpse seams and
S05's staggered draw chains so segments butt cleanly). DrawSteady is linear
by construction.

### 3.2 Camera / observer

Construction (from `camera.py` + scene CONFIG):
- **TwoDScene** (S02, S07): camera projection = parallel **top view**
  looking down −Y; `camera_position=(x,z)` offsets; `zoom` = C4D CAMERA_ZOOM
  (S02 animates it 1 → 7/4 → 1 via `ChangeParams(self.camera, zoom=…)`,
  run_time 1 each).
- **ThreeDScene**: perspective camera at `(x, 1000/zoom, z)` pitched −PI/2
  (looking straight down), inside a "Camera" group with
  `p = −PI/8, b_frozen = PI/4` for **"default"** perspective, or
  `p = 0, b_frozen = 0` for **"front"**. Zoom changes = dolly (y = 1000/zoom).
  - "front" (S03 zoom 3/2, S04 zoom 1, S09 & S10 zoom 5/4): near-flat
    top-down view of the XZ plane; perspective only shows on out-of-plane
    content (the cylinders' 3D poses).
  - "default" (S01, S05 position (0,50), S06, S08, all zoom 1): the 3/4
    orbit view — pitch −PI/8 about X composed with a frozen 45° bank about
    Z. Equivalent to `observer.orbit({phi, theta})` in SYNTAX-TS terms;
    the exact projected geometry MUST be calibrated against frame_015/020
    (see Risks — C4D frozen-rotation composition is `M = Frozen · Rel`).
- **No camera animation in any ThreeD scene** — only S02 zooms. All other
  motion is object motion.

### 3.3 Verb usage per scene (with exact args)

| Scene | Sequence (run_time in s) |
|---|---|
| S01 | Create(cylinder) 3 · Transform(cylinder, relative=False, p=PI/2) 3 · Create(circler, rectangler) 5 · wait 1 · Create(plane_circler) 3 · FadeIn(circle) 2 · UnCreate(plane_circler) 2 · Create(plane_rectangler) 3 · FadeIn(rectangle) 2 · [UnCreate(plane_rectangler) + FadeOut(cylinder)] 1 · [FadeOut(circle, rectangle) + UnCreate(circler, rectangler)] 1 |
| S02 | Create(circler, rectangler, shapes) 4 · wait 2 · DrawSteady(sight_lines ×2, draw_speed=200) 1 · [Glimpse(intersection_points ×2, rel_end_point=1/4) + Erase(sight_lines ×2)] 1 · wait 3 · [ChangeParams(camera, zoom=7/4) + UnCreate(circler, rectangler)] 1 · [Create(circle_axes) + Create(radial, sin, cos lines + labels) + Create(rectangle_mathematics)] 1 · wait 1 · [UnCreate(circle_axes) + Erase(math) ×2] 1 · ChangeParams(camera, zoom=1) 1 · wait 1 · Create(cylinderer) 2 · MoveAlongSpline(cylinderer, path) 2 · wait 1 · UnCreate(cylinderer) 1 · wait 1 · UnCreate(separator) 1 · UnCreate(circle, rectangle) 1 |
| S03 | wait 2 · flipflop (FadeIn/Out(rectangle/circle) 0.1 each, pauses 1/3, 2 cycles) · FadeIn(circle, rectangle) 1 · [Transform(circle, rectangle, relative=False) + ChangeColor(→PURPLE)] 2 · wait 2 · [Transform(circle, x=−200) + Transform(rectangle, x=+200) + ChangeColor back] 3 · wait 2 · [FadeIn(rounded pair) + Transform(rounded→cornered, relative=False) + ChangeParams(height=150, width=100, rounding=1/2) + ChangeColor(→PURPLE)] 2 · [FadeOut(circle, rectangle, rel_end_point=1/2) + Transform(rounded pair, x=−150) + Show(plane) + FadeIn(intersection_cylinder, rel_start_point=1/2)] 2 · Transform(plane, h=2·PI, x=200) 3 · FadeOut(all) 1 |
| S04 | wait 1 · Create(circle, rectangle) 2 · Create(gradient) 2 · [UnCreate(gradient, rel_end_point=3/4) + UnCreate(circle, rectangle, rel_start_point=1/2)] 2 |
| S05 | wait 2 · [Create(axes, smoothing_right=0, rel_end_point=1/2) + Create(circle, rectangle, smoothing_left=0, rel_start_point=1/3)] 2 · wait 3 · FadeIn(cylinder) 1 · wait 1 · [FadeOut(cylinder) + UnCreate(axes, rel_end_point=1/2, smoothing_right=0) + UnCreate(circle, rectangle, rel_start_point=1/3, smoothing_left=0)] 1 |
| S06 | wait 1 · Create(cylinder) 2 · Create(grid) 3 · FadeIn(intersection_cylinder) 1 · [Transform(cylinder, intersection_cylinder, p=2·PI) + FadeOut(cylinder)] 5 · [FadeOut(intersection_cylinder) + UnCreate(grid)] 3 |
| S07 | wait 2.5 · Write(text) 1 · wait 1 · UnWrite(text) 1 |
| S08 | wait 1 · Create(creature) 1 · [Create(planes) + FadeIn(rectangle, circle, rel_start_point=1/2)] 3 · Transform(creature, b=−PI/2) 2 · ChangeColor(creature, RED) 2 · UnCreate(planes) 2 · [FadeIn(cylinder) + Transform(creature, b=4·PI) + FadeOut(circle, rectangle, rel_end_point=2/3) + ChangeColor(creature, WHITE, rel_end_point=1/4)] 7 · [FadeOut(cylinder) + UnCreate(creature)] 2 |
| S09 | wait 2 · Create(circle, thesis) 1 · wait 1.5 · Create(rectangle, antithesis) 1 · [Transform(circle, x=0, z=25, b=−PI/4, relative=False, rel_start_point=1/4) + Transform(rectangle, x=0, z=25, h=PI/2, p=PI/4, relative=False, rel_start_point=1/4) + UnCreate(thesis, antithesis, rel_start_point=1/3)] 3 · [FadeIn(cylinder) + FadeOut(circle, rectangle, rel_end_point=2/3) + Create(synthesis)] 1 · wait 1 · [UnWrite(synthesis, rel_start_point=1/3) + FadeOut(cylinder)] 1 |
| S10 | wait 0.5 · Create(rectangle, circle) 1 · Create(arrows) 1 · FadeIn(cylinder) 1 · Create(dialectical_thinking) 1 · wait 1 · UnCreate(dialectical_thinking) 1 |

## 4. Build order recommendation

**By leverage (holons):**
1. **Line/stroke draw-on** (Chapter 4 core) — every scene, every object.
2. **Circle + Rectangle** — in all 10 scenes; already the Chapter-8 plan
   (plus Rectangle generalization with `rounding` for S03).
3. **Cylinder with analytic silhouette** — 7 scenes (01,03,05,06,08,09,10);
   the Chapter-8 founding holon; silhouette is the hardest single
   capability and gates most scenes.
4. **Axes/Grid** — 6 scenes (01,02,04,05,06,08); pure polyline generation +
   arrowheads + the domino cascade; high visual surface area in S01/06/08.
5. **Eye** — 3 scenes (01,02,08) but THE character of the video; needs
   filled ellipses (iris/pupil) → first use of fill.
6. **Text/Write** — 4 uses (07,09,10 + intro); needs glyph outlines
   (troika) + per-letter draw/fill domino.
7. **Cylinder×Plane intersection curve** — 2 scenes (03,06); analytic
   ellipse/rect section; independent of everything else.
8. **Connection (bezier arrow between holons)** — S10 only.
9. **Cross marker, Arc, MoveAlongSpline rail** — S02 only.
10. **Logo** — intro only, optional.

**Scene order (easiest → hardest to reproduce/evaluate):**
1. **S04** — 3 objects, front view, pure Create/UnCreate with rel windows.
2. **S10** — front view, adds Connection + text + FadeIn.
3. **S09** — front view, Transform choreography + text.
4. **S07** — trivially simple visually, but requires the full Write stack.
5. **S05** — default orbit view (first camera calibration), staggered
   create windows with smoothing overrides.
6. **S01** — cylinder rotation, eyes, both grid walls; long but linear.
7. **S03** — flip-flop, color blends, rounding morph via ChangeParams,
   first intersection sweep.
8. **S02** — most objects (sight lines, crosses, math annotations, camera
   zoom, MoveAlongSpline); many transient details.
9. **S06** — intersection-only cylinder morphing through the plane while
   the contour cylinder fades; the toughest rendering feature.
10. **S08** — everything at once: double grid, orbiting recoloring eye,
    7-second four-way composite — do it last, it reuses all prior parts.

(Suggested interleave: build stroke+Circle+Rectangle → S04 passes → Cylinder
silhouette → S10, S09 → Text → S07 → Axes+Eye → S05, S01 → intersection →
S03, S06 → the rest → S02 → S08.)

## 5. Risks / unknowns

1. **"default" camera projection** — C4D frozen-rotation composition
   (`M = M_frozen · M_rel`, here b_frozen=PI/4 about Z composed with
   p=−PI/8 about X, camera dollied to y=1000·… looking down). Deriving the
   exact screen mapping on paper is error-prone. *Resolution*: implement
   observer.orbit with two angles, then calibrate against frame_015
   (eye positions ±300 → screen x ≈ ±0.45·width, same height) and frame_020
   (grid line angles), iterating in the editor overlay.
2. **PURPLE** — the source formula `(a²+b²)/√2` per channel is non-physical
   (channels can exceed 1 and it's not a mean). *Resolution*: sample the
   rendered purple from frame_066/074 (≈ #C77FA0–#B46D9C pinkish-purple)
   and hard-code the measured value.
3. **Font** — never specified in code; C4D default (Helvetica-like grotesk;
   frames 005/116/155 show it). *Resolution*: measure letterforms from
   frame_116; pick Helvetica/Arial-class font for troika; TASTE check with
   David only if the overlay shows conspicuous mismatch.
4. **Stroke width on screen** — thickness 5 (primitives/text) & 3 (lines)
   in S&T units at base 1280×700, **with distance-based rescale strength
   0.6** (far strokes thinner — visible on the S01/S08 grid walls receding).
   *Resolution*: measure px widths at known depths from frame_020; implement
   width = base·(1 − 0.6·(1 − refDist/dist)) or simply calibrate two depths.
5. **Sub-second transients** — S02 sight lines + Glimpse crosses live
   ~2s total (t≈41–44); 1fps frames straddle them. *Resolution*: extract
   denser frames from `refs/video-01/DialecticalThinking.mkv` around
   t=40–45 (and any other contested moment) with ffmpeg when evaluating.
6. **Easing curve** — C4D spline keys with 0.25·run_time flat tangents ≈
   smoothstep but not identical; motion character matters for the overlay.
   *Resolution*: implement cubic-hermite with tangent length 0.25 (matching
   make_keyframes exactly: left/right time offsets ±smoothing·run_time,
   value tangents 0), honor smoothing_left/right=0 overrides.
7. **Erase vs UnDraw asymmetry** — grids/axes disappear front-to-back
   (Erase), plain UnCreate retracts back-to-front (UnDraw). Getting these
   backwards will read as "wrong motion" in overlay. Semantics in §3.1.
8. **Stroke draw order within an object** — S&T "bottom_top" default for
   primitives, "left_right" for text, "single" method (strokes sequential,
   not parallel). E.g. the circle draws as one stroke from its seam; the
   rectangle from its bottom; exact seam positions of C4D primitives are
   unverified. *Resolution*: compare partial-draw frames (000, 033, 082,
   087, 151) and set per-holon stroke start/order to match.
9. **Cylinder intersection rendering** (S03/S06) — S&T draws the surface∩
   plane curve; when the cut exits the caps the curve is a rectangle with
   arc corners, when fully internal an ellipse. *Resolution*: analytic
   cylinder-plane section (all cases: ellipse / truncated ellipse + cap
   chords), verified against frames 078, 104, 108.
10. **Scene05/06 exact grid extents on screen** — huge world coordinates
    (x=−5000, y=5000, grid_line_length=100000) rely on the specific camera;
    once risk #1 is calibrated these follow, but treat the S06 floor grid
    as a calibration checkpoint (frame_104 line spacing/vanishing).
11. **Scene-start offsets** — audio-derived boundaries above are ±1s
    (encode/edit tolerance). The editor's per-scene backdrop time-offset
    control (PLAN "Timing alignment" risk) is the tool for honest overlays;
    fine-tune each scene's offset when its first overlay is set up.
12. **Intro logo inclusion** — not part of the 10 scenes; the gauntlet
    definition ("reproduce the founding video") suggests including it for
    the full 2:37 re-render. Construction is fully specified (§2.14);
    flag to David only whether the intro belongs in scope.
