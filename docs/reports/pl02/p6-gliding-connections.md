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

## 3. MagicMove01 — before and after

Scored at the frames' own scene times. **Note the brief's `@t` values are
each 0.2s late**: the onset is video 216.2 ↔ scene t=1.0, so f_1087
(217.2s) is t=2.0, not 2.2. Corrected below; the uncorrected phase
depresses every number slightly but changes no verdict.

| frame | before (cov_ref/ours) | after | chamfer before → after |
|---|---|---|---|
| f_1082 onset | 1.000 / 1.000 PASS | 1.000 / 1.000 PASS | 0.03 / 0.22 |
| f_1085 | 0.269 / 0.415 | **0.448 / 0.469** | 5.81 → 4.34 |
| f_1087 | 0.249 / 0.242 | **0.374 / 0.309** | 8.91 → 7.64 |
| f_1088 | 0.220 / 0.194 | **0.357 / 0.278** | 9.49 → 8.22 |
| f_1089 | 0.276 / 0.230 | **0.370 / 0.273** | 9.26 → 8.29 |
| f_1092 settled | 0.982 / 0.997 PASS | 0.982 / 0.997 PASS | 0.09 / 0.22 |

Every mid-glide frame improved substantially (+0.10 to +0.18 cov_ref,
chamfer down ~1.3px throughout) and **the mid-glide frames still FAIL**.
Both endpoints are exact — 1.000 at onset, 0.982 settled — so the defect
is entirely interior. The structure is now visibly right: in the f_1087
composite every head has a red/green partner within a few pixels and the
mesh re-derives between them; what remains is a small, uniform
**vertical/phase offset**, our tableau sitting ~15-20px ahead of the
reference's along the same path.

## 4. The residual, and what it is NOT

Three candidates were tested and refused rather than fitted.

- **Ease shape.** Fitting the top head pair's centroid track (a clean
  118px signal) over onset × duration grids: `smooth` 6.69px, `easeOut`
  5.41, `linear` 6.35, `easeIn` 7.64 — all within each other's noise at
  5 fps. `smooth` at the *declared* onset/duration gives 8.99px, under
  8% of travel. The ease is not the residual.
- **The declared `delay: 0.5`.** Both transitions carry it and neither
  scene reads it. It is **excluded by the footage**: a 0.5s delay puts
  the onset at 216.7, and the tableau is already moving at 216.4.
- **Onset/duration.** Best fit is onset 216.10, duration 1.55s against
  the declared 1.5 and measured 216.2 — the deck's numbers are right and
  were not re-fitted (DECISIONS' refused-fits rule).

The honest statement: the residual is a ~15-20px phase-like offset whose
source is not the connections, not the matcher, not the ease, and not the
declared delay. A hold-time sweep makes every frame *worse* when held
later, so we are not simply running early. It is the next chapter's
question, and it now sits on a mesh and a matcher that are both correct.

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
- `core/demo/pl02/MagicMove01.ts` — stages the mesh; header records what
  slide 12 actually is.
- `core/test/gliding-connections.test.ts` — 10 tests.

`src/geometry/morph.ts`, the importer trio and `render/**` are untouched.
No new dependencies. Nothing committed.
