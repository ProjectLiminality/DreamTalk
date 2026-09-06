# Editor polish — holarchy outline grouping + hover glow (EDITOR-V5 item 4)

Evidence for the two long-queued polish items, captured headless against
the daemon (s01, t=15.5). Verified 2026-09-06; tsc clean, bun test 550
pass, S04 gauntlet 6/6 PASS (mean cov ref 0.9946 / ours 0.9954).

## Outline grouping (editor/outline.ts)

Runs of ≥3 same-class ANONYMOUS siblings (no `identityOf` field name)
fold into one disclosure row — "Line ×48" — closed by default. The group
row is presentation, not a holon: clicking it discloses, never selects.
Selecting a member from the viewport opens its group (and highlights the
row); the group closes again when the selection leaves, exactly like the
auto-revealed wholes. Auto-expand now counts ROWS after folding, so an
Axes that folds to one group row opens calm at boot.

- `before-s01-outline-boot.png` / `before-s01-outline-gridline-selected.png`
  — the dump: 52 undifferentiated "Line" rows on selecting one grid line.
- `after-s01-outline-boot.png` — named parts keep rows (Eye's lidTop /
  lidBottom / eyeball / iris / pupil), both Axes fold to "Line ×48".
- `after-s01-outline-gridline-selected.png` — a grid line clicked in the
  viewport: its group auto-expanded, the member row highlighted.

## Hover glow (LOOPS.md: the game loop's first seed)

Pointer over a SOVEREIGN symbol's ink — however deep the hit; a grid
line is the Axes' ink — glows that sovereign whole: tint lerps 15%
toward white and stroke width lifts ×1.3, via the tint/width values
sync() already writes per frame (three-host `highlight()`; no new
passes, no postprocessing). Non-sovereign parts alone never glow.
Cursor: pointer over sovereign ink. Hovering a cast chip glows every
instance of its class. Editor-only: the demo/gauntlet path never calls
`highlight()`, so captures cannot glow by construction.

- `glow-baseline.png` — no hover.
- `glow-hover-cylinder.png` — Cylinder hovered: its five strokes lift
  (0.53% of pixels changed, all on the cylinder).
  `glow-cylinder-crop-compare.png` — 2× crop, baseline | hover.
- `glow-hover-gridline-axes.png` — a grid line hovered: the sovereign
  Axes glows whole (the symbol is the button).
- `glow-hover-axes-chip.png` / `after-s01-full-hover-axes-chip.png` —
  the Axes cast chip hovered: its instances glow in the viewport.

Note (pre-existing, out of scope): the editor's very first render after
boot draws the S01 cylinder with a stale camera-relative cap split; the
next render at the same t settles it. Present before this change (see
the before-* shots at t=15.5). The glow captures render twice to isolate
the glow.
