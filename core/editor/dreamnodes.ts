/**
 * dreamnodes.ts — a scene seen as the DreamNodes that compose it.
 *
 *   "a third mode, the Dream Explorer view, disassembling the scene into
 *    its DreamNodes" — docs/transmissions/2026-09-20-creator-mode.md
 *
 * The pure half of the Dream Explorer (demo/explorer.ts is the other
 * half: the host, the flight, the overlay). Nothing here touches a
 * renderer, so all of it is testable under Bun.
 *
 * WHAT A DREAMNODE IS, HERE. A DreamNode is a repo, and a repo is a
 * CLASS, not an instance: YinYang's four Globes are one Globe, the way
 * Finder shows a folder once however many aliases point at it. So the
 * tree is class-level — one node per sovereign class (`static sovereign
 * = true`, the cast's rule), its parent the nearest sovereign whole that
 * holds it, the root the scene itself. Layer-1 vocabulary (Line, Circle,
 * Text…) is the node's own ink, never a node: invisible assets, not cast.
 *
 * One instance per class is the REPRESENTATIVE: it flies out and is the
 * node. The others fade where they stand (and say so: "×4").
 *
 * THE SCENE AND ITS SYMBOL ARE ONE NODE when they share a name. CLAUDE.md's
 * single-file pattern — the class and its standalone scene live together —
 * means MindVirusDream staging a MindVirus is the MindVirus DreamNode
 * looking at itself, not a scene that contains one. Merging them is the
 * honest reading, and it keeps a symbol's own demo from showing its name
 * twice.
 */

import { Holon } from "../src/holon"
import { Dream, type DreamClass } from "../src/dream"
import { Create } from "../src/verbs"
import { classNameOf } from "./classname"
import { pathOf, type SelectionPath } from "./selection"

/**
 * A DreamNode's name: its class's. A bundler that meets two classes of one
 * name renames the later (holons/Cylinder's Cylinder became `Cylinder3` in
 * the demo bundle, beside the vocabulary's and the primitive's), and a
 * repo is never called that — so a numeric tail is the bundler's, not ours.
 */
export const nodeNameOf = (holon: Holon): string => classNameOf(holon).replace(/(?<=[A-Za-z])\d+$/, "")

/** ONTOLOGY.md's dial, read: the class says it is a sovereign symbol. */
export const isSovereign = (holon: Holon): boolean =>
  (holon.constructor as { sovereign?: boolean }).sovereign === true

export interface DreamNode {
  /** The class name — which is also the repo's, and the path segment. */
  name: string
  /** The class, when the node is a symbol (absent for a bare scene root). */
  ctor?: new () => Holon
  /** The instance that IS the node in the exploded view. */
  rep?: Holon
  /**
   * The holons that move as this node: its representative — or, for the
   * root, every live non-sovereign root of the scene (the scene's own ink)
   * plus a merged representative.
   */
  members: Holon[]
  /** Instances of this class in the scene, the representative included. */
  count: number
  /** The other instances: they fade where they stand. */
  others: Holon[]
  parent?: DreamNode
  children: DreamNode[]
  depth: number
}

/**
 * The DreamNode tree of a scene. `name` is the scene's own node name;
 * `isLive` filters roots that are not on screen at all (a DreamSong's
 * inactive chapters, gated to nothing).
 */
export const dreamNodesOf = (
  roots: readonly Holon[],
  name: string,
  isLive: (root: Holon) => boolean = () => true,
): DreamNode => {
  const root: DreamNode = { name, members: [], count: 1, others: [], children: [], depth: 0 }
  const byClass = new Map<string, DreamNode>()
  // A root may be given a whole only when that whole composes (a Group
  // gathers its members lazily), so compose everything first; a root that
  // turns out to be a member is then visited through its whole, once.
  for (const r of roots) for (const _ of r.walk());
  const live = roots.filter((r) => r.parent === undefined && isLive(r))

  const merged = live.find((r) => isSovereign(r) && nodeNameOf(r) === name)
  if (merged) {
    root.rep = merged
    root.ctor = merged.constructor as new () => Holon
    root.members.push(merged)
    root.count = 0 // counted as an instance below, like any other
    byClass.set(name, root)
  }

  // Non-representative instances, visited after every representative so a
  // class is represented by an instance that is itself in flight whenever
  // one exists (depth-first would otherwise let a later sibling's part win).
  const deferred: { holon: Holon; node: DreamNode }[] = []

  const visit = (holon: Holon, container: DreamNode): void => {
    if (!isSovereign(holon)) {
      for (const part of holon.parts) visit(part, container)
      return
    }
    const cls = nodeNameOf(holon)
    const known = byClass.get(cls)
    if (known && known.rep !== holon) {
      known.count++
      deferred.push({ holon, node: known })
      return
    }
    let node = known
    if (!node) {
      node = {
        name: cls,
        ctor: holon.constructor as new () => Holon,
        rep: holon,
        members: [holon],
        count: 0,
        others: [],
        parent: container,
        children: [],
        depth: container.depth + 1,
      }
      container.children.push(node)
      byClass.set(cls, node)
    }
    node.count++
    for (const part of holon.parts) visit(part, node)
  }

  for (const r of live) {
    if (!isSovereign(r)) root.members.push(r)
    visit(r, root)
  }

  // A deferred instance's own parts may hold a class nothing else does —
  // that class is still a DreamNode, and its instance then cannot fade.
  for (let i = 0; i < deferred.length; i++) {
    const { holon, node } = deferred[i]!
    const before = byClass.size
    for (const part of holon.parts) visit(part, node)
    if (byClass.size === before) node.others.push(holon)
  }
  return root
}

/** Every node of the tree, parents before children. */
export const flatten = (root: DreamNode): DreamNode[] => {
  const out: DreamNode[] = []
  const walk = (n: DreamNode) => {
    out.push(n)
    n.children.forEach(walk)
  }
  walk(root)
  return out
}

/**
 * The holon whose transform a node moves, keyed by holon. A holon in
 * this map is re-placed directly; everything else rides along with the
 * nearest ancestor that is in it.
 */
export const moversOf = (root: DreamNode): Map<Holon, DreamNode> => {
  const movers = new Map<Holon, DreamNode>()
  for (const node of flatten(root)) for (const m of node.members) movers.set(m, node)
  return movers
}

/** The nearest STRICT ancestor of a holon that is itself moved, if any. */
export const carrierOf = (holon: Holon, movers: ReadonlyMap<Holon, DreamNode>): DreamNode | undefined => {
  for (let n = holon.parent; n; n = n.parent) {
    const node = movers.get(n)
    if (node) return node
  }
  return undefined
}

/**
 * A node's own ink: the smallest set of holons whose subtrees are all its
 * own (no sovereign inside — those are other nodes, or fade) and that are
 * themselves shown. One bounds query per entry, not per leaf — TheWall has
 * 3,776. A part not yet drawn still counts: it is the symbol's geometry,
 * and its ring should hold all of it.
 */
export const inkOf = (node: DreamNode, visible: (holon: Holon) => boolean): Holon[] => {
  const pure = new Map<Holon, boolean>()
  const isPure = (h: Holon): boolean => {
    const known = pure.get(h)
    if (known !== undefined) return known
    const ok = h.parts.every((p) => !isSovereign(p) && isPure(p))
    pure.set(h, ok)
    return ok
  }
  const out: Holon[] = []
  const gather = (h: Holon) => {
    if (!visible(h)) return
    if (isPure(h)) {
      out.push(h)
      return
    }
    for (const part of h.parts) if (!isSovereign(part)) gather(part)
  }
  for (const m of node.members) {
    if (m !== node.rep) gather(m)
    else if (m.parts.length === 0) {
      // A representative with no parts IS its ink (a sovereign stroke).
      if (visible(m)) out.push(m)
    } else for (const part of m.parts) if (!isSovereign(part)) gather(part)
  }
  return out
}

/** Every holon a node's own ink is drawn by — its stroke widths follow its scale. */
export const ownHolonsOf = (node: DreamNode): Holon[] => {
  const out: Holon[] = []
  const walk = (h: Holon) => {
    out.push(h)
    for (const part of h.parts) if (!isSovereign(part)) walk(part)
  }
  for (const m of node.members) walk(m)
  return out
}

// --- Layout -----------------------------------------------------------------

/** A node's place in the exploded view, in drawing-buffer pixels. */
export interface Disc {
  x: number
  y: number
  r: number
}

/** Room under each disc for the name and the path. */
export const LABEL_ROOM = 44
const MARGIN = 28
const GAP = 34

/**
 * The constellation: the scene at the centre, its DreamNodes on a ring
 * around it, theirs further out within their parent's sector — a radial
 * holarchy, wholes inside, parts beyond. Stretched to the frame's aspect
 * (a 16:9 ring is an ellipse), shrunk until no two discs touch, then
 * fitted and centred, labels included.
 */
export const layoutOf = (root: DreamNode, width: number, height: number): Map<DreamNode, Disc> => {
  const nodes = flatten(root)
  const depth = Math.max(0, ...nodes.map((n) => n.depth))
  const leaves = new Map<DreamNode, number>()
  const count = (n: DreamNode): number => {
    const k = n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + count(c), 0)
    leaves.set(n, k)
    return k
  }
  count(root)

  // Unit placement: ring d at radius d, x stretched to the frame's aspect.
  const aspect = width / height
  const angle = new Map<DreamNode, number>()
  const place = (n: DreamNode, from: number, span: number) => {
    let at = from
    for (const c of n.children) {
      const share = (span * leaves.get(c)!) / leaves.get(n)!
      angle.set(c, at + share / 2)
      place(c, at, share)
      at += share
    }
  }
  // Turn the first ring so no node sits straight above or below the
  // centre when it can be helped — the frame is wide, not tall.
  const first = root.children.length
  const turn = (offset: number) =>
    Math.min(...root.children.map((_, i) => Math.abs(Math.cos(offset + (2 * Math.PI * (i + 0.5)) / first))))
  const offset = first > 0 && turn(-Math.PI / first) >= turn(0) ? -Math.PI / first : 0
  place(root, offset, 2 * Math.PI)

  const base = (d: number) => (d === 0 ? 0.17 : d === 1 ? 0.125 : 0.095) * height
  const raw = new Map<DreamNode, Disc>()
  for (const n of nodes) {
    const a = angle.get(n) ?? 0
    const ring = n.depth / Math.max(depth, 1)
    raw.set(n, { x: Math.cos(a) * ring * aspect, y: Math.sin(a) * ring, r: base(n.depth) })
  }

  // Unit → pixels: pick the ring scale where the tightest pair just clears.
  const discs = [...raw.values()]
  let unit = 0.3 * height
  for (let i = 0; i < discs.length; i++) {
    for (let j = i + 1; j < discs.length; j++) {
      const a = discs[i]!
      const b = discs[j]!
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d > 1e-9) unit = Math.max(unit, (a.r + b.r + GAP) / d)
    }
  }

  // Fit the whole constellation — discs and labels — into the frame.
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const d of discs) {
    minX = Math.min(minX, d.x * unit - d.r)
    maxX = Math.max(maxX, d.x * unit + d.r)
    minY = Math.min(minY, d.y * unit - d.r)
    maxY = Math.max(maxY, d.y * unit + d.r + LABEL_ROOM)
  }
  const fit = Math.min(1, (width - 2 * MARGIN) / (maxX - minX), (height - 2 * MARGIN) / (maxY - minY))
  const cx = width / 2 - ((minX + maxX) / 2) * fit
  const cy = height / 2 - ((minY + maxY) / 2) * fit

  const out = new Map<DreamNode, Disc>()
  for (const [n, d] of raw) out.set(n, { x: cx + d.x * unit * fit, y: cy + d.y * unit * fit, r: d.r * fit })
  return out
}

// --- Navigation: the path IS the place --------------------------------------

/** A step of the breadcrumb: the node's name and the URL query that is it. */
export interface Crumb {
  name: string
  query: string
}

/** What a page at `?scene=…&path=…` shows. */
export interface Place {
  Dream: DreamClass
  /** The node the page is — the scene's own name, or the path's last step. */
  name: string
  /** From the scene down to this node; the last one is here. */
  crumbs: Crumb[]
  /** True when no registered scene stands for the node: it is framed alone. */
  alone: boolean
}

/** A Dream's own name — its class, without the suffix every Dream carries. */
export const dreamNameOf = (Ctor: DreamClass): string => Ctor.name.replace(/Dream$/, "")

/**
 * A DreamNode's own standalone scene, if the registry has one: the scene
 * whose Dream is named for the class (EyeDream for Eye) or whose key is
 * its name (globe for Globe).
 */
export const sceneOfNode = (scenes: Record<string, DreamClass>, name: string): string | undefined => {
  const entries = Object.entries(scenes)
  return (
    entries.find(([, Ctor]) => Ctor.name === `${name}Dream`)?.[0] ??
    entries.find(([key]) => key === name.toLowerCase())?.[0]
  )
}

/**
 * The canonical standalone scene of a symbol with none of its own —
 * CLAUDE.md's `if __name__ == "__main__"` pattern: the class at its
 * defaults, created, held.
 */
export const aloneDream = (Ctor: new () => Holon, name: string): DreamClass => {
  // The field is named for the node (`calculator`), as a DreamWeaving would
  // name it — the creator panel calls a root by its field.
  const field = name.charAt(0).toLowerCase() + name.slice(1)
  const Alone = class extends Dream {
    constructor() {
      super()
      ;(this as unknown as Record<string, Holon>)[field] = new Ctor()
    }
    unfold() {
      const holon = (this as unknown as Record<string, Holon>)[field]!
      this.play(Create(holon), 2)
      this.wait(2)
    }
  }
  Object.defineProperty(Alone, "name", { value: `${name}Dream` })
  return Alone
}

const query = (sceneKey: string, path: readonly string[]): string => {
  const q = new URLSearchParams({ scene: sceneKey })
  if (path.length) q.set("path", path.join("/"))
  return q.toString()
}

/**
 * Walk a path down the holarchy: from the scene, each step names a
 * sovereign class found inside the previous node (at its defaults — the
 * DreamNode itself, not the instance the scene dressed up). A step that
 * names nothing ends the walk there: the place is as deep as the path is
 * true.
 */
export const resolvePlace = (
  scenes: Record<string, DreamClass>,
  sceneKey: string,
  path: readonly string[],
): Place => {
  const Scene = scenes[sceneKey]!
  const top = dreamNameOf(Scene)
  const crumbs: Crumb[] = [{ name: top, query: query(sceneKey, []) }]
  let holons: readonly Holon[] = new Scene().roots
  let found: { name: string; ctor: new () => Holon } | undefined
  const walked: string[] = []
  for (const step of path) {
    let ctor: (new () => Holon) | undefined
    for (const r of holons) {
      for (const h of r.walk()) {
        if (isSovereign(h) && nodeNameOf(h) === step) {
          ctor = h.constructor as new () => Holon
          break
        }
      }
      if (ctor) break
    }
    if (!ctor) break
    walked.push(step)
    crumbs.push({ name: step, query: query(sceneKey, walked) })
    found = { name: step, ctor }
    try {
      holons = [new ctor()]
    } catch {
      break
    }
  }
  if (!found) return { Dream: Scene, name: top, crumbs, alone: false }
  const own = sceneOfNode(scenes, found.name)
  return own
    ? { Dream: scenes[own]!, name: found.name, crumbs, alone: false }
    : { Dream: aloneDream(found.ctor, found.name), name: found.name, crumbs, alone: true }
}

/** What the editor can open: a registered scene, and a holon in it. */
export interface EditorAddress {
  scene: string
  sel?: SelectionPath
}

/**
 * Where the editor can find what an entered page shows. The editor opens
 * registered scenes only, so: a node with its own scene is addressed
 * there directly (its roots ARE this page's). A node standing alone has
 * no file the editor could write into except the scene above it — so the
 * address is the top scene, with the same holon selected inside the
 * instance the path walked through (the class at its defaults here, the
 * scene's own instance there — same parts, so the same indices). If the
 * part does not line up, the instance itself is selected: still true.
 */
export const editorAddressOf = (
  scenes: Record<string, DreamClass>,
  sceneKey: string,
  place: Place,
  roots: readonly Holon[],
  holon: Holon,
): EditorAddress => {
  const path = place.crumbs.slice(1).map((c) => c.name)
  if (!place.alone) {
    const own = path.length ? sceneOfNode(scenes, place.name) ?? sceneKey : sceneKey
    return { scene: own, sel: pathOf(roots, holon) }
  }
  const topRoots = new scenes[sceneKey]!().roots
  // Walk the path through the scene's own instances (a whole's first
  // matching part; never the whole itself, which named the previous step).
  let instance: Holon | undefined
  for (const step of path) {
    const within: readonly Holon[] = instance ? instance.parts : topRoots
    instance = undefined
    for (const r of within) {
      for (const h of r.walk()) {
        if (isSovereign(h) && nodeNameOf(h) === step) {
          instance = h
          break
        }
      }
      if (instance) break
    }
    if (!instance) return { scene: sceneKey }
  }
  const there = pathOf(topRoots, instance!)
  const here = pathOf(roots, holon)
  if (!there || !here || here.root !== 0) return { scene: sceneKey, sel: there }
  const sel: SelectionPath = { root: there.root, indices: [...there.indices, ...here.indices], className: here.className }
  // Only if the indices really land on the same kind of holon there.
  let node: Holon | undefined = topRoots[sel.root]
  for (const i of sel.indices) node = node?.parts[i]
  return { scene: sceneKey, sel: node && classNameOf(node) === sel.className ? sel : there }
}
