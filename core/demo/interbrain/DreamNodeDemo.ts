/**
 * DreamNodeDemo — the DreamNode standing alone (InterBrain film 29:14–35:49).
 *
 * A DreamTalk symbol comes up and its ring draws round it, from one o'clock
 * clockwise (f8812–f8820, "GitRepo"); the node turns dreamer and back
 * (30:44, f9271); then the holarchy (35:43, f10760): three nodes outside,
 * each imported into a higher-order node, the outer tangents joining every
 * node to its copy.
 *
 * Framing: the default observer projects z = 0 at 0.48 px per unit on a
 * 720p frame, so f9076's 211.5 px ring is radius 440, its centre 51 px above
 * the middle (y 106); f10760's parent ring is 126 px (262), its children's
 * sources 102 px (212) about 290 px out (600).
 */

import { Dream, render } from "../../src/index"
import { Group } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { Create, UnCreate } from "../../src/verbs"
import { DreamNode, ImportLines } from "../../vocabulary/DreamNode/DreamNode"
import { DreamTalkSymbol } from "../../vocabulary/DreamTalkSymbol/DreamTalkSymbol"
import { InterBrain } from "../../vocabulary/InterBrain/InterBrain"

const PX = 0.48

const symbol = () => new DreamTalkSymbol({ radius: 100 })
const interbrain = () => new InterBrain({ radius: 200, logoStroke: 2 })

/** f10760's three: a dreamer below, a DreamTalk symbol and the InterBrain above. */
const holarchy = () => {
  const children = [
    new DreamNode({ kind: "dreamer" }),
    new DreamNode({ face: symbol() }),
    new DreamNode({ face: interbrain() }),
  ]
  const parent = new DreamNode({ radius: 126 / PX, ringStroke: 4, face: null, children })
  const out = 600
  const sources = children.map((c, i) => {
    const a = parent.childPhase.value + (i / children.length) * 2 * Math.PI
    return new DreamNode({
      radius: 102 / PX,
      x: Math.cos(a) * out,
      y: Math.sin(a) * out,
      kind: i === 0 ? "dreamer" : "dream",
      face: i === 0 ? undefined : i === 1 ? symbol() : interbrain(),
    })
  })
  const group = new Group({ y: 115 })
  const lines = sources.map((s, i) => new ImportLines({ between: [s, children[i]!], frame: () => group }))
  for (const h of [...lines, parent, ...sources]) group.attach(h)
  return { group, parent, sources, lines }
}

export class DreamNodeDemoDream extends Dream {
  node = new DreamNode({ radius: 211.5 / PX, y: 106 })
  holarchy = holarchy()

  unfold() {
    this.play(Create(this.node), 3)
    this.wait(1)
    this.play(this.node.stateAxis("kind").to("dreamer"), 1.5)
    this.wait(1)
    this.play(this.node.stateAxis("kind").to("dream"), 1.5)
    this.wait(0.5)
    this.play(UnCreate(this.node), 1)
    const { group, parent, sources, lines } = this.holarchy
    // Held at scale 0 until now: an un-created Earth's sea is still a solid
    // occluder (its surfaces ignore `creation`), and would bite the bloom.
    this.play(group.scale.sequence(0, 1), 0.01)
    this.play(together(...sources.map((s) => Create(s))), 2.5)
    this.play(Create(parent), 2.5)
    this.play(together(...lines.map((l) => Create(l))), 1.5)
    this.wait(2)
  }
}

if (import.meta.main) render(DreamNodeDemoDream)
