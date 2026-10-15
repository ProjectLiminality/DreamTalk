/**
 * The hands' visible face — calibration and hand talk, discoverable on screen
 * (not only from the console). Shown only while a hand is in play.
 *
 *   C   calibrate the pinch: gold rings one by one ("pinch on the ring 2/6"),
 *       the ring fills as the fingers close, "calibrated ✓" at the end;
 *       Esc cancels, C again redoes. Until a calibration is stored, a quiet
 *       line says so.
 *   I   hand talk ("invoke"): name a mudra, record three takes (a countdown,
 *       then hold it still), record the hand at rest once (`_rest`), and bind
 *       each mudra to an action — a state of the scene, home, a symbol to
 *       summon, dismiss.
 *
 * Both keys are the player's own (src/automaton.ts RESERVED_KEYS), so no
 * scene's axis can take them. Quiet grey and gold, like the rest of the HUD.
 */

import { SHELF } from "../sketch/catalogue"
import type { HandPlay } from "./handplay"

const STYLE = `
.dt-hui { position: fixed; z-index: 75; font: 12px -apple-system, system-ui, sans-serif; color: #888; user-select: none; }
.dt-hui-prompt { left: 50%; bottom: 14px; transform: translateX(-50%); }
.dt-hui-buttons { right: 12px; bottom: 34px; display: flex; gap: 8px; }
.dt-hui button { font: inherit; color: #999; background: #111; border: 1px solid #333; border-radius: 6px; padding: 3px 8px; cursor: pointer; }
.dt-hui button:hover { color: rgb(255,199,84); border-color: rgb(255,199,84); }
.dt-hui-panel { right: 12px; bottom: 64px; width: 300px; background: #0c0c0c; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px 12px; color: #aaa; }
.dt-hui-panel h4 { margin: 0 0 8px; font-weight: 500; color: #ccc; }
.dt-hui-panel input, .dt-hui-panel select { font: inherit; background: #151515; color: #ddd; border: 1px solid #333; border-radius: 4px; padding: 2px 6px; }
.dt-hui-row { display: flex; gap: 6px; align-items: center; margin: 4px 0; }
.dt-hui-status { color: rgb(255,199,84); min-height: 16px; margin: 6px 0; }
.dt-hui-list div { display: flex; gap: 6px; align-items: center; margin: 3px 0; }
.dt-hui-list b { font-weight: 500; color: #ddd; min-width: 64px; }
`

export const mountHandUI = (hands: HandPlay, signal: AbortSignal): void => {
  if (!document.getElementById("dt-hui-style")) {
    const style = document.createElement("style")
    style.id = "dt-hui-style"
    style.textContent = STYLE
    document.head.append(style)
  }
  const prompt = document.createElement("div")
  prompt.className = "dt-hui dt-hui-prompt"
  const buttons = document.createElement("div")
  buttons.className = "dt-hui dt-hui-buttons"
  buttons.innerHTML = `<button data-do="calibrate">calibrate · C</button><button data-do="talk">hand talk · I</button>`
  const panel = document.createElement("div")
  panel.className = "dt-hui dt-hui-panel"
  panel.style.display = "none"
  document.body.append(prompt, buttons, panel)
  signal.addEventListener("abort", () => {
    prompt.remove()
    buttons.remove()
    panel.remove()
  })

  const calibrate = () => void hands.calibrate()
  const togglePanel = (on = panel.style.display === "none") => {
    panel.style.display = on ? "" : "none"
    if (on) renderPanel()
  }
  buttons.addEventListener("click", (e) => {
    const what = (e.target as HTMLElement).dataset.do
    if (what === "calibrate") calibrate()
    if (what === "talk") togglePanel()
  })

  // --- hand talk panel ---------------------------------------------------------
  let status = ""
  let busy = false
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  const actions = () => [...hands.actionNames(), ...SHELF.map((s) => `invoke:${s.className}`)]
  const renderPanel = () => {
    const { library, bindings } = hands.mudras.store
    const options = actions().map((a) => `<option value="${esc(a)}"></option>`).join("")
    panel.innerHTML = `
      <h4>hand talk</h4>
      <div class="dt-hui-row"><input class="dt-hui-name" placeholder="name it" size="12">
        <select class="dt-hui-kind"><option value="pose">held</option><option value="motion">moving</option></select>
        <button data-do="take">record take</button></div>
      <div class="dt-hui-row"><button data-do="rest">record your hand at rest</button></div>
      <div class="dt-hui-status">${esc(status)}</div>
      <datalist id="dt-hui-actions">${options}</datalist>
      <div class="dt-hui-list">${library.mudras
        .filter((m) => !m.name.startsWith("_"))
        .map(
          (m) =>
            `<div data-name="${esc(m.name)}"><b>${esc(m.name)}</b><span>×${m.examples.length}</span>
              <input list="dt-hui-actions" placeholder="does…" value="${esc(bindings[m.name] ?? "")}" size="14">
              <button data-do="forget">forget</button></div>`,
        )
        .join("")}</div>
      <div class="dt-hui-row" style="color:#666">${library.mudras.some((m) => m.name === "_rest") ? "rest recorded ✓" : "record your resting hand once, so it is never mistaken for a mudra"} · I / Esc to close</div>`
  }
  const take = async (name: string, kind: "pose" | "motion") => {
    if (busy || !name) return
    busy = true
    for (const n of [3, 2, 1]) {
      status = `${kind === "pose" ? "form" : "get ready for"} “${name.replace(/^_/, "")}”… ${n}`
      renderPanel()
      await new Promise((r) => setTimeout(r, 600))
    }
    status = kind === "pose" ? `hold it still…` : `do it now…`
    renderPanel()
    const takes = await hands.mudras.record(name, kind, kind === "pose" ? 1 : 1.5)
    status = name === "_rest" ? "rest recorded ✓" : `“${name}” — ${takes} take${takes === 1 ? "" : "s"}${takes < 3 ? ", record more" : " ✓"}`
    busy = false
    renderPanel()
  }
  panel.addEventListener("click", (e) => {
    const el = e.target as HTMLElement
    const what = el.dataset.do
    if (what === "take") {
      const name = (panel.querySelector(".dt-hui-name") as HTMLInputElement).value.trim()
      const kind = (panel.querySelector(".dt-hui-kind") as HTMLSelectElement).value as "pose" | "motion"
      void take(name, kind)
    } else if (what === "rest") void take("_rest", "pose")
    else if (what === "forget") {
      hands.mudras.forget(el.closest<HTMLElement>("[data-name]")!.dataset.name!)
      renderPanel()
    }
  })
  panel.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement
    const row = input.closest<HTMLElement>("[data-name]")
    if (row && input.list) hands.mudras.bind(row.dataset.name!, input.value.trim())
  })

  // --- keys --------------------------------------------------------------------
  document.addEventListener(
    "keydown",
    (e) => {
      const t = e.target as HTMLElement | null
      if (t && (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === "Escape") {
        if (hands.calibrating) hands.cancelCalibration()
        else if (panel.style.display !== "none") togglePanel(false)
        return
      }
      if (!hands.handsActive && !hands.calibrating) return
      if (e.code === "KeyC") {
        e.preventDefault()
        calibrate()
      } else if (e.code === "KeyI") {
        e.preventDefault()
        togglePanel()
      }
    },
    { signal },
  )

  // --- quiet presence ------------------------------------------------------------
  const tick = setInterval(() => {
    const active = hands.handsActive || hands.calibrating
    buttons.style.display = active ? "" : "none"
    prompt.textContent =
      active && !hands.calibrating && !hands.calibrationStored ? "press C to calibrate your pinch" : ""
  }, 300)
  signal.addEventListener("abort", () => clearInterval(tick))
}
