/**
 * The spoken score — narration's contract.
 *
 * The properties worth pinning are the ones the rest of the system leans on:
 * timing is pure (so a scene renders identically with or without audio), keys
 * are content-addressed (so editing one line re-synthesizes one line), and
 * collisions are reported rather than silently swallowed.
 */

import { describe, expect, test } from "bun:test"
import { Narration, spokenSeconds, utteranceKey } from "../src/narration"
import { DEFAULT_VOICE, isValidVoiceKey, voiceKey } from "../src/voice"
import { Dream } from "../src/dream"
import { Circle } from "../src/parts/primitives"
import { Create } from "../src/verbs"

describe("spokenSeconds", () => {
  test("is pure — the same text always estimates the same", () => {
    const text = "An agent is in an arena."
    expect(spokenSeconds(text)).toBe(spokenSeconds(text))
  })

  test("empty text takes no time", () => {
    expect(spokenSeconds("")).toBe(0)
    expect(spokenSeconds("   ")).toBe(0)
  })

  test("longer lines take longer", () => {
    expect(spokenSeconds("A short line.")).toBeLessThan(
      spokenSeconds("A considerably longer line with a good many more words in it."),
    )
  })

  test("punctuation adds pause — a speaker stops at a full stop", () => {
    // Same word count, different stopping.
    expect(spokenSeconds("one two three four. five six.")).toBeGreaterThan(
      spokenSeconds("one two three four five six"),
    )
  })

  test("estimates land within a sane band of measured speech", () => {
    // Measured from synthesized audio (macOS say/Samantha): ~173 wpm.
    // A twelve-word line should come out in single-digit seconds, not
    // fractions and not half a minute — a guard against a unit slip.
    const twelve = "one two three four five six seven eight nine ten more words"
    const est = spokenSeconds(twelve)
    expect(est).toBeGreaterThan(3)
    expect(est).toBeLessThan(8)
  })
})

describe("utteranceKey", () => {
  test("same text and voice give the same key", () => {
    expect(utteranceKey("Hello there.", "narrator")).toBe(utteranceKey("Hello there.", "narrator"))
  })

  test("different text gives a different key — editing one line is one resynth", () => {
    expect(utteranceKey("Hello there.", "narrator")).not.toBe(
      utteranceKey("Hello, there.", "narrator"),
    )
  })

  test("different voice gives a different key — voices can coexist", () => {
    expect(utteranceKey("Hello there.", "narrator")).not.toBe(
      utteranceKey("Hello there.", "Daniel"),
    )
  })

  test("surrounding whitespace does not change the key", () => {
    expect(utteranceKey("  Hello there. ", "narrator")).toBe(
      utteranceKey("Hello there.", "narrator"),
    )
  })

  test("keys are the hex shape the daemon route enforces", () => {
    expect(isValidVoiceKey(utteranceKey("anything at all", DEFAULT_VOICE))).toBe(true)
    // Nothing that could escape the cache directory may pass.
    expect(isValidVoiceKey("../../etc/passwd")).toBe(false)
    expect(isValidVoiceKey("short")).toBe(false)
  })
})

describe("Narration", () => {
  test("is empty until something is said", () => {
    expect(new Narration().isEmpty).toBe(true)
  })

  test("at(t) finds the line being spoken, and nothing in the gaps", () => {
    const n = new Narration()
    n.add("First line here.", 0)
    n.add("Second line here.", 20)
    expect(n.at(0.1)?.text).toBe("First line here.")
    expect(n.at(10)).toBeUndefined()
    expect(n.at(20.1)?.text).toBe("Second line here.")
  })

  test("reports overlapping lines rather than reflowing them", () => {
    const n = new Narration()
    n.add("A line long enough to run past the next one that follows it.", 0)
    n.add("Too soon.", 0.5)
    const clashes = n.overlaps()
    expect(clashes.length).toBe(1)
    expect(clashes[0]!.by).toBeGreaterThan(0)
  })

  test("well-spaced lines do not collide", () => {
    const n = new Narration()
    n.add("One.", 0)
    n.add("Two.", 30)
    expect(n.overlaps()).toEqual([])
  })

  test("transcript carries timecodes for reading and diffing", () => {
    const n = new Narration()
    n.add("Hello.", 1.5)
    expect(n.transcript()).toBe("[1.50] Hello.")
  })
})

describe("Dream.say", () => {
  class Silent extends Dream {
    c = new Circle({ radius: 10 })
    unfold() {
      this.play(Create(this.c), 2)
    }
  }

  class Spoken extends Dream {
    c = new Circle({ radius: 10 })
    unfold() {
      this.say("A line that does not hold.")
      this.play(Create(this.c), 2)
    }
  }

  class Holding extends Dream {
    c = new Circle({ radius: 10 })
    unfold() {
      this.say("A line that holds the timeline open.", { hold: true })
      this.play(Create(this.c), 2)
    }
  }

  test("a dream with no say() has empty narration", () => {
    expect(new Silent().narration.isEmpty).toBe(true)
  })

  test("say() does not advance the cursor — words play OVER the beat", () => {
    // This is the property that keeps narration from changing any existing
    // scene's timing: it is additive by default.
    expect(new Spoken().duration).toBe(new Silent().duration)
  })

  test("say({hold}) reserves the line's time on the timeline", () => {
    expect(new Holding().duration).toBeGreaterThan(new Silent().duration)
  })

  test("narration records what was said and when", () => {
    const d = new Spoken()
    d.build()
    expect(d.narration.lines.length).toBe(1)
    expect(d.narration.lines[0]!.start).toBe(0)
    expect(d.narration.lines[0]!.text).toBe("A line that does not hold.")
  })

  test("voiceKey of a line is stable across rebuilds of the same dream", () => {
    const a = new Spoken()
    const b = new Spoken()
    expect(voiceKey(a.narration.lines[0]!)).toBe(voiceKey(b.narration.lines[0]!))
  })
})
