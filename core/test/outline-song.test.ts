/**
 * The outline of a lazy song (editor/outline.ts): one closed row per
 * chapter, and no chapter constructed, nor any row built for its parts,
 * until it is opened, reached by the playhead, or holds the selection.
 * Opening the whole InterBrain song in the editor must never walk its
 * ~150k holons.
 */

import { expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { Holon } from "../src/holon"
import { DreamSong } from "../src/song"

// --- A DOM just deep enough for the outline ----------------------------------
type El = {
  tagName: string
  style: Record<string, string>
  className: string
  children: El[]
  parent?: El
  handlers: Record<string, ((e: unknown) => void)[]>
  classList: { toggle(c: string, on?: boolean): void; contains(c: string): boolean }
  [k: string]: unknown
}
const make = (tag: string): El => {
  const classes = new Set<string>()
  const el: El = {
    tagName: tag.toUpperCase(),
    style: {},
    children: [],
    handlers: {},
    get className() {
      return [...classes].join(" ")
    },
    set className(v: string) {
      classes.clear()
      for (const c of v.split(" ").filter(Boolean)) classes.add(c)
    },
    classList: {
      toggle: (c: string, on?: boolean) => void ((on ?? !classes.has(c)) ? classes.add(c) : classes.delete(c)),
      contains: (c: string) => classes.has(c),
    },
    set textContent(_: string) {
      el.children.length = 0
    },
    appendChild(c: El) {
      c.parent = el
      el.children.push(c)
      return c
    },
    addEventListener(type: string, fn: (e: unknown) => void) {
      ;(el.handlers[type] ??= []).push(fn)
    },
    contains(c: El) {
      for (let x: El | undefined = c; x; x = x.parent) if (x === el) return true
      return false
    },
    getContext: () => null,
    scrollIntoView: () => {},
  }
  return el
}
const g = globalThis as Record<string, unknown>
g.window ??= { innerWidth: 100, innerHeight: 100, devicePixelRatio: 1 }
// Ours for this test (another file's stub may already stand — with fewer of what the outline needs).
const withDocument = (fn: () => void) => {
  const was = g.document
  g.document = { getElementById: () => null, createElement: make, head: make("head"), body: make("body") }
  try {
    fn()
  } finally {
    g.document = was
  }
}
const { mountOutline } = await import("../editor/outline")
const { Selection } = await import("../editor/selection")

class Lamp extends Holon {
  static sovereign = false
}
const chapter = () =>
  class extends Dream {
    lamp = new Lamp()
    unfold(): void {
      this.stage(this.lamp)
      this.wait(10)
    }
  }
const all = (el: El): El[] => el.children.flatMap((c) => [c, ...all(c)])
const click = (el: El) => el.handlers.click?.forEach((fn) => fn({ stopPropagation: () => {} }))

test("a lazy song outlines as closed chapter rows; a chapter is built only when opened, reached or selected into", () => withDocument(() => {
  const song = new DreamSong([{ scene: chapter(), span: 10 }, { scene: chapter(), span: 10 }, { scene: chapter(), span: 10 }], { lazy: true, keep: 0 })
  song.applyAt(1)
  // Standing: the playhead's chapter (and the one it is about to reach).
  const standing = song.constructed
  expect(standing).not.toContain(2)
  const container = make("div")
  const selection = new Selection()
  const ac = new AbortController()
  const outline = mountOutline(container as unknown as HTMLElement, song, song.roots, selection, ac.signal)

  const chapters = all(container).filter((e) => e.classList.contains("chapter"))
  expect(chapters.length).toBe(3)
  // Mounting constructed nothing and rowed no chapter's parts.
  expect(song.constructed).toEqual(standing)
  expect(all(container).filter((e) => e.classList.contains("node") && !e.classList.contains("chapter")).length).toBe(0)
  // The standing chapter reads as built.
  expect(chapters.map((c, i) => c.classList.contains("built") === standing.includes(i))).toEqual([true, true, true])

  // Opening chapter 3 builds it (and only it) and rows its lamp.
  click(chapters[2]!)
  expect(song.constructed).toContain(2)
  expect(all(container).filter((e) => e.classList.contains("node") && !e.classList.contains("chapter")).length).toBe(1)

  // Selecting into a standing chapter reveals it.
  const lamp0 = (song.chapters[0]!.dream as unknown as { lamp: Lamp }).lamp
  selection.set(lamp0)
  expect(all(container).filter((e) => e.classList.contains("selected")).length).toBe(1)

  // The playhead moves on: chapter 1 is dropped; its rows go with it.
  song.applyAt(25)
  outline.refresh()
  expect(chapters[0]!.classList.contains("built")).toBe(false)
  ac.abort()
}))
