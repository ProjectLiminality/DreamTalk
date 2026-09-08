# P-3 — the two dominant builds, on the opening arc

Chapter P-3 of the PL02 campaign: the deck's two most-used build
animations, implemented against its own records and scored against the
footage's own measured onsets, on deck slides 2-6 (video 0.6-134.8s).

**The timing gate is met outright, and it is the chapter's real claim.**
All twenty implemented builds fire within **0.1s** of the value fitted
from the footage — inside the 0.2s frame interval of the 5 fps reference,
so the residual is not resolvable. The stills gate is met on the three
segments that carry no inherited importer gap, and on both of the other
two once those gaps are excluded region by region; §4 says exactly what
each remaining number is made of.

**Post-chapter (2026-09-08): 2/5 became 3/5 with no change to this
chapter's code.** A `textBaseline` fix landed by P-5 — the `middle`
branch was off by half a descent, affecting 43 of the deck's 44 text
records — moved segment 6 from 0.9979/0.8515 FAIL to **1.0000/0.9670
PASS**, and lifted every other segment's `coverage_ours` with it. §4
carries both readings and §5.4 records what I got wrong about the
original number.

## 1. The two verbs, as the data names them

Not chosen — counted. Slides 2-6 carry 25 build records:

| effect | count | what it is |
|---|---|---|
| `apple:dissolve character` | 15 | uniform opacity ramp |
| `apple:dissolve` | 5 | the same ramp, other spelling |
| `com.apple.iWork.Keynote.LineDrawForLine` | 4 | spatial draw-on |
| `apple:action-motion-path` | 1 | a windowed `Move` — §6 |

So the two are **`dissolve character`** and **`LineDrawForLine`**, and
with `dissolve` folded into the first they cover 24 of 25 here. Deck-wide
the same two cover 263 of the 384 builds in slides 1-58.

### `dissolve character` is NOT a per-glyph cascade

The brief anticipated one, and so did the recon report ("a plain
per-glyph alpha ramp, distinct from Write"). **The footage refutes it.**

Slide 2's four `dissolve character` builds target the eagle, tree, sun
and apple icons, and each fades as ONE PIECE. Mean luminance over the
icon's own final ink mask, eagle (build 4880412):

| t | 4.0 | 4.2 | 4.4 | 4.6 | 4.8 | 5.0 | 5.2 | 5.4 |
|---|---|---|---|---|---|---|---|---|
| mean | 0.0 | 2.7 | 15.7 | 60.6 | 135.0 | 201.9 | 221.1 | 222.5 |
| norm | 0.00 | 0.01 | 0.07 | 0.27 | 0.61 | 0.91 | 0.99 | 1.00 |

A cascade fills the mask SPATIALLY — some strokes at full strength while
others are black. This does not: the whole mask rises together on one
S-curve, and the tree, sun and apple repeat it to within a percent.

Two reasons, both in the data rather than in the rendering. On slide 2 all
four targets are **shapes, not text** — Keynote lets a text effect be
applied to any drawable and falls back to the whole-object form when
there are no characters to dissolve. And every one of the 25 records in
the arc declares `delivery: "All at Once"`, which is Keynote's own words
for "not per character". Nowhere in the opening arc does the deck ask for
a cascade.

So `dissolve` and `dissolve character` compile to the same anim, and that
identity is **read off the records**, not assumed. The per-glyph hook
(`Text.letters`, `writeWindows`, the renderer's `glyphWindow` attribute)
is still there for the chapter that meets a real per-character delivery;
it has not been reached for, because nothing has asked.

### `LineDrawForLine` is a spatial draw, and it runs centre-outward

Measured on the eagle's dotted connection line, ink extent along a
corridor holding neither endpoint's icon (x = 0 at the eagle, x = 197 at
the Vitruvian figure):

| t | 3.4 | 3.6 | 3.8 | 4.0 | 4.2 |
|---|---|---|---|---|---|
| x-span | 192-197 | 151-197 | 57-197 | 5-197 | 0-197 |

The line GROWS from the centre outward at full brightness — a draw, not a
fade. On a `DottedLine` that is exactly the dash-by-dash sweep the
primitive already owns, so the verb is `Create` with the deck's pacing.

Which end it starts from cannot be taken from the stored point order,
because the deck does not agree with itself: three of slide 2's four
lines are stored outer-to-inner and one inner-to-outer, while all four
draw centre-outward in the footage. P-1 has since carried the deck's own
`direction` field (51 once, 52 three times here) on the evidence in this
chapter; the consumer states its own reading — resolve from the geometry,
nearest end first — rather than inheriting a semantics that four samples
cannot establish.

## 2. What is declared and what is measured

The chapter's central division, and the thing every number below is
sorted by.

**Declared** (read, never fitted): each build's effect, its target, its
easing, its duration — 1.0s for all 25 — and, since P-1 carried the chunk
list, the ORDER builds fire in.

**Measured** (exists only in the footage): when each fires. Every chunk in
the deck is Keynote's advance-on-click default; the video is David
clicking through while narrating.

The declared ORDER predicts the footage exactly. The chunk list for
slide 2 runs Vitruvian, then (line, icon) for eagle, tree, sun, apple,
then the four lightning glyphs — and the measured onsets run 2.4,
3.2/4.23, 5.22/6.23, 7.6/8.24, 9.2/10.22, 11.6. Same sequence, same
interleave, nothing reordered to achieve it.

### How the onsets were obtained

A frame-differenced scan locates each event to the 0.2s frame interval,
and that is not good enough: at 5 fps a 1.0s ease-both ramp is six
samples and the first sits at whatever alpha the encode's floor catches.
So each onset is the start time obtained by **inverting the deck's own
declared curve** — a 1.0s smoothstep — through every partial sample of
that object's ramp. Four samples per icon, four independent fits:

| icon | t0 | sd |
|---|---|---|
| eagle | 4.228 | 0.025 |
| tree | 6.233 | 0.021 |
| sun | 8.238 | 0.023 |
| apple | 10.220 | 0.024 |

That is a derivation *given* the declared duration, not a fit *of* it:
the curve and its length are read from the deck and only the offset is
solved for. The gaps that fall out — **2.005, 2.005, 1.982** — are David
clicking at a steady two seconds, a quantity that exists nowhere in the
file and is exactly what the O-11 refinement admits as measured.

**Where the two kinds of number conflict, the onset moves.** Slide 5's
`Out` ramp fits its four samples better at a 0.8s duration
(sd 0.020) than at the declared 1.0s (sd 0.034). The deck says 1.0, so
the duration stands and the onset takes the value 1.0s implies: 115.85.

### The one thing the deck gets wrong about its own timing

Each chunk carries `automatic`, and on slide 2 twelve of thirteen are
true — "fires with the previous build". Read literally that is ONE event;
the footage shows seven. The flag describes what the deck would do played
back untouched. It is not used for grouping here, and the grouping is
measured with the rest of the pacing.

## 3. Onset verdicts — the timing gate

Every implemented build, ramp midpoint measured against ramp midpoint:

| slide | build | effect | measured | ours | delta |
|---|---|---|---|---|---|
| 2 | 4881284 | LineDrawForLine | 3.9 | 3.8 | -0.1 |
| 2 | 4881256 | dissolve character | 4.7 | 4.8 | +0.1 |
| 2 | 4880370 | LineDrawForLine | 5.7 | 5.8 | +0.1 |
| 2 | 4880412 | dissolve character | 6.7 | 6.8 | +0.1 |
| 2 | 4882704 | LineDrawForLine | 8.1 | 8.2 | +0.1 |
| 2 | 4882723 | dissolve character | 8.8 | 8.8 | 0.0 |
| 2 | 4882778 | LineDrawForLine | 9.9 | 9.8 | -0.1 |
| 2 | 4883958 | dissolve character | 10.8 | 10.8 | 0.0 |
| 3 | 4890648 | dissolve character | 32.5 | 32.5 | 0.0 |
| 3 | 4890801 | action-motion-path | 32.5 | 32.5 | 0.0 |
| 3 | 4890815 | dissolve character | 32.5 | 32.5 | 0.0 |
| 3 | 4895353 | dissolve character | 33.9 | 33.9 | 0.0 |
| 3 | 4895689 | dissolve character | 33.9 | 33.9 | 0.0 |
| 4 | 4895439 | dissolve character | 46.5 | 46.5 | 0.0 |
| 4 | 4897553 | dissolve character | 46.5 | 46.5 | 0.0 |
| 4 | 5538572 | dissolve character | 46.5 | 46.5 | 0.0 |
| 4 | 5538573 | dissolve character | 46.5 | 46.5 | 0.0 |
| 5 | 5538696 | dissolve character (Out) | 116.3 | 116.4 | +0.1 |
| 5 | 5538697 | dissolve character (Out) | 116.3 | 116.4 | +0.1 |
| 5 | 5538698 | dissolve character (Out) | 116.3 | 116.4 | +0.1 |

**Worst |delta| 0.1s**, against a 0.2s reference interval. (Twenty
builds once slide 3's motion path landed — §6.)

Getting there needed two real fixes, both of which produced a scene that
looked plausible while being wrong:

**Builds overlap, and the Dream cursor cannot express that.** The eagle's
icon starts fading at 4.23 while its line, started at 3.2, is still
drawing. `play()` puts a clip at the cursor and advances past it, so each
build was pushed to the end of the previous one — clips landing at 4.40,
5.40, 7.80 where the footage has 4.23, 5.22, 7.6, a uniform **+0.6s** lag
across all nineteen. Fixed by placing clips absolutely (`play()` returns
its Clip for exactly this). Pinned by test, because settled-frame scores
are completely blind to it.

**A motion scan finds where something changed, not what changed.** Slide
5's `Out` builds were first read at 98.2, where the scan shows motion.
That motion is the incoming Magic Move settling; what arrives at 99.0-99.4
is two "Story" labels slide 5 has no build for. The blue side's own mask
holds flat at 150.9 from 101.4 to 115.8 and is gone by 116.8. Scored the
wrong way the segment read 0.4916/0.9028, with the whole blue half in
reference-only red.

## 4. Per-segment stills

Reference frames are chosen AFTER each segment's last event, per P-2's
slide-32 lesson. The gauntlet bar is coverage ≥ 0.90 on BOTH and both
chamfers ≤ 3.0 px.

### Whole frame, nothing excluded

At the chapter's close, and again after P-5's `textBaseline` fix landed:

| seg | frame | video s | at close | after the baseline fix | verdict |
|---|---|---|---|---|---|
| 2 | f_00081 | 16.0 | 0.4878 / 0.9143 | 0.5134 / 0.9732 | FAIL |
| 3 | f_00201 | 40.0 | 0.3675 / 0.9236 | 0.4059 / 0.9959 | FAIL |
| **4** | **f_00451** | **90.0** | 0.9999 / 0.9471 | **0.9999 / 0.9920** | **PASS** |
| **5** | **f_00591** | **118.0** | 1.0000 / 0.9029 | **1.0000 / 0.9853** | **PASS** |
| **6** | **f_00651** | **130.0** | 0.9979 / 0.8515 | **1.0000 / 0.9670** | **PASS** |

**2/5 at the close, 3/5 now.** Segments 4, 5 and 6 carry no inherited gap
and pass; 2 and 3 keep their verdicts because they are capped by ink no
type fix can supply (§5.1).

The chamfers after the fix are 0.211/6.701, 0.217/8.350, 0.356/0.040,
0.647/0.000 and 0.807/0.003 — every ours→ref figure now under 0.9 px.

### Decomposed, with regions excluded from DECLARED geometry

Every mask below is a box the deck states — the `super.geometry` of an
archive the decode skips, or a text record's own metrics. None was drawn
around a region because it scored badly, and the unmasked table above
remains the headline.

| what is excluded | cov_ref | cov_ours | chamfer | verdict |
|---|---|---|---|---|
| **seg 2**, five dropped images (47.1% of ref ink) | **0.9631** | **0.9778** | 0.180/0.342 | **PASS** |
| **seg 2**, + the four stale connection lines (53.0%) | **0.9921** | **0.9968** | 0.042/0.132 | **PASS** |
| **seg 3**, the dropped image alone (59.4%) | **0.9999** | **0.9959** | 0.217/0.081 | **PASS** |
| seg 3, + the stale connection line (68.4%) | 0.9999 | 0.9949 | 0.250/0.052 | PASS |

Segment 3 needs only the dropped image excluded to reach **0.9999 /
0.9959** — the stale connection line no longer moves it enough to matter.
Segment 2's second row is the chapter's sharpest: the four icons the
`dissolve character` builds drive, alone, at **0.9921 / 0.9968** with
chamfers of 0.042 and 0.132 px.

Every exclusion above is ONE of two inherited causes — drawables the
importer does not compose, and connection lines whose stored paths are
stale. Neither is a build.

### Mid-build frames

Settled frames cannot see a timing error, so the builds are also scored
mid-ramp:

| frame | video s | what | cov_ref | cov_ours | verdict |
|---|---|---|---|---|---|
| **f_00025** | **4.8** | eagle mid-dissolve, images masked | **0.9716** | **0.9922** | **PASS** |
| **f_00035** | **6.8** | tree mid-dissolve, images masked | **0.9352** | **0.9599** | **PASS** |
| f_00233 | 46.4 | slide 4 labels mid-dissolve | 0.9999 | 0.7431 | FAIL |
| f_00585 | 116.8 | slide 5 Out mid-dissolve | 1.0000 | 0.5295 | FAIL |

**Two genuine mid-dissolve frames now pass in-band** — the strongest
evidence in the chapter for the ramp itself, since a settled frame cannot
distinguish a correct ramp from a correct endpoint.

The last two have `coverage_ref` at 1.0 — everything the reference has,
we have — and low `coverage_ours` because at 0.01 alpha our antialiased
strokes still cross the overlay's luma-32 threshold where the reference's
JPEG has quantised to black. The ramps themselves agree: ours runs
0.920 / 0.697 / 0.433 / 0.182 / 0.011 against the reference's measured
0.970 / 0.738 / 0.379 / 0.117 / 0.000, within 0.05 at every sample.

## 5. What is NOT this chapter's, with each residual named

Every failing number above decomposes into one of four causes, none of
them the build verbs. All four are reported to `p1-keynote` with evidence.

**1. Five `TSD.ImageArchive` drawables are not composed.** Slide 2's
Vitruvian figure and four lightning glyphs; slide 3's Vitruvian. The
figure alone is **47%** of segment 2's reference ink and **60%** of
segment 3's. Their five `dissolve` builds have nothing to drive — which is
reported by `Slide.missingBuildTargets()` rather than passed over,
because a build with no target must not look like a build that never
existed.

**2. Connection lines' stored paths are STALE.** A
`TSD.ConnectionLineArchive` is recomputed by Keynote from the objects it
connects. Slide 2's four lines all connect to the dropped Vitruvian image;
fitting the eagle line's 584 measured ink pixels gives slope 0.5862 where
the stored path says 0.6816, and extrapolating the measured line to the
image's centre x lands **0.3 px** from that centre. Slide 3's line 4515938
is the same story — its stored path is a short diagonal in the lower left,
the footage draws a long horizontal at the exact y of both connected
objects' centres. Five for five across two slides.

*This is the finding that matters beyond P-3.* P-4 owns the connection
meshes (10-30 lines per slide, 70 on slide 11) and would find it the
expensive way. The fix is coupled to the images: recomputing a line needs
its endpoints to exist.

**3. RESOLVED during the chapter: `apple:action-motion-path`.** Slide 3's
"Story" carries a translation of (-1.388, -229.910) slide units, stored
in the BuildArchive at `attributes.actionMotionPathSource`. Unmoved, the
label rendered inside the lens the reference has it above. Reported;
P-1 carried the path; implemented here as a windowed `Move` (§6), which
took segment 3 from 0.7969 to **0.9236** `coverage_ours` and its chamfer
from 2.314 to 0.738 px.

**4. The antialiasing shoulder — and a CORRECTION, because I attributed
too much to it.**

Our ink runs wider than the reference's at the same threshold: 1.31x on
P-2's title card, 1.58x on P-2's slide 5, 1.75x on segment 6. I read
segment 6's 0.8515 `coverage_ours` as that shoulder and wrote that it
"is not a build". The second half holds. **The first half was too
confident.**

A systematic BASELINE OFFSET was also in that number — the `middle`
branch of `textBaseline` was off by half a descent, on 43 of the deck's
44 text records (found and fixed by P-5). With it corrected, segment 6
goes to **1.0000 / 0.9670** and passes.

The diagnosis I should have run, and did only afterwards: the render
before and after the fix **lost 2012 px and gained 2104 px**, in the same
x-range, with the two bounding boxes about ten rows apart (lost y
294-571, gained y 304-581). That is type moving DOWN onto the reference's
baseline. Meanwhile the ink RATIO barely moved — 1.745x to 1.757x —
which is the tell: the shoulder was real and unchanged, and it was
sitting in the wrong place.

**The lesson, stated against my own §10.4.** I compared segment 6's ink
ratio against P-2's frames, found it consistent, and stopped. A ratio can
be right while the ink is displaced; volume and position are independent,
and "how much ink" cannot answer "is it where the reference has it". The
residual now is 465 px of 14106 (3.3%) further than 3 px from any
reference ink, and 382 of those sit in the "Liminality" band — the
largest type on the slide, where any remaining metric error shows most.

For the record, **this chapter's arc cannot test P-5's fills at all**:
not one shape in slides 2-6 carries a fill (0 of 8, 5, 4, 2 and 1
respectively), so `SlideFill` composes nothing here. All five segments'
gains are the baseline fix.

## 6. Two fixes landed in this chapter's own area

### The motion path, implemented rather than scored wrong

`apple:action-motion-path` is NOT one of the chapter's two verbs and its
build class belongs to P-7. It is implemented anyway, for one reason:
once P-1 carried the declared path, leaving slide 3's label 230 units
out of place would have meant scoring a frame known to be wrong for a
reason already in hand.

What is claimed is narrow. The path is declared relative to the
drawable's own position, so `motionAnim` reads the ENDPOINT and moves
there — exactly right for the 32 of the deck's 34 motion paths that are
straight two-node runs. The two genuinely curved ones would need their
intermediate points; both are outside the opening arc.
`motionIsStraight()` says which kind a record is, so P-7 inherits a
stated boundary rather than a surprise.

One structural consequence, pinned by test: an `Action` build's target is
already on screen — the motion moves it, it does not bring it on — so it
must be exempt from both `preBuild()` and `cutIn()`'s hold-back. Hiding
it would blank a drawable the footage shows throughout the segment.

### The dotted-line dash period was 33% short, and the cap is why
Slide 2's connection lines drew 14 dots over a corridor where the
reference draws 10. Keynote states dash arrays in stroke-width multiples,
and `Slides.ts` was computing the period as `(dash + gap) · w` = 14.674
video px against a measured ~21.9.

A round cap paints half a stroke width beyond each end, so a dash of
length d occupies d + w and the period is `(dash + gap + 1) · w` = 22.007
px — 0.5% from the measurement. I could not close this from pixels alone
(one clean corridor, three contaminated), reported it, and **P-1 settled
it from the stylesheet**: every (0.001, 2.0) dotted pattern in the deck is
`RoundCap` and every other pattern is `ButtCap`. Read, not fitted.

Consuming `SlideShapeData.cap` moved segment 2's `coverage_ours` from
0.8725 to 0.9143 and its ours→ref chamfer from 1.347 to 0.924 px.

One wrinkle for other consumers: `dashRuns` lays out CENTRE-LINE lengths
and knows nothing about caps, so the `gap` handed to `DottedLine` is the
deck's gap adjusted for the cap the primitive does not draw
(`(pattern[1] + 1)·w − dash` for a round cap).

## 7. Where the code lives, and why

**Builds are in `core/vocabulary/Slides/`, not in `src/verbs.ts`.** A
Keynote build is not an animation kind — it is a SCHEDULING unit: one
effect, one drawable, fired at a click. The effect is something the
framework already has, so what the module supplies is the WINDOW, not the
motion; the anim inside it is `creation.sequence(0, 1)` or an opacity
ramp. That makes it slide-domain vocabulary, meaningless without a deck's
record to read, and it belongs beside the holon.

**Neither of the two generalises past slides today**, so neither has been
promoted. The ability-module pattern would apply if one did — the natural
candidate is a per-glyph dissolve, if a later chapter meets a real
per-character delivery — and inventing that generality now is the
speculative people-pleasing CLAUDE.md warns against.

| file | what |
|---|---|
| `core/vocabulary/Slides/Builds.ts` | **new** — the two verbs, the direction rule, the pre-build state |
| `core/vocabulary/Slides/Slides.ts` | `byId`, `build()`, `preBuild()`, `visible()`, `cutIn()`, `missingBuildTargets()`, the round-cap dash period |
| `core/demo/pl02/Arc01.ts` | **new** — the opening arc, registered `p02a` |
| `core/scripts/pl02-gauntlet.ts` | `index@t` per-frame hold times, for a multi-segment scene |
| `core/scripts/pl02-masked.py` | **new** — the decomposition scorer (§4) |
| `core/test/builds.test.ts` | **new** — 20 tests |

### Two things the renderer forced

**A `DottedLine` draws nothing itself.** Opacity is read per drawn
primitive with no inheritance down the tree, and a DottedLine is a parent
of one `Line` per dash — so hiding one changes no pixel. Four connection
lines survived a page cut and stayed on screen for seventy seconds before
this was found. Every opacity in the chapter goes through a helper that
reaches the dashes.

**`Slide.opacity` is not a page-level control** for the same reason: the
first version of this scene drew all five slides on top of one another.
`visible()` and `cutIn()` drive the parts.

## 8. The Magic Moves, held

Four of the arc's five transitions are
`magic-move-implied-motion-path` (2.0, 2.0, 2.0, 1.5s) and the fifth a
1.5s `BLTFadeThruColor`. **All five are rendered as CUTS**, and no frame
inside one is scored:

| between | effect | declared | held window |
|---|---|---|---|
| 1 → 2 | MagicMove | 2.0s | 0.6 |
| 2 → 3 | MagicMove | 2.0s | 19.2 → 21.4 |
| 3 → 4 | MagicMove | 2.0s | 44.6 → 45.8 |
| 4 → 5 | MagicMove | 1.5s | 97.6 → 99.4 |
| 5 → 6 | FadeThruColor | 1.5s | 118.8 → 120.4 |

Magic Move is P-6's whole subject — a matched-object interpolation across
two tableaux, not a fade — and a cross-dissolve stood in for it would
produce frames that look approximately right for the wrong reason. The
outgoing page is held to its last settled frame and the incoming page
appears at its first.

## 9. Gates

- `bunx tsc --noEmit` — **clean**.
- `bun test` — **1123 pass, 0 fail** at the last re-run (20 mine; the
  baseline keeps moving as other chapters land tests).
- **S04 gauntlet — 6/6 PASS**, mean coverage ref **0.9946** / ours
  **0.9954** — identical to P-1's and P-2's to four decimals, so nothing
  in this chapter perturbed the video-01 reproduction.
- Opening arc — **3/5 whole-frame** (2/5 at the chapter's close; P-5's
  `textBaseline` fix moved segment 6), **5/5** once the two inherited
  importer gaps are excluded region by region (§4); **20/20 onsets within
  0.1s** (§3).

## 10. What P-4 and later chapters inherit

1. **Connection lines are stale — assume it.** §5.2. This is the one that
   will cost P-4 real time if it is not settled first, and it is coupled
   to the images question.
2. **The build/schedule division holds.** Durations and order are read;
   onsets are measured by inverting the declared curve through the
   object's own ramp. Do not fit a duration to make an onset land.
3. **Place build clips absolutely.** Builds overlap; a forward-only
   cursor silently lags the whole scene and settled frames cannot see it.
4. **Score the coverage PAIR, and decompose a failure before believing
   it.** P-2's lesson, and §4's table is what following it looks like:
   the same frame reads 0.5134 or 0.9921 depending on whether you have
   accounted for what the importer did not compose.
5. **This arc composes ZERO fills** — 0 of 8, 5, 4, 2 and 1 shapes across
   slides 2-6, confirmed by walking the composed tree (only `Line`,
   `Connection`, `Text`, `Slide` appear). That makes it a clean
   REGRESSION CONTROL for the fill work: `p3-regression-baseline.json`
   holds the five segment scores, and a fill change that moves any of
   them has reached something it should not have.
6. **Ink VOLUME and ink POSITION are independent, and a ratio answers
   only the first.** §5.4 is my own violation of this: I matched segment
   6's ink ratio against P-2's frames, found it consistent, and called
   the residual antialiasing. Half of it was a baseline offset. The check
   that would have caught it costs one line — how much of our ink sits
   further than the tolerance from ANY reference ink, and where.
5. **A motion scan is not an event detector.** Use the object's own ink
   mask, especially where a transition and a build are close.
