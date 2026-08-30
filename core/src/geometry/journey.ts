/**
 * One MindVirus's journey — spawn to brick — as pure math.
 *
 * Ported from TheWall/TheWall.py's MindVirusJourney generator (the
 * Python-in-C4D original; line citations below refer to it). The study
 * (docs/reports/wall-stack-study.md §"What ports cleanly") calls this
 * pipeline "already pure f(growth, index) — preserve verbatim; best
 * code in the stack", and that is exactly what this file is: the same
 * arithmetic, with every magic number named and cited.
 *
 * The shape of one journey:
 *
 *  1. a cubic Bezier flight path from the shared spawn point to this
 *     virus's own wall slot, its control points derived purely from
 *     the endpoint geometry — p1 = spawn + spawnDir (the departure
 *     flourish), p2 = slot + normal · distance · ARRIVAL_FACTOR (the
 *     approach along the slot's outward normal) (:1129-1154);
 *  2. an arc-length LUT over that Bezier so travel is uniform in
 *     DISTANCE, not in the parameter (:1155-1189);
 *  3. `completion` — one number in [0,1] per virus per frame, produced
 *     by the growth wave sweeping the footprint (see completionOf);
 *  4. the mappings: completion → travel → spline position, fold, and
 *     scale (:331-398 for the first two, :1356-1386 for scale).
 *
 * The choreography those mappings encode, in words:
 *
 *   TRAVEL   completion [0, 0.85] eases out into the slot; the last
 *            0.15 of completion is arrival with no more travel.
 *   PULSES   the flight is num_pulses jellyfish thrusts, num_pulses =
 *            round(pathLength / DISTANCE_PER_THRUST), each 10% open /
 *            55% thrust / 35% glide of its distance. NOTE this is the
 *            JOURNEY's profile — the standalone creature's own pulse
 *            (parts/mindvirus.ts, 5/55/40) is a different reading of
 *            the same three phases, and the two are kept apart on
 *            purpose.
 *   BRICK    travel [0.8, 1] is the brick phase: the creature stops
 *            swimming and settles into the wall, folding shut.
 *   FOLD     1 → 0.1 → 1 per pulse (the bell), then in the brick
 *            phase 1 → 0.1 → −1, finishing at 75% of that phase —
 *            the last quarter travels fully wrapped.
 *   SCALE    "tiny lies that grow": pop to 20% by completion 0.05,
 *            cruise to 35% by 0.65, smoothstep to 75% by 0.75, then
 *            swell to 100% — overlapping the travel deceleration.
 *
 * Everything here is plain numbers and Vec3 — no Holon, no render.
 */

/** A point in world space. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const mul = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k })
const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z)

/** Non-zero-safe normalize. */
export const normalize = (v: Vec3, fallback: Vec3 = { x: 0, y: 0, z: 1 }): Vec3 => {
  const l = len(v)
  return l < EPSILON ? fallback : mul(v, 1 / l)
}

/** The source's own "is this vector/length worth anything" threshold (:1119, :1143). */
export const EPSILON = 0.001

// ---------------------------------------------------------------------------
// The named constants — every literal from the source, with its citation.
// ---------------------------------------------------------------------------

/** Pulses per this many units of path length (:1096 distance_per_thrust). */
export const DISTANCE_PER_THRUST = 350

/** p2 sits this far off the slot along its normal, as a fraction of the
 *  spawn→slot distance (:1095 arrival_curve_factor, :1148). */
export const ARRIVAL_FACTOR = 0.25

/** Samples in the Bezier arc-length LUT (:1092 ARC_LUT_SAMPLES). */
export const ARC_LUT_SAMPLES = 100

/** Travel (and its fold) occupy completion [0, TRAVEL_END] (:1294). */
export const TRAVEL_END = 0.85

/** Of the travel parameter, [0, THRUST_END] is swimming; the rest is the
 *  brick phase (:333 total_thrust_t / :384 in completion_to_fold). */
export const THRUST_END = 0.8

/** The swimming phases cover this much of the path; the brick phase covers
 *  the remaining 0.2 (:334 total_spline_travel). */
export const THRUST_TRAVEL = 0.8

/** One pulse: time shares of open and thrust; the rest glides (:339-340). */
export const PULSE_OPEN_TIME = 0.3
export const PULSE_THRUST_TIME = 0.2

/** One pulse: distance shares — 10% opening, 55% thrusting, 35% gliding
 *  (:341-343). The Journey's own profile; see the header note. */
export const PULSE_OPEN_DISTANCE = 0.1
export const PULSE_THRUST_DISTANCE = 0.55
export const PULSE_GLIDE_DISTANCE = 0.35

/** The bell never closes further than this while swimming (:373, :391). */
export const PULSE_MIN_FOLD = 0.1

/** Brick phase: its first 30% covers 15% of the remaining distance, the
 *  rest covers the other 85% — a slow settle then a drop in (:356-360). */
export const BRICK_SETTLE_TIME = 0.3
export const BRICK_SETTLE_DISTANCE = 0.15

/** The brick fold completes at 75% of the brick phase; the last 25%
 *  travels fully folded (:395-396). */
export const BRICK_FOLD_END = 0.75

/** The growth wave's smoothstep width in footprint-t units (:1288). */
export const TRANSITION_WIDTH = 0.15

/** Scale milestones — "tiny lies that grow" (:1362-1386). */
export const SCALE_POP_END = 0.05
export const SCALE_POP_VALUE = 0.2
export const SCALE_CRUISE_END = 0.65
export const SCALE_CRUISE_VALUE = 0.35
export const SCALE_RAMP_END = 0.75
export const SCALE_RAMP_VALUE = 0.75

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** The source's smoothstep, spelled out everywhere it appears (:1289). */
export const smoothstep = (t: number): number => t * t * (3 - 2 * t)

/** Quadratic ease-out — the source's `1 - (1-t)^2` (:1301, :1367). */
export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t)

// ---------------------------------------------------------------------------
// The cubic Bezier flight path (:1119-1189)
// ---------------------------------------------------------------------------

/** The four control points of one flight. */
export interface BezierPath {
  p0: Vec3
  p1: Vec3
  p2: Vec3
  p3: Vec3
}

/** Evaluate a cubic Bezier at parameter t (:1121-1124). */
export const bezierPoint = (path: BezierPath, t: number): Vec3 => {
  const u = 1 - t
  const { p0, p1, p2, p3 } = path
  return add(
    add(mul(p0, u * u * u), mul(p1, 3 * u * u * t)),
    add(mul(p2, 3 * u * t * t), mul(p3, t * t * t)),
  )
}

/** Unnormalized tangent of a cubic Bezier at t (:1126-1129). */
export const bezierTangent = (path: BezierPath, t: number): Vec3 => {
  const u = 1 - t
  const { p0, p1, p2, p3 } = path
  return add(
    add(mul(sub(p1, p0), 3 * u * u), mul(sub(p2, p1), 6 * u * t)),
    mul(sub(p3, p2), 3 * t * t),
  )
}

export interface FlightEndpoints {
  spawn: Vec3
  slot: Vec3
  /**
   * Departure vector from the spawn point — direction AND magnitude.
   * The full vector length sets the p1 offset, so dragging the spawn
   * direction further exaggerates the departure curve (:1136-1140).
   */
  spawnDir?: Vec3
  /** Outward normal at the slot: the approach direction (:1145-1149). */
  slotNormal?: Vec3
  /** Override the p2 offset fraction (default ARRIVAL_FACTOR). */
  arrivalFactor?: number
}

/**
 * Build the four control points from the endpoint geometry alone
 * (:1131-1154). No spline files — the path shape emerges from where the
 * creature starts and where its slot is.
 */
export const buildBezierPath = (e: FlightEndpoints): BezierPath => {
  const { spawn, slot } = e
  const direction = sub(slot, spawn)
  const distance = len(direction)
  if (distance < EPSILON) return { p0: spawn, p1: spawn, p2: slot, p3: slot }

  const arrival = e.arrivalFactor ?? ARRIVAL_FACTOR
  // Without a spawn direction the source leaves along the straight line,
  // a third of the way out (:1139-1140).
  const p1 =
    e.spawnDir && len(e.spawnDir) > EPSILON
      ? add(spawn, e.spawnDir)
      : add(spawn, mul(normalize(direction), distance * 0.33))
  // Without a slot normal the source approaches from -X (:1151).
  const p2 =
    e.slotNormal && len(e.slotNormal) > EPSILON
      ? add(slot, mul(e.slotNormal, distance * arrival))
      : add(slot, mul({ x: -1, y: 0, z: 0 }, distance * arrival))

  return { p0: spawn, p1, p2, p3: slot }
}

/** An arc-length table over a Bezier: cumulative length at each sample. */
export interface ArcLut {
  path: BezierPath
  cumulative: number[]
  totalLength: number
  samples: number
}

/** Sample a Bezier into a cumulative-length table (:1156-1167). */
export const buildArcLut = (path: BezierPath, samples: number = ARC_LUT_SAMPLES): ArcLut => {
  const positions: Vec3[] = []
  for (let i = 0; i <= samples; i++) positions.push(bezierPoint(path, i / samples))

  const cumulative = [0]
  for (let i = 1; i < positions.length; i++) {
    cumulative.push(cumulative[i - 1]! + len(sub(positions[i]!, positions[i - 1]!)))
  }
  return { path, cumulative, totalLength: cumulative[cumulative.length - 1]!, samples }
}

/**
 * Map normalized arc-length s to the Bezier parameter t, by binary
 * search through the LUT (:1169-1189). This is what makes travel uniform
 * in distance rather than in the parameter.
 */
export const arcLengthToT = (lut: ArcLut, s: number): number => {
  if (s <= 0) return 0
  if (s >= 1) return 1
  const { cumulative, totalLength, samples } = lut
  const target = s * totalLength

  let lo = 0
  let hi = cumulative.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (cumulative[mid]! < target) lo = mid
    else hi = mid
  }
  const seg = cumulative[hi]! - cumulative[lo]!
  const frac = seg > 0 ? (target - cumulative[lo]!) / seg : 0
  return (lo + frac) / samples
}

/** Pulse count for a path of this length (:1256). At least one. */
export const pulseCountFor = (
  pathLength: number,
  distancePerThrust: number = DISTANCE_PER_THRUST,
): number => Math.max(1, Math.round(pathLength / distancePerThrust))

// ---------------------------------------------------------------------------
// The completion mappings (:331-398) — ported verbatim
// ---------------------------------------------------------------------------

/**
 * Travel parameter → position along the path, normalized (:332-361).
 *
 * `numPulses` thrust cycles fill [0, THRUST_END] and cover the first
 * THRUST_TRAVEL of the path; the brick phase covers the rest.
 */
export const travelToSplinePosition = (t: number, numPulses: number): number => {
  if (t <= 0) return 0
  if (t >= 1) return 1

  if (t <= THRUST_END) {
    const pulseSpan = THRUST_END / numPulses
    const pulseIdx = Math.min(Math.floor(t / pulseSpan), numPulses - 1)
    const localT = (t - pulseIdx * pulseSpan) / pulseSpan
    const distPerPulse = THRUST_TRAVEL / numPulses
    const pulseBase = pulseIdx * distPerPulse

    if (localT <= PULSE_OPEN_TIME) {
      return pulseBase + (localT / PULSE_OPEN_TIME) * PULSE_OPEN_DISTANCE * distPerPulse
    }
    if (localT <= PULSE_OPEN_TIME + PULSE_THRUST_TIME) {
      const progress = (localT - PULSE_OPEN_TIME) / PULSE_THRUST_TIME
      return pulseBase + (PULSE_OPEN_DISTANCE + progress * PULSE_THRUST_DISTANCE) * distPerPulse
    }
    const progress =
      (localT - PULSE_OPEN_TIME - PULSE_THRUST_TIME) / (1 - PULSE_OPEN_TIME - PULSE_THRUST_TIME)
    return (
      pulseBase +
      (PULSE_OPEN_DISTANCE + PULSE_THRUST_DISTANCE + progress * PULSE_GLIDE_DISTANCE) * distPerPulse
    )
  }

  const brickT = (t - THRUST_END) / (1 - THRUST_END)
  const remaining = 1 - THRUST_TRAVEL
  if (brickT <= BRICK_SETTLE_TIME) {
    return THRUST_TRAVEL + (brickT / BRICK_SETTLE_TIME) * remaining * BRICK_SETTLE_DISTANCE
  }
  const progress = (brickT - BRICK_SETTLE_TIME) / (1 - BRICK_SETTLE_TIME)
  return (
    THRUST_TRAVEL +
    remaining * BRICK_SETTLE_DISTANCE +
    progress * remaining * (1 - BRICK_SETTLE_DISTANCE)
  )
}

/**
 * Travel parameter → fold, the bell (:363-398).
 *
 * While swimming, each pulse runs 1 → PULSE_MIN_FOLD → 1. In the brick
 * phase the same opening is followed by a fold clean through to −1
 * (wrapped), completing at BRICK_FOLD_END of the phase.
 */
export const travelToFold = (t: number, numPulses: number): number => {
  if (t <= 0) return 1
  if (t >= 1) return -1

  if (t <= THRUST_END) {
    const pulseSpan = THRUST_END / numPulses
    const localT = (t % pulseSpan) / pulseSpan
    if (localT <= PULSE_OPEN_TIME) {
      return 1 - (localT / PULSE_OPEN_TIME) * (1 - PULSE_MIN_FOLD)
    }
    if (localT <= PULSE_OPEN_TIME + PULSE_THRUST_TIME) {
      const progress = (localT - PULSE_OPEN_TIME) / PULSE_THRUST_TIME
      return PULSE_MIN_FOLD + progress * (1 - PULSE_MIN_FOLD)
    }
    return 1
  }

  const brickT = (t - THRUST_END) / (1 - THRUST_END)
  const foldT = Math.min(brickT / BRICK_FOLD_END, 1)
  if (foldT <= BRICK_SETTLE_TIME) {
    return 1 - (foldT / BRICK_SETTLE_TIME) * (1 - PULSE_MIN_FOLD)
  }
  if (foldT < 1) {
    // 0.1 down to -1 over the remaining 70%: a span of 1.1.
    return (
      PULSE_MIN_FOLD -
      ((foldT - BRICK_SETTLE_TIME) / (1 - BRICK_SETTLE_TIME)) * (PULSE_MIN_FOLD + 1)
    )
  }
  return -1
}

/**
 * Completion → travel parameter (:1294-1302).
 *
 * Travel occupies [0, TRAVEL_END] and eases out into the slot; the
 * overlap zone [0.75, 0.85] is travel decelerating WHILE the final
 * scale swell has already begun.
 */
export const completionToTravel = (completion: number): number => {
  if (completion <= 0) return 0
  if (completion >= TRAVEL_END) return 1
  return easeOut(completion / TRAVEL_END)
}

/**
 * Completion → scale: "tiny lies that grow" (:1356-1386). Four phases —
 * a pop into visibility, a long small cruise, a ramp on approach, and a
 * swell into full size as the creature settles.
 */
export const completionToScale = (completion: number): number => {
  if (completion <= 0) return 0
  if (completion >= 1) return 1
  if (completion <= SCALE_POP_END) {
    return SCALE_POP_VALUE * easeOut(completion / SCALE_POP_END)
  }
  if (completion <= SCALE_CRUISE_END) {
    const t = (completion - SCALE_POP_END) / (SCALE_CRUISE_END - SCALE_POP_END)
    return SCALE_POP_VALUE + (SCALE_CRUISE_VALUE - SCALE_POP_VALUE) * t
  }
  if (completion <= SCALE_RAMP_END) {
    const t = (completion - SCALE_CRUISE_END) / (SCALE_RAMP_END - SCALE_CRUISE_END)
    return SCALE_CRUISE_VALUE + (SCALE_RAMP_VALUE - SCALE_CRUISE_VALUE) * smoothstep(t)
  }
  const t = (completion - SCALE_RAMP_END) / (1 - SCALE_RAMP_END)
  return SCALE_RAMP_VALUE + (1 - SCALE_RAMP_VALUE) * easeOut(t)
}

// ---------------------------------------------------------------------------
// The growth wave (:1283-1290)
// ---------------------------------------------------------------------------

/** Where one virus sits in the wall — everything the wave needs. */
export interface SlotIndex {
  /** Normalized position along the footprint (the packing t). */
  splineT: number
  /** Which row, 0 = bottom. */
  row: number
}

export interface GrowthConfig {
  /** Rows in the wall. */
  rowCount: number
  /** Bricks per row — sets the "one brick" unit the lag is measured in. */
  rowLength: number
  /** Rows lag by this many bricks each (WALL_ROW_LAG in the wall). */
  rowLag: number
  /** Smoothstep width of the wave front (default TRANSITION_WIDTH). */
  transitionWidth?: number
}

/**
 * The growth wave: one global `growth` in [0,1] → this slot's completion
 * (:1283-1290).
 *
 * The wave sweeps across the footprint parameter, staggered by row. Its
 * total range is stretched by the accumulated row lag so that growth = 1
 * still finishes the LAST row — otherwise the top rows would never
 * complete.
 */
export const completionOf = (growth: number, slot: SlotIndex, config: GrowthConfig): number => {
  const { rowCount, rowLength, rowLag } = config
  const width = config.transitionWidth ?? TRANSITION_WIDTH

  // Row lag in "bricks per row" units: rowLag = 1 means one brick per row.
  const brickWidthT = 1 / Math.max(rowLength - 1, 1)
  const rowDelay = slot.row * rowLag * brickWidthT
  const totalRowLag = (rowCount - 1) * rowLag * brickWidthT

  // The wave sweeps 0→1 across splineT, staggered by row; its range is
  // stretched by the accumulated lag so growth = 1 still finishes the
  // last row.
  const effectiveGrowth = growth * (1 + totalRowLag)
  const localProgress = effectiveGrowth - slot.splineT - rowDelay

  return smoothstep(clamp01(localProgress / width))
}

// ---------------------------------------------------------------------------
// The whole journey
// ---------------------------------------------------------------------------

/** Everything one virus needs to be placed and posed at an instant. */
export interface JourneyState {
  position: Vec3
  /** Unit vector the creature's face points along (:1341-1355). */
  heading: Vec3
  /** Bipolar bell: +1 open, −1 wrapped shut. */
  fold: number
  scale: number
  /** Normalized distance travelled along the flight path. */
  splineS: number
}

/** A journey's fixed geometry — built once per slot, sampled every frame. */
export interface JourneyPath {
  lut: ArcLut
  numPulses: number
}

/** Build the flight geometry for one slot (:1252-1257). */
export const buildJourney = (
  endpoints: FlightEndpoints,
  opts: { distancePerThrust?: number; samples?: number } = {},
): JourneyPath => {
  const lut = buildArcLut(buildBezierPath(endpoints), opts.samples ?? ARC_LUT_SAMPLES)
  return {
    lut,
    numPulses: pulseCountFor(lut.totalLength, opts.distancePerThrust ?? DISTANCE_PER_THRUST),
  }
}

/**
 * The complete pipeline: one completion in [0,1] → where this creature
 * is, which way it faces, how folded and how big it is (:1292-1387).
 *
 * The creature faces −tangent: its own local forward leads its motion
 * (:1341-1345 builds the frame from `fwd = -tangent`).
 */
export const journeyState = (completion: number, journey: JourneyPath): JourneyState => {
  const c = clamp01(completion)
  const travel = completionToTravel(c)
  const splineS = travelToSplinePosition(travel, journey.numPulses)
  const fold = travelToFold(travel, journey.numPulses)

  const t = arcLengthToT(journey.lut, splineS)
  const position = bezierPoint(journey.lut.path, t)
  const tangent = bezierTangent(journey.lut.path, t)
  const forward = normalize(tangent, { x: 0, y: 0, z: -1 })

  return {
    position,
    heading: mul(forward, -1),
    fold,
    scale: completionToScale(c),
    splineS,
  }
}
