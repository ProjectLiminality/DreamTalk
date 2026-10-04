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
- **Live distill** — "a cool UX where that could happen in real time while
  I'm drawing": passes traced over each other distil by themselves once the
  pen rests 600 ms, one undo step, a brief glow (`sketch/livedistill.ts`,
  toolbar "≋ live", OFF by default). Built 2026-10-04; needs David's first
  real use, then tuning of the pause and tolerances to his hand.
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
- **`+` → `×` is now honest (2026-10-04):** behaviour is data. String
  params exist (`text()`, `choice()` in src/params); `Text.content` is a
  param read as data (`asData`), so it can share another holon's param or
  follow a derived reading. The Calculator holds `op = choice(...)` and
  `out` DERIVES from inputA/op/inputB through its rule table; the song's
  beat 5 changes `op` itself. In creator mode: select `+`, open in editor,
  pick `×` in the inspector's menu → `new Calculator({ op: "×" })` is
  written into CreatorMode.ts (a shared param commits to its OWNER), 8
  becomes 15, reload keeps it. Open: a paused view does not repaint when an
  async text re-layout lands (needs a "layout landed" hook in render/text).
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
- **Assembled (2026-10-04):** `?scene=web3`, all 17 shots, 171s, David's
  voice-over placed from the final mix (docs/campaigns/web3.md).
- Waiting on David: his photograph for shot 16; who reads the Vitalik quote
  (the final mix has VitalikQuote.mp3, not David's 07 take); whether the
  3Blue1Brown soundtrack comes across.
- Open: slide-wipe transitions; heavier-than-Manim text weight.

## Engine
- Performance roadmap E/F; ontology builds (SDF square∩circle cylinder,
  GeometrySketch, RayCaster, node-graph visualisation).
- DreamOS as one "dream graph" (Plan 9 / Houdini: a uniform data model through
  a procedural graph, nodes as code) — the tablet as one more client of it.
