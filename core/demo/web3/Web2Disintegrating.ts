/**
 * Web2Disintegrating — shots 4–5: the rigid hierarchy that cannot hold.
 *
 * The Web2-centralised half of the Liminal Consulting Web3 video's yin-yang
 * argument (docs/reports/web3-recon.md shots 4–5, §D). A solid equilateral
 * triangle, apex up, built from a dense triangular lattice of small cells
 * (shot 4, 20–24s) assembles and holds — then disintegrates FROM THE BOTTOM
 * UP, its cells detaching and tumbling into loose circles that fall and
 * scatter, blue fading to grey (shot 5, 24–31s). It is the exact antithesis
 * of the Web3 self-organising text (demo/web3/FlowerTextDemo + FlowerText):
 * there a scattered cloud GATHERS into order as one param runs 0 → 1; here an
 * ordered lattice FALLS APART as one param runs 0 → 1. Same gesture, mirrored.
 *
 *   docs/reports/web3-recon.md shots 4–5. Colour measured from the frames:
 *   lattice blue #2f6fd6 on black.
 *
 * WHAT THE FRAMES SAY (refs/web3/frames/f_00024, f_00027..f_00031, 1fps)
 *
 * The recon is a faithful reading of these; where the frames are sharper than
 * the text, the frames won:
 *
 *  - f_00024: the assembled lattice is up-pointing triangle OUTLINES, hollow,
 *    interlocking with the down-triangles between them — a full triangular
 *    subdivision of one big triangle, ~26–30 rows tall. NOT filled cells.
 *  - f_00027..f_00031: the collapse is unmistakably BOTTOM-UP. The top half
 *    stays a crisp rigid lattice while the bottom rows have already let go;
 *    the released cells drift DOWN with a little horizontal scatter, tumble,
 *    fade blue → grey → dark, and — the whole reason this shot exists — their
 *    corners ROUND OFF as they fall: an up-triangle becomes a rounded triangle
 *    becomes a small CIRCLE by the time it reaches the bottom of frame. The
 *    triangle→circle morph is a function of how far a cell has fallen.
 *
 * TRIANGLE→CIRCLE: WHY A DERIVED LINE, NOT A Morph PER CELL
 *
 * vocabulary/Morph exists and is the right tool for ONE outline becoming
 * another — but it is far too heavy here. A MorphShape is a holon that
 * re-resamples two world-space outlines every frame through a pull-based
 * accessor; ~700 of them, each recomputing on every tick, is exactly the
 * per-cell cost the lead warned against. And the morph here is trivial: a
 * small triangle into a small circle of the SAME size, both centred on the
 * cell. So each cell is ONE `Line` whose closed polyline is a pure function
 * of the cell's fall progress — the triangle's three corners resampled to a
 * ring of points, each lerped toward the matching point on a circle. That is
 * the cheap "polygon whose rounding is driven by the same param" reading the
 * brief names, and it keeps a cell at one primitive instead of a whole holon.
 *
 * The derived-`points` idiom (a memoised accessor that recomputes only when
 * the cell's fall key changes, bumping `geomVersion` so the host regenerates
 * the ribbon) is exactly what Morph.ts and parts/curves.ts do; it is ten pure
 * lines, said again here rather than reaching into a private helper — the same
 * choice Morph made. Everything a cell shows (its shape, position, tumble,
 * tint and opacity) is a pure function of the single `collapse` param, so the
 * scene scrubs backwards exactly and re-renders identically: no Math.random
 * (the horizontal scatter and tumble are seeded through flower.ts's hashUnit,
 * keyed on cell index, as FlowerText keys its scatter), no wall-clock.
 *
 * ONE PARAM PER BEAT
 *
 * `assemble` draws the lattice on from nothing (shot 4). `collapse` runs the
 * disintegration bottom-up (shot 5). Each is a pure function of one number,
 * the same shape as FlowerText's `settle` and ClarityField's `burst`.
 *
 * DEPARTURE FROM MEASUREMENT (said plainly, per the house header style):
 *
 *  - The measured lattice colour #2f6fd6 is the AVERAGE of thin blue ink over
 *    black in the source (bloom + compositing flattened it). Drawn literally
 *    at a 1.4px stroke it reads near-black, the same trap ClarityField's red
 *    documents. So the ink is LIFTED to a brighter blue and the header says so.
 *  - Cell count: the reference reads ~26–30 rows. This uses 26 rows (676
 *    cells) — dense enough to read as a rigid lattice, short of the renderer's
 *    instancing-slowdown ceiling (~1000), which is the density the brief asks.
 */

import { Dream } from "../../src/index"
import { Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { hashUnit } from "../../src/geometry/flower"
import { rgb, type Color } from "../../src/constants"

// ── Colour ──────────────────────────────────────────────────────────
// Lifted from the measured #2f6fd6 (see header) so thin ink reads as blue,
// not near-black; the fallen cells fade toward a dim grey before vanishing.
/**
 * Measured from f_00025: the blue ink averages (28,89,135) and reaches
 * (56,109,179) at p90 — but those are pixel averages over antialiased
 * hairlines, not the ink's own colour. Drawn as 1.4px strokes the average
 * renders near-black (this scene's original symptom). Lifted to the bright
 * core the reference actually reads as.
 */
const LATTICE_BLUE: Color = rgb(0x3d, 0x8f, 0xe8)
const FALLEN_GREY: Color = rgb(0x7a, 0x7a, 0x84)

// ── Lattice geometry ────────────────────────────────────────────────
// One big equilateral triangle, apex up, subdivided into ROWS of small
// cells. Row r (0 = apex, N−1 = base) is a horizontal band; within it sit
// up-pointing and down-pointing small triangles, the standard triangular
// mesh the frames show. Total cells = N².
//
// MEASURED, correcting an earlier estimate of 26. Counting horizontal lattice
// lines in refs/web3/frames/f_00025.png gives ~82, i.e. ~41 rows (two lines
// per row). At 26 the lattice read as a coarse grid rather than the fine
// mesh the reference shows. 41 rows is 1,681 cells — above the renderer's
// instancing threshold, which is exactly the case instancing exists for.
const ROWS = 41

// The big triangle's size in scene units. Base width reads frame-filling at
// zoom 1; height is the equilateral √3/2 · base. Base sits a touch below the
// origin so the apex is not crowded at the top of frame.
const BASE_WIDTH = 560
const TRI_HEIGHT = BASE_WIDTH * (Math.sqrt(3) / 2)
const BASE_Y = -TRI_HEIGHT / 2 - 6
const APEX_Y = BASE_Y + TRI_HEIGHT

const CELL_SIDE = BASE_WIDTH / ROWS
const ROW_STEP = CELL_SIDE * (Math.sqrt(3) / 2)
// Circumradius of a small cell — the size the triangle AND the circle it
// morphs into both span, so the morph swaps shape without swapping scale.
const CELL_RADIUS = CELL_SIDE / Math.sqrt(3)
// How many points ring each cell's outline. The triangle needs its 3 corners
// landed on exactly; between them the points space evenly so they have a
// circle point to travel to. 3 corners × 8 edge samples = 24, smooth enough.
const RING = 24

interface Cell {
  /** Centroid in scene units. */
  cx: number
  cy: number
  /** 0 = apex row, ROWS−1 = base row. Drives the bottom-up release. */
  row: number
  /** true = up-pointing, false = down-pointing. */
  up: boolean
  /** Deterministic index for the seeded tumble/scatter (packing order). */
  index: number
}

/**
 * Build the triangular lattice, row by row from the apex down. Row r holds
 * (r+1) up-triangles and r down-triangles, tiled left to right — the classic
 * subdivision of an equilateral triangle into N² congruent cells.
 *
 * A cell's centroid is what everything keys on: the triangle outline is
 * centred there, and so is the circle it becomes. Up- and down-cells differ
 * only in orientation, so one `up` flag carries the whole difference.
 */
const buildLattice = (): Cell[] => {
  const cells: Cell[] = []
  let index = 0
  for (let r = 0; r < ROWS; r++) {
    // The row's top and bottom edge, measured down from the apex.
    const yTop = APEX_Y - r * ROW_STEP
    const yBot = yTop - ROW_STEP
    // The row spans a band whose left edge marches out as r grows.
    const rowHalf = ((r + 1) / ROWS) * (BASE_WIDTH / 2)
    const xLeft = -rowHalf
    for (let k = 0; k <= r; k++) {
      // Up-triangle k in the row: base on yBot, apex on yTop.
      const upCx = xLeft + (k + 0.5) * CELL_SIDE
      const upCy = yBot + (yTop - yBot) / 3 // centroid: 1/3 up from base
      cells.push({ cx: upCx, cy: upCy, row: r, up: true, index: index++ })
      // Down-triangle between this up-cell and the next: base on yTop,
      // apex on yBot. One fewer than the up-triangles, so skip the last.
      if (k < r) {
        const dnCx = xLeft + (k + 1) * CELL_SIDE
        const dnCy = yTop - (yTop - yBot) / 3
        cells.push({ cx: dnCx, cy: dnCy, row: r, up: false, index: index++ })
      }
    }
  }
  return cells
}

/**
 * A cell's outline as a ring of `RING` points, in cell-local space (centred
 * on the origin), at morph `m` ∈ [0, 1]: m = 0 is the little triangle, m = 1
 * is a circle of the same circumradius. Pure — a straight vertex lerp between
 * the two rings, which is why it is cheap enough to run per cell per frame.
 *
 * The triangle ring lands its three CORNERS exactly (at the ring indices that
 * are multiples of RING/3) and spaces the remaining points evenly along the
 * edges, so every point has a well-defined home on the circle to travel to
 * and the corners round off smoothly as m grows — the frames' rounding.
 */
const cellRing = (up: boolean, m: number): Vec3Like[] => {
  const r = CELL_RADIUS
  // Corner angles: an up-triangle points up (a corner at +90°); a down one
  // points down (a corner at −90°). Corners every 120°.
  const corner0 = up ? Math.PI / 2 : -Math.PI / 2
  const perCorner = RING / 3
  const out: Vec3Like[] = []
  for (let i = 0; i < RING; i++) {
    // Which edge, and how far along it (0..1), for the triangle point.
    const seg = Math.floor(i / perCorner)
    const f = (i - seg * perCorner) / perCorner
    const aA = corner0 + (seg * 2 * Math.PI) / 3
    const aB = corner0 + ((seg + 1) * 2 * Math.PI) / 3
    const triX = r * (Math.cos(aA) + (Math.cos(aB) - Math.cos(aA)) * f)
    const triY = r * (Math.sin(aA) + (Math.sin(aB) - Math.sin(aA)) * f)
    // The circle point at the same fraction around the outline.
    const aC = corner0 + (i / RING) * 2 * Math.PI
    const cirX = r * Math.cos(aC)
    const cirY = r * Math.sin(aC)
    out.push({ x: triX + (cirX - triX) * m, y: triY + (cirY - triY) * m, z: 0 })
  }
  out.push(out[0]!) // close the loop for arc-length draw-on
  return out
}

/** Smoothstep — a soft, monotone ease for the per-cell release/fall curves. */
const smooth = (x: number): number => {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}

/** Linear colour blend — blue ink cooling to grey as a cell falls. */
/**
 * Blend two colours.
 *
 * NOT via `rgb()`: that helper takes 0–255 and DIVIDES by 255, but a `Color`
 * is already normalised 0–1. Passing blended components back through it
 * divided them a second time, which drove every cell's tint to ~0.002 — a
 * lattice drawn in near-black on black. That was this scene's real defect;
 * the stroke width and the measured blue were both innocent.
 */
const mixColor = (a: Color, b: Color, u: number): Color => ({
  r: a.r + (b.r - a.r) * u,
  g: a.g + (b.g - a.g) * u,
  b: a.b + (b.b - a.b) * u,
})

export class Web2DisintegratingDream extends Dream {
  /** Shot 4: the rigid lattice draws on from nothing. */
  /**
   * `creation` defaults to 1, so a Null used as a DRIVER starts at its END
   * state. Both drivers must be explicitly zeroed — otherwise every cell is
   * already fallen and faded out at t=0, which renders a black frame with a
   * fully-built holarchy behind it (exactly the symptom this scene had).
   */
  assemble = new Null({ creation: 0 })
  /** Shot 5: the disintegration, bottom rows first. */
  collapse = new Null({ creation: 0 })

  lattice!: Group
  private cells: Cell[] = []
  private root = new Null()

  constructor() {
    super()
    this.cells = buildLattice()
    const lines = this.cells.map((cell) => this.makeCell(cell))
    this.lattice = new Group({ members: lines })
  }

  /**
   * One cell as a single Line whose shape, position, tumble, tint and opacity
   * are all pure functions of `assemble` and `collapse`. The closed polyline
   * is a memoised derived accessor (the Morph.ts / curves.ts idiom): it
   * recomputes only when the cell's fall progress changes, and bumps
   * `geomVersion` so the host regenerates the ribbon exactly then.
   */
  private makeCell(cell: Cell): Line {
    // --- the bottom-up release schedule ---------------------------------
    // A cell lets go earlier the nearer the base it is. rowFrac 1 = base
    // (releases first), 0 = apex (last). Each cell gets a short release
    // window inside `collapse`, ordered by row, with a little per-cell
    // jitter so a row does not snap all at once (the frames show a ragged
    // release front, not a clean horizontal line).
    const rowFrac = cell.row / (ROWS - 1)
    const jitter = (hashUnit(cell.index, 2, 7) - 0.5) * 0.06
    // Base rows start releasing at collapse≈0; apex rows finish near 0.85,
    // leaving the top to fall last. Window width 0.28 = an unhurried tumble.
    const releaseStart = (1 - rowFrac) * 0.72 + jitter
    const releaseSpan = 0.28

    /** This cell's fall progress f ∈ [0, 1] at the current `collapse`. */
    const fallAt = (): number =>
      smooth((this.collapse.creation.value - releaseStart) / releaseSpan)

    // --- the fall trajectory (seeded, deterministic) --------------------
    // Direction and reach of the horizontal scatter, and the tumble rate,
    // are hashed on the cell index — same seed, same fall, every frame.
    const drift = (hashUnit(cell.index, 0, 7) - 0.5) * 2 // −1..1
    const spin = (hashUnit(cell.index, 1, 7) - 0.5) * 2 // −1..1
    // A fully-fallen cell drops well below the base and scatters sideways.
    const fallDistance = TRI_HEIGHT * 0.55 + hashUnit(cell.index, 3, 7) * 120
    const scatterX = drift * CELL_SIDE * 3.2
    const tumble = spin * Math.PI * 2.4

    const line = new Line({
      tint: this.collapse.creation.map(() => {
        const f = fallAt()
        return mixColor(LATTICE_BLUE, FALLEN_GREY, smooth(f * 1.4))
      }),
      // 1.6 matches the reference's hairlines. (An earlier 2.6 was an
      // overcorrection for the near-black lattice, whose real cause was the
      // mixColor double-normalisation above — worth remembering that a
      // symptom can have a cause two layers away from where it shows.)
      stroke: 1.6,
      // Assemble draws the lattice on; once fallen, the cell fades out near
      // the end of its fall so it does not pile up as ink at the bottom.
      opacity: this.assemble.creation.map((a) => {
        const on = smooth((a - rowFrac * 0.5) / 0.5) // apex-first draw-on
        const f = fallAt()
        const fade = 1 - smooth((f - 0.65) / 0.35)
        return Math.max(0, Math.min(1, on)) * fade
      }),
      // Position: at rest the cell sits at its centroid; as it falls it drops
      // and drifts sideways. x and y are derived from `collapse`.
      x: this.collapse.creation.map(() => cell.cx + scatterX * fallAt()),
      y: this.collapse.creation.map(() => cell.cy - fallDistance * fallAt()),
      // Tumble about the cell's own pivot as it falls.
      b: this.collapse.creation.map(() => tumble * fallAt()),
    })

    // The morphing outline: memoised on the cell's fall progress so the
    // polyline recomputes (and geomVersion bumps) only when the shape moves.
    let key = -1
    let memo: Vec3Like[] = []
    Object.defineProperty(line, "points", {
      configurable: true,
      enumerable: true,
      get(this: Line): Vec3Like[] {
        const f = fallAt()
        // Round the key so tiny float wobble does not thrash the memo; the
        // triangle→circle morph reads fully by the time a cell is ~70% down.
        const k = Math.round(smooth(f / 0.7) * 64)
        if (k !== key) {
          key = k
          memo = cellRing(cell.up, k / 64)
          this.geomVersion++
        }
        return memo
      },
      set() {},
    })

    return line
  }

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.root)
    this.stage(this.lattice)

    // Shot 4 — the rigid lattice assembles, apex to base, then holds.
    this.say("A centralised hierarchy assembles itself.")
    this.play(this.assemble.creation.to(1), 3)
    this.wait(1)

    // Shot 5 — it cannot hold: the base gives way first, and the collapse
    // propagates upward as the cells tumble into circles and scatter.
    this.say("But it cannot hold — the base gives way, and it falls.", { hold: true })
    this.play(this.collapse.creation.to(1, { easing: "easeIn" }), 6)
    this.wait(1)
  }
}
