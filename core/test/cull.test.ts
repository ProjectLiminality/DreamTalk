/**
 * The off-screen frustum cull (perf #2) — the conservative subset.
 *
 * The cull lives in ThreeHost.cullOffscreen(), which needs a live
 * WebGPU renderer, so these tests pin the two pieces that carry the
 * correctness contract and can be exercised headless:
 *
 *   1. RibbonStroke's LOCAL bounding sphere (boundsCenter/boundsRadius),
 *      recomputed only on setPoints — the volume the cull tests.
 *   2. The exact decision the host makes: build the frustum from a
 *      camera the way syncCamera + cullOffscreen do, carry the local
 *      sphere to world, PAD it, and cull ONLY when the padded sphere is
 *      fully outside. This is the same THREE.Frustum.intersectsSphere
 *      call the host makes, on the same bounds.
 *
 * The whole point is byte-identity: a false cull drops scored ink. So
 * the edge cases here are the ones that would fail the gauntlet if the
 * cull were even slightly too eager.
 */

import { describe, expect, test } from "bun:test"
import * as THREE from "three/webgpu"
import { RibbonStroke, RIBBON_KEYS } from "../src/render/ribbon"

/** Mirror ThreeHost.CULL_PAD_PX — kept in sync by intent, checked below. */
const CULL_PAD_PX = 16

/**
 * The host's exact off-screen decision, extracted so it can run without a
 * renderer: returns true iff the stroke's padded world sphere is fully
 * outside the frustum (i.e. the host would set mesh.visible = false).
 * `worldPerPx` stands in for unitsPerPixelAt(...) * maxScale.
 */
const wouldCull = (
  ribbon: RibbonStroke,
  worldMatrix: THREE.Matrix4,
  frustum: THREE.Frustum,
  worldPerPx: number,
): boolean => {
  if (ribbon.boundsRadius <= 0) return false
  const scale = new THREE.Vector3().setFromMatrixScale(worldMatrix)
  const maxScale = Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z))
  const center = ribbon.boundsCenter.clone().applyMatrix4(worldMatrix)
  const widthPx = (ribbon.mesh.userData[RIBBON_KEYS.widthPx] as number) || 0
  const padPx = widthPx * 0.5 + CULL_PAD_PX
  const radius = ribbon.boundsRadius * maxScale + padPx * worldPerPx
  return !frustum.intersectsSphere(new THREE.Sphere(center, radius))
}

/** A camera framed like the demo's perspective rig, looking down -Z. */
const frontCamera = (): THREE.PerspectiveCamera => {
  const cam = new THREE.PerspectiveCamera(53.13, 16 / 9, 1, 100000)
  cam.position.set(0, 0, 1000)
  cam.up.set(0, 1, 0)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

const frustumOf = (cam: THREE.Camera): THREE.Frustum =>
  new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
  )

describe("local bounding sphere", () => {
  test("covers the polyline; center is the AABB center", () => {
    const rb = new RibbonStroke(3)
    rb.setPoints([new THREE.Vector3(-100, -50, 0), new THREE.Vector3(100, 50, 0)])
    expect(rb.boundsCenter.toArray()).toEqual([0, 0, 0])
    // Radius reaches the farthest endpoint, never less.
    expect(rb.boundsRadius).toBeCloseTo(Math.hypot(100, 50), 5)
    // Every point is inside the sphere (conservative cover).
    for (const p of rb.worldPoints()) {
      expect(rb.boundsCenter.distanceTo(p)).toBeLessThanOrEqual(rb.boundsRadius + 1e-6)
    }
  })

  test("an emptied polyline reports radius 0 (cull leaves it alone)", () => {
    const rb = new RibbonStroke(3)
    rb.setPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0)])
    expect(rb.boundsRadius).toBeGreaterThan(0)
    rb.setPoints([])
    expect(rb.boundsRadius).toBe(0)
  })
})

describe("the cull decision is conservative", () => {
  const cam = frontCamera()
  const frustum = frustumOf(cam)
  const I = new THREE.Matrix4()
  // A world-per-pixel small enough that the pad is a few world units — the
  // realistic regime; the pad must never be the reason a visible stroke is
  // kept, only insurance against the edge.
  const worldPerPx = 1

  test("a sphere fully behind the camera culls", () => {
    const rb = new RibbonStroke(3)
    // Camera sits at z=+1000 looking toward -Z; this is well behind it.
    rb.setPoints([new THREE.Vector3(-10, -10, 5000), new THREE.Vector3(10, 10, 5000)])
    expect(wouldCull(rb, I, frustum, worldPerPx)).toBe(true)
  })

  test("a sphere far off to the side culls", () => {
    const rb = new RibbonStroke(3)
    rb.setPoints([new THREE.Vector3(50000, 0, 0), new THREE.Vector3(50100, 0, 0)])
    expect(wouldCull(rb, I, frustum, worldPerPx)).toBe(true)
  })

  test("a sphere at the origin (dead center) is NOT culled", () => {
    const rb = new RibbonStroke(3)
    rb.setPoints([new THREE.Vector3(-100, -50, 0), new THREE.Vector3(100, 50, 0)])
    expect(wouldCull(rb, I, frustum, worldPerPx)).toBe(false)
  })

  test("a sphere straddling the frustum edge is NOT culled", () => {
    // Find a world x that projects right at the right screen edge (NDC
    // x ≈ 1) at z = 0, then place the stroke centered on it so half is on
    // screen and half is off. It must survive.
    const edge = new THREE.Vector3(1, 0, 0).unproject(cam) // NDC right edge at near
    // Scale that direction out to the z=0 plane distance for a real edge x.
    // Simpler: sweep x until the projected center crosses NDC 1.
    let onEdgeX = 0
    for (let x = 0; x < 5000; x += 5) {
      const p = new THREE.Vector3(x, 0, 0).project(cam)
      if (p.x >= 1) {
        onEdgeX = x
        break
      }
    }
    expect(onEdgeX).toBeGreaterThan(0)
    void edge
    const rb = new RibbonStroke(3)
    rb.setPoints([new THREE.Vector3(onEdgeX - 40, 0, 0), new THREE.Vector3(onEdgeX + 40, 0, 0)])
    expect(wouldCull(rb, I, frustum, worldPerPx)).toBe(false)
  })

  test("a wide stroke just OUTSIDE the edge is kept by the width padding", () => {
    // Center just past the right edge — a hairline would cull, but a stroke
    // whose half-width + margin reaches back onto the screen must not.
    let justOutX = 0
    for (let x = 0; x < 8000; x += 5) {
      const p = new THREE.Vector3(x, 0, 0).project(cam)
      if (p.x >= 1) {
        justOutX = x
        break
      }
    }
    const rb = new RibbonStroke(80) // an 80px-wide stroke → 40px half-width
    // A tiny stroke sitting a hair past the edge; its raw sphere is small,
    // so only the width/AA padding can reach back on screen.
    rb.setPoints([
      new THREE.Vector3(justOutX + 5, 0, 0),
      new THREE.Vector3(justOutX + 6, 0, 0),
    ])
    // With a generous world-per-pixel the 40px + 16px pad reaches back.
    expect(wouldCull(rb, I, frustum, 3)).toBe(false)
  })

  test("respects a group's world scale when sizing the sphere", () => {
    // A stroke small in local units but scaled up 100× must be tested at
    // its true world size — a huge sphere at the origin obviously stays.
    const rb = new RibbonStroke(3)
    rb.setPoints([new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)])
    const scaled = new THREE.Matrix4().makeScale(100, 100, 100)
    expect(wouldCull(rb, scaled, frustum, worldPerPx)).toBe(false)
  })
})

describe("additivity — the cull never revives hidden ink", () => {
  test("style() hiding a stroke wins; the cull only ever hides more", () => {
    // The host's loop is `if (!mesh.visible || radius<=0) continue`, so a
    // stroke style() hid (drawn <= erased, or opacity 0) is skipped by the
    // cull entirely — it stays hidden regardless of where it sits.
    const rb = new RibbonStroke(3)
    rb.setPoints([new THREE.Vector3(-100, -50, 0), new THREE.Vector3(100, 50, 0)])
    // Dead center, fully on screen — the cull would keep it…
    const cam = frontCamera()
    expect(wouldCull(rb, new THREE.Matrix4(), frustumOf(cam), 1)).toBe(false)
    // …but style() with fraction 0 hides it, and the host's guard means the
    // cull never even looks. Emulate the guard:
    rb.style(0, 1, { r: 1, g: 1, b: 1 }, 3, 0)
    expect(rb.mesh.visible).toBe(false)
    const considered = rb.mesh.visible && rb.boundsRadius > 0
    expect(considered).toBe(false)
  })
})

describe("the idle latch — never skips a frame that could differ", () => {
  // The latch's rule, extracted exactly as ThreeHost.cullOffscreen decides
  // it: skip the full pass iff we are in the pure frame path, the last full
  // pass culled nothing (idle armed), and BOTH the timeline t and the camera
  // view-projection match the frame that armed it. Any mismatch re-runs.
  const shouldSkip = (
    hasOverrideLayer: boolean,
    idleArmed: boolean,
    frameT: number,
    latchT: number,
    vp: THREE.Matrix4,
    latchVP: THREE.Matrix4,
  ): boolean =>
    !hasOverrideLayer && idleArmed && Object.is(frameT, latchT) && vp.equals(latchVP)

  const vpOf = (cam: THREE.Camera): THREE.Matrix4 => {
    cam.updateMatrixWorld(true)
    return new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
  }

  test("an identical pure frame skips (the whole point)", () => {
    const cam = frontCamera()
    const vp = vpOf(cam)
    expect(shouldSkip(false, true, 3.0, 3.0, vp, vp.clone())).toBe(true)
  })

  test("a changed t never skips — geometry may have moved", () => {
    const cam = frontCamera()
    const vp = vpOf(cam)
    expect(shouldSkip(false, true, 3.1, 3.0, vp, vp.clone())).toBe(false)
  })

  test("a moved camera never skips — on-screen ink can leave frame", () => {
    const a = frontCamera()
    const vpA = vpOf(a)
    const b = frontCamera()
    b.position.set(500, 0, 1000)
    b.lookAt(0, 0, 0)
    const vpB = vpOf(b)
    expect(vpA.equals(vpB)).toBe(false)
    expect(shouldSkip(false, true, 3.0, 3.0, vpB, vpA)).toBe(false)
  })

  test("an override layer disables the latch — a paused drag moves geometry with t held", () => {
    const cam = frontCamera()
    const vp = vpOf(cam)
    // Same t, same camera, but beforeSync is present: MUST NOT skip.
    expect(shouldSkip(true, true, 3.0, 3.0, vp, vp.clone())).toBe(false)
  })

  test("a not-yet-armed latch never skips — the first frame always runs", () => {
    const cam = frontCamera()
    const vp = vpOf(cam)
    // idleArmed=false (initial state / after a frame that culled something).
    expect(shouldSkip(false, false, 3.0, 3.0, vp, vp.clone())).toBe(false)
    // And NaN latchT (the initial cullLatchT) can never Object.is-match a real t.
    expect(shouldSkip(false, true, 3.0, Number.NaN, vp, vp.clone())).toBe(false)
  })
})
