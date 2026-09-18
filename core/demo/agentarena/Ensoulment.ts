/**
 * Ensoulment — the red starburst: energy radiating from a dense centre.
 *
 * On the board this is drawn twice, and both times it means the same
 * thing: a human pouring agency down an interface into a virtual agent.
 * It sits beside the three equations — `selection = attention =
 * animation`, `selection = soul extension` — and again on the human at
 * the laptop, where the pouring is literally happening.
 *
 * Drawn the way David draws it: not a tidy asterisk but a scribbled
 * knot at the centre with rays flung out at uneven lengths. The
 * unevenness is load-bearing — a perfectly regular star reads as a
 * diagram of radiation, while an irregular one reads as something
 * ALIVE that is actually radiating. So the ray lengths vary on a fixed,
 * deterministic pattern (never random: a DreamSong must render the same
 * every time).
 */

import { Ellipse, Line, Stroke } from "../../src/parts/primitives"
import { RED } from "../../src/constants"
import { integer, length } from "../../src/params"

/**
 * Per-ray length multipliers, cycled. Deterministic by construction —
 * the irregularity is stated, not sampled, so every render is identical.
 */
const JITTER = [1, 0.72, 0.93, 0.64, 1.05, 0.8, 0.88, 0.7]

export class Ensoulment extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** How far the longest ray reaches. */
  radius = length(150)
  /** How many rays are flung out. */
  rays = integer(14)

  /** The dense knot the rays come out of. */
  knot!: Ellipse
  spokes: Line[] = []

  protected override compose(): void {
    const r = this.radius.value
    const n = Math.max(1, Math.round(this.rays.value))
    const stroke = this.stroke

    // The centre: small, filled, dense — where the energy is before it
    // leaves. On the board it is the hardest-pressed part of the mark.
    this.knot = this.add(
      new Ellipse({ radiusX: r * 0.1, radiusY: r * 0.1, filled: true, tint: RED }),
    )

    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const reach = r * JITTER[i % JITTER.length]!
      // Each ray starts just outside the knot, so the knot stays a knot
      // rather than being buried under the spokes' inner ends.
      const inner = r * 0.12
      this.spokes.push(
        this.add(
          new Line({
            points: [
              { x: Math.cos(a) * inner, y: Math.sin(a) * inner, z: 0 },
              { x: Math.cos(a) * reach, y: Math.sin(a) * reach, z: 0 },
            ],
            tint: RED,
            stroke,
          }),
        ),
      )
    }
  }
}
