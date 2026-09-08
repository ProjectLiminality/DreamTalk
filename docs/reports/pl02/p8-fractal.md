# P-8 — the fractal layout, and what it actually needed

Chapter P-8 of the PL02 campaign: deck slides 43, 44 and 54-58, video
seconds 639.4-861.0. The Liminal Space fractal cone tree, the
local/non-local pairing, and the Coherence Beacon family that closes the
pitch.

**The row's hypothesis dissolved on measurement, and something larger
took its place.** The brief named "recursive/fractal layout at scale, no
new verbs — a composition and performance test", and both halves of that
turn out to be wrong in the same direction: the composition needed
nothing, and two things that are not composition needed a great deal.

- **What the fractal needed: nothing.** Deep nesting was already
  exercised (§1), repeated-structure instancing has nothing to instance
  (§1), and the 103-shape tableau renders at rate.
- **What it needed instead, and it is deck-wide: the easing is wrong.**
  Keynote's `kEaseBoth` is not the framework's `smooth` — same Bezier
  family, tangent length 0.42 rather than pydeation's 0.25, which is CSS
  `ease-in-out`. Measured four times on two unrelated build classes,
  4.7x to 6.9x better than the value in use (§2).
- **And the occlusion question is now closed, with a defect found.**
  P-5's fills were hiding 13,346 px of our own ink on this tableau, and
  **78% of it was each filled drawable's OWN outline** — a fill
  triangulated to the stroke's centre line covers the ribbon's inner
  half. Fixed by a geometric inset (§3).

Gates: **7/7 segments, 7/7 mid-build**, tsc clean, `bun test` 1166/0,
S04 6/6 at the campaign's usual 0.9946/0.9954.

## 1. The row's hypothesis, refuted from the census

Not argued — counted, before any code was written.

**"Deep group nesting at scale" — REFUTED, and already exercised.** Deck
43 nests three levels, which IS the deepest in the deck. It is also not
new: the only other slide reaching three is deck 48, which **P-7 scored
at coverage_ref 1.0000 / ours 0.9948**. Deck-wide the distribution is 21
slides at depth 0, 30 at depth 1, five at depth 2, and two at depth 3.
The flattening in `keydecode.py`'s `walk` needed nothing, and P-2's
group-offset fix already covers the whole range.

**"Repeated-structure instancing" — NOT NEEDED, because the deck
instanced nothing.** The recon said the recursion is "drawn out by hand
in the deck (not generated)", and that is exactly right: 103 shapes,
each carrying its own stored bezier path, emitted as 122 KB of
polylines. There is no repeated structure to share — the "same" head
icon appears 40-odd times as 40-odd independent drawables with 40-odd
independent paths. A chapter that built an instancing layer here would
have built it for a corpus that has no instances.

**Performance is a non-issue.** 122 KB is the largest module in the
emitted set and it renders at full rate; the census that matters is
P-10's slide 11 (210 shapes, 105 groups, 105 builds), not this one.

Deck 44 and 54-58 are smaller still: 13, 36, 40, 36, 37 and 52
drawables. Nothing in this row is a scale test.

This is the second time a P-row title has dissolved on measurement
(P-5's dimmed palette was the first), and the pattern is the same both
times: the recon's row names a plausible capability, and the data says
the capability is either already present or not exercised. Checking
first cost an hour and saved building it.

## 2. What it DID need — Keynote's ease is not the framework's

**Both are the same curve family.** A cubic Bezier value curve with flat
value tangents, parameterised by the horizontal tangent length `s`, with
control points at (s, 0) and (1-s, 1) — which is exactly what
`timeline.ts`'s `c4dEaseWith(u, s, s)` evaluates. They differ only in `s`:

| | s | provenance |
|---|---|---|
| framework `smooth` | **0.25** | pydeation's C4D default, calibrated in `timeline.ts` against video-01's Scene 04 |
| Keynote `kEaseBoth` | **0.42** | CSS `ease-in-out` = `cubic-bezier(0.42, 0, 0.58, 1)` |

The x-coordinates of that CSS curve are `s` and `1-s`, and its
y-coordinates 0 and 1 are the flat tangents. So the two are the same
object under different names, and 0.42 is a **declared standard** rather
than a fitted number — which is what makes it admissible under the
refused-fits rule. A fitted 0.4183 would not be.

### The measurements — four, on two unrelated build classes

Each fitted P-7's way: the geometry and the duration are READ from the
deck, and the onset is the only free quantity, with `s` swept at each
build's own best onset.

**Motion** (`action-motion-path`), rms of the tracked centroid in video px:

| build | kind | s = 0.25 | s = 0.42 | best | samples |
|---|---|---|---|---|---|
| deck 46 cursor | straight, 1.0s | 2.09 | **0.44** | 0.42 | 5 |
| deck 56 figure | curved, 3.0s | 8.90 | **1.29** | 0.42 | 13 |

**Dissolve** (`dissolve character`), rms of the ramped alpha read as
summed luminance over the target's own settled ink mask:

| build | duration | s = 0.25 | s = 0.42 | best | interior samples |
|---|---|---|---|---|---|
| deck 43 "holographically…" | 2.0s | 0.0298 | **0.0164** | 0.41 | 8 |
| deck 43 "Liminal Space" | 2.0s | 0.0315 | **0.0075** | 0.45 | 7 |

A straight path and a curved one; a 1.0s build, two 2.0s builds and a
3.0s one; a position ramp and an opacity ramp; deck slides 43, 46 and 56,
spread across 170 seconds of video. The two motion fits land on 0.42 to
the sweep's own resolution (0.02); the two dissolve fits bracket it at
0.41 and 0.45, which is the precision that 7-8 samples of a JPEG
luminance ramp can support.

**Linear is ruled out decisively**, which matters because "no declared
acceleration" could have meant it: on deck 56, at its own best onset,
linear fits at **19.75 px** against ease-both's 4.51 (both at s=0.25 for
that comparison). On the two dissolves, linear fits at 0.063 and 0.068
against 0.016 and 0.008.

A fifth, weaker confirmation: deck 43's 2.0s `LineDrawForLine` arrow fits
its declared draw ramp at **0.0076 rms** on the Keynote curve.

### The complication: half the deck declares no easing at all

`acceleration` splits the 384 in-scope builds cleanly, **by build class
rather than by slide**:

| value | count | which builds |
|---|---|---|
| `kEaseBoth` | 155 | every `action-motion-path` (19), every `action-scale` (5), every `LineDraw`/`LineDrawForLine` (130), one `dissolve character` |
| absent | 229 | every `dissolve` (90), 120 of the 121 `dissolve character`, every appear, every fade-and-move |

So on the archive's own word the dissolves state no curve — and yet the
two 2.0s dissolves measured above are the ones that fit s = 0.42 best.
Both facts are real: the field is absent AND the ramp eases.

**The reading taken is that an absent `acceleration` is a DEFAULT rather
than an assertion of linearity**, and that Keynote's default is the same
ease-both its actions name. That is inference, and it is written down as
one in `Builds.KEYNOTE_EASE_S`. What it is *not* is a fit: the curve was
measured on builds that declare it, and the only question here is
whether builds that declare nothing take the same one. The footage says
they do, by 4x and 9x over linear.

The alternative — dissolves on `smooth`, actions on Keynote's — was
**tested rather than argued away**. It changes nothing on P-5's
regression frames (deck 29's f_02686 scores 0.9664 either way, because
its builds have all settled by the scored time) and it would leave the
two measured 2.0s ramps fitted 2-4x worse. One curve for one deck.

### How it is implemented without touching `src/`

`Easing` is a closed four-name union and all four carry pydeation's
0.25. Rather than widen it — a framework change made for one deck — the
curve is stated as **waypoints on `keynoteEase` with the track stamped
`linear`**, which `Timeline.valueAt` then interpolates uniformly.
Reconstruction error against the exact curve:

| samples | 8 | 16 | **32** | 64 |
|---|---|---|---|---|
| max error | 0.0086 | 0.0022 | **0.00054** | 0.00014 |

The quantity it has to resolve is the 0.054 gap between s = 0.25 and
s = 0.42, so 32 leaves a **100x margin**.

**A side effect worth knowing: this dissolves P-7's ripple problem
rather than re-solving it.** P-7 stamped its curved-motion waypoints
`smooth`, so `Timeline.valueAt` eased every consecutive PAIR over its
own sub-span and the composite rippled once per sample; the waypoints
had to be placed at `ease(k/N)` to cancel that. A `linear` sequence has
no per-pair ease to fight, so the pre-compensation is simply gone. Its
two ripple tests are **rewritten, not deleted**, to assert the stronger
property (the composite IS the Keynote ease, within 0.002) plus a guard
that the two curves have not been conflated.

**P-7's own conclusions are unaffected.** Its seven cursors were fitted
at s = 0.25 and still landed within 1.82 px, because a 54.8 px travel
sampled every 0.2s cannot separate two eases differing by 5% of the
span. Deck 56's 3.0s travel can — which is why this surfaces here, and
why it is reported as a correction to a shared constant rather than as a
defect in P-7's work. Re-scored, P-7's mid-glide frames **improve**:
f_03635 +0.0019 / +0.0021 and f_03637 +0.0017 / +0.0006, with the rest
bit-identical.

## 3. The occlusion verdict — the open question, closed, with a defect

The ground truth carried P-5's `SlideFill` as **"VERIFIED WINDING but
UNTESTED OCCLUSION"**, with P-3's push-back accepted and P-9/P-10 told
to run a cheap check before trusting it at scale. Deck 43 is where that
check is cheapest: **60 black-filled ellipses, 30 genuinely overlapping
pairs, 39 unfilled drawables whose boxes cross a filled one**, on a
tableau whose whole construction is cone lines running behind ellipses.

`Slide.fills` is the A/B switch, so the comparison is a parameter rather
than an edit-and-revert. Same page, same instant, scored against
`f_03370`:

| | coverage_ref | coverage_ours | IoU |
|---|---|---|---|
| fills ON (P-5's, uninset) | 0.9470 | 0.9608 | 0.7564 |
| **fills OFF** | **0.9822** | 0.9579 | **0.8340** |

**Turning the fills OFF scored better.** That is the opposite of what the
capability is for, and it is the finding.

### What the fills were hiding

Differencing the two renders and the reference:

| | pixels |
|---|---|
| ink the fills hide | 13,346 |
| …of which the reference **does** draw | **10,472 (78%)** |
| …of which the reference does not draw | 2,874 (22%) |

The 22% is correct — a neighbouring head's outline crossing behind this
one, which is exactly the occlusion the deck relies on. **The 78% is
every filled drawable's OWN outline**, and the artifact
`p8-occlusion-wrongly-hidden.png` shows it unambiguously: nothing but
head and icon silhouettes.

### The mechanism, read off one row of pixels

A stroke is drawn CENTRED on its path, so a 3-unit outline puts 1.5
units of ribbon on each side of the loop. A fill triangulated to that
same loop covers the ribbon's whole inner half — and fills blend NORMAL
where strokes blend MAX (`render/fill.ts`: "a fill must be able to COVER
what is behind it"). One row across a head icon's widest point, the four
pixels of its left edge:

| | | | | |
|---|---|---|---|---|
| reference | 142 | 246 | 205 | 36 |
| fills OFF | 142 | 232 | 204 | 33 |
| fills ON (uninset) | 142 | 204 | **0** | **0** |

At deck scale a 3.0-unit stroke is 2 video px wide, and the two pixels
lost are exactly its inner half.

### The fix, and the line drawn

`SlideFill.inset` pulls the filled region back by **half the outline's
stroke width** — each vertex along the bisector of its two edge normals,
scaled by `d / sin(theta/2)` so the offset EDGES land `d` from the
originals. Interior side is read from the loop's signed area, so a hole
insets the way a hole should. A step past `MAX_INSET_RATIO` falls back
to the uninset loop rather than folding the polygon.

Result on the same frame:

| | coverage_ref | coverage_ours | IoU |
|---|---|---|---|
| uninset | 0.9470 | 0.9608 | 0.7564 |
| **inset by half the stroke** | **0.9544** | **0.9655** | **0.8179** |

and wrongly-hidden ink falls from **10,472 px to 2,959 — a 72%
reduction**. The residual is the ribbon's antialias band.

**Insetting past that band was measured and NOT taken:**

| extra inset (world units) | 0 | +0.39 | +0.78 | +1.17 |
|---|---|---|---|---|
| coverage_ref | 0.9544 | 0.9566 | 0.9587 | 0.9606 |

The gain is monotone with no optimum, which is the signature of fitting
rather than reading — the curve is only "hide less of your own edge" and
has no natural stopping point short of disabling occlusion. And `AA_PX`
is one SCREEN pixel, so folding it into a world-space inset would make
the geometry depend on render resolution. **Half the stroke is the edge
the shape actually has**; the antialias band belongs to whoever owns the
ribbon.

### The verdict for the ground truth

> **Occlusion is REAL and now TESTED at scale.** Fills genuinely hide
> what is behind them, in the deck's own z-order, on a 60-fill tableau
> with 30 overlapping pairs — and the hidden ink genuinely disappears.
> P-5's capability was sound. Its EXTENT was a stroke-width too large in
> every direction, hiding each drawable's own outline; that is fixed by
> `SlideFill.inset` and guarded by seven tests.

P-9 and P-10 inherit a checked capability rather than an open question.

### The regression, in full

The inset moves ink on every filled drawable in the deck, so every prior
chapter was re-scored:

| chapter | before | after |
|---|---|---|
| P-3 opening arc | 3/5 | **3/5, bit-identical** (its two FAILs are its own image ceilings) |
| P-4 mesh | 4/4 | **4/4** |
| P-5 chain | 7/7 | **7/7** |
| P-7 Liminal Web | 9/9 | **9/9** |
| P-7 mid-build | 7/7 | **7/7** |
| **S04 (video-01)** | 6/6 | **6/6**, mean ref 0.9946 / ours 0.9954 |

Two P-5 frames improve materially (f_02246 coverage_ours +0.0441,
f_02351 +0.0155). One moves down: **f_02686 coverage_ref 0.9966 →
0.9664**. That was isolated rather than accepted: with the easing
reverted it is unchanged at 0.9664, and with the *inset* reverted it is
0.9598 — so the ease costs nothing there and the inset **recovers**
0.0066 of a drop that comes from elsewhere in the frame. The 586 px
involved are thin ring edges on a slide whose own ink we already
over-draw (14,748 ours against 10,511 reference). It still passes, and
chasing it further would be tuning one frame.

## 4. Deck 56 — P-7's unexercised code, finally scored

P-7 wrote `curvedMotionAnim` against the data, tested it synthetically,
and said plainly that the footage never exercised it: *"when a chapter
reaches slide 56, it is waiting and has never been scored against a
frame. Score it there."* This is there.

Build 5602009 drives a `Man_83` figure along two cubic segments over
3.0s, travelling (-284.409, -170.965) slide units and bowing 27 slide
units off its own chord — a person walking from the right tribe up into
the centre one. It is the only in-scope curve in the deck.

**Fitted with only the onset free**, and with the traveller isolated by
connected-component tracking on frame-to-frame new ink:

| easing | rms | onset |
|---|---|---|
| linear | 19.75 px | 830.755 |
| s = 0.25 (`smooth`) | 8.90 px | 830.435 |
| **s = 0.42 (Keynote)** | **1.29 px** | **830.430** |

Thirteen samples over a 340 px travel. That spread is what identified
the ease, and it is the reason this chapter has an easing section at all.

### `action-scale`: the one measurable instance of a class two chapters declined

Deck 56 carries an `apple:action-scale` (5602023) on the **same target**
over the **same window** as the motion. P-4 declined to score deck 10's
on the ground that the record declares no magnitude, and P-7 confirmed
the absence in the raw archives (no `actionScaleSource`, no factor on
the build's attributes). Both were right.

But a quantity that exists only in the footage is **MEASURED, not
fitted** — the same standing every click onset in this campaign has —
and deck 56 is the one place the deck makes it measurable cleanly: the
target crosses empty stage with nothing overlapping it. Tracking its
bounding box and correcting for its 3.0-unit stroke:

| | |
|---|---|
| declared box height | 44.400 px |
| measured at rest | 44.0 |
| measured at end of travel | 35.0 |
| **ratio** | **0.795** |

and the resulting arrival box, scaled about the box CENTRE, predicts the
figure's ink at **x[649.3, 665.1] y[278.5, 316.0]** against a measured
**x[649, 664] y[278, 315]** — sub-pixel on three of four edges.

**0.8** is quoted rather than 0.795, for the same reason
`KEYNOTE_EASE_S` is 0.42 rather than 0.4183: the measurement locates a
round number an author would type, and the third digit claims a
precision the 5 fps reference does not carry.

**Only deck 56 is scored on this.** The other four action-scale records
(decks 10, 17, 21 x2) get no factor — each would need its own
measurement and none is isolated the way this one is. `ACTION_SCALE` is
deliberately **kept out of `SUPPORTED`**, so those four keep appearing in
`unsupported()` rather than silently doing nothing; a scene states what
IT has measured, per build id, through `Slide.scaleFactors`.

## 5. The firing model — confirmed on a sixth slide, more sharply

Deck 43's six ring dissolves are the cleanest instance of P-5's rule in
the video: one manual chunk, then an automatic chain, with every target
isolable because the rings sit in separate corners of the canvas.

| chunk | onset | gap | `automatic` | rms |
|---|---|---|---|---|
| 0 | 651.105 | — | false | 0.0400 |
| 1 | 652.115 | **1.010** | true | 0.0565 |
| 2 | 654.390 | **2.275** | **false** | 0.0262 |
| 3 | 655.395 | **1.005** | true | 0.0229 |
| 4 | 656.395 | **1.000** | true | 0.0251 |
| 5 | 657.380 | **0.985** | true | 0.0474 |

**Four automatic gaps at mean 1.000x the declared 1.0s, range
0.985-1.010, against one manual gap at 2.275x.** No overlap, on one
slide, with no pooling across slides. P-5 needed three slides to
separate the two populations; deck 43 separates them alone.

**A measurement note that changes the numbers.** The six group boxes
overlap, and fitting each against its own box gives 0.19-0.33 rms;
stripping the pixels a box shares with any other target gives
0.023-0.057, and moves the onsets by up to 0.18s — most of a frame. On
a slide where the whole question is a 1.0s gap, an exclusive mask is not
a refinement, it is the measurement.

### One apparent exception, measured and kept

Deck 43's chunk 8 (automatic, predecessor duration 2.0) fires **0.060s**
after chunk 7 rather than 2.0s after it: the "travel by zooming in"
label arrives WITH the arrow it labels. Both onsets are solid — the
arrow fits its 2.0s draw at 0.0076 rms, the label its 2.0s ramp at
0.0231 — so this is not an artefact.

**Reported, not resolved.** It is a different SHAPE from the two on
record: P-5's deck 25 and P-7's deck 53 are ORDER exceptions (a chunk
firing out of turn), while this is a chunk firing *simultaneously* with
its predecessor. One instance does not name a rule. The scene uses the
measured onsets.

### And one that turned out not to be an exception at all — §7

## 6. The segment table needs its largest correction yet

The recon puts deck 54 at 793.4-816.0 and deck 55 at 816.0-827.8. The
footage puts the boundary **sixteen seconds earlier**, in a Magic Move
spanning ~797.6-799.8. Two independent lines:

1. **Deck 55's three mini-towers** (5491060, 5491203, 5491270 — declared
   on deck 55 and nowhere else) ink from **812.35**, well inside what the
   table calls deck 54.
2. **Four of the seven tablets vanish at 803.86**, and the four are
   exactly deck 55's four `fade and move` Out targets (5457731, 5458107,
   5458485, 5458233). The three that remain are precisely the three
   deck-55 tablets carrying no fade-out.

The cause is the Viterbi's ordinary failure mode on a near-identical
pair: **deck 55 IS deck 54 plus three mini-towers and a title**, so the
thumbnails correlate almost equally against every frame in the stretch.
This joins P-4's corrections to segments 7 and 14 and P-5's to 15 and 28.

The scene therefore holds deck 54 over 793.8-797.4 and deck 55 over
800.4-827.0.

## 7. A wrong fact request, and what it cost

**I sent the lead an importer bug report that was wrong, and withdrew
it.** It is recorded here because the failure mode is one the campaign
has hit before under a different name.

Deck 54 declares all seven tablet groups **stacked at one point** (px
x[388,398] y[239,250], on the tower's own circle) while the footage
shows seven spread over the heads. I sampled two settled frames, found
the declared geometry could not produce what I measured, and routed it
as a decode question — with the deck-55 position match as evidence.

Looking at the frames BETWEEN my samples settles it in one glance. At
**f_03993 (798.4)** all seven ARE clustered at the tower, exactly as
declared. At **f_03996 (799.0)** they are caught mid-flight, strung out
between the tower and the heads. It is the outgoing Magic Move doing
precisely the matched-object interpolation it exists for. The geometry
round-trips; the importer is fine.

The second anomaly dissolved with it. I had also reported deck 54's
chunks 2-7 firing simultaneously at 799.15 rather than staggering, and
chunk 8 firing before them — a third firing-model exception. **Both
readings were the Magic Move, not builds.** Measuring the tablet cluster
at its own tower position instead, it ramps 794.4-795.8 alongside the
tower and the beacon group (one click), and chunk 8 follows at 796.82 in
order. **Deck 54 offers no firing-model exception.** There are still
exactly two on record.

This is P-7's own recorded lesson — *"a scan finds WHERE something
changed, not WHAT changed"* — with a corollary it did not state: **two
settled frames do not show what happened between them either.** A
segment boundary is exactly where that bites, because the thing between
the samples is a transition.

## 8. Per-segment scores

Reference frames chosen AFTER each segment's last event and before its
outgoing transition (P-2's slide-32 lesson). Decks 54 and 55 use §6's
corrected boundaries. The gauntlet bar is coverage >= 0.90 on both and
both chamfers <= 3.0 px.

| deck | frame | video s | cov_ref | cov_ours | chamfer | verdict |
|---|---|---|---|---|---|---|
| 43 | f_03370 | 673.8 | 0.9544 | 0.9655 | 0.436/0.331 | **PASS** |
| 44 | f_03441 | 688.0 | **1.0000** | 0.9730 | 0.684/0.022 | **PASS** |
| 54 | f_03987 | 797.2 | **1.0000** | 0.9958 | 0.102/0.097 | **PASS** |
| 55 | f_04130 | 825.8 | 0.9939 | 0.9831 | 0.334/0.128 | **PASS** |
| 56 | f_04220 | 843.8 | 0.9285 | 0.9798 | 0.378/0.914 | **PASS** |
| 57 | f_04245 | 848.8 | 0.9467 | 0.9897 | 0.408/0.771 | **PASS** |
| 58 | f_04290 | 857.8 | 0.9724 | 0.9303 | 0.759/0.244 | **PASS** |

**7/7 PASS.** No image ceilings apply — none of these seven slides
carries an image (the deck's 12 in-scope images are all on decks 2, 3,
17 and 18), so every number is an unmasked whole-frame score with
nothing excluded.

### Mid-build frames

Where this chapter's subject lives: a settled frame cannot tell a
correct curve from a correct endpoint, nor a correct scale ramp from a
correct final size, nor a staggered cascade from a simultaneous one.

| deck | frame | video s | what it samples | cov_ref | cov_ours | chamfer | verdict |
|---|---|---|---|---|---|---|---|
| 43 | f_03263 | 652.4 | between rings 1 and 2 | 0.9562 | **1.0000** | 0.128/0.316 | **PASS** |
| 43 | f_03275 | 654.8 | ring 3 arriving | 0.9454 | 0.9952 | 0.116/0.384 | **PASS** |
| 43 | f_03287 | 657.2 | rings 4-5, mid-cascade | 0.9621 | 0.9983 | 0.068/0.295 | **PASS** |
| 43 | f_03327 | 665.2 | the arrow mid-draw | 0.9483 | 0.9678 | 0.398/0.430 | **PASS** |
| 56 | f_04159 | 831.6 | the figure, early travel | 0.9218 | 0.9884 | 0.301/0.916 | **PASS** |
| 56 | f_04162 | 832.2 | mid-travel, fastest point | 0.9137 | 0.9857 | 0.338/1.047 | **PASS** |
| 56 | f_04165 | 832.8 | late travel, mid-shrink | 0.9150 | 0.9776 | 0.507/1.041 | **PASS** |

**7/7 PASS.** The three deck-43 cascade frames are the firing model
rendered rather than tabulated: at any settled time every ring is up, so
these are the only frames that can distinguish a 1.0s automatic chain
from a single click.

### Two things a first pass got wrong, and the composites caught

Both were **missing builds, not wrong ones**, and both showed as pure
red on the composite:

- **Deck 56 scored 0.8087 cov_ref** until its two `dissolve` builds were
  added. I had assumed they fired with the incoming transition; measured
  on their own targets they fire at **837.110** (four `Man Walking_681`
  on the arrows) and **839.685** (four `Man_83` inside the centre cone),
  well after the travel. The slide's argument runs in three beats — one
  figure walks, a crowd follows, they stand in the new tribe — and only
  the first is an action build. Fixing it: 0.8087 → 0.9285.
- **Deck 57 scored 0.8301** because I listed no onsets at all, reasoning
  that its single build arrives with the transition and has no interior
  onset to fit. True, and irrelevant: `preBuild` correctly hides a built
  target until its build fires, so an empty list held "Memetic Nomads"
  off the page for the whole segment. Fired at the segment's own start:
  0.8301 → 0.9467.

The second is P-2's slide-32 lesson from the other side — that chapter
found a page **over**-drawing an unbuilt label, this one found a page
**under**-drawing a built one — and the shared root is that `preBuild`
makes the onset list load-bearing for presence, not just for timing.

## 9. What is NOT this chapter's, each residual named

**1. `apple:fade and move` and `fade and move character` remain
unimplemented** — five and five in the deck, four of the former on deck
55 and two of the latter on deck 44. Each is a fade combined with a
translation **whose distance the record does not carry**, the same gap
as deck 10's action-scale, and the same answer under the refused-fits
rule. `Slide.unsupported()` reports them.

Deck 55's four are handled a step further than "skipped", because
skipping them renders a frame known to be wrong: they are played **as
fades only**, on the measured 803.86 onset. A `fade and move` whose move
is unknown is at least a fade, and stating the half the record supports
beats holding ink the reference has dropped. Deck 44's two are left
entirely alone (their targets are lit by `cutIn`) because there the
motion is the whole content.

**2. Deck 58 skips one drawable** —
`kTSDRightSingleArrow:synthesis-unverified`, the large white arrow
between the two halves, and the same parametric-arrow class P-7 found
degenerating on its cursors. It is ~1.7% of that frame's ink, and the
segment passes at 0.9724 with it missing. Not this chapter's to fix;
named so the number is read with it in view.

**3. Deck 58's coverage_ours 0.9303** is the lowest in the chapter and
it is the fat-text-stroke gap P-5 recorded as "the one systematic gap
nobody owns" — this is the most text-dense tableau in the row (three
text records including a two-line centred title). It moves in the
direction P-5 predicted, on the kind of slide P-5 predicted.

**4. Deck 43's coverage_ref 0.9544** is the antialias residual of §3,
and it is the one number in the chapter that a further inset would
improve. It was deliberately left; see §3 for why.

## 10. Where the code lives

| file | what |
|---|---|
| `core/vocabulary/Slides/Builds.ts` | `KEYNOTE_EASE_S`, `keynoteEase`, `EASE_SAMPLES`, `keynoteWaypoints`, `ACTION_SCALE`, `ACTION_SCALE_D56`, `scaleAnim`, `rampOpacity`'s `keynote` flag — additive |
| `core/vocabulary/Slides/Slides.ts` | `SlideFill.inset` + `insetLoop` + `MAX_INSET_RATIO`, `Slide.fills`, `Slide.scaleFactors`, the `ACTION_SCALE` branch in `build()` |
| `core/demo/pl02/Fractal01.ts` | **new** — decks 43, 44, 54-58, registered `p02j` |
| `core/demo/pl02/FillProbe.ts` | **new** — the occlusion A/B, `p02jFillOn` / `p02jFillOff` |
| `core/test/fractal.test.ts` | **new** — 13 tests |
| `core/test/motion.test.ts` | P-7's two ripple tests rewritten for the mechanism that replaced them; four tests added |
| `core/scripts/key2ts.ts` | `CHAPTER_SLIDES` += 43, 44, 54, 55, 57, 58 (bare regenerate) |
| `core/demo/scenes.ts` | three registration lines |

Nothing in `render/**`, `src/**` or the importer trio was touched. The
six new slide modules add 345 KB; every pre-existing module regenerates
byte-identical, only the barrel changed.

## 11. Gates

- `bunx tsc --noEmit` — **clean**.
- `bun test` — **1166 pass, 0 fail** (1148 inherited + 13 new + 5 net
  from the motion-test rewrite).
- **S04 gauntlet — 6/6 PASS**, mean coverage ref **0.9946** / ours
  **0.9954** — identical to P-1's through P-7's to four decimals.
- **P-8 segments — 7/7 PASS**, unmasked whole-frame, no image ceilings.
- **P-8 mid-build — 7/7 PASS.**
- **Regressions — P-3 3/5 bit-identical, P-4 4/4, P-5 7/7, P-7 9/9 + 7/7
  mid-build** (§3 has the per-frame movement).
- Servers killed (4620, 4190).

## 12. What later chapters inherit

1. **Keynote's ease is s = 0.42, not the framework's 0.25** (§2), and it
   applies to every build in the deck including the 229 that declare no
   `acceleration` — that last part is an inference, stated as one. A
   chapter that wants to revisit it should measure a long dissolve; the
   deck has fifteen 2.0s ones.
2. **A `linear` sequence reproduces any curve its waypoints sample.**
   That is how a vocabulary states an ease the framework's four names
   cannot, without touching `src/`, and it removes rather than
   pre-compensates the per-pair ripple. `motion.test.ts` has the bound
   and the convergence across the family.
3. **Occlusion is tested at scale and correct** (§3); a fill is inset by
   half its outline's stroke width. **P-9's 70 fills and P-10's 15 can
   be trusted.**
4. **An undeclared magnitude can still be MEASURED** where the footage
   isolates it (§4) — that is the same standing every onset has. The
   discipline is to make it per-build and opt-in (`Slide.scaleFactors`)
   so an unmeasured record keeps reporting itself unsupported, rather
   than to make the effect globally "supported" on one measurement.
5. **Check the row's hypothesis against the census before building**
   (§1). Two of eight rows have now dissolved on measurement.
6. **Score a build's target with an EXCLUSIVE mask** (§5). On deck 43
   the shared-pixel version moved six onsets by up to 0.18s and
   quintupled the residuals — enough to mis-read the firing model.
7. **Two settled frames do not show what happened between them** (§7).
   A segment boundary is exactly where that bites, and it cost this
   chapter a wrong fact request.
8. **A missing build looks like a wrong build until you read the
   composite** (§8). Both of this chapter's first-pass failures were
   pure-red regions, which is the unmistakable signature — and one of
   them was a slide I had deliberately given an empty onset list.
