/**
 * jev.ts — the daemon side of Jev (src/gesture/jev.ts): one decision, "which
 * of these actions does the person mean, if any?", asked of the fast models
 * the whiteboard already uses (scripts/backends.ts):
 *
 *   clef   a typed CHOICE over the scene's action names plus "none", with
 *          probabilities — the natural shape of the question (needs
 *          CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN);
 *   groq / anthropic   the same question as JSON (an action name, a
 *          confidence, a reason) under a strict schema.
 *
 * The slow CLI is not asked unless JEV_ALLOW_CLI=1 — a decision that arrives
 * ten seconds after the gesture is no decision. With no key at all the
 * endpoint answers 503 and Jev simply stays silent.
 */

import { askChain, backendChain, decisionFirst, isFast, loadEnv } from "./backends"
import { prompt, type JevContext, type JevDecision } from "../src/gesture/jev"

const SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string" },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
  required: ["action", "confidence", "reason"],
  additionalProperties: false,
}

export const jevAvailable = (env: Record<string, string | undefined> = (loadEnv(), process.env)): boolean =>
  decisionFirst(env) !== undefined || backendChain(env).some((b) => isFast(b) || env.JEV_ALLOW_CLI === "1")

export const jevDecide = async (
  ctx: JevContext,
  env: Record<string, string | undefined> = (loadEnv(), process.env),
): Promise<JevDecision> => {
  const started = Date.now()
  const names = new Set(ctx.actions.map((a) => a.name))
  const clef = decisionFirst(env)
  if (clef) {
    const options: Record<string, string> = { none: "the gesture is incidental — no action is meant" }
    for (const a of ctx.actions) options[a.name] = a.description
    const d = await clef.choose({
      state: prompt(ctx),
      pngs: [],
      choice: { instructions: "Which action does the person mean right now?", options },
      timeoutMs: 4000,
    })
    return {
      action: d.choice === "none" || !names.has(d.choice) ? null : d.choice,
      confidence: d.confidence,
      reason: `clef: p=${(d.probabilities[d.choice] ?? 0).toFixed(2)}`,
      model: d.model,
      ms: Date.now() - started,
    }
  }
  const chain = backendChain(env).filter((b) => isFast(b) || env.JEV_ALLOW_CLI === "1")
  const { reply, failures } = await askChain(
    chain,
    {
      system: "You are Jev, the intent layer of a gesture interface. Answer with JSON only.",
      prompt: () => `${prompt(ctx)}\nAnswer: {"action": "<one action name or none>", "confidence": 0..1, "reason": "<a few words>"}`,
      pngs: [],
      schema: SCHEMA,
      maxTokens: 200,
      timeoutMs: 6000,
      tag: "jev",
    },
    (r) => {
      try {
        JSON.parse(r.text)
        return true
      } catch {
        return false
      }
    },
  )
  if (!reply) return { action: null, confidence: 0, reason: `no backend answered: ${failures.join("; ")}`, ms: Date.now() - started }
  const parsed = JSON.parse(reply.text) as { action?: string; confidence?: number; reason?: string }
  return {
    action: parsed.action && names.has(parsed.action) ? parsed.action : null,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    reason: parsed.reason,
    model: reply.model,
    ms: Date.now() - started,
  }
}
