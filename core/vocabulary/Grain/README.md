# Grain

![Grain](Grain.png)

A particle that knows how much we know about it — **the grain of
knowledge**. If all we know is kilograms moving, it is a neutral dot ("a
sphere is very neutral"). When the categories are told apart, the dot takes
its category's colour. When the type is known, the dot becomes a symbol of
an example of that material — a pallet of granulate, a reel of film, a
pouch. When the exact item is known, it is still that symbol, and named.
The rungs MORPH into each other, so the eye stays on the essence: this dot
stands for this more complex thing.

| rung | `grain` | what is known | what is drawn |
|---|---|---|---|
| mass | 0 | kilograms moving | a neutral dot (`NEUTRAL`) |
| category | 1 | its kind | the dot in its category's colour |
| type | 2 | its type | the type's symbol (a `SolidDrawing`), `material` = the category's colour |
| item | 3 | the exact item | the item's OWN symbol (from its data), its label written in beside it |

`grain` is continuous: 0.5 is a dot halfway to its colour; 1 → 2 is Morph's
three channels (`morphPhases`): the dot's fill goes, its outline flies apart
onto the symbol's visible 3D edges (`planMorph` / `blendPlan`,
src/geometry/correspond.ts), the symbol's fill comes in; 2 → 3 writes the
label and, when the data gives the item's own symbol (`item`), morphs the
type's edges into it — drawn at the TYPE's scale, so a narrower, taller
reel IS narrower and taller, an octabin replaces the sacks, a pouch takes
its size or becomes sheets. Every channel is continuous in `grain`, so a rung can be scrubbed,
reversed, or held halfway.

**Each rung has its own certainty.** `massKnown`, `categoryKnown`,
`typeKnown`, `itemKnown` (1 = the data says so, 0 = a picture we are
painting) — and the Grain's `certainty` (src/certainty.ts) FOLLOWS the rung
it stands on, piecewise linearly between them (`rungCertainty`). So the
renderer ghosts what is mocked and draws solid what is data, rung by rung:
a pallet guessed from mock data is a ghost (with its superposition cloud),
and `typeKnown.to(1)` is the collapse when the data arrives.

```ts
import { Grain, RUNG } from "../../vocabulary/Grain/Grain"

grain = new Grain({
  observer: this.observer,
  category: BLUE,                          // rung 1
  symbol: (o) => new FilmReel(o),          // rung 2 (gets observer, size, fades)
  label: "BOPP film · 2,400 m",            // rung 3: its name …
  item: (o) => new FilmReel({ ...o, width: 120, diameter: 230 }),  // … and its own shape
  typeKnown: 0.25,                         // the type is a guess so far
  stand: true,                             // the symbol stands on the dot's plane
})
this.play(grain.grain.to(RUNG.type), 3)    // dot → reel, ghosted
this.play(grain.typeKnown.to(1), 1.4)      // the data arrives: solid
```

**As a flow's particle**: `Stream`'s `symbol` hook takes it directly —
`new Stream({ path, symbol: (o, j) => new Grain({ ...o, observer, … }) })` —
and the Stream places and fades it. **On the FlowMap**: a stage whose data
names a `symbol` (`pallet` · `octabin` · `reel` · `pouch` · `sheets`)
carries Grains, and `stage(id).rung` 1 → 2 turns its dots into the
material (`/demo/?scene=flowmap-grain`; pass the map `seenBy: () => this.observer`).

**Params**: `grain` (0…3), `radius` (the dot), `size` (the symbol's largest
extent), the four `…Known`, `certainty` (read-only: it follows them), plus
the Stroke set (`tint` is the symbol's lines). **Options**: `observer`,
`category`, `symbol`, `label`, `item`, `neutral`, `stand`. A symbol turned with `h`/`p`/`b` (a pouch facing the camera) morphs as turned. **Exports**: `RUNG`,
`NEUTRAL`, `grainPhases(g)` and `rungCertainty(g, known)` (pure).

**Why its own frame**: the morph is planned in the Grain's local space, not
world space, so a particle travelling down a flow does not re-plan it as it
moves — under an orthographic camera never (the plan is keyed on the view
direction and the symbol), in perspective only as its view turns. The dot
and the label face the camera from the observer's phi/theta, so a Grain
under a ROTATED parent wants a facing carrier (as FlowMap's particles have).

**Material symbols** it was made with: `Pallet`, `FilmReel`, `Pouch`,
`SheetStack` (each its own folder); any `SolidDrawing` works — a `Truck`
too. A symbol with a `material` param takes the category's colour.

Scene: `/demo/?scene=grain` — a flexible-packaging value chain, generic:
raw material in, extruded to film, converted to pouches. Dots → colours →
symbols ghosted from mock data → collapsed to solid flow by flow → named →
and back to dots. `/demo/?scene=materials` turns the symbols on a shelf.
Proven by `test/grain.test.ts`.

**Not yet**: on the FlowMap the particles' carriers face the camera, so a
material symbol is always seen face-on there, and a stage starts at rung 1
(its colour), not 0; the FilmReel's rims stay sharp (a rounded lathe loses
its mantle contours in the mesh line drawing — reported to morph); the
superposition cloud on ghosted FILLS is glow's to tune.
