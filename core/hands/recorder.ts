/**
 * recorder.ts — hand frames into the live session that is recording.
 *
 * A session (editor/recorder.ts, scripts/session.ts) is one folder shared by
 * every recorder, on one clock: `refs/sessions/<id>/`, seconds since it
 * began. The session recorder already keeps the walk, the view, the voice
 * and its transcript; this adds `hands.jsonl` — one HandFrame per line,
 * `t` re-stamped onto the session clock — streamed to the daemon about twice
 * a second (`PUT /api/session/<id>/hands.jsonl?append=1`), so a crash loses
 * half a second, not the take.
 *
 * It never starts or stops a session: ⇧R does (the session's own key). It
 * only follows: frames flow into whichever session is recording.
 */

import { encodeFrame, type HandFrame, type HandSource } from "../src/hands"

/** What the recorder needs of a live session. */
export interface SessionLink {
  readonly recording: boolean
  readonly id: string | undefined
  /** Seconds since the session began. */
  clock(): number
}

export class HandsRecorder {
  #link: () => SessionLink | undefined
  #lines: string[] = []
  #id: string | undefined
  #timer: ReturnType<typeof setInterval>
  #off: () => void
  #put: (url: string, body: string) => Promise<unknown>
  /** Appends go one at a time: two in flight could land out of order. */
  #sending: Promise<unknown> = Promise.resolve()
  /** Frames written into the current (or last) session. */
  count = 0

  constructor(
    source: Pick<HandSource, "onFrame"> & { onRaw?: (fn: (f: HandFrame) => void) => () => void },
    link: () => SessionLink | undefined,
    put: (url: string, body: string) => Promise<unknown> = (url, body) => fetch(url, { method: "PUT", body }),
  ) {
    this.#link = link
    this.#put = put
    // Every device frame, not the coalesced display stream.
    this.#off = source.onRaw ? source.onRaw((f) => this.frame(f)) : source.onFrame((f) => this.frame(f))
    this.#timer = setInterval(() => void this.flush(), 500)
  }

  get recording(): boolean {
    return this.#id !== undefined
  }

  /** One frame from the source: kept if a session is recording. */
  frame(f: HandFrame) {
    const s = this.#link()
    const id = s?.recording ? s.id : undefined
    if (id !== this.#id) {
      void this.flush()
      this.#id = id
      if (id) this.count = 0
    }
    if (!id || !s) return
    this.#lines.push(encodeFrame({ ...f, t: s.clock() }))
    this.count++
  }

  /** Send what has gathered to the session it belongs to. */
  async flush(): Promise<void> {
    // A session that stopped between frames: send its tail before the next one begins.
    const s = this.#link()
    const id = this.#id
    if (id && !s?.recording) this.#id = undefined
    if (!id || this.#lines.length === 0) return
    const body = this.#lines.join("\n") + "\n"
    this.#lines = []
    const url = `/api/session/${encodeURIComponent(id)}/hands.jsonl?append=1`
    this.#sending = this.#sending.then(() => this.#put(url, body)).catch(() => {})
    await this.#sending
  }

  dispose() {
    void this.flush()
    clearInterval(this.#timer)
    this.#off()
  }
}
