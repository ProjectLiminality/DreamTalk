/**
 * memoReads — a per-frame memo that stays transparent to READS.
 *
 * A memo keyed on `paramEpoch()` makes every reading that passes through it
 * OPAQUE to the host's READS tracking (params.ts), so a stroke built on it
 * is never skipped, though nothing it depends on moved. This is the recipe
 * certainty.ts's `seenOpacity` uses, as one function: answer once per
 * `quietEpoch()`, compute under `trackReads` (so its reads are listed,
 * nested memos replaying theirs), and replay them with `noteReads` on every
 * cached answer. Same values, same order of evaluation — byte-identical.
 */

import { noteReads, quietEpoch, trackReads, type Reads } from "./params"

export const memoReads = <T>(compute: () => T): (() => T) => {
  let at = -1
  let value: T
  let reads: Reads = { deps: [], opaque: false }
  return () => {
    const now = quietEpoch()
    if (now !== at) {
      const fresh: Reads = { deps: [], opaque: false }
      value = trackReads(fresh, compute)
      reads = fresh
      at = now
    }
    noteReads(reads.deps, reads.opaque)
    return value
  }
}
