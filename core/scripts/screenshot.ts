/**
 * Headless frame capture: bun scripts/screenshot.ts <url> <outdir> <t...>
 * Uses system Chrome with WebGPU enabled. Exits non-zero if the page
 * reports a boot error or WebGPU is unavailable.
 */

import puppeteer from "puppeteer-core"
import { mkdirSync } from "node:fs"

const [url = "http://localhost:4173", outDir = "shots", ...tArgs] = process.argv.slice(2)
const times = tArgs.length ? tArgs.map(Number) : [0.5, 1.9, 3.0, 5.0, 6.5]

mkdirSync(outDir, { recursive: true })

/** Heavy scenes (a whole DreamSong) can take minutes to build; wait for the page, not the network. */
const BOOT_TIMEOUT = 10 * 60 * 1000

const browser = await puppeteer.launch({
  protocolTimeout: BOOT_TIMEOUT,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--headless=new",
    "--enable-unsafe-webgpu",
    "--enable-features=WebGPU",
    "--use-angle=metal",
    "--hide-scrollbars",
    "--window-size=1280,760",
  ],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  page.on("console", (msg) => console.log("[page]", msg.text()))
  // "load", not networkidle0: a 404 or a streaming asset keeps the network
  // busy forever on heavy scenes. The page says itself when it is done.
  await page.goto(url, { waitUntil: "load", timeout: BOOT_TIMEOUT })
  await page.waitForFunction("window.__dt !== undefined && (window.__dt.ready || window.__dt.error)", {
    timeout: BOOT_TIMEOUT,
    polling: 250,
  })

  const status = await page.evaluate(() => ({
    ready: window.__dt!.ready,
    error: window.__dt!.error ?? null,
    duration: window.__dt!.duration,
  }))
  if (!status.ready) {
    console.error("BOOT FAILED:", status.error)
    browser.process()?.kill("SIGKILL")
    process.exit(1)
  }
  console.log(`ready — duration ${status.duration.toFixed(2)}s`)

  for (const t of times) {
    await page.evaluate((tt) => window.__dt!.setT(tt), t)
    await new Promise((r) => setTimeout(r, 150))
    const path = `${outDir}/t${t.toFixed(2)}.png`
    await page.screenshot({ path: path as `${string}.png` })
    console.log("wrote", path)
  }
} finally {
  // browser.close() sometimes never resolves (a GPU process that will not
  // die): give it a few seconds, then kill the process and exit regardless.
  const closed = await Promise.race([
    browser.close().then(() => true, () => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), 5000)),
  ])
  if (!closed) browser.process()?.kill("SIGKILL")
}
process.exit(process.exitCode ?? 0)
