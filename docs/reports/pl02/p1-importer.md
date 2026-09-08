# P-1 — the `.key` → holon importer

Chapter P-1 of the PL02 campaign: the infrastructure every other chapter
sits on. No animation, no new verbs — a frame change, a fit rule, and the
title slide proved against the footage.

**The gate is met.** The title card's vector geometry — two circles and
the Λ — scores `coverage_ref 1.000 / coverage_ours 1.000`,
`chamfer_ref 0.000 px`, `chamfer_ours 0.397 px` against
`refs/pitch/pl02/frames5/f_04510.jpg`. The composite shows pure yellow
everywhere: no red where the reference has ink we lack, no green where we
have ink it lacks.

| artifact | what |
|---|---|
| `p1-title-geom-composite.png` | the geometry overlay, PASS 1.000/1.000 |
| `p1-title-geom-report.json` | its metrics |
| `p1-f_04510-composite.png` | the whole frame at P-1, FAIL 0.848/0.902 (type not yet solved) |
| `p1-f_04510-report.json` | its metrics |
| `p1-title-after-p2-composite.png` | the whole frame after P-2's type, **PASS 0.9986/0.9757** |
| `p1-title-after-p2-report.json` | its metrics |
| `ours-p1-f_04510.png` | the render itself |

The P-1 whole-frame FAIL was the FONT and only the font; P-2 has since
closed it and the title card now passes whole-frame. See §4.

**Since first writing, three corrections have landed in §1** — two of them
to this importer's own claims, caught by teammates whose chapters
exercised what P-1's single-slide gate did not: group children are
relative (P-2), and build order, `direction` and the firing model (P-3).
Both are fixed and guarded by tests. §1 also corrects the recon report on
three counts of its own.

## 1. What survives keynote-parser, and what is dropped

The decode walks the show's own slide order and each slide's own
`drawablesZOrder`. Across slides 1–58 it yields **1,750 shapes, 91 text
records, 561 groups, 384 builds and 58 transitions**, and skips exactly
one archive type: `TSD.ImageArchive`, on four slides (the images the
recon found, none load-bearing).

Shapes run *above* the report's 1,378 because connection lines (517 in
the deck) arrive as ordinary shapes here rather than as a separate
column. Groups run below its 676 because the importer records only groups
whose members actually reached the drawable list; a group of images
contributes nothing.

### CORRECTION (P-2): group children are RELATIVE, not absolute

This section originally claimed "Keynote stores group children in
absolute canvas coordinates, so a group carries identity but no
transform, and recording the member list is lossless". **That was
wrong.** P-1's gate never exercised it — the title slide has no groups —
and P-2 caught it on slide 32, where the whole tableau collapsed toward
the canvas origin (coverage 0.29/0.28, chamfer ~10 px).

Children are stored **relative to their enclosing group, and groups
nest**, so the offsets compose down the chain. The landmark: slide 32's
"InterLogos" text box has geometry (118.41, 121.54) inside group 5688069
at (841.59, 773.70); the sum **(960.00, 895.24)** is horizontally dead
centre on the 1920 canvas, which is where frame `f_02826` draws it.

The transform is a **pure translation**, and that is verified rather than
assumed. Across all 678 groups in the deck: not one carries a nonzero
angle, and every apparent group-box/child-extent mismatch (176 after
accounting for rotation) is either a rotated child — whose axis-aligned
box does not bound its own ink — or a stale group box that does not
tightly bound its children. Group 4524553's box is 51.13×18.75 and its
child 4524569 is *exactly* 51.13×18.75 at (0,0), with two siblings
overflowing; group 4095005's 8.9-unit "excess" is entirely its two
67°/113° rotated Logo legs. Every child sits at its natural size, so
there is no scale, and deriving one from the box ratio would move
geometry that is currently correct.

`keydecode.py`'s `walk()` now accumulates the chain and lifts each
drawable onto the canvas once, before anything downstream sees it — so
the fit, the frame change and the emitted modules all work in plain
canvas coordinates and no consumer needs to know groups existed.
`slide01.ts` regenerates byte-identical, confirming the fix is scoped to
grouped drawables. Four tests guard it, including the InterLogos
landmark and a "nothing stranded at the canvas corner" check that is the
bug's exact signature.

### CORRECTION (P-3): build order, direction, and the firing model

Three fixes, prompted by P-3 with footage evidence:

**1. The sort was a bug.** `builds_of()` sorted by `(target, effect)`,
defensively, to keep the determinism test safe from unstable archive
iteration. The defence was unnecessary — decoding the same `.iwa` three
times yields identical archive order — and it destroyed the deck's build
sequence. Builds now arrive in the order the slide's own
`KN.SlideArchive.builds` list states, which is the format's declaration
rather than the importer's observation.

**2. `direction` is now carried, uninterpreted.** LineDrawForLine draws
the stroke on from one END, and the stored point order does not predict
which: P-3 measured slide 2's four connection lines in the footage and
found all four draw centre-outward, two of them *against* their stored
order (dir 52) and one with it (dir 51). The field is what disambiguates.

Worth knowing before generalising from slide 2, which is unrepresentative:
`direction` appears on only **5 of the 58 slides** and is **absent on 114
of the 158 LineDrawForLine builds**, so absence is the default. Three
values occur — 51 once, 52 twenty-eight times, 53 fifteen times — and deck
slide 9 uses 53 for all fifteen of its builds. It is emitted raw; naming
what 51/52/53 mean in general from four measured samples would be a
guess, so a consumer that needs a rule states its own reading.

**3. `buildChunks` is now carried — and the firing model is NOT settled.**
I first reported the chunk's `automatic` flag as the answer, and P-3's
footage refuted it within the hour. The honest state:

The recon report's §0 mechanism is definitely wrong. It cites
`isAutomatic` on the build's `animationAttributes` — a field absent
throughout, so its absence says nothing — and concludes every advance is
a click. Two other fields carry real, varying information it did not use,
and **neither one predicts the footage on its own**:

| reading | deck-wide arithmetic | slide 2 locally |
|---|---|---|
| chunk `automatic` (89 false / 295 true) | 89 + 58 transitions = **147** vs 141 measured — within 4% | **fails**: 1 click means all 13 builds fire as one cascade; P-3 measured 7 events |
| build `eventTrigger` (320 of 384 are 1) | 320 + 58 = **378** vs 141 — overshoots 2.7× | **fits**: all 13 are `1`, consistent with separated firings |

The two disagree on 330 chunks, so they are not two spellings of one
fact. Resolving it needs the footage, not the archives — counting
measured onsets *within* segments against each prediction, across enough
slides to separate them. That belongs to P-3/P-9. **Both fields are
carried uninterpreted** (`automatic` on the chunk, `eventTrigger` on the
build) and a test pins that they disagree, so no later reader mistakes
either for settled.

Two things that *are* settled. Chunk order is the deck's own firing
order and differs from the builds-list order — on slide 2 the chunks
interleave each line with the dissolve of the icon it reaches, which the
builds list does not; neither is sorted. And the chunk adds no timing:
its `duration` agrees with its build's `animationAttributes.duration` in
all 384 cases.

**4. `delivery` (P-3's finding): no build in the video cascades per
character.** All 384 builds across slides 1–58 are `All at Once`,
including all 121 `apple:dissolve character` ones. P-3 confirmed it in
the footage rather than only in the file — slide 2's four `dissolve
character` builds all target *shapes*, and each fades as one piece
(luminance over the icon's own ink mask rising 0.00→1.00 across
t=4.0–5.4 with no spatial fill-in). So `dissolve` and `dissolve
character` compile to the same uniform opacity ramp, and the recon
report's expected `DissolveCharacters` sibling to `Write` (§5, "222
builds") **is not owed to any chapter**, not just the opening arc. The
effect name does not imply a cascade; `delivery` does, and here it never
says so.

### The recon's slide list is off by one from slide 18 onward

**This is the most consequential thing P-1 found, and it is not a
counting quibble.**

`Slide.iwa` (§1's gotcha) also caught the recon — and it caught it in a
way that was invisible, because the missing slide is missing for a
*reason*. Slide `4593439` carries **no thumbnail** in its archive, so the
recon's thumbnail scan never saw it. Its `analysis/slidefull.json`,
`analysis/slides2.json` and `analysis/segments.json` therefore list 83
slides that exclude it, and from show position 18 onward every slide
index names the deck slide AFTER the one it means. Verified element for
element: `recon[17:57] == mine[18:58]`.

Consequences downstream chapters must carry:

- **The segment table's "Slide" column is the deck's slide only up to
  17. From 18 on, add one.** The report's slide 42 ("Liminal Space, 105
  shapes, 31 groups") is the deck's slide 43 — which is exactly the
  103-shape, 31-group slide the importer finds at index 43. Every
  chapter row in §6 of the recon report needs the same shift.
- **Segment 17 is TWO slides, not one.** The report's "longest segment,
  82.6s, tower→audience→mass-hypnosis/psychosis" is deck slides 17 AND
  18. Slide 17 has no text at all; the strings **"mass-hypnosis"** and
  **"mass-psychosis "** (note the trailing space, which is in the deck)
  live on slide 18, along with 46 shapes, a 1.5s FadeThruColor
  transition and 5 builds (2 `dissolve`, 3 `dissolve character`). The
  Viterbi could not place slide 18 because it had no template to match,
  so those frames were absorbed into slide 17's hold. **Chapter P-9,
  which owns this set piece, must expect a transition inside what the
  report calls one segment**, and its 82.6 seconds split at a boundary
  the recon did not locate.
- **"413 builds across the 58 slides" counts deck slides 1–17 and
  19–59** — excluding slide 18's 5, including slide 59 which is out of
  scope under the canon policy. The correct figure for slides 1–58 is
  **384**.
- Per-slide build counts are otherwise exact: every slide the two lists
  share agrees to the build, including slide 11's 105 and slide 16's 50.
  The decode is faithful; only the indexing was wrong.

What is NOT affected: the segment *timings*. Those were measured from the
footage and the 59-segment tiling still covers the full 903.4s. What
moves is the label on each segment, and the fact that one label covers
two slides.

Five path-source kinds appear, all handled:

| source | count | how |
|---|---|---|
| `bezierPathSource` | 874 | typed elements, straight through |
| `bezierPathSource` + `localizationKey` | 700 | ditto; the key names the built-in icon |
| `scalarPathSource` | 46 | `kTSDRegularPolygon`, `kTSDRoundedRectangle` — constructed |
| `pointPathSource` | 24 | `kTSDStar`, `kTSDRightSingleArrow`, `kTSDDoubleArrow` — constructed |
| `editableBezierPathSource` | 6 | node list with in/out handles → curveTo records |

`TSD.ConnectionLineArchive` nests its elements one level deeper
(`connectionLinePathSource.super.path`) but is otherwise a path like any
other, so the 517 connection lines arrive as ordinary shapes.

Per shape the model keeps: id, `localizationKey`, flattened subpaths with
closed flags, resolved stroke (colour, width, dash pattern, cap, join),
resolved flat fill, opacity, and the geometry box. Per text: content,
box, horizontal and vertical alignment, padding, line spacing, point
size, PostScript face name, bold/italic, colour, tracking. Per slide:
builds in the deck's own order (id, target, effect, type, duration,
delay, delivery, acceleration, direction), the build chunks that say when
they fire, and the transition (effect, duration, delay, timing curve,
fade-unmatched).

**Dropped, and named in each module's header:** gradient fills (no slide
in 1–58 depends on one), images, and Keynote's shadow/reflection
properties. Groups are flattened to MEMBERSHIP rather than kept as
containers — Keynote stores group children in absolute canvas
coordinates, so a group carries identity but no transform, and recording
the member list is lossless and simpler than nesting.

**One archive-layout gotcha, which cost an hour:** slide 18 (id
`4593439`) lives in an unsuffixed `Slide.iwa`, not `Slide-4593439.iwa`.
A filename-parsing file map silently yields 57 slides and shifts every
index from 18 on. The decoder now builds its map by opening candidates.

## 2. The frame mapping

The deck is authored on a **1920×1080 y-DOWN canvas, origin top-left**.
The recording is 1280×720. 1920/1280 = 1080/720 = **3/2 exactly**, so the
canvas maps onto the frame with no letterbox and no crop, and one slide
unit is 2/3 of a video pixel. That is the whole derivation, and it is why
the recon's sub-pixel identification worked: r = 229.5884 slide units →
229.5884 × 2/3 = 153.0589 px, and the footage measures 153.06.

Into world units: `slideToWorld(frameHeight) = frameHeight / 1080`, plus
a move of the origin from the canvas corner to its centre and a **y
negation** (the same flip `svg.ts` performs, for the same reason). With
the framework's 36mm rig at its 1000-unit distance the visible height is
2·1000·tan(31.417°/2) = 562.4987, so a slide unit is 0.5208 world units
and the title circle's 229.5884 becomes 119.577 — rendering back to
153.06 px at 720p, closing the loop. `Slide.height` defaults to exactly
that visible height, so a slide dropped into a scene that has called
`observer.look(…)` fills the frame the way the projector did.

### The fit rule — the format's one non-obvious act

Not documented anywhere; established by measurement here. A Keynote shape
stores its path in its own design box at whatever scale the shape library
authored it in — 0…100 for the built-in circle, **0…400 for the icon
library**, 1:1 for a text box, 0…141.42 for a straight line. The rendered
shape is that path's **flattened CURVE bounding box** mapped onto
`[position, position + size]`, then rotated by `angle` about the box's
centre.

The curve box, not the control box. Four icons on slide 2:

| icon | curve-box aspect | `size` aspect | control-box aspect |
|---|---|---|---|
| Tree_70 | 0.7958 | 0.7958 | 0.7983 |
| Eagle In Flight_839 | 1.0004 | 1.0004 | 1.0265 |
| Sunburst_304 | 1.0000 | 1.0000 | 1.0000 |
| Apple_141 | 0.8788 | 0.8788 | **1.0404** |

Apple settles it: its control box is 18% off its size aspect, its curve
box agrees to four decimals. So the importer flattens FIRST and fits
SECOND, and the flattening tolerance is stated on the CANVAS (0.25 slide
units = 1/6 of a video pixel) and converted into each design box's own
units — otherwise a 460-unit circle and a 90-unit apple would be
flattened to wildly different fidelities.

## 3. A correction to the recon report's palette

Report §1 says "blue ≈ #00A1FF and red ≈ #EE220C — the deck's stylesheet
carries exactly those two, and they are pydeation's BLUE/RED." Reading
the stylesheet directly says otherwise. Counting stroke colours across
its 109 shape styles: white 46, black 16, **#00A2FF 12**, **#FF644E 10**,
and one each of #61D835, #EE220C, #53585F, #FAE232.

- The blue is **#00A2FF**. The float is 0.6336032 → 161.57/255 → 162.
  The encode's #00A1FF is a rounding of it.
- The body red is **#FF644E**, used ten times including on the title
  card. **#EE220C appears exactly once in the whole deck** — an outlier,
  not the palette.

The report's *conclusion* survives more cleanly than its numbers did:
#00A2FF and #FF644E are `constants.ts`'s `BLUE` and `RED` **to the
byte** — pydeation's own constants. The deck and the 2021 corpus share a
palette exactly, so a reproduction carries one blue and one red, not two
of each. Pinned by test.

## 4. The title-slide overlay

Rendered at a true 1280×720 with the live readout hidden (a 1280×760
window would letterbox and the resize to 720 would squash the geometry by
5% — six pixels of circle radius, larger than the thing being measured).

| | coverage_ref | coverage_ours | chamfer_ours | chamfer_ref | IoU | verdict |
|---|---|---|---|---|---|---|
| **geometry only** | **1.000** | **1.000** | **0.397 px** | **0.000 px** | 0.754 | **PASS** |
| whole frame, at P-1 | 0.848 | 0.902 | 1.034 px | 1.349 px | 0.579 | FAIL |
| **whole frame, after P-2** | **0.9986** | **0.9757** | **0.474 px** | **0.109 px** | 0.751 | **PASS** |

The third row is P-2's work landing on top of this importer: HelveticaNeue-Bold
extracted from the system `.ttc`, plus the deck's `tracking: -0.02`. The
geometry row is unchanged by it, which is the point — the type was the
only thing between P-1's importer and a whole-frame pass.

Landmark measurements against `f_04510`:

| | reference | ours |
|---|---|---|
| blue circle radius | 153.50 px | 154.50 px |
| blue circle centre x | 639.50 | 639.50 |
| red circle radius | 99.50 px | 100.50 px |
| red circle centre x | 639.50 | 639.50 |

The one-pixel radius excess on each is the stroke's own half-width, not a
placement error — the chamfer of 0.000 px from every reference line pixel
to ours says the centre lines are coincident.

**The whole-frame FAIL was entirely the typeface, and P-2 has since
closed it.** At P-1 the word's baseline and cap height were right — the
reference's dense-glyph band runs rows 522…577 and ours ran 522…578 —
but the bundled **Arimo set "Project Liminality" 580 px wide against
HelveticaNeue-Bold's 608**. Nothing in the importer could fix that; the
deck declares `HelveticaNeue-Bold` and the renderer did not have it.

P-2 loaded the real face and then found the remaining 5% was the deck's
**tracking of −0.02 em**, which this decoder was dropping. It is now
carried on `KeyText.tracking` (optional, additive). Worth knowing: across
the whole stylesheet **exactly one style carries a nonzero tracking** —
the 116-pt title — and every other is 0.0, so it can perturb no other
chapter's geometry. Pinned by test.

### The vertical placement, which is a conversion and not a fit

Keynote lays text in a box with a vertical alignment; core's `Text`
anchors on the BASELINE (render/text.ts). The title's box is
`kFrameAlignBottom` — the initial guess of `middle` put the word 100 px
high — so:

```
baseline = boxBottom − padding − descent
         = 529.496 + 366 − 4 − 0.212·116
         = 866.9 slide units = 577.9 video px
```

against a measured 577. The two numbers used are the face's own published
metrics (cap height 0.714 em, descent 0.212 em); the footage *confirms*
them rather than supplying them — 0.714 em at 116 units predicts a
55.2 px cap height and the reference measures 55. That is the difference
between a derivation and a fit, and it is why `textBaseline` lives in the
model layer with the metrics named.

## 5. The codegen size decision

`--all` emits all 58 slides as **1,825 KB** of TypeScript — inside a 2 MB
budget, so nothing forces a partial emission. The default is nevertheless
the chapter set (**154 KB**: slides 1–6 for P-2/P-3 plus deck slide 19),
and the reason is editorial: slide 11 (the density peak — 210 shapes, 105
groups, 105 builds) and slide 17 (172 shapes, 102 connection lines) are a
large fraction of that 1.8 MB and are not read before chapters P-9 and
P-10. Each later chapter runs `bun core/scripts/key2ts.ts --slides N` for
what it opens.

The pipeline splits at the language boundary and only there:

```
.key/Index/*.iwa
   --[core/scripts/keydecode.py, keynote-parser]-->  keyslides.json  (9 MB, gitignored under refs/)
   --[core/scripts/key2ts.ts + core/src/geometry/keynote.ts]-->  core/vocabulary/Slides/assets/pl02/*.ts
```

The Python half decodes only — archives, style-inheritance chains, typed
path elements untouched. Every geometric act is TypeScript, where the
tests reach it. Same division `svg2ts.ts` keeps with `svg.ts`, and the
reason a bug in the fit rule is a unit test rather than a re-decode.

Emission is deterministic (pinned by test: re-running reproduces the
module byte for byte) and each module's header records the source archive
path and its SHA-256.

## 6. Files

| path | what |
|---|---|
| `core/src/geometry/keynote.ts` | the model layer: frame, flattening, fit, text metrics, palette |
| `core/scripts/keydecode.py` | the decode half (keynote-parser) |
| `core/scripts/key2ts.ts` | the codegen |
| `core/vocabulary/Slides/Slides.ts` | the `Slide` holon |
| `core/vocabulary/Slides/assets/pl02/` | 7 generated modules + index |
| `core/demo/pl02/TitleSlide.ts` | the demo scene, registered as `slide` |
| `core/scripts/pl02-gauntlet.ts` | per-segment fidelity harness |
| `core/test/keynote.test.ts` | 38 tests |

One change outside my area: `flattenCubic` is now exported from
`core/src/geometry/svg.ts` (one word) so the Keynote flattener reuses the
same de Casteljau rather than duplicating it.

## 7. Gates

- `bunx tsc --noEmit` — clean.
- `bun test` — **1042 pass, 0 fail** (961 baseline + 52 mine + teammates').
- S04 gauntlet — **6/6 PASS**, mean coverage ref 0.9946 / ours 0.9954.
- Title card — **1/1 PASS** whole-frame after the group fix and P-2's type.

The checked-in slide set is 1–6, 19 and 32 (`CHAPTER_SLIDES` in
`key2ts.ts`). **Keep that list in sync when a chapter emits a new
slide**: `--slides N` rewrites `index.ts` to hold exactly what that run
emitted, so running it alone drops the others from the barrel. Adding N
to `CHAPTER_SLIDES` and re-running bare puts the set back. Merging into
the existing barrel was rejected deliberately — it would make the
generated directory depend on what happened to be on disk.

## 8. What later chapters inherit

The importer is done, the geometry is exact, and P-2 has closed the type.
Carry forward:

1. **Do not use `core/vocabulary/Logo`.** The deck's mark is a hand
   redraw — small/main radius ratio **0.64902** against pydeation's 0.61,
   centre offset **0.34003·r** against 0.36. At title-card size that is
   six pixels of red-circle radius. A test guards the substitution.
2. **The recon's segment table is off by one from slide 18 on**, and its
   segment 17 is two slides. See §1's correction before scoping P-9.
3. **The firing model is open.** Two fields carry it and disagree; each
   fails a different test (§1's P-3 correction). Resolve it against
   measured onsets before building timing on either. No `DissolveCharacters`
   verb is owed — nothing in the video delivers per character.
4. **Groups translate; they do not scale or rotate.** Verified across all
   678. If a future slide looks scaled, suspect the fit rule or a stale
   group box before adding a scale term.
5. The face is declared per text record (`fontName`, `tracking`), so a
   font map is a renderer-side lookup, not an importer change.

**On the lesson.** The group bug shipped because P-1's gate — the title
card — has no groups, so a claim in the prose was never touched by a
test. The four group tests now exist for that reason, and the general
form of the lesson is worth stating: a gate that exercises one slide
validates the importer only for the features that slide happens to use.
P-4 (`Connection` meshes and groups at scale) is where the next such gap
would surface.
