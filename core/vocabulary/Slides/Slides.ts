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
} from "../../src/geometry/keynote"

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

  protected override compose(): void {
    const scale = slideToWorld(this.height.value)

    /** Every drawable by its Keynote id, so groups can adopt them. */
    const byId = new Map<string, Holon>()

    for (const shape of this.data.shapes) {
      const parts = this.composeShape(shape, scale)
      // A shape's subpaths are one drawable; when it has several the
      // group id maps to the first, which is all the group needs to
      // reach it (and MagicMove will match on the shape id itself).
      if (parts[0]) byId.set(shape.id, parts[0])
      this.strokes.push(...parts)
    }

    for (const text of this.data.texts) {
      const label = this.composeText(text, scale)
      byId.set(text.id, label)
      this.labels.push(label)
    }

    // Groups adopt what already exists rather than owning construction —
    // Keynote stores its children in ABSOLUTE canvas coordinates, so a
    // group contributes identity, not a transform (geometry/keynote.ts
    // KeyGroup). Adopting keeps every part's own identity intact, which
    // is what a scene animating one member of a group needs.
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
        out.push(
          this.add(
            new DottedLine({
              points,
              dash: Math.max(shape.dash[0]! * width, width * 0.05),
              gap: shape.dash[1]! * width,
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
