/**
 * The state-space lattice — a visual automaton's MACHINE, as a structure
 * (David, 2026-10-18, docs/VISION-HYPEROBJECT.md "The state-space lattice":
 * "a parametric symbol that takes any object and visualises the state
 * machine underneath as a 3D lattice … how weaving machines into larger
 * machines makes the phase space explode: fractal, holonic state machines").
 *
 * This module is the model; vocabulary/StateLattice draws it. It reads
 * nothing but what the automaton already reads — `gatherStateSpace` over
 * the roots, the same axes, positions and owners the player walks — so the
 * lattice and the walk can never disagree about what the states are.
 *
 * THE HOLARCHY OF MACHINES. Every holon that declares axes is a MACHINE:
 * the product of its own axes. A machine inside another (a Worldview's
 * Eye, a CoherenceBeacon's Field) is a SUB-MACHINE, found by walking up
 * the holon tree to the nearest holon that owns axes. Weaving machines
 * together MULTIPLIES their state counts: a whole's phase space is its own
 * times every part's. `MachineNode.own` / `.woven` carry both numbers
 * (as log10 — the InterBrain song's 1,392 axes span ~10^430 states).
 *
 * THE PROJECTION (why this one). A product of independent machines cannot
 * be drawn whole beyond toy sizes, and a LINEAR projection of it (a
 * hypercube's shadow, PCA) lays distinct states on top of each other and
 * crosses transitions. Two rules instead, both injective:
 *
 *  - WOVEN where it fits: while a machine together with all its parts has
 *    at most `woven` states, it is drawn as ONE lattice of all those axes —
 *    so a part's lattice literally appears again at every state of its
 *    whole (the multiplication, visible).
 *  - FACTORED beyond: the machine's own lattice, with each sub-machine its
 *    own lattice beside it. A point of the product is then one lit node
 *    per factor — the current state is a constellation of lights, and a
 *    song is a path through each factor at once. Size grows as the SUM of
 *    the factors, not the product.
 *
 * Inside one lattice, axes beyond three NEST: the first three span x, y, z;
 * the next three span a smaller copy at every node, and so on (a hypercube
 * of hypercubes). A transition along one axis stays one short straight
 * edge, and no two states coincide.
 */

import { nearestPosition, type Axis, type StateSpace } from "./automaton"
import type { Holon } from "./holon"
import type { Param, ParamValue } from "./params"

/** One lattice: the product of these axes. Node i is a mixed-radix tuple over them. */
export interface Factor {
  /** The holon whose machine this is (undefined: the scene's own axes). */
  owner?: Holon
  label: string
  axes: Axis[]
  /** Positions per axis. */
  radix: number[]
  /** How many nodes (the product of radix). */
  size: number
}

/** A machine in the holarchy: its own axes, its sub-machines, the states each spans. */
export interface MachineNode {
  owner?: Holon
  label: string
  /** Its own axes (declared by `owner`). */
  axes: Axis[]
  parts: MachineNode[]
  /** log10 of its own state count, and of it woven with every part below. */
  own: number
  woven: number
}

const log10 = (n: number) => Math.log10(Math.max(1, n))
const nameOf = (h: Holon | undefined) => (h ? h.constructor.name : "scene")

/**
 * The machines under these roots, as a holarchy: one node per holon that
 * owns axes, nested by the holon tree; the scene's own (owner-less) axes,
 * if any, a machine at the top. `group` partitions the roots' machines
 * further (a DreamSong's chapters): one top-level node per group.
 */
export const machinesOf = (space: StateSpace, groups?: { label: string; roots: readonly Holon[] }[]): MachineNode => {
  const byOwner = new Map<Holon | undefined, Axis[]>()
  for (const a of space.axes) byOwner.set(a.owner, [...(byOwner.get(a.owner) ?? []), a])
  const nodes = new Map<Holon, MachineNode>()
  const make = (owner: Holon | undefined, axes: Axis[]): MachineNode => {
    const own = axes.reduce((s, a) => s + log10(a.positions.length), 0)
    return { owner, label: nameOf(owner), axes, parts: [], own, woven: own }
  }
  for (const [owner, axes] of byOwner) if (owner) nodes.set(owner, make(owner, axes))
  const top = make(undefined, byOwner.get(undefined) ?? [])
  top.label = "scene"
  const tops: MachineNode[] = []
  for (const [owner, node] of nodes) {
    let p = owner.parent
    while (p && !nodes.has(p)) p = p.parent
    if (p) nodes.get(p)!.parts.push(node)
    else tops.push(node)
  }
  // Keep the walk's order (whole-first, declaration order) everywhere.
  const order = new Map<Holon, number>()
  space.axes.forEach((a, i) => a.owner && !order.has(a.owner) && order.set(a.owner, i))
  const byOrder = (a: MachineNode, b: MachineNode) => (order.get(a.owner!) ?? 0) - (order.get(b.owner!) ?? 0)
  for (const n of nodes.values()) n.parts.sort(byOrder)
  tops.sort(byOrder)
  if (groups) {
    for (const g of groups) {
      const inside = new Set<Holon>()
      for (const r of g.roots) for (const h of r.walk()) inside.add(h)
      const node = make(undefined, [])
      node.label = g.label
      node.parts = tops.filter((m) => inside.has(m.owner!))
      top.parts.push(node)
    }
  } else top.parts.push(...tops)
  const weave = (n: MachineNode): number => (n.woven = n.own + n.parts.reduce((s, p) => s + weave(p), 0))
  weave(top)
  return top
}

/** Every axis in a machine and all its parts, whole-first. */
export const axesBelow = (m: MachineNode): Axis[] => [...m.axes, ...m.parts.flatMap(axesBelow)]

/** A lattice over these axes. */
export const factorOf = (axes: Axis[], label: string, owner?: Holon): Factor => {
  const radix = axes.map((a) => a.positions.length)
  return { owner, label, axes, radix, size: radix.reduce((s, n) => s * n, 1) }
}

/**
 * Split a machine into the lattices it is drawn as (see THE PROJECTION):
 * woven while `woven` states at most, else its own axes (themselves split
 * into runs of at most `max` nodes) and each part, recursively. Each
 * factor carries its depth in the holarchy, for the layout.
 */
export const factorsOf = (
  m: MachineNode,
  opts: { woven?: number; max?: number } = {},
  depth = 0,
): { factor: Factor; depth: number; machine: MachineNode }[] => {
  const woven = opts.woven ?? 64
  const max = opts.max ?? 128
  const all = axesBelow(m)
  if (all.length > 0 && 10 ** m.woven <= woven + 1e-9) return [{ factor: factorOf(all, m.label, m.owner), depth, machine: m }]
  const out: { factor: Factor; depth: number; machine: MachineNode }[] = []
  let run: Axis[] = []
  let size = 1
  const flush = () => {
    if (run.length) out.push({ factor: factorOf(run, m.label, m.owner), depth, machine: m })
    run = []
    size = 1
  }
  for (const a of m.axes) {
    if (run.length && size * a.positions.length > max) flush()
    run.push(a)
    size *= a.positions.length
  }
  flush()
  for (const p of m.parts) out.push(...factorsOf(p, opts, depth + 1))
  return out
}

/** Node index → the position index on each axis (mixed radix, first axis fastest). */
export const digitsOf = (f: Factor, node: number): number[] => {
  const d: number[] = []
  let n = node
  for (const r of f.radix) {
    d.push(n % r)
    n = Math.floor(n / r)
  }
  return d
}

export const nodeOf = (f: Factor, digits: readonly number[]): number => {
  let n = 0
  for (let i = f.radix.length - 1; i >= 0; i--) n = n * f.radix[i]! + digits[i]!
  return n
}

/** The node a factor stands at, its params read through `valueOf` (live values by default). */
export const currentNode = (f: Factor, valueOf: (p: Param<ParamValue>) => ParamValue = (p) => p.value): number =>
  nodeOf(
    f,
    f.axes.map((a) => {
      const name = nearestPosition(a, valueOf)
      return a.positions.findIndex((p) => p.name === name)
    }),
  )

/** A node's name: its positions, joined. */
export const nodeName = (f: Factor, node: number): string =>
  digitsOf(f, node)
    .map((d, i) => f.axes[i]!.positions[d]!.name)
    .join(" · ")

/** A node's params and values: every axis at its position (what clicking it walks to). */
export const nodeValues = (f: Factor, node: number): [Param<ParamValue>, ParamValue][] =>
  digitsOf(f, node).flatMap((d, i) => [...f.axes[i]!.positions[d]!.values])

/** Edges: node pairs one step apart along one axis (adjacent positions in cycle order). */
export const edgesOf = (f: Factor): [number, number][] => {
  const out: [number, number][] = []
  for (let node = 0; node < f.size; node++) {
    const d = digitsOf(f, node)
    d.forEach((di, i) => {
      if (di + 1 < f.radix[i]!) {
        const e = [...d]
        e[i] = di + 1
        out.push([node, nodeOf(f, e)])
      }
    })
  }
  return out
}

/**
 * Where each node stands (lattice-local, centred, about `span` across):
 * axes 0–2 → x, y, z at full spacing; 3–5 → x, y, z of a smaller copy at
 * every node; and so on (see THE PROJECTION).
 */
export const layoutOf = (f: Factor, span: number): { x: number; y: number; z: number }[] => {
  const levels = Math.ceil(f.radix.length / 3)
  const spacing: number[] = []
  let room = span
  for (let L = 0; L < levels; L++) {
    const widest = Math.max(1, ...f.radix.slice(3 * L, 3 * L + 3).map((n) => n - 1))
    spacing.push(room / widest)
    room = (0.45 * room) / widest
  }
  const out: { x: number; y: number; z: number }[] = []
  for (let node = 0; node < f.size; node++) {
    const d = digitsOf(f, node)
    const p = [0, 0, 0]
    d.forEach((di, i) => {
      const L = Math.floor(i / 3)
      p[i % 3]! += (di - (f.radix[i]! - 1) / 2) * spacing[L]!
    })
    // y up: the first axis runs left → right, the second bottom → top.
    out.push({ x: p[0]!, y: p[1]!, z: p[2]! })
  }
  return out
}

/**
 * A song's path through a factor: the node at every `dt` of song time,
 * kept only where it changes — what the song line draws and what a
 * playhead lights. `valueAt` reads the song (Timeline.valueAt).
 */
export const songPath = (
  f: Factor,
  valueAt: (p: Param<ParamValue>, t: number) => ParamValue,
  t0: number,
  t1: number,
  dt: number,
): { t: number; node: number }[] => {
  const out: { t: number; node: number }[] = []
  for (let t = t0; t <= t1 + 1e-9; t += dt) {
    const node = currentNode(f, (p) => valueAt(p, t))
    if (out.length === 0 || out[out.length - 1]!.node !== node) out.push({ t, node })
  }
  return out
}
