/**
 * Slide — one page of a Keynote deck, as strokes and type.
 *
 * This is an INVISIBLE ASSET, not a sovereign symbol (ONTOLOGY.md's
 * distinction, the same one that keeps `Line` out of the vocabulary's
 * cast, and the same call `Sketch` makes): a Slide means nothing by
 * itself. It is a generic mechanism — "render this page" — and the
 * meaning lives in the page it is given. `Project Liminality`'s title
 * card is a symbol; `Slide` is the doorway pages like it come through.
 * Hence no `static sovereign`.
 *
 * The contract is `Sketch`'s, one level up: a Sketch composes one `Line`
 * per subpath so an imported drawing renders through the IDENTICAL
 * polyline/ribbon path as a Circle; a Slide composes one `Line` (or
 * `DottedLine`) per subpath, one `Text` per text record, and one
 * `Connection` per connection line, so an imported PAGE renders through
 * the identical path as everything else. There is no Keynote-specific
 * rendering anywhere, and the whole stroke surface — tint, stroke width,
 * erasure, drawReversed, fill — applies to it unchanged, because it is
 * literally the same parts.
 *
 * CONNECTION LINES ARE THE ONE THING NOT READ BUT REBUILT
 *
 * A `TSD.ConnectionLineArchive` is Keynote's cached recompute of a line
 * between two objects, and 25% of the deck's are STALE — leftovers from
 * wherever those objects used to sit, with no local sign anything is
 * wrong. So a connection whose endpoints resolve is recomputed from them
 * rather than read (Connections.ts has the rule and the measurements),
 * and one whose endpoints do not resolve keeps its stored path and is
 * named by `stalePaths()`. That is the only place this holon second-
 * guesses its data, and it is because the data says to.
 *
 * THE FRAME CHANGE LIVES HERE, AND ONLY HERE
 *
 * The generated data is in SLIDE units: 1920x1080, y DOWN, origin at the
 * top-left, exactly as the deck states it — so a module reads directly
 * against docs/reports/pl02-vocabulary.md and against the .key itself.
 * Turning that into world coordinates is one act, `slidePointToWorld`,
 * and it happens once, in compose(). That is what makes `height` a real
 * parameter of the holon rather than something baked into an asset, and
 * it is why a Slide at (0,0,0) sits where the projector puts it.
 *
 * WHAT A SLIDE DOES NOT DO
 *
 * It does not animate itself beyond `Create`. Keynote's builds
 * (LineDrawForLine, dissolve, dissolve character) and its transitions
 * (MagicMove, FadeThruColor) are declared in the data and are chapters
 * P-3 and P-6's work; carrying them here would be exactly the
 * speculative people-pleasing CLAUDE.md warns against. What this holon
 * does is HOLD the tableau, correctly — which is 89% of the video's
 * frames, and the whole of P-1's gate.
 */

import { color, completion, length } from "../../src/params"
import { together, type Anim, type Windowed } from "../../src/anim"
import { Line, DottedLine, Stroke, Group, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { Holon } from "../../src/holon"
import { WHITE, type Color } from "../../src/constants"
import {
  slidePointToWorld,
  slideToWorld,
  textAnchorX,
  textBaseline,
  SLIDE_HEIGHT,
  type SlideData,
  type SlideShapeData,
  type KeyText,
  type KeyBuild,
  type KeyLineEnd,
} from "../../src/geometry/keynote"
import {
  ACTION_SCALE,
  LINE_DRAW,
  MOTION_PATH,
  SUPPORTED,
  buildAnim,
  drawsFromMiddle,
  drawsReversed,
  lineDrawAnim,
  motionAnim,
  preBuildAnim,
  scaleAnim,
  strokeEnds,
  unsupportedBuilds,
} from "./Builds"
import {
  Connection,
  boxCentre,
  connectionPath,
  lineDecoration,
  unionBoxes,
  type ConnectTarget,
  type SlidePoint,
} from "./Connections"

/** An empty page, so a Slide with no data is still a valid holon. */
const EMPTY: SlideData = {
  index: 0,
  id: "",
  source: "",
  hash: "",
  shapes: [],
  texts: [],
  groups: [],
  builds: [],
}

/** `#rrggbb` → the framework's Color. The deck's blue and red are the
 *  framework's BLUE and RED exactly (#00a2ff / #ff644e), so this is a
 *  parse, not an approximation. */
export const hexToColor = (hex: string): Color => {
  const n = Number.parseInt(hex.replace("#", ""), 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

/**
 * A drawable's OPAQUE INTERIOR — the deck's flat fill, as an occluder.
 *
 * WHY THIS EXISTS AT ALL (P-5). 413 of the deck's drawables carry a flat
 * black fill, and on a black stage a black fill paints nothing of its
 * own: its entire visible effect is to HIDE what is behind it. The deck
 * leans on that. Deck slide 24's head icons are black-filled and the
 * campfire ellipse's stroke runs behind them, cut by them — measured on
 * `f_02351`, the reference's head interior is unbroken black where the
 * ellipse would cross. Deck slide 23 goes further: it stacks two copies
 * of one composition and the upper copy's black-filled heads hide the
 * lower copy's inner circle and rectangle entirely. Nothing marks the
 * lower copy as hidden — it is a live drawable at opacity 1.0 — so a
 * renderer that ignores fills draws two extra shapes with no way to know
 * which.
 *
 * WHY A HOLON RATHER THAN `Stroke.fillOpacity` ON THE OUTLINE.
 *
 * Two reasons, and the second is the load-bearing one.
 *
 * The colours differ. A white-stroked, black-filled head is the deck's
 * common case, and the host's wash takes the holon's own `tint`
 * (three-host.ts styles it with `liftTint(holon.tint.value, …)`). One
 * holon cannot be white and black at once, so the interior needs a
 * holon of its own — rather than a second tint param on `Stroke`, which
 * would be a framework change made for one deck.
 *
 * And the interior is EVEN-ODD ACROSS ALL SUBPATHS, not one flood per
 * loop. `Notebook_109` on deck slide 24 is one white-filled drawable of
 * two closed subpaths — an outer laptop silhouette and an inner screen
 * rectangle — and the reference draws a white frame around a BLACK
 * screen. Filling each loop separately paints a solid white slab; the
 * hole is not a property of either loop, which is the rule
 * geometry/evenodd.ts exists to state. A PARENT holon carrying one
 * closed `Line` per subpath is the shape `drawingSubpaths` recognises,
 * so the host triangulates the set even-odd through `setPolygons` and
 * marks the children washed-by-ancestor. Same construction a `Sketch`
 * has, reached for the same reason.
 *
 * The children are strokeless: `creation` stays 0 so no ribbon is laid,
 * and the whole of the holon's ink is the wash `fillOpacity` carries.
 * That is the independent-surface contract `fillOpacity` was built for
 * — a shape can be filled without being drawn.
 */
export class SlideFill extends Stroke {
  /** One closed loop per subpath, in the drawable's own order. */
  loops: Vec3Like[][] = []
  override tint = color(WHITE)
  override fillOpacity = completion(1)

  /**
   * How far to pull the filled region back from the path, in world units
   * — normally HALF the outline's stroke width.
   *
   * WHY IT IS NOT ZERO (P-8; this is a correction to P-5's fill).
   *
   * A stroke is drawn CENTRED on its path, so a 3-unit outline puts 1.5
   * units of ribbon on each side of the loop. A fill triangulated to
   * that same loop therefore covers the ribbon's whole inner half — and
   * fills blend NORMAL where strokes blend MAX (render/fill.ts: "a fill
   * must be able to COVER what is behind it"), so on this deck's black
   * fills the drawable's own outline loses half its width to its own
   * interior.
   *
   * MEASURED on deck 43's head icons, one row across a head's widest
   * point, the four pixels of its left edge:
   *
   *     reference        142  246  205   36
   *     fills OFF        142  232  204   33      <- agrees
   *     fills ON         142  204    0    0      <- inner two zeroed
   *
   * At deck scale a 3.0-unit stroke is 2 video px wide, and the two
   * pixels lost are exactly its inner half. Across the whole fractal
   * tableau the uninset fills hid 13,346 px of our own ink, of which
   * 10,472 — 78% — was ink the reference draws, and every one of those
   * was a filled drawable's OWN outline. That is what P-3 meant by
   * "verified winding, untested occlusion": the winding was right and
   * the occluder was a stroke-width too big in every direction.
   *
   * The remaining 22% is genuine inter-object occlusion — a neighbouring
   * head's outline crossing behind this one — and it is correct. So the
   * capability was sound and its extent was not.
   *
   * WHY HALF THE STROKE AND NOT MORE. Half a stroke width is where the
   * ribbon's own geometry ends, and it is a GEOMETRIC quantity: it
   * scales with the drawing and holds at any output size. The ribbon
   * then fades over a further antialias band (render/ribbon.ts's
   * `AA_PX = 1.0`), and insetting past that band does recover a little
   * more — swept on this same frame:
   *
   *     extra inset   0       +0.39   +0.78   +1.17   (world units)
   *     coverage_ref  0.9544  0.9566  0.9587  0.9606
   *
   * It was NOT taken. The gain is monotone with no optimum, which is the
   * signature of fitting rather than reading: the curve is only "hide
   * less of your own edge", and it has no natural stopping point short
   * of disabling occlusion altogether. And `AA_PX` is one SCREEN pixel,
   * so folding it into a world-space inset would make the geometry
   * depend on the render resolution. Half the stroke is the edge the
   * shape actually has; the antialias band belongs to whoever owns the
   * ribbon.
   */
  inset = length(0)

  protected override compose(): void {
    for (const points of this.loops) {
      this.add(
        new Line({
          points: insetLoop(points, this.inset.value),
          tint: this.tint,
          stroke: 0,
          creation: 0,
        }),
      )
    }
  }
}

/**
 * A closed loop pulled `d` world units toward its own interior.
 *
 * Each vertex moves along the bisector of its two edge normals, scaled
 * so the OFFSET EDGES land `d` from the originals rather than the
 * vertices landing `d` from theirs — which for a sharp corner are very
 * different distances (the bisector step is `d / sin(theta/2)`).
 *
 * Interior side is read from the loop's signed area, so a hole wound the
 * other way insets the way a hole should: even-odd fills alternate, and
 * an inner loop's "interior" is the material around it. `Notebook_109`'s
 * screen rectangle is the case, and getting it backwards would grow the
 * hole instead of shrinking it.
 *
 * Degenerate cases fall back to the original loop rather than to a
 * self-intersecting one: a step longer than the local feature size
 * (a 1-unit-wide icon detail under a 1.5-unit inset) would fold the
 * polygon, and an unshrunk fill is a smaller error than an inverted one.
 * Guarded by `MAX_INSET_RATIO`.
 */
const insetLoop = (points: readonly Vec3Like[], d: number): Vec3Like[] => {
  const pts = points.slice()
  if (d <= 0 || pts.length < 4) return pts
  // The loop repeats its first point at the end; work on the open ring.
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  const closed = Math.hypot(last.x - first.x, last.y - first.y) < 1e-9
  const ring = closed ? pts.slice(0, -1) : pts
  const n = ring.length
  if (n < 3) return pts

  let area2 = 0
  for (let i = 0; i < n; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % n]!
    area2 += a.x * b.y - b.x * a.y
  }
  // A counter-clockwise loop (positive area in a y-up frame) has its
  // interior to the LEFT of each edge; clockwise, to the right.
  const side = area2 >= 0 ? 1 : -1

  const out: Vec3Like[] = []
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n]!
    const cur = ring[i]!
    const next = ring[(i + 1) % n]!
    // Inward normals of the two edges meeting at `cur`.
    const e0 = { x: cur.x - prev.x, y: cur.y - prev.y }
    const e1 = { x: next.x - cur.x, y: next.y - cur.y }
    const l0 = Math.hypot(e0.x, e0.y)
    const l1 = Math.hypot(e1.x, e1.y)
    if (l0 < 1e-12 || l1 < 1e-12) {
      out.push({ x: cur.x, y: cur.y, z: cur.z })
      continue
    }
    const n0 = { x: (-e0.y / l0) * side, y: (e0.x / l0) * side }
    const n1 = { x: (-e1.y / l1) * side, y: (e1.x / l1) * side }
    const bx = n0.x + n1.x
    const by = n0.y + n1.y
    const bl = Math.hypot(bx, by)
    if (bl < 1e-9) {
      // A 180-degree reversal — a spike. Offsetting it has no meaning.
      out.push({ x: cur.x, y: cur.y, z: cur.z })
      continue
    }
    // `bl/2` is cos(theta/2) for the half-angle between the normals, so
    // dividing by it turns an edge offset of d into the bisector step.
    const step = d / (bl / 2)
    if (!Number.isFinite(step) || step > d * MAX_INSET_RATIO) return pts
    out.push({
      x: cur.x + (bx / bl) * step,
      y: cur.y + (by / bl) * step,
      z: cur.z,
    })
  }
  if (closed) out.push({ x: out[0]!.x, y: out[0]!.y, z: out[0]!.z })
  return out
}

/**
 * How far past `d` a bisector step may go before the inset is abandoned.
 *
 * A corner sharper than about 23 degrees needs a step over 5x the edge
 * offset, and pushing a vertex that far turns a small feature inside
 * out. Falling back to the uninset loop there costs half a stroke width
 * on that one drawable and keeps the polygon simple, which is the
 * cheaper error.
 */
const MAX_INSET_RATIO = 5

/** Total length of a polyline — the weight a subpath carries in a draw. */
const arcLength = (points: readonly Vec3Like[]): number => {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  }
  return total
}

export class Slide extends Holon {
  /**
   * The world height the 1080-unit canvas spans — the only sizing
   * control a scene needs, and the whole of the frame mapping.
   *
   * The default is the visible height of the framework's own 36mm rig at
   * its 1000-unit distance (2·1000·tan(31.417°/2) = 562.4987), so a
   * Slide dropped into a scene that has called `observer.look(…)` fills
   * the frame exactly as the projector did — which is what makes the
   * deck's title circle land at 153.06 px in a 720p capture, the number
   * the recon measured off the footage.
   */
  height = length(562.4987439260904)

  /** The generated slide module. Construction data, not a parameter. */
  data: SlideData = EMPTY

  /**
   * The page's overall opacity — Keynote's slide-level fade, and what a
   * FadeThruColor transition drives (5 + 4 of the deck's 58 transitions).
   * Distinct from each part's own `opacity`, which carries the SHAPE's
   * declared alpha; the two multiply, as they do in Keynote.
   */
  override opacity = completion(1)

  /**
   * A tint override for every stroke on the page. Unset (the default)
   * means each shape keeps the colour the deck gave it, which is almost
   * always what a reproduction wants; a scene that is deliberately
   * re-colouring the page — a dimmed state, a single-hue study — sets it.
   */
  tint = color(WHITE)
  /** True once `tint` should override the deck's own colours. */
  overrideTint = false

  /** One stroke per subpath, in the deck's own z-order. */
  strokes: Stroke[] = []
  /** One Text per text record, in the deck's own z-order. */
  labels: Text[] = []
  /** One Group per `TSD.GroupArchive`, adopting its members. */
  groups: Group[] = []
  /**
   * The same Groups, by their archive id — a lookup `groups` alone
   * cannot give, since it is filtered to the groups whose members
   * resolved and so does not index against `data.groups`.
   *
   * WHY A GROUP SCALE DOES NOT NEED IT, which is worth recording because
   * the opposite looks obviously true and cost P-9 an hour. A scale
   * applies about its target's own origin, so scaling a group's members
   * one at a time would ordinarily grow each about ITS own centre and
   * leave the assembly's layout untouched. Here it does not: `Slide`
   * bakes every drawable's geometry into its points and leaves every
   * holon at x = y = 0, so each member's own origin IS the canvas
   * centre, and scaling all 42 of deck 17's members individually is
   * exactly the one transform about one centre that the footage shows.
   * `buildTargets`' flattening is therefore right for a scale too, and
   * routing a group scale through the adopting `Group` holon instead is
   * WRONG — that holon's three.Group has no children (its members are
   * already the Slide's own parts, attached under the Slide), so it
   * scales nothing at all.
   */
  groupById = new Map<string, Group>()
  /**
   * One `Connection` per connection line whose endpoints resolved —
   * RECOMPUTED from `connects`, never read from the stored path.
   *
   * See Connections.ts for why: 25% of the deck's stored connection-line
   * paths are stale leftovers with no local sign anything is wrong, so a
   * line that can be rebuilt is rebuilt. A line whose endpoints do NOT
   * resolve keeps its stored path and is listed by `stalePaths()`, which
   * is the honest reporting of a case this rule cannot reach rather than
   * a silent fall-through.
   */
  connections: Connection[] = []

  /**
   * The drawn length of an arrowhead, in slide units.
   *
   * WHICH lines get one is read from the deck (`SlideShapeData.lineEnds`
   * — 123 in-scope heads and one tail, resolved through the style chain
   * in the global stylesheet). HOW BIG it is drawn is not: the deck's
   * head path is 6 units long, and the head measured in f_00850 runs
   * **9.66 +/- 0.10 long by 4.67 +/- 0.20 half-width**. The aspect
   * matches the path's own 2.0, so the SHAPE is the declared one; the
   * absolute scale is not a clean multiple of the 2.0 stroke width and
   * three samples cannot establish the rule.
   *
   * So it is a parameter carrying the measurement rather than a constant
   * derived from too little — and the day someone measures enough heads
   * to state the rule, this becomes its default instead of its value.
   */
  headSize = length(9.66)

  /**
   * Every drawable this page composed, by its KEYNOTE id.
   *
   * Groups need it to adopt their members, and so does anything that
   * reads the deck's other per-drawable records — a build names its
   * target by this id and nothing else (`KeyBuild.target`), so a build
   * cannot be applied without it. A shape with several subpaths maps to
   * ALL of them, because a build fires on the whole drawable: slide 2's
   * Tree_70 is three subpaths and one `dissolve character`.
   */
  byId = new Map<string, Holon[]>()

  protected override compose(): void {
    const scale = slideToWorld(this.height.value)
    const geom = this.slideGeometry()

    for (const shape of this.data.shapes) {
      // A connection line is not an ordinary shape: its stored path is
      // Keynote's own cached recompute and is stale 25% of the time
      // (Connections.ts). Where both endpoints resolve it is rebuilt from
      // them; where they do not it falls through to the stored path, and
      // `stalePaths()` says which did.
      const rebuilt = shape.connects
        ? this.composeConnection(shape, geom, scale)
        : undefined
      if (rebuilt) {
        this.byId.set(shape.id, [rebuilt])
        this.connections.push(rebuilt)
        continue
      }
      const parts = this.composeShape(shape, scale)
      if (parts.length > 0) this.byId.set(shape.id, parts)
      this.strokes.push(...parts)
    }

    for (const text of this.data.texts) {
      const label = this.composeText(text, scale)
      this.byId.set(text.id, [label])
      this.labels.push(label)
    }

    /** A group adopts the FIRST part of each member — see `byId`. */
    const byId = new Map<string, Holon>()
    for (const [id, parts] of this.byId) if (parts[0]) byId.set(id, parts[0])

    // Groups adopt what already exists rather than owning construction.
    // The importer lifts every grouped child onto the canvas before this
    // sees it (keydecode.py's walk accumulates the enclosing chain), so a
    // group contributes identity here, not a transform. Adopting keeps
    // every part's own identity intact, which is what a scene animating
    // one member of a group needs — and what a build, which names a
    // single drawable, requires.
    for (const group of this.data.groups) {
      const members = group.members.map((id) => byId.get(id)).filter((m): m is Holon => !!m)
      if (members.length > 0) {
        const holon = this.add(new Group({ members }))
        this.groups.push(holon)
        this.groupById.set(group.id, holon)
      }
    }
  }

  /**
   * Every id a connection can attach to, with its box and its OUTLINE,
   * in slide coordinates.
   *
   * Both are needed because the clip is against the silhouette, not the
   * box — Connections.ts's clause 3, measured to -0.14 +/- 1.45 slide
   * units against the box's -15.4 +/- 13.1.
   *
   * GROUPS ARE HERE, AND THEY ARE THE REASON THIS IS NOT A ONE-LINER.
   * The deck attaches connections to groups as readily as to shapes —
   * ALL 140 endpoints of slide 11's seventy lines are groups, and all
   * ten of slide 8's — and `KeyGroup` carries members but no geometry.
   * So a group's box is the union of its members' boxes and its outline
   * is their outlines, computed RECURSIVELY because groups nest. That is
   * a derivation from what the model states, not a fact it is missing:
   * P-1 verified across all 678 groups in the deck that a group is a
   * pure translation with no scale and no rotation, and the union agrees
   * with the deck's own stored connection vectors to 0.0001 slide units
   * on all seventy of slide 11's lines.
   */
  private slideGeometry(): Map<string, ConnectTarget> {
    const out = new Map<string, ConnectTarget>()

    for (const shape of this.data.shapes) {
      // A connection line is not something another connection attaches
      // to, and its own stored box is the stale geometry we are here to
      // avoid — so it contributes no target.
      if (shape.connects) continue
      const outline: SlidePoint[][] = []
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const flat of shape.subpaths) {
        const poly: SlidePoint[] = []
        for (let i = 0; i + 1 < flat.length; i += 2) {
          const x = flat[i]!
          const y = flat[i + 1]!
          poly.push({ x, y })
          x0 = Math.min(x0, x)
          y0 = Math.min(y0, y)
          x1 = Math.max(x1, x)
          y1 = Math.max(y1, y)
        }
        if (poly.length >= 2) outline.push(poly)
      }
      if (outline.length === 0) continue
      out.set(shape.id, {
        id: shape.id,
        box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
        outline,
      })
    }

    for (const text of this.data.texts) {
      const f = text.frame
      out.set(text.id, {
        id: text.id,
        box: { x: f.position.x, y: f.position.y, w: f.size.width, h: f.size.height },
        // A text record has no silhouette this framework can clip
        // against, so it contributes its box and `connectionPath` falls
        // back to it — stated rather than silent.
        outline: [],
      })
    }

    for (const image of this.data.images ?? []) {
      const f = image.frame
      out.set(image.id, {
        id: image.id,
        box: { x: f.position.x, y: f.position.y, w: f.size.width, h: f.size.height },
        // An image is a raster this framework does not draw, so its box
        // is all there is. P-3's slide-3 case connects to exactly this.
        outline: [],
      })
    }

    // Groups last, and iterated to a fixed point because they nest: a
    // group whose member is another group cannot be resolved until that
    // one is. The loop terminates because each pass either resolves at
    // least one more group or stops.
    const pending = new Map(this.data.groups.map((g) => [g.id, g.members]))
    let progress = true
    while (progress && pending.size > 0) {
      progress = false
      for (const [id, members] of [...pending]) {
        const parts = members.map((m) => out.get(m)).filter((t): t is ConnectTarget => !!t)
        if (parts.length < members.filter((m) => out.has(m) || pending.has(m)).length) continue
        if (parts.length === 0) continue
        const box = unionBoxes(parts.map((p) => p.box))
        if (!box) continue
        out.set(id, { id, box, outline: parts.flatMap((p) => p.outline) })
        pending.delete(id)
        progress = true
      }
    }

    return out
  }

  /**
   * One connection line, recomputed from its endpoints.
   *
   * Returns undefined when either endpoint is unresolvable, which sends
   * the shape down the ordinary stored-path route — the only case in
   * which a stored connection path is drawn, and `stalePaths()` reports
   * it.
   */
  private composeConnection(
    shape: SlideShapeData,
    geom: Map<string, ConnectTarget>,
    scale: number,
  ): Connection | undefined {
    const from = shape.connects?.from ? geom.get(shape.connects.from) : undefined
    const to = shape.connects?.to ? geom.get(shape.connects.to) : undefined
    if (!from || !to) return undefined

    // THE BOW IS TAKEN AS A SHAPE, NOT AS A POINT, and that distinction
    // is the whole of this chapter's hardest bug.
    //
    // Keynote stores every connection as three points and renders it as
    // a quadratic THROUGH the middle one (Connections.ts clause 2), so
    // the middle point is the only authored quantity a recompute cannot
    // derive — how far the line bellies out has no other source. But it
    // must not be read as an absolute position, for the same reason the
    // endpoints must not be: the stored path is stale, and the importer
    // then fits it into the stored FRAME BOX, which is stale too.
    //
    // Slide 8's line 4105549 is the worked example. Its stored subpath
    // runs (652.3, 778.0) -> (600.8, 687.1) -> (526.8, 594.4), so its
    // stored chord is (-125.5, -183.6) — exactly HALF the true
    // centre-to-centre (-251.6, -364.2), because the frame it was fitted
    // into is a leftover from when the campfires sat closer together.
    // Read as a position the middle point lands off the line entirely
    // and the curve bows the wrong way; the composite showed all ten of
    // slide 8's lines as mirrored red/green pairs about their chords.
    //
    // Read as a FRACTION of the stored chord it is scale-free and
    // stale-proof: the offset of the middle point from the stored chord,
    // expressed in that chord's own (along, across) frame, transferred
    // onto the recomputed one. A straight stored line gives zero across
    // and reproduces the collinear case exactly.
    const flat = shape.subpaths[0]
    let mid: SlidePoint | undefined
    if (flat && flat.length >= 6) {
      const p0 = { x: flat[0]!, y: flat[1]! }
      const p1 = { x: flat[flat.length - 4]!, y: flat[flat.length - 3]! }
      const p2 = { x: flat[flat.length - 2]!, y: flat[flat.length - 1]! }
      const cx = p2.x - p0.x
      const cy = p2.y - p0.y
      const chord = Math.hypot(cx, cy)
      if (chord > 1e-9) {
        // The middle point in the stored chord's own basis.
        const ux = cx / chord
        const uy = cy / chord
        const dx = p1.x - p0.x
        const dy = p1.y - p0.y
        const along = (dx * ux + dy * uy) / chord
        const across = (dx * -uy + dy * ux) / chord
        // …transferred onto the recomputed chord.
        const a = boxCentre(from.box)
        const b = boxCentre(to.box)
        const vx = b.x - a.x
        const vy = b.y - a.y
        mid = {
          x: a.x + vx * along + -vy * across,
          y: a.y + vy * along + vx * across,
        }
      }
    }

    // The outset is READ, not assumed. P-1's first note recorded these
    // as "both 0.0 throughout this deck"; they are per-line and non-zero
    // on exactly the densest meshes (164 of the 467 in-scope lines —
    // slide 8's are 30/30, slide 11's 10/10), which this chapter refuted
    // and P-1 has since carried.
    const path = connectionPath(from, to, mid, shape.outset)
    if (path.points.length < 2) return undefined

    const width = ((shape.strokeWidth ?? 1) * this.height.value) / SLIDE_HEIGHT
    const tint = this.overrideTint
      ? this.tint.value
      : shape.stroke
        ? hexToColor(shape.stroke)
        : this.tint.value

    // The cap is part of the PERIOD, exactly as `composeShape` has it —
    // P-1's derivation from the stylesheet, confirmed here at mesh scale
    // by fifteen independent lines measuring 15.003 +/- 0.009 slide
    // units against its prediction of 15.005.
    let dash = 0
    let period = 0
    if (shape.dash && shape.dash.length >= 2) {
      const round = shape.cap === "RoundCap"
      dash = Math.max(shape.dash[0]! * width, width * 0.05)
      period = (shape.dash[0]! + shape.dash[1]! + (round ? 1 : 0)) * width
    }

    const world = path.points.map((p) => {
      const w = slidePointToWorld(p, scale)
      return { x: w.x, y: w.y, z: 0 }
    })

    // End decorations, READ from the deck's own resolved `lineEnds` —
    // the stylesheet field P-1 carries. The HEAD sits on the `to` end and
    // the TAIL on the `from` end, so the two are one act with opposite
    // directions rather than two special cases.
    //
    // Nothing here keys on "always a simple arrow on the `to` end", and
    // that is deliberate: of the deck's 123 heads and one tail, two are
    // `filled circle` rather than `simple arrow`. A consumer assuming
    // the common case would be wrong three times, silently, and in a way
    // no frame this chapter scores would catch — none of the exceptions
    // falls on slides 7, 8, 9 or 14. So the identifier is dispatched on
    // (`lineDecoration`) and the tail is drawn where one exists.
    const decorations: Vec3Like[][] = []
    const toWorld = (p: SlidePoint): Vec3Like => {
      const w = slidePointToWorld(p, scale)
      return { x: w.x, y: w.y, z: 0 }
    }
    const decorate = (
      end: KeyLineEnd | undefined,
      tip: SlidePoint,
      prev: SlidePoint,
    ): void => {
      if (!end) return
      const outline = lineDecoration(end.identifier, tip, prev, this.headSize.value)
      if (outline.length >= 2) decorations.push(outline.map(toWorld))
    }
    if (path.points.length >= 2) {
      const n = path.points.length
      decorate(shape.lineEnds?.head, path.points[n - 1]!, path.points[n - 2]!)
      decorate(shape.lineEnds?.tail, path.points[0]!, path.points[1]!)
    }

    return this.add(
      new Connection({
        points: world,
        decorations,
        dash,
        period,
        tint,
        stroke: width,
        opacity: shape.opacity,
      }),
    )
  }

  /**
   * Connection lines whose endpoints did not resolve, so their STALE
   * stored path was drawn.
   *
   * This is the counterpart of `missingBuildTargets()` and exists for
   * the same reason: a line drawn from a path known to be unreliable
   * must not look like a line that was recomputed. 25% of the deck's
   * stored paths are stale, so a silent fall-through here would be a
   * fidelity claim the data does not support.
   */
  stalePaths(): SlideShapeData[] {
    void this.parts
    return this.data.shapes.filter(
      (s) => s.connects && !(this.byId.get(s.id)?.[0] instanceof Connection),
    )
  }

  /** One shape's subpaths as Lines (or DottedLines when the deck dashes). */
  private composeShape(shape: SlideShapeData, scale: number): Stroke[] {
    const tint = this.overrideTint
      ? this.tint.value
      : shape.stroke
        ? hexToColor(shape.stroke)
        : this.tint.value
    // Stroke width is a SCREEN-pixel quantity in both worlds: Keynote
    // states it in slide units on a 1920-wide canvas, the framework in
    // rendered pixels. At the deck's own 3:2 slide-to-video ratio a
    // 6-unit stroke is 4 rendered pixels at 720p, so the conversion is
    // the same 2/3 the geometry takes — expressed here as the ratio of
    // the rendered frame to the canvas so it stays right at any output
    // size.
    const width = ((shape.strokeWidth ?? 1) * this.height.value) / SLIDE_HEIGHT
    const out: Stroke[] = []

    // THE OPAQUE FILL, WHICH IS AN OCCLUDER AND NOT A COLOUR (P-5).
    //
    // 413 of the deck's drawables carry a flat BLACK fill, and on a
    // black stage a black fill paints nothing of its own — its entire
    // visible effect is to HIDE what is behind it. The deck relies on
    // that: deck slide 24's head icons are black-filled, and the
    // campfire ellipse's stroke runs behind them and is cut by them.
    // Measured on `f_02351`, the reference's head interior is unbroken
    // black where the ellipse would cross it; ours drew the ellipse
    // straight through, which is the whole of that segment's
    // `coverage_ours` shortfall (0.8832) with `coverage_ref` already at
    // 0.9501 — ink we have and the reference does not.
    //
    // Deck slide 23 shows the same mechanism doing something stronger:
    // it stacks TWO copies of one composition, 5313xxx beneath 5315xxx,
    // and the upper copy's black-filled heads hide the lower copy's
    // inner circle and rectangle entirely. Nothing marks the lower copy
    // as hidden — it is a live drawable at opacity 1.0 — so a renderer
    // that ignores fills draws a picture with two extra shapes in it and
    // no way to know which.
    //
    // The wash goes down BEFORE the stroke, and shapes compose in the
    // deck's own `drawablesZOrder`, so attach order is composite order
    // (render/fill.ts: fills stack over strokes and over earlier fills
    // in declaration order) and Keynote's stacking is reproduced by
    // construction rather than by a sort here.
    //
    // It is a SEPARATE Line from the outline because the two carry
    // different colours — a white-stroked, black-filled head is the
    // common case — and `Stroke.fillOpacity`'s wash takes the holon's
    // own `tint`. One holon cannot be white and black at once, so the
    // wash is its own strokeless holon rather than a second tint param
    // on Stroke, which would be a framework change made for one deck.
    //
    // Only CLOSED subpaths fill: an open path has no interior, and the
    // host's wash path requires the loop to close on itself before it
    // will triangulate one (three-host.ts's `washGeometry`).
    // THE INTERIOR IS EVEN-ODD ACROSS ALL SUBPATHS, NOT ONE FLOOD PER
    // LOOP. Deck slide 24's `Notebook_109` is the case that proves it:
    // the icon is ONE white-filled drawable of two closed subpaths, an
    // outer laptop silhouette and an inner screen rectangle, and the
    // reference draws it as a white frame around a BLACK screen
    // (f_02351). Filling each loop on its own paints a solid white slab
    // — the hole is not a property of either loop, which is the rule
    // geometry/evenodd.ts exists to state.
    //
    // So the wash is a PARENT holon with one closed `Line` child per
    // subpath, which is the shape `drawingSubpaths` recognises: the host
    // then triangulates the whole set even-odd through `setPolygons` and
    // marks the children as washed-by-ancestor so no child floods its
    // own loop as well (three-host.ts). It is the same construction a
    // Sketch has, reached for the same reason.
    // Hoisted so the narrowing survives the loop below — `shape.fill`
    // is optional and TypeScript widens it again inside the closure.
    const fillHex = this.fills ? shape.fill : undefined
    if (fillHex) {
      const loops: Vec3Like[][] = []
      for (let i = 0; i < shape.subpaths.length; i++) {
        if (!shape.closed[i]) continue
        const flat = shape.subpaths[i]!
        const points: Vec3Like[] = []
        for (let j = 0; j + 1 < flat.length; j += 2) {
          const p = slidePointToWorld({ x: flat[j]!, y: flat[j + 1]! }, scale)
          points.push({ x: p.x, y: p.y, z: 0 })
        }
        if (points.length < 3) continue
        // The host reads a Line's interior only when its last point sits
        // back on its first; the importer's `closed` flag marks a loop
        // but does not require the opening point to be repeated.
        const first = points[0]!
        const last = points[points.length - 1]!
        if (Math.hypot(last.x - first.x, last.y - first.y) > 1e-6) {
          points.push({ x: first.x, y: first.y, z: 0 })
        }
        loops.push(points)
      }
      // `drawingSubpaths` needs at least two children to read a drawing;
      // a single-loop fill is the ordinary convex wash and is carried by
      // the loop itself.
      if (loops.length > 0) {
        out.push(
          this.add(
            new SlideFill({
              loops,
              tint: hexToColor(fillHex),
              opacity: shape.opacity,
              // HALF the outline's width, because a stroke is centred on
              // its path and a fill triangulated to that same path would
              // cover the ribbon's inner half — see `SlideFill.inset` for
              // the measurement. A drawable with no stroke of its own
              // gets no inset: there is no ribbon to protect, and the
              // fill's edge IS the shape's edge.
              inset: (shape.strokeWidth ?? 0) > 0 ? width / 2 : 0,
            }),
          ),
        )
      }
    }

    for (const flat of shape.subpaths) {
      const points: Vec3Like[] = []
      for (let i = 0; i + 1 < flat.length; i += 2) {
        const p = slidePointToWorld({ x: flat[i]!, y: flat[i + 1]! }, scale)
        points.push({ x: p.x, y: p.y, z: 0 })
      }
      if (points.length < 2) continue

      if (shape.dash && shape.dash.length >= 2) {
        // Keynote states the dash array in STROKE-WIDTH multiples, which
        // is why the deck's fine mesh reads as (0.001, 2.0) rather than
        // as a length: on a 1pt line that is a dot every 2 units.
        //
        // THE CAP IS PART OF THE PERIOD, and this is the deck's own
        // arithmetic rather than a tuned constant. A round cap paints
        // half a stroke width beyond each end of a dash, so a dash of
        // length d occupies d + w and the period is (d + gap + 1)·w
        // rather than (d + gap)·w. On slide 2's connection lines — w =
        // 11 slide units = 7.333 video px, pattern (0.001, 2.0) — that
        // is 22.007 px against 14.674, and the footage's eagle corridor
        // measures 21.9. Without it we drew 14 dots where the reference
        // draws 10.
        //
        // The deck splits cleanly on this: every (0.001, 2.0) dotted
        // pattern is RoundCap and every other pattern is ButtCap, read
        // from the stylesheet (geometry/keynote.ts SlideShapeData.cap).
        // So the branch is a reading, not a heuristic.
        const round = shape.cap === "RoundCap"
        const dash = Math.max(shape.dash[0]! * width, width * 0.05)
        out.push(
          this.add(
            new DottedLine({
              points,
              dash,
              // The gap the primitive is given must be the period minus
              // the dash it actually draws, because `dashRuns` knows
              // nothing about caps — it lays out centre-line lengths.
              gap: round
                ? (shape.dash[1]! + 1) * width - dash
                : shape.dash[1]! * width,
              tint,
              stroke: width,
              opacity: shape.opacity,
            }),
          ),
        )
      } else {
        out.push(this.add(new Line({ points, tint, stroke: width, opacity: shape.opacity })))
      }
    }
    return out
  }

  /**
   * One text record as a `Text`, converting Keynote's BOX anchoring into
   * core's BASELINE anchoring.
   *
   * Keynote lays a string inside a rectangle with a horizontal alignment
   * and a vertical one; core's `Text` puts its block's baseline on the
   * holon's y and its centre (or left edge) on the holon's x
   * (render/text.ts). Because both models are stated in terms the other
   * can express, this is a CONVERSION and not an approximation —
   * `textBaseline` and `textAnchorX` in geometry/keynote.ts do the
   * arithmetic, from the face's own published metrics.
   */
  private composeText(text: KeyText, scale: number): Text {
    const lines = text.content.split("\n").length
    const world = slidePointToWorld(
      { x: textAnchorX(text), y: textBaseline(text, lines) },
      scale,
    )

    return this.add(
      new Text({
        content: text.content,
        size: text.fontSize * scale,
        align: text.align === "center" ? "center" : "left",
        // The deck names its face per record, by PostScript name
        // (`HelveticaNeue-Bold` on the title card). The renderer's
        // fallback chain turns that into the locally extracted system
        // face where the machine has it and the vendored Arimo where it
        // does not — render/fonts.ts, which is where the whole licensing
        // question lives. Nothing here has to know which one it got.
        font: text.fontName,
        // Keynote's line spacing is a multiple of the font size and so
        // is the shaper's `lineHeight`, so this is a pass-through, not a
        // conversion. A record with no spacing declared leaves it unset,
        // which takes the face's own line height.
        lineHeight: text.lineSpacing > 0 ? text.lineSpacing : undefined,
        // Tracking is the same em-fraction in both worlds, so it too is
        // a pass-through. The title card's -0.02 is worth 30 px of word
        // width at 720p, which is the whole gap between a face that is
        // merely right and a card that matches.
        tracking: text.tracking ?? 0,
        tint: this.overrideTint
          ? this.tint.value
          : { r: text.color.r, g: text.color.g, b: text.color.b },
        opacity: text.opacity,
        x: world.x,
        y: world.y,
        creation: 1,
      }),
    )
  }

  /**
   * Draw the whole page on: every stroke over its own share of the span,
   * weighted by ARC LENGTH, then the type writes.
   *
   * This is `Sketch`'s sweep, extended to type — deliberately the same
   * honest v1 rather than Keynote's own choreography. The deck's real
   * build order is 413 declared builds fired in click-chunks (report
   * §0), which is chapter P-3's subject; what this gives is a single
   * coherent draw that proves the geometry, which is what P-1 is gated
   * on.
   */
  override createAnim(): Anim {
    void this.parts
    const items: Windowed[] = []
    // Connections draw with the strokes: they are page ink like any
    // other, and a page whose mesh appeared all at once at the end of
    // the sweep would be a worse `Create` than one that draws it in turn.
    const drawn: Holon[] = [...this.strokes, ...this.connections]
    const lengths = drawn.map((s) =>
      s instanceof Connection ? arcLength(s.points) : arcLength(strokePoints(s as Stroke)),
    )
    const total = lengths.reduce((a, b) => a + b, 0)
    const n = drawn.length
    // The type takes the last fifth of the span; the strokes share the
    // rest in proportion to how far the pen must travel.
    const strokeSpan = this.labels.length > 0 ? 0.8 : 1
    let at = 0
    for (let i = 0; i < n; i++) {
      const share = total > 1e-9 ? (lengths[i]! / total) * strokeSpan : strokeSpan / n
      const from = at
      at += share
      items.push([drawn[i]!.creation.sequence(0, 1), from, i === n - 1 ? strokeSpan : at])
    }
    for (const label of this.labels) {
      items.push([label.creation.sequence(0, 1), strokeSpan, 1])
    }
    return items.length > 0 ? together(...items) : { tracks: [] }
  }

  /**
   * The parts one build's target names, or none when the deck's target
   * is a drawable the importer dropped.
   *
   * Slide 2 has five such: four `dissolve` builds on lightning glyphs and
   * one on the Vitruvian figure, all `TSD.ImageArchive` (the four images
   * P-1's decode skips). A missing target is REPORTED, not silently
   * skipped — `missingBuildTargets` is what a scene checks, and what
   * keeps a dropped build from looking like a build that never existed.
   */
  buildTargets(build: KeyBuild): Holon[] {
    void this.parts
    const direct = this.byId.get(build.target)
    if (direct) return direct

    // A BUILD CAN TARGET A GROUP, and `byId` holds only shapes and
    // texts. Slide 9's Logo is the case: one `apple:dissolve` on group
    // 5149755, whose five member shapes are what actually draw. Before
    // this the build reported as having no target — indistinguishable
    // from the genuinely absent ones (a dropped image), which is exactly
    // the confusion `missingBuildTargets` exists to prevent.
    //
    // Resolved recursively, because groups nest, and de-duplicated,
    // because a shape reachable by two paths must not receive the same
    // opacity ramp twice.
    const group = this.data.groups.find((g) => g.id === build.target)
    if (!group) return []
    const seen = new Set<string>()
    const out: Holon[] = []
    const walk = (id: string): void => {
      if (seen.has(id)) return
      seen.add(id)
      const parts = this.byId.get(id)
      if (parts) {
        out.push(...parts)
        return
      }
      const nested = this.data.groups.find((g) => g.id === id)
      if (nested) for (const m of nested.members) walk(m)
    }
    for (const member of group.members) walk(member)
    return out
  }

  /** Build records whose target this page did not compose. */
  missingBuildTargets(): KeyBuild[] {
    void this.parts
    return this.data.builds.filter((b) => this.buildTargets(b).length === 0)
  }

  /**
   * Put the page into its PRE-BUILD state: everything an `In` build will
   * bring on is pushed back to nothing, everything else stays as composed.
   *
   * A scene calls this once, at its cursor, before playing any build. It
   * is the counterpart of the fact that `Slide` composes finished — see
   * Builds.ts `preBuildAnim` for why that default is right and why this
   * has to exist alongside it.
   */
  preBuild(builds: readonly KeyBuild[] = this.data.builds): Anim {
    void this.parts
    const items: Anim[] = []
    for (const record of builds) {
      if (!SUPPORTED.has(record.effect)) continue
      for (const target of this.buildTargets(record)) {
        items.push(preBuildAnim(record, target))
      }
    }
    return items.length > 0 ? together(...items) : { tracks: [] }
  }

  /**
   * One build record as an Anim over this page's own parts.
   *
   * The whole of the build's SHAPE comes from the record (effect,
   * animationType) and the whole of its SCHEDULE comes from the caller.
   * That division is the chapter's central claim: the deck declares
   * durations and easings and does not declare pacing (every one of its
   * 384 builds is `advance on click`), so a duration read from the record
   * and an onset measured from the footage are different KINDS of number
   * and must not be mixed. See DECISIONS' refused-fits rule as O-11
   * refined it.
   */
  /**
   * The factor an `apple:action-scale` build scales its target by, keyed
   * by the build's own id — supplied by the SCENE, because the record
   * does not carry one.
   *
   * P-4 established that a scale build declares an effect, a duration
   * and an easing and no magnitude, and P-7 confirmed the absence in the
   * raw archives. So the factor is either measured from the footage for
   * that specific build, or the build is not scored: a scene states what
   * IT has measured, one entry per build, and an unlisted record falls
   * through to `unsupported()` exactly as before.
   *
   * Only ONE of the deck's five action-scale records is listed anywhere
   * — deck 56's, whose target crosses empty stage and can be isolated
   * (`Builds.ACTION_SCALE_D56`). The other four stay unscored.
   */
  scaleFactors: Record<string, number> = {}

  /**
   * Compose the deck's opaque fills, or leave them out — the A/B switch
   * for the occlusion question P-5 left open (P-8).
   *
   * P-5 built `SlideFill` and verified its WINDING, and P-3's push-back
   * was accepted at the time: the motivating frame never exercised
   * HIDING, so occlusion order, black-stage interaction and whether
   * hidden ink actually disappears were all untested, and P-9/P-10 were
   * told to run a cheap check before trusting it at scale.
   *
   * Deck 43 is where that check is cheap: 60 black-filled shapes with 30
   * genuinely overlapping pairs and 39 unfilled drawables crossing them,
   * on a tableau whose whole construction is cone lines passing BEHIND
   * ellipses. Flipping this to false and re-scoring the same frame is
   * the measurement; the numbers are in `docs/reports/pl02/p8-fractal.md`.
   *
   * Default true — the deck's own behaviour. This exists so the
   * comparison is a parameter rather than an edit-and-revert, which is
   * the difference between a measurement someone can repeat and a claim
   * they have to take on trust.
   */
  fills = true

  build(record: KeyBuild): Anim {
    void this.parts

    const targets = this.buildTargets(record)
    if (targets.length === 0) return { tracks: [] }

    const items: Anim[] = []
    for (const target of targets) {
      if (record.effect === LINE_DRAW) {
        // A Connection is not a Stroke — it parents them — so the
        // direction fallback has to reach its own recomputed endpoints,
        // not the stored path's. On a mesh that matters: slide 9's
        // fifteen lines are all LineDrawForLine and none of them is a
        // Stroke any more.
        const ends =
          target instanceof Stroke || target instanceof Connection
            ? strokeEnds(target)
            : undefined
        // The page's own centre in world coordinates — the origin, since
        // slidePointToWorld puts the canvas centre there.
        const reversed = ends
          ? drawsReversed(record, ends, { x: 0, y: 0 })
          : false
        items.push(
          lineDrawAnim(
            target,
            reversed,
            record.animationType === "Out",
            drawsFromMiddle(record),
          ),
        )
      } else if (record.effect === MOTION_PATH) {
        // The only build that needs the frame change, because it is the
        // only one whose value is a DISTANCE. Routed here rather than in
        // Builds.ts because the scale is the holon's.
        items.push(motionAnim(record, target, slideToWorld(this.height.value)))
      } else if (record.effect === ACTION_SCALE) {
        // Scored only where the SCENE has measured the factor — the
        // record declares none (see `scaleFactors`). Without one the
        // build contributes nothing and stays in `unsupported()`.
        const factor = this.scaleFactors[record.id]
        if (factor !== undefined) items.push(scaleAnim(target, factor))
      } else {
        items.push(buildAnim(record, target))
      }
    }
    return together(...items)
  }

  /** Every build on this page whose effect P-3 does not implement. */
  unsupported(): KeyBuild[] {
    return unsupportedBuilds(this.data.builds)
  }

  /**
   * Show or hide the whole page, by driving every PART's own opacity.
   *
   * `Slide.opacity` is the holon-level parameter and the renderer does
   * not composite it: opacity is read per drawable (render/three-host.ts
   * multiplies each stroke's and each glyph mesh's own `opacity`), with
   * no parent inheritance. So a scene that stages several pages and cuts
   * between them cannot use `page.opacity` to do it — the first attempt
   * here drew all five slides of the opening arc on top of one another.
   *
   * `visible` is therefore the page-level control a multi-slide scene
   * actually needs, and it is deliberately NOT a fade: it composes with
   * a build's own opacity by MULTIPLYING into the same param, so hiding
   * a page whose builds have already run and showing it again would lose
   * their state. It is used for cuts, which is all this chapter's
   * transitions are (Magic Move is P-6's).
   */
  visible(on: boolean): Anim {
    void this.parts
    const items: Anim[] = []
    for (const stroke of this.strokes) items.push(...opacityOf(stroke, on ? 1 : 0))
    for (const line of this.connections) items.push(...opacityOf(line, on ? 1 : 0))
    for (const label of this.labels) items.push(label.opacity.to(on ? 1 : 0))
    return items.length > 0 ? together(...items) : { tracks: [] }
  }

  /**
   * The parts a build owns, so a cut can restore them without undoing
   * the build. `visible(true)` would light an unbuilt label; this is
   * what a page's cut-in uses instead.
   */
  private builtTargets(): Set<Holon> {
    const owned = new Set<Holon>()
    for (const record of this.data.builds) {
      if (!SUPPORTED.has(record.effect)) continue
      if (record.animationType === "Out") continue
      // A LineDrawForLine target is held back by its DRAW FRONT, not by
      // its opacity (preBuildAnim puts `creation` to 0), so it must be
      // lit by the cut like anything else — leaving it dark would mean a
      // line that draws on invisibly and appears all at once at the end.
      if (record.effect === LINE_DRAW) continue
      // An Action build's target is on screen already — see preBuildAnim.
      if (record.animationType === "Action") continue
      for (const target of this.buildTargets(record)) owned.add(target)
    }
    return owned
  }

  /**
   * Cut this page IN: everything that is not the target of a pending
   * `In` build becomes visible, and everything that is stays dark until
   * its build fires.
   *
   * This is the pairing of `visible()` with `preBuild()`, and it has to
   * be one act rather than two because the two disagree about the same
   * param — P-2's slide-32 lesson (a held page over-draws an unbuilt
   * label) is exactly what a plain `visible(true)` would reintroduce.
   */
  cutIn(): Anim {
    void this.parts
    const built = this.builtTargets()
    const items: Anim[] = []
    for (const part of [...this.strokes, ...this.connections, ...this.labels]) {
      if (built.has(part)) continue
      items.push(...opacityOf(part, 1))
    }
    return items.length > 0 ? together(...items) : { tracks: [] }
  }

  /** The same walk, retracting — the pen goes back the way it came. */
  override unCreateAnim(): Anim {
    void this.parts
    const items: Windowed[] = []
    for (const label of this.labels) items.push([label.erasure.sequence(0, 1), 0, 0.2])
    const drawn: Holon[] = [...this.strokes, ...this.connections]
    const n = drawn.length
    for (let i = 0; i < n; i++) {
      items.push([drawn[i]!.creation.to(0), 0.2 + (0.8 * i) / n, 0.2 + (0.8 * (i + 1)) / n])
    }
    return items.length > 0 ? together(...items) : { tracks: [] }
  }
}

/** A Stroke's polyline, whichever primitive it is. */
const strokePoints = (stroke: Stroke): Vec3Like[] =>
  stroke instanceof Line || stroke instanceof DottedLine ? stroke.points : []

/**
 * Set a drawable's opacity, reaching a DottedLine's dashes.
 *
 * The renderer reads opacity per drawn primitive and does not inherit it
 * down the tree (render/three-host.ts), and a DottedLine draws nothing
 * itself — it is a parent of one `Line` per dash. So setting a
 * DottedLine's own opacity changes no pixel, which is how slide 2's four
 * connection lines survived a `visible(false)` and were still on screen
 * seventy seconds after their page was cut away.
 */
const opacityOf = (holon: Holon, v: number): Anim[] => {
  if (holon instanceof DottedLine) {
    void holon.parts
    return holon.dashes.map((d) => d.opacity.to(v))
  }
  // A Connection is the same shape of problem one level up: it draws
  // nothing itself, parenting one Line per dash plus an arrowhead. On
  // slide 9 that is fifteen lines of a dozen dashes each, so a page cut
  // that missed them would leave a whole mesh on screen — which is
  // exactly how P-3's four connection lines survived a `visible(false)`.
  if (holon instanceof Connection) {
    return holon.drawn().map((d) => d.opacity.to(v))
  }
  return [holon.opacity.to(v)]
}
