/**
 * math.ts — the small scalar helpers every holon reaches for, said once.
 */

/** `v` held within [lo, hi]. */
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** `v` held within [0, 1] — a progress, an opacity, a share. */
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
