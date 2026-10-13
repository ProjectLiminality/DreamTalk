# LabelRoll

![LabelRoll](LabelRoll.png)

A roll of labels, platonic — a converted product sold by the roll: a
narrow wound roll standing on its edge, its core showing on the face, and
the liner unwinding along the ground with the labels on it, each a little
rectangle. The tail of labels is what tells it from a reel of film.
Visible 3D edges and fills (`src/parts/soliddrawing.ts`).

```ts
labels = new LabelRoll({ observer: this.observer, diameter: 120, width: 40 })
```

**Promoted params**: `material` (the labels' colour), `diameter` (140),
`width` (56, the liner's), `body` (the core), plus the Stroke set. Axis z,
the tail runs to +x; origin at the middle of the bounding box.

**Why it exists**: the packaging vocabulary of the grain of knowledge
(`vocabulary/Grain`) — labels are a product of their own.
`/demo/?scene=materials-faces`.
