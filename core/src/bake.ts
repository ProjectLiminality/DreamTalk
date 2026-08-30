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
