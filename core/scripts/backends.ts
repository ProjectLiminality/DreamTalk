/**
 * backends.ts — the eyes the recognizer and the voice borrow: one question
 * (a system line, a prompt, one or more PNGs, optionally a JSON schema for
 * the reply), asked of whichever vision model is configured.
 *
 *   groq       Groq's OpenAI-compatible REST, a vision model in JSON-schema
 *              mode with reasoning off — the near-instant one (~0.5 s).
 *              Needs GROQ_API_KEY.
 *   anthropic  the Anthropic API through the official SDK (Claude Haiku 4.5
 *              by default), image as a base64 block, structured output via
 *              output_config.format. Needs ANTHROPIC_API_KEY.
 *   cli        `claude -p` headless on the subscription — what there always
 *              was: no key, 5–15 s, the image written to disk and Read.
 *
 * The CHAIN is every backend whose key is present, in the order
 * RECOGNIZE_BACKENDS names (default groq, anthropic, cli); a backend that
 * fails hands the question to the next, and the CLI is always last, so with
 * no keys at all nothing changes.
 *
 * KEYS come only from the environment or core/.env (gitignored; read once
 * here, never overriding what the shell set) and are never logged.
 *
 *   GROQ_API_KEY, ANTHROPIC_API_KEY      the keys
 *   RECOGNIZE_BACKENDS                    e.g. "anthropic,cli"
 *   GROQ_MODEL                            default qwen/qwen3.8-27b
 *   ANTHROPIC_MODEL                       default claude-haiku-4-5
 */

import Anthropic from "@anthropic-ai/sdk"
import { existsSync, readFileSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"

export type BackendName = "groq" | "anthropic" | "cli"

export const GROQ_MODEL = "qwen/qwen3.8-27b"
export const ANTHROPIC_MODEL = "claude-haiku-4-5"
export const CLI_MODEL = "claude-opus-5-5"
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

const coreDir = new URL("../", import.meta.url).pathname
const cacheDir = `${coreDir}../.cache/sketch`

/** One question for a vision model. */
export interface VisionAsk {
  system: string
  /** The prompt. `imagePaths` are given only to the CLI, which Reads the
   *  images from disk; a model that sees them inline gets none. */
  prompt: (imagePaths?: string[]) => string
  /** Base64 PNGs, in the order the prompt names them. */
  pngs: string[]
  /** A JSON schema the reply must match (strict). Without one, any JSON object. */
  schema?: Record<string, unknown>
  maxTokens?: number
  timeoutMs?: number
  /** Names the image files the CLI writes ("scribble", "page"). */
  tag?: string
}

export interface VisionReply {
  text: string
  backend: BackendName
  model: string
  ms: number
  /** The CLI's own accounting, when it gives one. */
  cost?: number
  turns?: number
}

export interface Backend {
  name: BackendName
  model: string
  ask(q: VisionAsk): Promise<VisionReply>
}

// --- Keys ---------------------------------------------------------------------

let envLoaded = false

/** core/.env → process.env, once; the shell's own values win. Values never logged. */
export const loadEnv = (path = `${coreDir}.env`): void => {
  if (envLoaded) return
  envLoaded = true
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!m || process.env[m[1]!] !== undefined) continue
    process.env[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, "$2")
  }
}

// --- Groq ---------------------------------------------------------------------

type Fetch = (url: string, init: RequestInit) => Promise<Response>

export const groqBackend = (opts: { apiKey: string; model?: string; fetch?: Fetch }): Backend => {
  const model = opts.model ?? GROQ_MODEL
  const doFetch: Fetch = opts.fetch ?? ((u, i) => fetch(u, i))
  return {
    name: "groq",
    model,
    async ask(q) {
      const started = performance.now()
      const body = {
        model,
        temperature: 0,
        max_completion_tokens: q.maxTokens ?? 2048,
        // Thinking off: the reading is a glance, not a deliberation.
        reasoning_effort: "none",
        response_format: q.schema
          ? { type: "json_schema", json_schema: { name: "reply", strict: true, schema: q.schema } }
          : { type: "json_object" },
        messages: [
          { role: "system", content: q.system },
          {
            role: "user",
            content: [
              { type: "text", text: q.prompt() },
              ...q.pngs.map((png) => ({ type: "image_url", image_url: { url: `data:image/png;base64,${png}` } })),
            ],
          },
        ],
      }
      const res = await doFetch(GROQ_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(q.timeoutMs ?? 30_000),
      })
      const raw = await res.text()
      if (!res.ok) throw new Error(`groq ${res.status}: ${raw.slice(0, 300)}`)
      const json = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] }
      const text = json.choices?.[0]?.message?.content
      if (typeof text !== "string") throw new Error(`groq: no message in ${raw.slice(0, 200)}`)
      return { text, backend: "groq", model, ms: performance.now() - started }
    },
  }
}

// --- Anthropic ----------------------------------------------------------------

/** What the backend needs of the SDK client — a real `Anthropic`, or a test double. */
export type MessagesClient = Pick<Anthropic, "messages">

export const anthropicBackend = (opts: { apiKey?: string; model?: string; client?: MessagesClient }): Backend => {
  const model = opts.model ?? ANTHROPIC_MODEL
  let client = opts.client
  return {
    name: "anthropic",
    model,
    async ask(q) {
      const started = performance.now()
      client ??= new Anthropic({ apiKey: opts.apiKey, maxRetries: 1 })
      const content: Anthropic.ContentBlockParam[] = [
        ...q.pngs.map((data): Anthropic.ImageBlockParam => ({ type: "image", source: { type: "base64", media_type: "image/png", data } })),
        { type: "text", text: q.prompt() },
      ]
      const res = await client.messages.create(
        {
          model,
          max_tokens: q.maxTokens ?? 2048,
          system: q.system,
          messages: [{ role: "user", content }],
          // Haiku takes no effort setting; the bigger models glance at low effort.
          ...(q.schema || !model.includes("haiku")
            ? {
                output_config: {
                  ...(q.schema ? { format: { type: "json_schema" as const, schema: q.schema } } : {}),
                  ...(model.includes("haiku") ? {} : { effort: "low" as const }),
                },
              }
            : {}),
        },
        { timeout: q.timeoutMs ?? 60_000 },
      )
      if (res.stop_reason === "refusal") throw new Error("anthropic: refused")
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("")
      return { text, backend: "anthropic", model, ms: performance.now() - started }
    },
  }
}

// --- The CLI (what there always was) ------------------------------------------

/** The CLI's --output-format json: an array of events (or one object);
 *  the `result` event's `.result` is the model's text. */
export const cliResultText = (stdout: string, meta?: { turns?: number; cost?: number }): string => {
  const parsed = JSON.parse(stdout) as unknown
  const events = Array.isArray(parsed) ? parsed : [parsed]
  const result = events.find((e) => (e as { type?: string })?.type === "result") as
    | { result?: unknown; is_error?: boolean; num_turns?: number; total_cost_usd?: number }
    | undefined
  if (!result) throw new Error("no result event in CLI output")
  if (meta) {
    meta.turns = result.num_turns
    meta.cost = result.total_cost_usd
  }
  if (result.is_error) throw new Error(`CLI error: ${String(result.result).slice(0, 300)}`)
  return String(result.result ?? "")
}

export const cliBackend = (opts: { model?: string } = {}): Backend => {
  const model = opts.model ?? CLI_MODEL
  return {
    name: "cli",
    model,
    async ask(q) {
      const started = performance.now()
      await mkdir(cacheDir, { recursive: true })
      const paths: string[] = []
      for (const png of q.pngs) {
        const path = `${cacheDir}/${q.tag ?? "image"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
        await Bun.write(path, Buffer.from(png, "base64"))
        paths.push(path)
      }
      // Lean session: Read only, no MCP servers, no settings/CLAUDE.md, run
      // from outside the repo so no project instructions load.
      const proc = Bun.spawn(
        [
          "claude", "-p",
          "--model", model,
          "--tools", "Read",
          "--allowedTools", "Read",
          "--strict-mcp-config",
          "--setting-sources", "",
          "--no-session-persistence",
          "--system-prompt", q.system,
          "--output-format", "json",
          q.prompt(paths),
        ],
        { cwd: tmpdir(), stdout: "pipe", stderr: "pipe", stdin: "ignore" },
      )
      const timeoutMs = q.timeoutMs ?? 90_000
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        proc.kill()
      }, timeoutMs)
      const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ])
      clearTimeout(timer)
      if (timedOut) throw new Error(`timed out after ${timeoutMs / 1000}s`)
      if (code !== 0 && !stdout.trim()) throw new Error(`claude exited ${code}: ${stderr.slice(0, 300)}`)
      const meta: { turns?: number; cost?: number } = {}
      const text = cliResultText(stdout, meta)
      return { text, backend: "cli", model, ms: performance.now() - started, ...meta }
    },
  }
}

// --- The chain ------------------------------------------------------------------

/**
 * The configured backends, fastest first, the CLI always last. Reads the
 * environment (and core/.env) each call, so a key added while the daemon
 * runs is picked up by the next question.
 */
export const backendChain = (env: Record<string, string | undefined> = (loadEnv(), process.env)): Backend[] => {
  const order = (env.RECOGNIZE_BACKENDS ?? "groq,anthropic,cli")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const chain: Backend[] = []
  for (const name of order) {
    if (name === "groq" && env.GROQ_API_KEY) chain.push(groqBackend({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL }))
    else if (name === "anthropic" && env.ANTHROPIC_API_KEY)
      chain.push(anthropicBackend({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL }))
  }
  chain.push(cliBackend())
  return chain
}

/** A backend fast enough to ask speculatively, on every pause of the pen. */
export const isFast = (b: Backend): boolean => b.name !== "cli"

/**
 * Ask down the chain: the first backend that answers, and why the earlier
 * ones didn't. `accept` may reject an answer (unparseable) to fall through.
 */
export const askChain = async (
  chain: readonly Backend[],
  q: VisionAsk,
  accept: (reply: VisionReply) => boolean = () => true,
): Promise<{ reply?: VisionReply; failures: string[] }> => {
  const failures: string[] = []
  for (const b of chain) {
    try {
      const reply = await b.ask(q)
      if (accept(reply)) return { reply, failures }
      failures.push(`${b.name}: unusable reply`)
    } catch (err) {
      failures.push(`${b.name}: ${String((err as Error)?.message ?? err).slice(0, 200)}`)
    }
  }
  return { failures }
}
