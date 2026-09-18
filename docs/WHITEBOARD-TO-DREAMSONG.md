# Whiteboard → DreamSong

The loop David wants: **show a drawing, talk over it, get a DreamSong** — then
refine it by commenting in the DreamTalk UI. Eventually: no talking needed, just
the illustration (and whatever audio happens to accompany it).

This file is the method, written from doing it the first time
(`core/demo/agentarena/`, from
`transmissions/whiteboards/2026-09-18-agent-arena-ensoulment.jpg`). It is meant
to become a skill.

---

## 0. The artifact comes first

Copy the photo into `docs/transmissions/whiteboards/<date>-<slug>.jpg` and
commit it **before** interpreting anything. The photo is source of truth; every
later reading is answerable to it. A DreamSong whose source drawing is not in
the repo cannot be re-derived, and re-derivability is the whole point.

Write the READING as a sibling markdown file. Separate it from the photo
deliberately — the reading is an interpretation and may be wrong; the photo
cannot be.

## 1. Read the drawing before reading the words

A whiteboard is not a document. Four things carry meaning, roughly in this
order of reliability:

**Colour is usually the argument, not decoration.** On the agent-arena board,
blue is *always* the container/system/world and red is *always* the
agent/attention/soul — across six unrelated drawings. That consistency is the
thesis. Read the colour assignment across the *whole* board before reading any
single drawing; if a colour holds a role in five places, it holds it in the
sixth. (Lucky here: DreamTalk's canonical BLUE/RED already *are* the two
markers, so the scene states no colour of its own.)

**Connectors are the storyboard.** The long arrow David drew down the three
interface pairs, labelled "one continuous pattern", is an explicit instruction
about sequence and grouping: these are not three facts, they are one fact three
times. Look for arrows, brackets, boxes drawn around clusters — they tell you
what is a beat and what is a sub-beat.

**Repeated glyphs are the holons.** The arena circle appears three times; the
starburst twice. A glyph drawn more than once is one idea, so it should be one
class, created once and reused at different scales. This is the holonic
recognizer doing its job manually — and it is what makes the recursion in beat
7 *literal in the code* rather than merely depicted.

**Spatial layout encodes sequence loosely, grouping tightly.** Left→right,
top→bottom is a weak hint about order. Proximity is a strong claim about
belonging. Trust proximity; check sequence against the connectors.

## 2. Extract the spine, then the beats

Write the spine as numbered claims in plain prose (see
`transmissions/2026-09-18-agent-arena.md` §"The spine"). Six-ish claims. If you
cannot state the spine without the drawing, you have not read it yet.

Then a beat table: one row per beat, "what is drawn". Eight beats was right for
a board this dense; one beat per claim, plus a beat for the synthesis and one
for the conclusion.

## 3. Illustration-first is a hard constraint

David: *"it's mainly about the illustrations, but sometimes of course it also
makes sense to use text, but never a wall of text."*

Operationally:
- A label is a **noun beside a drawing**. Never a sentence.
- Text appears as text only where the board's own content IS text — here, the
  three equations and the two closing lines.
- **One line at a time.** Beat 6 writes `selection = attention = animation`,
  holds, fades it, *then* writes `selection = soul extension`. Never both.
- Prefer drawing a thing to naming it. The board says "human agency (CHOICE)
  flows into virtual arena through virtual agent"; the scene draws a red arrow
  leaving the agent and labels it `CHOICE`. The sentence became a picture.
- When the board draws a picture *of* text (`abcd|efg`), draw it as strokes,
  not as set type — it is a container, not content. Real glyphs there read as
  something to be read rather than something to be inhabited.

## 4. Frame per beat

A whiteboard is read in regions: the eye goes to a corner, takes it in, moves.
One zoom fitted to the widest moment leaves every other beat small and far away.
So `this.play(this.observer.zoom.to(…))` between beats — wide for the
three-pair tableau (1/2), close for a single dense mark (6/7), pulled back for
the reveal (4/7). In beat 7 the pull-back **is** the meaning: the arena we were
inside turns out to sit on a screen inside a larger arena.

## 5. Build → render → LOOK → fix

Not optional, and not replaceable by typechecking. Everything below was found
by looking at rendered frames, and none of it by `tsc`:

- the agent figure was far too small against its arena (board proportions)
- the three-pair tableau overflowed the frame entirely at zoom 1
- the tableau was off-centre once the arrow and its label extended right
- the recursion tableau pushed the interface column off-frame
- the ensoulment starburst sat below the human instead of blooming from them

Render 3-4 frames per beat, `Read` them, fix, repeat. The scratchpad harness is
~30 lines of puppeteer driving `window.__dt.setT`; it also surfaces boot errors,
which is how `Circle: unknown constructor option 'filled'` was caught (that
option is `Ellipse`'s; `Circle` fills via `fillOpacity`).

## 6. Hand it back for comments

The scene registers in `core/demo/scenes.ts` and opens at
`http://localhost:4174/?scene=<key>` in the editor — where selection-anchored
voice/typed comments (docs/EDITOR-VOICE-COMMENTS.md) are the refinement loop.
`bun scripts/comment-view.ts <scene>` renders exactly what a comment points at.

That is the closing of the circle: drawing → DreamSong → comment → revision,
without leaving the tooling.

---

## The checklist

1. Commit the photo. Write the reading beside it.
2. Colour law → connectors → repeated glyphs → layout.
3. Spine (numbered claims) → beat table.
4. Repeated glyphs become holons; reuse them at different scales rather than
   redrawing.
5. Write the scene in the house idiom (a long header stating what the source is
   and what was derived vs. chosen; `unfold()` as the score).
6. Illustration-first; one line of text at a time; labels are nouns.
7. Frame per beat.
8. Render, LOOK, fix. Repeat until each beat reads like its region of the board.
9. Register it; hand David the URL for comments.

## Known gaps (for the next run)

- **Audio is not yet ingested.** David expects to talk while showing the board;
  right now the talking arrives as chat text. Whisper is already in the PL
  stack — an obvious next step is transcribing the memo alongside the photo and
  committing both, so the reading cites the words as well as the marks.
- **The reading is manual.** Colour-role extraction and repeated-glyph detection
  are exactly what a vision pass could propose automatically, with the human
  confirming. That is the holonic recognizer from the pixel-universality
  transmission, pointed at whiteboards instead of video frames.
- **Layout is hand-tuned.** Each beat's positions were nudged by eye against
  rendered frames. A layout pass that fits a beat's content to the frame
  (measure bounds, choose zoom) would remove most of the iterations in §5.
