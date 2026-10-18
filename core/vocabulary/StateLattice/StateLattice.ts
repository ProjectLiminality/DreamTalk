/**
 * StateLattice — any holon's state machine, as a 3D lattice you can walk.
 *
 * David, 2026-10-18 (docs/VISION-HYPEROBJECT.md, "The state-space
 * lattice"): states as nodes, transitions as edges, machines woven into
 * bigger machines nested — so the phase space visibly multiplies — and a
 * DreamSong drawn through it as a SONG LINE, its current state lit.
 *
 * The model is src/lattice.ts (the holarchy of machines, the projection
 * and why); this draws it:
 *
 *  - each FACTOR a lattice: its nodes rings, its transitions one
 *    Polylines of short straight edges; nested sub-lattices smaller;
 *  - the current state: the node each factor stands at, filled and glowing
 *    gold — read live (what the player shows) or off the song at `time`;
 *  - the SONG LINE: in gold, every path the song takes through each
 *    factor, and one THREAD through all of them in the order the song
 *    makes its moves — the linear story through the constellation, drawn
 *    on as the song plays (`thread.creation`);
 *  - a label per block (chapter or machine) with its state count: own, and
 *    woven with its parts — the explosion, in numbers.
 *
 * WALKABLE: `axes()` gives one axis per interactive factor (a `poses` over
 * that machine's params, a position per node) whose handles are the
 * nodes, each standing for ITS position (AxisOpts.at) — so clicking or
 * pinching a node walks the observed holons there, through the ONE
 * automaton the player already runs. A scene returns them from its
 * stateSpace(). Interactive factors are drawn as ring holons; past
 * `interactive` nodes in all, only the factors the song moves are, and
 * the rest are drawn as one Polylines each (cheap, not clickable).
 */

import { Circle, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { Polylines, deriveLoops } from "../../src/parts/polylines"
import { Text } from "../../src/parts/text"
import { derive, length, paramEpoch, scalar, type Param, type ParamValue } from "../../src/params"
import { GOLD, WHITE, rgb } from "../../src/constants"
import { glow } from "../../src/glow"
import { poses, type Axis } from "../../src/automaton"
import type { Holon } from "../../src/holon"
import {
  currentNode,
  edgesOf,
  factorsOf,
  layoutOf,
  nodeName,
  nodeValues,
  songPath,
  type Factor,
  type MachineNode,
} from "../../src/lattice"

/** A song to draw through the lattice: its values at any t, its length. */
export interface LatticeSong {
  valueAt(p: Param<ParamValue>, t: number): ParamValue
  duration: number
  /** The params the song moves (Timeline.params): a factor touching none of them stands still. */
  params?: readonly Param<ParamValue>[]
}

type P = { x: number; y: number; z: number }

/** A lattice node that can glow (the current state, a hovered handle). */
class LatticeNode extends Circle {
  glow = glow(0)
}

/** One lattice's nodes, as one holon a level below the lattice. */
class NodeSet extends Null {
  nodes: LatticeNode[] = []
  protected override compose(): void {
    for (const n of this.nodes) this.add(n)
  }
}

const QUIET = rgb(150, 150, 150)
/** Each level down the holarchy draws this much smaller. */
const SHRINK = 0.65
/** A ring's radius against its lattice's span. */
const RING = 0.045

interface Drawn {
  factor: Factor
  depth: number
  machine: MachineNode
  /** Lattice-local node places, offset to the lattice's own place. */
  places: P[]
  nodes?: LatticeNode[]
}

export class StateLattice extends Null {
  static sovereign = true

  /** The machine to draw (src/lattice.ts machinesOf) — construction. */
  machine: MachineNode | undefined = undefined
  /** A song through it, read lazily (the scene's own build, or another Dream's) — construction. */
  song: (() => LatticeSong | undefined) | undefined = undefined
  /**
   * Where the current state is read: "live" — the params' values (what the
   * player and the walk show); "song" — the song at `time`.
   */
  playhead: "live" | "song" = "live"
  /** Song time, for playhead "song" (and the thread's draw-on). */
  time = scalar(0)
  /** One lattice's size, scene units. */
  span = length(240)
  /** Machines with at most this many states (woven with their parts) are drawn as one lattice. */
  woven = 64
  /** At most this many interactive nodes in all; beyond, only the song's factors are. */
  interactive = 1500
  /** A block's grid: columns over rows (1 square; less, taller blocks — many blocks side by side). */
  blockAspect = 1
  /** Label each factor (else only the blocks). */
  labels = true

  thread!: Line
  songLines!: Polylines
  drawn: Drawn[] = []

  /** How each param is read for the current state. */
  readAt = (p: Param<ParamValue>): ParamValue => {
    if (this.playhead === "song") {
      const s = this.#song()
      if (s) return s.valueAt(p, this.time.value)
    }
    return p.value
  }

  #songMemo: LatticeSong | undefined | null = null
  #axes: Axis[] | undefined
  #song(): LatticeSong | undefined {
    if (this.#songMemo === null) this.#songMemo = this.song?.()
    return this.#songMemo ?? undefined
  }

  /** The song's path through each factor, once (sampled every 0.25 s, or finer for a short song). */
  #paths: Map<Factor, { t: number; node: number }[]> | undefined
  #pathOf(f: Factor): { t: number; node: number }[] {
    if (!this.#paths) this.#paths = new Map()
    let p = this.#paths.get(f)
    if (!p) {
      const s = this.#song()
      if (!s) p = []
      else {
        this.#moved ??= new Set(s.params ?? [])
        const still = s.params && !f.axes.some((a) => a.params().some((q) => this.#moved!.has(q)))
        p = still
          ? [{ t: 0, node: currentNode(f, (q) => s.valueAt(q, 0)) }]
          : songPath(f, (q, t) => s.valueAt(q, t), 0, s.duration, Math.min(0.25, s.duration / 400))
      }
      this.#paths.set(f, p)
    }
    return p
  }
  #moved: Set<Param<ParamValue>> | undefined

  /** A factor's node at song time t, off its path (exact to the path's sampling). */
  #nodeAt(f: Factor, t: number): number {
    const path = this.#pathOf(f)
    let lo = 0
    let hi = path.length - 1
    if (hi < 0) return 0
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (path[mid]!.t <= t) lo = mid
      else hi = mid - 1
    }
    return path[lo]!.node
  }

  protected override compose(): void {
    const machine = this.machine
    if (!machine) throw new Error("StateLattice: needs a machine (src/lattice.ts machinesOf)")
    const S = this.span.value
    const blocks = machine.parts.length ? machine.parts : [machine]
    const all = blocks.map((b) => factorsOf(b, { woven: this.woven }))
    const total = all.flat().reduce((s, f) => s + f.factor.size, 0)
    // Past the budget, only what the song moves is walkable (and labelled):
    // then the song is read now — a song built apart from this lattice's scene.
    const songMoves = (f: Factor) => this.#song() !== undefined && this.#pathOf(f).length > 1
    const clickable = (f: Factor) => total <= this.interactive || songMoves(f)

    // Blocks left → right (a song's chapters in order); in each, its
    // lattices on a grid, whole before parts. Laid out first, then drawn
    // about the lattice's own origin (so it turns about its middle).
    const cell = S * 1.7
    const plan: { d: Drawn; span: number; at: P }[] = []
    const heads: { text: string; x: number; w: number }[] = []
    const states = (l: number) => (l < 6 ? Math.round(10 ** l).toLocaleString("en") : `10^${l.toFixed(0)}`)
    let x0 = 0
    let bottom = 0
    blocks.forEach((block, b) => {
      const list = all[b]!
      const cols = Math.max(1, Math.ceil(Math.sqrt(list.length * this.blockAspect)))
      list.forEach(({ factor, depth, machine: m }, i) => {
        const at: P = { x: x0 + (i % cols) * cell, y: -Math.floor(i / cols) * cell, z: 0 }
        bottom = Math.min(bottom, at.y)
        const span = S * SHRINK ** Math.min(depth, 3)
        const places = layoutOf(factor, span).map((q) => ({ x: at.x + q.x, y: at.y + q.y, z: at.z + q.z }))
        plan.push({ d: { factor, depth, machine: m, places }, span, at })
      })
      // The block's name and what it spans, woven with all its parts.
      heads.push({ text: `${block.label} — ${states(block.woven)} states`, x: x0 + ((cols - 1) * cell) / 2, w: cols * cell })
      x0 += cols * cell + cell * 1.1
    })
    const xs = plan.map((q) => q.at.x)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = bottom / 2
    for (const { d, span, at } of plan) {
      for (const q of d.places) {
        q.x -= cx
        q.y -= cy
      }
      this.drawn.push(d)
      this.#drawFactor(d, span, clickable(d.factor))
      if (this.labels && (total <= this.interactive || songMoves(d.factor))) {
        this.add(
          new Text({
            content: `${d.factor.label} · ${d.factor.size}`,
            size: Math.max(S * 0.09, span * 0.13),
            x: at.x - cx,
            y: at.y - cy - span * 0.5 - span * 0.22,
            tint: QUIET,
          }),
        )
      }
    }
    for (const h of heads) this.add(new Text({ content: h.text, size: Math.max(S * 0.2, Math.min(h.w * 0.05, S * 0.6)), x: h.x - cx, y: cell * 0.62 - cy, tint: WHITE }))
    // Several machines woven into one: the whole and what weaving them made of it.
    if (blocks.length > 1)
      this.add(
        new Text({
          content: `${machine.label} — ${states(machine.woven)} states`,
          size: S * 0.5,
          x: 0,
          y: cell * 1.5 - cy,
          tint: WHITE,
        }),
      )

    // The song line: each factor's path, and the thread through them all —
    // read lazily (first drawn), since a scene's own song is built after
    // its holons are composed.
    this.songLines = this.add(new Polylines({ tint: GOLD, stroke: 2.5 }))
    deriveLoops(this.songLines, () => [0], () =>
      this.drawn.map((d) => this.#pathOf(d.factor)).flatMap((path, i) => (path.length > 1 ? [path.map((s) => this.drawn[i]!.places[s.node]!)] : [])),
    )
    this.thread = this.add(new Line({ tint: GOLD, stroke: 1.2, opacity: 0.55 }))
    // The song's moves in time order; on a song playhead, the thread is
    // drawn as far as the song has come.
    let moves: { t: number; from: P; to: P }[] | undefined
    const allMoves = () =>
      (moves ??= this.drawn
        .flatMap((d) => {
          const path = this.#pathOf(d.factor)
          return path.slice(1).map((s, k) => ({ t: s.t, from: d.places[path[k]!.node]!, to: d.places[s.node]! }))
        })
        .sort((a, b) => a.t - b.t))
    const reached = () => {
      const m = allMoves()
      if (this.playhead !== "song") return m.length
      let n = 0
      while (n < m.length && m[n]!.t <= this.time.value) n++
      return n
    }
    derivePoints(this.thread, () => [reached()], () => {
      const pts = allMoves().slice(0, reached()).flatMap((m) => [m.from, m.to])
      return pts.length >= 2 ? pts : [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }]
    })
  }

  #drawFactor(d: Drawn, span: number, clickable: boolean): void {
    const { factor, places } = d
    const edges = this.add(new Polylines({ tint: QUIET, stroke: 1.2, opacity: 0.7 }))
    edges.loops = edgesOf(factor).map(([a, b]) => [places[a]!, places[b]!])
    // A ring fits its finest spacing: nested copies stay apart.
    const levels = Math.ceil(factor.radix.length / 3)
    let room = span
    for (let L = 0; L < levels - 1; L++) room = (0.45 * room) / Math.max(1, ...factor.radix.slice(3 * L, 3 * L + 3).map((n) => n - 1))
    const finest = room / Math.max(1, ...factor.radix.slice(3 * (levels - 1)).map((n) => n - 1))
    const r = Math.min(span * RING, finest * 0.22)
    // Read once per change of any param (paramEpoch), not once per node.
    let seen = -1
    let at = 0
    const now = () => {
      const e = paramEpoch()
      if (e !== seen) {
        seen = e
        // On a song: off its path (a still factor costs nothing); live: off the params.
        at = this.playhead === "song" && this.#song() ? this.#nodeAt(factor, this.time.value) : currentNode(factor, this.readAt)
      }
      return at
    }
    if (clickable) {
      d.nodes = places.map((q, i) => {
        const lit = derive(() => (now() === i ? 1 : 0))
        return new LatticeNode({
            radius: r,
            x: q.x,
            y: q.y,
            z: q.z,
            stroke: 1.5,
            tint: derive(() => (lit.value ? GOLD : QUIET)),
            fillOpacity: lit,
            glow: lit,
          })
      })
      // One group per lattice: its nodes sit a level deeper than the song
      // line drawn through them, so a click on a node is the node's.
      this.add(new NodeSet({ nodes: d.nodes }))
      return
    }
    // Drawn, not walkable: every node a small ring, the current one doubled.
    const dots = this.add(new Polylines({ tint: QUIET, stroke: 1 }))
    const ring = (c: P, rr: number): Vec3Like[] =>
      Array.from({ length: 9 }, (_, k) => ({ x: c.x + rr * Math.cos((k / 8) * 2 * Math.PI), y: c.y + rr * Math.sin((k / 8) * 2 * Math.PI), z: c.z }))
    deriveLoops(dots, () => [now()], () => {
      const at = now()
      return [...places.map((q) => ring(q, r)), ring(places[at]!, r * 1.8)]
    })
  }

  /**
   * One axis per walkable factor: its nodes are the handles, each standing
   * for its own position — clicking a node walks the machine there.
   */
  axes(): Axis[] {
    if (this.#axes) return this.#axes
    void this.parts
    const out: Axis[] = (this.#axes = [])
    for (const d of this.drawn) {
      if (!d.nodes) continue
      const { factor } = d
      const positions: Record<string, [Param<ParamValue>, ParamValue][]> = {}
      const names: string[] = []
      for (let i = 0; i < factor.size; i++) {
        const name = nodeName(factor, i)
        names.push(name)
        positions[name] = nodeValues(factor, i)
      }
      if (names.length < 2) continue
      const nodes = d.nodes
      out.push(
        poses(`◇ ${factor.label}`, positions, {
          label: `◇ ${factor.label}`,
          handles: nodes as Holon[],
          at: (h) => names[nodes.indexOf(h as LatticeNode)],
        }),
      )
    }
    return out
  }
}
