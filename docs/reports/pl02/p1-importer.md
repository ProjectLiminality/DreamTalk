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

**Since first writing, eight corrections have landed in §1**, all of them
to this importer's own claims and all caught by teammates whose chapters
exercised what P-1's single-slide gate did not: group children are
relative (P-2); build order, `direction` and the firing model; motion
paths and the dotted-line cap; the images, which ARE load-bearing; and
stale connection-line paths (P-3). Every one is fixed and guarded by
tests. §1 also corrects the recon report on three counts of its own, and
retracts one of my own corrections to it — see the firing model, which is
open rather than settled.

## 1. What survives keynote-parser, and what is dropped

The decode walks the show's own slide order and each slide's own
`drawablesZOrder`. Across **deck slides 1–59** (see the scope correction
below) it yields **1,804 shapes, 91 text records, 578 groups, 418 builds,
489 connection lines and 59 transitions**. **Nothing is dropped any
more** — the only entries in `skipped` are one gradient fill and the
15 slides carrying the unverified arrow synthesis. Images were the last
skipped type and no longer are,
whose BOXES are kept even though their pixels cannot be. The recon
called these "none load-bearing"; that is wrong, and the correction below
matters for four segments.

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

### CORRECTION (P-3, second round): motion paths and the dash cap

**5. `apple:action-motion-path` builds now carry their declared path.**
P-3 found it scoring slide 3: the "Story" label (text 4516215) sits at
(1049.522, 485.569) in the deck, and the build declares a straight
(-1.388, -229.910) move that the importer was discarding — so the label
rendered 230 units low, inside an ellipse it should sit above, scoring
coverage_ref 0.328. 485.569 − 229.910 = 255.66 slide units is video row
170, against the reference's glyph band at rows 158–189.

Carried as a full `KeyPathElement[]` rather than a `{dx, dy}`, because a
translation is not general enough. **The counts differ by scope**, and
P-7 was right to flag it — a chapter reading the deck-wide figure looks
for two curves and finds one:

| scope | motion paths | genuinely curved |
|---|---|---|
| whole 83-slide file | 34 | 2 |
| **in scope (slides 1-58)** | **19** | **1** |

The single in-scope curve is build 5602009 on deck slide 56 — 3.0s, two
cubic segments, travel (-284.4, -171.0). The straight ones arrive as degenerate curves whose
controls sit on their endpoints, so `flattenElements` serves both and
there is no special case. The motion itself is P-7's; the importer's job
was only to stop throwing the geometry away.

**6. The dotted-line period: RoundCap, settled from the file.** P-3
measured our dot period 33% short (14 dots where the reference draws 10)
and correctly declined to fit a constant to one good corridor. It did not
need fitting — the answer is stated in the stylesheet, and the importer
was dropping the field that carries it.

Counting every dashed stroke style in the deck gives a **perfect split**:
every `(0.001, 2.0)` dotted pattern is **`RoundCap`**, and every other
dash pattern — `(6, 6)` and `(1, 1)` — is `ButtCap`. The 0.001 dash is
the tell: a deliberate zero meaning "paint nothing but the cap", which is
only visible at all under a round cap.

That makes the period derivable. A round cap paints a half-disc past each
end, so a dash of length d occupies d + w:

| | period at w = 7.333 px | vs P-3's measured 21.9 px |
|---|---|---|
| butt, `(dash + gap)·w` | 14.674 px | 33% short |
| **round, `(dash + gap + 1)·w`** | **22.007 px** | **0.5%** |

And it converts our 14 dots over the eagle corridor to 9.33 against the
reference's 10. Three independent confirmations of one value read from
the file rather than fitted to pixels. `SlideShapeData.cap` is now
emitted alongside `dash`; the consumer change is in `Slides.ts`'s
`composeShape`, which P-3 owns.

### CORRECTION (P-3, third round): the images ARE load-bearing

§1 above records `TSD.ImageArchive` as the one skipped type and repeats
the recon's judgement that the deck's images are "none load-bearing"
(report §5: "image/photo support — explicitly NOT needed; 29 images in
the whole deck, none load-bearing in slides 1-58"). **I took that on the
recon's authority and it is wrong.** P-3 measured it: on slide 2 the five
images are **46.9% of that frame's reference ink**, and they are why that
segment's `coverage_ref` sits at 0.49 no matter what the vector
reproduction does.

The exact scope, counted from the archives: **31 images in the file, 12
of them inside slides 1-58**, on four slides —

| deck slide | images | what |
|---|---|---|
| 2 | 5 | the Vitruvian figure (481×481 slide units) + four lightning glyphs |
| 3 | 1 | 481×481 |
| 17 | 4 | the broadcast-tower set piece |
| 18 | 2 | the mass-hypnosis slide |

So the largest single drawable on the video's opening tableau is an
image, and slides 2, 3, 17 and 18 have a **hard ceiling on `coverage_ref`**
that no amount of vector fidelity can lift. That is not an importer bug
— an image is a raster and this framework draws strokes — but it is a
scoring fact every chapter touching those four slides needs, and
"explicitly NOT needed" is the wrong summary of it.

**What the pixels actually are** (found while closing P-3): the deck's
`Data/Man-10520.png` (the Vitruvian figure) and `lightning-11152.png` are
**white line art on transparent alpha** — RGB exactly (255,255,255) with
zero channel variance, 7.5% and 14.3% opaque. Not photographs. Only
**four** of the 117 files in the deck's `Data/` directory are line art of
this kind, and the 12 in-scope images draw from a handful of them.

That reframes the eventual fix. This is `david.svg` again — the Origins
campaign's O-1 case, a traced drawing whose vector form lives outside the
file that uses it. So the answer is probably **not** "render a textured
quad": it is to trace or source those four assets as paths and import
them through `Sketch`, the doorway that already exists for precisely
this. That keeps the reproduction all-strokes and preserves draw-on,
which a quad could never do. Real work, but bounded work on four assets
rather than an open-ended raster pipeline.

The image BOXES are now carried in the model (`KeyImage`, on
`SlideData.images`) so a chapter can mask against the deck's declared
geometry without re-decoding the deck. The pixels are not: this framework
draws strokes, and an image is a raster.

P-3's handling is the right pattern and worth copying: score the whole
frame as the headline, and score again with the deck's **own declared
image boxes** masked, reporting both. Masking those five boxes on slide 2
moves it from 0.4909/0.8725 to 0.9092/0.9244 (PASS); masking the dotted
lines too, leaving just the four icons the builds actually target, gives
0.9664/1.0000 with a 0.001 px chamfer. Stating the mask as the deck's
declared geometry rather than a hand-drawn crop is what keeps that
honest.

Whether the images should eventually be imported (they are stored in the
unpacked `Data/` directory and could be textured quads) is a real
question for P-9, which owns slide 17. It is not one P-1 should have
foreclosed by quoting the recon.

### CORRECTION (P-3, fourth round): connection-line paths can be STALE

**7. `connectedFrom` / `connectedTo` are now carried, and the survey P-3
asked for is done.** Keynote recomputes a `TSD.ConnectionLineArchive`'s
path from the two objects it joins, so a stored path can be a leftover
from wherever those objects used to sit — with no local sign anything is
wrong. P-3's example, slide 3's line 4515938: it joins the tree
(4515966) to the Vitruvian image (4515878), whose box centres both sit at
slide y 540 — video row 360, exactly where the reference draws a long
horizontal dotted line. Its stored path fits to (465, 727) → (743, 653),
a short lower-left diagonal the footage does not contain anywhere.

**The survey, across all 547 connection lines** — testing whether the
stored chord's axis aims at BOTH connected objects' centres (within 3
slide units):

| | count | |
|---|---|---|
| **FRESH** — aims at both centres | **352** | 64% |
| **STALE** — misses at least one | **135** | 25% |
| unresolvable — no `connectedFrom`/`connectedTo` | 60 | 11% |

**I first reported "15 stale, a handful", and that was wrong by 9x.** My
test measured distance from each endpoint to its object's BOX, which
scores a line fresh when EITHER end touches — and so passed the very
common half-right case. P-3 found it: slide 2's four dotted lines all aim
*exactly* at the Vitruvian image's centre (perpendicular deviation 0.0)
while three miss their OTHER endpoint by 47.6, 66.6 and 16.7 units. The
axis test above is the right instrument.

The footage settles it beyond the archives. Sampling the reference frame
along each candidate axis and counting samples landing on ink (f_00081,
2 px tolerance):

| line | stored path | centre-to-centre |
|---|---|---|
| sun (4514184) | **0%** | 41% |
| eagle (4514420) | **7%** | 57% |

For dotted lines ~50% is what a perfect match looks like, half the
samples falling in the gaps. P-3's independent fit of the eagle line's
584 ink pixels gives slope 0.5862 against the centre-to-centre 0.5866 and
the stored 0.6816, extrapolating to the image centre within **0.3 px**.

**So P-3's inversion is right: treat a stored connection-line path as
unreliable and recompute from the endpoints.** The rule, as far as it is
established: the line runs between the two connected drawables' CENTRES,
clipped to their boundaries — the visible dots begin outside each icon,
presumably what `outsetFrom`/`outsetTo` are for (both 0.0 throughout).
Attachment is not a fixed point on the box: slide 2's stored endpoints
sit at box fractions 1.425, 0.049, 3.604 and 0.042, which no single
attachment rule produces.

This lands squarely on **P-4** (connection meshes, 10-30 lines per slide,
70 on slide 11) — and it is now a design input rather than a discovery
waiting to happen there.

The endpoints are carried; the derivation is deliberately NOT performed
here. Where a line should run when its stored path disagrees — which
edge it attaches to, whether it routes around anything — is a rendering
decision belonging to P-4. Note the interaction that makes slide 3's case
doubly awkward: it connects to an IMAGE, whose pixels this importer does
not carry, so deriving that one needs `SlideData.images` too — which is
the second reason those boxes are kept.

### CORRECTION (P-4): outsets, line ends, routing type, and two data bugs

**9. `outsetFrom`/`outsetTo` are NOT 0.0 throughout — my claim, refuted.**
The `connects` note said "both 0.0 throughout this deck". I had checked
two slides and written "throughout". P-4 found they are per-line and
non-zero *exactly on the biggest meshes* — the worst place for a consumer
to have assumed zero on my say-so. In scope (slides 1-58, 467 lines): 303
are (0,0), 78 are (0,10), 74 are (10,10), 12 are (30,30). **164 of 467
carry a non-zero outset**; slide 8's are 30/30 and slide 11's 10/10, the
two densest meshes in the video. Now carried as `SlideShapeData.outset`.

**10. Arrowheads are carried**, resolved through the style chain — the
style archive lives in the GLOBAL `Index/DocumentStylesheet.iwa`, so it
is a document-wide id lookup, not a slide-file one. 124 in-scope
drawables carry an end decoration; slide 11 alone holds 70 of them, on
every one of its connection lines. Richer than a single convention: 123
heads, one tail, and across the whole file two `filled circle` rather
than `simple arrow`. The record passes through whole — P-4 measured the
drawn head at 9.66 x 4.67 half-width slide units, matching the path's 2.0
aspect, but could not pin the absolute scale from three samples, so the
data is here and the scale derivation belongs to the consumer.

**11. `connectionLinePathSource.type` is carried, and the quadratic is a
real curve.** P-4 proved Keynote renders the 3-point form as a quadratic
THROUGH the middle point, not as a 2-segment polyline — ink-hit rate
0.951 +/- 0.058 against 0.711 +/- 0.252 on slide 11's 70 solid strokes,
plus a control-polygon bounding argument on line 4107905. **That
supersedes the straight centre-to-centre rule** recorded under
Correction 8, which holds only as the degenerate collinear case.

One refinement to P-4's report: across the whole 83-slide file the deck
has 541 quadratic and **6 orthogonal** lines — but all six orthogonals
are out of scope, so within slides 1-58 every one of the 467 lines is
quadratic and P-4's "all quadratic" is right for the video. The field is
carried because the file is not uniform, not because the reproduction is.

**12. Two data bugs, both mine, both fixed.**

- *Slide 15 reported 0 connection lines where its archive holds 8.* The
  lines imported correctly all along; they were invisible because a
  consumer identifies connection lines by the presence of `connects`,
  and these eight declare no `connectedFrom`/`connectedTo` (27 in-scope
  lines are like this). Fixed by marking every connection line
  unconditionally with `isConnectionLine`, so identity no longer depends
  on a field that is legitimately absent.
- *Slide 18's recorded source named `Slide-4593439.iwa`, which does not
  exist* — my own hidden-slide gotcha, biting the provenance this time:
  the path was reconstructed from the id rather than taken from the file
  actually opened. Now `os.path.relpath` of the real path, and a test
  asserts every module's source resolves on disk.

### CORRECTION (P-7): the arrow synthesis is wrong, and `flags` is not flips

**13. `kTSDRightSingleArrow` does not synthesise correctly, and the
decoder now says so.** P-7 traced the seven out-of-arc
`action-motion-path` builds to one drawable (4475306) and found the
footage draws a **mouse pointer**, where my synthesis produces a
pentagon.

It is wrong for a structural reason, and for all 20 instances rather than
one. My reading takes `point.x` as the shaft thickness in natural units;
every instance in the deck has `point.x > naturalSize.height`, so
`t = min(px, h)/2` saturates at `h/2`, the shaft fills the full height,
and the shape collapses to a rectangle with a triangular bump — aspect
1.488. Isolating the glyph by differencing `f_03640` against `f_03635`
gives a narrow shaft with a solid triangular head, 18×25 video px. It is
neither the pentagon nor the rotated declared box (28.6×31.7).

So this is a Keynote built-in whose outline is not derivable from its two
parameters, and guessing further would be fitting. The synthesis is left
in place but **announced**: every affected slide now carries
`kTSDRightSingleArrow:synthesis-unverified` in `SlideData.skipped`, on 15
slides. Whoever needs these shapes should trace the silhouette from the
footage or find the shape library — the same answer as the images.

**14. `geometry.flags` is NOT a flip mask**, and P-7's reading of
`flags: 3` as "both flip bits set" is not the explanation for the cursor.
Keynote states flips on the PATH SOURCE (`horizontalFlip` /
`verticalFlip`), and **both are `false` on every drawable in the deck**.
`geometry.flags` is a validity mask: 3 on 2,743 drawables, 7 on 92, 0 on
89. `keydecode.py` overwrites the field with the real flip bits before it
reaches the model, so `fitToFrame` never mirrors anything — the pipeline
was correct and only my `KeyGeometry.flags` comment was misleading. Now
corrected, with the trap named.

### INVESTIGATED (P-8): deck 54's stacked tablets — the file does not know

P-8 found deck slide 54's seven "tablet" groups (5450290, 5451245,
5451291, 5451337, 5451383, 5451439, 5451499 — each a blue ring plus a
Cylinder_563 at angle 90) **all declared at one point**: group
(581.784, 359.175), cylinder (586.13, 362.46), byte-identical across all
seven. The footage draws them at seven spread positions matching deck
55's declared layout.

**This is not a dropped importer mechanism.** Checked and excluded:

- **group offsets** — all seven are TOP-LEVEL in `drawablesZOrder`;
- **motion paths** — their only builds are plain `apple:dissolve` In,
  with no `actionMotionPathSource` on any;
- **the transition** — deck 55's Magic Move stages matched objects, but
  cannot supply deck 54's own held layout;
- **a nested duplicate set** inside the big group 5447990 — there is
  none; these seven are the slide's only tablets;
- **decoder loss** — the RAW protobuf for 5450290 was read directly and
  matches the decode exactly, position included;
- **preserved unknown fields** — the `IgnoreAndPreserve` paths 1.12/1.13
  appear on ALL 24 of the slide's groups, not just these seven, so they
  are a generic per-group field, not a position;
- **a derivable relationship** — the seven displacements to deck 55's
  positions are all different and share no common offset.

**And yet Keynote's own slide thumbnail for deck 54 renders them
spread.** So Keynote knows a layout this file, as decoded, does not
state — most likely application state or a cache outside the slide
archive. The configuration is UNIQUE in the deck: scanning every slide
for three or more top-level drawables at one exact position finds only
this case. That, plus the thumbnail disagreeing with the geometry, reads
as an authoring artifact rather than a format feature.

So the importer reports what the file says, and **P-8's decision to score
deck 54 with the gap stated as a ceiling rather than moving geometry on a
guess is the correct one** — deriving the positions from deck 55 would be
fitting the reproduction to the answer. A test pins the archive's actual
content so the question is not silently re-opened, and so an invented-
position "fix" would fail loudly.

### CORRECTION (P-9): the in-scope range is deck 1..59, not 1..58

**15. The decoder's `[:58]` cutoff dropped the video's last content
slide, and the contradiction was mine.** This report established that
the recon's slide list omits the hidden slide 18 and is off by one from
there — and then left a cutoff written from that same list's "1-58".
Self-contradictory: if the recon's 58 rows map to deck positions with a
+1 shift from 18 on, the video's 58 content segments span **deck 1..59**.

Deck 59 (4853219) is the "Liminal Flow" set piece — 24 shapes, 22
connection lines, 34 builds — matching the recon's own row-58 census to
the build. Confirmed in the footage: `f_04460` (t = 891.8s) draws
Collective Intelligence, Syntropy and the "Liminal Flow" title.

One refinement to P-9's account. The video does **not** close on deck 60
or 61 — those are "Interaction Topology" bullet slides that appear
nowhere in it. `f_04490` (t = 897.8s) is **the title card mid-dissolve**:
the video closes by returning to deck 1, exactly as §1's original note
said. The recon's Viterbi assigns that segment to its own position 61
with a correlation of 0.114, which is noise.

**Every in-scope figure in this report was recounted, not adjusted.** The
ones that moved:

| | was (1-58) | now (1-59) |
|---|---|---|
| shapes | 1,750 | **1,792** |
| groups | 561 | **576** |
| builds | 384 | **418** |
| transitions | 58 | **59** |
| connection lines | 467 | **489** |
| lines with no endpoints | 27 | **31** |
| drawables with line ends | 124 | **142** |
| click-advanced chunks | 89 | **91** |
| builds with `eventTrigger: 1` | 320 | **354** |

Unchanged: 91 texts, 12 images, 164 non-zero outsets, 19 motion paths
with exactly one curved, zero orthogonal lines, zero per-character
deliveries.

The firing-model arithmetic survives the recount: **91 clicks + 59
transitions = 150** declared advances against 141 measured (was 147 vs
141), while `eventTrigger` gives 354 + 59 = 413 — still overshooting by
2.9x. Neither reading is settled, and the recount does not favour either.

### CORRECTION (P-9): images carry their OWN vectorization — `tracedPath`

**16. `TSD.ImageArchive.tracedPath` retires the trace-from-footage plan
entirely.** P-9 found that every image archive carries Keynote's own
instant-alpha vectorization, stored in the SAME typed
moveTo/lineTo/closeSubpath form as every bezierPathSource and stated in
the image's `naturalSize` design box. So it projects through the
identical shape fit, at the identical tolerance, and arrives as ordinary
strokes.

I had recorded (Correction 5) that the images are white line art and the
fix would be to trace or source those four assets as paths. **That was
unnecessary — the deck vectorized them itself.** What was going to be a
measurement is a reading, at the same standard as the title card: no
tracer, no rasteriser, no tolerance constant, no PNG to hash.

Verified: **all 31 image archives in the file carry a `tracedPath`**, and
the 12 in scope are served by exactly two assets — a 35-element lightning
glyph (10 instances) and the 2,239-element, 194-subpath Vitruvian figure
(2). That meets the "four line-art files in `Data/`" finding from the
other direction.

The result on slide 2, which was P-3's hard ceiling:

| | coverage_ref | coverage_ours | chamfer |
|---|---|---|---|
| before (images absent) | 0.4878 | 0.9143 | 0.924 / 7.029 |
| **after (traced)** | **0.9036** | 0.8100 | 1.465 / 0.719 |

The Vitruvian Man and all four lightning glyphs now render in place. This
retroactively lifts the deck 2 / 3 ceilings P-3 and I both recorded.

**One property a consumer must know.** An instant-alpha trace follows the
OUTER boundary of the drawn ink, not its centreline — it is the
silhouette of an opaque region, and a stroked line's silhouette is its
two outer edges. So a traced outline renders slightly LARGER than the
raster's line: the Vitruvian's outer circle measures 322 video px across
against the reference's 309, about 6.5 px per side, back-projecting to a
source stroke roughly 37 design px wide. That is inherent to what a trace
IS, not an importer defect, and the correction (inset by half the source
stroke, or render the trace thinner) is a rendering decision left to the
consumer. It is also why `coverage_ours` dips to 0.81 while
`coverage_ref` nearly doubles.

The image BOXES are still carried on `SlideData.images`, so anything that
masks against declared geometry today keeps working.

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
delay, delivery, acceleration, direction, eventTrigger, and a motion
path where one is declared), the build chunks that say when they fire,
and the transition (effect, duration, delay, timing curve,
fade-unmatched). Stroke `cap` rides alongside `dash`, because on a
dashed stroke it changes the period.

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
- `bun test` — **1167 pass, 1 fail** (961 baseline + 68 mine + teammates').
  The failure is `builds.test.ts`'s "slide 2's five image builds are
  named", which asserts those five build targets are UNRESOLVABLE. They
  now resolve, because `tracedPath` makes images drawables — so the test
  is correctly detecting that its own premise no longer holds. P-3's
  file; flagged rather than edited.
  The two `builds.test.ts` failures flagged earlier (P-4's `Connection`
  holon vs P-3's `DottedLine` expectations) have since been resolved.
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
4. **Treat a connection line's stored path as unreliable.** 135 of 547
   (25%) are stale; recompute from the carried endpoints. See §1's
   fourth P-3 correction.
5. **Groups translate; they do not scale or rotate.** Verified across all
   678. If a future slide looks scaled, suspect the fit rule or a stale
   group box before adding a scale term.
6. The face is declared per text record (`fontName`, `tracking`), so a
   font map is a renderer-side lookup, not an importer change.

**On the lesson.** The group bug shipped because P-1's gate — the title
card — has no groups, so a claim in the prose was never touched by a
test. The four group tests now exist for that reason, and the general
form of the lesson is worth stating: a gate that exercises one slide
validates the importer only for the features that slide happens to use.
P-4 (`Connection` meshes and groups at scale) is where the next such gap
would surface.
