# PL02 assembly — progress ledger

Resumable notes for the PL02 DreamSong assembly (machine-sleep insurance).
Frames live in the scratchpad, not the repo.

Scratchpad: /private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad

## Status

- [x] Read the constitution (pl02-vocabulary.md + all amendments)
- [x] Read the Origins assembly precedent
- [x] Chapter coverage map (which decks each chapter scene builds)
- [x] Boundary table skeleton (60 rows) — corrections pending
- [x] Missing slide modules generated (20,21,26,27,28,39,40,41,42) — index.ts restored to all 59 after another agent's regeneration dropped them
- [x] ProjectLiminality.ts + registry entry `pl02` — builds at 903.4s, 516 clips, 62 roots; tsc clean
- [x] boundary tests — core/test/pl02-song.test.ts, 16/16, 1,213,563 asserts
- [x] spot-score — 48/60 segments, and song-vs-standalone shows ZERO regressions (41 identical, 23 better, 1 worse by 0.0006)
- [—] render — **ABORTED at 11,086/27,102 frames (41%) per the lead's policy change**: full film renders are not needed for reproduction; evaluation is frame-selective against the live scene. Frames kept at `<scratchpad>/pl02-frames` (712 MB).
- [—] assemble + sync — **not done**, same policy change. `<scratchpad>/assemble.sh` and `<scratchpad>/synccheck.sh` are written and ready if the film is ever asked for.
- [x] gates — tsc clean; `bun test` 1234/1234 (1218 baseline + 16 mine); S04 6/6 (GAUNTLET_PORT=4660)

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


### The composition architecture (decided)

Probed each chapter Dream: every one places clips on the ABSOLUTE video
clock and spans 0 -> its own last segment end:

| chapter | duration | clips | minStart | maxEnd |
|---|---|---|---|---|
| Arc01 | 134.80 | 39 | 0.00 | 134.80 |
| Mesh01 | 227.00 | 37 | 0.00 | 227.00 |
| Chain01 | 546.20 | 53 | 0.00 | 546.20 |
| Density01 | 220.00 | 51 | 0.00 | 220.00 |
| SetPieces | 893.40 | 66 | 0.00 | 893.40 |
| Web01 | 792.60 | 61 | 0.00 | 792.60 |
| Fractal01 | 860.80 | 59 | 0.00 | 860.80 |

They OVERLAP in time (each holds its own pages hidden outside its
windows), so DreamSong's accumulating-offset model does not apply.
The song is ONE Dream on the video's own clock that composes all 60
deck-segments directly, reusing the chapters' constructions by
CONSTRUCTION (same Slide holon + same build/firing machinery) rather
than by instantiating the chapter Dreams. The onset tables in the
chapter files are module-private `const`, and scene files are
read-only for this agent, so they are transcribed with provenance
comments naming the source file and line.

### Slide modules

`bun scripts/key2ts.ts` rewrites index.ts to ONLY the slides named, so
it must be run with all 59 at once:
`bun scripts/key2ts.ts --slides $(seq -s, 1 59)`.
The 50 pre-existing modules regenerate BYTE-IDENTICALLY (git shows only
index.ts modified) — deterministic emission confirmed. Emitting all 59
trips the generator's 2048 KB budget warning at 2242 KB; the film needs
all 59, so the warning is accepted and reported, not silenced.

### Measured clicks for the 20 uncovered decks

Instrument: `<scratchpad>/clicks.py` — whole-frame change scan at 5 fps,
each maximal run of changing frames read as one firing. Runs at a
segment's own edges are its incoming/outgoing transitions (cuts here).
Raw output saved at `<scratchpad>/clicks-all.txt`.

Per-build masking (`<scratchpad>/onsets.py`) was tried first and does NOT
reach these decks: their build targets are nested overlapping groups, and
P-8's exclusive-mask rule masks most of them to zero pixels. The coarser
click measurement is what the three-state firing model actually needs,
and it is reported as coarser rather than dressed up.

Deck 21 is the only substantial uncovered segment (53.0s, 13 builds,
9 manual chunks against 8 measured clicks — chunks 4 and 5 fire together,
confirmed by eye at 394.6-395.8 where both lobes travel in the same
frames).

Decks 41 and 42 are all-automatic cascades: one click each, and the
scan's change runs track the declared 1.0/2.0s steps across the whole
segment. The three-state model predicts those two segments entirely from
one measured number apiece.

### THE ASSEMBLY'S STRUCTURAL FINDING: pages must be gated to their windows

Composing the seven chapters exposed a class of behaviour no chapter's
own gauntlet can see, and it is NOT a defect in any chapter.

A chapter hides the OUTGOING page when it cuts to the next
(`setAt(from, pages[i-1].visible(false))`). That is right standalone:
the chapter's run is contiguous, and its LAST page is meant to hold to
the end because the chapter ends there. In a film neither holds:

- every chapter's last page would stay lit for the rest of the video;
- a chapter whose decks are NOT contiguous in film order (SetPieces
  owns 16, 17, 18 and 59, with decks 19-58 in between) leaks its
  mid-run pages the same way.

MEASURED at video 700 before the fix: SEVEN pages drawing at once —
Mesh01's deck 14 (1,329 leaf drawables), Density01's deck 13 (1,327),
SetPieces' deck 18 (1,801), Chain01's deck 30, Arc01's deck 6, Web01's
deck 45, Fractal01's deck 44. The composite was every tableau
superimposed (see the first spot-score's f_00003 render).

FIX, in the song and uniform for all 59 pages: `visible(false)` at the
far edge of each page's own window. It cannot disturb a chapter's
scoring — inside the window nothing is written, outside it the chapter
had no opinion — and the composition-invisibility test proves that
holds, param for param, EXACTLY.

Counting must be on LEAF drawables. A holon with parts draws nothing
itself (a `Connection` parents one `Line` per dash, and `opacityOf`
sets the CHILDREN's opacity), so a container's own opacity says nothing
about what is on screen. Counting containers gave a false positive on
every page.

### Boundary corrections THIS chapter made (beyond the amendments')

- **deck 13 -> 216.4** (recon 217.0). P-6's MagicMove01 studied this
  exact glide and measured its onset at 216.4 (`ONSET_VIDEO`) — the
  frame the GEOMETRY first moves, distinguished there from 216.2, the
  frame the first pixel changes. The recon's 217.0 sits inside the glide.
- **deck 25 -> 490.2** (recon 490.6). P-5's own three In-build onsets
  are 490.108-490.115 (sd 0.022-0.024) and a whole-frame change scan
  puts the first changing frame at 490.2. Chain01's PAGES table still
  says `from: 490.6` — the one place its cut-in disagrees with its own
  onsets. Nothing visible turns on it: deck 25 IS deck 24 plus an arrow
  and a "?", the InterLogos mesh identical in both, so the 0.4s overlap
  draws the same mesh twice. Reported, not patched (scene files are the
  chapters').

### The leading-automatic-chunk case (`cascadeFrom`)

`firingTimes` honours a click only on `automatic: false` — correct,
because that is what the flag means. But six of the twenty uncovered
decks (20, 32, 39, 40, 41, 42) open on an AUTOMATIC chunk, which has no
predecessor to derive from, so the helper's `referentTime` starts at 0
and the whole cascade landed at video second 0. The chapters never met
the case: every slide they own opens on a manual chunk.

Read as: the referent a leading automatic chunk steps from is the click
that ADVANCED TO THE SLIDE. So the cascade is computed from zero and
shifted onto that measured instant, preserving every derived interval
exactly. Implemented as `Standard.cascadeFrom` in the song; the shared
helper is untouched.

### Render (in flight)

27,102 frames at 30fps, 1280x720. First rate report: 5.3 fps at f300,
ETA ~85 min. (Origins did 11,337 at ~19 fps; this scene is heavier —
59 slide pages are staged at once, so every setT re-evaluates the whole
deck, and the slideshow's static holds do NOT render faster.)

Frames: `<scratchpad>/pl02-frames/f%05d.png`
Log:    `<scratchpad>/render.log`

Both `scripts/render-song.ts` and `scripts/pl02-gauntlet.ts` use
`waitUntil: "networkidle0"` with a 30s timeout, and NEITHER works on
this scene: it never reaches network idle, and boot takes ~45s. Scratch
copies with `domcontentloaded` + raised timeouts are used instead
(`scripts/.render-song.tmp.ts`, `scripts/.song-gauntlet.tmp.ts`) — the
repo's scripts are untouched. REPORT THIS: any future whole-film render
hits the same wall.

### OPEN: two of the three deck-59 labels do not draw IN THE SONG

Isolated in a probe scene, all three reconstructed labels render at
their measured positions and match the reference frame closely. In the
song, only the two-line "Collective Intelligence" draws; "Liminal Flow"
and "Syntropy" are absent.

Ruled out: model state (all three carry opacity 1, creation 1, correct
x/y/size at 884.2, all three reachable from `roots`, all three driven by
their own clips); stale bundle (re-scored against a freshly built
bundle — scores identical to four decimals); layout-key collision (the
song has 97 Text holons with many duplicate keys that all render).

HYPOTHESIS TESTED AND REFUTED (recorded, per the campaign's standing
instruction that a dissolved hypothesis is worth as much as one that
holds): every one of the deck's 91 text records carries
`lineSpacing: 1` and so passes a `lineHeight` to the shaper, while the
two failing labels were the only Texts in the film leaving it
undefined (`layoutText` omits the option when unset). Setting
`lineHeight: 1` on both — the deck's own value — changed NOTHING. Still
one label of three. The value is KEPT anyway, because matching the
deck's convention is right on its own terms.

What remains: the working label is the only one containing a NEWLINE,
which is the one branch (`centreLinesInPlace`) that single-line text
skips. Single-line centred text is also the path every deck label
takes, and those all render — but every deck label is a CHILD of a
Slide holon, while these three are staged as sibling roots. The
interaction of that difference with a 97-Text scene is not root-caused.

render/** is untouchable for this agent, so this is REPORTED, not
fixed. It costs deck 59 two of three reconstructed labels; the
translation half of the ruling and "Collective Intelligence" do land.

### HAZARD for the lead: key2ts.ts rewrites index.ts to ONLY the slides named

`bun scripts/key2ts.ts --slides N,M` regenerates
`vocabulary/Slides/assets/pl02/index.ts` containing ONLY the slides in
that run — it does not merge. The film needs all 59 emitted, so it must
be run as `--slides $(seq -s, 1 59)` (which trips the generator's
2048 KB budget warning at 2242 KB — accepted deliberately, the film
needs them).

This bit twice in one session: another agent regenerated the index at
20:07 with the older 50-slide set, dropping the nine slides the film's
uncovered decks need (20, 21, 26, 27, 28, 39, 40, 41, 42) and breaking
the bundle build. The slide MODULES survive a regeneration; only the
index loses its exports, so the repair is to re-add the export lines.
Restored. The in-flight render was unaffected (its bundle had already
loaded).


## Resume instructions (machine-sleep insurance)

If the render died, restart it — the script overwrites from f00000, so
nothing needs deleting:

    cd core && bun scripts/.render-song.tmp.ts pl02 \
      <scratchpad>/pl02-frames --fps 30 --port 4661

That scratch copy exists because the REPO's `scripts/render-song.ts`
navigates with `waitUntil: "networkidle0"` and a 30 s timeout, and this
scene reaches neither (it never idles, and boots in ~45 s). Same for
`scripts/pl02-gauntlet.ts` -> `scripts/.song-gauntlet.tmp.ts`. Both
scratch copies must be DELETED before finishing; the repo's scripts are
untouched.

A dev server must be up on the port: `bun scripts/serve.ts 4661`.

Then assemble with `<scratchpad>/assemble.sh` (the video01/origins
recipe: 30fps h264 yuv420p for ours; hstack ours-left/original-right at
2560x720 with the reference's own audio, both fps-filtered to 30).

### Everything already banked

- `core/demo/pl02/ProjectLiminality.ts` + registry `pl02` — 903.4s
- `core/test/pl02-song.test.ts` — 16/16
- `docs/reports/pl02/ProjectLiminality-assembly.md` — the report, needing
  only the render stats and the sync verdict
- spot-scores: `<scratchpad>/seg2/` (60 segments) and
  `<scratchpad>/songfull/` (86 frames incl. every chapter's own)
