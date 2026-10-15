/**
 * Jev — the intent layer between hand talk and what is being said.
 *
 * David (2026-10-15): "track the hand movements and the voice, and from that
 * do a relevance realisation … the semantic context gives Jev full context on
 * what's happening in the conversation … plug in really advanced
 * intelligence."
 *
 * The recogniser (mudra.ts) invokes a mudra by itself only when it is sure.
 * Everything less certain is a CANDIDATE, and Jev decides: it hears the
 * recent candidates and the live transcript, and picks one of the actions
 * the scene offers — or none. Transparent by construction: the question it
 * asks is printable (`prompt`), the options are the scene's own action
 * names, and every decision carries its reason.
 *
 * Optional and pluggable: without a backend nothing here asks anything. The
 * daemon's /api/jev (scripts/jev.ts) answers with the fast decision models
 * already in use for the whiteboard (Clef's typed choice, else Groq / Haiku
 * as JSON) — never the slow CLI by default.
 */

import type { Candidate } from "./mudra"

export interface TranscriptEvent {
  t: number
  text: string
  final: boolean
}

export interface JevAction {
  name: string
  /** What it does, in words the model reads. */
  description: string
}

export interface JevContext {
  /** Recent mudra candidates, most confident first (the latest sighting of each). */
  candidates: Candidate[]
  /** The last stretch of what was said. */
  transcript: string
  actions: JevAction[]
}

export interface JevDecision {
  /** An action name from the context, or null: nothing meant. */
  action: string | null
  confidence: number
  reason?: string
  model?: string
  ms?: number
}

export interface JevBackend {
  decide(ctx: JevContext): Promise<JevDecision>
}

/** The question, as the model reads it — and as anyone can read it. */
export const prompt = (ctx: JevContext): string =>
  [
    "You decide whether a person's hand gesture (a mudra) is meant as an invocation, given what they are saying.",
    "Recent mudra candidates (name, confidence 0–1):",
    ...(ctx.candidates.length ? ctx.candidates.map((c) => `- ${c.name} (${c.confidence.toFixed(2)})`) : ["- none"]),
    `What they said recently: "${ctx.transcript.trim() || "(silence)"}"`,
    "Actions the scene offers:",
    ...ctx.actions.map((a) => `- ${a.name}: ${a.description}`),
    'Choose the one action they mean now, or "none" if the gesture is incidental. Prefer "none" when unsure.',
  ].join("\n")

export interface JevOpts {
  backend?: JevBackend
  /** Seconds of transcript and of candidates Jev hears. */
  span?: number
  /** Candidates below this are ignored; at or above `invokeAt` the recogniser acts alone. */
  candidateAt?: number
  invokeAt?: number
  /** Minimum seconds between questions. */
  interval?: number
  /** A decision below this confidence is treated as none. */
  acceptAt?: number
}

export class Jev {
  readonly opts: Required<Omit<JevOpts, "backend">> & { backend?: JevBackend }
  actions: JevAction[] = []
  #candidates: Candidate[] = []
  #transcript: TranscriptEvent[] = []
  #lastAsked = -Infinity
  #inFlight = false

  constructor(opts: JevOpts = {}) {
    this.opts = {
      backend: opts.backend,
      span: opts.span ?? 12,
      candidateAt: opts.candidateAt ?? 0.15,
      invokeAt: opts.invokeAt ?? 0.5,
      interval: opts.interval ?? 1.5,
      acceptAt: opts.acceptAt ?? 0.5,
    }
  }

  hear(e: TranscriptEvent): void {
    // A final segment replaces the partial it completes.
    if (this.#transcript.length && !this.#transcript.at(-1)!.final) this.#transcript.pop()
    this.#transcript.push(e)
    this.#trim(e.t)
  }

  see(candidates: readonly Candidate[]): void {
    for (const c of candidates) if (c.confidence >= this.opts.candidateAt) this.#candidates.push(c)
    if (candidates[0]) this.#trim(candidates[0].t)
  }

  /** The context Jev would ask with at time t. */
  context(t: number): JevContext {
    this.#trim(t)
    // The LATEST sighting of each candidate: how sure the recogniser is now.
    const latest = new Map<string, Candidate>()
    for (const c of this.#candidates) if (!latest.has(c.name) || latest.get(c.name)!.t <= c.t) latest.set(c.name, c)
    return {
      candidates: [...latest.values()].sort((a, b) => b.confidence - a.confidence),
      transcript: this.#transcript.map((e) => e.text).join(" "),
      actions: this.actions,
    }
  }

  /**
   * Ask, if it is worth asking: an uncertain candidate is present (one the
   * recogniser would not invoke by itself), a backend exists, and the last
   * question is old enough. Resolves to the decision (or undefined).
   */
  async maybeAsk(t: number): Promise<JevDecision | undefined> {
    const b = this.opts.backend
    if (!b || this.#inFlight || t - this.#lastAsked < this.opts.interval || this.actions.length === 0) return undefined
    const ctx = this.context(t)
    const uncertain = ctx.candidates.find((c) => c.confidence < this.opts.invokeAt)
    if (!uncertain) return undefined
    this.#lastAsked = t
    this.#inFlight = true
    try {
      const d = await b.decide(ctx)
      if (d.action !== null && (!this.actions.some((a) => a.name === d.action) || d.confidence < this.opts.acceptAt)) {
        return { ...d, action: null }
      }
      if (d.action !== null) this.#candidates = [] // acted on: the window starts afresh
      return d
    } catch (err) {
      return { action: null, confidence: 0, reason: `jev failed: ${String((err as Error)?.message ?? err).slice(0, 120)}` }
    } finally {
      this.#inFlight = false
    }
  }

  #trim(t: number): void {
    const from = t - this.opts.span
    this.#candidates = this.#candidates.filter((c) => c.t >= from)
    this.#transcript = this.#transcript.filter((e) => e.t >= from)
  }
}

/** The browser's backend: the daemon's /api/jev. */
export const httpJev = (url = "/api/jev"): JevBackend => ({
  async decide(ctx) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ctx) })
    if (!res.ok) throw new Error(`/api/jev ${res.status}`)
    return (await res.json()) as JevDecision
  },
})
