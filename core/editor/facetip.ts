/**
 * facetip.ts — a sovereign symbol's DreamTalk face, on hover.
 *
 * Every DreamNode has three faces (TASTE "Architecture"): linguistic,
 * geometric, functional. The outline and the cast bar show a holon's
 * NAME and an 18px glyph traced from its geometry — enough to find a
 * row, not enough to recognise the symbol. The rendered face
 * (`core/vocabulary/<Name>/<Name>.png`) is the geometric face proper:
 * the thing the holon actually looks like, rendered rather than
 * approximated. This shows it, briefly, when the pointer rests.
 *
 * ## Why a delay, and why one at a time
 *
 * Keynote-calm (TASTE "The Editor"): a card that appeared instantly
 * would flicker across every row the pointer crossed on its way
 * somewhere else, which is the opposite of calm. ~400ms of rest is the
 * difference between "passing over" and "looking at". Exactly one card
 * exists at a time, it fades rather than pops, and it NEVER takes
 * pointer events — the row underneath stays clickable while the card is
 * up, so the tooltip cannot get between the hand and the thing.
 *
 * ## Why this degrades to nothing
 *
 * The images come from the daemon (`/api/face/<Name>`). Under a static
 * `serve.ts` that route does not exist, the fetch 404s, and no card
 * appears — the editor is otherwise unaffected. A holon with no face
 * png (a primitive, a scene-local class) is the same case. Nothing here
 * is load-bearing; a face that cannot be shown is simply not shown, and
 * the negative is remembered so a missing image is asked for once.
 */

/** Rest before a card appears. Long enough to mean "looking at". */
const HOVER_DELAY_MS = 400

/** The card's image box. Big enough to recognise, small enough to float. */
const FACE_SIZE = 160

/** Where the daemon serves rendered faces from. */
const FACE_ENDPOINT = "/api/face"

/** Gap between the card and the element it describes. */
const OFFSET = 12

/**
 * Which names have a face, once asked. `true` while the image is in
 * flight or loaded, `false` once it has failed — so a scene full of
 * primitives makes at most one request per class, ever.
 */
const known = new Map<string, boolean>()

let card: HTMLDivElement | undefined
let timer: number | undefined
let current: string | undefined

const ensureCard = (): HTMLDivElement => {
  if (card) return card
  const el = document.createElement("div")
  el.className = "facetip"
  document.body.appendChild(el)
  card = el
  return el
}

/**
 * Which way the card steps off its anchor.
 *
 * "Do not occlude" means more than not covering the hovered element —
 * it means not covering its NEIGHBOURS, and neighbours lie along the
 * axis the anchor's container runs. So the card steps off the SHORT
 * axis: down from a chip in the horizontal cast bar (whose siblings are
 * to its left and right), sideways from a row in the vertical outline
 * (whose siblings are above and below it). Getting this backwards is
 * how a tooltip ends up hiding the three things next to the one you
 * asked about — which the first version of this did.
 */
export type TipSide = "below" | "beside"

/**
 * Place the card so it clears its anchor and its anchor's neighbours,
 * and stays inside the window.
 *
 * The preferred direction is tried first and flipped only when it would
 * clip: `below` becomes above, `beside` prefers the right (the outline
 * sits at the left edge, so that is where the room is) and flips left.
 * The other axis is aligned to the anchor and then clamped, so a chip
 * near the right edge or a row near the bottom still gets a whole card.
 */
const place = (el: HTMLElement, anchor: DOMRect, side: TipSide): void => {
  const w = el.offsetWidth
  const h = el.offsetHeight
  const margin = 8

  let left: number
  let top: number

  if (side === "below") {
    top = anchor.bottom + OFFSET
    if (top + h > window.innerHeight - margin) top = anchor.top - OFFSET - h
    // Centred under the chip, then clamped into the window.
    left = anchor.left + anchor.width / 2 - w / 2
  } else {
    left = anchor.right + OFFSET
    if (left + w > window.innerWidth - margin) left = anchor.left - OFFSET - w
    top = anchor.top + anchor.height / 2 - h / 2
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - w - margin))
  top = Math.max(margin, Math.min(top, window.innerHeight - h - margin))

  el.style.left = `${Math.round(left)}px`
  el.style.top = `${Math.round(top)}px`
}

/** Take the card down. Safe to call at any time, from any state. */
export const hideFace = (): void => {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
  current = undefined
  if (card) card.classList.remove("shown")
}

const show = (name: string, anchor: HTMLElement, side: TipSide): void => {
  const el = ensureCard()
  el.textContent = ""

  const img = document.createElement("img")
  img.width = FACE_SIZE
  img.height = FACE_SIZE
  img.alt = ""
  img.decoding = "async"

  const label = document.createElement("div")
  label.className = "facetipname"
  label.textContent = name

  img.addEventListener("load", () => {
    known.set(name, true)
    // The pointer may have moved on while the image was in flight.
    if (current !== name) return
    el.appendChild(img)
    el.appendChild(label)
    el.classList.add("shown")
    place(el, anchor.getBoundingClientRect(), side)
  })

  img.addEventListener("error", () => {
    // No face for this symbol. Remember, so we ask exactly once.
    known.set(name, false)
    if (current === name) hideFace()
  })

  img.src = `${FACE_ENDPOINT}/${encodeURIComponent(name)}`
}

/**
 * Give an element a face tooltip for `name`.
 *
 * `name` is a class name — the holon's, which is also its vocabulary
 * directory. Elements whose class has no face cost one failed request
 * the first time and nothing afterwards.
 *
 * The `signal` ties the listeners to the caller's lifetime, the way the
 * rest of the editor's mounts do: a rebuild removes the row and the
 * listeners go with it.
 */
export const attachFaceTip = (
  el: HTMLElement,
  name: string,
  signal: AbortSignal,
  side: TipSide = "beside",
): void => {
  if (known.get(name) === false) return

  el.addEventListener(
    "pointerenter",
    () => {
      if (known.get(name) === false) return
      if (timer !== undefined) clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = undefined
        current = name
        show(name, el, side)
      }, HOVER_DELAY_MS)
    },
    { signal },
  )

  el.addEventListener("pointerleave", () => hideFace(), { signal })
  // A click means the hand has decided; the card has no business
  // lingering over whatever the click just changed.
  el.addEventListener("click", () => hideFace(), { signal })
  signal.addEventListener("abort", () => hideFace())
}

/** Forget which names have faces — a rebuild may have added one. */
export const clearFaceCache = (): void => known.clear()
