# P-9 — the long-build set pieces

Chapter P-9 of the PL02 campaign: deck slides 16, 17, 18 and 59 — the
Social Machine assembling, the six social organisms flying apart while
the machine at their centre swells to fill the frame, the mass-hypnosis
towers, and the Liminal Flow mountain drawing itself line by line.

**The row's title was a hypothesis and it half survived.** "Assembly /
long-build choreography… by construction needs no new capability; it is
the integration test" — right that no new verb is needed, wrong that
there was nothing to find. The census turned up one slide that was not
being decoded at all, one segment boundary wrong by fifty-two seconds in
every existing record, an image ceiling that turned out to be removable
by *reading* rather than tracing, and one slide whose file no longer
matches its own footage.

## The gates

| gate | result |
|---|---|
| `bunx tsc --noEmit` | clean |
| `bun test` | **1186 pass, 0 fail** (1166 baseline + 18 mine + 2 teammates') |
| S04 gauntlet | **6/6 PASS**, mean coverage ref 0.9946 / ours 0.9954 |
| P-3 regression (`p02a`) | 5/5 frames rendered; **two of them improved**, see §8 |
| P-4 regression (`p02d`) | **4/4 PASS** |
| P-5 regression (`p02e`) | **7/7 PASS** |
| P-7 regression (`p02i`) | **9/9 PASS** |
| P-8 regression (`p02j`) | **7/7 PASS** |

## 1. The census demanded four slides, not three, and one was invisible

The recon's row named "16, 17, 58". Under P-1's +1 shift the third is
deck 59 — and **deck 59 was not being decoded**. `keydecode.py` cut the
deck at `slide_ids[:58]` with the comment "only slides 1-58 are in the
video; 59-83 are later additions", which predates P-1's own correction
and contradicts it: the video has 58 SEGMENTS, but because deck 18 is
real and in the video those segments run **deck 1..59**. The cut removed
exactly the last content slide — the recon's own "34 builds, the
second-densest build count".

Verified before reporting it: deck 59 (id 4853219) decodes to 42 shapes,
15 groups and 34 builds with a `none` transition, matching the recon's
row-58 census to the build; deck 60 and 61 are the closing title cards
and deck 63 is "How?", the first genuine out-of-scope later addition.
Routed to the lead, fixed there, and pinned by test.

## 2. The image ceiling is REMOVED, and nobody had to trace anything

P-1 queued this chapter to "trace or source those four assets as paths
through Sketch", with a tracer script to write, a tolerance to declare
and a source PNG to hash. **None of that was necessary.**
`TSD.ImageArchive` carries a **`tracedPath`** — Keynote's own
instant-alpha vectorization — in the same typed `moveTo`/`lineTo`/
`closeSubpath` form as every `bezierPathSource`, stated in the image's
own `naturalSize` design box. The decoder was discarding it along with
the rest of the archive.

All twelve in-scope images carry one, served by two assets:

| asset | elements | instances |
|---|---|---|
| the lightning glyph (`data 11152`) | 35 (a closed 33-point polygon) | 10 — four on deck 2, four on deck 17, two on deck 18 |
| the Vitruvian figure (`data 10520`) | 2,239 (194 subpaths, 1,852 lineTos) | 2 — decks 2 and 3 |

That meets P-1's "only four line-art files in `Data/`" finding from the
other direction. **Verified against the footage, not merely present** —
projecting the stored trace through the same design-box fit the importer
already applies to shapes:

| | predicted | measured |
|---|---|---|
| deck 18 left lightning, f_01790 | x 428.2–460.1, y 207.0–286.6 | x 429.0–459.0, y 207.0–285.0 |
| deck 2 Vitruvian, f_00081 (y only; x is contaminated by the dotted lines in the crop) | y 238.8–548.8 | y 239.0–548.0 |

Sub-pixel on every edge. So this is a **reading of the file at the same
standard as P-1's title card**, not a trace at a tolerance somebody
chose — no tracer, no tolerance constant, no PNG to hash, no fitting,
and the paths are all-strokes so draw-on is preserved exactly as P-1
wanted. It was routed to the lead the moment it was found rather than
kept for this report, because it pays other chapters more than it pays
this one (§5).

## 3. The firing model: the chunk is the unit, and deck 59 is the proof

**Deck 16 is the apparent counter-case.** Fifty chunks — chunk 0 manual,
chunks 1–49 all `automatic: true`. Read literally through P-5's settled
rule (an automatic chunk fires one declared duration after its
predecessor) that is a 49-step chain running about 74 seconds. The
segment is 16.4 seconds long, and the footage shows **three** firings.

Fitting all 24 In-builds independently, each against its own exclusive
ink mask, on Keynote's ease, with each build's declared duration and only
the onset free:

| chunks | what | onset | sd | rms |
|---|---|---|---|---|
| 0–11 | twelve heads, `dissolve`, 2.0s | **265.407** | **0.013 s** | 0.009–0.024 |
| 12–23 | twelve spokes, `LineDraw`, 2.0s | **267.307** | 0.126 s | 0.006–0.067 |
| 24 | the blue circle group | 275.400 | — | — |
| 25 | "Social Machine" | 276.325 | — | 0.0023 |

Twelve independent fits landing inside 0.013 s — a quarter of one frame
at 5 fps — is not a cascade. The gaps between the groups are 1.900 s
against a declared 2.0 (0.95×) and 0.925 against 1.0 (0.93×).

The reading that suggested itself was that the rule steps over
same-effect GROUPS rather than chunks. **Deck 59 refutes it**, and it is
a better discriminator than deck 16 because its chunks *interleave* two
effects (dissolve, LineDraw, LineDraw, dissolve, dissolve, LineDraw…).
A grouped reading predicts a dozen small firings; the footage shows 33
in strict chunk order:

    chunk    0      1      2      3      4      5      6  …
    onset  861.53 861.94 862.31 862.65 863.19 863.62 863.94

So the settled rule stands, and deck 16 is it at a density where twelve
steps fall inside one frame — P-7's effective-duration refinement applied
where the whole group is instantaneous relative to the sampling.

### What deck 16 *does* establish, and no chapter has recorded

**An automatic cascade is truncated by the outgoing click.** Chunks
26–49 are 24 `Out` builds that fade every head and every spoke away.
They never fire: the settled tableau at f_01392 has all 12 heads and all
12 spokes present, and David clicks to deck 17 at 278.4 before the chain
reaches them. A slide's declared build list therefore **overstates** what
the video contains, and deck 16 overstates it by half. Any chapter
reading a build census as a description of the footage needs that.

### The 0.87× anomaly on deck 59, reported and not explained

Deck 59's cascade fits a line with residual rms 0.057 s and slope
**0.4223 s per chunk**; independently, the whole cascade runs 861.5 →
875.4, which is 13.9 s over 32 gaps, or **0.434 s each**, measured from
total ink alone with no masks involved. The declared duration is 0.5 s,
so the ratio is 0.85–0.87 where the six prior confirmations measured
0.985–1.010.

This is **stated, not absorbed**: absorbing it would mean fitting a
per-slide rate, which the campaign forbids. Two candidates that would
each be a reading rather than a fit, and which a chapter with a second
0.5 s cascade could separate — the wait may be the predecessor's
*effective* rather than declared duration (a 0.5 s dissolve may simply
not take 0.5 s), or Keynote may floor the automatic delay below its
shortest duration. One slide is not enough to choose.

The scene fires deck 59 from the joint fit (both the thirteen isolable
onsets and the measured end): start 861.404, step 0.4347 s, max error
0.126 s — inside one frame everywhere.

## 4. The boundary correction, and how it was got wrong first

**Deck 17 → deck 18 is at 292.0, not 344.8, and not 362.0.** Deck 18 is
**seventy seconds long**, where every existing record gives it seven.

`analysis/segments.json` splits at 362.0; 362.0 is deck 18 *leaving* —
the one fade-to-black in the whole window (ink exactly 0 at f_01810 and
f_01811), after which the tableau is "Wisdom"/"Power", which is deck 19.
The real arrival is deck 18's declared 1.5 s FadeThruColor, plainly
visible once you look in the right place: ink falls 41,571 → 5,101 across
291.8–293.4 and the new tableau settles by 293.8.

**The proof is geometric, not correlational**, which matters on a slide
whose thumbnail is a mid-build state and whose correlations are all under
0.2:

| | video x span |
|---|---|
| deck 17's 176 shapes | 329.7 – 950.4 |
| deck 18's 48 shapes | 234.9 – 1045.1 |
| the footage's outer towers | ~235 and ~1040 |

The towers sit outside deck 17's reach on **both** sides. Deck 17 cannot
draw them, so they are not deck 17's.

### The wrong answer, and why it looked right

Hunting the boundary by ink-difference found a 33-pixel blip at 344.8 and
nothing else in the window — and 33 pixels changing across a whole frame
reads exactly like a crossfade between near-identical tableaux. It was
recorded as the boundary and even "confirmed" by a second measurement:
the lightning bolts' pixel counts tick 916 → 913 at precisely that frame.
Both observations were real; the inference was not. 344.8 is the last
frame before "mass-hypnosis" begins to ramp, and the ticking bolts are
JPEG noise on a static frame.

**The lesson generalises past this slide**: a scan finds *where*
something changed, never *what* changed, and on a deck whose consecutive
slides duplicate each other's geometry the two questions have different
answers. P-7 recorded this as "scan-finds-where-not-what" and P-8 walked
into it on deck 54; this is its third outing. The instrument that settled
it was not a better scan but the **shape census** — asking which slide's
declared geometry can draw the tableau at all.

## 5. Deck 17's action-scale, and the ease confirmed twice more

The six `action-motion-path` builds **declare their travel in full** —
(6.416, −375.740), (−619.667, −504.825), (471.914, −525.443),
(−475.861, 543.345), (543.287, 539.253), (−3.778, 357.497) slide units,
one per compass point — so they are read, not fitted.

The `apple:action-scale` (chunk 9, on the 26-member group) declares no
factor, as P-4, P-7 and P-8 all established. Here it is measurable by
P-8's admissible route, and it is a **better instance than deck 56's**:
the target is the blue circle, isolable by colour on an otherwise white
tableau, crossing an empty stage, and its START size is *declared* — the
group's box is 292.5 slide units = 195.0 video px against a measured 199,
whose 4 px difference is exactly the stroke's two half-widths. So only
the factor is free.

| build | curve | onset | value | rms |
|---|---|---|---|---|
| the action-scale | **kEaseBoth (s = 0.42)** | 288.285 | k = **3.0932** | **0.68 px** |
| the action-scale | smooth (s = 0.25) | 288.285 | k = 3.1094 | 8.87 px |
| chunk 3's top ring, on its declared −250.49 px travel | **kEaseBoth** | **288.285** | — | **0.73 px** |
| same | smooth | 288.285 | — | 9.26 px |
| same | linear | 288.300 | — | 20.45 px |

Two independent builds of two different classes agreeing on **one onset
to three decimals**, each preferring `kEaseBoth` by better than 12×.
That is a **seventh and eighth confirmation of P-8's ease**, on
`action-scale` and `action-motion-path` — neither of which P-8 used.

One measurement trap worth recording: the ring's first fit preferred
*linear* at 10.6 px rms, because the ring leaves the frame and its
centroid is clipped by the top edge. Tracking the ring's lower edge
instead gives the table above. A clipped centroid fights the ease and
manufactures a straight line.

## 6. Deck 59 is not in the deck as the video shows it

The one place this chapter cannot reach a clean score, recorded rather
than worked around.

Deck 59's declared geometry sits **141.56 slide units (94.37 video px)
below** what the footage draws. Measured as a pure translation on four
landmarks spanning the canvas:

| landmark | predicted (video px) | measured | delta |
|---|---|---|---|
| horizon rect, top edge | 288.69 | 194.0 | 94.69 |
| red "Collective Intelligence" ring, centre | 279.70 | 185.5 | 94.20 |
| red base ellipse, centre | 583.80 | 489.5 | 94.30 |
| blue base rectangle, centre | 583.80 | 489.5 | 94.30 |
| | | **sd** | **0.19 px** |

X is exact throughout (ring centre 620.2 predicted against 619.5
measured, radius 104.1 against 104.5 — the same sub-pixel agreement P-1
got on the title card), so it is a rigid vertical translation and not a
scale: fitting a scale instead misses the third landmark by 16 px.

**The deck is what moved, not the video.** Keynote's own stored thumbnail
for deck 59 agrees with the *deck* — horizon at 0.4000 of frame height
against the declared 0.4010 and the video's 0.2694 — and rolling the
video frame down 96 px lifts its correlation with that thumbnail from
0.104 to 0.880. Two further edits point the same way: the three strings
the footage shows — "Liminal Flow", "Collective Intelligence",
"Syntropy" — exist in **no archive anywhere in the 84-slide file** (every
`TSWP.StorageArchive` was searched, not just deck 59's), yet the footage
builds them at 875.8, 878.2 and 883.0, after the 33-chunk cascade ends.
So the labels were deleted and the tableau dragged down, some time after
2023-02-15.

This is the first concrete answer to the recon's own open caution —
"whether slides 1-58 were also edited after the recording is not knowable
from the file". For one slide it now is, and the answer is yes. It is
slide-local: sweeping all 59 segments' thumbnails against their footage
finds deck 59 as the only clean case (decks 41 and 43 show weak rolls
that are mid-build-thumbnail artifacts, and P-8 scored 43 fine).

### The ruling, and the verification it required

I first proposed scoring this with the offset stated as a ceiling, on
P-8's deck-54 precedent. **The lead ruled otherwise, conditionally**, and
the condition was the right one: close the deck-54-shaped hole by proving
the offset is a rigid constant across the segment and that nothing the
slide declares could produce it. All of the following was required before
the constant was applied.

**No build can translate anything.** All 34 records are `In`; 18
`LineDrawForLine`, 15 `dissolve`, 1 `dissolve character`; **zero** carry a
`motionPath`; there is no `action-motion-path`, no `action-scale`, no
`fade and move`. The union of every field on every record is
`{acceleration, animationType, delay, delivery, duration, effect,
eventTrigger, id, target}` — nothing in that set can express a
displacement.

**The incoming transition stages nothing.** Deck 59's own transition is
`none`, a hard cut: no matched objects, no interpolation. (Deck 58's
Magic Move is the transition *into* 58, not into 59.)

**The first scored frame is not mid-anything.** Deck 58 leaves
859.8–861.4 and the frame settles at 861.6 — 11 changed pixels against
its predecessor. The base tableau is five **unbuilt** drawables (the
horizon and the mountain curves) that no build targets.

**The offset is constant across the segment, three independent ways.**
The unbuilt horizon sits at row 194 at t = 861.6, 863.8, 869.8, 875.8,
881.8, 887.8, 891.8 and 893.4 — first settled frame to last, delta 94.69
throughout. Landmarks built at *different* times agree (the red base
ellipse and blue rectangle read 94.26 at every sample; the red ring,
built last, joins at the same offset) — which a build-produced motion
could not do. And the best whole-frame integer shift aligning each of ten
settled frames to the final frame is **dx = 0, dy = 0 at every sample**:
the tableau never moves.

**It is one number, not a per-shape accident.** Rasterising each declared
polyline through the importer's own design-box fit and sliding it in y,
every drawable large enough to match unambiguously (>40 video px on both
axes) gives **dy = 94, sd 0.00**, hit rate 0.93–1.00.

The condition held, so the translation is applied — on the page holon in
the scene, never in the asset or the importer. `slide59.ts` still says
exactly what the file says, and a test pins that its declared red-ring
top is 263.487 slide units, unshifted.

### What the translation buys

| | declared geometry | translated |
|---|---|---|
| f_04460 `coverage_ref` | 0.1171 | **0.6752** |
| f_04460 `coverage_ours` | 0.1613 | **0.9603** |
| f_04460 `chamfer_ours` | 10.587 px | **0.521 px** |
| f_04315 (mid-cascade) | 0.0256 / 0.0274 | **0.8212 / 0.9226** |
| f_04330 (mid-cascade) | 0.0695 / 0.0716 | **0.8520 / 0.9351** |
| f_04345 (mid-cascade) | 0.1314 / 0.1379 | **0.8619 / 0.9545** |

A chamfer of 0.521 px means our strokes sit on the reference's centre
lines. The mid-cascade frames matter most: the offset had been masking
the long cascade's timing entirely, and with it removed the 33-chunk
firing model scores 0.82–0.86 unmasked against a moving target.

An independent confirmation of the constant, from geometry the fit never
used: the two coloured landmarks the render hides (below) reappear with
`fills: false` at cy 489.0 and 488.5, against the reference's 489.5.

### The residual, fully accounted for

| region | reference ink | unmatched | why |
|---|---|---|---|
| "Liminal Flow" | 1,556 | **1,556** | deleted from the file |
| "Collective Intelligence" | 1,216 | **1,216** | deleted from the file |
| "Syntropy" (word) | 474 | **474** | deleted from the file |
| the Syntropy curves | 4,202 | 2,298 | deleted from the file |
| the coloured rings | 3,343 | 2,211 | **hidden by our own fills — see below** |

100% of the reference's ink in each label's region is unmatched, which is
exactly the signature of content the file does not contain.

### A pre-existing fill-occlusion bug, found here and not this chapter's

The red ring, the red base ellipse and the blue rectangle are **drawn,
tinted and positioned correctly** — every parameter checks out, and with
`fills: false` all three appear within a pixel of the reference. They are
hidden by opaque `SlideFill`s that the deck declares *below* them.

`composeShape` emits every stroke and every fill at `z = 0`, so the
deck's z-order survives only as emission order and the renderer resolves
coplanar geometry by draw order. Deck 59's full-canvas black horizon
rectangle — z-index **1 of 42**, and a genuine solid black in the
stylesheet rather than the dropped gradient its `skipped` note might
suggest — therefore wins over strokes declared thirty places above it.

**Verified pre-existing and independent of the ruling**: the same three
shapes are absent from the pre-ruling render too, so the translation
neither caused it nor masks it. It is P-5/P-8's fill machinery, reported
rather than patched, and it costs deck 59 about 2,211 px of
`coverage_ref` — roughly 0.10.

## 7. The scores

Scene `p02k`, `core/demo/pl02/SetPieces.ts`. Settled frames, unmasked
whole-frame:

| frame | deck | video s | coverage_ref | coverage_ours | chamfer ours/ref | verdict |
|---|---|---|---|---|---|---|
| f_01392 | 16 | 278.2 | **1.0000** | **0.9959** | 0.281 / 0.036 | **PASS** |
| f_01459 | 17 | 291.6 | 0.8822 | **0.9960** | **0.077** / 1.214 | FAIL — stroke-width ceiling, below |
| f_01795 | 18 | 358.8 | **0.9755** | **0.9445** | 0.879 / 0.419 | **PASS** |
| f_04460 | 59 | 891.8 | 0.6752 | **0.9603** | **0.521** / 4.355 | FAIL — deleted content + fills, §6 |

Mid-build frames, where the chapter's subject lives:

| frame | deck | video s | coverage_ref | coverage_ours | verdict |
|---|---|---|---|---|---|
| f_01329 | 16 | 265.6 | **1.0000** | 0.8701 | FAIL (ours ahead mid-dissolve) |
| f_01338 | 16 | 267.4 | **1.0000** | **0.9848** | **PASS** |
| f_01443 | 17 | 288.4 | 0.6401 | 0.6462 | FAIL |
| f_01445 | 17 | 288.8 | 0.8738 | 0.7569 | FAIL |
| f_01446 | 17 | 289.0 | 0.8548 | 0.6634 | FAIL |
| f_01664 | 18 | 332.6 | **0.9916** | **0.9863** | **PASS** |
| f_01684 | 18 | 336.6 | **0.9733** | **0.9457** | **PASS** |
| f_04315 | 59 | 862.8 | 0.8212 | **0.9226** | FAIL — §6 |
| f_04330 | 59 | 865.8 | 0.8520 | **0.9351** | FAIL — §6 |
| f_04345 | 59 | 868.8 | 0.8619 | **0.9545** | FAIL — §6 |

**Deck 16 scores `coverage_ref = 1.000` on all three of its frames**,
settled and mid-cascade — the twelve-at-once firing reproduces exactly.
**Deck 18 passes settled and at both mid-build frames**, which is the
corrected 70-second boundary and its five onsets confirming each other.
**Deck 59's three mid-cascade frames score 0.82–0.86 / 0.92–0.95** with
chamfer 0.57–0.87 px, which is the 33-chunk firing model measured against
a moving target — a reading the declared-geometry offset had been hiding
completely (it put those same frames at 0.026–0.131).

### Deck 17's ceiling: the renderer holds stroke width constant under scale

Deck 17's frames sit at 0.85–0.88 rather than passing, and the cause is
one property, not the chapter's timing. Measured on the big ring at row
360 of f_01459:

| | our stroke | reference |
|---|---|---|
| the ring | 3 px | 9 px |
| a head outline | 4 px | 6 px |

Keynote scales a stroke's **width** along with its geometry; the
framework deliberately does not — `render/three-host.ts` divides the
per-pixel width by the holon's scale so that on-screen stroke weight is
invariant under scale, and says so. Under a 3.09× scale that leaves our
ink at 43% of the reference's (17,970 px against 41,612). The same
property thins the dotted spokes twice over: a `Connection` bakes its
dash lattice at compose time (6 dashes for the unscaled spoke), so
scaling stretches the *spacing* without adding dots.

This is `src/render/**` behaviour and P-6's `Connection`, both outside
this chapter's area, so it is **reported as a ceiling rather than
patched**. The fix if a chapter wants it is known and already built:
`GlidingConnection` derives dash geometry per frame with a dash count
allocated for the longest reach, which is precisely this situation —
P-6 wrote it for Magic Move, and an `action-scale` is the same problem.

Note what the ceiling does *not* touch: `chamfer_ours` is **0.077 px** at
f_01459, so every stroke we draw is on the reference's centre line. The
geometry, the scale factor and the onsets are right; the ribbons are
thin.

## 8. What this chapter paid other chapters

The `tracedPath` finding lifts the image ceiling **retroactively**, and
P-3's two image slides move by more than any change this chapter made to
its own:

| frame | deck | coverage_ref before | after | delta |
|---|---|---|---|---|
| f_00081 | 2 | 0.5134 | **0.9036** | **+0.39** |
| f_00201 | 3 | 0.4059 | **0.9120** | **+0.51** |

Both were recorded as hard ceilings "no stroke fidelity can lift". They
were lifted by reading a field the decoder was throwing away.

## 9. Files

| path | what |
|---|---|
| `core/demo/pl02/SetPieces.ts` | the chapter's scene, registered as `p02k` |
| `core/test/setpieces.test.ts` | 18 tests pinning §1–§6 |
| `core/vocabulary/Slides/Slides.ts` | `groupById` (additive), and the comment recording why a group scale must NOT route through it |
| `core/scripts/key2ts.ts` | decks 16 and 17 added to `CHAPTER_SLIDES` |
| `core/vocabulary/Slides/assets/pl02/slide16.ts`, `slide17.ts`, `slide59.ts` | generated |
| `docs/reports/pl02/p9seg-*`, `p9mid-*`, `p9mid16-*` | scores and composites |

Two importer facts were routed to the lead rather than fixed here (the
`[:58]` cutoff and `tracedPath`), per the chapter's constraints; both
landed in `keydecode.py` and are pinned by tests in `setpieces.test.ts`.

## 10. What a later chapter inherits

1. **The corrected boundaries.** Deck 16: 263.0–279.4. Deck 17:
   279.4–**292.0** (not 362.0). Deck 18: **292.0–362.0**, seventy
   seconds. Deck 59: 861.0–893.8. The recon's segment table and
   `analysis/segments.json` are both wrong on the middle pair.
2. **The chunk is the firing unit** — deck 59's interleaved cascade
   settles it, and deck 16's twelve-at-once is that rule at high
   density, not an exception to it. But the 0.87× step on deck 59's
   0.5 s builds is **unexplained**, and a second 0.5 s cascade would
   separate the two candidate readings.
3. **A declared build list overstates the footage.** Deck 16 declares 50
   builds and fires 26; the outgoing click truncates the rest.
4. **Images draw.** Every `TSD.ImageArchive` in the file carries a
   `tracedPath`, and decks 2, 3, 17 and 18 no longer need masked scoring
   for their images.
5. **Deck 59's file disagrees with deck 59's footage** by a rigid
   141.56 slide units, plus four deleted drawables. The offset IS
   applied, in the scene only, as `DECK59_EDIT_OFFSET` — under the
   lead's ruling and after the five-part verification in §6. The asset
   is untouched and a test pins that. **This is the campaign's first
   admitted footage-sourced geometry constant**, and the precedent it
   sets is narrow: it needs a file that *provably* post-dates the
   recording (here, Keynote's own thumbnail siding with the deck against
   the video), not merely a disagreement.
6. **Stroke width does not scale**, and a `Connection`'s dash lattice is
   baked. Any chapter scoring an `action-scale` over dotted work inherits
   deck 17's ceiling until `GlidingConnection` is wired to that build
   class.
7. **Fills can hide strokes the deck declares above them.**
   `composeShape` emits every stroke and fill at `z = 0`, so the deck's
   z-order survives only as emission order. Deck 59's z-index-1
   full-canvas black rectangle hides three coloured drawables declared
   thirty places above it. Pre-existing, reported, not patched — and
   worth a look from whoever owns `SlideFill`, since a slide with a
   large early background fill is not a rare shape.
