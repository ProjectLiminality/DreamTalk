/**
 * Dream — the Kronos side. unfold() BUILDS a timeline; it never executes
 * one. Playback, scrubbing, and the editor all sample the result as f(t).
 */

import { Holon } from "./holon"
import { Timeline, type Clip } from "./timeline"
import { angle, scalar } from "./params"
import type { Anim } from "./anim"

export interface BackdropSpec {
  path: string
  /** Seconds added to scene t when sampling the backdrop video. */
  offset: number
}

/**
 * The consciousness perceiving the dream. A "2D scene" is an Observer
 * looking straight at the XY plane — nothing is ever merely 2D.
 */
export class Observer extends Holon {
  phi = angle(0)
  theta = angle(0)
  radius = scalar(1500)
  zoom = scalar(1)

  orbit(cfg: { phi?: number; theta?: number }): Anim[] {
    const anims: Anim[] = []
    if (cfg.phi !== undefined) anims.push(this.phi.to(cfg.phi))
    if (cfg.theta !== undefined) anims.push(this.theta.to(cfg.theta))
    return anims
  }

  pan(cfg: { x?: number; y?: number }): Anim[] {
    const anims: Anim[] = []
    if (cfg.x !== undefined) anims.push(this.x.to(cfg.x))
    if (cfg.y !== undefined) anims.push(this.y.to(cfg.y))
    return anims
  }

  dolly(radius: number): Anim[] {
    return [this.radius.to(radius)]
  }
}

export abstract class Dream {
  readonly observer = new Observer()
  #cursor = 0
  #clips: Clip[] = []
  #backdrop?: BackdropSpec
  #roots: Holon[] = []
  #built?: Timeline

  /** The temporal unfolding — override this. */
  abstract unfold(): void

  /** Append an Anim at the cursor, occupying runTime seconds; advance the cursor. */
  play(anim: Anim, runTime = 1): void {
    this.#clips.push({ anim, start: this.#cursor, duration: runTime })
    this.#cursor += runTime
  }

  /** Set values instantly at the cursor (a zero-duration step). */
  set(...anims: Anim[]): void {
    for (const anim of anims) {
      this.#clips.push({ anim, start: this.#cursor, duration: 0 })
    }
  }

  /** Let time pass. */
  wait(dt = 1): void {
    this.#cursor += dt
  }

  /** Register the reference layer (TASTE: The Editor). One per dream. */
  backdrop(path: string, opts: { offset?: number } = {}): void {
    this.#backdrop = { path, offset: opts.offset ?? 0 }
  }

  /** Explicitly stage a holon that no animation touches. */
  stage<T extends Holon>(holon: T): T {
    this.#roots.push(holon)
    return holon
  }

  get backdropSpec(): BackdropSpec | undefined {
    this.build()
    return this.#backdrop
  }

  /** Unique root holons of everything the dream touches or stages. */
  get roots(): readonly Holon[] {
    this.build()
    const seen = new Set<Holon>()
    const roots: Holon[] = []
    const consider = (h: Holon) => {
      const r = h.root
      if (!seen.has(r) && !(r instanceof Observer)) {
        seen.add(r)
        roots.push(r)
      }
    }
    for (const r of this.#roots) consider(r)
    for (const clip of this.#clips) {
      for (const track of clip.anim.tracks) {
        const owner = track.param.owner
        if (owner instanceof Holon) consider(owner)
      }
    }
    return roots
  }

  /** Build (once) and return the pure timeline. */
  build(): Timeline {
    if (!this.#built) {
      this.unfold()
      this.#built = new Timeline(this.#clips, this.#cursor)
    }
    return this.#built
  }

  get duration(): number {
    return this.build().duration
  }

  /** Convenience: pure sample-and-apply at t. */
  applyAt(t: number): void {
    this.build().apply(t)
  }
}

export type DreamClass = new () => Dream

/**
 * The DreamWeaving entry point: `if (import.meta.main) render(MyDream)`.
 * In a browser host the editor/adapter picks this up; under Bun it prints
 * a dry-run summary (the CLI render pipeline arrives with the renderer).
 */
export const render = (DreamCtor: DreamClass): Dream => {
  const dream = new DreamCtor()
  const timeline = dream.build()
  const isBrowser = typeof document !== "undefined"
  if (!isBrowser) {
    const params = timeline.params
      .map((p) => `${(p.owner as Holon | undefined)?.constructor.name ?? "?"}.${p.name ?? p.id}`)
      .join(", ")
    console.log(
      `[dreamtalk] ${DreamCtor.name}: ${timeline.duration.toFixed(2)}s, ` +
        `${dream.roots.length} root holon(s), ${timeline.params.length} animated param(s)` +
        (params ? ` — ${params}` : ""),
    )
  }
  return dream
}
