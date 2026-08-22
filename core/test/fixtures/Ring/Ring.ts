/** Ring.ts — fixture DreamWeaving; forms a legal cycle with Blossom. */
import { Holon } from "../../../src/holon"
import { length } from "../../../src/params"

;(globalThis as Record<string, unknown>).__ringImported = true

export class Ring extends Holon {
  radius = length(100)

  constructor(overrides = {}) {
    super(overrides)
    ;(globalThis as Record<string, unknown>).__ringConstructed = true
  }
}
