/**
 * Book — THE WRITTEN WORD: "the written word and broadcast" (InterBrain
 * film, 21:30–21:40), the first of the two innovations that changed the
 * physics of the medium — a story that no longer needs the teller at the
 * fire. On the Ancient → Modern arrow (f6496), alone at full size (f6526),
 * under the radio tower in the red field (f6586), and among the media round
 * the GitRepo (f8971).
 *
 * THE DRAWING IS THE FILM'S. The deck's `Book_381` (PL02 slide 15) is a flat
 * open book seen from above — a different icon. The film's book stands open
 * TOWARD us in perspective: two covers as parallelograms falling away from a
 * spine, the spine a narrow upright rectangle, and the white block of pages
 * fanned over the covers' top edges, a dark leaf-line across each half.
 * Traced off f_06526 (the largest instance, 84 × 81 px) at stroke
 * centrelines; the anchors are the frame's own pixels, so the trace can be
 * re-checked against it. Unit H = the book's height, 81 px (`size`); origin
 * the box's centre (587, 387.5) px; a frame point (x, y) maps to
 * ((x − 587)/H, (387.5 − y)/H) in units of `size`, y up. The book is
 * mirror-symmetric about the spine (x = 587), so only the left half is
 * traced and the right is its mirror.
 *
 * `opaque` gives the covers a black body (the red field of f6586 does not
 * show through them).
 */

import { Group, Line, Null, Shape, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, derive, length } from "../../src/params"
import { BLACK, WHITE } from "../../src/constants"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"

/** The trace's frame (f_06526, 1280×720): the book's height and its centre. */
export const BOOK_TRACE = { height: 81, cx: 587, cy: 387.5 } as const

type Px = readonly (readonly [number, number])[]

/** The left cover: its outer top corner, the spine's top, the spine's foot, the outer foot. */
export const LEFT_COVER: Px = [[545, 354], [579, 368], [579, 425], [545, 411]]
/** The spine, an upright rectangle centred on the axis. */
export const SPINE: Px = [[581.5, 369], [592.5, 369], [592.5, 428], [581.5, 428]]
/** The left half of the page block, fanned over the cover's top edge. */
export const LEFT_PAGES: Px = [[545, 354], [552, 350], [558, 347.5], [563, 348.5], [584, 360], [587, 366], [579, 368]]
/** The dark leaf-line across the left pages. */
export const LEFT_LEAF: Px = [[551, 353.5], [582, 365]]

/** Width over height (f6526: 84 × 81 px). */
export const BOOK_ASPECT = (LEFT_COVER.reduce((m, [x]) => Math.max(m, Math.abs(x - BOOK_TRACE.cx)), 0) * 2) / BOOK_TRACE.height

const unit = ([x, y]: readonly [number, number], mirror: boolean): Vec3Like => ({
  x: ((mirror ? 2 * BOOK_TRACE.cx - x : x) - BOOK_TRACE.cx) / BOOK_TRACE.height,
  y: (BOOK_TRACE.cy - y) / BOOK_TRACE.height,
  z: 0,
})

/** A traced run in units of `size` (closed runs repeat their first point). */
export const bookPath = (px: Px, mirror = false, closed = true): Vec3Like[] => {
  const pts = px.map((p) => unit(p, mirror))
  return closed ? [...pts, { ...pts[0]! }] : pts
}

export class Book extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The whole height, the pages' crest to the spine's foot. */
  size = length(170)
  tint = color(WHITE)
  /** Pen width in screen px (f6526's outline). */
  stroke = length(2)
  /** 0 ink only … 1 a black body under the covers. */
  opaque = completion(1)

  body!: Group
  covers!: Group
  pages!: Group

  protected override compose(): void {
    const sized = (pts: Vec3Like[]) => () => pts.map((p) => ({ x: p.x * this.size.value, y: p.y * this.size.value, z: 0 }))
    const line = (pts: Vec3Like[], ink = true) => {
      const l = ink ? new Line({ tint: this.tint, stroke: this.stroke }) : new Line({})
      derivePoints(l, () => [this.size.value], sized(pts))
      return l
    }
    const halves = [false, true]
    const coverRuns = [...halves.map((m) => bookPath(LEFT_COVER, m)), bookPath(SPINE)]
    this.body = this.add(
      new Group({
        members: coverRuns.map(
          (pts) => new Shape({ tint: BLACK, fillOpacity: derive(() => this.opaque.value), outlines: [line(pts, false)] }),
        ),
      }),
    )
    this.covers = this.add(new Group({ members: coverRuns.map((pts) => line(pts)) }))
    // The page block: white, its leaf-lines dark across it (f6526).
    this.pages = this.add(
      new Group({
        members: [
          ...halves.map((m) => new Shape({ tint: this.tint, outlines: [line(bookPath(LEFT_PAGES, m), false)] })),
          ...halves.map((m) => line(bookPath(LEFT_PAGES, m))),
          ...halves.map((m) => {
            const l = new Line({ tint: BLACK, stroke: this.stroke })
            derivePoints(l, () => [this.size.value], sized(bookPath(LEFT_LEAF, m, false)))
            return l
          }),
        ],
      }),
    )
  }

  /** The covers are drawn, then the pages fan open over them. */
  override createAnim(): Anim {
    void this.parts
    return together(restage(Create(this.body), 0, 0.4), restage(Create(this.covers), 0, 0.7), restage(Create(this.pages), 0.5, 1))
  }
}
