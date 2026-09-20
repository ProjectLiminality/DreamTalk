/**
 * GoldenDot — the agency of the human, released into creator mode.
 *
 * David's transmission (2026-09-20): leaving game mode releases the cursor's
 * agency as a glowing golden dot. Hover it over a UI element and the whole
 * element glows; click and you SELECT rather than fire. Leaving creator mode,
 * the glow concentrates back into the avatar.
 *
 *   "that dot is basically that kind of spark of your — of the human agency
 *    that can flow into that space."
 *
 * Visual reference: the iPadOS pointer, and the glowing dot mkbhd uses to
 * steer attention (which David has borrowed in his own videos).
 *
 * WHY IT IS A DOT AND NOT AN ARROW. A cursor's arrow POINTS — it has a tip,
 * it is aimed, it acts at one pixel. That is the game-mode gesture: fire this
 * button. The dot has no tip and no direction; it is a presence, and what it
 * does is ILLUMINATE what it is near. That is the creator-mode gesture: this
 * is what has my attention, and attention is what makes a thing editable.
 * The shape change IS the mode change, which is why the scene animates the
 * arrow becoming the dot rather than swapping one for the other.
 *
 * Built as a core with two haloes rather than one disc: a filled centre, a
 * bright ring close in, and a fainter ring further out. Concentric circles at
 * falling fill give the soft bloom a single flat disc cannot, using nothing
 * but strokes — no shader, no sprite, no texture. The scene animates `glow`
 * to make it breathe, and `scale` to make it arrive and depart.
 */

import { Circle, Stroke } from "../../src/parts/primitives"
import { completion, length } from "../../src/params"
import { rgb } from "../../src/constants"

/**
 * The gold. Warm, high-value, unmistakably not the blue/red of the arena
 * vocabulary — because this is neither container nor content: it is the
 * human's attention, a third thing.
 */
export const GOLD = rgb(255, 199, 84)

export class GoldenDot extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** Radius of the solid core. The haloes are sized from it. */
  radius = length(14)
  /**
   * How lit the haloes are, 0..1 — the dot's "charge".
   *
   * The scene breathes this rather than the radius, so the dot pulses
   * without moving: a presence that is alive, not a thing being resized.
   */
  glow = completion(1)

  core!: Circle
  halo!: Circle
  aura!: Circle

  protected override compose(): void {
    const r = this.radius.value
    // Outermost first, so the core draws over its own bloom.
    this.aura = this.add(
      new Circle({
        radius: r * 3.1,
        tint: GOLD,
        stroke: 2,
        fillOpacity: this.glow.times(0.1),
        opacity: this.glow.times(0.45),
      }),
    )
    this.halo = this.add(
      new Circle({
        radius: r * 1.9,
        tint: GOLD,
        stroke: 2.5,
        fillOpacity: this.glow.times(0.22),
        opacity: this.glow.times(0.8),
      }),
    )
    this.core = this.add(
      new Circle({ radius: r, tint: GOLD, stroke: 3, fillOpacity: 1 }),
    )
  }
}
