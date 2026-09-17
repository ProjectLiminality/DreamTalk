/**
 * instancing-perf.ts — the WIN measurement for optimization A.
 *
 * For a scene, at several t, measures render-ms and draw-call count
 * (renderer.info.render.calls) with the per-mesh oracle (instanced off)
 * and the batch (instanced on), in the SAME browser process for a fair
 * comparison. Render-ms is the self-time of renderer.render, taken as the
 * median of several CONTINUOUS-advance repetitions (the hump only appears
 * under continuous playback — hump-diagnosis.md), plus a held-frame floor.
 *
 * Usage: bun scripts/instancing-perf.ts <scene> [t...] [--port N] [--reps R]
 */

import { ensureFreshDemoBundle } from "./fresh"
import puppeteer from "puppeteer-core"

ensureFreshDemoBundle()

const args = process.argv.slice(2)
const num = (flag: string, def: number): number => {
  const i = args.indexOf(flag)
  return i >= 0 ? Number(args[i + 1]) : def
}
const port = num("--port", 4180)
const reps = num("--reps", 12)
const positional = args.filter(
  (a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1]!.startsWith("--")),
)
const scene = positional[0] ?? "thewall"
const ts = positional.slice(1).map(Number)

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

// Measure a scene, instanced on/off, in its own page. Instruments
// renderer.render self-time and reads renderer.info.render.calls.
const measure = async (
  instanced: boolean,
): Promise<{ perFrame: { t: number; median: number; calls: number }[]; duration: number }> => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  const url = `http://localhost:${port}/demo/?scene=${scene}${instanced ? "&instanced=1" : ""}`
  await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 })
  await page.waitForFunction("window.__dt !== undefined", { timeout: 120000 })
  const status = await page.evaluate(() => ({ ready: window.__dt!.ready, error: window.__dt!.error ?? null, duration: window.__dt!.duration }))
  if (!status.ready) throw new Error(`boot failed (${instanced ? "batch" : "oracle"}): ${status.error}`)

  // Instrument render self-time on the host in-page.
  await page.evaluate(() => {
    const host = window.__dtHost as unknown as {
      renderer: { render: (...a: unknown[]) => Promise<void>; info: { render: { calls: number } } }
      __renderMs?: number
      __renderCalls?: number
    }
    const orig = host.renderer.render.bind(host.renderer)
    host.renderer.render = async (...a: unknown[]) => {
      const s = performance.now()
      await orig(...a)
      host.__renderMs = performance.now() - s
      host.__renderCalls = host.renderer.info.render.calls
    }
  })

  const duration = status.duration
  const times = ts.length ? ts : [0.2, duration * 0.2, duration * 0.33, duration * 0.5, duration * 0.75, duration * 0.95]
  const perFrame: { t: number; median: number; calls: number }[] = []
  for (const t of times) {
    // CONTINUOUS advance: step a few frames up to t so the hump regime is
    // entered the way playback enters it, then measure the frame at t.
    const samples: number[] = []
    let calls = 0
    for (let r = 0; r < reps; r++) {
      const res = (await page.evaluate(async (tt) => {
        const host = window.__dtHost as unknown as { renderFrame: (t: number) => Promise<void>; __renderMs?: number; __renderCalls?: number }
        // Advance a few 30fps steps into t (continuous), measuring the last.
        for (let k = 4; k >= 1; k--) await host.renderFrame(Math.max(0, tt - k / 30))
        await host.renderFrame(tt)
        return { ms: host.__renderMs ?? 0, calls: host.__renderCalls ?? 0 }
      }, t)) as { ms: number; calls: number }
      samples.push(res.ms)
      calls = res.calls
    }
    samples.sort((a, b) => a - b)
    perFrame.push({ t, median: samples[Math.floor(samples.length / 2)]!, calls })
  }
  await page.close()
  return { perFrame, duration }
}

console.log(`\n=== instancing perf: ${scene} (reps=${reps}) ===`)
const oracle = await measure(false)
const batch = await measure(true)
console.log("  t       | oracle ms | batch ms | oracle calls | batch calls | speedup")
for (let i = 0; i < oracle.perFrame.length; i++) {
  const o = oracle.perFrame[i]!
  const b = batch.perFrame[i]!
  console.log(
    `  ${o.t.toFixed(2).padStart(7)} | ${o.median.toFixed(1).padStart(9)} | ${b.median
      .toFixed(1)
      .padStart(8)} | ${String(o.calls).padStart(12)} | ${String(b.calls).padStart(11)} | ${(
      o.median / Math.max(b.median, 0.001)
    ).toFixed(2)}x`,
  )
}
const oFloor = Math.min(...oracle.perFrame.map((f) => f.median))
const oHump = Math.max(...oracle.perFrame.map((f) => f.median))
const bFloor = Math.min(...batch.perFrame.map((f) => f.median))
const bHump = Math.max(...batch.perFrame.map((f) => f.median))
console.log(`\n  oracle: floor ${oFloor.toFixed(1)}ms (${(1000 / oFloor).toFixed(0)}fps) hump ${oHump.toFixed(1)}ms (${(1000 / oHump).toFixed(0)}fps)`)
console.log(`  batch : floor ${bFloor.toFixed(1)}ms (${(1000 / bFloor).toFixed(0)}fps) hump ${bHump.toFixed(1)}ms (${(1000 / bHump).toFixed(0)}fps)`)
await browser.close()
