/**
 * speculate.ts — reading ahead: while the pen rests, the page asks the
 * recognizer about the ink ✦ would most likely be pressed on, so that when
 * ✦ comes the answer is already there.
 *
 *   WHAT   the selection, if there is one; otherwise the LIKELY selection —
 *          the burst just drawn (likelySelection): the last stroke and every
 *          earlier one that touches the cluster it grows, walking back.
 *   WHEN   after the page has been idle IDLE_MS (pen up, no gesture in
 *          progress); every change restarts the wait.
 *   HOW    one reading in flight at most; a new target aborts the old one.
 *          Answers are kept by inkKey (the same key the daemon remembers by),
 *          so ✦ on that ink returns at once — or waits out the reading
 *          already running instead of starting another.
 *   COST   only when the daemon has a FAST backend (GET /api/recognize/config
 *          says `speculate`): never the CLI, whose reading costs seconds and
 *          money. Off, it does nothing at all.
 *
 * Pure apart from the timers it is handed: the tests drive it with fakes.
 */

import type { InkStroke, RecognizeRequest, RecognizeResponse } from "./protocol"

/** How long the page must rest before it reads ahead. */
export const IDLE_MS = 300

/** The ink + imports a reading is of (the daemon hashes the same string). */
export const inkKey = (req: Pick<RecognizeRequest, "strokes" | "vocabulary">): string => {
  const parts: string[] = [[...(req.vocabulary ?? [])].sort().join(",")]
  for (const s of [...req.strokes].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const a = s.points[0], b = s.points[s.points.length - 1]
    parts.push(`${s.id}:${s.points.length}:${a ? `${Math.round(a.x)},${Math.round(a.y)}` : ""}:${b ? `${Math.round(b.x)},${Math.round(b.y)}` : ""}`)
  }
  return parts.join("|")
}

type Box = { x0: number; y0: number; x1: number; y1: number }

const boxOf = (k: InkStroke): Box | undefined => {
  if (k.points.length === 0) return undefined
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of k.points) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y)
  }
  return { x0, y0, x1, y1 }
}

const gapBetween = (a: Box, b: Box): number =>
  Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1))

/**
 * The burst just drawn: from the newest stroke back, every stroke within
 * reach of the cluster so far (a gap under a third of its size, at least
 * `minGap`), stopping at the first that isn't — what a lasso around "the
 * thing I just drew" would catch.
 */
export const likelySelection = (strokes: readonly InkStroke[], minGap = 40, max = 120): InkStroke[] => {
  const out: InkStroke[] = []
  let cluster: Box | undefined
  for (let i = strokes.length - 1; i >= 0 && out.length < max; i--) {
    const b = boxOf(strokes[i]!)
    if (!b) continue
    if (cluster) {
      const reach = Math.max(minGap, Math.hypot(cluster.x1 - cluster.x0, cluster.y1 - cluster.y0) / 3)
      if (gapBetween(b, cluster) > reach) break
    }
    out.push(strokes[i]!)
    cluster = cluster
      ? { x0: Math.min(cluster.x0, b.x0), y0: Math.min(cluster.y0, b.y0), x1: Math.max(cluster.x1, b.x1), y1: Math.max(cluster.y1, b.y1) }
      : b
  }
  return out.reverse()
}

export interface SpeculatorOptions {
  /** Ask the recognizer (ahead of ✦), abortable. */
  ask: (req: RecognizeRequest, signal: AbortSignal) => Promise<RecognizeResponse>
  /** The ink + imports → the request ✦ would send (the crop PNG is rendered here). */
  build: (strokes: InkStroke[], vocabulary: string[]) => RecognizeRequest
  /** False while a gesture is in progress or ✦ is thinking: wait longer. */
  isIdle?: () => boolean
  /** A reading arrived (the page may show its ✦ as ready). */
  onReady?: () => void
  idleMs?: number
  timers?: { set: (f: () => void, ms: number) => unknown; clear: (h: unknown) => void }
}

interface Flight {
  key: string
  ctrl: AbortController
  promise: Promise<RecognizeResponse>
}

/** How many finished readings are kept (a few recent bursts). */
const KEEP = 8

export class Speculator {
  /** Off until the daemon says a fast backend exists. */
  enabled = false
  private timer: unknown
  private flight: Flight | undefined
  private readonly done = new Map<string, RecognizeResponse>()
  private target: (() => { strokes: InkStroke[]; vocabulary: string[] } | undefined) | undefined
  private readonly timers: NonNullable<SpeculatorOptions["timers"]>

  constructor(private readonly opts: SpeculatorOptions) {
    this.timers = opts.timers ?? { set: (f, ms) => setTimeout(f, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) }
  }

  /** Something changed: read ahead once the page has rested. */
  poke(target: () => { strokes: InkStroke[]; vocabulary: string[] } | undefined): void {
    if (!this.enabled) return
    this.target = target
    if (this.timer !== undefined) this.timers.clear(this.timer)
    this.timer = this.timers.set(() => this.fire(), this.opts.idleMs ?? IDLE_MS)
  }

  private fire(): void {
    this.timer = undefined
    if (!this.enabled || !this.target) return
    if (this.opts.isIdle && !this.opts.isIdle()) {
      this.timer = this.timers.set(() => this.fire(), this.opts.idleMs ?? IDLE_MS)
      return
    }
    const t = this.target()
    if (!t || t.strokes.length === 0 || t.vocabulary.length === 0) return
    const key = inkKey(t)
    if (this.done.has(key) || this.flight?.key === key) return
    this.flight?.ctrl.abort()
    const ctrl = new AbortController()
    const promise = this.opts.ask(this.opts.build(t.strokes, t.vocabulary), ctrl.signal)
    const flight: Flight = { key, ctrl, promise }
    this.flight = flight
    promise.then(
      (res) => {
        if (this.flight === flight) this.flight = undefined
        // Only a reading worth showing is kept; ✦ asks properly otherwise.
        if (res.candidates.length === 0) return
        this.done.set(key, res)
        while (this.done.size > KEEP) this.done.delete(this.done.keys().next().value!)
        this.opts.onReady?.()
      },
      () => {
        if (this.flight === flight) this.flight = undefined
      },
    )
  }

  /** The reading of exactly this ink, if one is done or running; else undefined. */
  answer(req: Pick<RecognizeRequest, "strokes" | "vocabulary">): Promise<RecognizeResponse> | undefined {
    const key = inkKey(req)
    const hit = this.done.get(key)
    if (hit) return Promise.resolve(hit)
    if (this.flight?.key === key) return this.flight.promise.catch(() => ({ candidates: [], error: "reading ahead failed" }))
    return undefined
  }

  /** Is the reading of this ink already here? (✦ may say so.) */
  ready(req: Pick<RecognizeRequest, "strokes" | "vocabulary">): boolean {
    return this.done.has(inkKey(req))
  }

  /** Stop: no timer, nothing in flight. */
  cancel(): void {
    if (this.timer !== undefined) this.timers.clear(this.timer)
    this.timer = undefined
    this.flight?.ctrl.abort()
    this.flight = undefined
  }
}
