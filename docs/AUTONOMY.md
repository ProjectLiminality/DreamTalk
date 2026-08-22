# AUTONOMY.md — The long-running work protocol (anti-slop constitution)

How Claude sessions apply compute to DreamTalk indefinitely WITHOUT
drifting into scope-slop. Every autonomous session (cron-spawned, /loop,
or plain) follows this protocol exactly. David's standing intent: use as
much compute as constructively possible; truly stop when nothing
meaningful remains.

## The fitness function (what "meaningful" means, mechanically)

Compute converts to value ONLY through these, in priority order:

1. **Corpus fidelity** — overlay match against the reference videos
   (refs/, CORPUS.md). This is external ground truth: you cannot slop
   your way to a better overlay of the 2021 original. When in doubt,
   work that moves a reproduction forward wins.
2. **PLAN.md deliverables** — a chapter's listed deliverables with their
   definitions of done, tagged AUTONOMOUS (or the AUTONOMOUS portion of
   a mixed chapter).
3. **Gates kept green** — tsc clean, `bun test` green, determinism holds,
   editor boots. A red gate preempts everything: fix-only session.

Anything not traceable to one of these three is OUT OF SCOPE for an
autonomous session. New ideas are welcome — as one-paragraph entries in
docs/PROPOSALS.md for David, never as unrequested code.

## Session shape (one loop iteration)

1. **Orient**: read TASTE.md → PLAN.md status ledger → DECISIONS.md →
   GATES.md → `git log --oneline -15`. Run the gates (tsc, tests).
2. **Pick ONE deliverable** — the highest-priority actionable item per
   the fitness function. One per session; finish it or record precisely
   where it stands.
3. **Build** — subagents encouraged (disjoint file ownership, agents
   don't commit, integrator verifies). The Chapter 9+ gauntlet runs as
   the dynamic Workflow per DECISIONS.md.
4. **Verify** — gates + self-evaluation (renders read with your own
   eyes; overlay comparisons for reproduction work). Claude evaluates
   BEFORE anything is presented to David (TASTE: The Editor).
5. **Commit** — granular, honest messages. Never rewrite history, never
   force-push, never touch `holons/*` history outside their own repos.
6. **Close** — update PLAN.md status markers; append any David-blocked
   item to GATES.md; append discoveries worth keeping to the right doc
   (never a new doc unless a chapter calls for it).

## Drift guards (the ratchet)

- **No refactor without a motivator**: a failing test, a measured
  benchmark gap, or a PLAN deliverable that requires it. "Cleaner" is
  not a motivator. Churn is the primary slop vector.
- **No new dependencies** without a one-line necessity note in the
  commit message.
- **UI work obeys TASTE "The Editor"** (Keynote vibe, red/blue/white
  flat palette, minimalist-as-meaningful). UI completeness grows by
  removing friction, not adding chrome.
- **Three-strikes rule**: if the same deliverable fails verification 3
  attempts in a row, STOP working it — write the blocker into PLAN.md
  and GATES.md and move to the next item (or stop the session). Never
  thrash.
- **Scope freeze**: autonomous sessions never edit TASTE.md (except
  appending to GATES.md-referenced proposals), never re-litigate
  DECISIONS.md, never change this file.

## Stop conditions (stopping is a success state)

A session ends IMMEDIATELY, with a clean summary, when:

- its one deliverable is done and verified, or
- nothing actionable remains: every remaining item is blocked on a
  TASTE/REVIEW gate → write GATES.md, notify David (PushNotification if
  available), and stop, or
- the three-strikes rule fired with nothing else actionable, or
- gates are red for reasons outside the session's power (e.g. toolchain).

**The standing-army rule**: if a session finds nothing actionable AND
the previous session's closing note in PLAN.md says the same, the
session must DISABLE the recurring schedule (CronDelete the
`dreamtalk-autonomy` job, or ScheduleWakeup `stop: true` in /loop mode),
say so in its summary, and leave a GATES.md entry telling David how to
re-enable (`create the cron again / run /loop`). Idling compute against
an empty backlog is the definition of slop.

## Checkpoints and the revert path

- Tag every TASTE-gate pass and chapter completion:
  `git tag checkpoint/<chapter-or-gate-name>` (annotated, one-line why).
- If David ever judges that quality drifted: `git log --oneline` +
  `git diff checkpoint/<last-good>` identifies the drift span;
  `git revert` (never reset on shared history) walks it back. Because
  sessions commit granularly and one-deliverable-per-session, the blast
  radius of any bad stretch is small and legible.

## The gate queue (docs/GATES.md)

Append-only queue of items awaiting David: TASTE decisions, REVIEW
sign-offs, render approvals — each with what's needed, links/paths to
evidence (renders, docs), and the PLAN chapter it unblocks. David
answers in chat or inline; sessions consume answered items into
DECISIONS.md. This is how autonomous work and David's async attention
meet without either blocking the other.
