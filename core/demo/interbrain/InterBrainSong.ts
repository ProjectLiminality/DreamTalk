/**
 * InterBrainSong.ts — A DreamSong
 *
 * "The InterBrain – How Collective DreamWeaving Can Heal the World" (2025,
 * corpus #14), whole: the eight chapters as ONE composition, carrying
 * David's own narration. Song time = video time, so reference frame
 * refs/interbrain/frames5/f_N sits at T = (N − 1)/5, and the song's 2835 s
 * is the film's.
 *
 * Reverse-engineered from the pixels (the production folder is lost —
 * docs/reports/interbrain-vocabulary.md): every symbol is a vocabulary holon
 * (the film's concepts, §4), every chapter a composition that imports them
 * (ib-ch1 … ib-ch8). The chapters butt edge to edge: each opens on its own
 * dip from black into its title card (film.ts), which is how the film's
 * music bridges read, so the song cuts between them.
 *
 * THE NARRATION is the song's score, not any chapter's (as in Web3Song):
 * narration.ts holds the transcript's lines at the film's times, and
 * import-narration.ts cuts each one out of the film's own soundtrack into
 * the voice cache, so say() plays David. The score (3Blue1Brown, Pink Floyd)
 * is not carried — audio beyond the voice is out of scope (CORPUS.md).
 */

import { DreamSong } from "../../src/song"
import { CHAPTERS } from "./film"
import { NARRATION, NARRATION_VOICE } from "./narration"
import { Ch1ThirdAttractorDream } from "./Ch1ThirdAttractor"
import { Ch2ArmsRaceDream } from "./Ch2ArmsRace"
import { Ch3ViciousCycleDream } from "./Ch3ViciousCycle"
import { Ch4GoingUpstreamDream } from "./Ch4GoingUpstream"
import { Ch5FixingTheLensDream } from "./Ch5FixingTheLens"
import { Ch6IntroducingInterBrainDream } from "./Ch6IntroducingInterBrain"
import { Ch7BreakingTheSpellDream } from "./Ch7BreakingTheSpell"
import { Ch8NewBeginningDream } from "./Ch8NewBeginning"

const SCENES = [
  Ch1ThirdAttractorDream,
  Ch2ArmsRaceDream,
  Ch3ViciousCycleDream,
  Ch4GoingUpstreamDream,
  Ch5FixingTheLensDream,
  Ch6IntroducingInterBrainDream,
  Ch7BreakingTheSpellDream,
  Ch8NewBeginningDream,
] as const

export class InterBrainSongDream extends DreamSong {
  /**
   * Lazy by default (song.ts LAZY CONSTRUCTION): every chapter declares its
   * span (the film's own cuts), so only the chapters near the playhead are
   * built — a whole-film walker asks for `{ lazy: false }`.
   */
  constructor(opts: { lazy?: boolean } = {}) {
    super(
      SCENES.map((scene, k) => ({ scene, span: CHAPTERS[k]!.end - CHAPTERS[k]!.start })),
      { lazy: opts.lazy ?? true },
    )
  }

  /** The narration first, at absolute times; then the chapters from 0. */
  override unfold(): void {
    let cursor = 0
    for (const [start, duration, text] of NARRATION) {
      this.wait(start - cursor)
      cursor = start
      this.say(text, { voice: NARRATION_VOICE, duration })
    }
    this.wait(-cursor)
    super.unfold()
  }
}
