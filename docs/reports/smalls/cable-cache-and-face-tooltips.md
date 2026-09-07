# Cable-bake disk cache + face tooltips

Session report. Two ledgered smalls. No commits (per instructions).

## ITEM 1 — Cable-bake disk cache

**Status: DONE — layer built, wired, measured, all identity gates passing.**
(Wiring into the two vocabulary files was granted by the lead mid-session after
escalation.)

### Headline

| | cold | warm |
|---|---|---|
| bake (bun, 236 sims) | 2463 ms | **77 ms** |
| demo boot (real browser, via daemon) | 5394 ms | **2104 ms** |
| cache hits | 0/236 | **236/236** |

Byte-identity holds everywhere it was asked to:

- **cold-with-wiring == pre-change baseline** — PASS (fingerprint of all 236
  cables' samples + completions, captured by stashing the wiring)
- **warm == cold** — PASS (same fingerprint)
- **rendered frame t=8.0, cold vs warm** — `cmp`-equal
- **wall-gauntlet `--step 12`, all 28 frames** — `cmp`-equal, 0 differing
- **derived `visible[]` == accumulated `visible[]`** — 118,236 comparisons across
  236 cables, **0 mismatches** (condition 1: no finding, the derivation is exactly
  invisible)

### Design

`core/src/bake.ts` gains `bakeCached()` alongside the untouched `bake()`.
`core/src/bakecache.ts` (new) supplies the two transports.

**Hash inputs.** `bakeHash(key, fps, duration, width)` over canonical JSON of:

| input | why |
|---|---|
| `key` (caller-stated) | the sim's own inputs — config + tip-path samples |
| `fps`, `duration`, `width` | the bake's shape |
| `CACHE_VERSION` (module constant) | **our** math — bump on any solver change |

Object keys are sorted before hashing so two callers building the same config in
different orders agree. Floats pass through unrounded: rounding would merge bakes
that genuinely differ. FNV-1a in four lanes → 128 bits, hex, usable as a filename.
This is a naming scheme, not a security hash; collision probability sits far below
the disk lying to us, and a collision that *did* land is caught by the shape check
on read rather than served.

**Why the caller states the key.** `bake()` receives a closure. It cannot inspect
the `tip` function, the settle parameters, or the journey, so it cannot derive
what makes one bake different from another. Guessing is the single way this layer
could *corrupt* a scene rather than merely fail to accelerate it — serving
creature A's tether for creature B. So: no key, no caching. Silence is the safe
default.

**Invalidation** is automatic (any changed input changes the hash) except for
solver changes, which leave every caller's key untouched while changing every
byte produced. That is what `CACHE_VERSION` covers, and it is the one manual step.

**Never a dependency.** Every path falls back to computing: a miss, an
unreachable daemon, a corrupt file, a truncated read, a cache that throws or
rejects, a stale version, a shape mismatch. A static `serve.ts` with no cache
endpoint boots the scene exactly as before, just slower. Verified, not asserted —
see the failure-mode tests.

**Storage format.** A 6×f64 header (magic, version, frames, width, fps, duration)
then the Float32 samples. Reads verify magic, version, integrality, the caller's
expected shape, and that the payload length exactly matches the declared shape —
which is what catches truncation. fs writes go to a temp name and rename, so a
process killed mid-write leaves no half-file.

### Measured (the real 236-sim TheWall bake)

    cable bake (236 sims):   2337 ms    29.8 MB, 236 tracks
    warm read + decode:        31 ms    <-- replaces the 2337 ms
    encode + store:         5 + 64 ms   (cold boot only)
    byte-identical:         236/236

**~2.3 s saved per boot** — better than the ~1.3 s the brief projected, because
the bake measures 2.34 s here, not 1.48 s. Byte-identity is 236/236 by
construction (the stored bytes *are* the computed bytes) and verified per-track
by direct Float32Array comparison.

### The key, stated in full (condition 3)

`bakeHash(key, fps, duration, width)` where `width = CABLE_PARTICLES × 3`, and
`key` is:

| field | what it pins |
|---|---|
| `holon: "TheWall.cable"` | namespace — another holon's bake cannot collide |
| `duration`, `fps` | the bake's span and rate |
| `brickSize` | the collision cube's edge |
| `slack` | rest length multiplier |
| `particles` | chain length |
| `anchor`, `anchorDir` | the fixed end and departure vector |
| `path` | **64 tip poses** across the span — position (3), direction (3), fold, scale, completion, travelled = 10 numbers each, 640 total |

Plus, folded in by `bakeHash` itself: `CACHE_VERSION` (the solver-version
constant — bump it when the XPBD math changes) and the bake's shape.

Sampling the tip path rather than hashing the closure is the honest move: a
function has no identity we can read, but its outputs do. 64 samples is a
judgement — dense enough that two distinct journeys cannot agree at every one,
cheap enough to compute 236 times.

### How it is wired (and why not the obvious way)

`compose()` is synchronous — a holon's parts must exist the moment anyone asks
for them — while a cache may be a fetch. Making composition async would put an
`await` between a scene and its own geometry. So instead:

- `TheWall.warmCables(cache)` resolves the tracks FIRST (async), leaving them
  where the synchronous bake will find them.
- `Cable.tether(..., prebaked?)` installs a given track instead of simulating.
- `unfoldCables()` consults the warmed tracks; anything absent it simulates
  exactly as before, then offers the result to the cache fire-and-forget.
- `demo/main.ts` calls `warmBakes(dream)` before mount — duck-typed on
  `warmCables`, so the boot has no business knowing which holons bake.

A scene that never calls `warmCables` behaves precisely as it did before.

### The bug that nearly shipped silently

The first wiring passed BOTH identity gates while hitting the cache **0/236
times**. It stored 236 files and matched none of them — and from the outside a
cache that never hits looks exactly like a cache that works.

Cause: `warmCables()` computes its keys *before* `compose()`, but `tipAt()` reads
`this.packing.rowLength` and falls back to `1` when the wall has not composed.
So the warm pass hashed a different growth wave than the bake did. One line fixes
it (`this.packing = packing` in `warmCables`, from the same pure `packSlots` call
`compose()` makes).

This is why the regression test asserts **the hit**, not merely the identity —
`test/bakecache.test.ts` "a warm boot HITS — not merely 'is identical'". I
confirmed the test genuinely catches it by removing the fix and watching it fail.

### Daemon endpoint

`GET/PUT /api/bake-cache/<hash>` — the browser cannot reach the filesystem, so
the daemon lends it one. Deliberately the dumbest possible blob store: the hash
is the name, the client computed it, and the bytes are not parsed here
(`decodeTrack` verifies its own header — validating twice lets the two drift).
Enforced: hash shape (so nothing addresses a path outside the cache dir) and a
64 MB ceiling. `.cache/` added to `.gitignore`.

Verified live: PUT 204 → GET 200 byte-identical; miss 404; bad hash 400;
traversal attempt 400; under `serve.ts` both routes 404.

## ITEM 2 — Face tooltips

**Status: done and verified.**

`core/editor/facetip.ts` (new) shows a holon's rendered face
(`core/vocabulary/<Name>/<Name>.png`, served as `GET /api/face/<Name>`) after
400 ms of hover, on cast chips and on sovereign outline rows. Primitives never
get one — a Line's 16px glyph is already the whole of what it looks like.

Keynote-calm: exactly one card exists, 90 ms fade, `pointer-events: none` so the
row underneath stays clickable, canonical palette (blue #00A2FF border and label
on `--panel` over black).

### One bug caught by looking rather than by asserting

My first placement put the card *beside* the anchor. On the **horizontal** cast
bar that covered the neighbouring chips (MolochEye half-hidden) — while my
occlusion check, which tested only the anchor, happily reported "no overlap". The
screenshot showed it immediately.

Fixed by making placement aware of the anchor's axis: the card steps off the
**short** axis — below a cast chip (siblings left/right), beside an outline row
(siblings above/below) — flipping when it would clip the window. The check now
tests the anchor *and every sibling*. Both surfaces now report "clears anchor and
all siblings".

The general lesson: "does not occlude" means not covering the anchor's
*neighbours*, not just the anchor.

### Verified

- Card loads the real 577×577 PNG, `pointer-events: none`, hides on leave.
- Delay is real: not shown at 150 ms, shown at 950 ms.
- Primitive rows (Arc/Line/Circle) get no card.
- Under static `serve.ts`: `/api/face` 404s, editor boots `ready=true`, no card,
  **zero** console errors, and exactly **one** request per class ever (the
  negative is remembered).

## Gates

| gate | result |
|---|---|
| `tsc --noEmit` | clean |
| `bun test` | **694 pass / 0 fail** across 40 files (661 baseline + 33 new) |
| S04 gauntlet | **6/6 PASS**, mean coverage ref=0.9946 ours=0.9954 (matches the recorded 0.996/0.993) |
| wall-gauntlet `--step 12` warm vs cold | **28/28 frames `cmp`-equal**, scores identical |

**On the wall gauntlet.** It reports 7/7 FAIL (mean coverage_ref=0.6623,
coverage_ours=0.3165, IoU=0.2302). These are **pre-existing and unrelated to this
work**: I stashed every one of my changes and re-ran it, and the numbers are
identical to the digit. Recorded here so the next session does not attribute them
to the cache or the tooltips. (A pristine-worktree comparison was attempted first
and abandoned — the demo cannot build outside the main checkout because `holons/`
is gitignored, local-first.)

**Also note:** `bun test` on the full tree currently shows 4 failures in
`test/svg.test.ts` — another agent's in-flight SVG path work, in files this
session does not own (`src/geometry/svg.ts`). Excluding that one file: 692/692.

## Files

Owned and changed by this session:

- `core/src/bake.ts` — additive cache layer (`bakeCached`, `bakeHash`,
  `encodeTrack`, `decodeTrack`, `CACHE_VERSION`); `bake()` itself untouched.
- `core/src/bakecache.ts` — new; `fsBakeCache`, `httpBakeCache`.
- `core/test/bakecache.test.ts` — new; 31 tests.
- `core/editor/facetip.ts` — new; the tooltip.
- `core/editor/cast.ts`, `core/editor/outline.ts` — one `attachFaceTip` call each.
- `core/editor/index.html` — `.facetip` styles.
- `core/scripts/daemon.ts` — two additive routes.
- `core/vocabulary/Cable/Cable.ts` — `tetherSim()` split out (completions derived
  purely), `tether()` takes an optional pre-baked track and returns what it
  computed.
- `core/vocabulary/TheWall/TheWall.ts` — `cableKey()`, `warmCables()`,
  `tetherOptions()`, cache consultation in `unfoldCables()`, `cableCacheHits`.
- `core/demo/main.ts` — `warmBakes()` before mount.
- `.gitignore` — `.cache/`.

### One operational note worth keeping

`core/demo/dist/main.js` is a **gitignored local build artifact that the daemon
does NOT rebuild** (it watches and rebuilds only `core/editor/dist`). A stale
demo bundle is what made my first browser measurement show no speedup at all —
the new boot code simply was not in the bundle being served. Anyone measuring
demo-side behaviour must `bun build demo/main.ts --outdir demo/dist --target
browser` first, or they will measure the previous build and believe it.

`core/editor/dist/main.js` also shows as modified: it is a checked-in build
artifact the daemon rebuilds on boot, not a hand edit.
