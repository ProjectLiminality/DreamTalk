# P-4 — connection meshes, recomputed

Chapter P-4 of the PL02 campaign: the deck's connection lines at scale,
on deck slides 7, 8, 9 and 14 (video 134.8–227.0s). Fifty-five lines,
every one of them **rebuilt from its endpoints** rather than read.

**The gate is met, 4/4 whole-frame**, with no masking of any kind — the
four slides carry zero images, so unlike P-3's arc there is no coverage
ceiling to excuse and the unmasked number is the whole story.

| seg | frame | video s | cov_ref | cov_ours | chamfer | verdict |
|---|---|---|---|---|---|---|
| 7 | f_00808 | 161.4 | 0.9505 | 0.9345 | 0.607/0.447 | **PASS** |
| 8 | f_00851 | 170.0 | 0.9554 | 0.9234 | 0.755/0.465 | **PASS** |
| **9** | **f_00950** | **189.8** | **1.0000** | **0.9654** | **0.364/0.045** | **PASS** |
| 14 | f_01111 | 222.0 | 0.9915 | 0.9988 | 0.071/0.128 | **PASS** |

Slide 9 — the chapter's gate, a complete K6 of fifteen dotted lines —
reaches `coverage_ref 1.0000`: every ink pixel the reference has, we
have. Slide 14's two thirty-line meshes score **0.9915 / 0.9988 with a
0.071 px chamfer**, which is identity to the limit the encode allows.
And a mid-segment frame of slide 9 after its mesh has settled but before
its Logo arrives (f_00900, 179.8s) scores **1.0000 / 1.0000, chamfer
0.065/0.062** — a perfect frame.

The chapter's one-line summary: **the recompute rule holds, and every
one of the four bugs it took to get there was invisible in the render.**

## 1. The rule, as derived

Stated first; §2 is the evidence for each clause.

1. A connection runs from the `from` drawable's **centre** to the `to`
   drawable's **centre**. A GROUP's centre is the union of its members'
   boxes, computed recursively.
2. It is a **quadratic Bézier through** the stored path's middle point —
   not a polyline, and not a curve with that point as its control.
3. It is **clipped at each end where the curve last leaves that object's
   own flattened path** — its drawn silhouette, not its bounding box and
   not an ellipse fitted to that box — then stood off further by the
   declared `outset`.
4. The dash lattice is laid by **continuous arc length** from the
   clipped start, at the round-cap period P-1 derived.

Nothing in that is fitted. Clauses 1–3 are read from the archives or
measured from the footage with no free parameter; clause 4's period is
the stylesheet's own arithmetic.

### Per geometry class, as the brief asked

The rule turned out **not** to vary by class, which is the useful
finding — Keynote clips against the shape's real outline in every case,
so there is no per-class table of rules to maintain:

| what the line connects to | slide | n | first dot − path clip (slide units) |
|---|---|---|---|
| `Head with Shoulders_826` (concave icon) | 9 | 15 | **−0.14 ± 1.45** |
| `Cell_302` | 10 | 6 | 1.32 ± 0.77 |
| `Bacteria_814` | 10 | 5 | 1.89 ± 1.03 |
| `Neuron_815` | 10 | 4 | 0.12 ± 2.67 |
| `Head with Shoulders_826`, after its declared transform | 10 | 15 | **0.340 ± 0.417** |
| a GROUP (campfire: ellipse + fire + heads) | 8 | 10 | governed by `outset`, §3 |

One slide unit is 2/3 of a video pixel, so those are sub-pixel. The
alternatives are not close, measured on slide 9's fifteen:

| candidate boundary | residual |
|---|---|
| **the object's own flattened path** | **−0.14 ± 1.45** |
| an ellipse fitted to the bounding box | −10.7 ± 11.5 |
| the bounding box | −15.4 ± 13.1 |

**The concavity is what makes the distinction visible.** A
`Head with Shoulders_826` is a head over shoulders, so a ray from its
centre can cross its own outline three times. Zoom f_00950 on any icon
and a dot sits in each shoulder notch — inside the bounding box — while
no dot lies inside the head. Keynote draws from the **outermost**
crossing, which is why `outlineExit` takes the last intersection and not
the first.

### The lattice is anchored at the near end

Slide 9's first dot lands within 1.45 units of the clip while its LAST
dot scatters over 9.31 ± 11.93 — a spread bounded by exactly one period.
So the lattice starts at the `from` clip and runs; the far end is ragged
by construction, not by a rule. That is also why the lattice must be
continuous across the flattened curve: `primitives.ts`'s `dashRuns`
restarts its phase at every vertex, which is invisible on the straight
two-point connections P-3 met and would reset the phase dozens of times
along one mesh line.

## 2. P-1's cap derivation, confirmed at scale

P-1 settled the dotted period from the stylesheet — round cap, so
`(dash + gap + 1) · width` rather than `(dash + gap) · width` — on one
corridor of one slide, and P-3 consumed it. Fifteen independent lines up
to 594 units long, lattice-fitted:

| | value |
|---|---|
| predicted, `(0.001 + 2.0 + 1) × 5.0` | **15.005** |
| measured, mean of 15 lines | **15.003** |
| standard deviation | **0.009** |

Agreement to 0.01%. A read constant surviving fifteen new samples at a
different stroke width on a different slide is about as much
confirmation as this kind of number gets.

## 3. Two claims of P-1's that this chapter refuted, and one it settled

### The outsets are NOT zero — a missing field that looked like a missing rule

`keynote.ts`'s `connects` note said `outsetFrom`/`outsetTo` were "both
0.0 throughout this deck". They are per-line, and non-zero on exactly
the densest meshes: **164 of the 467 in-scope lines**, with slide 8 at
30/30 and slide 11 at 10/10.

The failure mode is the instructive part, because it did not look like a
missing field. Slides 9 and 10 closed to sub-pixel and slide 8's lines
all ran long, so it looked like a clip rule that did not generalise. Six
candidate boundaries were tested against slide 8's own drawn extents —
the ellipse's path, the group box, an inscribed ellipse, the ellipse's
box, the member-path union, a circumscribed circle — and **none gave a
constant residual**; the best had a standard deviation of 11.3 slide
units. Five of the ten lines sat exactly 30 units beyond the group box
and the other five scattered from −37.7 to +6.0.

The temptation there is a per-slide constant, which would have "worked"
on slide 8 and been wrong everywhere else — and the five lines that
matched at 30 were precisely the ones whose ray left near the ellipse's
extreme, where box and silhouette coincide. A fitted constant would have
looked justified by half the data. The field was requested with these
measurements, P-1 carried it, and `connectionPath` now reads it.

### Arrowheads exist, on 123 lines — and the convention has exceptions

Not carried at all when the chapter started. They resolve through the
style variation chain into the **global** `Index/DocumentStylesheet.iwa`,
not the slide file: `super.style → TSWP.ShapeStyleArchive →
objects[0].super.shapeProperties.headLineEnd`. 123 in-scope heads and
one tail. All ten of slide 8's lines carry one and none of slides 7, 9
or 14's do, so a consumer keying "connections have arrows" would be
wrong four times out of five here.

**And the shape convention has exceptions, which P-1 caught and this
chapter would not have.** Almost every decoration is `"simple arrow"` —
a filled triangle `(0,0) (3,6) (6,0)`, `endPoint (3,0)`, on the `to`
end — but **two are `"filled circle"`**, and one line carries a **tail**
rather than a head. Neither exception falls on slides 7, 8, 9 or 14, so
no frame scored here would have caught a renderer that drew every
decoration as a forward-pointing triangle: it would have been wrong
three times, silently, in slides P-9 and P-10 own.

So `lineDecoration` dispatches on the identifier rather than assuming,
`composeConnection` draws the tail where one exists, and a
`Connection` holds its decorations as **separate outlines** — one flat
list would have drawn a spurious segment straight across the tableau
joining a head to its tail. An identifier nobody has read draws
**nothing**: a missing decoration is a visible, reportable gap, while
one invented in the wrong shape is a fidelity claim the data does not
support.

What is measured and what is not: the drawn head on slide 8 is
**9.66 ± 0.10 long by 4.67 ± 0.20 half-width**, an aspect of 2.07
against the path's own 6/3 = 2.0 — so the SHAPE is the declared one. The
absolute scale is not a clean multiple of the 2.0 stroke width and three
samples cannot establish the rule, so it is a holon parameter
(`Slide.headSize`) carrying the measurement rather than a constant
derived from too little.

### The firing model: `automatic` is confirmed, on slide 8

P-1 recorded the firing model as **open** — two fields claim to say when
a build fires (`automatic` on the chunk, `eventTrigger` on the build),
they disagree on 330 chunks deck-wide, and neither predicts slide 2.
Resolving it needed measured onsets *within* a segment, which P-1
assigned to P-3 or P-9.

**Slide 8 is the discriminating case, and it comes down on `automatic`.**
Its ten builds are all 0.5s `LineDrawForLine` on the ten connection
lines; its chunk list marks the first `automatic: false` and the other
nine `true` — one click, then a nine-step cascade, 5.0s end to end.
Measuring each line's own corridor crossing half brightness:

```
164.73  165.21  166.31  166.72  166.72  167.34  167.62  168.33  168.74  169.24
```

Ten firings ~0.5s apart spanning 164.7–169.2 — a cascade from one click,
not ten clicks. And **the order is the chunk list's own**, element for
element, with the single inversion sitting inside the 0.2s frame
interval that separates the two.

So the flag is neither decorative nor wrong. It states what the deck
does unattended; the footage states what David did. On slide 2 he
clicked *through* the cascade, which is why the flag read as one event
where seven were measured. Where he let it run, the two agree exactly.
Two mid-cascade frames score in-band (f_00833 at 0.9398/0.9799 and
f_00838 at 0.9442/0.9451), which settled frames cannot test.

**For P-9 and P-10**: `automatic` is now measured-confirmed once, in the
one place it could be. It is not yet established that it predicts every
slide, and slide 2 remains the counter-case that needs the other
explanation above.

## 4. Direction 53 — a draw mode nobody had read

P-1 carried `direction` uninterpreted and said why: three values occur
(51 once, 52 twenty-eight times, 53 fifteen times), the field is absent
on 114 of 158 line draws, and four samples cannot name a semantics.
P-3 measured 51 and 52 on slide 2, found both drawing centre-outward
*relative to the page*, and used a geometric fallback that reads the
field not at all.

**Deck slide 9 is the only slide using 53, on all fifteen of its builds,
and 53 is a different thing entirely: the line draws from its OWN
MIDPOINT outward to both ends at once.** Ink at fractions along one
594-unit mesh line through its 2.0s window:

| t | 0% | 10% | 20% | 30% | 40% | 50% | 60% | 70% | 80% | 90% | 100% |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 172.4 | – | – | – | – | – | **255** | – | – | – | – | – |
| 172.8 | – | – | – | – | 173 | 255 | – | – | – | – | – |
| 173.0 | – | – | – | – | 254 | 255 | 255 | – | – | – | – |
| 173.2 | – | – | – | 255 | 254 | 255 | 255 | 253 | – | – | – |
| 173.4 | – | – | 251 | 255 | 254 | 255 | 255 | 253 | 255 | – | – |
| 173.8 | – | 255 | 255 | 255 | 254 | 255 | 255 | 253 | 253 | 255 | – |

The middle lights first and the front advances in **both** directions at
the same rate — 40/60 together, then 30/70, then 20/80. Two other lines
of different lengths repeat it exactly.

It was found by scoring a mid-draw frame, not by reading the field: the
composite showed our fronts and the reference's as mirror images. With
the one-ended sweep f_00866 scored **0.782 / 0.7122, chamfer 3.634**;
with the midpoint sweep it scores **1.0000 / 0.8466, chamfer 1.775** —
`coverage_ref` perfect and the chamfer 2x better. The residual is our
front running about one dash ahead, which at 5 fps sampling of a 2.0s
ramp is inside the frame interval.

Only 53 is claimed. 51 and 52 keep P-3's geometric resolution because
that is what was measured for them, and absence stays the default.

## 5. The three bugs that rendered plausibly

Worth recording together, because they are one lesson: **every failure in
this chapter produced a picture that looked like a working
reproduction.** None would have been caught by looking.

**1. The bow was read as a POSITION.** Keynote stores three points and
the middle one carries the curve's belly — but the stored path is stale
AND the importer fits it into the stored frame box, which is stale too.
Slide 8's line 4105549 stores a chord of (−125.5, −183.6) where the true
centre-to-centre is (−251.6, −364.2): exactly half, because the frame is
a leftover from when the campfires sat closer together. Read as a
position the middle point lands off the line and the curve bows the
wrong way — all ten of slide 8's lines rendered as mirrored red/green
pairs about their chords, at 0.8833/0.8498. Read as a **fraction of the
stored chord**, in that chord's own (along, across) basis and
transferred onto the recomputed one, it is scale-free and stale-proof:
**0.9554/0.9234**.

**2. A build targeting a GROUP found nothing.** `byId` holds shapes and
texts; slide 9's Logo is one `apple:dissolve` on a group of five shapes.
The build reported as having no target — indistinguishable from the
genuinely absent ones (a dropped image), which is the exact confusion
`missingBuildTargets` exists to prevent. Found by a test asserting zero
missing targets, not by looking at the frame.

*Since P-5:* that group now resolves to **seven** parts, not five. Two
of the Logo's five shapes carry a black fill, and P-5's opaque-fill work
composes a `SlideFill` alongside each filled shape's outline (they need
separate holons because a white-stroked, black-filled icon cannot be one
colour). P-5 rewrote the assertion to state the relationship —
`members.length + filled.length` — rather than the bare 5, which is the
better test and is why the number moving did not cost anything. Verified
here that the new parts are reached by all three opacity paths
(`visible`, `preBuild`, the build's own ramp) and that `cutIn` still
leaves a pending build's targets dark: an unreached fill would be P-3's
seventy-second ghost wearing a new coat. My four segment scores are
unchanged to four decimals, because a fill only bites where a stroke
passes behind one and these slides' filled circles have nothing behind
them.

**3. The midpoint sweep gave its outermost dashes a zero-width window.**
Dividing by the distance to the last dash rather than by the number of
steps put that dash at `[1, 1]`, so **the two ends of every mesh line
silently never drew** — on all fifteen lines — in a frame that still
scored a perfect `coverage_ref`, because the reference had not reached
them either. Caught by a test asserting every dash gets a non-empty
window.

P-1's closing lesson was that "a gate that exercises one slide validates
the importer only for the features that slide happens to use", and
predicted P-4 as where the next such gap would surface. It did — groups
as connection endpoints, which `KeyGroup` describes by membership with
no geometry at all. That one turned out to be a **derivation** rather
than a missing fact (union the members recursively; P-1's verification
that groups are pure translations is what makes it sound, and it agrees
with the deck's own stored connection vectors to 0.0001 units on all
seventy of slide 11's lines), but it needed doing, and the three bugs
above are the same shape of thing one level down.

## 6. Per-line results — the mesh scores

Every recomputed line, sampled along its own path in the settled
reference frame at ±2 px, counting samples landing on ink:

| slide | lines | mean | sd | min | max |
|---|---|---|---|---|---|
| 8 (dashed 6,6, curved, arrowed, to groups) | 10 | 0.834 | 0.040 | 0.734 | 0.888 |
| 9 (dotted, K6, direction 53) | 15 | 0.915 | 0.052 | 0.744 | 0.970 |
| 14 (dotted, two K6 meshes) | 30 | 0.917 | 0.057 | 0.798 | 0.968 |

**All 55 land. No line fails the recompute rule** — the worst is 0.734
and there is no bimodality, no outlier sitting near zero that would mark
a residual stale-path convention. Every one of the 55 resolved its
endpoints, so **zero fell through to a stored path** (`stalePaths()`
returns empty on all four slides) and zero builds went untargeted.

## 7. Timing

Onsets by P-3's method — invert the deck's own declared curve through the
object's own ink-mask ramp, solving only for the offset. Durations are
read and never fitted.

| slide | what | onset | sd |
|---|---|---|---|
| 9 | the fifteen-line cascade | **172.08** | 0.031 / 0.015 (two fits) |
| 9 | the red ring | 174.79 | 0.009 |
| 9 | the Logo | 184.32 | 0.032 |
| 9 | "Social Organism" | 186.25 | 0.019 |
| 8 | the ten-line cascade | 164.73 → 169.24 | §3 |

Every standard deviation is an order of magnitude inside the 0.2s frame
interval, which is what a declared duration inverted through a real ramp
looks like when the duration is right. Mid-draw scoring, which is the
only thing that can see a timing error:

| frame | video s | what | cov_ref | cov_ours | verdict |
|---|---|---|---|---|---|
| f_00833 | 166.4 | slide 8, mid-cascade | 0.9398 | 0.9799 | **PASS** |
| f_00838 | 167.4 | slide 8, mid-cascade | 0.9442 | 0.9451 | **PASS** |
| f_00862 | 172.2 | slide 9, mesh opening | 1.0000 | 0.8614 | FAIL |
| f_00866 | 173.0 | slide 9, mesh half-drawn | 1.0000 | 0.8466 | FAIL |
| f_00869 | 173.6 | slide 9, mesh nearly done | 0.9882 | 0.9966 | **PASS** |
| f_00900 | 179.8 | slide 9, settled | **1.0000** | **1.0000** | **PASS** |

The two FAILs both have `coverage_ref` at 1.0000 — everything the
reference has, we have — and fail only the other way, which is the
signature of a front running slightly ahead rather than a wrong draw.

## 8. What is NOT this chapter's

**Slide 10 is deliberately not scored.** It belongs to P-4's row and
carries thirty connection lines, and its mesh recomputes correctly —
measured against its transformed cluster the clip rule gives
**0.340 ± 0.417**, the tightest reading anywhere in the chapter. But its
left cluster is driven by an `apple:action-scale` **whose factor is not
in the record**: the build declares an effect, a duration and an easing
and no target scale. The value can only come from the footage (fitting
the cluster's ink gives 0.810), and an undeclared magnitude fitted to
make a frame match is what the refused-fits rule forbids. The build class
is P-7's. Emitted, not scored, and the reason is stated rather than the
slide quietly dropped.

**Slide 7 carries five builds this chapter does not implement** — three
`apple:fade and move character` and two `com.apple.iWork.Keynote.LineDraw`
(distinct from `LineDrawForLine`: it draws a shape's outline rather than
a line's length). They are reported by `Slide.unsupported()` rather than
approximated. Its settled frame passes anyway because they are all `In`
builds whose targets `cutIn` lights; scored EARLIER, at f_00795 (158.8s,
before the last click), it reads 0.9613 / **0.8512** — the honest cost,
and it is a build gap, not a geometry one.

**The recon's segment 14 end time is wrong.** The table gives
219.4–227.0; the settled tableau runs 220.2–223.8 and the outgoing
FadeThruColor starts at 224.0. Frame f_01128 (225.4s), which the table
implies is inside the segment, is mid-transition into the next slide.
Segment 7's end is likewise early: it settles 160.6–161.4 and f_00809
(161.6) is already transitioning.

## 9. A note for P-3, and for P-10

The recompute **improved P-3's own slides** without touching its code.
Slide 2's four connection lines are among the 25% stale, and P-3 had to
exclude them region-by-region to score its segment. With them recomputed:

| | P-3's report | now |
|---|---|---|
| segment 2 `coverage_ours` | 0.9143 | **0.9732** |
| segment 2 ours→ref chamfer | 0.924 px | **0.211 px** |
| segment 3 `coverage_ours` | 0.9236 | **0.9614** |
| segment 3 ours→ref chamfer | 0.738 px | **0.351 px** |

Its verdicts are unchanged (2/5, same frames) because those segments are
capped by the dropped images, not by the lines. But the ink that IS drawn
is now 4.3x closer to the reference.

**For P-10** (slide 11, the density peak): its structure is **7 clusters
× K5 = 70 lines**, not the "~14 organisms × 7-node mesh" the recon
describes. All 140 endpoints are groups; all resolve by recursive union,
agreeing with the deck's own stored vectors to 0.0001 units. All 70 lines
are solid 2.0-wide with `outset` 10/10 and an arrowhead each, driven by
70 × 2.25s `LineDrawForLine` plus 35 × 0.30s `dissolve` on the nodes. The
seven clusters are pixel-identical translated copies (max deviation
0.0001 units), so one cluster generated seven times reproduces it. No
`direction` is declared on any of the 105.

## 10. Files

| path | what |
|---|---|
| `core/vocabulary/Slides/Connections.ts` | **new** — the recompute rule, the clip, the continuous lattice, the arrowhead |
| `core/vocabulary/Slides/Slides.ts` | connection composition, group geometry resolution, group build targets, `stalePaths()` |
| `core/vocabulary/Slides/Builds.ts` | `DIRECTION_FROM_MIDDLE`, the midpoint sweep, `Connection` routing |
| `core/demo/pl02/Mesh01.ts` | **new** — deck slides 7/8/9/14, registered `p02d` |
| `core/test/connections.test.ts` | **new** — 30 tests |
| `core/test/builds.test.ts` | two tests updated: slide 2's dashed lines are `Connection`s now |

Two of P-3's tests changed, and only in the type they assert — its four
connection lines are `Connection`s rather than `DottedLine`s now. Per the
lead's ruling the behaviour supersedes P-3's reading and the tests follow
the behaviour: what each test is *about* (the draw direction; that
opacity reaches every drawn dash) is unchanged, the assertions are the
same ones, and the supersession is noted in each test's comment with P-3
attributed. Both pass.

## 11. Gates

- `bunx tsc --noEmit` — **clean**.
- `bun test` — **1121 pass, 0 fail** (1067 baseline + 30 mine + the
  baseline's own movement as other agents landed work).
- **S04 gauntlet — 6/6 PASS**, mean coverage ref **0.9946** / ours
  **0.9954** — identical to P-1's, P-2's and P-3's to four decimals, so
  nothing here perturbed the video-01 reproduction.
- **P-4 segments — 4/4 whole-frame PASS**, unmasked, no images to mask.
- Mid-draw — 4/6, both failures `coverage_ref` 1.0000 (§7).
- P-3's opening arc — 2/5, unchanged verdicts, two segments improved (§9).
