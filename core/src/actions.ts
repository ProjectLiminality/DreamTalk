/**
 * Holon actions — what a symbol can DO when it is touched (David,
 * 2026-10-15: "every sub-symbol you click can be tied to an action; if it's
 * a submodule it can go to its repository, its layer of the holarchy;
 * sub-symbols carry skills").
 *
 * The sibling of `stateSpace()`: a state space is what a holon can BECOME
 * (positions on axes, walked by clicking its handles); actions are what it
 * can DO — open its DreamNode, dive into it, a skill of its own. A holon
 * declares its own with `actions()`; the host adds the ones every
 * sovereign symbol has (editor/actions.ts) and asks the host to carry
 * them out through an `ActionContext`. Nothing here runs in a render or
 * an export: actions are for a viewer's hand.
 */

import type { Holon } from "./holon"

/** What an action may ask of whoever shows it (the editor, the player). */
export interface ActionContext {
  /** The holon the action belongs to. */
  holon: Holon
  /** Say something, briefly. */
  note(text: string): void
  /** Show a source file (repo-relative) — the code view, or a new tab. */
  showSource(file: string): void
  /** Go one layer down the holarchy: make this holon the scene. */
  dive(): void
  /** Open a URL (a repo, a page). */
  open(url: string): void
}

export interface HolonAction {
  id: string
  label: string
  run(ctx: ActionContext): void | Promise<void>
}
