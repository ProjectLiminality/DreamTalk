/**
 * render-song.ts — headless frame renderer for a registered scene.
 *
 * Drives the demo page exactly the way the gauntlet does (window.__dt),
 * but over a dense frame grid instead of scored spot frames: setT for
 * every frame at the target fps, screenshot the canvas, and leave a
 * numbered PNG sequence for ffmpeg to assemble.
 *
 * Usage:
 *   bun scripts/render-song.ts <sceneKey> <framesDir> [--fps 30] [--port 4212]
 *
 * Assembly (h264, even the odd-duration tail is exact):
 *   ffmpeg -framerate 30 -i <framesDir>/f%05d.png -c:v libx264 -pix_fmt yuv420p out.mp4
 */

import { mkdirSync } from "node:fs"
import puppeteer from "puppeteer-core"

const args = process.argv.slice(2)
const flag = (name: string, fallback: number): number => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"))
const [sceneKey, framesDir] = positional
if (!sceneKey || !framesDir) {
  console.error("usage: bun scripts/render-song.ts <sceneKey> <framesDir> [--fps 30] [--port 4212]")
  process.exit(2)
}
const fps = flag("--fps", 30)
const port = flag("--port", Number(process.env.GAUNTLET_PORT ?? 4212))

mkdirSync(framesDir, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--headless=new",
    "--enable-unsafe-webgpu",
    "--enable-features=WebGPU",
    "--use-angle=metal",
    "--hide-scrollbars",
    "--window-size=1280,720",
  ],
})

try {
  const page = await browser.newPage()
  // 1280x720 exactly: the canvas fills the viewport, so at the reference
  // aspect the backing store maps 1:1 to screenshot pixels — no resize,
  // no letterbox, no comparator needed to undo anything.
  await page.setViewport({ width: 1280, height: 720 })
  await page.goto(`http://localhost:${port}/demo/?scene=${sceneKey}`, {
    waitUntil: "networkidle0",
    timeout: 30000,
  })
  await page.waitForFunction("window.__dt !== undefined", { timeout: 30000 })
  const status = await page.evaluate(() => ({
    ready: window.__dt!.ready,
    error: (window.__dt as { error?: string }).error ?? null,
    duration: window.__dt!.duration,
  }))
  if (!status.ready) {
    console.error("scene failed to boot:", status.error)
    process.exit(1)
  }
  // The t readout is page chrome, not scene — keep it out of the movie.
  await page.evaluate(() => {
    const readout = document.getElementById("readout")
    if (readout) readout.style.display = "none"
  })

  const frameCount = Math.round(status.duration * fps)
  console.log(
    `${sceneKey}: ${status.duration.toFixed(2)}s at ${fps}fps → ${frameCount} frames`,
  )
  const started = performance.now()
  for (let i = 0; i < frameCount; i++) {
    await page.evaluate((tt) => window.__dt!.setT(tt), i / fps)
    const path = `${framesDir}/f${String(i).padStart(5, "0")}.png`
    await page.screenshot({ path: path as `${string}.png` })
    if (i > 0 && i % 300 === 0) {
      const elapsed = (performance.now() - started) / 1000
      const rate = i / elapsed
      console.log(
        `  ${i}/${frameCount} (${((i / frameCount) * 100).toFixed(1)}%) · ` +
          `${rate.toFixed(1)} fps · ~${((frameCount - i) / rate / 60).toFixed(1)}min left`,
      )
    }
  }
  console.log(
    `done: ${frameCount} frames in ${((performance.now() - started) / 60000).toFixed(1)}min`,
  )
} finally {
  await browser.close()
}
