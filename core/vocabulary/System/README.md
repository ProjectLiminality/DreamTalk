# System

![System](System.png)

The global system, as four interlocking gears. Law, economy, finance and
healthcare, each drawn as a gear bearing the icon of what it governs —
the scales of justice, a factory, a banknote, a stethoscope. The symbol's
argument is in the meshing: these are not four machines but one machine,
and no tooth turns alone.

The only composite in the 2024 pitch built entirely out of imported
drawings — six SVGs, no primitives at all.

The construction is twelve numbers and nothing else. Four groups on two
diagonals: the big pair at (±80, ±85) carrying `gear_big`, the small pair
at (±70, ±65) carrying `gear_small`, at group scales 0.5 and 0.3. Each
icon carries a second, inner scale of 0.5 on top of its group's, so an
icon is always exactly half its gear. What that scales is each drawing's
**native** imported size — pydeation's SVG loader does no resizing, it
loads the file, re-centres the axis and stops — so the six measured asset
heights are what make the icons look correctly varied inside identical
gears. All six share a 400-unit export canvas; only their heights differ,
from cash's 163.8 to stethoscope's 400.5.

**Promoted params**: `tint` (the icons — the source's `color`), `gearTint`
(the gears — its `gear_color`, which falls back to `color`), plus the
Stroke set. Placement and sizing are the source's constructor and are not
parameters; resize through `scale`, which is how Scene03 does it
(`System(scale=3/4)`).

**`Create` floods it solid.** Not a draw-on: `System` is one of the six
classes pydeation's `Create` dispatches on by name, and it is sent to
`DrawThenFillCompletely` (`animator.py:948`). The gears and icons draw
over (0, 0.6) of the span and their interiors flood **opaque** over
(0.5, 1). A gear ends the span as a solid toothed ring, not an outline of
one — which is easy to miss, because the scene that stages it says only
`Create(global_system, circle)`. `unCreateAnim` is deliberately *not*
overridden: pydeation's `UnDraw` has no class table, so the un-draw is
the generic one.

**Stroke order is `short_long`**, applied as data. Within a drawing the
subpaths are drawn shortest first — a gear's inner circle reaches 80%
before its teeth begin, measured frame by frame — which is what the
reference shows and what neither `bottom_top` (pydeation's stated
default) nor `long_short` predicts. The same ordering then predicts the
un-draw, which was not used to choose it. This is the campaign's
recurring blocker (Scene00's stroke connection, Scene04's "bottom_top
law — third sighting") meeting an object simple enough to settle it: two
strokes of very different length make the three candidate orders give
three different answers instead of near-ties.

**Lineage**: `refs/pydeation-legacy/object/custom_objects.py:400-426` (the
whole class — a constructor and four Groups), `animation/animator.py:948`
(the `Create` dispatch) and `:498-514` (`DrawThenFillCompletely`), from
the 2024 pitch "The Origins of Project Liminality". Staged by `pitch.py`
Scene03, its only appearance.

**Proven by**: `test/system.test.ts` (26 tests — the layout recomputed
from the source's own constructor, the gears asserted to **mesh** by
solving centre distance against pitch radii rather than comparing stored
offsets, both stroke-order ends pinned), plus the scene score against
`refs/pitch/origins/frames5` — `?scene=o03` 8/29 PASS at mean coverage
ref 0.944 / ours 0.819, with **sixteen predicted pixel positions landing
within a pixel** of the reference (the four gear-cluster bbox edges and
each icon's width, height and centre). Nothing in the layout is fitted.
See `docs/reports/origins/o5-*`.

**Known gap: the fill ignores the hole.** A gear is an annulus with a
toothed rim, drawn as two separate closed subpaths, and
`render/three-host.ts`'s closed-`Line` wash fills each as a disc from
its centroid — a fan that is correct for a convex loop and stated as
such where it is defined. So the gear floods to its centre where the
reference leaves a black disc carrying the icon. Measured on the white
hold: 88.6% of our excess ink is inside the gears' inner discs, the hole
exactly. The tooth band itself is right, the reference is 98.9%
explained by us, and the frames where neither side carries fill score
0.97/0.95 at a chamfer of 0.86/0.28px — so the geometry and the
choreography are both correct and only the paint between the lines is
wrong. Filling it properly needs even-odd winding across a Sketch's
subpaths together rather than a fan per loop, in shared render code.

**Parts**: no primitives — four `Gearing` groups, each two `Sketch`es.
