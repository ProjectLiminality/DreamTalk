/**
 * Derived curves — strokes whose polylines are COMPUTED from other
 * state: the cylinder–plane section curve (Scenes 03/06) and the
 * Connection bezier arrow between holons (Scene 10).
 *
 * Both emit an ordinary Line part whose `points` are DERIVED. The host's
 * per-frame shape dirty-check compares Line point VALUES (three-host.ts
 * `shapeKey`, which flattens `holon.points`), so once the array reflects
 * the current params the rebuild happens for free. The only question was
 * who recomputes it, and when.
 *
 * Pushing (`refresh()` reassigning `points` after `applyAt`) needs a
 * per-frame host hook, and a host that has none renders each derived
 * curve ONE FRAME STALE: the dirty-check sees the previous frame's
 * mutation, so the shape visibly lags the parameters that produced it.
 * Verified, not assumed — a sweeping `tilt` drew the previous tilt's
 * curve at every sampled t.
 *
 * So these classes PULL instead. `points` is an accessor over a memo
 * keyed on the inputs the polyline depends on (`sourceKey()`); the host's
 * own read in `shapeKey` triggers the recompute, one per frame per curve
 * regardless of how many times the frame reads the array. That keeps the
 * live case correct with NO host change, and leaves `shapeKey`'s
 * value-comparison as the single source of truth about what changed.
 *
 * `refresh()` remains public for callers that want the polyline outside
 * a render pass (tests, exporters, `section` inspection).
 */

import { Holon, type Overrides } from "../holon"
import { angle, completion, length, scalar } from "../params"
import { PI } from "../constants"
import { Stroke, Line, type Vec3Like } from "./primitives"
import { cylinderPlaneSection, type Section } from "../geometry/section"

/**
 * Install a pull-based `points` accessor on a Line: `compute` runs only
 * when `sourceKey` changes, and the memo is what every reader sees. The
 * returned array identity is stable across unchanged frames, so the
 * host's value-comparison dirty-check stays cheap and honest.
 */
const derivePoints = (
  line: Line,
  sourceKey: () => readonly number[],
  compute: () => Vec3Like[],
): void => {
  let key: readonly number[] | undefined
  let memo: Vec3Like[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get(): Vec3Like[] {
      const next = sourceKey()
      if (!key || key.length !== next.length || next.some((v, i) => v !== key![i])) {
        key = next
        memo = compute()
      }
      return memo
    },
    // The host never writes points, but a Line's field initializer does
    // (`points: Vec3Like[] = []`) — accept and discard so construction
    // order can't clobber the accessor.
    set(_v: Vec3Like[]) {},
  })
}

// --- Pure helpers -----------------------------------------------------------

/**
 * Rotate by the standard h/p/b triple, in C4D's own composition order.
 *
 * h/p/b ARE C4D's HPB, and C4D composes them M = R_H · R_P · R_B about
 * its own axes. Under the fixed axis dictionary (X, Y, Z)c4d → (x, z, y),
 * legacy H turns about our z, legacy P about our x, legacy B about our y,
 * so the same composition reads Rz(b) · Rx(p) · Ry(h) in our frame —
 * three's 'ZXY' Euler order, which is what the host sets.
 */
export const rotHPB = (v: Vec3Like, p: number, h: number, b: number): Vec3Like => {
  let { x, y, z } = v
  // Ry(h) — innermost.
  let t = x * Math.cos(h) + z * Math.sin(h)
  z = -x * Math.sin(h) + z * Math.cos(h)
  x = t
  // Rx(p)
  t = y * Math.cos(p) - z * Math.sin(p)
  z = y * Math.sin(p) + z * Math.cos(p)
  y = t
  // Rz(b) — outermost.
  t = x * Math.cos(b) - y * Math.sin(b)
  y = x * Math.sin(b) + y * Math.cos(b)
  x = t
  return { x, y, z }
}

/** The inverse of rotHPB: Ry(-h)·Rx(-p)·Rz(-b), applied in that order. */
export const invRotHPB = (v: Vec3Like, p: number, h: number, b: number): Vec3Like => {
  let { x, y, z } = v
  // Rz(-b)
  let t = x * Math.cos(-b) - y * Math.sin(-b)
  y = x * Math.sin(-b) + y * Math.cos(-b)
  x = t
  // Rx(-p)
  t = y * Math.cos(-p) - z * Math.sin(-p)
  z = y * Math.sin(-p) + z * Math.cos(-p)
  y = t
  // Ry(-h)
  t = x * Math.cos(-h) + z * Math.sin(-h)
  z = -x * Math.sin(-h) + z * Math.cos(-h)
  x = t
  return { x, y, z }
}

/**
 * A holon's origin in world space — its local position pushed up through
 * every ancestor's scale → rotation → translation (the host's transform
 * order). Pure walk over the standard params; no three involved.
 */
export const worldPosition = (holon: Holon): Vec3Like => {
  let pos: Vec3Like = { x: holon.x.value, y: holon.y.value, z: holon.z.value }
  for (let node = holon.parent; node; node = node.parent) {
    const s = node.scale.value
    pos = rotHPB({ x: pos.x * s, y: pos.y * s, z: pos.z * s }, node.p.value, node.h.value, node.b.value)
    pos = { x: pos.x + node.x.value, y: pos.y + node.y.value, z: pos.z + node.z.value }
  }
  return pos
}

/**
 * A smooth interpolating spline THROUGH the anchor points, sampled to a
 * polyline — the shape a C4D MoGraph Tracer in bezier mode draws through
 * its traced objects (pydeation's Connection, mograph.py:97). Uniform
 * Catmull-Rom with clamped ends; each of the n−1 segments is a cubic.
 */
export const catmullRom = (anchors: readonly Vec3Like[], samplesPerSegment = 24): Vec3Like[] => {
  if (anchors.length < 2) return [...anchors]
  const pts: Vec3Like[] = []
  const P = (i: number): Vec3Like => anchors[Math.min(anchors.length - 1, Math.max(0, i))]!
  for (let seg = 0; seg < anchors.length - 1; seg++) {
    const p0 = P(seg - 1)
    const p1 = P(seg)
    const p2 = P(seg + 1)
    const p3 = P(seg + 2)
    const last = seg === anchors.length - 2
    const end = last ? samplesPerSegment : samplesPerSegment - 1
    for (let i = 0; i <= end; i++) {
      const t = i / samplesPerSegment
      const t2 = t * t
      const t3 = t2 * t
      const co = (a: number, b: number, c: number, d: number): number =>
        0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - 3 * c + d - a) * t3)
      pts.push({
        x: co(p0.x, p1.x, p2.x, p3.x),
        y: co(p0.y, p1.y, p2.y, p3.y),
        z: co(p0.z, p1.z, p2.z, p3.z),
      })
    }
  }
  return pts
}

/**
 * Trim a polyline to the [startFrac, 1 − endFrac] window of its total
 * arc length — Sketch & Toon's stroke-offset trim (OUTLINEMAT_ADJUSTMENT_
 * STROKESTART/END), which is how pydeation's Connection keeps its arrow
 * clear of the shapes it links.
 */
export const trimByArcLength = (
  points: readonly Vec3Like[],
  startFrac: number,
  endFrac: number,
): Vec3Like[] => {
  if (points.length < 2) return [...points]
  const lens: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    lens.push(lens[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z))
  }
  const total = lens[lens.length - 1]!
  if (!(total > 0)) return [...points]
  const s0 = Math.max(0, Math.min(1, startFrac)) * total
  const s1 = (1 - Math.max(0, Math.min(1, endFrac))) * total
  if (!(s1 > s0)) return []
  const pointAt = (s: number): Vec3Like => {
    let i = 1
    while (i < lens.length - 1 && lens[i]! < s) i++
    const a = points[i - 1]!
    const b = points[i]!
    const seg = lens[i]! - lens[i - 1]!
    const t = seg > 0 ? (s - lens[i - 1]!) / seg : 0
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
  }
  const out: Vec3Like[] = [pointAt(s0)]
  for (let i = 0; i < points.length; i++) {
    if (lens[i]! > s0 && lens[i]! < s1) out.push(points[i]!)
  }
  out.push(pointAt(s1))
  return out
}

/** Right-handed elementary rotations — about +y, +x and +z respectively. */
const yaw = (v: Vec3Like, a: number): Vec3Like => ({
  x: v.x * Math.cos(a) + v.z * Math.sin(a),
  y: v.y,
  z: -v.x * Math.sin(a) + v.z * Math.cos(a),
})
const pitch = (v: Vec3Like, a: number): Vec3Like => ({
  x: v.x,
  y: v.y * Math.cos(a) - v.z * Math.sin(a),
  z: v.y * Math.sin(a) + v.z * Math.cos(a),
})
const roll = (v: Vec3Like, a: number): Vec3Like => ({
  x: v.x * Math.cos(a) - v.y * Math.sin(a),
  y: v.x * Math.sin(a) + v.y * Math.cos(a),
  z: v.z,
})

// --- SectionPlane -----------------------------------------------------------

/**
 * A cutting plane as a holon in its own right — pydeation's `Plane`
 * (object.py:938) in the one role video-01 gives it: the invisible
 * partner an `intersects_with` cylinder is cut by.
 *
 * It is a locator, not a stroke: nothing of it renders. What it carries
 * is the pair a section needs — a world POINT and a world NORMAL —
 * derived from its own transform, so a scene animates the plane the way
 * the source does (`Transform(plane, h=2*PI, x=200)`) and the section
 * follows for free.
 *
 * **The frozen bank.** C4D's *frozen* rotation is not another rotation
 * in the same stack: it is a private parent frame. The object's own
 * position and rotation are expressed INSIDE it, so a frozen bank swings
 * both — an object at x = 100 with a frozen bank of PI/4 sits on the
 * diagonal, not on the axis. Scene03 depends on exactly that: its plane
 * is `Plane(b=PI/2, b_frozen=PI/4, scale=2, x=1)` and travels to x=201,
 * and it is the frozen frame that keeps the cut passing through the
 * cylinder's axis at the half-turn. Modelling the bank as an ordinary
 * rotation puts the cut ~31 units off-axis there — visibly the wrong
 * curve against refs/video-01/frames5/f0391.
 *
 * Angles are the legacy HPB triple (h about the top-view vertical, p, b),
 * because that is what the 2021 sources state; the class maps them into
 * our frame itself.
 */
export class SectionPlane extends Holon {
  /** C4D's frozen bank — the private parent frame (see the class note). */
  frozenB = angle(0)

  /**
   * The plane's unit normal in world space.
   *
   * The local normal of a C4D plane primitive is its own +Y, which under
   * the fixed axis dictionary (X, Y, Z)c4d → (x, z, y) is our +z. The
   * legacy triple then turns it, composed C4D's way (M = R_H · R_P · R_B),
   * with legacy H about our z, P about our x and B about our y — and each
   * at the SAME numeric angle, because the dictionary is a reflection and
   * C4D is left-handed, and those two sign flips cancel.
   *
   * The frozen bank then frames the result — the same rotation, applied
   * outermost, to the normal and (below) to the position alike.
   *
   * Calibrated against the S03 sweep, which exercises the whole family in
   * one shot: f0388/f0394 come out as the flat circle, f0391 as the
   * two-generator cut straight through the axis, f0386/f0396 as the low
   * truncated arcs, and the tilted ellipses in between lean and open the
   * way the reference does. The mirrored heading and the mirrored bank
   * were both tried against those frames: each keeps the two circle
   * moments and the two-generator moment (they are symmetric) but pinches
   * the mid-sweep ellipses narrow — visible as a ~0.85 coverage ceiling
   * on f0390/f0392 that no timing shift can lift.
   */
  get normal(): Vec3Like {
    let n: Vec3Like = { x: 0, y: 0, z: 1 }
    n = yaw(n, this.b.value)
    n = pitch(n, this.p.value)
    n = roll(n, this.h.value)
    return yaw(n, this.frozenB.value)
  }

  /**
   * The plane's origin in world space — its own position, carried out of
   * the frozen frame the same way the normal is. This is what puts a
   * plane at x = 100 with a PI/4 bank on the diagonal rather than the
   * axis, and it is the whole reason S03's cut passes through the
   * cylinder's own axis at the half-turn.
   */
  get origin(): Vec3Like {
    return yaw({ x: this.x.value, y: this.y.value, z: this.z.value }, this.frozenB.value)
  }
}

// --- SectionCurve -----------------------------------------------------------

/**
 * The cylinder–plane section curve as a stroke holon — the DreamTalk
 * replacement for pydeation's `intersects_with` (S&T line intersection).
 *
 * The plane is parameterized the way the scenes use it, in cylinder-local
 * space: `tilt` is the angle between the plane's NORMAL and the cylinder
 * axis (0 → cap-parallel cut → circle; π/2 → axis-parallel cut → the
 * S06 rectangle; in between → ellipse, truncated by the caps when steep),
 * `spin` rotates the cut around the axis (S03's h-sweep of the plane),
 * `offset` is the plane's signed distance from the cylinder center along
 * its normal (S03's traveling plane; S06's z=1).
 *
 * Place it at the same transform as the Cylinder it cuts, with matching
 * radius/height (a sibling part bound to the same params). When
 * parts/index.ts opens up this consolidates into `Cylinder.sectionPlane`
 * per the vocabulary report (§2.4).
 */
export class SectionCurve extends Stroke {
  radius = length(50)
  height = length(200)
  tilt = angle(PI / 4)
  spin = angle(0)
  offset = scalar(0)
  /**
   * Which frame `tilt`/`spin`/`offset` describe the plane in.
   *
   * "local" (the default) is the S03 reading: the plane is stated
   * relative to the cylinder, so a spinning `spin` sweeps the cut around
   * a cylinder that itself holds still.
   *
   * "parent" is the S06 reading, and the one pydeation's
   * `intersects_with=[plane]` actually means: the Plane is a SEPARATE
   * object standing still in the scene while the cylinder TURNS THROUGH
   * it. Stating the plane in the parent frame and inverse-rotating it by
   * the holon's own h/p/b is what makes the section morph
   * rectangle → ellipse → circle → ellipse → rectangle for free as `p`
   * animates — one animated parameter (the pose), no hand-computed
   * relationship between pose and cut.
   *
   * Only the ROTATION is undone: the holon's own scale is uniform (it
   * scales radius/height and the plane's distance together), and its
   * translation is the cylinder's own, so a plane through the scene
   * origin at offset 0 stays through the cylinder's centre — exactly
   * S06, whose plane sits one unit off the origin the cylinder is at.
   */
  planeFrame: "local" | "parent" = "local"

  /**
   * Cut by an actual SectionPlane holon instead of by tilt/spin/offset.
   *
   * This is pydeation's `intersects_with=[plane]` said literally: the
   * plane is a separate object in the scene, and the section is whatever
   * falls out of the two objects' transforms. Scene03 needs it —
   * its plane both spins and travels, through a frozen frame that no
   * tilt/spin/offset triple states without the scene doing trigonometry
   * of its own (which the gardening rule sends here, not there).
   *
   * The plane is read in WORLD space and brought into this holon's local
   * frame (which is the cylinder's), so both objects may move. It lives
   * inside a plain object so the holon field scan does not mistake the
   * reference for a part and reparent the plane (the same guard
   * Connection uses for its anchors).
   */
  private cutter: { plane?: SectionPlane } = {}

  /** Cut by an actual plane object — see the note on `cutter`. */
  cutBy(plane: SectionPlane): this {
    this.cutter.plane = plane
    return this
  }

  line: Line = new Line({ tint: this.tint, stroke: this.stroke })

  /**
   * The last computed section — its `kind` tells callers which of the
   * S03/S06 cases the current plane produces. Populated by `refresh()`,
   * which the `points` accessor drives; read `line.points` first if you
   * need it up to date outside a render pass.
   */
  section?: Section

  protected override compose(): void {
    derivePoints(
      this.line,
      () => {
        const cutter = this.cutter.plane
        if (cutter) {
          // The plane object's own state IS the input, plus wherever the
          // cylinder itself has got to.
          const n = cutter.normal
          const o = cutter.origin
          const c = worldPosition(this)
          return [this.radius.value, this.height.value, n.x, n.y, n.z, o.x, o.y, o.z, c.x, c.y, c.z]
        }
        return [
          this.radius.value,
          this.height.value,
          this.tilt.value,
          this.spin.value,
          this.offset.value,
          // In the parent frame the pose IS an input to the cut.
          this.planeFrame === "parent" ? this.p.value : 0,
          this.planeFrame === "parent" ? this.h.value : 0,
          this.planeFrame === "parent" ? this.b.value : 0,
        ]
      },
      () => this.refresh(),
    )
  }

  /** Recompute the polyline from current param values (fresh array). */
  refresh(): Vec3Like[] {
    const cutter = this.cutter.plane
    if (cutter) {
      // Both objects in world space; the cut is stated relative to this
      // holon's own origin, which is where the cylinder geometry sits.
      const n = cutter.normal
      const o = cutter.origin
      const c = worldPosition(this)
      const planePoint: Vec3Like = { x: o.x - c.x, y: o.y - c.y, z: o.z - c.z }
      this.section = cylinderPlaneSection(this.radius.value, this.height.value, planePoint, n)
      return this.section.points
    }
    const tilt = this.tilt.value
    const spin = this.spin.value
    let normal: Vec3Like = {
      x: Math.sin(tilt) * Math.cos(spin),
      y: Math.cos(tilt),
      z: Math.sin(tilt) * Math.sin(spin),
    }
    if (this.planeFrame === "parent") {
      // Undo the holon's own rotation: R = Rz(b)·Rx(p)·Ry(h) (the host's
      // ZXY Euler order), so the inverse is Ry(-h)·Rx(-p)·Rz(-b) — which
      // rotHPB spells by negating every angle and reading it backwards.
      normal = invRotHPB(normal, this.p.value, this.h.value, this.b.value)
    }
    const off = this.offset.value
    const planePoint: Vec3Like = { x: normal.x * off, y: normal.y * off, z: normal.z * off }
    this.section = cylinderPlaneSection(this.radius.value, this.height.value, planePoint, normal)
    return this.section.points
  }
}

// --- Connection -------------------------------------------------------------

/**
 * A bezier arrow between two holons — pydeation's Connection
 * (mograph.py:97): a Tracer spline drawn THROUGH [source, …waypoints,
 * target] in bezier mode, arrowhead at the end, and the stroke trimmed
 * by arc length (`offsetStart` from the source, `offsetEnd` short of the
 * target) so the arrow floats clear of both shapes. S10:
 * `Connection(rectangle, (20,0,-50), (0,0,-30), cylinder,
 * offset_start=0.15, offset_end=0.2)`.
 *
 * `via` waypoints are absolute positions (the source made them nulls in
 * the scene), and endpoints are the anchors' CURRENT world positions —
 * keep the Connection itself at the identity transform so its local
 * space IS world space. Endpoints are pulled from the anchors every time
 * the polyline is read, so a Connection tracks holons that MOVE (the arrow
 * follows) as well as S10's static case, with no host change either way.
 */
export class Connection extends Stroke {
  /** Absolute intermediate waypoints, in order from source to target. */
  via: Vec3Like[] = []
  offsetStart = completion(0.1)
  offsetEnd = completion(0.1)

  line: Line = new Line({ tint: this.tint, stroke: this.stroke, arrowEnd: true })

  // Anchor refs live inside a plain object so the holon field scan
  // doesn't mistake them for parts (which would reparent them).
  private anchors!: { source: Holon; target: Holon }

  constructor(source: Holon, target: Holon, overrides: Overrides = {}) {
    super(overrides)
    this.anchors = { source, target }
  }

  protected override compose(): void {
    derivePoints(
      this.line,
      () => {
        // The anchors' world positions ARE the input — recompute when
        // either endpoint moves (live mode), not just at construction.
        const a = worldPosition(this.anchors.source)
        const b = worldPosition(this.anchors.target)
        return [a.x, a.y, a.z, b.x, b.y, b.z, this.offsetStart.value, this.offsetEnd.value]
      },
      () => this.refresh(),
    )
  }

  /** Recompute the polyline from the anchors' current world positions. */
  refresh(): Vec3Like[] {
    const anchors = [
      worldPosition(this.anchors.source),
      ...this.via,
      worldPosition(this.anchors.target),
    ]
    return trimByArcLength(catmullRom(anchors), this.offsetStart.value, this.offsetEnd.value)
  }
}
