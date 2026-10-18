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
import { attachFaceTip } from "./facetip"

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
}

/**
 * A row that discloses — a whole, a folded run, a song's chapter. Its
 * children are built the first time it opens (`fill`), never before: an
 * outline of a whole song must not build rows for parts nobody opened.
 */
interface Disclosure {
  childrenEl: HTMLDivElement
  twisty: HTMLDivElement
  /** Builds the children on first open; undefined once built. */
  fill?: () => void
  /** Is it on the path to this selection? */
  wants(chain: ReadonlySet<Holon>, current: Holon | null): boolean
  /**
   * Open only because it is on the path to the selection — not because
   * anyone asked for it. Such a row closes again when the selection
   * leaves, so revealing one grid line does not permanently turn a
   * 48-part Axes into a dump. A hand-thrown twisty clears the flag: an
   * explicit choice outranks the automatic one.
   */
  revealed?: boolean
}

/** A lazy song (src/song.ts LAZY CONSTRUCTION), as the outline reads it. */
interface LazySong {
  lazy: boolean
  chapters: readonly { dream: object; offset: number; span: number }[]
  constructed: number[]
  ownRoots: readonly Holon[]
  chapterRoots(i: number): readonly Holon[]
  sceneOf(i: number): { name: string }
}
const lazySongOf = (dream: object): LazySong | undefined => {
  const s = dream as Partial<LazySong>
  return s.lazy === true && Array.isArray(s.chapters) && typeof s.chapterRoots === "function" && typeof s.sceneOf === "function" ? (s as LazySong) : undefined
}

export interface OutlineHandle {
  /** A lazy song built or dropped chapters: the chapter rows follow. */
  refresh(): void
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
  const discs: Disclosure[] = []
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

  const setOpen = (d: Disclosure, open: boolean): void => {
    if (open && d.fill) {
      const fill = d.fill
      d.fill = undefined
      fill()
    }
    d.childrenEl.style.display = open ? "" : "none"
    d.twisty.textContent = open ? "▼" : "▶"
  }
  const isOpen = (d: Disclosure) => d.childrenEl.style.display !== "none"

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
    // Only sovereign symbols have a rendered face — a Line or a Circle
    // is an invisible asset (cast.ts's rule), and its 16px glyph is
    // already the whole of what it looks like.
    if ((holon.constructor as { sovereign?: boolean }).sovereign === true) {
      attachFaceTip(row, classNameOf(holon), signal)
    }
    parentEl.appendChild(row)
    rows.push({ holon, el: row })

    if (entries.length === 0) return
    const childrenEl = document.createElement("div")
    const d: Disclosure = {
      childrenEl,
      twisty,
      fill: () => {
        for (const child of entries) {
          if (child.kind === "holon") build(child.holon, depth + 1, childrenEl)
          else buildGroup(child.holons, depth + 1, childrenEl)
        }
      },
      wants: (chain, current) => chain.has(holon) && holon !== current,
    }
    discs.push(d)
    twisty.addEventListener("click", (e) => {
      e.stopPropagation()
      setOpen(d, !isOpen(d))
      // Deliberate: this row now stays as the user left it.
      d.revealed = false
    }, { signal })
    parentEl.appendChild(childrenEl)
    setOpen(d, entries.length <= AUTO_EXPAND_MAX_ROWS)
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
    const d: Disclosure = {
      childrenEl,
      twisty,
      fill: () => {
        for (const member of members) build(member, depth + 1, childrenEl)
      },
      wants: (chain) => members.some((member) => chain.has(member)),
    }
    discs.push(d)
    setOpen(d, false)
    // The whole row is the disclosure — presentation, not a holon, so a
    // click toggles rather than selects.
    row.addEventListener("click", (e) => {
      e.stopPropagation()
      setOpen(d, !isOpen(d))
      d.revealed = false
    }, { signal })
  }

  // A lazy song lists its chapters as closed rows, each built (and its
  // chapter constructed) only when opened — or already standing because
  // the playhead reached it. The song's own holons come first.
  const song = lazySongOf(dream)
  const chapterRows: { d: Disclosure; row: HTMLDivElement; i: number; filledWith?: readonly Holon[] }[] = []
  const buildChapter = (i: number): void => {
    const ch = song!.chapters[i]!
    const row = document.createElement("div")
    row.className = "node chapter"
    row.style.paddingLeft = "8px"
    const twisty = document.createElement("div")
    twisty.className = "twisty"
    row.appendChild(twisty)
    const name = document.createElement("span")
    name.className = "nclass"
    name.textContent = `${i + 1} · ${song!.sceneOf(i).name.replace(/Dream$/, "")}`
    row.appendChild(name)
    const at = document.createElement("span")
    at.className = "nident"
    at.textContent = `${Math.round(ch.offset)} s`
    row.appendChild(at)
    container.appendChild(row)
    const childrenEl = document.createElement("div")
    container.appendChild(childrenEl)
    const entry = { d: undefined as unknown as Disclosure, row, i, filledWith: undefined as readonly Holon[] | undefined }
    entry.d = {
      childrenEl,
      twisty,
      fill: () => {
        // Opening a chapter that is not standing constructs it (song.ts chapterRoots).
        const rs = song!.chapterRoots(i)
        entry.filledWith = rs
        for (const r of rs) build(r, 1, childrenEl)
      },
      // Only a standing chapter can hold the selection — never construct one to ask.
      wants: (chain) => song!.constructed.includes(i) && song!.chapterRoots(i).some((r) => chain.has(r)),
    }
    discs.push(entry.d)
    chapterRows.push(entry)
    setOpen(entry.d, false)
    row.addEventListener("click", (e) => {
      e.stopPropagation()
      setOpen(entry.d, !isOpen(entry.d))
      entry.d.revealed = false
    }, { signal })
  }
  const sameRoots = (a: readonly Holon[], b: readonly Holon[]) => a.length === b.length && a.every((h, k) => h === b[k])
  const refreshChapters = (): void => {
    if (!song) return
    const standing = new Set(song.constructed)
    for (const c of chapterRows) {
      c.row.classList.toggle("built", standing.has(c.i))
      // Its rows were built for holons the song has since dropped or rebuilt: build again when next opened.
      if (c.filledWith && (!standing.has(c.i) || !sameRoots(song.chapterRoots(c.i), c.filledWith))) {
        const open = isOpen(c.d) && standing.has(c.i)
        const gone = new Set<Holon>()
        for (const r of c.filledWith) for (const h of r.walk()) gone.add(h)
        for (let k = rows.length - 1; k >= 0; k--) if (gone.has(rows[k]!.holon)) rows.splice(k, 1)
        for (let k = discs.length - 1; k >= 0; k--) if (c.d.childrenEl.contains(discs[k]!.childrenEl)) discs.splice(k, 1)
        c.d.childrenEl.textContent = ""
        c.filledWith = undefined
        c.d.fill = () => {
          const rs = song.chapterRoots(c.i)
          c.filledWith = rs
          for (const r of rs) build(r, 1, c.d.childrenEl)
        }
        setOpen(c.d, open)
      }
    }
  }

  if (song) {
    for (const root of song.ownRoots) build(root, 0, container)
    song.chapters.forEach((_, i) => buildChapter(i))
    refreshChapters()
  } else for (const root of roots) build(root, 0, container)

  const unsubscribe = selection.subscribe((current) => {
    // Reveal a selection made in the viewport: open every collapsed
    // ancestor (building it if it never was), and close again the ones a
    // PREVIOUS selection opened. Without that second half, clicking one
    // grid line would leave its 48-part Axes expanded forever — the panel
    // would accumulate into exactly the dump the auto-expand rule exists
    // to prevent. Opening appends its children's disclosures: the loop reaches them too.
    const chain = new Set<Holon>()
    for (let node: Holon | null | undefined = current; node; node = node.parent) chain.add(node)
    for (let k = 0; k < discs.length; k++) {
      const d = discs[k]!
      const wanted = d.wants(chain, current)
      if (wanted && !isOpen(d)) {
        setOpen(d, true)
        d.revealed = true
      } else if (!wanted && d.revealed) {
        setOpen(d, false)
        d.revealed = false
      }
    }
    for (const { holon, el } of rows) el.classList.toggle("selected", holon === current)
    if (!current) return
    const found = rows.find((r) => r.holon === current)
    found?.el.scrollIntoView({ block: "nearest" })
  })

  return { refresh: refreshChapters, dispose: unsubscribe }
}
