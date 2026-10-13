/**
 * build-demo.ts — the player bundle (demo/dist, gitignored), with local holons.
 *
 *   bun scripts/build-demo.ts      (= bun run build:demo)
 *
 * See scripts/local-holons.ts — the daemon's auto-rebuild uses the same.
 */

import { buildPlayer } from "./local-holons"

const { ok, scenes } = await buildPlayer()
if (!ok) process.exit(1)
console.log(`demo bundle built${scenes.length ? ` · local scenes: ${scenes.join(", ")}` : ""}`)
