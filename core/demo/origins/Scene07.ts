/**
 * Scene07.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 07 — code and idea.
 *
 * Two words face each other across a double-headed arrow: "code" in
 * blue on the left, "idea" in red on the right. They hold for nine
 * seconds while the narration makes its case, and then each word
 * dissolves into a square frame of its own colour — the words BECOME
 * the panels. The left panel fills with source code; the right with a
 * cylinder. A small arrow walks down the code, line by line, and the
 * cylinder does what each line says: it is created, it is rotated, it
 * is un-created. Then the panels themselves melt into a Venn diagram —
 * a small blue circle sitting inside a large red one — and the two words
 * write themselves back on inside it. Code is not the opposite of idea.
 * Code is a proper subset of it.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:549-625):
 *
 *   code  = Text("code", x=-200, z=-15, color=BLUE)
 *   idea  = Text("idea", x= 200, z=-15, color=RED)
 *   frame_code = Rectangle(width=300, height=300, x=-250, color=BLUE, solid=True)
 *   frame_idea = Rectangle(width=300, height=300, x= 250, color=RED,  solid=True)
 *   arrow    = Connection((0,0,0), (100,0,0), x=-450, y=2)
 *   cylinder = Cylinder(x=250)
 *   circle_code = Circle(radius=100, z=-95, color=BLUE, solid=False)
 *   circle_idea = Circle(radius=200,        color=RED,  solid=False)
 *   link = Connection((-100,0,0), (100,0,0), arrow_start=True)
 *   code_snippet = CObject()
 *   self.audio(…, offset=233)
 *   self.add(link, text, frames, cylinder, arrow, venn_diagram, code_snippet)
 *   self.wait(1)
 *   self.play(DrawThenFillCompletely(code, idea), run_time=3)
 *   self.play(Create(link))
 *   self.wait(9)
 *   self.play(Morph(code, frame_code), Morph(idea, frame_idea), run_time=3)
 *   self.play(Fill(frames, transparency=1))
 *   self.play(Fill(code_snippet))
 *   self.play(Create(arrow), run_time=2/3)
 *   self.play(Create(cylinder), run_time=2)
 *   self.play(Transform(arrow, z=-32), run_time=2/3)
 *   self.play(Transform(cylinder, h=PI/3, p=PI/4), run_time=2)
 *   self.play(Transform(arrow, z=-52), run_time=2/3)
 *   self.play(UnCreate(cylinder), run_time=2)
 *   self.play(Erase(arrow), UnFill(code_snippet))
 *   self.play(FadeOut(link))
 *   self.play(Morph(frame_code, circle_code), Morph(frame_idea, circle_idea),
 *             Transform(code, z=-110, relative=False),
 *             Transform(idea, z=80,  relative=False),
 *             UnFillThenUnDraw(code, idea), run_time=2)
 *   self.play(DrawThenFillCompletely(code, idea))
 *   self.wait(5)
 *   self.play(UnFillThenUnDraw(code, idea), run_time=3)
 *   self.play(UnCreate(circle_code, circle_idea), run_time=3)
 *
 * Summed, forty-three seconds.
 *
 *
 * THE TIMELINE — FOURTEEN LANDMARKS, ONE OFFSET
 *
 * Unlike Scene07_1 next door, this scene DOES sit at its declared audio
 * offset; what it needs is an ordinary lead-in. Measured off
 * refs/pitch/origins/frames5 (ink counts, per-colour masks, the arrow's
 * bounding box in the strip left of the panel, and the cylinder's ink
 * inside the red one), against the source's own cumulative times:
 *
 *   video   localT  beat                              predicted
 *   238.8     1.0   the two words begin to write        238.80
 *   241.8     4.0   the link begins to create           241.80
 *   242.8     5.0   the link is complete                242.80
 *   251.6    14.0   the words begin to morph            251.80
 *   254.8    17.0   the panels stand, flooded           254.80
 *   255.8    18.0   the code snippet fills              255.80
 *   256.8    19.0   the progress arrow creates          256.80
 *   257.4    19.7   the cylinder begins to create       257.47
 *   259.4    21.7   the arrow steps to z = −32          259.47
 *   260.0    22.3   the cylinder begins to rotate       260.13
 *   262.0    24.3   the arrow steps to z = −84          262.13
 *   262.8    25.0   the cylinder begins to un-create    262.80
 *   264.8    27.0   the arrow is erased                 264.80
 *   265.2    28.0   the link fades                      265.80
 *
 * Fourteen beats, none of them off by more than 0.2 s except the last
 * (a fade whose first missing pixel reads early). START_OFFSET = 4.8 is
 * the single number that does that, and it also predicts the scene's
 * END at 233 + 4.8 + 43 = 280.8 — which is exactly where the video's
 * next black gap begins, and exactly where Scene07_1 starts. Two
 * independent confirmations of one constant.
 *
 * That 4.8 s head is the long tail of Scene06, the 79-second monster
 * that precedes this one and that the editor trimmed hardest (report
 * §0). This scene's own beats are untouched by the re-cut.
 *
 *
 * THE ARROW'S THREE STOPS ARE RELATIVE, AND THE CODE SAYS WHY
 *
 * `Transform(arrow, z=-32)` then `Transform(arrow, z=-52)`. pydeation's
 * Transform defaults to `relative=True`, so those compose: the arrow
 * sits at y = 0, drops to −32, then drops a further 52 to −84. Measured
 * in the reference the arrow's centre is at screen y 360, 401, 467.5,
 * i.e. world 0, −32, −84. Absolute would have given 0, −32, −52 and the
 * third stop would have landed nowhere in particular.
 *
 * Where it lands instead is the whole conceit. The panel's code lines
 * sit at world y 121.5, 85.5, 34.0, −0.4, −34.4/−51.2, −87.1, −120.7,
 * and the arrow's three stops are −0.4 (`self.play(Create(cylinder))`),
 * −34.4 (`self.play(Transform(cylinder, …))`) and −87.1
 * (`self.play(UnCreate(cylinder))`) — the three lines whose effects the
 * right-hand panel is performing, in the order it performs them. The
 * arrow is a program counter.
 *
 *
 * THE CODE PANEL — THE SANCTIONED IMPROVEMENT (a FIDELITY-LEDGER entry)
 *
 * ▲ REFERENCE FLAW, OURS BETTER — with one honest cost, stated below.
 *
 * The source declares `code_snippet = CObject()`: a bare, empty
 * placeholder carrying no geometry whatsoever. In the published render
 * it is a **raster screenshot** — a syntax-highlighted PNG of pydeation
 * source, textured onto a plane in C4D and revealed with `Fill`. That
 * is why the source is empty: the panel was never constructed, it was
 * pasted in, and the .py file has no record of what it said.
 *
 * The vocabulary report (§5) recommends rendering real text instead,
 * and this chapter takes that recommendation. The panel is 36% of the
 * frame's ink through its whole span, so omitting it was never an
 * option; and reproducing a screenshot as a screenshot would import a
 * raster asset into a framework whose entire claim is that the source
 * code IS the thing. A DreamTalk scene that shows code should show it
 * the way it shows everything else.
 *
 * What the reference gives us is the CONTENT, legibly — f_01290 and
 * f_01310 are readable character by character — and the LAYOUT, which
 * turns out to be three constants and nothing else:
 *
 *   the column advance   10.9 px  → 8.516 world units, constant across
 *                        all six clean lines (px/char measured 10.65,
 *                        10.86, 10.89, 10.96, 10.97, 10.77)
 *   the left margin      the centre of column 0, world x −391.4
 *   the half-pitch       17.2 world units; every one of the eight rows
 *                        sits on a multiple of it
 *
 * Those three reproduce every measured line centre to within 1.1 world
 * units horizontally and 2.2 vertically. So the panel below is not
 * eyeballed from a screenshot — it is a monospace grid whose three
 * parameters were measured, with each line placed by its own character
 * count. See CODE_LINES.
 *
 * THE COST, STATED PLAINLY: core's Text renders in Arimo, which is
 * PROPORTIONAL, and it is centre-anchored with no left-align. So each
 * line's CENTRE lands where the reference's does, and its glyphs then
 * spread from that centre at Arimo's advances rather than a monospace
 * one. Columns therefore do not align down the panel the way real code
 * does, the lines' widths differ from the reference's by a few percent
 * either way, and the reference's per-token syntax colouring is not
 * reproduced at all (one tint per line holon; the panel is white).
 * Fixing any of that means a monospace font and a left-align in
 * render/text.ts, which is out of this chapter's scope.
 *
 * The gauntlet will see this. Frames whose ink is dominated by the code
 * panel — the whole span from the snippet's fill to its un-fill, video
 * 255.8 to 265.8 — score against a reference panel we deliberately do
 * not reproduce glyph-for-glyph, and they are reported EXCLUDED WITH
 * REASON rather than silently failed, on the Scene04-fade precedent.
 *
 *
 * THE TWO MORPHS ARE PER-LETTER, AND THE REFERENCE INSISTS ON IT
 *
 * `Morph(code, frame_code)` morphs a TEXT into a rectangle, and the
 * obvious reading — one blob crossing the frame — is wrong. pydeation's
 * Morph wraps its source in a single MoSpline, and a C4D text spline's
 * letters are its sub-splines, so the Cloner blends EVERY LETTER
 * independently toward the same destination outline. Four letters, four
 * simultaneous morphs, all arriving at one square.
 *
 * f_01259 (u ≈ 0.07) photographs it: "code" and "idea" are still
 * readable but every counter is closing — the bowl of the "o", the eye
 * of the "e", the "a" losing its aperture — because each letter is
 * separately swelling toward a square. f_01262 (u ≈ 0.2) shows them
 * fused into one lumpy mass with a scalloped bottom edge, which is four
 * overlapping quadrilaterals and not one shape. f_01265 (u ≈ 0.4) is
 * the mass squaring up with its corners still ragged and offset — four
 * squares converging on one, not yet coincident.
 *
 * WE CANNOT REPRODUCE THAT, and the reason is structural rather than an
 * omission: core's `Text` is a `Holon`, not a `Stroke`, and its letters
 * are not geometry at all — they are vertex ranges of one glyph buffer,
 * tagged by index and dominoed in the shader (parts/text.ts's header
 * says why). There are no per-letter outlines for a MorphShape to take,
 * and `Morph` gates on `Stroke` at compile time precisely so this is a
 * type error rather than a surprise. Giving Text real per-letter
 * outlines is a text-rendering change, not a scene change.
 *
 * What this scene does instead is state the morph's ENDPOINTS honestly:
 * the words leave (UnWrite) as the frames arrive (Create + flood) over
 * the same three-second span. The frame's growth is the morph's
 * silhouette; what is missing is the four-letter mid-flight, which is
 * roughly video 252.4-254.2. Those frames are the second entry in the
 * excluded-with-reason list, for a reason that is about `Text`'s
 * representation rather than about this scene.
 *
 *
 * FRAMING (front, zoom 1 — the source coordinates ARE the pixels)
 *
 * CONFIG sets `camera_perspective: "front"` and `camera_zoom: 1`, so
 * the camera is 1000 units out and the 36mm rig's f = 1280 px scales
 * the origin plane by 1.28 px per world unit. Checked against f_01290:
 *
 *   blue frame  x = −250 ± 150 → 128–512 px      measured 126–514
 *   red frame   x = +250 ± 150 → 768–1152 px     measured 766–1154
 *   both        z = ±150 → y 168–552 px          measured 166–555
 *
 * — every edge right to the stroke's half-width. And against f_01350,
 * the Venn diagram:
 *
 *   red circle   r = 200 → 256 px                measured 256
 *   blue circle  r = 100 → 128 px, z = −95 →
 *                centre y 360 + 121.6 = 481.6    measured 482
 *
 * Nothing here is fitted except START_OFFSET.
 */

import { Dream, render } from "../../src/index"
import { Circle, Group, Line, Rectangle } from "../../src/parts/primitives"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import { Text, Write, UnWrite } from "../../src/parts/text"
import {
  Create,
  Erase,
  FadeOut,
  Fill,
  UnCreate,
  UnFill,
} from "../../src/verbs"
import { together } from "../../src/anim"
import { BLUE, PI, RED, WHITE } from "../../src/constants"
import { STROKE_MAIN } from "../video01/palette"

/**
 * The head between the audio cue (offset=233, which the scorer takes as
 * localT 0) and the scene's first frame — the ONE fitted number here,
 * carried as a leading wait so every run_time and wait below stays
 * verbatim from the source.
 *
 * It is barely fitted at all, in the event. The header's table lists
 * fourteen independent landmarks read off the reference at 5 fps, and
 * 4.8 puts thirteen of them within 0.2 s. It is also confirmed from the
 * other end without reference to any of them: the scene's own
 * choreography sums to 43.0 s, and 233 + 4.8 + 43.0 = 280.8 is where
 * the video's next black gap starts and where Scene07_1's first frame
 * sits. A lead-in fitted to the opening should not also predict the
 * closing frame forty-three seconds later unless it is right.
 *
 * The 4.8 s is Scene06's tail. That scene runs 154 → 233 by declaration
 * and is the one the editor cut hardest (report §0); its overrun lands
 * here as this scene's late start, and does not disturb anything inside
 * it.
 */
const START_OFFSET = 4.8

/**
 * The code panel's monospace grid, all three of it, measured off
 * f_01310 (see the ledger note in the header for the derivation and the
 * cost). `COL0` is the CENTRE of column zero, not its left edge.
 */
const COL0 = -391.4
const ADVANCE = 8.516
const HALF_PITCH = 17.2

/**
 * The panel's content and its layout, as (text, indent column, row).
 * Rows count HALF-pitches from the top line, which is what makes the
 * blank line after `cylinder = Cylinder()` (three halves) and the
 * wrapped continuation of the `Transform` call (one half) come out
 * right without a special case for either.
 *
 * The text is transcribed from the reference, which is legible
 * character by character on f_01290 and f_01310 — and it is the code
 * that builds the cylinder in the other panel, which is the joke the
 * whole scene is making.
 */
const CODE_LINES: { text: string; col: number; row: number }[] = [
  { text: "def construct(self):", col: 0, row: 0 },
  { text: "cylinder = Cylinder()", col: 4, row: 2 },
  { text: "self.add(cylinder)", col: 4, row: 5 },
  { text: "self.play(Create(cylinder))", col: 4, row: 7 },
  { text: "self.play(Transform(cylinder,", col: 4, row: 9 },
  { text: "h=PI/4, p=PI/6))", col: 12, row: 10 },
  { text: "self.play(UnCreate(cylinder))", col: 4, row: 12 },
  { text: "self.finish()", col: 4, row: 14 },
]

/**
 * The top line's world y — the row-0 datum of the grid above.
 *
 * The reference's own top line has its ink CENTRED at world y 121.5,
 * and core's Text anchors on the BASELINE, so the datum is that centre
 * dropped by the distance from a baseline to the middle of a line of
 * ink. Measured rather than assumed: placed at 121.5 flat, all six
 * clean lines rendered a consistent 6.5 px (5.08 world units) high, so
 * the datum is 121.5 − 5.1.
 */
const CODE_TOP = 116.4

/**
 * The panel's glyph size, set by the reference's own ink.
 *
 * Measured on f_01310 a code line's ink band is 18-20 px tall (the
 * clean lines read 18, 20, 20, 20, 20, 18), which at 1.28 px/unit is
 * about 15 world units of cap-plus-descender. Arimo at `size` renders a
 * band of roughly 1.5·size px here — a first cut at 20 gave 30 px
 * against the reference's 19 and tripled the panel's ink — so the size
 * that lands the band is 20 · 19/30 ≈ 12.7.
 */
const CODE_SIZE = 12.7

export class Scene07Dream extends Dream {
  // Text("code", x=-200, z=-15) / Text("idea", x=200, z=-15). pydeation's
  // z is our y, so the words ride 15 units BELOW centre — which is the
  // baseline offset that puts their x-height on the arrow's line.
  code = new Text({ content: "code", x: -200, y: -15, size: 50, tint: BLUE })
  idea = new Text({ content: "idea", x: 200, y: -15, size: 50, tint: RED })

  // Rectangle(300×300, x=∓250, solid=True). `solid=True` is a fill
  // STATE, not a construction flag — the panels arrive already flooded,
  // which is what the morph delivers and what `Fill(transparency=1)`
  // then drains one second later.
  frameCode = new Rectangle({
    width: 300,
    height: 300,
    x: -250,
    tint: BLUE,
    fillOpacity: 1,
    stroke: STROKE_MAIN,
  })
  frameIdea = new Rectangle({
    width: 300,
    height: 300,
    x: 250,
    tint: RED,
    fillOpacity: 1,
    stroke: STROKE_MAIN,
  })
  frames = new Group({ members: [this.frameCode, this.frameIdea] })

  /**
   * The code panel — one Text per line, centred on the grid. See the
   * ledger note in the header: the CENTRES are the reference's, the
   * advances are Arimo's, and the reference's syntax colouring is not
   * reproduced.
   *
   * Held as the line array as well as the Group, because a Text reads
   * its OWN `opacity` in the renderer (render/text.ts: the glyph
   * material's fade and the visibility gate both come off
   * `holon.opacity.value`) and does not inherit its parent's. So the
   * panel's reveal has to reach each line, and the Group is here for
   * the transform and the outline rather than for the fade.
   */
  codeLines = CODE_LINES.map(
    ({ text, col, row }) =>
      new Text({
        content: text,
        // The line's centre = column 0's centre, plus the indent, plus
        // half the line's own length — a monospace centre, computed
        // rather than measured per line.
        x: COL0 + ADVANCE * (col + text.length / 2),
        y: CODE_TOP - HALF_PITCH * row,
        size: CODE_SIZE,
        tint: WHITE,
        // A THIN stroke, and the size is why. `Text.stroke` is the
        // outline the Write cascade draws before each letter floods,
        // stated in screen pixels, and the renderer insets the traced
        // contour by half of it to keep the outline inside the
        // letterform. At the title sizes the rest of the corpus uses
        // (50) the default 5 is invisible against the glyph; at 12.7 it
        // is most of the glyph, and a first cut at the default rendered
        // the panel as a column of white blobs with no letters in them.
        // The panel never writes anyway — it fades in whole — so the
        // outline has no work to do here beyond not eating the text.
        stroke: 1,
      }),
  )
  codeSnippet = new Group({ members: this.codeLines })

  // Connection((0,0,0), (100,0,0), x=-450, y=2) — the program counter.
  // Fixed coordinates again, so a Line again (see `link` above); its
  // points are stated in the holon's own space and `x=-450` places it,
  // which is what the source's own `x=` argument does. A 100-unit arrow
  // whose tail sits at world −450, just outside the blue panel's left
  // edge at −400, with its single head pointing INTO the panel.
  // pydeation's y is our z, so `y=2` is a 2-unit lift off the panel
  // plane that keeps the two out of z-fighting.
  arrow = new Line({
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
    ],
    arrowEnd: true,
    x: -450,
    z: 2,
    stroke: STROKE_MAIN,
  })

  // Cylinder(x=250) — in the right panel, at its centre.
  cylinder = new Cylinder({ x: 250, stroke: STROKE_MAIN })

  // The Venn diagram: Circle(radius=100, z=-95, BLUE) INSIDE
  // Circle(radius=200, RED). `solid=False` on both — these are the one
  // pair in the scene that never floods, and the reference shows them
  // as bare outlines throughout.
  circleCode = new Circle({ radius: 100, y: -95, tint: BLUE, stroke: STROKE_MAIN })
  circleIdea = new Circle({ radius: 200, tint: RED, stroke: STROKE_MAIN })
  vennDiagram = new Group({ members: [this.circleCode, this.circleIdea] })

  // Connection((-100,0,0), (100,0,0), arrow_start=True) — the
  // double-headed arrow between the words, 200 units across the centre.
  //
  // A `Line` rather than a `Connection`, and the two arrowheads are why.
  // pydeation's `Connection` takes bare COORDINATE TUPLES here, not
  // objects: `(-100,0,0)` and `(100,0,0)` are fixed points, so there is
  // nothing for a Connection's anchor tracking to track, and the curve
  // it would fit through two points is the straight segment anyway.
  // What core's Connection does NOT expose is the arrow flags — they
  // live on the `Line` it composes internally (parts/primitives.ts:
  // Line.arrowStart / .arrowEnd), and `arrowEnd` is already true by that
  // Line's default, which is what makes a plain Connection
  // single-headed. Reaching through the wrapper to set the inner Line's
  // flag is both uglier than saying `Line` and, in the event, wrong:
  // the head is built from the line's points when the host attaches it,
  // and a Connection's points are derived later, so the start cap lands
  // on top of the end cap and renders as a diamond.
  //
  // So: the straight thing is stated as a straight thing. The offsets
  // the source does not ask for are not invented either — pydeation's
  // `Connection` defaults `offset_start`/`offset_end` to 0.1, but those
  // trim a curve back from ANCHOR OBJECTS, and this arrow has none.
  // f_01230 confirms it runs the full 200 units: measured tip to tip at
  // screen x 525-756, i.e. world −90 to +90 to the tips of two 10-unit
  // caps on a 200-unit line.
  link = new Line({
    points: [
      { x: -100, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
    ],
    arrowStart: true,
    arrowEnd: true,
    stroke: STROKE_MAIN,
  })

  unfold() {
    // CONFIG camera_perspective "front", camera_zoom 1.
    this.observer.look("front")


    // Everything the source `add`s is staged and then taken back to
    // nothing, exactly as `self.add` means in pydeation: present from
    // the first frame, undrawn.
    this.stage(this.link)
    this.stage(this.code)
    this.stage(this.idea)
    this.stage(this.frames)
    this.stage(this.cylinder)
    this.stage(this.arrow)
    this.stage(this.vennDiagram)
    this.stage(this.codeSnippet)
    this.set(
      UnCreate(this.link),
      UnCreate(this.frames),
      UnCreate(this.cylinder),
      UnCreate(this.arrow),
      UnCreate(this.vennDiagram),
      this.code.creation.to(0),
      this.idea.creation.to(0),
    )
    // The panels are morph destinations: their outlines are complete
    // and their interiors flooded from the first frame (`solid=True`),
    // and OPACITY alone keeps them out of the first fourteen seconds.
    // Same reading as Scene01's circle and rectangle.
    this.set(
      this.frameCode.creation.to(1),
      this.frameIdea.creation.to(1),
      this.frameCode.fillOpacity.to(1),
      this.frameIdea.fillOpacity.to(1),
      FadeOut(this.frameCode),
      FadeOut(this.frameIdea),
    )
    // The code panel is revealed by `Fill`, so it starts invisible —
    // written in full (creation 1: no letter cascade, the panel is not
    // typed on) and faded out, per line.
    this.set(
      ...this.codeLines.flatMap((line) => [line.creation.to(1), line.opacity.to(0)]),
    )

    this.wait(START_OFFSET)
    this.wait(1)

    // DrawThenFillCompletely(code, idea) — on a Text that IS Write, the
    // per-letter domino of draw-then-fill (parts/text.ts).
    this.play(together(Write(this.code), Write(this.idea)), 3)
    this.play(Create(this.link), 1)
    this.wait(9)

    // THE FIRST MORPH — the words become the panels. See the header:
    // the reference does this per letter and core's Text has no
    // per-letter outlines, so what is stated here is the morph's two
    // ENDS over its own three-second span. The words un-write while the
    // panels arrive whole and already flooded, which is what a morph
    // delivers at u = 1.
    this.play(
      together(
        UnWrite(this.code),
        UnWrite(this.idea),
        this.frameCode.opacity.to(1),
        this.frameIdea.opacity.to(1),
      ),
      3,
    )
    // Fill(frames, transparency=1) DRAINS them — `transparency` is the
    // source's own unit and core's Fill animates 1 − it, so this empties
    // the panels to bare outlines. Reads backwards from the verb's name
    // until you check f_01276 (flooded) against f_01278 (hollow), one
    // second apart.
    this.play(
      together(
        Fill(this.frameCode, { transparency: 1 }),
        Fill(this.frameIdea, { transparency: 1 }),
      ),
      1,
    )
    // Fill(code_snippet) — the panel appears. In the source this reveals
    // a textured plane; here it fades in eight lines of real text.
    this.play(together(...this.codeLines.map((line) => line.opacity.to(1))), 1)
    this.play(Create(this.arrow), 2 / 3)
    this.play(Create(this.cylinder), 2)
    // The three arrow stops are RELATIVE and they compose: 0 → −32 → −84
    // (see the header). Each lands on the code line whose effect the
    // right-hand panel performs next.
    this.play(this.arrow.y.by(-32), 2 / 3)
    // Transform(cylinder, h=PI/3, p=PI/4). pydeation's h is our b and
    // its p our x-tilt, the same reading Scene01 makes of this object.
    this.play(together(this.cylinder.b.by(PI / 3), this.cylinder.p.by(PI / 4)), 2)
    this.play(this.arrow.y.by(-52), 2 / 3)
    this.play(UnCreate(this.cylinder), 2)
    this.play(
      together(Erase(this.arrow), ...this.codeLines.map((line) => line.opacity.to(0))),
      1,
    )
    this.play(FadeOut(this.link), 1)

    // THE SECOND MORPH — the panels become the Venn diagram, and the two
    // words move to their places inside it while they are gone.
    //
    // Both `Transform`s are `relative=False`, and that is a FULL
    // ABSOLUTE POSE, not a single-channel move: pydeation's
    // `transform()` declares every channel with a default in its own
    // signature and, in the absolute branch, takes the unnamed ones at
    // those literal defaults (object.py:340-393 — `input_values = [x, y,
    // z, …]`, with the current values used only to filter out the
    // channels that would not move). So naming only `z` sends x home to
    // ZERO as well, and the two words converge on the centre line as
    // they drop and rise.
    //
    // f_01354 measures it: "idea" is ink x[582,698] and "code" x[573,707],
    // both centred on 640 — world x = 0 — where they began at ∓200. The
    // first cut of this scene moved only y and left them out at ∓200,
    // which the composite showed as two green words stranded outside the
    // circles while the reference's sat inside. Scene07_1's own
    // `Transform(idea1, scale=3/2, relative=False)` is the same rule
    // seen from the other side, and its header derives it at length.
    this.play(
      together(
        this.frameCode.opacity.to(0),
        this.frameIdea.opacity.to(0),
        Create(this.circleCode),
        Create(this.circleIdea),
        this.code.x.to(0),
        this.code.y.to(-110),
        this.idea.x.to(0),
        this.idea.y.to(80),
        UnWrite(this.code),
        UnWrite(this.idea),
      ),
      2,
    )
    // And they write themselves back on, in their new home.
    this.set(this.code.creation.to(0), this.idea.creation.to(0))
    this.set(this.code.erasure.to(0), this.idea.erasure.to(0))
    this.play(together(Write(this.code), Write(this.idea)), 1)
    this.wait(5)
    this.play(together(UnWrite(this.code), UnWrite(this.idea)), 3)
    this.play(together(UnCreate(this.circleCode), UnCreate(this.circleIdea)), 3)
  }
}

if (import.meta.main) render(Scene07Dream)
