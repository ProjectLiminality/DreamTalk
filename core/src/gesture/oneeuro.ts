/**
 * The One-Euro filter (Casiez, Roussel & Vogel, CHI 2012) — jitter smoothing
 * that stays responsive: at rest it filters hard (a hovering hand trembles),
 * in motion it follows (a reaching hand must not lag). The cutoff rises with
 * speed: fc = minCutoff + beta · |ẋ|.
 *
 * Timed on the SAMPLE's own clock (a HandFrame's `t`), never wall time, so a
 * recorded take replays to the same numbers.
 */

const alpha = (cutoff: number, dt: number): number => {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}

export interface OneEuroOpts {
  /** Hz at rest — lower is smoother and laggier. */
  minCutoff?: number
  /** How fast the cutoff rises with speed — higher is less lag in motion. */
  beta?: number
  /** Hz for the derivative's own low-pass. */
  dCutoff?: number
}

export class OneEuro {
  readonly minCutoff: number
  readonly beta: number
  readonly dCutoff: number
  #x?: number
  #dx = 0
  #t?: number

  constructor(opts: OneEuroOpts = {}) {
    this.minCutoff = opts.minCutoff ?? 1.2
    this.beta = opts.beta ?? 0.02
    this.dCutoff = opts.dCutoff ?? 1
  }

  /** Filter `x` sampled at time `t` (seconds). */
  filter(x: number, t: number): number {
    if (this.#x === undefined || this.#t === undefined || t <= this.#t) {
      // First sample, or a non-advancing clock: take it as is.
      if (this.#x === undefined || this.#t === undefined) {
        this.#x = x
        this.#t = t
      }
      return this.#x
    }
    const dt = t - this.#t
    this.#t = t
    const dx = (x - this.#x) / dt
    this.#dx = this.#dx + alpha(this.dCutoff, dt) * (dx - this.#dx)
    const cutoff = this.minCutoff + this.beta * Math.abs(this.#dx)
    this.#x = this.#x + alpha(cutoff, dt) * (x - this.#x)
    return this.#x
  }

  /** The filtered derivative (units per second). */
  get velocity(): number {
    return this.#dx
  }

  reset(): void {
    this.#x = undefined
    this.#t = undefined
    this.#dx = 0
  }
}

/** A One-Euro per component of a point. */
export class OneEuro2 {
  readonly x: OneEuro
  readonly y: OneEuro
  constructor(opts: OneEuroOpts = {}) {
    this.x = new OneEuro(opts)
    this.y = new OneEuro(opts)
  }
  filter(p: { x: number; y: number }, t: number): { x: number; y: number } {
    return { x: this.x.filter(p.x, t), y: this.y.filter(p.y, t) }
  }
  reset(): void {
    this.x.reset()
    this.y.reset()
  }
}
