/**
 * The hands' visible face — calibration and hand talk, discoverable on screen
 * (not only from the console). Shown only while a hand is in play.
 *
 *   C   calibrate the pinch: gold rings one by one ("pinch on the ring 2/6"),
 *       the ring fills as the fingers close, "calibrated ✓" at the end;
 *       Esc cancels, C again redoes. Until a calibration is stored, a quiet
 *       line says so.
 *   A legend, bottom left: what each gesture does, the one in use lit gold.
 *
 *   I   hand talk ("invoke"): name a mudra, record three takes (a countdown,
 *       then hold it still), record the hand at rest once (`_rest`), and bind
 *       each mudra to an action — a state of the scene, home, a symbol to
 *       summon, dismiss.
 *
 * Both keys are the player's own (src/automaton.ts RESERVED_KEYS), so no
 * scene's axis can take them. Quiet grey and gold, like the rest of the HUD.
 */

import { SHELF } from "../sketch/catalogue"
import type { Gesture, HandPlay } from "./handplay"

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
.dt-hui-legend { left: 12px; top: 12px; line-height: 18px; color: #777; }
.dt-hui-legend div { transition: color 0.12s; }
.dt-hui-legend b { display: inline-block; min-width: 96px; font-weight: 500; color: #999; }
.dt-hui-legend .on, .dt-hui-legend .on b { color: rgb(255,199,84); }
.dt-hui-legend .dt-hui-swap { margin-top: 4px; color: #555; cursor: pointer; pointer-events: auto; }
.dt-hui-legend .dt-hui-swap:hover { color: rgb(255,199,84); }
`

/** What each gesture does — the legend's rows, by the gesture that lights them; `who` names the hand. */
const LEGEND: readonly [Gesture, "point" | "grab" | "both", string, string][] = [
  ["point", "point", "point", "the spark follows, near and far; brighter as you close"],
  ["pinch", "point", "pinch", "click · drag to slide a state · hold for actions"],
  ["fist", "grab", "fist", "turn the scene · push / pull to come near / go far"],
  ["fists", "both", "two fists", "move · spread / close to zoom · twist to turn"],
]
const other = (side: "left" | "right") => (side === "left" ? "right" : "left")

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
  buttons.innerHTML = `<button data-do="pinch">pinch point</button><button data-do="calibrate">calibrate · C</button><button data-do="talk">hand talk · I</button>`
  const panel = document.createElement("div")
  panel.className = "dt-hui dt-hui-panel"
  panel.style.display = "none"
  // --- pinch point: the cursor's thumb weight and offset, by hand ------------
  const tune = document.createElement("div")
  tune.className = "dt-hui dt-hui-panel"
  tune.style.display = "none"
  const SLIDERS = [
    ["w", "thumb weight", 0, 1, "0 index tip · 1 thumb tip"],
    ["ox", "offset →", -0.6, 0.6, "hand sizes, + right"],
    ["oy", "offset ↓", -0.6, 0.6, "hand sizes, + down"],
  ] as const
  tune.innerHTML =
    `<h4>pinch point</h4>` +
    SLIDERS.map(
      ([k, label, lo, hi, hint]) =>
        `<div class="dt-hui-row" title="${hint}"><span style="min-width:84px">${label}</span>` +
        `<input type="range" data-k="${k}" min="${lo}" max="${hi}" step="0.01" style="flex:1;accent-color:rgb(255,199,84)">` +
        `<span data-v="${k}" style="min-width:36px;text-align:right;color:#ddd"></span></div>`,
    ).join("") +
    `<div class="dt-hui-row"><a href="#" data-do="reset" style="color:#888">reset to calibrated</a></div>`
  const showTune = () => {
    const c = hands.calibration
    for (const [k] of SLIDERS) {
      ;(tune.querySelector(`[data-k="${k}"]`) as HTMLInputElement).value = String(c[k])
      tune.querySelector(`[data-v="${k}"]`)!.textContent = c[k].toFixed(2)
    }
  }
  tune.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement
    const k = el.dataset.k as "w" | "ox" | "oy" | undefined
    if (!k) return
    hands.calibration = { ...hands.calibration, [k]: Number(el.value) }
    tune.querySelector(`[data-v="${k}"]`)!.textContent = Number(el.value).toFixed(2)
  })
  tune.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).dataset.do !== "reset") return
    e.preventDefault()
    hands.resetCalibration()
    showTune()
  })
  const toggleTune = (on = tune.style.display === "none") => {
    tune.style.display = on ? "" : "none"
    if (on) {
      togglePanel(false)
      showTune()
    }
  }
  const legend = document.createElement("div")
  legend.className = "dt-hui dt-hui-legend"
  let rows = new Map<Gesture, HTMLElement>()
  let lit: Gesture | undefined
  // One job per hand, named in the legend — "swap hands" for the left-handed.
  const renderLegend = () => {
    const g = hands.grabHand
    const hand = (who: "point" | "grab" | "both") =>
      g === "either" || who === "both" ? "" : `${who === "grab" ? g : other(g)} `
    legend.innerHTML =
      LEGEND.map(([id, who, name, what]) => `<div data-g="${id}"><b>${hand(who)}${name}</b>${what}</div>`).join("") +
      (g === "either" ? "" : `<div class="dt-hui-swap">swap hands (${other(g)} grabs)</div>`)
    rows = new Map(Array.from(legend.querySelectorAll<HTMLElement>("[data-g]"), (el) => [el.dataset.g as Gesture, el]))
    lit = undefined
  }
  legend.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).classList.contains("dt-hui-swap") || hands.grabHand === "either") return
    hands.grabHand = other(hands.grabHand)
    renderLegend()
  })
  renderLegend()
  document.body.append(prompt, buttons, panel, legend, tune)
  signal.addEventListener("abort", () => {
    tune.remove()
    legend.remove()
    prompt.remove()
    buttons.remove()
    panel.remove()
  })

  const calibrate = () =>
    void hands.calibrate().then(() => {
      if (tune.style.display !== "none") showTune()
    })
  const togglePanel = (on = panel.style.display === "none") => {
    panel.style.display = on ? "" : "none"
    if (on) {
      tune.style.display = "none"
      renderPanel()
    }
  }
  buttons.addEventListener("click", (e) => {
    const what = (e.target as HTMLElement).dataset.do
    if (what === "calibrate") calibrate()
    if (what === "talk") togglePanel()
    if (what === "pinch") toggleTune()
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
        else if (tune.style.display !== "none") toggleTune(false)
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
  // Polled, and only what changed is touched: no work on the hand frames' path.
  let shown: string | undefined
  const tick = setInterval(() => {
    const active = hands.handsActive || hands.calibrating
    const now = `${active} ${hands.calibrating}`
    if (now !== shown) {
      shown = now
      buttons.style.display = active ? "" : "none"
      legend.style.display = active && !hands.calibrating ? "" : "none"
    }
    const g = active ? hands.gesture : undefined
    if (g !== lit) {
      rows.get(lit!)?.classList.remove("on")
      rows.get(g!)?.classList.add("on")
      lit = g
    }
    const text = active && !hands.calibrating && !hands.calibrationStored ? "press C to calibrate your pinch" : ""
    if (prompt.textContent !== text) prompt.textContent = text
  }, 100)
  signal.addEventListener("abort", () => clearInterval(tick))
}
