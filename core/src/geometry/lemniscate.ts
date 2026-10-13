/**
 * The lemniscate — the figure-eight of a balancing loop (S&OP: demand ↔
 * supply) — and its untwisting into one circle. Pure; vocabulary/SOPLoop
 * draws it.
 *
 * Bernoulli's lemniscate, half-width a, parameter t ∈ [0, 2π):
 *
 *   x = a·cos t / (1 + sin²t),   y = a·sin t·cos t / (1 + sin²t)
 *
 * t = 0 is the right tip, t = π the left; the curve crosses itself at the
 * origin at t = π/2 and t = 3π/2. The RIGHT lobe is t ∈ (−π/2, π/2), the
 * LEFT lobe t ∈ (π/2, 3π/2).
 *
 * WHY THE CIRCLE IS NOT A BLEND. A figure-eight's two lobes run in opposite
 * senses (one counter-clockwise, one clockwise), so interpolating it point
 * by point toward a circle would drag the left lobe through itself. The
 * honest move is the one a twisted band makes: the left lobe FLIPS over
 * about the horizontal axis, through depth, and the curve becomes one
 * untwisted loop pinched at the centre — then it relaxes into the circle,
 * now with a consistent sense all the way round. So `round` runs in two
 * phases: 0 → ½ flips (3D), ½ → 1 rounds.
 */

export interface P3 {
  x: number
  y: number
  z: number
}

/** The lemniscate point at t. */
export const lemniscate = (t: number, a: number): P3 => {
  const s = Math.sin(t)
  const c = Math.cos(t)
  const d = 1 + s * s
  return { x: (a * c) / d, y: (a * s * c) / d, z: 0 }
}

/** Is t on the left lobe? (t taken mod 2π.) */
export const onLeftLobe = (t: number): boolean => {
  const u = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  return u > Math.PI / 2 && u < (3 * Math.PI) / 2
}

const smooth = (e0: number, e1: number, x: number): number => {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return k * k * (3 - 2 * k)
}

/**
 * The loop at t for a given `round` ∈ [0, 1]: 0 the figure-eight, ½ the
 * untwisted pinched loop (the left lobe flipped through depth), 1 one
 * circle of radius `r`. Exact at both ends; continuous in t and round.
 */
export const loopPoint = (t: number, a: number, r: number, round: number): P3 => {
  const p = lemniscate(t, a)
  const flip = Math.PI * smooth(0, 0.5, round)
  if (onLeftLobe(t) && flip > 0) {
    // Turn the left lobe about the x axis: y → y·cos, out into z by y·sin.
    const y = p.y
    p.y = y * Math.cos(flip)
    p.z = y * Math.sin(flip)
  }
  const w = smooth(0.5, 1, round)
  if (w <= 0) return p
  // The untwisted loop runs one sense all round, so t maps straight onto
  // the circle's angle: the two centre passes go to its top and bottom.
  const cx = r * Math.cos(t)
  const cy = r * Math.sin(t)
  return { x: p.x + (cx - p.x) * w, y: p.y + (cy - p.y) * w, z: p.z * (1 - w) }
}
