/**
 * Sites — the plain data a scene hands over to stand buildings on the
 * Earth, and the one function that turns it into anchored symbols.
 *
 * A site is a name, a lat/lon and a kind — nothing else — so a real
 * dataset swaps in for the mock (mockSites.ts) without touching a line of
 * drawing code. Headquarters get the tower (Headquarters.ts), production
 * sites the sawtooth hall (Factory.ts); the two production kinds are told
 * apart by colour alone, red and blue, each a tint the scene may override.
 */

import { BLUE, RED, WHITE } from "../../src/constants"
import type { Color } from "../../src/constants"
import { BALL_INSET, Place } from "./Earth"
import { Factory } from "./Factory"
import { Headquarters } from "./Headquarters"

/** One site as plain data. */
export interface SiteData {
  name: string
  lat: number
  lon: number
  kind: "hq" | "red" | "blue"
}

/** The headquarters' colour and the two production kinds'. */
export const SITE_TINTS: Record<SiteData["kind"], Color> = { hq: WHITE, red: RED, blue: BLUE }

/**
 * Turn site data into Places carrying their symbols. With `sunk`, each
 * starts wholly underground — well below the Earth's ground ball, which
 * hides it — so a scene raises it by animating `altitude` to 0. (Well
 * below, not just below: near the planet's silhouette a sight line grazes
 * the ball, and a building only a little under its skin can show through
 * at depth precision. Measured: 1.25× the ground's depth leaked a blue
 * hall at the limb; 4× does not.) `radius` is the Earth's — the ground's
 * depth is a fraction of it.
 */
export const sitePlaces = (
  sites: readonly SiteData[],
  opts: {
    scale?: number
    sunk?: boolean
    radius?: number
    tints?: Partial<Record<SiteData["kind"], Color>>
  } = {},
): Place[] => {
  const k = opts.scale ?? 1
  const ground = BALL_INSET * (opts.radius ?? 400)
  return sites.map((s) => {
    const tint = opts.tints?.[s.kind] ?? SITE_TINTS[s.kind]
    const hq = s.kind === "hq"
    const size = (hq ? 9 : 8) * k
    const symbol = hq ? new Headquarters({ tint, size }) : new Factory({ tint, size })
    const height = hq ? Headquarters.heightFor(size) : Factory.heightFor(size)
    return new Place({
      lat: s.lat,
      lon: s.lon,
      altitude: opts.sunk ? -(height + ground * 4) : 0,
      members: [symbol],
    })
  })
}
