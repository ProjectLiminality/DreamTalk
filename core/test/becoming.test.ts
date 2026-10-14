/**
 * The becoming (scripts/becoming.ts): a song's history is the commits that
 * touched it and the holons it stands on, from its birth; a commit is
 * materialised read-only, and only well-formed keys are served.
 */

import { describe, expect, test } from "bun:test"
import { becomingResponse, history, keyOf, songSources } from "../scripts/becoming"

const repoRoot = new URL("../../", import.meta.url).pathname
const SCENE = "core/demo/vocabulary/FlowMap.ts"

describe("the song's sources", () => {
  test("its own file, its holons' directories — never the framework", async () => {
    const sources = (await songSources(repoRoot, repoRoot + SCENE)).map((s) => s.slice(repoRoot.length))
    expect(sources).toContain(SCENE)
    expect(sources).toContain("core/vocabulary/FlowMap/")
    expect(sources.some((s) => s.startsWith("core/src/"))).toBe(false)
    expect(sources.some((s) => s.startsWith("core/editor/"))).toBe(false)
  })
})

describe("history", () => {
  test("newest first, from the song's birth, each commit naming what of the song it touched", async () => {
    const commits = await history(repoRoot, SCENE)
    expect(commits.length).toBeGreaterThan(1)
    for (let i = 1; i < commits.length; i++) expect(commits[i - 1]!.time).toBeGreaterThanOrEqual(commits[i]!.time)
    const oldest = commits[commits.length - 1]!
    // The oldest is the commit that brought the song into being (or later).
    const birth = Bun.spawnSync(["git", "log", "--diff-filter=A", "--format=%ct", "--", SCENE], { cwd: repoRoot })
    const born = Math.min(...new TextDecoder().decode(birth.stdout).split("\n").filter(Boolean).map(Number))
    expect(oldest.time).toBeGreaterThanOrEqual(born)
    for (const c of commits) {
      expect(c.sha).toMatch(/^[0-9a-f]{40}$/)
      expect(c.files.length).toBeGreaterThan(0)
    }
  })

  test("a scene outside the repo is refused", async () => {
    await expect(history(repoRoot, "../../etc/passwd")).rejects.toThrow()
  })
})

describe("serving a commit", () => {
  test("keys are repo + sha; anything else is not a becoming path or is refused", async () => {
    expect(keyOf("", "abc1234")).toBe("main-abc1234")
    expect(keyOf("holons/Circle", "abc1234")).toBe("holons-Circle-abc1234")
    expect(await becomingResponse(repoRoot, "/demo/")).toBeUndefined()
    expect(await becomingResponse(repoRoot, "/becoming/main-nothex/demo/")).toBeUndefined()
    expect(await becomingResponse(repoRoot, "/becoming/../main-abc1234/demo/")).toBeUndefined()
  })
})
