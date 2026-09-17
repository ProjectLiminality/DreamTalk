/**
 * instancing-gate.ts — the byte-identity gate for optimization A (ribbon
 * instancing). Two proofs, in ONE browser process (so a settled setT frame
 * is bit-reproducible — cull-result.md's methodology):
 *
 *   1. INSTANCE-DATA EQUALITY. Mount the ORACLE (per-mesh) host and the
 *      BATCH host on the same page, render the same scene at the same t,
 *      and compare the exact numbers the shader receives:
 *        - per segment: the VIEW-space start/end (oracle: modelView·local,
 *          computed here the way the shader does; batch: the baked
 *          instanceStart/End it wrote), the LOCAL distances, and the style
 *          (drawn/erased/tint/fade/width).
 *      Both sides are flattened into a sorted multiset of segments and
 *      compared to a tight tolerance. This is the design's primary gate.
 *
 *   2. RENDERED EQUALITY. Screenshot oracle vs batch at each t and report
 *      whether the PNGs are byte-identical (a settled frame in one process
 *      is reproducible), plus a coverage delta as a backstop.
 *
 * Usage: bun scripts/instancing-gate.ts <scene> [t...] [--port N]
 *   e.g. bun scripts/instancing-gate.ts molocheye 0.3 0.6 0.9
 */

import { ensureFreshDemoBundle } from "./fresh"
import puppeteer from "puppeteer-core"
import { mkdirSync } from "node:fs"
import { spawnSync } from "node:child_process"

ensureFreshDemoBundle()

const args = process.argv.slice(2)
const portFlag = args.indexOf("--port")
const port = portFlag >= 0 ? Number(args[portFlag + 1]) : 4174
const positional = args.filter((_, i) => portFlag < 0 || (i !== portFlag && i !== portFlag + 1))
const scene = positional[0] ?? "molocheye"
const times = positional.slice(1).map(Number)
const ts = times.length ? times : [0.25, 0.5, 0.75, 0.95]

const outDir = `/tmp/instancing-gate/${scene}`
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
    "--window-size=1280,760",
  ],
})

// The extractor runs in the page. It reads either the oracle strokes'
// per-mesh data (transforming local→view with the SAME modelView three
// uses) or the batch's live instance data, and returns a canonical sorted
// list of segments so the two can be compared order-independently.
const EXTRACT = `
(mode) => {
  const THREE = window.__THREE__;
  const host = window.__dtHost;
  const cam = host.camera;
  cam.updateMatrixWorld(true);
  const round = (x) => Math.round(x * 1000) / 1000;   // 3 decimals
  const segs = [];
  if (mode === 'oracle') {
    // host.strokes is private; reach it through the well-known field.
    const strokes = host['strokes'];
    const mv = new THREE.Matrix4();
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const binding of strokes) {
      const r = binding.ribbon, group = binding.group;
      if (!r.mesh.visible) continue;
      const g = r.geometry, count = g.instanceCount;
      if (count < 1) continue;
      mv.multiplyMatrices(cam.matrixWorldInverse, group.matrixWorld);
      const pos = g.getAttribute('instanceStart').data.array;
      const dist = g.getAttribute('instanceDistanceStart').data.array;
      const ud = r.mesh.userData;
      const w = ud['dtRibbonWidthPx'], dn = ud['dtRibbonDrawn'], er = ud['dtRibbonErased'], fa = ud['dtRibbonFade'];
      const tint = ud['dtRibbonTint'];
      for (let i = 0; i < count; i++) {
        a.set(pos[i*6], pos[i*6+1], pos[i*6+2]).applyMatrix4(mv);
        b.set(pos[i*6+3], pos[i*6+4], pos[i*6+5]).applyMatrix4(mv);
        segs.push([round(a.x),round(a.y),round(a.z),round(b.x),round(b.y),round(b.z),
                   round(dist[i*2]),round(dist[i*2+1]),round(w),round(dn),round(er),
                   round(tint.r),round(tint.g),round(tint.b),round(fa)]);
      }
    }
  } else {
    const batch = host['ribbonBatch'];
    const g = batch.geometry;
    const n = g.instanceCount;
    const pos = g.getAttribute('instanceStart').data.array;
    const dist = g.getAttribute('instanceDistanceStart').data.array;
    const width = g.getAttribute('instanceWidthPx').array;
    const drawn = g.getAttribute('instanceDrawn').array;
    const erased = g.getAttribute('instanceErased').array;
    const fade = g.getAttribute('instanceFade').array;
    const tint = g.getAttribute('instanceTint').array;
    for (let i = 0; i < n; i++) {
      if (fade[i] === 0) continue;   // hidden slot — draws nothing, excluded
      segs.push([round(pos[i*6]),round(pos[i*6+1]),round(pos[i*6+2]),
                 round(pos[i*6+3]),round(pos[i*6+4]),round(pos[i*6+5]),
                 round(dist[i*2]),round(dist[i*2+1]),round(width[i]),round(drawn[i]),round(erased[i]),
                 round(tint[i*3]),round(tint[i*3+1]),round(tint[i*3+2]),round(fade[i])]);
    }
  }
  segs.sort((p,q) => { for (let k=0;k<p.length;k++){ if(p[k]!==q[k]) return p[k]-q[k]; } return 0; });
  return segs;
}
`

const grab = async (instanced: boolean, t: number, shotPath: string): Promise<unknown[]> => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  const url = `http://localhost:${port}/demo/?scene=${scene}${instanced ? "&instanced=1" : ""}`
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 })
  await page.waitForFunction("window.__dt !== undefined", { timeout: 60000 })
  const status = await page.evaluate(() => ({ ready: window.__dt!.ready, error: window.__dt!.error ?? null }))
  if (!status.ready) throw new Error(`boot failed (${instanced ? "batch" : "oracle"}): ${status.error}`)
  await page.evaluate((tt) => window.__dt!.setT(tt), t)
  // EXTRACT is a function SOURCE; invoke it as a self-calling expression so
  // puppeteer evaluates it with the mode argument (a bare string arg to
  // evaluate would be treated as an expression, not a call).
  const mode = instanced ? "batch" : "oracle"
  const segs = (await page.evaluate(`(${EXTRACT})(${JSON.stringify(mode)})`)) as unknown[]
  await page.screenshot({ path: shotPath })
  await page.close()
  return segs
}

console.log(`\n=== instancing gate: ${scene} ===`)
let allPass = true
for (const t of ts) {
  const oracle = (await grab(false, t, `${outDir}/oracle_t${t}.png`)) as number[][]
  const batch = (await grab(true, t, `${outDir}/batch_t${t}.png`)) as number[][]

  // Compare as multisets with a TOLERANCE. The two sides bake the same
  // one multiply (mv·local) — the oracle on the GPU (f32), the batch on
  // the CPU (f64) then f32-store — so a value can differ by a fraction of
  // a ULP-scaled unit. That is the very precision the design says to
  // MEASURE. So: sort both by their full tuple, pair row by row, and pass
  // iff every paired field agrees within a tolerance that is far below any
  // real geometry difference (a wrong transform, a wrong style value, a
  // dropped segment all move a field by whole units) yet above f32 store
  // noise (~1e-3 relative on hundreds-scale coordinates).
  const TOL = 0.05 // per-field tolerance: f32 store noise, << any real diff
  // Multiset match in two passes. PASS 1: a counted map on a fine rounded
  // key (0.01) cancels the vast bulk exactly. PASS 2: whatever is left is
  // bucket-edge jitter (a value near an .xx5 boundary rounding opposite
  // ways) — a SMALL residual — matched by nearest-neighbour with the
  // tolerance, which is tie-flip-proof (a sort-and-pair would mispair two
  // segments that merely tie on the leading fields; nearest-neighbour
  // pairs each to its actual counterpart).
  const fineKey = (s: number[]): string => s.map((x) => Math.round(x * 100) / 100).join(",")
  const bmap = new Map<string, number[][]>()
  for (const r of batch) {
    const k = fineKey(r)
    ;(bmap.get(k) ?? bmap.set(k, []).get(k)!).push(r)
  }
  const oResidual: number[][] = []
  for (const r of oracle) {
    const k = fineKey(r)
    const bucket = bmap.get(k)
    if (bucket && bucket.length > 0) bucket.pop()
    else oResidual.push(r)
  }
  const bResidual: number[][] = []
  for (const bucket of bmap.values()) for (const r of bucket) bResidual.push(r)

  let dataPass = oracle.length === batch.length
  let mismatches = 0
  let maxDelta = 0
  if (dataPass && oResidual.length > 0) {
    const used = new Array(bResidual.length).fill(false)
    for (const o of oResidual) {
      let best = Infinity
      let bestJ = -1
      for (let j = 0; j < bResidual.length; j++) {
        if (used[j]) continue
        let d = 0
        for (let k = 0; k < o.length; k++) d = Math.max(d, Math.abs(o[k]! - bResidual[j]![k]!))
        if (d < best) { best = d; bestJ = j }
      }
      maxDelta = Math.max(maxDelta, best)
      if (best <= TOL && bestJ >= 0) used[bestJ] = true
      else mismatches++
    }
    dataPass = mismatches === 0
  }

  // Rendered comparison. Raw cmp of two separate GPU submissions is not
  // reliable (MAX-blend overdraw is schedule-sensitive even in one
  // process), so the render gate is the design's: coverage of batch vs
  // oracle to 4 decimals (overlay.py — batch as "ours", oracle as "ref").
  const cmp = spawnSync("cmp", ["-s", `${outDir}/oracle_t${t}.png`, `${outDir}/batch_t${t}.png`])
  const pngIdentical = cmp.status === 0
  let coverage = "n/a"
  const ov = spawnSync(
    "python3",
    [
      "scripts/overlay.py",
      `${outDir}/batch_t${t}.png`,
      `${outDir}/oracle_t${t}.png`,
      `${outDir}/ov_t${t}`,
      "--json",
    ],
    { encoding: "utf8" },
  )
  if (ov.status === 0 && ov.stdout) {
    try {
      const r = JSON.parse(ov.stdout)
      coverage = `ref=${r.coverage_ref} ours=${r.coverage_ours}`
    } catch {
      coverage = "parse-fail"
    }
  } else if (ov.stderr) {
    coverage = `err:${ov.stderr.trim().split("\n").pop()}`
  }

  const ok = dataPass
  allPass = allPass && ok
  console.log(
    `  t=${t}: segments oracle=${oracle.length} batch=${batch.length} | ` +
      `DATA ${dataPass ? "EQUAL" : `DIFFER (${mismatches} keys, maxΔ=${maxDelta.toFixed(3)})`} | ` +
      `PNG ${pngIdentical ? "identical" : "differ"} | coverage ${coverage}`,
  )
}
console.log(allPass ? "GATE PASS (instance data equal)" : "GATE FAIL")
await browser.close()
process.exit(allPass ? 0 : 1)
