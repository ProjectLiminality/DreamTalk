/**
 * TheWall.ts — A DreamWeaving
 *
 * The wall builds itself. MindViruses stream out of a single point,
 * swim their jellyfish flights to their own slots along a circle of
 * radius 1000, and fold shut into bricks — a growth wave sweeping the
 * ring, each of the four rows lagging the one below it by 1.66 bricks,
 * while the observer swings from straight overhead round to eye level.
 *
 * This is TheLabyrinth.py's __main__ (:466-585) — the scene that
 * rendered the reference TheWall.mp4 — minus one thing it had: the MAZE
 * floor, which belongs to the Labyrinth holon above this one
 * (demo/wall/Labyrinth.ts).
 *
 * The CABLES are on. Every creature trails an XPBD tether back to the
 * spawn anchor, and in the reference those white filaments are the
 * dominant image for most of the video — the dandelion. They are
 * history-dependent, so the wall bakes all 236 simulations while this
 * scene is built (~2.3 s, ~30 MB); from then on they are pure f(t) like
 * everything else, and the scene scrubs in both directions.
 *
 * ## The reference and its mapping
 *
 * refs/wall/thewall5 holds 84 frames at 5 fps, 1080², extracted from
 * TheWall.mp4 — the 500-frame, 30 fps render of the scene below, so
 * frame f000N sits at scene time (N−1)/5 seconds and the whole span is
 * 16.6s. The comparator takes the central 720² crop, exactly as the
 * MindVirus scene does.
 *
 * The lens here is the framework DEFAULT (53.13° vertical), and that is
 * deliberate: the reference is SQUARE, so C4D's 36mm lens spans 53.13°
 * on both of its axes, and 53.13° vertical over our 720-tall frame puts
 * exactly 53.13° across the 720² crop — degree for degree the reference.
 * Do NOT "correct" this to `CAMERA_FOV_VERTICAL`: that constant is the
 * 36mm lens read for a 16:9 frame (31.42°) and is right for the video-01
 * scenes, but here it would frame 1.78× too tight.
 *
 * ## The camera (TheLabyrinth.py:526-566)
 *
 * The Observer starts top-down (theta = PI/2) and descends to the
 * horizon (theta = 0) while its azimuth swings phi 0 → −PI, all
 * linearly across the whole span; radius 3000, focused a little above
 * the ground at y = 100.
 */

import { Dream, render } from "../../src/index"
import { eased } from "../../src/anim"
import { PI } from "../../src/constants"
import { TheWall } from "../../src/parts/thewall"
import { circleFootprint, reflectedZ } from "../../src/geometry/packing"

/** 500 frames at 30 fps — the reference render's span (:469). */
export const WALL_DURATION = 500 / 30

export class TheWallDream extends Dream {
  wall = new TheWall({
    rowCount: 4,
    // C4D-authored scene: the host's azimuth convention is the C4D rig
    // mirrored about Y, so the footprint reflects ONCE at the scene
    // boundary (reflectedZ doc; +0.79 coverage_ref measured). sealAtOne
    // false reproduces the 2025/26 wave (FIDELITY-LEDGER #1).
    footprint: reflectedZ(circleFootprint(1000)),
    sealAtOne: false,
    // The reference launches its creatures straight up out of the
    // origin, a 300-unit flourish (:487-489).
    spawn: { x: 0, y: 0, z: 0 },
    spawnDirection: { x: 0, y: 300, z: 0 },
    // The tethers, baked at build time over this scene's own span.
    cables: true,
    cableDuration: WALL_DURATION,
  })

  unfold() {
    const observer = this.observer
    observer.radius.defaultValue = 3000
    observer.radius.value = 3000
    // Focused just above the ground plane (:528).
    observer.y.defaultValue = 100
    observer.y.value = 100
    observer.theta.defaultValue = PI / 2
    observer.theta.value = PI / 2

    // Everything linear: the reference keyframes both the growth and
    // the orbit with linear interpolation (:497-521, :541-565).
    this.play(
      eased("linear", this.wall.growth.to(1), ...observer.orbit({ phi: -PI, theta: 0 })),
      WALL_DURATION,
    )
  }
}

if (import.meta.main) render(TheWallDream)
