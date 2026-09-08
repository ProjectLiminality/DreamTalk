# P-10 — the density peak, and the firing model it settled

Chapter P-10 of the PL02 campaign, the last build chapter: deck slides
11, 12 and 13, video seconds 199.4 to 220.0. Deck 11 is the video's
densest tableau — 210 shapes, 70 connection lines, 105 groups, 105
builds, all inside fifteen seconds.

**The row's title is DENSITY, and under the standing instruction that a
row title is a hypothesis, the census says the row is right about the
scale and wrong about what is hard in it.** Nothing here strains the
renderer. What deck 11 turned out to be is the **firing model's
discriminator** — the one slide in the deck carrying both of Keynote's
automatic-advance cases side by side under otherwise identical
declarations, so the footage can tell them apart. That resolves the two
chunk-order exceptions P-7 and P-8 left standing, and retires the
"effective duration" refinement as a description of something the format
states outright.

## 1. What the census demanded

Read first, per the standing instruction, before any frame was scored.

**The structure is seven clusters of five, not fourteen of seven.** The
recon describes "a field of ~14 miniature social organisms, each itself a
7-node dotted mesh". It is **7 clusters x K5 = 70 lines over 35 nodes** —
exactly what P-4 predicted for this chapter from the other side. The
seven clusters are translated copies of one another to a maximum
deviation of **0.0010 slide units**, so the tableau is one cluster placed
seven times. Each node is a group of a `Fire_80` over two `Head_652`, and
every one of the 70 heads carries a black fill, so every node composes a
`SlideFill` (P-5's capability, trusted at scale per the amendment).

**All 70 lines carry an arrowhead**, which is the fact P-1 flagged when it
found end decorations at all: 70 of the deck's 142 are here. Every one is
`simple arrow` — the filled triangle `(0,0) (3,6) (6,0)`, `endPoint`
(3,0) — so P-4's identity dispatch never reaches its `filled circle` or
tail branches on this slide. That it was *built* to is what makes the 70
safe. All 70 are quadratic, 2.0 wide, solid, `outset` 10/10, and all 140
endpoints are GROUPS resolving by P-4's recursive union with **zero
falling through to a stored path**.

**Decks 12 and 13 have zero builds.** Both are held tableaux reached by
Magic Move: 30 dotted `(0.001, 2.0)` RoundCap lines each (two K6 meshes),
12 `Head with Shoulders_826`, one red ring. The census surfaced what the
run of slides is *about*: **deck 12's two meshes are superimposed** — its
twelve head centres are six positions occupied twice, to the unit. So
deck 12 draws as one six-person organism and decks 13 and 14 pull the two
coincident meshes apart. One organism dividing, told entirely through
Magic Move on matched objects, with not a single build.

## 2. The firing model — the chapter's real subject

### The arithmetic that does not fit

Deck 11 declares 105 builds in 105 chunks: two clicks (0 and 35) and 103
automatic. Read through the rule the campaign had settled — an automatic
chunk fires one declared duration after its predecessor — the 70-line
cascade alone runs `69 x 2.25 + 2.25 = 157.5 seconds`. **The segment is
15.0 seconds long.**

That looks exactly like P-9's truncation finding, and the brief asked me
to check it. **IT IS NOT TRUNCATION.** All seventy lines are fully drawn
and settled at `f_01064`, t = 212.6s, with 1.4 seconds of hold to spare.
Nothing is cut off. The cascade simply is not a cascade.

### The field that says so

`KN.BuildChunkArchive` carries a boolean **`referent`** that the decoder
was dropping. Read with `automatic`:

| | |
|---|---|
| `automatic: false` | waits for a click |
| `automatic` + `referent: true` | fires one declared duration after its predecessor (a **step**) |
| `automatic` + `referent: false` | fires **WITH** its referent — simultaneously, no step |

Deck 11 discriminates because both cases occur on **one slide**, with the
same `automatic: true`, the same `chunkId: 1`, the same click structure.
Everything the campaign had been reading is identical across the two
groups; only `referent` differs.

| chunks | builds | referent |
|---|---|---|
| 0–34 | 35 `dissolve`, 0.30s | all **true** |
| 35–104 | 70 `LineDrawForLine`, 2.25s | 1 true + **69 false** |

**Measured, per node**, on each node's own box, in the deck's declared
chunk order (frames 996–1074):

```
199.40 199.80 200.00 200.40 200.60 201.00 201.20 201.60 201.80
202.20 202.40 202.80 203.00 203.40 203.60 204.00 204.20 204.60
204.80 205.20 205.40 205.80 206.00 206.40 206.60 207.00 207.20
207.60 207.80 208.20 208.40 208.80 209.00 209.40 209.60
```

Thirty-five firings, in the declared order element for element,
least-squares step **0.3000s against a declared 0.30 — ratio 1.0000,
residual sd 0.050s**, a quarter of one frame interval. That is the
sharpest confirmation of the stepping rule anywhere in the campaign: 35
steps, one slide, no pooling.

**Measured, per line**, on each line's own quadratic corridor with both
endpoint node boxes excluded so a node's ink cannot be mistaken for a
line's (frames 1048–1069, 70 lines):

> onsets span **211.20 to 211.60** — 0.40s total, two frame intervals —
> least-squares step in chunk order **0.0007s against a declared 2.25**
> (ratio 0.0003), mean peak corridor hit-rate **1.000**.

Seventy lines firing inside two frames is not a 157-second chain.

### It retrodicts every measurement on record

Which is what raises it above a reading that merely fits this slide:

| slide | `referent` | what was measured | |
|---|---|---|---|
| deck 8 (P-4) | all true | ten firings ~0.5s apart | agrees |
| deck 15 (P-5) | all true | automatic gaps 0.995–1.008x | agrees |
| deck 16 (P-9) | chunks 1–11, 13–23 **false**; 12 true | 12 heads together (sd 0.013s), 12 spokes together (sd 0.126s), one 2.0s step between | agrees |
| deck 43 (P-8) | chunk 8 **false** | "ONE apparent exception, fires WITH its predecessor, **reported unresolved**" | **RESOLVED** |
| deck 53 (P-7) | chunks 1–2 **false** | "two LineDraws LEAD the fade-and-move by 0.68s where the chunk list says they trail by 2.0s" | **RESOLVED** |
| deck 56 (P-8) | chunk 1 **false** | action-scale firing with the motion path | agrees |
| deck 59 (P-9) | all true | 33 strict steps | agrees |

So **both standing chunk-order exceptions were the same fact**, and P-7's
"effective duration" refinement was a correct description of a case the
format states directly. P-9 had to account for deck 16 as "the model at a
density where twelve steps fit inside one frame"; the field says it
outright, and the arithmetic stops being a coincidence of sampling.

**What it does NOT explain**: deck 59's unexplained 0.85–0.87x stepping
ratio. Deck 11's own steps measure 1.0000x, so that anomaly is untouched
and **stays open**.

The field is now carried on `KeyBuildChunk.referent` (the lead landed it;
present on all 554 chunks in the file and genuinely varying — 254
`(automatic, false)`, 151 `(click, true)`, 149 `(automatic, true)`).

### Why the scene derives its onsets rather than listing them

Every prior chapter hand-listed a measured onset per build, which is
right when the onsets are independent measurements. Here they are not:
**two clicks are measured, and the other 103 firings follow from the
deck's own structure through the rule above.** Listing 105 numbers would
present 103 derivations as if they were 105 measurements and would let a
wrong rule hide inside a correct-looking list. `firingTimes` computes
them, so the rule is what is on trial and the two measured numbers are
visibly the only free ones.

## 3. The draw direction — a fallback meeting the edge of its premise

None of the 105 builds declares a `direction`, so all seventy take the
absent-is-default path, and the chapter's first mid-draw composite showed
every line with our front and the reference's as **mirror images** —
P-4's exact signature for direction 53, arrived at from the other side.

It is not 53. `drawsReversed`'s fallback derives its answer from a premise
P-3 measured on deck 2: *"the deck's connection lines run between a centre
and a periphery, and the footage shows them drawing centre-outward"*. True
of deck 2. Deck 11's lines run between two nodes of one five-node cluster,
so "further from the slide's centre" is nearly a coin toss between two
points a few dozen units apart.

Measured at `f_01055` (~0.4s into the 2.25s draw), corridor sampled with
both endpoint boxes excluded:

| | |
|---|---|
| draws from the `from` end | **56 / 70** |
| draws from the `to` end | **0 / 70** |
| ambiguous | 14 / 70 |
| page-centre fallback agrees with the footage | **31 / 70** |

Zero counter-examples in seventy lines, against a fallback performing at
chance. **On this slide the stored order IS the draw order.**

Stated through a new opt-in `Slide.drawsInStoredOrder` (additive,
alongside `scaleFactors`) rather than by changing the fallback: two slides
now disagree about the absent case with footage behind each, and flipping
the shared default on P-10's evidence would move P-3's arc. The
disagreement is left visible. A declared `direction` still wins over both.

That flag alone took the mid-draw frame from `coverage_ref` 0.8977 to
**0.9911** and `chamfer_ours` from 1.407 to **0.213**.

## 4. Two gaps in the connection draw-on, both measured, both routed — and both since fixed

Both are in P-4's files and were routed to the lead rather than changed
here. **Both were implemented while this chapter was scoring**, and the
re-score is in §7 and §10: deck 11's two mid-draw frames went from
`coverage_ours` 0.82/0.79 to **0.96/0.96**, and P-4's own long-standing
mid-draw FAIL on deck 9 crossed to PASS. The measurements below are the
evidence as it was gathered, before either fix existed.

**The Connection draw-on is LINEAR; the footage is EASED.**
`Connection.createAnim` distributes dashes over uniform windows
`[k/n, (k+1)/n]`. Measured on front position (furthest contiguous lit
fraction), averaged over the 20 longest lines, duration held at the
declared 2.25 and only the offset free:

| | onset | rms |
|---|---|---|
| **eased** | 210.200s | **0.0120** |
| linear | 210.190s | 0.0617 |

5.1x better, and pointwise the measurement tracks the eased curve:
at t=210.8 our linear front is 0.267 where the eased curve predicts 0.147
and the footage measures **0.164**; at t=211.2, 0.444 / 0.405 / **0.397**.
Our overdraw is 11.9% and 3.9% of total line length across 70 lines,
which is the whole of the `coverage_ours` deficit on both mid-draw
frames. **This is the campaign's eighth independent kEaseBoth
confirmation**, on a build class and slide P-8 never used, thrown off by
this measurement rather than sought.

Worth flagging: P-4's own slide-9 mid-draw FAILs (`f_00862` 0.8614,
`f_00866` 0.8466, both at `coverage_ref` 1.0000) have exactly this
signature — "our front running about one dash ahead", which P-4 attributed
to 5 fps sampling. Same shape, same direction, same magnitude; worth
re-running after the fix.

**The arrowhead travels with the front; we put it last.**
`createAnim`'s comment states the assumption — *"the arrowhead arriving at
the end of the shaft because that is where the shaft reaches it"* — and
`drawn()` returns `[...dashes, ...arrows]` so the head takes the final
window. The footage draws the head **at the advancing front from the
first frame**: each line is a half-length stroke with an arrowhead on its
tip, moving. Measured on the 25 longest lines:

| frame | mean front | ink in far 15% of corridor |
|---|---|---|
| f_01055 | 0.164 | **0.000** |
| f_01056 | 0.262 | **0.000** |
| f_01057 | 0.397 | **0.000** |
| f_01058 | 0.540 | **0.000** |

Zero ink beyond the front in every frame. If the head waited at its final
position that column would read ~1.0. Deck 11 is where this is visible
because it is the only slide with 70 heads on simultaneously-drawing
lines; slide 8's ten draw in a stepped cascade with one head in flight at
a time.

**What I did NOT do**: absorb either into an onset. The onset is measured
at 210.20 by the eased fit and stays there; shifting it to hide a curve
error is what the refused-fits rule forbids, and I confirmed it makes the
reproduction worse in exactly the way P-8 warned — it raises nothing and
moves geometry.

## 5. The outset verdict

**10/10 behaves.** Every one of the 70 corridors reaches a peak ink-hit
rate of **1.000** in the settled frame (mean 1.000 over 70 lines),
sampled on the recomputed path with both endpoint boxes excluded, and the
settled frame's chamfer is **0.388 / 0.259 px** on seventy lines whose
start positions are entirely governed by the outset. Sub-half-pixel.

**Does that settle slide 8's residual? No, and the honest answer is
narrower than the brief hoped.** P-4 left slide 8 OPEN with a best
standard deviation of 11.3 slide units after testing six candidate
boundaries. Deck 11 says the outset FIELD is read correctly and applied
correctly at scale, so 11.3 was **not** a defect in how the field is
applied — which is a real narrowing. But slide 8's outset is 30/30 on a
different geometry class (lines to campfire GROUPS whose member ellipse
dominates the silhouette), and nothing measured here reaches that case.
**Slide 8 stays open**, with the search space reduced to its own geometry.

## 6. The boundaries

From this chapter's own sweep of frames 965–1145 (sweep, never landmark).
Decks 12/13/14 were separated by **shape census** — head-centre positions
— rather than by correlation, because the amendment's corollary that a
boundary can hide between near-identical slides applies to them exactly.

| | |
|---|---|
| deck 10 out | 196.6–197.8, then black 197.8–199.2 (ink exactly 0) |
| **deck 11** | **199.40** first ink .. **213.4** last held frame |
| | nodes settle 209.8–210.2 · lines 210.2–212.6 · hold to 213.4 |
| **deck 12** | 214.6 in, settled hold **215.4–216.0** |
| **deck 13** | 216.2 Magic Move, settled hold **218.4** |
| deck 14 | 220.0 on (P-4's, already corrected to 220.2–223.8) |

The recon's table gives slide 11 as 199.4–214.4 and slide 14 as
219.4–227.0. **The 199.4 start is confirmed exactly.** Deck 11 is over by
214.2 (ink 0), and the recon's rows for "12" (214.4–217.0) and "13"
(217.0–219.4) only roughly bracket the settled holds above.

## 7. Scores

Unmasked whole-frame throughout — **these three slides carry zero
images**, so there is no coverage ceiling to excuse and no masked variant
to report. `SlideData.images` is empty on all three.

| frame | video s | what | cov_ref | cov_ours | chamfer | verdict |
|---|---|---|---|---|---|---|
| f_01030 | 205.8 | deck 11, **mid-STEP** (26 of 35 nodes) | 0.9971 | 0.9990 | 0.116/0.141 | **PASS** |
| f_01051 | 210.0 | deck 11, 35 nodes settled, before the lines | 0.9973 | 0.9988 | 0.119/0.135 | **PASS** |
| f_01055 | 210.8 | deck 11, **mid-DRAW**, 70 lines ~0.3 in | 0.9909 | 0.9575 | 0.479/0.202 | **PASS** |
| f_01057 | 211.2 | deck 11, **mid-DRAW**, 70 lines ~0.45 in | 0.9853 | 0.9586 | 0.494/0.240 | **PASS** |
| f_01064 | 212.6 | **deck 11 settled** — all 70 lines in | 0.9819 | 0.9647 | 0.388/0.259 | **PASS** |
| f_01080 | 215.8 | **deck 12 settled** | **1.0000** | **1.0000** | 0.044/0.100 | **PASS** |
| f_01093 | 218.4 | **deck 13 settled** | 0.9821 | 0.9969 | 0.088/0.222 | **PASS** |

**7/7 PASS.** Deck 12 reaches **1.0000 / 1.0000** with a 0.044 px chamfer
— identity to the limit the encode allows, on a tableau of 30 dotted
lines and 12 icons.

**The two mid-draw frames are where this chapter's claims live**, and
they are the ones the §4 fixes moved. Before those landed they read
0.8215 and 0.7890 on `coverage_ours` with chamfers of 2.3, failing in one
direction only — `coverage_ref` already 0.991 and 0.995, everything the
reference draws drawn in the right place, with `coverage_ours` saying we
drew *more*. That is the signature of a front running ahead, and its
magnitude was exactly the linear-minus-eased difference computed in §4.
With the ease and the travelling head in place they read **0.9575 and
0.9586**, chamfer_ours **0.479 and 0.494** — a fivefold chamfer
improvement from two changes that were each measured independently
before either was made.

The methodology asks for settled plus mid-cascade frames, and the
mid-cascade pair here is load-bearing rather than decorative: **a settled
frame cannot distinguish a stepping cascade from a simultaneous one** —
both end in the same tableau. `f_01030` and `f_01057` are the only frames
where a wrong firing model is visible at all, which is why the scored set
contains one of each case.

## 8. Files

| path | what |
|---|---|
| `core/demo/pl02/Density01.ts` | **new** — deck slides 11/12/13, registered `p02l`; `firingTimes` is the rule |
| `core/vocabulary/Slides/Slides.ts` | **additive** — `Slide.drawsInStoredOrder`, default off |
| `core/test/density.test.ts` | **new** — 20 tests |
| `core/demo/scenes.ts` | one import, one registry entry |

Routed to the lead rather than changed here: `KeyBuildChunk.referent`
(landed), and the two `Connection` draw-on gaps in §4.

## 9. What later work inherits

1. **The firing model is settled and now has three parts**, not two.
   `referent` is the field; deck 11 is the discriminator; the two
   standing chunk-order exceptions (P-7's deck 53, P-8's deck 43) were
   the same fact and are closed.
2. **Deck 59's 0.85–0.87x stepping ratio is still open.** Deck 11 steps
   at 1.0000x, so it does not generalise and nothing here explains it.
3. **Slide 8's outset residual is still open**, but narrowed: the field
   is read and applied correctly at scale, so the remaining candidates
   are properties of that slide's own geometry.
4. **The `Connection` draw-on's ease and travelling head are now in**
   (§4), and they moved P-4's deck-9 mid-draw frames as predicted. The
   prediction was made from deck 11's measurements before P-4's frames
   were re-run, which is what distinguishes it from a fit.
5. **`drawsReversed`'s fallback is scoped to its premise.** Two slides
   disagree about the absent-`direction` case with footage behind each.
   Deciding which generalises needs more slides than either chapter has.
6. **A settled frame cannot test a firing model.** Any future chapter
   claiming a cascade shape must score a mid-cascade frame; deck 11's
   105 declared builds settle into a tableau identical under both
   readings.

## 10. Gates

- `bunx tsc --noEmit` — **clean**.
- `bun test` — **1208 pass, 0 fail** across 60 files (1188 baseline +
  20 mine).
- **S04 gauntlet — 6/6 PASS**, mean coverage ref **0.9946** / ours
  **0.9954** — identical to P-1's, P-2's, P-3's and P-4's to four
  decimals, so nothing here perturbed the video-01 reproduction.
- **P-10 segments — 7/7 PASS** (§7).

### Regression spots, freshness-guarded

Every one re-run after the `Connection` fixes landed, since a chapter
figure that survived a teammate's landing unmoved is unverified until
re-run (P-4's rule).

| chapter | scene | result | |
|---|---|---|---|
| P-3 | `p02a` | **3/5** | unchanged; the two FAILs are its traced-image slides |
| P-4 | `p02d` | **9/10** | **improved** — see below |
| P-5 | `p02e` | **7/7** | unchanged |
| P-7 | `p02i` | **9/9** | unchanged |
| P-8 | `p02j` | **7/7** | unchanged |
| P-9 | `p02k` | **2/4** | unchanged; both FAILs are its own documented ceilings (deck 17's stroke-width-under-scale, deck 59's post-recording edit) |

**P-4's mid-draw pair moved, exactly as §4 predicted.** Its two standing
mid-draw FAILs on deck 9's fifteen-line cascade were attributed to 5 fps
sampling of a 2.0s ramp; they were the linear front:

| frame | P-4 reported | now | |
|---|---|---|---|
| f_00862 | 0.8614 | **0.9101** | FAIL → **PASS** |
| f_00866 | 0.8466 | **0.8862** | still FAIL, `cov_ref` 1.0000 |
| f_00869 | 0.9966 | 0.9330 | PASS |

P-4's four settled frames are unchanged to four decimals, which is the
check that the fix moved only what it should. The prediction in §4 was
made from deck 11's measurements before these frames were re-run, and it
held — which is the strongest evidence available that the two gaps were
correctly identified rather than fitted to deck 11.
