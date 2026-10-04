/**
 * magic.ts — the magic switch: which eyes ✦ (and the voice) read with.
 *
 *   auto · geometry · groq · clef · haiku · opus · compare all
 *
 * A small select beside ✦. "auto" is the daemon's chain (backends.ts); any
 * other choice is exactly that reader (recognize.ts eyesFor). A reader
 * whose key is missing is shown greyed — "groq — add key" — and can't be
 * chosen; the daemon says which are available (GET /api/recognize/config
 * `eyes`). "compare all" makes ✦ run every available reader side by side
 * (Shift+✦ does it once, whatever the switch says). The choice is
 * remembered per browser.
 *
 * Also the calm line after each ✦: which reader answered, how long it took,
 * how well its reading lies on the ink.
 */

import type { RecognizeResponse } from "./protocol"

export interface EyesOption {
  id: string
  label: string
  available: boolean
  needs?: string
  fast: boolean
}

const KEY = "dreamtalk.magic"
export const COMPARE = "compare"

const DEFAULT_OPTIONS: EyesOption[] = [
  { id: "auto", label: "auto", available: true, fast: false },
  { id: "geometry", label: "geometry", available: true, fast: true },
  { id: "groq", label: "groq", available: false, fast: true },
  { id: "clef", label: "clef", available: false, fast: true },
  { id: "haiku", label: "haiku", available: false, fast: true },
  { id: "opus", label: "opus", available: true, fast: false },
]

const read = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "auto"
  } catch {
    return "auto"
  }
}

let current = read()

/** The reader the page asks with now ("compare" asks with auto, per reader). */
export const currentEyes = (): string => (current === COMPARE ? "auto" : current)

export interface MagicSwitch {
  /** The switch's value: a reader id, or "compare". */
  choice(): string
  /** The daemon said which readers exist. */
  setOptions(eyes: readonly EyesOption[]): void
  /** Can the current reader be asked ahead of ✦ (speculate.ts)? */
  fast(): boolean
}

/** The select, placed right after `anchor` (the ✦ button). */
export const installMagic = (anchor: HTMLElement, onChange: () => void): MagicSwitch => {
  let options = DEFAULT_OPTIONS
  const el = document.createElement("select")
  el.id = "magic"
  el.title = "magic: which eyes ✦ reads with (Shift+✦ compares them all)"
  el.style.cssText = "margin-left:6px;font:inherit;font-size:12px;background:transparent;color:inherit;border:1px solid rgba(127,127,127,.4);border-radius:6px;padding:2px 4px;opacity:.85"
  anchor.after(el)
  const render = () => {
    el.innerHTML = ""
    for (const o of [...options, { id: COMPARE, label: "compare all", available: true, fast: false }]) {
      const opt = document.createElement("option")
      opt.value = o.id
      opt.disabled = !o.available
      opt.textContent = o.available ? (o.id === COMPARE ? o.label : `magic: ${o.label}`) : `${o.label} — add key`
      if (!o.available && "needs" in o && o.needs) opt.title = `add ${o.needs} to core/.env`
      el.appendChild(opt)
    }
    // A remembered reader whose key went away falls back to auto.
    if (current !== COMPARE && !options.some((o) => o.id === current && o.available)) current = "auto"
    el.value = current
  }
  el.addEventListener("change", () => {
    current = el.value
    try {
      localStorage.setItem(KEY, current)
    } catch {
      // ignore
    }
    el.blur()
    onChange()
  })
  render()
  return {
    choice: () => current,
    setOptions(eyes) {
      if (eyes.length) options = [...eyes]
      render()
      onChange()
    },
    fast: () => current !== COMPARE && !!options.find((o) => o.id === current)?.fast,
  }
}

/** "groq · 736 ms · fit 0.014" — who answered, how fast, how well it lies on the ink. */
export const viaLine = (res: RecognizeResponse, ms: number, ahead = false): string => {
  const who = (res.backend ?? "").split(":")[0] || "?"
  const fit = res.fit !== undefined ? ` · fit ${res.fit.toFixed(3)}` : ""
  return `${who} · ${ahead ? "read ahead" : `${Math.round(ms)} ms`}${fit}`
}
