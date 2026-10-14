# Open threads

Conceptual threads David has already transmitted that are well-defined enough
to act on, but were left unfinished as attention moved on. Kept here so they
never have to be explained from scratch again. Newest first; strike through
when done.

## The visual automaton (2026-10-13)
- **Overview for David: `docs/reports/automaton.md`** (the editor half:
  `docs/reports/editor-automaton.md`). Every symbol whose params express
  states declares `stateSpace()` (axes over States; `toggle`, `choices`,
  `poses` for scene states); free play (Space, `?play=free`) walks it, the
  song is one path through it (`holon.stateAxis(id).to(pos)`). Try
  `?scene=gallery&play=free` (← → between symbols).
- **Built:** `src/automaton.ts` (deterministic C¹ retargeting, verbs via
  `via`, clocks, one param one axis, per-holon keys), `demo/game.ts` (HUD,
  hover ticks, focus), `src/view.ts` (orbit/pan/dolly as bias/gate over the
  observer's readings; keep-outs; surface orbit over an Earth close-up;
  exact world-space framing), `editor/touchcamera.ts` (pinch/pan, double-
  tap), `editor/overlay.ts` (one stage→page mapping, the DPR-2 fix).
- Open: four declared keys collide with the player's reserved ones
  (Horizons `h`, SOPLoop `f`/`r`, FlowMap `m`) and are silently replaced —
  new keys or a warning, and the reserved list belongs in automaton.ts;
  record a walk as a song (the journal exists; ⌘K captures one move);
  camera flight as part of a path; David's eye on the hover ticks/caption
  (glow now owns the look).

## The Earth (2026-10-13)
- **Built:** `core/vocabulary/Earth` (`?scene=earth`). A true 3D sphere
  from Natural Earth 1:50m: land triangulated on the sphere, coast and
  borders as surface strokes with their own draw-ons, the far side hidden
  exactly by a horizon-plane disc (solid `Surface`s write depth, the host's
  first occluder), NE `min_zoom` LOD, `Place` anchoring, `EarthView`
  (lat/lon/zoom/tilt + `FrameRegion`), Factory/Headquarters with GPU hidden
  lines, and mock European sites (the real ones stay private).
- Built 2026-10-13 (round 3): graticule, lakes, rivers, per-country
  highlight sheets (`highlight` + `country(iso)`), camera-facing labels
  (country + city, LOD + horizon fade, overlay compositing via the new
  opt-in `Text.composite`), `Focus` / `FlyTo` verbs; `?scene=earth-features`.
- Built 2026-10-13 (round 4): label declutter (fixed priority, continuous
  yield, stateless), 1:10m regional packs (`packs/alps10m.ts`, 80 KB; grid
  cells as the seam), night side + terminator, atmosphere halo, land light.
- Built 2026-10-13/14: data layers (`Choropleth`, `PointData`, Connection
  flows; `?scene=earth-data`), `vocabulary/GeoFlow` (a FlowMap with lat/lon
  on the planet ↔ its abstract map along one axis `v`; `?scene=geoflow`),
  free-play axes + keep-out, and **One Earth**: the flat Web3 Globe is
  retired, every former globe is an Earth set on the page by
  `src/parts/recede.ts` (docs/reports/consolidation.md).
- Open: more detail packs (Europe-wide is large); ~~measured glyph boxes for
  the declutter~~ (measured Arimo advances, 2026-10-13); morphing
  the site→HQ `Connection` arcs into one circle (they expose
  `worldCurves()`); and the colour-space question below. (Draw-on cost
  fixed 2026-10-13: 80 → 20 ms, byte-identical.)
- **Colour space (framework-wide, not Earth's):** tints are fed to three as
  LINEAR and sRGB-encoded on output, so `RED` #FF644E renders ≈ #FAA593 and
  a fill of 0x2a reads as #717171. Measured on the Earth's factories and
  land; every scene shares it. Is that the intended palette?

## The universal morph (2026-10-13)
- **Built:** `MorphCurves`/`MorphMany` (vocabulary/Morph/README.md) — N→M
  curves by arc length, 3D, fill as its own channel; `SolidDrawing` +
  `Truck` give view-dependent 3D outlines to land on. `?scene=morph-lines-
  circle`, `?scene=morph-dot-truck`.
- Built 2026-10-13/14: `Morph(a, b)` — one verb routed by what a and b are
  (word / point / gather / travel), returns an Anim with `back()`; rigid-
  then-deform travel on arcs, chaining, stagger; the neutral route (unlike
  shapes pass through a camera-facing circle); Forms (`?scene=forms`,
  `morph-solids`).
- Open: ~~arcing / staggered travel paths~~ (built); a "nearest-target"
  strategy for clustered many→many (letters, map regions — how: assign by
  minimum total travel over piece centroids before the tape match);
  ~~hidden-line for general meshes~~ (meshlines.ts) and rotated /
  interpenetrating solids; re-planning stability when the camera moves
  DURING a morph onto a view-dependent target; fill morphing (not only
  fading); the graft (`.morphInto([...])`) once a scene wants the method
  spelling.
- **Symbol ↔ word (built 2026-10-13, Horizons #4):** `MorphToWord`,
  `Word`, fonts baked as data (Arimo, ASCII + Latin-1). Open: kerning and
  other faces (bake more with scripts/font2ts.ts); mid-morph of a
  detailed symbol into many letters still reads as a scribble for a beat.
- **General mesh silhouettes (built 2026-10-13):** `mesh` solids
  (meshlines.ts). Open: intersection curves between interpenetrating
  solids; painter order between box faces (Lines) and mesh fills
  (depth-writing Surfaces) in one drawing; view-bucket caching under
  orthographic cameras; GPU path for very large meshes.
- **Lens (built 2026-10-13):** `vocabulary/Lens` (Lens + FlowLens), `Road`,
  `Stream` — `?scene=lens`. Open: a two-way road (trucks both ways — a
  second lane on Road, a reversed Stream); ~~curved road + landscape~~,
  ~~ground aligned to a tilted stack~~ (`?scene=lens-flowmap`), ~~mid-morph
  re-planning cost~~ (param-epoch memos, 314 → 4 ms) — all built.

## Value flow map (2026-10-13, whiteboard transmission)
- **Built:** `core/vocabulary/FlowMap` (`?scene=flowmap`) — group/members/
  partners as nested circles; `grain` (category discs shrink in from the rim
  into a vesica, N categories); flow layers with particles (`stage(id).shown`);
  `expand` tilts it into the value-chain stage stack (`stage(id).open` per gap,
  never reorders). **Certainty** is a core ability (`src/certainty.ts`):
  inherited product, drawn as `ghost(c)` opacity + particle `wobble`.
- Built 2026-10-13: the certainty blur as a render ability
  (`src/render/superposition.ts`, echo clouds drawn with a gaussian-edged
  ribbon twin, crystallising as c → 1) and
  a Morph opening (relations → the group circle).
- Open: David's eye on the superposition (echo count, spread, breath);
  entity labels (stage + category labels exist); ~~particle symbols beyond the dot (pallets, reels)~~ (Grain + Pallet/FilmReel/Pouch/SheetStack built 2026-10-13, `?scene=grain`; ~~Grain riding FlowMap's channels~~ and ~~a data-driven item rung~~ built (`?scene=flowmap-grain`) — open: the superposition cloud on ghosted symbol FILLS is heavy at symbol size);
  splitting a stage in two (production step); wiring Morph (connection lines
  → the group circle, dot → truck); a clickable creator-mode toggle per param.

- Built 2026-10-13/14: FlowMap over time (`?scene=flowmap-time`: a flow
  table importer, a scrubbable period, gaps as conjecture), value ↔ money
  (`?scene=flowmap-money`), presence, per-stage material-type certainty,
  realtime particles (one carrier each). Packaging symbols (Coin, Carton,
  Sack, LabelRoll, Drum) on the shelf.

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
  becomes 15, reload keeps it. ~~Open: a paused view does not repaint when an
  async text re-layout lands~~ — done 2026-10-04: `onTextLayout` in
  render/text.ts fires when glyphs land; the demo player redraws its held
  frame and the paused editor repaints (one per animation frame).
- **Changes are git-tracked**; Claude-artifact-style comment mode generalised to
  any element.
- **Dream Explorer** — a third mode that disassembles a scene into its
  DreamNodes; window ≡ folder ≡ DreamNode (epistemology = ontology). Reference:
  HyperTalk.
- **DreamSong as cut scene** — the real UI driven by a scripted timeline.

## Audio
- Narration as a timeline clip is built. Open: a better narrator voice than
  macOS `say`; **universal voice mode** (deferred by David).
- **Effect sound built (2026-10-04):** `src/sound.ts` + `src/render/sfx.ts` —
  synthesized ping / chime / whoosh as timeline events (`this.sound()`,
  holon `soundCues()`, opt-in `this.chimes()`); RayCaster pings wired. Open:
  David's ear on the three sounds (levels, timbre); whether `Move` should
  whoosh on its own above some speed.
- **Audio mixdown built (2026-10-04):** `render-song.ts` writes
  `<frames>/audio.wav` (narration from .cache/voice + effects, one recipe
  shared with the live player: `src/timbre.ts`) and `--out x.mp4` muxes it;
  `scripts/mixdown.ts <scene> <out.wav>` for audio alone. Deterministic bytes.

## Web3 video (Liminal Consulting)
- **Assembled (2026-10-04):** `?scene=web3`, all 17 shots, 171s, David's
  voice-over placed from the final mix (docs/campaigns/web3.md).
- Waiting on David: his photograph for shot 16; who reads the Vitalik quote
  (the final mix has VitalikQuote.mp3, not David's 07 take); whether the
  3Blue1Brown soundtrack comes across.
- Open: slide-wipe transitions; heavier-than-Manim text weight.
- **On the 3D Earth since 2026-10-13** (bf55244): shots 1, 2–3, 13, 15 use
  `vocabulary/Earth` via Recede; the hero/red-lobe node is `LightNode`, shot
  12's figure is `Vitruvian`. Waiting on David: his eye on the new globe
  look (before/after in the consolidation commit messages).

## Engine

- **Holons attached twice — FIXED 2026-10-04 (one parent per holon):** a
  holon that was both a FIELD of a whole and a MEMBER of a Group inside it
  was registered twice and drawn twice (Calculator 9, pl02 8529, p02k
  2256). Now `add()` moves a part (its previous whole lets it go), a field
  scan claims only an unowned holon, and a Group adopts its members at
  construction. pl02 host nodes 41662 → 24842, pixels identical
  (test/oneparent.test.ts). Re-measure perf item I's GPU cost on this base.
- Performance roadmap E/F; ontology builds (SDF square∩circle cylinder,
  GeometrySketch, RayCaster, node-graph visualisation).
- **One symbol, one implementation (2026-10-13/14):** TASTE.md rule,
  guarded by `test/one-implementation.test.ts` (no shelf class redeclared;
  no private derived-points copy; no cast past `add()` — `Holon.attach`;
  the eye-distance formula only in `src/geometry/frames.ts`). Open (how:
  docs/reports/consolidation.md): Earth/Labels/PointData/GeoFlow still
  cast past `add()` (switch to `attach`, then shrink the guard's list);
  FlowMap/SOPLoop could compose `Stream` instead of their own particle
  wiring; promote the Regenaissance lattice to a 3D `Noosphere` holon only
  when a second song needs it.
- DreamOS as one "dream graph" (Plan 9 / Houdini: a uniform data model through
  a procedural graph, nodes as code) — the tablet as one more client of it.
