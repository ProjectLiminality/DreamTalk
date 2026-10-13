# Road

A road, platonic: two edges and a dashed centre line on the ground (local
y = 0), along local x, centred on its origin. The concrete form of a flow's
line — what an arrow becomes under a `Lens`, through the morph (its Lines
are its curves, so `MorphCurves([line], [road])` just works).

```ts
road = new Road({ length: 400, width: 70, bound: (p) => lens.inside(p), boundKey: () => lens.insideKey() })
```

**Params**: `length`, `width`, `dash` (dash length = gap), plus the Stroke
set. **Options**: `bound` — a world-space predicate every line is trimmed
to (its longest inside run, ends refined), so a road ends exactly at a
lens's rim however it is tilted; `boundKey` — numbers that change whenever
the bound's answer would (the camera); `dashes` — dash slots (default 16).

Used by `vocabulary/Lens` (FlowLens). Proven by `test/lens.test.ts`.
