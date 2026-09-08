# PL02 assembly — progress ledger

Resumable notes for the PL02 DreamSong assembly (machine-sleep insurance).
Frames live in the scratchpad, not the repo.

Scratchpad: /private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad

## Status

- [x] Read the constitution (pl02-vocabulary.md + all amendments)
- [x] Read the Origins assembly precedent
- [x] Chapter coverage map (which decks each chapter scene builds)
- [x] Boundary table skeleton (60 rows) — corrections pending
- [ ] Missing slide modules generated (DONE: 20,21,26,27,28,39,40,41,42)
- [ ] ProjectLiminality.ts + registry
- [ ] boundary tests
- [ ] spot-score
- [ ] render
- [ ] assemble + sync
- [ ] gates

## Notes

### Structural finding: chapters run on ABSOLUTE VIDEO SECONDS

Unlike Origins (local clocks + offsets), every PL02 chapter's `at(t)`
IS video second t and each starts at t=0 with clips placed by
`clip.start = <video second>`. So the song must give each chapter
offset 0 — a span-based DreamSong offset would double-shift them.

### Chapter coverage (39 of 59 decks)

| chapter | decks |
|---|---|
| Arc01 | 2,3,4,5,6 |
| Mesh01 | 7,8,9,14 |
| Density01 | 11,12,13 |
| Chain01 | 15,22,23,24,25,29,30 |
| SetPieces | 16,17,18,59 |
| Web01 | 45-53 |
| Fractal01 | 43,44,54,55,56,57,58 |

STANDARD TREATMENT needed for 20 decks:
1, 10, 19, 20, 21, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42

Slide modules for 20,21,26,27,28,39,40,41,42 generated via
`bun scripts/key2ts.ts --slides ...` (they were not in the emitted set).

