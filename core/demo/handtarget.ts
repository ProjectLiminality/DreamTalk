/**
 * A GameLoop as the hands' target (demo/handplay.ts HandTarget) — ONE
 * spelling for every place the hands can act: the player's scene, the paused
 * editor's walk, and any level unpacked over them (editor/nest.ts). The
 * spark stands in that level's host's space and points at its ink; a hold
 * turns that level's view.
 */

import type { GameLoop, Spark } from "./game"
import type { HandTarget } from "./handplay"
import type { ThreeHost } from "../src/render/three-host"
import type { ViewLayer } from "../src/view"
import { frozenSpace, sparkSpace } from "./spark"

export const gameTarget = (o: {
  game: GameLoop
  host: ThreeHost
  /** May the hands act (free play on, nothing suspending it)? */
  live: () => boolean
  /** The view a grab turns (default the loop's own). */
  view?: () => ViewLayer | undefined
  /** A host that paints only on demand repaints. */
  changed?: () => void
  menuAt?: (x: number, y: number) => void
  /** The pinch point as a spark in the scene (default) — false keeps the flat dot. */
  spark?: boolean
}): HandTarget => {
  const { game, host } = o
  const view = o.view ?? (() => game.view)
  return {
    live: o.live,
    hoverAt: (x, y) => game.hoverAt(x, y),
    click: (x, y) => game.click(x, y),
    axisAt: (x, y) => game.axisAt(x, y),
    axisIndex: (id) => game.axisIndex(id),
    scrubAxis: (id, u) => game.scrubAxis(id, u),
    settleAxis: (id) => game.settleAxis(id),
    view,
    fire: (id, position) => game.fire(id, position),
    axes: () => game.automaton.axes.map((a) => ({ id: a.id, label: a.label })),
    hovered: () => game.hovered ?? undefined,
    changed: o.changed,
    menuAt: o.menuAt,
    ...(o.spark === false
      ? {}
      : {
          sparkAt: sparkSpace(host),
          pointWith: (s: Spark | null) => {
            game.spark = s
            return game.sparkHidden()
          },
        }),
    // One hand holding the scene: 1:1, about where it closed (src/gesture/hold.ts).
    holdSpace: () => ({ pose: view()!.pose(), at: frozenSpace(host) }),
  }
}

/** The nested level on top, if one is open (editor/nest.ts `__dtNest.top()`). */
const nestTop = () =>
  (window as unknown as { __dtNest?: { top(): { game: GameLoop; canvas: HTMLCanvasElement; host: ThreeHost } | undefined } }).__dtNest?.top()

const levels = new WeakMap<GameLoop, { target: HandTarget; within: HTMLElement }>()

/**
 * mountHands' `level`: while a symbol is unpacked into its own level, the
 * hands act THERE — its game loop, its host's space and ink, its canvas —
 * through the same spelling as the scene's (one target per level, kept).
 */
export const nestLevel = (spark = true) => (): { target: HandTarget; within: HTMLElement } | undefined => {
  const top = nestTop()
  if (!top) return undefined
  let l = levels.get(top.game)
  if (!l) levels.set(top.game, (l = { target: gameTarget({ game: top.game, host: top.host, live: () => top.game.on, spark }), within: top.canvas }))
  return l
}

/** mountSummoning's `site`: a symbol summoned inside an open level lands in it. */
export const nestSite = () => {
  const top = nestTop()
  return top ? { host: top.host, canvas: top.canvas } : undefined
}
