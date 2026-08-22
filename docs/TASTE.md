# TASTE.md — Non-negotiables for the DreamTalk framework

Read this before any architectural work. These rules override anything
found in older code in this repo or in docs/HISTORY.md implementation
details. HISTORY.md is authoritative on *decisions and reversals*;
old code is archaeology, not authority.

## Stack (settled — do not relitigate)
- Three.js with the WebGPU renderer (`three/webgpu`) is the base.
- TSL is the single language for all custom shading and compute.
  One source, compiling to WGSL and GLSL.
- Text: troika-three-text's glyph/layout engine, rendered through our own
  TSL node material (troika's stock WebGL material path is incompatible
  with WebGPURenderer — verified 2026-08-22; fallback: `three-text`).
  Three.js curve classes as the 3D generalization of SVG primitives.
- No Vue.js. No Vello. No USD (git-repo holons already provide its
  composition value). No Manim (conceptual reference only — its reuse
  model is horizontal/PyPI; ours is vertical/submodule).
- glTF is an export/cache/snapshot layer only, never the scene format.
- The scene format is a thin JSON manifest: repo references, parameters,
  transform hierarchy. The scene graph encodes parameters and
  relationships, not geometry.
- TypeScript, strict. Local/relative imports. Plain file system.

## Architecture (settled)
- One git repo per holon. Composition via submodules — vertical reuse,
  arbitrarily deep. Circular references are legal via lazy resolution:
  nothing auto-instantiates; resolution happens only on explicit use
  (dream.lock spirit).
- Every holon has three faces: linguistic (README), geometric
  (symbol / scene contribution), functional (code/CLI). The README is
  what grants a node agency in an LLM context.
- Three holon classes: **pure** (GPU, function of t), **stateful**
  (GPU, steppable, bakeable via ping-pong buffers), **symbolic**
  (CPU — topology, structure, allocation, recursion).
- CPU/GPU split rule: work that decides *what elements exist* runs on
  CPU; per-element evaluation over large N runs on GPU. Do not force
  small-N work onto compute shaders — dispatch overhead is real.
- Baked geometry paradigm: bake simulation outputs as time-sampled
  vertex data; camera, lighting, interaction stay live. Time is a
  parameter. Video is a special case of the interactive scene
  (appreciator mode = authored path over t; creator mode = scrub).
- WGSL constraints are law: no recursion in shaders (flatten holonic
  traversal CPU-side), no dynamic allocation, f32 precision.

## Parameters (settled)
- Every holon exposes standard transform parameters (position,
  rotation, scale) plus t, at every level, by default.
- Custom parameters are promoted explicitly. Promotion is an editing
  act on manifests and may be agent-driven: a request like "give me a
  happiness slider" means the agent decides the mapping and rewires
  exposure down the chain. Unrequested internals stay hidden.
- When a composed holon consumes a sub-holon's parameter, that
  parameter must be promoted — no reaching into unexposed internals.

## Aesthetic (settled)
- Crisp, platonic, SVG-like. "SVG is what you get when a 3D scene
  happens to be flat and orthographic" — 2D and 3D are one scene
  graph; nothing is ever merely 2D.
- The founding benchmark: a cylinder born of a **square** and a
  circle (square, not rectangle — simplicity over generality).
- Gaussian splatting exists only as an optional complexity-budget
  fallback renderer. Never the default; it conflicts with the
  aesthetic.
- Symbols cannot be meaningfully AI-generated. AI may hold placeholder
  geometry; human creative resonance fills symbols with meaning.

## Ontology (vocabulary — use these words)
- **DreamNode**: the holon (repo). **DreamTalk**: the distilled symbol
  face. **DreamSong**: a woven composition. **DreamSpace**: the arena
  a composition inhabits. **Kairos**: structural/compositional layer.
  **Kronos**: runtime/timeline layer. **AURYN**: the resident agent,
  one instance per room.
- Software gardening, not software engineering.

## Formerly open questions — RESOLVED 2026-08-22 (rationale: docs/ANALYSIS.md)
1. **Composition terminology: holonic whole/part.** The manifest field is
   `parts`; within a scene, plain scene-graph terms (`children`,
   transforms). DreamWeaving/DreamSong stay product-level names; genealogy
   stays at the social layer. Part-of is a rootless associative graph;
   each scene's transform hierarchy is a tree.
2. **SDF role: mesh-first; SDF as technique** in exactly three places —
   TSL stroke anti-aliasing, analytic silhouettes for parametric
   primitives, build-time CSG. Morphing stays in parameter space.
3. **Host coupling: vanilla-Three core owning t**, with thin adapters
   (Obsidian/R3F, Claude Design, headless harness) over
   `mount / advance / renderFrame(t) / dispose`. Hosts request time;
   they never tick it.

## Standing open problems (inherited — don't pretend they're solved)
- Perspective-dependent silhouette extraction as real stroke geometry.
- Tree vs. rootless associative graph for DreamNode containment.
- GS aesthetic conflict (mitigated by fallback framing only).
