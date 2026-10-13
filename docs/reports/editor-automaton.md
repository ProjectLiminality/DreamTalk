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
- The editor's own axes are not yet *declared* the way the scene's are;
  when they are, the HUD can show both machines — the containment made
  visible.
