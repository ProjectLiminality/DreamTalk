# Triad

![Triad](Triad.png)

A triangle of two naive opposites and the one without an opposite. At the
base, two poles that mirror each other and act as if they were enemies: the
hot one (red: spirit fleeing matter, light, lowercase good) and the cold one
(blue: matter devouring spirit, rigid, shadow, lowercase evil). Under them,
lowercase life and death in a back-and-forth dance. At the apex, capital-L
Life, or Reality, which has no opposite: on the vertical a thing is either
real or not there at all. The base plane is where things come in degrees.

**Real 3D.** In a flat drawing, horizontal and vertical can be swapped. In
space, a horizontal plane and the vertical line normal to it cannot. So the
flat drawing is treated as a 3D figure seen exactly edge-on. `unfold` opens
the third dimension:

- the base edge opens into the horizontal plane's rim, a circle with the base
  as its diameter and the two poles at opposite ends;
- the coil under the base opens into a helix turning round the vertical axis
  under the plane, red on the hot pole's side and blue on the cold pole's;
- the vertical line rises from the plane's centre to the apex.

The figure leans toward the eye as it unfolds, and the camera can orbit it.

**Two readings** (`reading`). At 0, the apex is Life itself, shown as a
white point. At 1, the triangle is read as the ego: an `Eye` opens at the
apex, gazing down into the triangle, for the figure that holds good and evil
in one. Life is then the whole that holds everything, drawn as the
triangle's circumscribed sphere. The sphere meets the base plane exactly in
the plane's rim, and the coil fits inside it.

**The dance** runs on the symbol's own clock (`dance`, seconds). The helix
turns, and life and death keep trading places through it, each staying on its
pole's side.

**Params**: `radius` (the triangle's circumradius, which is also the sphere's
radius; the one size), `unfold` 0 drawn … 1 3D, `reading` 0 apex … 1 whole,
`dance` (a clock).

**Axes**: `unfold` (`u`: drawn · 3D), `reading` (`w`: apex · whole); `dance`
is a clock, so it keeps running in free play. A whole that drives `unfold` or
`reading` makes that axis its own, and any key can be rekeyed.

**Construction** (ρ = `radius`, the sphere's centre at the origin): the
triangle is equilateral, with its apex at (0, ρ, 0) and its poles at
(∓ρ√3/2, −ρ/2, 0). The plane is y = −ρ/2, with a rim of radius ρ√3/2, which
lies on the sphere. The helix has radius ρ/2, runs 2 turns from −0.58ρ to
−0.84ρ, and turns once every 9 s.

**Parts**: `Eye` (the sovereign symbol, its lids driven by the reading) and
primitives (Lines, filled Circles that turn to face the eye).

`?scene=triad` draws the figure, unfolds it and turns the reading;
`?scene=triad&play=free` walks it.
