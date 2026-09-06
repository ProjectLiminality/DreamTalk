/**
 * Player mode (`?mode=player`) — LOOPS.md made visible.
 *
 * The three loops, per the containment law (Creator ⊃ Game ⊃ Cutscene):
 * the DreamSong PLAYS as authored (cutscene); PAUSE and the film becomes
 * a world — drag flies the camera, sovereign symbols glow on hover and a
 * click on one is reserved for TRAVEL to its home; PLAY interpolates the
 * view back to the authored camera and the cutscene resumes.
 *
 * The player is a STRIP-DOWN of the editor, not a second build: main.ts
 * boots the same engine with the creator tooling unmounted (no outline,
 * inspector, cast, code view, timeline, checkpoint — and no ops, so the
 * daemon link stays read-only). What this module owns is the one piece
 * of chrome the player has: a minimal auto-hiding transport (play/pause
 * + a scrub line, Keynote-presenter style), plus the pure helpers the
 * mode switch and its tests share.
 */

/** Is the given location.search asking for the player presentation? */
export const isPlayerMode = (search: string): boolean =>
  new URLSearchParams(search).get("mode") === "player"

/**
 * The URL that returns to the creator editor — same scene, same t, every
 * other param preserved. Esc / `e` navigate here; the editor boots
 * paused at t because a ?t= deep link never autoplays.
 */
export const exitUrl = (search: string, t: number): string => {
  const q = new URLSearchParams(search)
  q.delete("mode")
  q.delete("autoplay")
  q.set("t", t.toFixed(2))
  return `?${q.toString()}`
}

/** How long the transport lingers after the pointer goes idle. */
export const IDLE_FADE_MS = 2000

export interface PlayerTransportOpts {
  duration: number
  isPlaying: () => boolean
  onToggle: () => void
  onScrub: (t: number) => void
  signal: AbortSignal
}

export interface PlayerTransport {
  /** Update the fill and the play glyph — called from the paint path. */
  sync(t: number, playing: boolean): void
  dispose(): void
}

/**
 * The transport: #pplay + #pline/#ptrack/#pfill (markup in index.html,
 * shown only under body.player). It fades out after IDLE_FADE_MS of
 * pointer stillness while playing; paused, it stays — pausing is what
 * opens the game loop, and the way back should not have to be hunted.
 */
export const mountPlayerTransport = (
  root: HTMLElement,
  opts: PlayerTransportOpts,
): PlayerTransport => {
  const play = root.querySelector<HTMLButtonElement>("#pplay")!
  const line = root.querySelector<HTMLElement>("#pline")!
  const fill = root.querySelector<HTMLElement>("#pfill")!
  const listen = { signal: opts.signal }

  let idleTimer: ReturnType<typeof setTimeout> | undefined
  const wake = () => {
    root.classList.remove("idle")
    if (idleTimer !== undefined) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      if (opts.isPlaying()) root.classList.add("idle")
    }, IDLE_FADE_MS)
  }
  document.addEventListener("pointermove", wake, listen)
  document.addEventListener("pointerdown", wake, listen)
  document.addEventListener("keydown", wake, listen)
  wake()

  play.addEventListener(
    "click",
    () => {
      opts.onToggle()
      wake()
    },
    listen,
  )

  const timeAt = (clientX: number): number => {
    const rect = line.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return frac * opts.duration
  }
  let scrubbing = false
  line.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return
      scrubbing = true
      try {
        line.setPointerCapture(e.pointerId)
      } catch {}
      opts.onScrub(timeAt(e.clientX))
    },
    listen,
  )
  line.addEventListener(
    "pointermove",
    (e) => {
      if (scrubbing) opts.onScrub(timeAt(e.clientX))
    },
    listen,
  )
  const endScrub = () => (scrubbing = false)
  line.addEventListener("pointerup", endScrub, listen)
  line.addEventListener("pointercancel", endScrub, listen)

  return {
    sync(t: number, playing: boolean) {
      const frac = opts.duration > 0 ? Math.max(0, Math.min(1, t / opts.duration)) : 0
      fill.style.width = `${frac * 100}%`
      play.textContent = playing ? "⏸" : "▶"
      if (!playing) root.classList.remove("idle")
    },
    dispose() {
      if (idleTimer !== undefined) clearTimeout(idleTimer)
    },
  }
}
