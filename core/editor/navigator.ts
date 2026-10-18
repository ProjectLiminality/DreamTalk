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

/** How long the rail waits after mounting before it draws a tile (the open scene boots first). */
const BOOT_GRACE_MS = 1500

export interface NavigatorHandle {
  dispose(): void
}

/** A transparent pixel — a tile's frame while its drawing is pending. */
const PENDING = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

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
    // Until its tile is drawn, an empty frame — not a broken image with its
    // alt text (the label above already names the scene).
    img.src = PENDING
    img.alt = ""
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

  // Draw a tile only once it scrolls into the rail's view, one per idle slice
  // and none in the editor's first breaths —
  // drawing one constructs its whole scene, and a rail of ~280 (the whole
  // InterBrain song and its lattice among them) drawn up front cost seconds
  // of frames and hundreds of MB before anyone looked. Nearest the open
  // slide first, among those in view.
  const order = new Map(pending.map((p, i) => [p.img, i]))
  const here = pending.findIndex((p) => p.key === currentKey)
  const byImg = new Map(pending.map((p) => [p.img, p]))
  const queue: typeof pending = []
  let alive = true
  let scheduled = false
  const fill = () => {
    scheduled = false
    if (!alive) return
    if (here >= 0) queue.sort((a, b) => Math.abs(order.get(a.img)! - here) - Math.abs(order.get(b.img)! - here))
    const next = queue.shift()
    if (!next) return
    // One scene that cannot be drawn must not stop the rest of the rail.
    let url: string | undefined
    try {
      url = sceneThumbnail(next.key, next.ctor)
    } catch {}
    if (url) next.img.src = url
    else next.img.classList.add("blank")
    schedule()
  }
  let warm = false
  const schedule = () => {
    if (scheduled || !queue.length || !warm) return
    scheduled = true
    const idle = (window as { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (idle) idle(fill, { timeout: 2000 })
    else setTimeout(fill, 16)
  }
  // The scene being opened comes first: the rail waits until it has drawn.
  setTimeout(() => {
    warm = true
    schedule()
  }, BOOT_GRACE_MS)
  const seen = new IntersectionObserver(
    (hits) => {
      for (const h of hits) {
        if (!h.isIntersecting) continue
        const p = byImg.get(h.target as HTMLImageElement)
        if (!p) continue
        seen.unobserve(h.target)
        queue.push(p)
      }
      schedule()
    },
    { root, rootMargin: "200px 0px" },
  )
  for (const p of pending) seen.observe(p.img)
  signal.addEventListener("abort", () => seen.disconnect())

  return {
    dispose() {
      alive = false
      seen.disconnect()
    },
  }
}
