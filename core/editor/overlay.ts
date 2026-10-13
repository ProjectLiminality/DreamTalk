/**
 * The 2D overlay — one mapping from a holon on stage to a box on screen,
 * shared by every affordance drawn over the scene (the game loop's ticks and
 * caption, creator mode's rims, the Dream Explorer's rings).
 *
 * THE BUG IT ENDS (2026-10-13). Each overlay was a full-window canvas styled
 * `position: fixed; inset: 0` and sized `innerWidth × devicePixelRatio` for
 * crisp lines. But `inset` does not stretch a canvas — a replaced element
 * keeps its intrinsic size — so at DPR 2 the overlay was laid out TWICE the
 * window's size, and everything drawn on it in CSS pixels landed at twice
 * its distance from the top-left: boxes offset toward the lower right,
 * growing with distance. DPR 1 (every headless capture) never showed it.
 * The fix is the explicit CSS size here, in the one place overlays are made.
 *
 * Two spaces, and only two: the host's DRAWING-BUFFER pixels (what
 * `boundsOf` and `pick` speak — the stage canvas's width × height) and the
 * page's CSS pixels (what pointer events and overlays speak). `clientBox`
 * carries one to the other through the stage canvas's actual box.
 */

/** A screen box in the stage canvas's drawing-buffer pixels — what boundsOf returns. */
export interface PixelBox {
  min: { x: number; y: number }
  max: { x: number; y: number }
}

/** A box in CSS (client) pixels. */
export interface ClientBox {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Drawing-buffer pixels → client (CSS) pixels. The stage is rendered at its
 * buffer size and stretched to its CSS box, so a box is carried through the
 * same stretch the pixels were — and through the canvas's offset in the page.
 */
export const bufferToClient = (
  box: PixelBox,
  rect: { left: number; top: number; width: number; height: number },
  buffer: { width: number; height: number },
): ClientBox => {
  const sx = rect.width / (buffer.width || 1)
  const sy = rect.height / (buffer.height || 1)
  return {
    x: rect.left + box.min.x * sx,
    y: rect.top + box.min.y * sy,
    w: (box.max.x - box.min.x) * sx,
    h: (box.max.y - box.min.y) * sy,
  }
}

/** A holon's box on the page, in CSS pixels — or undefined when it has no ink on screen. */
export const clientBox = (stage: HTMLCanvasElement, box: PixelBox | undefined): ClientBox | undefined =>
  box ? bufferToClient(box, stage.getBoundingClientRect(), stage) : undefined

/** The CSS every full-window overlay canvas carries — the explicit size is the point. */
export const OVERLAY_CSS = "position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; pointer-events: none;"

/** Make a full-window overlay canvas (append it yourself). */
export const makeOverlay = (className: string, zIndex: number): HTMLCanvasElement => {
  const c = document.createElement("canvas")
  c.className = className
  c.style.cssText = `${OVERLAY_CSS} z-index: ${zIndex};`
  return c
}

/**
 * Size the overlay's buffer to the window at the device's pixel ratio, pin
 * its CSS size to the window, clear it, and hand back a context that draws
 * in CSS pixels. Null without a 2D context.
 */
export const beginOverlay = (overlay: HTMLCanvasElement): CanvasRenderingContext2D | null => {
  const dpr = window.devicePixelRatio || 1
  const w = Math.round(window.innerWidth * dpr)
  const h = Math.round(window.innerHeight * dpr)
  if (overlay.width !== w || overlay.height !== h) {
    overlay.width = w
    overlay.height = h
  }
  overlay.style.width = "100vw"
  overlay.style.height = "100vh"
  const ctx = overlay.getContext("2d")
  if (!ctx) return null
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}
