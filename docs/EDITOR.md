# EDITOR.md — The bidirectional editor architecture

The grounded design for TASTE "The Editor": UI gestures write the scene
source; source edits update the UI live; the AI writes code and the human
tweaks parameters in the expanded sense. This document is the deep
thinking demanded before building — every mechanism here is chosen for
robustness and performance, not elegance of concept.

## Principles

1. **The file is the only truth.** The DreamWeaving `.ts` (plus, later,
   the repo manifest) is the single source of state. The editor holds
   nothing persistent — everything it shows is derivable from files plus
   transient transport state (current t, playing, panel scroll).
2. **Constrained forms make robust edits possible.** SYNTAX-TS.md's
   machine-editability rules are load-bearing: one temporal statement per
   line, literals inline, no metaprogramming in Dreams. The editor never
   parses arbitrary code — it edits recognized forms.
3. **Two directions, two different mechanisms.** Code→UI is *rebuild and
   remount*; UI→code is *semantic operations on the AST*. They are
   asymmetric on purpose: reading code is cheap and total, writing code
   must be surgical and minimal.

## Code → UI (watch, rebuild, remount)

- A Bun daemon watches the DreamWeaving files (`fs.watch`, debounced
  ~50 ms), rebuilds the scene bundle (`Bun.build`, incremental — budget
  <150 ms for a scene file), and pushes a `reload` event over WebSocket.
- The browser editor re-imports the module (cache-busted), rebuilds the
  Dream, diffs nothing — it simply **remounts the scene while preserving
  transport state**: current t, play/pause, backdrop UI settings that
  didn't come from code. Timeline length, clip marks, and the param panel
  re-derive from the fresh Dream. Target: keystroke-to-pixels < 250 ms.
- Remount instead of patching is a deliberate v1 choice: the pure-f(t)
  architecture makes remounting *correct by construction* (no accumulated
  state to lose), so we take the simple path and optimize only if the
  editor ever hosts scenes whose build exceeds the budget.

## UI → Code (semantic operations, not text edits)

Every editing gesture maps to a **semantic op** — a small, typed intent:

| Gesture | Op | AST effect |
|---|---|---|
| Drop video/image on viewport | `setBackdrop(path, offset?)` | Insert or update the `this.backdrop("…", {…})` statement at the top of `unfold()` |
| Change backdrop offset/mode field | `setBackdrop` (partial) | Rewrite the options literal |
| Commit a param slider (release) | `setOverride(holon, name, value)` | Rewrite the literal in that holon's construction `{…}` (add the property if absent) |
| Drag a clip edge in the timeline | `setRunTime(clip, seconds)` | Rewrite the seconds literal in that `this.play(…, s)` call |
| (later) Reorder/insert clips | `movePlay/insertPlay` | Statement-level moves within `unfold()` |

Ops are executed by an AST service in the daemon (ts-morph over the TS
compiler API), which rewrites **only the targeted literal/statement** and
preserves all other formatting. The browser never edits text.

### Anchoring: how a live holon knows its source location

Order-based or name-based matching breaks under conditionals and
repetition, so anchoring is **mechanical, injected at build time**: the
daemon's build runs a small transform over DreamWeaving files that wraps
every PascalCase construction and every `this.play(...)` /
`this.backdrop(...)` call:

```ts
__dt(new Square({ size: 200 }), "FoundingSmoke.ts:214:241")
```

`__dt` attaches `{file, span}` to Holon instances and clip records (and
is a passthrough for anything else). Every scene object therefore carries
the exact byte-span of the expression that created it — the op targets
that span, and the AST service re-locates the node from the span (with a
structural sanity check: the node at that span must still be the expected
form; if not, see conflicts below). No heuristics anywhere.

## The live layer vs. the persisted layer

Dragging a slider must feel like 60 fps and MUST NOT write files at 60 Hz:

- **During a gesture**: the value is written to the in-memory Param only
  (exactly what v0 does today). The UI marks the value as *diverged*
  (accent styling) — the file does not yet agree.
- **On gesture end** (pointer-up, or 300 ms idle for typed input): one
  semantic op commits the literal. The file save triggers the watcher,
  the scene remounts, and the diverged marking clears — the loop closes
  through the file, proving the round-trip on every single tweak.
- Escape / "revert" during a gesture drops the live override; nothing was
  ever written.

This split is what makes bidirectionality *robust*: there is never a
moment where UI state and file state can drift silently — divergence is
explicit, transient, and visually marked.

## Echo-loop prevention and conflicts

- Every daemon-originated write records the SHA-256 of the content it
  wrote. The watcher ignores exactly one subsequent event matching that
  hash (self-echo); everything else is an external edit and triggers
  reload. Editor-originated changes therefore loop through the same
  reload path as human edits — one code path, no special cases.
- Before applying an op, the AST service verifies the target file's hash
  against the hash the browser last loaded (sent with the op). On
  mismatch (the AI or David edited meanwhile): re-parse, re-locate the
  anchor **by span-then-structure** (spans shift → fall back to matching
  the unique constrained form within the same enclosing declaration), 
  apply, save. If the anchor no longer exists, the op is rejected with a
  reason and the UI un-diverges by reloading — never a silent overwrite,
  never a modal. Semantic ops are naturally rebasable because they carry
  intent, not text positions alone.
- Writes are atomic (write temp + rename), serialized through one queue
  in the daemon.

## Parameter exposure (the minimal meaningful set)

The panel shows, per holon: its **declared params** (the class's own
degrees of freedom) and any standard param **the timeline animates**.
Standard params that are neither animated nor declared stay hidden —
TASTE's "no parameter dumps" as a mechanical rule, aligned with the
promotion protocol (Ch 5): what is promoted is exactly what is shown.
Bound params render as read-only with their binding expression.

## Backdrop and the mp4 timeline sync

`this.backdrop(path, { offset })` is scene code — so reference choice
travels with the DreamWeaving repo (the evaluation setup is itself
reproducible). The video element syncs by `currentTime = t + offset` when
paused/scrubbed and by drift-corrected `play()` during playback (resync
at >80 ms drift, matching v0). Frame-stepping UI (,/. keys) steps t by
1/30 s for frame-exact overlay reads.

## Tauri

The daemon is plain Bun (fs + WebSocket + static serve) and the front end
is a static bundle — Tauri packaging replaces the daemon's transport with
the same protocol over Tauri IPC and gains native fs dialogs. Nothing in
this design assumes a browser-only or Tauri-only capability; the spike
(PLAN Ch 7 deliverable 5) validates the fs.watch + IPC path.

## Build order

1. **v1 — the loop exists**: daemon (watch/build/WS/reload) +
   `setBackdrop` op end-to-end (drop file → code line appears → watcher
   reloads → UI reflects code). One op proves the whole architecture.
2. **v2 — params**: live/persisted split with divergence marking +
   `setOverride` commits.
3. **v3 — timeline**: `setRunTime` via clip-edge drag; frame-stepping.
4. **v4 — polish**: multi-scene registry, Tauri spike, overlay presets.
