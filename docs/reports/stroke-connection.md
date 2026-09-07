# The S&T stroke-connection rule — derivation from the reference frames

**Status: the Sketch phenomenon is SOLVED, and it was not a connection
problem. The cylinder phenomenon is NARROWED to a provable negative plus one
surviving candidate, and is NOT closed.**

Research task, 2026-09-07. Read-only on `core/`; no code changed. Analysis
scripts are self-contained bun/python under
`docs/reports/stroke-connection-analysis/`.

---

## 0. The headline, before the evidence

The task assumed one rule behind two phenomena: that Sketch & Toon re-cuts
splines into its own stroke set at connection time, and that this re-cutting
explains both david.svg's draw order and the cylinder's pose-dependent arc
order.

**The measurement refutes the premise for the Sketch case.** C4D does *not*
break david.svg's scribbles into more strokes than subpaths. The 37 subpaths
are the 37 strokes, and they are ordered `long_short` exactly as the source
says — Spearman ρ = **0.97** between length rank and measured onset rank
(§2.3). What the O-2 work read as "more strokes than subpaths" is a different
mechanism entirely:

> **Sketch & Toon draws many strokes CONCURRENTLY, not one at a time.**
> `draw_speed` is a GLOBAL arc-length budget (~10000 px/s, measured §2.5)
> spent across all strokes that are currently in flight. Strokes *start* in
> `stroke_order` sequence but do not wait for their predecessor to finish, so
> at any moment 3–15 separate pen fronts are advancing (§2.2, measured in raw
> pixels with no geometry model).

Our `DrawSteady` lays the strokes end to end in disjoint abutting windows
(`planSteady`, `core/src/steady.ts`). That is the single discrepancy behind
every mid-draw failure in O-2. It is a **scheduling** bug in DrawSteady, not a
missing `segmentStrokes()` in `geometry/`.

For the cylinder, the same rule **cannot** apply, and I can prove it: the
away-facing cap arc is longer than the camera-facing one for *every* possible
pose (§3.1), so no length-based ordering can ever flip between S01 and S06.
The deeper reason is structural — the cylinder scenes never use `long_short`
at all (§3.2). The two phenomena do not share a rule, and the DECISIONS entry
that binds them should be split.

---

## 1. Method and its validation

The 2021 reference (`refs/pitch/origins/frames5`, 5 fps, 1280×720) is ground
truth. For each frame I take the pixels newly lit versus the previous frame,
and map each to the nearest point on david.svg's subpaths projected through
Scene00's documented framing (scale 2/3, ortho zoom 1 = 1.25122 px/world-unit,
centred). That yields, per frame, which *(subpath, arc-position)* regions the
pen inked — its itinerary.

**Validation of the projection and attribution.** On a full-ink frame
(`f_00030`), 100% of lit pixels fall within 2px of the projected geometry,
median distance **0.53px** (`itinerary.py` / sanity check). The projected
bounding box is x[407.7, 872.3] y[88.5, 631.5] against the report's
independently measured x[407, 873] y[88, 632]. The attribution is sound, so
the itinerary below can carry the weight put on it.

Scripts: `subpaths.ts` (asset profile), `export-geom.ts` (projection),
`itinerary.py` / `itinerary2.py` (the measurement), `perstroke.ts`,
`onset.ts`, `window-fit.ts` (the analysis), `reversal-test.ts`,
`all-mode.ts`, `staggered.ts`, `overlap-fit.ts` (hypotheses tested and
rejected), `cylinder.ts`, `cylinder2.ts` (the cylinder check).

---

## 2. The Sketch phenomenon

### 2.1 Connection MERGES; it does not split

The first thing the frames show is a join, not a cut. At **t=0.2 there is
exactly one connected ink mark** (581 px, `frame1.py`), and it spans the ends
of two different SVG subpaths — sp0's arc [0–340] and sp6's arc [720–1140],
which meet in screen space.

Checking every subpath endpoint pair confirms this is systematic
(`endpoints.ts`). david.svg's open subpaths form a near-continuous chain of
coincident endpoints:

| pair | gap (px) | pair | gap (px) |
|---|---|---|---|
| sp4.S ↔ sp34.S | 0.13 | sp9.E ↔ sp10.S | 1.14 |
| sp5.E ↔ sp6.S | 0.14 | sp2.E ↔ sp3.S | 1.65 |
| sp35.E ↔ sp36.S | 0.25 | sp8.E ↔ sp9.S | 1.83 |
| sp6.E ↔ sp7.S | 0.59 | sp11.E ↔ sp12.S | 2.25 |
| sp34.E ↔ sp35.S | 1.01 | sp7.E ↔ sp8.S | 3.10 |

The artist drew one continuous contour that Pixelmator emitted as separate
`M` subpaths. `OUTLINEMAT_CONNECTIIONZ = 3` ("Match to World" — connect
strokes that touch) with `JOIN_ANGLE_LIMIT = π` rejoins them. Chaining at a
3.5px tolerance turns 37 subpaths into **25 strokes** (`chain.ts`), the 20
`Z`-closed subpaths passing through untouched since they offer no free
endpoints.

This is worth recording on its own: **`CONNECTIIONZ=3` is a parameter the
task brief did not have**, and it is the actual connection control.
`JOIN_ANGLE_LIMIT` only decides whether a join is refused for being too
sharp; at π nothing is refused.

### 2.2 The pen is in many places at once — the decisive observation

Counting spatially separate connected components of *newly* inked pixels per
frame, with no geometry model involved at all:

| frame | t | new px | separate ink marks | sizes |
|---|---|---|---|---|
| f_00001 | 0.2 | 581 | **1** | 581 |
| f_00002 | 0.4 | 2983 | **3** | 1436, 1373, 171 |
| f_00003 | 0.6 | 2693 | **4** | 1478, 750, 327, 93 |
| f_00004 | 0.8 | 2932 | **3** | 1623, 673, 636 |
| f_00005 | 1.0 | 2776 | **9** | 1254, 430, 355, 292, 147, … |
| f_00006 | 1.2 | 2280 | **8** | 1087, 618, 133, 111, … |
| f_00007 | 1.4 | 2092 | **6** | 571, 569, 469, 197, … |
| f_00008 | 1.6 | 2255 | **9** | 649, 501, 360, 206, … |
| f_00009 | 1.8 | 2103 | **15** | 340, 274, 256, 159, … |
| f_00010 | 2.0 | 1777 | **9** | 414, 343, 316, 295, … |
| f_00011 | 2.2 | 1886 | **12** | 592, 476, 179, 162, … |

A sequential pen can produce at most a couple of marks per frame (one, or two
when it crosses a stroke boundary). Fifteen is categorical. The new ink is
also genuinely virgin territory rather than lines thickening: only 0–28% of
new pixels are even adjacent to previously-lit ones through the draw.

**Adversarial check, on raw pixels with no ordering model.** A sequential
`long_short` pen at 10000 px/s has covered 6830 px of the 21107 px drawing by
t=0.8 — enough for sp0 (5435 px) and the first 1400 px of sp8, and nothing
else. Masking those two subpaths with a generous 6px halo and comparing
against `f_00004`:

> lit = 9417 px · inside sp0 ∪ sp8 = 5629 px · **outside = 3788 px (40.2%)**,
> distributed over sp25 (1623), sp3 (1395), sp2 (670), sp11 (100).

Two-fifths of the reference's ink at t=0.8 is in places a sequential pen
cannot have been, in four different subpaths. No ordering rule, split rule, or
connection rule can repair a sequential model against that; only concurrency
can.

### 2.3 The ORDER is `long_short` on the subpaths as they are

Per-subpath cumulative inked fraction, read straight off the frames
(`perstroke.ts`). Rows are sorted by length; the staircase of first-nonzero
entries is the ordering:

```
sp   len     0.2  0.4  0.6  0.8  1.0  1.2  1.4  1.6  1.8  2.0  2.2  2.4
sp 0  6515  0.05 0.21 0.39 0.39 0.66 0.74 0.74 0.83 0.87 0.90 0.93 0.93
sp 8  2423  0.00 0.00 0.00 0.00 0.04 0.26 0.44 0.47 0.62 0.71 0.73 0.73
sp11  2217  0.00 0.44 0.56 0.56 0.56 0.56 0.56 0.70 0.83 0.86 0.86 0.86
sp 3  2086  0.00 0.00 0.28 0.51 0.51 0.51 0.51 0.51 0.83 0.93 1.00 1.00
sp 2  1450  0.00 0.00 0.00 0.43 0.66 0.66 1.00 1.00 1.00 1.00 1.00 1.00
sp 6  1146  0.00 0.00 0.00 0.00 0.00 0.00 0.38 0.38 0.38 0.38 0.38 0.38
sp25   992  0.00 0.00 0.00 0.99 0.99 0.99 0.99 0.99 0.99 0.99 0.99 0.99
sp12   749  0.00 0.00 0.00 0.00 0.00 0.87 0.87 0.87 0.87 0.87 0.97 0.97
sp 7   621  0.00 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.45 0.45 0.45
sp14   417  0.00 0.00 0.00 0.00 0.00 0.00 0.00 1.00 1.00 1.00 1.00 1.00
sp23   372  0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.86 0.95 0.95 0.95 0.95
sp 4   292  0.00 …                                              0.89 0.89
sp22   247  0.00 …                                    0.81 0.81 0.81
sp13   245  0.00 …                                    0.98 0.98 0.98
sp19   188  0.00 …                                              0.96 0.96
sp 1   187  0.00 …                                              0.32 0.32
sp18   142  0.00 …                                              0.99 0.99
sp35   115  0.00 …                                              0.83 0.83
sp34   109  0.00 …                                              1.00 1.00
sp26    93  0.00 …                                              0.43 1.00
sp27    84  0.00 …                                                   0.95
sp24    77  0.00 …                                                   1.00
sp32    75  0.00 …                                                   1.00
sp28    56  0.00 …                                                   1.00
sp10    47  0.00 …                                                   0.85
```

Onset rank against length rank (`onset.ts`), n = 25 subpaths that receive
measurable ink:

| sp | len | length rank | first ink (s) | onset rank | Δ |
|---|---|---|---|---|---|
| sp0 | 6515 | 0 | 0.2 | 0 | 0 |
| sp8 | 2423 | 1 | 1.0 | 6 | +5 |
| sp11 | 2217 | 2 | 0.4 | 1 | −1 |
| sp3 | 2086 | 3 | 0.6 | 3 | 0 |
| sp2 | 1450 | 4 | 0.8 | 4 | 0 |
| sp6 | 1146 | 5 | 1.4 | 8 | +3 |
| sp25 | 992 | 6 | 0.8 | 5 | −1 |
| sp12 | 749 | 7 | 1.2 | 7 | 0 |
| sp7 | 621 | 8 | 0.4 | 2 | −6 |
| sp14 | 417 | 9 | 1.6 | 9 | 0 |
| sp23 | 372 | 10 | 1.6 | 10 | 0 |
| sp4 | 292 | 11 | 2.2 | 13 | +2 |
| sp22 | 247 | 12 | 2.0 | 11 | −1 |
| sp13 | 245 | 13 | 2.0 | 12 | −1 |
| sp19 … sp10 | 188 → 47 | 14–24 | 2.2 → 2.4 | 14–24 | **all 0** |

**Spearman ρ = 0.9700.** Eleven of the last eleven strokes are in exact
length order. The two outliers are explained by §2.1: sp7 (Δ −6) is chained
to sp6 and sp8, and sp11 (Δ −1) to sp12, so they inherit their chain's onset
rather than their own length's.

This settles the O-2 open question directly. `long_short` was never in doubt;
what was in doubt was whether the *strokes being ordered* were the subpaths.
They are. No re-splitting, no >90° reversal rule, no fitted split angle.

### 2.4 Why "longest stroke ≠ longest subpath" looked true

Because sp0 (30.9% of all arc) is drawn *across the whole 2.1 seconds* rather
than in one 0.65-second block, and always advancing:

| t | sp0 arc regions newly inked |
|---|---|
| 0.2 | [0–340] |
| 0.4 | [340–420] [440–1380] |
| 0.6 | [1360–1860] [1880–2300] [2320–2520] |
| 1.0 | [2760–3660] [4080–4220] [5420–6120] |
| 1.2 | [4280–4440] [4460–4840] |
| 1.6 | [5000–5420] [6180–6300] |
| 1.8 | [3820–4100] |
| 2.0 | [2520–2740] |
| 2.2 | [3700–3740] [4840–4960] |

Monotonically increasing arc, spread over nine frames. Under a sequential
model that pattern is only expressible as "sp0 was cut into nine strokes that
happened to be scheduled in order" — which is exactly the inference O-2 drew,
and why a reversal-split *improved* late frames without being right. The
correct reading is one stroke, drawn slowly, concurrently with others.

### 2.5 `draw_speed` is a GLOBAL budget shared across concurrent strokes

Total newly-inked arc length per 0.2s frame (`window-fit.ts` cross-check):

| t | new arc (px) | implied px/s |
|---|---|---|
| 0.4 | 2200 | 11000 |
| 0.6 | 2032 | 10162 |
| 0.8 | 2080 | 10400 |
| 1.0 | 2170 | 10851 |
| 1.2 | 1729 | 8645 |
| 1.6 | 1677 | 8385 |
| 1.8 | 1632 | 8160 |

Against the source's `draw_speed=10000`. Equivalently, summing the individual
rates (stroke length ÷ its own measured draw window) of the strokes active at
each instant gives 8000–13000 px/s, while each stroke *individually* runs at
a median of only **779 px/s**. The global rate is conserved; the per-stroke
rate is not. This confirms and refines the 2026-09-07 DECISIONS entry: the
pixels-per-second is real and it is the *aggregate*.

(The tail declines below 10000 because the ≥40px reporting threshold drops
thin fragments; 86% of the total projected arc is accounted for overall.)

### 2.6 What the exact concurrency law is — not yet pinned

I can state the mechanism with confidence but not the precise scheduling law.
Four parametric families were fitted against the measured itinerary and all
scored poorly (pixel-weighted interval overlap; `reversal-test.ts`,
`all-mode.ts`, `staggered.ts`, `overlap-fit.ts`):

| model | best score |
|---|---|
| sequential, split at angle θ (θ swept 30–180°, all three orders) | 0.14 |
| all-strokes proportional completion | 0.09 |
| all-strokes equal px/s (swept 100–800 px/s) | 0.03 |
| staggered starts, overlap φ (swept 0–1), `long_short` | **0.27** at φ=0.4 |
| onset = t₀ + φ·C_k/v, and power/rank laws on cumulative length | rms ≥ 0.45 s |

The staggered-overlap family is directionally right and clearly beats the
alternatives, but 0.27 is not a derived rule. The measured per-stroke windows
(`window-fit.ts`) show why no simple law fits: sp0 draws over 2.2s at 2470
px/s while sp7, a sixth its length, draws over 1.8s at 288 px/s — the windows
are neither proportional to length nor uniform.

**What would decide it:** a controlled render in C4D 2025 (installed on this
machine). Build a Sketch material with pydeation's exact settings on a spline
with a few strokes of known, very different lengths; render at 5 fps with
`sketch_speed="pixels"`; measure each stroke's start and end frame. Three
renders — `stroke_method` 0 vs 1, and one with `stroke_order="document"` —
would pin the scheduler outright. That is a one-session experiment and it is
the honest way to finish this, rather than fitting a fifth family.

---

## 3. The cylinder phenomenon

### 3.1 A provable negative: arc length can never explain the pose dependence

The near cap is broken at the two silhouette generators into a camera-facing
arc of sweep `thetaB − thetaA = 2·acos(r/d)` and an away-facing arc of
`2π − 2·acos(r/d)`. Since `acos(r/d) ∈ (0, π/2)` for every valid camera
distance `d > r`, the camera-facing sweep is always less than π and the
away-facing arc is **always the longer one** (`cylinder.ts`):

| d/r | camera-facing sweep | away-facing sweep | longer |
|---|---|---|---|
| 1.05 | 35.5° | 324.5° | away |
| 1.5 | 96.4° | 263.6° | away |
| 3 | 141.1° | 218.9° | away |
| 10 | 168.5° | 191.5° | away |
| 1000 | 179.9° | 180.1° | away |

So *any* length-based ordering predicts away-facing-first universally. It
matches S01 and can never match S06. The Sketch finding does not transfer,
and this is a proof rather than a failed fit.

### 3.2 The structural reason: the cylinder is not ordered by length at all

`grep` over the source scene file
(`refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py`) finds
`stroke_order="long_short"` at exactly **one** call site: line 17, the
Scene00 David draw. Every other object — the cylinders included — takes
`CObject.__init__`'s default `stroke_order="bottom_top"`
(`refs/pydeation-legacy/object/object.py:90` → S&T mode 3).

The two phenomena run different S&T ordering modes. Expecting one rule to
close both was the premise's error, and this is the cleanest available
evidence against it. The DECISIONS entry of 2026-09-07 should be amended
accordingly: **one derivation does not close both.**

### 3.3 The surviving candidate

`bottom_top` orders by screen Y. The three obvious Y keys (bottom-most point,
centroid, start point) were already tested by the S01/S06 builders and none
reproduces either sequence. What the two measured poses do differ in is cap
foreshortening (`cylinder2.ts`):

| scene | pitch | cap-normal angle to camera | ellipse minor/major | measured first arc |
|---|---|---|---|---|
| S01 | 0.4 | 67.1° | 0.389 (edge-on sliver) | **away-facing** |
| S06 | π/2 | 0.0° | 1.000 (face-on circle) | **camera-facing** |

The scenes sit at opposite extremes of the very variable DECISIONS named as
the lead, with opposite outcomes — consistent, but two points cannot fix a
threshold, and a two-point fit is exactly the fitted rule both builders
refused.

**What would decide it:** the same C4D experiment as §2.6, swept over pitch.
Render one cylinder with pydeation's settings at pitch 0.1 → π/2 in ~10
steps, `stroke_order="bottom_top"`, and read the first-drawn cap arc off each.
The flip point (if it is a threshold) or its absence (if the real key is
something else, e.g. which arc's *bottom-most point* is lower once the ellipse
inverts) falls straight out. Until then the S01 rule ships, as decided.

---

## 4. Implementation plan for `core/`

The finding relocates the work. There is **no `segmentStrokes(polylines,
camera?)` to write** — that function would encode a splitting rule the
reference does not perform. Two changes replace it.

### 4.1 The real fix: concurrent scheduling in `DrawSteady` (Sketch case)

`core/src/steady.ts`. `planSteady` currently lays strokes in disjoint abutting
windows:

```ts
windows.push({ stroke, from, to: i === ordered.length - 1 ? 1 : at, length })
```

This is the sequential model the frames refute. It should become an
*overlapping* schedule: strokes still ordered by `stroke_order`, still start
in that sequence, but each runs over a window that extends past its
successor's start, with the aggregate arc-length rate held at `draw_speed`.

The signature and the `SteadyPlan` shape already accommodate this — the
windows simply stop abutting — so `DrawSteady`/`UnDrawSteady` and their
`restage` call sites need no change. `steadyDuration` is unaffected: the
total duration is still total arc ÷ speed, which is why O-2's *timing* was
already exact while its *distribution* was not.

**Do not implement this from the 0.27-scoring fit.** Run the C4D experiment
in §2.6 first and implement the law it reveals. A fitted overlap factor here
would be the same mistake as a fitted split angle, one layer up.

### 4.2 Optional and separable: endpoint chaining at import (Sketch case)

`core/scripts/svg2ts.ts` or a pure helper beside it —
`chainByEndpoints(subpaths, tolerance)` in `core/src/geometry/`, taking and
returning polylines, no camera. It reproduces `CONNECTIIONZ=3` +
`JOIN_ANGLE_LIMIT=π` + `CLOSECONNECTION=true`, turning david's 37 subpaths
into 25 strokes (`chain.ts` is a working reference implementation).

This is a genuine C4D behaviour and worth having for fidelity of the stroke
*set*. But note its effect on ordering is small and slightly negative in
isolation — chaining lengthens sp7's chain and would move its onset — so it
should land *with* §4.1, scored together, not before it.

### 4.3 Cylinder: leave as is, and split the DECISIONS entry

`core/src/render/three-host.ts` keeps the S01 rule, as already decided. The
in-code comment at line ~940 attributes the gap to stroke connection; §3.1–3.2
show connection is not the cause, and the comment should be corrected to point
at `bottom_top`'s screen-Y key under cap foreshortening. That is a comment
edit, not a behaviour change, and I have not made it (read-only task).

---

## 5. Honest state of the rule

| question | state |
|---|---|
| Does S&T split subpaths into more strokes? | **No.** Refuted — ρ=0.97 onset-vs-length on the subpaths as they are. |
| Does S&T join across subpath boundaries? | **Yes.** `CONNECTIIONZ=3`; 37 → 25 strokes on david. |
| Is the Sketch draw order `long_short`? | **Yes**, confirmed directly, not inferred. |
| Why did "longest stroke ≠ longest subpath" look true? | Concurrency, not splitting (§2.4). |
| Is `draw_speed` px/s? | **Yes**, and it is a *global* budget across concurrent strokes (§2.5). |
| What is the exact concurrency law? | **Open.** Family identified, parameters not pinned. One C4D render decides it (§2.6). |
| Does one rule close the cylinder too? | **No** — proven for arc length (§3.1); different `stroke_order` mode (§3.2). |
| What decides the cylinder? | **Open.** Pitch sweep in C4D (§3.3). Ship S01's rule meanwhile. |

Nothing here was fitted into `core/`. The two open questions both reduce to
the same concrete, cheap experiment — driving C4D 2025, which is installed —
and I would recommend that as the next session rather than any further
inference from 11 frames.
