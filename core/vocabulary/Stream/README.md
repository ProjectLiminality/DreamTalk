# Stream

A flow of particles along a path: evenly spaced by arc length, moving at a
constant speed, a pure function of `time` — the abstract flow (a line and
its dots). The stream mathematics is FlowMap's (`src/geometry/flowmap.ts`:
`streamArc`, `atArcLength`, `smooth`), reused, not restated: a Stream is a
single FlowMap channel standing on its own.

```ts
stream = new Stream({ path: [{ x: -760, y: -230, z: 0 }, { x: 740, y: -230, z: 0 }], count: 12, spacing: 130, speed: 70 })
this.play(together(this.stream.time.by(dt, { easing: "linear" }), …), dt)   // every beat keeps it running
```

**Params**: `count`, `spacing`, `speed` (units/s), `time` (seconds),
`radius` (the default dot), plus the Stroke set (`tint` is the dots').
**Options**: `path`; `symbol(overrides, index) => Holon` — what a particle
IS (default: the filled blue dot); the Stream places it (x, y, z, opacity)
and owns it. `dots` holds the particle holons.

It answers the **flow source** contract a `Lens` reads — `path()` and
`particles()` (each particle's place along the path as a fraction of its
arc length, −1 while in the pipe) — the same two questions FlowMap's `Flow`
answers. Proven by `test/lens.test.ts`; seen in `/demo/?scene=lens`.
