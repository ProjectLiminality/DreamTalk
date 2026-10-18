/**
 * PuppeteerDemo.ts — A DreamWeaving
 *
 * The Puppeteer standing alone, at the film's size above the manipulated
 * lens (f3541): the hand draws, the five strings drop from its fingers.
 * Hold, then a little working of the strings — the hand lifts and sinks
 * as a puppeteer's does — and hold.
 *
 * Framing: the default eye projects z = 0 at 720/1500 = 0.48 px per unit;
 * the hand is 113 px wide at f3541 (235 units), its grip at (638, 187) px,
 * the strings reaching the prism's apex at y 258 px (71 px below).
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { Puppeteer } from "../../vocabulary/Puppeteer/Puppeteer"

const PX = 720 / 1500
/** The grip's height: the hand above the centre, its strings reaching down. */
const Y0 = (360 - 187) / PX - 120

export class PuppeteerDemoDream extends Dream {
  puppeteer = new Puppeteer({ size: 113 / PX, length: 140 / PX, x: (638 - 640) / PX, y: Y0 })

  unfold() {
    this.play(Create(this.puppeteer), 2.5)
    this.wait(1)
    this.play(this.puppeteer.y.to(Y0 + 40), 0.8)
    this.play(this.puppeteer.y.to(Y0), 0.8)
    this.wait(1.5)
  }
}

if (import.meta.main) render(PuppeteerDemoDream)
