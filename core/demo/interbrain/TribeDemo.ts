/**
 * TribeDemo — the Tribe standing alone, and the film's walk through it.
 *
 * `ib-tribe`: the ancient tribe draws — seven liminal minds in red circles,
 * a SandTalk on every edge (f6091) — holds, then turns modern as the
 * film's timeline turns it (f6496): the circles square, red goes blue, the
 * campfires narrow to bare lines, the minds take their cubes (f5221); the
 * narrative box claps over the heads and lifts again (f5221 ↔ f5341).
 * `ib-tribe-web`: the boxed web grown huge — three rings (f6736).
 * `ib-tribes`: tribes of tribes, the far ones dim (f6286).
 *
 * At the default camera (0.48 px per unit at 720p) the spacing is the
 * film's: f6091 266 px, f6736 106 px, f6286 ≈ 87 px.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { Tribe } from "../../vocabulary/Tribe/Tribe"

const PX = 0.48

export class TribeDemoDream extends Dream {
  tribe = new Tribe({ size: 266 / PX })

  unfold() {
    this.play(Create(this.tribe), 4)
    this.wait(1.5)
    this.play(this.tribe.modern.to(1), 3)
    this.wait(1)
    this.play(this.tribe.boxed.to(1), 1)
    this.wait(1.5)
    this.play(this.tribe.boxed.to(0), 1)
    this.wait(1)
  }
}

export class TribeWebDemoDream extends Dream {
  tribe = new Tribe({ size: 106 / PX, rings: 3, modern: 1, stroke: 1.3 })

  unfold() {
    this.play(Create(this.tribe), 4)
    this.wait(2)
  }
}

export class TribesDemoDream extends Dream {
  tribe = new Tribe({ size: 87 / PX, depth: 1, stroke: 1.1 })

  unfold() {
    this.play(Create(this.tribe), 4)
    this.wait(2)
  }
}

if (import.meta.main) render(TribeDemoDream)
