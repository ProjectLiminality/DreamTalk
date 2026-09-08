# P-6 handoff — where the chapter stood when the session limit hit

The p6 agent died at the account limit (resets 12:30 Berlin) with
Transitions.ts substantially complete and two of three proof scenes
written. The integrator scored what existed; this is the state.

## Landed and verified
- **Transitions.ts** (807 lines): the matcher (class via
  normalized-silhouette sampling + localizationKey, then MINIMUM TOTAL
  CENTRE TRAVEL via Hungarian assignment — greedy provably swaps
  objects on 3 of 50 multi-member classes), the glide (unique
  similarity taking A's box onto B's; the B page dark until swap), the
  ONTOLOGY verdict (one operator, two identity sources — the deck
  declares NO cross-slide ids anywhere: zero shared ids across all 57
  pairs, measured) and the anisotropy diagnostic (mismatches show up
  as fake stretches; 107/107 real matches isotropic within 0.4%).
- **MagicMove01** (deck 12→13, the crowd) and **MagicMove02** (deck
  36→37, the pure glide: 11 matched, 0 fades). MagicMove03 was never
  written (registration commented in scenes.ts).

## Integrator's scores (fresh bundle, port 4591)
- MM02: endpoints PASS (0.92/0.91 at onset, 0.96/1.00 settled);
  mid-glide 0.89-0.90 — near-bar, fails by a hair.
- MM01: onset frame PASSES (0.955/0.934); every mid-glide frame
  FAILS at ~0.23-0.35, and NO onset sweep rescues it (best 0.30/0.43
  at t=1.8 — not a phase error).

## The diagnosis for the revived agent
The composite (f_01087) shows the reference's dotted connection lines
STRETCHED BETWEEN heads mid-travel, while ours glide as rigid baked
drawables. Keynote re-derives connection lines per frame from the
objects they connect — the SAME truth P-4 established for static
slides (stored paths stale; recompute from connects) extended into
the transition: **a connection line is a RELATION, not a drawable,
and it stays one while its endpoints move.** The fix shape: during a
magic-move window, lines whose from/to both belong to matched pairs
must have their paths recomputed per frame from the interpolated
endpoint boxes (Connections.ts's connectionPath already takes the
boxes; the matcher already knows the pairs). MM02's small mid-glide
residual (0.89 vs 0.90 bar) is a separate, gentler question — ease
shape or the "implied motion path" curvature of the effect's own name.

## Also inherited
- The effect name is apple:magic-move-implied-motion-path — the
  IMPLIED MOTION PATH may curve; check the lotus tile's measured
  centroid track (MM02 header) against a straight line before
  assuming linear travel.
- p6's last confirmed measurement: MM02's declared 2.0s fits at rms
  3.8px on 101px travel; onset 604.9 measured.
