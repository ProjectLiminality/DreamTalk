/**
 * The transform gizmo (docs/EDITOR-VOICE-COMMENTS.md step 2) — a beautiful,
 * minimalist x/y/z manipulator on the selected object.
 *
 * David's framing: "by default it's voice." The mic is the primary, prominent
 * control (agentic-first); the gizmo's transform tools sit in the SAME
 * dimension — the way to nudge WITHOUT voice. So the mode switch reads
 * voice · move · rotate · scale, with voice the default. Choosing move/
 * rotate/scale reveals three axis handles on the selection; dragging one
 * writes x/y/z (move), h/p/b (rotate) or scale, through the SAME live-override
 * + setOverride op path the viewport drag already uses (editor/overrides.ts).
 *
 * This module owns two things: the mode switch UI in the inspector, and the
 * geometry of the axis handles drawn on the marquee overlay (their screen
 * positions from the selection's world origin + projected world axes, and the
 * hit-test that says which handle a press landed on). The ray/plane math of a
 * handle drag is manipulate.ts's AxisGesture — reused, not re-derived. main.ts
 * owns the pointer wiring and where a value GOES, exactly as it does for the
 * view-plane move.
 */

export type GizmoMode = "voice" | "move" | "rotate" | "scale"

/** The three axes, in x/y/z order — the handle colours key off the index. */
export type AxisIndex = 0 | 1 | 2

/** Which holon param a handle writes, per mode. */
export const AXIS_PARAM: Record<Exclude<GizmoMode, "voice">, [string, string, string]> = {
  move: ["x", "y", "z"],
  rotate: ["h", "p", "b"],
  scale: ["scale", "scale", "scale"], // scale is uniform — every ring nudges it
}

/**
 * Handle geometry in canvas pixels: the shared origin and, per axis, the tip
 * the handle line reaches to. Purely a function of the projected screen
 * points; the drawing and the hit-test both read it.
 */
export interface HandleGeometry {
  origin: { x: number; y: number }
  tips: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]
}

/** Canonical axis colours (TASTE): x = red, y = blue, z = a quiet gray. */
const AXIS_COLOR = ["#ff644e", "#00a2ff", "#8a8a94"] as const
/** How close (canvas px) a press must fall to a handle line to grab it. */
export const HANDLE_HIT = 11
/** Minimum on-screen handle length, so an edge-on axis stays grabbable. */
const MIN_ARM = 26
/** The nominal on-screen length of a handle before projection clamps it. */
const ARM = 62

/** Distance from point p to the segment a→b, in the same units as the inputs. */
export const distanceToSegment = (
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * Build the on-screen handle geometry from the origin and the axis
 * DIRECTIONS already projected to screen pixels (world-axis-tip minus
 * world-origin, in canvas space). Each arm is normalized to a fixed pixel
 * length so the gizmo is a constant on-screen size, and floored at MIN_ARM
 * so an axis pointing at the camera still shows a stub to grab.
 */
export const handleGeometry = (
  origin: { x: number; y: number },
  screenAxes: readonly { x: number; y: number }[],
): HandleGeometry => {
  const tip = (d: { x: number; y: number }): { x: number; y: number } => {
    const len = Math.hypot(d.x, d.y)
    if (len < 1e-6) return { x: origin.x + MIN_ARM, y: origin.y } // degenerate → a right stub
    const armLen = Math.max(MIN_ARM, Math.min(ARM, len))
    return { x: origin.x + (d.x / len) * armLen, y: origin.y + (d.y / len) * armLen }
  }
  return {
    origin,
    tips: [tip(screenAxes[0]!), tip(screenAxes[1]!), tip(screenAxes[2]!)],
  }
}

/** Which axis handle a press at (px, py) grabs, or null — nearest within HANDLE_HIT. */
export const hitHandle = (
  geo: HandleGeometry,
  px: number,
  py: number,
): AxisIndex | null => {
  let best: AxisIndex | null = null
  let bestDist = HANDLE_HIT
  for (let i = 0; i < 3; i++) {
    const d = distanceToSegment({ x: px, y: py }, geo.origin, geo.tips[i as AxisIndex])
    if (d < bestDist) {
      bestDist = d
      best = i as AxisIndex
    }
  }
  return best
}

/**
 * Paint the handles onto a 2D context (the marquee overlay). A thin line per
 * axis in its colour with a small square knob at the tip; the active axis (a
 * drag in flight) brightens. Minimal by design — three lines and three knobs,
 * no rings, no cones, nothing that competes with the artwork underneath.
 */
export const drawGizmo = (
  ctx: CanvasRenderingContext2D,
  geo: HandleGeometry,
  active: AxisIndex | null,
): void => {
  ctx.save()
  ctx.lineCap = "round"
  for (let i = 0; i < 3; i++) {
    const tip = geo.tips[i as AxisIndex]
    const on = active === i
    ctx.strokeStyle = AXIS_COLOR[i]!
    ctx.fillStyle = AXIS_COLOR[i]!
    ctx.globalAlpha = active === null || on ? 1 : 0.4
    ctx.lineWidth = on ? 2.5 : 1.5
    ctx.beginPath()
    ctx.moveTo(geo.origin.x, geo.origin.y)
    ctx.lineTo(tip.x, tip.y)
    ctx.stroke()
    const s = on ? 5 : 4
    ctx.fillRect(tip.x - s / 2, tip.y - s / 2, s, s)
  }
  // The pivot: a small hollow dot where the axes meet.
  ctx.globalAlpha = 1
  ctx.strokeStyle = "#e8e8ee"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(geo.origin.x, geo.origin.y, 3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/** The mode switch built into the inspector; main.ts owns what each mode does. */
export interface GizmoSwitch {
  readonly el: HTMLElement
  mode: () => GizmoMode
  set: (mode: GizmoMode) => void
}

/**
 * Build the voice · move · rotate · scale switch. Voice is the default and
 * the prominent one (a mic glyph, wider); the transform modes are quiet text
 * beside it. `onChange` fires with the new mode so main.ts can show/hide the
 * handles and repaint.
 */
export const mountGizmoSwitch = (
  host: HTMLElement,
  onChange: (mode: GizmoMode) => void,
  signal: AbortSignal,
): GizmoSwitch => {
  let current: GizmoMode = "voice"

  const section = document.createElement("div")
  section.className = "section gizmosec"
  const heading = document.createElement("h2")
  heading.textContent = "Transform"
  section.appendChild(heading)

  const bar = document.createElement("div")
  bar.className = "gizmobar"

  const buttons = new Map<GizmoMode, HTMLButtonElement>()
  const make = (mode: GizmoMode, label: string, cls: string) => {
    const b = document.createElement("button")
    b.type = "button"
    b.className = `gizbtn ${cls}`
    b.textContent = label
    b.addEventListener("click", () => set(mode), { signal })
    bar.appendChild(b)
    buttons.set(mode, b)
    return b
  }
  // Voice first and prominent — agentic-first, "by default it's voice".
  make("voice", "🎙 Voice", "gizvoice")
  make("move", "Move", "")
  make("rotate", "Rotate", "")
  make("scale", "Scale", "")

  section.appendChild(bar)
  host.appendChild(section)

  const paint = () => {
    for (const [mode, b] of buttons) b.classList.toggle("active", mode === current)
  }

  const set = (mode: GizmoMode) => {
    if (mode === current) return
    current = mode
    paint()
    onChange(current)
  }

  paint()
  return {
    el: section,
    mode: () => current,
    set: (mode) => set(mode),
  }
}

export { AXIS_COLOR }
