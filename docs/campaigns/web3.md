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
| **FlowerText** | building | Recurs 4× in this video alone. The mechanism generalises to any text. |
| Globe (outline/solid/light-spread) | proposed | Recurs, but the three modes may be three different things wearing one name. Decide on second use. |
| PlatonicSolid (5-in-1) | proposed | Appears once here. Wait for a second use. |
| NodeGraph (centralised↔decentralised) | proposed | Strong idea; the parameterisation is the argument itself. |
| David's portrait card, PL logo, Web2 triangle | one-offs | Specific to this piece. |

**The Vitruvian Man is NOT a holon** — it is `FourierTrace` + a red circle +
a blue square, composed in a scene. That is David's own verticality read: the
reusable thing is the tracer; the figure is what it happens to be tracing.

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

## Not yet done

The 17 shots are not assembled; only set-pieces exist. Narration is available
(a full 14-segment VO exists in `Video/Audio/`) and the `say()` scoring
primitive now exists to carry it — but the shots must exist first.
