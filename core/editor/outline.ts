/**
 * The holarchy outline (EDITOR-V3: below the scene navigator, toggled by
 * cmd+shift+L exactly like Keynote's outline).
 *
 * The current scene's part tree, straight from `dream.roots` and
 * `holon.parts` — no separate model, no cached copy. Clicking a row
 * writes the shared selection; the selected row highlights from it. Both
 * directions run through the one store, which is what makes viewport and
 * outline agree by construction rather than by synchronisation.
 *
 * A row shows the holon's CLASS (what it is) and, when it has one, its
 * identity — the field name the DreamWeaving gave it (`cylinder`,
 * `planeCircler`). The field name is the name a human wrote and the name
 * an agent will read back in the source, so it is worth more here than
 * any generated id.
 */

import type { Holon } from "../src/holon"
import type { Selection } from "./selection"
import { classNameOf } from "./classname"

/** The field name a whole knows a part by — the identity a human wrote. */
export const identityOf = (holon: Holon): string | undefined => {
  const parent = holon.parent
  if (!parent) return undefined
  for (const [key, value] of Object.entries(parent)) {
    if (value === holon) return key
  }
  return undefined
}

/** The root-level identity: which field of the Dream this holon is. */
export const rootIdentityOf = (dream: object, holon: Holon): string | undefined => {
  for (const [key, value] of Object.entries(dream)) {
    if (value === holon) return key
  }
  return undefined
}

interface Row {
  holon: Holon
  el: HTMLDivElement
  /** Children rows, for collapse. */
  childrenEl?: HTMLDivElement
  twisty?: HTMLDivElement
  /**
   * The row is open only because it is on the path to the selection —
   * not because anyone asked for it. Such a row closes again when the
   * selection leaves, so revealing one grid line does not permanently
   * turn a 48-part Axes into a dump. A hand-thrown twisty clears the
   * flag: an explicit choice outranks the automatic one.
   */
  revealed?: boolean
}

export interface OutlineHandle {
  /** Re-highlight from the store (subscribed automatically). */
  dispose(): void
}

export const mountOutline = (
  container: HTMLElement,
  dream: object,
  roots: readonly Holon[],
  selection: Selection,
  signal: AbortSignal,
): OutlineHandle => {
  container.textContent = ""
  const rows: Row[] = []
  /**
   * What opens by default. An Eye's five parts want to be visible; an
   * Axes' fifty grid lines do not — a panel that opens with fifty
   * identical rows is a dump, which is the one thing TASTE forbids. So
   * the rule is by SIZE, not by depth: a whole small enough to read at a
   * glance opens, a large one waits to be asked.
   */
  const AUTO_EXPAND_MAX_PARTS = 8

  const build = (holon: Holon, depth: number, parentEl: HTMLElement): void => {
    const row = document.createElement("div")
    row.className = "node"
    row.style.paddingLeft = `${8 + depth * 12}px`

    const parts = holon.parts
    const twisty = document.createElement("div")
    twisty.className = parts.length > 0 ? "twisty" : "twisty leaf"
    twisty.textContent = "▼"
    row.appendChild(twisty)

    const name = document.createElement("span")
    name.className = "nclass"
    name.textContent = classNameOf(holon)
    row.appendChild(name)

    const identity = depth === 0 ? rootIdentityOf(dream, holon) : identityOf(holon)
    if (identity) {
      const ident = document.createElement("span")
      ident.className = "nident"
      ident.textContent = identity
      row.appendChild(ident)
    } else if (parts.length > AUTO_EXPAND_MAX_PARTS) {
      // An anonymous whole says how big it is instead of proving it.
      const count = document.createElement("span")
      count.className = "nident"
      count.textContent = `${parts.length}`
      row.appendChild(count)
    }

    row.addEventListener("click", (e) => {
      e.stopPropagation()
      selection.set(holon)
    }, { signal })
    parentEl.appendChild(row)

    const entry: Row = { holon, el: row }
    rows.push(entry)

    if (parts.length === 0) return
    const childrenEl = document.createElement("div")
    entry.childrenEl = childrenEl
    entry.twisty = twisty
    const expanded = parts.length <= AUTO_EXPAND_MAX_PARTS
    childrenEl.style.display = expanded ? "" : "none"
    twisty.textContent = expanded ? "▼" : "▶"
    twisty.addEventListener("click", (e) => {
      e.stopPropagation()
      const open = childrenEl.style.display === "none"
      childrenEl.style.display = open ? "" : "none"
      twisty.textContent = open ? "▼" : "▶"
      // Deliberate: this row now stays as the user left it.
      entry.revealed = false
    }, { signal })
    parentEl.appendChild(childrenEl)
    for (const part of parts) build(part, depth + 1, childrenEl)
  }

  for (const root of roots) build(root, 0, container)

  const unsubscribe = selection.subscribe((current) => {
    for (const { holon, el } of rows) {
      el.classList.toggle("selected", holon === current)
    }
    // Reveal a selection made in the viewport: open every collapsed
    // ancestor, and close again the ones a PREVIOUS selection opened.
    // Without that second half, clicking one grid line would leave its
    // 48-part Axes expanded forever — the panel would accumulate into
    // exactly the dump the auto-expand rule exists to prevent.
    const chain = new Set<Holon>()
    for (let node: Holon | null | undefined = current; node; node = node.parent) chain.add(node)
    for (const row of rows) {
      const { childrenEl, twisty, holon } = row
      if (!childrenEl || !twisty) continue
      const wanted = chain.has(holon) && holon !== current
      if (wanted && childrenEl.style.display === "none") {
        childrenEl.style.display = ""
        twisty.textContent = "▼"
        row.revealed = true
      } else if (!wanted && row.revealed) {
        childrenEl.style.display = "none"
        twisty.textContent = "▶"
        row.revealed = false
      }
    }
    if (!current) return
    const found = rows.find((r) => r.holon === current)
    found?.el.scrollIntoView({ block: "nearest" })
  })

  return { dispose: unsubscribe }
}
