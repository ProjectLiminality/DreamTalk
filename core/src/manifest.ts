/**
 * Manifest — the repo-level face of a DreamNode.
 *
 * A `dreamtalk.json` at a repo root declares identity, the entry
 * DreamWeaving, the holon repos it draws in (`parts`), and the promoted
 * parameter face. It never contains geometry, timelines, or behaviors —
 * those live in the entry `.ts` (see docs/MANIFEST.md).
 *
 * Resolution is lazy (dream.lock spirit): loading a manifest reads one
 * JSON file and nothing else; a part's module is imported only when
 * `load()` is called, and nothing is ever constructed by the loader.
 * Loaded manifests are identity-mapped by resolved directory, which is
 * what makes circular part references legal.
 */

import { existsSync, realpathSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { basename, dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Holon, type Overrides } from "./holon"
import type { ParamKind } from "./params"

export const MANIFEST_FILENAME = "dreamtalk.json"
export const MANIFEST_SCHEMA_VERSION = 1

/** A holon class as the loader hands it over — never an instance. */
export type HolonClass = new (overrides?: Overrides) => Holon

/** Reference to a part repo: exactly one of `path` (local) or `git` (URL). */
export interface PartRef {
  /** Directory of the part repo, relative to this manifest's directory. */
  path?: string
  /** Git URL of the part repo — resolved only if already fetched (see docs). */
  git?: string
  /** Advisory pin (commit-ish). Recorded, not enforced by the loader. */
  rev?: string
}

/** One promoted parameter — the face mirrors the entry holon's declaration. */
export interface ParamDecl {
  name: string
  kind: ParamKind
  default?: number | boolean | { r: number; g: number; b: number }
  min?: number
  max?: number
}

export interface Manifest {
  /** Schema version — MANIFEST_SCHEMA_VERSION. */
  manifest: number
  /** PascalCase holon name; the entry module must export a class by this name. */
  name: string
  /** Repo semver. */
  version: string
  /** Relative path to the DreamWeaving `.ts` exporting the holon class. */
  entry: string
  /** Relative path to the rendered symbol face (the thumbnail test). */
  thumbnail?: string
  /** alias → part repo reference. The rootless part-of graph; cycles legal. */
  parts: Record<string, PartRef>
  /** Promoted parameter face, generated from code (docs/PARAMETERS.md). */
  params?: ParamDecl[]
}

const PARAM_KINDS: readonly ParamKind[] = [
  "scalar",
  "length",
  "angle",
  "bipolar",
  "completion",
  "color",
  "integer",
  "bool",
]

const fail = (context: string, message: string): never => {
  throw new Error(`${context}: ${message}`)
}

/** Parse and validate manifest JSON text. `context` names the source in errors. */
export const parseManifest = (json: string, context = MANIFEST_FILENAME): Manifest => {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch (e) {
    fail(context, `not valid JSON — ${(e as Error).message}`)
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail(context, "manifest must be a JSON object")
  }
  const m = raw as Record<string, unknown>

  if (m["manifest"] !== MANIFEST_SCHEMA_VERSION) {
    fail(context, `unknown schema version ${JSON.stringify(m["manifest"])} (expected ${MANIFEST_SCHEMA_VERSION})`)
  }
  if (typeof m["name"] !== "string" || m["name"].length === 0) {
    fail(context, "'name' must be a non-empty string")
  }
  if (typeof m["version"] !== "string" || m["version"].length === 0) {
    fail(context, "'version' must be a non-empty string")
  }
  if (typeof m["entry"] !== "string" || !m["entry"].endsWith(".ts")) {
    fail(context, "'entry' must be a relative path to a .ts DreamWeaving")
  }
  if (m["thumbnail"] !== undefined && typeof m["thumbnail"] !== "string") {
    fail(context, "'thumbnail' must be a string when present")
  }

  const partsRaw = m["parts"] ?? {}
  if (typeof partsRaw !== "object" || partsRaw === null || Array.isArray(partsRaw)) {
    fail(context, "'parts' must be an object of alias → part reference")
  }
  const parts: Record<string, PartRef> = {}
  for (const [alias, refRaw] of Object.entries(partsRaw as Record<string, unknown>)) {
    if (typeof refRaw !== "object" || refRaw === null) {
      fail(context, `part '${alias}' must be an object`)
    }
    const ref = refRaw as Record<string, unknown>
    const hasPath = typeof ref["path"] === "string"
    const hasGit = typeof ref["git"] === "string"
    if (hasPath === hasGit) {
      fail(context, `part '${alias}' needs exactly one of 'path' or 'git'`)
    }
    if (ref["rev"] !== undefined && typeof ref["rev"] !== "string") {
      fail(context, `part '${alias}': 'rev' must be a string when present`)
    }
    const out: PartRef = {}
    if (hasPath) out.path = ref["path"] as string
    if (hasGit) out.git = ref["git"] as string
    if (typeof ref["rev"] === "string") out.rev = ref["rev"]
    parts[alias] = out
  }

  const paramsRaw = m["params"]
  let params: ParamDecl[] | undefined
  if (paramsRaw !== undefined) {
    if (!Array.isArray(paramsRaw)) fail(context, "'params' must be an array")
    params = (paramsRaw as unknown[]).map((declRaw, i) => {
      if (typeof declRaw !== "object" || declRaw === null) {
        fail(context, `params[${i}] must be an object`)
      }
      const d = declRaw as Record<string, unknown>
      if (typeof d["name"] !== "string" || d["name"].length === 0) {
        fail(context, `params[${i}]: 'name' must be a non-empty string`)
      }
      if (!PARAM_KINDS.includes(d["kind"] as ParamKind)) {
        fail(context, `params[${i}] ('${d["name"]}'): unknown kind '${String(d["kind"])}' (kinds: ${PARAM_KINDS.join(", ")})`)
      }
      const decl: ParamDecl = { name: d["name"] as string, kind: d["kind"] as ParamKind }
      if (d["default"] !== undefined) decl.default = d["default"] as ParamDecl["default"]
      if (typeof d["min"] === "number") decl.min = d["min"]
      if (typeof d["max"] === "number") decl.max = d["max"]
      return decl
    })
  }

  const out: Manifest = {
    manifest: MANIFEST_SCHEMA_VERSION,
    name: m["name"] as string,
    version: m["version"] as string,
    entry: m["entry"] as string,
    parts,
  }
  if (typeof m["thumbnail"] === "string") out.thumbnail = m["thumbnail"]
  if (params) out.params = params
  return out
}

/**
 * Canonical serialization (the editor contract): fixed top-level key
 * order, two-space indent, one part / one param per line. Writers
 * preserve existing entry order and append new entries — line diffs stay
 * minimal.
 */
export const serializeManifest = (m: Manifest): string => {
  const lines: string[] = ["{"]
  lines.push(`  "manifest": ${m.manifest},`)
  lines.push(`  "name": ${JSON.stringify(m.name)},`)
  lines.push(`  "version": ${JSON.stringify(m.version)},`)
  const trailing: string[] = []
  trailing.push(`  "entry": ${JSON.stringify(m.entry)}`)
  if (m.thumbnail !== undefined) trailing.push(`  "thumbnail": ${JSON.stringify(m.thumbnail)}`)

  const partEntries = Object.entries(m.parts)
  if (partEntries.length === 0) {
    trailing.push(`  "parts": {}`)
  } else {
    const partLines = partEntries.map(([alias, ref], i) => {
      const fields: string[] = []
      if (ref.path !== undefined) fields.push(`"path": ${JSON.stringify(ref.path)}`)
      if (ref.git !== undefined) fields.push(`"git": ${JSON.stringify(ref.git)}`)
      if (ref.rev !== undefined) fields.push(`"rev": ${JSON.stringify(ref.rev)}`)
      const comma = i < partEntries.length - 1 ? "," : ""
      return `    ${JSON.stringify(alias)}: { ${fields.join(", ")} }${comma}`
    })
    trailing.push(`  "parts": {\n${partLines.join("\n")}\n  }`)
  }

  if (m.params !== undefined) {
    const paramLines = m.params.map((d, i) => {
      const fields: string[] = [`"name": ${JSON.stringify(d.name)}`, `"kind": ${JSON.stringify(d.kind)}`]
      if (d.default !== undefined) fields.push(`"default": ${JSON.stringify(d.default)}`)
      if (d.min !== undefined) fields.push(`"min": ${JSON.stringify(d.min)}`)
      if (d.max !== undefined) fields.push(`"max": ${JSON.stringify(d.max)}`)
      const comma = i < (m.params?.length ?? 0) - 1 ? "," : ""
      return `    { ${fields.join(", ")} }${comma}`
    })
    trailing.push(`  "params": [\n${paramLines.join("\n")}\n  ]`)
  }

  lines.push(trailing.join(",\n"))
  lines.push("}")
  return lines.join("\n") + "\n"
}

/** Repo directory name a git URL lands in ("…/FoldableCube.git" → "FoldableCube"). */
const repoDirName = (gitUrl: string): string => {
  const last = basename(gitUrl.replace(/\/+$/, ""))
  const name = last.endsWith(".git") ? last.slice(0, -4) : last
  if (name.length === 0) throw new Error(`cannot derive a repo directory from git URL '${gitUrl}'`)
  return name
}

/**
 * A lazy handle on one part. Nothing is read or imported until
 * `manifest()` / `load()` — and even then, nothing is constructed.
 */
export class PartHandle {
  constructor(
    readonly alias: string,
    readonly ref: PartRef,
    private readonly owner: LoadedManifest,
  ) {}

  /** The absolute directory this ref resolves to. Pure path math — no fs access. */
  get dir(): string {
    if (this.ref.path !== undefined) return resolve(this.owner.dir, this.ref.path)
    const workspace = process.env["DREAMTALK_WORKSPACE"] ?? dirname(this.owner.dir)
    return join(workspace, repoDirName(this.ref.git as string))
  }

  /** Load (or return the cached) manifest of the part repo. */
  async manifest(): Promise<LoadedManifest> {
    const dir = this.dir
    if (this.ref.git !== undefined && !existsSync(dir)) {
      throw new Error(
        `${this.owner.data.name}: part '${this.alias}' resolves to '${dir}', which is not present. ` +
          `The loader never fetches — clone ${this.ref.git} there, or point DREAMTALK_WORKSPACE at the workspace holding it.`,
      )
    }
    return loadManifest(dir)
  }

  /** Import the part's entry module and return its holon class. Constructs nothing. */
  async load(): Promise<HolonClass> {
    return (await this.manifest()).load()
  }
}

export class LoadedManifest {
  #entryClass?: Promise<HolonClass>
  #handles = new Map<string, PartHandle>()

  constructor(
    /** Resolved absolute directory of the repo — the identity key. */
    readonly dir: string,
    readonly data: Manifest,
  ) {}

  get partAliases(): readonly string[] {
    return Object.keys(this.data.parts)
  }

  /** A lazy handle on one part; throws on an unknown alias. */
  part(alias: string): PartHandle {
    const known = this.#handles.get(alias)
    if (known) return known
    const ref = this.data.parts[alias]
    if (!ref) {
      const aliases = this.partAliases.join(", ") || "none"
      throw new Error(`${this.data.name}: unknown part alias '${alias}' (parts: ${aliases})`)
    }
    const handle = new PartHandle(alias, ref, this)
    this.#handles.set(alias, handle)
    return handle
  }

  /** Import this manifest's entry module and return the holon class. Constructs nothing. */
  load(): Promise<HolonClass> {
    this.#entryClass ??= importEntry(this)
    return this.#entryClass
  }
}

const importEntry = async (loaded: LoadedManifest): Promise<HolonClass> => {
  const { name, entry } = loaded.data
  const entryPath = resolve(loaded.dir, entry)
  const context = `${name} (${entryPath})`
  if (!existsSync(entryPath)) fail(context, "entry file does not exist")
  const mod = (await import(pathToFileURL(entryPath).href)) as Record<string, unknown>
  const cls = mod[name] ?? mod["default"]
  if (typeof cls !== "function") {
    fail(context, `entry must export a class named '${name}' (or a default export)`)
  }
  if (!((cls as HolonClass).prototype instanceof Holon)) {
    fail(context, `export '${name}' does not extend Holon — is the part built against the same dreamtalk core?`)
  }
  return cls as HolonClass
}

// --- The identity map: one LoadedManifest per resolved directory ---

const cache = new Map<string, Promise<LoadedManifest>>()

const canonicalDir = (dir: string): string => {
  const abs = resolve(dir)
  if (!existsSync(abs)) throw new Error(`manifest directory not found: '${abs}'`)
  return realpathSync(abs)
}

const readAndBuild = async (dir: string): Promise<LoadedManifest> => {
  const file = join(dir, MANIFEST_FILENAME)
  if (!existsSync(file)) throw new Error(`no ${MANIFEST_FILENAME} in '${dir}'`)
  const json = await readFile(file, "utf8")
  return new LoadedManifest(dir, parseManifest(json, file))
}

/**
 * Load the manifest of the repo at `dir`. Reads exactly one JSON file;
 * parts stay unresolved until used. Loading the same directory twice
 * returns the identical instance — the identity map that keeps circular
 * part references finite.
 */
export const loadManifest = (dir: string): Promise<LoadedManifest> => {
  const key = canonicalDir(dir)
  const hit = cache.get(key)
  if (hit) return hit
  const pending = readAndBuild(key)
  cache.set(key, pending)
  pending.catch(() => cache.delete(key))
  return pending
}

/** Drop all cached manifests (tests and tooling; module import caches are unaffected). */
export const clearManifestCache = (): void => {
  cache.clear()
}
