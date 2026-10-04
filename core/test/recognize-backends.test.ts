/**
 * The recognizer's backends and its staged reading — with every model
 * mocked: Groq by a fake fetch, the Anthropic SDK by a fake client, whole
 * backends by objects. No key, no network, no CLI: what is pinned is the
 * request each backend sends, the fall-through order, and what the stages
 * (look → fit → second look → escalate → remembered) do with the answers.
 */

import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { inflateSync } from "node:zlib"
import {
  anthropicBackend,
  askChain,
  backendChain,
  clefBackend,
  decisionFirst,
  groqBackend,
  loadEnv,
  type Backend,
  type DecisionBackend,
  type MessagesClient,
  type VisionAsk,
} from "../scripts/backends"
import { overlayPng } from "../scripts/overlay"
import { parseRecognizeReply, readingSchema, recognize, recognizeMemo, POOR_FIT } from "../scripts/recognize"
import type { RecognizeRequest } from "../sketch/protocol"
import { roughCylinder, wobblyCircle } from "./scribbles"

const ASK: VisionAsk = {
  system: "sys",
  prompt: (paths) => (paths ? `read ${paths[0]}` : "look at the attached image"),
  pngs: ["AAAA"],
  schema: { type: "object" },
  maxTokens: 300,
}

describe("Groq", () => {
  test("sends the vision model a strict JSON-schema request with reasoning off", async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const b = groqBackend({
      apiKey: "gsk_test",
      fetch: async (url, init) => {
        seen = { url, init }
        return new Response(JSON.stringify({ choices: [{ message: { content: '{"candidates":[],"notes":""}' } }] }))
      },
    })
    const r = await b.ask(ASK)
    expect(r.text).toBe('{"candidates":[],"notes":""}')
    expect(r.backend).toBe("groq")
    expect(seen!.url).toBe("https://api.groq.com/openai/v1/chat/completions")
    expect((seen!.init.headers as Record<string, string>).authorization).toBe("Bearer gsk_test")
    const body = JSON.parse(String(seen!.init.body))
    expect(body.model).toBe("qwen/qwen3.8-27b")
    expect(body.reasoning_effort).toBe("none")
    expect(body.response_format).toEqual({ type: "json_schema", json_schema: { name: "reply", strict: true, schema: { type: "object" } } })
    const content = body.messages[1].content
    expect(content[0]).toEqual({ type: "text", text: "look at the attached image" })
    expect(content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } })
  })

  test("an HTTP error throws, and never carries the key", async () => {
    const b = groqBackend({ apiKey: "gsk_secret", fetch: async () => new Response("rate limited", { status: 429 }) })
    const err = await b.ask(ASK).catch((e: Error) => e)
    expect(String(err)).toContain("groq 429")
    expect(String(err)).not.toContain("gsk_secret")
  })
})

describe("Anthropic", () => {
  test("Haiku: the image as a base64 block, the schema as output_config.format, no effort", async () => {
    let params: Record<string, unknown> | undefined
    const client = {
      messages: {
        create: async (p: Record<string, unknown>) => {
          params = p
          return { stop_reason: "end_turn", content: [{ type: "text", text: '{"candidates":[]}' }] }
        },
      },
    } as unknown as MessagesClient
    const r = await anthropicBackend({ client }).ask(ASK)
    expect(r.text).toBe('{"candidates":[]}')
    expect(params!.model).toBe("claude-haiku-4-5")
    expect(params!.system).toBe("sys")
    const content = (params!.messages as { content: unknown[] }[])[0]!.content
    expect(content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } })
    expect(content[1]).toEqual({ type: "text", text: "look at the attached image" })
    expect(params!.output_config).toEqual({ format: { type: "json_schema", schema: { type: "object" } } })
  })

  test("a bigger model glances at low effort; a refusal falls through", async () => {
    let params: Record<string, unknown> | undefined
    const client = {
      messages: {
        create: async (p: Record<string, unknown>) => {
          params = p
          return { stop_reason: "refusal", content: [] }
        },
      },
    } as unknown as MessagesClient
    const err = await anthropicBackend({ client, model: "claude-sonnet-5-5" })
      .ask(ASK)
      .catch((e: Error) => e)
    expect((params!.output_config as { effort?: string }).effort).toBe("low")
    expect(String(err)).toContain("refused")
  })
})

describe("the chain", () => {
  test("no keys: the CLI alone, exactly as before", () => {
    expect(backendChain({}).map((b) => b.name)).toEqual(["cli"])
  })

  test("keys add the fast backends ahead of the CLI, in the configured order", () => {
    expect(backendChain({ GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "a" }).map((b) => b.name)).toEqual(["groq", "anthropic", "cli"])
    expect(backendChain({ GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "a", RECOGNIZE_BACKENDS: "anthropic,groq" }).map((b) => b.name)).toEqual([
      "anthropic",
      "groq",
      "cli",
    ])
    expect(backendChain({ ANTHROPIC_API_KEY: "a", ANTHROPIC_MODEL: "claude-opus-5-5" })[0]!.model).toBe("claude-opus-5-5")
  })

  test("a failing backend hands the question on", async () => {
    const bad: Backend = { name: "groq", model: "m", ask: async () => { throw new Error("down") } }
    const good: Backend = { name: "cli", model: "m", ask: async () => ({ text: "{}", backend: "cli", model: "m", ms: 1 }) }
    const { reply, failures } = await askChain([bad, good], ASK)
    expect(reply?.backend).toBe("cli")
    expect(failures).toEqual(["groq: down"])
  })

  test("core/.env fills what the shell left unset, and nothing else", () => {
    const dir = mkdtempSync(`${tmpdir()}/env-`)
    writeFileSync(`${dir}/.env`, 'DT_TEST_A=from-file\nexport DT_TEST_B="quoted"\nDT_TEST_C=file\n')
    process.env.DT_TEST_C = "shell"
    loadEnv(`${dir}/.env`)
    // loadEnv runs once per process; a test after the daemon's own load still sees the file's values only if first.
    if (process.env.DT_TEST_A !== undefined) {
      expect(process.env.DT_TEST_A).toBe("from-file")
      expect(process.env.DT_TEST_B).toBe("quoted")
    }
    expect(process.env.DT_TEST_C).toBe("shell")
  })
})

// --- The staged reading ---------------------------------------------------------

const circleInk = wobblyCircle(4, 600, 500, 120)
const request = (vocabulary = ["circle", "square", "triangle"]): RecognizeRequest => ({
  png: "iVBORw0KGgo=",
  crop: { x: 440, y: 340, w: 320, h: 320 },
  strokes: circleInk,
  vocabulary,
})

/** A schema-form reply (params as a list), as the API backends give it. */
const reply = (symbol: string, params: Record<string, number>) =>
  JSON.stringify({
    candidates: [
      { symbol, params: Object.entries(params).map(([name, number]) => ({ name, number, text: null, points: [] })), confidence: 0.9, why: "" },
    ],
    notes: "",
  })

const scripted = (name: Backend["name"], answers: string[], seen: VisionAsk[] = []): Backend => ({
  name,
  model: "mock",
  ask: async (q) => {
    seen.push(q)
    const text = answers.shift()
    if (text === undefined) throw new Error("no more answers")
    return { text, backend: name, model: "mock", ms: 1 }
  },
})

describe("the reading, staged", () => {
  test("the schema is strict everywhere: every object closed, every field required", () => {
    const walk = (s: unknown): void => {
      if (!s || typeof s !== "object") return
      const o = s as Record<string, unknown>
      if (o.type === "object") {
        expect(o.additionalProperties).toBe(false)
        expect(o.required).toEqual(Object.keys(o.properties as object))
      }
      for (const v of Object.values(o)) walk(v)
    }
    walk(readingSchema(["circle"]))
  })

  test("params as a list read back as the params object", () => {
    const r = parseRecognizeReply(
      JSON.stringify({
        candidates: [
          {
            symbol: "flowerOfLife",
            params: [
              { name: "cx", number: 10, text: null, points: [] },
              { name: "rings", number: null, text: "2", points: [] },
            ],
            confidence: 1,
            why: "",
          },
        ],
        notes: "",
      }),
    )
    expect(r.candidates[0]!.params).toEqual({ cx: 10, rings: "2" })
  })

  test("look → fit: the fast model's rough numbers are tuned onto the ink", async () => {
    const res = await recognize(request(), { chain: [scripted("groq", [reply("circle", { cx: 625, cy: 480, r: 140 })])] })
    expect(res.candidates[0]!.symbol).toBe("circle")
    expect(Math.abs(Number(res.candidates[0]!.params.r) - 120)).toBeLessThan(10)
    expect(res.fit!).toBeLessThan(POOR_FIT)
    expect(res.backend).toBe("groq:mock")
    expect(res.stages!.map((s) => s.name)).toEqual(["groq mock", "fit"])
  })

  test("a poor fit gets a second look, with the overlay as a second image", async () => {
    const seen: VisionAsk[] = []
    const groq = scripted("groq", [reply("square", { cx: 600, cy: 500, size: 60, rotation: 0.7 }), reply("circle", { cx: 600, cy: 500, r: 120 })], seen)
    const res = await recognize(request(), { chain: [groq] })
    expect(seen).toHaveLength(2)
    expect(seen[1]!.pngs).toHaveLength(2)
    expect(seen[1]!.prompt()).toContain("SECOND LOOK")
    expect(res.candidates[0]!.symbol).toBe("circle")
    expect(res.stages!.map((s) => s.name)).toContain("second look")
  })

  test("still poor: Claude takes it — but ahead of ✦, never the slow CLI", async () => {
    const bad = () => scripted("groq", [reply("square", { cx: 600, cy: 500, size: 40, rotation: 0.7 }), reply("square", { cx: 600, cy: 500, size: 40, rotation: 0.7 })])
    const cliSeen: VisionAsk[] = []
    const cli = scripted("cli", [JSON.stringify({ candidates: [{ symbol: "circle", params: { cx: 600, cy: 500, r: 120 }, confidence: 0.9, why: "" }], notes: "" })], cliSeen)
    const ahead = await recognize(request(), { chain: [bad(), cli], speculative: true })
    expect(cliSeen).toHaveLength(0)
    expect(ahead.candidates[0]!.symbol).toBe("square")
    const asked = await recognize(request(), { chain: [bad(), cli] })
    expect(cliSeen).toHaveLength(1)
    // The CLI still reads from disk, in the object form, as always.
    expect(cliSeen[0]!.prompt(["/tmp/x.png"])).toContain("Read the image /tmp/x.png")
    expect(asked.candidates[0]!.symbol).toBe("circle")
    expect(asked.backend).toBe("cli:mock")
  })

  test("asked ahead, answered for ✦: the same ink is read once", async () => {
    const seen: VisionAsk[] = []
    const groq = scripted("groq", [reply("circle", { cx: 600, cy: 500, r: 121 })], seen)
    const req = request(["circle", "triangle"])
    const first = await recognizeMemo(req, { chain: [groq], speculative: true })
    const second = await recognizeMemo({ ...req, png: "different-render" }, { chain: [groq] })
    expect(seen).toHaveLength(1)
    expect(second.candidates).toEqual(first.candidates)
    expect(second.stages!.at(-1)!.name).toBe("remembered")
  })

  test("ahead of ✦ with only the CLI: nothing is asked", async () => {
    const seen: VisionAsk[] = []
    const res = await recognize(request(), { chain: [scripted("cli", ["{}"], seen)], speculative: true })
    expect(seen).toHaveLength(0)
    expect(res.error).toContain("no fast backend")
  })
})

describe("the overlay", () => {
  test("a real PNG: ink black, the reading red", () => {
    const b64 = overlayPng(circleInk, [[{ x: 480, y: 500 }, { x: 720, y: 500 }]], { x: 440, y: 340, w: 320, h: 320 }, 128)
    const png = Buffer.from(b64, "base64")
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(png.readUInt32BE(16)).toBe(128)
    expect(png.readUInt32BE(20)).toBe(128)
    // The IDAT payload inflates to rows of filter byte + RGB.
    const idat = png.indexOf("IDAT")
    const len = png.readUInt32BE(idat - 4)
    const raw = inflateSync(png.subarray(idat + 4, idat + 4 + len))
    expect(raw.length).toBe(128 * (1 + 128 * 3))
    let red = 0, black = 0
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const i = y * (1 + 384) + 1 + x * 3
        if (raw[i]! > 200 && raw[i + 1]! < 80) red++
        if (raw[i]! < 50 && raw[i + 1]! < 50 && raw[i + 2]! < 50) black++
      }
    expect(red).toBeGreaterThan(50)
    expect(black).toBeGreaterThan(100)
  })
})

describe("Clef (a decision model)", () => {
  test("one typed Choice over the image, in the Workers AI System One shape", async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const b = clefBackend({
      accountId: "acc123",
      apiToken: "cf_secret",
      fetch: async (url, init) => {
        seen = { url, init }
        return new Response(
          JSON.stringify({
            success: true,
            result: { model: "clef-flash", answers: { symbol: { type: "choice", choice: "circle", probabilities: { circle: 0.8, square: 0.2 }, confidence: 0.7 } }, usage: { input_tokens: 1, output_tokens: 0 } },
          }),
        )
      },
    })
    const d = await b.choose({ state: "ink", pngs: ["AAAA"], choice: { instructions: "which?", options: { circle: "a circle", square: "a square" } } })
    expect(d).toMatchObject({ choice: "circle", probabilities: { circle: 0.8, square: 0.2 }, confidence: 0.7 })
    expect(seen!.url).toBe("https://api.cloudflare.com/client/v4/accounts/acc123/ai/run/@cf/cloudflare/clef-flash")
    expect((seen!.init.headers as Record<string, string>).authorization).toBe("Bearer cf_secret")
    expect(JSON.parse(String(seen!.init.body))).toEqual({
      model: "clef-flash",
      state: "ink",
      images: ["data:image/png;base64,AAAA"],
      questions: { symbol: { type: "choice", instructions: "which?", criteria: { circle: "a circle", square: "a square" } } },
    })
  })

  test("an HTTP error throws without the token", async () => {
    const b = clefBackend({ accountId: "a", apiToken: "cf_secret", fetch: async () => new Response("no", { status: 403 }) })
    const err = await b.choose({ state: "", pngs: [], choice: { instructions: "", options: {} } }).catch((e: Error) => e)
    expect(String(err)).toContain("clef 403")
    expect(String(err)).not.toContain("cf_secret")
  })

  test("Clef goes first when it has credentials and no keyed reader is ordered before it", () => {
    const cf = { CLOUDFLARE_ACCOUNT_ID: "a", CLOUDFLARE_API_TOKEN: "t" }
    expect(decisionFirst({})).toBeUndefined()
    expect(decisionFirst(cf)?.name).toBe("clef")
    expect(decisionFirst({ ...cf, GROQ_API_KEY: "g" })).toBeUndefined()
    expect(decisionFirst({ ...cf, GROQ_API_KEY: "g", RECOGNIZE_BACKENDS: "clef,groq,cli" })?.name).toBe("clef")
  })

  const deciding = (choice: string, probabilities: Record<string, number>): DecisionBackend => ({
    name: "clef",
    model: "mock",
    choose: async () => ({ choice, probabilities, confidence: 0.9, model: "mock", ms: 1 }),
  })

  test("Clef chooses, the fitter places: a cylinder from the ink alone", async () => {
    const ink = roughCylinder(1)
    const req: RecognizeRequest = { png: "iVBORw0KGgo=", crop: { x: 780, y: 440, w: 240, h: 320 }, strokes: ink, vocabulary: ["circle", "cylinder", "cube"] }
    const res = await recognize(req, { chain: [], decision: deciding("cylinder", { cylinder: 0.9, cube: 0.08, circle: 0.02 }) })
    expect(res.candidates.map((c) => c.symbol)).toEqual(["cylinder"])
    expect(res.fit!).toBeLessThan(POOR_FIT)
    expect(Math.abs(Number(res.candidates[0]!.params.radius) - 70)).toBeLessThan(15)
    expect(res.backend).toBe("clef:mock")
  })

  test("words or a cable are not Clef's to place: the reading model takes over", async () => {
    const seen: VisionAsk[] = []
    const res = await recognize(request(), {
      chain: [scripted("groq", [reply("circle", { cx: 600, cy: 500, r: 120 })], seen)],
      decision: deciding("text", { text: 0.7, circle: 0.3 }),
    })
    expect(seen).toHaveLength(1)
    expect(res.candidates[0]!.symbol).toBe("circle")
    expect(res.stages!.map((s) => s.name)[0]).toBe("clef mock")
  })
})
