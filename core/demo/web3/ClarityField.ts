/**
 * ClarityField — shots 7 and 8: complexity, and the clarity inside it.
 *
 * The turn of the Liminal Consulting Web3 argument. The word "Web3" gives way
 * to a vast field of flower-of-life ringlets that sweeps in from the edges of
 * the frame and gathers into a dim red disc ringed by a loose grey halo
 * (shot 7, 45–50s). Then a blue-ringed disc of bright dots crystallises at its
 * heart: the "clarity behind complexity" (shot 8, 50–62s).
 *
 * The same field is the stage of two later shots, which is why it carries
 * four beats rather than two (see Shot09 and Shot14):
 *
 *   burst   — the field gathers in and fades up (shot 7);
 *   clarity — the blue disc of dots crystallises (shot 8);
 *   veil    — the disc recedes and the field dims under the Vitalik quote
 *             (shot 9), and comes back when veil returns to 0;
 *   expand  — the disc swells to the size of the hero's red ring, its ring
 *             turning from blue to red, while the field dissolves around it
 *             (shot 14, the hand-off into shot 15).
 *
 * Each is a pure function of one number, the same shape as FourierTrace's
 * `turn` and FlowerText's `settle`.
 *
 * WHAT THE FRAMES SHOW (refs/web3/frames f_00046–f_00063, f_00120–f_00130)
 *
 *   - the field does NOT grow out of the centre: at 45s a faint lattice
 *     already fills the frame behind the word, and over 45–47.5s it CONTRACTS
 *     into the disc. So `burst` brings the ringlets in from 2.2× their rest
 *     radius as it fades them up.
 *   - the red core is ~190px across at 1280w (≈148 units at this camera) and
 *     DIM — a red haze of overlapping ringlets, not a bright lattice. Around it
 *     a loose halo of grey ringlets of mixed sizes runs out to ~310px (≈242
 *     units). The halo is irregular, not a packing: it is drawn from seeded
 *     noise so it re-renders identically.
 *   - the clarity ring is ~75px in radius (≈58 units), bright blue, around a
 *     hex lattice of white dots ~13px apart.
 *   - by 129s the ring has grown to ≈146 units and is turning red; at 130s it
 *     IS the hero's ring (≈198 units), which is where shot 15 picks it up.
 *
 * An earlier version of this scene drew a 330-unit field of bright 17-unit
 * cells and a 96-unit disc, and its two drivers were `new Null()` — creation
 * 1 — so it opened fully formed (the campaign doc's first host trap). Both
 * are corrected here against the frames above.
 *
 * WHY THIS IS A SCENE AND NOT A HOLON
 *
 * It is `hexPack` (already built for FlowerText) over a disc mask, a seeded
 * scatter, a ring and a second pack. Nothing here is a new capability — the
 * campaign map's test is whether the *parameterisation* is the interesting
 * thing, and here it is not: what is interesting is this particular
 * composition, which is exactly what a scene is for.
 *
 * THE DENSITY FALLOFF IS OPACITY, NOT SPACING
 *
 * A radially-varying pack destroys the flower-of-life lattice — the thing the
 * whole motif is ABOUT — because the lattice only exists when every circle is
 * the same distance from its neighbours. So the core is a uniform pack whose
 * brightness falls away, and the halo is a separate scatter.
 */

import { Dream } from "../../src/index"
import { Circle, Group, Null } from "../../src/parts/primitives"
import { hashUnit, hexPack, type Vec2 } from "../../src/geometry/flower"
import { rgb, type Color } from "../../src/constants"

/**
 * Measured from the reference frames, then the red DELIBERATELY lifted: the
 * measured #7a2a24 is the field as photographed — thin ink averaged over
 * black after the original's bloom. Drawn literally as ink it reads
 * near-black, so the ink is brighter than the field it averages to.
 */
/**
 * Re-measured at full resolution (2026-10-04, 55s): the core reads as thin
 * deep-red lines (median (30,12,11) on screen), the halo's brightest grey
 * ~(33,30,31), the ring (25,117,192). The host treats a tint as linear light
 * and encodes it for display, so screen colours go over decoded (`seen`).
 */
const seen = (r: number, g: number, b: number): Color => {
  const decode = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return { r: decode(r), g: decode(g), b: decode(b) }
}
const RED_CORE = seen(150, 62, 60)
const RIM_GREY = rgb(0x9a, 0x96, 0x96)
const CLARITY_BLUE = seen(25, 125, 205)
/** The hero ring's red (shot 15) — where `expand` takes the clarity ring. */
const HERO_RED = seen(252, 93, 75) // the hero ring, measured at 135s
const DOT_WHITE = rgb(0xff, 0xff, 0xff)

/** The red core's reach and the halo's, in scene units (see header). */
const CORE_RADIUS = 150
const HALO_INNER = 135
const HALO_OUTER = 260
const HALO_COUNT = 1300
/** The clarity disc at rest, and where `expand` takes it — the hero's ring. */
export const CLARITY_RADIUS = 58
export const HERO_RING_RADIUS = 198
/** How far out the ringlets start before `burst` gathers them. */
const GATHER_FROM = 2.2

/** A disc as a polygon, for hexPack's mask. */
const disc = (radius: number, segments = 96): Vec2[] =>
  Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius }
  })

/** Linear blend between two colours. Components directly — never back through rgb(). */
const mix = (a: Color, b: Color, u: number): Color => ({
  r: a.r + (b.r - a.r) * u,
  g: a.g + (b.g - a.g) * u,
  b: a.b + (b.b - a.b) * u,
})

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const smooth = (u: number) => {
  const v = clamp01(u)
  return v * v * (3 - 2 * v)
}

export class ClarityFieldDream extends Dream {
  /** Shot 7: the field gathers in. Drivers start at 0 — never `new Null()`. */
  burst = new Null({ creation: 0 })
  /** Shot 8: the clarity disc crystallises. */
  clarity = new Null({ creation: 0 })
  /** Shot 9: the disc recedes and the field dims under the quote. */
  veil = new Null({ creation: 0 })
  /** Shot 14: the disc swells into the hero's ring; the field dissolves. */
  expand = new Null({ creation: 0 })

  field!: Group
  inner!: Group
  ring!: Circle

  protected root = new Null()

  constructor() {
    super()
    // --- the complexity field: a dim red core ------------------------------
    // Flower-of-life spacing (radius = spacing) over a disc; brightness falls
    // toward the edge, the lattice never does.
    // Cell size re-measured (55s, 1280w): ~13px, i.e. 10 units.
    const core = hexPack([disc(CORE_RADIUS)], { spacing: 10 }).map((c) => {
      const d = Math.hypot(c.x, c.y) / CORE_RADIUS
      return this.ringlet(c, 10, RED_CORE, 0.22 * (1 - 0.45 * d * d), 1)
    })

    // --- the loose grey halo -----------------------------------------------
    // Seeded, so it re-renders identically. Denser near the core, and the
    // innermost ringlets keep a little of the red.
    const halo = Array.from({ length: HALO_COUNT }, (_, i) => {
      const a = hashUnit(i, 0, 31) * Math.PI * 2
      // sqrt-free radial draw biased inward: thins out toward the rim.
      const u = hashUnit(i, 1, 31)
      const r = HALO_INNER + (HALO_OUTER - HALO_INNER) * u * u
      const size = 1.3 + 3.2 * hashUnit(i, 2, 31)
      const out = (r - HALO_INNER) / (HALO_OUTER - HALO_INNER)
      return this.ringlet(
        { x: Math.cos(a) * r, y: Math.sin(a) * r },
        size,
        mix(RED_CORE, RIM_GREY, clamp01(0.6 + out * 2.5)),
        0.1 * (1 - out) + 0.02,
        0.8,
      )
    })
    this.field = new Group({ members: [...core, ...halo] })

    // --- the clarity disc ---------------------------------------------------
    // Dots are packed over the HERO disc so `expand` can reveal more of them
    // as the ring swells; at rest only those inside the clarity ring show.
    const dots = hexPack([disc(HERO_RING_RADIUS - 4)], { spacing: 8 }).map((c) => {
      const d = Math.hypot(c.x, c.y)
      return new Circle({
        radius: 0.75,
        x: c.x,
        y: c.y,
        tint: DOT_WHITE,
        fillOpacity: 1,
        stroke: 0.8,
        opacity: this.discReading((on, rNow, e) => {
          const inside = clamp01((rNow - 5 - d) / 6)
          return on * inside * this.dotFade(e)
        }),
      })
    })
    this.inner = new Group({ members: dots })
    this.ring = new Circle({
      radius: this.expand.creation.map((e) => this.discRadius(e)),
      tint: this.expand.creation.map((e) => mix(CLARITY_BLUE, HERO_RED, this.ringRed(e))),
      stroke: 3,
      opacity: this.discReading((on) => on),
    })
  }

  /** The clarity ring's radius at expansion `e`. */
  protected discRadius(e: number): number {
    return CLARITY_RADIUS + (HERO_RING_RADIUS - CLARITY_RADIUS) * smooth(e)
  }

  /**
   * A derived opacity for the clarity disc's parts: how present the disc is
   * (clarity in, veil out), its current radius and the expansion.
   */
  private discReading(f: (on: number, radius: number, e: number) => number) {
    return this.clarity.creation.map((c) => {
      const on = clamp01(c) * (1 - clamp01(this.veil.creation.value))
      const e = clamp01(this.expand.creation.value)
      return f(on, this.discRadius(e), e)
    })
  }

  /**
   * One ringlet of the field. Its position is gathered in by `burst` (from
   * GATHER_FROM× out to rest), and its brightness is faded up by `burst`,
   * dimmed by clarity and veil, and dissolved by expand.
   */
  private ringlet(c: Vec2, radius: number, tint: Color, rest: number, stroke: number): Circle {
    return new Circle({
      radius: this.burst.creation.map((b) => radius * this.ringScale(b)),
      x: this.burst.creation.map((b) => c.x * this.spreadAt(b)),
      y: this.burst.creation.map((b) => c.y * this.spreadAt(b)),
      tint,
      stroke,
      opacity: this.burst.creation.map((b) => {
        const k = this.fadeAt(b)
        const dim = 1 - 0.3 * clamp01(this.clarity.creation.value) - 0.45 * clamp01(this.veil.creation.value)
        const fade = this.fieldFade(this.expand.creation.value, Math.hypot(c.x, c.y))
        return rest * k * dim * fade
      }),
    })
  }

  /** How present the clarity dots stay as the disc swells (expand `e`). */
  protected dotFade(e: number): number {
    return (1 - e) ** 1.5
  }

  /** How far the ring has turned from blue to red at expand `e`. */
  protected ringRed(e: number): number {
    return smooth((e - 0.45) / 0.55)
  }

  /** How present a field ringlet `r` from the centre stays as the disc
   *  swells (expand `e`). */
  protected fieldFade(e: number, _r: number): number {
    return 1 - smooth((e - 0.2) / 0.8)
  }

  /** How far out the field stands at `burst` b (1 = at rest). */
  protected spreadAt(b: number): number {
    return 1 + (GATHER_FROM - 1) * (1 - smooth(b))
  }

  /** How large a ringlet stands at `burst` b — the standalone gathers its
   *  ringlets in without scaling them. */
  protected ringScale(_b: number): number {
    return 1
  }

  /** How faded up the field is at `burst` b. */
  protected fadeAt(b: number): number {
    return clamp01(b * 1.6)
  }

  protected stageField() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.root)
    this.stage(this.field)
    this.stage(this.inner)
    this.stage(this.ring)
  }

  unfold() {
    this.stageField()

    // Shot 7 — the field gathers in out of the frame's edges, then rests.
    this.say("The word bursts into complexity.")
    this.play(this.burst.creation.to(1, { easing: "easeOut" }), 2.5)
    this.wait(2.5)

    // Shot 8 — the clarity inside it.
    this.say("And inside the complexity, clarity.", { hold: true })
    this.play(this.clarity.creation.to(1), 1.5)
    this.wait(3)
  }
}
