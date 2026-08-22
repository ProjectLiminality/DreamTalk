/**
 * Editor UI capture: bun scripts/editor-shot.ts <outdir>
 * Screenshots the editor in plain / backdrop-under / overlay states.
 */

import puppeteer from "puppeteer-core"
import { mkdirSync } from "node:fs"

const outDir = process.argv[2] ?? "shots-editor"
mkdirSync(outDir, { recursive: true })

const base = "http://localhost:4173"
const shots: { name: string; url: string }[] = [
  { name: "editor-plain", url: `${base}/?t=6.5` },
  {
    name: "editor-backdrop",
    url: `${base}/?t=3.0&backdrop=/refs/video-01/frame_020.png&mode=under`,
  },
  {
    name: "editor-overlay",
    url: `${base}/?t=6.5&backdrop=/refs/video-01/frame_020.png&mode=overlay`,
  },
]

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--headless=new",
    "--enable-unsafe-webgpu",
    "--enable-features=WebGPU",
    "--use-angle=metal",
    "--hide-scrollbars",
    "--window-size=1600,900",
  ],
})

try {
  for (const { name, url } of shots) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1600, height: 900 })
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })
    await page.waitForFunction("window.__dt !== undefined", { timeout: 30000 })
    const status = await page.evaluate(() => ({
      ready: window.__dt!.ready,
      error: window.__dt!.error ?? null,
    }))
    if (!status.ready) {
      console.error(`${name}: BOOT FAILED —`, status.error)
      process.exit(1)
    }
    await new Promise((r) => setTimeout(r, 400))
    const path = `${outDir}/${name}.png`
    await page.screenshot({ path: path as `${string}.png` })
    console.log("wrote", path)
    await page.close()
  }
} finally {
  await browser.close()
}
