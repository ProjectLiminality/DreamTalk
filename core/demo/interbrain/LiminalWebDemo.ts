/**
 * LiminalWebDemo — the liminal web standing alone (InterBrain film
 * 32:01–32:21): a story becomes a place where you meet your peers, and for
 * each peer you see the stories that mediate the relationship.
 *
 * The Logo comes up with its dreamers round it (f9646); then the focus
 * walks the film's tour — the friend and her six dreams (f9676), the
 * Vision and its four dreamers (f9691), David and his four (f9721) — each
 * step one scrub of `focus`.
 *
 * Framing (default observer, 0.48 px per unit at 720p): f9721's centre ring
 * is 137.5 px, centred in the frame.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { LiminalWeb } from "../../vocabulary/LiminalWeb/LiminalWeb"

export class LiminalWebDemoDream extends Dream {
  web = new LiminalWeb()

  unfold() {
    this.play(Create(this.web), 3)
    this.wait(1)
    for (let k = 1; k < this.web.tour.length; k++) {
      this.play(this.web.focus.to(k), 2)
      this.wait(1.5)
    }
    this.wait(1)
  }
}

if (import.meta.main) render(LiminalWebDemoDream)
