/**
 * fourier.ts — a closed path as a sum of rotating circles.
 *
 * The mathematics behind the epicycle drawing 3Blue1Brown made famous, and
 * which David used (via Manim) to trace the Vitruvian Man in the Liminal
 * Consulting Web3 video. He asked for it as a REUSABLE component:
 *
 *   "the Fourier decomposition certainly is one of them, where the input is
 *    an SVG plus the parameters of how many terms should be visualized, how
 *    closely should that SVG path be approximated … and then the output
 *    should be that animation."
 *
 * So this file is the pure maths — path in, coefficients out — and knows
 * nothing about drawing. `vocabulary/Fourier/` turns coefficients into moving
 * circles and a pen.
 *
 * THE IDEA IN ONE PARAGRAPH
 *
 * Treat the plane as ℂ and the path as a periodic function f(t), t ∈ [0,1).
 * Then f is a sum of terms c_n · e^(2πi·n·t): each term is a circle of radius
 * |c_n| spinning n times per lap, starting at angle arg(c_n). Stack them tip
 * to tail and the final tip traces f. The coefficients are
 *
 *     c_n = ∫₀¹ f(t) · e^(−2πi·n·t) dt
 *
 * which we evaluate numerically, because f is a polyline and not something
 * you integrate in closed form.
 *
 * WHY ARC LENGTH, NOT VERTEX INDEX
 *
 * The parameter t must run at CONSTANT SPEED along the path, or the drawing
 * is wrong in a way that is hard to see and impossible to fix later: an SVG's
 * vertices bunch up on curves and spread out on straight runs, so
 * parameterising by vertex index makes the pen crawl through detail and race
 * across simple stretches. Worse, the coefficients themselves come out wrong,
 * because the integral is then weighted by vertex density rather than by
 * length. `resampleClosed` below fixes this once, up front, and everything
 * after it is honest.
 *
 * WHY THE TERMS COME BACK ORDERED 0, +1, −1, +2, −2, …
 *
 * Truncating the series is the whole point of the parameter David asked for
 * ("how many terms"), and the series only looks right when truncated in
 * CONJUGATE PAIRS. n and −n are circles turning opposite ways at the same
 * rate; together they make an ellipse, and the real path is a sum of
 * ellipses. Keep one without the other and the partial sum spirals off in a
 * direction the path never goes. So `coefficients()` returns them
 * interleaved, and taking the first k of the list is always a sensible
 * drawing.
 */

/** A complex number. Plain object, not a class: these are made in bulk. */
export interface Complex {
  readonly re: number
  readonly im: number
}

/** One term of the series: a circle of radius |c| spinning `freq` times a lap. */
export interface Epicycle {
  /** How many turns per lap. 0 is the fixed centre; negatives turn backwards. */
  readonly freq: number
  /** The circle's radius. */
  readonly radius: number
  /** Where on the circle the arm starts, in radians. */
  readonly phase: number
  /** The raw coefficient, kept so a consumer can re-derive radius/phase. */
  readonly c: Complex
}

/** A point on the path. Matches the rest of the geometry layer's shape. */
export interface Vec2 {
  readonly x: number
  readonly y: number
}

/**
 * Resample a closed polyline to `count` points spaced equally in ARC LENGTH.
 *
 * The path is treated as closed: the segment from the last point back to the
 * first is included, because a Fourier series is periodic and a path with a
 * gap in it would be reconstructed with a jump discontinuity — which shows up
 * as ringing (Gibbs) right where the gap is.
 */
export const resampleClosed = (points: readonly Vec2[], count: number): Vec2[] => {
  if (points.length === 0 || count <= 0) return []
  if (points.length === 1) return Array.from({ length: count }, () => points[0]!)

  // Cumulative length around the closed loop.
  const n = points.length
  const cum: number[] = [0]
  for (let i = 0; i < n; i++) {
    const a = points[i]!
    const b = points[(i + 1) % n]!
    cum.push(cum[i]! + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const total = cum[n]!
  if (total === 0) return Array.from({ length: count }, () => points[0]!)

  const out: Vec2[] = []
  let seg = 0
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total
    while (seg < n - 1 && cum[seg + 1]! < target) seg++
    const segLen = cum[seg + 1]! - cum[seg]!
    const u = segLen > 0 ? (target - cum[seg]!) / segLen : 0
    const a = points[seg]!
    const b = points[(seg + 1) % n]!
    out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u })
  }
  return out
}

/**
 * The Fourier coefficients of a closed path, ordered 0, +1, −1, +2, −2, …
 *
 * `terms` is how many CIRCLES you want, which is what an author actually
 * thinks in — not a maximum frequency. The list is truncated to that many,
 * and because of the conjugate-pair ordering above, any prefix is a sensible
 * drawing.
 *
 * `samples` controls how finely the integral is evaluated. It bounds the
 * highest frequency that can be represented honestly (Nyquist: |n| must stay
 * under samples/2), so it is raised automatically if `terms` asks for more
 * than the samples can support — an author should not have to know this.
 */
export const coefficients = (
  path: readonly Vec2[],
  terms: number,
  samples = 1024,
): Epicycle[] => {
  const wanted = Math.max(1, Math.floor(terms))
  // Highest |n| we will need, given the 0,+1,−1,… ordering.
  const maxFreq = Math.ceil((wanted - 1) / 2)
  // Nyquist, with headroom: integrating at exactly 2·maxFreq aliases badly.
  const n = Math.max(samples, maxFreq * 4, 64)
  const f = resampleClosed(path, n)
  if (f.length === 0) return []

  const out: Epicycle[] = []
  const push = (freq: number) => {
    let re = 0
    let im = 0
    for (let k = 0; k < n; k++) {
      const t = k / n
      const ang = -2 * Math.PI * freq * t
      const cos = Math.cos(ang)
      const sin = Math.sin(ang)
      const p = f[k]!
      // (p.x + i·p.y) · (cos + i·sin)
      re += p.x * cos - p.y * sin
      im += p.x * sin + p.y * cos
    }
    re /= n
    im /= n
    out.push({
      freq,
      radius: Math.hypot(re, im),
      phase: Math.atan2(im, re),
      c: { re, im },
    })
  }

  push(0)
  for (let k = 1; out.length < wanted; k++) {
    push(k)
    if (out.length < wanted) push(-k)
  }
  return out.slice(0, wanted)
}

/**
 * Where each epicycle's arm ends at time t — the chain, tip to tail.
 *
 * Returns `epicycles.length + 1` points: the origin, then every joint, and
 * finally the PEN at the end. A consumer draws a circle at each joint with
 * the next arm's radius, and the last point is the ink.
 */
export const chainAt = (epicycles: readonly Epicycle[], t: number): Vec2[] => {
  const out: Vec2[] = [{ x: 0, y: 0 }]
  let x = 0
  let y = 0
  for (const e of epicycles) {
    const ang = 2 * Math.PI * e.freq * t + e.phase
    x += e.radius * Math.cos(ang)
    y += e.radius * Math.sin(ang)
    out.push({ x, y })
  }
  return out
}

/** Just the pen — the reconstructed point at t. */
export const traceAt = (epicycles: readonly Epicycle[], t: number): Vec2 => {
  const chain = chainAt(epicycles, t)
  return chain[chain.length - 1]!
}

/**
 * The whole reconstructed curve, at `steps` samples.
 *
 * Useful for two things: drawing the finished trace as one polyline once the
 * pen has gone round, and MEASURING how good a given `terms` is — which is
 * what `approximationError` does with it.
 */
export const reconstruct = (epicycles: readonly Epicycle[], steps = 512): Vec2[] =>
  Array.from({ length: steps }, (_, i) => traceAt(epicycles, i / steps))

/**
 * Mean distance between the real path and its reconstruction, in path units.
 *
 * This is the honest answer to David's second parameter — "how closely should
 * that SVG path be approximated". Terms are cheap to add and the relationship
 * is not obvious by eye, so an author should be able to ASK rather than
 * guess, and `termsForError` inverts it.
 */
export const approximationError = (
  path: readonly Vec2[],
  epicycles: readonly Epicycle[],
  steps = 512,
): number => {
  const truth = resampleClosed(path, steps)
  if (truth.length === 0) return 0
  let sum = 0
  for (let i = 0; i < steps; i++) {
    const a = truth[i]!
    const b = traceAt(epicycles, i / steps)
    sum += Math.hypot(a.x - b.x, a.y - b.y)
  }
  return sum / steps
}

/**
 * The fewest terms whose mean error is within `tolerance`.
 *
 * Searches by doubling and then bisecting, so a tight tolerance on a
 * complicated path does not cost a linear scan. Capped, because some paths
 * (sharp corners especially) never converge to a very small error and an
 * author asking for the impossible should get the cap, not a hang.
 */
export const termsForError = (
  path: readonly Vec2[],
  tolerance: number,
  cap = 512,
): number => {
  let hi = 8
  while (hi < cap && approximationError(path, coefficients(path, hi)) > tolerance) hi *= 2
  hi = Math.min(hi, cap)
  let lo = 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (approximationError(path, coefficients(path, mid)) > tolerance) lo = mid + 1
    else hi = mid
  }
  return lo
}
