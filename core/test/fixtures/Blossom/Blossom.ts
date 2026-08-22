/** Blossom.ts — fixture DreamWeaving. The import side-effect flag proves laziness. */
import { Holon } from "../../../src/holon"
import { completion, integer } from "../../../src/params"

;(globalThis as Record<string, unknown>).__blossomImported = true

export class Blossom extends Holon {
  petals = integer(5)
  bloom = completion(0)

  constructor(overrides = {}) {
    super(overrides)
    ;(globalThis as Record<string, unknown>).__blossomConstructed = true
  }
}
