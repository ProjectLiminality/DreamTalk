/**
 * gauntlet.ts — the scene reproduction harness.
 *
 * Renders a video-01 scene at the reference frame times and scores every
 * frame with scripts/overlay.py (hue-tolerant, geometry-strict per
 * DECISIONS 2026-08-23). This is the loop the builder/evaluator agents
 * run: render → score → iterate until PASS.
 *
 * Usage:
 *   bun scripts/gauntlet.ts <sceneKey> <sceneStartSec> <sceneEndSec> [outDir] [--step N]
 *
 * Example (Scene 04 spans 82–89s of the original):
 *   bun scripts/gauntlet.ts s04 82 89 /tmp/g/s04 --step 5
 *
 * Scene time maps to reference frames as: frameIndex = round(videoSec * 5)
 * (refs/video-01/frames5/f%04d.png). Our scene's local t starts at 0, so
 * localT = videoSec - sceneStartSec.
 *
 * Emits <outDir>/summary.json: per-frame metrics + the aggregate verdict.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import puppeteer from "puppeteer-core"

const args = process.argv.slice(2)
const stepFlag = args.indexOf("--step")
const step = stepFlag >= 0 ? Number(args[stepFlag + 1]) : 5 // every 5th ref frame = 1s
const positional = args.filter((_, i) => stepFlag < 0 || (i !== stepFlag && i !== stepFlag + 1))
const [sceneKey, startStr, endStr, outDirArg] = positional
if (!sceneKey || !startStr || !endStr) {
  console.error("usage: bun scripts/gauntlet.ts <sceneKey> <startSec> <endSec> [outDir] [--step N]")
  process.exit(2)
}
const startSec = Number(startStr)
const endSec = Number(endStr)
const outDir = outDirArg ?? `/tmp/gauntlet/${sceneKey}`
const repoRoot = new URL("../../", import.meta.url).pathname
const framesDir = `${repoRoot}refs/video-01/frames5`
const port = Number(process.env.GAUNTLET_PORT ?? 4190)

mkdirSync(outDir, { recursive: true })

const frameIndex = (videoSec: number): number => Math.round(videoSec * 5)
const framePath = (idx: number): string => `${framesDir}/f${String(idx).padStart(4, "0")}.png`

const targets: { videoSec: number; localT: number; ref: string; idx: number }[] = []
for (let idx = frameIndex(startSec); idx <= frameIndex(endSec); idx += step) {
  const ref = framePath(idx)
  if (!existsSync(ref)) continue
  const videoSec = idx / 5
  targets.push({ videoSec, localT: videoSec - startSec, ref, idx })
}
if (targets.length === 0) {
  console.error("no reference frames in range")
  process.exit(2)
}

const browser = await puppeteer.launch({
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

interface FrameReport {
  idx: number
  videoSec: number
  localT: number
  iou: number
  chamfer_ours_px: number
  chamfer_ref_px: number
  coverage_ref: number
  coverage_ours: number
  verdict: string
}

const reports: FrameReport[] = []

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
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
  console.log(`scene ${sceneKey}: ${status.duration.toFixed(2)}s · ${targets.length} frames to score`)

  for (const target of targets) {
    await page.evaluate((tt) => window.__dt!.setT(tt), target.localT)
    await new Promise((r) => setTimeout(r, 120))
    const shot = `${outDir}/ours-f${String(target.idx).padStart(4, "0")}.png`
    await page.screenshot({ path: shot as `${string}.png` })

    const name = `f${String(target.idx).padStart(4, "0")}`
    const res = spawnSync(
      "python3",
      [
        `${repoRoot}core/scripts/overlay.py`,
        shot,
        target.ref,
        outDir,
        "--name",
        name,
        "--ignore-bottom",
        "40",
        "--json",
      ],
      { encoding: "utf8" },
    )
    const line = (res.stdout ?? "").trim().split("\n").pop() ?? "{}"
    try {
      const metrics = JSON.parse(line) as Omit<FrameReport, "idx" | "videoSec" | "localT">
      reports.push({ idx: target.idx, videoSec: target.videoSec, localT: target.localT, ...metrics })
      console.log(
        `  t=${target.localT.toFixed(1)}s (video ${target.videoSec.toFixed(1)}s) ` +
          `${metrics.verdict} cov_ref=${metrics.coverage_ref} cov_ours=${metrics.coverage_ours} ` +
          `chamfer=${metrics.chamfer_ours_px}/${metrics.chamfer_ref_px}px`,
      )
    } catch {
      console.error(`  t=${target.localT.toFixed(1)}s SCORING FAILED: ${res.stderr?.slice(0, 200)}`)
    }
  }
} finally {
  await browser.close()
}

const passed = reports.filter((r) => r.verdict === "PASS").length
const summary = {
  scene: sceneKey,
  startSec,
  endSec,
  frames: reports.length,
  passed,
  passRate: reports.length ? Number((passed / reports.length).toFixed(3)) : 0,
  meanCoverageRef: reports.length
    ? Number((reports.reduce((a, r) => a + r.coverage_ref, 0) / reports.length).toFixed(4))
    : 0,
  meanCoverageOurs: reports.length
    ? Number((reports.reduce((a, r) => a + r.coverage_ours, 0) / reports.length).toFixed(4))
    : 0,
  worst: [...reports].sort((a, b) => a.coverage_ref - b.coverage_ref).slice(0, 3),
  reports,
}
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 2))
console.log(
  `\n${sceneKey}: ${passed}/${reports.length} frames PASS (${(summary.passRate * 100).toFixed(0)}%) · ` +
    `mean coverage ref=${summary.meanCoverageRef} ours=${summary.meanCoverageOurs}`,
)
if (summary.worst.length > 0) {
  console.log("worst frames:", summary.worst.map((w) => `f${w.idx}(${w.coverage_ref})`).join(" "))
}
process.exit(passed === reports.length ? 0 : 1)
