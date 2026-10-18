/**
 * GlobeDemo — the Earth in the three looks the Web3 video asks of a globe
 * (docs/reports/web3-recon.md, shots 1/3/13/15), side by side and turning.
 * It was the sheet of the flat `Globe` holon's modes; the Earth replaced
 * that holon (2026-10-13) and each look is now a few of its params:
 *
 *   • LEFT  — SHOT 1: a dark grey Earth on black with a thin limb ring.
 *             Dark `land`, coasts off, `limbStroke` set.
 *   • RIGHT — SHOT 13: an outline Earth — white coastlines, no land fill.
 *             `landOpacity: 0`, `coastStroke` 2.5.
 *   • BELOW — SHOT 15, the hero: a bright Earth inside a red flower-of-life
 *             halo with a bold red ring and long white light rays.
 *
 * Each is set on the page (Recede), so the hero's decoration composites
 * around it in attach order, as a flat picture's would.
 *
 * The hero's halo, ring and rays are the DreamTalkSymbol holon — the same symbol
 * shots 2–3 and 15 use — not decoration drawn here.
 */

import { Dream } from "../../src/index"
import { together } from "../../src/anim"
import { Earth } from "../../vocabulary/Earth/Earth"
import { Recede } from "../../src/parts/recede"
import { rgb, TAU } from "../../src/constants"
import { DreamTalkSymbol } from "../../vocabulary/DreamTalkSymbol/DreamTalkSymbol"

const HERO_R = 52
const HALO_R = 128

export class GlobeDemoDream extends Dream {
  // LEFT — the dark Earth with a thin ring (shot 1).
  fillEarth = new Earth({
    radius: 105,
    land: rgb(0x3a, 0x3a, 0x3a),
    coastOpacity: 0,
    borderOpacity: 0,
    limbStroke: 1.5,
    limbTint: rgb(0x88, 0x88, 0x88),
    p: 0.18,
  })
  fill = new Recede({ members: [this.fillEarth], reach: 105, x: -270, y: 120 })

  // RIGHT — the outline Earth (shot 13).
  outlineEarth = new Earth({
    radius: 105,
    landOpacity: 0,
    coastStroke: 2.5,
    borderOpacity: 0,
    limbStroke: 1,
    limbTint: rgb(0x44, 0x44, 0x44),
    p: 0.12,
  })
  outline = new Recede({ members: [this.outlineEarth], reach: 105, x: 270, y: 120 })

  // BELOW — the hero (shot 15): the DreamTalkSymbol, the Earth in its bloom,
  // flower of life, red ring and rays, at this sheet's size.
  hero = new DreamTalkSymbol({ radius: HALO_R + 6, globe: HERO_R / (HALO_R + 6), y: -125 })

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    for (const g of [this.fill, this.outline, this.hero]) g.seenFrom(this.observer)
    this.stage(this.fill)
    this.stage(this.outline)
    this.stage(this.hero)

    // All three turn together — one full-ish rotation over the take.
    this.play(
      together(
        this.fillEarth.h.to(TAU * 0.6, { easing: "linear" }),
        this.outlineEarth.h.to(TAU * 0.6, { easing: "linear" }),
        this.hero.spin.to(TAU * 0.6, { easing: "linear" }),
      ),
      6,
    )
  }
}
