import { expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { Holon } from "../src/holon"
import { DreamSong } from "../src/song"
import { toggle, type StateSpace } from "../src/automaton"
import { completion } from "../src/params"

// --- A DOM just deep enough for GameLoop (as test/walk.test.ts) ---------------
const el = (): Record<string, unknown> => ({
  style: {},
  className: "",
  innerHTML: "",
  addEventListener: () => {},
  append: () => {},
  remove: () => {},
  getContext: () => null,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, x: 0, y: 0 }),
})
const g = globalThis as Record<string, unknown>
g.document ??= { getElementById: () => null, createElement: el, head: el(), body: el() }
g.window ??= { innerWidth: 100, innerHeight: 100, devicePixelRatio: 1 }
const { GameLoop } = await import("../demo/game")

class Lamp extends Holon {
  on = completion(0)
  override stateSpace(): StateSpace {
    return { axes: [toggle("on", this.on, { key: "o" })] }
  }
}
const chapter = () =>
  class extends Dream {
    lamp = new Lamp()
    unfold(): void {
      this.stage(this.lamp)
      this.wait(10)
    }
  }

test("a lazy song's chapters come and go: the game loop walks the live ones (reroot)", () => {
  const song = new DreamSong([{ scene: chapter(), span: 10 }, { scene: chapter(), span: 10 }, { scene: chapter(), span: 10 }], { lazy: true, keep: 0 })
  song.applyAt(1)
  const ac = new AbortController()
  const game = new GameLoop(
    { canvas: el() as unknown as HTMLCanvasElement, pick: () => undefined, boundsOf: () => undefined, setBeforeSync: () => {} },
    { roots: song.roots, space: song.stateSpace(), animated: song.driven, suspended: () => false, hud: false, signal: ac.signal },
  )
  const first = song.chapters[0]!.dream as unknown as { lamp: Lamp }
  expect(game.automaton.axes.some((a) => a.owner === first.lamp)).toBe(true)
  game.enter(1)
  game.fire(game.automaton.axes.find((a) => a.owner === first.lamp)!.id) // a fire on chapter 1's lamp
  expect(game.automaton.journal.length).toBe(1)

  // The playhead moves into chapter 3: chapter 1 is dropped.
  song.applyAt(25)
  game.reroot({ roots: song.roots, space: song.stateSpace(), animated: song.driven })
  const third = song.chapters[2]!.dream as unknown as { lamp: Lamp }
  const owners = game.automaton.axes.map((a) => a.owner)
  expect(owners.includes(third.lamp)).toBe(true)
  expect(owners.includes(first.lamp)).toBe(false)
  // The fire on a lamp that is gone is dropped with it; its key goes to the live lamp.
  expect(game.automaton.journal.length).toBe(0)
  game.key({ key: "o", code: "KeyO", metaKey: false, ctrlKey: false, altKey: false })
  expect(game.automaton.journal.at(-1)?.axis).toBe(game.automaton.axes.find((a) => a.owner === third.lamp)!.id)
  ac.abort()
})
