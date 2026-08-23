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
 * scene's vertical axis: it is an AZIMUTH, not a tilt. Composing the 2021
 * rig symbolically — camera at local (0, 1000, 0) pitched -PI/2 inside a
 * null with p = -PI/8 and a frozen bank of PI/4, in C4D's top-view world
 * mapped to ours by (X, Y, Z)c4d -> (x, z, y) — collapses to exactly a
 * spherical orbit with plain +y up and NO roll: azimuth 45 degrees,
 * elevation 22.5 degrees, camera at (653.3, 382.7, 653.3) looking at the
 * origin. The C4D composition's own up-vector lands on what lookAt(+y up)
 * chooses, so the rig never rolls.
 *
 * The SIGNS are pinned by the reference, which kills the antipodal
 * solution (phi = -3PI/4, theta = -PI/8 — same eye symmetry, same axis
 * verticality, mirrored handedness) that an unordered centroid fit cannot
 * distinguish. On the raw f0080.png (no harness in the loop):
 *
 *   - the BLUE Eye (source: x=300) sits screen RIGHT — measured apex
 *     x=979 vs 977.7 predicted; the antipode puts it LEFT (356);
 *   - the RED Eye (source: y=300, out-of-plane) sits screen LEFT —
 *     measured apex x=302 vs 302.3 predicted;
 *   - the source-exact cylinder (r=50, h=200, axis +z) projects to a
 *     screen bbox of x[499.6, 771.5] y[268.8, 462.1] against the
 *     measured x[498, 773] y[267, 463]; the antipode misses the top
 *     edge by 35px.
 *
 * "front" stays phi = 0: the camera on +Z looking back at the origin.
 */
export type Perspective = "front" | "default"

/** phi (azimuth) and theta (elevation) per named perspective. */
export const PERSPECTIVES: Record<Perspective, { phi: number; theta: number }> = {
  front: { phi: 0, theta: 0 },
  default: { phi: PI / 4, theta: PI / 8 },
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
 * C4D's default: 36mm focal at 36mm aperture, i.e. a HORIZONTAL field of
 * view of 2*atan(18/36) = 53.13 degrees — a projection focal length of
 * exactly 1280px across a 1280px frame, or 1.28 px per world unit at the
 * rig's 1000-unit distance.
 *
 * The reference frames confirm the number twice over, independently:
 *
 *   - S04 (front view, flat objects, no orbit ambiguity) measures
 *     1.280 px/unit four separate ways on f0428: axis tick pitch
 *     38.4px per 30 units, shape centres at ±250 units = ±320px,
 *     rectangle 100x200 units = 132x260px incl. stroke, circle
 *     diameter 100 units = 131px.
 *   - S01 (default view): the f0080 landmark set above lands within
 *     ~2px at focal 1280 with the SOURCE-exact geometry.
 *
 * An earlier 45mm conclusion here came from an Eye-centroid solve run
 * against harness composites carrying a 5.3% vertical squash (since
 * fixed in core/demo/index.html) and an underdetermined theta/focal
 * trade — it also forced the CameraCal cylinder to a fictitious
 * r=42/h=166 at p=60deg. The 36mm lens restores the source's nominal
 * r=50/h=200 at p=PI/2 exactly.
 */
export const CAMERA_FOCAL_MM = 36
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
   * The default is the 53.13 degrees VERTICAL every existing scene was
   * framed against. video-01 scenes take CAMERA_FOV_VERTICAL instead: the
   * 2021 renders were shot on C4D's 36mm lens, whose 53.13 degrees are
   * HORIZONTAL — 31.42 degrees vertically at 16:9. Same number, different
   * axis; the coincidence is exactly why the two must not be conflated.
   */
  fov = angle((53.13 * Math.PI) / 180)
  /** Sketch & Toon's pixel-unit reference height (scene/scene.py:74). */
  baseHeight = length(700)

  /**
   * Adopt a named 2021 perspective: its azimuth and elevation, the rig's
   * 1000-unit distance, and the 36mm lens it was shot on. Taking the whole
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
