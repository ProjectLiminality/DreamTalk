/**
 * DialecticalThinking.ts — A DreamSong
 *
 * video-01 "Dialectical Thinking" (2021), whole: the ten scenes as
 * chapters of ONE composition, cut back-to-back exactly where the
 * reference cuts (ONTOLOGY.md "The DreamSong: one file, linear, one
 * import set"). The intro logo (video 0–6s) stays excluded while
 * GATES #1 is unanswered, so the song covers video 6s–157s and a
 * global song time T sits over reference frame (T + 6) * 5.
 *
 * Each chapter's window is its REFERENCE span (video-01.md's scene
 * table), not the chapter's own duration. The two differ, and the
 * difference is meaningful, not sloppy:
 *
 *   chapter   own (s)   ref span (s)   why they differ
 *   S01       26.000    26             —
 *   S02       26.035    26             +0.035 lead-in wait
 *   S03       22.683    24             ends early, final frame holds
 *   S04        6.710    7              leading wait carried NEGATIVE
 *   S05       10.740    9.5            outro runs past the ref cut
 *   S06       15.300    16             ends early, holds
 *   S07        3.830    6              0.83s lead + early end
 *   S08       17.890    19.5           2.11s of clips BEFORE its cut
 *   S09       10.420    10.5           ends early, holds
 *   S10        5.970    6.5            0.03s negative lead, early end
 *
 * Every scene passed its gauntlet against localT = videoSec - refStart,
 * so the reference spans are the offsets that keep a chapter's in-song
 * frames IDENTICAL to its standalone ones. A chapter shorter than its
 * window holds its last frame (the timeline's hold rule — which is what
 * the reference shows too: those scenes hold before their cut); clips
 * spilling outside a window (S04, S08, S10 lead-ins; S05's tail)
 * evaluate but stay hidden until their chapter's cut — the same
 * structure a future Magic Move overlap will sample openly.
 */

import { render } from "../../src/index"
import { DreamSong } from "../../src/song"
import { S01Dream } from "./S01"
import { S02Dream } from "./S02"
import { S03Dream } from "./S03"
import { S04Dream } from "./S04"
import { S05Dream } from "./S05"
import { S06Dream } from "./S06"
import { S07Dream } from "./S07"
import { S08Dream } from "./S08"
import { S09Dream } from "./S09"
import { S10Dream } from "./S10"

export class DialecticalThinkingDream extends DreamSong {
  constructor() {
    super([
      { scene: S01Dream, span: 26 }, // video   6 –  32
      { scene: S02Dream, span: 26 }, // video  32 –  58
      { scene: S03Dream, span: 24 }, // video  58 –  82
      { scene: S04Dream, span: 7 }, // video  82 –  89
      { scene: S05Dream, span: 9.5 }, // video  89 –  98.5
      { scene: S06Dream, span: 16 }, // video  98.5 – 114.5
      { scene: S07Dream, span: 6 }, // video 114.5 – 120.5
      { scene: S08Dream, span: 19.5 }, // video 120.5 – 140
      { scene: S09Dream, span: 10.5 }, // video 140 – 150.5
      { scene: S10Dream, span: 6.5 }, // video 150.5 – 157
    ])
  }
}

if (import.meta.main) render(DialecticalThinkingDream)
