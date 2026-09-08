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
 * `DottedLine`) per subpath and one `Text` per text record, so an
 * imported PAGE renders through the identical path as everything else.
 * There is no Keynote-specific rendering anywhere, and the whole stroke
 * surface — tint, stroke width, erasure, drawReversed, fill — applies to
 * it unchanged, because it is literally the same parts.
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
} from "../../src/geometry/keynote"
import {
  LINE_DRAW,
  MOTION_PATH,
  SUPPORTED,
  buildAnim,
  drawsReversed,
  lineDrawAnim,
  motionAnim,
  preBuildAnim,
  strokeEnds,
  unsupportedBuilds,
} from "./Builds"

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

    for (const shape of this.data.shapes) {
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
      if (members.length > 0) this.groups.push(this.add(new Group({ members })))
    }
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
    const lengths = this.strokes.map((s) => arcLength(strokePoints(s)))
    const total = lengths.reduce((a, b) => a + b, 0)
    const n = this.strokes.length
    // The type takes the last fifth of the span; the strokes share the
    // rest in proportion to how far the pen must travel.
    const strokeSpan = this.labels.length > 0 ? 0.8 : 1
    let at = 0
    for (let i = 0; i < n; i++) {
      const share = total > 1e-9 ? (lengths[i]! / total) * strokeSpan : strokeSpan / n
      const from = at
      at += share
      items.push([this.strokes[i]!.creation.sequence(0, 1), from, i === n - 1 ? strokeSpan : at])
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
    return this.byId.get(build.target) ?? []
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
  build(record: KeyBuild): Anim {
    void this.parts
    const targets = this.buildTargets(record)
    if (targets.length === 0) return { tracks: [] }

    const items: Anim[] = []
    for (const target of targets) {
      if (record.effect === LINE_DRAW) {
        const ends = target instanceof Stroke ? strokeEnds(target) : undefined
        // The page's own centre in world coordinates — the origin, since
        // slidePointToWorld puts the canvas centre there.
        const reversed = ends
          ? drawsReversed(record, ends, { x: 0, y: 0 })
          : false
        items.push(lineDrawAnim(target, reversed, record.animationType === "Out"))
      } else if (record.effect === MOTION_PATH) {
        // The only build that needs the frame change, because it is the
        // only one whose value is a DISTANCE. Routed here rather than in
        // Builds.ts because the scale is the holon's.
        items.push(motionAnim(record, target, slideToWorld(this.height.value)))
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
    for (const part of [...this.strokes, ...this.labels]) {
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
    const n = this.strokes.length
    for (let i = 0; i < n; i++) {
      items.push([this.strokes[i]!.creation.to(0), 0.2 + (0.8 * i) / n, 0.2 + (0.8 * (i + 1)) / n])
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
  return [holon.opacity.to(v)]
}
