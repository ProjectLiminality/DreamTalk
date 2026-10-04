# Eye

![Eye](Eye.png)

The creature of video-01 — the "circler" and "rectangler" who watches
the dialectic unfold. The Observer presents as the Eye (ONTOLOGY.md).
Two lid rays from the apex, opened ±22.5°; the eyeball arc spanning the
same fan (the lids deliberately overshoot past it — the little tick at
the tips); iris and pupil as filled ellipses. CreateEye draws the lids
as ONE stroke — the pen runs the upper lid in to the apex and back out
along the lower — and UnCreateEye takes the look before the shape.

**Promoted params**: `opening` (lid half-angle scale), plus the Stroke
set (`tint` binds lids, eyeball and iris; the pupil stays black).

**Lineage**: pydeation `custom_objects.py:79-80` (the three-point lid
spline), `animator.py` CreateEye/UnCreateEye dispatch. Proven by the
S01/S02/S08 gauntlets and the Create-choreography tests
(`test/vocab.test.ts`).

**Looking — the RayCaster** (`RayCaster.ts`, the Eye's latent ability,
ONTOLOGY 2026-09-16/17): `eye.rayCast([shape])` casts three rays across
the eye's own opening (its lid lines and its gaze, derived live — turn or
blink the eye and the fan follows). Each ray stops where it meets a
collider's outline, an "x" marks the hit, and a shockwave rings out from
it, ease-out, fading as it spreads; one param, `cast`, drives it all
(verb `Cast`). The general form `new RayCaster(emitter, colliders,
{ first, last, steps })` casts from any holon in the xy plane, isotropic
by default. It lives here, not popped out, until a second symbol needs to
cast (the gardening rule). Not yet: the collision ping on the audio track
(no effect-driven audio exists) and casting from surface normals / in 3D.
Proven by `test/raycaster.test.ts` (20) and `/demo/?scene=raycaster`.

**Parts**: primitives only — 2 Lines, an Arc, 2 filled Ellipses.
