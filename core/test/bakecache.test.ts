/**
 * bakecache.test.ts — the accelerator that must never become a dependency.
 *
 * Two properties carry this whole layer, and they are what these tests
 * pin:
 *
 *   1. **A hit is byte-identical to a miss.** The cache is only honest
 *      if serving stored bytes is indistinguishable from recomputing —
 *      otherwise it is not a cache, it is a second implementation.
 *   2. **Every failure means "compute".** A missing entry, a corrupt
 *      file, a truncated read, a cache that throws, a stale version, a
 *      changed key — none of them may produce wrong numbers, and none of
 *      them may produce an error. They produce a bake.
 *
 * The third property — that a wrong key would serve one bake's numbers
 * for another's — is the failure this layer CANNOT recover from, so the
 * hash tests below are the load-bearing ones.
 */

import { describe, expect, test } from "bun:test"
import {
  bake,
  bakeCached,
  bakeHash,
  decodeTrack,
  encodeTrack,
  CACHE_VERSION,
  type BakeCache,
  type Simulation,
} from "../src/bake"
import { isValidHash, bakeCacheDir, fsBakeCache, httpBakeCache } from "../src/bakecache"

/** A history-dependent sim whose numbers depend on a parameter, so two
 *  configurations genuinely differ frame by frame. */
const drift = (rate: number): Simulation<{ x: number; v: number }> => ({
  width: 2,
  init: () => ({ x: 0, v: rate }),
  step: (s) => ({ x: s.x + s.v, v: s.v * 0.9 + rate }),
  sample: (s, out, off) => {
    out[off] = s.x
    out[off + 1] = s.v
  },
})

/** An in-memory cache that counts what was asked of it. */
const memCache = (): BakeCache & { store: Map<string, Uint8Array>; gets: number; puts: number } => {
  const self = {
    store: new Map<string, Uint8Array>(),
    gets: 0,
    puts: 0,
    get(hash: string): Uint8Array | undefined {
      self.gets++
      return self.store.get(hash)
    },
    put(hash: string, bytes: Uint8Array): void {
      self.puts++
      self.store.set(hash, bytes)
    },
  }
  return self
}

describe("the hash names the bake", () => {
  test("same inputs, same name", () => {
    expect(bakeHash({ a: 1, b: [2, 3] }, 30, 2, 6)).toBe(bakeHash({ a: 1, b: [2, 3] }, 30, 2, 6))
  })

  test("key order does not matter — two callers, one set of inputs", () => {
    expect(bakeHash({ a: 1, b: 2 }, 30, 2, 6)).toBe(bakeHash({ b: 2, a: 1 }, 30, 2, 6))
  })

  test("a different key is a different name", () => {
    expect(bakeHash({ a: 1 }, 30, 2, 6)).not.toBe(bakeHash({ a: 1.0001 }, 30, 2, 6))
  })

  test("the bake's shape is part of the name: fps, duration, width", () => {
    const base = bakeHash({ a: 1 }, 30, 2, 6)
    expect(bakeHash({ a: 1 }, 60, 2, 6)).not.toBe(base)
    expect(bakeHash({ a: 1 }, 30, 3, 6)).not.toBe(base)
    expect(bakeHash({ a: 1 }, 30, 2, 9)).not.toBe(base)
  })

  test("nested arrays of floats — the shape a sampled path arrives in", () => {
    const path = Array.from({ length: 64 }, (_, i) => [i * 0.1, Math.sin(i), -i])
    expect(bakeHash({ path }, 30, 2, 63)).toBe(bakeHash({ path }, 30, 2, 63))
    const nudged = path.map((p, i) => (i === 30 ? [p[0]!, p[1]! + 1e-6, p[2]!] : p))
    expect(bakeHash({ path: nudged }, 30, 2, 63)).not.toBe(bakeHash({ path }, 30, 2, 63))
  })

  test("it is a valid path segment — hashes become filenames", () => {
    expect(isValidHash(bakeHash({ a: 1 }, 30, 2, 6))).toBe(true)
    expect(isValidHash("../../etc/passwd")).toBe(false)
    expect(isValidHash("")).toBe(false)
    expect(isValidHash("ABC123")).toBe(false)
  })
})

describe("encode/decode round-trips the exact bytes", () => {
  const track = bake(drift(0.5), { fps: 30, duration: 1 })

  test("a decoded track is the encoded one, value for value", () => {
    const back = decodeTrack(encodeTrack(track))
    expect(back).toBeDefined()
    expect(back!.frames).toBe(track.frames)
    expect(back!.width).toBe(track.width)
    expect(back!.fps).toBe(track.fps)
    expect(back!.duration).toBe(track.duration)
    expect(Array.from(back!.data)).toEqual(Array.from(track.data))
  })

  test("and it samples identically — the property that makes a hit honest", () => {
    const back = decodeTrack(encodeTrack(track))!
    for (let t = 0; t <= 1; t += 0.037) {
      expect(Array.from(back.sampleAt(t))).toEqual(Array.from(track.sampleAt(t)))
    }
  })

  test("truncation is refused, not half-believed", () => {
    const bytes = encodeTrack(track)
    expect(decodeTrack(bytes.slice(0, bytes.byteLength - 4))).toBeUndefined()
    expect(decodeTrack(bytes.slice(0, 8))).toBeUndefined()
    expect(decodeTrack(new Uint8Array(0))).toBeUndefined()
  })

  test("garbage is refused", () => {
    expect(decodeTrack(new Uint8Array(128))).toBeUndefined()
    const noise = new Uint8Array(encodeTrack(track))
    noise[0] = noise[0]! ^ 0xff
    expect(decodeTrack(noise)).toBeUndefined()
  })

  test("a shape it did not expect is refused — a hash collision cannot land", () => {
    const bytes = encodeTrack(track)
    expect(decodeTrack(bytes, { frames: track.frames, width: track.width })).toBeDefined()
    expect(decodeTrack(bytes, { frames: track.frames + 1, width: track.width })).toBeUndefined()
    expect(decodeTrack(bytes, { frames: track.frames, width: track.width + 3 })).toBeUndefined()
  })

  test("a future version's bytes are refused by today's reader", () => {
    const bytes = encodeTrack(track)
    // header[1] is the version, the second f64.
    const header = new Float64Array(bytes.slice(0, 48).buffer)
    header[1] = CACHE_VERSION + 1
    bytes.set(new Uint8Array(header.buffer), 0)
    expect(decodeTrack(bytes)).toBeUndefined()
  })

  test("a view at a nonzero byte offset decodes — payloads arrive as slices", () => {
    const bytes = encodeTrack(track)
    const padded = new Uint8Array(bytes.byteLength + 7)
    padded.set(bytes, 7)
    const view = padded.subarray(7)
    expect(Array.from(decodeTrack(view)!.data)).toEqual(Array.from(track.data))
  })
})

describe("bakeCached: a hit is a miss, byte for byte", () => {
  const opts = { fps: 30, duration: 1, key: { rate: 0.5 } }

  test("cold computes and stores; warm reads and does not recompute", async () => {
    const cache = memCache()
    let steps = 0
    const counting = (): Simulation<{ x: number; v: number }> => {
      const inner = drift(0.5)
      return { ...inner, step: (s, f, t, dt) => (steps++, inner.step(s, f, t, dt)) }
    }

    const cold = await bakeCached(counting(), { ...opts, cache })
    expect(cold.hit).toBe(false)
    expect(cache.puts).toBe(1)
    const coldSteps = steps

    steps = 0
    const warm = await bakeCached(counting(), { ...opts, cache })
    expect(warm.hit).toBe(true)
    expect(steps).toBe(0) // the simulation never ran
    expect(coldSteps).toBeGreaterThan(0)

    expect(Array.from(warm.track.data)).toEqual(Array.from(cold.track.data))
  })

  test("the warm track samples identically across the whole span", async () => {
    const cache = memCache()
    const cold = (await bakeCached(drift(0.5), { ...opts, cache })).track
    const warm = (await bakeCached(drift(0.5), { ...opts, cache })).track
    for (let t = -0.5; t <= 1.5; t += 0.017) {
      expect(Array.from(warm.sampleAt(t))).toEqual(Array.from(cold.sampleAt(t)))
    }
  })

  test("a changed key misses — invalidation is automatic", async () => {
    const cache = memCache()
    await bakeCached(drift(0.5), { ...opts, cache })
    const other = await bakeCached(drift(2), { ...opts, key: { rate: 2 }, cache })
    expect(other.hit).toBe(false)
    expect(cache.store.size).toBe(2)
    // And the two are genuinely different bakes, not one served twice.
    const a = (await bakeCached(drift(0.5), { ...opts, cache })).track
    expect(Array.from(a.sampleAt(1))).not.toEqual(Array.from(other.track.sampleAt(1)))
  })

  test("a changed span misses too", async () => {
    const cache = memCache()
    await bakeCached(drift(0.5), { ...opts, cache })
    expect((await bakeCached(drift(0.5), { ...opts, duration: 2, cache })).hit).toBe(false)
    expect((await bakeCached(drift(0.5), { ...opts, fps: 60, cache })).hit).toBe(false)
  })
})

describe("bakeCached: every failure means compute", () => {
  const opts = { fps: 30, duration: 1, key: { rate: 0.5 } }
  const truth = bake(drift(0.5), { fps: 30, duration: 1 })
  const sameAsTruth = (r: { track: { data: Float32Array } }): void => {
    expect(Array.from(r.track.data)).toEqual(Array.from(truth.data))
  }

  test("no key: no caching at all", async () => {
    const cache = memCache()
    const r = await bakeCached(drift(0.5), { fps: 30, duration: 1, cache })
    expect(r.hit).toBe(false)
    expect(cache.gets).toBe(0)
    expect(cache.puts).toBe(0)
    sameAsTruth(r)
  })

  test("no cache: no caching at all", async () => {
    sameAsTruth(await bakeCached(drift(0.5), opts))
  })

  test("a cache that throws on get still yields the right bake", async () => {
    const cache: BakeCache = {
      get() {
        throw new Error("disk on fire")
      },
      put() {},
    }
    sameAsTruth(await bakeCached(drift(0.5), { ...opts, cache }))
  })

  test("a cache that throws on put still yields the right bake", async () => {
    const cache: BakeCache = {
      get: () => undefined,
      put() {
        throw new Error("read-only")
      },
    }
    sameAsTruth(await bakeCached(drift(0.5), { ...opts, cache }))
  })

  test("a cache that rejects still yields the right bake", async () => {
    const cache: BakeCache = {
      get: () => Promise.reject(new Error("offline")),
      put: () => Promise.reject(new Error("offline")),
    }
    sameAsTruth(await bakeCached(drift(0.5), { ...opts, cache }))
  })

  test("a cache serving corrupt bytes recomputes rather than believing them", async () => {
    const cache: BakeCache = {
      get: () => new Uint8Array(64).fill(0xab),
      put: () => {},
    }
    const r = await bakeCached(drift(0.5), { ...opts, cache })
    expect(r.hit).toBe(false)
    sameAsTruth(r)
  })

  test("a cache serving a DIFFERENT bake's bytes recomputes — the shape check", async () => {
    const wrong = encodeTrack(bake(drift(0.5), { fps: 30, duration: 5 }))
    const cache: BakeCache = { get: () => wrong, put: () => {} }
    const r = await bakeCached(drift(0.5), { ...opts, cache })
    expect(r.hit).toBe(false)
    sameAsTruth(r)
  })
})

describe("the fs cache", () => {
  const root = `/tmp/dt-bakecache-${process.pid}-${Math.random().toString(36).slice(2)}`

  test("dir sits under the repo root, gitignored", () => {
    expect(bakeCacheDir("/repo")).toBe("/repo/.cache/bakes")
    expect(bakeCacheDir("/repo/")).toBe("/repo/.cache/bakes")
  })

  test("stores and reads back a track byte-identically", async () => {
    const cache = fsBakeCache(root)
    const cold = await bakeCached(drift(0.5), { fps: 30, duration: 1, key: { r: 1 }, cache })
    expect(cold.hit).toBe(false)
    const warm = await bakeCached(drift(0.5), { fps: 30, duration: 1, key: { r: 1 }, cache })
    expect(warm.hit).toBe(true)
    expect(Array.from(warm.track.data)).toEqual(Array.from(cold.track.data))
    await Bun.$`rm -rf ${root}`.quiet()
  })

  test("a missing directory is a miss, not an error", async () => {
    const cache = fsBakeCache("/nonexistent-root-xyz")
    expect(await cache.get(bakeHash({ a: 1 }, 30, 1, 2))).toBeUndefined()
  })

  test("it refuses a hash that is not one of ours", async () => {
    const cache = fsBakeCache(root)
    expect(await cache.get("../../../etc/passwd")).toBeUndefined()
  })
})

describe("TheWall's cable cache", () => {
  /**
   * The failure this pins is the one that actually happened, and it is
   * the nastiest shape a cache can fail in: everything "works", nothing
   * errors, byte-identity holds — and the hit rate is silently zero.
   *
   * The cause was that `warmCables()` computes its keys BEFORE
   * `compose()`, while `tipAt()` reads `this.packing.rowLength` and
   * falls back to 1 when the wall has not composed yet. So the warm
   * pass hashed a different growth wave than the bake did, stored 236
   * files, and matched none of them. A cache that never hits looks
   * exactly like a cache that is working, from the outside.
   *
   * Hence: assert the HIT, not merely the identity.
   */
  test("the key is the same before compose() and during it", async () => {
    const { TheWall } = await import("../vocabulary/TheWall/TheWall")
    const { bakeHash } = await import("../src/bake")
    const { CABLE_PARTICLES } = await import("../src/geometry/xpbd")
    const { packSlots, rowHeight } = await import("../src/geometry/packing")
    const { buildJourney } = await import("../src/geometry/journey")

    // A small wall — the property is per-creature, not per-population.
    const wall = new TheWall({ rowCount: 2, cables: false, cableDuration: 1 })
    const duration = wall.cableDuration.value
    const fps = wall.cableFps.value
    const brick = wall.brickSize.value
    const inner = wall as unknown as {
      cableKey(s: unknown, j: unknown, d: number, f: number, b: number): unknown
      packing?: unknown
      footprint: unknown
      rowCount: { value: number }
      rowHeight: { value: number }
      spawn: unknown
      spawnDirection?: unknown
      placements: { slot: unknown; journey: unknown }[]
      parts: unknown
    }

    // The pre-compose key, exactly as warmCables() forms it.
    const packing = packSlots(inner.footprint as never, {
      brickSize: brick,
      rowCount: inner.rowCount.value,
    })
    inner.packing = packing // what warmCables() publishes, and why
    const slot = packing.slots[0]!
    const journey = buildJourney({
      spawn: inner.spawn as never,
      slot: {
        x: slot.position.x,
        y: rowHeight(slot.row, inner.rowCount.value, inner.rowHeight.value),
        z: slot.position.z,
      },
      spawnDir: inner.spawnDirection as never,
      slotNormal: { x: slot.normal.x, y: 0, z: slot.normal.z },
    })
    const before = bakeHash(
      inner.cableKey(slot, journey, duration, fps, brick),
      fps,
      duration,
      CABLE_PARTICLES * 3,
    )

    // The during-compose key, from the placement the wall actually built.
    void inner.parts
    const p = inner.placements[0]!
    const during = bakeHash(
      inner.cableKey(p.slot, p.journey, duration, fps, brick),
      fps,
      duration,
      CABLE_PARTICLES * 3,
    )

    expect(before).toBe(during)
  })

  test("a warm boot HITS — not merely 'is identical'", async () => {
    const { TheWall } = await import("../vocabulary/TheWall/TheWall")
    const root = `/tmp/dt-wallcache-${process.pid}-${Math.random().toString(36).slice(2)}`
    const cache = fsBakeCache(root)
    const opts = { rowCount: 2, cables: true, cableDuration: 1 } as const

    const cold = new TheWall({ ...opts })
    expect((await (cold as unknown as { warmCables(c: unknown): Promise<{ hits: number }> })
      .warmCables(cache)).hits).toBe(0)
    void cold.parts
    const total = cold.layout.slots.length
    expect(total).toBeGreaterThan(0)

    // The stores are fire-and-forget; let them land.
    await new Promise((r) => setTimeout(r, 600))

    const warm = new TheWall({ ...opts })
    const warmed = await (warm as unknown as {
      warmCables(c: unknown): Promise<{ hits: number; total: number }>
    }).warmCables(cache)
    expect(warmed.hits).toBe(total)
    void warm.parts
    expect((warm as unknown as { cableCacheHits: number }).cableCacheHits).toBe(total)

    await Bun.$`rm -rf ${root}`.quiet()
  }, 30000)
})

describe("the http cache", () => {
  test("a 404 is a miss, not an error — this is serve.ts's world", async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("no", { status: 404 }) })
    const cache = httpBakeCache(`http://localhost:${server.port}/api/bake-cache`)
    expect(await cache.get(bakeHash({ a: 1 }, 30, 1, 2))).toBeUndefined()
    await cache.put(bakeHash({ a: 1 }, 30, 1, 2), new Uint8Array(8)) // must not throw
    server.stop(true)
  })

  test("an unreachable daemon is a miss, not an error", async () => {
    const cache = httpBakeCache("http://localhost:1/api/bake-cache")
    expect(await cache.get(bakeHash({ a: 1 }, 30, 1, 2))).toBeUndefined()
    await cache.put(bakeHash({ a: 1 }, 30, 1, 2), new Uint8Array(8))
  })

  test("round-trips a real track through a real server", async () => {
    const store = new Map<string, Uint8Array>()
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const hash = new URL(req.url).pathname.split("/").pop()!
        if (req.method === "PUT") {
          store.set(hash, new Uint8Array(await req.arrayBuffer()))
          return new Response(null, { status: 204 })
        }
        const bytes = store.get(hash)
        return bytes
          ? new Response(bytes.slice().buffer as ArrayBuffer)
          : new Response("miss", { status: 404 })
      },
    })
    const cache = httpBakeCache(`http://localhost:${server.port}/api/bake-cache`)
    const opts = { fps: 30, duration: 1, key: { r: 7 }, cache }
    const cold = await bakeCached(drift(0.5), opts)
    expect(cold.hit).toBe(false)
    const warm = await bakeCached(drift(0.5), opts)
    expect(warm.hit).toBe(true)
    expect(Array.from(warm.track.data)).toEqual(Array.from(cold.track.data))
    server.stop(true)
  })
})
