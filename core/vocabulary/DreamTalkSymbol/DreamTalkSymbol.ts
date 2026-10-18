/**
 * DreamTalkSymbol — a DreamTalk symbol: the Earth inside a white bloom, a
 * red flower of life, a bold red ring and twelve rays of light.
 *
 * NAME. Built for the Web3 video's decentralised node (as `LightNode`), it
 * is the very symbol the InterBrain film shows and names: "Digital
 * SandTalk" (f8746) — "let's refer to the digital extension of SandTalk as
 * DreamTalk" (29:08) — and "a DreamTalk symbol needs a digital vehicle"
 * (29:14), the DreamNode that rings it (vocabulary/DreamNode). DreamTalk is
 * also the framework's own name, so the holon is the symbol: DreamTalkSymbol.
 * `vocabulary/LightNode/LightNode.ts` stays as a thin re-export.
 *
 * It was drawn three times — the hero (shot 15, Shot15Hero + the song's
 * HeroShot re-fit), the red lobe of the yin-yang (shots 2–3, "the hero's
 * construction at the lobe's scale"), and GlobeDemo's sheet — each copy with
 * its own drifted constants. It is one symbol, so it is one holon
 * (docs/TASTE.md, "One symbol, one implementation").
 *
 * ONE SIZE: `radius` is the red ring's. Everything else is a share of it,
 * and every part follows it live, so a scene can swell or shrink the node
 * (the yin-yang's lobes trade sizes) by animating one param:
 *
 *   globe          `globe` × radius (the hero measured 83/198; the lobe 0.415)
 *   lattice        circles of radius/3, hex-packed inside the ring
 *   rays           from 1.1 × the globe out to 1.25 (on the axes) and
 *                  1.17 (the diagonals) of the ring
 *   bloom          `bloomRings` white rings from 1.02 × the globe outward,
 *                  `bloomSpread` apart, falling off as
 *                  `bloomStrength` · (1 − i/n)^`bloomFalloff`
 *
 * PRESENCE: each layer has one opacity — `bloomOpacity` (a factor on the
 * falloff), `latticeOpacity`, `rayOpacity`, `ringOpacity` — and the land
 * floods in on `landOpacity`, so a scene brings the node up layer by layer.
 * The globe turns on `spin` and leans on `tilt` (the Earth's h and p).
 *
 * The Earth is set on the page (parts/recede.ts), so the bloom and lattice
 * drawn before it pass behind its black sea and the ring after it lies over
 * it — the layer order of the reference. It needs the eye: `seenFrom`.
 */

import { Circle, Group, Line, Null, derivePoints } from "../../src/parts/primitives"
import { color, completion, integer, length, scalar, angle } from "../../src/params"
import { WHITE, rgb, TAU } from "../../src/constants"
import type { Overrides } from "../../src/holon"
import type { Observer } from "../../src/dream"
import { hexPack } from "../../src/geometry/flower"
import { Recede } from "../../src/parts/recede"
import { Earth } from "../Earth/Earth"

/** The lattice circles' radius, as a share of the ring. */
const LATTICE_UNIT = 1 / 3
/** The flower of life in unit space (ring radius 1): its circles' centres. */
const FLOWER_UNIT = hexPack(
  [
    Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * TAU
      return { x: Math.cos(a) * (1 - LATTICE_UNIT * 0.9), y: Math.sin(a) * (1 - LATTICE_UNIT * 0.9) }
    }),
  ],
  { spacing: LATTICE_UNIT },
)
/** The radius the Earth is built at; `scale` sizes it. */
const EARTH_R = 100
const RAYS = 12
/** How far the rays on the axes reach, × the ring (the diagonals: DIAGONAL_REACH). */
export const RAY_REACH = 1.25
const DIAGONAL_REACH = 1.17

export class DreamTalkSymbol extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The red ring's radius — the node's one size. */
  radius = length(198)
  /** The globe's radius as a share of the ring. */
  globe = scalar(83 / 198)

  /** The Earth's turn about its pole and its pole's lean (h, p). */
  spin = scalar(0)
  tilt = angle(0.1)
  /** The land floods in on this. */
  landOpacity = completion(1)

  ringTint = color(rgb(0xe0, 0x50, 0x40))
  ringStroke = length(3)
  ringOpacity = completion(1)

  latticeTint = color(rgb(0xb0, 0x40, 0x34))
  latticeStroke = length(1.1)
  latticeOpacity = completion(0.55)

  rayTint = color(WHITE)
  rayStroke = length(1.2)
  rayOpacity = completion(0.85)

  bloomTint = color(WHITE)
  bloomOpacity = completion(1)
  /** Bloom shape: how many rings, how far apart (× the globe), how bright, how fast it falls. */
  bloomRings = integer(18)
  bloomSpread = scalar(0.04)
  bloomStrength = scalar(0.5)
  bloomFalloff = scalar(2.2)

  earth!: Earth
  earthOnPage!: Recede
  bloom!: Group
  lattice!: Group
  rays!: Group
  ring!: Circle

  private observer?: Observer

  constructor(overrides: Overrides = {}) {
    super(overrides)
    // The Earth is built here, not in compose, so a scene can turn it
    // (`spin`) from the first frame.
    this.earth = new Earth({
      radius: EARTH_R,
      land: WHITE,
      landOpacity: this.landOpacity,
      coastOpacity: 0,
      borderOpacity: 0,
      h: this.spin,
      p: this.tilt,
    })
  }

  /** Tell the Earth where the eye is (any scene whose camera is not the default). */
  seenFrom(observer: Observer): void {
    this.observer = observer
    this.earthOnPage?.seenFrom(observer)
  }

  /** How far the symbol reaches from its centre — the tips of the axis rays.
   *  A frame that holds it (vocabulary/DreamNode) fits this. */
  get reach(): number {
    return this.radius.value * RAY_REACH
  }

  private get globeRadius(): number {
    return this.globe.value * this.radius.value
  }

  protected override compose(): void {
    const R = () => this.radius.value
    const gr = () => this.globeRadius

    const n = this.bloomRings.value
    this.bloom = this.add(
      new Group({
        members: Array.from({ length: n }, (_, i) => {
          const c = new Circle({ tint: this.bloomTint, stroke: 4 })
          c.radius.follow(this.radius.map(() => gr() * (1.02 + i * this.bloomSpread.value)))
          c.opacity.follow(
            this.bloomOpacity.map(
              (b) => b * this.bloomStrength.value * (1 - i / n) ** this.bloomFalloff.value,
            ),
          )
          return c
        }),
      }),
    )

    this.lattice = this.add(
      new Group({
        members: FLOWER_UNIT.map((u) => {
          const c = new Circle({ tint: this.latticeTint, stroke: this.latticeStroke, opacity: this.latticeOpacity })
          c.radius.follow(this.radius.map((r) => r * LATTICE_UNIT))
          c.x.follow(this.radius.map((r) => u.x * r))
          c.y.follow(this.radius.map((r) => u.y * r))
          return c
        }),
      }),
    )

    this.rays = this.add(
      new Group({
        members: Array.from({ length: RAYS }, (_, i) => {
          const a = (i / RAYS) * TAU
          const reach = i % 3 === 0 ? RAY_REACH : DIAGONAL_REACH
          const line = new Line({ tint: this.rayTint, stroke: this.rayStroke, opacity: this.rayOpacity })
          derivePoints(line, () => [R(), this.globe.value], () => [
            { x: Math.cos(a) * gr() * 1.1, y: Math.sin(a) * gr() * 1.1, z: 0 },
            { x: Math.cos(a) * R() * reach, y: Math.sin(a) * R() * reach, z: 0 },
          ])
          return line
        }),
      }),
    )

    this.earth.scale.follow(this.radius.map(() => gr() / EARTH_R))
    this.earthOnPage = this.add(new Recede({ members: [this.earth], reach: EARTH_R }))
    this.earthOnPage.reach.follow(this.radius.map(() => gr()))
    if (this.observer) this.earthOnPage.seenFrom(this.observer)

    this.ring = this.add(
      new Circle({ radius: this.radius, tint: this.ringTint, stroke: this.ringStroke, opacity: this.ringOpacity }),
    )
  }
}
