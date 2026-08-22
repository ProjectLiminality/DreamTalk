# SYNTAX-TS.md — The canonical DreamTalk syntax (TypeScript)

The target syntax for the new framework. Direct descendant of
`docs/SYNTAX.md` and `docs/reference/MindVirus_canonical.py` — everything
good in them survives; deviations are deliberate, argued in
**Deviations from the Python canon** below, and follow one rule:
*keep the philosophy, upgrade the mechanics where TypeScript or the
deterministic-t architecture offers something strictly better.*

## The Trinity (unchanged)

| Concept | Domain | Manifestation |
|---------|--------|---------------|
| **Kairos** | Timeless pattern | The `Holon` class definition |
| **Kronos** | Temporal flow | The `Dream`'s `unfold()` method |
| **DreamWeaving** | Living bridge | The `.ts` file containing both |

A "2D scene" is an Observer looking straight at the XY plane; nothing is
ever merely 2D.

## The complete example (MindVirus, transcribed)

```ts
/**
 * MindVirus.ts — A DreamWeaving
 *
 * A manipulative narrative with folding control mechanism.
 * The eye sees; the cube entraps.
 */
import { Holon, Dream, render } from "dreamtalk"
import { bipolar, color, length, state } from "dreamtalk/params"
import { ImagePlane, FoldableCube } from "dreamtalk/parts"
import { Create, together } from "dreamtalk/animation"
import { BLUE, PURPLE, PI } from "dreamtalk/constants"

// === Kairos: The Timeless Pattern ===

/** A self-replicating thought-form that attaches to minds. */
export class MindVirus extends Holon {
  // Parameters — degrees of freedom (declare before parts)
  fold = bipolar(0)          // -1 (wrapped) … 1 (open)
  tint = color(BLUE)
  eyeHeight = length(35)

  // Parts — pass a param where a value is expected and it BINDS
  eye = new ImagePlane({
    path: "parts/MolochEye/MolochEye.png",
    height: this.eyeHeight,
    orientation: "z-",
  })
  cube = new FoldableCube({
    fold: this.fold,
    color: this.tint,
    bottom: true,
    p: -PI / 2,
  })

  // States — discrete relational configurations
  states = {
    idle: state({ fold: 1 }),
    hunting: state({ fold: 0.5 }),
    attached: state({ fold: -1 }),
  }

  // Behaviors — ways of moving through Kronos
  thrustPulse(distance = 100) {
    return together(
      this.fold.sequence(1, 0.1, 1),
      this.z.by(-distance),
    )
  }

  wrap() {
    return this.fold.to(-1)
  }
}

// === Kronos: The Temporal Unfolding ===

export class MindVirusDream extends Dream {
  unfold() {
    const virus = new MindVirus({ tint: PURPLE })
    this.observer.orbit({ phi: PI * 24 / 180, theta: PI * 8 / 180 })

    this.play(Create(virus), 1.5)
    this.play(virus.thrustPulse(200), 1.2)
    this.play(virus.thrustPulse(200), 1.2)
    this.play(virus.transitionTo(virus.states.hunting), 0.8)
    this.wait(1)
  }
}

if (import.meta.main) render(MindVirusDream)
```

## Parameters

Semantic types are **runtime values**, not type annotations (TS erases
annotations; values introspect, serialize, and drive the editor UI):

| Constructor | Range | Example |
|---|---|---|
| `length(v)` | 0 → ∞ | `radius = length(100)` |
| `angle(v)` | radians | `rotation = angle(0)` |
| `bipolar(v)` | −1 → 1 | `fold = bipolar(0)` |
| `completion(v)` | 0 → 1 | `progress = completion(0)` |
| `color(v)` | RGB/named | `tint = color(BLUE)` |
| `integer(v)` | ℤ | `count = integer(6)` |
| `bool(v)` | true/false | `visible = bool(true)` |

Every holon carries the standard set by default (TASTE law): `x y z`
(position), `h p b` (rotation), `scale`, plus scene time `t`. Constructor
overrides: `new MindVirus({ tint: PURPLE, eyeHeight: 40 })`.

## Binding: pass the param

The Python canon's `<<` operator becomes something simpler: **a `Param`
object passed where a value is expected IS the binding.** Sharing the
object is sharing the value — referential semantics you can see.

```ts
cube = new FoldableCube({ fold: this.fold })  // bound: follows the whole
disc = new Circle({ radius: 20 })              // constant: plain literal
ring = new Circle({ radius: this.size.times(0.6) })  // derived binding
```

Derived params: `p.times(k)`, `p.plus(k)`, `p.map(fn)`, and
`derive(() => …)` for multi-param expressions. Data still flows downward —
the whole provides for its parts — because the whole *owns* the param.
Bidirectional constraint is a deliberate, rare, explicit act:
`link(a.radius, b.radius)`.

## Parts

Parts are class fields — declaration is registration (the holon scans its
own fields: `Param` fields are parameters, `Holon` fields are parts, in
declaration order). Conditional or repeated parts use the optional
`compose()` hook:

```ts
compose() {
  if (this.cableEnabled.value) {
    this.cable = this.add(new SweepNurbs({ rail: this.cableTracer }))
  }
  for (let i = 0; i < this.count.value; i++) this.add(new MindVirus())
}
```

`dreamtalk/parts` is the vocabulary namespace (Circle, Square, Sphere,
Axes, Eye, …). In the repo manifest, `parts` lists the holon repos this
holon draws in — the same word at both levels, by design (DECISIONS:
whole/part terminology).

## Animation: params animate themselves

The Python `.animate` proxy is replaced by methods **on the param itself**
— fully typed, autocompleted, and one less concept:

```ts
virus.fold.to(0.5)               // animate to absolute value
virus.z.by(-100)                 // animate by relative offset
virus.fold.sequence(1, 0.1, -1)  // through a value sequence
virus.tint.to(RED)
```

Each returns an `Anim` — a pure description (no side effects). Composition:

```ts
together(a, b, c)      // parallel, one shared span
chain(a, b, c)         // sequential
together(a, [b, 0.3, 1])  // b occupies the 0.3→1.0 sub-window of the span
```

The sub-window form is the Python canon's `(animation, rel_run_time)`
tuple, kept intact — nested groups renormalize their children into their
own span (the relative-time algebra from `animation/animation.py`).

Verbs from the classic grammar operate on the standard params:
`Create(h)` (draw-on), `UnCreate`, `Draw`, `FadeIn/Out`, `Fill/UnFill`,
`Move`, `Scale`, `Rotate`, `Morph(a, b)`. Abilities belong to objects, not
stuntman classes: if a line can draw itself, it can morph itself.

## The Dream

```ts
export class MyDream extends Dream {
  unfold() {
    this.backdrop("refs/video-01/DialecticalThinking.mkv", { offset: 0 })
    const thing = new Thing()
    this.play(Create(thing), 1.5)   // seconds, positional
    this.play(thing.pulse(), 1.2)
    this.wait(1)
  }
}
if (import.meta.main) render(MyDream)
```

- `unfold()` **builds a timeline; it does not execute one.** `play()`
  appends a clip at the cursor and advances it; `wait()` advances it. The
  result is pure data sampled as `timeline.sample(t)` — realtime playback,
  scrubbing, and the editor's overlay evaluation all fall out of this.
- Initial values of every animation resolve **from the timeline** (the
  param's value at the end of the previous clip), never from live scene
  state — evaluation is order-independent and deterministic in t. This is
  a deliberate correction of the pydeation design, whose
  `get_current_value()` read the mutable document.
- `this.observer` — pan/zoom/orbit/dolly; the unified 2D/3D consciousness
  per SYNTAX.md.
- `this.backdrop(path, { offset })` — the editor's reference layer,
  timeline-synced (TASTE: The Editor).

## Machine-editability rules (the editor contract)

The editor edits this file bidirectionally, so DreamWeavings stay inside
constrained forms:

1. One temporal statement (`play`/`wait`/`backdrop`) per line, literals
   inline — the editor rewrites literals via AST anchors.
2. Parameter defaults are literals in the field initializer.
3. No metaprogramming in Dreams (no dynamically built play calls);
   loops/conditionals live in behaviors and `compose()`, which the editor
   treats as opaque.

## Naming conventions

| Element | Convention | Example |
|---|---|---|
| Holon class / file | PascalCase / `MindVirus.ts` | `FlowerOfLife` |
| Dream class | `<Holon>Dream` | `MindVirusDream` |
| Params, parts, behaviors, states | camelCase | `eyeHeight`, `thrustPulse`, `states.hunting` |

## Deviations from the Python canon (each one argued)

| Python canon | TS canon | Why |
|---|---|---|
| `fold: Bipolar = 0` annotation | `fold = bipolar(0)` value | TS erases annotations at runtime; values introspect, carry range/UI semantics, serialize, and need no decorator machinery. |
| `<<` binding operator | pass the `Param` object | No operator overloading in JS — and passing the param is *better*: binding-by-reference is visible, typed, and needs no parser magic. `<>` becomes explicit `link()`. |
| `specify_parts()` method | parts as class fields (+ `compose()` for dynamic) | Declaration is registration; reads like a parts list; conditionals keep a hook. |
| `.animate` proxy (`self.animate.fold(0.5)`) | methods on params (`this.fold.to(0.5)`) | Same fluency, full typing/autocomplete, one less indirection. `.sequence` survives verbatim. |
| `class States:` inner class | `states = { idle: state({…}) }` field | Inner classes aren't idiomatic TS; an object literal scans and types cleanly. |
| `color` param name colliding with `color()` type | `tint` when a holon needs a color param | Honest collision fix; `color()` stays the constructor name. |
| Keyframes executed into the document at play-time | `unfold()` builds a pure timeline sampled at t | The deterministic-t architecture (TASTE): realtime playback, scrubbing, overlay evaluation, baking — all require evaluation to be a pure function of t. |
| `if __name__ == "__main__"` | `if (import.meta.main) render(Dream)` | Bun/modern-JS equivalent, same Kairos/Kronos file structure. |
| snake_case | camelCase | Language convention; PascalCase files/classes unchanged. |

## Philosophy encoded (unchanged, one addition)

1. **Holon** — every whole is also a part; sovereignty at every scale.
2. **Binding flows downward** — the whole provides for its parts.
3. **`unfold()` not `construct()`** — we allow revelation, we don't build.
4. **Dream not Scene** — creation is dreaming, not engineering.
5. **The file IS the holon** — code and manifestation are one.
6. **Kairos contains Kronos** — the class contains all possible unfoldings.
7. **Time is sampled, never accumulated** — every frame is a pure reading
   of the timeline at t; nothing depends on having played the past.

*DreamTalk: where mathematics dreams itself into motion.*
