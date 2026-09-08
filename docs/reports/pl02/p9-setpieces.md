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

**The scoring consequence follows P-8's deck-54 precedent**: applying the
141.56 would be fitting geometry to the footage, so the scene does not
apply it and deck 59 is scored with the offset stated as a ceiling. The
number lives in `SetPieces.ts` as `DECK59_EDIT_OFFSET`, unused by the
scene and pinned by test, so that it is recorded where a later chapter
can find it and nobody re-derives it and quietly bakes it in.

What the offset costs, measured: shifting our render up by exactly 94 px
lifts overlap with the reference from 812 to 12,574 pixels and
`coverage_ours` to **0.9037**. The residual `coverage_ref` of 0.656 is
the deleted content — and it is entirely the deleted content:

| region | reference ink | unmatched |
|---|---|---|
| "Liminal Flow" | 1,556 | **1,556 (100%)** |
| "Collective Intelligence" | 1,216 | **1,216 (100%)** |
| "Syntropy" (word) | 474 | **474 (100%)** |
| the Syntropy curves | 4,202 | 2,287 |
| elsewhere | — | 2,534 |

100% of the reference's ink in each label's region is unmatched, which is
exactly the signature of content the file does not contain.

## 7. The scores

Scene `p02k`, `core/demo/pl02/SetPieces.ts`. Settled frames, unmasked
whole-frame:

| frame | deck | video s | coverage_ref | coverage_ours | chamfer ours/ref | verdict |
|---|---|---|---|---|---|---|
| f_01392 | 16 | 278.2 | **1.0000** | **0.9959** | 0.281 / 0.036 | **PASS** |
| f_01459 | 17 | 291.6 | 0.8822 | 0.9960 | 0.077 / 1.214 | FAIL — see below |
| f_01795 | 18 | 358.8 | **0.9755** | **0.9445** | 0.879 / 0.419 | **PASS** |
| f_04460 | 59 | 891.8 | 0.1171 | 0.1613 | 10.587 / 11.470 | FAIL — §6 |

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
| f_04315/4330/4345 | 59 | 862.8–868.8 | 0.026–0.131 | 0.027–0.138 | FAIL — §6 |

**Deck 16 scores `coverage_ref = 1.000` on all three of its frames**,
settled and mid-cascade — the twelve-at-once firing reproduces exactly.
**Deck 18 passes settled and at both mid-build frames**, which is the
corrected 70-second boundary and its five onsets confirming each other.

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
   141.56 slide units and three deleted labels. Do not apply the offset;
   it is recorded as `DECK59_EDIT_OFFSET`.
6. **Stroke width does not scale**, and a `Connection`'s dash lattice is
   baked. Any chapter scoring an `action-scale` over dotted work inherits
   deck 17's ceiling until `GlidingConnection` is wired to that build
   class.
