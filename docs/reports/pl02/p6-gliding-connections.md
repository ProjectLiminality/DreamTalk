# P-6 — the gliding connection, and what it uncovered underneath

The chapter was handed one diagnosis: MagicMove01 collapses mid-glide
because connection lines are baked ink dragged along, where Keynote
re-derives them per frame between the moving endpoints. That diagnosis
was **right and it is now implemented**. It was also **not the whole
failure** — fixing it moved the mid-glide frames from ~0.23 to ~0.30,
and the remaining gap turned out to be a second, larger defect the
connection bug had been masking.

Both are recorded here, because the second one revises a claim the
matcher's own header makes.

## 1. The gliding connection (the commissioned fix)

**A connection is a relation, not a drawable, and it stays one while its
endpoints move.** `Connections.ts` already carried the static half of
that truth (Keynote recomputes a line whenever either object moves,
which is why 25% of the deck's stored paths are stale). This extends it
through time.

`GlidingConnection` is a holon whose dashes' `points` are a **pull-based
derivation** keyed on one param, `completion` — the `MorphShape` /
`curves.ts` idiom, written out a third time rather than exported, for
the reason Morph.ts gives about the second. At completion *u* each
endpoint's box is lerped between the matched pair's two boxes, the
outgoing silhouette is carried onto it by the box similarity, the bow is
transferred onto the current chord as a *fraction* (the reading
`Slides.ts` derived for the static case — an absolute middle point lands
off a moving line), and `connectionPath` re-clips and re-lays the dash
lattice.

Two design facts are load-bearing:

- **The dash count is fixed at compose; the lattice is not.** The host
  binds one ribbon per `Line` once, walking `parts` at mount, so a holon
  cannot gain or lose children per frame — but a shrinking mesh needs
  fewer dots (deck 12→13's lines carry 22/18/44/46 dashes on slide 12
  and 15/12/29/31 on slide 13). So `maxDashes` allocates for the longest
  the path gets and a surplus slot derives an **empty** polyline, which
  the host explicitly passes through ("an emptied derived polyline …
  so the ribbon empties too"). Nothing stale is ever painted.
- **`maxDashes` samples the LENGTH, not the lattice.** Laying full
  lattices at 33 samples per line put scene construction past the
  harness's navigation limit. The count is `ceil(length/period)+1`, which
  needs one un-trimmed walk. Verified against a 200-step sweep over all
  thirty lines: **zero violations, slack exactly 1 on every line** — the
  bound is tight, not merely safe. Eight samples suffice because both
  endpoints travel affinely, so the length is smooth.

**Purity** is the contract that makes it scrub-safe: geometry at *u* is a
pure function of the four boxes and *u*, the memo is a cache keyed on
`completion` rather than a state. `test/gliding-connections.test.ts`
pins it — a scrambled-order sample must reproduce a forward sweep
exactly — along with the two endpoint identities (at *u*=0 and *u*=1 the
derivation reproduces a static `connectionPath` between the outgoing and
incoming boxes respectively, which is what makes the hand-off to slide
13's own baked mesh invisible). Independently confirmed: all 12 lines
whose endpoint pair survives into slide 13 reproduce **B's dash count
exactly** at completion 1.

## 2. What was underneath: the superposed tableau

With the mesh fixed, the composite still showed our heads travelling to
different places than the reference's. The cause is a property of slide
12 that nothing had noticed:

**Slide 12 carries twelve heads in six EXACTLY COINCIDENT PAIRS** —
identical centres to the decimal, two whole six-node meshes superposed.
`f_01081` looks like six heads because six are hidden behind six. The
transition's content is that the copies come apart.

That breaks an assumption `matchSlides` never stated: minimum-total-travel
assumes the class's members *start in different places*. Here every cost
is a tie, the assignment breaks it arbitrarily, and measured against the
footage it breaks it wrong — it splits each coincident pair across the
two outgoing lobes. Tracking the top head band's ink and comparing
predicted centroids (video px):

| frame | reference | declaration order | minimum travel |
|---|---|---|---|
| f_1087 | 554, 721 | **535, 739** | 474, 637, 637, 800 |
| f_1088 | 533, 742 | **512, 761** | 485, 788 |
| f_1089 | 512, 760 | **497, 776** | 492, 780 |

Minimum travel leaves heads sitting at the centre (637) through the
middle of the glide — a four-head signature the reference never shows.
Declaration order tracks it throughout.

What the deck states instead is **z-order blocks**: slide 12's heads are
two contiguous runs (z 1-6, z 22-27) and slide 13's likewise (z 0-5 =
left lobe, z 21-26 = right). Pairing k-th with k-th sends each block to
its own lobe intact. It costs **more** total travel — 2787 slide units
against the optimum's 1918 — which is exactly why no minimum-travel rule
can reach it, and why this is a separate branch (`coincident()`) rather
than a tweak to the cost.

This does **not** reinstate z-order as identity, which the module header
refutes for the general case and rightly. It is the fallback for a class
whose geometry has been made degenerate by construction: when position
cannot distinguish, the only thing the deck still states is the order it
states things in. It fires only when two members of one class share a
position, so every other Magic Move in the deck is untouched.

## 2b. The residual, closed: it was the onset

The ~15-20px residual reported in the first round is **resolved**. It was
two things, and neither was geometry.

**The measurement artefact.** Comparing the reference's ink CENTROID
against a predicted BOX CENTRE adds a spurious **+6px downward offset,
uniform across all twelve heads** — x displacement ≈ 0 (−0.27px mean,
all within ±1.4px). The head glyph is bottom-heavy (shoulders wider than
head), so its centroid sits 5.9px below its box centre at settled size.
That artefact *was* most of the "15-20px". Compare centroid to centroid
or box to box, never one to the other.

**The onset, off by one frame.** With the artefact removed, recovering
the transition's own completion per frame — fitting all twelve heads'
centroids, order-free nearest-neighbour — gives geometry that closes to
**0.67-1.36px mean, 2.46px worst**. Sub-pixel, no free parameter. So the
model was right and the *clock* was wrong:

| video | recovered u | `smooth` at old onset 216.2 |
|---|---|---|
| 217.0 | 0.400 | 0.544 |
| 217.2 | 0.590 | 0.718 |
| 217.4 | 0.740 | 0.872 |
| 217.6 | 0.865 | 0.981 |

The onset is **216.4, not 216.2**. At f_1082 the ring's pixel count is
unchanged (8662, identical to f_1081) and the heads have not moved (top
row still 52, band still 366px) — what changed is the second superposed
copy becoming visible. The geometry first moves at f_1083. P-6 took the
first changing *pixel* for the onset; it is the fade that precedes the
glide.

| reading | rms(u) |
|---|---|
| onset 216.2, duration 1.5 (P-6's) | 0.130 |
| **onset 216.4, duration 1.5 (declared)** | **0.030** |
| onset 216.30, duration 1.62 (free fit) | 0.011 |

The declared duration at the corrected onset is a 4× improvement with
nothing fitted. The 1.62s free fit is better by a hair and is **reported
rather than adopted** — it would be fitting a duration the deck states,
and 1.62 is inside 5 fps' own resolution of 1.5.

### The four candidates, resolved

1. **Per-object stagger** — *no*. All twelve heads share one completion:
   their displacements at a common u agree to ±1.4px in x and the spread
   in y is the glyph artefact, identical for every head. One window.
2. **Curved travel path** — *no*. At the recovered u the straight-line
   interpolation reproduces every head to sub-pixel; a curved path has no
   room left to explain.
3. **Interpolation domain (centre vs corner lerp)** — *not applicable*.
   Lerping the corners independently yields the identical centre
   (`((x0A+Δx0·u)+(x1A+Δx1·u))/2 = cA+Δc·u`), so the two readings differ
   only in the scale ANCHOR, and centre-anchored scaling already closes
   to sub-pixel.
4. **Open residual** — not needed for geometry. What remains is named
   below and it is a different quantity.

### What remains: dash-lattice phase

Mid-glide our dots and the reference's lie **along the same lines** but
land at different points along them. Dilation separates the two readings
cleanly (fraction of reference ink covered by ours, dilated k px):

| frame | 0px | 2px | 4px | 6px |
|---|---|---|---|---|
| f_1092 settled (scores 0.982) | 0.938 | 0.994 | 0.998 | 1.000 |
| f_1087 mid-glide (scores 0.783) | 0.127 | 0.463 | 0.811 | 0.939 |

Settled, dots land on dots at 0px. Mid-glide, 81% of the reference is
within **4px** of our ink — under half the 10px (15 slide-unit) dash
period. A geometric error does not close that fast; this is the lattice's
PHASE, which anchors at the `from` clip, so a sub-pixel difference in
where the curve leaves a moving silhouette walks every dot along the
line. That is the next chapter's question and it is a smaller one.

## 3. MagicMove01 — before and after

Scene t = 1.0 is now video **216.4**, so a frame's hold is
`(idx−1)/5 − 216.4 + 1.0`. (The brief's original `@t` values assumed
216.2 and were a further 0.2s late again; both corrections are folded in
below.)

| frame | P-6 as inherited | + gliding mesh & matcher | + corrected onset |
|---|---|---|---|
| f_1082 onset | 0.955 PASS | 1.000 PASS | **1.000 PASS** |
| f_1085 | 0.242 | 0.448 | **0.516** |
| f_1086 | — | — | **0.583** |
| f_1087 | 0.253 | 0.374 | **0.783** |
| f_1088 | 0.228 | 0.357 | **0.730** |
| f_1089 | 0.351 | 0.370 | **0.579** |
| f_1092 settled | 0.982 PASS | 0.982 PASS | **0.982 PASS** |

(cov_ref; chamfer on f_1087 falls 9.38 → 7.64 → **1.97** px.)

Mid-glide cov_ref roughly **tripled** — f_1087 from 0.253 to 0.783 — and
the frames still FAIL the bar. Both endpoints are exact and the geometry
is sub-pixel at the recovered completion, so what is left is not shape
and not timing but the dash lattice's phase (§2b).

A sub-frame sweep shows how sharply the score now turns on alignment:
f_1089 reaches **0.872** at hold 2.1 against 0.579 at 2.2. That
sensitivity is itself evidence the geometry is right — only well-aligned
ink can be that sensitive to a tenth of a second.

## 4. Hypotheses tested and refused

Kept as a record, since several were plausible enough to be worth the
measurement and one of them (the ease) nearly absorbed the onset error.

- **Ease shape.** Against the recovered completions, fitting onset ×
  duration per ease: `easeOut` rms 0.009, `smooth` 0.011, `linear`
  0.017, `easeIn` 0.020 — indistinguishable, and `smooth` (the deck's
  own, shared with the DreamSong level) fits at the declared duration.
  No ease change is warranted.
- **The declared `delay: 0.5`.** Both transitions carry it and neither
  scene reads it. **Excluded by the footage**: it would put the onset at
  216.9, and the tableau is demonstrably moving at 216.6.
- **Duration.** The free fit prefers 1.55-1.62s; the declared 1.5s at
  the corrected onset fits at rms 0.030, inside 5 fps' resolution. Not
  re-fitted (DECISIONS' refused-fits rule).
- **Per-object stagger, curved paths, corner-lerp** — all refuted in
  §2b.

## 5. MagicMove02's residual — the curvature verdict

**The lotus tile travels a STRAIGHT line. There is no implied motion
path to honor.**

Isolating the moving ink by differencing each frame against the settled
one and taking its centroid gives a clean 2-D track over 604.8-607.0s.
Resolved into the chord's own (along, across) frame:

- chord (771.2, 367.5) → (691.6, 340.8), **83.9 px**
- **max |across| = 2.68 px = 3.19% of travel**, most samples under 1 px,
  and the two largest deviations sit at the end where the centroid is
  noisiest.

At 5 fps, with a shape whose measured ink count varies ±10% frame to
frame, that is straight within measurement error. The effect is *named*
`apple:magic-move-implied-motion-path`, but **the deck carries no motion-path
record on the transition** — only slide 36 has an `action-motion-path`,
and that is a build on one drawable, not the transition. So any curvature
would be footage-only, and the footage says there is none. MM02's
0.89-0.90 is not a curvature deficit.

## Gates

- `bunx tsc --noEmit` — **clean**.
- `bun test` — **1133 pass, 0 fail** (1123 baseline + 10 new).
- S04 — **6/6 PASS**, mean cov ref 0.9946 / ours 0.9954.
- o01 morph span (`--step 4`) — **unchanged**: 0/18, mean cov ref 0.049 /
  ours 0.151, byte-identical to the pre-change baseline measured by
  stashing the diff. (That gate does not pass on either side with this
  invocation's time mapping; what it establishes is that the shared
  derivation machinery is untouched.)

## Files

- `core/vocabulary/Slides/Connections.ts` — `GlidingConnection`,
  `lerpBox`, `targetAt`, `midAt`, `glidingPathAt`, `glidingDashesAt`,
  `maxDashes` (additive).
- `core/vocabulary/Slides/Transitions.ts` — `glidingMesh`,
  `glidingMeshSetup/Anim/Swap`, `coincident`, `Matchable.order`, and the
  superposed branch in `matchSlides`; `magicMoveSwap` takes an optional
  mesh.
- `core/demo/pl02/MagicMove01.ts` — stages the mesh; `ONSET_VIDEO`
  216.4; header records what slide 12 actually is, how the onset was
  re-measured, and the centroid-vs-box-centre trap.
- `core/test/gliding-connections.test.ts` — 10 tests.

`src/geometry/morph.ts`, the importer trio and `render/**` are untouched.
No new dependencies. Nothing committed.
