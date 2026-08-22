# ANALYSIS.md — Resolving the TASTE.md open questions

Status: **RESOLVED — signed off by David 2026-08-22.** Verdicts recorded in
docs/DECISIONS.md; this file is the rationale record. Note: Q1's original
recommendation (weaving vocabulary) was **rejected** by David in favor of
plain holonic whole/part language — see the Q1 verdict below.

---

## Q1 — Composition terminology

**The question**: what language does the framework use for "holon A is built
from holons B and C"? Candidates: genealogical (parents birth a child),
scene-graph containment (parent/child nodes), weaving (strands → weave).

### Trade-offs

| Framing | For | Against |
|---|---|---|
| **Genealogical** (parents → child) | Matches the Coherence Beacon social story: a new creation is offered to those holding its "parents". Emotionally alive. | Genealogy forbids cycles — you cannot be your own ancestor — but TASTE.md makes circular references *legal* via lazy resolution. Also "parent/child" in scene-graph engineering means the **opposite** direction (parent contains child), guaranteeing permanent confusion. |
| **Containment** (scene-graph parent/child) | Familiar to every graphics engineer; maps 1:1 to Three.js `Object3D` hierarchy and the transform hierarchy in the manifest. | Presupposes a strict tree — silently answers the still-open tree-vs-rootless-graph question the wrong way. A holon used in two compositions is "contained" in neither. Bureaucratic flavor (the Finder metaphor TASTE rejects). |
| **Weaving** (strands → weave) | Already the ontology: Dream**Weaving**, Dream**Song**, the 2025 canonical definition ("DreamNodes woven into larger wholes"). A strand can appear in many weaves; a weave can serve as a strand in a larger weave — this models shared use and recursion *natively*, and is agnostic on tree-vs-graph. | Unfamiliar as engineering vocabulary; contributors and LLMs need a glossary. Doesn't by itself name the *transform* hierarchy inside one scene. |

### VERDICT (David, 2026-08-22): **holonic whole/part language**

Weaving-as-schema-vocabulary was rejected (taste call). The settled
terminology is the holon vocabulary itself:

- **Between repos**: every holon is simultaneously a whole and a part —
  the manifest field listing the holons a composition draws in is
  **`parts`**. The old pydeation grammar already said `specify_parts()`,
  and CLAUDE.md's sovereign-symbol structure already describes submodules
  as "other sovereign symbols as parts". Zero new metaphor; nobody
  misreads it.
- **Within one scene**: plain scene-graph terms (`children`, transforms) —
  there it *is* a containment tree and pretending otherwise costs clarity.
- **DreamWeaving / DreamSong remain product-level names** (the act and the
  artifact, culturally), just not schema words. Genealogical language stays
  at the social layer (Coherence Beacon).

This resolves the standing tree-vs-rootless-graph problem the same way the
weaving proposal did: **part-of is a rootless associative graph** (a part
can belong to many wholes; cycles legal via lazy resolution), while **each
scene's transform hierarchy is a tree**. Kairos = the part graph; a
manifest = one tree-shaped reading of it.

---

## Q2 — SDF role

**The question**: are signed distance fields the *native* geometry primitive
(field-first, raymarched), or is the framework mesh-first with SDFs as a
technique for CSG, benchmarks, and silhouettes?

### Trade-offs

**Field-first** —
For: analytically perfect surfaces (the platonic ideal, literally); free
smooth CSG and morphing/blending; resolution-independent crispness; elegant
2D/3D unity (a 2D SDF is just a 3D SDF evaluated on a plane).
Against: **it breaks the baked-geometry paradigm**, which is the load-bearing
architectural decision — baking means time-sampled *vertex data*; a raymarched
field has no vertices to bake. It also fights the entire mesh pipeline:
troika/text (quads), glTF export, Line2-style stroke ribbons, Three.js curve
classes, and the GPU instancing story. Raymarching whole scenes is a second
renderer in disguise. And DreamTalk's aesthetic is **strokes**, not surfaces —
SDF raymarching excels at exactly the shaded-blobby look TASTE rejects.

**Mesh-first with SDF as technique** —
For: everything composes with the settled stack; baking works; strokes are
first-class (curves → GPU ribbon expansion); silhouettes for parametric
primitives can still be *analytic* (HISTORY approach 4 — the cylinder's
silhouette is computable in closed form, which is an SDF-adjacent trick, not a
scene representation). SDFs appear where they are strongest: **inside TSL
shaders** — distance-based anti-aliased stroke rendering, dash/draw-on
parameterization, glyph rendering (troika's atlases *are* SDFs), and optional
build-time CSG on primitives.
Against: no free-form field blending (metaball-style morphs); CSG is a
build-time operation rather than a live parameter; truly analytic silhouettes
only exist for parametric primitives, so arbitrary meshes still need the
compute-shader edge-extraction path.

### Recommendation: **mesh-first; SDF as a shader-level technique in exactly three places**

1. **Stroke/2D rendering in TSL** — distance functions give the crisp,
   resolution-independent line quality the aesthetic demands.
2. **Analytic silhouettes for parametric primitives** (circle, square,
   cylinder, sphere…) — closed-form view-dependent outlines; the general
   mesh case uses compute-shader edge extraction (HISTORY approaches 2/3).
3. **Build-time CSG** on primitives, where a construction calls for it.

Morphing stays in parameter space (spline-to-spline `Morph`, per the
pydeation grammar) rather than field space — that is what "the source code IS
the thing" means: a morph between two *constructions*, not two blobs.

**Would change the recommendation**: if the video-01 gauntlet or a T2 video
turns out to depend on field-blending effects that parameter-space morphing
cannot express cleanly (none visible in the corpus so far).

---

## Q3 — Host coupling

**The question**: is the core a pure vanilla-Three library with thin adapters
(Obsidian / R3F / Claude Design), or R3F-native?

### Trade-offs

**R3F-native** —
For: the InterBrain Obsidian plugin already lives in R3F; drei/ecosystem
conveniences; declarative JSX scene description is pleasant for humans.
Against: couples the *framework* to React's render loop and lifecycle;
`useFrame` assumes R3F owns the clock, directly violating "the framework owns
t; hosts request it" (TASTE, law); JSX is a worse target than JSON manifests
for LLM generation and for git-diffable holons; and — decisive for this
project — the **video-01 reproduction gauntlet requires headless,
deterministic, frame-exact rendering** (render at t, compare to reference
frame, iterate). A React tree in a headless browser adds nothing but
nondeterminism and dependency weight to that loop.

**Vanilla core + thin adapters** —
For: the core owns renderer, scene, and the time authority; `advance(t)` /
`renderFrame(t)` are pure entry points, which makes the gauntlet loop and
CLI/SKILL-driven operation trivial; adapters stay small: an R3F adapter mounts
the core canvas via `<primitive>` with `frameloop="never"` and forwards host
events *requesting* time; an Obsidian adapter is a plain mount; Claude Design
gets the same contract (its Stage model conflict, flagged in HISTORY, is
solved by the same rule — the host asks, the framework advances).
Against: forgoes drei and R3F ecosystem components inside the core; adapter
maintenance is on us; declarative-JSX ergonomics lost (mitigated: the JSON
manifest *is* the declarative layer).

### Recommendation: **vanilla-Three core, framework owns t, thin adapters**

The core exposes a minimal host contract:
`mount(canvas)` · `advance(t | dt)` · `renderFrame(t)` (deterministic) ·
`dispose()` · parameter get/set. Hosts never tick the clock themselves; they
request time advancement. R3F, Obsidian, and Claude Design are all ~100-line
adapters over that contract. The gauntlet harness is just another host.

**Would change the recommendation**: nothing foreseeable — the headless
gauntlet requirement makes this near-forced. Revisit only if the Obsidian
adapter proves to need deep R3F integration that the contract can't express.

---

## ⚠ Flagged conflict with TASTE.md: troika-three-text under WebGPU

Recon (2026-08-22) verified the stack versions: **three 0.185.1** (r184+ line,
WebGPURenderer production-ready since r171, WebGPU universal in browsers since
late 2025 incl. Safari 26), **troika-three-text 0.52.5**. But: troika's
rendering path patches materials via `onBeforeCompile`, **which never runs
under WebGPURenderer** — known open issue; text renders as white squares.
TASTE.md mandates both troika and WebGPU-only TSL, which is currently
unsatisfiable as written.

Options:
(a) **Keep troika's layout/SDF-atlas core, replace its material patch with our
own TSL NodeMaterial** — troika's glyph generation is renderer-agnostic; only
the WebGL material shim breaks. Aligns with the one-language-TSL rule; we own
~1 shader.
(b) Switch to `three-text` (countertype, npm `three-text` 0.6.5) — built for
WebGPU/NodeMaterial, but alpha with a churning API.
(c) Render text via WebGL fallback — violates the single-renderer aesthetic
and architecture. Rejected.

**Recommendation: (a)**, with (b) as fallback if troika's atlas API resists.
**Proposed TASTE.md edit** (pending sign-off): change the text bullet to
"troika-three-text's glyph/layout engine for text, rendered through our own
TSL node material (troika's stock WebGL material path is incompatible with
WebGPURenderer)."

---

## Sign-off checklist (TASTE — David) — completed 2026-08-22

- [x] Q1: **whole/part** vocabulary (`parts` between repos; plain scene-graph
      terms within a scene; weaving/genealogy at the product/social layer) —
      and with it, tree-vs-rootless-graph resolved as "part graph is
      rootless; each scene's transform hierarchy is a tree"
- [x] Q2: mesh-first; SDFs only as TSL stroke technique, analytic primitive
      silhouettes, and build-time CSG
- [x] Q3: vanilla-Three core owning t; R3F/Obsidian/Claude-Design as thin
      adapters over `mount/advance/renderFrame`
- [x] Additionally signed off: new TS core lives in `core/` in this repo;
      Python library stays as C4D authoring backend until the gauntlet
      proves the core, then relocates to `legacy/`
- [x] Troika amendment applied to TASTE.md as proposed above (technical
      necessity; fallback `three-text` recorded)
