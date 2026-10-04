/**
 * Behaviour as data — "the button contains what it does".
 *
 * Creator mode's promise needs two things the model lacked (OPEN-THREADS,
 * Creator mode): STRING PARAMS (Text.content a Param, not frozen
 * construction data) and DERIVED CONTENT (a holon whose words are a reading
 * of other params through a rule). These pin both, the calculator built on
 * them, the song that now changes its rule rather than swapping glyphs,
 * and the edit's round trip through the scene file.
 */

import { describe, expect, test } from "bun:test"
import { Text } from "../src/parts/text"
import { Null } from "../src/parts/primitives"
import { Timeline } from "../src/timeline"
import { choice, derive, text } from "../src/params"
import { Calculator, compute } from "../demo/creatormode/Calculator"
import { CreatorModeDream } from "../demo/creatormode/CreatorMode"
import { applySetOverride, readOverride } from "../scripts/ops"
import { formatValue, inspectorGroups } from "../editor/inspector"

describe("string params", () => {
  test("text() holds a string; choice() holds one of its options", () => {
    expect(text("hi").value).toBe("hi")
    const op = choice("+", ["+", "×"])
    expect(op.value).toBe("+")
    expect(op.options).toEqual(["+", "×"])
  })

  test("a choice refuses a value outside its vocabulary — at construction and on write", () => {
    expect(() => choice("^", ["+", "×"])).toThrow(/choice of \+ ×/)
    expect(() => choice("+", ["+", "×"]).clamp("^")).toThrow()
  })

  test("a string cannot animate .by() and steps (never blends) on the timeline", () => {
    const op = choice("+", ["+", "×"])
    expect(() => op.by(1)).toThrow(/cannot animate/)
    const anim = op.to("×")
    const tl = new Timeline([{ start: 1, duration: 1, anim }])
    expect(tl.valueAt(op, 0)).toBe("+")
    expect(tl.valueAt(op, 1.5)).toBe("+")
    expect(tl.valueAt(op, 1.99)).toBe("+")
    expect(tl.valueAt(op, 2)).toBe("×")
    expect(tl.valueAt(op, 9)).toBe("×")
  })
})

describe("Text.content — data to its readers, a param to its holon", () => {
  test("a literal reads as the string, and is the param's default", () => {
    const t = new Text({ content: "hello" })
    expect(t.content).toBe("hello")
    const p = t.params.get("content")!
    expect(p.kind).toBe("text")
    expect(p.defaultValue).toBe("hello")
    expect(t.letters.map((l) => l.char).join("")).toBe("hello")
  })

  test("unset is the old default", () => {
    expect(new Text().content).toBe("Text")
  })

  test("writing the field writes the param — it never stops being one", () => {
    const t = new Text({ content: "a" })
    t.content = "b"
    expect(t.content).toBe("b")
    expect(t.params.get("content")!.value).toBe("b")
  })

  test("a shared Param binds: the Text says whatever the param holds", () => {
    const op = choice("+", ["+", "×"])
    const t = new Text({ content: op })
    expect(t.params.get("content")).toBe(op)
    expect(t.content).toBe("+")
    op.value = "×"
    expect(t.content).toBe("×")
  })

  test("a derived reading follows: content recomputes on every read", () => {
    const n = text("3")
    const t = new Text({ content: derive(() => `${n.value}!`) })
    expect(t.content).toBe("3!")
    n.value = "4"
    expect(t.content).toBe("4!")
    expect(t.params.get("content")!.isBound).toBe(true)
  })

  test("a holon WITHOUT asData fields reads its params as Params, as ever", () => {
    const h = new Null()
    expect(h.x.value).toBe(0)
  })
})

describe("the calculator carries its rule", () => {
  test("compute is the rule table, honestly formatted", () => {
    expect(compute("3", "+", "5")).toBe("8")
    expect(compute("3", "×", "5")).toBe("15")
    expect(compute("3", "−", "5")).toBe("−2")
    expect(compute("3", "÷", "5")).toBe("0.6")
    expect(compute("3", "÷", "0")).toBe("—")
  })

  test("out is DERIVED from a, op and b — change the rule, the answer recomputes", () => {
    const calc = new Calculator()
    expect(calc.opGlyph.content).toBe("+")
    expect(calc.out.content).toBe("8")
    calc.op.value = "×"
    expect(calc.opGlyph.content).toBe("×")
    expect(calc.out.content).toBe("15")
    calc.inputA.value = "4"
    expect(calc.valueA.content).toBe("4")
    expect(calc.out.content).toBe("20")
  })

  test("the override the editor writes is the construction option that holds it", () => {
    expect(new Calculator({ op: "×" }).out.content).toBe("15")
    expect(() => new Calculator({ op: "^" })).toThrow()
  })

  test("the glyph SHARES op (declared on the Calculator); the output is bound", () => {
    const calc = new Calculator()
    const content = calc.opGlyph.params.get("content")!
    expect(content).toBe(calc.op)
    // The editor commits a shared param to its OWNER under the owner's name.
    expect(content.owner).toBe(calc)
    expect(content.name).toBe("op")
    expect(calc.out.params.get("content")!.isBound).toBe(true)
  })

  test("the inspector shows the glyph's content (a choice) and formats strings", () => {
    const calc = new Calculator()
    const entries = inspectorGroups(calc.opGlyph, []).flatMap((g) => g.entries)
    const row = entries.find((e) => e.name === "content")!
    expect(row.param.options).toEqual(["+", "−", "×", "÷"])
    expect(formatValue("×")).toBe("×")
  })
})

describe("the CreatorMode song changes the rule, not the picture", () => {
  const dream = new CreatorModeDream()
  const tl = dream.build()
  const app = dream.app
  const at = (t: number) => {
    tl.apply(t)
    return {
      op: app.opGlyph.content,
      out: app.out.content,
      opOpacity: app.opGlyph.opacity.value,
      outOpacity: app.out.opacity.value,
    }
  }

  test("game mode computes 8; after beat 5 the same holons say × and 15", () => {
    expect(at(25)).toMatchObject({ op: "+", out: "8", outOpacity: 1 })
    const after = at(tl.duration - 4)
    expect(after.op).toBe("×")
    expect(after.out).toBe("15")
  })

  test("the rule steps exactly once, while both glyphs are dark (async re-layout stays unseen)", () => {
    let prev = at(0)
    let switches = 0
    for (let t = 0; t < tl.duration; t += 1 / 30) {
      const now = at(t)
      if (now.op !== prev.op || now.out !== prev.out) {
        switches++
        expect(now.opOpacity).toBeLessThan(0.02)
        expect(now.outOpacity).toBeLessThan(0.02)
      }
      prev = now
    }
    expect(switches).toBe(1)
  })
})

describe("setOverride round-trips a string through the scene file", () => {
  const scene = `export class S extends Dream {
  app = new Calculator()
  label = new Text({ content: "hi", size: 34 })
}
`
  const span = (src: string, needle: string) => {
    const start = src.indexOf(needle)
    return { start, end: start + needle.length }
  }

  test("inserted into an argument-less construction, then rewritten in place", () => {
    const s1 = applySetOverride(scene, {
      op: "setOverride",
      span: span(scene, "new Calculator()"),
      className: "Calculator",
      name: "op",
      value: "×",
    })
    expect(s1.ok).toBe(true)
    const t1 = (s1 as { text: string }).text
    expect(t1).toContain(`app = new Calculator({ op: "×" })`)
    const at1 = span(t1, `new Calculator({ op: "×" })`)
    expect(readOverride(t1, { span: at1, className: "Calculator", name: "op" })).toEqual({
      kind: "literal",
      value: "×",
    })
    const s2 = applySetOverride(t1, { op: "setOverride", span: at1, className: "Calculator", name: "op", value: "÷" })
    expect((s2 as { text: string }).text).toContain(`app = new Calculator({ op: "÷" })`)
  })

  test("an existing string literal is replaced, every other byte kept", () => {
    const res = applySetOverride(scene, {
      op: "setOverride",
      span: span(scene, `new Text({ content: "hi", size: 34 })`),
      className: "Text",
      name: "content",
      value: `say "hello"`,
    })
    expect((res as { text: string }).text).toBe(
      scene.replace(`content: "hi"`, `content: "say \\"hello\\""`),
    )
  })
})
