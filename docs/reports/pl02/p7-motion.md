# P-7 — on-slide motion builds, at scale

Chapter P-7 of the PL02 campaign: `apple:action-motion-path` and its
siblings, implemented against the deck's own records and scored against
the footage's own measured onsets, on deck slides 45-53 (video
690.6-793.4s).

**The headline is that the deck's declared motion geometry reproduces
the footage without fitting anything but the offset.** The chapter's
seven motion builds all drive the same drawable — a mouse cursor
reaching out to click an app tile — and each declares the identical
translation. Tracking each cursor's centroid through its travel and
fitting only the onset against the deck's declared endpoints, duration
and ease gives residuals of **0.96 to 1.82 video pixels** on a 54.8-pixel
travel. Every segment passes, and so does every mid-build frame.

**The one real gap is not the motion, it is the OBJECT being moved.**
The deck stores the cursor as a parametric `kTSDRightSingleArrow` whose
stored parameters make the importer degenerate it into a pentagon, while
the footage draws a proper mouse-pointer glyph. Position, timing and ink
volume all agree; the silhouette does not. It is 0.5% of frame ink, so
the whole-frame scores are blind to it — §5 gives the honest masked
number instead of letting the headline hide it.

**A refinement to the settled firing model landed here**, because P-7's
slides are the first to put an INSTANT build in the predecessor slot.

## 1. What the chapter's slides actually declare

Not chosen — counted. Deck slides 33-38 and 45-53 carry 32 build records:

| effect | count | what it is |
|---|---|---|
| `apple:action-motion-path` | 7 | on-slide travel along a declared path |
| `apple:bc-appear` | 7 | an INSTANT appear (§4) |
| `apple:dissolve character` | 7 | uniform opacity ramp |
| `apple:dissolve` | 6 | the same ramp, other spelling |
| `com.apple.iWork.Keynote.LineDrawForLine` | 3 | spatial draw-on |
| `apple:appear` | 2 | the instant appear, other spelling |
| `apple:fade and move` | 1 | not implemented — §6 |

Deck slides 33, 35, 37 and 38 declare **zero** builds; they are held
tableaux reached by Magic Move, and they are not part of this chapter's
scene (which runs 45-53, where every one of the motion builds outside the
opening arc lives).

### The seven motion builds are one gesture, repeated

Every `action-motion-path` in the chapter drives a drawable with the
same geometry — 39.58762 x 26.596611 slide units, angle 120, black fill,
3.0 white stroke — and declares the **same translation**, (-43.896656,
-69.45765) slide units, which is 54.8 video pixels up and to the left.
Each is paired with a `bc-appear` on the same target, so the gesture is
always two beats: the cursor appears where the click begins, then glides.

That repetition is what makes the chapter scoreable. It is seven
independent measurements of one declared quantity, on seven different
slides at seven different screen positions, and they agree.

### `apple:action-scale`: NOT in this chapter, and the precedent holds

The brief asked for action-scale. **There are five in the deck and none
is on a P-7 slide** — they sit on deck slides 10, 17, 21 (x2) and 56.
So the refused-fits question the brief raised is inherited rather than
re-litigated, and P-4's verdict on deck slide 10 stands unchanged: the
build declares an effect, a duration and an easing **and no target
scale**, so scoring it would mean fitting an undeclared magnitude.

I did investigate whether the factor lives in a field the model drops,
since that was the specific question. It does not: the raw
`TSWP.ShapeInfoArchive` build records for all five carry
`actionMotionPathSource` where a motion path is declared and **no scale
analogue at all** — no `actionScaleSource`, no scale factor on the
build's attributes. The absence is in the archive, not in the decode.
The build class is emitted and reported by `Slide.unsupported()`; the
factor is genuinely not stated, and P-4's decision not to score it was
right.

## 2. The curved motion path — implemented, and honestly unexercised

P-3 implemented the straight case and named the boundary rather than
hiding it: `motionAnim` read the path's ENDPOINT and moved there, which
is exactly right for a two-node run whose controls sit on its ends, and
silently wrong for a path that bows away from its chord.

### The census, with a scope correction

P-1 recorded "34 motion paths, 32 straight, 2 curved". That is the whole
**83-slide file**. Within slides 1-58 — the canon policy's scope, since
59-83 appear nowhere in the video — there are **19 motion paths and
exactly ONE is curved**: build 5602009 on deck slide 56, 3.0s, two cubic
segments travelling (-284.409, -170.965) with real control points. The
second curved record is out of scope entirely.

This is a correction to the inherited figure's SCOPE, not its
arithmetic. It was routed to the lead during the chapter and **P-1 has
since landed it** — `p1-importer.md` and `KeyBuild.motionPath`'s own
comment now carry both scopes side by side, so a later chapter reading
either will not look for two curves and find one.

### It is out of this chapter's row, and it is implemented anyway

Deck 56 is not in P-7's slides, so **the footage never exercises this
code**. Per the brief, it is implemented against the data, tested
synthetically, and said plainly here. The record is real and the
geometry is declared; what is not available is a frame to score it
against.

The curve is worth honouring rather than approximating: it bows **27
slide units** off its own chord, which at this deck's scale is eighteen
video pixels — the straight branch would cut a visible corner.

### The implementation, and the non-obvious part

`curvedMotionAnim` flattens the path with `flattenElements` — svg.ts's
recursive de Casteljau, reached through keynote.ts, the same code the
shape importer uses, so a motion path and a drawn outline cannot drift
apart — then walks the polyline's cumulative chord length and inverts it
to sample **by arc length rather than by curve parameter**. A cubic's
parameter runs fast where its controls bunch, so stepping it uniformly
would make the target dawdle and lurch along a path whose declared
timing is uniform.

**The part that is not obvious, and that a well-meaning simplification
would break:** a `sequence` track is eased PER CONSECUTIVE PAIR of
waypoints, each over its own sub-span (`Timeline.valueAt`). So the
obvious implementation — flatten, hand the points to `sequence` —
produces N accelerate-decelerate cycles where the deck declares one.
Reconstructing the renderer's own lookup over five uniform waypoints
gives 0.032 / 0.092 / 0.158 / 0.218 / 0.250 across the first quarter,
where a single ease wants a smooth ramp: the velocity pulses at every
junction.

The waypoints are therefore placed to CANCEL that — waypoint k sits at
arc-length fraction `ease(k/N)`, and the renderer's per-pair easing
composes with that placement to reproduce the single declared ease.
Measured worst deviation from the desired curve:

| samples | placed (ours) | naive uniform |
|---|---|---|
| 4 | 0.0359 | 0.0900 |
| 8 | 0.0133 | 0.0795 |
| 16 | 0.0060 | 0.0765 |
| **32** | **0.0030** | 0.0744 |
| 64 | 0.0015 | 0.0733 |
| 128 | — | 0.0727 |

Ours converges as O(1/N); the naive version **plateaus at 0.073 forever**,
because its ripple is per pair and adding samples adds ripples. At the
chosen 32 samples the residual is 0.3% of the path — 0.6 slide units, or
0.4 video pixels, well under the 5 fps reference's own resolution — and
it costs 33 waypoints on one build in the whole deck.

Both numbers are pinned by tests (`test/motion.test.ts`), including one
that asserts the naive placement WOULD fail. If that test ever passes,
the renderer's easing has changed and the pre-compensation is no longer
needed — which is the thing worth being told about.

## 3. Onset verdicts — the timing gate

Every motion build, fitted against the deck's declared endpoints,
duration and ease-both curve, solving only for the offset (P-3's method:
the curve and its length are read, the offset is measured):

| deck | onset | rms | samples | travel |
|---|---|---|---|---|
| 36 | 602.880 | **1.31 px** | 5 | 54.8 px |
| 45 | 704.920 | **1.19 px** | 7 | 54.8 px |
| 46 | 719.135 | **1.39 px** | 7 | 54.8 px |
| 47 | 726.735 | **1.30 px** | 7 | 54.8 px |
| 48 | 731.180 | **1.39 px** | 7 | 54.8 px |
| 49 | 736.935 | **1.82 px** | 7 | 54.8 px |
| 52 | 761.875 | **0.96 px** | 7 | 54.8 px |

**Worst residual 1.82 px on a 54.8 px travel — 3.3%.** Nothing here is
fitted but the offset.

The declared endpoints agree with the footage independently of the fit.
Comparing the deck's stated start and end box centres against the
cursor's measured centroid at rest:

| deck | start Δ | end Δ |
|---|---|---|
| 36 | (-0.7, -0.6) | — |
| 45 | (-0.1, +0.2) | (+0.7, +1.6) |
| 46 | (+0.1, +0.4) | (-0.0, +1.7) |
| 47 | (-0.0, +0.4) | (+0.7, +1.8) |
| 48 | (+0.4, +1.2) | (+0.6, +1.6) |
| 49 | (-0.1, +0.5) | (+0.4, +2.6) |
| 52 | (-1.0, -1.1) | (+0.1, +0.9) |

Fourteen independent agreements within 2.6 px, most within one. The
small positive y bias at the ends is the glyph mismatch of §5, not a
placement error: our pentagon's centroid sits slightly differently in
its own box than the reference's pointer does in hers.

### One measurement trap, recorded because I fell into it

Deck 36's first fit gave 6.97 px rms and I nearly wrote it up as the
chapter's one poor case. **The window was wrong, not the data.** I had
read the cursor's travel off a change scan that was picking up a lotus
tile fading in over the same pixels; scanning a box BELOW the tile,
where only the cursor can be, put the travel at 603.0-603.8 rather than
605.0-605.8. Refitted there it lands at **1.31 px**, in line with the
other six.

The same lesson P-3 recorded ("a motion scan finds WHERE something
changed, not WHAT changed") with a second edge on it: when two things
move over one another, the box that isolates one of them is the
measurement, and a scan cannot choose it for you.

## 4. The firing model needs one refinement, and the arrows are why

P-5 settled it: an `automatic: true` chunk fires one DECLARED DURATION
after its predecessor; `automatic: false` waits for a click. **P-7's
slides are the first to put an INSTANT build in the predecessor slot,
and there the literal rule over-predicts.**

Every arrow is the pair (`bc-appear`, `automatic: false`) then
(`action-motion-path`, `automatic: true`, duration 1.0) on the same
target. Read literally: the cursor appears, sits still for a full
second, then glides. At the reference's 5 fps that is five frames of a
stationary cursor. It does not happen. On the three arrows whose travel
is cleanly isolated from other ink:

| deck | first cursor ink | fitted motion onset | gap |
|---|---|---|---|
| 46 | 719.2 | 719.135 | **+0.065** |
| 47 | 726.8 | 726.735 | **+0.065** |
| 52 | 762.0 | 761.875 | **+0.125** |

Every gap is under one 0.2s frame interval: the cursor is already moving
in the first frame that shows it.

### `bc-appear` is a STEP, measured against its own declared 1.0s

The reconciliation is that `bc-appear` does not ramp. Peak luminance
over deck 47's cursor at its start position, against a clean earlier
frame:

| t | 726.4 | 726.6 | 726.8 | 727.0 |
|---|---|---|---|---|
| max | 25 | 25 | **255** | 255 |

A 1.0s ease-both ramp sampled every 0.2s would pass through roughly
0.03, 0.16, 0.50 and 0.84 of full alpha. Nothing between black and full
appears on any frame, on any of the three isolated arrows. Every one of
the nine `bc-appear` / `appear` records in the deck declares
`duration: 1.0`, and **the declared duration is not a ramp length**.

**The refinement**: the delay an automatic chunk waits is its
predecessor's EFFECTIVE duration, and an instant build's is zero. Every
case P-5 measured had a ramping predecessor, where effective and
declared duration coincide and the two readings are indistinguishable;
these are the first that separate them. Recorded as
`Builds.INSTANT_CONSUMES_NO_TIME` so a later chapter meeting another
instant effect finds it already named. **P-5's rule is not weakened** —
it is the same rule with the quantity it ranges over made explicit.

Implementing the step needed care the obvious version misses: a `.to()`
spans its whole window (`Timeline` reads it as `[previous, value]` and
interpolates), so stating one over a 1.0s build produces exactly the
fade the measurement rules out. The ramp is squeezed into the window's
first thousandth instead — not zero, because `Timeline.valueAt` returns
the END value for a zero-width span, which would make the target visible
from the clip's start rather than from its onset.

### A second exception to chunk-order-is-firing-order

Deck 53's chunk list runs `fade and move` (manual, 2.0s) then two
`LineDrawForLine` (automatic, 1.75s), which predicts the draws at
fade + 2.0. Measured on regions chosen so the two builds' ink does not
overlap — the fade's own box above y=390, the draws' below y=410 — the
draws start **first**:

| build | onset | rms |
|---|---|---|
| fade and move | 772.710 | 0.134 |
| line draws | **772.030** | 0.046 |

The draws lead by 0.68s where the chunk order says they should trail by
2.0s. P-5 recorded one measured exception already (deck 25 chunk 4);
this is a second. **Reported, not resolved** — two exceptions do not
name a rule, and forcing the declared order here would mean rendering a
frame known to be wrong. The scene uses the measured onsets.

## 5. Per-segment scores

Reference frames are chosen AFTER each segment's last event and before
its outgoing transition (P-2's slide-32 lesson). The gauntlet bar is
coverage ≥ 0.90 on BOTH and both chamfers ≤ 3.0 px.

| deck | frame | video s | cov_ref | cov_ours | chamfer | verdict |
|---|---|---|---|---|---|---|
| 45 | f_03521 | 704.0 | **1.0000** | 0.9948 | 0.146/0.118 | **PASS** |
| 46 | f_03591 | 718.0 | **1.0000** | 0.9958 | 0.085/0.092 | **PASS** |
| 47 | f_03626 | 725.0 | 0.9997 | 0.9957 | 0.091/0.102 | **PASS** |
| 48 | f_03661 | 732.0 | **1.0000** | 0.9948 | 0.095/0.095 | **PASS** |
| 49 | f_03686 | 737.0 | 0.9896 | 0.9950 | 0.102/0.249 | **PASS** |
| 50 | f_03716 | 743.0 | 0.9702 | 0.9956 | 0.129/0.548 | **PASS** |
| 51 | f_03741 | 748.0 | 0.9664 | 0.9949 | 0.167/0.577 | **PASS** |
| 52 | f_03811 | 762.0 | 0.9660 | 0.9944 | 0.172/0.578 | **PASS** |
| 53 | f_03941 | 788.0 | 0.9634 | 0.9899 | 0.193/0.583 | **PASS** |

**9/9 PASS**, every chamfer under 0.6 px.

### Mid-build frames — where a motion build's point lives

A settled frame cannot tell a correct motion from a correct endpoint:
both put the cursor in the same place once it stops. These are sampled
inside the travel.

| deck | frame | video s | cov_ref | cov_ours | chamfer | verdict |
|---|---|---|---|---|---|---|
| 45 | f_03526 | 705.0 | 0.9991 | 0.9938 | 0.156/0.125 | **PASS** |
| 45 | f_03527 | 705.2 | 0.9991 | 0.9938 | 0.156/0.125 | **PASS** |
| 45 | f_03528 | 705.4 | 0.9991 | 0.9939 | 0.155/0.125 | **PASS** |
| 46 | f_03597 | 719.2 | 0.9995 | 0.9951 | 0.091/0.097 | **PASS** |
| 46 | f_03598 | 719.4 | 0.9994 | 0.9950 | 0.092/0.098 | **PASS** |
| 46 | f_03599 | 719.6 | 0.9994 | 0.9951 | 0.091/0.097 | **PASS** |
| 47 | f_03635 | 726.8 | 0.9994 | 0.9950 | 0.099/0.102 | **PASS** |
| 47 | f_03636 | 727.0 | 0.9993 | 0.9951 | 0.098/0.103 | **PASS** |
| 47 | f_03637 | 727.2 | 0.9991 | 0.9951 | 0.098/0.103 | **PASS** |
| 48 | f_03657 | 731.2 | 0.9995 | 0.9949 | 0.094/0.097 | **PASS** |
| 48 | f_03658 | 731.4 | 0.9994 | 0.9947 | 0.095/0.097 | **PASS** |
| 48 | f_03659 | 731.6 | 0.9994 | 0.9949 | 0.094/0.097 | **PASS** |
| 48 | f_03660 | 731.8 | 0.9991 | 0.9943 | 0.097/0.098 | **PASS** |
| 49 | f_03687 | 737.2 | 0.9895 | 0.9951 | 0.101/0.250 | **PASS** |
| 52 | f_03812 | 762.2 | 0.9660 | 0.9942 | 0.173/0.578 | **PASS** |
| 52 | f_03813 | 762.4 | 0.9659 | 0.9942 | 0.173/0.579 | **PASS** |

**16/16 PASS.**

### The cursor tracked directly — the test that actually bites

The whole-frame numbers above cannot see the cursor: it is **0.5% of
frame ink** (≈230 px of ≈49,000). So each cursor was located in our own
render and in the reference by the same differencing, and their
centroids compared:

| deck | video s | reference | ours | Δ |
|---|---|---|---|---|
| 45 | 705.0 | (533.4, 452.0) | (533.3, 451.9) | (-0.1, -0.1) |
| 45 | 705.2 | (528.2, 443.9) | (527.7, 443.1) | (-0.5, -0.9) |
| 45 | 705.4 | (519.0, 429.3) | (520.4, 431.5) | (+1.4, +2.2) |
| 46 | 719.2 | (792.9, 425.2) | (792.8, 425.1) | (-0.1, -0.1) |
| 46 | 719.4 | (788.2, 417.8) | (787.4, 416.8) | (-0.8, -1.0) |
| 46 | 719.6 | (779.2, 403.8) | (780.5, 405.6) | (+1.3, +1.8) |
| 47 | 726.8 | (898.8, 476.9) | (898.9, 477.1) | (+0.1, +0.3) |
| 47 | 727.0 | (894.3, 469.9) | (893.0, 467.5) | (-1.3, -2.3) |
| 47 | 727.2 | (885.0, 455.0) | (886.4, 457.1) | (+1.4, +2.1) |
| 49 | 737.2 | (486.3, 473.1) | (485.6, 472.2) | (-0.8, -0.9) |
| 52 | 762.2 | (824.1, 363.3) | (823.6, 362.7) | (-0.5, -0.6) |
| 52 | 762.4 | (819.7, 356.5) | (820.1, 357.2) | (+0.5, +0.8) |

**Worst 2.3 px, most under 1 px, mid-glide.** This is the chapter's
strongest evidence: a settled frame cannot distinguish a correct path
from a correct endpoint, and these are sampled where the two readings
differ most.

**A trap worth recording**: my first run of this comparison showed a
uniform 6-10 px lead and I started hunting a phase error. The gauntlet
labels a frame by its INDEX (frame n is video second (n-1)/5), and I had
passed `@727.0` alongside frame 3635, which is 726.8 — I was comparing
our render at one time against the reference at another. Matched up, the
lead vanished. A second apparent 5 px offset on deck 48 was a comparison
box clipping the cursor's tail. Both were my measurement, not the code,
and both looked exactly like a real bug.

## 6. What is NOT this chapter's, with each residual named

**1. THE CURSOR IS THE WRONG GLYPH — the chapter's one real gap.**

The deck stores the cursor as
`pointPathSource {type: kTSDRightSingleArrow, point: {x: 29.159813, y: 0.30273533}, naturalSize: {39.58762, 26.596611}}`,
and `keydecode.py`'s `point_elements` computes the shaft half-thickness
as `min(px, h) / 2`. Here **px = 29.16 exceeds h = 26.60**, so the min
saturates, `t` becomes exactly `h/2`, the shaft fills the full height,
and the arrow degenerates into a 5-point pentagon.

The footage draws neither a pentagon nor a thin-shafted arrow. It draws
a **classic mouse pointer with a notched tail** — verified by dumping
the reference silhouette (f_03636 differenced against f_03626): a
slanted spike with a straight left edge and a two-prong tail notch. That
is not `kTSDRightSingleArrow` at any (px, py).

*A correction to my own fact request, made by the importer owner and
recorded here rather than quietly dropped:* I also reported that these
drawables carry `geometry.flags = 3`, "both flip bits set", and offered
it as a candidate cause. **That reading was wrong.** Keynote states
flips on the path source (`horizontalFlip` / `verticalFlip`) and uses
`geometry.flags` for something else — a validity mask, 3 on 2,743
drawables deck-wide. Both flips are false on every drawable in this
deck. The glyph mismatch measured above is unaffected; the cause I
speculated is not a cause.

Masked to the cursor's own box, the honest number:

| frame | ref ink | our ink | cov_ref | cov_ours | IoU |
|---|---|---|---|---|---|
| f_03636 | 227 px | 222 px | 0.264 | 0.270 | **0.154** |
| f_03598 | 223 px | 248 px | 0.327 | 0.294 | **0.183** |
| f_03812 | 398 px | 417 px | 0.475 | 0.453 | **0.302** |

The ink VOLUMES agree within a few percent while the overlap does not —
which is the signature of a shape mismatch rather than a size or timing
one, and it is P-3's "volume and position are independent" lesson
arriving as "volume and SHAPE are independent" too.

**This is an importer fact, not a build one**, and it is routed to the
lead with the measurements rather than worked around here. Reported
because a chapter whose whole subject is moving an object should say
when it is moving the wrong object, even at 0.5% of ink where every
headline score passes anyway.

**2. `apple:fade and move` is not implemented.** Deck 53's build 5444090.
It is a fade combined with a translation whose distance **the record does
not carry** — the same shape of gap as slide 10's action-scale, and the
same answer under the refused-fits rule. `Slide.unsupported()` reports
it; its target is lit by `cutIn` and deck 53's segment passes with that
stated.

**3. The `coverage_ref` slide from 1.0000 to 0.963 across decks 50-53** is
inherited, not this chapter's. It tracks the growing text load on those
tableaux and it is the fat-text-stroke gap P-5 recorded as "the one
systematic gap nobody owns" (ink 1.3-2.28x the reference at the same
threshold on text-dense frames). Every one of those segments still
passes; the number moves in the direction P-5 predicted, on the slides
P-5 predicted.

## 7. Where the code lives

| file | what |
|---|---|
| `core/vocabulary/Slides/Builds.ts` | `curvedMotionAnim`, `MOTION_SAMPLES`, `BC_APPEAR`/`APPEAR`, `isInstant`, `INSTANT_WINDOW`, `INSTANT_CONSUMES_NO_TIME` — additive |
| `core/demo/pl02/Web01.ts` | **new** — deck 45-53, registered `p02i` |
| `core/test/motion.test.ts` | **new** — 12 tests |
| `core/scripts/key2ts.ts` | `CHAPTER_SLIDES` += 38, 45-53 (bare regenerate) |
| `core/demo/scenes.ts` | one registration line |

Nothing in `render/**`, `src/**` or the importer trio was touched.

## 8. Gates

- `bunx tsc --noEmit` — **clean**.
- `bun test` — **1145 pass, 0 fail** (1133 inherited + 12 mine).
- **S04 gauntlet — 6/6 PASS**, mean coverage ref **0.9946** / ours
  **0.9954** — identical to P-1's, P-2's and P-3's to four decimals, so
  nothing here perturbed the video-01 reproduction.
- Liminal Web — **9/9 segments**, **16/16 mid-build frames**,
  **7/7 motion onsets within 1.82 px** on a 54.8 px travel.
- Servers killed.

## 9. What later chapters inherit

1. **`sequence` eases PER WAYPOINT PAIR.** Any chapter that resamples a
   path into waypoints — a curved motion, a traced camera move, a
   morph's intermediate states — inherits the ripple and must
   pre-compensate for it. §2 has the numbers and `test/motion.test.ts`
   has the guard, including the test that asserts the naive placement
   fails.
2. **An instant build consumes no time in the automatic chain** (§4).
   P-5's rule with its quantity made explicit, not a replacement for it.
3. **Chunk order has now failed twice** (P-5's deck 25, this chapter's
   deck 53). Still not a rule; worth a chapter that can measure several
   more.
4. **Score the thing the chapter is about, masked, in addition to the
   frame.** The cursor is 0.5% of ink: every whole-frame number here
   passes at 0.99+ while the cursor's own IoU is 0.15. A headline score
   is not evidence about a small object, and a chapter that only quotes
   one is not reporting on its own subject.
5. **Match the frame index to the hold time.** The gauntlet's `index@t`
   form makes it easy to pass a time that is not the frame's own second
   (frame n is (n-1)/5), and the resulting uniform offset looks exactly
   like a phase error in the code. Cost me a diagnosis; §5 records it.
6. **Deck 56's curved motion path is implemented and unexercised.** When
   a chapter reaches slide 56, `curvedMotionAnim` is waiting and has
   never been scored against a frame. Score it there.
