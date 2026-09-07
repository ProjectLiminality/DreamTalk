/**
 * Logo — the Project Liminality brand mark.
 *
 * A blue circle; a red circle riding high inside it; and a white "Λ"
 * whose legs stand on the blue rim and meet just above the red circle's
 * centre. The liminal threshold: the gateway drawn inside the whole.
 *
 * Source (refs/pydeation-legacy/object/custom_objects.py:115-146), the
 * 2024 pitch's own `Logo(CustomObject)`, ported DERIVATION-first — every
 * number below is either one of the source's own named values or an
 * arithmetic consequence of them. Verbatim:
 *
 *   angle_lines  = PI * 2 / 5              # separation of the leg feet
 *   angle_offset = -PI / 2                 # the fan's centre — straight down
 *   self.small_circle_radius        = 200 * 0.61
 *   self.small_circle_center_height = 200 - self.small_circle_radius - 6
 *   self.focal_height = self.small_circle_center_height
 *                       + 0.11 * self.small_circle_radius
 *   x_left, x_right = polar2cartesian(200, angle_offset + angle_lines/2)[0],
 *                     polar2cartesian(200, angle_offset - angle_lines/2)[0]
 *   z               = polar2cartesian(200, angle_offset + angle_lines/2)[1]
 *
 *   main_circle  = Circle(color=BLUE)                       # r = 200 default
 *   small_circle = Circle(z=…center_height, radius=…, color=RED)
 *   lines        = Group(Spline([(x_left, 0, z),  focal_point]),
 *                        Spline([(x_right, 0, z), focal_point]))
 *
 * `polar2cartesian(r, φ) = (r·cos φ, r·sin φ)` (constants.py:26-31), so
 * the feet sit at x = 200·cos(−π/2 ± π/5) = ±117.557 and both share
 * z = 200·sin(−π/2 + π/5) = −161.803. Note the source reads the z of the
 * LEFT foot only and gives it to both legs, which is what makes the Λ
 * symmetric; had it read each leg's own z the two would still agree,
 * since sin is even about −π/2. The redundancy is the source's, kept.
 *
 * The 200 is `Circle`'s own default radius, which the source never
 * overrides — so the main circle's radius IS the unit the rest is stated
 * in, and `radius` here restores that (everything derives from it, so a
 * Logo at any size is the same mark).
 *
 *
 * THE THREE MAGIC DECIMALS, AND WHY THEY STAY
 *
 * 0.61, the −6, and 0.11 are the source's own named values — a designer's
 * three decisions, not fitted parameters. They are carried verbatim
 * rather than rationalised (0.61 is NOT 1/φ = 0.618, and pretending it
 * were would move the mark). Their consequences:
 *
 *   small radius        = 122
 *   small centre        = 200 − 122 − 6 = 72      (the −6 is a 6-unit gap
 *                                                  below the rim: the two
 *                                                  circles nearly kiss at
 *                                                  the top, 200 vs 194)
 *   focal height        = 72 + 0.11·122 = 85.42   (the apex sits 13.42
 *                                                  above the red centre —
 *                                                  just inside its upper half)
 *
 * (The origins vocabulary report §1 quotes 72.2 and 85.6 here; that is
 * an arithmetic slip in the report — 200 − 122 − 6 is 72, not 72.2 — and
 * the source is the authority. The reference frames agree with 72: see
 * below.)
 *
 * Verified against refs/pitch/origins/frames5/f_01700 (Scene09, zoom 1,
 * so 1.29 px per world unit at the origin), predicted vs measured:
 *
 *   main circle    r 258.0 px            measured 258 (x[382,898])
 *   small circle   r 157.4, centre y 267.1   measured 158, 268
 *   leg feet       x 488.4 / 791.6, y 568.7  measured 490 / 790, 566
 *   apex           x 640, y 249.8            measured 640, 249
 *
 * Every landmark inside a pixel or two of the encode — which is what
 * makes the derivation, and not a set of measurements, the source of
 * truth here.
 *
 *
 * THE CHOREOGRAPHY IS NOT A DRAW
 *
 * `Create(logo)` does NOT draw the three parts on together. pydeation
 * dispatches a dedicated `CreateLogo` animator
 * (refs/pydeation-legacy/animation/animator.py:774-806) whose windows are
 *
 *   (0, 0.4)   FadeIn(main_circle)
 *   (0.4, 0.7) Draw(lines, smoothing_right=0)
 *   (0.7, 1)   FadeIn(small_circle, smoothing_left=0.1)
 *              + ChangeParams(small_circle, radius: 0 → 122, smoothing_left=0)
 *              + Transform(small_circle, z: focal_height → 72, smoothing_left=0)
 *
 * — the blue circle appears whole out of the dark, the Λ draws itself up
 * from the rim, and the red circle is BORN AT THE APEX, swelling out of
 * the focal point and settling down into place. That last simultaneity
 * is the mark's whole idea in motion: the threshold opens, and what
 * comes through it grows from the point where the gateway closes.
 *
 * Read straight off the reference (f_01606-f_01696, Scene09's 18s draw;
 * see Scene09.ts for the frame table): blue reaches full brightness with
 * no partial arc ever visible (a fade, not a draw); the white ink's
 * BOTTOM edge is pinned at y=565 from its first frame while its top
 * climbs 565 → 543 → 445 → 249 (the legs grow upward from their feet,
 * which is `Spline([foot, focal])`'s own direction and so core's default
 * pen); and the red circle's radius grows 76.5 → 158 px while its centre
 * DESCENDS 259.5 → 268 — the swell and the settle, together, exactly as
 * the three (0.7, 1) animations state.
 */

import { color, length } from "../../src/params"
import { eased, restage, together, type Anim } from "../../src/anim"
import { Circle, Line, Stroke } from "../../src/parts/primitives"
import { BLUE, PI, RED, WHITE } from "../../src/constants"

/** The angular separation of the two leg feet on the main circle. */
export const ANGLE_LINES = (PI * 2) / 5
/** The fan's centre angle — straight down, so the Λ stands upright. */
export const ANGLE_OFFSET = -PI / 2

/** The designer's three decimals (custom_objects.py:126-133). */
export const SMALL_CIRCLE_RATIO = 0.61
export const SMALL_CIRCLE_GAP = 6
export const FOCAL_RATIO = 0.11

/**
 * The mark's proportions, all as fractions of the main circle's radius —
 * the source's arithmetic, done once, in the unit the source states it
 * in (radius = 200). Exported so the tests can pin the derivation
 * without re-deriving it, and so Scene05/09 can talk about the focal
 * point without reaching into a Logo instance.
 */
export const proportions = (radius: number) => {
  const smallRadius = radius * SMALL_CIRCLE_RATIO
  const smallCenter = radius - smallRadius - SMALL_CIRCLE_GAP * (radius / 200)
  const focalHeight = smallCenter + FOCAL_RATIO * smallRadius
  // polar2cartesian(r, φ) = (r·cos φ, r·sin φ) — constants.py:26.
  const footX = radius * Math.cos(ANGLE_OFFSET + ANGLE_LINES / 2)
  const footY = radius * Math.sin(ANGLE_OFFSET + ANGLE_LINES / 2)
  return { smallRadius, smallCenter, focalHeight, footX, footY }
}

export class Logo extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol — the mark, not a prop. */
  static sovereign = true

  /**
   * The main circle's radius — the mark's single unit. 200 is `Circle`'s
   * own C4D default, which the source relies on rather than states, so
   * every proportion above is a fraction of THIS.
   *
   * The 6-unit gap is the one absolute length in the construction; it
   * scales with `radius` here (via radius/200 in `proportions`) so that
   * a Logo of any size is the same mark rather than a differently
   * proportioned one. At the default it is exactly the source's 6.
   */
  radius = length(200)
  /** The main circle's colour. The 2021/2024 palette's BLUE. */
  override tint = color(BLUE)
  /** The small circle's colour, promoted separately — the mark is two-tinted. */
  smallTint = color(RED)
  /** The Λ's colour. White in every instance the pitch stages. */
  lineTint = color(WHITE)

  /**
   * `Transform(logo, scale=…)` is how the source resizes it
   * (Scene05's `scale=0.6`, Scene06's `5/4`), so `scale` — the Holon's
   * own — is the sanctioned handle and `radius` states the mark's
   * intrinsic size. Both work; they compose.
   */

  /**
   * The mark's own numbers, derived once from `radius` at construction.
   *
   * A snapshot rather than a live binding, deliberately: `smallCircle`'s
   * radius and y are the two params `createAnim` DRIVES (0 → smallRadius,
   * focalHeight → smallCenter), so they cannot also follow a derived
   * reading, and the legs' `points` are plain data with no param to bind.
   * Resizing a built Logo therefore goes through `scale`, which is what
   * the source does everywhere it resizes one.
   */
  get geometry() {
    return proportions(this.radius.value)
  }

  mainCircle = new Circle({
    radius: this.radius,
    tint: this.tint,
    stroke: this.stroke,
  })

  /**
   * The red circle. Its `radius` and `y` are the two params CreateLogo
   * animates — they start at 0 and at the focal height respectively —
   * so they are plain params here, set to their SETTLED values. The
   * animator states the initial condition, which is the pydeation
   * pattern (`set_initial_params_object`) and the reason a finished
   * Logo needs no special construction.
   */
  smallCircle = new Circle({
    radius: this.geometry.smallRadius,
    y: this.geometry.smallCenter,
    tint: this.smallTint,
    stroke: this.stroke,
  })

  /**
   * The two legs, each `Spline([foot, focal])` — points in that order,
   * so core's default (unreversed) pen enters at the foot and travels
   * up to the apex, which is what the reference shows.
   *
   * pydeation builds in the XZ plane and its out-of-plane y is our z;
   * a front-view camera maps its z straight to our y, so the source's
   * `(x, 0, z)` is our `(x, z, 0)`.
   */
  leftLeg = new Line({
    points: [
      { x: this.geometry.footX, y: this.geometry.footY, z: 0 },
      { x: 0, y: this.geometry.focalHeight, z: 0 },
    ],
    tint: this.lineTint,
    stroke: this.stroke,
  })
  rightLeg = new Line({
    points: [
      { x: -this.geometry.footX, y: this.geometry.footY, z: 0 },
      { x: 0, y: this.geometry.focalHeight, z: 0 },
    ],
    tint: this.lineTint,
    stroke: this.stroke,
  })

  /**
   * CreateLogo (animator.py:774-806), window for window.
   *
   * The three (0.7, 1) animations run TOGETHER on the small circle —
   * opacity, radius and height — which is what makes it bloom out of the
   * apex rather than simply appear there. The source's `smoothing_left`
   * variations across the three (0.1 on the fade, 0 on the other two)
   * are a tangent detail of C4D's keyframe interpolation that our single
   * `easing` per track cannot express separately; the shared default
   * smooth ease is the honest single reading, and the fade's 0.1 differs
   * from the others by too little to show at 5fps.
   *
   * `smoothing_right=0` on the leg draw IS expressible and IS kept: the
   * pen must not decelerate into the apex, because the small circle's
   * bloom begins the instant it arrives.
   *
   * Every window goes on through `restage()`, not a plain tuple, and
   * that is not cosmetic — it is the difference between passing and
   * failing the reference. pydeation states an ease's tangents against
   * the WHOLE play span, so a track occupying 0.3 of it carries them
   * proportionally longer (timeline.ts smoothingFor, and Track.
   * smoothingWindow which restage sets). CreateLogo is a composite
   * animator of exactly the kind that needs it: it assembles its
   * choreography at full span and each sub-window is a fraction of that
   * span, not an ease authored for a 0.3-long window. Scored against
   * refs/pitch/origins/frames5 the plain-tuple version draws the legs
   * over 1.0s where the reference takes 0.6, and blooms the small
   * circle a full frame late; restaged, both land on the reference.
   * (Video-01's S05 hit the same distinction with its Axes.)
   */
  override createAnim(): Anim {
    const { smallRadius, smallCenter, focalHeight } = this.geometry
    return together(
      restage(this.mainCircle.opacity.sequence(0, 1), 0, 0.4),
      restage(
        eased(
          "easeIn",
          this.leftLeg.creation.sequence(0, 1),
          this.rightLeg.creation.sequence(0, 1),
        ),
        0.4,
        0.7,
      ),
      restage(this.smallCircle.opacity.sequence(0, 1), 0.7, 1),
      restage(this.smallCircle.radius.sequence(0, smallRadius), 0.7, 1),
      restage(this.smallCircle.y.sequence(focalHeight, smallCenter), 0.7, 1),
    )
  }

  /**
   * UnCreateLogo (animator.py:808-836) — NOT createAnim reversed. The
   * source runs its own order, outside-in reversed: the small circle
   * fades FIRST (0, 0.3), the legs un-draw (0.3, 0.6), the main circle
   * fades LAST (0.6, 1). The mark leaves through its own gateway.
   *
   * Note the small circle only FADES here — it does not shrink back into
   * the apex — so un-creating and re-creating a Logo is not symmetric,
   * which is the source's own asymmetry and is kept.
   */
  override unCreateAnim(): Anim {
    return together(
      restage(this.smallCircle.opacity.to(0), 0, 0.3),
      restage(together(this.leftLeg.creation.to(0), this.rightLeg.creation.to(0)), 0.3, 0.6),
      restage(this.mainCircle.opacity.to(0), 0.6, 1),
    )
  }
}
