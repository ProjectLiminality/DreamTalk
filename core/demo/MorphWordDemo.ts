/**
 * MorphWordDemo.ts — a symbol becoming its word, and back
 * (vocabulary/Morph/MorphToWord.ts; CLAUDE.md Current Horizons #4).
 *
 * "Words are symbols of symbols, twice removed from reality. DreamTalk
 * symbols are the universal layer beneath language." The truck lets go of
 * its colour, its visible 3D edges fly — left to right, the order we read
 * in — into the letters of "truck", whose ink fills in as they land. Then
 * the word goes back to being the thing it names.
 */

import { Dream, render } from "../src/index"
import { Truck } from "../vocabulary/Truck/Truck"
import { MindVirus } from "../vocabulary/MindVirus/MindVirus"
import { MorphToWord } from "../vocabulary/Morph/MorphToWord"

const PHI = 0.62
const THETA = 0.3

export class MorphWordDream extends Dream {
  truck = new Truck({ observer: this.observer })
  m = MorphToWord(this.truck, "truck", { observer: this.observer })

  unfold() {
    this.set(...this.observer.orbit({ phi: PHI, theta: THETA }), ...this.observer.dolly(950))
    this.stage(this.truck)
    for (const h of this.m.holons) this.stage(h)
    this.wait(1)
    this.play(this.m.there(), 5)
    this.wait(1.2)
    this.play(this.m.back(), 5)
    this.wait(1)
  }
}

/**
 * The vocabulary's own creature: MindVirus — the eye that sees, the cube
 * that entraps — becoming the two words that name it, and back. A
 * composite: its curves are whatever it visibly shows.
 */
export class MorphWordVirusDream extends Dream {
  virus = new MindVirus({ scale: 3.2, h: -0.5, p: 0.35 })
  m = MorphToWord(this.virus, "Mind Virus", { observer: this.observer, fit: 1.6 })

  unfold() {
    this.stage(this.virus)
    for (const h of this.m.holons) this.stage(h)
    this.wait(1)
    this.play(this.m.there(), 5)
    this.wait(1.2)
    this.play(this.m.back(), 5)
    this.wait(1)
  }
}

if (import.meta.main) render(MorphWordDream)
