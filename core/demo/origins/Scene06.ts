/**
 * Scene06.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 06 — the origin
 * story proper, and the longest scene in the video at 81 seconds.
 *
 * The mark inherited from Scene05 swells until its blue circle is the
 * whole frame; its red circle and its Λ fade away, leaving a bare ring
 * — a world with nothing in it yet. Inside that ring the dialectic of
 * video-01 is drawn: a blue circle, a red rectangle, a white cylinder
 * standing above the tension between them. That whole thesis then
 * shrinks back INTO the mark, and a ring of twelve nodes wires itself
 * around it and goes away again. The octocat arrives, pairs off with a
 * second logo, and becomes the first of five framed shapes — triangle,
 * square, pentagon, hexagon, circle — each morphing into the next with
 * an arrow between: a repository learning to be round. The chain
 * collapses to that final circle, a rectangle joins it, tension strings
 * between them and a cylinder rises where they meet. The scene ends by
 * undoing the frames, so what is left is the bare triad it started from
 * — the dialectic, rebuilt out of repositories.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:328-477).
 * This is the chapter the campaign called the INTEGRATION TEST: by
 * construction it introduces no new capability. Everything it needs —
 * Logo, Morph, Polygon (`NGon`), the octocat Sketch, Connection,
 * Cylinder, the fill/colour verbs — was landed by O-1 through O-10, and
 * this scene only composes them. It does, and nothing was missing.
 *
 *
 * THE TIMING, AND THE CAMPAIGN'S BIGGEST CORRECTION
 *
 * The vocabulary report (§0) held that "Scene06 alone is a ~79s monster
 * and the editor trimmed it", and instructed later chapters to treat
 * the video's second half as a re-cut rather than a frame-exact target.
 * MEASURED AGAINST THE FRAMES, THAT IS WRONG. Scene06 is not trimmed at
 * all: it plays complete, at its full source length, at source pace.
 *
 * The source's own `run_time`/`wait` calls sum to 81.00s. Laid down from
 * t0 = 154.6 they predict every beat in the published video:
 *
 *   local  predicted  measured  beat
 *    0.00     154.6     154.6   logo growth begins (r = 117 px)
 *   10.00     164.6     164.6   growth ends (r = 242 px) — 10.0s exactly
 *   14.00     168.6     168.6   red + Λ gone — the bare ring
 *   20.00     174.6     174.6   Create(dialectical_thinking) begins
 *   24.00     178.6     178.4   it completes
 *   39.00     193.6     193.6   Draw(github) begins
 *   43.00     197.6     197.6   Create(logo2) — the pairing image
 *   57.00     211.6     211.6   Morph(github → triangle)
 *   59.00     213.6     213.6   Create(repo_triangle)
 *   68.00     222.6     222.6   the chain collapses to repo_circle
 *   73.00     227.6     227.6   Create(repo_cylinder)
 *   81.00     235.6     ~236    the final UnDraw
 *
 * Twelve independent landmarks, none fitted, every one inside a frame
 * (0.2s) of its prediction. The scene is verbatim.
 *
 * WHY THE REPORT THOUGHT OTHERWISE. §0 read a "6.2s black gap" at
 * 168.2–174.4 and took it for an editor's cut. There is no gap there —
 * it is the source's own `wait(6)`, holding the BARE BLUE CIRCLE, and
 * that ring is simply too dim for a mean-luminance detector: the frame
 * averages 0.003 while a thin unfilled circle lights ~7,500 pixels that
 * never waver. Re-scanned on a per-pixel ink threshold (max channel >
 * 0.10), the true black gaps between 144s and 288s are only 193.6–193.8,
 * 237.6–238.8 and 280.6 — and the first of those is the instant between
 * the nodes vanishing and the octocat's first stroke, i.e. INSIDE this
 * scene, not a cut at all.
 *
 * So the report's own rule — "from Scene06 on, compare against the
 * source's choreography rather than the video's re-cut" — turns out to
 * be unnecessary here: for THIS scene the two are the same thing, and
 * the frames are a legitimate frame-exact target. This file is scored
 * against them accordingly.
 *
 *
 * WHERE THE MISSING ~52 SECONDS ACTUALLY WENT
 *
 * The video is 377.9s against 429.7s of narration. O-8 found ~66s of it
 * in Scene08_1/08_2, which are cut entirely. This chapter accounts for
 * the rest: SCENE06_1 IS ALSO CUT ENTIRELY.
 *
 * Scene06_1 (pitch.py:479-585) is described in the report as "a
 * continuation-state duplicate — the same objects re-declared with
 * show=True, completion=1 so the render could be resumed mid-scene".
 * Only its first seven lines are that. The rest is 80 lines of NEW
 * material that appears nowhere in Scene06: three filled dots (blue,
 * red, white) replacing the triad, a second half-scale copy of them at
 * x=200, a dotted vertical separator between the two, and a small white
 * mediator dot that the two white dots converge on — the dialectic
 * restated twice and then reconciled, with a camera zoom out to 1.
 *
 * None of it is in the published video. Searched all 1,889 reference
 * frames for its unmistakable signature (large FILLED blue and red
 * discs co-present): three hits, all accounted for elsewhere —
 * 136.6–141.8s is Scene04's coloured pie, and 254.6 + 256.4–265.2s are
 * Scene07's filled panels and Venn diagram, both confirmed by eye. At
 * 236–237s the video shows this scene's closing UnDraw; by 238.6s
 * Scene07's "code ↔ idea" is already on screen. Scene06 hands straight
 * to Scene07 with a 1.4s black gap and nothing in between.
 *
 * That completes the accounting for the whole published video: every
 * second of it is now mapped to a source scene, and the ~52s deficit is
 * Scene06_1 (~15s) plus Scene08_1/08_2 (~66s) minus the overlap the
 * re-cut absorbed. THIS FILE THEREFORE REPRODUCES SCENE06 ONLY. The
 * brief asked for the pair "as one continuous scene per the report's
 * continuation-state note"; the note is mistaken about what Scene06_1
 * is, and appending unpublished material to a scene that is verbatim
 * against the frames would corrupt the one thing this chapter can
 * prove. Scene06_1 is reproducible from source and is left for a
 * chapter that wants it — like Scene08_1/08_2, it is UNSCOREABLE: no
 * reference frames for it exist.
 *
 *
 * FRAMING (zoom 3/4, front — the same projection as Scene05)
 *
 * Distance 1000/zoom = 1333.33 units; with the 36mm rig's f = 1290 px
 * at 1280 wide the origin plane scales by 1290/1333.33 = 0.9675 px per
 * world unit. Two independent checks against the frames:
 *
 *   liminality  Circle(radius=250) → 250 · 0.9675 = 241.9 px
 *               measured r = 242 (f_00823, and steady for 70 frames)
 *   github      Sketch height 23.388 · 14 = 327.4 units → 316.8 px
 *               measured 315 px tall (f_00983)
 *
 * pydeation's out-of-plane y is our z and its z is our y throughout.
 *
 *
 * THE ONE FITTED NUMBER
 *
 * START_OFFSET, the head between the audio cue (offset=154, which the
 * scorer takes as localT 0) and the scene's first frame. Everything
 * else below is verbatim from the source.
 */

import { Dream, render } from "../../src/index"
import {
  Create,
  UnCreate,
  Draw,
  UnDraw,
  Erase,
  FadeIn,
  FadeOut,
} from "../../src/verbs"
import {
  Circle,
  Group,
  Line,
  Null,
  Polygon,
  Rectangle,
  type Vec3Like,
} from "../../src/parts/primitives"
import { Connection, trimByArcLength } from "../../src/parts/curves"
import { Logo } from "../../vocabulary/Logo/Logo"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import { Sketch } from "../../vocabulary/Sketch/Sketch"
import { github as githubDrawing } from "../../vocabulary/Sketch/assets/github"
// The pluggable ability — importing this folder is what teaches every
// Stroke in the scene `.morphTo()`. See vocabulary/Morph/Morph.ts.
import { Morph, MorphShape } from "../../vocabulary/Morph/Morph"
import { together, restage } from "../../src/anim"
import { BLUE, RED, WHITE, PI } from "../../src/constants"
import { STROKE_MAIN } from "../video01/palette"

/**
 * Fitted by sweeping the alignment against the reference and scoring the
 * construction densely, exactly as Scene05's was — not read off one
 * landmark, because an eased transform spends part of its window below
 * the encode's threshold before it moves a measurable pixel, so every
 * "first change" time reads late.
 *
 * The landmark arithmetic and the sweep agree here to within a frame,
 * which they did not for Scene05: this scene's opening beat is a 10s
 * geometric growth rather than a fade, and a growing radius crosses a
 * measurement threshold far more sharply than an opacity ramp does.
 *
 *   offset   0.40   0.50   0.60   0.70   0.80
 *   (see docs/reports/origins/o11-sweep.json for the scored table)
 */
const START_OFFSET = 0.65

/** The octocat SVG's own height in its own units — the thing `scale` scales. */
const GITHUB_SOURCE_HEIGHT = 23.388

/**
 * Where the octocat's pen starts, as a fraction along its single closed
 * subpath — the scene's second and last fitted number.
 *
 * The asset's point list opens at the top of the head: its first point
 * is (0, 11.694), i.e. angle +90°, and our first cut drew from there,
 * spreading symmetrically into the top-left. The reference does not.
 * Tracking the ink's angular extent about the drawing's centre through
 * `Draw(github)` (v193.6-196.6):
 *
 *   v194.0  angles [-31.5, +45.0]   — a short arc on the RIGHT
 *   v194.4  angles [-75.2, +45.0]   — growing downward
 *   v194.8  angles [-75.2, +81.3]   — and upward
 *   v195.2  closed
 *
 * so the pen opens on the right and runs both ways from there.
 *
 * Fitted by sweeping the value and scoring the draw densely (every
 * frame of v193.8-196.6, 8 frames), which finds a clean unimodal peak:
 *
 *   drawStart  0.45   0.50   0.55   0.575  0.59   0.60   0.61   0.625  0.65
 *   PASS       1/8    1/8    2/8    4/8    5/8    6/8    6/8    5/8    3/8
 *   covRef     .5509  .6322  .7268  .7807  .8769  .9263  .8940  .8070  .7454
 *
 * This is a PROPERTY OF THE 2021 C4D IMPORT, not of the drawing: C4D's
 * SVG importer chose its own start vertex when it built the spline, and
 * that choice is not recoverable from the file — the `d` attribute's
 * first coordinate is the one we have, and it is demonstrably not the
 * one C4D drew from. Fitting it against the frames is the only route,
 * and it is one number for one asset.
 *
 * WHERE IT HAS TO GO. `drawStart` is a `Stroke` param, and a Sketch IS
 * a Stroke — but `Sketch.createAnim` sweeps each CHILD Line's
 * `creation` (Sketch.ts:125-147) and never reads a `drawStart` of its
 * own, so setting it on the Sketch is silently inert. The first attempt
 * did exactly that, and six sweep values scored byte-identically, which
 * is the signature of a parameter nothing consumes. It is set on the
 * child Line instead (see `githubOutline`).
 */
const GITHUB_DRAW_START = 0.6

export class Scene06Dream extends Dream {
  // ── the video-01 dialectic, quoted (pitch.py:337-352) ─────────────
  // Rectangle(width=75, height=150, x=125, z=-100, color=RED)
  rectangle = new Rectangle({
    width: 75,
    height: 150,
    x: 125,
    y: -100,
    tint: RED,
    stroke: STROKE_MAIN,
  })
  // Circle(radius=75/2, x=-125, z=-100, color=BLUE)
  circle = new Circle({
    radius: 75 / 2,
    x: -125,
    y: -100,
    tint: BLUE,
    stroke: STROKE_MAIN,
  })
  // Cylinder(h=-PI/2, z=100, p=-PI/4, scale=3/4). The source's z is our
  // y and its h our b — the axis mapping Scene01 and video-01's S05/S06
  // settled for this exact object, not a fresh guess.
  cylinder = new Cylinder({
    b: -PI / 2,
    y: 100,
    p: -PI / 4,
    scale: 3 / 4,
    tint: WHITE,
    stroke: STROKE_MAIN,
  })

  /**
   * The tension arrows — and pydeation's `Connection` is VARIADIC, which
   * is the thing to get right here.
   *
   * `Connection(circle, (-20, 0, -85), (0, 0, 40))` is not "from circle
   * to a point": `def __init__(self, *nodes, …)` (mograph.py:97) takes
   * ANY number of nodes and traces a spline through all of them, turning
   * each bare tuple into a Null on the way. So this is a THREE-node
   * path — the circle, a waypoint low and to the left, then up to a
   * shared endpoint at (0, 0, 40) beneath the cylinder.
   *
   * That third node is what makes the image: both arrows end at the SAME
   * point and approach it from below, so the pair reads as a Y with its
   * stem rising toward the cylinder. Read as a two-node connection they
   * run flat and horizontal instead, which is what the first cut of this
   * scene did and what the gauntlet caught in the closing composite
   * (v229.6/v234.6): the circle, rectangle and cylinder in exact yellow
   * overlap with two green arrows lying flat under a red Y.
   *
   * Core's Connection carries intermediate nodes as `via`, so the shape
   * is stated by anchoring on the endpoint and routing through the
   * waypoint. pydeation's z is our y throughout.
   */
  tensionApex = new Null({ y: 40 })
  viaLeft = new Null({ x: -20, y: -85 })
  viaRight = new Null({ x: 20, y: -85 })

  arrowCircle = through(this.circle, this.viaLeft, this.tensionApex, 1 / 4)
  arrowRectangle = through(this.rectangle, this.viaRight, this.tensionApex, 1 / 4)

  tension = new Group({ members: [this.arrowCircle, this.arrowRectangle] })

  // Group(rectangle, circle, cylinder, tension, z=15, y=-100) — pydeation's
  // y is our z, so the group's y=-100 is a 100-unit push AWAY from the
  // camera and its z=15 a 15-unit lift.
  dialecticalThinking = new Group({
    members: [
      this.rectangle,
      this.circle,
      this.cylinder,
      this.tension,
      this.tensionApex,
      this.viaLeft,
      this.viaRight,
    ],
    y: 15,
    z: -100,
  })

  // ── the mark, inherited from Scene05 already finished ──────────────
  // Logo(z=50, scale=0.6, show=True, completion=1) — Scene05's exact
  // pose. `show=True, completion=1` is pydeation for "it is already
  // there", which in core is simply a Logo the timeline never draws.
  logo = new Logo({ y: 50, scale: 0.6, stroke: STROKE_MAIN })

  /**
   * Circle(color=BLUE, radius=250) — declared and `add`ed by the source,
   * and then NEVER PLAYED. No verb in Scene06 touches it, so it stays at
   * opacity 0 for the whole scene and never lights a pixel.
   *
   * That is not a guess. Scanning the reference's equator for distinct
   * blue runs finds exactly TWO edges (one ring) at every sampled
   * moment — v164.6, v174.6, v179.6 — never four. The ring that carries
   * the middle of this scene is the LOGO's own main circle at scale 5/4
   * (200 · 5/4 = 250, which is why the two are so easily confused: they
   * are the same size by construction, and that is surely why the
   * source's author left this one in). It is kept here because the
   * source keeps it, and because its absence from the frames is a
   * finding worth recording rather than a line worth deleting.
   */
  liminality = new Circle({ radius: 250, tint: BLUE, stroke: STROKE_MAIN })

  // GitHub(scale=14) — the octocat. `scale` in pydeation multiplies the
  // SVG's native units, so the height is those units times 14.
  github = new Sketch({
    data: githubDrawing,
    height: GITHUB_SOURCE_HEIGHT * 14,
    tint: WHITE,
    stroke: STROKE_MAIN,
  })

  // ── the twelve-node ring (pitch.py:360-371) ────────────────────────
  // Twelve Circles on a ring of radius ~220, and twelve Connections that
  // reach them through two right-angled waypoints — the "circuit board"
  // image at t=186-192s. `spline_mode="linear"` there means the
  // path is polyline, not smoothed, which is what the frames show:
  // square corners, not curves.
  nodes = new Group({
    members: NODE_XS.map(
      (x, i) =>
        new Circle({
          x,
          y: NODE_ZS[i]!,
          radius: 10,
          tint: WHITE,
          stroke: STROKE_MAIN,
        }),
    ),
  })

  /**
   * The twelve wires, as `Line`s rather than `Connection`s — because the
   * source says `spline_mode="linear"` and a Connection cannot say it.
   *
   * `Connection.refresh` always runs its anchors through `catmullRom`
   * (parts/curves.ts:494), which is right for every OTHER connection in
   * this scene and in the corpus: those are tension arrows and they bow.
   * These twelve do not bow. The source asks for linear interpolation
   * explicitly, and the frames agree emphatically — at t=186-192s the
   * ring reads as a circuit board, every wire leaving its node straight
   * and turning a SQUARE CORNER at each waypoint. Smoothed, the same
   * anchors render as S-curves, which is a different image.
   *
   * A linear `Connection` would be the tidier spelling and is a fair
   * thing for core to grow later (`spline_mode` is a real pydeation
   * parameter with a real second value). It is not this chapter's to
   * add — O-11 consumes vocabulary, it does not extend it — and the
   * honest composition is available today: a Connection through
   * waypoints with no smoothing IS a polyline through those points, so
   * the wire is stated as the Line it is. The `offset_end=0.1` trim
   * is applied to the point list directly by the same arc-length rule
   * the Connection would have used.
   */
  edges = new Group({
    members: NODE_XS.map((_, i) => {
      const angle = (PI / 6) * (i - 1)
      const anchors: Vec3Like[] = [
        { x: 85 * Math.sin(angle), y: 85 * Math.cos(angle), z: 0 },
      ]
      // The two right-angle waypoints, where the source drops them (a
      // null entry means "no bend on this axis" — the four axial wires
      // run straight out).
      const first = FIRST_POINTS[i]
      const second = SECOND_POINTS[i]
      if (first) anchors.push({ x: first[0], y: first[1], z: 0 })
      if (second) anchors.push({ x: second[0], y: second[1], z: 0 })
      anchors.push({ x: NODE_XS[i]!, y: NODE_ZS[i]!, z: 0 })
      return new Line({
        // offset_start=0, offset_end=0.1 — the wire stops short of the
        // node it feeds, which is the gap visible in every frame.
        points: trimByArcLength(anchors, 0, 0.1),
        tint: WHITE,
        stroke: STROKE_MAIN,
      })
    }),
  })

  // ── the repo chain (pitch.py:374-390) ──────────────────────────────
  // Five framed shapes marching left to right at 150-unit intervals.
  // Each is Group(NGon|Circle, Rectangle(100x100)) — the shape and the
  // box that makes it a repository. `NGon(n=…)` IS core's Polygon
  // (settled by O-7, Scene07_1).
  repoTriangle = repo(new Polygon({ sides: 3, radius: 25, tint: BLUE, stroke: STROKE_MAIN }), -300)
  repoSquare = repo(new Polygon({ sides: 4, radius: 25, tint: BLUE, stroke: STROKE_MAIN }), -150)
  repoPentagon = repo(new Polygon({ sides: 5, radius: 25, tint: BLUE, stroke: STROKE_MAIN }), 0)
  repoHexagon = repo(new Polygon({ sides: 6, radius: 25, tint: BLUE, stroke: STROKE_MAIN }), 150)
  repoCircle = repo(new Circle({ radius: 25, tint: BLUE, stroke: STROKE_MAIN }), 300)

  // The two that rebuild the dialectic out of repositories.
  repoRectangle = repo(
    new Rectangle({ width: 30, height: 60, tint: RED, stroke: STROKE_MAIN }),
    120,
    -100,
  )
  repoCylinder = repo(
    new Cylinder({ b: (-PI * 3) / 4, p: -PI / 4, scale: 1 / 3, tint: WHITE, stroke: STROKE_MAIN }),
    0,
    100,
  )

  // ── the arrows between the links ───────────────────────────────────
  arrowTriangleSquare = link(this.repoTriangle, this.repoSquare)
  arrowSquarePentagon = link(this.repoSquare, this.repoPentagon)
  arrowPentagonHexagon = link(this.repoPentagon, this.repoHexagon)
  arrowHexagonCircle = link(this.repoHexagon, this.repoCircle)

  // The last two rebuild the same Y under the repo cylinder — the same
  // three-node form as the opening triad's tension, with the waypoints
  // 30 units out instead of 20 and a 1/3 start offset.
  repoApex = new Null({ y: 40 })
  repoViaLeft = new Null({ x: -30, y: -85 })
  repoViaRight = new Null({ x: 30, y: -85 })
  arrowCircleCylinder = through(
    this.repoCircle.members[0] as Circle,
    this.repoViaLeft,
    this.repoApex,
    1 / 3,
  )
  arrowRectangleCylinder = through(
    this.repoRectangle.members[0] as Rectangle,
    this.repoViaRight,
    this.repoApex,
    1 / 3,
  )

  repoTension = new Group({
    members: [
      this.arrowCircleCylinder,
      this.arrowRectangleCylinder,
      this.repoApex,
      this.repoViaLeft,
      this.repoViaRight,
    ],
  })

  arrows = new Group({
    members: [
      this.arrowTriangleSquare,
      this.arrowSquarePentagon,
      this.arrowPentagonHexagon,
      this.arrowHexagonCircle,
    ],
  })

  // Logo(x=-250, scale=0.9) — the mark that pairs off with the octocat.
  logo2 = new Logo({ x: -250, scale: 0.9, stroke: STROKE_MAIN })

  // ── the morphers ───────────────────────────────────────────────────
  // One MorphShape per Morph call, which is pydeation's own structure
  // (one helper Cloner per Morph). The octocat becomes the triangle's
  // FRAME, not its shape — `repo_triangle.children[1]` is the Rectangle
  // — which is the joke: the drawing of the cat turns into the box a
  // repository lives in, and the polygon inside it is what evolves.
  /**
   * The octocat's morph is stated on its ONE SUB-STROKE, not on the
   * Sketch that carries it — and that distinction is a real finding
   * rather than a workaround.
   *
   * A Sketch is a composite: its ink lives in one `Line` per SVG
   * subpath, and the Sketch itself has no single outline, so the Morph
   * ability refuses it at construction (vocabulary/Morph, "ELIGIBILITY"
   * — the multi-subpath composite is the exact ambiguous case its
   * design names). The refusal is CORRECT and its message is the way
   * through: "morph its pieces individually, since each sub-stroke is
   * morphable on its own."
   *
   * Here that resolves cleanly, because github.svg is a ONE-SUBPATH
   * drawing (assets/github.ts: 1 subpath, 69 points, closed). The
   * octocat's single closed outline is the whole cat, so morphing the
   * child IS morphing the drawing — there is no piece left out and no
   * ambiguity to paper over. pydeation's `Morph(github, …)` reads the
   * same way: it took the object's splines, and the object had one.
   *
   * A multi-subpath SVG would NOT resolve this way, and that is the
   * honest boundary of what this scene proves: the corpus contains
   * `Morph` on exactly this one SVG, and it happens to be the one that
   * is a single closed path.
   *
   * LAZY, and necessarily so. A Sketch's `strokes` are built by its
   * `compose()`, which the framework runs on completion — AFTER the
   * enclosing Dream's own class fields have finished initializing. A
   * plain field initializer here would read `strokes[0]` while the
   * Sketch is still an empty shell. The getter defers the read to
   * `unfold()`, by which time the Sketch has settled, and memoizes so
   * the staged morpher and the animated one are the same object.
   */
  #githubMorph?: MorphShape
  get githubMorph(): MorphShape {
    this.#githubMorph ??= new MorphShape(
      this.githubOutline,
      this.repoTriangle.members[1] as Rectangle,
      { opacity: 0 },
    )
    return this.#githubMorph
  }

  /**
   * The octocat's one closed sub-stroke — the drawing's whole outline.
   *
   * `strokes` is a plain field the Sketch's `compose()` fills, and
   * compose runs on the holon's COMPLETION, which the framework
   * triggers from the `.params`/`.parts` accessors (holon.ts:236-241).
   * Reading `strokes` directly would not trigger it, so `.parts` is
   * touched first — the documented way to ask a holon to finish
   * building itself before reaching inside it.
   */
  get githubOutline() {
    void this.github.parts
    const outline = this.github.strokes[0]!
    // The pen's start phase belongs to the LINE, not to the Sketch that
    // carries it: `Sketch.createAnim` sweeps each child's `creation`
    // (Sketch.ts:125-147) and never reads a `drawStart` of its own, so
    // setting it on the container is silently inert — which a sweep of
    // six values scoring identically is exactly what that looks like.
    outline.drawStart.value = GITHUB_DRAW_START
    return outline
  }

  // The four chain links, each a PAIR (the shape and its frame), each
  // with copy=true so the source stays standing — that is what leaves
  // all five boxes on screen at once at t=220.
  chainMorphs = new Group({
    members: [
      new MorphShape(this.repoTriangle.members[0] as Polygon, this.repoSquare.members[0] as Polygon, { opacity: 0 }),
      new MorphShape(this.repoTriangle.members[1] as Rectangle, this.repoSquare.members[1] as Rectangle, { opacity: 0 }),
      new MorphShape(this.repoSquare.members[0] as Polygon, this.repoPentagon.members[0] as Polygon, { opacity: 0 }),
      new MorphShape(this.repoSquare.members[1] as Rectangle, this.repoPentagon.members[1] as Rectangle, { opacity: 0 }),
      new MorphShape(this.repoPentagon.members[0] as Polygon, this.repoHexagon.members[0] as Polygon, { opacity: 0 }),
      new MorphShape(this.repoPentagon.members[1] as Rectangle, this.repoHexagon.members[1] as Rectangle, { opacity: 0 }),
      new MorphShape(this.repoHexagon.members[0] as Polygon, this.repoCircle.members[0] as Circle, { opacity: 0 }),
      new MorphShape(this.repoHexagon.members[1] as Rectangle, this.repoCircle.members[1] as Rectangle, { opacity: 0 }),
    ],
  })

  // The closing pair: the repo shapes shed their frames and become the
  // bare triad the scene opened with.
  closingMorphs = new Group({
    members: [
      new MorphShape(this.repoCircle.members[0] as Circle, this.circle, { opacity: 0 }),
      new MorphShape(this.repoRectangle.members[0] as Rectangle, this.rectangle, { opacity: 0 }),
    ],
  })

  unfold() {
    // CONFIG camera_perspective "front", camera_zoom 3/4 — Scene05's
    // projection, unchanged, which is why the inherited logo needs no
    // repositioning to match the frame it arrives on.
    this.observer.look("front")
    this.set(this.observer.zoom.to(3 / 4))

    // Everything the source `add`s is staged, morphers included.
    // Touch the octocat's outline before anything else: the getter is
    // what settles the Sketch and sets the pen's start phase, and the
    // draw at beat 6 must already have it.
    void this.githubOutline

    this.stage(this.dialecticalThinking)
    this.stage(this.liminality)
    this.stage(this.github)
    this.stage(this.nodes)
    this.stage(this.edges)
    this.stage(this.logo)
    this.stage(this.logo2)
    this.stage(this.repoTriangle)
    this.stage(this.repoSquare)
    this.stage(this.repoPentagon)
    this.stage(this.repoHexagon)
    this.stage(this.repoCircle)
    this.stage(this.repoRectangle)
    this.stage(this.repoCylinder)
    this.stage(this.arrows)
    this.stage(this.repoTension)
    this.stage(this.githubMorph)
    this.stage(this.chainMorphs)
    this.stage(this.closingMorphs)

    // THE INITIAL STATE, in the two orthogonal registers the framework
    // keeps apart (holon.ts: `creation` is how much of the outline is
    // drawn, `opacity` is a fade over it).
    //
    // Objects a verb will DRAW start un-drawn (`creation.to(0)`); the
    // morph DESTINATIONS are born with complete outlines and held out
    // by opacity alone, because a morph steps its target in whole
    // rather than drawing it (Scene07_1 states this at length). The
    // logo alone is `show=True, completion=1` — it arrives finished
    // from Scene05 and is the one thing already on screen.
    this.set(
      this.dialecticalThinking.creation.to(0),
      this.liminality.creation.to(0),
      this.github.creation.to(0),
      this.nodes.creation.to(0),
      this.edges.creation.to(0),
      this.logo2.creation.to(0),
      this.repoTriangle.creation.to(0),
      this.repoRectangle.creation.to(0),
      this.repoCylinder.creation.to(0),
      this.arrows.creation.to(0),
      this.repoTension.creation.to(0),
    )
    // The four chain links downstream of the triangle are morph
    // destinations: outlines complete, invisible until their morpher
    // hands over.
    this.set(
      this.repoSquare.creation.to(1),
      this.repoPentagon.creation.to(1),
      this.repoHexagon.creation.to(1),
      this.repoCircle.creation.to(1),
      FadeOut(this.repoSquare),
      FadeOut(this.repoPentagon),
      FadeOut(this.repoHexagon),
      FadeOut(this.repoCircle),
    )

    this.wait(START_OFFSET)

    // ── beat 1: the mark becomes the world (10s) ─────────────────────
    // Transform(logo, z=0, scale=5/4, relative=False) — absolute, so
    // the mark travels from Scene05's y=50/scale=0.6 to centred at 5/4.
    // At 5/4 its main circle is 250 units, which is exactly
    // `liminality`'s radius: the growth ENDS on the ring, and that is
    // why the source can hand the frame from one to the other without a
    // seam. Measured: r 117 px → 242 px over 154.6-164.6s.
    this.play(
      together(
        this.logo.y.to(0),
        this.logo.scale.to(5 / 4),
      ),
      10,
    )

    // ── beat 2: it empties out (4s) ──────────────────────────────────
    // FadeOut(logo.components["small_circle"], logo.components["lines"])
    // — the red circle and the Λ go, the blue ring stays. Measured: red
    // ink 4,919 px → 1 px over 164.8-168.6s.
    // The source names two COMPONENTS ("small_circle", "lines"); core's
    // Logo carries the Λ as its two legs rather than a group, so the
    // three strokes fade together — the same three objects either way.
    this.play(
      together(
        FadeOut(this.logo.smallCircle),
        FadeOut(this.logo.leftLeg),
        FadeOut(this.logo.rightLeg),
      ),
      4,
    )
    // wait(6) — the bare ring holds. THIS is the "6.2s black gap" the
    // report saw; it is the most nearly-empty image in the video and it
    // is deliberate: the world, before anything is in it.
    this.wait(6)

    // ── beat 3: the dialectic is drawn inside it (4s) ────────────────
    this.play(Create(this.dialecticalThinking), 4)
    this.wait(4)

    // ── beat 4: the world shrinks, and the thesis with it (5s) ───────
    // `Transform(dialectical_thinking, logo, scale=1/3)` — pydeation's
    // MULTI-TARGET form: the first argument is not a destination, it is
    // a second OBJECT, and the transform applies to BOTH. So the logo's
    // ring shrinks to a third along with the thesis inside it.
    //
    // Measured, and this is what corrected the first cut of this scene:
    // the reference's blue ring falls from r=241.5 px to r=82.5 px
    // between v182.6 and v187.6 — a factor of 0.342, i.e. 1/3, over
    // exactly the source's 5s. Holding the ring at 250 (reading the call
    // as "move the group ONTO the logo") leaves the whole middle of the
    // scene at the wrong scale, which is what the gauntlet caught at
    // v184.6 with the two rings side by side in the composite.
    //
    // The logo is centred by now, so both shrink about the origin.
    this.play(
      together(
        this.logo.scale.to((5 / 4) * (1 / 3)),
        this.dialecticalThinking.scale.to(1 / 3),
        this.dialecticalThinking.y.to(15 / 3),
        this.dialecticalThinking.z.to(-100 / 3),
      ),
      5,
    )

    // ── beat 5: the ring of nodes wires itself on and off ────────────
    this.play(Create(this.edges), 5 / 3)
    this.play(Create(this.nodes), 1 / 3)
    this.wait(2)
    // Three verbs in one 2s span at different reaches: the logo and the
    // shrunken thesis fade whole, the edges erase over the first 3/4,
    // and the nodes un-create starting a quarter of the way in.
    this.play(
      together(
        FadeOut(this.logo),
        FadeOut(this.dialecticalThinking),
        [Erase(this.edges), 0, 3 / 4],
        [UnCreate(this.nodes), 1 / 4, 1],
      ),
      2,
    )

    // ── beat 6: the octocat, and the pairing image ───────────────────
    this.play(Draw(this.github), 3)
    this.play(this.github.x.to(250), 1)
    this.play(Create(this.logo2), 3)
    this.wait(8)

    // Transform(dialectical_thinking, scale=3.01) — the hidden thesis is
    // quietly re-inflated while nobody is looking at it, so that the
    // closing morph has somewhere full-size to land. It is invisible
    // here (it faded at beat 5) and this is pure bookkeeping, which is
    // why the odd 3.01 rather than 3: the source is undoing its own 1/3.
    this.play(
      together(
        this.dialecticalThinking.scale.to((1 / 3) * 3.01),
        this.dialecticalThinking.y.to(15),
        this.dialecticalThinking.z.to(-100),
      ),
      1,
    )
    this.play(FadeOut(this.logo2), 2)

    // ── beat 7: the repo evolution chain ─────────────────────────────
    // The octocat becomes the triangle's FRAME (children[1]).
    this.play(
      Morph(
        this.githubMorph,
        this.githubOutline,
        this.repoTriangle.members[1] as Rectangle,
      ),
      2,
    )
    this.play(Create(this.repoTriangle), 1)

    // Four identical steps: morph the shape AND its frame forward with
    // copy=true (both ends stay lit), while the arrow between them
    // creates over the last third of the span.
    const chain: [MorphShape, MorphShape, Connection, Group, Group][] = [
      [this.chainMorphs.members[0] as MorphShape, this.chainMorphs.members[1] as MorphShape, this.arrowTriangleSquare, this.repoTriangle, this.repoSquare],
      [this.chainMorphs.members[2] as MorphShape, this.chainMorphs.members[3] as MorphShape, this.arrowSquarePentagon, this.repoSquare, this.repoPentagon],
      [this.chainMorphs.members[4] as MorphShape, this.chainMorphs.members[5] as MorphShape, this.arrowPentagonHexagon, this.repoPentagon, this.repoHexagon],
      [this.chainMorphs.members[6] as MorphShape, this.chainMorphs.members[7] as MorphShape, this.arrowHexagonCircle, this.repoHexagon, this.repoCircle],
    ]
    for (const [shapeMorph, frameMorph, arrow, from, to] of chain) {
      this.play(
        together(
          // The destination GROUP is faded out in the initial state, and
          // a Morph lights the destination STROKES, not the group that
          // carries them — so the group's own opacity is restored here,
          // at the same instant (0.99, 1) the morph hands over.
          restage(to.opacity.to(1), 0.99, 1),
          Morph(shapeMorph, from.members[0] as never, to.members[0] as never, { copy: true }),
          Morph(frameMorph, from.members[1] as never, to.members[1] as never, { copy: true }),
          [Create(arrow), 2 / 3, 1],
        ),
        1,
      )
    }
    this.wait(2)

    // ── beat 8: the chain collapses to its last link ─────────────────
    this.play(
      together(
        FadeOut(this.repoTriangle),
        FadeOut(this.repoSquare),
        FadeOut(this.repoPentagon),
        FadeOut(this.repoHexagon),
        FadeOut(this.arrows),
      ),
      2,
    )
    // Transform(repo_circle, x=-120, z=-100, relative=False)
    this.play(
      together(this.repoCircle.x.to(-120), this.repoCircle.y.to(-100)),
      2,
    )

    // ── beat 9: the dialectic, rebuilt out of repositories ───────────
    this.play(Create(this.repoRectangle), 2)
    this.play(Create(this.repoTension), 1)
    this.play(Create(this.repoCylinder), 2)
    this.wait(1)

    // ── beat 10: the frames fall away, the triad remains (3s) ────────
    // Five things at once: the three frames un-create over the first
    // half, the circle and rectangle morph back into the ORIGINAL triad
    // objects, and the repo cylinder transforms into the original
    // cylinder's pose. The scene ends where it began, one level down.
    this.play(
      together(
        // The triad's group faded out at beat 5 and its members are the
        // morph destinations here, so the group is lit again as they
        // arrive — the same (0.99, 1) hand-over the chain uses.
        restage(this.dialecticalThinking.opacity.to(1), 0.99, 1),
        [UnCreate(this.repoCylinder.members[1] as Rectangle), 0, 1 / 2],
        [UnCreate(this.repoCircle.members[1] as Rectangle), 0, 1 / 2],
        [UnCreate(this.repoRectangle.members[1] as Rectangle), 0, 1 / 2],
        Morph(this.closingMorphs.members[0] as MorphShape, this.repoCircle.members[0] as Circle, this.circle),
        Morph(this.closingMorphs.members[1] as MorphShape, this.repoRectangle.members[0] as Rectangle, this.rectangle),
        // Transform(repo_cylinder.children[0], scale=3/4, h=-PI/2,
        // p=-PI/4, z=15, y=-100, relative=False) — the rebuilt cylinder
        // takes the original's exact pose.
        (this.repoCylinder.members[0] as Cylinder).scale.to(3 / 4),
        (this.repoCylinder.members[0] as Cylinder).b.to(-PI / 2),
        (this.repoCylinder.members[0] as Cylinder).p.to(-PI / 4),
        (this.repoCylinder.members[0] as Cylinder).y.to(15),
        (this.repoCylinder.members[0] as Cylinder).z.to(-100),
      ),
      3,
    )
    this.wait(1)
    this.play(
      together(
        UnDraw(this.repoCylinder.members[0] as Cylinder),
        UnDraw(this.dialecticalThinking),
      ),
      1,
    )
  }
}

// ── construction helpers ─────────────────────────────────────────────

/** Group(shape, Rectangle(100x100), x=…, z=…) — a shape in its repo box. */
function repo(shape: Circle | Polygon | Rectangle | Cylinder, x: number, z = 0): Group {
  return new Group({
    members: [
      shape,
      new Rectangle({ width: 100, height: 100, tint: WHITE, stroke: STROKE_MAIN }),
    ],
    x,
    y: z,
  })
}

/**
 * `Connection(source, waypoint, target, …)` — the variadic form, which
 * core spells as an anchored Connection with one `via` point.
 */
function through(
  source: Holon,
  waypoint: Null,
  target: Holon,
  offsetStart: number,
): Connection {
  const c = new Connection(source, target, {
    offsetStart,
    offsetEnd: 0.1,
    tint: WHITE,
    stroke: STROKE_MAIN,
  })
  c.via = [{ x: waypoint.x.value, y: waypoint.y.value, z: 0 }]
  return c
}

/** Connection(a, b, offset_start=0.45, offset_end=0.38) — a chain arrow. */
function link(a: Group, b: Group): Connection {
  return new Connection(a, b, {
    offsetStart: 0.45,
    offsetEnd: 0.38,
    tint: WHITE,
    stroke: STROKE_MAIN,
  })
}

// The twelve ring nodes and the two waypoint rings the edges bend
// through, verbatim from pitch.py:360-369. pydeation's z is our y.
const NODE_XS = [-93, 0, 93, 200, 200, 200, 93, 0, -93, -200, -200, -200]
const NODE_ZS = [200, 200, 200, 93, 0, -93, -200, -200, -200, -93, 0, 93]

/** `None if x == 0 or z == 0` — the axial edges take no bend. */
const bend = (xs: number[], zs: number[]): (readonly [number, number] | null)[] =>
  xs.map((x, i) => (x === 0 || zs[i] === 0 ? null : ([x, zs[i]!] as const)))

const FIRST_POINTS = bend(
  [-43, 0, 43, 125, 125, 125, 43, 0, -43, -125, -125, -125],
  [125, 125, 125, 43, 0, -43, -125, -125, -125, -43, 0, 43],
)
const SECOND_POINTS = bend(
  [-93, 0, 93, 125, 125, 125, 93, 0, -93, -125, -125, -125],
  [125, 125, 125, 93, 0, -93, -125, -125, -125, -93, 0, 93],
)

if (import.meta.main) render(Scene06Dream)
