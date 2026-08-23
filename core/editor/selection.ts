/**
 * The selection store (EDITOR-V3 decision 1: selection is a first-class
 * editor concept, not a viewport detail).
 *
 * One `Holon | null` that every panel both READS and WRITES: the
 * viewport picks into it, the holarchy outline sets it, the inspector
 * renders from it, and the timeline will scope to it. Panels never hold
 * their own idea of what is selected — they subscribe here and redraw.
 *
 * Deliberately tiny and framework-free: the store outlives no remount
 * (a fresh Dream means fresh Holon identities), so it is constructed per
 * mount and handed to the panels, not made a module singleton.
 */

import type { Holon } from "../src/holon"

export type SelectionListener = (selection: Holon | null) => void

export class Selection {
  #current: Holon | null = null
  readonly #listeners = new Set<SelectionListener>()

  get current(): Holon | null {
    return this.#current
  }

  /** Set the selection; no-ops (and notifies nobody) if unchanged. */
  set(holon: Holon | null): void {
    if (holon === this.#current) return
    this.#current = holon
    for (const listener of this.#listeners) listener(this.#current)
  }

  clear(): void {
    this.set(null)
  }

  /** Subscribe; the listener fires immediately with the current value. */
  subscribe(listener: SelectionListener): () => void {
    this.#listeners.add(listener)
    listener(this.#current)
    return () => this.#listeners.delete(listener)
  }

  /**
   * Re-point the selection into a freshly rebuilt Dream (code → UI
   * remount). Holon identities do not survive a remount, so the store
   * matches by PATH — the chain of part indices from the root, plus the
   * class name as a sanity check. A structural edit that moves the holon
   * simply clears the selection rather than selecting something else.
   */
  rehydrate(roots: readonly Holon[], path: SelectionPath | undefined): void {
    this.#current = path ? resolvePath(roots, path) : null
    for (const listener of this.#listeners) listener(this.#current)
  }
}

export interface SelectionPath {
  /** Index of the root holon the selection lives under. */
  root: number
  /** Part indices from that root down to the selection. */
  indices: number[]
  /** Expected class name at the destination. */
  className: string
}

/** The path from a root list to a holon, or undefined if it is unreachable. */
export const pathOf = (
  roots: readonly Holon[],
  holon: Holon,
): SelectionPath | undefined => {
  for (let root = 0; root < roots.length; root++) {
    const indices = descend(roots[root]!, holon, [])
    if (indices) return { root, indices, className: holon.constructor.name }
  }
  return undefined
}

const descend = (node: Holon, target: Holon, trail: number[]): number[] | undefined => {
  if (node === target) return trail
  const parts = node.parts
  for (let i = 0; i < parts.length; i++) {
    const found = descend(parts[i]!, target, [...trail, i])
    if (found) return found
  }
  return undefined
}

const resolvePath = (roots: readonly Holon[], path: SelectionPath): Holon | null => {
  let node = roots[path.root]
  if (!node) return null
  for (const index of path.indices) {
    const next: Holon | undefined = node.parts[index]
    if (!next) return null
    node = next
  }
  return node.constructor.name === path.className ? node : null
}
