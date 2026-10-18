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
 *  - `slide(d)`: Keynote's Push — A's and B's ROOT holons are carried
 *    up one frame-height together (A from rest to the top edge, B from
 *    below the bottom edge to rest), eased C4D-smooth unless the slide
 *    states its own tangents; nothing fades unless it states a dissolve.
 *    The frame-height is each chapter's own, at its observer's distance,
 *    so the two pictures stay butted edge to edge. A root whose `y` is
 *    a derived binding cannot be carried and stays put (say so in the
 *    song if it matters).
 *
 *  Every window write is recomputed from t alone each sample (glided
 *  params are restored — driven ones by apply(t), undriven ones to their
 *  declared default — whenever t is outside the window), so scrubbing
 *  backward through a transition is bit-identical to scrubbing forward.
 *
 * Two pieces of documented pragmatism, both scaffolding until the
 * Dream/Holon unification delivers the clean form:
 *
 *  - HIDING: inactive chapters are hidden by gating opacity to 0
 *    (`Param.gate`, which also reaches a bound opacity) on every holon
 *    of their trees after each apply. It must be every holon,
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

import { Dream, orthoHalfHeight, type DreamClass, type Observer } from "./dream"
import type { Holon } from "./holon"
import type { Param, ParamValue } from "./params"
import { Timeline } from "./timeline"
import {
  buildIn,
  buildOut,
  crossfadeAt,
  dissolveAt,
  easeOf,
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
  /** The chapter's scene. In a lazy song (LAZY CONSTRUCTION) reading it constructs the chapter if it is not standing. */
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
  kind: "crossfade" | "magicMove" | "slide"
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
  /** slide only — the carried roots' `y` params, per side. */
  lifts: { from: Param<number>[]; into: Param<number>[] }
}

/**
 * The world height a chapter's camera frames at its focus — what one
 * frame of slide travel is. Perspective frames 2·r·tan(fov/2) at distance
 * r = radius/zoom (three-host syncCamera); orthographic, its half-height
 * twice. Scenes are composed for 16:9 (three-host aspect()).
 */
const frameHeight = (observer: Observer): number => {
  const zoom = observer.zoom.value || 1
  return observer.orthographic.value
    ? 2 * orthoHalfHeight(zoom, 16 / 9)
    : 2 * (observer.radius.value / zoom) * Math.tan(observer.fov.value / 2)
}

/** A chapter's carriable roots: those whose y is not a derived binding. */
const liftsOf = (dream: Dream): Param<number>[] =>
  dream.roots.filter((r) => !r.y.isBound).map((r) => r.y)

/**
 * RESIDENCY — which chapters a host keeps MOUNTED (geometry, GPU buffers,
 * render objects) at song time t. A long song cannot hold every chapter's
 * picture at once (the InterBrain film: 151k holons, ~4 GB of tab); only
 * the chapters near the playhead need to be in the host. These are pure
 * functions of the chapters' windows and t, so what is mounted never
 * depends on how the playhead got there — and since only LIVE chapters
 * draw (the gate hides the rest), what is mounted never reaches a pixel.
 *
 *  - live: on screen at t — the active chapter (chapterAt's rule: the last
 *    whose offset ≤ t, clamped at both ends) and, inside a transition's
 *    overlap, the chapter it leaves;
 *  - resident: the live ones, plus every chapter whose window opens within
 *    `ahead` seconds (mounted before its cut, so playback crosses it with
 *    the chapter's matrices settled and its shaders warm) and every chapter
 *    whose window closed less than `behind` seconds ago (a small scrub back
 *    across a cut does not remount).
 */
export interface ChapterWindow {
  offset: number
  span: number
}

/** Seconds before its cut a chapter is mounted (RESIDENCY). */
export const RESIDENT_AHEAD = 12
/** Seconds after its window a chapter stays mounted (RESIDENCY). */
export const RESIDENT_BEHIND = 2

/** The chapters on screen at t, ascending (RESIDENCY). */
export const liveChapters = (windows: readonly ChapterWindow[], t: number): number[] => {
  if (windows.length === 0) return []
  let active = 0
  for (let i = 0; i < windows.length; i++) if (t >= windows[i]!.offset) active = i
  const prev = windows[active - 1]
  // Inside an overlap the chapter left behind is still drawing.
  return prev && t >= windows[active]!.offset && t < prev.offset + prev.span ? [active - 1, active] : [active]
}

/** The chapters a host keeps mounted at t, ascending (RESIDENCY). */
export const residentChapters = (
  windows: readonly ChapterWindow[],
  t: number,
  ahead = RESIDENT_AHEAD,
  behind = RESIDENT_BEHIND,
): number[] => {
  const keep = new Set(liveChapters(windows, t))
  windows.forEach((w, i) => {
    const end = w.offset + w.span
    if ((t >= w.offset - ahead && t < w.offset) || (t >= end && t < end + behind)) keep.add(i)
  })
  return [...keep].sort((a, b) => a - b)
}

/**
 * LAZY CONSTRUCTION — a song may also not CONSTRUCT the chapters away from
 * the playhead (`new DreamSong(specs, { lazy: true })`). Residency keeps a
 * chapter out of the host; this keeps it out of the heap: its Dream, its
 * holon trees, its clips. It needs every chapter to declare its `span`, so
 * the windows, the offsets and the duration are known without building
 * one (an InterBrain-length song: eight chapters, ~600 MB of trees).
 *
 *  - Constructed: the chapters resident at the sampled t (residentAt), and
 *    up to `keep` (default 1) more, the most recently resident — a jump
 *    back to where the playhead just was does not construct again. The
 *    rest are dropped; reading `chapter.dream` constructs one on demand.
 *  - Timeline: each constructed chapter carries its own clips placed at
 *    its offset — exactly the segments the composite would hold for its
 *    params (a chapter's params are its own), with the same arithmetic —
 *    applied after the song's own clips. A chapter is a deterministic
 *    construction, so one built again is the chapter that never left:
 *    the song stays a pure function of t, bit for bit.
 *  - The song's own parts stand as before: its clips (`build()`, `clips`),
 *    its `narration` and staged holons. `roots` is the song's own plus the
 *    CONSTRUCTED chapters' — so a walker of `roots` (editor, explorer,
 *    automaton) sees the chapters near the playhead only; `ownRoots` is
 *    the song's own. `soundtrack` is the song's own score (the chapters'
 *    sounding holons are not gathered — it is read once, at boot).
 *  - `eager()` before the first build turns it back into the composite as
 *    it always was (every chapter constructed, one timeline) — for a host
 *    that mounts every chapter at once (three-host.ts, `residency: false`).
 */
export interface DreamSongOptions {
  /** Construct only the chapters near the playhead (LAZY CONSTRUCTION). Every chapter must declare its span. */
  lazy?: boolean
  /** Lazy songs: constructed chapters kept beyond the resident ones, most recent first. Default 1. */
  keep?: number
}

/** A constructed chapter of a lazy song (LAZY CONSTRUCTION). */
interface Built {
  dream: Dream
  /** The chapter's clips at its offset — the composite's segments for its params. */
  timeline: Timeline
  /** Its opacity params, once each (perf J). */
  opacities: Param<number>[]
}

/** One chapter fading as a single picture: its roots and its weight. */
export interface LayerFade {
  roots: readonly Holon[]
  opacity: number
}

export class DreamSong extends Dream {
  readonly #specs: readonly ChapterSpec[]
  #chapters: Chapter[] = []
  /** Per-chapter flattened holon trees (visibility gating), cached. */
  #holons?: Holon[][]
  /**
   * Each chapter's opacity params, resolved once (perf J): the visibility
   * pass gates every holon every frame, and reading `holon.opacity` went
   * through the holon's Proxy each time — ~32k trap calls a frame on
   * Web3. A param shared by several holons appears once: gating and
   * restoring it are idempotent, so once is the same as many.
   */
  #opacities?: Param<number>[][]
  /** Params the composite timeline drives, cached. */
  #driven?: Set<Param<ParamValue>>
  /** Resolved transition windows (chapter order — disjoint), cached. */
  #windows?: TransitionWindow[]
  /** This frame's fading chapters, as whole layers (see `layerFades`). */
  #layers: LayerFade[] = []

  /**
   * The chapters fading at the sampled t, each as ONE picture: its roots
   * and the weight the host composites it with. A crossfade or dissolve is
   * a film dissolve — each picture is flattened first, then the two are
   * mixed by weight — so a chapter's own members never show through each
   * other mid-fade (Web3's dive: the globe's sea, half-faded on its own,
   * let the lattice behind it through). The host renders each layer
   * offscreen and adds it in (three-host.ts renderLayered); empty outside
   * a crossfade/dissolve window. Magic Move is not a dissolve: it builds
   * individual holons out and in, and keeps doing so per holon.
   */
  get layerFades(): readonly LayerFade[] {
    return this.#layers
  }

  /** This frame's live chapters' roots (see `liveRoots`). */
  #live = new Set<Holon>()

  /**
   * The roots of the chapters on screen at the sampled t — the active
   * chapter and, inside a transition window, the one it leaves. Every
   * other chapter is gated to opacity 0 and draws nothing, so a host may
   * skip its per-stroke work entirely (three-host.ts, perf I-4).
   */
  get liveRoots(): ReadonlySet<Holon> {
    return this.#live
  }

  /** LAZY CONSTRUCTION: whether chapters are constructed only near the playhead. */
  #lazy: boolean
  /** Lazy: constructed chapters kept beyond the resident ones. */
  readonly #keep: number
  /** Lazy: each chapter's scene class. */
  #scenes: (new () => Dream)[] = []
  /** Lazy: the constructed chapters by index, least recently used first. */
  #built = new Map<number, Built>()
  /** Lazy: the resolved transition windows between constructed neighbours, by incoming index. */
  #lazyWindows = new Map<number, TransitionWindow>()
  /** Lazy: driven params (the song's own + the constructed chapters'), cached until the set changes. */
  #lazyDriven?: Set<Param<ParamValue>>
  /** Lazy: `roots`, cached until the constructed set changes. */
  #rootsMemo?: readonly Holon[]
  #unfolded = false

  constructor(chapters: readonly ChapterSpec[], opts: DreamSongOptions = {}) {
    super()
    this.#specs = chapters
    this.#lazy = opts.lazy ?? false
    this.#keep = opts.keep ?? 1
    if (this.#lazy) {
      for (const spec of chapters) {
        const scene = Array.isArray(spec) ? spec[0] : spec
        if (typeof scene === "function" || scene.span === undefined) {
          throw new Error("DreamSong: a lazy song needs every chapter to declare its span")
        }
      }
    }
  }

  /** LAZY CONSTRUCTION: whether this song constructs its chapters only near the playhead. */
  get lazy(): boolean {
    return this.#lazy
  }

  /**
   * Construct every chapter up front — the composite as it always was —
   * for a host that mounts the whole song at once. Only before the song
   * is built; a song that is not lazy is unchanged.
   */
  eager(): void {
    if (!this.#lazy) return
    if (this.#unfolded) throw new Error("DreamSong.eager(): the song is already built lazily")
    this.#lazy = false
  }

  /** Lazy: the chapters constructed now, ascending (every chapter, for a song that is not lazy). */
  get constructed(): number[] {
    if (!this.#lazy) return this.chapters.map((_, i) => i)
    return [...this.#built.keys()].sort((a, b) => a - b)
  }

  /** The song's own roots — its staged and animated holons, no chapter's. */
  get ownRoots(): readonly Holon[] {
    return this.#lazy ? super.roots : this.roots
  }

  /** Chapter i's roots, constructing it if a lazy song has not (or no longer has). */
  chapterRoots(i: number): readonly Holon[] {
    return this.chapters[i]!.dream.roots
  }

  /** Lazy: the song's own roots and the constructed chapters', in chapter order (LAZY CONSTRUCTION). */
  override get roots(): readonly Holon[] {
    const own = super.roots
    if (!this.#lazy) return own
    this.#rootsMemo ??= [
      ...own,
      ...[...this.#built.keys()].sort((a, b) => a - b).flatMap((i) => this.#built.get(i)!.dream.roots),
    ]
    return this.#rootsMemo
  }

  /** A lazy song's soundtrack is its own score (LAZY CONSTRUCTION). */
  protected override get soundingRoots(): readonly Holon[] {
    return this.ownRoots
  }

  /** Lazy: chapter i, constructed if it is not standing, and marked most recently used. */
  #construct(i: number): Built {
    let built = this.#built.get(i)
    if (built) {
      this.#built.delete(i)
      this.#built.set(i, built)
      return built
    }
    const offset = this.#chapters[i]!.offset
    const dream = new this.#scenes[i]!()
    // Placed exactly as unfold() places an eager chapter's clips.
    const placed = dream.clips.map((clip) => ({ anim: clip.anim, start: offset + clip.start, duration: clip.duration }))
    const holons = dream.roots.flatMap((root) => [...root.walk()])
    built = { dream, timeline: new Timeline(placed), opacities: [...new Set(holons.map((h) => h.opacity))] }
    this.#built.set(i, built)
    this.#lazyChanged()
    return built
  }

  /** Lazy: drop the constructed chapters beyond the resident ones and the `keep` most recent. */
  #evict(resident: readonly number[]): void {
    let spare = this.#keep
    let changed = false
    // Only a window resolved (and so possibly glided) has anything to put back.
    const driven = this.#lazyWindows.size > 0 ? this.#lazyResolve().driven : undefined
    for (const i of [...this.#built.keys()].reverse()) {
      if (resident.includes(i)) continue
      if (spare > 0) {
        spare--
        continue
      }
      // A window touching it goes too — its glided params put back first.
      for (const [into, w] of this.#lazyWindows) {
        if (w.from !== i && w.into !== i) continue
        this.#restoreWindow(w, driven!)
        this.#lazyWindows.delete(into)
      }
      this.#built.delete(i)
      changed = true
    }
    if (changed) this.#lazyChanged()
  }

  #lazyChanged(): void {
    this.#lazyDriven = undefined
    this.#rootsMemo = undefined
  }

  /** Lazy: driven params and the windows between constructed neighbours. */
  #lazyResolve(): { driven: Set<Param<ParamValue>>; windows: TransitionWindow[] } {
    if (!this.#lazyDriven) {
      const driven = new Set(this.build().params)
      for (const built of this.#built.values()) for (const p of built.timeline.params) driven.add(p)
      this.#lazyDriven = driven
      for (const i of [...this.#built.keys()]) {
        if (i === 0 || !this.#built.has(i - 1) || this.#lazyWindows.has(i)) continue
        const w = this.#windowInto(i)
        if (w) this.#lazyWindows.set(i, w)
      }
    }
    return {
      driven: this.#lazyDriven,
      windows: [...this.#lazyWindows.values()].sort((a, b) => a.start - b.start),
    }
  }

  /** The placed chapters. Building the song is what places them. */
  get chapters(): readonly Chapter[] {
    this.build()
    return this.#chapters
  }

  /**
   * The chapters a host keeps mounted at song time t (RESIDENCY above) —
   * a pure function of the chapters' windows and t. The host
   * (three-host.ts) mounts each chapter's roots when it enters this set
   * and releases them when it leaves.
   */
  residentAt(t: number): number[] {
    return residentChapters(this.chapters, t)
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
    this.#unfolded = true
    let offset = 0
    let prev: Chapter | undefined
    let prevName = ""
    for (const [index, spec] of this.#specs.entries()) {
      const [scene, transition] = Array.isArray(spec) ? spec : [spec, undefined]
      const SceneCtor = typeof scene === "function" ? scene : scene.scene
      // LAZY CONSTRUCTION: the window is the declared span; nothing is built.
      const dream = this.#lazy ? undefined : new SceneCtor()
      const span = (typeof scene === "function" ? undefined : scene.span) ?? dream!.duration
      const d = transition?.duration ?? 0
      if (d > 0) {
        if (!prev) {
          throw new Error("DreamSong: the first chapter has no boundary to transition across")
        }
        const room = prev.span - (prev.transition?.duration ?? 0)
        if (d > room || d > span) {
          throw new Error(
            `DreamSong: a ${d}s ${transition!.kind} does not fit its adjacent chapters` +
              ` (${room}s of '${prevName}' remain, incoming span ${span}s)`,
          )
        }
        offset -= d
        this.wait(-d)
      }
      let chapter: Chapter
      if (dream) {
        for (const clip of dream.clips) {
          const placed = this.play(clip.anim, clip.duration)
          placed.start = offset + clip.start
          this.wait(-clip.duration)
        }
        for (const root of dream.roots) this.stage(root)
        chapter = { dream, offset, span }
      } else {
        const construct = () => this.#construct(index).dream
        this.#scenes.push(SceneCtor)
        chapter = {
          offset,
          span,
          get dream() {
            return construct()
          },
        }
      }
      if (d > 0) chapter.transition = transition
      this.#chapters.push(chapter)
      this.wait(span)
      offset += span
      prev = chapter
      prevName = SceneCtor.name
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
      this.#opacities = this.#holons.map((hs) => [...new Set(hs.map((h) => h.opacity))])
      this.#driven = new Set(timeline.params)
      this.#windows = []
      for (let i = 1; i < this.#chapters.length; i++) {
        const window = this.#windowInto(i)
        if (window) this.#windows.push(window)
      }
    }
    return { holons: this.#holons, driven: this.#driven, windows: this.#windows }
  }

  /** The transition window into chapter i, resolved — undefined for a cut. */
  #windowInto(i: number): TransitionWindow | undefined {
    const ch = this.#chapters[i]!
    const transition = ch.transition
    if (!transition || transition.kind === "cut") return undefined
    const window: TransitionWindow = {
      kind: transition.kind,
      start: ch.offset,
      end: ch.offset + transition.duration,
      from: i - 1,
      into: i,
      pairs: [],
      outs: [],
      ins: [],
      lifts: { from: [], into: [] },
    }
    if (transition.kind === "magicMove") {
      const a = this.#chapters[i - 1]!
      const match = matchRoots(a.dream, a.dream.roots, ch.dream, ch.dream.roots)
      window.pairs = match.pairs.flatMap(([ra, rb]) => matchedParams(ra, rb))
      window.outs = match.outs.flatMap((root) => [...root.walk()])
      window.ins = match.ins.flatMap((root) => [...root.walk()])
    }
    if (transition.kind === "slide") {
      window.lifts = { from: liftsOf(this.#chapters[i - 1]!.dream), into: liftsOf(ch.dream) }
    }
    return window
  }

  /** Put a window's glided params back: driven ones are the timeline's, undriven ones their default. */
  #restoreWindow(w: TransitionWindow, driven: Set<Param<ParamValue>>): void {
    for (const { a, b } of w.pairs) {
      if (!driven.has(a)) a.value = a.defaultValue
      if (!driven.has(b)) b.value = b.defaultValue
    }
    for (const y of [...w.lifts.from, ...w.lifts.into]) if (!driven.has(y as Param<ParamValue>)) y.value = y.defaultValue
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
    // LAZY CONSTRUCTION: the resident chapters stand and sample their own
    // placed clips; the rest are dropped (all but the `keep` most recent).
    if (this.#lazy) {
      const resident = this.residentAt(t)
      for (const i of resident) this.#construct(i).timeline.apply(t)
      this.#evict(resident)
    }
    const { driven, windows } = this.#lazy ? this.#lazyResolve() : this.#resolve()
    const opacitiesOf = (i: number): readonly Param<number>[] | undefined =>
      this.#lazy ? this.#built.get(i)?.opacities : this.#opacities![i]

    // The one window containing t (unfold() sizes them disjoint).
    const window = windows.find((w) => t >= w.start && t < w.end)

    // Glide overlay: outside a window every glided param is restored —
    // driven ones by apply(t) above, undriven ones to their declared
    // default (a previous sample inside the window wrote them).
    for (const w of windows) if (w !== window) this.#restoreWindow(w, driven)
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

    if (window && window.kind === "slide") {
      const ease = easeOf(this.#chapters[window.into]!.transition)
      const e = ease((t - window.start) / (window.end - window.start))
      const lift = (ys: Param<number>[], dy: number) => {
        for (const y of ys) y.value = (driven.has(y as Param<ParamValue>) ? y.value : y.defaultValue) + dy
      }
      lift(window.lifts.from, e * frameHeight(this.#chapters[window.from]!.dream.observer))
      lift(window.lifts.into, (e - 1) * frameHeight(this.#chapters[window.into]!.dream.observer))
    }

    // Visibility: the live chapters show (their driven opacity already
    // applied, undriven restored to default); every other tree is hidden.
    // Hiding and ramping go through the opacity's GATE (params.ts), not its
    // value: a bound opacity — a holon whose fade follows a driver — cannot
    // be written, and the gate scales either kind of reading alike.
    const active = this.chapterAt(t)
    const fromChapter = window ? this.#chapters[window.from]! : undefined
    this.#live = new Set()
    for (let i = 0; i < this.#chapters.length; i++) {
      const chapter = this.#chapters[i]!
      // A lazy song's dropped chapters have nothing to gate (a live one always stands).
      const opacities = opacitiesOf(i)
      if (!opacities) continue
      const live = chapter === active || chapter === fromChapter
      if (live) for (const root of chapter.dream.roots) this.#live.add(root)
      for (const opacity of opacities) {
        opacity.gate = live ? 1 : 0
        if (live && !opacity.isBound && !driven.has(opacity as Param<ParamValue>)) {
          opacity.value = opacity.defaultValue
        }
      }
    }

    // Transition ramps, multiplied onto the freshly established gate —
    // once per opacity PARAM, not per holon: holons may share one opacity
    // (FlowerText's thousand ringlets carry the word's single
    // circleOpacity), and ramping it once per sharer took a crossfaded
    // word to 0.97^1000 in a frame.
    this.#layers = []
    if (window) {
      const u = (t - window.start) / (window.end - window.start)
      const ramp = (hs: readonly Holon[], k: number) => {
        for (const opacity of new Set(hs.map((h) => h.opacity))) opacity.gate *= k
      }
      // A dissolve fades each chapter as one layer, not leaf by leaf.
      const layer = (i: number, opacity: number) =>
        this.#layers.push({ roots: this.#chapters[i]!.dream.roots, opacity })
      if (window.kind === "crossfade") {
        const f = crossfadeAt(this.#chapters[window.into]!.transition, u)
        layer(window.from, f.from)
        layer(window.into, f.into)
      } else if (window.kind === "magicMove") {
        ramp(window.outs, buildOut(u))
        ramp(window.ins, buildIn(u))
      } else if (window.kind === "slide") {
        const d = dissolveAt(this.#chapters[window.into]!.transition, t - window.start)
        if (d !== undefined) {
          layer(window.from, d.from)
          layer(window.into, d.into)
        }
      }
    }

    // Observer: the active rig, or — inside a window — the two rigs'
    // lerp (the camera always matches itself; a crossfade's single
    // camera has to travel too, on the same ramp as its opacity).
    const mirror = this.observer.params
    if (window) {
      const u = (t - window.start) / (window.end - window.start)
      const e = window.kind === "crossfade" ? u : smooth(u)
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
