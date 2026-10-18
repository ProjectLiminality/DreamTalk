/**
 * DivideDemo — the S standing alone (InterBrain film 18:27–19:02, 36:22).
 *
 * Engineering │ Gardening (f5581): the S across the whole frame, the blue
 * grid on the engineered side and the red flower of life on the gardened
 * side; then the S gathers into the open arc between two lobes with the
 * arrow across its waist (f5851 — the arc DreamWeaving reuses, f10951);
 * then the circle closes round it (f11071) and the lobes trade sizes (the
 * Web3 yin-yang's exchange, demo/web3/YinYang.ts — the same holon).
 *
 * Framing: the default observer draws z = 0 at 0.48 px per unit on 720p.
 * f5581's S has lobes of 380 px (R 760 px → 1583); f5851's 155 px (R 310 px
 * → 646); its stroke is ~8 px wide on f5581, ~5 px on f5851.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Create, UnCreate } from "../../src/verbs"
import { Text } from "../../src/parts/text"
import { Divide, FILM_TURN } from "../../vocabulary/Divide/Divide"

const PX = 0.48
const label = (content: string, x: number, y: number, size = 62) =>
  new Text({ content, size, x: (x - 640) / PX, y: (360 - y) / PX })

export class DivideDemoDream extends Dream {
  divide = new Divide({
    radius: 760 / PX,
    turn: FILM_TURN,
    stroke: 7,
    fieldA: "grid",
    fieldB: "flower",
    fieldReach: 0.92,
    arrowStroke: 9,
    arrowHead: 2.4,
  })
  engineering = label("Engineering", 308, 160, 90)
  gardening = label("Gardening", 965, 558, 90)

  unfold() {
    this.play(together(Create(this.divide), Create(this.engineering), Create(this.gardening)), 3)
    this.wait(2)
    // Gather into the open arc between two lobes (f5851): the fields go, the S shrinks.
    this.play(
      together(
        UnCreate(this.engineering),
        UnCreate(this.gardening),
        this.divide.fieldOpacity.to(0),
        this.divide.radius.to(310 / PX),
        this.divide.stroke.to(5),
      ),
      2.5,
    )
    this.play(this.divide.arrow.to(1), 1)
    this.wait(1.5)
    // Closed by the circle (f11071), then the lobes trade sizes.
    this.play(together(this.divide.arrow.to(0), this.divide.outer.to(1)), 1.5)
    this.play(this.divide.stateAxis("split").to("A swells"), 2)
    this.play(this.divide.stateAxis("split").to("B swells"), 2.5)
    this.play(this.divide.stateAxis("split").to("even"), 1.5)
    this.wait(1)
  }
}

if (import.meta.main) render(DivideDemoDream)
