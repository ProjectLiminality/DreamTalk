/**
 * state-gate.ts — "every existing scene renders identically", proven on
 * the CPU side, deterministically.
 *
 * For each scene, drives a fixed frame sequence (continuous run-ups into
 * seven marks, then backward jumps) and after every frame hashes EVERYTHING
 * the GPU will receive: each node's matrixWorld, visibility, layer mask and
 * renderOrder; every mesh's userData uniforms and numeric material
 * uniforms; the used range of every geometry buffer (the ribbon batch as
 * an order-free multiset of its LIVE instances — each its table row plus
 * its local segment — since hidden and abandoned slots are MAX-blend
 * no-ops whose stale contents depend on history); and the camera. Equal
 * hashes before and after a change mean equal GPU input, so equal pixels —
 * without the cross-process noise MAX-blended pixels carry.
 *
 *   bun scripts/state-gate.ts <label> [scene...]      capture
 *   bun scripts/state-gate.ts --compare <a> <b>       compare two captures
 *
 * Captures land in .cache/state-gate/. Needs a demo server
 * (GAUNTLET_PORT, default 4190: `bun scripts/serve.ts 4190`). Measured
 * noise floor: the FIRST frame of a mark can differ run to run in a
 * geometry hash (`hg` only) on labyrinth and o01 — an unused buffer tail
 * left by the page's own autoplay before the harness pauses it. Any other
 * difference is real.
 */
import puppeteer from "puppeteer-core"
import { ensureFreshDemoBundle } from "./fresh"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
const DIR = new URL("../../.cache/state-gate", import.meta.url).pathname
mkdirSync(DIR, { recursive: true })
const PORT = Number(process.env.GAUNTLET_PORT ?? 4190)
const argv = process.argv.slice(2)
if (argv[0] === "--compare") {
  const a = JSON.parse(readFileSync(`${DIR}/gate-${argv[1]}.json`, "utf8"))
  const b = JSON.parse(readFileSync(`${DIR}/gate-${argv[2]}.json`, "utf8"))
  let bad = 0, n = 0
  for (const scene of Object.keys(a)) {
    if (!b[scene]) { console.log(scene, "MISSING in", argv[2]); continue }
    const fa = a[scene], fb = b[scene]
    const diffs = fa.map((h: any, i: number) => (JSON.stringify(h) === JSON.stringify(fb[i]) ? null : { i, a: h, b: fb[i] })).filter(Boolean)
    n += fa.length
    bad += diffs.length
    console.log(`${scene.padEnd(12)} ${fa.length} frames  ${diffs.length ? "DIFF " + diffs.length : "IDENTICAL"}`)
    for (const d of diffs.slice(0, 3)) console.log("   ", JSON.stringify(d))
  }
  console.log(bad ? `FAIL ${bad}/${n}` : `PASS ${n}/${n} frames identical`)
  process.exit(bad ? 1 : 0)
}
ensureFreshDemoBundle()
const label = argv[0]!
const scenes = argv.slice(1).length ? argv.slice(1) : ["thewall", "video01", "s06", "s01", "s03", "s04", "o01", "o03", "molocheye", "mindvirus", "labyrinth", "magicmove", "founding", "text", "patience", "agentarena"]
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--headless=new", "--enable-unsafe-webgpu", "--enable-features=WebGPU", "--use-angle=metal", "--window-size=1280,760"],
})
const out: Record<string, unknown[]> = {}
for (const scene of scenes) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720 })
  await page.goto(`http://localhost:${PORT}/demo/?scene=${scene}`, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction("window.__dt && (window.__dt.ready === true || window.__dt.error)", { timeout: 180000 })
  const frames = await page.evaluate(async () => {
    ;(window as any).__dt.pause?.()
    const host = (window as any).__dtHost
    const dur = (window as any).__dt.duration as number
    const h32 = (bytes: Uint8Array, h = 0x811c9dc5) => { for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]!; h = Math.imul(h, 0x01000193) } return h >>> 0 }
    const f64 = new Float64Array(1), u8 = new Uint8Array(f64.buffer)
    const hashNums = (nums: ArrayLike<number>, h: number) => { for (let i = 0; i < nums.length; i++) { f64[0] = nums[i]!; h = h32(u8, h) } return h }
    const seen = new WeakSet()
    const hashFrame = () => {
      let hm = 0x811c9dc5, hu = 0x811c9dc5, hg = 0x811c9dc5, hv = 0x811c9dc5, nodes = 0
      host.scene.traverse((o: any) => {
        nodes++
        hm = hashNums(o.matrixWorld.elements, hm)
        hv = hashNums([o.visible ? 1 : 0, o.layers.mask, o.renderOrder], hv)
        for (const k of Object.keys(o.userData).sort()) { const v = o.userData[k]; hu = typeof v === "number" ? hashNums([v], hu) : v && v.isColor ? hashNums([v.r, v.g, v.b], hu) : hu }
        const g = o.geometry
        if (g && g.attributes.instanceStroke && o.userData.dtBatch) {
          // the ribbon batch, table layout (opt G): an instance is live when
          // its stroke's row has fade ≠ 0; hash each live instance as its
          // row (f32 modelView + style) plus its local endpoints/distances,
          // as an order-free multiset — abandoned runs keep stale history
          const t = o.userData.dtBatch.tableArray, rows = g.attributes.instanceStroke.array
          const pos = g.attributes.instanceStart.data.array, dist = g.attributes.instanceDistanceStart.data.array
          let sum = 0, live = 0
          for (let i = 0; i < g.instanceCount; i++) {
            const r = rows[i] * 24
            if (t[r + 19] === 0) continue
            live++
            let hi = hashNums(t.subarray(r, r + 23), 0x811c9dc5)
            hi = hashNums([pos[i*6], pos[i*6+1], pos[i*6+2], pos[i*6+3], pos[i*6+4], pos[i*6+5], dist[i*2], dist[i*2+1]], hi)
            sum = (sum + hi) >>> 0
          }
          hg = hashNums([sum, live], hg)
        } else if (g && g.attributes.instanceFade && g.attributes.instanceStart) {
          // the ribbon batch: hidden slots (fade 0) are MAX-blend no-ops whose
          // stale positions depend on history — hash only live instances
          const fade = g.attributes.instanceFade.array, n = Math.min(g.instanceCount, fade.length)
          const pos = g.attributes.instanceStart.data.array, dist = g.attributes.instanceDistanceStart.data.array
          const others = ["instanceWidthPx", "instanceDrawn", "instanceErased", "instanceTint"].map((k) => g.attributes[k])
          let sum = 0, live = 0
          for (let i = 0; i < n; i++) {
            if (fade[i] === 0) continue
            live++
            let hi = hashNums([fade[i], pos[i*6], pos[i*6+1], pos[i*6+2], pos[i*6+3], pos[i*6+4], pos[i*6+5], dist[i*2], dist[i*2+1]], 0x811c9dc5)
            for (const a of others) if (a) for (let c = 0; c < a.itemSize; c++) hi = hashNums([a.array[i * a.itemSize + c]], hi)
            sum = (sum + hi) >>> 0
          }
          hg = hashNums([sum, live], hg)
        } else if (g) {
          hg = hashNums([g.instanceCount ?? -1, g.drawRange.start, g.drawRange.count], hg)
          for (const name of Object.keys(g.attributes).sort()) {
            const a = g.attributes[name]; const arr = a.isInterleavedBufferAttribute ? a.data.array : a.array
            if (arr && !seen.has(arr)) {
              seen.add(arr)
              // instanced interleaved data: only the used instances reach a draw
              const used = a.isInterleavedBufferAttribute && a.data.isInstancedInterleavedBuffer && g.instanceCount !== undefined && g.instanceCount !== Infinity
                ? Math.min(arr.length, g.instanceCount * a.data.stride) : arr.length
              hg = h32(new Uint8Array(arr.buffer, arr.byteOffset, used * arr.BYTES_PER_ELEMENT), hg)
            }
          }
          if (g.index && !seen.has(g.index.array)) { seen.add(g.index.array); const arr = g.index.array; hg = h32(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), hg) }
        }
        const m = o.material
        if (m && !Array.isArray(m)) {
          const vals: number[] = []
          for (const k of Object.keys(m).sort()) { const v = m[k]; if (typeof v === "number") vals.push(v); else if (v && typeof v === "object" && "value" in v && typeof v.value === "number") vals.push(v.value) }
          hu = hashNums(vals, hu)
        }
      })
      const c = host.camera
      const hc = hashNums([...c.matrixWorld.elements, ...c.matrixWorldInverse.elements, ...c.projectionMatrix.elements], 0x811c9dc5)
      return { nodes, hm, hu, hg, hv, hc }
    }
    const res: unknown[] = []
    const marks = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.97].map((f) => f * dur)
    // continuous run-up into each mark (playback regime), hashing the last 3 frames
    for (const t of marks) {
      for (let k = 4; k >= 0; k--) { await host.renderFrame(Math.max(0, t - k / 30)); if (k <= 2) res.push({ t: +(t - k / 30).toFixed(4), ...hashFrame() }) }
    }
    // jump regime: backwards jumps
    for (const t of [...marks].reverse()) { await host.renderFrame(t); res.push({ jt: +t.toFixed(4), ...hashFrame() }) }
    return res
  })
  out[scene] = frames
  console.log(scene, frames.length, "frames")
  await page.close()
}
writeFileSync(`${DIR}/gate-${label}.json`, JSON.stringify(out))
await browser.close()
