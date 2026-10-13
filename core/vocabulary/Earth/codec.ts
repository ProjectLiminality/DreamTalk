/**
 * codec.ts — how the Earth carries its geography in the repo.
 *
 * Natural Earth arrives as GeoJSON: ~3.4 MB for the two 1:50m layers the
 * Earth needs. Shipped as-is that would dwarf every other holon, so
 * `gen-data.ts` packs each layer into one base64 string of zigzag VARINT
 * DELTAS on a fixed lon/lat grid, and this module unpacks it. Both halves
 * live here so the format is stated exactly once.
 *
 * THE GRID is 1/1000 degree (~111 m at the equator). 1:50m data is a
 * generalization at the scale of kilometres, so the grid moves no vertex
 * by a visible amount at any zoom the 50m layer is meant for — and on it
 * the step between neighbouring vertices (~0.1–0.4 degrees) is a 2-byte
 * varint, which is what makes the packing small: ~4 bytes a vertex, about
 * an eighth of the GeoJSON.
 *
 * THE STREAM, per layer:
 *
 *     varint ringCount
 *     per ring:  varint meta · varint pointCount · pointCount × (zz dlon, zz dlat)
 *
 * Deltas run across ring boundaries (the first point of a ring is a delta
 * from the last point of the previous one), so nothing restarts at zero.
 * `meta` is the layer's own per-ring byte — the land states its LOD rank and
 * whether the ring is a hole, the borders their class (see `gen-data.ts`).
 */

/** Natural Earth's border classes, in the order their index is stored. */
export const BORDER_CLASSES = [
  "International boundary (verify)",
  "Disputed (please verify)",
  "Indefinite (please verify)",
  "Line of control (please verify)",
  "Indeterminant frontier",
] as const

/**
 * Grid steps per degree — the default, and the land's and borders'. A
 * layer may pack on a coarser grid (the country fills use 200: they lie
 * UNDER the 1/1000° coast and borders, so half a kilometre is never seen,
 * and on that grid most steps fit one byte).
 */
export const QUANTUM = 1000

/** One decoded ring: its meta byte and its points as flat [lon, lat, …] degrees. */
export interface Ring {
  meta: number
  coords: Float64Array
}

const zig = (n: number): number => (n < 0 ? -2 * n - 1 : 2 * n)
const unzig = (n: number): number => (n & 1 ? -(n + 1) / 2 : n / 2)

/** Pack rings (flat lon/lat degrees) into the base64 stream. */
export const encodeRings = (
  rings: readonly { meta: number; coords: readonly number[] }[],
  quantum = QUANTUM,
): string => {
  const bytes: number[] = []
  const varint = (v: number): void => {
    // Plain arithmetic, not bit ops: a zigzagged 360000 is past 2^18 but
    // well inside the safe-integer range, and >>> would cap at 2^32 anyway.
    while (v >= 128) {
      bytes.push((v % 128) | 128)
      v = Math.floor(v / 128)
    }
    bytes.push(v)
  }
  varint(rings.length)
  let px = 0
  let py = 0
  for (const ring of rings) {
    varint(ring.meta)
    const n = ring.coords.length / 2
    varint(n)
    for (let i = 0; i < n; i++) {
      const x = Math.round(ring.coords[2 * i]! * quantum)
      const y = Math.round(ring.coords[2 * i + 1]! * quantum)
      varint(zig(x - px))
      varint(zig(y - py))
      px = x
      py = y
    }
  }
  return Buffer.from(bytes).toString("base64")
}

/** Unpack a base64 stream back into rings. Runs in the browser — no Buffer. */
export const decodeRings = (b64: string, quantum = QUANTUM): Ring[] => {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  let at = 0
  const varint = (): number => {
    let v = 0
    let mul = 1
    for (;;) {
      const b = bytes[at++]!
      v += (b & 127) * mul
      if (b < 128) return v
      mul *= 128
    }
  }
  const count = varint()
  const rings: Ring[] = []
  let px = 0
  let py = 0
  for (let r = 0; r < count; r++) {
    const meta = varint()
    const n = varint()
    const coords = new Float64Array(n * 2)
    for (let i = 0; i < n; i++) {
      px += unzig(varint())
      py += unzig(varint())
      coords[2 * i] = px / quantum
      coords[2 * i + 1] = py / quantum
    }
    rings.push({ meta, coords })
  }
  return rings
}
