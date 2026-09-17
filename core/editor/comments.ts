/**
 * The comment affordance in the inspector (docs/EDITOR-VOICE-COMMENTS.md
 * step 1) — Claude Code's artifact comment mode, for a DreamTalk selection.
 *
 * When a holon is selected in creator mode, the panel grows a small comment
 * block UNDER its params: the notes already attached to this selection, a
 * text input, an "attach" button, and a mic button (the voice-first
 * affordance). The mic is a placeholder for now — it focuses the text input
 * — so the UI is complete before transcription exists (step 4).
 *
 * Asynchronous by design, exactly as the artifact mode feels: attaching
 * posts and clears the field without blocking, and you can select something
 * else and keep commenting while prior notes are handled. The panel reads
 * GET /api/comments and shows only those whose path matches the current
 * selection, so you SEE your own comments the moment they land.
 *
 * main.ts owns WHAT is selected and its stable path; this module owns the UI
 * and the REST round-trip. A comment carries the selection's screen bounds +
 * t so a later step can render exactly that region (the render is then a pure
 * function of what is captured here).
 */

import type { SelectionPath } from "./selection"

interface CommentBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** A comment as the daemon returns it (scripts/comments.ts Comment). */
export interface Comment {
  id: string
  ts: string
  path: SelectionPath | null
  pathLabel: string
  text: string
  t: number
  scene: string
  bounds?: CommentBounds | null
  resolved?: boolean
}

/** What the mount needs from the editor to attach a comment to the selection. */
export interface CommentContext {
  scene: string
  /** The current selection's stable path, or null (scene-level note). */
  path: () => SelectionPath | null
  /** A human-readable name for the selection — shown without resolving path. */
  label: () => string
  /** The timeline t right now. */
  currentT: () => number
  /** The selection's screen bounds, for the future render (may be undefined). */
  bounds: () => CommentBounds | undefined
}

export interface CommentPanel {
  /** Re-render for a (possibly changed) selection — called on every select. */
  refresh: () => void
  dispose: () => void
}

/** Two paths address the same selection (scene-level notes have path null). */
const samePath = (a: SelectionPath | null, b: SelectionPath | null): boolean => {
  if (a === null || b === null) return a === b
  return (
    a.root === b.root &&
    a.className === b.className &&
    a.indices.length === b.indices.length &&
    a.indices.every((v, i) => v === b.indices[i])
  )
}

/** A short relative age ("just now", "3m", "2h") — the artifact-mode feel. */
const ago = (iso: string): string => {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 45) return "just now"
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  if (secs < 86400) return `${Math.round(secs / 3600)}h`
  return `${Math.round(secs / 86400)}d`
}

/**
 * Mount the comment block into `host` (a container the inspector owns). The
 * block redraws whenever the selection changes (main.ts calls refresh()) and
 * whenever a comment is attached.
 */
export const mountComments = (
  host: HTMLElement,
  ctx: CommentContext,
  signal: AbortSignal,
): CommentPanel => {
  let all: Comment[] = []
  let selectionKey: SelectionPath | null = null

  const section = document.createElement("div")
  section.className = "section commentsec"

  const heading = document.createElement("h2")
  heading.textContent = "Comments"
  section.appendChild(heading)

  const list = document.createElement("div")
  list.className = "commentlist"
  section.appendChild(list)

  // The composer: mic (voice-first, the prominent affordance) · text · attach.
  const composer = document.createElement("div")
  composer.className = "composer"

  const mic = document.createElement("button")
  mic.type = "button"
  mic.className = "micbtn"
  // Step 4: dictate into the field via the browser's own speech engine
  // (SpeechRecognition — no model download, on-device where the platform
  // provides it). Falls back to a focused field if the browser lacks it.
  const speechSupported =
    typeof (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition !==
      "undefined" ||
    typeof (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition !== "undefined"
  mic.title = speechSupported
    ? "voice comment — click to dictate (click again to stop)"
    : "voice not available here — type instead"
  mic.textContent = "🎙"
  composer.appendChild(mic)

  const input = document.createElement("textarea")
  input.className = "commentinput"
  input.rows = 1
  input.placeholder = "Comment on this selection…"
  composer.appendChild(input)

  const attach = document.createElement("button")
  attach.type = "button"
  attach.className = "attachbtn"
  attach.textContent = "Attach"
  attach.disabled = true
  composer.appendChild(attach)

  section.appendChild(composer)
  host.appendChild(section)

  const renderList = () => {
    list.textContent = ""
    const mine = all.filter((c) => samePath(c.path, selectionKey))
    if (mine.length === 0) {
      const empty = document.createElement("div")
      empty.className = "empty"
      empty.textContent = "No comments yet — the first note on this selection."
      list.appendChild(empty)
      return
    }
    for (const c of mine) {
      const row = document.createElement("div")
      row.className = "comment"
      if (c.resolved) row.classList.add("resolved")
      const meta = document.createElement("div")
      meta.className = "cmeta"
      meta.textContent = `${ago(c.ts)} · ${c.t.toFixed(2)}s`
      const body = document.createElement("div")
      body.className = "cbody"
      body.textContent = c.text
      row.appendChild(meta)
      row.appendChild(body)
      list.appendChild(row)
    }
  }

  const load = async () => {
    try {
      const res = await fetch(`/api/comments?scene=${encodeURIComponent(ctx.scene)}`, { signal })
      if (!res.ok) return
      all = ((await res.json()) as { comments: Comment[] }).comments ?? []
      renderList()
    } catch {
      // Aborted on unmount, or the daemon blinked — the block just shows what it has.
    }
  }

  const send = async () => {
    const text = input.value.trim()
    if (!text) return
    // Snapshot the target NOW: the async post must anchor to the selection
    // that was live when Attach was pressed, not whatever is selected when
    // the request returns (asynchronous — you can select on while it flies).
    const payload = {
      path: selectionKey,
      pathLabel: ctx.label(),
      text,
      t: ctx.currentT(),
      scene: ctx.scene,
      bounds: ctx.bounds() ?? null,
    }
    input.value = ""
    attach.disabled = true
    try {
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      })
      if (res.ok) {
        const { comment } = (await res.json()) as { comment: Comment }
        all.push(comment)
        renderList()
      }
    } catch {
      // Restore the text so an offline daemon doesn't eat the note.
      if (!input.value) input.value = text
      attach.disabled = input.value.trim().length === 0
    }
  }

  input.addEventListener(
    "input",
    () => {
      attach.disabled = input.value.trim().length === 0
      // Grow with the note, artifact-style, up to a few lines.
      input.style.height = "auto"
      input.style.height = `${Math.min(input.scrollHeight, 96)}px`
    },
    { signal },
  )
  input.addEventListener(
    "keydown",
    (e) => {
      // Enter attaches; shift+Enter is a newline. The transport's Space and
      // arrow chords are already held off while a text control has focus.
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        void send()
      }
    },
    { signal },
  )
  attach.addEventListener("click", () => void send(), { signal })
  // --- Step 4: voice dictation into the field ------------------------------
  //
  // The mic toggles a SpeechRecognition session that appends its transcript
  // to whatever is already typed (so voice and typing compose). Interim
  // results stream live into the field; the final result replaces the interim
  // span. Recording state is on the button (a class the CSS pulses) so it is
  // obvious the editor is listening. Everything degrades to `input.focus()`
  // when the browser has no speech engine — voice-first, never voice-only.
  type Recognition = {
    lang: string
    continuous: boolean
    interimResults: boolean
    start(): void
    stop(): void
    onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
    onend: (() => void) | null
    onerror: ((e: { error: string }) => void) | null
  }
  const RecognitionCtor = (
    window as unknown as {
      SpeechRecognition?: new () => Recognition
      webkitSpeechRecognition?: new () => Recognition
    }
  ).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => Recognition })
      .webkitSpeechRecognition
  let recog: Recognition | null = null
  /** The text that was in the field when recording began — voice appends to it. */
  let dictationBase = ""

  const stopDictation = () => {
    recog?.stop()
    recog = null
    mic.classList.remove("recording")
  }

  mic.addEventListener(
    "click",
    () => {
      if (!RecognitionCtor) {
        input.focus()
        return
      }
      if (recog) {
        stopDictation()
        return
      }
      const r = new RecognitionCtor()
      r.lang = navigator.language || "en-US"
      r.continuous = true
      r.interimResults = true
      dictationBase = input.value ? input.value.replace(/\s*$/, "") + " " : ""
      r.onresult = (e) => {
        let finalTxt = ""
        let interim = ""
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]!
          if (res.isFinal) finalTxt += res[0].transcript
          else interim += res[0].transcript
        }
        if (finalTxt) dictationBase = (dictationBase + finalTxt).replace(/\s{2,}/g, " ")
        input.value = (dictationBase + interim).replace(/\s{2,}/g, " ")
        input.dispatchEvent(new Event("input", { bubbles: true }))
      }
      r.onend = () => {
        // A continuous session can still end (silence timeout); reflect it.
        if (recog === r) {
          recog = null
          mic.classList.remove("recording")
        }
      }
      r.onerror = () => stopDictation()
      recog = r
      mic.classList.add("recording")
      input.focus()
      try {
        r.start()
      } catch {
        stopDictation()
      }
    },
    { signal },
  )

  const refresh = () => {
    selectionKey = ctx.path()
    renderList()
    // A fresh selection re-fetches so a note attached in another session (or
    // a prior selection of the same object) shows up.
    void load()
  }

  return {
    refresh,
    dispose: () => {
      // Never leave a recognizer listening past the panel's life (a scene
      // switch / remount) — it would hold the mic and keep dictating into a
      // detached field.
      stopDictation()
      section.remove()
    },
  }
}
