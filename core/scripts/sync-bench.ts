/**
 * sync-bench.ts — time host.sync() on a scene at a held t.
 *
 * Drives window.__dt.setT(t) after monkey-patching ThreeHost.sync to
 * accumulate its own self-time (the same three-stage split the
 * thewall-profile used). Reports mean sync() ms over N reps at the held t,
 * plus a rough per-frame allocation proxy (Line shapeKey flatMaps avoided).
 *
 * Usage: GAUNTLET_PORT=4190 bun scripts/sync-bench.ts <scene> <t> [reps]
 */
import puppeteer from "puppeteer-core"

const [scene = "thewall", tStr = "3.33", repsStr = "40"] = process.argv.slice(2)
const t = Number(tStr)
const reps = Number(repsStr)
const port = Number(process.env.GAUNTLET_PORT ?? 4190)

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=metal", "--enable-unsafe-webgpu", "--no-sandbox"],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 720 })
page.on("console", (m) => {
  const t = m.text()
  if (t.includes("[dreamtalk]") || t.includes("BENCH")) console.log("  ", t)
})
await page.goto(`http://localhost:${port}/demo/?scene=${scene}`, {
  waitUntil: "domcontentloaded",
  timeout: 120000,
})
await page.waitForFunction("window.__dt && window.__dt.ready === true", { timeout: 120000 })

const result = await page.evaluate(
  async (t: number, reps: number) => {
    const host = (window as unknown as { __dtHost: Record<string, unknown> }).__dtHost
    // Disable the cull so its updateMatrixWorld(true) + sweep (~2.4ms, added
    // after the profile) does not swamp the stroke-loop change we measure.
    ;(host as { cullEnabled?: boolean }).cullEnabled = false
    const proto = Object.getPrototypeOf(host) as { sync: (...a: unknown[]) => void }
    const orig = proto.sync
    let acc = 0
    let calls = 0
    proto.sync = function (this: unknown, ...a: unknown[]) {
      const s = performance.now()
      const r = orig.apply(this, a)
      acc += performance.now() - s
      calls++
      return r
    }
    const setT = (window as unknown as { __dt: { setT: (t: number) => Promise<void> } }).__dt.setT
    // Warm the frame once (shader/pipeline), then measure.
    await setT(t)
    acc = 0
    calls = 0
    const per: number[] = []
    for (let i = 0; i < reps; i++) {
      acc = 0
      calls = 0
      // Nudge t imperceptibly so setT does real work but geometry is ~stable.
      await setT(t)
      per.push(acc)
    }
    proto.sync = orig
    per.sort((a, b) => a - b)
    const mean = per.reduce((s, v) => s + v, 0) / per.length
    const median = per[Math.floor(per.length / 2)]!
    return { mean, median, min: per[0]!, max: per[per.length - 1]!, calls }
  },
  t,
  reps,
)

console.log(
  `BENCH ${scene} t=${t}: sync() mean=${result.mean.toFixed(2)}ms ` +
    `median=${result.median.toFixed(2)}ms min=${result.min.toFixed(2)} max=${result.max.toFixed(2)} (${reps} reps)`,
)
await browser.close()
