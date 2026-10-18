# Book

![Book](Book.png)

An open book standing toward us: two covers falling away from an upright
spine, the white block of pages fanned over them.

**The concept: THE WRITTEN WORD.** "The written word and broadcast"
(21:30–21:40): the first of the two innovations that changed the physics of
the medium, a story that no longer needs its teller at the fire. On the
Ancient → Modern arrow (f6496), alone (f6526), under the radio tower in the
red field (f6586), among the media round the GitRepo (f8971).

**The drawing** is the film's, traced off f6526 (84 × 81 px) at stroke
centrelines, anchors kept in the frame's own pixels. It is NOT the deck's
`Book_381` (PL02 slide 15), which is a flat open book seen from above.
Mirror-symmetric about the spine, so only the left half is traced.

```ts
book = new Book({ size: 170 })   // f6526 at the default eye
```

**Params**
- `size` (170): the whole height; origin the box's centre.
- `tint` (white), `stroke` (2 px).
- `opaque` (1): the covers wash black, so the red field of f6586 does not
  show through.

**Abilities**: Create draws the covers, then fans the pages open.

**Residual**: the film's page block shows several leaf-lines; ours has one
per side.

**Proven by** `test/ib-icons.test.ts` (one unit tall, mirror-symmetric,
84 × 81). Standalone scene `demo/interbrain/IconsDemo.ts` (`ib-book`).
Comparison against f6526: `docs/reports/interbrain/book-radiotower-compare.png`.
