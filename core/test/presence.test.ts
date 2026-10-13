import { expect, test } from "bun:test"
import { certainty, ghost, presence, seenOpacity } from "../src/certainty"
import { Circle, Group } from "../src/parts/primitives"

class Picture extends Group {
  presence = presence(1)
}
class Ghostly extends Group {
  certainty = certainty(0.5)
}

test("presence inherits as a product and multiplies a leaf's own fade — no ghost floor", () => {
  const leaf = new Circle({ opacity: 0.8 })
  const inner = new Picture({ members: [leaf] })
  const outer = new Picture({ members: [inner] })
  inner.presence.value = 0.5
  outer.presence.value = 0.5
  expect(seenOpacity(leaf).value).toBeCloseTo(0.8 * 0.25, 12)
  outer.presence.value = 0
  expect(seenOpacity(leaf).value).toBe(0)
})

test("presence and certainty compose", () => {
  const leaf = new Circle()
  const g = new Ghostly({ members: [leaf] })
  const p = new Picture({ members: [g] })
  p.presence.value = 0.5
  expect(seenOpacity(leaf).value).toBeCloseTo(0.5 * ghost(0.5), 12)
})

test("no presence and no certainty: the leaf's own opacity param, untouched", () => {
  const leaf = new Circle()
  new Group({ members: [leaf] })
  expect(seenOpacity(leaf)).toBe(leaf.opacity)
})
