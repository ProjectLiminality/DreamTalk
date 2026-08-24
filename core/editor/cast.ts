/**
 * The cast bar (EDITOR-V3 step 2, grounded in ONTOLOGY.md "Vocabulary
 * vs. invisible assets").
 *
 * The scene's *meaningful* symbols — its conceptual cast — in one quiet
 * row above the viewport. The rule, mechanical: Layer-1 primitives
 * (Line, Circle, Arc…) are invisible assets and never appear here;
 * sovereign symbols do. Until Eye/Cylinder/Axes pop out into their own
 * holon repos they live inside core, so sovereignty is the interim
 * `static sovereign = true` marker on the class (parts/index.ts) — the
 * flag is inherited, so a future subclass of a sovereign symbol is cast
 * too. A scene with no sovereign symbols (S07 is Text and primitives)
 * simply has no bar: cast, not chrome.
 *
 * One chip per CLASS, not per instance — S01's five Cylinders are one
 * "Cylinder" in the cast, the way a playbill lists an actor once.
 * Clicking a chip selects the first instance through the shared
 * selection store; the chip highlights whenever the selection is one of
 * its class, so the bar and the outline agree by construction.
 */

import type { Holon } from "../src/holon"
import type { Selection } from "./selection"
import { classNameOf } from "./classname"
import { thumbnailEl } from "./thumbnails"

/** ONTOLOGY.md's dial, read: the class says it is a sovereign symbol. */
const isSovereign = (holon: Holon): boolean =>
  (holon.constructor as { sovereign?: boolean }).sovereign === true

interface Member {
  name: string
  /** First instance in scene order — what a chip click selects. */
  first: Holon
  count: number
}

/** The sovereign classes present under these roots, in scene order. */
export const castOf = (roots: readonly Holon[]): Member[] => {
  const members = new Map<string, Member>()
  const walk = (holon: Holon) => {
    if (isSovereign(holon)) {
      const name = classNameOf(holon)
      const seen = members.get(name)
      if (seen) seen.count++
      else members.set(name, { name, first: holon, count: 1 })
    }
    for (const part of holon.parts) walk(part)
  }
  for (const root of roots) walk(root)
  return [...members.values()]
}

export interface CastHandle {
  dispose(): void
}

export const mountCast = (
  root: HTMLElement,
  roots: readonly Holon[],
  selection: Selection,
  signal: AbortSignal,
): CastHandle => {
  root.textContent = ""
  const members = castOf(roots)
  root.classList.toggle("empty", members.length === 0)

  const chips: { member: Member; el: HTMLDivElement }[] = []
  for (const member of members) {
    const chip = document.createElement("div")
    chip.className = "castchip"
    chip.appendChild(thumbnailEl(member.first, 18))
    const name = document.createElement("span")
    name.className = "castname"
    name.textContent = member.name
    chip.appendChild(name)
    if (member.count > 1) {
      const count = document.createElement("span")
      count.className = "castcount"
      count.textContent = `×${member.count}`
      chip.appendChild(count)
    }
    chip.addEventListener("click", () => selection.set(member.first), { signal })
    root.appendChild(chip)
    chips.push({ member, el: chip })
  }

  const unsubscribe = selection.subscribe((selected) => {
    for (const { member, el } of chips) {
      el.classList.toggle(
        "active",
        selected !== null && selected.constructor === member.first.constructor,
      )
    }
  })

  return {
    dispose() {
      unsubscribe()
    },
  }
}
