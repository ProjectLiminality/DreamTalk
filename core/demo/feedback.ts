/**
 * feedback.ts — a shared song's viewer comment mode: the note left ON a
 * thing, at a moment, by someone the song was sent to.
 *
 * The studio's comment mode (editor/comments.ts, demo/creatorpanel.ts)
 * writes through the daemon into the repo; a song published as a static
 * site (scripts/build-standalone.ts) has neither. Built with
 * `--feedback <url>`, its player gets this instead: a quiet button (and the
 * creator key, `), which holds the song where it stands and lets the
 * viewer point at a part of it — the golden dot and its glow, creator
 * mode's own (editor/creator.ts) — and leave a note on that part: typed,
 * spoken (hold the mic, or tap it on and off) and/or a photo of a paper
 * sketch. Each note is posted, multipart, to the sink the build baked in
 * (the dashboard's POST /api/feedback/:song), anchored as the studio's
 * comments are — scene, song t, the holon's stable path, class, field name
 * and wholes, its screen box — plus the walked state (the toolkit's link
 * state, and the link that reopens it), the axes' positions in words, and
 * a small frame of what was on screen, the selection's glow included.
 *
 * Nothing here touches the Dream: the dot and the sheet are DOM overlays,
 * the glow is the host's interaction layer.
 */

import type { Holon } from "../src/holon"
import { CreatorMode, GOLD_CSS, isCreatorToggle, type CreatorHost } from "../editor/creator"
import { classNameOf } from "../editor/classname"
import { pathOf } from "../editor/selection"
import { holonAnchor } from "../editor/comments"

export interface FeedbackHost extends CreatorHost {
  /** The Dream (for a holon's field name) and its roots (for its path). */
  dream: object
  roots: () => readonly Holon[]
  scene: string
  /** The song t on screen. */
  t: () => number
  /** Hold the song where it stands; the returned function lets it go on. */
  hold: () => () => void
  /** Draw the held frame again (the glow changed), resolving once drawn. */
  redraw: () => Promise<void>
  /** The toolkit's link state as its `&state=` code, and the link that reopens it. */
  state: () => { code: string; link: string }
  /** The axes' positions, in words. */
  walk: () => { free: boolean; positions: Record<string, string> }
  signal: AbortSignal
}

export interface Feedback {
  readonly on: boolean
  toggle(on?: boolean): boolean
  /** Handle a key; true when it was ours. Call before every other key handler. */
  key(e: KeyboardEvent): boolean
}

const NAME_KEY = "feedback.name"
/** A press held longer than this is hold-to-talk; shorter, the mic toggles. */
const HOLD_MS = 350
const MAX_VOICE_MS = 5 * 60_000
/** The frame's longer side, and a photo's, as sent (px). */
const SHOT_PX = 640
const PHOTO_PX = 2000

const ICON_NOTE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5.5h16v10H10l-4 3.5v-3.5H4z"/></svg>`
const ICON_MIC = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3"/></svg>`
const ICON_PHOTO = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 8h3.5l1.5-2h6l1.5 2H20v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>`

/** A function, so a build without the mode (standalone.ts) can drop it whole. */
const style = () => `
.fb-btn { position: fixed; right: 16px; bottom: 16px; z-index: 72; width: 40px; height: 40px; border-radius: 50%;
  display: grid; place-items: center; padding: 0; background: rgba(12,12,12,.7); color: #bbb; border: 1px solid #333;
  opacity: .5; transition: opacity .25s, color .25s, border-color .25s; cursor: pointer !important; -webkit-tap-highlight-color: transparent; }
.fb-btn:hover, .fb-btn.on { opacity: 1; color: ${GOLD_CSS}; border-color: ${GOLD_CSS}; }
.fb-sheet { position: fixed; right: 16px; bottom: 68px; z-index: 71; width: 300px; box-sizing: border-box;
  background: rgba(10,10,10,.94); border: 1px solid #262626; border-radius: 12px; padding: 12px 14px 14px;
  color: #ddd; font: 13px/1.45 -apple-system, system-ui, sans-serif; cursor: auto !important;
  opacity: 0; transform: translateY(6px); transition: opacity .25s, transform .25s; pointer-events: none; }
.fb-sheet.on { opacity: 1; transform: none; pointer-events: auto; }
.fb-sheet * { cursor: inherit; }
.fb-sheet button, .fb-sheet label { cursor: pointer !important; }
.fb-head { display: flex; align-items: baseline; gap: 8px; }
.fb-title { color: ${GOLD_CSS}; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
.fb-close { margin-left: auto; background: none; border: none; color: #777; font-size: 18px; line-height: 1; padding: 0 2px; }
.fb-close:hover { color: #ddd; }
.fb-on { margin: 6px 0 8px; color: #999; font-size: 12px; }
.fb-on b { color: #fff; font-weight: 500; }
.fb-on .cls { color: #777; }
.fb-text { display: block; width: 100%; box-sizing: border-box; resize: none; min-height: 64px; max-height: 160px;
  background: #141414; color: #fff; border: 1px solid #333; border-radius: 8px; padding: 8px 10px;
  font: 14px/1.4 -apple-system, system-ui, sans-serif; cursor: text !important; }
.fb-text:focus, .fb-name:focus { outline: none; border-color: ${GOLD_CSS}; }
.fb-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.fb-chips:empty { display: none; }
.fb-chip { display: inline-flex; align-items: center; gap: 6px; background: #161616; border: 1px solid #2c2c2c; border-radius: 14px;
  padding: 2px 4px 2px 8px; font-size: 12px; color: #ccc; }
.fb-chip img { width: 22px; height: 22px; object-fit: cover; border-radius: 4px; margin-left: -4px; }
.fb-chip button { background: none; border: none; color: #777; font-size: 14px; padding: 0 4px; }
.fb-chip button:hover { color: #eee; }
.fb-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.fb-tool { height: 34px; min-width: 34px; border-radius: 17px; border: 1px solid #333; background: #141414; color: #ccc;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 10px; font-size: 12px;
  user-select: none; -webkit-user-select: none; touch-action: none; -webkit-tap-highlight-color: transparent; }
.fb-mic { min-width: 128px; }
.fb-tool:hover { border-color: #555; color: #fff; }
.fb-tool.rec { border-color: #e55; color: #f77; background: #1d1010; }
.fb-tool.rec svg { animation: fb-pulse 1.2s ease-in-out infinite; }
@keyframes fb-pulse { 50% { opacity: .35 } }
.fb-send { margin-left: auto; height: 34px; border-radius: 17px; border: 1px solid ${GOLD_CSS}; background: none; color: ${GOLD_CSS};
  padding: 0 16px; font-size: 13px; }
.fb-send:disabled { opacity: .35; }
.fb-send:not(:disabled):hover { background: rgba(255,199,84,.1); }
.fb-name { margin-top: 10px; width: 100%; box-sizing: border-box; background: none; border: none; border-bottom: 1px solid #262626;
  color: #bbb; padding: 4px 0; font: 12px -apple-system, system-ui, sans-serif; cursor: text !important; }
.fb-status { margin-top: 8px; min-height: 16px; color: #888; font-size: 12px; }
.fb-status.ok { color: ${GOLD_CSS}; }
.fb-status.err { color: #f77; }
@media (max-width: 600px) {
  .fb-sheet { left: 0; right: 0; bottom: 0; width: auto; border-radius: 14px 14px 0 0; border-bottom: none;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom)); transform: translateY(100%); }
  .fb-sheet.on { transform: none; }
  .fb-sheet.on ~ .fb-btn { display: none; }
  .fb-text { min-height: 56px; font-size: 16px; }
}
`

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`
const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.round(ms / 1000) % 60).padStart(2, "0")}`

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k) ?? ""
    } catch {
      return ""
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      // A private window: the name is just asked again.
    }
  },
}

/** A canvas (or image) drawn into a JPEG whose longer side is at most `px`. */
const jpeg = async (src: CanvasImageSource, w: number, h: number, px: number, quality: number): Promise<Blob | undefined> => {
  const s = Math.min(1, px / Math.max(w, h))
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.round(w * s))
  c.height = Math.max(1, Math.round(h * s))
  const ctx = c.getContext("2d")
  if (!ctx) return undefined
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return new Promise((done) => c.toBlob((b) => done(b ?? undefined), "image/jpeg", quality))
}

export const mountFeedback = (sink: string, host: FeedbackHost): Feedback => {
  const listen = { signal: host.signal }
  const css = document.createElement("style")
  css.textContent = style()
  document.head.append(css)

  const sheet = document.createElement("div")
  sheet.className = "fb-sheet"
  sheet.innerHTML = `
    <div class="fb-head"><span class="fb-title">Leave a note</span><button class="fb-close" type="button" title="close (esc)">×</button></div>
    <div class="fb-on"></div>
    <textarea class="fb-text" rows="3" placeholder="What do you see here? What would you change?"></textarea>
    <div class="fb-chips"></div>
    <div class="fb-row">
      <button class="fb-tool fb-mic" type="button" title="hold to speak — or tap to start and stop">${ICON_MIC}<span>hold to speak</span></button>
      <label class="fb-tool fb-photo" title="add a photo — a sketch on paper">${ICON_PHOTO}<input type="file" accept="image/*" hidden /></label>
      <button class="fb-send" type="button" disabled>Send</button>
    </div>
    <input class="fb-name" type="text" placeholder="your name (optional)" maxlength="80" autocomplete="name" />
    <div class="fb-status"></div>`
  const btn = document.createElement("button")
  btn.className = "fb-btn"
  btn.type = "button"
  btn.title = "leave a note on this moment (`)"
  btn.innerHTML = ICON_NOTE
  document.body.append(sheet, btn)
  host.signal.addEventListener("abort", () => {
    stopVoice(true)
    sheet.remove()
    btn.remove()
    css.remove()
  })

  const $ = <T extends Element>(sel: string) => sheet.querySelector(sel) as T
  const onLine = $<HTMLDivElement>(".fb-on")
  const text = $<HTMLTextAreaElement>(".fb-text")
  const chips = $<HTMLDivElement>(".fb-chips")
  const mic = $<HTMLButtonElement>(".fb-mic")
  const micLabel = mic.querySelector("span")!
  const photoInput = $<HTMLInputElement>(".fb-photo input")
  const send = $<HTMLButtonElement>(".fb-send")
  const name = $<HTMLInputElement>(".fb-name")
  const status = $<HTMLDivElement>(".fb-status")
  name.value = storage.get(NAME_KEY)

  let on = false
  let release: (() => void) | undefined
  let voice: { blob: Blob; ms: number; url: string } | undefined
  let photo: { blob: Blob; url: string } | undefined
  let sending = false

  const say = (msg: string, kind: "" | "ok" | "err" = "") => {
    status.textContent = msg
    status.className = `fb-status${kind ? ` ${kind}` : ""}`
  }

  const nameOf = (h: Holon) => holonAnchor(host.dream, h).name ?? classNameOf(h)
  const renderTarget = () => {
    const h = creator.selected
    const at = clock(host.t())
    onLine.innerHTML = ""
    if (h) {
      const b = document.createElement("b")
      b.textContent = nameOf(h)
      const cls = document.createElement("span")
      cls.className = "cls"
      cls.textContent = ` ${classNameOf(h)}`
      onLine.append("on ", b, cls, ` · at ${at}`)
    } else onLine.append(`on the whole scene · at ${at} — tap any part to point at it`)
  }

  const ready = () => {
    send.disabled = sending || recording !== undefined || (!text.value.trim() && !voice && !photo)
  }
  const renderChips = () => {
    chips.textContent = ""
    const chip = (label: string, drop: () => void, thumb?: string, play?: string) => {
      const el = document.createElement("span")
      el.className = "fb-chip"
      if (thumb) {
        const img = document.createElement("img")
        img.src = thumb
        el.append(img)
      }
      const l = document.createElement("span")
      l.textContent = label
      el.append(l)
      if (play) {
        const p = document.createElement("button")
        p.type = "button"
        p.textContent = "▶"
        p.title = "listen"
        const audio = new Audio(play)
        p.addEventListener("click", () => (audio.paused ? void audio.play() : audio.pause()))
        el.append(p)
      }
      const x = document.createElement("button")
      x.type = "button"
      x.textContent = "×"
      x.title = "remove"
      x.addEventListener("click", () => {
        drop()
        renderChips()
        ready()
      })
      el.append(x)
      chips.append(el)
    }
    if (voice) chip(`voice ${seconds(voice.ms)}`, () => {
      URL.revokeObjectURL(voice!.url)
      voice = undefined
    }, undefined, voice.url)
    if (photo) chip("photo", () => {
      URL.revokeObjectURL(photo!.url)
      photo = undefined
    }, photo.url)
  }

  // --- The golden dot: creator mode's pointing, here for the viewer.
  const creator = new CreatorMode(host, {
    clickSelects: true,
    signal: host.signal,
    onSelect: () => renderTarget(),
  })

  const toggle = (want = !on): boolean => {
    if (want === on) return on
    on = want
    if (on) {
      release = host.hold()
      creator.toggle(true)
      renderTarget()
      say("")
    } else {
      stopVoice(false)
      creator.select(null)
      creator.toggle(false)
      text.blur()
      release?.()
      release = undefined
    }
    sheet.classList.toggle("on", on)
    btn.classList.toggle("on", on)
    return on
  }
  btn.addEventListener("click", () => toggle(), listen)
  $<HTMLButtonElement>(".fb-close").addEventListener("click", () => toggle(false), listen)

  // --- Voice: hold to talk, or tap on and tap off.
  let recording: { media: MediaRecorder; chunks: Blob[]; started: number; timer: number } | undefined
  let pressedAt = 0
  let starting = false
  const startVoice = async () => {
    if (recording || starting) return
    starting = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const media = new MediaRecorder(stream)
      const chunks: Blob[] = []
      media.addEventListener("dataavailable", (e) => e.data.size && chunks.push(e.data))
      media.addEventListener("stop", () => {
        for (const tr of stream.getTracks()) tr.stop()
      })
      media.start(250)
      recording = { media, chunks, started: performance.now(), timer: window.setTimeout(() => stopVoice(false), MAX_VOICE_MS) }
      mic.classList.add("rec")
      micLabel.textContent = "listening…"
      say("")
      ready()
    } catch {
      say("the microphone isn't available here — type instead", "err")
    } finally {
      starting = false
    }
  }
  /** Stop recording; keep what was said unless `discard`. */
  function stopVoice(discard: boolean) {
    const r = recording
    if (!r) return
    recording = undefined
    clearTimeout(r.timer)
    mic.classList.remove("rec")
    micLabel.textContent = "hold to speak"
    const ms = performance.now() - r.started
    r.media.addEventListener(
      "stop",
      () => {
        if (discard || !r.chunks.length || ms < 400) return ready()
        if (voice) URL.revokeObjectURL(voice.url)
        const blob = new Blob(r.chunks, { type: r.media.mimeType || "audio/webm" })
        voice = { blob, ms: Math.round(ms), url: URL.createObjectURL(blob) }
        renderChips()
        ready()
      },
      { once: true },
    )
    r.media.stop()
  }
  mic.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault()
      // The press is the mic's until it lets go, wherever the pointer drifts.
      mic.setPointerCapture(e.pointerId)
      pressedAt = performance.now()
      if (recording) stopVoice(false)
      else void startVoice()
    },
    listen,
  )
  const letGo = () => {
    // Held: let go and it is kept. A tap leaves it listening until the next tap.
    if (recording && performance.now() - pressedAt > HOLD_MS) stopVoice(false)
  }
  mic.addEventListener("pointerup", letGo, listen)
  mic.addEventListener("pointercancel", letGo, listen)
  mic.addEventListener("contextmenu", (e) => e.preventDefault(), listen)

  // --- A photo (a sketch on paper), scaled to a sensible size.
  photoInput.addEventListener(
    "change",
    async () => {
      const file = photoInput.files?.[0]
      photoInput.value = ""
      if (!file) return
      let blob: Blob = file
      try {
        const bmp = await createImageBitmap(file)
        blob = (await jpeg(bmp, bmp.width, bmp.height, PHOTO_PX, 0.86)) ?? file
        bmp.close()
      } catch {
        // A format the browser can't decode (HEIC on some): sent as it is.
      }
      if (photo) URL.revokeObjectURL(photo.url)
      photo = { blob, url: URL.createObjectURL(blob) }
      renderChips()
      ready()
    },
    listen,
  )

  text.addEventListener(
    "input",
    () => {
      if (status.classList.contains("ok")) say("")
      ready()
    },
    listen,
  )
  text.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault()
        void submit()
      }
    },
    listen,
  )
  name.addEventListener("change", () => storage.set(NAME_KEY, name.value.trim()), listen)

  // --- Sending: everything the note is anchored to, captured NOW.
  const submit = async () => {
    if (send.disabled) return
    const h = creator.selected
    const roots = host.roots()
    const canvas = host.canvas
    const box = h ? host.boundsOf(h) : undefined
    const anchor = h ? holonAnchor(host.dream, h) : undefined
    const st = host.state()
    const meta = {
      scene: host.scene,
      name: name.value.trim() || undefined,
      text: text.value.trim() || undefined,
      t: Math.round(host.t() * 1000) / 1000,
      holon: h
        ? { path: pathOf(roots, h) ?? null, className: classNameOf(h), name: anchor?.name, owners: anchor?.owners }
        : null,
      state: st.code,
      link: st.link,
      walk: host.walk(),
      bounds: box ? { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y } : null,
      frame: { w: canvas.width, h: canvas.height },
      voice_ms: voice?.ms,
    }
    // The frame as the viewer sees it, glow and all — drawn again and read
    // in the same task, before the canvas can present and clear.
    await host.redraw()
    const shot = await jpeg(canvas, canvas.width, canvas.height, SHOT_PX, 0.8)

    const form = new FormData()
    form.append("meta", JSON.stringify(meta))
    if (voice) form.append("audio", voice.blob, `voice.${voice.blob.type.includes("mp4") ? "m4a" : "webm"}`)
    if (photo) form.append("image", photo.blob, "photo.jpg")
    if (shot) form.append("shot", shot, "frame.jpg")
    sending = true
    ready()
    say("sending…")
    try {
      const res = await fetch(sink, { method: "POST", body: form, signal: host.signal })
      if (!res.ok) throw new Error(String(res.status))
      if (name.value.trim()) storage.set(NAME_KEY, name.value.trim())
      text.value = ""
      if (voice) URL.revokeObjectURL(voice.url)
      if (photo) URL.revokeObjectURL(photo.url)
      voice = undefined
      photo = undefined
      renderChips()
      say("sent — thank you. Point at something else, or close.", "ok")
    } catch {
      say("couldn't send — check the connection and try again", "err")
    } finally {
      sending = false
      ready()
    }
  }
  send.addEventListener("click", () => void submit(), listen)

  return {
    get on() {
      return on
    },
    toggle,
    key: (e) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.code === "Escape" && on) {
        e.preventDefault()
        if (typing) (e.target as HTMLElement).blur()
        else toggle(false)
        return true
      }
      if (typing) return on
      if (isCreatorToggle(e)) {
        e.preventDefault()
        toggle()
        return true
      }
      // While a note is open the song is held: no other key reaches it.
      return on
    },
  }
}
