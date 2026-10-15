import { describe, expect, test } from "bun:test"
import { Jev, prompt, type JevContext, type JevDecision } from "../src/gesture/jev"
import { jevAvailable } from "../scripts/jev"

const fake = (answer: (ctx: JevContext) => JevDecision) => {
  const asked: JevContext[] = []
  return {
    asked,
    backend: {
      decide: async (ctx: JevContext) => {
        asked.push(ctx)
        return answer(ctx)
      },
    },
  }
}

const actions = [
  { name: "summon.flowmap", description: "bring the value-flow map into the scene" },
  { name: "grain", description: "sort the sites into their categories" },
]

describe("Jev", () => {
  test("asks only about an UNCERTAIN candidate, with what was said, and acts on a confident answer", async () => {
    const f = fake(() => ({ action: "summon.flowmap", confidence: 0.9, reason: "they said 'show the flows'" }))
    const jev = new Jev({ backend: f.backend })
    jev.actions = actions
    jev.hear({ t: 1, text: "so let me show you the flows", final: true })
    // A sure candidate: the recogniser acts alone — Jev stays out.
    jev.see([{ name: "spiral", confidence: 0.9, distance: 0.05, t: 2 }])
    expect(await jev.maybeAsk(2)).toBeUndefined()
    // An uncertain one: Jev asks, with the transcript and the actions.
    jev.see([{ name: "spiral", confidence: 0.3, distance: 0.2, t: 4 }])
    const d = await jev.maybeAsk(4)
    expect(d?.action).toBe("summon.flowmap")
    expect(f.asked[0]!.transcript).toContain("show you the flows")
    expect(prompt(f.asked[0]!)).toContain("summon.flowmap: bring the value-flow map")
  })

  test("an unknown action or a low confidence is no action; questions are rate-limited", async () => {
    const answers: JevDecision[] = [
      { action: "delete.everything", confidence: 0.99 },
      { action: "grain", confidence: 0.2 },
    ]
    const f = fake(() => answers.shift()!)
    const jev = new Jev({ backend: f.backend, interval: 1.5 })
    jev.actions = actions
    jev.see([{ name: "spiral", confidence: 0.3, distance: 0.2, t: 1 }])
    expect((await jev.maybeAsk(1))?.action).toBeNull()
    expect(await jev.maybeAsk(2)).toBeUndefined() // too soon
    jev.see([{ name: "spiral", confidence: 0.3, distance: 0.2, t: 3 }])
    expect((await jev.maybeAsk(3))?.action).toBeNull()
    expect(f.asked.length).toBe(2)
  })

  test("without a backend, Jev never asks — the layer is optional", async () => {
    const jev = new Jev()
    jev.actions = actions
    jev.see([{ name: "spiral", confidence: 0.3, distance: 0.2, t: 1 }])
    expect(await jev.maybeAsk(1)).toBeUndefined()
    expect(jevAvailable({})).toBe(false) // no keys: the daemon answers 503
  })
})
