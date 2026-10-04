/**
 * voice.ts — speak to the whiteboard.
 *
 * David's vision (2026-10-03): select things — a pen lasso on the
 * reMarkable, or on the Mac — and then just SAY what should happen to them:
 * "make this bigger and open its cube", "turn these into a flower of life
 * with two rings". With NOTHING selected the instruction is about the whole
 * scene: "add a MindVirus swimming towards the circle". Drawing + selecting
 * + speaking, one surface. Claude sees the page (pixels), the selection,
 * the scene data and the transcript, and answers with edits
 * (scripts/instruct.ts) that land as ONE undoable step (state.ts `edit`).
 *
 * PUSH-TO-TALK. The Mac has the microphone; the reMarkable has none.
 *
 *   SPACE held           listen; release → send (not while a field has focus)
 *   🎙 button            click toggles; right-click → type instead
 *   pen button, HOVERING held ≥ 350 ms → listen; release → send. If the tip
 *                        touches while the button is held it was a lasso:
 *                        listening is cancelled, silently.
 *
 * Speech-to-text is the browser's Web Speech API (continuous, interim
 * results): the live words in a calm caption at the bottom of the page,
 * then "thinking…", then Claude's one-line reply for a few seconds. Chrome
 * streams audio to its recognition service and ends a session on long
 * silence (restarted while the key is held); Safari uses on-device / Siri
 * recognition and asks for microphone + speech permission once. Where the
 * API is missing or refused, the caption becomes a text field (Enter sends)
 * — never a dead end.
 *
 * The page hands this module a small host (main.ts) and calls `pen()` with
 * every tablet pen event; everything else lives here.
 */

import {
  PAGE_H,
  PAGE_W,
  type EditOp,
  type InstructRequest,
  type InstructResponse,
  type PenEvent,
} from "./protocol"
import { Dream } from "../src/dream"
import { ThreeHost } from "../src/render/three-host"
import { buildSymbol, framePage } from "./vocabulary"
import { importsOf } from "./catalogue"
import { currentEyes } from "./magic"
import {
  boxOfPoints,
  editCommand,
  selectionBox,
  symbolBox,
  touched,
  type Command,
  type PlacedSymbol,
  type SketchState,
} from "./state"

export interface VoiceHost {
  state(): SketchState
  selection(): string[]
  setSelection(ids: Iterable<string>): void
  commit(cmd: Command, fresh?: string): void
  /** A recognition, ring, or gesture owns the page right now. */
  busy(): boolean
  closeRing(): void
}

export interface Voice {
  /** Every tablet pen event (main.ts handlePen). */
  pen(ev: PenEvent): void
  /** Send an instruction as if it had been spoken. */
  send(text: string): Promise<InstructResponse>
}

type Instructor = (req: InstructRequest) => Promise<InstructResponse>

const ACCENT = "#00a2ff"
/** Hold the pen button this long, hovering, before it means "listen". */
const PEN_HOLD_MS = 350
const REPLY_MS = 5000
/** The image Claude sees: the whole page at this many px per page unit. */
const SNAP_K = 0.5

// --- The page as Claude sees it ------------------------------------------------------

/** Short tags drawn beside every item: S1… symbols, K1… raw ink. */
export const tagsFor = (s: SketchState): Record<string, string> => {
  const out: Record<string, string> = {}
  s.symbols.forEach((y, i) => (out[y.id] = `S${i + 1}`))
  s.strokes.forEach((k, i) => (out[k.id] = `K${i + 1}`))
  return out
}

/** Some symbols staged on the page, framed as the whiteboard frames them. */
class PageDream extends Dream {
  constructor(private readonly placed: readonly PlacedSymbol[]) {
    super()
    framePage(this)
  }

  unfold() {
    for (const y of this.placed) {
      try {
        this.stage(buildSymbol(y))
      } catch {
        // an unbuildable symbol: the data still describes it
      }
    }
  }
}

/**
 * Symbols rendered at snapshot size, read back as brightness per pixel
 * (page-sized, SNAP_K px per page unit). Its own render, not the page's
 * layers: a WebGPU canvas only yields its pixels right after a frame —
 * read later, the page's canvases come back black.
 */
const renderSymbols = async (list: readonly PlacedSymbol[]): Promise<Float32Array | undefined> => {
  if (list.length === 0) return undefined
  const h = Math.round(PAGE_H * SNAP_K)
  const w = Math.round((h * 16) / 9)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  canvas.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;visibility:hidden;pointer-events:none`
  document.body.appendChild(canvas)
  let host: ThreeHost | undefined
  try {
    host = await ThreeHost.mount(new PageDream(list), canvas)
    host.renderer.setPixelRatio(1)
    host.renderer.setSize(w, h, false)
    await host.renderFrame(0)
    await host.renderFrame(0)
    // Now, before the frame is presented and the canvas reads black.
    const pw = Math.round(PAGE_W * SNAP_K)
    const t = document.createElement("canvas")
    t.width = pw
    t.height = h
    const g = t.getContext("2d", { willReadFrequently: true })!
    g.drawImage(canvas, (w - pw) / 2, 0, pw, h, 0, 0, pw, h)
    const d = g.getImageData(0, 0, pw, h).data
    const lum = new Float32Array(pw * h)
    for (let i = 0; i < lum.length; i++) lum[i] = Math.max(d[4 * i]!, d[4 * i + 1]!, d[4 * i + 2]!) / 255
    return lum
  } catch (err) {
    console.warn("[voice] snapshot render failed", err)
    return undefined
  } finally {
    host?.dispose()
    canvas.remove()
  }
}

/**
 * The WHOLE page as a PNG, dark on white like the recognizer's crops (the
 * model reads ink on paper reliably; white-on-black it has called blank):
 * the symbols, the selected ones BLUE, the ink, the selection's frame, and
 * a tag beside every item — so "the circle", "S2" and the pixels name one
 * thing.
 */
const renderPage = async (s: SketchState, selection: ReadonlySet<string>, tags: Record<string, string>): Promise<string> => {
  const K = SNAP_K
  const rest = await renderSymbols(s.symbols.filter((y) => !selection.has(y.id)))
  const lifted = await renderSymbols(s.symbols.filter((y) => selection.has(y.id)))
  const c = document.createElement("canvas")
  c.width = Math.round(PAGE_W * K)
  c.height = Math.round(PAGE_H * K)
  const g = c.getContext("2d")!
  const out = g.createImageData(c.width, c.height)
  const d = out.data
  const blue = [0x00, 0xa2, 0xff]
  for (let i = 0; i < c.width * c.height; i++) {
    const r = rest?.[i] ?? 0
    const l = lifted?.[i] ?? 0
    for (let ch = 0; ch < 3; ch++) d[4 * i + ch] = (255 * (1 - r) + 17 * r) * (1 - l) + blue[ch]! * l
    d[4 * i + 3] = 255
  }
  g.putImageData(out, 0, 0)
  // Ink.
  g.lineCap = "round"
  g.lineJoin = "round"
  for (const k of s.strokes) {
    g.strokeStyle = g.fillStyle = selection.has(k.id) ? ACCENT : "#111"
    g.lineWidth = Math.max(1.5, 4 * K)
    g.beginPath()
    k.points.forEach((p, i) => (i ? g.lineTo(p.x * K, p.y * K) : g.moveTo(p.x * K, p.y * K)))
    if (k.points.length === 1) g.arc(k.points[0]!.x * K, k.points[0]!.y * K, 2, 0, Math.PI * 2)
    g.stroke()
  }
  // The selection's frame.
  const sb = selectionBox(s, selection)
  if (sb) {
    g.strokeStyle = ACCENT
    g.lineWidth = 1.5
    g.setLineDash([6, 5])
    const pad = 16
    g.strokeRect((sb.x - pad) * K, (sb.y - pad) * K, (sb.w + 2 * pad) * K, (sb.h + 2 * pad) * K)
    g.setLineDash([])
  }
  // Tags, at each item's top-left.
  g.font = `600 ${Math.round(26 * K)}px -apple-system, Helvetica, sans-serif`
  g.textBaseline = "bottom"
  const tagAt = (id: string, x: number, y: number) => {
    const text = tags[id]
    if (!text) return
    const tx = Math.max(2, Math.min(c.width - 40, x * K))
    const ty = Math.max(16, y * K - 3)
    g.fillStyle = "rgba(255,255,255,0.8)"
    g.fillRect(tx - 2, ty - Math.round(26 * K) - 1, g.measureText(text).width + 4, Math.round(26 * K) + 2)
    g.fillStyle = selection.has(id) ? ACCENT : "#6a6a72"
    g.fillText(text, tx, ty)
  }
  for (const y of s.symbols) {
    const b = symbolBox(y)
    tagAt(y.id, b.x, b.y)
  }
  for (const k of s.strokes) {
    const b = boxOfPoints(k.points)
    if (b) tagAt(k.id, b.x, b.y)
  }
  return c.toDataURL("image/png").split(",")[1]!
}

const httpInstruct: Instructor = async (req) => {
  const res = await fetch("/api/instruct", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // The magic switch picks the reader for the voice too (magic.ts).
    body: JSON.stringify({ ...req, backend: req.backend ?? currentEyes() }),
  })
  const text = await res.text()
  try {
    const body = JSON.parse(text) as InstructResponse
    if (!res.ok && !body.error) body.error = `instruct ${res.status}`
    return { ops: Array.isArray(body.ops) ? body.ops : [], reply: body.reply ?? "", error: body.error }
  } catch {
    return { ops: [], reply: "", error: res.ok ? "unreadable answer" : `instruct ${res.status}: ${text.slice(0, 80)}` }
  }
}

// --- Speech ------------------------------------------------------------------------------

/** The slice of the Web Speech API used here (not in TS's DOM lib everywhere). */
interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

const speechCtor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

// --- The caption & button ------------------------------------------------------------------

const STYLE = `
#voice { position: fixed; left: 50%; bottom: 26px; transform: translate(-50%, 8px); z-index: 20; display: flex;
  align-items: center; gap: 10px; max-width: min(680px, calc(100vw - 32px)); padding: 10px 18px; border-radius: 20px;
  background: color-mix(in srgb, var(--page) 88%, transparent); box-shadow: 0 0 0 1px var(--edge), 0 8px 30px rgba(0,0,0,0.3);
  color: var(--bright); font: 15px/1.35 -apple-system, "SF Pro", Inter, sans-serif; opacity: 0; pointer-events: none;
  transition: opacity 0.25s, transform 0.25s; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
#voice.on { opacity: 1; transform: translate(-50%, 0); }
#voice.typing { pointer-events: auto; }
#voice .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--dim); }
#voice.listening .dot { background: var(--blue); animation: voicepulse 1.1s ease-in-out infinite; }
#voice.thinking .dot { background: var(--blue); opacity: 0.5; animation: breathe 1.6s ease-in-out infinite; }
#voice.reply .dot { background: var(--blue); }
#voice.error .dot { background: var(--amber); }
#voice .text { overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
#voice .text .interim { color: var(--text); }
#voice .text .hint { color: var(--text); }
#voice input { display: none; width: min(520px, calc(100vw - 110px)); background: none; border: none; outline: none;
  color: var(--bright); font: inherit; user-select: text; -webkit-user-select: text; }
#voice.typing input { display: block; }
#voice.typing .text { display: none; }
#toolbar #mic.on { color: var(--blue); border-color: var(--blue); }
@keyframes voicepulse { 50% { transform: scale(1.5); opacity: 0.55; } }
`

// --- Install -----------------------------------------------------------------------------

export const installVoice = (host: VoiceHost): Voice => {
  const style = document.createElement("style")
  style.textContent = STYLE
  document.head.appendChild(style)

  const cap = document.createElement("div")
  cap.id = "voice"
  cap.innerHTML = `<span class="dot"></span><span class="text"></span><input spellcheck="false" autocomplete="off" placeholder="say what should happen — Enter sends, Esc cancels" />`
  document.body.appendChild(cap)
  const textEl = cap.querySelector(".text") as HTMLSpanElement
  const input = cap.querySelector("input") as HTMLInputElement

  const mic = document.createElement("button")
  mic.id = "mic"
  mic.textContent = "🎙"
  mic.title = "Speak an instruction — hold Space, or hold the pen button while hovering. Click to start/stop; right-click to type."
  const anchor = document.getElementById("redo")
  if (anchor) anchor.insertAdjacentElement("afterend", mic)
  else document.getElementById("toolbar")?.appendChild(mic)
  mic.addEventListener("pointerdown", (e) => e.preventDefault())

  type Phase = "idle" | "listening" | "typing" | "thinking" | "reply"
  let phase: Phase = "idle"
  let source: "key" | "pen" | "button" | undefined
  let rec: Recognition | undefined
  /** Text heard in earlier sessions of this hold (Chrome restarts on silence). */
  let heard = ""
  let finalText = ""
  let interim = ""
  let finishing: (() => void) | undefined
  let speechBroken = !speechCtor()
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let instructor: Instructor = httpInstruct

  const show = (cls: string, html?: string, text?: string) => {
    if (hideTimer) clearTimeout(hideTimer)
    cap.className = `on ${cls}`
    if (html !== undefined) textEl.innerHTML = html
    else textEl.textContent = text ?? ""
    mic.classList.toggle("on", cls === "listening")
  }
  const hide = (after = 0) => {
    if (hideTimer) clearTimeout(hideTimer)
    const go = () => {
      cap.className = ""
      mic.classList.remove("on")
      if (phase === "reply") phase = "idle"
    }
    if (after) hideTimer = setTimeout(go, after)
    else go()
  }
  const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!)
  const spoken = () => `${heard} ${finalText} ${interim}`.replace(/\s+/g, " ").trim()

  const renderListening = () => {
    const done = `${heard} ${finalText}`.trim()
    textEl.innerHTML =
      done || interim
        ? `${esc(done)} <span class="interim">${esc(interim)}</span>`
        : `<span class="hint">listening${host.selection().length ? " — about the selection" : " — about the whole page"}…</span>`
  }

  // -- typing: the fallback, and right-click on 🎙 --

  const openTyping = (hint?: string) => {
    stopRec(true)
    phase = "typing"
    source = undefined
    show("typing")
    input.value = ""
    if (hint) input.placeholder = hint
    input.focus()
  }
  input.addEventListener("keydown", (e) => {
    e.stopPropagation()
    if (e.key === "Enter") {
      e.preventDefault()
      const text = input.value.trim()
      input.blur()
      if (text) void send(text)
      else (phase = "idle"), hide()
    } else if (e.key === "Escape") {
      input.blur()
      phase = "idle"
      hide()
    }
  })
  input.addEventListener("blur", () => {
    if (phase === "typing" && !input.value.trim()) {
      phase = "idle"
      hide()
    }
  })

  // -- listening --

  const stopRec = (abort: boolean) => {
    const r = rec
    rec = undefined
    if (!r) return
    r.onend = r.onresult = r.onerror = null
    try {
      if (abort) r.abort()
      else r.stop()
    } catch {
      // already stopped
    }
  }

  const startSession = () => {
    const Ctor = speechCtor()!
    const r = new Ctor()
    r.continuous = true
    r.interimResults = true
    r.lang = navigator.language || "en-US"
    r.onresult = (e) => {
      if (rec !== r) return
      let f = ""
      let i = ""
      for (let k = 0; k < e.results.length; k++) {
        const res = e.results[k]!
        if (res.isFinal) f += res[0]!.transcript
        else i += res[0]!.transcript
      }
      finalText = f
      interim = i
      if (phase === "listening") renderListening()
    }
    r.onerror = (e) => {
      if (rec !== r) return
      if (e.error === "no-speech" || e.error === "aborted") return
      // not-allowed, service-not-allowed, audio-capture, network, …: type instead.
      speechBroken = true
      const was = spoken()
      openTyping(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "microphone not allowed — type it instead (Enter sends)"
          : `speech unavailable (${e.error}) — type it instead (Enter sends)`,
      )
      input.value = was
    }
    r.onend = () => {
      if (rec !== r) return
      // Finals of this session become part of the hold.
      heard = `${heard} ${finalText}`.trim()
      finalText = ""
      if (finishing) {
        rec = undefined
        const done = finishing
        finishing = undefined
        done()
      } else if (phase === "listening") {
        // Chrome ends a session on silence; the hold is still on.
        try {
          r.start()
        } catch {
          rec = undefined
        }
      }
    }
    rec = r
    r.start()
  }

  const listen = (from: "key" | "pen" | "button") => {
    if (phase === "listening" || phase === "thinking" || phase === "typing") return
    if (speechBroken) {
      openTyping()
      return
    }
    host.closeRing()
    phase = "listening"
    source = from
    heard = finalText = interim = ""
    show("listening")
    renderListening()
    try {
      startSession()
    } catch (err) {
      speechBroken = true
      openTyping(`speech unavailable (${(err as Error).message}) — type it instead`)
    }
  }

  /** Stop listening and send what was heard (nothing heard → just close). */
  const release = async () => {
    if (phase !== "listening") return
    const r = rec
    if (r) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          finishing = undefined
          resolve()
        }, 1500)
        finishing = () => {
          clearTimeout(timer)
          resolve()
        }
        try {
          r.stop()
        } catch {
          finishing = undefined
          clearTimeout(timer)
          resolve()
        }
      })
    }
    stopRec(true)
    if (phase !== "listening") return // cancelled meanwhile
    const text = spoken()
    source = undefined
    if (!text) {
      phase = "reply"
      show("", undefined, "heard nothing")
      hide(1400)
      return
    }
    await send(text)
  }

  /** Stop listening, send nothing, say nothing. */
  const cancel = () => {
    if (phase !== "listening") return
    finishing = undefined
    stopRec(true)
    phase = "idle"
    source = undefined
    hide()
  }

  // -- sending --

  const send = async (transcript: string): Promise<InstructResponse> => {
    if (phase === "thinking") return { ops: [], reply: "", error: "already thinking" }
    phase = "thinking"
    source = undefined
    const state = host.state()
    const selected = host.selection()
    const t0 = performance.now()
    show("thinking", `“${esc(transcript)}” <span class="interim">· thinking…</span>`)
    let res: InstructResponse
    try {
      const labels = tagsFor(state)
      const png = await renderPage(state, new Set(selected), labels)
      res = await instructor({
        transcript,
        png,
        selection: selected,
        board: { strokes: state.strokes, symbols: state.symbols },
        vocabulary: importsOf(state),
        labels,
      })
    } catch (err) {
      res = { ops: [], reply: "", error: (err as Error).message || "instruct unreachable" }
    }
    lastSeconds = (performance.now() - t0) / 1000
    last = res
    phase = "reply"
    const cmd = editCommand(host.state(), res.ops as EditOp[], selected)
    if (cmd) {
      const fresh = cmd.steps.find((s) => s.kind === "addSymbol" || s.kind === "replace")
      host.commit(cmd, fresh && (fresh.kind === "addSymbol" || fresh.kind === "replace") ? fresh.symbol.id : undefined)
      host.setSelection(touched(cmd))
    }
    if (res.error && !cmd) show("error", undefined, res.reply || res.error)
    else show("reply", undefined, res.reply || (cmd ? "done" : "nothing to change"))
    hide(REPLY_MS)
    return res
  }

  let last: InstructResponse | undefined
  let lastSeconds = 0

  // -- keys: hold Space --

  const typingIn = (t: EventTarget | null) =>
    t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || typingIn(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
    e.preventDefault()
    if (e.repeat) return
    listen("key")
  })
  window.addEventListener("keyup", (e) => {
    if (e.code !== "Space" || source !== "key") return
    e.preventDefault()
    void release()
  })
  window.addEventListener("blur", () => {
    if (source === "key") void release()
  })

  mic.addEventListener("click", () => {
    if (phase === "listening") void release()
    else if (phase === "typing") (input.blur(), (phase = "idle"), hide())
    else listen("button")
  })
  mic.addEventListener("contextmenu", (e) => {
    e.preventDefault()
    if (phase === "idle" || phase === "reply") openTyping()
  })

  // -- the pen's side button, hovering --

  let penButton = false
  let penContact = false
  let penTimer: ReturnType<typeof setTimeout> | undefined

  const penPress = () => {
    if (penButton) return
    penButton = true
    if (penTimer) clearTimeout(penTimer)
    if (penContact) return
    penTimer = setTimeout(() => {
      penTimer = undefined
      if (penButton && !penContact && !host.busy()) listen("pen")
    }, PEN_HOLD_MS)
  }
  const penRelease = () => {
    if (!penButton) return
    penButton = false
    if (penTimer) clearTimeout(penTimer)
    penTimer = undefined
    if (source === "pen") void release()
  }

  const pen = (ev: PenEvent) => {
    switch (ev.kind) {
      case "button":
        if (ev.pressed) penPress()
        else penRelease()
        return
      case "hover":
        // A missed button event never leaves the hold stuck either way.
        penContact = false
        if (ev.button) penPress()
        else penRelease()
        return
      case "down":
        penContact = true
        if (penTimer) clearTimeout(penTimer)
        penTimer = undefined
        // The tip touched with the button held: a lasso, not speech.
        if (source === "pen") cancel()
        return
      case "up":
        penContact = false
        return
      case "leave":
        penContact = false
        penRelease()
        return
      default:
    }
  }

  // -- test hooks --

  const sketch = (window.__sketch ??= {})
  Object.assign(sketch, {
    /** Run an instruction through the same path speech takes. */
    instruct: (text: string) => send(text),
    /** Replace the instructor: a fixed response, a function, or null for the real one. */
    stubInstruct: (r: InstructResponse | Instructor | null) => {
      instructor = r === null ? httpInstruct : typeof r === "function" ? r : async () => r
    },
    voice: () => ({ phase, source, caption: cap.className ? textEl.textContent : "", typing: phase === "typing", speech: !speechBroken }),
    lastInstruct: () => last && { ...last, seconds: lastSeconds },
    /** The page image Claude would see now (base64 PNG). */
    pageImage: async () => {
      const s = host.state()
      return renderPage(s, new Set(host.selection()), tagsFor(s))
    },
  })

  return { pen, send }
}
