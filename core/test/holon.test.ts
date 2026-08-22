import { describe, expect, test } from "bun:test"
import { Holon } from "../src/holon"
import { Dream, render } from "../src/dream"
import { Create } from "../src/verbs"
import { together } from "../src/anim"
import { bipolar, color, length, state } from "../src/params"
import { BLUE, PURPLE, WHITE } from "../src/constants"
import { Circle, Square } from "../src/parts/index"

/** The canonical shape, transcribed from MindVirus_canonical.py. */
class MindVirus extends Holon {
  fold = bipolar(0)
  tint = color(BLUE)
  size = length(100)

  eye = new Circle({ radius: this.size.times(0.2), tint: this.tint })
  cube = new Square({ size: this.size, tint: this.tint })

  override states = {
    idle: state({ fold: 1 }),
    hunting: state({ fold: 0.5 }),
    attached: state({ fold: -1 }),
  }

  thrustPulse(distance = 100) {
    return together(this.fold.sequence(1, 0.1, 1), this.z.by(-distance))
  }
}

describe("holon field scanning", () => {
  test("params and parts register by declaration", () => {
    const virus = new MindVirus()
    expect([...virus.params.keys()]).toContain("fold")
    expect([...virus.params.keys()]).toContain("x") // standard set present
    expect(virus.parts.length).toBe(2)
    expect(virus.eye.parent).toBe(virus)
    expect(virus.eye.root).toBe(virus)
  })

  test("constructor literals override defaults", () => {
    const virus = new MindVirus({ tint: PURPLE, size: 150 })
    expect(virus.tint.value).toEqual(PURPLE)
    expect(virus.size.value).toBe(150)
  })

  test("passing a Param binds by shared reference", () => {
    const whole = new MindVirus()
    const follower = new Circle({ radius: whole.size })
    expect(follower.radius).toBe(whole.size)
    whole.size.value = 42
    expect(follower.radius.value).toBe(42)
  })

  test("derived bindings: the part's param follows the whole's, live", () => {
    const virus = new MindVirus({ size: 200 })
    expect(virus.eye.radius.value).toBeCloseTo(40, 10)
    virus.size.value = 300
    expect(virus.eye.radius.value).toBeCloseTo(60, 10)
    expect(virus.eye.radius.isBound).toBe(true)
    // a bound param refuses direct writes — animate its source instead
    expect(() => {
      virus.eye.radius.value = 5
    }).toThrow(/follows a derived binding/)
  })

  test("unknown constructor options throw", () => {
    expect(() => new Circle({ radous: 5 }).params).toThrow(/unknown constructor option 'radous'/)
  })

  test("walk() yields the holarchy depth-first", () => {
    const virus = new MindVirus()
    const names = [...virus.walk()].map((h) => h.constructor.name)
    expect(names).toEqual(["MindVirus", "Circle", "Square"])
  })
})

describe("states and behaviors", () => {
  test("transitionTo animates the state's params", () => {
    class D extends Dream {
      virus = new MindVirus()
      unfold() {
        this.play(this.virus.transitionTo(this.virus.states.hunting), 0.5)
      }
    }
    const d = new D()
    const tl = d.build()
    expect(tl.valueAt(d.virus.fold, 0.5)).toBe(0.5)
  })

  test("behaviors return pure Anims usable across dreams", () => {
    const virus = new MindVirus()
    const pulse = virus.thrustPulse(200)
    expect(pulse.tracks.length).toBe(2)
  })
})

describe("the dream", () => {
  class MindVirusDream extends Dream {
    virus = new MindVirus({ tint: PURPLE })
    unfold() {
      this.play(Create(this.virus), 1.5)
      this.play(this.virus.thrustPulse(200), 1.2)
      this.play(this.virus.thrustPulse(200), 1.2)
      this.wait(1)
    }
  }

  test("unfold builds a pure timeline with correct duration", () => {
    const d = new MindVirusDream()
    expect(d.duration).toBeCloseTo(1.5 + 1.2 + 1.2 + 1, 10)
  })

  test("Create is holon-deep and honors the hold-first rule", () => {
    const d = new MindVirusDream()
    const tl = d.build()
    expect(tl.valueAt(d.virus.creation, 0)).toBe(0)
    expect(tl.valueAt(d.virus.eye.creation, 0)).toBe(0)
    expect(tl.valueAt(d.virus.creation, 1.5)).toBe(1)
  })

  test("thrust pulses accumulate z through the timeline", () => {
    const d = new MindVirusDream()
    const tl = d.build()
    expect(tl.valueAt(d.virus.z, 1.5 + 1.2)).toBeCloseTo(-200, 6)
    expect(tl.valueAt(d.virus.z, 1.5 + 2.4)).toBeCloseTo(-400, 6)
  })

  test("roots are discovered from played anims", () => {
    const d = new MindVirusDream()
    expect(d.roots.length).toBe(1)
    expect(d.roots[0]).toBe(d.virus)
  })

  test("render() dry-runs under bun", () => {
    const dream = render(MindVirusDream)
    expect(dream.duration).toBeGreaterThan(0)
  })

  test("applyAt writes live values for the whole holarchy", () => {
    const d = new MindVirusDream()
    d.applyAt(0)
    expect(d.virus.creation.value).toBe(0)
    d.applyAt(1.5)
    expect(d.virus.creation.value).toBe(1)
  })
})
