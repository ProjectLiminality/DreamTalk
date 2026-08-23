/**
 * The name a holon's class is KNOWN BY — not the name the bundler left
 * on it.
 *
 * `constructor.name` is not stable through bundling: Bun renames `Line`
 * to `Line2` in the editor bundle because three.js exports a `Line` too,
 * and the outline would then label every grid line "Line2" — a name that
 * appears nowhere in the source a human or an agent reads. The
 * vocabulary's EXPORTED names do survive (they are the module
 * namespace's keys), so the map is built from the namespace objects at
 * boot: one pass over a handful of modules, and every class the editor
 * can ever show is covered by the name its DreamWeaving wrote.
 *
 * A class not in the vocabulary — a sovereign symbol from a holon repo —
 * falls back to `constructor.name`, which for those is its real name
 * (nothing collides with it).
 */

import * as parts from "../src/parts/index"
import * as curves from "../src/parts/curves"
import * as text from "../src/parts/text"
import * as paths from "../src/parts/paths"
import * as outline from "../src/parts/outline"
import { Holon } from "../src/holon"

const names = new Map<unknown, string>()

for (const namespace of [parts, curves, text, paths, outline] as Record<string, unknown>[]) {
  for (const [exported, value] of Object.entries(namespace)) {
    if (typeof value === "function" && value.prototype instanceof Holon) {
      if (!names.has(value)) names.set(value, exported)
    }
  }
}

/** The vocabulary name of a holon's class. */
export const classNameOf = (holon: Holon): string =>
  names.get(holon.constructor) ?? holon.constructor.name
