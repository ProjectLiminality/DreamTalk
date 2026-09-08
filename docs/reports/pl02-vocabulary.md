# PL02 Vocabulary Report — "Project Liminality" (2023-02-15, 15:04)

Reconnaissance for the corpus-#02 reproduction chapter, opening the TRIO
campaign. Everything the builder agents need without re-deriving it.

**The headline, and it inverts the brief**: this video contains **no pydeation
at all**. It is **100% Keynote, end to end** — 903.4 seconds, 58 slides, zero
imported symbol renders, zero external footage, zero photos. And the deck that
made it **survives on this machine with full vector geometry**, so the video
that was supposed to be the "purely visual, training-wheels-off" benchmark is
in fact the most completely source-backed video in the corpus so far — more so
than #09, whose SVG assets had to be recovered from a preferences folder.

The methodological consequence is the opposite of what the campaign assumed.
Origins (#09) was pydeation-with-source; #02 was expected to be
Keynote-by-eye. It is Keynote-with-source. The wheels do not come off here.
They come off at #03 or #05 — **and this report's §3 says how to find out
cheaply**, because the same deck-hunting method that worked here is a
five-minute check for those.

**Sources analyzed** (read-only):

- `refs/pitch/videos/PL02_ProjectLiminality.mkv` — 720p h264/opus, 903.488s.
- `refs/pitch/pl02/frames5/f_00001..04517.jpg` — 5 fps ground truth
  (`f_N` ≈ t = (N−1)/5 s), 168 MB. Full-video luminance/ink scan, motion
  scan, and ~120 frames viewed.
- `refs/pitch/pl02/audio.m4a` + `refs/pitch/pl02/narration.srt` — the
  narration, transcribed (whisper-tiny; good enough to align beats, not a
  publication transcript).
- **`/Users/davidrug/RealDealVault/ProjectLiminality/ProjectLiminalityLogo/ProjectLiminality Pitch.key`
  — THE PRODUCTION DECK** (13.3 MB, 88 slides, slide thumbnails stamped
  **2023-02-13/14**, the day before the upload). Copied unpacked to
  `refs/pitch/pl02/key/`, decoded to YAML with the already-installed
  `keynote-parser` (see §2 for the identification proof).
- `refs/PydeationProjects/pitch/InterfaceGuy/seed/seed.py` — the campaign's
  #02 lead. **Refuted**: it belongs to #09, not #02 (§3).
- `refs/pitch/Key2SVG/` — still the empty stub (`Key2SVG.py` is 0 bytes).
  Irrelevant now: `keynote-parser` does the job it was going to do, better.

## 0. Timing model (measured — there is no declared timeline)

Unlike #09, whose `pitch.py` declares its own timeline through `audio(offset=)`
calls, **this deck declares durations but not pacing**. Every one of the 413
build events has `isAutomatic` and `automaticDelay` absent, i.e. Keynote's
default: **advance on click**. The video was recorded by David clicking
through the deck while narrating. So the *shape* of each animation is in the
file (exact) and the *moment it fires* is not (it is in the footage only).

Per the DECISIONS refused-fits rule (2026-09-07): a quantity that exists only
in the footage is **MEASURED, and that is measurement, not fitting**. Every
timing number below is measured from `frames5`; every duration and easing
number is read from the deck.

### What the deck declares (exact, 58 slides)

| Transition | Count | Duration | Delay |
|---|---|---|---|
| `apple:magic-move-implied-motion-path` | 41 | **2.0s** | 0.5 |
| `apple:magic-move-implied-motion-path` | 3 | 1.5s | 0.5 |
| `com.apple.iWork.Keynote.BLTFadeThruColor` | 5 | 1.5s | 0.5 |
| `com.apple.iWork.Keynote.BLTFadeThruColor` | 4 | 2.0s | 0.5 |
| `none` (hard cut) | 5 | 1.0s | 0.5 |

Timing curve on every Magic Move: `TransitionCustomAttributesTimingCurveTypeEaseInEaseOut`.
Unmatched objects: `customMagicMoveFadeUnmatchedObjects: true`.
Text delivery: `…TextDeliveryTypeByObject`.

413 builds across the 58 slides, all with `delay: 0.0`:

| Build effect | Count | Durations seen |
|---|---|---|
| `com.apple.iWork.Keynote.LineDrawForLine` | 144 | **2.25s** ×70, 2.0s ×37, 0.5s ×28, 1.0s ×7 |
| `apple:dissolve character` | 119 | 1.0s ×104, 2.0s ×15 |
| `apple:dissolve` | 103 | 1.0s ×53, 0.3s ×35, 0.5s ×15 |
| `apple:action-motion-path` | 19 | 1.0s |
| `apple:bc-appear` | 7 | 1.0s |
| `apple:fade and move character` | 5 | 2.0s |
| `apple:action-scale` | 5 | 1.0s |
| `apple:fade and move` | 5 | — |
| `com.apple.iWork.Keynote.LineDraw` | 4 | 2.0s |
| `apple:appear` | 2 | — |

`LineDrawForLine` is Keynote's stroke-draw-on: **this is `Create`/`Draw`,
reimplemented in Keynote**, and it is the single dominant build in the video.
`dissolve character` is per-glyph text fade — Keynote's `Write` analogue,
though a fade rather than a domino outline-then-fill.

### What the footage measures

- **89% of the video is a still frame.** A frame-to-frame motion scan
  (160×90 grayscale, threshold 0.0015) finds 4,021 of 4,517 frames with no
  change at all.
- At a sensitivity that catches the subtle builds (threshold 0.0005),
  **141 discrete animation events** occupy **155s (17%)** of the runtime;
  median event 1.0s.
- Holds between events: median **6.2s**, mean 9.8s, max 51.2s.
- The 413 declared builds compress to 141 visible events because David
  click-advances *build chunks* — many builds fire together on one click.

**The reproduction consequence**: this is not an animation to be re-timed
against a soundtrack. It is a **slideshow of 58 held tableaux**, each punctuated
by a handful of short builds, with the narration carrying the pace. A
reproduction gets the geometry and the build shapes from the deck, and the
59 segment boundaries plus the 141 event onsets from `frames5`.

### Slide-to-video alignment (the identification proof, §2)

Every frame was correlated against all 83 slide thumbnails (64×36 grayscale,
mean-centred normalised correlation), then resolved to a **monotone
non-decreasing** slide path by Viterbi. The result covers **all 903.4 seconds
with 59 contiguous segments and no gaps**, and the slide index never goes
backwards. That is the proof: a deck that was not the source could not tile
the whole runtime in its own stored order.

## 1. The segment table

Production technique for every segment is the same — **(a) Keynote slide
material** — so the classification column the brief asked for is degenerate.
It is replaced by the deck facts. `sh/cn/gr` = shapes / connection-lines /
groups on that slide. "ev" = measured animation events in that window.

| Slide | Video (s) | Dur | Transition IN | Builds | ev | sh/cn/gr | Text on slide |
|---|---|---|---|---|---|---|---|
| 1 | 0.0–0.6 | 0.6 | cut | 0 | 0 | 4/0/0 | Project Liminality |
| 2 | 0.6–20.2 | 19.6 | MagicMove 2.0 | 13 | 7 | 4/4/0 | Catalyse Cultural Enlightenment by Upgrading Logos |
| 3 | 20.2–45.8 | 25.6 | MagicMove 2.0 | 5 | 3 | 5/1/0 | Story |
| 4 | 45.8–98.0 | 52.2 | MagicMove 2.0 | 4 | 1 | 9/0/0 | Story; Dead Thing; Living Being |
| 5 | 98.0–119.4 | 21.4 | MagicMove 1.5 | 3 | 2 | 7/0/0 | Story; Dead Thing; Living Being |
| 6 | 119.4–134.8 | 15.4 | FadeThru 1.5 | 0 | 1 | 5/0/0 | Story = Being; Liminality |
| 7 | 134.8–162.8 | 28.0 | MagicMove 2.0 | 10 | 4 | 12/0/1 | — (campfire) |
| 8 | 162.8–171.2 | 8.4 | FadeThru 2.0 | 10 | 1 | 60/10/21 | — (5 campfires, dashed mesh) |
| 9 | 171.2–193.8 | 22.6 | MagicMove 2.0 | 18 | 6 | 13/15/1 | Social Organism |
| 10 | 193.8–199.4 | 5.6 | MagicMove 2.0 | 3 | 2 | 23/30/4 | Social Organism; Biological Organism |
| 11 | 199.4–214.4 | 15.0 | FadeThru 2.0 | **105** | 17 | **140/70/105** | — (field of micro-organisms) |
| 12 | 214.4–217.0 | 2.6 | MagicMove 2.0 | 0 | 1 | 13/30/3 | — |
| 13 | 217.0–219.4 | 2.4 | MagicMove 1.5 | 0 | 0 | 15/30/3 | — |
| 14 | 219.4–227.0 | 7.6 | FadeThru 1.5 | 0 | 2 | 15/30/5 | — (two organisms, ⇔) |
| 15 | 227.0–263.0 | 36.0 | MagicMove 2.0 | 9 | 3 | 13/8/2 | Symbol → Symbol-System → Tele-Communication; non-contextual; non-local |
| 16 | 263.0–279.4 | 16.4 | MagicMove 2.0 | **50** | 3 | 28/24/1 | Social Machine |
| 17 | 279.4–362.0 | **82.6** | MagicMove 2.0 | 23 | 6 | 70/102/14 | — (tower→audience→mass-hypnosis/psychosis) |
| 18 | 362.0–369.4 | 7.4 | MagicMove 2.0 | 2 | 2 | 23/27/2 | Wisdom; Power |
| 19 | 369.4–375.2 | 5.8 | cut | 3 | 1 | 4/0/0 | Project Liminality |
| 20 | 375.2–428.2 | 53.0 | MagicMove 2.0 | 13 | 10 | 18/12/12 | Logos; MonoLogos; DiaLogos; InterLogos |
| 21 | 428.2–445.8 | 17.6 | FadeThru 1.5 | 1 | 2 | 13/8/5 | MonoLogos; ABC… |
| 22 | 445.8–452.0 | 6.2 | MagicMove 2.0 | 0 | 1 | 13/0/6 | DiaLogos |
| 23 | 452.0–490.6 | 38.6 | FadeThru 1.5 | 0 | 2 | 11/0/5 | DiaLogos |
| 24 | 490.6–503.6 | 13.0 | FadeThru 1.5 | 4 | 2 | 12/10/7 | InterLogos; ? |
| 25 | 503.6–510.2 | 6.6 | MagicMove 2.0 | 0 | 1 | 5/0/4 | — |
| 26 | 510.2–517.6 | 7.4 | MagicMove 2.0 | 0 | 1 | 38/0/22 | — |
| 27 | 517.6–526.6 | 9.0 | MagicMove 2.0 | 3 | 1 | 39/2/22 | — |
| 28 | 526.6–539.6 | 13.0 | FadeThru 2.0 | 3 | 1 | 24/0/10 | Location A; Distance; Location B |
| 29 | 539.6–546.2 | 6.6 | FadeThru 2.0 | 1 | 1 | 14/8/2 | Symbol → Symbol-System → Tele-Communication |
| 30 | 546.2–553.8 | 7.6 | MagicMove 1.5 | 1 | 1 | 22/0/10 | — |
| 31 | 553.8–572.6 | 18.8 | MagicMove 2.0 | 4 | 2 | 21/0/10 | story = place; MonoLogos Node; InterLogos |
| 32 | 572.6–590.6 | 18.0 | MagicMove 2.0 | 0 | 1 | 8/0/1 | Liminal Wallet |
| 33 | 590.6–599.6 | 9.0 | MagicMove 2.0 | 2 | 1 | 13/0/5 | Liminal Wallet |
| 34 | 599.6–601.4 | 1.8 | MagicMove 2.0 | 0 | 1 | 13/0/5 | Liminal Wallet |
| 35 | 601.4–606.0 | 4.6 | MagicMove 2.0 | 2 | 2 | 11/0/2 | Liminal Wallet |
| 36 | 606.0–608.4 | 2.4 | MagicMove 2.0 | 0 | 1 | 11/0/2 | Liminal Wallet |
| 37 | 608.4–610.6 | 2.2 | MagicMove 2.0 | 0 | 1 | 10/0/2 | Liminal Wallet |
| 38 | 610.6–613.8 | 3.2 | MagicMove 2.0 | 1 | 1 | 8/0/6 | — |
| 39 | 613.8–618.6 | 4.8 | MagicMove 2.0 | 4 | 1 | 13/0/7 | — |
| 40 | 618.6–627.2 | 8.6 | cut | 7 | 1 | 11/2/6 | — |
| 41 | 627.2–639.4 | 12.2 | MagicMove 2.0 | 8 | 3 | 14/2/8 | — |
| 42 | 639.4–675.4 | 36.0 | MagicMove 2.0 | 10 | 5 | **105**/1/31 | Liminal Space; holographically interconnected fractal space; travel by zooming in |
| 43 | 675.4–690.6 | 15.2 | MagicMove 2.0 | 4 | 3 | 13/0/1 | Liminal Space / Physical Space; local / non-local; Biosphere / Noosphere |
| 44 | 690.6–710.6 | 20.0 | MagicMove 2.0 | 6 | 4 | 11/0/4 | MonoLogos; DiaLogos |
| 45 | 710.6–722.4 | 11.8 | MagicMove 2.0 | 4 | 2 | 25/0/18 | Liminal Web |
| 46 | 722.4–728.8 | 6.4 | MagicMove 2.0 | 2 | 2 | 25/0/11 | Liminal Web |
| 47 | 728.8–733.2 | 4.4 | MagicMove 2.0 | 4 | 1 | 26/0/22 | Liminal Web |
| 48 | 733.2–739.0 | 5.8 | MagicMove 2.0 | 3 | 2 | 28/0/15 | Liminal Web |
| 49 | 739.0–744.0 | 5.0 | MagicMove 2.0 | 2 | 1 | 26/0/15 | Video Chat; Liminal Wallet |
| 50 | 744.0–749.4 | 5.4 | MagicMove 2.0 | 2 | 1 | 30/0/16 | + Digital Sand |
| 51 | 749.4–765.2 | 15.8 | MagicMove 2.0 | 4 | 2 | 33/1/17 | Video Chat; Digital Sand; Liminal Wallet |
| 52 | 765.2–793.4 | 28.2 | MagicMove 2.0 | 3 | 1 | 34/2/18 | Video Chat; Digital Sand; Liminal Wallet |
| 53 | 793.4–816.0 | 22.6 | MagicMove 2.0 | 9 | 4 | 36/0/24 | Coherence Beacon |
| 54 | 816.0–827.8 | 11.8 | MagicMove 2.0 | 8 | 1 | 40/0/24 | Social Resonance Filter; Coherence Beacon |
| 55 | 827.8–846.8 | 19.0 | cut | 4 | 3 | 34/2/7 | Coherence Beacon |
| 56 | 846.8–851.0 | 4.2 | MagicMove 2.0 | 1 | 1 | 35/2/6 | Memetic Nomads |
| 57 | 851.0–861.0 | 10.0 | MagicMove 2.0 | 1 | 2 | 48/4/11 | intra-tribe / inter-tribe coherence; solves need for Gerardian scapegoating! |
| 58 | 861.0–893.8 | 32.8 | cut | **34** | 5 | 24/22/16 | Liminal Flow; Collective Intelligence; Syntropy |
| 1 | 893.8–903.4 | 9.6 | cut | 0 | 2 | 4/0/0 | Project Liminality (closing card) |

**Classification totals — the answer to the brief's central question:**

| Technique | Segments | Seconds | Share |
|---|---|---|---|
| **(a) Keynote slide material** | 59 | **903.4** | **100.0%** |
| (b) pydeation symbol renders imported as video | 0 | 0.0 | 0.0% |
| (c) external footage / photos / screen recordings | 0 | 0.0 | 0.0% |

Corpus #02's ⚠ in `CORPUS.md` ("pydeation + Keynote ⚠") resolves to
**Keynote only** — and its tier should move from T2 (symbol animation) to a
new reading: it is a *vector-slideshow* benchmark, not a symbol-animation one.

### Segment anatomy — the notable ones

**Slides 1 / 19 / closing (the title card).** Identical (thumbnail correlation
0.99999998). The Logo over "Project Liminality" in HelveticaNeue-Bold. Exact
geometry from the deck, canvas 1920×1080:

- main circle: position (730.4116, 205.50696), size 459.17673 →
  **centre (960.000, 435.095), r = 229.5884**
- small circle: position (810.99255, 208.0213), size 298.01483 →
  **centre (960.000, 357.029), r = 149.0074**
- two lines: length 340.53683 at 67.04865°, and 341.42834 at 113.560555°,
  starting (721.48285, 465.0141) and (855.5681, 465.01407)

**This is NOT the pydeation `Logo`, and the difference is measurable**:
r_small/r_main is **0.64902** here versus pydeation's **0.61**, and the
centre offset is **0.34003·r_main** versus pydeation's **0.36**. It is a
hand-redrawn Keynote approximation of the same mark. Cross-checked against
the footage: scaled to 720p the deck predicts blue r = 153.06 px and centre
y = 290.06; six averaged title-card frames measure **153.06** and **290.8**.
Sub-pixel agreement — which is simultaneously the deck-identification proof
and the warning that `core/vocabulary/Logo` (built from pydeation's numbers
in O-3) **must not be reused verbatim** for this video.

**Slide 2 (0.6–20.2s), the Vitruvian opening.** Vitruvian Man at centre,
four dotted `Connection`s radiating to an eagle, a tree, a sun and an apple,
with lightning glyphs on each. 13 builds, 7 measured events. The Vitruvian
figure is a single 42-element bezier path — a traced drawing, exactly the
`david.svg` situation from #09 but stored inside the deck.

**Slide 4 (45.8–98.0s), the longest single hold.** 52.2s with **one**
animation event. Two trees in tinted rings labelled "Dead Thing" / "Living
Being" under "Story". This is where the reproduction's fidelity target is
almost entirely *static composition*, not animation.

**Slide 11 (199.4–214.4s), the density peak.** 140 shapes, 70 connection
lines, 105 groups, **105 builds** — a field of ~14 miniature social organisms,
each itself a 7-node dotted mesh. 17 measured events in 15s: the fastest
stretch in the video. This is the stress test for whatever renders the deck.

**Slide 17 (279.4–362.0s), the longest segment.** 82.6s, 70 shapes,
**102 connection lines**. A broadcast tower fans dotted lines to a row of
seated figures; then three towers, cross-wired, with lightning between them;
"mass-hypnosis" resolving to "mass-psychosis" under a down-arrow. Six
measured events across 82.6s — long holds under narration.

**Slide 42 (639.4–675.4s), Liminal Space.** 105 shapes, 31 groups: a
self-similar fractal cone tree, three levels deep, each node a ring of
figures. The recursion is drawn out by hand in the deck (not generated), so
a reproduction can generate it and match.

**Slide 58 (861.0–893.8s), Liminal Flow.** 34 builds, the second-densest
build count. The mountain-with-horizon composition: a "Collective
Intelligence" ring rising through the horizon line, "Syntropy" curves, nodes
descending the slope. Note its thumbnail is a *mid-build* state, which is why
naive thumbnail correlation scores it low (0.29) — the deck's thumbnail is
not always the final frame, and any future matcher must expect that.

### The deck's own asset vocabulary — 24 named icons, 613 instances

These are **Keynote's built-in shape library**, referenced by `localizationKey`,
each carrying its own full bezier path inside the deck file:

| Icon | Instances | Path elements |
|---|---|---|
| Head with Shoulders_826 | 232 | 27 |
| Head_652 | 132 | 20 |
| Fire_80 | 67 | 14 |
| Man_83 | 39 | 82 |
| Lotus_615 | 25 | 92 |
| Cylinder_563 | 23 | 16 |
| Notebook_109 | 22 | 25 |
| Radio Tower_245 | 17 | 109 |
| Man Walking_681 | 12 | 108 |
| Tree_70 | 6 | **363** |
| Stethoscope_317 · Cash_250 · Light Bulb_270 · Dodecahedron_956 | 5 each | 86 / 40 / 43 / 77 |
| Book_381 | 3 | 17 |
| Eagle In Flight_839 · Sunburst_304 · Apple_141 · Neuron_815 · Cell_302 · Bacteria_814 | 2 each | 90 / 41 / 18 / 258 / 187 / **787** |
| Sitting Cat_906 · Music Note_217 · Game Controller_92 | 1 each | 41 / 26 / 73 |

Overall the 58 slides carry **1,378 shapes** (1,346 with paths), **517
connection lines**, **676 groups**, and only **29 images** — i.e. the deck is
overwhelmingly vector, which is why a reproduction is feasible at all.

### Typography and palette

- Fonts: **HelveticaNeue** (regular, `-Medium`, `-Bold`). One stray `Helvetica`.
- Sizes present in the theme stylesheet: 50, 24, 32, 34 dominate; 116 for the
  title card.
- The video's measured saturated palette quantises to blue ≈ **#00A1FF** and
  red ≈ **#EE220C** — the deck's stylesheet carries exactly those two, and
  they are pydeation's BLUE/RED. Body line-work is **#FFFFFF**, with
  **#A9A9A9** for the dimmed/secondary state (the greyed labels visible in
  e.g. slides 15 and 29).
- Stroke widths in use: 1.0, 2.0, 3.0, 4.0, 6.0 (and 0.5/0.75 for hairlines).
- Dotted lines are a real stroke pattern (`TSDPattern` with a (0.001, 2.0)
  dash array — the fine dotted mesh; and (6.0, 6.0) for the coarse dashes).

## 2. Identification proof — why this deck is the source

Four independent lines, any one of which would be suggestive; together they
settle it:

1. **The deck's own preview image is the video's first and last frame** —
   the Logo above "Project Liminality", pixel-for-pixel the title card.
2. **Slide thumbnails are stamped 2023-02-13 and 2023-02-14**, one day before
   the 2023-02-15 upload. (Older thumbnails from 2020–2022 also exist in the
   file: the deck was assembled from earlier material and extended later.)
3. **Monotone tiling.** Correlating all 4,517 frames against all 83 slide
   thumbnails and resolving a non-decreasing path covers **all 903.4s in 59
   contiguous segments**, slides 1→58 in the deck's own stored order, ending
   on the title card. Fifty-two of the 58 segments correlate above 0.80 at
   their best frame; the six that do not are all long-build slides whose
   thumbnail is a mid-build state (§1, slide 58).
4. **Sub-pixel geometry agreement.** The deck's title-slide circle geometry,
   scaled 1920→1280, predicts blue r = 153.06 px; the footage measures
   153.06 px (six-frame average). Independent of the correlation method.

**A caution for reuse**: the deck now on disk is **not frozen at Feb 2023**.
Slides 59–83 are later additions (bullet-list slides — "How?", "What?",
"Block Protocol Node", "Interaction Topology" — with thumbnails as late as
2023-10-21) and appear nowhere in the video. Under the canon policy
(DECISIONS 2026-09-07: *the published video is the canon; source-only material
is experiment*) **slides 59–83 are out of scope entirely**. Reproduce slides
1–58 and the closing card, nothing else. Whether slides 1–58 were also edited
after the recording is not knowable from the file; the frame agreement in
§1/§2 says they were not edited in any way that moved geometry.

## 3. Source-lead verdicts

**`seed/seed.py` — REFUTED. It belongs to #09, not #02.** Two independent
disproofs:

- *Content*: seed.py's six scenes are the 7-node kinship graph → shapes →
  eyes (Scene01, a near-verbatim precursor of `pitch.py`'s Scene01), a
  three-segment `Arc(mode="ring")` pie twice, a `System`+`Logo` scene, and a
  `Tree` with a "Project Liminality" title. **None of it is in this video** —
  the video has no pie, no kinship graph, no Tree-with-title, and its complete
  48-string text corpus (§4) contains none of seed's vocabulary.
- *Audio, decisively*: seed's `scene01_audio.m4a` transcribes to *"in my early
  childhood, a series of events started disrupting my social circles,
  fragmenting them into opposing camps… I discovered a completely novel
  approach… called dialectical thinking"* — that is the **Origins /
  Dialectical Thinking** narration. PL02's audio opens *"If you're watching
  this, chances are you have noticed that nearly all of the relationships
  humanity is involved in are wildly out of balance."* Different scripts.
  seed's six clips total 254.8s against this video's 903.4s.

So seed.py is an earlier draft of the **#09** lineage (or of an unmade
pydeation cut of the pitch), and `PLAN.md`'s "#02 lead: the local seed/
project" should be corrected to point at #09's family instead.

**The `.key` — FOUND, and it is the whole video.** `ProjectLiminality Pitch.key`
in `ProjectLiminalityLogo/`. Two decoys were checked and cleared first:
`PL Interface.key` (2023-01-29, a photo/screenshot deck — wrong content) and
`PL pitch deck.key` (2023-03-25, mostly dragged PDFs). A machine-wide
`mdfind` for Keynote documents surfaced ~40 candidates; date-ordering them
and inspecting the two nearest the upload found it.

**Other repos — nothing further.** `gh repo list InterfaceGuy` (200 repos)
and `ProjectLiminality` (40+) contain no repo matching this video's content;
the earliest InterfaceGuy repo after `PyTalk` (2022-02) is `Synergy`
(2023-10-23), eight months *after* this upload. `refs/pitch/pydeation-PL-pitch`
remains the 2022 sketch of a different script (already established in the
Origins report). `Key2SVG` is still a 0-byte stub, and is now moot.

**Method note for #03 and #05** — the same hunt is cheap and should be run
before either chapter is scoped. `mdfind "kMDItemKind == '*Keynote*'"`, sort
by creation date, and look at decks dated just before the upload; then
`keynote-parser unpack` (already installed at
`/Users/davidrug/.local/bin/keynote-parser`; its Python at
`/Users/davidrug/.local/pipx/venvs/keynote-parser/bin/python` also has PyYAML,
which the system python3 lacks — while system python3 has numpy/PIL, which the
venv lacks; the two halves of this analysis were split accordingly). Two
specific candidates already visible in the `mdfind` output:
`/Users/davidrug/SecondBrain/Attachments/Keynote/TheAgeOfMiracles.key`
(created 2023-05-31, **1.8 GB**) for corpus **#05** (uploaded 2023-08-16),
and the `PyTalk-CustodianOfTheNoosphere` repo lead for **#03** — but #03
should get the `.key` check too, since #02 proves the habit.

## 4. The complete text corpus (48 strings, all slides 1–58)

Every word that appears on screen, transcribed from the deck (not OCR):

`=` · `?` · `ABC…` · `Being` · `Biological Organism` · `Biosphere` ·
`Catalyse Cultural Enlightenment by Upgrading Logos` · `Coherence Beacon` ·
`Complexity` · `Dead Thing` · `DiaLogos` · `Digital Sand` · `Distance` ·
`InterLogos` · `Liminal Space` · `Liminal Wallet` · `Liminal Web` ·
`Liminality` · `Living` · `Location A` · `Location B` · `Logos` ·
`Memetic Nomads` · `Mission Statement` · `MonoLogos` · `MonoLogos\nNode` ·
`Noosphere` · `Physical Space` · `Power` · `Project Liminality` ·
`Social Machine` · `Social Organism` · `Social Resonance Filter` · `Story` ·
`Symbol` · `Symbol-System` · `Tele-Communication` · `Two Projects` ·
`Video Chat` · `Wisdom` · `holographically interconnected\nfractal space` ·
`inter-tribe\ncoherence` · `intra-tribe\ncoherence` · `local` ·
`non-contextual` · `non-local` · `solves need for\nGerardian scapegoating!` ·
`story = place` · `travel by zooming in`

(`Two Projects`, `Complexity` and `Mission Statement` are **slide-navigator
section names**, not on-screen text — they live in the title placeholder and
are not rendered. Do not draw them.)

## 5. What DreamTalk core is missing

Measured against `core/src/verbs.ts` (Create, UnCreate, Draw, UnDraw, Erase,
FadeIn, FadeOut, Move, Scale, Rotate, Fill, UnFill, ChangeColor,
DrawThenFillCompletely, UnFillThenUnDraw, UnDrawThenUnFill),
`core/src/parts/` (Stroke, Circle, Square, Polygon, **Arc**, **AnnularSector**,
Line, Rectangle, Ellipse, Cross, **DottedLine**, Group, Null, **Connection**,
Text with per-letter Write) and `core/vocabulary/` (Logo, Eye, Cylinder,
System, Morph, Sketch, …).

**The good news**: the O-1..O-11 campaign already built most of the *drawing*
vocabulary this video needs. Dotted splines, `Connection` with arrowheads,
`Arc`, `AnnularSector`, `Fill`/`ChangeColor`, `Text`+`Write` all exist.

**Blocking — the new capability class this video introduces:**

| Missing | Needed by | Notes |
|---|---|---|
| **Keynote `.key` → holon importer** | every slide | The single highest-value item, and it is *bounded*: `keynote-parser` already decodes the deck to YAML. What is needed is the mapping layer — walk `TSWP.ShapeInfoArchive` (path at `super.pathsource.bezierPathSource`, geometry at `super.super.geometry` — note the double nesting, it cost this recon a wrong turn), flatten cubic béziers to polylines, apply position/size/angle, and emit `Stroke`s. `TSD.GroupArchive` → `Group`, `TSD.ConnectionLineArchive` → `Connection`. This is the #02 analogue of #09's SVG importer, and strictly easier: the path mini-language is already parsed into typed `moveTo`/`lineTo`/`curveTo`/`closeSubpath` records, so there is no `d`-string parsing at all. |
| **Slide-canvas coordinate frame** | every slide | The deck is authored in a **1920×1080 y-down pixel canvas**, not pydeation's centred y-up world. Core needs a documented 2D slide frame (or an importer-side transform) so deck coordinates land unmodified. Every geometry number in this report is in that frame. |
| **`MagicMove` (matched-object transition)** | 44 of 58 transitions | The dominant transition and the video's signature move: Keynote matches objects by identity across two slides and interpolates position/size/rotation/opacity, fading unmatched ones (`customMagicMoveFadeUnmatchedObjects: true`), over 2.0s ease-in-ease-out. This is **not** the shape-to-shape `Morph` the Origins campaign built — it is a *scene diff* animation over a whole tableau. It is the one genuinely new animation concept in the video. |
| **`LineDrawForLine` (stroke draw-on with Keynote's parameterisation)** | 144 builds | Semantically core's `Create`, but the pacing is Keynote's, not pydeation's: a fixed per-object duration (2.25s dominant) rather than pydeation's normalized-time or `DrawSteady`'s arc-length rate. Worth a thin verb rather than reusing `Create`'s curve, so the reproduction can be scored. |

**Needed, smaller:**

| Missing | Needed by | Notes |
|---|---|---|
| **Text at slide scale, in HelveticaNeue** | ~40 slides | `Text` exists with per-letter `Write`, but the bundled face is **Arimo** (Helvetica/Arial-class) and `size` defaults to pydeation's 50. This video needs the deck's actual sizes (24/32/34/50/116 in the 1920-canvas) and, ideally, HelveticaNeue itself — the vocabulary report already flags the font question as an open Risk, and #02 makes it concrete. Also needed: **left/centre block alignment against a text-box rectangle** (Keynote lays text in a box; core anchors on a point). |
| **`dissolve` and `dissolve character`** | 222 builds | Whole-object opacity fade (core's `FadeIn`/`FadeOut` cover this) and **per-glyph opacity fade**. The latter is *not* core's `Write`: `Write` is a domino of outline-then-fill per letter, Keynote's is a plain per-character alpha ramp over 1.0s. A `DissolveCharacters` sibling to `Write`, sharing `writeWindows()`, is a few lines. |
| **`action-motion-path`, `action-scale`** | 24 builds | On-slide object motion along a path, and on-slide scaling — i.e. builds that move something already visible. `Move`/`Scale` exist as verbs; what is missing is the *build* framing (fire at a click, on one object within a held tableau). |
| **Dimmed-state colour `#A9A9A9`** | slides 15, 29, others | Not a capability gap so much as a palette constant: the greying-out of an earlier chain element is a `ChangeColor` to `#A9A9A9`, which should join the vocabulary's named colours. |
| **A "held tableau" scene model** | all | Core's scenes are continuous timelines. This video is 58 tableaux, 89% still, advanced by discrete clicks. Nothing is *missing* to express that (a sequence of waits), but the harness's scoring should know that most frames are static — a per-segment still-frame comparison is a far stronger and cheaper fidelity test here than the dense per-frame scoring used for #09. |

**Explicitly NOT needed** (the brief asked; the answer is no): image/photo
support (29 images in the whole deck, none load-bearing in slides 1–58);
video/screen-recording support; camera animation (the deck is 2D and the
camera never moves); 3D anything.

## 6. Proposed chapter plan

Ordered by difficulty, each chapter naming its new capability, each target
fully scoreable against `frames5` (per the canon policy, nothing outside
slides 1–58 is reproduced).

| Ch | Slides | New capability | Why here |
|---|---|---|---|
| **P-1** | — | **`.key` → holon importer** + slide coordinate frame | Pure infrastructure, no animation, no rendering. Fully specified by §1/§5; testable by round-tripping the title slide's four shapes against the numbers in §1 (which are already cross-validated against the footage to sub-pixel). Unblocks everything. |
| **P-2** | **1 / 19 / closing** | Slide-scale `Text` in the deck's face and sizes | The video's first and last frames, three shapes and a word. Settles the font question concretely. Note it must use the **deck's** logo ratios (0.649 / 0.340), *not* `core/vocabulary/Logo` — see §1. |
| **P-3** | **2–6** | `LineDrawForLine` + `dissolve` / `dissolve character` | The opening arc (Vitruvian → tree → Story → Dead Thing/Living Being → Liminality). Introduces the two build verbs that cover 366 of 413 builds, on slides with ≤9 shapes and no groups. Slide 4's 52s single-event hold is the gentlest possible timing target. |
| **P-4** | **7–10, 14** | `Connection` meshes + `Group` from the importer | The campfire and social-organism family: dotted many-to-many meshes over grouped icons. No new animation — it is the importer at moderate scale (13–60 shapes, 10–30 connections), proving groups and dotted patterns. |
| **P-5** | **15, 28, 29, 21–24** | `ChangeColor` to the dimmed `#A9A9A9`; the labelled-chain layout | Symbol → Symbol-System → Tele-Communication, and the MonoLogos/DiaLogos/InterLogos chain. Text-heavy, geometry-light; the greyed-state palette lands here. |
| **P-6** | **20, 25–27, 30, 31, 38–41** | **`MagicMove`** | The hardest verb, given its own chapter, on the run of slides where consecutive tableaux are near-identical and the matched-object interpolation *is* the content. This is the chapter that proves the transition model. |
| **P-7** | **32–37, 44–52** | `action-motion-path`, `action-scale`; nested UI composition | The Liminal Wallet / Liminal Web laptop sequences: many short segments (1.8–5.8s), 8–34 shapes, deep grouping. Reuses P-6's MagicMove heavily; adds the on-slide motion builds. |
| **P-8** | **42, 43, 53–57** | Recursive/fractal layout at scale | Liminal Space's 105-shape three-level fractal cone, plus the Coherence Beacon family (36–48 shapes, 24 groups). No new verbs — a composition and performance test. |
| **P-9** | **16, 17, 58** | Assembly / long-build choreography | The three build-heavy set pieces (50, 23 and 34 builds) including the 82.6s centrepiece. By construction needs no new capability; it is the integration test, and its measured event onsets are the finest timing target in the video. |
| **P-10** | **8, 11–13** | Density | Deliberately last: slide 11's 140 shapes / 70 connections / 105 groups / 105 builds in 15s is the performance ceiling, and 17 events in 15s is the densest timing in the video. Everything else must work first. |

**On fidelity targets**: because 89% of frames are static, score primarily by
**per-segment still-frame comparison** at the 59 boundaries in §1 (each
segment has a long settled hold — pick a frame ≥1.0s after its last event),
and secondarily by **event-onset timing** against the 141 measured onsets in
`refs/pitch/pl02/analysis/events.json`. Dense per-frame scoring buys little
here and costs a lot; that was the right tool for #09's continuous renders,
not for a slideshow.

**On refused fits**: build *durations* and *easing* are DERIVABLE (they are in
the deck — §0) and must be read, never fitted. Build *onsets* and segment
boundaries exist only in the footage (David clicking live) and are MEASURED —
admissible under the O-11 refined rule. Do not fit a duration to make an
onset land; fix the onset.

## 7. Artifacts on disk

| Path | Contents |
|---|---|
| `refs/pitch/pl02/frames5/f_00001..04517.jpg` | 5 fps ground truth, 168 MB |
| `refs/pitch/pl02/audio.m4a` | the narration track, 14 MB |
| `refs/pitch/pl02/narration.srt` | whisper-tiny transcript of the above |
| `refs/pitch/pl02/key/` | **the unpacked production deck** (Index/, Data/, previews), 13 MB |
| `refs/pitch/pl02/slides/s01..s58.jpg` | the 58 slide thumbnails, in show order |
| `refs/pitch/pl02/analysis/segments.json` | the 59-segment Viterbi alignment |
| `refs/pitch/pl02/analysis/segtable.json` | §1's table as data, with narration per segment |
| `refs/pitch/pl02/analysis/slidefull.json` | per-slide transitions, builds, texts, shape counts |
| `refs/pitch/pl02/analysis/geometry.json` | per-slide shape geometry (kind, x, y, w, h, angle, element count) |
| `refs/pitch/pl02/analysis/events.json` | the 141 measured animation-event windows |
| `refs/pitch/pl02/analysis/slides2.json` | slide id ↔ show order ↔ thumbnail map |
| `/Users/davidrug/RealDealVault/ProjectLiminality/ProjectLiminalityLogo/ProjectLiminality Pitch.key` | the original deck (untouched; **outside this repo**) |

Frames + audio + deck + slides = ~196 MB added. Disk after: 121 GB free.
The deck was copied, not moved; nothing outside `refs/pitch/pl02/**` and this
file was written.

## 8. Video URLs

| # | Title | URL |
|---|---|---|
| 02 | Project Liminality | https://www.youtube.com/watch?v=YsDNeH9JVV0 |
| 03 | The Custodian of the Noosphere | https://www.youtube.com/watch?v=125ihqgmicY |
| 05 | The Age of Miracles | https://www.youtube.com/watch?v=yrgSwgqclJU |
| 09 | The Origins of Project Liminality | https://www.youtube.com/watch?v=cmbjQVQ3nbs |

## Amendments (2026-09-08, P-1)

- **Slide indexing +1 from show position 18** — deck slide 4593439
  (unsuffixed Slide.iwa, no thumbnail) was invisible to the recon scan:
  every §6 chapter row from 18 onward names the deck slide AFTER the
  one it means (recon[17:57] == deck[18:58]). The "82.6s longest
  segment" is TWO slides (17: no text; 18: the mass-hypnosis pair, 46
  shapes, FadeThruColor + 5 builds — confirmed at f_01780). Corrected
  build total 1-58: 384.
- **Palette from the stylesheet, not the encode**: #00A2FF and #FF644E
  — constants.ts's BLUE and RED to the byte. The deck and the
  pydeation corpus share ONE palette.
- (2026-09-08, P-1 §1, RETRACTED SAME DAY) ~~The deck declares its
  cascades~~ — the `automatic` reading (147 declared vs 141 measured,
  4%) has the right TOTAL but the wrong local structure (slide 2's
  seven measured events fit `eventTrigger`, not `automatic`), while
  `eventTrigger` (378 declared) overshoots 2.7x deck-wide. The two
  fields disagree on 330 chunks — not two spellings of one fact.
  BOTH carried uninterpreted, a test pins the disagreement; resolving
  needs measured onsets WITHIN segments across several slides (P-3 or
  P-9). Click-onset timing remains footage-measured for now.
  Build order now comes from the slide's own builds list (a defensive
  sort was hiding it); `direction` carried uninterpreted (absent on
  114/158 LineDrawForLine builds — absence is the default; values
  51/52/53 observed); chunk and build durations agree in all 384 cases.
- (2026-09-08, P-1) **No per-character delivery exists in the video**:
  all 384 builds in slides 1-58 are `All at Once`, including all 121
  dissolve-character builds — the recon's 222-build DissolveCharacters
  expectation is VOID; the per-glyph alpha-ramp capability is owed to
  no chapter.
- (2026-09-08, P-1 §1 / P-3, correction 7) **Images exist and are
  load-bearing** — §5's "skipped, none load-bearing" is refuted by
  measurement (46.9% of one opening tableau's ink): 12 images inside
  slides 1-58, on four slides — 2 (five, incl. the 481×481 Vitruvian
  figure, the largest drawable on the opening tableau), 3 (one), 17
  (four), 18 (two). Those four slides carry a hard coverage_ref
  CEILING no stroke fidelity can lift. Image BOXES now ride in the
  model (SlideData.images) so masked scoring uses the deck's declared
  geometry, not a chosen crop; whether pixels import as textured quads
  is P-9's question. Reporting convention: unmasked whole-frame as
  headline, masked as what the builds did on the ink they own.
- (2026-09-08, P-1) **The images are LINE ART, not photographs** — the
  Vitruvian figure and its kin are white strokes on transparent alpha
  (RGB exactly 255,255,255, zero variance, 7.5-14% opaque): david.svg's
  exact case, traced drawings whose vector form lives outside the
  file. Only FOUR line-art files serve all 12 in-scope images. The
  image ceiling is therefore REMOVABLE: trace/source those four as
  paths through Sketch (all-strokes, draw-on preserved) rather than
  textured quads. Bounded work, queued for P-9's image-heavy slides.
  The stale-line recompute is independent of this (lines need only
  the image's geometry box, which is carried).
- (2026-09-08, P-4) **The clip rule is universal**: Keynote clips
  connection lines against the object's actual FLATTENED SILHOUETTE
  (no per-class table; the concave head icon proves it — dots in the
  shoulder notches, none in the head). Firing-model evidence: slide
  8's ten builds cascade from ONE click in chunk order (fits
  `automatic` there; slide 2 fits `eventTrigger` — the fields may
  each be right on different slides; still open). `direction: 53` is
  midpoint-outward draw. Segment boundaries corrected: 14 settles
  220.2-223.8 (not 227.0); 7 likewise re-measured (see p4 report).
  Slide 10 unscored on principle: its action-scale declares no
  factor, and scoring would fit an undeclared magnitude.
- (2026-09-08, P-5) **The dimmed palette is REFUTED at source** — the
  deck has EXACTLY four colours deck-wide (#FFFFFF 1655, #000000 413,
  #00A2FF 109, #FF644E 77; zero non-palette occurrences in 1841
  drawables, every opacity exactly 1.0). #A9A9A9 appears nowhere; no
  ChangeColor build exists anywhere in the deck. §5's grey was a
  MID-DISSOLVE FRAME: "Distance" caught ~6% into its declared 1.0s
  ramp, firing ~4s after its neighbours (measured; stroke-core scans
  across seven settled frames find no grey plateau). P-5 is the
  labelled-chain layout at scale — nothing new to build.
- (2026-09-08, P-5) **The firing model is SETTLED**: `automatic: true`
  fires ONE DECLARED DURATION after its predecessor; `automatic:
  false` waits for a click. Deck slide 15 is the discriminator (the
  only slide with both flag values): automatic gaps 0.995-1.008x the
  declared duration, manual gaps 2.5-10.9x — pooled with slides 2/8,
  20 automatic at mean 1.001x vs 4 manual, NO overlap. Slide 2 was
  never a counter-case: the flag means "fires without waiting for a
  click", not "fires WITH the predecessor". eventTrigger distinguishes
  nothing. Chunk order = firing order (one measured exception, deck
  25 chunk 4, pinned by test). Only true click onsets remain
  footage-measured.
- (2026-09-08, P-5/P-3) Segment boundary corrections: 15 settles
  225.2, out at 262.2; 28 settles 527.6, out at 538.8. ATTRIBUTION,
  FINAL (P-5's own 2x2 factorial, each variant fresh-built): the
  baseline fix contributes ALL cross-chapter gains (P-3 seg 6
  FAIL→PASS +0.116, P-4 slide 9 +0.024, P-2 slides +0.083/+0.029);
  the fills contribute 0.0003 on ONE frame. The SlideFill capability
  is REAL and TESTED AT SCALE (P-8, deck 43: 60 fills, 30 overlapping
  pairs) — fills genuinely hide what is behind them in the deck's own
  z-order, and hidden ink genuinely disappears. P-5's capability was
  sound; its EXTENT was a stroke-width too large in every direction
  (a fill triangulated to the stroke's own path covers the ribbon's
  inner half, and fills blend NORMAL where strokes blend MAX) — fixed
  by SlideFill.inset (winding-aware bisector offset by half the
  stroke), wrongly-hidden ink down 72%. Further insetting refused
  (monotone, no optimum = fitting; and AA is a SCREEN pixel, not
  world geometry). P-9/P-10's fills can be trusted.
- (2026-09-08, P-5) **The one systematic gap nobody owns: text strokes
  are FAT** — ink 1.3-2.28x the reference at the same threshold on
  text-dense tableaux. Geometry and type metrics are now right; the
  stroke weight caps coverage_ours on every text-heavy frame. Queued.
- (2026-09-08, P-7) **Firing-model refinement**: the delay an automatic
  chunk waits is its predecessor's EFFECTIVE duration — an instant
  build (bc-appear measures INSTANT against its declared 1.0s) waits
  zero (three isolated arrows, gap under one frame where the literal
  rule predicts a second). Second measured chunk-order exception:
  deck 53's two LineDraws LEAD the fade-and-move by 0.68s where the
  chunk list says they trail by 2.0s (joins P-5's deck-25 chunk 4).
- (2026-09-08, P-8) **Keynote's kEaseBoth is CSS ease-in-out
  (cubic-bezier 0.42, 0, 0.58, 1), NOT the framework's smooth
  (s=0.25)** — the fitted minimum lands on a NAMED standard curve,
  which is what makes it a reading rather than a fit. Measured on two
  unrelated build classes four ways (motion rms 8.90 -> 1.29 on deck
  56's 3.0s curve; dissolves bracket 0.41-0.45); linear decisively
  excluded. Implemented as waypoints stamped linear (src/ untouched;
  reconstruction 0.0005 vs 0.054 curve separation). P-7's cursors
  couldn't separate the two eases (54.8px at 5fps); deck 56's 3.0s
  travel can. Mid-build frames of P-3/4/5/7 may move — P-8 re-runs
  them as gates. Side effect: dissolves P-7's per-pair ripple problem
  (a linear sequence has no ease to fight); its ripple tests
  rewritten to assert the stronger property.
- (2026-09-08, P-8, superseding the deck-54 exchange) **Deck 54 has no
  geometry gap** — the seven tablets ARE declared stacked at the tower,
  the footage shows them stacked during the hold (f_03993), and the
  outgoing MAGIC MOVE carries them to deck 55's spread (mid-flight at
  f_03996). The importer, deck, and P-1's held-layout reasoning were
  all correct; the phantom was one mis-timed sample (P-7's
  scan-finds-where-not-what lesson, walked into and recorded). Deck 54
  offers NO firing-model exception (the count stays at two). BOUNDARY
  CORRECTION, the largest yet: deck 54 holds ~793.4-797.6, the Magic
  Move runs ~797.6-799.8, deck 55 holds 799.8-827.8 (recon said
  816.0) — the Viterbi's near-identical-pair failure mode, confirmed
  independently by the mini-towers inking from 812.35 and the
  four-vanish/fade-out match. The lead's footage-measured-positions
  ruling was RETRACTED as moot (conditionally sound doctrine, false
  antecedent).
- (2026-09-08, P-8) **Standing instruction: a chapter row's title is
  a hypothesis** — two of eight have now dissolved on measurement
  (P-5's dimmed palette, P-8's fractal instancing). Read the build
  census and shape structure FIRST; name the work from the data.
- (2026-09-08, P-8) The ease refinement: `acceleration` splits builds
  by CLASS — 155 declare kEaseBoth, 229 declare NOTHING (every plain
  dissolve/appear/fade-and-move). The absent field is read as a
  DEFAULT (inference, stated as such; the alternative tested — smooth
  on dissolves fits 2-4x worse and moves nothing else). Deck 56's
  action-scale factor MEASURED admissibly (crosses empty stage;
  0.795 ink-corrected, k=0.8 predicts the arrival box to ~1px);
  ACTION_SCALE stays out of SUPPORTED — per-build opt-in. Sixth
  firing-model confirmation (sharpest: one slide, no pooling; gaps
  0.985-1.010x vs manual 2.275x); ONE new-shape apparent exception
  (deck 43 chunk 8 fires WITH its predecessor) reported unresolved.
  Measurement note: overlapping group boxes need EXCLUSIVE masks
  (onsets move up to 0.18s — most of a frame). THE COROLLARY LESSON:
  two settled frames do not show what happened between them, and a
  segment boundary is exactly where that bites.
