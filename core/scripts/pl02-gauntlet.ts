/**
 * pl02-gauntlet.ts — the PL02 fidelity harness, per-SEGMENT rather than
 * per-frame.
 *
 * Usage: bun pl02-gauntlet.ts <sceneKey> <refFrameIdx…> <outDir> [--port P] [--name N]
 *
 * A frame may be given as a bare index (scored against the scene held at
 * `--at`) or as `index@t`, which holds the scene at t instead. The second
 * form is what a MULTI-SEGMENT scene needs: P-3's opening arc runs deck
 * slides 2-6 on one timeline in video seconds, so each segment's settled
 * frame has its own scene time and a single `--at` cannot reach them. For
 * a scene whose clock IS the video's, `index@t` with t = (index−1)/5 is
 * the identity — and writing it out is what makes the correspondence
 * checkable rather than assumed.
 *
 * Why this and not origins-gauntlet.ts: PL02 is a slideshow, not a
 * continuous render. 89% of its frames are identical to their
 * neighbours, 4,021 of 4,517 show no change at all
 * (docs/reports/pl02-vocabulary.md §0), so dense per-frame scoring buys
 * almost nothing and costs a lot. The report's own recommendation is to
 * score at the 59 segment boundaries, picking a settled frame from each
 * hold — which is what this takes: an explicit list of reference frame
 * indices, one or more per segment, each compared against the scene held
 * at a stated time.
 *
 * The viewport gotchas are origins-gauntlet.ts's, and they matter here
 * for the same reason: a 1280x760 window would letterbox the render and
 * the resize to 720 would squash the geometry by 5%, which on this deck
 * is six pixels of circle radius — larger than the thing being measured.
 * So the viewport is forced to a TRUE 1280x720 and the live readout is
 * hidden rather than merely ignored.
 */

import { mkdirSync, existsSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import puppeteer from "puppeteer-core"

const args = process.argv.slice(2)
const flag = (name: string, dflt: string): string => {
  const i = args.indexOf(name)
  return i >= 0 ? (args[i + 1] ?? dflt) : dflt
}
const port = Number(flag("--port", "4571"))
const label = flag("--name", "p1")
const at = Number(flag("--at", "1.0"))
const pos = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"))
const sceneKey = pos[0]
const outDir = pos[pos.length - 1]
/** `12345` → held at `--at`; `12345@27.4` → held at 27.4s. */
const frames = pos.slice(1, -1).map((spec) => {
  const [idx, t] = spec.split("@")
  return { idx: Number(idx), at: t === undefined ? at : Number(t) }
})

const REPO = "/Users/davidrug/RealDealVault/ProjectLiminality/DreamTalk/"
const FRAMES = `${REPO}refs/pitch/pl02/frames5`

if (!sceneKey || frames.length === 0 || !outDir) {
  console.error("usage: bun pl02-gauntlet.ts <scene> <frameIdx…> <outDir> [--at T] [--port P]")
  process.exit(2)
}
mkdirSync(outDir, { recursive: true })

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

interface FrameReport {
  idx: number
  videoSec: number
  /** The scene time the render was held at — see the header's `index@t`. */
  heldAt: number
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
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
  await page.goto(`http://localhost:${port}/demo/?scene=${sceneKey}`, {
    waitUntil: "networkidle0",
    timeout: 30000,
  })
  await page.waitForFunction("window.__dt !== undefined", { timeout: 30000 })
  await page.evaluate(() => {
    const el = document.getElementById("readout")
    if (el) el.style.display = "none"
  })
  const status = await page.evaluate(() => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ready: (window as any).__dt.ready,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: (window as any).__dt.error ?? null,
  }))
  if (!status.ready) {
    console.error("scene failed to boot:", status.error)
    process.exit(1)
  }
  for (const { idx, at: hold } of frames) {
    // Held per frame, not once for the run — see the header's `index@t`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate((t) => (window as any).__dt.setT(t), hold)
    await new Promise((r) => setTimeout(r, 200))
    const ref = `${FRAMES}/f_${String(idx).padStart(5, "0")}.jpg`
    if (!existsSync(ref)) {
      console.error(`  f_${idx}: no reference frame`)
      continue
    }
    const name = `${label}-f_${String(idx).padStart(5, "0")}`
    const shot = `${outDir}/ours-${name}.png`
    await page.screenshot({ path: shot as `${string}.png` })
    const res = spawnSync(
      "python3",
      [`${REPO}core/scripts/overlay.py`, shot, ref, outDir, "--name", name, "--json"],
      { encoding: "utf8" },
    )
    const line = (res.stdout ?? "").trim().split("\n").pop() ?? "{}"
    try {
      const m = JSON.parse(line) as Omit<FrameReport, "idx" | "videoSec" | "heldAt">
      reports.push({ idx, videoSec: (idx - 1) / 5, heldAt: hold, ...m })
      console.log(
        `  f_${idx} (v ${((idx - 1) / 5).toFixed(1)}s) ${m.verdict}` +
          ` cov_ref=${m.coverage_ref} cov_ours=${m.coverage_ours}` +
          ` ch=${m.chamfer_ours_px}/${m.chamfer_ref_px} iou=${m.iou}`,
      )
    } catch {
      console.error(`  f_${idx} SCORING FAILED ${res.stderr?.slice(0, 200)}`)
    }
  }
} finally {
  await browser.close()
}

const passed = reports.filter((r) => r.verdict === "PASS").length
writeFileSync(
  `${outDir}/${label}-summary.json`,
  JSON.stringify({ scene: sceneKey, at, frames: reports.length, passed, reports }, null, 1),
)
console.log(`\n${sceneKey}: ${passed}/${reports.length} PASS`)
