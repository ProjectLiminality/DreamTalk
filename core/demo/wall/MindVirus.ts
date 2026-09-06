/**
 * MindVirus.ts — A DreamWeaving
 *
 * The creature awakens far away, swims toward and past the observer in
 * three jellyfish pulses, and leaves — its trail cable hanging in space
 * with the contour rings still marking every 30 units it travelled.
 * Matches the reference render (TheWall/MindVirus/MindVirus.mp4,
 * 5.63s, 1080×1080) — timings and waypoints fitted to the 5fps frame
 * extraction in the wall report.
 *
 * ## Framing (the verification mapping)
 *
 * The reference is square on C4D's 36mm lens: 53.13° across BOTH axes.
 * The default Observer renders 53.13° VERTICALLY at 16:9 — so the
 * central 720×720 crop of our 1280×720 frame is degree-for-degree the
 * reference frame scaled to 720. The comparator letterboxes exactly
 * that way (report). Camera at radius 1500 on +z, world origin ahead.
 *
 * ## The journey (fitted anchors)
 *
 * The cable's tail pins the start: the trail's far end holds screen
 * (766, 468) of 1080 for the whole video, which at depth d = 720 from
 * the camera is world (150, 45, 780). Cube sizes across the closed
 * frames give the approach; open-bell peaks sit at t ≈ 0.35 / 1.25 /
 * 2.45 (frames f003/f007+f008/f013+f014), pinning the pulse windows.
 * The third pulse stretches its glide (shares 0.19/0.13) — the source
 * rendered a long coast that only settles around t ≈ 4.0, after which
 * every extracted frame is bit-still.
 */

import { Dream, render } from "../../src/index"
import { together, eased } from "../../src/anim"
import { MindVirus } from "../../vocabulary/MindVirus/MindVirus"

const DUR = 5.65

export class MindVirusDream extends Dream {
  virus = new MindVirus({
    journey: {
      origin: { x: 150, y: 45, z: 780 },
      pulses: [
        // the arrival dash — the reference reaches its station by t=0.4
        { start: 0.05, duration: 0.22, to: { x: 13, y: 4, z: 885 }, heading: { x: 0, y: 0, z: 1 } },
        // station-keeping pulse (open peak ~0.45, barely any headway)
        { start: 0.3, duration: 0.65, to: { x: 0, y: 0, z: 910 } },
        // the approach pulse (open peak ~1.25)
        {
          start: 0.95,
          duration: 1.15,
          to: { x: -78, y: -24, z: 1180 },
          distanceShares: { open: 0.25, thrust: 0.45 },
        },
        // the exit: bell open through ~2.6, the snap by 2.8, long glide
        {
          start: 2.1,
          duration: 1.9,
          to: { x: -395, y: -125, z: 1450 },
          shares: { open: 0.26, thrust: 0.12 },
          distanceShares: { open: 0.05, thrust: 0.15 },
        },
      ],
    },
  })

  unfold() {
    const virus = this.virus
    this.play(
      together(
        virus.clock.to(DUR, { easing: "linear" }),
        // The awakening: the creature pops in from nothing (f002's
        // speck → f003's full body), the eye condensing a beat later.
        [eased("smooth", virus.scale.sequence(0, 1)), 0.15 / DUR, 0.38 / DUR],
        [eased("smooth", virus.molochEye.scale.sequence(0, 1)), 0.2 / DUR, 0.5 / DUR],
      ),
      DUR,
    )
  }
}

if (import.meta.main) render(MindVirusDream)
