# Inputs — the InterBrain DreamSong

What this DreamSong was reverse-engineered from (2026-10-18). The production
folder (Keynote deck, Manim code, Cinema 4D projects) is lost, so the film
itself is the input. Large media stay in the gitignored `refs/interbrain/`
and are referenced here, not copied.

| Input | Where | What it fed |
|---|---|---|
| The film, "The InterBrain – How Collective DreamWeaving Can Heal the World" (YouTube `v5dBRmjF8mc`, 2025-05-29, 1080p, 2835 s), with its description and chapter list | `refs/interbrain/IB14_InterBrain.mkv`, `.info.json`, `.description` | everything: `film.ts` chapter windows, every beat |
| 5 fps frames (14,174) and the motion scan | `refs/interbrain/frames5/`, `refs/interbrain/analysis/scan.json` | every symbol's geometry and every beat's time; the `*-compare` sheets in `docs/reports/interbrain/` |
| David's narration, transcribed (whisper large-v3-turbo) | `refs/interbrain/transcript/` | the concept definitions (report §4), `narration.ts` |
| The soundtrack | `refs/interbrain/audio.m4a` | the narration lines in the voice cache (`import-narration.ts`) |
| The Final Cut edit, read from copies | `refs/interbrain/fcp/` (from `~/Movies/ProjectLiminality.fcpbundle/InterBrain/`) | the production's anatomy and the 72 pickup takes (report amendment) |
| David's 2024 ancestor DreamNodes (local, read-only): DomesticatedMind, MolochConsciousness, ThirdAttractor, SocialPolarization | a local DreamNode collection (report §8b) | the names DomesticatedMind / MolochConsciousness; the bust in the cube; the mind in the triangle |
| The InterBrain app face as it was on 2025-04-06 (`InterBrain.png`, `InterBrainLogo300.png`) | iCloud Unclutter | the composition of our own `vocabulary/InterBrain` face (Logo in a crystal), not its third-party silhouette |

The ground truth for what each concept means is the narration; for what
each symbol looks like, the frames. See `docs/reports/interbrain-vocabulary.md`.
