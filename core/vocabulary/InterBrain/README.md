# InterBrain

![InterBrain](InterBrain.png)

The face of the InterBrain: the Project Liminality [Logo](../Logo/) at the
heart of a faceted crystal, a dark bloom round the Logo.

**The concept.** "A collectively interconnected inter-brain in which we all
participate as equals" (27:07) — the instrument the film builds towards. In
the film its icon sits in a ring as a [DreamNode](../DreamNode/) (f8221,
f12376 red; f9271 blue).

**Our own face.** The film's icon is a third-party note app's crystal with
the Logo pasted in. This holon keeps David's composition (InterBrain.png,
2025-04-06: the Logo at the heart of a crystal, wrapped in a dark bloom) and
draws the crystal anew as a construction — a double-terminated hexagonal
quartz seen face-on, symmetric, nine facets washed purple and lit from the
upper left — not the app's silhouette.

**Faces**: `?scene=ib-interbrain` — the face above is t≈3.9; at t≈7 it sits
in its red ring (`DreamNode` with `dreamTint: RED`).

## Params

`radius` is the crystal's half-height — the symbol's one size and its
`reach`. Measured on InterBrain.png: half-width 0.777·H, the Logo's ring
0.304·H, 0.142·H below centre (`CRYSTAL`). `tint` (edges), `shadowTint` →
`lightTint` (the facets' wash), `stroke`, `edgeOpacity`, `facetOpacity`;
the bloom: `bloomOpacity`, `bloomRings`, `bloomReach` (× the Logo's ring);
`logoStroke`.

Create: the edges draw, the facets wash in, the heart darkens, then the Logo
makes itself with its own choreography (the Logo is imported, never redrawn).

## Proven by

`test/ib-interbrain.test.ts`; `docs/reports/interbrain/interbrain-compare.png`
(f12376 and InterBrain.png against the render).
