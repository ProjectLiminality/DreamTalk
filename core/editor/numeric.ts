/**
 * The C4D numeric field (EDITOR-V4 "Numeric editing").
 *
 * A slider cannot say 250.0. That is the whole complaint, and it is not a
 * matter of resolution — a range input maps a fixed pixel width onto a
 * guessed interval, so the value a human means is reachable only by
 * accident. C4D solved this decades ago and Keynote uses the same control
 * for the same reason: the number itself is the widget. You read it, you
 * click it and type an exact one, or you drag across it to scrub.
 *
 * The gesture vocabulary, matching C4D:
 *
 *   drag horizontally   scrub by the param's natural step
 *   shift + drag        fine   (÷10)
 *   cmd/ctrl + drag     coarse (×10)
 *   click (no drag)     focus and select — type an exact value, Enter
 *   Escape              abandon the gesture, restore the entry value
 *
 * Two details that make it feel right rather than merely work:
 *
 *  - the drag is POINTER-LOCKED in effect (accumulated from movementX,
 *    not from clientX), so a scrub never runs out of screen and never
 *    stalls at the window edge;
 *  - click and drag are the same gesture until they are not. The field
 *    only commits to "this was a drag" after ~3px of movement, so a
 *    click-to-type is never stolen by a one-pixel tremor.
 *
 * The field is deliberately ignorant of WHERE its value goes. It reports
 * `onInput` while the value moves and `onCommit` when the gesture ends;
 * main.ts owns the live/persisted split (live param write + divergence
 * mark on input, setOverride op on commit) exactly as it did with the
 * slider it replaces.
 */

import type { Param, ParamValue } from "../src/params"

export interface NumericFieldOpts {
  /** Fired continuously while the value moves (drag, or typed + Enter). */
  onInput: (value: number) => void
  /** Fired once when the gesture ends and the value differs from its start. */
  onCommit: (value: number) => void
  /** Fired when Escape abandons an in-flight gesture; value is the entry value. */
  onRevert?: (value: number) => void
  signal: AbortSignal
}

export interface NumericFieldHandle {
  el: HTMLDivElement
  /** Push a value in from outside (timeline apply, remount) — ignored while editing. */
  set(value: number): void
  /** True while a drag or a typed edit is in flight — suppresses external writes. */
  readonly busy: boolean
}

/**
 * How much one pixel of drag is worth, per semantic kind.
 *
 * These are honest units rather than a shared default: an `angle` lives
 * on [-PI, PI] and wants hundredths of a radian per pixel, a `length` in
 * scene units wants whole units, a `completion` on [0,1] wants
 * thousandths. Getting this wrong is what makes a numeric field feel
 * broken — a param that needs 600 units of travel and one that needs 1.0
 * cannot share a sensitivity.
 */
const STEP_PER_PIXEL: Record<string, number> = {
  scalar: 1,
  length: 1,
  angle: 0.01,
  bipolar: 0.005,
  completion: 0.005,
  integer: 0.1,
}

/** How the value is written down — precision that matches the kind. */
const DECIMALS: Record<string, number> = {
  scalar: 2,
  length: 2,
  angle: 3,
  bipolar: 3,
  completion: 3,
  integer: 0,
}

const stepFor = (param: Param<ParamValue>): number => STEP_PER_PIXEL[param.kind] ?? 1

const decimalsFor = (param: Param<ParamValue>): number => DECIMALS[param.kind] ?? 2

/**
 * A number as a human reads it: no trailing zeros past the point, but
 * never scientific notation and never a 17-digit float tail. `250` stays
 * `250`, `0.5` stays `0.5`, `1.5707963` becomes `1.571`.
 */
export const formatNumber = (value: number, decimals: number): string => {
  if (!Number.isFinite(value)) return "—"
  const fixed = value.toFixed(decimals)
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed
}

/** Clamp to the param's declared bounds and integer-ness. */
const clamped = (param: Param<ParamValue>, value: number): number => {
  let out = value
  if (param.min !== undefined) out = Math.max(param.min, out)
  if (param.max !== undefined) out = Math.min(param.max, out)
  if (param.kind === "integer") out = Math.round(out)
  return out
}

/**
 * Build one numeric field for a param.
 *
 * The DOM is a single contenteditable-free input: an `<input type=text>`
 * that is read-only until clicked. Read-only is what lets the drag own
 * the pointer without the browser starting a text selection, and one
 * click flips it editable — the same element in two modes rather than
 * two elements swapped in and out (which loses focus and the caret).
 */
export const numericField = (
  param: Param<ParamValue>,
  opts: NumericFieldOpts,
): NumericFieldHandle => {
  const el = document.createElement("div")
  el.className = "num"

  const input = document.createElement("input")
  input.type = "text"
  input.className = "numinput"
  input.readOnly = true
  input.spellcheck = false
  const decimals = decimalsFor(param)
  input.value = formatNumber(param.value as number, decimals)
  el.appendChild(input)

  let typing = false
  let dragging = false
  /** Movement accumulated since pointerdown — the drag's own coordinate. */
  let travelled = 0
  /** The value the gesture started from; Escape restores it. */
  let entry = 0
  let moved = false

  const DRAG_THRESHOLD_PX = 3

  const show = (value: number) => {
    input.value = formatNumber(value, decimals)
  }

  const emit = (value: number) => {
    show(value)
    opts.onInput(value)
  }

  // --- Drag to scrub -------------------------------------------------------

  el.addEventListener(
    "pointerdown",
    (e) => {
      if (typing || e.button !== 0) return
      e.preventDefault()
      dragging = true
      moved = false
      travelled = 0
      entry = param.value as number
      el.setPointerCapture(e.pointerId)
      el.classList.add("dragging")
    },
    { signal: opts.signal },
  )

  el.addEventListener(
    "pointermove",
    (e) => {
      if (!dragging) return
      travelled += e.movementX
      if (!moved && Math.abs(travelled) < DRAG_THRESHOLD_PX) return
      moved = true
      // Modifiers are read LIVE, so a scrub can change gear mid-gesture
      // without restarting — which is how C4D behaves and how anyone who
      // overshoots expects to recover.
      const gear = e.shiftKey ? 0.1 : e.metaKey || e.ctrlKey ? 10 : 1
      emit(clamped(param, entry + travelled * stepFor(param) * gear))
    },
    { signal: opts.signal },
  )

  const endDrag = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    el.releasePointerCapture(e.pointerId)
    el.classList.remove("dragging")
    if (moved) {
      opts.onCommit(param.value as number)
    } else {
      // A click, not a drag: become an editable field, all selected, so
      // typing replaces rather than appends.
      typing = true
      input.readOnly = false
      el.classList.add("typing")
      input.focus()
      input.select()
    }
  }
  el.addEventListener("pointerup", endDrag, { signal: opts.signal })
  el.addEventListener("pointercancel", endDrag, { signal: opts.signal })

  // --- Type an exact value -------------------------------------------------

  const stopTyping = () => {
    typing = false
    input.readOnly = true
    el.classList.remove("typing")
    input.blur()
  }

  input.addEventListener(
    "keydown",
    (e) => {
      if (!typing) return
      if (e.key === "Enter") {
        e.preventDefault()
        // Arithmetic a human would otherwise do in their head: a field
        // that accepts "250" should accept "250/2". Deliberately only
        // the four operators and digits — no eval of arbitrary source.
        const parsed = parseEntry(input.value)
        if (parsed !== undefined) {
          const value = clamped(param, parsed)
          emit(value)
          opts.onCommit(value)
        } else {
          show(param.value as number)
        }
        stopTyping()
      } else if (e.key === "Escape") {
        e.preventDefault()
        show(param.value as number)
        stopTyping()
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        // Nudge by one step; shift for ten. The keyboard half of the drag.
        e.preventDefault()
        const dir = e.key === "ArrowUp" ? 1 : -1
        const unit = stepFor(param) * (e.shiftKey ? 10 : 1) * (param.kind === "integer" ? 10 : 1)
        const value = clamped(param, (param.value as number) + dir * unit)
        emit(value)
        opts.onCommit(value)
        show(value)
      }
      e.stopPropagation()
    },
    { signal: opts.signal },
  )

  input.addEventListener(
    "blur",
    () => {
      if (!typing) return
      const parsed = parseEntry(input.value)
      if (parsed !== undefined) {
        const value = clamped(param, parsed)
        emit(value)
        opts.onCommit(value)
      } else {
        show(param.value as number)
      }
      stopTyping()
    },
    { signal: opts.signal },
  )

  return {
    el,
    set(value: number) {
      if (typing || dragging) return
      show(value)
    },
    get busy() {
      return typing || dragging
    },
  }
}

/**
 * Parse what a human typed: a plain number, or one simple infix
 * expression over numbers (`250/2`, `100 + 40`). Anything else is
 * rejected rather than guessed at — a field that silently reinterprets
 * a typo is worse than one that refuses it.
 */
export const parseEntry = (text: string): number | undefined => {
  const trimmed = text.trim().replace(/\s+/g, "")
  if (trimmed === "") return undefined
  const plain = Number(trimmed)
  if (Number.isFinite(plain)) return plain
  const infix = /^(-?\d*\.?\d+)([+\-*/])(-?\d*\.?\d+)$/.exec(trimmed)
  if (!infix) return undefined
  const a = Number(infix[1])
  const b = Number(infix[3])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined
  const value =
    infix[2] === "+" ? a + b : infix[2] === "-" ? a - b : infix[2] === "*" ? a * b : a / b
  return Number.isFinite(value) ? value : undefined
}

/**
 * Where a slider still earns its width: a param whose RANGE is the
 * meaning, not the number. `completion` reads as a proportion of a whole
 * and `bipolar` as a position between two poles — for those, seeing
 * where the handle sits says something the digits do not. Everything
 * else (a length in scene units, an angle, a count) is a number that
 * happens to be adjustable, and gets the numeric field alone.
 */
export const wantsSlider = (param: Param<ParamValue>): boolean =>
  param.kind === "completion" || param.kind === "bipolar"
