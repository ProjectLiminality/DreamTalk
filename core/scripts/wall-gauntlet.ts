/**
 * wall-gauntlet.ts — the TheWall benchmark runner.
 *
 * The stock gauntlet scores against refs/video-01; TheWall's reference
 * is refs/wall/thewall5 (84 frames @5fps, 1080², from TheWall.mp4) and
 * needs the crop mapping the wall report established:
 *
 *   our 1280x720 frame carries the same 53.13 degrees horizontally that
 *   C4D's 36mm lens gave the SQUARE reference, so the central 720^2 crop
 *   is degree-for-degree the reference, resized to 1080^2.
 *
 * Reference frame N sits at scene time (N-1)/5.
 *
 * Usage: bun scripts/wall-gauntlet.ts [outDir] [--step N] [--port N]
 *                                     [--scene KEY] [--frames a,b,c]
 */

import { mkdirSync, existsSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import puppeteer from "puppeteer-core"

const args = process.argv.slice(2)
const flag = (name: string, dflt: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1]! : dflt
}
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"))
const outDir = positional[0] ?? "/tmp/wall-gauntlet"
const step = Number(flag("step", "6"))
const port = Number(flag("port", "4260"))
const sceneKey = flag("scene", "thewall")
const only = flag("frames", "")
  .split(",")
  .filter(Boolean)
  .map(Number)

const repoRoot = new URL("../../", import.meta.url).pathname
const framesDir = `${repoRoot}refs/wall/thewall5`
mkdirSync(outDir, { recursive: true })

/** f0084 is the video's fade-out, not choreography (wall report). */
const LAST_SCORED = 78

const targets: { idx: number; t: number; ref: string }[] = []
const indices = only.length > 0 ? only : Array.from({ length: 999 }, (_, i) => 1 + i * step)
for (const idx of indices) {
  if (idx > LAST_SCORED) break
  const ref = `${framesDir}/f${String(idx).padStart(4, "0")}.png`
  if (!existsSync(ref)) continue
  targets.push({ idx, t: (idx - 1) / 5, ref })
}
if (targets.length === 0) {
  console.error("no reference frames matched")
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
  t: number
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
    timeout: 180000,
  })
  await page.waitForFunction("window.__dt !== undefined", { timeout: 180000 })
  const status = await page.evaluate(() => ({
    ready: window.__dt!.ready,
    error: (window.__dt as { error?: string }).error ?? null,
    duration: window.__dt!.duration,
  }))
  if (!status.ready) {
    console.error("scene failed to boot:", status.error)
    process.exit(1)
  }
  console.log(`scene ${sceneKey}: ${status.duration.toFixed(2)}s · ${targets.length} frames`)

  for (const target of targets) {
    await page.evaluate((tt) => window.__dt!.setT(tt), target.t)
    await new Promise((r) => setTimeout(r, 150))
    const name = `f${String(target.idx).padStart(4, "0")}`
    const raw = `${outDir}/raw-${name}.png`
    await page.screenshot({ path: raw as `${string}.png` })

    // The central 720^2 of the 1280x720 render area, up to 1080^2.
    const shot = `${outDir}/ours-${name}.png`
    const crop = spawnSync("python3", [
      "-c",
      `
import sys
from PIL import Image
img = Image.open(sys.argv[1]).convert("RGB").crop((0, 0, 1280, 720))
left = (1280 - 720) // 2
img.crop((left, 0, left + 720, 720)).resize((1080, 1080), Image.LANCZOS).save(sys.argv[2])
`,
      raw,
      shot,
    ])
    if (crop.status !== 0) {
      console.error(`  ${name} CROP FAILED: ${crop.stderr?.toString().slice(0, 200)}`)
      continue
    }

    const res = spawnSync(
      "python3",
      [`${repoRoot}core/scripts/overlay.py`, shot, target.ref, outDir, "--name", name, "--json"],
      { encoding: "utf8" },
    )
    const line = (res.stdout ?? "").trim().split("\n").pop() ?? "{}"
    try {
      const m = JSON.parse(line) as Omit<FrameReport, "idx" | "t">
      reports.push({ idx: target.idx, t: target.t, ...m })
      console.log(
        `  ${name} t=${target.t.toFixed(1)}s ${m.verdict} cov_ref=${m.coverage_ref} ` +
          `cov_ours=${m.coverage_ours} iou=${m.iou} chamfer=${m.chamfer_ours_px}/${m.chamfer_ref_px}px`,
      )
    } catch {
      console.error(`  ${name} SCORING FAILED: ${res.stderr?.slice(0, 200)}`)
    }
  }
} finally {
  await browser.close()
}

const mean = (pick: (r: FrameReport) => number): number =>
  reports.length ? Number((reports.reduce((a, r) => a + pick(r), 0) / reports.length).toFixed(4)) : 0

const summary = {
  scene: sceneKey,
  frames: reports.length,
  passed: reports.filter((r) => r.verdict === "PASS").length,
  meanCoverageRef: mean((r) => r.coverage_ref),
  meanCoverageOurs: mean((r) => r.coverage_ours),
  meanIoU: mean((r) => r.iou),
  worst: [...reports].sort((a, b) => a.coverage_ref - b.coverage_ref).slice(0, 5),
  reports,
}
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 2))
console.log(
  `\n${sceneKey}: mean coverage_ref=${summary.meanCoverageRef} ` +
    `coverage_ours=${summary.meanCoverageOurs} IoU=${summary.meanIoU} over ${reports.length} frames`,
)
console.log("worst:", summary.worst.map((w) => `f${w.idx}(${w.coverage_ref})`).join(" "))
