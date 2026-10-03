# Open threads

Conceptual threads David has already transmitted that are well-defined enough
to act on, but were left unfinished as attention moved on. Kept here so they
never have to be explained from scratch again. Newest first; strike through
when done.

## The whiteboard loop (2026-10-03, active)
- **Tablet screen driven by DreamTalk** — the e-ink mirror of the whiteboard
  (AppLoad + qtfb installed on the tablet; `tablet/dreamtalk-pad/`).
- **Voice on a selection** — select, then speak; nothing selected = the whole
  scene. Built (`sketch/voice.ts`); needs David's first real use.
- **Text as a platonic symbol** — handwriting → Text whose input is the string
  and output the animated writing geometry.
- **3D tumble** — rotate a selected symbol and discover it was 3D all along.
- **Strokes in 3D** — Grease-Pencil: strokes on a plane facing the camera, then
  lifted into a 3D scene in the editor.
- **DreamTalk develops DreamTalk** — draw + speak to show Claude what to build;
  the strange loop toward the DreamSong that specifies DreamTalk itself.
- Later: a fast typed-output vision model for live recognition; 3D on e-ink.

## Creator mode (2026-09-20 transmission)
- "The music contains the instrument": one key (⌘-space / AURYN) flips **game
  mode ↔ creator mode**; a golden glowing dot makes hovered elements glow;
  clicking selects instead of fires; behaviour is edited in place (calculator
  `+` → `×`, Super Mario). **The mode now exists (2026-10-03,
  `core/editor/creator.ts`):** the lone backquote (`` ` ``, the key under Esc —
  ⌘-Space is Spotlight, ⌥-Space is Raycast/Alfred) flips the demo player and
  the editor viewport into it: golden dot cursor, gold rim on hover, click
  selects. The player freezes t and shows a read-only panel with "open in
  editor ↗" (`?sel=…&creator=1`), where a param change is a setOverride op
  written into the DreamWeaving — i.e. git-tracked.
- **Why `+` → `×` cannot yet be done honestly in creator mode:** the
  calculator has no behaviour to change. Its `8` and `15` are two authored
  `Text`s the score fades in, not the output of a rule; `+`/`×` are two glyphs
  swapped by opacity. The data model lacks (a) **behaviour as data** — a holon
  carrying a rule (an operator function, HyperTalk's "the button contains what
  it does") from which another holon's content derives; (b) **string params**
  — `Text.content` is construction data, not a `Param`, and the only
  persisted edit (`setOverride`) writes numbers. Both are needed before
  selecting `+` and saying "make it times" can recompute 15.
- **Changes are git-tracked**; Claude-artifact-style comment mode generalised to
  any element.
- **Dream Explorer** — a third mode that disassembles a scene into its
  DreamNodes; window ≡ folder ≡ DreamNode (epistemology = ontology). Reference:
  HyperTalk.
- **DreamSong as cut scene** — the real UI driven by a scripted timeline.

## Audio
- Narration as a timeline clip is built. Open: a better narrator voice than
  macOS `say`; **universal voice mode** (deferred by David).

## Web3 video (Liminal Consulting)
- 12 of 17 shots render. Open: shots 6, 9, 12, 14 from existing set-pieces;
  sequence all 17 into one DreamSong; carry David's 14-segment voice-over.
- Waiting on David: his photograph for shot 16; who reads the Vitalik quote;
  whether the 3Blue1Brown soundtrack comes across.
- Cosmetic: YinYang globes render as outlines.

## Engine
- Performance roadmap E/F; ontology builds (SDF square∩circle cylinder,
  GeometrySketch, RayCaster, node-graph visualisation).
- DreamOS as one "dream graph" (Plan 9 / Houdini: a uniform data model through
  a procedural graph, nodes as code) — the tablet as one more client of it.
