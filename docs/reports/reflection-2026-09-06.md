# The reflection pass (EDITOR-V5 §6) — 2026-09-06 night

Measured, then judged. Boot/scrub probe (editor, headless):
s01 196ms/34ms · s08 215ms/29.5ms · thewall **13,894ms**/129ms ·
video01 342ms/**98.9ms** (boot/scrub-per-frame).

## Ranked: acting tonight

1. **TheWall-class boot (13.9s, of which bake is only 1.4s)** — ~12.5s
   is attaching 5,901 holons (proxy field-scans + THREE object
   creation). The editor's heaviest friction. Action: profile, land
   only PROVABLY-invisible wins (byte-identity gate).
2. **Timeline editing** — the v3 leftovers: drag a clip edge →
   setRunTime op; `,`/`.` frame-stepping. "Fine-tweak" made literal.
3. **First-render stale cap split** (polish finding #2) — the editor's
   first frame after mount draws the cylinder with a stale
   camera-relative split; the settle pass exists on the demo path only.
   A bug; fix.
4. **Player mode** (`?mode=player`) — LOOPS made visible: chromeless
   fullscreen stage, cutscene plays, pause→fly→hover-glow works, no
   creator tooling. The three loops become demonstrable.

## Recorded, not tonight

- **Editor undo stack** (cmd+Z across drag/capture/inspector) — the
  biggest missing UX primitive; file-level git is the only net today.
  Needs design (op inverses exist naturally: setOverride is its own
  inverse with the old literal). Queue for David's next editor batch.
- **video01 scrub at 99ms** — all ten chapters' roots mounted and
  hidden per frame; fine for now, folds into item 1's findings.
- **Cross-scene Magic Move** (ONTOLOGY) — next structural piece, not a
  night item.
- Cast/outline hover could show the holon's FACE (vocabulary/*.png now
  exists) as a tooltip — small delight, queued.
- Text ink cannot glow (text.ts owns its tint internally) — moot until
  a sovereign carries Text; noted.

## Item 1 findings — TheWall boot profiled and fixed (13.9s → ~1.9s)

The profile (headless demo host, phase-timed; ms):

| phase | before | after |
|---|---|---|
| dream ctor + timeline build | 1 | 1 |
| compose (5,901 holons, proxy scans) | ~34 | ~34 |
| cable bake (236 XPBD sims) | 1,483 | 1,484 |
| host attach (groups + ribbon geometry) | 119 | 103 |
| **first render** | **10,153** | **365** |
| boot total | ~11,850 | **1,944** |
| scrub /frame | 100 | 93 |

The 12.5s was NOT holon construction (34ms) and not attach (119ms) —
it was the FIRST RENDER. Root cause, pinned in the three r185 source:
`Node.customCacheKey()` returns `this.id`, so every node instance
hashes uniquely and two structurally identical materials can never
share a WebGPU NodeBuilder cache entry. TheWall's 4,720 strokes + 236
fills each carried their own material → 8,025 cache misses → 8,025
full WGSL codegen runs that deduplicated into just 3 programs and 5
pipelines downstream. ~10s of CPU to compile 3 shaders.

The fix (render/ribbon.ts, render/fill.ts): ONE shared RibbonMaterial /
fill material for all meshes; per-stroke width/drawn/erased/tint/fade
moved from per-material uniform nodes to OBJECT-updated `userData`
reference nodes reading each mesh's own userData (written only by
`RibbonStroke.style()` / `FillShape.style()`). Invisible by the
renderer's own contract: a material carrying nodes always refreshes
(NodeMaterialObserver.hasNode), reference nodes re-read per render
object with no per-frame dedupe, and each mesh binds its own cloned
uniform buffer, updated and uploaded object-by-object before its draw.
nodeBuilderCache: 8,025 entries → 5.

Gate evidence: 565 tests green, tsc clean, and byte-identity over 17
frames — gauntlet s04 6/6 (8 frames), wall-gauntlet --step 12 (7
frames), molocheye t=1/t=3 — every capture cmp-equal to the pre-change
baseline (capture determinism itself verified by double-capture first).

Side effect, larger than hoped: the same misses were most of SCRUB
cost wherever new strokes become visible mid-timeline. s01 scrub
33.8 → 2.8 ms/frame, video01 scrub 77.6 → 6.3 ms/frame (the reflection's
99ms item folds to nothing; all-chapters-mounted is fine). s01 boot
unchanged (~30ms).

What remains in TheWall, measured, for the ledger:
- **Cable bake 1.48s** — build-time, honest, already per ONTOLOGY.
  Could persist to disk keyed by (scene source hash, params) if it ever
  hurts; not tonight.
- **Scrub 93ms/frame** — profile: cable geometry resampling
  (toLocal/tubeFrom/state) + ~26ms/frame of holon.ts Proxy field-scan
  (`scan` 208ms + trap `get` 133ms over a 13-render run; Object.keys
  allocated on EVERY property read of every holon, forever). A
  `settled` flag set after complete()+compose would end scanning per
  holon — but it changes the Holon contract (a Param/Holon assigned to
  a NEW own property after first .params/.parts access would no longer
  register, where today it does), and with other agents live in the
  editor tonight that invariant is not provable from here. Queued: land
  it with a test pinning the contract, in a quiet window.
