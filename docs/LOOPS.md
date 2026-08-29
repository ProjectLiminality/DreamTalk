# LOOPS.md — The three loops (cutscene, game, creator)

David's transmission (2026-08-29). The UX telos of DreamSongs, and the
bridge from DreamTalk to InterBrain/DreamOS. Companion to ONTOLOGY.md;
enriched by recon of the DreamOS and InterBrain repos (see reports).

## The three loops

A DreamSong is experienced through three nested loops — the videogame
trinity, applied to knowledge. **The containment law (DreamOS
README:40): Creator ⊃ Game ⊃ Cutscene.** A cutscene is a constrained
game is a constrained creation session — removing constraints is always
possible; adding them is a creative choice. Cutscene is the innermost,
most constrained loop; creator is the outermost:

1. **Cutscene loop** — you just watch a video. The DreamSong plays as
   authored: pure timeline, authored camera, full screen. This is the
   default experience and demands nothing.
2. **Game loop** — you PAUSE, and the film becomes a world. Fly around
   the 3D scene (organic navigation); DreamTalk symbols are BUTTONS:
   they glow on hover and, clicked, travel you to that holon's
   standalone place. Pre-DreamOS this means: holons are hosted on
   GitHub Pages, and clicking a symbol navigates to its hosted page.
   The travel mechanism ALREADY EXISTS in InterBrain
   (github-publishing/dreamsong-standalone/main.tsx:52-77): a
   linkResolver keyed by source-DreamNode UUID resolving in strict
   priority githubPagesUrl → githubRepoUrl → Radicle → not clickable.
   DreamTalk's game loop adopts the same resolution priority.
   Pressing play interpolates the view back to the authored camera and
   the cutscene resumes. Full screen enforced.
3. **Creator loop** — you change the thing. Requires the engine
   (InterBrain / DreamTalk editor); downloading it seeds your
   DreamGarden with the DreamNode holding the DreamSong you saw. In
   the editor all three loops are available; creator tooling is
   visible only here.

Fullscreen is enforced for cutscene + game; the editor chrome exists
only in the creator loop. The player (cutscene+game, no tooling) and
the editor (all three) are therefore two presentations of one engine.

## The comment field that isn't

Beneath the player sits what LOOKS like a comment section — but it is a
prompt field. A "comment" that suggests any change to the DreamSong is
a PORTAL to the creator loop: it loads the prompt into the DreamTalk
agent (Claude Code with the DreamTalk skill) against your seeded copy
of the node, and the DreamSong changes. **You cannot passively share
your opinion; you can only actively act on it** — fork, transform,
and offer your unique perspective back to the world. Critique becomes
creation, structurally.

## Why the architecture is already most of the way there

This is the convergence worth recording: the editor work of 2026-08-24
built the game loop's substrate without naming it —

| Game-loop need | Existing mechanism |
|---|---|
| Pause → fly around | The live override layer on the Observer (flying camera, built) |
| Play → return to authored view | The ~0.4s eased interpolation back (built) |
| Symbols as buttons | Host picking (`pick()`) + the Selection store (built) |
| Glow on hover | A hover pass over the same raycast + a tint/bloom uniform (small) |
| Click → travel to the holon's place | The source anchor + manifest already know WHO a holon is; travel = navigate to its hosted URL (needs: a `home` field per sovereign holon) |
| Fullscreen player | A chromeless presentation of the same host (small) |
| The prompt-portal | The daemon's semantic-op pipeline IS the change-application machinery; the agent is Claude Code with the skill (Ch 13) |

Consequently: the **player is a strip-down, not a new build** — the
editor minus tooling plus fullscreen + hover-glow + travel. And the
creator loop's "seeding" is the clone of a DreamNode repo, which is
what the holarchic submodule pattern already describes.

## What this settles for current work

- Selection/hover must stay cheap and universal (every sovereign holon
  pickable) — game loop depends on the picking path staying healthy.
- Sovereign holons need a `home` (hosted URL) in their manifest face —
  one field, added when the repo-template gate (GATES #3c) is answered.
- The editor's presentation modes become explicit: `player` (cutscene+
  game) vs `creator` (everything). One flag, two chromes.
- GitHub Pages hosting of holons is the distribution story before
  DreamOS — aligns with local-first + publish-on-approval (DECISIONS).

## Provenance notes (from DreamOS/InterBrain recon, 2026-08-29)

- **Fullscreen rules and hover-glow affordances are NOT specified in
  DreamOS** — David's transmission defines them; DreamTalk is the
  origin of record.
- **"DreamGarden" and the comment-field-as-prompt are undocumented
  anywhere** — they exist only in David's speech and are original
  increments recorded here first. The comment-portal is the
  web-deployment instance of DreamOS's Event Bubbling universal
  fallback handler (README:42-48: an unhandled click on any symbol IS
  talking to the agent about that symbol; in creator mode all game
  handlers deactivate and every click becomes conversation-by-pointing).
- **DreamOS's renderer prose (Rust/wgpu/Vello) predates the TS
  decision** and is superseded by TASTE.md. Its two-mode appreciator/
  creator framing in TASTE is superseded by the three loops here —
  TASTE amendment queued for David's next pass.
- The .udd schema authority is InterBrain's dreamnode.ts:40-91;
  note `dreamTalk` is a SINGLE file path there while ONTOLOGY.md allows
  multiple symbols per node — schema change implied, unrecorded.

## Deliberately deferred (DreamOS territory)

Deep OS refactoring, CLI tooling, vault-wide node management, the full
DreamGarden lifecycle, richer in-scene interactivity than
button-clicking (the default interaction is CLICK; more comes later).
