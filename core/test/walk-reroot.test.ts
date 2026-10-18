/**
 * The editor's paused walk follows a lazy song's live holons (editor/walk.ts
 * reroot, as the player's GameLoop.reroot): a chapter dropped from the song
 * is dropped from the walk, so a key never drives an off-stage holon.
 */

import { expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { Holon } from "../src/holon"
import { DreamSong } from "../src/song"
import { toggle, type StateSpace } from "../src/automaton"
import { completion } from "../src/params"
import { Timeline } from "../src/timeline"
import { Overrides } from "../editor/overrides"

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
const { EditorWalk } = await import("../editor/walk")

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

test("the paused editor walks a lazy song's live chapters: a dropped chapter's holons leave the walk", () => {
  const song = new DreamSong([{ scene: chapter(), span: 10 }, { scene: chapter(), span: 10 }, { scene: chapter(), span: 10 }], { lazy: true, keep: 0 })
  song.applyAt(1)
  const ac = new AbortController()
  const walk = new EditorWalk({
    canvas: el() as unknown as HTMLCanvasElement,
    pick: () => undefined,
    boundsOf: () => undefined,
    roots: song.roots,
    scene: () => song.stateSpace(),
    overrides: new Overrides(new Timeline([])),
    isPlaying: () => false,
    suspended: () => false,
    currentT: () => 1,
    pause: () => {},
    hud: false,
    signal: ac.signal,
  })
  const lampOf = (k: number) => (song.chapters[k]!.dream as unknown as { lamp: Lamp }).lamp
  expect(walk.game.automaton.axes.some((a) => a.owner === lampOf(0))).toBe(true)

  // The playhead moves into chapter 3: chapter 1 is dropped, chapter 3 built.
  song.applyAt(25)
  walk.reroot(song.roots)
  const owners = walk.game.automaton.axes.map((a) => a.owner)
  expect(owners.includes(lampOf(2))).toBe(true)
  expect(owners.includes(lampOf(0))).toBe(false)
  // A key now drives the live lamp, never the dropped one.
  walk.step(0)
  walk.game.key({ key: "o", code: "KeyO", metaKey: false, ctrlKey: false, altKey: false })
  expect(walk.game.automaton.journal.at(-1)?.axis).toBe(walk.game.automaton.axes.find((a) => a.owner === lampOf(2))!.id)
  ac.abort()
})
