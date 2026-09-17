# Voice-first comments on selections + the transform gizmo (David, 2026-09-17 eve)

PRIORITY build — David wants a working implementation to use immediately.
Replicate the genius of Claude Code's artifact comment mode, for DreamTalk.

## The vision
Claude Code artifacts let you enter comment mode, select HTML elements at any
level, attach comments, and Claude works them asynchronously in the background
while you keep commenting. DreamTalk already has select-to-inspect (single +
multi). Add: **any selection can carry a COMMENT, voice-first**, which becomes
context for Claude (the daemon → the operating agent) to make the change.

## The staged plan (validate each step before the next)
1. **[BUILD FIRST] Comment on a selection.** Select object(s) in creator mode →
   a comment affordance appears → attach a comment (TYPING works always; this is
   the validate-the-mechanism step). Confirm the comment persists against the
   selection. Mirror Claude Code's async feel: keep selecting/commenting while
   prior comments are handled. Minimalist, clear how to trigger, fits the
   DreamTalk aesthetic.
2. **[BUILD FIRST, same push] The transform gizmo.** A beautiful minimalist
   x/y/z transform UI on the selected object — default is VOICE (the mic is the
   primary affordance, "agentic-first"), but you can switch the gizmo to
   translate / rotate / scale for direct 3D manipulation. Voice and the
   transform tools sit in the SAME conceptual dimension: don't need voice to
   nudge something; can do anything with voice.
3. **The screenshot/render into context.** A comment auto-carries a rendered
   view of that selection into the chat/agent context — cleanest way, so Claude
   sees what's meant. Iterate through the DreamSong super-clearly.
4. **[NEXT] Voice transcription.** The mic button on a selection records voice,
   transcribed (ideally LOCALLY). Voice-first: always typeable, but mic is the
   love.
5. **[DEFERRED — do NOT build yet] Universal voice mode.** A session where you
   just talk continuously while selecting; each selection is an EVENT timed
   against the audio track + transcription, so you point at things as you speak
   and never consciously "make a comment." The real-time-voice endgame. David:
   leave unimplemented for now — wants to think it through before adding
   complexity.

## How Claude gets the context (the elegant path)
NOT "teach Claude Code to use DreamTalk inside an artifact." Instead: the
DreamTalk system lets you attach voice/typed notes to any selection, and the
daemon surfaces them (+ the rendered view) to the operating agent as context —
Claude already manipulates the scene via the daemon (ops.ts). Comments are just
richer, selection-anchored context flowing the same channel.

## Order of work
David: prioritize the EVENING message (this doc). Step 1 + step 2 are the
"working implementation" to have ready. Validate step 1 (add + confirm a comment
on a selection) before layering transcription. Look at how Claude Code artifacts
do comment mode and stay close to it; make the UI minimalist and obvious.

## Step 1+2 VALIDATION (2026-09-17) — full interactive UX, real DOM

Validated by driving the actual DOM headless (clicks, typing, pointer,
button clicks), asserting BEHAVIOR not HTTP codes. Harnesses tracked at
core/scripts/uxtest/.

**comments-gizmo.ux.ts — 16/16 PASS:**
- sections hidden with no selection; appear on selection (has-selection)
- composer = mic + textarea + Attach; gizmo = Voice/Move/Rotate/Scale
- type → Attach enables → comment lists → composer clears
- persists with FULL anchor: SelectionPath (root+indices+className),
  pathLabel, timeline t, screen bounds (the render hook), id, ts
- gizmo DEFAULTS to voice (agentic-first); move/rotate/scale each set
  the mode + expose 3 axis handles; active mode visually marked
- deselect hides both sections

**real-gestures.ux.ts — 4/4 PASS:**
- a REAL mouse click on the canvas selects + shows the panel
- the mic button focuses the text input (voice-first placeholder)
- clicking empty space deselects cleanly (no crash)
- a REAL click on the "Move" button activates move mode

No console errors. One test-harness quirk found + fixed (puppeteer
keyboard.type strips spaces headless — use dispatched input event); no
product bugs. The stored record (core/.comments/<scene>.jsonl) carries
everything the operating agent needs to work a comment: what, where
(path), when (t), and the exact pixel region (bounds) to render.

## Step 3 BUILT (2026-09-17) — the auto-render-into-context

`core/scripts/comment-view.ts`: the operating-agent tool that closes the
comment→context loop. A comment already stores scene + t + selection bounds,
so the rendered crop is a pure function of them. The tool renders the
CHROMELESS DEMO (ink only — the editor's marquee/gizmo live on an overlay, so
demo and editor paint identical pixels for the same t) at the comment's t and
crops to its bounds.

  bun scripts/comment-view.ts <scene>          # newest comment
  bun scripts/comment-view.ts <scene> <id>     # a specific one
  bun scripts/comment-view.ts <scene> --all    # each comment → its own png

It prints the agent's read-line — `[label @ t] "text" → file.png` — and writes
the crop to docs/reports/comments/. VALIDATED: a real editor-attached comment
on the s01 Cylinder rendered a crop showing exactly that cylinder's ink,
tightly framed. So the full loop is: point at an object → type/speak a note →
Claude gets the text AND a rendered image of precisely that ink.

Remaining: step 4 (voice transcription, local) and step 5 (universal voice
mode — deferred per David).
