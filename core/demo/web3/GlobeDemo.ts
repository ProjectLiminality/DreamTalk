/**
 * GlobeDemo — the Globe holon showing the modes it supports, against the four
 * shots it appears in (docs/reports/web3-recon.md, shots 1/3/13/15).
 *
 * Three globes side by side, all spinning (so rotation-as-a-param is visible),
 * each a different one of the looks the video asks of the holon:
 *
 *   • LEFT  — SHOT 1: a dark grey globe on black with a thin limb ring.
 *             `continents: "fill"`, dark land, `limbStroke` set.
 *   • RIGHT — SHOT 13: an outline globe — white coastlines on a bare sphere.
 *             `continents: "outline"`, white land, no fill.
 *   • BELOW — SHOT 15, the hero: a bright globe inside a red flower-of-life
 *             halo with a bold red ring and long white light rays.
 *
 * They share a frame rather than fading in turn because opacity in this host
 * is PER-PRIMITIVE, not inherited by a group's children — so a side-by-side
 * layout (position DOES cascade) is the honest way to show all the modes at
 * once, and reads as a comparison sheet besides.
 *
 * WHAT THE DEMO OWNS, NOT THE HOLON. The halo, the red ring and the rays are
 * DECORATION composed here, not part of Globe — folding them in would make the
 * globe "three things wearing one name" (the recon's own warning). The halo
 * reuses the existing flower packing (src/geometry/flower.ts hexPack) over a
 * disc mask, which is exactly the flower-of-life the reference draws; the rays
 * and ring are a handful of primitives.
 */

import { Dream } from "../../src/index"
import { Circle, Group, Line } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { Globe } from "../../vocabulary/Globe/Globe"
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
  // LEFT — the dark globe with a thin ring (shot 1).
  fill = new Globe({
    radius: 105,
    x: -270,
    y: 120,
    continents: "fill",
    land: rgb(0x3a, 0x3a, 0x3a),
    limbStroke: 1.5,
    limbTint: rgb(0x88, 0x88, 0x88),
    tilt: 0.18,
  })

  // RIGHT — the outline globe (shot 13).
  outline = new Globe({
    radius: 105,
    x: 270,
    y: 120,
    continents: "outline",
    land: WHITE,
    coastStroke: 2.5,
    limbStroke: 1,
    limbTint: rgb(0x44, 0x44, 0x44),
    tilt: 0.12,
  })

  // BELOW — the hero globe (shot 15): small, bright, land-on-black.
  hero = new Globe({ radius: HERO_R, continents: "fill", land: WHITE, tilt: 0.1 })

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
    this.stage(this.fill)
    this.stage(this.outline)
    this.stage(this.heroScene)

    // All three turn together — one full-ish rotation over the take.
    this.play(
      together(
        this.fill.spin.to(TAU * 0.6, { easing: "linear" }),
        this.outline.spin.to(TAU * 0.6, { easing: "linear" }),
        this.hero.spin.to(TAU * 0.6, { easing: "linear" }),
      ),
      6,
    )
  }
}
