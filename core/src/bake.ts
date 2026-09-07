/**
 * bake.ts — the ONE sanctioned bridge from stateful to pure.
 *
 * ## Why this file is allowed to exist
 *
 * Everything in DreamTalk is a function of t. A holon asked for its
 * geometry at t = 12 answers immediately, from t alone, which is what
 * makes scrubbing, the gauntlet, determinism and Magic Move all work at
 * once. A *history-dependent* holon cannot do that: a particle chain
 * only knows t = 12 by having lived through 0…12. That is a real
 * property of the thing, not a deficiency to argue away.
 *
 * Baking resolves it by simulating ONCE and storing the result as time
 * samples. Afterwards the holon is pure again — `sampleAt(t)` reads the
 * table, in any order, forwards or backwards, identically. Per ONTOLOGY
 * "Baking, corrected": baking was NEVER a render-cost optimization
 * (everything renders realtime); its one honest purpose is to let a
 * stateful holon join the pure-timeline world. Pure holons never bake.
 * It is per-holon and on demand, not a pipeline stage.
 *
 * **The bake happens at scene build time** — inside `unfold()`/
 * `compose()`, while the scene is being assembled — and NEVER during
 * playback. A frame must never trigger a simulation; if it can, the
 * scrub is already broken. `bake()` is therefore deliberately eager and
 * synchronous: it runs to completion where you call it, and what it
 * returns has no simulator left inside it.
 *
 * ## The shape of a bake
 *
 * A simulation is `{ init, step }` over an opaque state, plus a
 * `sample` that flattens one state to a fixed-width vector of numbers.
 * The result is a `BakedTrack`: one Float32Array holding `frames ×
 * width` values, and `sampleAt(t)` linearly interpolating between the
 * two straddling frames (clamped at both ends). Float32 is deliberate —
 * these are vertex positions bound for the GPU, and the storage should
 * be the storage the renderer wants.
 *
 * Linear interpolation, not spline: between two frames 1/30 s apart a
 * cable moves less than its own width, and a higher-order interpolant
 * would invent overshoot the simulation never had.
 */

/** A steppable simulation, stated as pure functions over an opaque state. */
export interface Simulation<S> {
  /** The state at t = 0. */
  init(): S
  /** One frame forward. Must not mutate `state`. */
  step(state: S, frame: number, time: number, dt: number): S
  /** Flatten a state into `width` numbers, written into `out`. */
  sample(state: S, out: Float32Array, offset: number): void
  /** How many numbers one frame occupies. */
  width: number
}

export interface BakeOptions {
  /** Sample rate of the bake — the simulation steps at exactly this rate. */
  fps: number
  /** Seconds of scene time to cover. */
  duration: number
}

/** The frozen result: pure, sampleable, and simulator-free. */
export interface BakedTrack {
  /** `frames × width` values, frame-major. */
  data: Float32Array
  frames: number
  width: number
  fps: number
  duration: number
  /**
   * The baked value at scene time `t`, linearly interpolated between
   * frames and clamped outside [0, duration]. Pure: same t, same
   * numbers, any order, any direction.
   */
  sampleAt(t: number, out?: Float32Array): Float32Array
}

/**
 * Run the simulation once and freeze it.
 *
 * The step count is `round(duration × fps) + 1` so that both endpoints
 * are sampled: frame 0 is `init()`, and the last frame sits exactly at
 * `duration`. The simulation's own dt is `1 / fps` — one step per
 * stored frame, no substepping. (Substepping would be a lie about which
 * samples the stored ones are.)
 */
export const bake = <S>(sim: Simulation<S>, { fps, duration }: BakeOptions): BakedTrack => {
  if (fps <= 0) throw new Error("bake: fps must be positive")
  if (duration < 0) throw new Error("bake: duration must be non-negative")

  const width = sim.width
  const frames = Math.max(1, Math.round(duration * fps) + 1)
  const dt = 1 / fps
  const data = new Float32Array(frames * width)

  let state = sim.init()
  sim.sample(state, data, 0)
  for (let f = 1; f < frames; f++) {
    state = sim.step(state, f, f * dt, dt)
    sim.sample(state, data, f * width)
  }

  return makeTrack(data, frames, width, fps, duration)
}

/** Wrap already-sampled data as a track — for callers that produced the
 *  samples some other way (a re-bake, a cache, a test fixture). */
export const makeTrack = (
  data: Float32Array,
  frames: number,
  width: number,
  fps: number,
  duration: number,
): BakedTrack => {
  const track: BakedTrack = {
    data,
    frames,
    width,
    fps,
    duration,
    sampleAt(t: number, out?: Float32Array): Float32Array {
      const dest = out ?? new Float32Array(width)
      if (frames === 1) {
        dest.set(data.subarray(0, width))
        return dest
      }
      const u = Math.min(Math.max(t * fps, 0), frames - 1)
      const i = Math.min(Math.floor(u), frames - 2)
      const w = u - i
      const a = i * width
      const b = a + width
      if (w <= 0) {
        dest.set(data.subarray(a, a + width))
        return dest
      }
      for (let k = 0; k < width; k++) {
        dest[k] = data[a + k]! + (data[b + k]! - data[a + k]!) * w
      }
      return dest
    },
  }
  return track
}

/** Bytes a track occupies — for the perf notes a bake owes its report. */
export const trackBytes = (track: BakedTrack): number => track.data.byteLength

/* ==========================================================================
 * The disk cache — an accelerator, never a dependency
 * ==========================================================================
 *
 * A bake is deterministic: the same simulation over the same span
 * produces the same Float32Array, every time, on every machine. That is
 * not an accident we are exploiting, it is the property the whole
 * chapter rests on (xpbd.test.ts pins it). So the second time anyone
 * asks for a bake we have already computed, the honest answer is the
 * bytes we computed before.
 *
 * The rules this layer holds itself to:
 *
 * 1. **Never a dependency.** Every path through here falls back to
 *    computing. A missing cache, an unreachable daemon, a corrupt file,
 *    a short read — all of them mean "compute it", never "fail". A
 *    static `serve.ts` with no cache endpoint at all must still boot the
 *    scene, just slower. If this file's disappearance would break a
 *    scene, the design is wrong.
 *
 * 2. **The caller states its identity.** `bake()` cannot inspect a
 *    closure, so it cannot derive what makes one bake different from
 *    another — only the caller knows that its simulation is "this
 *    creature's tether, on this path, with these settle parameters".
 *    The caller passes `key`: any JSON-shaped value naming those inputs.
 *    No key, no caching — silence is the safe default, because a wrong
 *    key serves one bake's numbers for another's, which is the single
 *    way this layer could corrupt a scene rather than merely fail to
 *    accelerate it.
 *
 * 3. **Invalidation is automatic, and includes the solver.** The stored
 *    name is a hash of (key, fps, duration, width, CACHE_VERSION). The
 *    first four cover the caller's inputs and the bake's shape; the
 *    version constant covers US — a change to the XPBD solver leaves
 *    every caller's key untouched while changing every byte it
 *    produces, so the constant below MUST be bumped whenever the
 *    simulation math changes. That is the one manual step in an
 *    otherwise automatic scheme, and it is the one worth guarding.
 */

/**
 * Bump when ANY simulation's math changes — the solver, the sampling,
 * or the frame convention. Caller keys describe the caller's inputs;
 * this describes ours, and nothing else invalidates on our behalf.
 */
export const CACHE_VERSION = 1

/** The header a cached track carries so a served file can prove its own
 *  shape before we trust the bytes after it. */
const CACHE_MAGIC = 0x444b4231 // "DKB1"
const HEADER_FLOATS = 6

/**
 * Where cached bakes live. Both methods may fail freely: a rejection or
 * a throw means "not cached" / "not stored", and the bake proceeds.
 */
export interface BakeCache {
  /** The stored bytes for `hash`, or undefined if absent. */
  get(hash: string): Promise<Uint8Array | undefined> | Uint8Array | undefined
  /** Offer bytes for storage. Fire-and-forget; failures are ignored. */
  put(hash: string, bytes: Uint8Array): Promise<void> | void
}

export interface CachedBakeOptions extends BakeOptions {
  /**
   * What makes this bake this bake — the simulation's inputs, in any
   * JSON-shaped form (numbers, arrays, nested objects). For a path-
   * driven sim this is the config plus samples of the path: enough that
   * two bakes sharing a key genuinely produce identical bytes.
   *
   * Omit it and no caching happens at all.
   */
  key?: unknown
  /** Where to look. Omit and no caching happens at all. */
  cache?: BakeCache
}

/**
 * FNV-1a over the canonical JSON of the key material. Not a security
 * hash — a naming scheme. Collisions matter, cryptographic hardness
 * does not, and 128 bits of FNV over a few kB of floats sits far below
 * the probability of the disk lying to us.
 */
export const bakeHash = (key: unknown, fps: number, duration: number, width: number): string => {
  const payload = JSON.stringify([CACHE_VERSION, fps, duration, width, canonical(key)])
  // Four independent FNV-1a lanes, different offsets → 128 bits.
  const offsets = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]
  const out: string[] = []
  for (const offset of offsets) {
    let h = offset >>> 0
    for (let i = 0; i < payload.length; i++) {
      h ^= payload.charCodeAt(i) & 0xff
      h = Math.imul(h, 0x01000193) >>> 0
      h ^= payload.charCodeAt(i) >>> 8
      h = Math.imul(h, 0x01000193) >>> 0
    }
    out.push(h.toString(16).padStart(8, "0"))
  }
  return out.join("")
}

/**
 * Key material must hash the same on every machine, so object key order
 * cannot be allowed to matter — JSON.stringify preserves insertion
 * order, and two callers building the same config in different orders
 * are stating the same inputs. Floats pass through as-is: they are
 * already exact in JSON, and rounding them here would merge bakes that
 * genuinely differ.
 */
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(src).sort()) out[k] = canonical(src[k])
    return out
  }
  if (typeof value === "number" && !Number.isFinite(value)) return String(value)
  return value
}

/** Serialize a track: a small header naming its shape, then the samples. */
export const encodeTrack = (track: BakedTrack): Uint8Array => {
  const header = new Float64Array([
    CACHE_MAGIC,
    CACHE_VERSION,
    track.frames,
    track.width,
    track.fps,
    track.duration,
  ])
  const bytes = new Uint8Array(header.byteLength + track.data.byteLength)
  bytes.set(new Uint8Array(header.buffer), 0)
  bytes.set(new Uint8Array(track.data.buffer, track.data.byteOffset, track.data.byteLength), header.byteLength)
  return bytes
}

/**
 * Read bytes back, verifying every claim they make about themselves
 * before any of them are believed: magic, version, and — the one that
 * actually catches truncation — that the payload is exactly as long as
 * the declared shape requires. Anything off returns undefined, which
 * means "compute it".
 */
export const decodeTrack = (
  bytes: Uint8Array,
  expect?: { frames: number; width: number },
): BakedTrack | undefined => {
  const headerBytes = HEADER_FLOATS * 8
  if (bytes.byteLength < headerBytes) return undefined
  // The payload may arrive at any byte offset (a slice of a larger
  // buffer), so copy the header rather than viewing it in place.
  const header = new Float64Array(bytes.slice(0, headerBytes).buffer)
  if (header[0] !== CACHE_MAGIC || header[1] !== CACHE_VERSION) return undefined
  const frames = header[2]!
  const width = header[3]!
  const fps = header[4]!
  const duration = header[5]!
  if (!Number.isInteger(frames) || !Number.isInteger(width) || frames < 1 || width < 1) {
    return undefined
  }
  if (expect && (expect.frames !== frames || expect.width !== width)) return undefined
  if (bytes.byteLength !== headerBytes + frames * width * 4) return undefined
  const data = new Float32Array(bytes.slice(headerBytes).buffer)
  return makeTrack(data, frames, width, fps, duration)
}

/**
 * `bake()` with a cache in front of it.
 *
 * Async because the cache may be a fetch — and a bake is a build-time
 * act, where awaiting is free (`unfold()` may await; a FRAME may not).
 * The synchronous `bake()` above remains the ground truth and the
 * fallback: this function computes exactly what it would have computed
 * whenever the cache has nothing to say.
 *
 * A hit is byte-identical to a miss by construction — the same
 * Float32Array is what was stored — which is what makes serving one in
 * place of the other honest rather than merely fast.
 */
export const bakeCached = async <S>(
  sim: Simulation<S>,
  opts: CachedBakeOptions,
): Promise<{ track: BakedTrack; hit: boolean }> => {
  const { key, cache, fps, duration } = opts
  if (key === undefined || !cache) return { track: bake(sim, opts), hit: false }

  const frames = Math.max(1, Math.round(duration * fps) + 1)
  const hash = bakeHash(key, fps, duration, sim.width)

  try {
    const bytes = await cache.get(hash)
    if (bytes) {
      const track = decodeTrack(bytes, { frames, width: sim.width })
      if (track) return { track, hit: true }
    }
  } catch {
    // A cache that throws is a cache that is absent. Compute.
  }

  const track = bake(sim, opts)
  try {
    await cache.put(hash, encodeTrack(track))
  } catch {
    // Storing is a courtesy to the next boot, never this one's problem.
  }
  return { track, hit: false }
}
