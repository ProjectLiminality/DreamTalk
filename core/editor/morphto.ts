/**
 * "Morph to…" — authoring a Morph from the editor (vocabulary/Morph).
 *
 * Select a holon, press `m` (or the inspector's "morph to…"), click the
 * one it becomes: one appendCheckpoint op with `morphs` writes
 * `this.play(Morph(this.a, this.b), 4)` after the clip the playhead
 * stands in — the same placement, the same ordinal into helper-played
 * songs, the same clocks kept running, and the same span inverse for
 * ⌘Z as a ⌘K capture. The editor's selection is single, so the second
 * holon is a click, not a second selection: the gesture is "this … into
 * that". Escape, or a click on nothing addressable, cancels.
 */

import type { Dream } from "../src/dream"
import type { Holon } from "../src/holon"
import { clipOrdinalAt, holonPathOf, placementAt } from "./checkpoint"

/** Morph's own length in the demos — long enough to read the travel. */
export const MORPH_SECONDS = 4

/** The nearest holon at-or-above a hit that the scene's code can spell (`this.map.stack`). */
export const addressable = (dream: Dream, hit: Holon | undefined): { holon: Holon; path: string } | undefined => {
  for (let node: Holon | null | undefined = hit; node; node = node.parent) {
    const path = holonPathOf(dream, node)
    if (path) return { holon: node, path: `this.${path}` }
  }
  return undefined
}

/**
 * The op for `a` morphing into `b` at t — or the reason it cannot be
 * written (a holon into itself, a part the code cannot address).
 */
export const morphOp = (
  dream: Dream,
  a: Holon,
  b: Holon,
  t: number,
  opts: { sceneFile?: string; clocks?: string[]; seconds?: number } = {},
): Record<string, unknown> | string => {
  if (a === b) return "a holon cannot morph into itself"
  const from = holonPathOf(dream, a)
  const to = holonPathOf(dream, b)
  if (!from || !to) return "the scene's code has no name for that holon"
  const { placement, anchor } = placementAt(dream.clips, t)
  const file = anchor?.file ?? opts.sceneFile
  if (!file) return "no scene file to write into"
  return {
    type: "op",
    op: "appendCheckpoint",
    file,
    placement,
    anchor: anchor ? { start: anchor.start, end: anchor.end } : undefined,
    ordinal: anchor ? clipOrdinalAt(dream.clips, t) : undefined,
    targets: [],
    morphs: [{ from: `this.${from}`, to: `this.${to}` }],
    clocks: opts.clocks?.length ? opts.clocks : undefined,
    duration: opts.seconds ?? MORPH_SECONDS,
  }
}

export interface MorphToOpts {
  canvas: HTMLCanvasElement
  dream: Dream
  pick(clientX: number, clientY: number): Holon | undefined
  /** The holon that morphs — the selection. */
  selected(): Holon | null
  isPlaying(): boolean
  currentT(): number
  sceneFile(): string | undefined
  /** The clocks the song runs (the walk's capture), so the Morph clip keeps them flowing. */
  clocks(): string[]
  send(op: Record<string, unknown>): void
  note(text: string): void
  signal: AbortSignal
}

export interface MorphTo {
  /** Is a target being picked? */
  readonly picking: boolean
  /** Arm the pick from the selection (true when armed). */
  start(): boolean
  /** Disarm without writing (true when something was armed). */
  cancel(): boolean
  /** Complete the pick at a point, as a click would — headless driving. Returns the op sent, or the refusal. */
  pickAt(clientX: number, clientY: number): Record<string, unknown> | string
}

export const mountMorphTo = (opts: MorphToOpts): MorphTo => {
  let from: { holon: Holon; path: string } | null = null
  const { canvas } = opts
  const disarm = () => {
    from = null
    canvas.classList.remove("picking")
  }
  const pickAt = (x: number, y: number): Record<string, unknown> | string => {
    const a = from
    disarm()
    if (!a) return "nothing armed"
    const b = addressable(opts.dream, opts.pick(x, y))
    if (!b) {
      opts.note("morph cancelled")
      return "no addressable holon there"
    }
    const op = morphOp(opts.dream, a.holon, b.holon, opts.currentT(), { sceneFile: opts.sceneFile(), clocks: opts.clocks() })
    if (typeof op === "string") {
      opts.note(op)
      return op
    }
    opts.send(op)
    opts.note(`morph ${a.path.replace(/^this\./, "")} → ${b.path.replace(/^this\./, "")}`)
    return op
  }
  // Capture phase on the canvas itself: the target click is the pick's, never a selection or a fire.
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (!from || e.button !== 0) return
      e.stopImmediatePropagation()
      e.preventDefault()
      pickAt(e.clientX, e.clientY)
    },
    { signal: opts.signal, capture: true },
  )
  return {
    get picking() {
      return from !== null
    },
    start() {
      if (opts.isPlaying()) return false
      const a = addressable(opts.dream, opts.selected() ?? undefined)
      if (!a) {
        opts.note("select a holon the scene names, then m")
        return false
      }
      from = a
      canvas.classList.add("picking")
      opts.note(`morph ${a.path.replace(/^this\./, "")} into… (click it · Esc cancels)`)
      return true
    },
    cancel() {
      if (!from) return false
      disarm()
      opts.note("morph cancelled")
      return true
    },
    pickAt,
  }
}
