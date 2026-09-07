/**
 * OriginsPitch.ts — A DreamSong
 *
 * "The Origins of Project Liminality" (2024), whole: the twelve
 * published scenes as chapters of ONE composition, cut back-to-back at
 * the video's own boundaries (ONTOLOGY.md "The DreamSong: one file,
 * linear, one import set").
 *
 * Unlike video-01's song, this one has NO global offset to subtract.
 * The published video runs 0 → 377.888s and the first chapter starts at
 * 0, so the song's time T IS video time, and reference frame f_N sits at
 * T = N/5 with no arithmetic in between. The song's duration is the
 * video's duration exactly, and that is a consequence of the spans
 * rather than a target: the spans are the boundaries and they sum to
 * 377.888.
 *
 *
 * WHAT A SPAN IS HERE, AND WHY IT IS NOT THE CHAPTER'S DURATION
 *
 * Each chapter's window is the distance to the NEXT chapter's t0 — the
 * video's own cut — not the chapter's own length. Every one of the
 * thirteen t0s below is the number that chapter was SCORED at against
 * refs/pitch/origins/frames5, taken from the scene file's own header
 * (which is the authority; the vocabulary report's §0 table is the
 * source's audio cues and diverges from the video after Scene06). So
 * the windows are the measurements, and a chapter's own duration is
 * only ever allowed to disagree with its window by the slack below:
 *
 *   ch      t0      own dur    ends     span    slack
 *   o00      0.000   13.117   13.117   13.000   -0.117
 *   o01     13.000   58.100   71.100   58.000   -0.100
 *   o02     71.000   25.280   96.280   25.000   -0.280
 *   o03     96.000   29.600  125.600   29.000   -0.600
 *   o04    125.000   17.450  142.450   17.000   -0.450
 *   o05    142.000   12.450  154.450   12.000   -0.450
 *   o06    154.000   83.600  237.600   79.000   -4.600
 *   o07    233.000   47.800  280.800   47.700   -0.100
 *   o07_1  280.700   12.000  292.700   12.100   +0.100
 *   o08    292.800   28.000  320.800   28.050   +0.050
 *   o09    320.850   25.000  345.850   24.950   -0.050
 *   o10    345.800   14.000  359.800   14.400   +0.400
 *   o11    360.200   12.000  372.200   11.000   -1.200
 *   o12    371.200    6.688  377.888    6.688    0.000
 *
 * Negative slack is a chapter whose clips run past its cut; positive is
 * a chapter that finishes early and holds. Both are the DreamSong's
 * ordinary behaviour (song.ts: a spilling clip evaluates but stays
 * hidden until its chapter's window; a short chapter holds its last
 * frame), and both are what the reference shows — a scene's teardown
 * runs into the black gap after it, and a black gap is a held final
 * frame.
 *
 * The small negatives (o00-o05, o07) are each a fraction of a second:
 * these scenes carry a fitted START_OFFSET as a leading wait, which
 * pushes their tail past the cut by exactly that head. Nothing is lost —
 * what spills is the last sliver of an already-empty frame.
 *
 *
 * THE TWO LARGE SLACKS, AND WHY THEY ARE RIGHT
 *
 * **o06 → o07, −4.600s.** Scene06 ends at video 237.6 (measured: its
 * closing UnDraw finishes there, and the frames are black 237.6-238.6).
 * Scene07's t0 is its declared audio offset 233, because that is the
 * alignment its fourteen landmarks were scored at — but its own
 * START_OFFSET is 4.8s of DEAD AIR, so from video 233 to 237.8 Scene07
 * renders nothing at all. The overlap is therefore between a scene that
 * is still on screen and a scene that has not started drawing, and the
 * cut has to fall where Scene06 ends. Hence o06's span is 79.0 (to
 * 233.0) and Scene06's last 4.6s spill past it — which the song HIDES,
 * because only the active chapter shows.
 *
 * That is the one place the composition is knowingly not the reference:
 * the film shows Scene06's close through 237.6 and the song cuts it at
 * 233.0. It is stated rather than fixed because the alternative is
 * worse in both directions — moving o07's t0 to 237.8 would break the
 * alignment its fourteen landmarks fix, and both scenes cannot own the
 * same 4.6 seconds under a cut. The scored consequence is visible in
 * the song-vs-standalone table in the report: o06's last frames are the
 * only ones the song and the standalone disagree about.
 *
 * **o11 → o12, −1.200s.** Scene11's own clips end at its local 11.0
 * (video 371.2) and it carries a trailing `wait(1)` of held black to
 * 372.2. The closing card was written standalone with Scene05's
 * `wait(2)` lead and therefore a t0 of 370.05, which would cut Scene11
 * off mid-fade. Scene12's lead is dead air, so it absorbs the
 * difference: its t0 moved to 371.2 and its LEAD_IN to 0.85, keeping
 * the play at video 372.05 where its six landmarks put it. See
 * Scene12.ts's header. What spills here is Scene11's held black tail,
 * and the frames it spills over are black too.
 *
 *
 * THE BLACK GAPS ARE THE COMPOSITE'S OWN DEAD AIR
 *
 * The reference has ~1-3s of black between most scenes (report §0's
 * luminance scan). Nothing in this file states them: they fall out of
 * the chapters themselves — a scene's closing UnCreate empties the
 * frame and its window keeps running (o00 goes black at 13.117 and its
 * window ends at 13.0; o02's UnFillThenUnDraw empties it well before
 * 96.0), and the next chapter's START_OFFSET holds black before its
 * first ink. The gaps are inherited, not authored, which is the right
 * relationship: the film's rhythm is in the scenes.
 */

import { render } from "../../src/index"
import { DreamSong } from "../../src/song"
import { Scene00Dream } from "./Scene00"
import { Scene01Dream } from "./Scene01"
import { Scene02Dream } from "./Scene02"
import { Scene03Dream } from "./Scene03"
import { Scene04Dream } from "./Scene04"
import { Scene05Dream } from "./Scene05"
import { Scene06Dream } from "./Scene06"
import { Scene07Dream } from "./Scene07"
import { Scene07_1Dream } from "./Scene07_1"
import { Scene08Dream } from "./Scene08"
import { Scene09Dream } from "./Scene09"
import { Scene10Dream } from "./Scene10"
import { Scene11Dream } from "./Scene11"
import { Scene12Dream } from "./Scene12"

/**
 * The chapters' t0s in video time — each one the alignment its scene
 * was scored at, read off that scene's own header. Kept as t0s rather
 * than spans because the t0 is the measured quantity; the spans are
 * differences, and deriving them is what keeps the two consistent.
 *
 * The final entry is the video's own duration (377.888s), which closes
 * the last chapter's window.
 */
const BOUNDARIES = [
  0, // o00   the line portrait
  13.0, // o01   the kinship graph → dialectic
  71.0, // o02   the pie splitting
  96.0, // o03   the global system
  125.0, // o04   the pie, coloured
  142.0, // o05   the logo + title
  154.0, // o06   the origin story (audio cue; first ink at 154.6)
  233.0, // o07   code ↔ idea (audio cue; first ink at 237.8)
  280.7, // o07_1 the head and the idea chain
  292.8, // o08   the four applications
  320.85, // o09   the logo, slowly
  345.8, // o10   big tech and the cylinder
  360.2, // o11   the return
  371.2, // o12   the closing title
  377.888, // the last frame of the published video
] as const

/** The published video's duration — the song's, by construction. */
export const ORIGINS_DURATION = BOUNDARIES[BOUNDARIES.length - 1]!

/** The chapter classes, in film order. */
const CHAPTERS = [
  Scene00Dream,
  Scene01Dream,
  Scene02Dream,
  Scene03Dream,
  Scene04Dream,
  Scene05Dream,
  Scene06Dream,
  Scene07Dream,
  Scene07_1Dream,
  Scene08Dream,
  Scene09Dream,
  Scene10Dream,
  Scene11Dream,
  Scene12Dream,
] as const

/**
 * The chapters' video-time t0s, exported so the offset tests and the
 * spot-scoring can assert against the same numbers the song is built
 * from rather than a transcribed copy of them.
 */
export const ORIGINS_T0 = BOUNDARIES.slice(0, CHAPTERS.length) as readonly number[]

export class OriginsPitchDream extends DreamSong {
  constructor() {
    super(
      CHAPTERS.map((scene, i) => ({
        scene,
        span: BOUNDARIES[i + 1]! - BOUNDARIES[i]!,
      })),
    )
  }
}

if (import.meta.main) render(OriginsPitchDream)
