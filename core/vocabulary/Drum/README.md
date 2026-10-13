# Drum

![Drum](Drum.png)

A drum, platonic — liquids and additives by the barrel: a standing
cylinder girded by two rolling hoops (bands a little wider than the body,
touching it, never through it), the bung on its lid. The hoops are what
say DRUM rather than can. Visible 3D edges and fills
(`src/parts/soliddrawing.ts`).

```ts
drum = new Drum({ observer: this.observer, material: BLUE })
```

**Promoted params**: `material` (the steel's colour — the content's
category), `body` (the bung), plus the Stroke set. 120 across, 176 tall,
axis y; origin at the middle of the bounding box.

**Why it exists**: the packaging vocabulary of the grain of knowledge
(`vocabulary/Grain`) — inks, adhesives, additives. `/demo/?scene=materials-faces`.
