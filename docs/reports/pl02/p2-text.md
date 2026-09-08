# P-2 — the face, and slide text at fidelity

Chapter P-2 of the PL02 campaign: the last 4.6% of the title card, and
the text machinery every later chapter sits on.

**The gates are met, on three frames.** The title card's WHOLE FRAME —
geometry and type together — scores `coverage_ref 0.9986 /
coverage_ours 0.9757`, `chamfer_ours 0.474 px / chamfer_ref 0.109 px`
against `refs/pitch/pl02/frames5/f_04510.jpg`, up from P-1's
0.848 / 0.902 FAIL. Deck slide 5 (five text records against two shapes —
the deck's most nearly pure type page) scores **1.000 / 0.9853**, and
deck slide 32 (three sizes including a two-line record) **0.9973 /
0.9655**.

The face is HelveticaNeue-Bold, and getting it was only half of it: the
other half is the deck's own `tracking: -0.02`, hiding in the theme
stylesheet, worth 30 px of word width. §2.

| artifact | what |
|---|---|
| `p2-title-f_04510-composite.png` | the title card whole-frame, **PASS 0.9986/0.9757** |
| `p2-title-f_04510-report.json` | its metrics |
| `ours-p2-title-f_04510.png` | the render |
| `p2-slide05-f_00541-composite.png` | deck slide 5, **PASS 1.000/0.9853** |
| `p2-slide05-f_00541-report.json` | its metrics |
| `p2-slide32b-f_02851-composite.png` | deck slide 32 — the MULTI-LINE proof, **PASS 0.9973/0.9655** |
| `p2-slide32-f_02826-composite.png` | the same slide before its label's build fires — see §4 |

## 1. The font decision

**The face is HelveticaNeue-Bold, extracted at build time from this
machine's own system collection, with a vendored fallback to Arimo.**
Option (a) of the brief, and it landed without needing (b) or (c).

### Why it is legitimate

Apple's fonts are proprietary — licensed for use on the machine that
ships them, not for redistribution — so they cannot be committed to a
public repo, and no framing changes that. But nothing stops the machine
that holds the licence from reading its own installed font. So:

- `/System/Library/Fonts/HelveticaNeue.ttc` is read at build time by
  `core/scripts/system-font.ts`;
- the face is written to `refs/fonts/`, which `.gitignore` already
  excludes (line 20, "large reference material") — the shelf for things
  that exist on David's machine and are not the repo's to give away;
- nothing Apple wrote enters git, and `git check-ignore` confirms it.

The repo stays reproducible for everyone else because the fallback is a
real path, not a crash: **verified by hiding the cache and re-scoring**.
With `refs/fonts/` moved aside the title card still renders, in Arimo, at
`coverage_ref 0.8168 / coverage_ours 0.8809` — a FAIL on fidelity, a
success on booting. `core/demo/fonts/README.md` states that difference
with these numbers in it.

### Why an extraction was needed at all

`three-text` cannot consume a `.ttc` — two independent reasons, both read
out of `node_modules/three-text/dist/index.js`:

1. its `FontLoader` accepts only sfnt signatures `0x00010000` and
   `OTTO`, and a collection signs `ttcf`;
2. it calls `hb.createFace(fontBlob, 0)` with the face index hardcoded,
   and face 0 of HelveticaNeue.ttc is **Regular** where the title card
   wants **Bold** (index 1).

Rather than patch a dependency, `core/src/render/ttc.ts` unpacks one face
into an ordinary single-face `.ttf` that every consumer already
understands. It is a repack, not a re-encoding — the table bodies are
copied verbatim, the directory is renumbered, tables are 4-byte aligned
and `head.checkSumAdjustment` is recomputed over the finished file. Three
things pin that it is a real font and not a plausible one:

- the extracted `glyf` table is **byte-identical** to the same range in
  the collection (test);
- the file checksum closes to the spec's `0xB1B0AFBA` (test);
- **CoreText accepts the file**, returning exactly one font descriptor
  from `CTFontManagerCreateFontDescriptorsFromURL` — macOS's own parser,
  not ours, agreeing that it is a valid single-face font.

Extraction is deterministic (same collection, same index, same bytes —
pinned by test), which is what lets `refs/fonts/` be a cache rather than
a build step.

Options (b) and (c) were not needed and are recorded as not-taken:
TeX Gyre Heros and Nimbus Sans clone **Helvetica**, not Helvetica *Neue*,
so adopting one would have swapped a measured approximation for an
unmeasured one; and a per-slide tracking correction is a fit in the
DECISIONS sense, tuned per string.

## 2. The tracking — and it is derived, not fitted

Getting the face right was **not enough**, and the way it failed is the
most useful thing in this chapter.

With HelveticaNeue-Bold loaded, the title card's vertical was already
exact — cap height 57 px against the reference's 57, baseline row 578
against 577 — and the word was **640 px wide against the reference's
610**. Wrong by 5% in the *other* direction from Arimo's 580. A face that
is right and a width that is wrong is a tracking problem, and the deck
says so:

    tracking: -0.02   kerning: 0.0   fontName: HelveticaNeue-Bold
    fontSize: 116     lineSpacing: 0.8

That is the resolved character-property chain for the storage holding
"Project Liminality". **It lives in the theme stylesheet, not in the
slide** (`DocumentStylesheet.iwa` carries `tracking` on its 116-pt
style; the slide archive has no tracking key at all), which is why it
arrives only through the decoder's merged style inheritance — and why the
recon never saw it. It is the only non-zero tracking in the whole chapter
set: regenerating slides 1-6 and 19 produced **exactly one changed line**
across all seven modules.

Applying it closes the card: 614 px against 610, with the right edge
landing on the reference's exactly (x 947 both). The residual four pixels
are on the left, and are the encode's own blur on the `P`'s stem.

Under the DECISIONS refused-fits rule this is a **derivation**: the value
is read out of the source and not tuned against the picture. The picture
then confirms it, which is the correct order.

Keynote's tracking and `three-text`'s `letterSpacing` are the same
quantity in the same units — extra advance after each glyph as a fraction
of the em — so it is a pass-through, not a conversion.

## 3. What was added, and what stayed untouched

All additive. Byte-identity for existing consumers is evidenced in §6.

| file | change |
|---|---|
| `core/src/render/ttc.ts` | **new** — the `.ttc` → `.ttf` sfnt repack |
| `core/src/render/fonts.ts` | **new** — `SYSTEM_FACES`, `fontChain`, the fallback rule. Pure: it is in the browser bundle, so it may not touch `node:fs` |
| `core/scripts/system-font.ts` | **new** — the extraction script (`--list`, `--all`, or named faces) |
| `core/src/render/text.ts` | `fontCandidates`, `layoutWithChain` (walks the chain, first that loads wins), `lineHeight` + `letterSpacing` pass-through, `loadedFaces()` |
| `core/src/parts/text.ts` | `lineHeight?: number`, `tracking = 0` on the `Text` holon |
| `core/vocabulary/Slides/Slides.ts` | `composeText` now passes `fontName`, `lineSpacing` and `tracking` through |
| `core/demo/fonts/README.md` | the licensing arrangement and the measured fidelity cost |
| `core/test/fonts.test.ts` | **new** — 31 tests |
| `core/src/geometry/keynote.ts` | `tracking?` on `KeyText`; the `middle` branch of `textBaseline` corrected to centre the CAP BOX (§8) |

The cache probe is deliberately **not** a filesystem check. `fonts.ts`
runs inside the browser bundle, and a `node:fs` import there breaks the
build; more importantly a separate existence check would be a second
source of truth about a file the loader is about to fetch anyway. So the
chain is data, the walk is the loader's, and the only thing that decides
which face a run used is whether the fetch succeeded — reported by
`loadedFaces()` rather than assumed.

### Four edits inside P-1's area, and why

`tracking` had to reach the model layer, and the model layer is P-1's.
The edits are strictly additive and were reported to `p1-keynote` before
and after:

- `core/scripts/keydecode.py` — one line in `text_of()`:
  `"tracking": char.get("tracking", 0.0)`. `resolve_char_props` already
  merged it; only the emission was missing.
- `core/src/geometry/keynote.ts` — `tracking?: number` on `KeyText`.
  **Optional**, so a module generated before the field existed still
  typechecks.
- `core/scripts/key2ts.ts` — emits the line only when non-zero, so an
  untracked record produces the bytes it always did.
- the seven generated modules — regenerated; **one line changed**.

## 4. The three frames

### The title card (deck slide 1 / 19 / closing), f_04510

| | coverage_ref | coverage_ours | chamfer_ours | chamfer_ref | IoU | verdict |
|---|---|---|---|---|---|---|
| P-1 (Arimo) | 0.848 | 0.902 | 1.034 px | 1.349 px | 0.579 | FAIL |
| face only, no tracking | 0.9367 | 0.8745 | 1.317 px | 0.631 px | 0.634 | FAIL |
| **P-2 (face + tracking)** | **0.9986** | **0.9757** | **0.474 px** | **0.109 px** | 0.751 | **PASS** |

The middle row is worth keeping: the right face alone moved
`coverage_ref` up 9 points and moved `coverage_ours` *down* 3, because
the word was then too wide instead of too narrow. A single-number gate
would have called that progress; the pair caught it.

Landmarks against the reference:

| | reference | ours |
|---|---|---|
| word width | 610 px | 614 px |
| word right edge | x 947 | x 947 |
| cap height | 57 px | 57 px |
| baseline row | 577 | 578 |

### The generalization (deck slide 5), f_00541

Five text records against **two** shapes — the deck's most nearly pure
type page, so the score is carried by the letterforms rather than by
geometry. It exercises everything the card does not: the other face
(`HelveticaNeue` regular), two sizes at once (50 and 40), the `middle`
branch of `textBaseline` where the card takes `bottom`, and **zero**
tracking, where the card's −0.02 is the whole of its final 4.6%.

| | coverage_ref | coverage_ours | chamfer_ours | chamfer_ref | IoU | verdict |
|---|---|---|---|---|---|---|
| f_00541 (v 108.0s) | **1.000** | **0.9853** | 0.634 px | 0.002 px | 0.775 | **PASS** |

`coverage_ref 1.000` is every pixel of the reference's ink covered, and
`chamfer_ref` is **0.002 px** — the reference's letterforms sit on ours.
The remaining 1.5% the other way is the antialiasing shoulder: our ink
runs a few pixels wider than the reference's, symmetrically about the
same centre, which is the edge and not a metric.

**This paragraph originally claimed 0.9028, and blamed all of it on the
shoulder. That was wrong, and the way it was wrong is worth keeping.**
It asserted "baselines agreeing exactly (row 592 for both lower labels,
379 for both Story's)" — but 592 and 379 are the bottoms of the
DESCENDERS (`g` in "Being", `y` in "Story"), not the baselines. Measuring
a descender-free glyph instead puts the baseline at 587 and 372, and ours
was **3 px high** on every middle-aligned record. The shoulder was real;
it was simply not the whole story, and a measurement taken on the wrong
row agreed with the wrong formula. P-5 found the cause independently
(§8), and the corrected numbers are the table above.

The reference frame is measured, not chosen: segment 5's animation events
end at 99.6s and the next begins at 116.2s
(`analysis/events.json`), so 108.0s sits in the middle of a 16.6-second
settled hold.

**Horizontal alignment is not varied here, because the deck does not vary
it** — all 91 text records in slides 1-58 are centred. Staging a
left-aligned label to exercise the branch would be inventing content.
`textAnchorX`'s left / right / justify branches are pinned by unit test
instead.

### The multi-line proof (deck slide 32), f_02851

Slide 32 carries the deck's `MonoLogos\nNode` — a two-line record, which
routes through the line-height and per-line centring neither frame above
touches. It was unscoreable when this chapter started (§5); with P-1's
group fix landed it scores:

| | coverage_ref | coverage_ours | chamfer_ours | chamfer_ref | IoU | verdict |
|---|---|---|---|---|---|---|
| f_02851 (v 570.0s) | **0.9973** | **0.9655** | 0.588 px | 0.046 px | 0.809 | **PASS** |

All three text records land yellow, including the two-line one, at three
sizes (37 / 36 / 30) with `lineSpacing` 1.0 and no tracking. The residual
green is the antialiasing shoulder plus a small shape detail on two head
icons, which is not type.

**Why f_02851 and not f_02826.** The first frame chosen was 565.0s, in
the middle of the segment's measured settled hold — and it scored
`coverage_ours 0.7738` while `coverage_ref` was already 0.997. The cause
is not placement: "MonoLogos Node" is **absent from the reference at that
frame**. Probing the label's band across the segment, the reference has
zero ink there at t=557.8, 559.8, 563.8 and full ink by t=569.8, so a
build fires at ≈567s. The Slide holon draws its whole page at
`creation = 1`, so it was showing a label the footage had not built yet.
That is a TIMING gap and P-3's subject (`dissolve character`), not a text
one, and the fix was to score after the build rather than to adjust
anything. Both frames are kept: the 2826 composite is what an unbuilt
label looks like, and future chapters will meet it often.

## 5. An importer bug, found and fixed by P-1 mid-chapter

Deck slide 32 could not be scored at all when this chapter started.

**Group children are stored RELATIVE to their parent group, and groups
nest.** `p1-importer.md` §1 stated the opposite ("Keynote stores group
children in absolute canvas coordinates, so a group carries identity but
no transform"); the title slide has zero groups, so P-1's gate never
exercised the claim. Slide 32 disproves it:

    4762951  TSD.GroupArchive       parent=KN.SlideArchive   pos=(747.03, 461.80)
    4763187  TSWP.ShapeInfoArchive  parent=TSD.GroupArchive  pos=(  0.00, 102.43)
    4762952  TSD.GroupArchive       parent=TSD.GroupArchive  pos=(173.91,  90.40)
    4763177  TSWP.ShapeInfoArchive  parent=TSD.GroupArchive  pos=( 10.97,   0.00)

A shape at (0.00, 102.43) absolute would sit on the canvas's left edge;
nothing on that slide does. Confirmed independently against the footage:
the "InterLogos" text box (5688067, geometry (118.41, 121.54)) has parent
group 5688069 at (841.59, 773.70), and the sum (960.00, 895.24) is dead
centre horizontally on the 1920 canvas — exactly where reference frame
f_02826 draws it. Our render puts it in the top-left corner.

Scored, before the fix: `coverage_ref 0.2916 / coverage_ours 0.2769`,
chamfer ~10 px — the whole tableau collapsed toward the origin, with only
the two ungrouped cone lines landing.

**Reported to `p1-keynote` with the evidence, and fixed the same
session.** `walk()` now accumulates every enclosing group's position, so
consumers see plain canvas coordinates. One caution was passed along —
that group `size` does not always match the child extents, so a scale
might be hiding behind the translation — and P-1 answered it with
evidence rather than assumption: all 217 naive box mismatches across the
deck's 678 groups are STALE BOXES (children already at natural size;
rotated legs whose zero-height boxes do not bound their ink), no group
carries an angle, and translation is the whole of it.

The same slide now scores 0.9973 / 0.9655 (§4). Its scene
(`core/demo/pl02/StoryPlaceSlide.ts`, registered as `slide32`) stays as a
live regression target for the grouped path.

## 6. Gates

- `bunx tsc --noEmit` — **clean**.
- `bun test` — **1123 pass, 0 fail** (31 of them this chapter's; the
  baseline keeps rising as other chapters land tests, which is why the
  count is quoted with a date rather than a delta from P-1's 999).
- **S04 gauntlet — 6/6 PASS**, mean coverage ref **0.9946** / ours
  **0.9954** — identical to P-1's numbers to four decimals.
- **Byte-identity for existing text consumers.** The demo bundle was
  built from the pre-change tree (source stashed), o07 captured at
  t=3.0 and o08 at t=20.0; the tree was restored, rebuilt, and both
  recaptured. `cmp` on both pairs: **byte-identical**. o07 is the mono
  panel — the one consumer that reaches the font resolver by alias —
  and o08 t=20 is the multi-line centring path.
- **The fallback renders.** With `refs/fonts/` moved aside the title
  card still boots and draws, at 0.8168 / 0.8809.

All of the above were re-run after §8's baseline correction, and after a
full `--decode` regeneration from the .key archives (which reproduced
every generated module byte for byte).

## 7. What P-3 inherits

- **Type is done.** Face resolution, box alignment, padding, line
  spacing and tracking all read from the deck's records and land on the
  footage. A later slide needs no text work — it needs its module
  generated (`bun core/scripts/key2ts.ts --slides N`) and a scene.
- **Run the extraction once per machine**:
  `bun core/scripts/system-font.ts --all`. Without it every scene still
  renders, in Arimo, and every fidelity number drops ~15 points. A
  report quoting a number should say which face it got —
  `loadedFaces()` answers that.
- **Grouped slides work now** (§5 — P-1 fixed the transform during this
  chapter), which unblocks P-4's campfire and social-organism family and
  most of the deck from slide 20 on.
- **A held page will over-draw an unbuilt label.** `Slide` renders its
  whole page at `creation = 1`, so scoring a frame BEFORE one of its
  builds fires costs `coverage_ours` and nothing else is wrong — §4's
  f_02826 is the worked example. Until P-3 lands the builds, pick a
  reference frame after the segment's last event, not merely inside a
  motion-free hold: the two are not the same thing, because a label that
  fades in over 1.0s can sit below the motion scan's threshold.
- **Watch the coverage PAIR, not either number.** Two cases in this
  chapter turned on it: the right face alone raised `coverage_ref` 9
  points and LOWERED `coverage_ours` 3 (§4), and the unbuilt label above
  showed 0.997 against 0.774.

## 8. A correction from P-5: the `middle` branch was descent/2 high

**Applied after this chapter's first close, and it improves both of §4's
middle-aligned frames.** Found by `p5-chains` against their chain slides,
reproduced independently here before applying.

`textBaseline`'s `middle` branch centred the CAP-PLUS-DESCENT block on
the box. Keynote centres the **cap box alone**. For one line the two
differ by exactly `descent / 2` — an identity at every size, not an
approximation — so every middle-aligned label sat 2-5 px high, growing
with the point size.

The measurement, five texts across three slides and four point sizes,
taken as the bottom ink row of a **descender-free glyph** in the
1280×720 frame:

| text (glyph) | size | box y | cap+descent | cap box | measured |
|---|---|---|---|---|---|
| DiaLogos (D) | 70 | 126.408 | 95.99 | **100.93** | 101 |
| Location A (L) | 30 | 647.701 | 436.82 | **438.94** | 439 |
| non-contextual (n) | 30 | 694.692 | 468.15 | **470.27** | 470 |
| Story (S) | 50 | 540.000 | 368.37 | **371.90** | 372 |
| Dead Thing (D) | 40 | 866.000 | 584.03 | **586.85** | 587 |

The first three are P-5's; the last two are this chapter's own slide 5,
measured here as an independent check. Cap box within 0.3 px on all
five.

The effect on §4's frames — the title card is unmoved, because it is the
deck's one `bottom`-aligned record and that branch did not change:

| frame | coverage_ours before | after | chamfer_ref before | after |
|---|---|---|---|---|
| title card f_04510 | 0.9757 | 0.9757 | 0.109 px | 0.109 px |
| slide 5 f_00541 | 0.9028 | **0.9853** | 0.032 px | **0.002 px** |
| slide 32 f_02851 | 0.9364 | **0.9655** | 0.049 px | 0.046 px |

Slide 32 carries the deck's `MonoLogos\nNode`, so the multi-line middle
case improved too — but at one line spacing only, which is why the
multi-line rule is marked DERIVED-not-yet-measured in the function's
header rather than claimed.

### Two lessons, and the second is the one that generalizes

**A gate validates only the branches its own slide uses.** The title card
is the deck's ONE `bottom`-aligned text; the census across the shipped
modules is **1 bottom, 43 middle**. So P-2's 0.4 px verification was of
the branch 43 of the 44 records do not take, and `middle` never met a
reference frame until P-5's slides put nine labels in front of it. This
is the same shape as P-1's closing lesson, landing for the third time.

**A test that restates the implementation gates nothing.** P-2's own
`middle` test asserted `(top+bottom)/2 − (cap+descent)/2 + cap` — the
formula, copied. It passed throughout, and could not have failed. It is
replaced by two that can: the footage table above, and an identity check
that the two formulas differ by `descent/2` at every size the deck uses,
which is what would catch the descent creeping back in.
