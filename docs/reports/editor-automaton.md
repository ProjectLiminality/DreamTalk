# The editor as a visual automaton (2026-10-13)

David: *"Any UI is a visual state machine. The DreamTalk editor with the
timeline is really just another instance of a visual state machine that has
the scene as a subcomponent … I want to interact with objects state-machine
style so smoothly in the editor that it transcends but includes the current
solution."*

## The model

- **The scene's state space** is every axis its holons declare
  (`Holon.stateSpace()`, src/automaton.ts) **plus `t`**. `t` is not special
  in kind, only in authorship: it is the one axis the DreamWeaving *writes*
  — the song is a path through the other axes parameterised by `t`
  (`this.play(axis.to("categorised"), 2.5)` is a step along `grain` at a t).
- **The editor's automaton contains the scene's.** Its own axes are
  transport (`playing | paused`), lens (`game | creator` — the backquote),
  selection (`∅ | holon`), and its panels (outline, code, comments,
  explorer). They are orthogonal to the scene's axes, and each one *gates*
  what the scene's axes do: a scene axis is walkable only while
  `transport = paused` and `lens = game`.
- **Three ways to move through the scene's space, one layer each:**

  | mode | moves along | written to | lifetime |
  |---|---|---|---|
  | authored (play / scrub) | `t` | the DreamWeaving (file) | permanent |
  | free walk (paused, game lens) | the declared axes | the live layer (Overrides) | until time moves, Esc, or capture |
  | editing (creator lens, inspector) | any exposed param | the live layer → ops | until committed or released |

  The walk and editing share ONE live layer (EDITOR-V4's Overrides), so a
  walked pose is a pose like any other: the inspector reads it, Esc discards
  it, play snaps it back (time is truth), ⌘K captures it.

## "Transcends but includes", concretely

The timeline is not replaced by the state machine; it **is** the state
machine's recorded path. Walking adds what the timeline could not: any
order, reversal mid-flight (C¹ retarget), the adjacent possible (`when`).
Capturing closes the loop: a walk at the playhead becomes an authored step
(`appendCheckpoint` — `this.play(together(this.map.grain.to(1), …), 1.8)`
after the clip the playhead stands in, with the walked axis's own duration).
So: **walk it, keep it.** The editor includes the old way (scrub + inspector
+ capture) unchanged, and the new way writes through the same op.

## What is built (step 1)

- `editor/walk.ts` — `EditorWalk` embeds the player's `GameLoop`
  (demo/game.ts) in the paused editor: hover ticks + caption, clicks and keys
  fire axes, the inspector's **State** group lists every axis (or the
  selected holon's) with its position lit and every position clickable.
  The automaton's display is routed into Overrides instead of the params;
  clocks stay still (a paused editor is a held world).
- **The click rule:** creator lens → a click selects (as ever). Game lens,
  paused → a click on an element that *owns* an axis fires it and leaves
  the selection alone; a click anywhere else selects as before; a drag from
  anywhere flies the camera. The ticks say which before you press; over a
  handle the sovereign glow yields to them.
- **Grounding:** the automaton re-enters from what is on screen whenever
  the world moved under it — the playhead moved, or the live layer lost a
  value the walk wrote (Esc, capture, undo). At rest that loses nothing;
  mid-flight it is the honest stop. Walked back to its entry, a value's
  override evaporates.
- **Recording:** capture uses the walked axis's duration; `appendCheckpoint`
  now places into songs that play through a helper (`this.flowing(…)`) by
  the clip's play-order ordinal, refusing when a loop/branch makes the
  count indeterminate.
- The HUD is off by default in the editor (the State group is its editor
  form); `h` or `?hud=1` shows it in the viewport.

## Unpack a symbol, and come back (nesting)

- While a song plays (player: Space for free play; editor: paused), press
  **Enter** over a symbol, or choose "unpack <X>" in its action menu or
  long press. The view glides into the symbol and past it, while its own
  song (its WatchMe) grows out of the box it occupied. Inside, Space walks
  it, Enter goes a level deeper, and **Esc** comes back. Esc is consumed
  only while a level is open; pressed while a level is still opening, it
  comes back as soon as the level has opened.
- WatchMe: the registered scene `<Class>WatchMeDream` / `<Class>Dream` /
  `<Class>DemoDream`. A symbol with no song of its own opens **beside its
  StateLattice**, framed together: every node is a button, and clicking one
  walks the symbol into that state (a stateless symbol opens alone).
- **Shift+Enter** (or "<X>'s state space" in the action menu) opens a
  symbol's state space on demand. For a symbol with a WatchMe, that is the
  lattice of the WatchMe's machine, with the song line lit gold as a path
  through it and its current state following the song. Shift+Enter inside a
  level with nothing hovered opens the lattice of that level's own song,
  starting at the moment you were at. Esc comes back as usual.
- Frame-exact return by construction: the song beneath is held (its
  free-play clocks too), never re-timed, and its view delta is restored as
  a value. Verified byte-identical on the whole InterBrain song.
- Enter is in RESERVED_KEYS (`u` is an axis key: Worldview's pullers, the
  InterBrain unfold). Hands bind to `window.__dtNest.unpackHovered()` /
  `statesHovered()` / `back()`. While a level is open, `__dtNest.top()`
  gives its game loop, canvas and host (undefined at depth 0), so hands aim
  at the level you see. `dreamtalk:nest` fires on window when it changes.
- While a level is open, the HUD of the level beneath steps aside
  (`GameLoop.covered`).
- Try it: `/demo/?scene=interbrain&t=2295` → Space → hover the beacon →
  Enter → explore → Esc. Shift+Enter over the beacon shows its 128-state
  lattice with the song line. Songless: `/demo/?scene=ib-ch1&t=60` → Space →
  Enter over the Dialectic → click a cube corner. The editor is the same:
  `/?scene=ib-ch7&t=225`.
- Code: editor/nest.ts (the stack, pure in NestStack), wired into
  demo/main.ts and editor/main.ts; test/nest.test.ts.

## ⌘K in the song's idiom, clocks running

- A walked transition is written as an axis to a named position:
  `this.map.stateAxis("expand").to("staged")`. That is `Holon.stateAxis(id)`,
  the scene-addressable form of `axis.to(position)`. The name avoids the
  `axis` fields holons already have. The walked axes' params are not
  repeated as raw `.to()`s. Anything else posed (inspector tweaks, moves)
  still writes as raw param targets in the same `together`.
- Clocks the song animates (FlowMap's `time`) ride along in every
  recorded clip, as `this.map.time.by(d, { easing: "linear" })`, so the
  particles keep flowing through it instead of freezing.
- Checked against the real FlowMap song: the generated file typechecks,
  and sampled across the inserted clip, time runs on while expand and
  raw.open move.

## Authoring states from the editor ("save as state")

- With a pose standing (inspector, drag, walk), the inspector shows a row:
  "save pose as [axis] [state] ↵". One `saveState` op writes the pose as a
  position on one of the **scene's** own axes, in the DreamWeaving's
  `stateSpace()`. The method and its imports are created on the first save:
  `poses("look", { rest: [[this.map.grain, 0]], busy: [[this.map.grain, 1]] })`.
  The base pose (`rest`) is the timeline's values at the playhead.
- Home: the scene, not the holon. A vocabulary symbol's own states are its
  author's to declare. A designer's states are compositional, so they span
  holons, and only the scene can name several.
- Saving to an existing axis adds the position, or replaces it if the name
  is already used. A param new to the axis is added to the other positions
  at its base, so walking back undoes it. A position names only the params
  that were posed.
- `poses()` (src/automaton.ts) is the axis over explicit params of any
  holons. `Dream.stateSpace()` / `Dream.stateAxis(id)` are the scene's
  hooks. The editor's walk carries the scene's space as one more root (a
  stand-in holon, never drawn). ⌘K of a walked scene axis writes
  `this.stateAxis("look").to("busy")`.
- Undo: the op's span inverse. Refused rather than guessed when the
  scene's `stateSpace()` is hand-written in another shape (no
  `axes: [ … ]` literal).

## Step 2 — the timeline shows the state space

- `editor/statelanes.ts`: under the clip rows, one lane per axis the song
  moves. Each authored transition is a block `from → to`, with positions
  read off the timeline at the clip's ends (nearest match, the automaton's
  own rule). A click seeks to (and selects) the clip. Dragging the right
  edge retimes it with the rows' `setRunTime` op. A walked, unwritten
  transition is a dashed ghost at the playhead until ⌘K or Esc. The
  timeline grows to hold the lanes (at most 8).
- These are not the per-parameter lanes timeline.ts forbids. A lane is a
  named dimension a holon chose to expose, and a scene with no state space
  draws none.
- `setRunTime` now retimes songs that play through helpers: when the
  play()'s run_time is the helper's parameter (`flowing(dt, …)`), the
  literal in the unfold() call that played the clip is rewritten, found by
  ordinal. Undo uses the byte-span inverse. This also fixes retiming the
  clip rows in FlowMap.

## Next

- The recorded spelling is the pose (`this.map.stack.members[4].open.to(0)`);
  the song's own idiom is the axis (`m.stage("raw").open.to(0)`, or
  `map.axis("grain").to("categorised")`). A semantic `appendTransition` op
  that writes `axis.to(position)` is the right next op once holons expose
  axes by name.
- A recorded transition inside a `flowing` song freezes the clock for its
  duration (the checkpoint writes `this.play`, not the helper).
- Firing while playing (a live fork of the song) and the clocks running in
  the paused editor are deliberate omissions, not gaps.
- The editor's own axes are declared (`EditorAxis`, editor/walk.ts):
  transport, lens, outline and code. With nothing selected they sit above
  the scene's axes in the State group, each position a button, so the
  containment is visible: the containing machine first, the scene's below.
  They are not params, since nothing eases; a position is read and fired
  through the editor. Selection and the panels with unbounded positions
  (comments, explorer) are not axes yet.
