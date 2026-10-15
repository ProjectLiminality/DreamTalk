/**
 * Hands → intents: one controller over the HandFrame stream, pure and
 * frame-clocked, so a recorded take replays to the same intents.
 *
 *   hover       — the pinch cursor of the POINTING hand (any hand not
 *                 holding the scene; the right one if both are free);
 *   click       — a pinch that did not travel (a double pinch frames: the
 *                 host's own double-click rule);
 *   scrub       — a pinch that began on a handle and travelled: the
 *                 handle's axis follows the hand, continuously, and
 *                 settles on release;
 *   grab        — closed hands turn, move and scale the scene (grab.ts).
 *
 * A fist also closes the thumb–index gap, so a hand counts as pinching only
 * while it is not grabbing (grab strength under `pinchGrabLimit`): a fist
 * never clicks.
 *
 * HAND ROLES (`grabHand`). Either hand may do either ("either", the curl
 * decides) — or each hand has ONE job, a simpler language with nothing to
 * mistake: `grabHand: "left"` (David's default in the player) lets only the
 * left hand grab and only the right point and pinch; "right" swaps them for
 * the left-handed. Both at once work. Two fists stay a gesture: the
 * pointing hand closing joins the grab only while the grabbing hand holds.
 */

import { GrabController, type GrabDelta, type GrabOpts } from "./grab"
import { PinchCursor, type CursorState, type PinchOpts } from "./pinch"
import { grabStrength, type HandFrame } from "./hand"

export interface Intent {
  t: number
  cursor: CursorState
  /** Screen point (0..1) of a click this frame. */
  click?: { x: number; y: number }
  /** A pinch began here this frame — the host asks whether a handle is under it. */
  press?: { x: number; y: number }
  /** While a press travels: how far (screen units) from where it began. */
  drag?: { dx: number; dy: number }
  /** The press ended after travelling (end a scrub). */
  dragEnd?: boolean
  grab: GrabDelta
}

export interface ControllerOpts {
  pinch?: PinchOpts
  grab?: GrabOpts
  /** A pinch that travels further than this (screen units) is a drag, not a click. */
  slop?: number
  /** A hand closed beyond this is grabbing, never pinching. */
  pinchGrabLimit?: number
  /** Which hand grabs (the other points): "either" (default) lets the curl decide. */
  grabHand?: GrabHand
}

export type GrabHand = "left" | "right" | "either"

export class GestureController {
  readonly cursor: PinchCursor
  readonly grab: GrabController
  readonly slop: number
  readonly pinchGrabLimit: number
  grabHand: GrabHand
  #press?: { x: number; y: number; dragging: boolean }
  #pointer?: number

  constructor(opts: ControllerOpts = {}) {
    this.cursor = new PinchCursor(opts.pinch)
    this.grab = new GrabController(opts.grab)
    this.slop = opts.slop ?? 0.015
    this.pinchGrabLimit = opts.pinchGrabLimit ?? 0.7
    this.grabHand = opts.grabHand ?? "either"
  }

  update(frame: HandFrame): Intent {
    if (this.grabHand !== "either") return this.#roles(frame, this.grabHand)
    const grab = this.grab.update(frame.hands, frame.t)
    // A hand points unless it holds the scene or is closing into a fist
    // (a natural pinch, the other fingers curled, reads ~0.4 — it points;
    // the limit is the grab's own onset, so no hand is ever neither).
    const free = frame.hands.filter((h) => !this.grab.isHolding(h.id) && grabStrength(h) < this.pinchGrabLimit)
    // Keep the same pointing hand while it stays free; else the right one; else any.
    const pointer =
      free.find((h) => h.id === this.#pointer) ?? free.find((h) => h.side === "right") ?? free[0]
    if (pointer?.id !== this.#pointer) this.cursor.update(undefined, frame.t) // a new hand starts fresh
    this.#pointer = pointer?.id
    return this.#intent(frame.t, this.cursor.update(pointer, frame.t), grab)
  }

  /** One job per hand: `side` grabs, the other points. */
  #roles(frame: HandFrame, side: "left" | "right"): Intent {
    let holding = false
    for (const h of frame.hands) if (h.side === side && this.grab.isHolding(h.id)) holding = true
    // The pointing hand reaches the grab only as the second of two fists.
    const grab = this.grab.update(holding ? frame.hands : frame.hands.filter((h) => h.side === side), frame.t)
    let pointer: HandFrame["hands"][number] | undefined
    for (const h of frame.hands) if (h.side !== side && !this.grab.isHolding(h.id)) pointer = h
    if (pointer?.id !== this.#pointer) this.cursor.update(undefined, frame.t)
    this.#pointer = pointer?.id
    return this.#intent(frame.t, this.cursor.update(pointer, frame.t), grab)
  }

  #intent(t: number, cursor: CursorState, grab: GrabDelta): Intent {
    const out: Intent = { t, cursor, grab }
    if (cursor.pressed) {
      this.#press = { x: cursor.x, y: cursor.y, dragging: false }
      out.press = { x: cursor.x, y: cursor.y }
    } else if (cursor.pinched && this.#press) {
      const dx = cursor.x - this.#press.x
      const dy = cursor.y - this.#press.y
      if (this.#press.dragging || Math.hypot(dx, dy) > this.slop) {
        this.#press.dragging = true
        out.drag = { dx, dy }
      }
    } else if (cursor.released && this.#press) {
      if (this.#press.dragging) out.dragEnd = true
      else out.click = { x: this.#press.x, y: this.#press.y }
      this.#press = undefined
    }
    return out
  }
}
