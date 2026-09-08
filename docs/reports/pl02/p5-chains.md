# P-5 — the labelled chains, and the dimming that is not there

Chapter P-5 of the PL02 campaign: deck slides 15, 22, 23, 24, 25, 29 and
30 (video segments 15, 21, 22, 23, 24, 28 and 29). Symbol becomes
Symbol-System becomes Tele-Communication; Logos divides into MonoLogos,
DiaLogos and InterLogos; and two campfires are joined across a Distance.

**The gate is met, 7/7 whole-frame, unmasked.** These seven slides carry
zero images, so unlike P-3's arc there is no coverage ceiling to excuse
and the unmasked number is the whole story.

| seg | deck | frame | video s | cov_ref | cov_ours | chamfer | verdict |
|---|---|---|---|---|---|---|---|
| 15 | 15 | f_01301 | 260.0 | 0.9767 | 0.9734 | 0.502/0.199 | **PASS** |
| 21 | 22 | f_02216 | 443.0 | 0.9830 | 0.9804 | 0.328/0.137 | **PASS** |
| 22 | 23 | f_02246 | 449.0 | **0.9938** | 0.9406 | 0.803/0.104 | **PASS** |
| 23 | 24 | f_02351 | 470.0 | 0.9588 | 0.9520 | 0.594/0.330 | **PASS** |
| 24 | 25 | f_02496 | 499.0 | 0.9735 | 0.9715 | 0.458/0.254 | **PASS** |
| 28 | 29 | f_02686 | 537.0 | **0.9966** | 0.9731 | 0.496/0.062 | **PASS** |
| 29 | 30 | f_02721 | 544.0 | 0.9777 | 0.9745 | 0.483/0.190 | **PASS** |

The chapter has two results beyond its own segments, and both are
corrections to things previously believed:

1. **The dimmed palette does not exist.** The chapter was briefed on it;
   the deck refutes it at the source (§1).
2. **The firing model is settled**, and the two chapters that appeared to
   disagree were both reading the same field correctly (§2).

It also built one capability nobody had scoped — **opaque fills** (§3) —
whose value turned out to be far smaller than this report first claimed,
and §5 is the correction: the cross-chapter gains credited to it are
**not** its, and an A/B proves it.

## 1. The dimmed palette: refuted

The recon report's §5 asks for a **"Dimmed-state colour `#A9A9A9`"**,
"needed by slides 15, 29, others", and explains it as "the greying-out of
an earlier chain element is a `ChangeColor` to `#A9A9A9`, which should
join the vocabulary's named colours". §1 of the same report cites
"**#A9A9A9** for the dimmed/secondary state (the greyed labels visible in
e.g. slides 15 and 29)".

**Every clause of that is wrong**, and the arithmetic is short enough to
state completely. Counting every stroke, fill and text colour across all
1,841 drawables in slides 1–58:

| colour | count |
|---|---|
| `#FFFFFF` | 1655 |
| `#000000` | 413 |
| `#00A2FF` | 109 |
| `#FF644E` | 77 |

That is the whole palette. `#A9A9A9` appears **zero** times; the count of
non-palette colours anywhere in the deck is **zero**. The opacity
histogram over the same 1,841 drawables has a **single bin, at 1.0** — so
there is no dimming in the other spelling either. And there is no
`ChangeColor` build in the file: all 18 builds across this chapter's
seven slides are `apple:dissolve` or `apple:dissolve character`, both of
which P-3 already implements as one uniform opacity ramp.

### What the recon actually saw

A **mid-dissolve frame**, and the slide it names is the one that shows it.
On deck slide 29 the word "Distance" fires about four seconds after
"Location A" and "Location B", so a frame sampled in between catches it
part-way up its declared 1.0s ramp. Measured over that segment, the
"Distance" label's own box against "Location A"'s:

| t | 532.0 | 533.0 | 536.0 | 537.0 |
|---|---|---|---|---|
| Distance, max luma | 0 | 0 | **16** | 255 |
| Location A, max luma | 201 | 255 | 255 | 255 |

At t = 536.0 "Distance" is 6% of the way up. That is the grey.

The general check, so this does not rest on one label: a **stroke-core**
scan of all seven settled frames — local maxima only, which excludes
antialiased edges, the thing a naive luminance histogram mistakes for
grey — puts the fraction of cores at luma ≥ 230 at

    0.996  0.998  1.000  1.000  0.812  1.000  0.952

The only sub-230 cores anywhere are the blue `#00A2FF` (luma ≈ 124) and
the red on the InterLogos slides. **There is no grey plateau in the
video.**

### What follows

No dimming verb is owed to any chapter, and `#A9A9A9` must not join the
vocabulary's named colours — it would be a constant invented to satisfy a
refuted claim. This chapter therefore builds no new build type: the
chapter's row named the labelled-chain layout in its second clause, and
that is what it is.

The refutation is pinned by three tests over the shipped asset modules
rather than asserted here, so a future decode that produced a grey would
fail rather than quietly make this report wrong.

## 2. The firing model, settled — and the disagreement dissolves

P-1 recorded the firing model as **open**: two fields claim to say when a
build fires — the chunk's `automatic` and the build's `eventTrigger` —
and they disagree deck-wide on 330 chunks. P-4 measured slide 8's ten
builds cascading from one click and came down on `automatic`. P-3
measured slide 2's thirteen builds firing as **seven separate events** and
read that as fitting `eventTrigger` instead. P-1 left both carried
uninterpreted and asked for measured onsets *within* segments across
several slides.

**Deck slide 15 is the discriminating case**, because it is the only
slide in any chapter's reach that carries **both flag values** — five
chunks `automatic: false`, four `automatic: true`, and all nine builds
`eventTrigger: 1`.

Its nine onsets, each obtained by P-3's method (invert the deck's own
declared 1.0s smoothstep through that target's own ink-mask ramp, solving
only for the offset):

| # | build | automatic | onset | gap | sd |
|---|---|---|---|---|---|
| 1 | 5286898 | false | 226.310 | — | 0.030 |
| 2 | 5161707 | false | 228.781 | +2.471 | 0.023 |
| 3 | 5291410 | **true** | 229.776 | **+0.995** | 0.016 |
| 4 | 5286946 | **true** | 230.766 | **+0.990** | 0.020 |
| 5 | 5068320 | false | 234.838 | +4.072 | 0.024 |
| 6 | 5161127 | false | 245.717 | +10.879 | 0.028 |
| 7 | 5161126 | **true** | 246.709 | **+0.992** | 0.024 |
| 8 | 5287000 | **true** | 247.717 | **+1.008** | 0.016 |
| 9 | 5071095 | false | 256.490 | +8.773 | 0.025 |

**The rule: an `automatic: true` chunk fires exactly one DECLARED
DURATION after its predecessor; an `automatic: false` chunk waits for a
click.** The four automatic gaps are 0.995, 0.990, 0.992 and 1.008
against a declared 1.0; the four manual gaps are 2.47, 4.07, 10.88 and
8.77, human intervals and no two alike. Every standard deviation is an
order of magnitude inside the 0.2s frame interval.

Pooling this slide with P-4's slide 8 and P-3's slide 2 — 24 gaps in all:

| | n | gap / declared duration |
|---|---|---|
| `automatic: true` | 20 | mean **1.001**, sd 0.400 |
| `automatic: false` | 4 | 2.47 – 10.88 (i.e. 2.5× – 10.9×) |

The two populations do not overlap.

### So slide 2 was never a counter-case

Its seven measured events are **seven steps of a cascade** running at the
declared duration: gaps of 1.028, 0.992, 1.013, 1.367, 0.638, 0.962 and
1.020 against a declared 1.0s. That is exactly what `automatic: true`
predicts.

What made it look like a refutation is a reading of the flag. P-3 and P-1
both took `automatic: true` as "fires **with** the previous build", i.e.
simultaneously — from which thirteen builds on one slide would be one
event, and seven measured events refute it. It means "fires **without
waiting for a click**", which on a 1.0s build is one second later. Under
that reading slide 2 confirms the field rather than contradicting it, and
P-4's slide 8 (0.5s builds firing ~0.5s apart) is the same statement at a
different duration.

`eventTrigger` is 1 on every build of all three slides, so it
distinguishes nothing among them and cannot be the field that carries
this. Deck slide 29 adds a third slide on the manual branch: three
builds, all `automatic: false`, measured gaps 2.09 and 2.38s.

**Chunk order is firing order**, element for element, on decks 2, 8, 15
and 29 — here across nine builds spanning thirty seconds, a much longer
lever than either previous chapter had.

### The one exception, stated rather than smoothed

**Deck slide 25 does not fit.** Its chunk list runs (1) the "?"
`automatic: false`, (2) the arrow `true`, (3) the "?" `Out` `false`, (4)
the Logo `true`. The rule predicts chunk 4 at ~494.6; it is measured at
490.109, simultaneous with chunk 1. The measured order is 1, 4, 2, 3
where the chunk order is 1, 2, 3, 4.

What survives on this slide is weaker but not nothing: chunks 1 and 2 are
0.007s apart where the rule predicts 1.0s, so the exception is not a
single stray build. What does **not** survive here is chunk-order-as-
firing-order. Four builds inside 3.5 seconds is also the least resolvable
arrangement in the chapter at 5 fps. It is reported as an exception to be
re-examined on a slide with more room, not as a refutation of a rule that
24 gaps support, and it is pinned by a test so a later re-measure that
moved it would be visible.

## 3. The capability this chapter built: opaque fills

**Read §5 before believing anything in this section about its value.**
An A/B run after P-3 challenged the attribution shows the fills are worth
**0.0003 `coverage_ours` on one frame** of this chapter and **exactly
nothing** anywhere else. The construction below is sound and the deck
facts are real; the claimed impact was not, and the first draft of this
section made a case far stronger than the measurement supports.

413 of the deck's drawables carry a flat fill. On a black stage a black
fill paints nothing of its own, so its only possible effect is to **hide
what is behind it** — an occlusion question, not a colour one, which is
why counting colours did not predict it.

Two cases motivated the work. Both are real in the archives; **only the
second is visible in any frame this chapter scores**, and even there
barely.

**Deck slide 23 — a fill hiding a whole shape.** The slide stacks **two
copies** of one composition: 5313xxx beneath 5315xxx. The lower copy's
heads contain a small blue circle and a red rectangle; the upper copy's
heads are black-filled and sit later in z-order. Both copies are live
drawables at opacity 1.0 with nothing marking either hidden.

**Deck slide 24 — a fill cutting a stroke.** Its head icons are
black-filled and the campfire ellipse spans them (ellipse 5314388 runs
x 223–509, the head 5314453 sits at x 273–311 inside it).

### What the fills actually change, measured

Rendering `f_02351` with the fill branch disabled and enabled differs by
**87 pixels**, all of them on the laptop's frame:

| region | fills OFF | fills ON | reference |
|---|---|---|---|
| laptop interior, mean luma | 1.2 | 1.2 | 0.2 |
| head interior, mean luma | 13.0 | 13.0 | — |

The head interiors are **empty either way** — the ellipse passes below
the heads rather than through them, so the occlusion case that motivated
the work does not arise in the frame that was supposed to show it. What
the fill does do is thicken the laptop's frame from a thin gappy outline
to a solid one matching the reference, which is a genuine improvement
worth 0.9517 → 0.9520.

The construction is still the right one for what it is, and its two
design decisions stand on their own evidence:

**The colours differ**, so the interior is a holon (`SlideFill`) rather
than a param on the outline. A white-stroked, black-filled head is the
deck's common case and the host's wash takes the holon's own `tint`; one
holon cannot be white and black at once.

**The interior is EVEN-ODD across all subpaths.** `Notebook_109` on deck
slide 24 is one white-filled drawable of two closed subpaths — an outer
laptop silhouette and an inner screen rectangle — which the reference
draws as a white frame around a black screen. Filling each loop
separately paints a solid slab; the hole is not a property of either
loop. Verified: the triangulated area is 290.79 against an outer loop of
999.73 and an inner of 708.95, exactly the difference. Even-odd is needed
even for a single loop, because a Keynote icon silhouette is not convex —
head icon 5314453 has 61 points and both cross-product signs — so a
centroid fan would paint outside it.

The stacking needs no sort: shapes compose in the deck's own
`drawablesZOrder` and attach order **is** composite order.

**Where it would matter, and does not yet:** slide 11 carries 70 fills
and slide 8 fifteen. This chapter scores neither. Whether opaque fills
earn their place is a question for P-9 and P-10, and the honest position
today is that the capability exists, is correct by construction, and has
not yet met a frame that needs it.

### The construction, and why each part of it

The interior is a **`SlideFill` holon** composed alongside the outline,
not a property of it. Two reasons:

**The colours differ.** A white-stroked, black-filled head is the deck's
common case, and the host's wash takes the holon's own `tint`. One holon
cannot be white and black at once. The alternative — a second tint param
on `Stroke` — would be a framework change made for one deck.

**The interior is EVEN-ODD across all subpaths, not one flood per loop.**
`Notebook_109` on deck slide 24 is one white-filled drawable of two
closed subpaths, an outer laptop silhouette and an inner screen
rectangle, and the reference draws a **white frame around a black
screen**. Filling each loop separately paints a solid white slab; the
hole is not a property of either loop, which is the rule
`geometry/evenodd.ts` exists to state. A parent holon with one closed
`Line` per subpath is the shape `drawingSubpaths` recognises, so the host
triangulates the set even-odd and marks the children washed-by-ancestor.
Same construction a `Sketch` has, reached for the same reason. Checked:
the triangulation's area is 290.79 against an outer loop of 999.73 and an
inner of 708.95 — exactly the difference.

Even-odd is required even for a **single** loop, because a Keynote icon
silhouette is not convex: the head icon 5314453 has 61 points and both
cross-product signs. A centroid fan on it would paint outside the
silhouette. That is pinned by a test, because it is the geometric fact
the whole construction rests on and it is not obvious from the data.

The stacking needs no sort: shapes compose in the deck's own
`drawablesZOrder` and attach order **is** composite order, so Keynote's
z-order is reproduced by construction.

## 4. Timing

Durations are read from the deck and never fitted; onsets are measured.
Settled frames cannot see a timing error, so the builds are also scored
mid-ramp:

| frame | video s | what | cov_ref | cov_ours | verdict |
|---|---|---|---|---|---|
| f_01150 | 229.8 | deck 15, mid-cascade (chunk 3) | 0.9314 | 0.9515 | **PASS** |
| f_01155 | 230.8 | deck 15, mid-cascade (chunk 4) | 0.9694 | 0.9714 | **PASS** |
| f_01234 | 246.6 | deck 15, the tower arriving | 0.9528 | 0.9621 | **PASS** |
| f_02673 | 534.4 | deck 29, "Location B" mid-ramp | 0.9964 | 0.9751 | **PASS** |

**4/4.** The first two are the strongest evidence in the chapter: they
catch consecutive steps of one cascade exactly one declared duration
apart, which is the rule of §2 rendered rather than tabulated.

### A note on event detection

P-3's "a motion scan finds where something changed, not what changed" is
sharper here than where it was written. A frame-differenced scan of
segment 15 finds **two** events; the slide has **nine**. Seven of the nine
ramps move too little ink to clear the scan's threshold, so every onset in
§2 comes from the target's own ink mask. Had the scan been trusted, the
slide that settles the firing model would have looked like the slide with
the least to say about it.

## 5. A wrong attribution, and the A/B that settled it

**The first draft of this section credited the fills with improving P-3's
and P-4's slides. That was wrong. P-3 caught it, and the correction is
the more useful result.**

The claim was that P-3's arc went 2/5 → 3/5 and P-4's slide 9 rose
0.9654 → 0.9898 because opaque fills stopped ink being drawn behind
black shapes. P-3 pointed out the disqualifying fact in one line:
**not one shape in deck slides 2–6 carries a fill** — 0 of 8, 0 of 5,
0 of 4, 0 of 2, 0 of 1. `SlideFill` composes nothing anywhere in that
arc and therefore cannot have moved it. P-3 also showed the movement had
the wrong *shape* for occlusion: ink volume unchanged at 1.75×, and a
diff of 2012 px lost against 2104 px gained with the bounding boxes ten
rows apart — text moving down, not interior ink being removed.

### The A/B

Two independent changes landed in the same window — this chapter's fills
and the `textBaseline` fix (§6) — and I attributed a joint effect to one
of them without separating them. A 2×2 settles it: each variant built and
scored from a fresh bundle.

P-3's segment 6 (`f_651`) and segment 5 (`f_591`):

| variant | f_651 | f_591 |
|---|---|---|
| **A** new baseline + fills | 1.0000 / 0.9670 **PASS** | 1.0000 / 0.9853 |
| **B** new baseline, fills OFF | 1.0000 / 0.9670 **PASS** | 1.0000 / 0.9853 |
| **C** old baseline + fills | 0.9979 / 0.8515 FAIL | 1.0000 / 0.9029 |
| **D** old baseline, fills OFF | 0.9979 / 0.8515 FAIL | 1.0000 / 0.9029 |

A = B and C = D **to four decimals**. The fills contribute exactly
nothing; the baseline fix contributes all of it.

P-4's four segments, same design: A = B and C = D exactly, with slide 9's
0.9654 → 0.9898 falling entirely to the baseline fix (its label "Social
Organism"), *despite* that slide carrying two black-filled circles — the
fills are there and still change nothing.

And this chapter's own seven segments: A vs B differ on **one frame by
0.0003** (`f_2351`, 0.9520 against 0.9517). Everything else is identical.

### What each fix is actually worth

| fix | evidence |
|---|---|
| `textBaseline` middle | P-3 seg 6 FAIL→PASS; seg 5 +0.082; seg 4 +0.045; P-4 slide 9 +0.024; P-2's slide 5 +0.083, slide 32 +0.029 |
| opaque fills | one frame, +0.0003 |

### The correction to P-3's §5.4, which still stands

P-3 wrote that segment 6's 0.8515 was "the shoulder, and it is not a
build". The second half holds. The first half was too confident — but not
for the reason I gave. It was not interior ink behind fills; it was a
systematic **baseline offset**, and the shoulder is genuinely unchanged
at 1.757×. A ratio can be right while the ink is in the wrong place.
P-3 is amending its own report accordingly.

### The lesson

This is the chapter's second attribution failure and it has the same root
as §8's: **I inferred a cause from a coincidence in time rather than
isolating it.** Two changes landed together, one of them mine, and I
credited mine. The check that would have caught it costs one extra build
— disable the change and re-score — and I did not run it until someone
else's arithmetic forced me to.

The general form, worth carrying: **when two fixes land in one window,
neither may be credited until each has been scored with the other held
constant.** A teammate's slide that improved is not evidence for your
change; it is evidence that *something* changed.

One assertion in `test/connections.test.ts` was still legitimately
updated by this chapter — slide 9's group build resolves seven parts
rather than five because two members carry fills. That is a real
consequence of composing fills, independent of whether they move any
score.

## 6. A finding owed to another chapter: `textBaseline`'s `middle` branch

**Landed during the chapter.** Found here, reported to the lead and P-2
rather than fixed here (`core/src/geometry/keynote.ts` is not this
chapter's file); P-2 reproduced it independently on two further texts at
two more point sizes and applied it as Correction 11. The measurements
below are the ones this chapter contributed.

`textBaseline`'s `middle` branch centres the **cap + descent** block on
the box. Keynote centres the **cap box** alone. Measured on four texts at
two point sizes, baseline row in the 1280×720 frame — strings chosen with
no descender, so the bottom ink row *is* the baseline:

| text | size | current formula | cap-box reading | measured |
|---|---|---|---|---|
| DiaLogos | 70 | 95.99 | **100.93** | **101** |
| Location A | 30 | 436.82 | **438.94** | **439** |
| non-contextual | 30 | 468.15 | **470.27** | **470** |

The cap-box reading lands within 0.3 px; the current one sits 3–5 px
high. The residual is the term: measured − current = 5.01 video px on
DiaLogos against descent/2 = 0.212·70/2 = 7.42 slide units = **4.95 video
px**, agreeing to 0.07 px at two different point sizes. Cap *height* is
already right and unaffected — DiaLogos's "D" measures 34 rows against a
predicted 33.32.

**Why it survived P-2's gate**, which is the part worth carrying: the
title card is the deck's **one** `bottom`-aligned text. Across every
shipped slide module the count is **1 bottom, 43 middle**. So the branch
P-2 verified to 0.4 px is not the branch 43 of the 44 records use, and
`middle` had never been measured against the footage until this chapter
put four titles and nine labels in front of it. That is P-1's closing
lesson — a gate validates the importer only for the features its slide
happens to use — recurring for the third time, after the group bug (P-2)
and the outsets (P-4).

P-2's own slides confirm the size of it: slide 5 goes
`cov_ours 0.9028 → 0.9853` and slide 32 `0.9364 → 0.9655`, with the title
card — the one `bottom` record, and so the control — unmoved.

On this chapter's segments the correction is visible in the composites
rather than in the totals. "Location A" on `f_02686` now spans rows
421–443 against the reference's 424–439, straddling it symmetrically,
where before it sat 3–4 px high. The label still shows ours-only in the
composite, but for a different reason: our ink there runs **2.28×** the
reference's at the same threshold, which is P-3's pre-existing
antialiasing shoulder (it measured 1.31×, 1.58× and 1.75×) and is not
this. The baseline is right; the strokes are fat.

## 7. Segment boundary corrections

Two, both measured from `frames5`, joining P-4's corrections to segments
7 and 14:

- **Segment 15 settles at 225.2, not 227.0**, and its outgoing transition
  begins at **262.2, not 263.0**. The table's 227.0 is 1.8s inside the
  held tableau — and its first build has already fired by 226.3, so the
  table's own start time postdates an event it also lists.
- **Segment 28 settles at 527.6** and its outgoing transition begins at
  **538.8**, against the table's 526.6–539.6.

The pattern is the same each time: the Viterbi tiling has to assign every
frame to some slide, so a boundary lands mid-transition rather than at
the settle.

The +1 slide shift resolves cleanly for this chapter's row — the recon's
slides 15, 28, 29, 21–24 are deck slides 15, 29, 30, 22–25 — verified
against per-slide build and shape counts.

## 8. A mistake worth recording

Between the first scoring run and the second I edited `Slides.ts`, then
diagnosed the result by reading the **screenshot on disk** instead of
re-rendering. The PNG was fourteen minutes older than the bundle. From
that stale image I concluded that single-loop fills produced nothing,
worked out a plausible mechanism (the host's `drawingSubpaths` gates on
`parts.length < 2`, so a lone loop falls through to a centroid fan), and
sent the lead a request to change a file I do not own — with a measured
concavity argument attached, which made it more convincing, not less.

Nothing was wrong with the code. The fills had been rendering the whole
time. The concavity measurement is real and is why even-odd is the right
triangulator, but it was not causing anything.

The rule, stated as the campaign's other lessons are: **re-render before
you diagnose.** A screenshot is not the render, and a well-supported
argument built on a stale artifact is more dangerous than a weak one,
because the supporting evidence is all genuine. The request was withdrawn
and every number in this report comes from a fresh bundle.

## 9. Files

| path | what |
|---|---|
| `core/vocabulary/Slides/Slides.ts` | `SlideFill` — the opaque interior as an occluder; the fill branch in `composeShape` |
| `core/demo/pl02/Chain01.ts` | **new** — deck slides 15, 22-25, 29, 30, registered `p02e` |
| `core/demo/scenes.ts` | one registry entry |
| `core/scripts/key2ts.ts` | `CHAPTER_SLIDES` + 22, 23, 24, 25, 29, 30 |
| `core/vocabulary/Slides/assets/pl02/slide{22,23,24,25,29,30}.ts` | **new** — generated, bare regenerate |
| `core/test/chains.test.ts` | **new** — 19 tests |
| `core/test/connections.test.ts` | one assertion updated (§5) |

The six new modules add 106 KB. The pre-existing modules regenerate
byte-identical; only the barrel changed.

## 10. Gates

- `bunx tsc --noEmit` — **clean**.
- `bun test` — **1123 pass, 0 fail** (1100 baseline + 19 mine + the
  baseline's own movement as other agents landed work).
- **S04 gauntlet — 6/6 PASS**, mean coverage ref **0.9946** / ours
  **0.9954** — identical to P-1's, P-2's, P-3's and P-4's to four
  decimals, so nothing here perturbed the video-01 reproduction.
- **P-5 segments — 7/7 whole-frame PASS**, unmasked, no images to mask.
- **Mid-build — 4/4 PASS.**
- P-4's segments — 4/4, one improved (§5). P-3's arc — 3/5, up from 2/5.

## 11. What later chapters inherit

1. **There is no dimmed state and no `#A9A9A9`.** Do not add the constant;
   the deck has four colours and every drawable is opaque. A "grey" in
   the footage is a mid-dissolve frame — check the object's own ramp
   before reading a state into it.
2. **The firing model is settled** (§2). `automatic: true` means "one
   declared duration after the previous build", not "simultaneously with
   it"; `automatic: false` is a click. `eventTrigger` carries nothing
   here. Deck slide 25 is the one measured exception.
3. **Opaque fills exist and are correct, but have not yet earned their
   keep** (§3, §5). Measured value so far: 0.0003 on one frame. Slide 11
   carries 70 fills and slide 8 fifteen — P-9 and P-10 are where the
   question is actually decided. Do not repeat this chapter's mistake of
   assuming a capability matters because it ought to.
4. **`textBaseline`'s `middle` branch was off by descent/2** (§6) —
   fixed during this chapter as Correction 11. The lesson outlives the
   fix: 43 of the 44 records use the branch the title-card gate never
   touched, which is P-1's "a gate validates only the features its own
   slide uses" for the third time.
5. **Re-render before you diagnose** (§8), and **isolate before you
   attribute** (§5). Both of this chapter's errors were inferences from
   circumstance — a stale screenshot, and two fixes landing together —
   that one extra build would have caught. When two changes land in one
   window, neither may be credited until each is scored with the other
   held constant.
6. **The remaining residual on text-dense frames is the antialiasing
   shoulder**, not geometry and not type metrics. On this chapter's
   labels it runs 2.28×. It caps `coverage_ours` on every text-heavy
   tableau in the video and is the one systematic gap no chapter has yet
   owned.
