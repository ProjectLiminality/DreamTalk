/**
 * mount.ts — hands on a page: one call from the player or the editor.
 *
 * Does nothing unless the page was opened with `?hands=…` (sources.ts) — the
 * camera or the daemon socket is touched only then. Starts the source, shows
 * the small overlay (`?skeleton=0` hides it, `=full` adds the viewport
 * layer), follows the live session for recording (recorder.ts), and puts
 * the source where the interaction layer and headless drivers find it:
 *
 *   window.__dtHandSource = { source, last(), onFrame(fn), screen, at(t)?, play()?, recorder }
 *
 * `screen.subscribe` is the same stream in the gesture layer's screen space
 * (screen.ts) — what demo/handplay.ts's `mountHands({ source })` takes.
 */

import type { HandEmitter, HandFrame, HandSource } from "../src/hands"
import { mountOverlay } from "./overlay"
import { HandsRecorder, type SessionLink } from "./recorder"
import { screenFrame, type ScreenFrame } from "./screen"
import { handSourceFromQuery } from "./sources"

export interface HandsHandle {
  source: HandSource & HandEmitter
  last(): HandFrame | undefined
  onFrame(fn: (f: HandFrame) => void): () => void
  /** The stream in the gesture layer's screen space. */
  screen: { subscribe(fn: (f: ScreenFrame) => void): () => void }
  /** Replay / sim only: show the frame at t, clock stopped. */
  at?(t: number): HandFrame | undefined
  /** Replay / sim only: give the source its clock back. */
  play?(from?: number): void
  recorder: HandsRecorder
  dispose(): void
}

declare global {
  interface Window {
    __dtHandSource?: HandsHandle
  }
}

/**
 * The live session: the editor's recorder singleton (`window.__dtRecorder`,
 * editor/recorder.ts — `recording`, `id`, `clock()` on the one session clock),
 * read fresh on every frame so a recorder made after the hands still counts.
 */
const pageSession = (): SessionLink | undefined =>
  (window as unknown as { __dtRecorder?: SessionLink }).__dtRecorder

export const mountHandSource = (
  opts: { parent?: HTMLElement; query?: URLSearchParams; session?: () => SessionLink | undefined } = {},
): HandsHandle | undefined => {
  const q = opts.query ?? new URLSearchParams(location.search)
  const source = handSourceFromQuery(q)
  if (!source) return undefined
  const skeleton = q.get("skeleton")
  const overlay = skeleton === "0" ? undefined : mountOverlay(opts.parent ?? document.body, { full: skeleton === "full", pulse: () => source.pulse })
  const recorder = new HandsRecorder(source, opts.session ?? pageSession)
  const offStatus = source.onStatus((s) => overlay?.status(s))
  const offFrame = source.onFrame((f) => {
    overlay?.draw(f)
    overlay?.recording(recorder.recording)
  })
  const clocked = source as unknown as { at?: (t: number) => HandFrame | undefined; play?: (from?: number) => void }
  const handle: HandsHandle = {
    source,
    last: () => source.last,
    onFrame: (fn) => source.onFrame(fn),
    screen: { subscribe: (fn) => source.onFrame((f) => fn(screenFrame(f))) },
    at: clocked.at?.bind(source),
    play: clocked.play?.bind(source),
    recorder,
    dispose() {
      offStatus()
      offFrame()
      recorder.dispose()
      source.stop()
      overlay?.dispose()
      if (window.__dtHandSource === handle) delete window.__dtHandSource
    },
  }
  window.__dtHandSource = handle
  void source.start()
  return handle
}
