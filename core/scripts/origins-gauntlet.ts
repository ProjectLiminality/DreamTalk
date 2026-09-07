/**
 * ogauntlet.ts — gauntlet.ts adapted to the ORIGINS reference frames.
 *
 * Differences from core/scripts/gauntlet.ts:
 *   - frames live in refs/pitch/origins/frames5 as f_%05d.jpg (not f%04d.png)
 *   - the scene's t0 is the source's audio offset, so localT = videoSec - t0
 *   - viewport forced to a TRUE 1280x720 and #readout hidden
 *
 * Usage: bun ogauntlet.ts <sceneKey> <t0> <startSec> <endSec> <outDir> [--step N] [--port P]
 */
import { mkdirSync, existsSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import puppeteer from "puppeteer-core"

const args = process.argv.slice(2)
const num = (flag: string, dflt: number): number => {
  const i = args.indexOf(flag)
  return i >= 0 ? Number(args[i + 1]) : dflt
}
const step = num("--step", 5)
const port = num("--port", 4460)
const pos = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"))
const [sceneKey, t0Str, startStr, endStr, outDir] = pos
const t0 = Number(t0Str)
const startSec = Number(startStr)
const endSec = Number(endStr)
const repoRoot = "/Users/davidrug/RealDealVault/ProjectLiminality/DreamTalk/"
const framesDir = `${repoRoot}refs/pitch/origins/frames5`
mkdirSync(outDir!, { recursive: true })

const targets: { videoSec: number; localT: number; ref: string; idx: number }[] = []
for (let idx = Math.round(startSec * 5); idx <= Math.round(endSec * 5); idx += step) {
  const ref = `${framesDir}/f_${String(idx).padStart(5, "0")}.jpg`
  if (!existsSync(ref)) continue
  targets.push({ videoSec: idx / 5, localT: idx / 5 - t0, ref, idx })
}
if (targets.length === 0) { console.error("no reference frames"); process.exit(2) }

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--headless=new", "--enable-unsafe-webgpu", "--enable-features=WebGPU",
         "--use-angle=metal", "--hide-scrollbars", "--window-size=1280,720"],
})

interface FrameReport {
  idx: number; videoSec: number; localT: number
  iou: number; chamfer_ours_px: number; chamfer_ref_px: number
  coverage_ref: number; coverage_ours: number; verdict: string
}
const reports: FrameReport[] = []

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
  await page.goto(`http://localhost:${port}/demo/?scene=${sceneKey}`, { waitUntil: "networkidle0", timeout: 30000 })
  await page.waitForFunction("window.__dt !== undefined", { timeout: 30000 })
  // THE GOTCHA: the readout is live text at the bottom of the frame and
  // scores as ink. Hide it rather than relying on --ignore-bottom alone.
  await page.evaluate(() => { const el = document.getElementById("readout"); if (el) el.style.display = "none" })
  const status = await page.evaluate(() => ({
    ready: (window as any).__dt.ready,
    error: (window as any).__dt.error ?? null,
    duration: (window as any).__dt.duration,
  }))
  if (!status.ready) { console.error("scene failed to boot:", status.error); process.exit(1) }
  console.log(`scene ${sceneKey}: ${status.duration.toFixed(2)}s · ${targets.length} frames`)

  for (const target of targets) {
    await page.evaluate((tt) => (window as any).__dt.setT(tt), target.localT)
    await new Promise((r) => setTimeout(r, 120))
    const name = `f_${String(target.idx).padStart(5, "0")}`
    const shot = `${outDir}/ours-${name}.png`
    await page.screenshot({ path: shot as `${string}.png` })
    const res = spawnSync("python3", [
      `${repoRoot}core/scripts/overlay.py`, shot, target.ref, outDir!,
      "--name", name, "--ignore-bottom", "40", "--json",
    ], { encoding: "utf8" })
    const line = (res.stdout ?? "").trim().split("\n").pop() ?? "{}"
    try {
      const m = JSON.parse(line) as Omit<FrameReport, "idx" | "videoSec" | "localT">
      reports.push({ idx: target.idx, videoSec: target.videoSec, localT: target.localT, ...m })
      console.log(`  t=${target.localT.toFixed(2)} (v ${target.videoSec.toFixed(1)}) ${m.verdict} ` +
        `cov_ref=${m.coverage_ref} cov_ours=${m.coverage_ours} ch=${m.chamfer_ours_px}/${m.chamfer_ref_px}`)
    } catch { console.error(`  t=${target.localT.toFixed(2)} SCORING FAILED ${res.stderr?.slice(0, 200)}`) }
  }
} finally { await browser.close() }

const passed = reports.filter((r) => r.verdict === "PASS").length
const summary = {
  scene: sceneKey, t0, frames: reports.length, passed,
  meanCoverageRef: Number((reports.reduce((a, r) => a + r.coverage_ref, 0) / reports.length).toFixed(4)),
  meanCoverageOurs: Number((reports.reduce((a, r) => a + r.coverage_ours, 0) / reports.length).toFixed(4)),
  reports,
}
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 1))
console.log(`\n${sceneKey}: ${passed}/${reports.length} PASS · mean cov ref=${summary.meanCoverageRef} ours=${summary.meanCoverageOurs}`)
