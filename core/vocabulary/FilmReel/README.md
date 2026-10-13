# FilmReel

![FilmReel](FilmReel.png)

A reel of film, platonic — the semi-finished product: a big roll wound on
a core, lying on its side. The roll is one capped cylinder; the core shows
on each face as a ring and stands proud of it as a stub, which is what
tells a ROLL from a drum. Its contour lines are solved for the camera
(`src/geometry/hiddenline.ts`): turn the view and they stay where the view
ray grazes the roll.

```ts
reel = new FilmReel({ observer: this.observer, material: BLUE, width: 120 })
```

**Promoted params**: `material` (the film's colour — its category),
`diameter` (200), `width` (190, the film's width along the axis), `body`
(the core's fill), plus the Stroke set. Axis along x, up +y, origin at the
centre.

**Why it exists**: the grain of knowledge (`vocabulary/Grain`) — a dot in
the flow from extrusion to conversion becomes a reel. `/demo/?scene=materials`.
