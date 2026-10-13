/**
 * GlobeDemo — the Earth in the three looks the Web3 video asks of a globe
 * (docs/reports/web3-recon.md, shots 1/3/13/15), side by side and turning.
 * It was the sheet of the flat `Globe` holon's modes; the Earth replaced
 * that holon (2026-10-13) and each look is now a few of its params:
 *
 *   • LEFT  — SHOT 1: a dark grey Earth on black with a thin limb ring.
 *             Dark `land`, coasts off, `limbStroke` set.
 *   • RIGHT — SHOT 13: an outline Earth — white coastlines, no land fill.
 *             `landOpacity: 0`, `coastStroke` 2.5.
 *   • BELOW — SHOT 15, the hero: a bright Earth inside a red flower-of-life
 *             halo with a bold red ring and long white light rays.
 *
 * Each is set on the page (Recede), so the hero's decoration composites
 * around it in attach order, as a flat picture's would.
 *
 * WHAT THE DEMO OWNS, NOT THE HOLON. The halo, the red ring and the rays are
 * DECORATION composed here, not part of the Earth. The halo reuses the
 * existing flower packing (src/geometry/flower.ts hexPack) over a disc mask,
 * which is exactly the flower-of-life the reference draws; the rays and ring
 * are a handful of primitives.
 */

import { Dream } from "../../src/index"
import { Circle, Group, Line } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { Earth } from "../../vocabulary/Earth/Earth"
import { Recede } from "../../src/parts/recede"
import { hexPack } from "../../src/geometry/flower"
import { RED, WHITE, rgb, TAU } from "../../src/constants"

/** A disc of the given radius, as a one-polygon mask for hexPack. */
const disc = (radius: number, segments = 64): { x: number; y: number }[][] => {
  const poly: { x: number; y: number }[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * TAU
    poly.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius })
  }
  return [poly]
}

const HERO_R = 52
const HALO_R = 128

export class GlobeDemoDream extends Dream {
  // LEFT — the dark Earth with a thin ring (shot 1).
  fillEarth = new Earth({
    radius: 105,
    land: rgb(0x3a, 0x3a, 0x3a),
    coastOpacity: 0,
    borderOpacity: 0,
    limbStroke: 1.5,
    limbTint: rgb(0x88, 0x88, 0x88),
    p: 0.18,
  })
  fill = new Recede({ members: [this.fillEarth], reach: 105, x: -270, y: 120 })

  // RIGHT — the outline Earth (shot 13).
  outlineEarth = new Earth({
    radius: 105,
    landOpacity: 0,
    coastStroke: 2.5,
    borderOpacity: 0,
    limbStroke: 1,
    limbTint: rgb(0x44, 0x44, 0x44),
    p: 0.12,
  })
  outline = new Recede({ members: [this.outlineEarth], reach: 105, x: 270, y: 120 })

  // BELOW — the hero Earth (shot 15): small, bright, land-on-black.
  heroEarth = new Earth({ radius: HERO_R, land: WHITE, coastOpacity: 0, borderOpacity: 0, p: 0.1 })
  hero = new Recede({ members: [this.heroEarth], reach: HERO_R })

  // The flower-of-life halo: overlapping circles in a hex packing over a disc.
  private halo = new Group({
    members: hexPack(disc(HALO_R), { spacing: HALO_R / 3 }).map(
      (c) =>
        new Circle({
          radius: HALO_R / 3,
          x: c.x,
          y: c.y,
          tint: rgb(0x8a, 0x3a, 0x30),
          stroke: 1.2,
          opacity: 0.7,
        }),
    ),
  })

  private ring = new Circle({ radius: HALO_R + 6, tint: RED, stroke: 4 })

  private rays = new Group({
    members: Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * TAU
      return new Line({
        points: [
          { x: Math.cos(a) * (HERO_R + 8), y: Math.sin(a) * (HERO_R + 8), z: 0 },
          { x: Math.cos(a) * (HALO_R + 70), y: Math.sin(a) * (HALO_R + 70), z: 0 },
        ],
        tint: WHITE,
        stroke: 1,
        opacity: 0.85,
      })
    }),
  })

  // The hero and its decoration, positioned together below the pair.
  heroScene = new Group({ members: [this.halo, this.ring, this.rays, this.hero], y: -125 })

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    for (const g of [this.fill, this.outline, this.hero]) g.seenFrom(this.observer)
    this.stage(this.fill)
    this.stage(this.outline)
    this.stage(this.heroScene)

    // All three turn together — one full-ish rotation over the take.
    this.play(
      together(
        this.fillEarth.h.to(TAU * 0.6, { easing: "linear" }),
        this.outlineEarth.h.to(TAU * 0.6, { easing: "linear" }),
        this.heroEarth.h.to(TAU * 0.6, { easing: "linear" }),
      ),
      6,
    )
  }
}
