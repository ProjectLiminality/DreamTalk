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
| `p1-f_04510-composite.png` | the whole frame including type, FAIL 0.848/0.902 |
| `p1-f_04510-report.json` | its metrics |
| `ours-p1-f_04510.png` | the render itself |

The whole-frame FAIL is the FONT, and only the font — see §4.

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
contributes nothing, and since groups carry no transform (see below) an
unrecorded empty group changes no geometry.

The build count needs its own section, because it is not a discrepancy in
counting.

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
size, PostScript face name, bold/italic, colour. Per slide: builds
(target, effect, type, duration, delay, delivery, acceleration) and the
transition (effect, duration, delay, timing curve, fade-unmatched).

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
| whole frame | 0.848 | 0.902 | 1.034 px | 1.349 px | 0.579 | FAIL |

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

**The whole-frame FAIL is entirely the typeface, and it is P-2's
subject.** The word's baseline and cap height are right — the reference's
dense-glyph band runs rows 522…577 and ours runs 522…578 — but the
bundled **Arimo sets "Project Liminality" 580 px wide against
HelveticaNeue-Bold's 608, 4.6% narrower**. Same baseline, same cap
height, different widths. Nothing in the importer can fix that; the deck
declares `HelveticaNeue-Bold` and the renderer does not have it.

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
- `bun test` — **999 pass, 0 fail** (961 baseline + 38 new).
- S04 gauntlet — **6/6 PASS**, mean coverage ref 0.9946 / ours 0.9954.

## 8. What P-2 inherits

The importer is done and the geometry is exact. P-2's whole subject is
the remaining 4.6%: get HelveticaNeue (or a metrically compatible face)
into the renderer and the title card closes. Two things to carry:

1. **Do not use `core/vocabulary/Logo`.** The deck's mark is a hand
   redraw — small/main radius ratio **0.64902** against pydeation's 0.61,
   centre offset **0.34003·r** against 0.36. At title-card size that is
   six pixels of red-circle radius. A test guards the substitution.
2. The face is declared per text record (`fontName`), so a font map is a
   renderer-side lookup, not an importer change.
