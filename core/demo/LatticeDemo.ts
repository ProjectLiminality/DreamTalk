/**
 * LatticeDemo.ts — A DreamWeaving
 *
 * The state-space lattice (vocabulary/StateLattice) on real automata, side
 * by side with them (`?scene=lattice&play=free`):
 *
 *   - a CoherenceBeacon — its own two axes woven with its Field's and its
 *     DreamNode's: 64 states, drawn as ONE lattice whose nested copies show
 *     the multiplication;
 *   - a DreamNode holding a Mind — 2 × 2 × 2: the Mind's square at each of
 *     the node's two states, a cube;
 *   - an Eye — two states, a line;
 *   - a Worldview — its own 288 states and its Earths, Noosphere, Eye,
 *     Narrative and Conflicts: too many to weave, so FACTORED — a lattice
 *     per machine, one lit node in each.
 *
 * The song walks a path through them (the gold line, the thread drawn on
 * as it plays); in free play every node is a button — click one and the
 * symbol walks there.
 */

import { Dream, render } from "../src/index"
import { Create } from "../src/verbs"
import { BLUE, GOLD, RED } from "../src/constants"
import { eased, together } from "../src/anim"
import { gatherStateSpace, type StateSpace } from "../src/automaton"
import { machinesOf } from "../src/lattice"
import { CoherenceBeacon } from "../vocabulary/CoherenceBeacon/CoherenceBeacon"
import { DreamNode } from "../vocabulary/DreamNode/DreamNode"
import { Mind } from "../vocabulary/Mind/Mind"
import { Eye } from "../vocabulary/Eye/Eye"
import { Worldview } from "../vocabulary/Worldview/Worldview"
import { StateLattice } from "../vocabulary/StateLattice/StateLattice"
import { InterBrainSongDream } from "./interbrain/InterBrainSong"
import { CHAPTERS } from "./interbrain/film"

const TOP = 1150

export class LatticeDream extends Dream {
  beacon = new CoherenceBeacon({ scale: 0.32, x: -1700, y: TOP })
  mind = new Mind()
  node = new DreamNode({ face: this.mind, scale: 0.3, x: -650, y: TOP + 40 })
  eye = new Eye({ tint: BLUE, scale: 1.1, x: 150, y: TOP })
  worldview = new Worldview({ scale: 0.32, x: 1500, y: TOP })
  observed = [this.beacon, this.node, this.eye, this.worldview]
  lattice = new StateLattice({
    machine: machinesOf(gatherStateSpace(this.observed)),
    song: () => this.build(),
    span: 240,
    y: -350,
    // Turned a little, so its third dimension reads.
    h: 0.35,
    p: 0.25,
  })

  override stateSpace(): StateSpace {
    return { axes: this.lattice.axes() }
  }

  unfold() {
    const o = this.observer
    o.radius.value = o.radius.defaultValue = 4300
    o.y.value = o.y.defaultValue = 450
    for (const h of [...this.observed, this.lattice]) this.stage(h)
    this.play(together(...this.observed.map((h) => Create(h)), Create(this.lattice)), 1.5)
    // The song: a short walk through the machines — the gold line.
    const walk = [
      this.beacon.stateAxis("coherence").to("beacon"),
      this.mind.stateAxis("liminal").to("liminal"),
      this.eye.stateAxis("opening").to("closed"),
      this.worldview.stateAxis("distortion").to("distorted"),
      this.beacon.stateAxis("noise").to("gone"),
      this.eye.stateAxis("opening").to("open"),
      this.worldview.stateAxis("strings").to("pulled"),
    ]
    this.lattice.thread.tint.value = GOLD
    for (const step of walk) this.play(step, 1.2)
    void RED
  }
}


/**
 * The InterBrain song's own machine (`?scene=lattice-interbrain`): every
 * walkable holon of the eight chapters — 1,392 axes, ~10^446 states — as
 * a lattice per machine, the chapters left to right; the song's 2,835 s as
 * a line through them, its current state lit at t (scene time = song time).
 */
export class LatticeInterBrainDream extends Dream {
  song = new InterBrainSongDream()
  lattice = new StateLattice({
    machine: (() => {
      const tl = this.song.build()
      void tl
      const m = machinesOf(
        gatherStateSpace(this.song.roots, this.song.stateSpace()),
        this.song.chapters.map((c, k) => ({ label: `${k + 1} · ${CHAPTERS[k]!.title.replace(/\n/g, " ")}`, roots: c.dream.roots })),
      )
      m.label = "The InterBrain"
      return m
    })(),
    song: () => this.song.build(),
    playhead: "song",
    span: 240,
    woven: 16,
    blockAspect: 0.4,
  })

  unfold() {
    const o = this.observer
    o.radius.value = o.radius.defaultValue = 15500
    this.stage(this.lattice)
    this.play(Create(this.lattice), 2)
    const d = this.song.build().duration
    this.play(eased("linear", this.lattice.time.to(d)), d)
  }
}

if (import.meta.main) render(LatticeInterBrainDream)
