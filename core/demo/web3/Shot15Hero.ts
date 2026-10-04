/**
 * Shot15Hero — shot 15 (≈130–146s): Web3 spreading light. The world inside a
 * flower of life, a bold red ring, and long white rays.
 *
 * GlobeDemo already composes this look as one of its three panels (the halo,
 * ring and rays are deliberately DEMO-side decoration, not part of Globe).
 * This shot is that composition at the reference's proportions, which
 * differ from the demo panel's: measured on f_00136 at 1280w (scene units at
 * this camera, 1.28px each),
 *
 *   globe radius   ~107px  →  83
 *   red ring       ~253px  → 198   (= ClarityField's HERO_RING_RADIUS, which
 *                                    is where shot 14's swelling disc ends)
 *   rays           to ~313px → 245, twelve of them, the four on the axes
 *                  reaching a little further than the diagonals
 *   flower lattice circles of a third of the ring's radius
 *
 * and a white bloom around the globe. The bloom is concentric rings of
 * falling opacity rather than a filled disc — YinYang found a disc behind
 * the globe shows THROUGH its transparent ocean as a grey wash.
 *
 * Timing (refs at 4fps, 130–146s): the globe and its light come up out of
 * the swollen disc over ~1.25s, then the globe turns slowly and the image
 * holds until the wipe into the portrait at ~145.
 */

import { Dream } from "../../src/index"
import { Circle, Group, Line } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { Globe } from "../../vocabulary/Globe/Globe"
import { hexPack } from "../../src/geometry/flower"
import { WHITE, rgb, TAU } from "../../src/constants"
import { HERO_RING_RADIUS } from "./ClarityField"

const GLOBE_R = 83
const RING_R = HERO_RING_RADIUS
const LATTICE_R = RING_R / 3
const HERO_RED = rgb(0xe0, 0x50, 0x40)
const LATTICE_RED = rgb(0xb0, 0x40, 0x34)
/** Concentric rings make the bloom; enough that they read as one glow. */
const BLOOM_RINGS = 18

/** A disc as a one-polygon mask. */
const disc = (radius: number, segments = 64) => [
  Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * TAU
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius }
  }),
]

export class Shot15HeroDream extends Dream {
  // A black ocean, opaque: the reference's globe is white land on a black
  // disc that sits IN its bloom, not a transparent sphere over it.
  globe = new Globe({
    radius: GLOBE_R,
    continents: "fill",
    land: WHITE,
    tilt: 0.1,
    spin: 0.15,
    landOpacity: 0,
    oceanTint: rgb(0, 0, 0),
  })

  ring = new Circle({ radius: RING_R, tint: HERO_RED, stroke: 3 })

  lattice = new Group({
    members: hexPack(disc(RING_R - LATTICE_R * 0.9), { spacing: LATTICE_R }).map(
      (c) =>
        new Circle({ radius: LATTICE_R, x: c.x, y: c.y, tint: LATTICE_RED, stroke: 1.1, opacity: 0 }),
    ),
  })

  bloom = new Group({
    members: Array.from({ length: BLOOM_RINGS }, (_, i) =>
      new Circle({ radius: GLOBE_R * (1.02 + i * 0.04), tint: WHITE, stroke: 4, opacity: 0 }),
    ),
  })

  rays = new Group({
    members: Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * TAU
      const reach = i % 3 === 0 ? 248 : 232
      return new Line({
        points: [
          { x: Math.cos(a) * GLOBE_R * 1.1, y: Math.sin(a) * GLOBE_R * 1.1, z: 0 },
          { x: Math.cos(a) * reach, y: Math.sin(a) * reach, z: 0 },
        ],
        tint: WHITE,
        stroke: 1.2,
        opacity: 0,
      })
    }),
  })

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    // Bloom behind, then the lattice, rays, globe and ring on top.
    this.stage(this.bloom)
    this.stage(this.lattice)
    this.stage(this.rays)
    this.stage(this.globe)
    this.stage(this.ring)

    const bloomLevels = this.bloom.members.map((h, i) =>
      h.opacity.to(0.5 * (1 - i / BLOOM_RINGS) ** 2.2),
    )
    this.play(
      together(
        this.globe.landOpacity.to(1),
        this.globe.oceanOpacity.to(1),
        together(...bloomLevels),
        together(...this.lattice.members.map((h) => h.opacity.to(0.55))),
        [together(...this.rays.members.map((h) => h.opacity.to(0.85))), 0.2, 1],
        this.globe.spin.to(0.1, { easing: "linear" }),
      ),
      1.25,
    )
    // The globe keeps turning through the hold.
    this.play(this.globe.spin.to(-0.25, { easing: "linear" }), 14.75)
  }
}
