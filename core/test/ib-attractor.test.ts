import { describe, expect, test } from "bun:test"
import { ATTRACTOR, Attractor, pathologyAt } from "../vocabulary/Attractor/Attractor"
import { DIALECTIC, Dialectic, pullsAt, thirdAt } from "../vocabulary/Attractor/Dialectic"
import { Circle, Square } from "../src/parts/primitives"
import { PI } from "../src/constants"

/** Walking a holon composes it. */
const built = <T extends { walk(): Iterable<unknown> }>(h: T): T => (void [...h.walk()], h)

describe("Attractor — one pole, sober or fragmented", () => {
  test("chaos is freedom's red circle; oppression is order's square, which circumscribes the circle (side 2R)", () => {
    const f = built(new Attractor({ kind: "chaos", size: 100 }))
    const o = built(new Attractor({ kind: "oppression", size: 100 }))
    expect(f.shape).toBeInstanceOf(Circle)
    expect((f.shape as Circle).radius.value).toBe(100)
    expect(o.shape).toBeInstanceOf(Square)
    expect((o.shape as Square).size.value).toBe(2 * (f.shape as Circle).radius.value)
    expect(f.valueText.content).toBe("freedom")
    expect(f.pathologyText.content).toBe("Chaos")
    expect(o.valueText.content).toBe("order")
    expect(o.pathologyText.content).toBe("Oppression")
  })

  test("pathology 0 is the value, 1 the pathology: labels cross, the bolts strike in and fly out", () => {
    const a = built(new Attractor({ size: 100 }))
    expect(a.valueLayer.presence.value).toBe(1)
    expect(a.pathologyLayer.presence.value).toBe(0)
    expect(a.bolts.creation.value).toBe(0)
    expect(a.bolts.spread.value).toBe(0)
    a.pathology.value = 1
    expect(a.valueLayer.presence.value).toBe(0)
    expect(a.pathologyLayer.presence.value).toBe(1)
    expect(a.bolts.creation.value).toBe(1)
    expect(a.bolts.spread.value).toBe(1)
    // The readings never run backwards as the pathology grows.
    let prev = pathologyAt(0)
    for (let p = 0.05; p <= 1; p += 0.05) {
      const now = pathologyAt(p)
      expect(now.value).toBeLessThanOrEqual(prev.value + 1e-12)
      expect(now.pathology).toBeGreaterThanOrEqual(prev.pathology - 1e-12)
      prev = now
    }
  })

  test("Chaos's eight bolts radiate on a circle; Oppression's strike in on a square — both in units of R", () => {
    const f = built(new Attractor({ kind: "chaos", size: 200 }))
    const o = built(new Attractor({ kind: "oppression", size: 200 }))
    expect(f.bolts.count.value).toBe(8)
    expect(f.bolts.ring.value).toBe("circle")
    expect(f.bolts.direction.value).toBe(0)
    expect(o.bolts.ring.value).toBe("square")
    expect(o.bolts.direction.value).toBeCloseTo(PI, 12)
    expect(f.bolts.radius.value).toBeCloseTo(ATTRACTOR.ringCircle * 200, 9)
    expect(f.bolts.size.value).toBeCloseTo(ATTRACTOR.bolt * 200, 9)
    // The ring clears the pole: bolt centres sit outside the circle and the square.
    expect(f.bolts.radius.value - f.bolts.size.value / 2).toBeGreaterThan(0.9 * 200)
    expect(o.bolts.radius.value).toBeGreaterThan(200)
  })

  test("armed crossfades the pole into a blue triangle; at rest chaos's apex points up, oppression's down", () => {
    const f = built(new Attractor({ kind: "chaos" }))
    const o = built(new Attractor({ kind: "oppression" }))
    expect(f.shapeLayer.presence.value).toBe(1)
    expect(f.triangleLayer.presence.value).toBe(0)
    f.armed.value = 1
    expect(f.shapeLayer.presence.value).toBe(0)
    expect(f.triangleLayer.presence.value).toBe(1)
    expect(f.triangle.sides.value).toBe(3)
    expect(f.triangle.phase.value).toBeCloseTo(PI / 2, 12)
    expect(o.triangle.phase.value).toBeCloseTo(-PI / 2, 12)
    // The triangle encloses the circle (its inradius exceeds R).
    expect(f.triangle.radius.value / 2).toBeGreaterThan(f.size.value)
  })

  test("walkable: value ↔ pathology", () => {
    const a = new Attractor({ kind: "oppression" })
    const ax = a.stateSpace()!.axes[0]!
    expect(ax.positions.map((p) => p.name)).toEqual(["order", "oppression"])
  })
})

describe("Dialectic — the two poles, the conflict, the oscillation, the third axis", () => {
  test("the poles stand ±span·R, freedom left, order right, sharing R", () => {
    const d = built(new Dialectic({ size: 100, span: 3.5 }))
    expect(d.freedom.x.value).toBeCloseTo(-350, 9)
    expect(d.order.x.value).toBeCloseTo(350, 9)
    expect(d.freedom.size.value).toBe(100)
    expect(d.order.size.value).toBe(100)
    expect(d.freedom.poleKind).toBe("chaos")
    expect(d.order.poleKind).toBe("oppression")
  })

  test("attack turns the bolt and both triangles together (f391 → f405 → f420)", () => {
    const d = built(new Dialectic())
    const apex = (a: Attractor) => a.triangle.phase.value
    d.attack.value = 0
    expect(d.bolt.direction.value).toBeCloseTo(-PI / 2, 12) // down
    expect(Math.cos(apex(d.freedom))).toBeCloseTo(1, 12) // both apexes right
    expect(Math.cos(apex(d.order))).toBeCloseTo(1, 12)
    d.attack.value = 1 // freedom attacks order
    expect(d.bolt.direction.value).toBeCloseTo(0, 12) // the bolt points at order
    expect(Math.sin(apex(d.freedom))).toBeCloseTo(1, 12) // freedom's apex up
    expect(Math.sin(apex(d.order))).toBeCloseTo(-1, 12) // order's down
    d.attack.value = -1 // order attacks freedom
    expect(Math.cos(d.bolt.direction.value)).toBeCloseTo(-1, 12) // at freedom
    expect(Math.sin(apex(d.freedom))).toBeCloseTo(-1, 12)
    expect(Math.sin(apex(d.order))).toBeCloseTo(1, 12)
  })

  test("the promoted pathologies drive the poles; the poles' own are bound (one axis, not two)", () => {
    const d = built(new Dialectic())
    d.chaos.value = 1
    expect(d.freedom.pathology.value).toBe(1)
    expect(d.order.pathology.value).toBe(0)
    expect(d.freedom.stateSpace()).toBeUndefined()
    expect(d.stateSpace()!.axes.map((a) => a.id)).toEqual(["chaos", "oppression", "third"])
    expect(d.stateSpace()!.clocks).toEqual([d.phase])
  })

  test("the ball shuttles: x = A·sin(phase), never past the poles' rims", () => {
    const d = built(new Dialectic({ size: 100, span: 3.5 }))
    const A = DIALECTIC.swing * 350
    for (const ph of [0, 0.7, PI / 2, 2, -PI / 2]) {
      d.phase.value = ph
      expect(d.ballAt().x).toBeCloseTo(A * Math.sin(ph), 9)
      expect(d.ball.x.value).toBeCloseTo(d.ballAt().x, 9)
    }
    expect(A).toBeLessThan(350 - 100)
  })

  test("the closer to one pole, the stronger the pull to the other (2:09)", () => {
    for (const s of [-1, -0.6, 0, 0.4, 1]) {
      const p = pullsAt(s)
      expect(p.order + p.freedom).toBeCloseTo(1, 12)
    }
    expect(pullsAt(-0.6).order).toBeGreaterThan(pullsAt(-0.6).freedom)
    expect(pullsAt(0.6).freedom).toBeGreaterThan(pullsAt(0.6).order)
    const d = built(new Dialectic({ size: 100 }))
    d.phase.value = -PI / 2 // beside freedom
    const len = (l: { points: { x: number }[] }) => Math.abs(l.points[1]!.x - l.points[0]!.x)
    expect(len(d.toOrder)).toBeGreaterThan(len(d.toFreedom))
    expect(d.toOrder.points[1]!.x).toBeLessThanOrEqual(d.order.x.value - 100 + 1e-9) // never into the square
  })

  test("the trace starts at the ball and hangs beneath it, its length growing with the cycle up to its span", () => {
    const d = built(new Dialectic({ size: 100 }))
    d.phase.value = 2
    const pts = d.traceLine.points
    expect(pts[0]!.x).toBeCloseTo(d.ballAt().x, 9)
    expect(pts[0]!.y).toBe(-0)
    const k = (DIALECTIC.tracePeriod * 100) / (2 * PI)
    expect(pts[pts.length - 1]!.y).toBeCloseTo(-2 * k, 9)
    d.phase.value = 40
    const far = d.traceLine.points
    expect(far[far.length - 1]!.y).toBeCloseTo(-DIALECTIC.traceSpan * k, 9)
  })

  test("third: the ball stills, then rises from the line into the cylinder under the liminal eye", () => {
    const d = built(new Dialectic({ size: 100 }))
    d.phase.value = 1
    expect(d.ballAt().y).toBe(0)
    expect(thirdAt(0).cylinder).toBe(0)
    d.third.value = 1
    expect(d.ballAt().x).toBeCloseTo(0, 12)
    expect(d.ballAt().y).toBeCloseTo(d.cylinderLayer.y.value, 9)
    expect(d.cylinderLayer.presence.value).toBe(1)
    // The arrow's tip is the cylinder's foot; the liminal eye stands above it, the gaze below the line.
    expect(DIALECTIC.arrowTip * 100).toBeLessThan(d.cylinderLayer.y.value - d.cylinder.radius.value + 1e-9)
    expect(d.liminal.y.value).toBeGreaterThan(d.cylinderLayer.y.value + d.cylinder.radius.value)
    expect(d.liminal.iris.value).toBe(1)
    expect(d.eye.iris.value).toBe(0)
    expect(d.eye.y.value).toBeLessThan(0)
    // The two eyes are the same eye.
    expect(d.liminal.height.value).toBe(d.eye.height.value)
  })
})
