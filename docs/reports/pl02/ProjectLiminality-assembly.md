# PL02 assembly — the whole video as one DreamSong

The seven build chapters composed into ONE composition at the video's
own boundaries — all 59 deck slides and the closing return to the title
card, 903.4 seconds — and scored against the published upload segment by
segment.

**Scene**: `core/demo/pl02/ProjectLiminality.ts`, registered `pl02`.
**Tests**: `core/test/pl02-song.test.ts` — 16 tests, 1,213,563 assertions.

**On the film**: a full render was started and stopped at 41% on the
lead's directive (§7) — reproduction is evaluated frame-selectively
against the live scene, which is what §2 and §4 are. There is no MP4 and
no sync verdict here; the recipes and the measured render rate are in §7
for whenever one is wanted.

**The headline.** The composition is invisible: across all 65 frames the
seven chapters had scored standalone, re-scored inside the song, **no
frame regressed** — 41 identical, 23 better (from landings that
postdate those chapters' own runs), one worse by 0.0006. Zero
PASS→FAIL, three FAIL→PASS. On the 60 segment spots the song scores a
**median cov_ref of 0.9951**, 48/60 PASS.

## 1. What the assembly is, structurally

The ORIGINS song is a `DreamSong`: its chapters run on their own local
clocks and the class places each at an accumulated offset. **Every PL02
chapter runs on the VIDEO's clock instead** — P-3 set that convention on
the first chapter and all seven kept it, so `at(t)` advances to video
second t and every clip is placed by `clip.start = <video second>`.

Measured, not assumed:

| chapter | duration | clips | minStart | maxEnd |
|---|---|---|---|---|
| Arc01 | 134.80 | 39 | 0.00 | 134.80 |
| Mesh01 | 227.00 | 37 | 0.00 | 227.00 |
| Density01 | 220.00 | 51 | 0.00 | 220.00 |
| Chain01 | 546.20 | 53 | 0.00 | 546.20 |
| SetPieces | 893.40 | 66 | 0.00 | 893.40 |
| Web01 | 792.60 | 61 | 0.00 | 792.60 |
| Fractal01 | 860.80 | 59 | 0.00 | 860.80 |

The chapters therefore do not TILE the film — they OVERLAP it, each
holding its own pages hidden outside its own windows. A span-based
`DreamSong` would shift clips that are already correct.

So the song is one `Dream` on the video's clock that **borrows each
chapter's clips verbatim** (`clip.start` unchanged) and stages its
roots. Nothing is transcribed, re-implemented or re-timed: the chapters'
clip lists ARE the song's clip lists. That is the strongest possible
form of the composition-invisibility property, and §4 measures it.

The song is **903.4 s, 516 clips, 62 roots, 60 segments**.

### The one thing a chapter cannot know — and the assembly's real finding

Borrowing the chapters verbatim exposed a class of behaviour no
chapter's own gauntlet can see, and it is **not a defect in any
chapter**.

A chapter hides the OUTGOING page when it cuts to the next
(`setAt(from, pages[i-1].visible(false))`). Over its own run that is
exactly right, and its LAST page is meant to hold to the end because the
chapter ends there. In a film neither holds: every chapter's last page
would stay on screen for the rest of the video, and a chapter whose
decks are NOT contiguous in film order (SetPieces owns 16, 17, 18 and
59, with decks 19–58 in between) leaks its mid-run pages the same way.

Measured before the fix, at video 700: **seven pages drawing at once** —
Mesh01's deck 14 (1,329 leaf drawables), Density01's deck 13 (1,327),
SetPieces' deck 18 (1,801), Chain01's deck 30, Arc01's deck 6, Web01's
deck 45, Fractal01's deck 44. The composite was every tableau in the
film superimposed.

The song gates every page it can reach — its own twenty and all seven
chapters' — with a `visible(false)` at the far edge of that page's
window. It cannot disturb a chapter's scoring: inside the window nothing
is written, outside it the chapter had no opinion, and §4 measures that
holding. "When does my last page leave" is a question only the film can
answer, so the film answers it.

Two tests pin the result: one asserts the ACTIVE deck at the settled end
of each of the 60 segments, the other sweeps a 0.2 s grid across the
whole 903.4 s and requires that no two decks ever draw together. Zero
decks drawing is allowed and expected — those are the crossings, which
the film renders as cuts and therefore as black (the ORIGINS precedent's
dead air).

The counting must be on LEAF drawables. A holon with parts draws nothing
itself — a `Connection` parents one `Line` per dash, and `opacityOf`
sets the CHILDREN's opacity — so a container's own opacity says nothing
about what is on screen. Counting containers gives a false positive on
every page.

## 2. The boundary table — all 60 rows

`deck` is the DECK slide (P-1's +1 shift applied); the window runs to
the next row's start. Six rows are CORRECTED against
`analysis/segments.json`, each by the chapter that measured it — the
chapter is the authority, because it looked at the footage with an
instrument built for that question and the Viterbi did not.

The `spot` is one settled reference frame per segment, chosen clear of
BOTH crossings (after the segment's last measured event, before the
outgoing transition starts).

**48/60 PASS; mean cov_ref 0.9061, MEDIAN 0.9951.** The mean sits far
below the median because five segments are shorter than about 4 s and so
have no instant clear of both crossings — their spot necessarily lands
inside one, and the film cuts where the reference glides (§5a).
Excluding exactly those five: **48/55 PASS, mean cov_ref 0.9709, mean
cov_ours 0.9501.**

| # | deck | window (s) | dur | built by | spot | cov_ref | cov_ours | verdict |
|---|---|---|---|---|---|---|---|---|
| 0 | 1 | 0.0–0.6 | 0.6 | **standard** | f_00003@0.4 | 0.9989 | 0.9753 | PASS |
| 1 | 2 | 0.6–20.2 | 19.6 | Arc01 | f_00056@11.0 | 0.9062 | 0.8382 | FAIL |
| 2 | 3 | 20.2–45.8 | 25.6 | Arc01 | f_00164@32.6 | 0.8549 | 0.6919 | FAIL |
| 3 | 4 | 45.8–98.0 | 52.2 | Arc01 | f_00361@72.0 | 0.9999 | 0.9917 | PASS |
| 4 | 5 | 98.0–119.4 | 21.4 | Arc01 | f_00545@108.8 | 1.0000 | 0.9853 | PASS |
| 5 | 6 | 119.4–134.8 | 15.4 | Arc01 | f_00637@127.2 | 1.0000 | 0.9670 | PASS |
| 6 | 7 | 134.8–162.8 | 28.0 | Mesh01 | f_00747@149.2 | 0.8912 | 0.7701 | FAIL |
| 7 | 8 | 162.8–171.2 | 8.4 | Mesh01 | f_00849@169.6 | 0.9554 | 0.9258 | PASS |
| 8 | 9 | 171.2–193.8 | 22.6 | Mesh01 | f_00917@183.2 | 1.0000 | 1.0000 | PASS |
| 9 | 10 | 193.8–199.4 | 5.6 | **standard** | f_00979@195.6 | 0.1175 | 0.1764 | FAIL |
| 10 | 11 | 199.4–214.4 | 15.0 | Density01 | f_01057@211.2 | 0.9857 | 0.9597 | PASS |
| 11 | 12 | 214.4–216.4 | 2.0 | Density01 | f_01082@216.2 | 1.0000 | 1.0000 | PASS |
| 12 | 13 *P-6* | 216.4–219.4 | 3.0 | Density01 | f_01097@219.2 | 0.2986 | 0.2249 | FAIL |
| 13 | 14 | 219.4–225.2 | 5.8 | Mesh01 | f_01110@221.8 | 0.9915 | 0.9988 | PASS |
| 14 | 15 *P-5* | 225.2–262.2 | 37.0 | Chain01 | f_01223@244.4 | 0.9748 | 0.9723 | PASS |
| 15 | 16 *P-5* | 262.2–279.4 | 17.2 | SetPieces | f_01356@271.0 | 1.0000 | 0.9973 | PASS |
| 16 | 17 | 279.4–292.0 | 12.6 | SetPieces | f_01436@287.0 | 0.9933 | 0.9699 | PASS |
| 17 | 18 *P-9* | 292.0–362.0 | 70.0 | SetPieces | f_01639@327.6 | 1.0000 | 0.9960 | PASS |
| 18 | 19 | 362.0–369.4 | 7.4 | **standard** | f_01833@366.4 | 1.0000 | 0.9940 | PASS |
| 19 | 20 | 369.4–375.2 | 5.8 | **standard** | f_01862@372.2 | 1.0000 | 1.0000 | PASS |
| 20 | 21 | 375.2–428.2 | 53.0 | **standard** | f_02014@402.6 | 0.4798 | 0.1579 | FAIL |
| 21 | 22 | 428.2–445.8 | 17.6 | Chain01 | f_02187@437.2 | 0.9830 | 0.9804 | PASS |
| 22 | 23 | 445.8–452.0 | 6.2 | Chain01 | f_02242@448.2 | 0.9932 | 0.9843 | PASS |
| 23 | 24 | 452.0–490.2 | 38.2 | Chain01 | f_02357@471.2 | 0.9588 | 0.9671 | PASS |
| 24 | 25 *P-5* | 490.2–503.6 | 13.4 | Chain01 | f_02485@496.8 | 0.9736 | 0.9714 | PASS |
| 25 | 26 | 503.6–510.2 | 6.6 | **standard** | f_02535@506.8 | 0.9980 | 0.9872 | PASS |
| 26 | 27 | 510.2–517.6 | 7.4 | **standard** | f_02571@514.0 | 0.9975 | 0.9894 | PASS |
| 27 | 28 | 517.6–526.6 | 9.0 | **standard** | f_02609@521.6 | 0.9975 | 0.9879 | PASS |
| 28 | 29 | 526.6–539.6 | 13.0 | Chain01 | f_02666@533.0 | 0.9961 | 0.9784 | PASS |
| 29 | 30 | 539.6–546.2 | 6.6 | Chain01 | f_02715@542.8 | 0.9777 | 0.9745 | PASS |
| 30 | 31 | 546.2–553.8 | 7.6 | **standard** | f_02754@550.6 | 0.9951 | 0.9819 | PASS |
| 31 | 32 | 553.8–572.6 | 18.8 | **standard** | f_02818@563.4 | 0.9970 | 0.9809 | PASS |
| 32 | 33 | 572.6–590.6 | 18.0 | **standard** | f_02908@581.4 | 1.0000 | 0.9968 | PASS |
| 33 | 34 | 590.6–599.6 | 9.0 | **standard** | f_02979@595.6 | 1.0000 | 0.9972 | PASS |
| 34 | 35 | 599.6–601.4 | 1.8 | **standard** | f_03007@601.2 | 0.1403 | 0.1910 | FAIL |
| 35 | 36 | 601.4–606.0 | 4.6 | **standard** | f_03022@604.2 | 0.9957 | 0.9895 | PASS |
| 36 | 37 | 606.0–608.4 | 2.4 | **standard** | f_03042@608.2 | 0.9455 | 0.9360 | PASS |
| 37 | 38 | 608.4–610.6 | 2.2 | **standard** | f_03053@610.4 | 0.1619 | 0.1943 | FAIL |
| 38 | 39 | 610.6–613.8 | 3.2 | **standard** | f_03069@613.6 | 0.2462 | 0.3098 | FAIL |
| 39 | 40 | 613.8–618.6 | 4.8 | **standard** | f_03081@616.0 | 1.0000 | 1.0000 | PASS |
| 40 | 41 | 618.6–627.2 | 8.6 | **standard** | f_03118@623.4 | 0.9609 | 0.9413 | PASS |
| 41 | 42 | 627.2–639.4 | 12.2 | **standard** | f_03173@634.4 | 0.9632 | 0.9463 | PASS |
| 42 | 43 | 639.4–675.4 | 36.0 | Fractal01 | f_03285@656.8 | 0.9848 | 0.9968 | PASS |
| 43 | 44 | 675.4–690.6 | 15.2 | Fractal01 | f_03413@682.4 | 1.0000 | 0.8989 | FAIL |
| 44 | 45 | 690.6–710.6 | 20.0 | Web01 | f_03511@702.0 | 1.0000 | 0.9948 | PASS |
| 45 | 46 | 710.6–722.4 | 11.8 | Web01 | f_03580@715.8 | 1.0000 | 0.9958 | PASS |
| 46 | 47 | 722.4–728.8 | 6.4 | Web01 | f_03623@724.4 | 0.9997 | 0.9957 | PASS |
| 47 | 48 | 728.8–733.2 | 4.4 | Web01 | f_03662@732.2 | 1.0000 | 0.9955 | PASS |
| 48 | 49 | 733.2–739.0 | 5.8 | Web01 | f_03681@736.0 | 1.0000 | 0.9946 | PASS |
| 49 | 50 | 739.0–744.0 | 5.0 | Web01 | f_03710@741.8 | 0.9696 | 0.9973 | PASS |
| 50 | 51 | 744.0–749.4 | 5.4 | Web01 | f_03737@747.2 | 0.9737 | 0.9951 | PASS |
| 51 | 52 | 749.4–765.2 | 15.8 | Web01 | f_03784@756.6 | 0.9688 | 0.9951 | PASS |
| 52 | 53 | 765.2–793.4 | 28.2 | Web01 | f_03896@779.0 | 0.9704 | 0.9903 | PASS |
| 53 | 54 | 793.4–799.8 | 6.4 | Fractal01 | f_03982@796.2 | 1.0000 | 1.0000 | PASS |
| 54 | 55 *P-8* | 799.8–827.8 | 28.0 | Fractal01 | f_04068@813.4 | 0.9999 | 0.9776 | PASS |
| 55 | 56 | 827.8–846.8 | 19.0 | Fractal01 | f_04200@839.8 | 0.9867 | 0.9586 | PASS |
| 56 | 57 | 846.8–851.0 | 4.2 | Fractal01 | f_04243@848.4 | 0.9986 | 0.9911 | PASS |
| 57 | 58 | 851.0–861.0 | 10.0 | Fractal01 | f_04279@855.6 | 0.9951 | 0.7796 | FAIL |
| 58 | 59 | 861.0–893.8 | 32.8 | SetPieces | f_04422@884.2 | 0.7910 | 0.9400 | FAIL |
| 59 | 1 | 893.8–903.4 | 9.6 | standard (close) | f_04501@900.0 | 0.9986 | 0.9757 | PASS |


### The six corrections

| deck | recon | corrected | by | why |
|---|---|---|---|---|
| 13 | 217.0 | **216.4** | P-6 | MagicMove01 studied this exact glide: onset 216.4, the frame the GEOMETRY first moves (216.2 is the frame the first pixel changes, when the second superposed copy appears). 217.0 sits inside the glide. |
| 15 | 227.0 | **225.2** | P-5 | settles 225.2, leaves 262.2 |
| 16 | 263.0 | **262.2** | P-5 | ditto |
| 18 | 362.0 | **292.0** | P-9 | the recon's 82.6 s "segment 17" is TWO slides. Geometric proof: deck 17's shapes reach x 329.7–950.4 and cannot draw the outer towers at ~235/~1040 that the footage shows from 293.8. **Deck 18 is seventy seconds long.** |
| 25 | 490.6 | **490.2** | P-5 | P-5's own three In-build onsets are 490.108–490.115 (sd 0.022–0.024) and a change scan puts the first changing frame at 490.2. Chain01's PAGES table still says 490.6 — the one place its cut-in disagrees with its own onsets. |
| 55 | 816.0 | **799.8** | P-8 | the Viterbi's near-identical-pair failure; confirmed by the mini-towers inking from 812.35. Deck 54 holds only ~6.4 s. |

Rows 13 and 25 are **this chapter's own corrections**, found by the
assembly and not previously in the amendments.

## 3. The standard treatment — the twenty decks no chapter built

The seven chapters build 39 of the 59 decks and 715 of the 903 seconds.
The other twenty are the film's quiet stretches: **188.6 s carrying just
34 of the 141 measured animation events, and eight of the twenty declare
no build at all.** They get the standard treatment — compose the slide,
cut it in at its boundary, fire its builds through the three-state
firing model at the measured clicks. Nothing needed a capability that
was not already landed.

| chapter | decks |
|---|---|
| Arc01 (P-3) | 2–6 |
| Mesh01 (P-4) | 7, 8, 9, 14 |
| Density01 (P-10) | 11, 12, 13 |
| Chain01 (P-5) | 15, 22–25, 29, 30 |
| SetPieces (P-9) | 16, 17, 18, 59 |
| Web01 (P-7) | 45–53 |
| Fractal01 (P-8) | 43, 44, 54–58 |
| **standard** | 1, 10, 19, 20, 21, 26, 27, 28, 31–42 |

### The clicks are measured; everything else is derived

`firingTimes` (P-10's close) is imported rather than restated. Only the
CLICKS are footage-measured, and at the footage's own 5 fps resolution
rather than by inverting one target's ramp — stated plainly because it
is weaker than what the chapters did. The per-build instrument does not
reach these decks: their targets are nested overlapping groups, and
P-8's exclusive-mask rule masks most of them to zero pixels. Nothing is
fitted.

Deck 21 is the only substantial uncovered segment (53.0 s, 13 builds,
9 manual chunks against 8 measured clicks — chunks 4 and 5 fire
together, confirmed by eye at 394.6–395.8 where both lobes travel in the
same frames). Decks 41 and 42 are all-automatic cascades: **one measured
click apiece predicts the whole segment**, and the footage's change runs
track the declared 1.0/2.0 s steps across it.

### `cascadeFrom` — a case the chapters never met

`firingTimes` honours a click only on `automatic: false`, which is what
the flag means. But six of the twenty decks (20, 32, 39, 40, 41, 42)
open on an AUTOMATIC chunk, which has no predecessor to derive from, so
the helper's clock starts at 0 and the whole cascade landed at video
second 0. Read as: the referent a leading automatic chunk steps from is
the click that ADVANCED TO THE SLIDE. The cascade is computed from zero
and shifted onto that measured instant, preserving every derived
interval. The shared helper is untouched.

### Two builds are deliberately NOT rendered

Decks 10 and 21 each carry an `apple:action-scale` whose FACTOR IS NOT
IN THE RECORD. P-4 refused to score deck 10 for exactly this reason, and
the refusal is inherited rather than reversed: an undeclared magnitude
fitted to make a frame match is what the refused-fits rule forbids. P-8
and P-9 measured factors for decks 56 and 17 because those targets cross
an empty stage; these do not. The visible cost is deck 21's row — its
elements are in the right PLACES (the motion paths declare their travel
and are read) and the wrong SIZES.

## 4. Song vs standalone — the composition-invisibility gate

Every chapter's own SCORED and MIDS frames, re-scored inside the song at
the same reference frames, against the score that chapter recorded.

**No frame regressed. 41 identical, 23 better, 1 worse by 0.0006 (noise).
Zero PASS→FAIL. Three FAIL→PASS.**

| frame | chapter | solo cov_ref | song cov_ref | delta | solo→song |
|---|---|---|---|---|---|
| f_00081 | p3seg | 0.5134 | 0.9036 | +0.3902 | FAIL→FAIL **better** |
| f_00201 | p3seg | 0.4059 | 0.9120 | +0.5061 | FAIL→FAIL **better** |
| f_00451 | p3seg | 0.9999 | 0.9999 | +0.0000 | PASS→PASS identical |
| f_00591 | p3seg | 1.0000 | 1.0000 | +0.0000 | PASS→PASS identical |
| f_00651 | p3seg | 1.0000 | 1.0000 | +0.0000 | PASS→PASS identical |
| f_00851 | p4 | 0.9554 | 0.9554 | +0.0000 | PASS→PASS identical |
| f_00950 | p4 | 1.0000 | 1.0000 | +0.0000 | PASS→PASS identical |
| f_01030 | p10seg | 0.9971 | 0.9971 | +0.0000 | PASS→PASS identical |
| f_01051 | p10seg | 0.9973 | 0.9973 | +0.0000 | PASS→PASS identical |
| f_01055 | p10seg | 0.9915 | 0.9915 | +0.0000 | PASS→PASS identical |
| f_01057 | p10seg | 0.9857 | 0.9857 | +0.0000 | PASS→PASS identical |
| f_01064 | p10seg | 0.9825 | 0.9825 | +0.0000 | PASS→PASS identical |
| f_01080 | p10seg | 1.0000 | 1.0000 | +0.0000 | PASS→PASS identical |
| f_01093 | p10seg | 0.9821 | 0.9821 | +0.0000 | PASS→PASS identical |
| f_01301 | p5 | 0.9767 | 0.9767 | +0.0000 | PASS→PASS identical |
| f_01329 | p9mid16 | 1.0000 | 1.0000 | +0.0000 | FAIL→FAIL identical |
| f_01338 | p9mid16 | 1.0000 | 1.0000 | +0.0000 | PASS→PASS identical |
| f_01392 | p9seg | 1.0000 | 1.0000 | +0.0000 | PASS→PASS identical |
| f_01443 | p9mid | 0.6401 | 0.6401 | +0.0000 | FAIL→FAIL identical |
| f_01445 | p9mid | 0.8738 | 0.8738 | +0.0000 | FAIL→FAIL identical |
| f_01446 | p9mid | 0.8548 | 0.8548 | +0.0000 | FAIL→FAIL identical |
| f_01459 | p9seg | 0.8822 | 0.8822 | +0.0000 | FAIL→FAIL identical |
| f_01664 | p9mid | 0.9916 | 0.9916 | +0.0000 | PASS→PASS identical |
| f_01684 | p9mid | 0.9733 | 0.9733 | +0.0000 | PASS→PASS identical |
| f_01795 | p9seg | 0.9755 | 0.9755 | +0.0000 | PASS→PASS identical |
| f_02216 | p5 | 0.9830 | 0.9830 | +0.0000 | PASS→PASS identical |
| f_02246 | p5 | 0.9938 | 0.9932 | -0.0006 | PASS→PASS worse |
| f_02351 | p5 | 0.9588 | 0.9588 | +0.0000 | PASS→PASS identical |
| f_02496 | p5 | 0.9735 | 0.9735 | +0.0000 | PASS→PASS identical |
| f_02686 | p5 | 0.9966 | 0.9966 | +0.0000 | PASS→PASS identical |
| f_02721 | p5 | 0.9777 | 0.9777 | +0.0000 | PASS→PASS identical |
| f_03263 | p8mid | 0.9562 | 0.9845 | +0.0283 | PASS→PASS **better** |
| f_03275 | p8mid | 0.9454 | 0.9778 | +0.0324 | PASS→PASS **better** |
| f_03287 | p8mid | 0.9621 | 0.9852 | +0.0231 | PASS→PASS **better** |
| f_03327 | p8mid | 0.9483 | 0.9671 | +0.0188 | PASS→PASS **better** |
| f_03370 | p8seg | 0.9544 | 0.9718 | +0.0174 | PASS→PASS **better** |
| f_03441 | p8seg | 1.0000 | 1.0000 | +0.0000 | PASS→PASS identical |
| f_03521 | p7seg | 1.0000 | 1.0000 | +0.0000 | PASS→PASS identical |
| f_03591 | p7seg | 1.0000 | 1.0000 | +0.0000 | PASS→PASS identical |
| f_03597 | p7mid | 0.9995 | 0.9995 | +0.0000 | PASS→PASS identical |
| f_03598 | p7mid | 0.9994 | 0.9994 | +0.0000 | PASS→PASS identical |
| f_03599 | p7mid | 0.9994 | 0.9994 | +0.0000 | PASS→PASS identical |
| f_03626 | p7seg | 0.9997 | 0.9997 | +0.0000 | PASS→PASS identical |
| f_03635 | p7mid | 0.9975 | 0.9975 | +0.0000 | PASS→PASS identical |
| f_03637 | p7mid | 0.9974 | 0.9974 | +0.0000 | PASS→PASS identical |
| f_03661 | p7seg | 1.0000 | 1.0000 | +0.0000 | PASS→PASS identical |
| f_03686 | p7mid3 | 0.9896 | 0.9896 | +0.0000 | PASS→PASS identical |
| f_03716 | p7seg2 | 0.9702 | 0.9702 | +0.0000 | PASS→PASS identical |
| f_03741 | p7seg2 | 0.9664 | 0.9737 | +0.0073 | PASS→PASS **better** |
| f_03811 | p7mid2 | 0.9660 | 0.9734 | +0.0074 | PASS→PASS **better** |
| f_03812 | p7mid | 0.9660 | 0.9733 | +0.0073 | PASS→PASS **better** |
| f_03813 | p7mid | 0.9659 | 0.9733 | +0.0074 | PASS→PASS **better** |
| f_03941 | p7seg2 | 0.9634 | 0.9704 | +0.0070 | PASS→PASS **better** |
| f_03987 | p8seg | 1.0000 | 1.0000 | +0.0000 | PASS→PASS identical |
| f_04130 | p8seg | 0.9939 | 0.9999 | +0.0060 | PASS→PASS **better** |
| f_04159 | p8mid | 0.9218 | 0.9881 | +0.0663 | PASS→PASS **better** |
| f_04162 | p8mid | 0.9137 | 0.9804 | +0.0667 | PASS→PASS **better** |
| f_04165 | p8mid | 0.9150 | 0.9819 | +0.0669 | PASS→PASS **better** |
| f_04220 | p8seg | 0.9285 | 0.9872 | +0.0587 | PASS→PASS **better** |
| f_04245 | p8seg | 0.9467 | 0.9986 | +0.0519 | PASS→PASS **better** |
| f_04290 | p8seg | 0.9724 | 0.9958 | +0.0234 | PASS→PASS **better** |
| f_04315 | p9mid | 0.8212 | 0.9336 | +0.1124 | FAIL→PASS **better** |
| f_04330 | p9mid | 0.8520 | 0.9542 | +0.1022 | FAIL→PASS **better** |
| f_04345 | p9mid | 0.8619 | 0.9502 | +0.0883 | FAIL→PASS **better** |
| f_04460 | p9deck59 | 0.6752 | 0.7912 | +0.1160 | FAIL→FAIL **better** |

**identical 41 · better 23 · worse 1**

The improvements are NOT the assembly's doing and should not be read as
such: they are chapters whose recorded scores predate later landings —
P-1's `tracedPath` (which lifts P-3's deck 2/3 image ceiling exactly as
the amendment predicted, 0.5134→0.9036 and 0.4059→0.9120), P-10's
z-order fix (P-8's frames), and P-9's own deck-59 translation plus this
chapter's label reconstruction (f_04460, 0.6752→0.7912).

What the assembly claims is the 41 identical rows and the zero
regressions: **the composition changes nothing.** The song's test
asserts the same property structurally and EXACTLY — no tolerance,
because there is no offset arithmetic to introduce float slack, which is
strictly stronger than the ORIGINS song's 1e-9.

## 5. The twelve segment-spot failures, classified

None is an assembly fault. Each is one of four known things.

**(a) The transition gap — the film's largest known limitation.** Every
chapter renders its transitions as CUTS (P-3 set it: standing in a
cross-dissolve for a Magic Move "would produce frames that look
approximately right for the wrong reason"), and the song does the same
for the twenty decks it adds. 44 of the 59 transitions are
`magic-move-implied-motion-path` at a declared 2.0 s, so **roughly 88
seconds — a tenth of the film — are crossings the reference glides and
the reproduction cuts.** On a segment shorter than about 4 s there is no
instant clear of both crossings, so its spot necessarily lands inside
one: decks 10, 13, 35, 38 and 39 (cov_ref 0.10–0.30, chamfer 8–11 px).
Those five rows measure the gap, not the tableau.

The machinery to close it is LANDED and proven on two pairs (P-6's
`magicMove`/`magicMoveAnim`/`magicMoveSwap`, scored on decks 12→13 and
36→37). The reason it is not used is p6-handoff.md: **MM01's mid-glide
frames score 0.23–0.35 because Keynote re-derives a connection line per
frame from the objects it joins while ours glides as a rigid baked
drawable — the dash-phase residual, still OPEN, with
`GlidingConnection` the identified fix.** Standing a half-right glide
into the film would replace a clean cut with 88 s of visibly wrong
frames. Stated, scored, and left for the chapter that closes p6-handoff.

**(b) The undeclared action-scale.** Deck 21 (0.4798) — its elements are
in the right places and the wrong sizes, because the two `action-scale`
builds declare no factor and the refused-fits rule forbids inventing
one. §3 above.

**(c) The image ceiling, now mostly lifted.** Decks 2 and 3 (0.9062,
0.8549) carry the deck's line-art images. P-1's `tracedPath` landing
lifted them from 0.5134/0.4059 to 0.9036/0.9120; the residual is the
SILHOUETTE PROPERTY the amendment names — an instant-alpha trace follows
the ink's OUTER boundary, so traced outlines render ~6.5 px/side larger.
Inherent to what a trace is.

**(d) Chapter-local build timing.** Deck 7 (0.8912) and deck 58
(cov_ours 0.7796 — ours draws MORE, the "Gerardian scapegoating" label
arriving before the reference shows it) are the owning chapters' own
onsets at frames those chapters did not score. Deck 44's 0.8989
cov_ours is the same shape.

## 6. Deck 59 — the filmed state

The standing ruling (P-9 final, and the lead's assembly note): the FILM
renders the FILMED state, because deck 59 is the one slide the file
demonstrably post-dates the recording — its tableau sits 141.56 slide
units below what the footage draws, and three labels the footage builds
exist in NO archive in the 84-slide file.

**The translation** is SetPieces' (`DECK59_EDIT_OFFSET`, exported and
previously unused), and the song inherits it by borrowing that chapter
whole. It was verified five ways at P-9's close.

**The three labels** are this chapter's work, reconstructed from the
footage — the canon policy's inverse case. The chain:

| | |
|---|---|
| **text** | read from the footage, legible at f_04451 and every settled frame after |
| **position** | ink bounding box over eight settled frames 886.0–893.0 s, **sd 0.00 px on every edge** — the check that the window really is settled. Converted px→slide by the pipeline's own 3/2, then to the first line's baseline (one cap height, 0.714 em, below the measured cap top) because that is what `Text` anchors on |
| **size** | DERIVED from measured cap height, then MATCHED to the deck's own stylesheet: Liminal Flow 24 px → 50.42 → **50**; Collective Intelligence 15 px → 31.51 → **32**; Syntropy 19 px → 39.92 → **40**. All three land within half a unit of a size the deck already declares (24/30/32/34/36/37/40/50/116), so the measurement SELECTS a deck value rather than inventing one |
| **face** | `HelveticaNeue`, the deck's own body face; `lineHeight` 1 as all 91 deck records carry, except Collective Intelligence's measured 1.142 (24 px baseline gap against a 21.01 px em) |
| **onsets** | measured: 875.8, 878.2, 883.0 — after the 33-chunk cascade ends at 875.314. A 1.0 s ramp each, `All at Once` per P-1's amendment |
| **staging** | SIBLINGS of the deck-59 page, not members: the page carries the translation, and a label riding it would be lifted twice |

Result: deck 59's cov_ref rises **0.6752 → 0.7912**.

**NOT reconstructed, and named so the residual is not mistaken:** the
SYNTROPY CURVES (2,298 px in P-9's accounting) are also absent from the
file and are not rebuilt. Reconstructing two long free-drawn beziers
from footage would be TRACING, and the campaign's one tracing question
was settled by finding Keynote's own stored `tracedPath` — there is no
stored path for a shape that was deleted.

**OPEN, and reported rather than fixed:** two of the three labels do not
draw IN THE SONG. In an isolated probe scene all three render at their
measured positions and match the reference closely; in the song only the
two-line "Collective Intelligence" appears. Ruled out: model state (all
three carry opacity 1, creation 1, correct geometry at 884.2, all
reachable from `roots`, all driven by their own clips), stale bundle
(re-scored against a fresh build — identical to four decimals), and
layout-key collision (97 Text holons with many duplicate keys all
render). A tested hypothesis was REFUTED: the two failing labels were
the only Texts in the film leaving `lineHeight` undefined, and setting
it to the deck's own 1 changed nothing (the value is kept anyway, since
matching the deck is right on its own terms). What remains is that the
working label is the only one containing a NEWLINE — the one branch
single-line text skips — and that every deck label is a CHILD of a Slide
while these three are sibling roots. `render/**` is untouchable for this
agent.

## 7. The film — rendered in part, then stopped by policy

The render was started (27,102 frames at 30 fps, 1280x720) and **aborted
at 11,086 frames (41%)** on the lead's directive: full film renders are
not needed for reproduction, because evaluation happens frame-selectively
against the live scene — which is what §2's boundary table and §4's
song-vs-standalone comparison already are. Going forward this is policy:
no full renders unless David asks.

The frames rendered before the stop are kept at
`<scratchpad>/pl02-frames` (11,086 PNGs, 712 MB, video seconds 0–369.5).
No MP4 and no side-by-side were assembled, so there is no sync verdict
in this report.

**Render stats, measured, for whoever needs them later.** The rate held
at **5.3 fps steady** from f300 to f11000 — so the full 27,102 frames
would take about **85 minutes**. That is 3.6x slower per frame than the
ORIGINS song (11,337 frames at ~19 fps, 9.9 min), and the reason is
worth recording because it inverts the intuition the brief carried: **a
slideshow's static holds do NOT render faster.** Every one of the 59
slide pages is staged for the whole film, so each `setT` re-evaluates
the entire deck's geometry no matter how little is moving. The cost is
set by the scene's total size, not by how much of it changes.

Two recipes are written and ready if the film is ever asked for —
`<scratchpad>/assemble.sh` (30 fps h264/yuv420p for ours; hstack
ours-left / original-right at 2560x720 carrying the reference's own
audio, both fps-filtered to 30 since the reference is 59.94) and
`<scratchpad>/synccheck.sh` (four stills at v108, v327, v656, v890).

Sync would be exact by construction rather than by adjustment: the
reference mkv starts at 0.000 and its first frame matches `f_00001` to a
mean absolute difference of 0.18 (JPEG noise), and the song's clock IS
video time with no offset anywhere.

## 8. Gates

| gate | result |
|---|---|
| `bunx tsc --noEmit` in `core/` | **clean** |
| `bun test` | **1234/1234**, 1,352,065 assertions (1218 baseline + 16 mine) |
| `core/test/pl02-song.test.ts` | **16/16**, 1,213,563 assertions |
| S04 regression (`GAUNTLET_PORT=4660`) | **6/6 PASS**, mean cov ref 0.9946 / ours 0.9954 |

The last two S04 frames report "empty line mask ours" — the scene has
ended by t=6.0s; six frames are the gate, as the brief states.

## 9. Two things the next agent needs to know

**The repo's headless scripts cannot run this scene.** Both
`scripts/render-song.ts` and `scripts/pl02-gauntlet.ts` navigate with
`waitUntil: "networkidle0"` and a 30 s timeout. The song never reaches
network idle and takes ~45 s to boot, so BOTH fail on it. Scratch copies
with `domcontentloaded` and raised timeouts were used
(`scripts/.render-song.tmp.ts`, `scripts/.song-gauntlet.tmp.ts`, both
deleted after use); the repo's scripts are untouched. Any future
whole-film render hits the same wall.

**`key2ts.ts` rewrites `index.ts` to only the slides it is given.** It
does not merge. The film needs all 59 emitted
(`--slides $(seq -s, 1 59)`, which trips the generator's 2048 KB budget
warning at 2242 KB — accepted deliberately). This bit twice in one
session: another agent regenerated the index mid-run with the older
50-slide set, dropping the nine the uncovered decks need (20, 21, 26,
27, 28, 39, 40, 41, 42) and breaking the bundle build. The slide MODULES
survive a regeneration; only the index loses its exports.
