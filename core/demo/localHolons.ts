/**
 * Local holons — scenes the player finds in this machine's own holon repos.
 *
 * `holons/` is gitignored: each holon there is its own local repo, and some
 * never leave the machine. A holon whose dreamtalk.json names a
 * `"scene": { "id", "export" }` (its entry exporting that Dream class) is
 * playable at `/demo/?scene=<id>` — but only in the player bundle, which
 * scripts/build-demo.ts builds with this module REPLACED by imports of
 * whatever such holons exist. The editor bundle (tracked) never sees them,
 * and a plain build sees this empty registry: nothing local can leak into
 * a tracked file.
 */

import type { DreamClass } from "../src/dream"

export const localScenes: Record<string, DreamClass> = {}
