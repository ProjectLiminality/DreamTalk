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
 * TRANSITIONS (ONTOLOGY "Magic Move: one operator, self-similar across
 * levels"; transitions.ts): a chapter entry may carry the transition
 * INTO it — `[S02, magicMove(1.5)]` — which starts its offset that many
 * seconds BEFORE the previous chapter ends. Inside the overlap window
 * both chapters are live and the window is one more pure layer over the
 * ordinary sampling:
 *
 *  - `crossfade(d)`: A's holons ramp opacity 1 → 0 and B's 0 → 1,
 *    linearly across the window;
 *  - `magicMove(d)`: A's and B's ROOT holons are matched by
 *    (class, field identity), falling back to (class, structural index)
 *    — matched pairs GLIDE (transform, tint, stroke lerped between the
 *    two chapters' own sampled values, eased C4D-smooth, written onto
 *    both twins so they coincide), unmatched A builds out over the first
 *    40% of the window, unmatched B builds in over the final 40%, and
 *    the observer always matches itself: the camera glides between the
 *    scenes' perspectives.
 *
 *  Every window write is recomputed from t alone each sample (glided
 *  params are restored — driven ones by apply(t), undriven ones to their
 *  declared default — whenever t is outside the window), so scrubbing
 *  backward through a transition is bit-identical to scrubbing forward.
 *
 * Two pieces of documented pragmatism, both scaffolding until the
 * Dream/Holon unification delivers the clean form:
 *
 *  - HIDING: inactive chapters are hidden by forcing opacity = 0 on
 *    every holon of their trees after each apply. It must be every holon,
 *    not just the roots, because the host reads each stroke's own
 *    opacity (there is no cascaded group opacity yet). Re-applied from
 *    the timeline-or-default on the live chapters each sample, so the
 *    write is idempotent in t — purity holds.
 *  - OBSERVER: each chapter carries its own Observer (its unfold() sets
 *    perspectives imperatively; its clips may dolly it). The host reads
 *    the SONG's observer, so each apply mirrors the active chapter's
 *    observer params onto it, value for value. A cut between scenes is
 *    then also a cut between rigs, which is what the 2021 renders do;
 *    inside a transition window the mirror carries the lerp of the two
 *    rigs instead.
 */

import { Dream, type DreamClass } from "./dream"
import type { Holon } from "./holon"
import type { Param, ParamValue } from "./params"
import {
  buildIn,
  buildOut,
  lerpParamValue,
  matchRoots,
  matchedParams,
  smooth,
  type ParamPair,
  type Transition,
} from "./transitions"

/**
 * A scene entry: a scene class, optionally with an explicit window
 * `span` (seconds). Without one the chapter occupies exactly its own
 * duration. An explicit span longer than the chapter holds its final
 * frame (the timeline's own hold rule); a shorter one cuts the tail off
 * visually while the params keep evaluating underneath.
 */
export type SceneSpec = DreamClass | { scene: DreamClass; span?: number }

/**
 * A chapter entry: a scene, optionally paired with the transition INTO
 * it — `[S02, magicMove(1.5)]`. A bare entry cuts (transitions.ts `cut`).
 */
export type ChapterSpec = SceneSpec | [SceneSpec, Transition]

export interface Chapter {
  dream: Dream
  /** Global song time at which this chapter's local t = 0. */
  offset: number
  /** The window [offset, offset + span) this chapter is visible in. */
  span: number
  /** The transition INTO this chapter, when it overlaps (duration > 0). */
  transition?: Transition
}

/** One resolved overlap window between two adjacent chapters. */
interface TransitionWindow {
  kind: "crossfade" | "magicMove"
  start: number
  end: number
  /** Chapter indices: `from` fades/builds out, `into` fades/builds in. */
  from: number
  into: number
  /** magicMove only — the glided param pairs of the matched roots. */
  pairs: ParamPair[]
  /** magicMove only — subtree holons of unmatched `from` roots. */
  outs: Holon[]
  /** magicMove only — subtree holons of unmatched `into` roots. */
  ins: Holon[]
}

export class DreamSong extends Dream {
  readonly #specs: readonly ChapterSpec[]
  #chapters: Chapter[] = []
  /** Per-chapter flattened holon trees (visibility gating), cached. */
  #holons?: Holon[][]
  /** Params the composite timeline drives, cached. */
  #driven?: Set<Param<ParamValue>>
  /** Resolved transition windows (chapter order — disjoint), cached. */
  #windows?: TransitionWindow[]

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
   * own clips stop short of its span. A transition INTO a chapter pulls
   * its offset (and the cursor) back by the overlap, so the total
   * duration is the sum of the spans minus the sum of the overlaps.
   */
  unfold(): void {
    let offset = 0
    let prev: Chapter | undefined
    for (const spec of this.#specs) {
      const [scene, transition] = Array.isArray(spec) ? spec : [spec, undefined]
      const SceneCtor = typeof scene === "function" ? scene : scene.scene
      const dream = new SceneCtor()
      const span = (typeof scene === "function" ? undefined : scene.span) ?? dream.duration
      const d = transition?.duration ?? 0
      if (d > 0) {
        if (!prev) {
          throw new Error("DreamSong: the first chapter has no boundary to transition across")
        }
        const room = prev.span - (prev.transition?.duration ?? 0)
        if (d > room || d > span) {
          throw new Error(
            `DreamSong: a ${d}s ${transition!.kind} does not fit its adjacent chapters` +
              ` (${room}s of '${prev.dream.constructor.name}' remain, incoming span ${span}s)`,
          )
        }
        offset -= d
        this.wait(-d)
      }
      for (const clip of dream.clips) {
        const placed = this.play(clip.anim, clip.duration)
        placed.start = offset + clip.start
        this.wait(-clip.duration)
      }
      for (const root of dream.roots) this.stage(root)
      const chapter: Chapter = { dream, offset, span }
      if (d > 0) chapter.transition = transition
      this.#chapters.push(chapter)
      this.wait(span)
      offset += span
      prev = chapter
    }
  }

  /**
   * The chapter whose window contains t — the one a cut shows. Windows
   * are half-open [offset, offset + span) and contiguous, so this is
   * "the last chapter whose offset <= t"; before the first window the
   * first chapter answers, after the last window the last one does.
   * Inside a transition's overlap the answer is the INCOMING chapter —
   * the weighted pair a transition shows lives in applyAt().
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

  /** Lazy caches: holon trees, driven set, resolved transition windows. */
  #resolve(): { holons: Holon[][]; driven: Set<Param<ParamValue>>; windows: TransitionWindow[] } {
    if (!this.#holons || !this.#driven || !this.#windows) {
      const timeline = this.build()
      this.#holons = this.#chapters.map((ch) =>
        ch.dream.roots.flatMap((root) => [...root.walk()]),
      )
      this.#driven = new Set(timeline.params)
      this.#windows = []
      for (let i = 1; i < this.#chapters.length; i++) {
        const ch = this.#chapters[i]!
        const transition = ch.transition
        if (!transition || transition.kind === "cut") continue
        const window: TransitionWindow = {
          kind: transition.kind,
          start: ch.offset,
          end: ch.offset + transition.duration,
          from: i - 1,
          into: i,
          pairs: [],
          outs: [],
          ins: [],
        }
        if (transition.kind === "magicMove") {
          const a = this.#chapters[i - 1]!
          const match = matchRoots(a.dream, a.dream.roots, ch.dream, ch.dream.roots)
          window.pairs = match.pairs.flatMap(([ra, rb]) => matchedParams(ra, rb))
          window.outs = match.outs.flatMap((root) => [...root.walk()])
          window.ins = match.ins.flatMap((root) => [...root.walk()])
        }
        this.#windows.push(window)
      }
    }
    return { holons: this.#holons, driven: this.#driven, windows: this.#windows }
  }

  /**
   * Pure sample-and-apply at global t: evaluate the composite timeline,
   * lay the transition overlay, gate visibility to the live chapters,
   * mirror (or glide) the observer. Every write is a function of t
   * alone — sampling order cannot matter.
   */
  override applyAt(t: number): void {
    const timeline = this.build()
    timeline.apply(t)
    const { holons, driven, windows } = this.#resolve()

    // The one window containing t (unfold() sizes them disjoint).
    const window = windows.find((w) => t >= w.start && t < w.end)

    // Glide overlay: outside a window every glided param is restored —
    // driven ones by apply(t) above, undriven ones to their declared
    // default (a previous sample inside the window wrote them).
    for (const w of windows) {
      if (w === window || w.kind !== "magicMove") continue
      for (const { a, b } of w.pairs) {
        if (!driven.has(a)) a.value = a.defaultValue
        if (!driven.has(b)) b.value = b.defaultValue
      }
    }
    if (window && window.kind === "magicMove") {
      const e = smooth((t - window.start) / (window.end - window.start))
      for (const { a, b } of window.pairs) {
        const av = driven.has(a) ? a.value : a.defaultValue
        const bv = driven.has(b) ? b.value : b.defaultValue
        const v = lerpParamValue(av, bv, e)
        a.value = v
        b.value = v
      }
    }

    // Visibility: the live chapters show (their driven opacity already
    // applied, undriven restored to default); every other tree is hidden.
    const active = this.chapterAt(t)
    const fromChapter = window ? this.#chapters[window.from]! : undefined
    for (let i = 0; i < this.#chapters.length; i++) {
      const chapter = this.#chapters[i]!
      const live = chapter === active || chapter === fromChapter
      for (const holon of holons[i]!) {
        if (!live) {
          holon.opacity.value = 0
        } else if (!driven.has(holon.opacity as Param<ParamValue>)) {
          holon.opacity.value = holon.opacity.defaultValue
        }
      }
    }

    // Transition ramps, multiplied onto the freshly established opacity.
    if (window) {
      const u = (t - window.start) / (window.end - window.start)
      if (window.kind === "crossfade") {
        for (const holon of holons[window.from]!) holon.opacity.value *= 1 - u
        for (const holon of holons[window.into]!) holon.opacity.value *= u
      } else {
        const out = buildOut(u)
        const into = buildIn(u)
        for (const holon of window.outs) holon.opacity.value *= out
        for (const holon of window.ins) holon.opacity.value *= into
      }
    }

    // Observer: the active rig, or — inside a window — the two rigs'
    // lerp (the camera always matches itself; a crossfade's single
    // camera has to travel too, on the same ramp as its opacity).
    const mirror = this.observer.params
    if (window) {
      const u = (t - window.start) / (window.end - window.start)
      const e = window.kind === "magicMove" ? smooth(u) : u
      const aObs = this.#chapters[window.from]!.dream.observer.params
      const bObs = this.#chapters[window.into]!.dream.observer.params
      for (const [name, target] of mirror) {
        const pa = aObs.get(name)
        const pb = bObs.get(name)
        if (pa && pb) target.value = lerpParamValue(pa.value, pb.value, e)
      }
    } else {
      for (const [name, param] of active.dream.observer.params) {
        const target = mirror.get(name)
        if (target) target.value = param.value
      }
    }
  }
}
