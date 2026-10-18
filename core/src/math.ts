/**
 * math.ts — the small scalar helpers every holon reaches for, said once.
 */

/** `v` held within [lo, hi]. */
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** `v` held within [0, 1] — a progress, an opacity, a share. */
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/** From `a` to `b` by `u` (u = 0 → a, 1 → b; not clamped). */
export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u
