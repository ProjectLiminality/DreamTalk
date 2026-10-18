/**
 * Harmonisation geometry — the pure layout under vocabulary/Harmonization.
 *
 * N source systems on a REGULAR POLYGON (one ring, equal angles). Two ways
 * to make them speak to each other:
 *
 *   PAIRWISE  every pair mapped directly — the complete graph, N(N−1)/2
 *             chords, growing as N².
 *   HUB       one canonical model at the centre, each system mapped once —
 *             N spokes. A spoke's LENGTH is its cost: in the hub picture a
 *             system sits at the radius its distance to the model demands
 *             (angles stay regular, so the figure stays radially symmetric
 *             — a radar of distances).
 *
 * The first system onboarded is the expensive one: it DEFINES the model,
 * so its cost is the whole reach (1) whatever its distance says. Every
 * next system costs its own distance.
 *
 * The transition is one number s ∈ [0, 1]: each chord a–b is a polyline
 * a → v → b whose middle vertex v slides from the chord's midpoint to the
 * centre, so at s = 1 every chord lies exactly along two spokes — the
 * pairwise web collapses into the hub.
 */

export interface Pt {
  x: number
  y: number
}

/**
 * The ring's starting angle: the polygon is turned so that straight down
 * (−π/2) is never a vertex — the hub's caption sits below the hub in the
 * gap between two spokes. Even N: a flat edge at top and bottom (π/2 + π/N);
 * odd N: a vertex at the top, a flat edge at the bottom (π/2).
 */
export const ringPhase = (n: number): number => (n % 2 === 0 ? Math.PI / 2 + Math.PI / n : Math.PI / 2)

/** System i's direction on the ring — clockwise from the phase, a unit vector. */
export const ringDir = (i: number, n: number): Pt => {
  const a = ringPhase(n) - (i * 2 * Math.PI) / n
  return { x: Math.cos(a), y: Math.sin(a) }
}

/** Every unordered pair (i < j), in reading order — the chords. */
export const pairs = (n: number): [number, number][] => {
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j])
  return out
}

/** How many mappings each topology needs: the complete graph's edges, or one per system. */
export const mappings = (n: number): { pairwise: number; hub: number } => ({ pairwise: (n * (n - 1)) / 2, hub: n })

/** A distance in [0, 1] (NaN → 1: what we do not know, we assume far). */
const unit = (d: number): number => (Number.isFinite(d) ? Math.min(1, Math.max(0, d)) : 1)

/**
 * What onboarding system i costs: the first defines the model (1), every
 * next its distance to it.
 */
export const systemCost = (distances: readonly number[], i: number): number => (i === 0 ? 1 : unit(distances[i]!))

/**
 * How far system i sits from the centre in the hub picture: the hub's
 * edge plus its cost of the remaining reach. `inner` is where cost 0 would
 * sit (just outside the hub), `outer` the ring.
 */
export const hubRadius = (cost: number, inner: number, outer: number): number => inner + unit(cost) * (outer - inner)

/** How onboarded system i is, at `onboarded` ∈ [0, N]: 0 not yet, 1 in, a ramp across its own step. */
export const onboardedness = (i: number, onboarded: number): number => Math.min(1, Math.max(0, onboarded - i))

/**
 * The chord a–b at collapse s: a → v → b, v sliding from the midpoint to
 * `centre`. At s = 0 a straight chord (v on it), at s = 1 two spokes.
 */
export const chordPolyline = (a: Pt, b: Pt, s: number, centre: Pt = { x: 0, y: 0 }): Pt[] => {
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const k = Math.min(1, Math.max(0, s))
  return [a, { x: m.x + (centre.x - m.x) * k, y: m.y + (centre.y - m.y) * k }, b]
}

/**
 * The onboarding axis's named positions — a handful, never one per system:
 * none · first · half · all (half only when it is distinct from the others).
 */
export const onboardPositions = (n: number): Record<string, number> => {
  const out: Record<string, number> = { none: 0 }
  if (n >= 1) out.first = 1
  const half = Math.ceil(n / 2)
  if (half > 1 && half < n) out.half = half
  if (n > 1) out.all = n
  return out
}

/** The total cost of onboarding the first `k` systems (whole systems only). */
export const onboardingCost = (distances: readonly number[], k: number): number => {
  let c = 0
  for (let i = 0; i < Math.min(k, distances.length); i++) c += systemCost(distances, i)
  return c
}
