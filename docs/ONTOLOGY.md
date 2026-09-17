# ONTOLOGY.md — The strange loop, made tangible

David's transmission (2026-08-24), mapped point by point onto the
architecture: where the platonic self-similarity already exists in code,
where it doesn't yet, and the decisions that keep the road to DreamOS
open without building DreamOS now. This document is foundation-layer:
read it with TASTE.md before architectural work.

## The core claim

**Everything is a DreamNode — a digital holon.** A holon:

- **is in space**: it can be imported into a scene and presents itself
  there through its DreamTalk symbol(s) — its exterior face(s), in the
  display-domain sense (Hoffman's interface theory: how a thing chooses
  to appear, not what it "is"). The Observer presents as the Eye.
  Multiple symbols per node are legal; faces evolve (the becoming
  vector).
- **is space**: it contains parts dancing within it. Its interior
  perspective is the DreamSong — one or more orchestrated plays of its
  lower-level ideas that explain it from within.
- Exterior condenses (many → one symbol); interior explicates (one →
  many parts in time). Thumbnail vs. watching-the-video is exactly this
  dynamic.
- It travels with **three faces** (already TASTE law): linguistic
  (README), geometric (symbol), functional (code — the Fourier node
  contains the actual transform, and an app using the symbol gets the
  function). That third face is the DreamOS on-ramp.

## Where the loop is ALREADY tangible in the code

| Intuition | Existing mechanism |
|---|---|
| "Scene properties are just another object" | The Observer is a Holon; the inspector's no-selection state shows the scene as an object. |
| "Parent contains its own space; children dance in it" | `parts` as class fields; each scene's transform hierarchy is a tree inside its holon (DECISIONS Q1). |
| "Inputs and outputs; geometry is just an output" | Params in, geometry out is the pure-holon contract (Ch 6's formal shape); a Cloner is a holon whose geometry output derives from its children's outputs — `compose()` generating parts already does the informal version (Axes, Eye). |
| "Every holon has unique abilities over its children" | `createAnim()` / `unCreateAnim()` dispatch — abilities are methods returning Anims over self+parts. No stuntman classes (SYNTAX-TS). |
| "States of the whole scene" | `State` / `transitionTo()` already exist as "discrete relational configurations." |
| "Pose it by hand, then it becomes the animation" | The live override layer: posing-while-paused is already the interaction; it currently snaps back — capturing it is the missing half (below). |
| "Symbols travel with functionality" | dreamtalk.json: entry + parts + promoted params; the module's exports ARE the functional face. |

## The one real gap: the Dream is not yet a Holon

Today `Dream` (timeline builder) and `Holon` (thing in space) are
separate classes. David's ontology says they must not be: a scene is a
holon whose chronology we happen to be playing.

**Decision (direction, not immediate refactor): Dream = Holon + chronology.**
A holon may own a timeline the way it owns params; `unfold()` is the
macro form of `createAnim()` — the same idea at two zoom levels. When a
scene-holon is imported as a part of a larger holon, its chronology
becomes an invocable *performance*. A DreamSong with chapters is then
nothing special: a holon whose parts are scene-holons, played in
sequence. Mirrors facing mirrors.

Practically: `Dream` survives as a thin façade (holon + transport
conveniences) so nothing breaks; **new machinery (DreamSong files,
transitions, checkpoints) must treat scenes as holons-with-chronologies**
so the unification is never blocked. The refactor lands when Ch 12
(appreciator mode) needs it anyway.

## The DreamSong: one file, linear, one import set

Canonical form: **a DreamSong is a single file** with relative imports
(into the repo or its submodules), defining its scenes as chapters in
sequence. Linear by nature — a video, a scrollytelling page, a talk.

- Scenes inside a DreamSong are *chapters*, not sovereign nodes — like
  Keynote's grouped slides. Sovereignty lives at the imported symbols
  and at the DreamSong itself.
- **Pop-out** is the first-class growth operation: in hindsight, any
  chapter, symbol, or asset can be promoted to its own DreamNode
  (create repo, move content, rewrite the import to the submodule path,
  add a `parts` entry). Programmatic; agent-drivable ("give Walter
  Russell his own node"). This is how the holarchy grows — cell
  division, not planning.
- EDITOR-V3's `dreamsong.json` is hereby refined: the JSON remains the
  *manifest face* (repo-level metadata), but the DreamSong's source of
  truth is the .ts file itself — consistent with file-is-truth
  everywhere else. For video-01: `DialecticalThinking.ts` imports
  S01–S10 and sequences them with cuts; the ten scene files stay as
  working chapters in the same repo (relative imports — the constraint
  holds).

## Vocabulary vs. invisible assets

The vocabulary bar (top of the editor) shows a DreamSong's *meaningful*
imports — its conceptual cast — never every primitive.

**The rule, mechanical:** Layer-1 core primitives (Line, Circle, Arc…
from `dreamtalk/parts`) are *invisible assets* — no DreamNode for "a
line". Anything imported from OUTSIDE the core (from `holons/`, a
submodule, or the DreamSong's own repo-level symbols — Eye, Cylinder,
future MindVirus) is vocabulary and appears in the bar. Explicit
override allowed both ways. Verbose symbolism (the letter 'a' as a
node) remains the asymptotic ideal AI makes possible — a dial, not a
duty; the rule above is today's setting of that dial.

Within a repo, plain assets are legal and unlimited: they are weak ways
the idea presents itself. The strong faces are named (thumbnail,
symbol). Meaningfulness is graded, and pop-out is how an asset
graduates.

## Magic Move: one operator, self-similar across levels

Keynote's deepest trick, ontologically cleaned up. Keynote has a hidden
dualism (in-slide builds vs. between-slide transitions; ground truth is
always slides). We do NOT copy the dualism — in this architecture both
are one operation at different holon levels:

> **Magic Move = an interpolated path between two States, played over a
> span of the pure timeline.**

1. **Within a scene — checkpoints.** A checkpoint is a captured `State`
   of the scene-holon (params of it and its parts). The editor flow uses
   machinery that already exists: *pose the scene with live overrides
   while paused → "capture state" → a semantic op writes the State into
   the code and a `play(scene.transitionTo(states.X), d)` clip*. The
   snap-back layer becomes the posing instrument; committing a pose IS
   authoring animation. "Here's the beginning, here's the end,
   interpolate" — without keyframing parts individually. Checkpoints
   are sugar over the same timeline: deletable, duplicable, reorderable
   like slides, compiling to transitionTo clips. No second ontology.
2. **Between scenes — the same thing one level up.** In the DreamSong
   holon, the two scenes are sibling parts; a cross-scene Magic Move
   interpolates between scene A's final State and scene B's initial
   State. "Same object" generalizes to **matching** (by identity, name,
   class — later by shape for true morphs); matched pairs interpolate
   transform/color, unmatched A builds out, unmatched B builds in.
   Because scenes are holons, this is *literally* the within-scene case
   applied to the parent — the strange loop doing UX work.
3. Everything stays a pure function of t: a transition is an Anim
   computed from two sampled States in an overlap window (EDITOR-V3's
   composite-timeline decision unchanged). Scrubbing through a Magic
   Move is just sampling.

## Baking, corrected

David's skepticism is half right and worth recording precisely. Baking
was never about render cost — everything renders realtime. Its one
honest purpose: **history-dependent (stateful) holons cannot be sampled
at arbitrary t** — a particle sim must replay from 0 to answer "what is
t=12?", which breaks scrubbing, the gauntlet, determinism, and Magic
Move alike. Baking converts a stateful holon into a pure f(t) by
storing time-samples. So: pure holons never bake; stateful holons bake
*so they can join the pure-timeline world*; it is per-holon, on demand,
not a pipeline stage. Ch 6 stays, scoped to exactly this.

## Abilities and their owners (David's create/morph question)

Settled as already practiced: **abilities belong to objects** — a
method returning an Anim over self and parts (`createAnim`,
`thrustPulse`, a scene's `unfold`). The grammar keeps free-function
verbs (`Create(x)`, `Morph(a, b)`) as uniform spellings that *dispatch*
to the owner's choreography. Both mirrors, one image: the scene
revealing its children with Create and a Morpher morphing its children
are the same pattern at different addresses.

## The horizon (named so the foundation aims at it, built later)

- **UI as scene**: most UI is a 2D scene; the editor itself is
  eventually a DreamSong rendered by DreamTalk. Interactivity = input
  events writing params — the live layer is already that pathway.
  Nothing in the current architecture forecloses this; nothing today
  requires it.
- **DreamOS**: one holon containing all subholons, symbols carrying
  functionality into every interface. The three-faces manifest and the
  pop-out operation are the seeds.

## Consequences queued (see PLAN)

1. Scene navigator + vocabulary bar (one window; slides left, cast top).
2. `DialecticalThinking.ts` DreamSong pilot: ten chapters, cuts,
   157s composite timeline → full MP4 beside the original.
3. Checkpoint capture (pose → State → code) — Magic Move within scenes.
4. Cross-scene Magic Move v1 (match by identity/class; morphing later).
5. Dream/Holon unification rides Ch 12; all new code treats scenes as
   holons-with-chronologies from now on.

---

## Transmission 2026-09-16 (David) — abilities as pluggable holons, generalized; and the node graph

Thought-in-progress, captured for recurrent crystallization — not
conclusive. Sparked by revisiting the very first video (Dialectical
Thinking), now that its reproduction is essentially complete (the
manual C4D tweaks the original Python couldn't drive are the last
minor details to fold in — and the moment to go BEYOND the original,
not just match it).

### The parametric-elegance north star (the whole point)
Swap the inputs, and the entire piece responds — "exactly how good UI
components work, where you change one variable and the whole app's UI
responds. DreamTalk inherits that property from UI, taking it into
hypermedia for communicating ideas." Two input changes David wants,
that SHOULD cascade if the architecture is right:
- **Colors swapped**: the circle is now RED, the square BLUE (was the
  other way). One-line palette tweak.
- **Rectangle → Square**: monotonic for the visual-metaphor language —
  circle-vs-square is a cleaner comparison than circle-vs-rectangle.
- **THE TEST OF ELEGANCE**: if the cylinder is built as the SDF
  INTERSECTION of a square and a circle (discussed once, NOT yet built
  — confirmed absent), then rectangle→square propagates through the
  whole video automatically: change the input, the cylinder follows,
  the logic holds. This is the elegance to build toward. (Status: the
  cylinder is currently its own five-stroke vocabulary entry; the
  square∩circle SDF derivation is an OPEN ontology-aligned refactor.)

### Two effects to generalize from manual one-offs into ABILITIES
Both follow the settled pattern (DECISIONS 2026-09-07, "abilities are
pluggable DreamNodes"): a self-contained holon that is NOT a thing but
APPLIES an effect to a thing; imported into a DreamSong, it grafts a
verb onto every eligible object. Morph was the first; these are the
next two.

**1. GeometrySketch (the "annotate the geometry" effect).** Draws from
Keynote's sketch-effect thinking: apply to ANY line/shape and it runs
its own internal logic. It finds the shape's sharp angles and annotates
them geometrically — an arc drawn across each angle to show it, and the
right-angle convention (the little square-corner mark / dot) where the
angle is 90°. Throw it at any platonic shape (triangle, pentagon,
square) and it does what you'd expect; throw it at a custom shape and
it still works to reasonable degree. Syntax goal: `square.sketchGeometry()`
(or similar) once the ability module is imported. This is the SQUARE
side of the "both creatures describe the mathematics of what they see"
scene — the square gets right-angles/straight-line clarification while
the circle gets the sin/cos x-y-axis graph. (David has more clarity on
the square side; the circle side is future.)

**2. RayCaster (the "eyes perceive" effect).** Its own object. Casts
rays from a point; where a ray hits a collider shape, the ray STOPS and
a little "x" marks the hit (the collision). General form + edge cases:
- simplest: an origin point, rays isotropic in all directions;
- constrain to a PLANE (e.g. xy) → rays radial-outward in that plane;
- parameters: first-ray angle, last-ray angle, step count → steer/fan
  the spread. The Dialectical-Thinking scene (three rays from an eye
  hitting the shape) is then just an EDGE CASE of this general caster.
- takes an EMITTER object as input: simplest reading = cast from
  wherever that object is; later = cast from the emitter's surface
  NORMALS; later = 3D. Read whatever is needed off the emitter.
- COLLIDERS fed as input via set-algebra selection (the EDD /
  everything-minus-these vocabulary): most elegant is naming exactly
  the pair — e.g. left-eye-looking-at-circle is the emitter, the circle
  is the collider.
- on collision: colour (David trailed off — "add colours"), then a
  SHOCKWAVE — a circle that grows outward from the hit point and fades,
  ease-OUT not ease-in (full energy at impact, dissipating/slowing as
  it fades). And drive AUDIO off the collision (a little "ping") — the
  same "effect drives the audio track" pattern already used elsewhere.
- IMPLEMENTATION is free — pure geometry, OR a particle emitter with
  collision + traced paths. It does not matter, BECAUSE each holon is
  self-contained: no global system needed; whatever imports it gets
  everything it needs. (David explicitly: solve it however; the
  self-containment is what makes the choice local and reversible.)

### The open composition question — toward a node graph
Does the RayCaster come bundled WITH the Eye (so anyone who gets the
Eye can "look at things" = receives the caster)? Likely yes. But this
surfaces the deeper question David flags and defers: the object
HIERARCHY. Right now it's a tree (parent/child) — and "is the Eye a
child of the RayCaster, or the RayCaster a child of the Eye?" is
exactly the awkwardness C4D hit with its effectors/generators
(deformers-must-be-children, generators-must-be-parents). David wants
to move toward something **more like a NODE GRAPH, visualized in a
much more minimalist way** — not a rigid tree. Left as the next thread
to explore.

### Addendum 2026-09-17 (morning) — the node graph is object-level, and abilities are AGENTS
The graph is already there (Morph references shapes it doesn't own). The
refinement: every holon has INPUTS and OUTPUTS, but the VISUALIZATION is
stripped down to OBJECT relationships only — not the convoluted wire-up-
everything node graph. "Circle and square feed into Morph" — that
relationship, shown; the internal param wiring (e.g. map circle.color →
morph.completion by some logic) exists but stays folded away. A
distinction worth holding: the DEPENDENCY graph (not to be dictated by
suboptimal tools) vs the VISUALIZATION of how things play together.

The deeper reframe: dependencies are HORIZONTAL, not "text has the
ability to morph." Rather — text is an agent in the arena, shape is an
agent in the arena, and the MORPHER is a third agent: a SHAPESHIFTER
that interpolates between the two, taking on their shape, with its own
degrees of freedom and internal params. All three are children of the
SCENE (siblings), not parent/child of each other. Same for RayCaster:
it's the eye's latent ability, instantiated when needed — the scene
instantiates the Eye, then calls something like `eye.rayCast(...)`,
which imports the caster from the submodule and makes it available. The
guarantee: you never receive the Eye and find its cool ability trails a
broken dependency — it's all self-contained (down to particles if used).
Popping-out is OPTIONAL: the RayCaster needn't be extracted from the Eye
until you want it as a general capability for another project — then you
disentangle and modularize. Self-containment first; modularize on
actual reuse (the gardening rule). [node-graph-as-scene-of-agents]
