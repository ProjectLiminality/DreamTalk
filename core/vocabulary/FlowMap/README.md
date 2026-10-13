# FlowMap

![FlowMap](FlowMap.png)

An organisation's value flows as a visual automaton: a state machine whose
internal state is mirrored by its display state. The GROUP is one circle
holding its MEMBERS (subsidiaries, sites) as small rings; PARTNERS ring it
from outside — suppliers on the left where value enters, customers on the
right where it leaves, two-way partners above and below. Flows of value run
between them as channels with particles streaming down them.

Plain data in (`FlowMapData`): `categories`, `members` (with their
categories), `partners` (with a side), `stages` (the value chain, in order),
`flows` (from, to, stage, rate, certainty). The mock is generic.

**The degrees of freedom** — every one a param, smooth and reversible:

- `grain` 0 → 1 reveals the categorical dimension. Each category's disc
  shrinks in from the group's own circumference (the tangent point never
  moves); two categories land on the vesica piscis. Members glide into the
  region of exactly their categories and take its colour; members of
  several sit in the overlap, neutral. N categories, not two.
- `stage(id).shown` switches a flow layer on: its channels draw on and
  its particles start to run.
- `expand` 0 → 1 reveals the value chain's ORDER as a dimension: the map
  tilts to the side into a stack of identical slices, one per step, and
  each stage's flows run from its slice to the next. Inflow converges,
  outflow fans out. Collapsing lays it flat and face-on, exactly.
- `stage(id).open` opens or closes one gap of the stack — stages collapse
  individually but can never reorder.
- `time` (seconds; advance it linearly) and `speed` run the particles —
  a pure function of time. States: `uncategorised`, `categorised`,
  `flat`, `staged`.

**Certainty** (`src/certainty.ts`, a core ability): a stage, flow, member
or partner declared conjectural in the data is drawn GHOSTED —
translucent, its particles hovering (`wobble`) rather than running a crisp
line; real data is solid. Certainty inherits down the tree as a product.

**Seams**: `slices[k].hull` (the group circle, a Circle), `flows[i].line`
(a Line), `flows[i].dots[j]` (filled Circles — the neutral `symbol` "dot";
a stage's `symbol` names what its particles will become) — ready for Morph
(lines → one circle, dot → truck).

`?scene=flowmap` walks it all. Best seen orthographic (the demo's observer).
