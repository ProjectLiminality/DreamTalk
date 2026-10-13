/**
 * Recede — a 3D holon set ON a flat page: the same picture, pushed back
 * along the eye's rays until it lies wholly behind the page, so the page's
 * flat ink composites with it in attach order.
 *
 * WHY. A 3D sphere centred on the page plane (z = 0) cuts the page in
 * half: its near half stands in front of every flat line drawn inside its
 * disc, and its solid occluder hides them. That is physically right and
 * compositionally wrong for a 2D picture — a seam drawn over a globe, an
 * eye ring over the Earth in a symbol, a flower of life BEHIND a globe and
 * rays in front of it. A flat globe was a layer; a 3D one is an object.
 *
 * HOW. Perspective is invariant to scaling about the eye: a holon scaled
 * by k about the eye projects to exactly the same pixels. So Recede scales
 * its contents about the eye until their nearest point is behind the page
 * plane through its origin — same image, every depth behind the page.
 * Whatever the scene attaches AFTER it then draws over it, and its solids
 * (Surface `composite: "inOrder"`, set here) cover whatever was attached
 * BEFORE it, at their place in attach order. Inside, the 3D object still
 * occludes itself by depth (the Earth's far side stays hidden).
 *
 * `reach` is how far the contents extend from this holon's origin (a
 * globe's radius × scale). With `fit` (the default) the contents are also
 * shrunk so a sphere of radius `reach` has a silhouette of radius `reach`
 * ON THE PAGE — the disc a flat, orthographic globe of that radius drew —
 * rather than the slightly larger one perspective gives.
 *
 * It needs the eye: `seenFrom(observer)` (forwarded to every member that
 * has its own, e.g. the Earth). Untold, it assumes the default observer.
 * The transform is a pure function of the eye, its own placement and
 * `reach`, so it scrubs both ways and follows a moving camera.
 */

import { Group, Null, type Vec3Like } from "./primitives"
import { bool, derive, length } from "../params"
import type { Holon, Overrides } from "../holon"
import type { Observer } from "../dream"
import { Surface } from "./surface"
import { toLocal, viewOf, type View } from "../geometry/frames"


/** A default Observer's view (dream.ts): perspective, 1500 out on +z. */
const DEFAULT_VIEW: View = { eye: { x: 0, y: 0, z: 1500 } }
/** Push a little past "just behind the page", for content off the view axis. */
const MARGIN = 1.1

export class Recede extends Null {
  /** The holons set on the page — adopted at construction (the Group pattern). */
  members: Holon[] = []
  /** How far the contents reach from this holon's origin, local units. */
  reach = length(0)
  /** Shrink so a ball of radius `reach` shows a silhouette of radius `reach`. */
  fit = bool(true)

  /** The pushed-back frame the members live in. */
  readonly inner: Group
  private observer?: Observer

  constructor(overrides: Overrides = {}) {
    super(overrides)
    const pose = () => this.pose()
    this.inner = new Group({
      members: this.members,
      x: derive(() => pose().x),
      y: derive(() => pose().y),
      z: derive(() => pose().z),
      scale: derive(() => pose().scale),
    })
    this.add(this.inner)
  }

  /** Tell it (and every member that listens) where the eye is. */
  seenFrom(observer: Observer): void {
    this.observer = observer
    for (const m of this.members) (m as { seenFrom?: (o: Observer) => void }).seenFrom?.(observer)
  }

  protected override compose(): void {
    // Every solid inside composites in attach order (see the header).
    const walk = (h: Holon): void => {
      if (h instanceof Surface) h.composite = "inOrder"
      for (const p of h.parts) walk(p)
    }
    walk(this.inner)
  }

  /**
   * Where a point of the members' frame shows ON THE PAGE: the plane z = 0
   * of this holon, where the eye's ray through the point crosses it. Ink
   * placed there sits exactly over that point of the receded picture.
   */
  toPage(c: Vec3Like): Vec3Like {
    const view = this.observer ? viewOf(this.observer) : DEFAULT_VIEW
    const q = this.pose()
    const p = { x: q.x + q.scale * c.x, y: q.y + q.scale * c.y, z: q.z + q.scale * c.z }
    if (!("eye" in view)) {
      const o = toLocal(this, { x: 0, y: 0, z: 0 })
      const t = toLocal(this, view.toward)
      const d = { x: t.x - o.x, y: t.y - o.y, z: t.z - o.z }
      const u = Math.abs(d.z) > 1e-9 ? -p.z / d.z : 0
      return { x: p.x + d.x * u, y: p.y + d.y * u, z: 0 }
    }
    const eye = toLocal(this, view.eye)
    const u = Math.abs(eye.z - p.z) > 1e-9 ? eye.z / (eye.z - p.z) : 1
    return { x: eye.x + (p.x - eye.x) * u, y: eye.y + (p.y - eye.y) * u, z: 0 }
  }

  /**
   * The eye in the members' frame — before the push, so a sphere of radius
   * R about the members' origin hides a point c exactly when c·eye ≤ R².
   * (Orthographic: a far point along the view direction.)
   */
  eyeOfMembers(): Vec3Like {
    const view = this.observer ? viewOf(this.observer) : DEFAULT_VIEW
    const q = this.pose()
    const at = (w: Vec3Like): Vec3Like => {
      const l = toLocal(this, w)
      return { x: (l.x - q.x) / q.scale, y: (l.y - q.y) / q.scale, z: (l.z - q.z) / q.scale }
    }
    if ("eye" in view) return at(view.eye)
    const o = at({ x: 0, y: 0, z: 0 })
    const t = at(view.toward)
    return { x: (t.x - o.x) * 1e6, y: (t.y - o.y) * 1e6, z: (t.z - o.z) * 1e6 }
  }

  /** The inner frame's placement this frame, in this holon's local space. */
  private pose(): { x: number; y: number; z: number; scale: number } {
    const view = this.observer ? viewOf(this.observer) : DEFAULT_VIEW
    const e = Math.max(0, this.reach.value)
    if (!("eye" in view)) {
      // Orthographic: no scale changes the picture, so slide it straight back.
      const o = toLocal(this, { x: 0, y: 0, z: 0 })
      const t = toLocal(this, view.toward)
      const d = { x: t.x - o.x, y: t.y - o.y, z: t.z - o.z }
      const n = Math.hypot(d.x, d.y, d.z) || 1
      const back = -e * MARGIN
      return { x: (d.x / n) * back, y: (d.y / n) * back, z: (d.z / n) * back, scale: 1 }
    }
    const eye = toLocal(this, view.eye)
    const L = Math.hypot(eye.x, eye.y, eye.z)
    const s = this.fit.value ? L / Math.hypot(L, e) : 1
    if (L <= s * e) return { x: 0, y: 0, z: 0, scale: s }
    const k = (MARGIN * L) / (L - s * e)
    return { x: (1 - k) * eye.x, y: (1 - k) * eye.y, z: (1 - k) * eye.z, scale: k * s }
  }
}
