# MANIFEST.md — The repo-level face of a DreamNode

`dreamtalk.json`, at the root of every sovereign symbol repo. Written for
humans and LLM agents equally: an agent that has read this file can read,
write, and resolve manifests without reading framework source.
Implementation: `core/src/manifest.ts`.

## Purpose

Every DreamNode has three faces (HISTORY: the monadic pattern) —
linguistic (README), geometric (the rendered symbol), functional (code).
The manifest is the **machine-readable index of the functional face**:
identity, the entry DreamWeaving, the holon repos this holon draws in
(`parts`), and the promoted parameter face. It is what another repo, the
editor, or an agent reads to know *what this holon is and offers* —
without executing any code.

The `.ts` DreamWeaving remains the behavioral source of truth
(SYNTAX-TS.md). The manifest is its face: thin, declarative, generated
where possible, hand-editable everywhere, and machine-editable by design
(EDITOR.md writes it).

## Why `dreamtalk.json`, not `.udd`

The prior art is the `.udd` file (DreamNode metadata: uuid, title, type,
submodule/supermodule pointers). The two stay **separate files** on
purpose:

- **Different owners.** `.udd` belongs to the DreamOS/InterBrain layer —
  social identity, coherence, genealogy. `dreamtalk.json` belongs to the
  DreamTalk framework — the behavioral contract. Genealogy stays at the
  social layer (TASTE, resolved Q1); merging them would couple the
  framework's loader to InterBrain's schema and vice versa.
- **Different reference semantics.** `.udd` `submodules` are git-level
  facts. Manifest `parts` are *aliased behavioral references* — an alias
  is how code and the editor name a part, and cycles are legal (the
  rootless part-of graph), which git submodules cannot express natively.
- **Visibility.** The manifest is a first-class face of the repo, not
  hidden housekeeping; a dotfile is the wrong register.

A repo that is a DreamNode carries both; neither duplicates the other's
fields.

## The shape

Complete annotated example (a MindVirus repo):

```jsonc
{
  // Schema version of THIS file format (not the repo's version).
  "manifest": 1,

  // PascalCase holon name. The entry module must export a class by
  // exactly this name (default export accepted as fallback).
  "name": "MindVirus",

  // Semver of the repo/holon itself.
  "version": "0.1.0",

  // Relative path to the DreamWeaving — the .ts file that contains the
  // Holon class (Kairos) and its canonical Dream (Kronos).
  "entry": "MindVirus.ts",

  // Optional: the rendered symbol face (the thumbnail test).
  "thumbnail": "MindVirus.png",

  // alias → part repo reference. Whole/part terminology is law.
  // Aliases are camelCase and are how code, the editor, and agents
  // name the part. Exactly one of "path" | "git" per reference.
  "parts": {
    "molochEye": { "path": "../MolochEye" },
    "foldableCube": { "git": "https://github.com/ProjectLiminality/FoldableCube", "rev": "a1b2c3d" }
  },

  // The promoted parameter face: mirrors the entry holon's DECLARED
  // params (PARAMETERS.md). Generated from code; hand-editable;
  // conflicts resolve toward code. Standard params (x y z h p b scale
  // creation opacity, t) are implicit and never listed.
  "params": [
    { "name": "fold", "kind": "bipolar", "default": 0, "min": -1, "max": 1 },
    { "name": "tint", "kind": "color", "default": {"r":0,"g":162,"b":255} },
    { "name": "eyeHeight", "kind": "length", "default": 35 }
  ]
}
```

Field reference:

| Field | Required | Meaning |
|---|---|---|
| `manifest` | yes | Schema version; currently `1`. Bump only on breaking shape changes. |
| `name` | yes | PascalCase holon/class name; also the export the loader looks up. |
| `version` | yes | Semver of the repo. |
| `entry` | yes | Relative `.ts` path exporting the holon class. |
| `thumbnail` | no | Relative path to the rendered face. |
| `parts` | yes (may be `{}`) | alias → `PartRef`. |
| `params` | no | Promoted-param declarations: `{name, kind, default?, min?, max?}`. `kind` ∈ scalar, length, angle, bipolar, completion, color, integer, bool. Color defaults are `{r,g,b}` (0–255). |

## Part references

Two forms, exactly one per reference:

- **Local path** — `{ "path": "../Circle" }`, resolved relative to the
  manifest's directory. The normal form during local-first development
  (DECISIONS 2026-08-22) and inside a workspace of sibling repos.
- **Git URL** — `{ "git": "https://…/Circle", "rev": "<commit-ish>" }`.
  The loader resolves a git reference to a directory in the
  **workspace**: `$DREAMTALK_WORKSPACE` if set, otherwise the parent
  directory of the referencing repo (siblings). The directory name is
  the URL's last path segment minus `.git`.

**The loader never fetches.** Fetching/cloning is a separate concern
(a fetch tool / the future dream.lock resolver); the loader only resolves
what is already on disk, and an unfetched git part fails with a message
saying exactly where to clone it. `rev` is recorded for reproducibility
but not verified by the loader — enforcement arrives with the lock layer.

## The resolution algorithm (lazy — dream.lock spirit)

Nothing auto-instantiates; resolution happens only on explicit use:

1. `loadManifest(dir)` reads **one JSON file** (`dir/dreamtalk.json`),
   validates it, and returns a `LoadedManifest`. No part is touched, no
   module imported, no holon constructed.
2. Loaded manifests are **identity-mapped by resolved absolute
   directory** (symlinks collapsed): loading the same repo twice returns
   the identical instance.
3. `loaded.part(alias)` returns a lazy `PartHandle` — pure path math,
   no file system access. Unknown aliases throw, listing the known ones.
4. `handle.manifest()` loads the part's manifest (step 1 again, through
   the same identity map).
5. `handle.load()` (or `loaded.load()` for the repo's own entry)
   dynamic-imports the entry module and returns the **holon class** —
   still constructing nothing. Construction happens only when user code
   writes `new TheClass({...})`.

**Cycles are legal by construction.** A → B → A terminates because step 2
returns the already-cached `LoadedManifest` for A instead of re-reading
it, and because no step eagerly walks the part graph — there is no
"resolve everything" phase to recurse in. This is the dream.lock insight
(HISTORY): circularity is only a problem for eager instantiation;
namespace + lazy resolution makes it a non-problem.

## Machine-editability (the editor contract)

The canonical serialization (`serializeManifest`) is what the editor and
agents write:

- Fixed top-level key order: `manifest, name, version, entry,
  thumbnail, parts, params`.
- Two-space indent; **one part per line, one param per line** — every
  meaningful edit is a one-line diff, and every entry is
  line-addressable for the AST-free case.
- Writers preserve existing entry order and append new entries at the
  end; no re-sorting (stable diffs beat alphabetical purity).
- Plain JSON, no comments — the manifest is thin enough that comments
  belong in the README or the DreamWeaving. Nothing needs preserving
  beyond what the canonical form emits, so rewrite-on-save is safe.

## Versioning

- `manifest` versions the **schema** — the loader rejects versions it
  does not know rather than guessing.
- `version` versions the **holon** — semver, bumped by the repo's own
  releases.
- `rev` on a git part pins the **part** — advisory today, enforced when
  the lock layer lands.

## What does NOT belong in the manifest

- **Geometry** — lives in the holon class (and its baked caches; glTF is
  export-only per TASTE).
- **Timelines / choreography** — `unfold()` in the DreamWeaving.
- **Behaviors, states, bindings** — class code. The manifest never
  encodes *how* params map to parts; only *which* params exist.
- **The scene transform hierarchy.** PLAN Ch3 mentions "transform
  hierarchy" as part of the scene format — resolved Q1 splits this:
  part-of (the manifest's `parts`) is a rootless associative graph at
  the **repo** level; each scene's transform **tree** lives in the
  DreamWeaving (parts as class fields, `compose()`), where the editor
  edits it via semantic ops. Putting the tree in JSON would duplicate
  the behavioral source.
- **Layer-1 vocabulary.** `Circle`, `Square`, `Sphere`… come from the
  `dreamtalk/parts` import namespace (SYNTAX-TS), not from `parts`
  entries — the core library is consumed as a package, which is also why
  the core repo itself carries no `dreamtalk.json`: it is vocabulary,
  not a sovereign symbol with one entry holon. `parts` lists sovereign
  symbol repos only.
- **DreamNode social identity** — uuid, genealogy, supermodules: `.udd`.

## Loader API (summary)

```ts
import { loadManifest } from "dreamtalk/manifest"

const virus = await loadManifest("~/workspace/MindVirus")
virus.data.name                     // "MindVirus"
virus.partAliases                   // ["molochEye", "foldableCube"]

const eye = virus.part("molochEye") // lazy handle — nothing read yet
await eye.manifest()                // the part's LoadedManifest (cached, identity-mapped)
const EyeClass = await eye.load()   // dynamic-imports the entry; constructs NOTHING

const MindVirus = await virus.load()
const instance = new MindVirus({ tint: PURPLE })  // the only place construction happens
```

`serializeManifest(manifest)` emits the canonical text;
`parseManifest(json, context)` validates with precise errors;
`clearManifestCache()` resets the identity map (tests/tooling).
