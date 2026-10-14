# Every symbol a visual automaton

*David, 2026-10-13: "A DreamTalk symbol is a visual automaton: a state
machine where the internal process state is mirrored by an external display
state … a DreamSong is a high-dimensional visual automaton … every state has
an adjacent possible."*

This is what exists now, in one page. The editor half (the walk, state
lanes, save-as-state) has its own report: `editor-automaton.md`.

## The one idea

A state space is not a second system beside params and the timeline. It is
a **naming** of what is already there.

- **Axis**: a named dimension of a holon, with named **positions**. Each
  position is a set of param values (a `State`). A toggle is an axis with
  two positions.
- **The song is one path through the space.** `this.play(map.stateAxis("grain").to("categorised"), 1.8)`
  writes exactly the tracks a hand-written `map.grain.to(1)` would.
- **Free play is every other path.** The world holds at a moment of the
  song. The viewer fires axes in any order, through clicks, keys or the HUD,
  while looking from any angle.

What's on screen is a pure function of the fired transitions and a clock.
From rest, a transition draws the same C4D-eased curve the song would.
Fired again mid-flight, it carries its current value *and* velocity, so a
reversal swings and comes back instead of popping.

## How a holon declares it

```ts
override stateSpace(): StateSpace {
  return {
    axes: [
      axis("grain", this, { uncategorised: this.states.uncategorised, categorised: this.states.categorised }, { key: "g", handles: () => [...] }),
      toggle("labels", this.labels, { off: ["hidden", 0], on: ["shown", 1] }),
      choices("op", this.op),                // a choice param's options as positions
    ],
    clocks: [this.time],                     // keeps running in free play
  }
}
```

Options on an axis:

- `handles`: what you click.
- `key`: a single character.
- `when`: the adjacent possible. A stage gap is only walkable once the map is
  staged.
- `via`: a verb or morph that plays the transition instead of a plain ease.
- `duration`.

Scene-level states that span several holons, such as the editor's "save as
state", are `poses(...)` in the Dream's own `stateSpace()`.

**Who has one today:** FlowMap, Lens / FlowLens, Forms, Earth, GeoFlow,
SOPLoop, Horizons, Grain, Pallet, Eye, FoldableCube, MindVirus, Quote, Road,
TheWall, Fourier, Plot, Regenaissance, and the Calculator. Each one exposes
only states its params already express. Nothing was invented.

## Where to try it

- `?scene=gallery&play=free`: fourteen symbols in two rows. Use ← → to visit
  each one. The view glides to frame it, and its axes come alive on the keys
  and the HUD. Esc shows them all.
- `?scene=flowmap&play=free`, `?scene=earth&play=free`,
  `?scene=forms&play=free`, `?scene=lens&play=free`.
- In any song, **Space** holds the world and makes it walkable. Space again
  glides back into the song.

## Looking around

In free play, and in the editor whenever it's paused:

- Drag to orbit. Shift-drag or right-drag pans.
- Wheel or pinch to dolly. On glass, one finger orbits, and two fingers
  pinch and pan.
- Double-click or `f` frames what's under the pointer. A double-click never
  fires anything. `r` glides home.

The viewer's camera is a layer over the song's own, not a change to it. Every
holon that reads the camera sees the pose that's actually on screen: the
Earth's horizon, a Lens, a Truck's hidden lines, a Grain or FlowMap label
turning to face you. Bound camera rigs work too, and exports never see the
layer.

Holons can keep the eye out of solids with `keepOut()`. On an Earth
close-up, a drag turns the planet beneath you at a constant height.

## Conventions (keep these)

- **Ids** are lowercase words: `grain`, `expand`, `labels`. An axis on a part
  is `part.param`: `raw.open`, `lens.align`, `left.certainty`.
- **Positions** are named for what they *look like*, never as numbers:
  `flat · staged`, `closed · open`, `blank · written · credited`. Order is
  the cycle order.
- **Sequential beats are one axis, not several toggles.** The Quote's credit
  never exists without its words.
- **One param, one axis.** A part sharing its whole's param is walked by the
  whole. Scene states, which compose holon params by design, are exempt.
- **Guard bound params.** If a rig or binding drives the param, the holon
  declares no axis for it.
- **Reserved player keys:** Space, `` ` ``, `~`, `m` (sound), `h` (HUD), `r`
  and `f` (view), Esc, and the arrows. A declared key in this set is
  silently replaced by a digit. That currently hits Horizons `h`, SOPLoop
  `f` / `r` and FlowMap `m`.

## Open

- **Reserved keys:** the four collisions above need new keys, or the player
  should warn. The reserved list belongs in `automaton.ts`, where authors
  see it, not hidden in the player.
- **Recording a walk as a song:** the journal already records every fire,
  and the editor's ⌘K captures one at a time.
- **Camera flight as part of a path:** a song that remembers where you looked.
- **The look of attention:** glow owns it now; hover ticks and captions are
  the fallback.
