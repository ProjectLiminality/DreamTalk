/**
 * MorphAnyDemo.ts — "How to morph anything" (vocabulary/Morph README).
 *
 * `forms`: one thing in three forms — a blue dot, the truck it stands for,
 * the word that names it — and a morph between any two. As a song: dot →
 * truck → word → dot. In free play (?scene=forms&play=free) the forms are
 * a state axis: click whichever is showing (or press "f") and it becomes
 * the next.
 *
 * `morph-solids`: 3D into 3D — a truck, a pallet, a film reel, a pouch —
 * with nothing but `Morph(a, b)`, the camera turning between them (and once
 * during a morph) to show every stroke is where it belongs in space.
 */

import { Dream, render } from "../src/index"
import { together } from "../src/index"
import { BLUE } from "../src/constants"
import { Circle, Group } from "../src/parts/index"
import { Truck } from "../vocabulary/Truck/Truck"
import { Pallet } from "../vocabulary/Pallet/Pallet"
import { FilmReel } from "../vocabulary/FilmReel/FilmReel"
import { Pouch } from "../vocabulary/Pouch/Pouch"
import { Word } from "../vocabulary/Word/Word"
import { Morph } from "../vocabulary/Morph/Morph"
import { Forms } from "../vocabulary/Morph/Forms"

const PHI = 0.62
const THETA = 0.3

export class FormsDream extends Dream {
  dot = new Circle({ radius: 46, tint: BLUE, fillOpacity: 1, p: -THETA })
  facing = new Group({ members: [this.dot], h: PHI })
  truck = new Truck({ observer: this.observer, opacity: 0 })
  word = new Word("truck", { observer: this.observer, opacity: 0, size: 190 })
  forms = new Forms({ dot: this.dot, truck: this.truck, word: this.word }, { observer: this.observer })

  unfold() {
    this.set(...this.observer.orbit({ phi: PHI, theta: THETA }), ...this.observer.dolly(950))
    this.stage(this.facing)
    this.stage(this.truck)
    this.stage(this.word)
    this.stage(this.forms)
    this.wait(1)
    this.play(this.forms.morph("dot", "truck"), 4)
    this.wait(1)
    this.play(this.forms.morph("truck", "word"), 5)
    this.wait(1)
    this.play(this.forms.morph("word", "dot"), 4.5)
    this.wait(1)
  }
}

export class MorphSolidsDream extends Dream {
  truck = new Truck({ observer: this.observer, scale: 0.42 })
  pallet = new Pallet({ observer: this.observer, opacity: 0 })
  reel = new FilmReel({ observer: this.observer, opacity: 0 })
  pouch = new Pouch({ observer: this.observer, opacity: 0, scale: 1.1 })

  unfold() {
    this.set(...this.observer.orbit({ phi: 0.7, theta: 0.32 }), ...this.observer.dolly(700))
    this.stage(this.truck)
    this.stage(this.pallet)
    this.stage(this.reel)
    this.stage(this.pouch)
    const turn = (phi: number, theta: number, d: number) => this.play(together(...this.observer.orbit({ phi, theta })), d)
    this.wait(0.8)
    this.play(Morph(this.truck, this.pallet), 3.5)
    turn(1.2, 0.45, 2)
    this.play(Morph(this.pallet, this.reel), 3.5)
    turn(0.4, 0.25, 2)
    // Once DURING a morph: the curves are re-read as the camera turns.
    this.play(together(Morph(this.reel, this.pouch), ...this.observer.orbit({ phi: 0.9, theta: 0.4 })), 3.5)
    turn(0.7, 0.32, 1.5)
    this.play(Morph(this.pouch, this.truck), 3.5)
    this.wait(1)
  }
}

if (import.meta.main) render(FormsDream)
