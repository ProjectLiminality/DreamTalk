# Origins Vocabulary Report — "The Origins of Project Liminality" (2024)

Reconnaissance analysis for the corpus-#09 reproduction chapter. Everything the
builder agents need to reproduce the sixteen scenes without re-reading the
pydeation source.

**The headline**: this video is **fully source-backed**. Every frame is a
pydeation render — there is **no Keynote in it at all**, and no external
footage. The one non-parametric asset class is a set of **SVG line drawings**
loaded from a C4D-preferences asset folder, and that folder still exists on
this machine (all 32 SVGs recovered, see §4).

**Sources analyzed** (read-only):
- `refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py` — **the production
  source**, 1087 lines, 16 scene classes (`Scene00`–`Scene11` with `_1`/`_2`
  variants). This is the file the video was rendered from; see §2 for the
  evidence.
- `refs/pitch/pydeation-PL-pitch/pitch.py` — the GitHub repo of the same name.
  **Not the source** — a 189-line 2022 sketch of a *different, unrealized*
  script. See §2.
- `refs/pydeation-legacy/object/vector_graphics.py` — the `SVG` / `Vectorizer`
  loaders and the 24 named SVG symbol subclasses.
- `refs/pydeation-legacy/object/custom_objects.py` — `Logo`, `System`, `Eye`,
  `Connection`, `Arc`, `NGon`, `Head`, `Graph`, `Node`.
- `refs/pydeation-legacy/animation/animator.py` — the 45-verb animation grammar.
- `refs/pitch/svg-assets/svg/` — **the 32 SVG assets, recovered** from
  `~/Library/Preferences/Maxon/Maxon Cinema 4D R26_8986B2D7/python39/libs/pydeation/assets/`.
- `refs/pitch/origins/Origins.mkv` (720p, 377.9s) and
  `refs/pitch/origins/frames5/f_00001..01889.jpg` — ground truth at 5fps
  (`f_N` ≈ t = N/5 s), ~20 frames viewed plus a full-video luminance scan.
- `refs/PydeationProjects/pitch/InterfaceGuy/pitch/Scene00/tex/pitch_audio_final.mp3`
  — the single continuous narration track (429.7s).

## 0. Timing model (measured — one continuous audio track, scenes cut against it)

Unlike video-01 (ten scenes with ten separate audio files concatenated), this
project uses **one 7:10 narration track** (`pitch_audio_final.mp3`, 429.7s).
Every scene calls `self.audio(<same file>, offset=N)` — the offset is the
scene's start time in that track. So the source *declares its own timeline*:

| Scene | `offset=` | Source line |
|---|---|---|
| Scene00 | 0 | 12 |
| Scene01 | 13 | 113 |
| Scene02 | 71 | 201 |
| Scene03 | 96 | 233 |
| Scene04 | 125 | 284 |
| Scene05 | 142 | 315 |
| Scene06 | 154 (`..._fixed.mp3`) | 411 |
| Scene07 | 233 | 549 |
| Scene07_1 | 248 | 626 |
| Scene08 | 291 | 676 |
| Scene08_1 | 303 | 731 |
| Scene08_2 | 326 | 816 |
| Scene09 | 369 | 901 |
| Scene10 | 380 | 930 |
| Scene11 | 405 | 973 |
| (end) | 419 | 1055 |

**The published video is 377.9s, not 429.7s** — it is a re-cut, ~52s shorter
than the full narration. Scene boundaries in the video were measured by a
luminance scan (frames whose 32×18 grayscale mean < 0.6 = black gap):

| Video black gap (s) | Duration | Reading |
|---|---|---|
| 0.0–0.2 | 0.4s | lead-in |
| **12.8–13.6** | 1.0s | **Scene00 → Scene01** (source offset 13 ✓) |
| **70.6–71.4** | 1.0s | **Scene01 → Scene02** (source offset 71 ✓) |
| **95.0–96.6** | 1.8s | **Scene02 → Scene03** (source offset 96 ✓) |
| **124.8–128.0** | 3.4s | **Scene03 → Scene04** (source offset 125 ✓) |
| **142.2–146.6** | 4.6s | **Scene04 → Scene05** (source offset 142 ✓) |
| 168.2–174.2 | 6.2s | Scene05 → Scene06 (source 154 — diverges) |
| 186.6–187.4 … 237.0–240.6 | 1–3.8s | intra-Scene06 beats |
| 279.0–281.0, 284.4–287.4, 292.2–294.6 | 2–3.2s | Scene07 / Scene07_1 |
| 315.0–325.4 | **10.6s** | the long gap — a cut section |
| 345.6–347.2, 359.0–360.8, 370.8–372.6 | ~2s | Scene08_2 / Scene09 / Scene11 |

The first six boundaries match the source offsets to **within 0.4s** — that is
the identification proof (§2). From Scene06 on, the video was re-timed: Scene06
alone is a ~79s monster (offset 154→233) and the editor trimmed it. **For
reproduction, use the source's own `run_time`/`wait` choreography** (it is
exact — the C4D timeline was driven by these calls) and treat the video's
second half as a re-cut of that material rather than a frame-exact target.

## 1. Scene map

Every scene below is **source-backed** — the construction code exists in
`pitch.py`. The "visual-only" column that video-01's report needed is empty
here. What varies is *asset* dependency: scenes marked **[SVG]** need one or
more files from `refs/pitch/svg-assets/svg/`.

### Scene00 [0–13] — TwoDScene — **the line portrait** [SVG]
Black; a single white line-art portrait of David draws itself on. One object:

```python
picture = David(scale=2 / 3, thickness=2 / 3)
self.play(DrawSteady(picture, draw_speed=10000, stroke_order="long_short"),
          run_time=3)
self.wait(9)
self.play(Erase(picture))
```

`David` is `SVG("david", line_only=True)` — see §4. The draw is **`DrawSteady`,
not `Create`**: constant *arc-length* speed (10000 units/s) across all 37
subpaths, ordered **longest-stroke-first** (`stroke_order="long_short"`), so the
jaw and hoodie outlines appear before the hair scribbles. This is the single
most distinctive animation in the video and the one verb DreamTalk lacks (§5).
Key frames: **f_00015** (t=3s, complete), **f_00050** (t=10s, holding).

### Scene01 [13–71] — ThreeDScene, "front" — the kinship graph → dialectic
The thesis statement. A 7-node graph: `central_node = Circle(radius=20)` at
origin plus six `Circle(radius=20)` on a circle of radius 200 at angles
`(i+1)·2π/6 + π/2 + π/6`. All 42 directed `Connection` edges are built
(every node to every other), then partitioned by hand-picked index into
`left` (7,11,13,17,37,38), `right` (21,22,27,28,33,34), `middle`
(0–5 + 6,12,18,24,30,36) and `remaining` (the other 18).

Choreography: `DrawThenFillCompletely(relatives)` (2s) → `Create(relationships)`
(2s) → a 4s beat that simultaneously creates a **dotted vertical separator**
(`Spline([(0,0,400),(0,0,-400)], thickness=5, line_style="dotted")`),
un-creates `relationships_remaining`, and `ChangeColor`s the left half BLUE and
right half RED. The centre node then oscillates x = +50/−50 four times
(the mediator wobbling between camps) and returns. After a 9s hold, the six
outer nodes **`Morph`** into shapes — the three left circles into
`Circle(radius=50, x=-200, BLUE, solid=True)`, the three right into
`Rectangle(100×200, x=200, RED, solid=True)` — the separator fades, and two
`Connection` tension arrows create between them. Then the circle and rectangle
converge (x = ±75) and a `Cylinder(h=-π/2, z=100, p=-π/4, scale=1/2)` creates
above. The whole `shapes` group slides to x=−250 and two `Eye`s
(`Eye(BLUE, scale=1/3, x=-175)`, `Eye(RED, ..., h=PI)`) create, rotate to face
each other (h=±π/2), whiten, and cast `sight_lines` (`Connection` to fixed
world points) before erasing.
Key frames: **f_00090** (t=18s, full 7-node graph filled), **f_00160** (t=32s,
dotted separator + BLUE/RED split — the signature image), **f_00260** (t=52s,
circle + tension arrows + rectangle).

### Scene02 [71–96] — ThreeDScene, "front", zoom 3/4 — the pie splitting
Three `Arc(mode="ring", angle=2π/3, symmetrical=True)` segments, each grouped
with an invisible `CObject(x=50)` anchor, the groups rotated h = π/2, 2π/3+π/2,
4π/3+π/2 — a disc cut in three. `DrawThenFillCompletely(pie)` (2s), then each
segment translates x += 20 over 5s (`parts=False, smoothing_left=0,
smoothing_right=0` — move the whole spline rigidly, no re-smoothing). Then over
6s the segments fly out to x=100 while `Connection` force-vectors create from
the origin to each anchor and the segments recolor GREEN / BLUE / RED.
`UnFillThenUnDraw` to close.
Key frames: **f_00360** (t=72s, disc drawing), **f_00380** (separated white
disc), and see Scene04 for the colored variant.

### Scene03 [96–125] — TwoDScene — the global system [SVG ×6]
`System(scale=3/4, y=1)` inside a plain `Circle()`. `System` is a
`CustomObject` composite of four gear-and-icon pairs:

| component | icons | placement |
|---|---|---|
| `law` | `Justice` + `GearBig` | scale 0.5, x=80, z=−85 |
| `economy` | `Factory` + `GearBig` | scale 0.5, x=−80, z=85 |
| `finance` | `Cash` + `GearSmall(b=π/12)` | scale 0.3, x=70, z=65 |
| `healthcare` | `Stethoscope` + `GearSmall(b=−π/12)` | scale 0.3, x=−70, z=−65 |

All six distinct icons are SVGs. `Create` both (3s), `Fill(transparency=1)` +
`ChangeColor(BLUE)` over 8s, hold 2s, then a slow 11s `UnDraw` and a fade.
Key frame: **f_00560** (t=112s — the blue circle containing four interlocking
gears bearing factory / banknote / stethoscope / scales-of-justice icons).

### Scene04 [125–142] — ThreeDScene, "front", zoom 3/4 — the pie, colored
Scene02's construction re-instantiated with the colors baked in
(`Arc(..., x=120, color=GREEN/BLUE/RED)`), anchors at x=170 and the
`Connection` vectors `reverse=True` (pointing *inward*). Wait 2s,
`DrawThenFillCompletely` (3s), `Create(force)` (4s), then the segments collapse
back to x=0 while everything fades — centrifugal disintegration reversed.
Key frame: **f_00470** (t=94s… note: this is Scene02's slot; the *colored*
version reads at **f_00640**, t=128s).

### Scene05 [142–154] — ThreeDScene, "front", zoom 3/4 — the logo + title
`Logo(z=50, scale=0.6)` and `Text("Project Liminality", z=-160, height=50)`.
`Logo` is the canonical brand mark, a `CustomObject` of three components:
BLUE `main_circle` (r=200); RED `small_circle` (r = 200·0.61 = 122, centred at
z = 200 − 122 − 6 = 72.2); and `lines` — two `Spline`s from points on the main
circle at angle −π/2 ± π/5 converging on a focal point at
z = 72.2 + 0.11·122 = 85.6, forming the "Λ".
`Create(logo, rel_end_point=3/4)` overlapped with `Write(name,
rel_start_point=2/3)` over 4s.
Key frame: **f_00760** (t=152s).

### Scene06 [154–233] — ThreeDScene, "front", zoom 3/4 — **the longest scene** [SVG]
The origin story proper, ~79s. Beats, in order:
1. A pre-shown `logo` transforms to z=0, scale 5/4 over **10s**, then its
   `small_circle` and `lines` components fade out over 4s (leaving the bare
   blue circle), hold 6s.
2. `Create(dialectical_thinking)` (4s) — a **group reproducing video-01's
   thesis** inside the circle: `Rectangle(75×150, x=125, z=-100, RED)`,
   `Circle(radius=75/2, x=-125, z=-100, BLUE)`, `Cylinder(h=-π/2, z=100,
   p=-π/4, scale=3/4)`, plus two `Connection` tension arrows.
3. That whole group `Transform`s into the logo at scale 1/3 (5s), then graph
   `edges` and `nodes` create around it and un-create.
4. `Draw(github)` (3s) — the **GitHub octocat SVG**; it slides to x=250 while a
   second logo creates at left (the pairing image).
5. `Morph(github, repo_triangle.children[1])` — the octocat morphs into a
   framed triangle, beginning the **repo evolution chain**: triangle → square →
   pentagon → hexagon → circle, each a `Group(frame, NGon)`, each step a paired
   `Morph(..., copy=True)` plus a `Create(arrow, rel_start_point=2/3)`.
6. The chain collapses to `repo_circle` at x=−120, a `repo_rectangle` creates,
   then `tension`, then `repo_cylinder` — rebuilding the dialectic from repos.
7. Everything un-creates into the bare circle/rectangle/cylinder triad.
Key frames: **f_00900** (t=180s, dialectic inside the blue circle),
**f_00980** (t=196s, octocat alone), **f_01040** (t=208s, logo + octocat side
by side), **f_01100** (t=220s, the five-box polygon chain), **f_01160**
(t=232s, the triad dissolving).

`Scene06_1` is a **continuation-state duplicate** — the same objects
re-declared with `show=True, completion=1` so the render could be resumed
mid-scene. Reproduce Scene06 and Scene06_1 as one continuous scene.

### Scene07 [233–248] — ThreeDScene, "front", zoom 1 — code ↔ idea
`Text("code", x=-200, BLUE)` and `Text("idea", x=200, RED)` with a
double-headed `Connection` between them. `DrawThenFillCompletely` (3s), hold
9s, then both texts `Morph` into 300×300 frames (BLUE left, RED right). A
`code_snippet` — declared as a bare `CObject()` and revealed with `Fill` — is
in the left frame; in the video it is a **syntax-highlighted raster image of
pydeation source** (`def construct(self): cylinder = Cylinder()  …`), i.e. a
`Picture`-style textured plane, not vector geometry. A `Cylinder` creates in
the right frame and is `Transform`ed (h=π/3, p=π/4) in step with a small
progress `arrow` moving down the code — code line ↔ resulting geometry. Then
both frames `Morph` into a **Venn diagram** (`Circle(radius=100, z=-95, BLUE)`
inside `Circle(radius=200, RED)`) with the words repositioned inside.
Key frames: **f_01230** (t=246s, "code ↔ idea"), **f_01300** (t=260s, the
code-panel / cylinder-panel pair).

### Scene07_1 [248–291] — ThreeDScene, "front" — the head and the idea chain [SVG]
`Head(x=-200, WHITE, scale=1/2, thickness=VG_THICKNESS*2)` — the profile-head
SVG — and five RED ideas: `NGon(n=3)`, `NGon(n=4)`, `NGon(n=5)`, `NGon(n=6)`,
`Circle`, all radius 25, scale 3/2. The head draws while `idea1` creates; head
slides right and recolors RED, then BLUE while dropping (y=−115); then the four
`Morph(ideaN, ideaN+1, copy=True)` steps walk the polygon up to a circle —
the same "more sides → circle" convergence as Scene06's repo chain, at the
scale of one mind.
Key frame: **f_01420** (t=284s, white head profile with a red triangle inside).

### Scene08 [291–303] — ThreeDScene, "front", zoom 1 — the four applications
`Logo(z=-150, scale=1/4)` at bottom centre with four labelled `Connection`
spokes, created in narration order with holds between:
`"p2p education\nsystem"` (z=50, x=−300) → `"de-escalate\nculture war"`
(z=50, x=300) → `"sense-making\nplatform"` (z=150, x=−100) →
`"idea\nincubator"` (z=150, x=100). A `Rectangle(160×70, z=45, x=-300)`
frames the first label. Then all labels un-create and the links fade.
Key frame: **f_01530** (t=306s — three labels and spokes around the small logo).

### Scene08_1 [303–326] — ThreeDScene — the lattice + **camera flythrough**
The most camera-heavy scene in the video. Five rows of `Circle(radius=15)`
alternating 5 / 4 / 5 / 4 / 5 across z = −200 … +200, wired by `Connection`
edges between adjacent rows (`offset_start=0.15, offset_end=0.25`) — a diamond
lattice of ideas. Two tiny `Head`s at scale 1/50 (BLUE `student`, RED
`teacher`, `h=PI`) sit at the top. A BLUE region (row1[:4] + row2[:3]) fills;
a RED path (row3[2], row4[2], row5[2]) fills; then **the camera itself is
animated** — `Transform(self.camera, y=-500)`, then `x=50, z=100`, then
`x=0, z=200, p=-π/2, y=500`, then `y=-450` — dollying along the red path
turning it BLUE step by step, ending with a 9s pull-out to y=1000. Finally an
`extra_node` (BLUE, x=−250) and two edges create: the lattice grows.
**Note**: this is the scene most affected by the re-cut — the 10.6s black gap
at t=315–325.4s falls in this range.

### Scene08_2 [326–369] — ThreeDScene, camera_position (−300, 22.5), zoom 100
Scene08's tableau again, entered **mid-flight**: the camera starts pushed in at
zoom 100 and pulls back (`Transform(self.camera, y=990)` then `x=0, z=0,
y=1000, p=-π/2`) while the labels and links create at `rel_end_point=1/30`
(essentially instantly). Then everything un-creates and the logo is drawn out
over 3s. This is the "resume" half of Scene08 the way Scene06_1 is Scene06's.
Key frame: **f_01500** (t=300s, mid-flythrough with labels part-visible).

### Scene09 [369–380] — ThreeDScene, "front", zoom 1 — the logo, slowly
`Logo()` at full size, `Create(logo, run_time=18)` — an unusually slow,
meditative 18s draw — hold 6s, fade. The video's re-cut shortens this.
Key frame: **f_01700** (t=340s, full-screen logo).

### Scene10 [380–405] — ThreeDScene — big tech and the cylinder [SVG ×4]
`AppleLogo` (x=−150, BLUE), `AmazonLogo` (x=150, BLUE), `GoogleLogo` (z=−150,
RED), `MicrosoftLogo` (z=150, RED), all scale 1/4 — four SVG brand marks around
a centre `anchor = CObject()`, each with a `Connection` tension line to it.
Then, over 4s, **the camera group rotates** (`Transform(self.camera_group,
p=π/3, h=π/4)`) while the camera dollies (`z=25, y=-300`) and the anchor lifts
(`y=80`) — the flat cross of logos tilts into 3D and a `Cylinder(y=125,
scale=1/2)` rises out of the middle where the four tensions meet.
This is the only scene using **`self.camera_group`** (orbiting the rig) as
opposed to `self.camera` (moving the camera within it).

### Scene11 [405–419] — ThreeDScene, "front", zoom 1 — the return
Scene01's 7-node graph rebuilt verbatim (identical node/edge/partition code),
entered already-drawn. `ChangeColor` left BLUE and right RED, then
`Fill(relatives, solid=True)` while the three named edge groups fade in (4s),
hold 2s, `Create(relationships_remaining)` (2s) — **the 18 edges that were
deleted in Scene01 come back**: the split is healed. Fade out.
Key frame: **f_01810** (t=362s, the full re-connected graph),
**f_01880** (t=376s, closing logo + title).

## 2. Which repo is the source (the mapping, with evidence)

**The source of video #09 is `refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py`**
— a local working copy, *not* a GitHub repo.

The GitHub repo `InterfaceGuy/pydeation-PL-pitch` ("the essential pitch for
ProjectLiminality", 2022-06-07), cloned to
`refs/pitch/pydeation-PL-pitch/`, is **not** the source. Its `pitch.py` is 189
lines with three classes — `RelationshipToStories`, `PhysicalCampfire`,
`Campfires` — describing an entirely different, *unrealized* script: humans
around campfires, `Earth`/`Money`/`Health` symbols, walking paths between
fires. None of it appears in the video. It also imports `from pydeation.imports`
and calls objects (`Human`, `Fire`, `Money`, `Health`) that do not exist in
`pydeation-legacy`. It is an abandoned treatment that happens to share a name.

The evidence for the working copy being the real source is four-fold:

1. **The portrait.** `Scene00` constructs `David(scale=2/3, thickness=2/3)` and
   draws it with `DrawSteady(draw_speed=10000, stroke_order="long_short")`.
   Frame `f_00015` is that portrait, complete, at t=3s — exactly the declared
   `run_time=3`.
2. **The audio offsets are the video's cut points.** The first six scene
   transitions measured from the video's luminance (12.8, 70.6, 95.0, 124.8,
   142.2 s) match the source's declared `offset=` values (13, 71, 96, 125, 142)
   to within 0.4s. Six independent coincidences is not coincidence.
3. **The audio file is present and matches.** `Scene00/tex/pitch_audio_final.mp3`
   is the exact file the code names, 429.7s long, with `offset=419` for the last
   scene — a self-consistent timeline.
4. **Frame-by-frame construction match.** Every sampled frame corresponds to a
   specific construction in the file: the 7-node graph with hand-partitioned
   edges and dotted separator (`f_00160`), the tri-segment `Arc` pie
   (`f_00360`/`f_00470`), the four-gear `System` (`f_00560`), the `Logo` +
   title (`f_00760`), the GitHub octocat (`f_00980`), the polygon repo chain
   (`f_01100`), the code/idea panels (`f_01230`/`f_01300`), the `Head` + `NGon`
   chain (`f_01420`), the labelled logo spokes (`f_01530`), the healed graph
   (`f_01810`).

**Naming note for CORPUS.md**: the working copy lives under a directory named
`pitch`, the audio is `pitch_audio_final.mp3`, and the repo is
`pydeation-PL-pitch` — the project was called *"the pitch"* throughout. It was
published in Jan 2024 under the title "The Origins of Project Liminality".
There is a sibling `seed/` project (`seed.py`, 339 lines, six scenes with
per-scene `.m4a` audio) and a `stem/` stub in the same tree; `seed` is a
*different, earlier* video — worth checking against corpus #02 when that
chapter opens.

Also note **`InterfaceGuy/PyTalk-CustodianOfTheNoosphere`** ("pytalk animations
for custodian of the noosphere video", 2023-02-26) — that is almost certainly
the source for **corpus #03**, which the campaign brief classified as
visual-only. It should be cloned before #03 begins.

## 3. Key2SVG's role (and why it doesn't help here)

`InterfaceGuy/Key2SVG` (2024-09-16), cloned to `refs/pitch/Key2SVG/`, is
**an empty stub**. Its two commits are "Initial commit from template" and a
"cleanup" that renamed the empty `DreamSong.canvas` to `Key2SVG.py` — the
`.py` file is **zero bytes**, and the README is the single line `# DreamNode`.
The name records an *intention* (Keynote → SVG conversion, presumably to pull
slide vector art into the DreamTalk pipeline) that was never implemented.

**Implication for the visual-only trio (#02, #03, #05)**: there is no Key2SVG
tooling to recover Keynote slide geometry with. Note also that Key2SVG postdates
all three videos (Sep 2024 vs Feb/May/Aug 2023), so it was never part of their
production anyway. Those videos' Keynote layers will have to be reproduced by
eye or, better, sourced from the `.key` files themselves if they can be found
locally (the `DialecticalThinking` symbol repo shipped a `.key`, so the habit
exists). The *symbol* layers of #02/#03/#05 are the reproducible part, and for
#03 the `PyTalk-CustodianOfTheNoosphere` repo is the lead.

## 4. The SVG question, answered

**Yes — the line portrait comes from an SVG file, and no, it is not in any
repo. But it has been recovered.**

`refs/pydeation-legacy/object/vector_graphics.py:31` defines:

```python
class SVG(SplineObject):
    def __init__(self, file_name, line_only=False, thickness=VG_THICKNESS, **params):
        assets_path = "/Users/davidrug/Library/Preferences/Maxon/Maxon Cinema 4D R25_EBA43BEE/python39/libs/pydeationlib/assets/svg"
        file_path = os.path.join(assets_path, file_name + ".svg")
        doc = c4d.documents.LoadDocument(file_path, c4d.SCENEFILTER_NONE)
        ...
```

and `:196`:

```python
class David(SVG):
    def __init__(self, **params):
        super(David, self).__init__("david", line_only=True, **params)
```

The assets lived in the **C4D preferences folder, outside version control** —
which is why no repo contains them. The R25 path in the code is stale, but the
**R26 equivalent still exists on this machine** and has been copied to
`refs/pitch/svg-assets/` (696 KB, 32 files):

```
amazon_logo apple_logo cash control crop_talk david dna dodecahedron
education emu factory fire gear_big gear_small github google_logo
head_front head_side healthcare individual infinity_symbol justice
left_foot man microsoft_logo right_eye right_foot stethoscope
tree_high_res tree_medium_res wave world
```

Every SVG this video needs is in that set **but one**: `david`, `github`,
`justice`, `factory`, `cash`, `stethoscope`, `gear_big`, `gear_small`,
`apple_logo`, `amazon_logo`, `google_logo`, `microsoft_logo` are all present
and exact.

**The one gap is `Head`.** `vector_graphics.py:80` declares
`super(Head, self).__init__("head", ...)` — i.e. it loads `head.svg` — but the
recovered R26 folder contains only **`head_front.svg` and `head_side.svg`**,
no `head.svg`. The file was evidently renamed (or split in two) between the
R25 folder the code targets and the R26 folder that survived. Frame
`f_01420` settles which one the video used: Scene07_1 shows a **side profile**
facing right, so **`head_side.svg` is the match**. Scene08_1's two 1/50-scale
heads are too small to distinguish and should use the same asset.

### `david.svg` anatomy (what an importer must handle)

- 124,731 bytes; `width="1191px" height="842px" viewBox="0 0 1191 842"`.
- Generated by **Pixelmator Pro 2.2** (Oct 2021) — a hand-traced drawing.
- **One single `<path>` element** whose `d` attribute is 124,356 characters.
- Command histogram: **`M`×37, `C`×42, `L`×6, `Z`×20**. So: 37 subpaths, and
  the geometry is overwhelmingly **polyline-dense cubic bézier runs** — a
  single `C` command carrying hundreds of implicit repeated control triples
  (Pixelmator emits one `C` then streams coordinates). This is why the stroke
  count is low but the file is huge.
- `fill="none" stroke="#000000" stroke-width="1" stroke-linejoin="round"
  stroke-linecap="round"` — **stroke-only, no fills**. Consistent with
  `line_only=True`, which routes the object through the plain `CObject` branch
  (no `clipping="inside"` fill setup).

**What DreamTalk needs**: an **SVG path → polyline importer**. Specifically it
must parse the `d` mini-language for `M`/`L`/`C`/`Z` **including implicit
command repetition** (the streamed-coordinate form), flatten cubic béziers to
polylines at a tolerance, keep **subpaths separate** (37 of them — they are the
individual pen strokes, and `stroke_order` sorts *by subpath arc length*), and
apply the y-flip and centering the loader did (`Center Axis to`, then
`p_frozen=-π/2`, and the z/y swap in `params`). Once subpaths are polylines,
the existing `Stroke` machinery draws them.

This is a **bounded, well-specified piece of work** — a few hundred lines, no
new rendering concepts — and it unlocks 12 of the 16 scenes' assets plus a
reusable asset class for the rest of the corpus.

### How Keynote mixes with rendered symbols

**It doesn't, in this video.** There is no Keynote layer in corpus #09 — the
luminance scan shows clean black gaps between pydeation renders end to end, and
every sampled frame maps to a construction in `pitch.py`. The only
non-parametric raster is Scene07's **code snippet**, a syntax-highlighted
screenshot revealed on a plane inside the BLUE frame (declared in the source as
a bare `CObject()` placeholder that was textured in C4D). Corpus #09's ⚠ in
CORPUS.md can be resolved to: **pydeation + SVG assets, no Keynote**.

For the visual-only trio the Keynote question is still open, and Key2SVG does
not answer it (§3).

## 5. What DreamTalk core is missing

Measured against `core/src/verbs.ts` (Create, UnCreate, Draw, UnDraw, Erase,
FadeIn, FadeOut, Move, Scale, Rotate) and `core/src/parts/`.

**Blocking — needed by Scene00, the first frame of the video:**

| Missing | Needed by | Notes |
|---|---|---|
| **SVG path→polyline importer** | Scene00, 03, 06, 07_1, 08_1, 10 | §4. The single highest-value item; 12 of 16 scenes touch an SVG asset. |
| **`DrawSteady`** | Scene00 | Constant *arc-length* draw speed across a multi-subpath object, plus `stroke_order` (`"long_short"`). Core's `Create` is per-holon normalized-time; this is a different parameterization. `refs/pydeation-legacy/animation/animator.py:245`. |

**Blocking — needed by most scenes:**

| Missing | Needed by | Notes |
|---|---|---|
| **`Morph`** | Scene01, 06, 07, 07_1 | Genuine shape-to-shape interpolation, with `copy=True` (leave the source in place) and `smoothing`/`smoothing_left`/`smoothing_right` controls. `core/src/transitions.ts:69` explicitly notes "true shape morphs come later" — this is that. Used ~15 times. |
| **`Fill` / `UnFill` as verbs** | Scene01, 02, 03, 04, 08_1, 11 | `core/src/render/fill.ts` has a `FillShape` renderer, but there is no `Fill(holon, transparency=…)` animator, and no `solid=True` construction flag on primitives. |
| **`ChangeColor`** | Scene01, 02, 03, 07_1, 08_1, 11 | Animated recolor of a holon (and of a whole group). Pervasive. |
| **Composite draw-then-fill verbs** | Scene01, 02, 03, 04, 07 | `DrawThenFillCompletely`, `UnFillThenUnDraw`, `UnDrawThenUnFill` — trivial compositions once `Fill` exists, but they are the actual grammar the source is written in. |
| **`rel_start_point` / `rel_end_point`** | ~20 call sites | Per-animator sub-windows within a `play()` block (start this at 2/3 through, end that at 1/30). This is the source's main tool for overlapping choreography; without it timings will be wrong everywhere. |

**Needed for specific scenes:**

| Missing | Needed by | Notes |
|---|---|---|
| **Camera as animation target** | Scene08_1, 08_2, 10 | `Transform(self.camera, x=…, y=…, z=…, p=…)` and, separately, `Transform(self.camera_group, p=…, h=…)` — moving the camera within the rig vs orbiting the rig. Scene08_1 is essentially a camera performance. |
| **`Arc(mode="ring", symmetrical=True)`** | Scene02, 04 | Annular sector primitive (a pie slice with a hole). Not in `parts/primitives.ts`. |
| **`NGon(n=…)`** | Scene06, 07_1 | Regular polygon primitive; needed for the triangle→circle morph chains. |
| **`Logo`** | Scene05, 06, 08, 08_2, 09 | The brand mark composite. Fully specified in §1/Scene05 — pure construction, no new capability. A natural `core/vocabulary/Logo/` entry. |
| **`System`** | Scene03 | Four gear+icon groups; pure composition over six SVGs. |
| **`Transform(..., parts=False)`** | Scene02 | Move a spline rigidly without re-smoothing its interior points. |
| **Textured plane / `Picture`** | Scene07 | The code snippet. Could be sidestepped by rendering real text, which would arguably be better. |

**Already covered by core** (no work needed): `Connection` bezier arrows with
arrowheads and `offset_start`/`offset_end` (`core/src/parts/curves.ts:456`),
`Text` with per-letter `Write` (`core/src/parts/text.ts:115`), **dotted
splines** — Scene01's separator — via `dashRuns` and the dotted-polyline
helper (`core/src/parts/primitives.ts:418,442`), `Cylinder`, `Circle`,
`Rectangle`, `Eye`, `Group`, `MoveAlong` (`parts/paths.ts:166`),
`polar2cartesian`-style layout.

## 6. Proposed chapter plan

Ordered by difficulty, so each chapter's new capability is available to the
next. The SVG importer is deliberately first — it is the gate on 12 scenes, and
it is the least ambiguous work in the list.

| Ch | Scenes | New capability | Why here |
|---|---|---|---|
| **O-1** | — | **SVG path→polyline importer** + asset pipeline | Pure infrastructure, no animation. Fully specified by §4, testable against `david.svg`'s 37 subpaths without rendering anything. Unblocks everything. |
| **O-2** | **Scene00** | `DrawSteady` + `stroke_order` | The video's first 13 seconds and its signature image. One object, one verb, one `Erase`. A clean, high-value first render. |
| **O-3** | **Scene05, Scene09** | `Logo` vocabulary entry | Pure construction over primitives core already has. Scene09 is `Create(logo, run_time=18)` and nothing else — the easiest scene in the video. Gives the brand mark to four later scenes. |
| **O-4** | **Scene02, Scene04** | `Arc(mode="ring")`, `Fill`/`UnFill`, `ChangeColor`, `DrawThenFillCompletely` | The two pie scenes are the same construction twice, so the second is nearly free. Introduces the fill-and-color grammar in a scene with no SVGs and no camera work. |
| **O-5** | **Scene03** | `System` composite | Six SVGs composed with the O-4 fill/color verbs. Tests the importer at scale (gears are dense) but adds no new animation concepts. |
| **O-6** | **Scene01, Scene11** | `Morph`, `rel_start_point`/`rel_end_point`, dotted splines | The thesis and its resolution — the two halves of the same construction, so build them together. The hardest verb (`Morph`, 6 simultaneous) meets the hardest timing (overlapping windows). This is the chapter that proves the grammar. |
| **O-7** | **Scene07, Scene07_1** | `NGon`, morph chains, raster-or-text panel | Polygon→circle convergence, plus the code panel (recommend rendering real text rather than reproducing the screenshot). |
| **O-8** | **Scene08, Scene08_2** | Labelled spoke layout; camera dolly (`self.camera`) | Introduces camera animation in the gentler of the two camera scenes — 08_2's flythrough is a pull-back along one axis. |
| **O-9** | **Scene10** | `self.camera_group` orbit | The rig-orbit-vs-camera-move distinction, with four SVG logos and a cylinder reveal. Short scene, one new concept. |
| **O-10** | **Scene08_1** | Full camera choreography over a generated lattice | Deliberately last: four chained camera transforms, a procedurally-wired 23-node lattice, per-node fills, and the scene most disturbed by the re-cut. Everything else must work first. |
| **O-11** | **Scene06** (+`06_1`) | Assembly | The 79s centerpiece reuses `Logo`, `Morph`, the repo chain (`NGon`), the octocat SVG, and the video-01 dialectic triad. By construction it needs *no new capability* — it is the integration test. Last because it is longest and depends on all of the above. |

**On fidelity targets**: chapters O-1 through O-6 can be compared frame-exactly
against `refs/pitch/origins/frames5/` using the §0 offsets, because the video's
first half matches the source timeline to within 0.4s. From Scene06 on, compare
against the **source's own choreography** (the `run_time`/`wait` calls) rather
than the video's re-cut, and treat the published video as a reference for
*appearance* rather than *timing*.

## 7. Assets and artifacts on disk

| Path | Contents |
|---|---|
| `refs/pitch/origins/Origins.mkv` | corpus #09, 720p VP9/opus, 377.9s, 9.4 MB |
| `refs/pitch/origins/frames5/f_00001..01889.jpg` | 5fps frames, 41 MB |
| `refs/pitch/svg-assets/svg/` | **the 32 recovered SVG assets**, 696 KB |
| `refs/pitch/pydeation-PL-pitch/` | the 2022 GitHub repo (not the source, §2) |
| `refs/pitch/Key2SVG/` | the empty stub (§3) |
| `refs/pitch/videos/PL02_ProjectLiminality.mkv` | corpus #02, 720p, 15:04, 30.8 MB |
| `refs/pitch/videos/PL03_Custodian.mkv` | corpus #03, 720p, 25:48, 34.5 MB |
| `refs/pitch/videos/PL05_AgeOfMiracles.mkv` | corpus #05, 720p, 46:28, 108.2 MB |
| `refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py` | **the source** (pre-existing, not fetched by this session) |
| `refs/PydeationProjects/pitch/InterfaceGuy/pitch/Scene00/tex/pitch_audio_final.mp3` | the 429.7s narration track |

Frames were **not** extracted for #02/#03/#05 per the campaign brief. Disk after
downloads: 89 GB free.

## 8. Video URLs

| # | Title | URL |
|---|---|---|
| 02 | Project Liminality | https://www.youtube.com/watch?v=YsDNeH9JVV0 |
| 03 | The Custodian of the Noosphere | https://www.youtube.com/watch?v=125ihqgmicY |
| 05 | The Age of Miracles | https://www.youtube.com/watch?v=yrgSwgqclJU |
| 09 | The Origins of Project Liminality | https://www.youtube.com/watch?v=cmbjQVQ3nbs |


## Amendments (2026-09-07, O-3)

- §1 Scene05/Logo: the small circle's z is 72 (= 200−122−6) and the
  focal height 85.42 (= 72 + 0.11·122) — the source's own arithmetic;
  the report's 72.2/85.6 were frame-measurement roundings.
- §0: **Scene09 was NOT re-timed** — its 18s draw plays at full source
  length in the published video; the editor only moved where it sits
  (measured window fractions match the source's own to a threshold
  offset). The re-cut affects placement, not pace, for this scene.
