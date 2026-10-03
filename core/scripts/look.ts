/**
 * look.ts — Claude looks at David's page.
 *
 *   bun scripts/look.ts [board]          → one PNG, path printed (default `scratch`)
 *   bun scripts/look.ts --all            → every board the daemon knows
 *   flags: --light (the light theme), --scale <k> (css px per page unit, default 0.75),
 *          --base <url> (default http://localhost:4174)
 *
 * The board exactly as the whiteboard shows it — the same page, the same
 * ThreeHost symbol layers, the same ink — opened headless at
 * `/sketch/?board=<name>&look=1`. Look mode is read-only by construction
 * (sketch/main.ts): no toolbar, NO /ws/pen connection (a second page must
 * never echo the tablet's strokes) and NO saving (it must never write over
 * the board David is drawing on). The PNG is the page rectangle only.
 *
 * Needs the daemon (bun run studio) and a built sketch bundle
 * (bun run build:sketch).
 */

import puppeteer from "puppeteer-core"
import { mkdirSync } from "node:fs"
import { PAGE_H, PAGE_W } from "../sketch/protocol"

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const base = opt("--base") ?? "http://localhost:4174"
const scale = Number(opt("--scale") ?? 0.75)
const light = flag("--light")
const named = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--base", "--scale"].includes(args[i - 1]!)))

const repoRoot = new URL("../../", import.meta.url).pathname
const outDir = `${repoRoot}.cache/look`
mkdirSync(outDir, { recursive: true })

let boards: string[]
if (flag("--all")) {
  const res = await fetch(`${base}/api/boards`).catch(() => undefined)
  if (!res?.ok) {
    console.error(`look: no daemon at ${base} (bun run studio)`)
    process.exit(1)
  }
  boards = ((await res.json()) as { name: string }[]).map((b) => b.name)
} else boards = named.length ? named : ["scratch"]

// The page's own layout: page = min((W − 32)/PAGE_W, (H − 24)/PAGE_H) css px per unit.
const viewport = { width: Math.ceil(PAGE_W * scale + 32), height: Math.ceil(PAGE_H * scale + 24) }

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--headless=new", "--enable-unsafe-webgpu", "--enable-features=WebGPU", "--use-angle=metal", "--hide-scrollbars"],
})
let failed = 0
try {
  for (const name of boards) {
    const page = await browser.newPage()
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 })
    page.on("pageerror", (e) => console.error(`[${name}] page error:`, (e as Error).message))
    // The theme is per browser; this profile is fresh, so state it.
    await page.evaluateOnNewDocument((dark: boolean) => {
      try {
        localStorage.setItem("dreamtalk.sketch.dark", dark ? "1" : "0")
      } catch {
        // the page defaults to dark
      }
    }, !light)
    try {
      await page.goto(`${base}/sketch/?board=${encodeURIComponent(name)}&look=1`, { waitUntil: "load", timeout: 60000 })
      await page.waitForFunction(
        () => {
          const s = (window as unknown as { __sketch?: { ready?: boolean; symbolsReady?: () => boolean } }).__sketch
          return !!s?.ready && !!s.symbolsReady?.()
        },
        { timeout: 60000 },
      )
      // Two frames for the swapped-in layers to reach the compositor.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      const el = await page.$("#page")
      const path = `${outDir}/${name}.png` as `${string}.png`
      await el!.screenshot({ path })
      console.log(path)
    } catch (err) {
      failed++
      console.error(`look: ${name} failed —`, (err as Error).message)
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
}
process.exit(failed ? 1 : 0)
