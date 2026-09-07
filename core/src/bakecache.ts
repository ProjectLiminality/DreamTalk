/**
 * bakecache.ts — the two places baked tracks are kept.
 *
 * bake.ts states WHAT a cache is (get/put over a hash) and refuses to
 * care where the bytes live. This file supplies the two wheres DreamTalk
 * actually has, and nothing else:
 *
 *   - **fs** — scripts, tests, the gauntlet: `.cache/bakes/<hash>.bin`
 *     under the repo root, gitignored, disposable.
 *   - **http** — the editor and the demo, which run in a browser and
 *     have no filesystem. The daemon serves the same directory over
 *     `/api/bake-cache/<hash>`; the page GETs and PUTs.
 *
 * Both are written so that every failure mode is silence. A read that
 * 404s, a daemon that is not running, a static `serve.ts` with no such
 * endpoint, a read-only disk — each returns undefined or does nothing,
 * and the caller bakes. That is not defensive coding for its own sake;
 * it is the property that lets the cache be deleted at any moment
 * without anyone noticing except the clock.
 */

import type { BakeCache } from "./bake"

/** Hashes are our own hex; nothing else may become a path segment. */
const VALID_HASH = /^[0-9a-f]{8,64}$/

export const isValidHash = (hash: string): boolean => VALID_HASH.test(hash)

/**
 * The repo's cache directory, given a repo root. One place so the
 * daemon, the scripts and the tests cannot drift apart on it.
 */
export const bakeCacheDir = (repoRoot: string): string =>
  `${repoRoot.replace(/\/$/, "")}/.cache/bakes`

/**
 * Cache backed by the filesystem — for bun/node contexts.
 *
 * Writes go to a temp name and are renamed into place, so a process
 * killed mid-write leaves no half-file for the next boot to read. (The
 * length check in `decodeTrack` would catch it anyway; this makes the
 * catching unnecessary.)
 */
export const fsBakeCache = (repoRoot: string): BakeCache => {
  const dir = bakeCacheDir(repoRoot)
  /**
   * This module is imported by the browser bundle (for `httpBakeCache`),
   * so `fsBakeCache` may be CONSTRUCTED where `Bun` does not exist. The
   * guard makes that a documented no-op rather than a ReferenceError
   * waiting for someone to call the wrong constructor in the wrong
   * context — the same "every failure means compute" rule, applied to
   * the environment itself.
   */
  const hasBun = typeof Bun !== "undefined"
  return {
    async get(hash: string): Promise<Uint8Array | undefined> {
      if (!hasBun || !isValidHash(hash)) return undefined
      try {
        const file = Bun.file(`${dir}/${hash}.bin`)
        if (!(await file.exists())) return undefined
        return new Uint8Array(await file.arrayBuffer())
      } catch {
        return undefined
      }
    },
    async put(hash: string, bytes: Uint8Array): Promise<void> {
      if (!hasBun || !isValidHash(hash)) return
      try {
        const { mkdir, rename } = await import("node:fs/promises")
        await mkdir(dir, { recursive: true })
        const tmp = `${dir}/.${hash}.${process.pid}.tmp`
        await Bun.write(tmp, bytes)
        await rename(tmp, `${dir}/${hash}.bin`)
      } catch {
        // A cache we cannot write is a cache the next boot recomputes.
      }
    },
  }
}

/**
 * Cache backed by the daemon — for the editor and the demo.
 *
 * `base` is the endpoint prefix. A GET that is not 200 means "compute";
 * a PUT is fire-and-forget. Against `serve.ts`, which has no such
 * route, every GET 404s and every PUT 404s, and the scene boots exactly
 * as it did before this file existed.
 */
export const httpBakeCache = (base = "/api/bake-cache"): BakeCache => ({
  async get(hash: string): Promise<Uint8Array | undefined> {
    if (!isValidHash(hash)) return undefined
    try {
      const res = await fetch(`${base}/${hash}`)
      if (!res.ok) return undefined
      return new Uint8Array(await res.arrayBuffer())
    } catch {
      return undefined
    }
  },
  async put(hash: string, bytes: Uint8Array): Promise<void> {
    if (!isValidHash(hash)) return
    try {
      await fetch(`${base}/${hash}`, {
        method: "PUT",
        // A fresh copy: the view may be onto a larger buffer.
        body: bytes.slice().buffer as ArrayBuffer,
      })
    } catch {
      // Offline, or a static server. Neither is our business.
    }
  },
})
