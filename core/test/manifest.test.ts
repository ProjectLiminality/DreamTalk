import { afterEach, describe, expect, test } from "bun:test"
import { join, resolve } from "node:path"
import { Holon } from "../src/holon"
import {
  clearManifestCache,
  loadManifest,
  parseManifest,
  serializeManifest,
  MANIFEST_FILENAME,
  type Manifest,
} from "../src/manifest"

const fixtures = resolve(import.meta.dir, "fixtures")
const flags = globalThis as Record<string, unknown>

describe("loading", () => {
  test("reads and validates a manifest", async () => {
    const blossom = await loadManifest(join(fixtures, "Blossom"))
    expect(blossom.data.name).toBe("Blossom")
    expect(blossom.data.version).toBe("0.1.0")
    expect(blossom.data.entry).toBe("Blossom.ts")
    expect(blossom.data.thumbnail).toBe("Blossom.png")
    expect(blossom.partAliases).toEqual(["ring"])
    expect(blossom.data.params).toEqual([
      { name: "petals", kind: "integer", default: 5 },
      { name: "bloom", kind: "completion", default: 0, min: 0, max: 1 },
    ])
  })

  test("loading the same directory twice returns the identical instance", async () => {
    const a = await loadManifest(join(fixtures, "Blossom"))
    const b = await loadManifest(join(fixtures, "Blossom"))
    expect(a).toBe(b)
  })

  test("a directory without a manifest errors cleanly", async () => {
    await expect(loadManifest(fixtures)).rejects.toThrow(`no ${MANIFEST_FILENAME}`)
  })

  test("a missing directory errors cleanly", () => {
    expect(() => loadManifest(join(fixtures, "Nowhere"))).toThrow(/directory not found/)
  })
})

describe("lazy part resolution", () => {
  test("part() hands out a handle without importing anything", async () => {
    const blossom = await loadManifest(join(fixtures, "Blossom"))
    const ring = blossom.part("ring")
    expect(ring.alias).toBe("ring")
    expect(ring.dir).toBe(join(fixtures, "Ring"))
    // the entry module has NOT been imported, and nothing constructed
    expect(flags.__ringImported).toBeUndefined()
    expect(flags.__ringConstructed).toBeUndefined()
  })

  test("load() imports the entry module but constructs nothing", async () => {
    const blossom = await loadManifest(join(fixtures, "Blossom"))
    const RingClass = await blossom.part("ring").load()
    expect(flags.__ringImported).toBe(true)
    expect(flags.__ringConstructed).toBeUndefined()
    expect(RingClass.prototype instanceof Holon).toBe(true)
    // explicit use is what finally constructs
    const ring = new RingClass()
    expect(flags.__ringConstructed).toBe(true)
    expect(ring.params.has("radius")).toBe(true)
  })

  test("unknown alias errors with the known aliases", async () => {
    const blossom = await loadManifest(join(fixtures, "Blossom"))
    expect(() => blossom.part("stem")).toThrow(
      "Blossom: unknown part alias 'stem' (parts: ring)",
    )
  })
})

describe("circular part references (Blossom → Ring → Blossom)", () => {
  test("the cycle resolves finitely to identical instances", async () => {
    const blossom = await loadManifest(join(fixtures, "Blossom"))
    const ring = await blossom.part("ring").manifest()
    const blossomAgain = await ring.part("blossom").manifest()
    expect(blossomAgain).toBe(blossom)
    // and around once more, for good measure
    const ringAgain = await blossomAgain.part("ring").manifest()
    expect(ringAgain).toBe(ring)
  })
})

describe("git part references", () => {
  const savedWorkspace = process.env["DREAMTALK_WORKSPACE"]
  afterEach(() => {
    if (savedWorkspace === undefined) delete process.env["DREAMTALK_WORKSPACE"]
    else process.env["DREAMTALK_WORKSPACE"] = savedWorkspace
  })

  test("resolves an already-fetched repo in the sibling workspace", async () => {
    const consumer = await loadManifest(join(fixtures, "GitConsumer"))
    const orbit = consumer.part("orbit")
    expect(orbit.dir).toBe(join(fixtures, "Orbit"))
    expect(orbit.ref.rev).toBe("v0.1.0")
    const OrbitClass = await orbit.load()
    expect(OrbitClass.prototype instanceof Holon).toBe(true)
  })

  test("DREAMTALK_WORKSPACE overrides the sibling default", async () => {
    process.env["DREAMTALK_WORKSPACE"] = "/somewhere/else"
    const consumer = await loadManifest(join(fixtures, "GitConsumer"))
    expect(consumer.part("orbit").dir).toBe(join("/somewhere/else", "Orbit"))
  })

  test("an unfetched git part fails with fetch guidance, never fetches", async () => {
    const consumer = await loadManifest(join(fixtures, "GitConsumer"))
    await expect(consumer.part("ghost").manifest()).rejects.toThrow(/loader never fetches/)
  })
})

describe("validation", () => {
  const base = {
    manifest: 1,
    name: "Thing",
    version: "0.1.0",
    entry: "Thing.ts",
    parts: {},
  }
  const parse = (overrides: Record<string, unknown>) =>
    parseManifest(JSON.stringify({ ...base, ...overrides }), "test")

  test("rejects a wrong schema version", () => {
    expect(() => parse({ manifest: 99 })).toThrow(/unknown schema version 99/)
  })

  test("rejects a non-.ts entry", () => {
    expect(() => parse({ entry: "Thing.py" })).toThrow(/'entry' must be a relative path/)
  })

  test("rejects a part with both path and git", () => {
    expect(() => parse({ parts: { p: { path: "../P", git: "https://x" } } })).toThrow(
      /part 'p' needs exactly one of 'path' or 'git'/,
    )
  })

  test("rejects a part with neither path nor git", () => {
    expect(() => parse({ parts: { p: { rev: "abc" } } })).toThrow(/exactly one of 'path' or 'git'/)
  })

  test("rejects an unknown param kind", () => {
    expect(() => parse({ params: [{ name: "vibe", kind: "aura" }] })).toThrow(
      /unknown kind 'aura'/,
    )
  })
})

describe("canonical serialization", () => {
  test("writes the stable, line-addressable form", () => {
    const m: Manifest = {
      manifest: 1,
      name: "MindVirus",
      version: "0.1.0",
      entry: "MindVirus.ts",
      thumbnail: "MindVirus.png",
      parts: {
        molochEye: { path: "../MolochEye" },
        foldableCube: { git: "https://github.com/ProjectLiminality/FoldableCube", rev: "a1b2c3d" },
      },
      params: [
        { name: "fold", kind: "bipolar", default: 0, min: -1, max: 1 },
        { name: "tint", kind: "color", default: { r: 0, g: 162, b: 255 } },
      ],
    }
    const text = serializeManifest(m)
    expect(text).toBe(`{
  "manifest": 1,
  "name": "MindVirus",
  "version": "0.1.0",
  "entry": "MindVirus.ts",
  "thumbnail": "MindVirus.png",
  "parts": {
    "molochEye": { "path": "../MolochEye" },
    "foldableCube": { "git": "https://github.com/ProjectLiminality/FoldableCube", "rev": "a1b2c3d" }
  },
  "params": [
    { "name": "fold", "kind": "bipolar", "default": 0, "min": -1, "max": 1 },
    { "name": "tint", "kind": "color", "default": {"r":0,"g":162,"b":255} }
  ]
}
`)
  })

  test("round-trips through parse", () => {
    const m: Manifest = {
      manifest: 1,
      name: "Ring",
      version: "1.2.3",
      entry: "Ring.ts",
      parts: { blossom: { path: "../Blossom" } },
    }
    expect(parseManifest(serializeManifest(m), "roundtrip")).toEqual(m)
  })

  test("the fixture manifests are already canonical", async () => {
    for (const name of ["Blossom", "Ring", "Orbit", "GitConsumer"]) {
      const file = join(fixtures, name, MANIFEST_FILENAME)
      const text = await Bun.file(file).text()
      expect(serializeManifest(parseManifest(text, file))).toBe(text)
    }
  })
})

// The manifest cache is intentionally process-wide (that is the identity
// map); clearManifestCache exists for tooling. Prove it works and leave
// the cache clean for any other suite.
test("clearManifestCache drops identity", async () => {
  const a = await loadManifest(join(fixtures, "Orbit"))
  clearManifestCache()
  const b = await loadManifest(join(fixtures, "Orbit"))
  expect(a).not.toBe(b)
})
