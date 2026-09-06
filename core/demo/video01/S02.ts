/**
 * S02.ts — A DreamWeaving
 *
 * video-01 "Dialectical Thinking" (2021), Scene 02 — the split screen.
 *
 * One white line divides the world. On the left a blue circle and the
 * creature that only ever sees circles; on the right a red rectangle and
 * the creature that only ever sees rectangles. Each looks at its own
 * shape and finds it: three sight lines reach out, three crosses mark
 * where looking touches the thing — empiricism, and it works. Then the
 * camera leans in and each side proves its shape: the circle gets its
 * unit-circle axes with sin and cos dropped from the 45-degree point,
 * the rectangle gets its four right angles — mathematics, and that works
 * too. The camera leans back out, and a third creature, white and
 * belonging to neither side, is born at the far left and flies a great
 * arc under BOTH of them before it goes. Then the divider goes, and
 * finally the two shapes.
 *
 * Source (refs/video-01-source-2022/dialectical_thinking.py:52-186), a
 * TwoDScene at camera_position (0, 0) and camera_zoom 1:
 *
 *   play(Create(circler, rectangler, shapes), run_time=4)
 *   wait(2)
 *   play(DrawSteady(sight_lines_rectangle, sight_lines_circle, draw_speed=200))
 *   play(Glimpse(intersection_points_*, rel_end_point=1/4),
 *        Erase(sight_lines_*), run_time=1)
 *   wait(3)
 *   play(ChangeParams(camera, zoom=7/4), UnCreate(circler, rectangler))
 *   play(Create(circle_axes), Create(radial, sin, cos, sin_text, cos_text),
 *        Create(rectangle_mathematics))
 *   wait(1)
 *   play(UnCreate(circle_axes), Erase(math), Erase(rectangle_mathematics))
 *   play(ChangeParams(camera, zoom=1))
 *   wait(1)
 *   play(Create(cylinderer), run_time=2)
 *   play(MoveAlongSpline(cylinderer, spline=path), run_time=2)
 *   wait(1)
 *   play(UnCreate(cylinderer))
 *   wait(1)
 *   play(UnCreate(separator))
 *   play(UnCreate(circle, rectangle))
 *
 * 26.0s exactly, and the reference agrees to a frame: nothing is lit at
 * video 32.0 (f0160), the first pixels arrive at 32.2 (f0161), and the
 * last leave just after 58.0 (f0290 holds 111 pixels, f0291 none).
 *
 * THE WORLD MAPPING. pydeation is a top-view system: its content lives
 * in the XZ plane and its camera looks down C4D's -Y with +X to screen
 * right and +Z to screen up. Ours is the XY plane seen head on, so every
 * source `z` becomes our `y`, and the legacy heading `h` — a rotation
 * about the axis the top-view camera looks along — becomes our `b`.
 * Measured on the reference: the blue circle at source x = -150 sits at
 * screen x = 452.5 and the red rectangle at +150 at 827.5, i.e. ∓187.5px
 * about the centre, so +x is screen right and the projection runs at
 * 1.2512 px per world unit.
 *
 * THE CAMERA. A TwoDScene is C4D's PARALLEL top projection
 * (camera.py:53-62 sets CAMERA_PROJECTION = 6 and CAMERA_ZOOM directly),
 * so the observer is orthographic and its zoom is the framing ratio, not
 * a distance: 1023 / zoom world units across the frame. At zoom 1 that
 * is 1023 units over 1280px = 1.2512 px/unit, which is exactly what the
 * frames measure — four ways over (circle centre, rectangle centre,
 * rectangle 100x200 extents, separator span). Scene 02 is the ONLY scene
 * in video-01 that moves its camera, and it moves it only in zoom.
 */

import { Dream, render } from "../../src/index"
import { orthoHalfHeight } from "../../src/dream"
import { Holon } from "../../src/holon"
import { together, eased, type Anim, type Windowed } from "../../src/anim"
import { Create, UnCreate, Erase } from "../../src/verbs"
import { PI } from "../../src/constants"
import { Arc, Circle, Cross, DottedLine, Line, Rectangle } from "../../src/parts/index"
import { Axes } from "../../vocabulary/Axes/Axes"
import { Eye } from "../../vocabulary/Eye/Eye"
import { Text, Write, UnWrite } from "../../src/parts/text"
import { EllipticalRail, MoveAlong } from "../../src/parts/paths"
import { BLUE, RED, WHITE, STROKE_MAIN, STROKE_GRID } from "./palette"

/**
 * The measured scene-start offset, in the gauntlet's localT =
 * videoSec - 32 frame.
 *
 * The boundary itself is exact — f0160 (video 32.0) is black and f0161
 * (32.2) already carries 307 lit pixels — so the scene's own t = 0 sits
 * essentially on the span start, and this is only the residue. It is
 * measured rather than swept, three independent times, and the three
 * agree to a hundredth of a second:
 *
 *   - the separator's draw front fitted against the standard ease over
 *     f0161-f0179 (nineteen frames, the front read to the pixel, solved
 *     jointly with the drawn half-length) puts t = 0 at +0.04;
 *   - the zoom-IN, read as the red rectangle's height over f0214-f0222,
 *     starts at localT 11.03 against the cursor's 11.00 — +0.03;
 *   - the zoom-OUT, read the same way over f0235-f0241, starts at 15.03
 *     — +0.03 again.
 *
 * Three anchors 15 seconds apart landing within 0.01s of each other is
 * what says this is a constant offset and not accumulating drift, which
 * is the thing a per-play fudge would have hidden.
 */
const START_OFFSET = 0.035

/** Half the diagonal contact offset: the circle's 45-degree point, 50/√2. */
const CONTACT = 50 / Math.SQRT2

/**
 * The frame's own half height in world units at zoom 1 — the length the
 * separator actually draws over (see the separator's own note).
 */
const SEPARATOR_HALF = orthoHalfHeight(1, 16 / 9)

/**
 * Sketch & Toon's dotted preset at this scene's zoomed-in camera.
 *
 * The pattern is stated in screen pixel units and the droppers are only
 * ever seen at zoom 7/4, i.e. 2.19 px per world unit; the reference
 * (f0230, the cos dropper read column by column) lays down a 5px dash on
 * a 12px period, so 2.3 world units on and 3.2 off.
 */
const DASH = 2.3
const GAP = 3.2

/**
 * The Glimpse windows, in the fractions of its play the 2021 relative-
 * time algebra actually produces.
 *
 * `Glimpse(points, rel_end_point=1/4)` reads as "a quarter of the span",
 * but rel_end_point lands on the LEAF animations (object.py:291), inside
 * both the Draw group's (0.01, 1) and then the Glimpse group's (0, 0.5)
 * and (0.5, 1) — so the mark blooms over (0.005, 0.129) and is eaten
 * over (0.505, 0.629) of the play, not over its first quarter. The
 * reference settles it: the crosses are absent at video 39.0, complete
 * at 39.2 AND 39.4, half gone at 39.6 and gone by 39.8.
 */
const GLIMPSE_DRAW: [number, number] = [0.005, 0.129]
const GLIMPSE_ERASE: [number, number] = [0.505, 0.629]

/**
 * DrawSteady's pen speed, in world units per second.
 *
 * `draw_speed=200` is 200 Sketch & Toon pixel units per second, and
 * those are pixels at the 700-line base height (scene.py:69-74), so
 * 200 * 720/700 = 205.7 screen px/s, which at this camera's 1.2512
 * px/unit is 164.4 world units/s. The reference's own reading agrees:
 * the circle-side sight lines advance ~38px per 0.2s frame step across
 * f0191-f0195, dead linear.
 */
const DRAW_SPEED = (200 * (720 / 700)) / 1.2512

/** The sight lines' run_time, so a steady pen becomes a rel window. */
const SIGHT_RUN_TIME = 1

/**
 * One creature's three sight lines and the three crosses where they
 * land — the scene's whole argument for empiricism, in six strokes.
 *
 * The source builds each side as a Group of Splines at y = 1 (a float
 * above the shapes, to win the overlap) plus a Group of Crosses, both
 * inside one more Group carrying `x` and `h=PI`. Two things live in
 * that half turn. It aims the fan: the splines are authored reaching
 * one way and the group turns them the other. And it flips the fan
 * top for bottom, which is invisible here only because the fan is
 * symmetric about its own axis.
 *
 * The two sides are mirror images in the source — the circle's fan
 * reaches from local +240 in, the rectangle's from local -240 — so
 * `sign` carries the mirror and everything else is stated once.
 *
 * `contacts` is where the looking actually touches: on the circle at
 * its own 45-degree points (50/√2 out from a centre 50 from the group
 * pivot) plus the near pole at 100; on the rectangle flat against the
 * near edge at 100, at the same three heights.
 */
class Empiricism extends Holon {
  /** +1 for the circle side, -1 for the rectangle's mirror image. */
  sign = 1
  /** True on the circle side: the contacts ride the arc, not a flat edge. */
  onArc = false

  lines: Line[] = []
  marks: Cross[] = []

  /** The parts, guaranteed composed — a plain field read would not be. */
  get fan(): { lines: Line[]; marks: Cross[] } {
    void this.parts
    return { lines: this.lines, marks: this.marks }
  }

  protected override compose(): void {
    const s = this.sign
    const near = this.onArc ? CONTACT + 50 : 100
    const contacts: [number, number][] = [
      [s * near, CONTACT],
      [s * near, -CONTACT],
      [s * 100, 0],
    ]
    for (const [ex, ey] of contacts) {
      this.lines.push(
        this.add(
          new Line({
            points: [
              { x: s * 240, y: 0, z: 0 },
              { x: ex, y: ey, z: 0 },
            ],
            tint: WHITE,
            stroke: STROKE_GRID,
          }),
        ),
      )
      this.marks.push(
        this.add(new Cross({ size: 6, x: ex, y: ey, b: PI / 4, tint: WHITE, stroke: STROKE_GRID })),
      )
    }
  }
}

/**
 * The rectangle's proof — four right-angle marks and four overshooting
 * edge lines, authored around the source's 200 x 100 rectangle so the
 * group's own quarter turn lands them on the 100 x 200 one on screen.
 *
 * Group(right_angles, straight_lines, h=PI/2, x=150). Each Arc opens
 * from its corner INTO the rectangle (the corner's own quadrant, turned
 * by k * PI/2 around the four of them); each Spline runs 10 units past
 * both ends of the edge it marks.
 */
class RectangleMathematics extends Holon {
  angles: Arc[] = []
  edges: Line[] = []

  protected override compose(): void {
    const corners: [number, number, number][] = [
      [-100, -50, 0],
      [100, -50, PI / 2],
      [100, 50, PI],
      [-100, 50, -PI / 2],
    ]
    for (const [x, y, b] of corners) {
      this.angles.push(
        this.add(
          new Arc({
            radius: 20,
            x,
            y,
            b,
            startAngle: 0,
            endAngle: PI / 2,
            tint: WHITE,
            stroke: STROKE_MAIN,
          }),
        ),
      )
    }
    const edges: [number, number, number, number][] = [
      [-110, 50, 110, 50],
      [-110, -50, 110, -50],
      [-100, 60, -100, -60],
      [100, 60, 100, -60],
    ]
    for (const [ax, ay, bx, by] of edges) {
      this.edges.push(
        this.add(
          new Line({
            points: [
              { x: ax, y: ay, z: 0 },
              { x: bx, y: by, z: 0 },
            ],
            tint: WHITE,
            stroke: STROKE_GRID,
          }),
        ),
      )
    }
  }
}

export class S02Dream extends Dream {
  // --- shapes -------------------------------------------------------
  //
  // Circle(x=-150, radius=50, color=BLUE). The pen starts at the
  // 45-degree point and runs CLOCKWISE — f0161-f0175 draw the right
  // flank down first and close at the top — which is pydeation's XZ
  // winding seen from the front, the same reading Scene 04 settled.
  circle = new Circle({
    radius: 50,
    tint: BLUE,
    x: -150,
    drawStart: 1 / 8,
    drawReversed: true,
    stroke: STROKE_MAIN,
  })
  // Rectangle(x=150, h=PI/2, height=100, width=200, color=RED). The
  // legacy quarter turn swaps the stated 200x100 to 100 wide by 200
  // tall on screen; stating it that way directly leaves the outline's
  // arc length — and so its draw phase — identical, and the reference
  // draws it exactly as Scene 04 draws its own: right edge downward
  // from the top-right corner, then the bottom, the left, the top.
  rectangle = new Rectangle({
    width: 100,
    height: 200,
    tint: RED,
    x: 150,
    drawStart: 5 / 12,
    drawReversed: true,
    stroke: STROKE_MAIN,
  })
  // Spline([(0, 0, -500), (0, 0, 500)]) — the divider, drawn bottom to
  // top.
  //
  // Stated at the FRAME's half height, not the source's 500, and that is
  // a rendering fact rather than a liberty. Sketch & Toon clips a stroke
  // to the render frame BEFORE it parametrizes the draw-on, so a spline
  // running off both edges draws over the part you can see, not over its
  // geometry. Fitting the reference's front against the standard ease
  // across f0161-f0179 (nineteen frames, the front measured to the
  // pixel) solves the half-length at 289 units with a residual of 1.6
  // units RMS — the frame's own 287.7, not 500, which would put the
  // front off-screen for the first 1.2s and off again after 2.9s. At the
  // source's length the reference would be blank at t = 1 and settled at
  // t = 3; it is neither.
  separator = new Line({
    points: [
      { x: 0, y: -SEPARATOR_HALF, z: 0 },
      { x: 0, y: SEPARATOR_HALF, z: 0 },
    ],
    tint: WHITE,
    stroke: STROKE_GRID,
  })

  // --- creatures ----------------------------------------------------
  //
  // Eye(scale=0.3, x=-400, color=BLUE) — gazing along +x at its circle.
  circler = new Eye({ scale: 0.3, x: -400, tint: BLUE, stroke: STROKE_MAIN })
  // Eye(scale=0.3, x=400, h=PI, color=RED) — the legacy heading is our
  // bank; a half turn aims it back along -x at its rectangle.
  rectangler = new Eye({ scale: 0.3, x: 400, b: PI, tint: RED, stroke: STROKE_MAIN })
  // Eye(scale=0.3, color=WHITE, b=PI) — the third creature. The source
  // leaves it at the origin, but its align-to-spline constraint exists
  // from the moment the document is built, so it is born at the RAIL's
  // start, world (-400, 0), gazing +x: f0246-f0255 create it in exactly
  // the blue Eye's footprint, x 138..222 to the pixel. The legacy b is
  // the constraint's own orientation correction, which the tangential
  // reading below subsumes.
  cylinderer = new Eye({ scale: 0.3, x: -400, tint: WHITE, stroke: STROKE_MAIN })

  // --- empiricism ---------------------------------------------------
  //
  // Group(sight_lines_circle, intersection_points_circle, x=-100, h=PI):
  // the fan reaches from world (-340, 0) — just behind the blue Eye's
  // iris — to the circle's own 45-degree points and its near pole.
  circleEmpiricism = new Empiricism({ x: -100, b: PI, sign: 1, onArc: true })
  // Group(sight_lines_rectangle, …, x=100, h=PI): the same fan mirrored,
  // landing on the rectangle's right edge at x = 200.
  rectangleEmpiricism = new Empiricism({ x: 100, b: PI, sign: -1, onArc: false })

  // --- circle mathematics -------------------------------------------
  //
  // Axes(mode="xz", length_x=120, length_z=120, draw_ticks=False,
  // thickness=3) — the unit-circle frame, reaching 60 units each way so
  // its arrowheads clear the radius-50 arc.
  circleAxes = new Axes({
    mode: "xy",
    xStart: -60,
    xEnd: 60,
    yStart: -60,
    yEnd: 60,
    x: -150,
    drawGrid: false,
    drawTicks: false,
    arrowEnd: true,
    tint: WHITE,
    stroke: STROKE_GRID,
  })
  // Spline([(0,0,0), (r/√2, 0, r/√2)]) — the radius at 45 degrees.
  radialLine = new Line({
    points: [
      { x: 0, y: 0, z: 0 },
      { x: CONTACT, y: CONTACT, z: 0 },
    ],
    x: -150,
    tint: WHITE,
    stroke: STROKE_GRID,
  })
  // The two droppers, both authored reversed in the source so each is
  // drawn from the circle's 45-degree point back toward its axis.
  sinLine = new DottedLine({
    points: [
      { x: CONTACT, y: CONTACT, z: 0 },
      { x: 0, y: CONTACT, z: 0 },
    ],
    x: -150,
    dash: DASH,
    gap: GAP,
    tint: WHITE,
    stroke: STROKE_GRID,
  })
  cosLine = new DottedLine({
    points: [
      { x: CONTACT, y: CONTACT, z: 0 },
      { x: CONTACT, y: 0, z: 0 },
    ],
    x: -150,
    dash: DASH,
    gap: GAP,
    tint: WHITE,
    stroke: STROKE_GRID,
  })
  // Text("sin", scale=0.15, z=r/√2, x=-8) and its cos mirror: the
  // default text height of 50 scaled to 7.5 units, centre-aligned.
  sinText = new Text({ content: "sin", size: 7.5, x: -158, y: CONTACT, tint: WHITE, stroke: 0 })
  cosText = new Text({ content: "cos", size: 7.5, x: -150 + CONTACT, y: -8, tint: WHITE, stroke: 0 })

  // --- rectangle mathematics ----------------------------------------
  //
  // Group(right_angles, straight_lines, h=PI/2, x=150): authored around
  // a 200x100 rectangle and turned a quarter to land on the 100x200 one
  // on screen. Each Arc(radius=20) opens into the rectangle from its own
  // corner; each Spline overshoots its edge by 10 units.
  rectangleMath = new RectangleMathematics({ x: 150, b: PI / 2 })

  // --- the rail -----------------------------------------------------
  //
  // Arc(angle=PI, h=PI, scale_x=2, scale_z=1.3) — never drawn, only
  // flown: a half turn of a 400 x 260 ellipse, banked so the sweep runs
  // BELOW the axis. The reference's apex track (f0255-f0265) reads
  // -401, -400, -382, -316, -197, -33, +130, +270, +360, +396, +401 in
  // x against -0, -19, -83, -162, -229, -260, -248, -193, -117, -43, -1
  // in y: that ellipse, walked at its NATURAL parameter (which is what
  // C4D's align-to-spline tag does, and what parts/paths.ts settles
  // against these same eleven frames).
  rail = new EllipticalRail({ radiusX: 400, radiusY: 260 })

  unfold() {
    // TwoDScene: the parallel top projection, zoom 1.
    this.observer.orthographic.value = true
    this.observer.orthographic.defaultValue = true

    this.wait(START_OFFSET)

    // Create(circler, rectangler, shapes) — the eyes, the two shapes and
    // the divider, all drawing together over 4s.
    this.play(
      together(
        Create(this.circler),
        Create(this.rectangler),
        Create(this.circle),
        Create(this.rectangle),
        Create(this.separator),
      ),
      4,
    )
    this.wait(2)

    // DrawSteady(sight_lines, draw_speed=200): a constant pen, so every
    // line is linear and each finishes at its own length / speed.
    this.play(eased("linear", this.steadyFan()), SIGHT_RUN_TIME)

    // Glimpse(crosses, rel_end_point=1/4) + Erase(sight_lines): the
    // marks bloom and are eaten inside the first two thirds of the span
    // while the fan sweeps away from the eye outward.
    this.play(
      together(
        this.glimpseMarks(),
        Erase(this.circleEmpiricism),
        Erase(this.rectangleEmpiricism),
      ),
      1,
    )
    this.wait(3)

    // ChangeParams(camera, zoom=7/4) + UnCreate(circler, rectangler).
    this.play(
      together(
        this.observer.zoom.to(7 / 4),
        UnCreate(this.circler),
        UnCreate(this.rectangler),
      ),
      1,
    )

    // Create(circle_axes) + Create(radial, sin, cos, labels) +
    // Create(rectangle_mathematics) — both proofs at once.
    this.play(
      together(
        Create(this.circleAxes),
        Create(this.radialLine),
        Create(this.sinLine),
        Create(this.cosLine),
        Write(this.sinText),
        Write(this.cosText),
        Create(this.rectangleMath),
      ),
      1,
    )
    this.wait(1)

    // UnCreate(circle_axes) + Erase(the rest): the axes sweep away from
    // their own start, and so does everything hung on them.
    this.play(
      together(
        UnCreate(this.circleAxes),
        Erase(this.radialLine),
        Erase(this.sinLine),
        Erase(this.cosLine),
        UnWrite(this.sinText),
        UnWrite(this.cosText),
        Erase(this.rectangleMath),
      ),
      1,
    )

    // ChangeParams(camera, zoom=1) — back out.
    this.play(this.observer.zoom.to(1), 1)
    this.wait(1)

    // Create(cylinderer) — the third creature, born at the rail's head.
    this.play(Create(this.cylinderer), 2)
    // MoveAlongSpline(cylinderer, path) — tangential, so its gaze is the
    // ellipse's inward normal the whole way round.
    //
    // The (0.01, 1) window is the source's own: MoveAlongSpline is an
    // AnimationGroup of `enable_spline_tag` over (0, 0.01) and
    // `animate_position` over (0.01, 1) (animator.py:1054), so the
    // flight starts a fiftieth of a second into its play and runs 1.98s,
    // not 2. It is 20ms, and it is worth stating: with it, the scene's
    // own start offset and the framework's smoothing land all eleven
    // measured apex positions within 6.4px with NOTHING fitted.
    this.play(together([MoveAlong(this.cylinderer, this.rail), 0.01, 1]), 2)
    this.wait(1)
    this.play(UnCreate(this.cylinderer), 1)
    this.wait(1)
    this.play(UnCreate(this.separator), 1)
    this.play(together(UnCreate(this.circle), UnCreate(this.rectangle)), 1)
  }

  /**
   * DrawSteady over both fans: every line starts together and runs
   * linearly at DRAW_SPEED, so a 158-unit sight line takes 0.96s of the
   * 1s play and a 140-unit one 0.85s.
   */
  private steadyFan(): Anim {
    const items: Windowed[] = []
    for (const side of [this.circleEmpiricism, this.rectangleEmpiricism]) {
      for (const line of side.fan.lines) {
        const a = line.points[0]!
        const b = line.points[1]!
        const span = Math.hypot(b.x - a.x, b.y - a.y) / DRAW_SPEED / SIGHT_RUN_TIME
        items.push([line.creation.sequence(0, 1), 0, Math.min(1, span)])
      }
    }
    return together(...items)
  }

  /** Glimpse: each mark draws, then erases, inside its own two windows. */
  private glimpseMarks(): Anim {
    const items: Windowed[] = []
    for (const side of [this.circleEmpiricism, this.rectangleEmpiricism]) {
      for (const mark of side.fan.marks) {
        items.push([Create(mark), GLIMPSE_DRAW[0], GLIMPSE_DRAW[1]])
        items.push([Erase(mark), GLIMPSE_ERASE[0], GLIMPSE_ERASE[1]])
      }
    }
    return together(...items)
  }
}

if (import.meta.main) render(S02Dream)
