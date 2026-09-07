# FIDELITY-LEDGER.md — Where we matched the flaw instead of the ideal

David's directive (2026-08-30): map every place the port did something
imperfect ON PURPOSE to match the original, so the framework can now
implement the ideal the original was aiming at — rather than spending
resources reproducing old flaws. Each entry: the flaw, why we matched
it, the ideal, and the switch (how a scene opts into the ideal).

Era correction (David): the TheWall/MindVirus stack is **2025/2026**
code, not 2021. "2021" applies only to the video-01/pydeation era.
Earlier docs/commits that say "2021 growth wave" mean the 2025/26 wall.

Legend: ■ = flaw matched, ideal pending · ◆ = ideal already built ·
▲ = reference itself is flawed (we already exceed it; nothing to build)

## The wall stack (2025/2026 code)

1. ■ **The growth wave never seals the wall.** At growth=1 the last
   ~15% of splineT is still in flight (19/236 creatures) because the
   wave range is stretched by row lag but not by the smoothstep's own
   TRANSITION_WIDTH. Matched because the benchmark render behaves this
   way; pinned in journey.test.ts. IDEAL: stretch the normalization by
   (1 + totalLag + TRANSITION_WIDTH) so growth=1 means SEALED — one
   line in `completionOf`. SWITCH: `sealAtOne: true` config on
   TheWall (default ON for new scenes; the benchmark scene passes
   false).
2. ■ **Journey vs standalone pulse profiles disagree.** The wall's
   journey pulses 10/55/35 while the standalone MindVirus pulses
   30/20/50 — two hand-tuned profiles for one creature. Matched both.
   IDEAL: one parameterized pulse (openShare/thrustShare/glideShare as
   promoted params with per-context defaults) so the creature has ONE
   gait vocabulary. SWITCH: unify in mindvirus.ts, both contexts pass
   their shares explicitly.
3. ■ **The labyrinth's orphan filter thins the maze.** The
   citadel-connectivity filter DISCARDS 26–90 of ~133 wall segments
   (verified with the source's own parameters) — the annulus frays at
   the rim and thins near the citadel; the published PNG just had a
   lucky seed. IDEAL: connect-or-regrow — reattach orphan islands with
   one extra wall each (preserves maze properties, fills the annulus)
   instead of deleting them. SWITCH: `orphans: "regrow" | "discard"`
   (discard = benchmark mode).
4. ■ **~7% frame-height residual in the TheWall benchmark** —
   unexplained after camera probes bracketed it; left untuned rather
   than fitted around missing cables. Revisit ONCE cables land: if it
   persists, it is likely a render-era viewport quirk → recorded as
   reference flaw (▲), not worth matching.
5. ◆ **The blackboard.** PackingLUT spline, CableState_* splines,
   SearchObject-by-name, userdata strings → replaced by pure functions
   and holon-owned data. Ideal built; nothing pending.
6. ◆ **The duplicated cube.** XPBD collision re-modeled FoldableCube's
   faces by hand; ours derives them from the one definition.
7. ◆ **Stateful cable that breaks scrubbing.** The 2025/26 tether
   steps frame-sequentially (scrubbing breaks); ours bakes to pure
   f(t). The trail needed no bake at all (pure past-sampling).
8. ▲ **MindVirus.mp4's source is lost** — the render's fold
   choreography doesn't match the surviving simulate(). We matched the
   surviving SOURCE where it exists and the render's rhythm where it
   doesn't (swim plateaus ~0.63 vs the lost-source render). IDEAL
   (queued, honest): journey legs as (impulse, drag) pairs integrated
   in closed form — analytic exponential decay, still pure f(t) — the
   physics feel without waypoint fitting. Build when MindVirus next
   stars in a scene; do NOT chase the lost render further.

## The video-01 era (2021/2022 code)

9. ■ **The near-cap arc-order gap.** S&T's contour-edge chaining rule
   is unexplained; S01 and S06 measurably need OPPOSITE first arcs. We
   ship S01's reading and eat S06's mean-coverage loss. IDEAL: derive
   the real screen-space join rule (the two poses put generators on
   opposite sides of the cap's projected ellipse — a derivable
   discriminant), or better: make drawStart/draw order AUTHORABLE per
   stroke so scenes state intent instead of inheriting S&T's opaque
   chaining. SWITCH: expose the cylinder's cap-draw order as a param;
   default = S01 calibration.
10. ■ **S&T's 0.6 distance-thickness attenuation.** Every 2021
    material carried it; palette.ts bakes it as a constant factor.
    It is an aesthetic-era artifact, not a law. IDEAL: honest
    world-consistent stroke width; keep the 0.6 as a `legacyLook`
    palette flag for reproductions only. New scenes should not inherit
    it silently.
11. ■ **S05's opacity-fade transfer curve.** The measured fades
    contradict the source's run_time=1/wait(1) (fitted start/duration
    pairs would encode nothing; a g=0.68 exponent fit was refused).
    The hold runs ~2.19s where the source says 2.0. Matched the
    SOURCE; the 1/8 frame gap stands. IDEAL: nothing to build — if the
    true S&T completion→opacity curve is ever recovered from C4D, it
    becomes a framework capability; until then this is a reference
    flaw (▲-leaning).
12. ▲ **S08's orbit timing.** The encode implies ~7.06s; the source
    says run_time=7. We ship 7.00 and eat one frame at the orbit's
    fastest instant (~25ms phase). The reference's edit drifted; ours
    is the stated truth.
13. ▲ **MolochEye's lens arcs are Keynote beziers**, up to 12px off a
    true circle at full resolution. Ours IS the true circle — the
    overlay's only fringe is the reference deviating from itself.
14. ▲ **720p YouTube encode** as video-01 ground truth — compression
    tolerance is built into the evaluator; nothing to build.
15. ◆ **The azimuth mirror** — RESOLVED as a documented handedness
    adapter, not a convention flip: `reflectedZ(footprint)` maps
    C4D-authored scenes onto the host's convention once at the scene
    boundary. Measured worth: +0.79 coverage_ref in the cable phase
    (0.02 → 0.94-0.98 per frame, chamfer 13px → sub-pixel). The host's
    convention stays canonical; no re-scoring of other scenes needed.
    (Previously:) ■ **The azimuth mirror.** The host's heading zero is the 2021
    rig's turned 180° about Y; every calibration runs THROUGH the
    mirror. Harmless but a standing trap. IDEAL: pick the convention
    we want ON PURPOSE (recommend: keep the host's, document it as
    canonical in TASTE) and delete the "2021 rig" framing — a
    deliberate convention beats an accidental inheritance. No
    re-scoring needed if we keep the host's.

16. ▲ **The 2025/26 render's ink is faint and thin** — its bricks are
    nearly invisible mid-scene (437 blue px vs our 29,506 at t=6) and
    its cables threadlike, capping our precision (~0.5) while recall
    reaches 0.94-0.98. The reference under-draws its own scene; ours is
    the legible version. Nothing to build.
17. ▲ **The benchmark's opening (t 0-3.4) is the reference's pre-roll,
    not its choreography.** RESOLVED — and both halves of the original
    suspicion were wrong. The "faint dotted floor element" is neither
    floor nor maze: it is the **MoGraph Cloner's own 1x4x59 grid**
    (`TheWall.py:1007-1010`, MG_GRID_SIZE (0,100,100)) — the un-launched
    creatures parked at their grid slots, inked by Sketch & Toon even
    though `SetRelScale(0)` (`:1386`) zeroed the MindVirus child; the
    `MindVirusJourney` generator holon holding the ink is never scaled.
    Identified four ways: its angle tracks phi within 0.8 degrees across
    t 0-3.2, its minor spread is 3.6px (a 1px line, not a maze), its
    autocorrelation pitch is 34px against a projected slot pitch of
    34.84px, and it is 85-91% blue. The maze is explicitly disabled
    (`TheLabyrinth.py:463`) and the footprint circle projects top-down
    as a 700px RING, not a line.
    The launch-timing half is the same artifact: **100% of reference ink
    through t=3.4 sits ON that grid**, then 17,329 px leave it in one
    0.2s step at f0019 — a switch, not a motion. The source keyframes
    growth linear 0->1 over frames 0-500 with no offset or easing
    (`:497-521`), which lands the first creature by t=2.4; the render
    parks it until t=3.6. Source and render disagree, so this is a
    REFERENCE discrepancy, recorded not fitted. Our timing is confirmed
    correct by what follows it: coverage_ref 0.79-0.99 at sub-pixel
    chamfer from f0019 on.
    Nothing to build: drawing this would mean reproducing a generator's
    failure to hide a zero-scaled clone. We have no cloner, the wall
    owns its slots as data, and completion 0 means scale 0 means no ink
    — already the ideal. ACTION: exclude f0001-f0018 from scoring the
    way f0079-f0084's fade-out already is. Excluding them, the benchmark
    means **0.933 coverage_ref at 0.86px chamfer** over 20 frames.
    (Detail and measurements: docs/reports/wall/thewall-port.md.)

## The Origins campaign (2026-09-07)

18. ▲ **Scene07's code panel — the reference pasted a screenshot; we
    render the code.** The source declares `code_snippet = CObject()`,
    a bare placeholder: the published panel is a syntax-highlighted
    RASTER of pydeation source textured onto a plane — in a framework
    whose entire claim is that source code IS the thing. We render
    real Text instead (the panel is 36% of the frame's ink; omitting
    it was never an option). The reference supplied the content
    (legible character-by-character — and it is the code that builds
    the cylinder in the OTHER panel, which is the scene's joke) and a
    three-constant layout (column advance 8.516, column-0 centre
    −391.4, half-pitch 17.2 — reproducing every measured line centre
    within 1.1/2.2 world units). THE COST, stated: Arimo is
    proportional and centre-anchored, so columns drift and per-token
    colouring is absent; the gauntlet's asymmetry (cov_ours 0.90-0.99,
    cov_ref 0.80-0.86) is the signature of a font difference, not a
    layout error. SWITCH: a monospace face + left-align in
    render/text.ts — queued, out of chapter scope.

## The protocol going forward

- Benchmark scenes pass the legacy switches (sealAtOne:false,
  orphans:"discard", legacyLook) — fidelity stays reproducible forever.
- NEW scenes get the ideals by default. The flaw is never the default.
- Every future port adds its entries here at integration time, not
  after — this ledger is part of the definition of done for
  reproduction work.
