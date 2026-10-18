# Vision

![Vision](Vision.png)

The red mark: an S of two point-symmetric semicircles that kiss at the
centre, a round dot at the upper bowl's centre and a square at the
lower's — the yin-yang's two eyes made one round and one square.

**The concept it carries.** The InterBrain film names it: Vision — "an
organic vision that reveals itself through inspiration" (18:54), set
against Narrative's blue cube (f5686, "Narrative → Vision"). Vision
gardening is the antithesis of narrative engineering (19:02); the film
plants the mark in heads (f5716, f7021), in its own red ring with a white
light at its heart (f5776 → f5821), and in the iris of the liminal eye,
where the domesticated eye holds its cube (f12691 — see MolochEye `iris`).

Born as `SMark` inside the Regenaissance DreamNode (the eye of the vesica,
`WelcomeToTheRegenaissance.png`), where its proportions were measured;
popped out and renamed 2026-10-18. `Regenaissance/SMark.ts` only re-exports
it under the old names.

**Params**: `radius` (R, the circle it fills — every proportion is a
fraction of it), `tint` (the mark's one colour; Regenaissance's sampled red
by default, the film draws it RED in the eye and WHITE in its ring),
`weight` (the S band's width in units of R: 0.08 measured for Regenaissance,
`FILM_BAND` 0.05 in the film's eye, ≈ 0.035 in its ring), `ring` (0..1, the
red ring drawn on at 1.047·R; `ringTint`, `ringStroke`), `light` (0..1, the
white light at its heart, fitted to f5776's falloff; `lightTint`),
`presence` (the inherited fade a whole uses to bring it in).

**Abilities**: Create runs the pen along the S tip to tip, floods the band,
then opens the dot and the square together. The ring and the light are
their own params (`vision.ring.to(1)`, `vision.light.to(1)`).

`?scene=ib-vision` (the mark writes itself, the ring draws on, the light
rises). On the whiteboard it is still `sMark`.

**Proven by** `test/ib-vision.test.ts` (and the measurements in
`test/regenaissance.test.ts`); the frame comparison
`docs/reports/interbrain/vision-compare.png` (f5821, f12691, f12661, f31).
