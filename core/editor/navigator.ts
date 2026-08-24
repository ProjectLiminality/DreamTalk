/**
 * The scene navigator (EDITOR-V3 step 2: Keynote's slide rail).
 *
 * Every registered DreamWeaving as a live tile — the scene's own
 * geometry at 60% of its duration, framed by its own camera
 * (thumbnails.ts sceneThumbnail) — with its registry key beside it the
 * way Keynote numbers its slides. Clicking a tile opens that scene in
 * place: no page load, the same teardown-and-boot path a daemon reload
 * takes, with the URL kept honest via history.replaceState so deep
 * links keep working.
 *
 * Order is the DreamSong's own: the video-01 chapters s01…s10
 * numerically, then the composite (video01) when the registry grows
 * one, then the demo scenes in registry order. No drag-to-reorder yet —
 * that arrives with the DreamSong document (EDITOR-V3 build order 3),
 * whose file will then be the truth the rail reflects.
 *
 * Tiles are built lazily, one per idle breath: twenty Dream
 * instantiations in one synchronous pass would hold the first paint
 * hostage for the sake of thumbnails nobody has scrolled to yet. The
 * data URLs are cached at module level, so every boot after the first
 * (scene switches included) fills the rail instantly.
 */

import type { DreamClass } from "../src/dream"
import { sceneThumbnail, TILE_W, TILE_H } from "./thumbnails"

/** s01…s10 numerically, then the video01 composite, then demo scenes. */
export const orderedSceneKeys = (registry: Record<string, DreamClass>): string[] => {
  const keys = Object.keys(registry)
  const chapters = keys
    .filter((k) => /^s\d+$/.test(k))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const composite = keys.filter((k) => k === "video01")
  const rest = keys.filter((k) => !/^s\d+$/.test(k) && k !== "video01")
  return [...chapters, ...composite, ...rest]
}

export interface NavigatorHandle {
  dispose(): void
}

export const mountNavigator = (
  root: HTMLElement,
  registry: Record<string, DreamClass>,
  currentKey: string,
  onOpen: (key: string) => void,
  signal: AbortSignal,
): NavigatorHandle => {
  root.textContent = ""
  const pending: { img: HTMLImageElement; key: string; ctor: DreamClass }[] = []

  for (const key of orderedSceneKeys(registry)) {
    const ctor = registry[key]!
    const tile = document.createElement("div")
    tile.className = "slide"
    if (key === currentKey) tile.classList.add("current")
    tile.title = key

    const label = document.createElement("div")
    label.className = "skey"
    label.textContent = key
    tile.appendChild(label)

    const img = document.createElement("img")
    img.className = "sthumb"
    img.width = TILE_W
    img.height = TILE_H
    img.alt = key
    img.draggable = false
    tile.appendChild(img)
    pending.push({ img, key, ctor })

    tile.addEventListener(
      "click",
      () => {
        if (key !== currentKey) onOpen(key)
      },
      { signal },
    )
    root.appendChild(tile)
    // Keynote lands you on the open slide, not the top of the deck.
    // Two frames in: the grid needs one to size the rail before a scroll
    // distance exists to compute. Scrolls the RAIL only — scrollIntoView
    // would move every scrollable ancestor it liked.
    if (key === currentKey) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const dy = tile.getBoundingClientRect().top - root.getBoundingClientRect().top
          root.scrollTop += dy - (root.clientHeight - tile.clientHeight) / 2
        }),
      )
    }
  }

  // Fill tiles one per frame: cached ones resolve in the first breaths,
  // cold ones each get their own so the rail never blocks the editor.
  let alive = true
  const fill = () => {
    if (!alive) return
    const next = pending.shift()
    if (!next) return
    const url = sceneThumbnail(next.key, next.ctor)
    if (url) next.img.src = url
    else next.img.classList.add("blank")
    requestAnimationFrame(fill)
  }
  requestAnimationFrame(fill)

  return {
    dispose() {
      alive = false
    },
  }
}
