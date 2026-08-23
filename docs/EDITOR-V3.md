# EDITOR-V3.md — The Keynote-grade DreamTalk editor

David's framing (2026-08-23): *"something like Keynote and Manim and C4D
having a baby"* — Keynote's simplicity, C4D's intuitive three-
dimensionality, Manim's programmatic elegance, plus the holonic structure
of the DreamNode system. Keynote is the **refined reference frame** for
layout and interaction concepts; the palette stays canonical
(TASTE: red/blue/white flat on black).

This is a design document. It exists because three of its decisions
accumulate dependents and are therefore expensive to reverse; everything
else is deliberately left as adjustable surface.

## What the editor becomes

Four regions, straight out of Keynote's proportions:

```
┌──────────┬───────────────────────────────────┬─────────────┐
│ SCENES   │              VIEWPORT             │  INSPECTOR  │
│ (slides) │                                   │  (selected  │
│  S01 ▸   │        [ the DreamSong ]          │   object    │
│  S02     │                                   │   only)     │
│  S03 ◂── │                                   │             │
│  …       │                                   │             │
├──────────┼───────────────────────────────────┴─────────────┤
│ HOLARCHY │  TIMELINE  (clips · transitions · playhead)     │
│ (cmd+⇧+L)│                                                 │
└──────────┴─────────────────────────────────────────────────┘
```

- **Scene navigator** (left, Keynote's slide rail): every registered
  DreamWeaving as a live thumbnail. Click to open, drag to reorder,
  the order defining the DreamSong's sequence.
- **Holarchy outline** (below the navigator, `cmd+shift+L` like
  Keynote's outline toggle): the part tree of the current scene.
  Selection is shared with the viewport in both directions.
- **Viewport**: unchanged in spirit — realtime playback, backdrop
  overlay — plus click-to-select with a C4D-style selection affordance.
- **Inspector** (right): *only the selected object's* properties.
  Nothing selected → scene-level properties (duration, camera, backdrop).
  This replaces today's dump-every-holon panel.
- **Timeline** (bottom): clips as now, plus inter-scene transitions.

## The three load-bearing decisions

Everything else in this document is surface. These three are not.

### 1. Selection is a first-class editor concept, not a viewport detail

`selection: Holon | null` lives in one editor-level store. The viewport,
the holarchy outline, the inspector, and the timeline all *read* it and
all *write* it. Consequences that make this load-bearing:

- The inspector renders from the selection, so the promotion protocol
  (PARAMETERS.md) finally has its natural home: what a selected holon
  exposes is exactly its promoted params.
- Every holon already carries a **source anchor** (`editor/anchors.ts`),
  so selection knows the file and byte range that created the object.
  Selecting a circle in the viewport can reveal — and later, edit — the
  exact `new Circle({...})` that made it. Selection is the bridge
  between the visual and the code, which is the whole thesis of the
  editor.
- Picking mechanism: the host already keeps `{holon, group}` bindings
  for every holon (`three-host.ts` GroupBinding). A raycast against
  those groups plus a map lookup yields the holon. No architectural
  change, but the *contract* — that the host can answer "what holon is
  under this pixel?" — becomes public API.

**Reversible?** The mechanism, yes. The decision that selection is
shared editor state rather than per-panel state, no — every panel would
have to be rewritten.

### 2. A DreamSong is a list of DreamWeavings, not a container of scenes

Multi-scene must not invent a new document format that owns scene
content. A **DreamSong is an ordered list of references** to
DreamWeaving files plus the transitions between them:

```ts
// dreamsong.json — the multi-scene document
{
  "scenes": [
    { "ref": "core/demo/video01/S01.ts", "transition": null },
    { "ref": "core/demo/video01/S02.ts",
      "transition": { "kind": "cut", "duration": 0 } },
    …
  ]
}
```

Why this is load-bearing: the alternative (a document that *contains*
scene definitions) would break the file-is-truth rule that EDITOR.md's
whole bidirectional architecture rests on, and would make a scene
un-openable on its own. With references, every scene stays a sovereign
DreamWeaving that runs standalone (`import.meta.main`), the manifest
system (`parts`) still describes composition, and the DreamSong is
exactly what the ontology already says it is: a woven composition of
sovereign pieces.

**Reversible?** No. Ten scenes and the gauntlet already depend on scenes
being standalone files.

### 3. Transitions are timeline composition, not a new evaluation mode

The framework's deepest invariant is that everything is a pure function
of `t` (SYNTAX-TS philosophy #7). Transitions must not break it.

A DreamSong therefore builds **one composite timeline** by placing each
scene's timeline at an offset, with transitions as overlap regions:

- `cut` — scene B starts exactly when A ends (offset = ΣA).
- `crossfade(d)` — B starts `d` before A ends; both scenes evaluate in
  the overlap, with an opacity ramp applied at the scene root.
- `hold(d)` — d seconds of A's final frame before B begins.

Sampling a DreamSong at global `t` = find which scene(s) are live,
sample each at its local `t`, composite. Scrubbing, export, and the
gauntlet all keep working because nothing is accumulated. Camera
transitions (a C4D-flavored move *between* scene cameras) become
possible later precisely because both scenes are live during an overlap.

**Reversible?** The transition *vocabulary* is fully adjustable — add
push/wipe/zoom freely. The decision that transitions compose timelines
rather than introducing sequencer state is not: it is what keeps the
editor, the renderer, and the scorer all agreeing on what a frame is.

## Deliberately adjustable (change these freely later)

Panel widths and arrangement · which properties the inspector shows and
how they group · selection highlight styling · the transition vocabulary
· thumbnail rendering strategy · keyboard shortcuts beyond
`cmd+shift+L` · whether the holarchy is a tree or a breadcrumb ·
scene-navigator drag behaviour · timeline zoom.

## Build order

1. **Selection** — host picking API, editor selection store, holarchy
   outline (`cmd+shift+L`), inspector filtered to selection. Ends when
   clicking a circle in S01 shows that circle's properties and nothing
   else, and the outline highlights in sync.
2. **Scene navigator** — thumbnails of all registered scenes, click to
   open. Ends when all ten video-01 scenes are switchable without a URL.
3. **DreamSong document** — `dreamsong.json`, composite timeline, `cut`
   only. Ends when the ten scenes play end-to-end as one 157s piece.
4. **Transitions** — crossfade and hold; timeline UI for setting them.
5. **Polish toward Keynote** — proportions, motion, empty states.

Selection (1) is the prerequisite for everything; 2 and 3 are
independent of each other.

## Open question for David (not blocking 1–2)

Does the DreamSong's scene order *replace* the reproduction's scene
timing, or is video-01 a special case where each scene already knows its
absolute position in the original? Recommendation: DreamSong order is
authoritative for new work, and the video-01 DreamSong simply lists the
ten scenes with `cut` transitions — which reproduces the original's
gapless concatenation exactly.
