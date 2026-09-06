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
 *
 * Anonymous compose()-generated siblings fold (Keynote-calm): a run of
 * three or more SAME-CLASS parts with no authored identity collapses to
 * one disclosure row — "Line ×20" — closed by default. The group row is
 * presentation, not a holon: clicking it discloses, it never selects.
 * Selecting a member from the viewport opens its group the same way it
 * opens a collapsed whole, and closes it again when the selection leaves.
 */

import type { Holon } from "../src/holon"
import type { Selection } from "./selection"
import { classNameOf } from "./classname"
import { thumbnailEl } from "./thumbnails"

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

/** Fewest same-class anonymous siblings in a row that fold into a group. */
const GROUP_MIN = 3

/** One outline entry: a part with its own row, or a folded run of them. */
export type OutlineEntry =
  | { kind: "holon"; holon: Holon }
  | { kind: "run"; holons: Holon[] }

/**
 * A whole's parts as the outline will row them: parts with authored
 * identities (and short runs) stand alone; runs of ≥GROUP_MIN same-class
 * anonymous siblings fold into one entry. Consecutive-only, so authored
 * structure (a named part between two runs) is never rowed out of order.
 */
export const outlineEntries = (parts: readonly Holon[]): OutlineEntry[] => {
  const entries: OutlineEntry[] = []
  let i = 0
  while (i < parts.length) {
    const part = parts[i]!
    if (identityOf(part)) {
      entries.push({ kind: "holon", holon: part })
      i++
      continue
    }
    let j = i + 1
    while (
      j < parts.length &&
      parts[j]!.constructor === part.constructor &&
      !identityOf(parts[j]!)
    ) {
      j++
    }
    const run = parts.slice(i, j)
    if (run.length >= GROUP_MIN) entries.push({ kind: "run", holons: run })
    else for (const holon of run) entries.push({ kind: "holon", holon })
    i = j
  }
  return entries
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

/** A folded run's disclosure row — same open/close life as a Row, no holon. */
interface GroupRow {
  members: Holon[]
  childrenEl: HTMLDivElement
  twisty: HTMLDivElement
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
  const groups: GroupRow[] = []
  /**
   * What opens by default. An Eye's five parts want to be visible; an
   * Axes' fifty grid lines do not — a panel that opens with fifty
   * identical rows is a dump, which is the one thing TASTE forbids. So
   * the rule is by SIZE, not by depth: a whole small enough to read at a
   * glance opens, a large one waits to be asked. Size is counted in ROWS
   * (folded runs count once), so an Axes whose fifty lines fold to two
   * groups reads at a glance and opens.
   */
  const AUTO_EXPAND_MAX_ROWS = 8

  const setOpen = (childrenEl: HTMLDivElement, twisty: HTMLDivElement, open: boolean): void => {
    childrenEl.style.display = open ? "" : "none"
    twisty.textContent = open ? "▼" : "▶"
  }

  const build = (holon: Holon, depth: number, parentEl: HTMLElement): void => {
    const row = document.createElement("div")
    row.className = "node"
    row.style.paddingLeft = `${8 + depth * 12}px`

    const entries = outlineEntries(holon.parts)
    const twisty = document.createElement("div")
    twisty.className = entries.length > 0 ? "twisty" : "twisty leaf"
    twisty.textContent = "▼"
    row.appendChild(twisty)

    // The symbol's own face, at row scale (EDITOR-V4 "Symbol thumbnails"):
    // a glyph drawn from this holon's geometry, so the tree can be read by
    // shape before it is read by name.
    row.appendChild(thumbnailEl(holon, 16))

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
    } else if (entries.length > AUTO_EXPAND_MAX_ROWS) {
      // An anonymous whole says how big it is instead of proving it.
      const count = document.createElement("span")
      count.className = "nident"
      count.textContent = `${holon.parts.length}`
      row.appendChild(count)
    }

    row.addEventListener("click", (e) => {
      e.stopPropagation()
      selection.set(holon)
    }, { signal })
    parentEl.appendChild(row)

    const entry: Row = { holon, el: row }
    rows.push(entry)

    if (entries.length === 0) return
    const childrenEl = document.createElement("div")
    entry.childrenEl = childrenEl
    entry.twisty = twisty
    setOpen(childrenEl, twisty, entries.length <= AUTO_EXPAND_MAX_ROWS)
    twisty.addEventListener("click", (e) => {
      e.stopPropagation()
      setOpen(childrenEl, twisty, childrenEl.style.display === "none")
      // Deliberate: this row now stays as the user left it.
      entry.revealed = false
    }, { signal })
    parentEl.appendChild(childrenEl)
    for (const child of entries) {
      if (child.kind === "holon") build(child.holon, depth + 1, childrenEl)
      else buildGroup(child.holons, depth + 1, childrenEl)
    }
  }

  const buildGroup = (members: Holon[], depth: number, parentEl: HTMLElement): void => {
    const row = document.createElement("div")
    row.className = "node run"
    row.style.paddingLeft = `${8 + depth * 12}px`

    const twisty = document.createElement("div")
    twisty.className = "twisty"
    row.appendChild(twisty)
    row.appendChild(thumbnailEl(members[0]!, 16))

    const name = document.createElement("span")
    name.className = "nclass"
    name.textContent = classNameOf(members[0]!)
    row.appendChild(name)
    const count = document.createElement("span")
    count.className = "nident"
    count.textContent = `×${members.length}`
    row.appendChild(count)

    parentEl.appendChild(row)
    const childrenEl = document.createElement("div")
    parentEl.appendChild(childrenEl)
    const group: GroupRow = { members, childrenEl, twisty }
    groups.push(group)
    setOpen(childrenEl, twisty, false)
    // The whole row is the disclosure — presentation, not a holon, so a
    // click toggles rather than selects.
    const toggle = (e: Event) => {
      e.stopPropagation()
      setOpen(childrenEl, twisty, childrenEl.style.display === "none")
      group.revealed = false
    }
    row.addEventListener("click", toggle, { signal })
    for (const member of members) build(member, depth + 1, childrenEl)
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
        setOpen(childrenEl, twisty, true)
        row.revealed = true
      } else if (!wanted && row.revealed) {
        setOpen(childrenEl, twisty, false)
        row.revealed = false
      }
    }
    // A folded run opens the same way a collapsed whole does: when the
    // selection is one of its members (or ink inside one), and closes
    // again when the selection moves on.
    for (const group of groups) {
      const wanted = group.members.some((member) => chain.has(member))
      if (wanted && group.childrenEl.style.display === "none") {
        setOpen(group.childrenEl, group.twisty, true)
        group.revealed = true
      } else if (!wanted && group.revealed) {
        setOpen(group.childrenEl, group.twisty, false)
        group.revealed = false
      }
    }
    if (!current) return
    const found = rows.find((r) => r.holon === current)
    found?.el.scrollIntoView({ block: "nearest" })
  })

  return { dispose: unsubscribe }
}
