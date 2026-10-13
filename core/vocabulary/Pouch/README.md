# Pouch

![Pouch](Pouch.png)

A stand-up pouch, platonic — the finished product, shaped as the film is:
two sheets sealed at the sides and the top, so its cross-section is a LENS
(sharp side seams, bellied faces) that opens wide at the gusseted foot it
stands on and closes to nothing under the sealed band. One lofted mesh
(`mesh` solids, src/geometry/hiddenline.ts): the seams, the gusset's fold
above the foot (the "smile") and the zip (a ridge across both faces) are
creases; the bellies are smooth contours solved for the camera, so turn it
and its outline slides round its curves.

```ts
pouch = new Pouch({ observer: this.observer, material: GREEN, width: 96, height: 150 })
```

**Promoted params**: `material` (the film's colour — the product's
category), `width` (120), `height` (186), `body` (the seal's fill), plus
the Stroke set. Face toward +z (turn it with `h` to face a camera), up +y;
the foot is 0.4 of the width deep; origin at the middle of its height.

**Why it exists**: the grain of knowledge (`vocabulary/Grain`) — what
leaves the converter. `/demo/?scene=materials`.
