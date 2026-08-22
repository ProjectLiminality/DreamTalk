# PARAMETERS.md — The parameter system and promotion protocol

Chapter 5's contract: how degrees of freedom are declared, bound,
animated, promoted, and exposed. This document is written for humans and
LLM agents equally — an agent following it can wire a "happiness slider"
without reading framework source.

## The layers

1. **Declaration** (Kairos, in the holon class): `fold = bipolar(0)`.
   A param is a runtime value with semantic kind, range, default, and
   identity. Every holon additionally carries the standard set
   (`x y z h p b scale creation opacity`) plus scene time `t` implicitly
   (TASTE law).
2. **Binding** (composition): pass the param (`fold: this.fold`) for
   identity binding; pass a derived reading (`this.size.times(0.2)`) for
   expressions. Data flows downward — the whole owns what its parts
   follow. A bound param is read-only from outside (writes throw).
3. **Animation** (Kronos): params animate themselves — `p.to(v)`,
   `p.by(dv)`, `p.sequence(...)` — producing pure Anims placed by
   `play()` into the pure timeline, evaluated as f(t).
4. **Live tweak** (the editor): writing `param.value` directly. Ephemeral
   by definition — the next `timeline.apply(t)` overwrites animated
   params, and a file reload rebuilds everything. Persistence happens
   only through the promotion/commit path below.

## Promotion: what it means

A holon has many internal degrees of freedom; **promotion is the explicit
act of making one part of a holon's public face.** Per TASTE: unrequested
internals stay hidden; the editor shows only the meaningful minimal set.

Promotion has exactly three surfaces, kept consistent:

1. **In code** — a param declared as a class field on the holon IS
   promoted for that holon (declaration is registration). A part's param
   consumed by a whole must be reached through binding at construction,
   never by grabbing `part.someParam` from outside (the loader will
   enforce this when manifests land).
2. **In the manifest** — the repo-level `params` list mirrors the entry
   holon's declared params (name, kind, default, range). This is the face
   other repos and the Coherence-Beacon-era tooling read without
   executing code. Generated from code; hand-editable; conflicts resolve
   toward code (code is the behavioral truth; the manifest is its face).
3. **In the editor** — the panel shows exactly: declared params of each
   holon + standard params the timeline animates. Nothing else. Bound
   params render read-only with their source visible.

## The agent-driven flow ("give me a happiness slider")

The request names a *meaning*, not a wire. The agent:

1. Decides the mapping — which internal params, with what curves,
   express "happiness" (e.g. `mouthCurve.map(...)`, `eyeOpen.times(...)`).
2. Adds `happiness = bipolar(0)` to the holon class and rewires the
   affected parts' constructions to derived bindings off it.
3. The manifest face regenerates; the editor panel now shows exactly one
   new slider.
4. Un-promoted internals that the mapping consumed disappear from the
   face if they were only ever intermediate.

The protocol's invariant: **after any promotion, the three surfaces
agree**, and the diff shows one new class field plus rewired bindings —
reviewable in one glance.

## Commit semantics in the editor (with EDITOR.md)

- Slider drag → live value only (60 fps, no file writes), visually
  marked as diverged.
- Release/commit → one semantic op (`setOverride`) rewriting the literal
  at the holon's construction site (or the class default, when the tweak
  targets the class rather than an instance — the editor offers instance
  by default; class-default commit is an explicit secondary action).
- The loop closes through the file (watch → rebuild → remount), clearing
  the divergence mark. There is no hidden editor-side persistence, ever.

## Keyframing a param over t

`play(p.to(v), seconds)` is the primitive. The editor's timeline edits
literals in existing `play` lines (EDITOR.md v3); inserting new clips is
statement insertion in `unfold()`. Easing: `smooth` default, `linear`
opt-in; richer easing vocabulary arrives when a corpus scene demands it
(gardening rule — no speculative easing zoo).

## Rules (enforceable, and to be enforced)

1. No reaching into unexposed internals: a whole may bind only params
   passed at its parts' construction. (Loader enforcement lands with the
   manifest chapter.)
2. A bound param rejects writes and rejects direct animation — animate
   its source.
3. `creation` and `opacity` are orthogonal: draw-on state vs. fade state.
   Verbs (`Create`, `FadeIn`) are the canonical way to touch them.
4. Semantic kinds are honest: a bounded concept is `bipolar`/`completion`
   with real min/max — never `scalar` with a comment.
5. The editor never shows a param the protocol doesn't expose. If a debug
   view is ever needed, it is explicitly labeled and off by default.
