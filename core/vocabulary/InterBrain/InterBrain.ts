/**
 * InterBrain — the face of the InterBrain: the Project Liminality Logo at
 * the heart of a faceted crystal, a dark bloom round the Logo.
 *
 * THE CONCEPT (InterBrain film, 27:07): "a collectively interconnected
 * inter-brain in which we all participate as equals" — the instrument the
 * film builds towards; in the film its icon sits in a ring as a DreamNode
 * (f8221, f12376 red; f9271 blue).
 *
 * OUR OWN FACE. The film's icon is a third-party note app's crystal with the
 * Logo pasted in (docs/reports/interbrain-vocabulary.md §6, default 4). Its
 * COMPOSITION is David's (InterBrain.png, 2025-04-06): the Logo at the heart
 * of a crystal, wrapped in a dark bloom. This holon keeps that composition
 * and draws the crystal anew, as a DreamTalk construction — a
 * double-terminated hexagonal quartz seen face-on, symmetric about its axis,
 * NOT the app's leaning rounded silhouette.
 *
 * MEASURED on InterBrain.png (732², the crystal's alpha box 568 × 731):
 *
 *   crystal          half-height H (= `radius`), half-width 0.777·H
 *   Logo ring        radius 0.304·H, centre 0.142·H below the crystal's
 *   bloom            dark from the Logo out to ≈ 1.9 × its ring
 *
 * THE CRYSTAL (units of H, y up): apexes (0, ±1); the girdle's outer
 * corners (±W, ±G) and inner (front) corners (±W/2, ±G·INNER) — the front
 * face reads a little lower, as a prism seen from just above does. Nine
 * facets: three on each termination, three on the prism. Each facet is a
 * faint purple wash, shaded by a light from the upper left (its centroid's
 * direction · LIGHT), so the crystal has the reference's lavender-to-violet
 * turn; the edges are strokes.
 *
 * The Logo (vocabulary/Logo) is imported, never redrawn, and keeps its own
 * Create choreography; it is built at its native 200 and sized by `scale`,
 * which is how the Logo says it is resized.
 */

import { Circle, Group, Line, Null, Shape, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, integer, length, scalar } from "../../src/params"
import { BLACK, rgb, type Color } from "../../src/constants"
import { eased, restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { Logo } from "../Logo/Logo"

/** The crystal, in units of its half-height (see header). */
export const CRYSTAL = {
  halfWidth: 0.777,
  girdle: 0.5,
  inner: 0.88,
  logo: 0.304,
  logoDrop: 0.142,
} as const
/** The light the facets are shaded by: from the upper left. */
const LIGHT = { x: -0.6, y: 0.8 }
/** One bloom disc's darkness; n of them stacked reach 1 − (1 − v)^n. */
const BLOOM_VEIL = 0.17
/** The Logo's native radius (vocabulary/Logo). */
const LOGO_NATIVE = 200

const P = (x: number, y: number): Vec3Like => ({ x, y, z: 0 })

/** The crystal's corners at half-height H. */
export const crystalCorners = (H: number) => {
  const W = CRYSTAL.halfWidth * H
  const G = CRYSTAL.girdle * H
  const g = G * CRYSTAL.inner
  return {
    top: P(0, H),
    bottom: P(0, -H),
    /** The girdle above / below, left to right: outer, inner, inner, outer. */
    upper: [P(-W, G), P(-W / 2, g), P(W / 2, g), P(W, G)],
    lower: [P(-W, -G), P(-W / 2, -g), P(W / 2, -g), P(W, -G)],
  }
}

/** The nine facets as closed loops (each convex). */
export const crystalFacets = (H: number): Vec3Like[][] => {
  const { top, bottom, upper: u, lower: l } = crystalCorners(H)
  const loop = (...ps: Vec3Like[]) => [...ps, ps[0]!]
  return [
    loop(top, u[0]!, u[1]!),
    loop(top, u[1]!, u[2]!),
    loop(top, u[2]!, u[3]!),
    loop(u[0]!, l[0]!, l[1]!, u[1]!),
    loop(u[1]!, l[1]!, l[2]!, u[2]!),
    loop(u[2]!, l[2]!, l[3]!, u[3]!),
    loop(bottom, l[1]!, l[0]!),
    loop(bottom, l[2]!, l[1]!),
    loop(bottom, l[3]!, l[2]!),
  ]
}

/** The crystal's edges: the silhouette first, then the inner edges. */
export const crystalEdges = (H: number): Vec3Like[][] => {
  const { top, bottom, upper: u, lower: l } = crystalCorners(H)
  return [
    [top, u[3]!, l[3]!, bottom, l[0]!, u[0]!, top],
    [u[0]!, u[1]!, u[2]!, u[3]!],
    [l[0]!, l[1]!, l[2]!, l[3]!],
    [u[1]!, top, u[2]!],
    [l[1]!, bottom, l[2]!],
    [u[1]!, l[1]!],
    [u[2]!, l[2]!],
  ]
}

/** 0 (in shadow) … 1 (lit): a facet's centroid direction against LIGHT. */
export const facetLight = (loop: readonly Vec3Like[]): number => {
  const pts = loop.slice(0, -1)
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const d = Math.hypot(cx, cy)
  if (d < 1e-9) return 0.5
  return 0.5 + 0.5 * ((cx * LIGHT.x + cy * LIGHT.y) / d)
}

const mix = (a: Color, b: Color, u: number): Color => ({
  r: a.r + (b.r - a.r) * u,
  g: a.g + (b.g - a.g) * u,
  b: a.b + (b.b - a.b) * u,
})

export class InterBrain extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The crystal's half-height — the symbol's one size (and its reach). */
  radius = length(200)

  /** The edges' purple, and the facets' wash from shadow to light. */
  tint = color(rgb(0xb4, 0x96, 0xff))
  shadowTint = color(rgb(0x4c, 0x14, 0xc8))
  lightTint = color(rgb(0xb8, 0x94, 0xff))
  stroke = length(1.6)
  edgeOpacity = completion(1)
  /** The facets' wash — 0 is pure line-art. */
  facetOpacity = completion(0.7)

  /** The dark bloom round the Logo: nested veils from its ring outward. */
  bloomOpacity = completion(1)
  bloomRings = integer(14)
  bloomReach = scalar(1.9)

  /** The Logo's pen. */
  logoStroke = length(3)

  facets!: Group
  edges!: Group
  bloom!: Group
  logo!: Logo

  /** How far the symbol reaches from its centre: the apexes. */
  get reach(): number {
    return this.radius.value
  }

  protected override compose(): void {
    const H = this.radius.value

    this.facets = this.add(
      new Group({
        members: crystalFacets(H).map(
          (loop) =>
            new Shape({
              tint: mix(this.shadowTint.value, this.lightTint.value, facetLight(loop)),
              fillOpacity: this.facetOpacity,
              outlines: [new Line({ points: loop })],
            }),
        ),
      }),
    )
    this.edges = this.add(
      new Group({
        members: crystalEdges(H).map(
          (points) => new Line({ points, tint: this.tint, stroke: this.stroke, opacity: this.edgeOpacity }),
        ),
      }),
    )

    // The dark bloom: black discs, nested, each a thin veil — where more of
    // them overlap it is darker, so the heart is near black and the dark
    // thins out to `bloomReach` × the Logo's ring, swallowing the facets.
    const lr = CRYSTAL.logo * H
    const cy = -CRYSTAL.logoDrop * H
    const n = this.bloomRings.value
    const reach = this.bloomReach.value
    this.bloom = this.add(
      new Group({
        members: Array.from({ length: n }, (_, i) => {
          const u = i / Math.max(1, n - 1)
          return new Circle({
            y: cy,
            radius: lr * (reach + (1.02 - reach) * u),
            tint: BLACK,
            stroke: 0,
            fillOpacity: i === n - 1 ? 1 : BLOOM_VEIL,
            opacity: this.bloomOpacity,
          })
        }),
      }),
    )

    this.logo = this.add(new Logo({ y: cy, scale: lr / LOGO_NATIVE, stroke: this.logoStroke }))
  }

  /** The crystal's edges draw, its facets wash in and the bloom darkens the
   *  heart; then the Logo makes itself, with its own choreography. */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(eased("smooth", ...this.edges.parts.map((e) => e.creation.sequence(0, 1))), 0, 0.5),
      restage(this.facetOpacity.sequence(0, this.facetOpacity.value), 0.25, 0.6),
      restage(this.bloomOpacity.sequence(0, this.bloomOpacity.value), 0.3, 0.6),
      restage(Create(this.logo), 0.55, 1),
    )
  }
}
