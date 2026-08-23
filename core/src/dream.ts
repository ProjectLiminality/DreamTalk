/**
 * Dream — the Kronos side. unfold() BUILDS a timeline; it never executes
 * one. Playback, scrubbing, and the editor all sample the result as f(t).
 */

import { Holon } from "./holon"
import { Timeline, type Clip } from "./timeline"
import { angle, bool, length, scalar } from "./params"
import { PI } from "./constants"
import type { Anim } from "./anim"

export interface BackdropSpec {
  path: string
  /** Seconds added to scene t when sampling the backdrop video. */
  offset: number
}

/**
 * The named 2021 camera perspectives (pydeation ThreeDScene.CONFIG
 * "camera_perspective", scene/scene.py:1066-1072):
 *
 *   "default": p = -PI/8, b_frozen = PI/4
 *   "front":   p =  0,    b_frozen = 0
 *
 * Reading those two numbers as spherical ORBIT angles — not as a camera
 * roll — is what the reference frames actually show. The frozen bank is
 * applied to the camera's parent null, so it swings the camera around the
 * scene's vertical axis: it is an AZIMUTH, not a tilt. Two independent
 * checks in refs/video-01/frames5 confirm it:
 *
 *   - f0100 (S01 with the grids up) has one white axis standing exactly
 *     vertical on screen. A rolled camera cannot leave any world axis
 *     vertical; a level camera at 45 degrees of azimuth does.
 *   - f0080 (cylinder + both Eyes settled) puts the two Eyes at the same
 *     screen height, symmetric about the frame center — which a 45-degree
 *     azimuth on a level camera produces exactly, and a 45-degree roll
 *     does not.
 *
 * Fitting the f0080 Eye centroids over the whole (phi, theta, focal) space
 * lands on an azimuth of 45 degrees off the -Z axis and an elevation of
 * -22.5 degrees, with sub-pixel residuals: exactly the source's PI/4 and
 * -PI/8. Expressed in the framework's own spherical convention (phi = 0
 * puts the camera on +Z; see syncCamera in render/three-host.ts) that is
 * phi = -3PI/4, theta = -PI/8, which is what these constants hold.
 *
 * "front" stays phi = 0: the camera on +Z looking back at the origin.
 */
export type Perspective = "front" | "default"

/** phi (azimuth) and theta (elevation) per named perspective. */
export const PERSPECTIVES: Record<Perspective, { phi: number; theta: number }> = {
  front: { phi: 0, theta: 0 },
  default: { phi: (-3 * PI) / 4, theta: -PI / 8 },
}

/**
 * The reference framing constant, ported from the modern C4D camera rig
 * (objects/camera_objects.py:82 — `zoom = 1023.0 / frame_width`). C4D's
 * CAMERA_ZOOM for a parallel projection is this ratio, so a zoom of z frames
 * a world width of 1023/z. This is what pydeation's TwoDScene "camera_zoom"
 * multiplies (camera/camera.py:57-62 sets CAMERA_ZOOM directly).
 */
export const ZOOM_REFERENCE_WIDTH = 1023

/** Orthographic half-height of the view frustum at a given zoom + aspect. */
export const orthoHalfHeight = (zoom: number, aspect: number): number =>
  ZOOM_REFERENCE_WIDTH / (2 * zoom * aspect)

/**
 * Perspective camera distance for a given zoom, per pydeation's
 * ThreeDCamera (camera/camera.py:70-77): zoom is realized purely as
 * distance, `pos_y = 1000 / zoom`. Zooming in walks the camera closer;
 * the focal length never changes.
 */
export const DEFAULT_DISTANCE = 1000
export const distanceForZoom = (zoom: number): number => DEFAULT_DISTANCE / zoom

/**
 * The 2021 lens. pydeation never sets a focal length, so the camera keeps
 * C4D's own default: 36mm aperture with a 45mm focal length, i.e. a
 * HORIZONTAL field of view of 2*atan(18/45) = 43.60 degrees.
 *
 * The reference frames confirm the number rather than assume it. Solving
 * for the focal length that puts the two f0080 Eye centroids on their
 * measured pixels (at the phi/theta established above) gives 1580.65px
 * across a 1280px frame — a 44.46mm lens, within 1.2% of the 45mm preset,
 * which is comfortably inside the error of centroid measurement on a
 * YouTube encode. 36mm (the OTHER common default, hfov 53.13) would put
 * the Eyes ~90px off and is firmly excluded.
 */
export const CAMERA_FOCAL_MM = 45
export const CAMERA_APERTURE_MM = 36
/** The 2021 lens, HORIZONTAL — 43.60 degrees. */
export const CAMERA_FOV = 2 * Math.atan(CAMERA_APERTURE_MM / (2 * CAMERA_FOCAL_MM))

/** Convert a horizontal field of view to the vertical one three.js wants. */
export const verticalFov = (horizontal: number, aspect: number): number =>
  2 * Math.atan(Math.tan(horizontal / 2) / aspect)

/** The 2021 lens as the observer states it: vertical, at the 16:9 it was shot at. */
export const CAMERA_FOV_VERTICAL = verticalFov(CAMERA_FOV, 16 / 9)

/**
 * The consciousness perceiving the dream. A "2D scene" is an Observer
 * looking straight at the XY plane — nothing is ever merely 2D.
 *
 * Spherical about the focus point (x, y): `phi` azimuth, `theta` elevation,
 * `radius` distance, `tilt` roll about the view axis. `zoom` means what the
 * 2021 rig meant by it — for perspective, a distance divisor; for
 * orthographic, the CAMERA_ZOOM framing ratio.
 */
export class Observer extends Holon {
  phi = angle(0)
  theta = angle(0)
  /** Roll about the view axis. The 2021 rig never rolls (see PERSPECTIVES). */
  tilt = angle(0)
  /**
   * Distance to the focus point. The framework default stays at 1500 — the
   * framing every existing scene was authored against. video-01 scenes take
   * the 2021 rig's DEFAULT_DISTANCE of 1000 explicitly, because there zoom
   * is expressed as distance and the absolute value carries meaning.
   */
  radius = scalar(1500)
  zoom = scalar(1)
  /** Parallel projection (pydeation's TwoDCamera, CAMERA_PROJECTION top/front). */
  orthographic = bool(false)
  /**
   * VERTICAL field of view in radians — three.js's own convention, which is
   * what the host has always fed its PerspectiveCamera.
   *
   * The default is the 53.13 degrees every existing scene was framed
   * against. video-01 scenes take CAMERA_FOV_VERTICAL instead: the 2021
   * renders were shot on C4D's 45mm lens, whose 43.60-degree HORIZONTAL
   * angle is 25.36 degrees vertically at 16:9.
   */
  fov = angle((53.13 * Math.PI) / 180)
  /** Sketch & Toon's pixel-unit reference height (scene/scene.py:74). */
  baseHeight = length(700)

  /**
   * Adopt a named 2021 perspective: its azimuth and elevation, the rig's
   * 1000-unit distance, and the 45mm lens it was shot on. Taking the whole
   * rig together is the point — the angles alone would frame differently
   * under the framework's default lens.
   */
  look(perspective: Perspective): this {
    const { phi, theta } = PERSPECTIVES[perspective]
    this.phi.defaultValue = phi
    this.phi.value = phi
    this.theta.defaultValue = theta
    this.theta.value = theta
    this.radius.defaultValue = DEFAULT_DISTANCE
    this.radius.value = DEFAULT_DISTANCE
    this.fov.defaultValue = CAMERA_FOV_VERTICAL
    this.fov.value = CAMERA_FOV_VERTICAL
    return this
  }

  orbit(cfg: { phi?: number; theta?: number; tilt?: number }): Anim[] {
    const anims: Anim[] = []
    if (cfg.phi !== undefined) anims.push(this.phi.to(cfg.phi))
    if (cfg.theta !== undefined) anims.push(this.theta.to(cfg.theta))
    if (cfg.tilt !== undefined) anims.push(this.tilt.to(cfg.tilt))
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

  /** Append an Anim at the cursor, occupying runTime seconds; advance the cursor.
   *  Returns the Clip record so build-time anchors (__dt) can attach source
   *  spans to it — the editor's timeline edits (setRunTime) depend on this. */
  play(anim: Anim, runTime = 1): Clip {
    const clip: Clip = { anim, start: this.#cursor, duration: runTime }
    this.#clips.push(clip)
    this.#cursor += runTime
    return clip
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

  /** The raw clip layout — the editor's timeline markers read this. */
  get clips(): readonly Clip[] {
    this.build()
    return this.#clips
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
