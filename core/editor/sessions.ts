/**
 * Live sessions in the editor — the recorder's controls, and the act of
 * writing a recorded walk into the song (scripts/session.ts renders it).
 *
 * ⇧R: a red dot and a running clock on the track while it records;
 * stopping leaves a chip — "write walk 12.4 s into the song" — that sends
 * ONE `appendSession` op placed exactly as ⌘K places a pose (after the clip
 * the walk was held in; helper-played songs by ordinal). The daemon reads
 * the session folder itself, transcribes the voice if no live transcript
 * came with it, cuts each spoken line into the narration cache and writes
 * the passage. ⌘Z takes it back out (the op's span inverse).
 */

import type { Dream } from "../src/dream"
import { clipOrdinalAt, placementAt } from "./checkpoint"
import type { SessionRecorder } from "./recorder"

export interface SessionsOpts {
  /** #track — the chip rides there beside the capture chip. */
  track: HTMLElement
  dream: Dream
  recorder: SessionRecorder
  sceneFile: () => string | undefined
  currentT: () => number
  isPlaying: () => boolean
  pause: () => void
  send: (op: Record<string, unknown>) => void
  note: (text: string) => void
  /** A session recorded elsewhere (the player), offered for writing on boot. */
  pending?: string
  signal: AbortSignal
}

export interface Sessions {
  readonly recording: boolean
  /** The last session recorded or offered here. */
  readonly last: string | undefined
  toggle(): Promise<string | undefined>
  /** Write a session (default: the last) into the song; resolves to the op, or the refusal. */
  write(id?: string): Promise<Record<string, unknown> | string>
  tick(now: number): void
}

export const mountSessions = (opts: SessionsOpts): Sessions => {
  const { track, recorder, signal } = opts
  track.querySelector("#sessionchip")?.remove()
  const chip = document.createElement("button")
  chip.id = "sessionchip"
  chip.style.display = "none"
  track.appendChild(chip)
  const dot = document.createElement("div")
  dot.className = "recdot"
  dot.style.display = "none"
  track.appendChild(dot)
  signal.addEventListener("abort", () => {
    chip.remove()
    dot.remove()
  })

  let last = opts.pending
  /** The song time the session was held at — where it is written. */
  let heldAt = opts.currentT()
  let lastTick = -1

  const offer = (id: string, seconds?: number) => {
    last = id
    chip.textContent = `write walk${seconds ? ` ${seconds.toFixed(1)} s` : ""} into the song`
    chip.title = `refs/sessions/${id} — becomes a passage after the clip it was held in (⌘Z takes it back out)`
    chip.style.display = ""
  }
  if (opts.pending) offer(opts.pending)
  // A session stopped just before a remount is still on offer after it.
  else if (recorder.lastId) offer(recorder.lastId, recorder.lastSeconds)
  // Still recording across a remount: the dot comes back with the mount.
  if (recorder.recording) dot.style.display = ""

  const write = async (id = last): Promise<Record<string, unknown> | string> => {
    if (!id) return "no session to write"
    let t = heldAt
    try {
      const res = await fetch(`/api/session/${id}/session.json`)
      if (res.ok) t = ((await res.json()) as { heldAt: number }).heldAt
    } catch {}
    const { placement, anchor } = placementAt(opts.dream.clips, t)
    const file = anchor?.file ?? opts.sceneFile()
    if (!file) return "no scene file to write into"
    const op = {
      type: "op",
      op: "appendSession",
      id,
      file,
      placement,
      anchor: anchor ? { start: anchor.start, end: anchor.end } : undefined,
      ordinal: anchor ? clipOrdinalAt(opts.dream.clips, t) : undefined,
    }
    opts.send(op)
    if (recorder.lastId === id) recorder.lastId = undefined
    chip.style.display = "none"
    opts.note("writing the walk into the song…")
    return op
  }

  chip.addEventListener("pointerdown", (e) => {
    e.stopPropagation()
    void write()
  }, { signal })

  return {
    get recording() {
      return recorder.recording
    },
    get last() {
      return last
    },
    async toggle() {
      if (recorder.recording) {
        const seconds = recorder.clock()
        dot.style.display = "none"
        const id = await recorder.stop()
        if (id) {
          offer(id, seconds)
          opts.note(`session ${id} kept — write it into the song from the track`)
        }
        return id
      }
      if (opts.isPlaying()) opts.pause()
      heldAt = opts.currentT()
      chip.style.display = "none"
      const id = await recorder.start()
      dot.style.display = ""
      opts.note("● recording — walk, look, speak · ⇧R stops")
      return id
    },
    write,
    tick(now) {
      if (!recorder.recording) return
      recorder.tick(now)
      const s = Math.floor(recorder.clock(now))
      if (s !== lastTick) {
        lastTick = s
        dot.textContent = `● ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
      }
    },
  }
}
