# EDITOR-V4.md — Overrides, the flying Observer, and the minimal timeline

David's batch (2026-08-24). Keynote for layout and animation *concepts*,
C4D for three-dimensionality and numeric editing, Manim for programmatic
elegance. Canonical flat palette throughout.

## The one architectural idea: the LIVE LAYER

Four of these requests are the same mechanism wearing different clothes:

- tweak an animated parameter and have it snap back when the playhead moves;
- fly the camera around a paused scene and have it return on play;
- scrub without losing what you were inspecting;
- eventually, drag an object in the viewport.

All of them are: **a temporary value that overlays the timeline and yields
to it when time advances.** Build it once.

```
value(param, t) = liveOverride(param) ?? timeline.valueAt(param, t)
```

Rules (this is the contract, and it is the load-bearing part):

1. `Timeline.apply(t)` writes into params as today. The live layer sits
   ABOVE it: an override map on the editor, consulted after apply.
2. An override is **cleared when the playhead moves** — pressing play, or
   scrubbing to a different t. That is C4D's behaviour and David's ask:
   "they should just snap back to their keyframed value when the player
   goes." Editing while paused is exploration; time is truth.
3. An override on a param that the timeline never touches is NOT cleared
   by time — there is nothing to snap back to. It persists until
   committed to code or explicitly reverted.
4. Committing an override to code (EDITOR.md's `setOverride` op) is the
   existing persisted path and is unchanged. Overrides are the *live*
   half of the live/persisted split, generalised.
5. The Observer is a Holon like any other, so flying the camera is just
   overrides on `phi`/`theta`/`radius`/`x`/`y`. No special case.

**Why it must be an overlay and not a write into the param:** params are
written by `Timeline.apply(t)` every frame. A value written into the param
is destroyed on the next frame. Today's editor gets away with it only
because it pauses first. The overlay makes tweaking-while-playing, and
snap-back, both fall out for free.

## Flying the Observer (C4D-flavoured, minimal)

While paused, dragging in the viewport orbits: drag → `phi`/`theta`,
scroll → `radius`, shift+drag → pan (`observer.x/y`). These are overrides,
so the scene's authored camera is never damaged.

On play: **interpolate back** over ~0.4s from the flown pose to the
timeline's pose at the current t, then release the overrides and resume.
David's words: "a quick interpolation of the current view towards the
camera perspective and then the scene should be played further." One
eased tween over the same spherical params; nothing else moves.

Two constraints that keep this honest:
- the flown pose is never written to the scene file unless explicitly
  committed (a "set observer from view" action, later);
- the gauntlet and export always sample the timeline pose, never a flown
  one — overrides live on the editor, not in the Dream.

## The minimal timeline (Keynote's model, not keyframes)

Keynote asks *how long a thing takes* and *whether it follows or goes
with* the previous thing. It never exposes keyframes. `AnimationGroup`
already encodes exactly this: `together`, `chain`, and windowed sub-spans
`[anim, a, b]` (see core/src/anim.ts). The UI should surface that and no
more:

- one row per `play()` clip, in order, labelled by what it animates;
- the row's WIDTH is its `run_time`; drag the edge to change it
  (`setRunTime` op — EDITOR.md v3, whose anchors already exist since
  `Dream.play()` returns its Clip);
- nested windows within a clip drawn as bars inside the row, read-only
  for now (they come from `together(...)`/`[anim, a, b]` in code);
- NO per-parameter keyframe lanes. If a scene needs that, the answer is
  better composition in code, not a keyframe editor.

## Code view (read-only first)

A panel showing the current scene's source with the selected object's
construction highlighted. Every holon already carries `{file, start, end}`
via `editor/anchors.ts`, so this is a lookup, not an analysis. Selecting
a clip highlights its `play(...)` line; selecting an object highlights its
`new X({...})`. Read-only in this pass — editing stays in the file, where
the daemon watches it.

## Symbol thumbnails

Each holon class gets a tiny glyph rendered from its own geometry
(offscreen, once, cached by class + params-signature), shown in the
holarchy outline and inline in the code view. Fall back to a generated
monogram when a class has no renderable geometry. This is the
"DreamTalk symbol as its own face" idea at UI scale — a symbol should be
recognisable by its shape, not only its name.

## Numeric editing (C4D)

Every number in the inspector is a **draggable numeric field**: click to
type an exact value, drag horizontally to scrub it, shift for fine and
cmd for coarse. Sliders stay only where a bounded range is genuinely
meaningful (`completion`, `bipolar`). This replaces today's slider-first
panel, which cannot express 250.0 precisely and wastes width.

## Not in this pass

Scene navigator thumbnails (EDITOR-V3 step 2), DreamSong documents and
transitions (steps 3-4), editable code view, committing a flown camera
to source.
