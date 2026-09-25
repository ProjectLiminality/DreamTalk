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

**Ten set-pieces exist and render**, each verified by eye against the
reference frames: `fourier` (the tracer proving itself on a square),
`quote` (the Vitalik quote, spoken), `flowertext` ("Web3" self-organising),
`vitruvian` (the figure drawn by epicycles inside circle and square),
`clarity` (shots 7–8, the complexity field and the clarity in it), `globe`
(shots 1/3/13/15, all three modes), `web2` (shots 4–5, the lattice
disintegrating), `nodenet` (shots 10–11, the graph and the four crystals),
`closing` (shot 17, the logo), `lightspread` (shot 13, insight travelling
the world).

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

## Not yet done

The 17 shots are not assembled; only set-pieces exist. Narration is available
(a full 14-segment VO exists in `Video/Audio/`) and the `say()` scoring
primitive now exists to carry it — but the shots must exist first.
