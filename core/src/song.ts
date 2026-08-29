/**
 * DreamSong — chapters composed into ONE pure timeline.
 *
 * ONTOLOGY.md: a DreamSong is a holon whose parts are scene-holons,
 * played in sequence — one file, linear, one import set. Until Dream and
 * Holon unify (Dream = Holon + chronology, queued for Ch 12), this class
 * is the pre-unification form: it treats each chapter as a
 * holon-with-a-chronology by taking the chapter's OWN clip layout and
 * placing it, verbatim, at the chapter's offset in the song's timeline
 * (EDITOR-V3 load-bearing decision 3: a composite is sampled, never
 * sequenced).
 *
 * The composite stays a pure function of t:
 *
 *  - the song's Timeline is just every chapter's clips with shifted
 *    starts — evaluation is the ordinary per-param resolution, so
 *    scrubbing anywhere is exact and nothing accumulates;
 *  - a chapter may spill clips OUTSIDE its own window (a source scene's
 *    leading negative wait puts ink before its cut; a scene longer than
 *    its reference span runs past it). The spill evaluates — that is
 *    exactly the structure a Magic Move overlap needs — but visibility
 *    is gated by the window: with cuts, only the ACTIVE chapter shows.
 *
 * Two pieces of documented pragmatism, both scaffolding until the
 * Dream/Holon unification delivers the clean form:
 *
 *  - HIDING: inactive chapters are hidden by forcing opacity = 0 on
 *    every holon of their trees after each apply. It must be every holon,
 *    not just the roots, because the host reads each stroke's own
 *    opacity (there is no cascaded group opacity yet). Re-applied from
 *    the timeline-or-default on the active chapter each sample, so the
 *    write is idempotent in t — purity holds.
 *  - OBSERVER: each chapter carries its own Observer (its unfold() sets
 *    perspectives imperatively; its clips may dolly it). The host reads
 *    the SONG's observer, so each apply mirrors the active chapter's
 *    observer params onto it, value for value. A cut between scenes is
 *    then also a cut between rigs, which is what the 2021 renders do.
 */

import { Dream, type DreamClass } from "./dream"
import type { Holon } from "./holon"
import type { Param, ParamValue } from "./params"

/**
 * A chapter: a scene class, optionally with an explicit window `span`
 * (seconds). Without one the chapter occupies exactly its own duration.
 * An explicit span longer than the chapter holds its final frame (the
 * timeline's own hold rule); a shorter one cuts the tail off visually
 * while the params keep evaluating underneath.
 */
export type ChapterSpec = DreamClass | { scene: DreamClass; span?: number }

export interface Chapter {
  dream: Dream
  /** Global song time at which this chapter's local t = 0. */
  offset: number
  /** The window [offset, offset + span) this chapter is visible in. */
  span: number
}

export class DreamSong extends Dream {
  readonly #specs: readonly ChapterSpec[]
  #chapters: Chapter[] = []
  /** Per-chapter flattened holon trees (visibility gating), cached. */
  #holons?: Holon[][]
  /** Params the composite timeline drives, cached. */
  #driven?: Set<Param<ParamValue>>

  constructor(chapters: readonly ChapterSpec[]) {
    super()
    this.#specs = chapters
  }

  /** The placed chapters. Building the song is what places them. */
  get chapters(): readonly Chapter[] {
    this.build()
    return this.#chapters
  }

  /**
   * One composite timeline: each chapter's clips at its offset. play()
   * owns the clip list and the cursor, so each borrowed clip is played
   * where the cursor stands, rewound, and restated at its true start;
   * the per-chapter wait(span) then walks the cursor across the song so
   * the total duration is the sum of the windows even where a chapter's
   * own clips stop short of its span.
   */
  unfold(): void {
    let offset = 0
    for (const spec of this.#specs) {
      const SceneCtor = typeof spec === "function" ? spec : spec.scene
      const dream = new SceneCtor()
      const span = (typeof spec === "function" ? undefined : spec.span) ?? dream.duration
      for (const clip of dream.clips) {
        const placed = this.play(clip.anim, clip.duration)
        placed.start = offset + clip.start
        this.wait(-clip.duration)
      }
      this.#chapters.push({ dream, offset, span })
      this.wait(span)
      offset += span
    }
  }

  /**
   * The chapter whose window contains t — the one a cut shows. Windows
   * are half-open [offset, offset + span) and contiguous, so this is
   * "the last chapter whose offset <= t"; before the first window the
   * first chapter answers, after the last window the last one does.
   * Transitions later generalize this single answer to a weighted set
   * over an overlap window — the offsets/spans already carry everything
   * that needs.
   */
  chapterAt(t: number): Chapter {
    const chapters = this.chapters
    if (chapters.length === 0) throw new Error("DreamSong has no chapters")
    let active = chapters[0]!
    for (const chapter of chapters) {
      if (t >= chapter.offset) active = chapter
    }
    return active
  }

  /**
   * Pure sample-and-apply at global t: evaluate the composite timeline,
   * gate visibility to the active chapter, mirror its observer. Every
   * write is a function of t alone — sampling order cannot matter.
   */
  override applyAt(t: number): void {
    const timeline = this.build()
    timeline.apply(t)

    if (!this.#holons || !this.#driven) {
      this.#holons = this.#chapters.map((ch) =>
        ch.dream.roots.flatMap((root) => [...root.walk()]),
      )
      this.#driven = new Set(timeline.params)
    }

    const active = this.chapterAt(t)
    for (let i = 0; i < this.#chapters.length; i++) {
      const hidden = this.#chapters[i] !== active
      for (const holon of this.#holons[i]!) {
        if (hidden) {
          holon.opacity.value = 0
        } else if (!this.#driven.has(holon.opacity as Param<ParamValue>)) {
          // apply(t) restored the driven ones; undriven opacity must be
          // put back to its declared default or last sample's hide sticks.
          holon.opacity.value = holon.opacity.defaultValue
        }
      }
    }

    const mirror = this.observer.params
    for (const [name, param] of active.dream.observer.params) {
      const target = mirror.get(name)
      if (target) target.value = param.value
    }
  }
}
