# Liminal Consulting · Decentralizing Web3 Insights — the campaign

Reverse-engineering David's 171s video into DreamTalk. Kicked off 2026-09-24.

**Source (read-only):** `~/RealDealVault/LiminalConsultingWeb3/`
— `Video/LiminalConsultingWeb3Final.mov` is THE CANON (171.0s, 2560×1440, 30fps).
Training wheels beside it: 5 `.c4d` scenes, `Video/LiminalConsultingWeb3Video.key`,
`~/RealDealVault/VitalikQuote/` (the Manim quote + its spoken mp3),
`~/RealDealVault/VitruvianMan/` (rendered media only — no vector source).

**Canon policy holds:** replicate only what is VISIBLE in the final render.
Anything that exists solely in a source file was an experiment.

## Where things live

```
core/src/geometry/fourier.ts      the epicycle maths (pure, closed-form tested)
core/src/geometry/flower.ts       flower-of-life packing + deterministic noise
core/vocabulary/Fourier/          FourierTrace — the drawing
core/vocabulary/Quote/            Quote — words + attribution + spoken audio
core/vocabulary/FlowerText/       FlowerText — text that self-organises
core/demo/web3/                   the scenes of THIS video
docs/reports/web3-recon.md        the 17-shot breakdown + set-piece measurements
refs/web3/frames*/                extracted frames (gitignored)
```

Scene keys are registered in `core/demo/scenes.ts`: `fourier`, `quote`,
`flowertext`, `vitruvian`.

## The structure of the piece (recon §shot table)

A **yin-yang argument**. Web2-centralised against Web3-decentralised, bridged
by the Vitalik quote, resolved by the Vitruvian Man and the PL logo. Motifs
recur as deliberate callbacks rather than as decoration.

17 shots. The set-pieces, in order:
- **31–43s** "Web3" self-organising from scattered circles (C4D)
- **66–76s** the Vitalik quote (Manim) — spoken, but see the voice note below
- **92–106s** the Vitruvian Man traced by Fourier epicycles (Manim, 3B1B style)
- **128–146s** the Web3-spreading-light hero

## Reusable components — what earned it, and why

David named two; recon proposed more. The test applied: does it recur, and is
its *parameterisation* the interesting thing?

| holon | status | why |
|---|---|---|
| **FourierTrace** | built | David named it. Input is a path + "how many terms"/"how close" — a general draw-verb for any line symbol, not a Vitruvian-specific effect. |
| **Quote** | built | David named it, on recurrence grounds. Words + attribution + *the recording of them being said* is one unit. |
| **FlowerText** | built | Recurs 4× in this video alone. The mechanism generalises to any text. |
| **Globe** | built | Recurs 4×. The modes question was ANSWERED: they share one spine (a projected, spun sphere), and differ only by `continents: fill\|outline` and colour. The halo, rays and hotspot were deliberately left demo-side — folding them in is what would have made it three things wearing one name. |
| **Platonic** | built | The "wait for a second use" test was met at once: FOUR of the five appear together in shot 11. Pure maths split out as src/geometry/platonic.ts, 32 tests pinning all five solids' vertex/edge counts. |
| NodeGraph (centralised↔decentralised) | proposed | Strong idea; the parameterisation is the argument itself. |
| David's portrait card, PL logo, Web2 triangle | one-offs | Specific to this piece. |

**The Vitruvian Man is NOT a holon** — it is `FourierTrace` + a red circle +
a blue square, composed in a scene. That is David's own verticality read: the
reusable thing is the tracer; the figure is what it happens to be tracing.

## Host properties learned the hard way

- **A `Null` used as an animation DRIVER must be explicitly zeroed.**
  `creation` defaults to **1**, so `new Null()` starts at its END state and the
  scene opens fully formed (or, worse, already faded out — a black frame with
  a complete holarchy behind it). This bit THREE scenes before it was written
  down: the patience song, Web2Disintegrating, NodeNetwork.
- **`rgb()` normalises; a `Color` is already normalised.** Blending two Colors
  and passing the result back through `rgb()` divides by 255 a second time,
  giving ~0.002 — near-black ink. This was Web2Disintegrating's real defect,
  and it masqueraded convincingly as a colour-too-dark or stroke-too-thin
  problem. Blend components directly.
- **`holon.x = 5` REPLACES the Param object with a number** and destroys any
  binding. Use `.value` for a constant, `.follow()` for a derived reading.
- **`projectLatLon` returns a camera-facing `z`; discard it and the far
  hemisphere projects onto the near side.** Anything drawn on the sphere must
  cull `z < 0`, as Globe's own outline mode does. A break in a polyline is the
  honest rendering of a line passing behind the globe.
- **Measure the frame WITHOUT the HUD.** The demo's timecode readout sits at
  the bottom-left and lands in any full-frame bounding box, which made three
  successive arc measurements read 1.75× when the truth was 1.02. A confident
  wrong number is worse than no number.

- **Opacity is PER-PRIMITIVE and is not inherited by a Group's children.**
  Setting opacity on a Group is inert; position DOES cascade. Found when a
  globe demo's fade-sequencing silently did nothing and all three modes
  stacked on top of each other.
- **Measured colours are not always drawable colours.** A field colour sampled
  from a frame is the AVERAGE of thin bright ink over black; drawn literally
  as ink it reads near-black. See `ClarityField`'s red, lifted from #7a2a24 to
  #c4463a with the reasoning stated in the file.

## Honest limits, recorded so nobody re-discovers them

- **All five `.c4d` files are compressed.** `strings` yields only Maxon
  type-ids — no object, cloner or effector names. Every C4D attribution in the
  shot table is a filename-plus-visual guess, marked as such in the recon.
  Confirming the effector stacks needs C4D open.
- **The Vitruvian silhouette is a TRACE of pixels**, not recovered vector
  geometry (no SVG exists anywhere in the projects). Its path file says so in
  its header. Treat it as evidence, not as authority.
- **The self-organising mechanism is David's account, frame-confirmed** —
  packing masked to text, displaced by noise, noise animated to zero. He
  warned explicitly against solving it with attractors ("fighting entropy").
  It is written down here because it is the kind of thing that would otherwise
  be re-attempted the hard way.

## Who reads the Vitalik quote — a correction

Recon reported that the quote "is spoken", citing `Video/Audio/VitalikQuote.mp3`
(7.93s, matching the 7.5s write), and the Quote holon was wired to it.
Measuring the FINAL MIX complicates that:

RMS across 64–78s shows continuous speech from 64s to 71s, a pause, and a
short return at 74–75s — one voice, running longer than 7.93s. The VO folder
also holds `07_if_the_thing.m4a` (12.18s), which is **David reading the quote
himself**. The evidence therefore points to David's reading being what is in
the video, with `VitalikQuote.mp3` an asset that did not make the final cut.

Under the canon policy (only what is visible/audible in the final render
counts), the reproduction should use **David's reading**, not the Vitalik
recording.

What was built is unaffected and still correct: `Quote.voice` +
`scripts/import-voice.ts` are the mechanism for "a real recording, by whoever
said it", and the mechanism was proved end to end with the Vitalik file. Only
the choice of WHICH recording the reproduction uses changes — and that is
David's call, so it is recorded here rather than silently switched.

## The 3Blue1Brown question — flagged, not decided

David raised this himself in the pixel-universality transmission: 3B1B is a
superb reference, he open-sources his material, and the care needed is "to not
look like I'm stealing anything". Two concrete things surfaced here:

1. **The epicycle Fourier figure is Grant Sanderson's signature visual.** What
   we have built is an independent implementation from the mathematics (the
   coefficients are a textbook integral), not a port of his code — and the
   `FourierTrace` holon is general, not a copy of his scene. That is a
   defensible position, and an attribution in the DreamSong's own credits
   would make it a generous one.
2. **The original video's score is literally his.** `Video/Audio/` holds
   Vincent Rubinetti's *The Music of 3Blue1Brown* (Resonance, Hypothesis).
   Rubinetti releases that music for use with attribution, so this is likely
   fine — but it is DAVID's call, not ours, and a reproduction that silently
   carries someone else's soundtrack should not happen by default.

**Position taken:** build the mathematics and the holon (done); do NOT import
the soundtrack into the reproduction without David saying so. Raised rather
than decided.

## State (2026-09-24)

**Twelve set-pieces exist and render**, each verified by eye against the
reference frames: `fourier` (the tracer proving itself on a square),
`quote` (the Vitalik quote, spoken), `flowertext` ("Web3" self-organising),
`vitruvian` (the figure drawn by epicycles inside circle and square),
`clarity` (shots 7–8, the complexity field and the clarity in it), `globe`
(shots 1/3/13/15, all three modes), `web2` (shots 4–5, the lattice
disintegrating), `nodenet` (shots 10–11, the graph and the four crystals),
`closing` (shot 17, the logo), `lightspread` (shot 13, insight travelling
the world), `portrait` (shot 16, the frame around a photograph we did not take), `yinyang`
(shots 2–3, the thesis).

Four reusable holons landed: `FourierTrace`, `Quote`, `FlowerText`, `Globe`.
All four share the same shape — ONE param drives the whole effect, so each is a
pure function of one number and scrubs backwards exactly.

**What the Vitruvian trace actually is** (correcting an earlier claim of mine
in commit eaa250e): the figure DOES carry both arm positions and both leg
positions — the eight-limbed Da Vinci pose — visible in the completed render.
I had called it four-limbed after reading a mid-trace frame, which was simply
wrong, and the path's own extremes confirm the full pose.

The real divergence is subtler: the original's SELF-CROSSING single stroke is
not unambiguously recoverable from pixels, so what was traced is the outer
ENVELOPE of the silhouette — one simple closed loop, which is what a Fourier
series wants. Inner crossings where limbs overlap are therefore absent. The
right side was also mirrored from the crisp left (the frame's right limbs are
broken) and the head synthesised, since the pen finishes there under its own
machinery. All documented in the path file's header.

## What shot 16 is waiting for

The portrait card is built as a FRAME with an explicit placeholder: the ring,
proportion and timing are reproduced and measured, but `media/David.png` is
not in this repo. Committing a photograph of a person into a framework
repository is David's call. The placeholder announces itself in an assembly
rather than leaving a silent gap — when the cut is reviewed, this shot says
what it is waiting for.

## YinYang's globes read as outlines — FIXED (2026-10-04)

The real cause was in the host, not the scene. `ThreeHost.washesFillOpacity`
decides ONCE, at attach, whether a Stroke ever needs a fill mesh: yes if its
`fillOpacity` is non-zero then, or if some timeline track names that param.
YinYang's land follows a reading — `landOpacity.follow(birth.creation…)` — so
at attach it was 0 and no track names it (the track is on the `birth`
driver). No wash was ever built; only the zero-width coastline strokes drew.
GlobeDemo (constant 1) and LightSpread (a direct `landOpacity.to(1)` track)
never hit it. Fix: a BOUND `fillOpacity` counts as "may show"
(`src/render/three-host.ts`). Any scene that follows a fill into existence
benefits. Verified by before/after frames of `yinyang` at t=5.

## The assembly — `web3` (2026-10-04)

`core/demo/web3/Web3Song.ts` is the whole video as one DreamSong, **171.0s**,
song time = video time. Its header carries the chapter table (every cut
read off the final render at 4fps) and how the voice-over was placed. Six
set-pieces are RETIMED there by subclass (their holons untouched, only the
timing measured from the frames); the standalone `say(…, {hold})`
placeholders had pushed beats seconds late (LightSpread's arcs fell past
their cut).

New shots, all compositions of what existed:
- `web3s01` Shot01Globe — the dark globe brightening (Globe holon only).
- `web3s06` Shot06Web3Word — FlowerTextDemo retimed: rises from below, ~2.8s settle.
- `web3s09` Shot09Quote — ClarityField `veil` + the Quote holon, in Times.
- `web3s12` Shot12Vitruvian — figure present from the start, pen lapping
  every 4.5s (the final render, not the standalone demo, is the canon).
- `web3s14` Shot14Callback — ClarityField again; `expand` swells the disc
  into the hero's ring.
- `web3s15` Shot15Hero — globe + flower lattice + red ring + rays + bloom at
  the measured proportions.

**Fixes found on the way (each at its own level):**
- `ClarityField` rebuilt against the frames: its drivers were `new Null()`
  (creation 1 — it opened fully formed), its field ~2× too large and far too
  bright. It now has four beats (burst, clarity, veil, expand) so shots 7–9
  and 14 are ONE scene recurring.
- `NodeNetwork`: the four crystals showed from t=0 — `c.opacity.to(1)` on a
  Platonic (a Null) hides nothing; now a deep `FadeIn`.
- `YinYang`: drew ~21% too large against f_00009; camera zoom 0.82.
- `Globe` fill (`clampedRing`): a continent passing behind near the antipode
  had its far points clamped along arbitrary screen directions, sweeping the
  whole limb — the Americas seen from 110°E flooded the disc and turned the
  visible land into holes. Hidden runs are now the shorter limb arc between
  the crossings; a wholly hidden ring is a zero-area closed sliver (an empty
  child would switch off the whole drawing's fill). Regression test on the
  real continent data.
- `DreamSong` hiding now goes through `Param.gate` (a multiplier on a numeric
  param's reading): writing a BOUND opacity throws, and ClarityField,
  YinYang and LightSpread bind theirs — the song could not sample at all.
- `Quote` gained `font`/`attributionFont` and a right-aligned credit (Manim's
  `aligned_edge=RIGHT`); `Times-Roman`/`Times-Italic` added to SYSTEM_FACES
  (extract with `bun core/scripts/system-font.ts Times-Roman Times-Italic`;
  without the cache the text falls back to Arimo).

**Voice-over.** Each of the 14 m4a takes was cross-correlated against the
final mix chunk by chunk; the USED pieces were cut and imported under voice
`David` (18 pieces + the quote = 19 lines). `say()` gained `duration` for a
real recording of known length. The cut points (source seconds), so the cache
can be rebuilt with `scripts/import-voice.ts "<text>" <cut> --voice David`
(texts are in `WEB3_VOICEOVER`):

    01 0.6–6.9   02 7.0–14.9   03 0–9.2   04 0.72–4.75 | 5.4–11.2 | 11.4–23.6
    05 1.0–7.9   06 0.9–2.9    08 0.5–3.2 | 3.9–9.6    09 0.5–3.4 | 3.45–end
    10 whole     11_a_universal 0–2.6 | 2.65–4.4       11_not_limited 0.9–end
    12 1.6–end   13 whole

Two takes are not in the final mix and are not placed: `07_if_the_thing`
(the mix correlates with `VitalikQuote.mp3` at 63.3s, not with David's
reading — this contradicts the "Who reads the quote" section above; the
quote keeps its current voice, and the choice stays David's) and
`14_I_would_love` (an alternate of 13's last sentence).

**The moves between shots (2026-10-04, re-measured at 30fps).** Fitting a
circle to each node's ring in every frame of 10–21.5 showed the yin-yang
does not settle: it spins 1515° (four turns and a fifth) from 11.0 on one
C4D ease-in (left tangent 0.18), still at ~170°/s at the cut, and its lobes
trade sizes once per four turns (blue share 0.5 + 0.375·sin(turn/4); each
ring 0.56 of its lobe) — YinYang.ts now draws exactly that, within ~3px of
the reference frame by frame. The "dive" is a dolly straight in on the
figure's CENTRE (19.6–21.5, distance to 0.15 on an ease-in), not an aim at
the blue node: the node swells and swings across in front of the camera.
The two vertical pushes are each ~2.6s Keynote curves (tangents 0.4 / 0.45,
105.3–108.05 and 144.25–146.8), now `slide(d, PUSH)`. The first also
dissolves — the two pictures' screen brightness sums to one, 105.5–107.6
on a 0.35/0.35 curve — stated as `slide(…, { …, screen: true })`; within
0.02 of the reference throughout.

**The nodes, at full resolution.** The red node is the hero's construction
(black-sea globe IN a white bloom, flower of life, twelve rays); the blue
node's lattice is a triangular grid of straight lines in the band between
globe and ring. Globe/ring 0.46 (blue), 0.415 (red); ring/lobe 0.547 /
0.577. The host treats a tint as LINEAR light and encodes it for display
(0x1495ee drew as 79 201 247), so YinYang hands its sampled screen colours
over decoded (`seen()`); the rings now land within a few levels of the
frames. Every other scene's sampled tints draw lighter than sampled for
the same reason — an engine-wide question, not settled here.

The dive's fade to black is the crossfade into Web2 on its own measured
curve: `crossfade(1.75, { smoothing: {0.85, 0}, screen: true })`, 19.75–21.5,
within 0.01 of the reference's screen brightness; Web2's camera retraces
the dive under it (keyed every 50ms) so the crossfade's camera lerp is a
no-op. The bolts are filled ⚡ glyphs traced off the 14.4s frame — a
drawing (Stroke + one closed Line), the host's even-odd fill for a concave
outline.

The red globe turns faster than the blue (to 0.5 + 0.78·TAU over the
spin): South America at 11s, Asia and Australia through 17–21s, as the
frames show.

**Fixed by the engine (verified in a frame each, 2026-10-04):** the dive's
red globe no longer goes see-through mid-fade (cdf2ae4, dissolves flatten
each picture before mixing — 21.2s), and the hero's lattice no longer
draws over its globe (3dd6173, ribbon runs — 140s).

**The whole song against the reference, 1fps, 0–171s (2026-10-04).** Read
side by side (reference frames taken on the exact second). What still
visibly differs, in order:

- ~~0–4 (globe)~~ DONE: it fades up out of black on the measured keys,
  a warm seam meridian sweeps in from the right limb to the centre over a
  frosted far half, and from 3.0s the globe shrinks while its limb is
  pushed outward as the yin-yang's circle (Shot01Globe.ts).
- ~~5–8 (yin-yang birth/division)~~ DONE: the one globe divides into two
  that draw apart into their lobes (4.0–6.05, measured curves), the circle
  is never drawn on — it widens — and the S-curve and decoration come in
  5.75–7.0. The globes' faces follow the frames throughout (one face for
  both, drifting west: India → Africa → the Pacific → Asia).
- ~~22–31 (Web2)~~ DONE: re-measured size and place (468 units wide, base
  188 below centre), the frame's blue, a whole-lattice fade-in 21.75–23,
  down-cells vanishing on release, upright cells settling ~100px under the
  base, and the release front climbing linearly from 25.25. Ours still
  reads a little brighter and its fallen cloud a little narrower.
- 31–45 (Web3 word): size DONE — re-measured 742 × 226px, centred 13px
  high (the demo's word at 0.78×, ringlets with it). Still different: the
  face — ours is Arimo (Arial metrics, bundled, open licence); the original
  reads as Helvetica, slightly heavier — and the colour (David's call).
- ~~45–47~~ DONE: the field fades up frame-filling behind the word
  (45.05–45.45), then the WHOLE picture contracts — lattice, halo, ringlets
  and the word with it — from 2.945× at 45.70 to rest at 47.75 (fitted to
  the halo's median radius, RMS 1%). Still different: the original's field
  is a full rectangle at its largest (ours a disc reaching past the frame's
  sides, not its corners), and its settled core shows a brighter lattice.
  FOUND ON THE WAY (src/song.ts): transition ramps multiplied onto each
  HOLON's opacity gate, and FlowerText's thousand ringlets share one
  opacity param — so a crossfading word went to 0.97^1000 in one frame and
  vanished at 45.05. Ramps now go once per param (test in slide.test.ts).
- ~~63–74 (quote)~~ DONE: per-line write-on measured at 8fps (63.3–65.5,
  65.75–67.5, 67.8–70.0), credit 71.0–71.75, fade 73.35–74.1 — ours within
  ~0.1 of a line throughout.
- ~~86–93 (node network)~~ DONE: the cluster now expands out of the
  disc (camera pull-back, 78.75–80.5); at 85.5 the four crystals draw on
  SUPERIMPOSED at the centre (icosahedron the outer cage, the others nested
  — that is the original's "dense graph", not a mesh of the cloud), the
  cloud fading 86–87; at 88.5–89.4 they part into the compact 2×2
  (±142, +145 / −128) and shrink to rest. The near-neighbour mesh is not
  staged.
- ~~107–113 (light globe)~~ PARTLY DONE: it now turns the frames' whole
  way (Asia at 107 → India 110 → Africa 113 → South America 118.5) at the
  measured size, and the light starts at the left limb over the Sahara.
  Still different: the original ignites as a soft radial GLOW that shades
  the land from white to grey across the disc; ours floods flat grey →
  white. A radial gradient fill is a host capability (src/render) — not
  done here.
- ~~114–118 (arcs)~~ DONE: lifted to the measured 1.2× (the ink spans
  1.19× the globe from 115s on) and occluded only where they pass behind
  AND inside the silhouette, so they loop out past the limb as orbits.
- ~~119 and 128–130 (fades)~~ 119 DONE: it is a DIP through black, not a
  cross — the globe gone 117.85–119.05, the field in 119.05–120.4 (new
  `FadeCurve.dip`, src/transitions.ts). The field's colours re-measured
  too (deep-red lattice, 13px cells, smaller dots, ring (25,125,205)). Our
  field still comes back ~15% brighter than the reference. 128–130 needed
  nothing once the field's brightness matched.
- ~~163–165 (closing)~~ DONE: logo 0.786× (blue ring 155.5px), title
  centred 210px below at the same width; the blue ring FADES in
  (158.75–159.5), the A's legs draw up together (160–161), the red ring
  161–162, the title 162.75–164.4. Within ~3px everywhere.
- 146–157 (portrait): ours is the placeholder — the photograph awaits David.

**FINAL remaining differences (1fps full-song sheet vs reference,
2026-10-04, after all of the above):**

- ~~1–3s glow~~ DONE: soft columns of light where the seam meets the
  limb, top and bottom (nested filled ellipses), fitted to the frames'
  brightness, width and drift.
- ~~31s~~ DONE: the cloud enters at ~31.1 and settles by 33.4. Still
  different: the original's Web2 lattice lifts off the top of frame while
  the word arrives (ours crossfades it), and its word forms left to right
  ("Veb" reads at 32 with the 3 still loose); ours settles evenly.
- 31–45s: the word's typeface (Arimo vs Helvetica — a licensing call) and
  colour (David's call).
- 108–113s: the light globe ignites as a radial glow shading the land
  white → grey; ours floods flat (needs a gradient fill — with engine).
- ~~128–130s~~ DONE: the swell starts at 123.0 (not 125) on the measured
  radius keys, the ring is red by ~129.25, the disc keeps its lattice while
  the halo goes, and the hero crossfades in over it (130–130.5) on one
  shared camera, then comes up slowly — bloom over 3s, land white by 131.5,
  ring carried 237 → 253px — with its ring, lattice and bloom re-measured.
- 63–74s: our quote type is heavier than Manim's hairline serif.
- 146–157s: the portrait is a placeholder — awaiting David's photograph.
- ~~163s~~ DONE: the title's ink width tracks the frames within ~0.1s.

Everything else — the opening, the yin-yang's birth, spin and dive, Web2,
the field's contraction, the quote's timing, the network, the pushes, the
light globe's turn and arcs, the dip into the callback, the hero and the
closing — matches the frames at 1fps.

**Not reproduced, stated rather than faked:** Text renders
heavier than Manim's hairline serif; the light globe's radial glow (a
gradient fill, host-side).
