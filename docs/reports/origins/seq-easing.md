# seq-easing — the Scene10 dip, candidate #1 ruled out

The queued experiment from PLAN.md: Scene10's 1.2 s dip had two
separable candidates. This separates them. **The verdict is candidate
#2** — the source's windowed ease. Candidate #1, `sequence` easing each
segment rather than the span, is ruled out, and ruled out with a margin
that makes it worth stating as arithmetic rather than as a score.

## The API question, answered before it was asked

The brief anticipated adding `Param.sequence(..., { easing })`. That
option turned out to already exist, one level up: `eased("linear", …)`
(anim.ts:134) re-stamps the easing of every track an Anim carries, and
`timeline.ts:236` already branches on `easing === "linear"` to
interpolate straight through a segment. `paths.ts:191` is a scene
already using exactly this to get a linear multi-waypoint ride.

So the experiment needed **no new API**, and none was added. What
`sequence()` does differently from `to()`/`by()` is discard an
`AnimOpts` argument it never accepted (params.ts:107) — but adding it
there would be a second spelling of `eased()`, at a level the framework
has deliberately chosen against: anim.ts:127-133 states that easing is
stamped by an animator-level wrapper so it reaches every keyframe the
animator generates, however deeply nested. A per-call option would
reintroduce the per-track spelling that wrapper exists to replace.
**Judged honestly: the option does not carry its weight. Not added.**

## The measurement

Scene10's seven rig channels wrapped in `eased("linear", …)`, so the 24
waypoints carry all the shaping. `bun scripts/origins-gauntlet.ts o10
345.8 …`, port 4545.

| scan | baseline | linear | verdict |
|------|----------|--------|---------|
| whole scene, step 5 (346-360) | 7/14, mean cov_ref **0.8529** | 7/14, mean **0.8535** | +0.0006 |
| dense dip, step 1 (349.8-354.4) | 10/24, mean **0.9347** | 11/24, mean **0.9349** | +0.0002 |

The dip frames themselves, where the effect was predicted to be
largest:

| v | base cov_ref | linear cov_ref | delta |
|---|--------------|----------------|-------|
| 349.8 | 0.9993 | 0.9993 | +0.0000 |
| 350.0 | 0.8703 | 0.8805 | +0.0102 |
| 350.2 | 0.7891 | 0.7929 | +0.0038 |
| **350.4** (deepest) | **0.7766** | **0.7723** | **−0.0043** |
| 350.6 | 0.7980 | 0.7889 | −0.0091 |
| 350.8 | 0.8306 | 0.8306 | +0.0000 |
| 351.0 | 0.8966 | 0.9090 | +0.0124 |
| 351.2 | 0.9893 | 0.9919 | +0.0026 |
| 352.0 | 0.8937 | 0.8792 | −0.0145 |

The deepest frame moved the **wrong way**. The deltas are signed both
ways, none exceeds 0.015, and every frame from 352.6 onward is
identical to four decimals. This is noise, not a lift.

## Why — the arithmetic that makes it conclusive

A null result from a single scene invites the objection that the effect
was there but masked. It was not, and the reason does not depend on the
scoring at all.

The per-segment ease is **symmetric within each segment**: it departs
slow and arrives slow by the same amount, so the segment's midpoint is
exactly where linear interpolation puts it, and the deviation is
confined to the interior of each segment. Sampling Scene10's own rig
path at its 24 steps and differencing the two easings over the whole
2.67 s move gives a worst-case divergence of **0.0067 rad — 0.38°**,
sub-pixel at this framing. At the waypoints themselves the two agree to
1e-15.

The suspected cause is therefore four orders of magnitude too small to
produce a 0.22 coverage dip. Candidate #1 is not merely unconfirmed; it
is excluded.

The header's earlier estimate — "bounded by ~110 ms of local time
distortion" — was the right instinct and the right conclusion (leave it
alone); this replaces the bound with a measurement.

## What stands

Candidate #2, by elimination and not merely by default. The sampled
path's points are exact (the move ends at 0.991 and holds there for
four seconds), and its interior timing is now proven irrelevant. The
discrepancy has nowhere else to live: it is the shape of the ease
across the `rel_end_point=2/3` **window**, not within the segments —
the source's own ease over that window is not the C4D auto-tangent this
framework fits by default. That is a separate chapter, and it is now
the only one left for this dip.

## What changed in the repo

- `core/demo/origins/Scene10.ts` — **comments only, zero code delta**
  (`git diff` shows no non-comment lines). The `eased("linear", …)`
  edit was reverted per the brief; the header now records the verdict
  in both places that carried the speculation.
- `core/test/timeline.test.ts` — three tests pinning the finding: the
  default eases per SEGMENT (and restarts at the interior waypoint),
  `eased("linear", …)` opts out, and dense waypoints make the two
  converge (< 0.01 rad).
- No change to `params.ts` or `timeline.ts`. No new deps.

## Gates

| gate | result |
|------|--------|
| `bunx tsc --noEmit` | clean — the two `Scene06.ts` `Holon` errors are pre-existing (verified by stashing this work: identical before and after) and belong to o11's in-flight edit |
| `bun test` | **957 pass, 0 fail** (954 + 3 new) |
| S04 gauntlet (mandatory, shared machinery) | **6/6 PASS**, mean cov ref 0.9946 / ours 0.9954 |
| S09 video01 spot | **9/9 PASS**, mean cov ref 0.9946 / ours 0.9963 |

Servers killed. No commits.
