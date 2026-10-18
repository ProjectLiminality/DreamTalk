# DreamOS fusion — the InterBrain app and its song as one hyperobject (recon, 2026-10-18)

Reconnaissance for VISION-HYPEROBJECT.md: *"the song lives in the same repo
as the app … deduplicate the app's visual components with the DreamTalk
symbols … the roadmap is part of the hyperobject."* Read-only on both sides.
The InterBrain repo was read at `main` `f2f576b` (v0.17.0-rc.1 release prep).
Nothing in it was built, run or changed.

Paths: `IB/` = `/Users/davidrug/RealDealVault/ProjectLiminality/InterBrain/`,
`DT/` = this repo's `core/`. **(inferred)** marks a reading of mine, not a
fact in either codebase.

**Headline.**

1. The app already **is** an explicit visual state machine.
   `IB/src/core/orchestration/ARCHITECTURE.md` has 7 layout states, a
   transition table and "escape always rolls back". DreamTalk adopted that
   intent funnel in 2026-08 (DECISIONS 2026-08-29). The two machines can be
   named in one vocabulary.
2. Its 3D layer is small and close to WebGPU-ready: R3F + three 0.178,
   **two GLSL shaders and one drei `Line`**. Everything else is drei `Html`
   DOM overlays, which don't depend on the renderer.
3. The only symbol both sides already share by source is the
   **InterBrain face**. `DT/vocabulary/InterBrain` was redrawn from the same
   2025-04-06 `InterBrain.png` that is the app's own DreamTalk (`IB/.udd`).
   That makes it the natural first dedupe and the vision's entry point.

---

## 1. How InterBrain renders today

| Layer | What | Where |
|---|---|---|
| Host | Obsidian plugin (an `ItemView`) plus a Tauri tray daemon (first-run setup, GitHub identity, `git-remote-interbrain`), joined by a WebSocket bridge | `IB/src/main.ts`, `IB/desktop/src-tauri/`, `IB/src/features/desktop-bridge/` |
| Build | Vite lib build → one CJS `main.js`, no code splitting (`inlineDynamicImports`) | `IB/vite.config.ts` |
| 3D | React 19 + **R3F 9 / drei 10 / three 0.178**, `WebGLRenderer` (`gl={{antialias:true}}`), fov 75, black space | `IB/src/core/components/DreamspaceCanvas.tsx:708` |
| World | `dreamWorldRef` group, turned by a virtual trackball (quaternion + momentum); stars + DreamNodes + DreamSong threads inside it | `SphereRotationControls.tsx`, `DreamspaceCanvas.tsx:858–1013` |
| DreamNode | `DreamNode3D`: `group → Billboard → flip group (rotY 0…π) → [DreamTalkSprite (WebGL) or DreamTalkSide (Html, selected node only), DreamSongSide (Html, back)]` + an invisible hit sphere (r 12) | `IB/src/features/dreamnode/components/DreamNode3D.tsx:1150–1290` |
| Front face | Sprite with `circularClipShader` (media clipped to a circle, border, fade to black) and a hover overlay (dark + title); golden glow on hover | `DreamTalkSprite.tsx`, `shaders/circularClipShader.ts`, `styles/dreamNodeStyles.ts` |
| Back face | DOM carousel: index 0 = HolonView (submodules circle-packed inside the node), 1+ = each `.canvas` DreamSong, README, Perspectives / Conversations | `DreamSongSide.tsx`, `HolonView.tsx`, `IB/src/features/dreamweaving/components/DreamSong.tsx` |
| Flip | Y rotation 0 → π, animated with movement; Dreamers can't flip | `DreamNode3D.tsx:379–452, 1063–1112` |
| Layouts | Constellation: a Fibonacci sphere + force-directed clusters, Apple-Watch distance scaling. Liminal web / holarchy / search: hexagonal rings of 6 + 12 + 18 | `IB/src/features/constellation-layout/`, `IB/src/features/liminal-web-layout/RingLayout.ts` |
| Edges | DreamSong threads as great-circle arcs (drei `Line`) | `constellation-layout/components/Edge3D.tsx`, `DreamSongThread3D.tsx` |
| State | Zustand with one slice per feature. `spatialLayout ∈ constellation · creation · search · liminal-web · edit · relationship-edit · copilot` (+ holarchy = liminal-web with the centre flipped) | `IB/src/core/store/interbrain-store.ts:133` |
| Orchestration | `Event → deriveIntent() → executeLayoutIntent() → node.setTargetState({active, position, flipSide} \| home)`. Never `useEffect`. Layout snapshot in IndexedDB | `IB/src/core/components/SpatialOrchestrator.tsx` (2,055 lines), `IB/src/core/orchestration/` |
| Tutorial | Portal overlay (SVG Logo, "Enter DreamSpace", music) is **live**. The step runner (ManimText, GoldenDot, 16 MVP steps) is **disabled** in this version | `IB/src/features/tutorial/`, `DreamspaceCanvas.tsx:983` |
| Pages viewer | The standalone DreamSong player: a React bundle, data inline as JSON | `IB/src/features/github-publishing/dreamsong-standalone/main.tsx` |

**Visual vocabulary in the app** (the parts that are symbols, not chrome):

- the DreamNode disc, blue for a dream and red for a dreamer;
- the flip;
- the circle-packed holarchy;
- the ring layouts;
- the star sphere;
- the DreamSong threads;
- the golden glow and the GoldenDot;
- the portal Logo;
- ManimText.

Everything else is DOM: the canvas DreamSong, the panels, the search input
and the radial buttons' icons.

**WebGPU migration surface (measured):**

- 2 GLSL materials: `IB/src/features/dreamnode/shaders/circularClipShader.ts`
  and `radialGradient.ts`;
- 1 drei `Line` (Line2, GLSL): `Edge3D.tsx`;
- the legacy `DreamTalkMesh.tsx` (drei `Text`/troika), which is off by flag;
- 11 files use drei `Html`, which is DOM and works with any renderer.

---

## 2. Dedupe map — app component ↔ DreamTalk holon

**Status** says how the two sides relate:

- **identical**: same symbol and same source;
- **divergent**: same concept, two drawings;
- **app-only**: no holon;
- **song-only**: a holon with no app visual.

| App component (path under `IB/src/`) | DreamTalk holon (`DT/`) | Status | The difference |
|---|---|---|---|
| InterBrain node's DreamTalk, `IB/InterBrain.png` (`.udd` `dreamTalk`) | `vocabulary/InterBrain` (Logo in a faceted crystal, dark bloom) | **identical source, divergent rendering** | Same 2025-04-06 png: raster in the app, a construction in DreamTalk. First dedupe candidate |
| DreamNode disc: `DreamTalkSprite.tsx` + `circularClipShader.ts` + `dreamNodeStyles.ts` | `vocabulary/DreamNode` (ring + face slot, `kind` dream/dreamer, `FACE_FILL` 0.84) | divergent | (1) Palette: app `#479FF8`/`#FF6B6B`, DreamTalk `BLUE #00A2FF`/`RED #FF644E` (TASTE: palette is law). (2) The app's face is **user raster media** (image/gif/video/pdf) with a fade to black. DreamTalk has **no raster-media face** (only a scene backdrop, `src/dream.ts:343`), so it needs a media-face ability |
| Dreamer node (user's photo, red) | `DreamNode` kind `dreamer` (portrait via `Sketch`) | divergent | Photo vs line portrait; same red-ring rule |
| Flip front ↔ back (`DreamNode3D.tsx`) | `DreamSongSymbol.compress` (song ↔ symbol); Magic Move (`src/transitions.ts`) | divergent | The vision: "front and back share one state-machine graph". Today the app's flip is a rotation over two DOM faces |
| Back side, `.canvas` DreamSong (`DreamSong.tsx`) | `src/song.ts` `DreamSong` (chapters on one pure timeline); `DreamSongSymbol` (its face) | divergent | A scroll document vs a timeline. DECISIONS 2026-08-29: "InterBrain has NO timeline machinery; DreamTalk fills that exact hole" |
| HolonView (submodules circle-packed in the node, `HolonView.tsx`, `utils/circle-packing.ts`) | `DreamNode` `children` (holarchy: `CHILD_SHARE` 0.27 on an orbit of 0.55) | divergent | Packing vs orbit (the film's f10760) |
| Holarchy layout (supermodules in the ring) | `DreamNode` import lines (outer tangents, f10760) | divergent | The app has rings and no lines; the song has lines and no rings |
| Liminal web rings (`RingLayout.ts`, 6+12+18) | `vocabulary/LiminalWeb` (centre + satellites, `focus` axis) | divergent | Same concept; the film's geometry is one ring, the app's is three hex rings |
| Constellation (Fibonacci star sphere, `constellation-layout/`) | `DreamGarden` (flat red ring, unstructured) · `Noosphere` state `interbrain` (geodesic sphere studded with InterBrains) | divergent | **(inferred)** The app's garden is a sphere and the film's garden is a disc; the film's *sphere* is the collective InterBrain. Which one the constellation should be is David's call |
| Stars (`Star3D.tsx`, `StarMesh.tsx`) | none | app-only | — |
| DreamSong threads (`Edge3D.tsx`, `DreamSongThread3D.tsx`) | none (`Divide` is the DreamWeaving S-arc; ribbons could draw arcs) | app-only | The one drei `Line`: DreamTalk's ribbon pipeline is the natural replacement |
| Proto-node on creation (`dreamnode-creator/DreamNodeCreator3D.tsx`, translucent) | `DreamNode` Create (ring draws on from one o'clock) | divergent | — |
| Portal Logo (`tutorial/components/ProjectLiminalityLogo.tsx`) | `vocabulary/Logo` | divergent | Red r 32/49 = 0.653 vs Logo's 0.61; colours `#0099ff`/`#f06850` vs BLUE/RED |
| ManimText (`tutorial/ManimText.tsx`, stroke draw → fill → stroke fade) | `src/parts/text` + `Create`/Write | divergent | Same Manim idea, SVG vs TSL ribbons |
| GoldenDot + golden hover glow (`tutorial/GoldenDot.tsx`, glow `#FFD700`) | `src/glow.ts` (attention, `HOVER`), `GOLD` (255,199,84) | divergent | — |
| Hover scale ∝ \|z\| (`dreamNodeStyles.ts:106`) | adopted by DreamTalk (DECISIONS 2026-08-29) | identical (idea, not code) | — |
| Copilot mode = "digital campfire" (`conversational-copilot/CopilotModeOverlay`) | `DigitalCampfire`, `SandTalk` | divergent | A UI mode in the app; a two-InterBrain glyph in the song |
| Perspectives / Conversations list (`songline/components/`) | `SongLine` (a column of campfire clips above the node) | divergent | The app lists clips on the back; the song draws the chain |
| Coherence beacon (`coherence-beacon/`: git commits + an accept modal) | `CoherenceBeacon` | song-only visual | The mechanism is in the app; the picture is only in the song |
| — | `Resonance`, `Vault`, `Field`, `Tribe`, `Noosphere`, `Worldview`… | song-only | The explanatory cast (ch1–5) |
| Radial action ring (`action-buttons/RadialButtonRing3D.tsx`) | (`Icons`, non-sovereign props) | app-only | — |
| Search node (`search/SearchNode3D.tsx`) | none | app-only | — |
| Dream Explorer (`dream-explorer/`, a file navigator in circles) | none | app-only | — |
| DreamSong Pages player (`dreamsong-standalone/`) | the DreamTalk player bundle (`DT/scripts/build-demo.ts`) | divergent (same pattern) | DECISIONS 2026-08-29 already chose this pattern for embedding |

---

## 3. Architecture: "the DreamSong lives in the app's repo and the symbols are the UI"

### Options

| # | Path | For | Against |
|---|---|---|---|
| 1 | **Standalone player.** The DreamTalk bundle plays the WatchMe in the app's fullscreen DreamSong view and on Pages (DECISIONS 2026-08-29) | Almost no coupling; WatchMe on Pages at once; no renderer change | Two worlds: the symbols are *beside* the UI, not the UI. No dedupe of the node face. Interaction ends at the iframe or bundle edge |
| 2 | **Package + texture.** `dreamtalk` (`DT/package.json` exports) as a dependency; each symbol renders in its own `ThreeHost` to a canvas and becomes the sprite's texture | Incremental; the app stays WebGL | N renderers and GPU devices; a texture copy per frame; DreamTalk's picking, glow and state axes are lost behind the texture. Horizontal reuse, which TASTE rejects ("vertical/submodule") |
| 3 | **Submodule + one scene.** DreamTalk is a git submodule of the InterBrain DreamNode (`IB/submodules/DreamTalk`, the CLAUDE.md pattern). The app's R3F canvas moves to `WebGPURenderer`. A thin **guest-mode** host adapter attaches holons into the app's scene and syncs them each frame | One renderer, one world: symbols *are* the UI. DreamTalk's ribbons, glow, picking and `stateSpace()` reach the app. Holarchy-native. TASTE already names "Obsidian/R3F" among its thin adapters (Q3) | Three 0.178 → 0.185. Port 2 shaders + `Line` to TSL. **WebGPU in Obsidian's Electron is UNVERIFIED** (DECISIONS 2026-08-29); `WebGPURenderer` has a WebGL2 backend **(inferred fallback; compute-heavy holons may not run on it)**. `ThreeHost` today owns its own renderer, scene and camera (`three-host.ts:1014–1023`), so a guest constructor is needed. Two camera models (DreamTalk Observer / ViewLayer vs R3F) need a bridge. Bundle size: `vocabulary/` is 9.6 MB of source (Earth data), so import only the holons used |
| 4 | **Inversion.** The app's 3D layer *becomes* a DreamTalk Dream (orchestrator → `stateSpace()`, DreamNode3D → `DreamNode`). R3F is dropped for 3D; React DOM stays for panels | The purest form of "the app is the hyperobject" | Rewrites ~3,300 lines (`SpatialOrchestrator` + `DreamNode3D`) at once; risk to a shipping rc |
| 5 | **Shared holon library.** DreamNode, InterBrain, Logo… popped out into their own DreamNode repos, which both sides import as submodules | Each symbol has one home (TASTE "one symbol, one implementation" across repos) | Blocked on the repo-template gate (`DT/vocabulary/README.md`: "When the repo-template gate opens (GATES #3c), pop-out is mechanical"). An end state, not a first step |

### Recommendation: path 3, grown toward 4, with 5 as the later pop-out

**Why path 3.** It is the only path where the app's symbols *become*
DreamTalk symbols without a rewrite. The app's components can be swapped
one at a time: the InterBrain face, then the DreamNode disc, then the Logo,
then the threads. Each swap is a dedupe row in §2. When the last one is
swapped, path 4 has happened by attrition.

**Holarchy.** DreamTalk becomes a submodule of the InterBrain DreamNode,
exactly as CLAUDE.md prescribes (`submodules/DreamTalk`, initialised only
at the root).

**The WatchMe.** It lives at the InterBrain repo root as the node's own
DreamSong (e.g. `IB/WatchMe.ts`), importing `submodules/DreamTalk/core/…`.
**(inferred)** `DT/demo/interbrain/` (the 8 chapters, `InterBrainSong.ts`)
is the InterBrain node's own song. ONTOLOGY's pop-out would move it there,
and the explanatory holons would stay DreamTalk vocabulary.

**Question for David.** Does `vocabulary/InterBrain` (the node's face)
belong in the InterBrain repo, with DreamTalk importing it back? Circular
imports are legal through lazy resolution (TASTE).

### The smallest first step that proves it

0. **Probe** (one line, in Obsidian's dev console):
   `await navigator.gpu?.requestAdapter()`. This answers the one
   unverified assumption before any code is written.
1. **Spike** (a feature branch of InterBrain, David's go-ahead):
   - add the submodule;
   - set the Canvas to `gl={async p => { const r = new WebGPURenderer(p); await r.init(); return r }}` with three aligned;
   - port `circularClipShader` and `radialGradient` to TSL node materials (Edge3D off, or drawn with a ribbon, for the spike);
   - in DreamTalk core, add a guest mode to `ThreeHost` (attach into a given scene; sync(t) driven by the app's `useFrame`; DreamTalk still owns t).

   **Then render ONE holon**: the InterBrain node, uuid
   `550e8400-e29b-41d4-a716-446655440000`, as `DreamNode({ face: new InterBrain() })`
   in place of its `InterBrain.png` sprite.

   **Pass** when, inside Obsidian:
   - the constellation renders as before;
   - the InterBrain node shows the DreamTalk symbol;
   - a click still enters liminal-web (the app's hit sphere is unchanged).

   That proves bundling, WebGPU (or its fallback), one scene and the first
   dedupe together, and it is the vision's opening frame: "Opening
   InterBrain: its DreamTalk symbol".

---

## 4. Gap table — the seed of "the roadmap as a subspace"

### The song's instrument (ch5–8), against the app

Times are the transcript's (`refs/interbrain/transcript/narration.tsv`).

| Concept, as the song says it | App today | Where |
|---|---|---|
| Second brain → InterBrain: "participate as equals" (27:07) | **partial**: an Obsidian plugin; peers are pairwise GitHub outboxes, with no shared collective space | `IB/src/features/social-resonance-filter/` |
| Knowledge not "managed" in categories (27:24) | **implemented**: a flat vault of DreamNodes | `dreamnode/utils/vault-scanner.ts` |
| A new fundamental unit, "natively integrated with the spoken word" (28:17) | **partial**: the unit exists; spoken-word integration is via transcription and perspectives | `realtime-transcription/`, `songline/` |
| DreamTalk = digital SandTalk (29:08) | **partial**: DreamTalk = any media file. Symbols authored as code (this framework) are not yet in the app | `dreamnode/components/DreamTalkSprite.tsx` |
| DreamNode = git repo (29:14–30:11) | **implemented** | `dreamnode/`, `.udd` |
| "Anything that can be expressed digitally" (29:52) | **implemented**: images, video, PDF, links, HTML | `MediaRenderer.tsx`, `PDFPreview.tsx`, `web-link-analyzer/` |
| Tracks an idea's whole evolution (30:18); the film draws the commit chain (f9166) | **implemented** in git; **not yet** as a visual | — |
| "Or for that matter, the InterBrain itself" (30:39) | **implemented**: the repo root is a DreamNode (`IB/.udd`) | `IB/.udd` |
| Dreams and dreamers (30:44) | **implemented** | `dreamnode/types/dreamnode.ts` |
| DreamGarden, "without any imposed structure" (31:10) | **implemented** as the constellation | `constellation-layout/` |
| Cross-pollination: "for every DreamTalk symbol we invoke, the node is cloned into each other's garden" (31:43) | **partial**: copilot records invocations; at the end of a call it emails invite links, and the peer clones via `interbrain://`. Not live | `conversational-copilot/` (end-flow steps 4–5), `uri-handler/` |
| The liminal web self-organises "by tracking this process" (31:58–32:21) | **partial**: the layout is implemented; relationships come from drag-drop, the relationship editor, and copilot's end-of-call "persist bidirectional relationships" | `liminal-web-layout/`, `conversational-copilot/` (step 7) |
| Digital campfire = video calls around the globe (32:51) | **partial**: FaceTime via AppleScript (macOS); native WebRTC not yet (a signaling worker exists) | `video-calling/`, `IB/signaling/` |
| Scale past Dunbar (33:06) | **not yet** shown as a property **(inferred)** | — |
| SongLine: the journey through the InterBrain, clipped at each step (33:21) | **partial**: clipped audio perspectives are stored per node per conversation. The *chain across peers* exists only as far as git carries them **(inferred)** | `songline/services/perspective-service.ts` |
| SongLines as a dataset for people and AI (33:43) | **not yet** | — |
| Import into a higher-order node (35:43); imported nodes stay sovereign (36:01) | **implemented**: submodules, holarchy | `dreamweaving/services/submodule-manager-service.ts` |
| DreamWeaving into a DreamSong (36:14) | **implemented** as Obsidian canvas | `dreamweaving/` |
| Compress a DreamSong back into one DreamTalk (36:28) | **partial**: manual (pick a DreamTalk media) | — |
| Emergent holarchy (36:42) | **implemented**: holarchy layout | `SpatialOrchestrator.tsx` |
| Broadcast coupled to dreamweaving (36:49) | **partial**: "sharing is publishing" (GitHub Pages) broadcasts *any* shared node, not only woven ones **(inferred divergence)** | `github-publishing/` |
| Heard first by adjacent tribes; those who resonate join and extend the reach (37:01–37:29) | **implemented**: the beacon offers the supermodule to peers holding its submodules, and accepting propagates | `coherence-beacon/` |
| A social resonance filter (37:38) | **implemented**: human cherry-pick | `social-resonance-filter/`, `dreamnode-updater/` |
| Incoherent songs fade (37:51) | **implemented implicitly**: no acceptance, no spread | — |
| Collective knowledge garden, the InterBrain sphere (39:27) | **not yet**: no network-level view | — |
| Applications: podcasting, journalism, education… (41:40) | **not yet**: none are features | — |
| No censorship needed (38:24), transmutation (39:49), the hyper-agent of love (42:26) | outcomes, not features | — |

### What the app does that the song never mentions

The rows below are app features with no beat in the song. Each is a
candidate for a nested explanatory DreamSong.

| Feature | Where (`IB/src/features/`) |
|---|---|
| Semantic search (Ollama embeddings) + the search node | `semantic-search/`, `search/` |
| Conversational copilot: AI summaries, PDF + email export | `conversational-copilot/` |
| AI provider hub (Claude, Ollama, OpenAI, Groq, xAI) | `ai-magic/` |
| Web-link analysis | `web-link-analyzer/` |
| Drag-and-drop creation, metadata editor, relationship editor | `drag-and-drop/`, `dreamnode-creator/`, `dreamnode-editor/` |
| Radial action ring (Option key) | `action-buttons/` |
| Dream Explorer (file navigator) | `dream-explorer/` |
| Updater: update preview / cherry-pick | `dreamnode-updater/` |
| Feedback / bug reporter (dedupe, `gh` issues) | `feedback/` |
| Desktop daemon: first-run setup, tray, GitHub identity, `interbrain://` resolution | `IB/desktop/`, `uri-handler/` |
| Layout snapshot restore | `IB/src/core/orchestration/snapshot-storage.ts` |
| Constellation filtering for thousands of nodes | `constellation-layout/services/` |
| AI pair-programmers inside DreamNodes (README) | — |
| The tutorial portal | `tutorial/` |

---

## 5. A first sketch of the InterBrain hyperobject's `stateSpace()`

### The app's states are already DreamTalk-shaped

| App (ARCHITECTURE.md) | DreamTalk (`DT/src/automaton.ts`) |
|---|---|
| layout state | a `choices` axis |
| transition table conditions ("center is Dream", "Dreamers cannot flip") | `when` (the adjacent possible) |
| "escape always rolls back" | a guarded back-edge on the layout axis |
| flip | a per-node `toggle` |
| a centred node | a **data-generated axis**. Precedent: `LiminalWeb`'s `focus` axis, whose positions are its nodes (`DT/vocabulary/LiminalWeb/LiminalWeb.ts:187`) |

### Sketch

Translation, not built. The axis ids follow the automaton.md conventions.

```ts
// IB/WatchMe.ts — the InterBrain DreamNode's own Dream (sketch)
override stateSpace(): StateSpace {
  return { axes: [
    // R0 the symbol: the entry point that unfolds into the UI (the portal today)
    toggle("unfold", this.unfold, { off: ["symbol", 0], on: ["dreamspace", 1] }),

    // R1 everyday UX: the orchestrator's machine, named
    choices("layout", this.layout /* constellation · liminal-web · holarchy · search ·
                                      edit · relationship-edit · copilot · creation */,
            { when: () => this.unfold.value === 1 }),
    axis("focus", this, positionsFrom(this.garden.nodes), { when: inLayouts("liminal-web", "holarchy") }),
    // per node (each DreamNode holon declares its own):
    //   toggle("side", node.side, { off: ["dreamtalk",0], on: ["dreamsong",1], when: isDream })
    toggle("actions", this.ring, { off: ["hidden",0], on: ["shown",1] }),   // Option held

    // R2 first-use tutorial: a song LINE through R1, not a separate machine.
    //    Its 16 MVP steps already set the layout on entry (onEnter: set-layout).
    axis("tutorial", this, { anchor, dreamers, dreamtalk, navigate, dreamsong, invitation }),

    // R3 explanatory songs: R1's nodes unfold into their DreamSongs.
    //    The InterBrain node's back side IS InterBrainSong (ch1…ch8).
    axis("explain", this, { none, ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8 }),

    // R5 the roadmap subspace: §4's rows as axes, each `described ↔ implemented`
  ], clocks: [this.time] }
}
// R4 the release song line = one authored path (this.play(...)) through R0 → R1 → R3
```

### The regions

The regions VISION-HYPEROBJECT names, located:

| Region | What it contains | How you enter it | What exists today |
|---|---|---|---|
| R0 symbol | The InterBrain face, closed. "Once you have friends, they and the ideas … show up *in* that symbol" | App launch | `TutorialPortalOverlay` (the Logo, "Enter DreamSpace"); `DT/vocabulary/InterBrain` |
| R1 everyday UX | 7 layouts × focus × per-node side × overlays | Unfolding the symbol | `ARCHITECTURE.md` transition table, `SpatialOrchestrator.tsx` |
| R2 first-use tutorial | 6 segments, 16 steps, text + GoldenDot | First run (the daemon's setup comes before it, outside 3D) | `tutorial/steps/mvp-steps.ts` (disabled), `TUTORIAL_VISION_FULL.md` |
| R3 explanatory songs | InterBrainSong; per-holon demos (`ib-*`) as nested READMEs | Flip a node to its back, or pause and unpack a symbol | `DT/demo/interbrain/`, `DT/vocabulary/*/README.md` |
| R4 release song line | The YouTube render: a recording of R0 → R1 + R3 | — | **not yet** |
| R5 roadmap | §4's gap table, each row an axis | — | this report |

### Where the sketch strains the current automaton

These are honest gaps, not plans.

- **Unbounded positions.** The selection and the search query are not
  axes yet (editor-automaton.md: "Selection and the panels with unbounded
  positions … are not axes yet"). `focus` needs positions generated from
  data, as LiminalWeb does.
- **Regions are containment, not a flat list.**
  - `gatherStateSpace` (`automaton.ts:244`) flattens holon trees.
  - The only nesting today is editor ⊃ scene, where the containing machine
    gates the contained one (editor-automaton.md).
  - R0 ⊃ R1 ⊃ per-node is that same pattern again, through `when`.
- **Side effects.** Saving an edit, accepting a beacon and a git push are
  commands, not display state. They stay in the app's intent funnel. An
  axis may *show* them but never performs them.
- **Two players of one t.** DreamTalk owns t ("hosts request time"). The
  app's real-time constellation drag and momentum are live-layer input,
  like `view.ts`'s ViewLayer.

---

## Questions for David

1. **The garden's shape.** Is the app's constellation the `DreamGarden`
   (the film's flat disc) or the `Noosphere` in its `interbrain` state (the
   film's sphere)? (§2)
2. **The palette.** Does the app take the DreamTalk palette (`#00A2FF` /
   `#FF644E`, the Logo at 0.61), or the reverse? (TASTE: the palette is law
   for DreamTalk.)
3. **Where the InterBrain song and face live.** Do `vocabulary/InterBrain`
   and `demo/interbrain/` move into the InterBrain repo as the node's own
   face and WatchMe? (§3)
4. **The go-ahead for step 0 / 1.** It needs the probe in Obsidian and a
   feature branch in the app repo; this agent touched neither.
