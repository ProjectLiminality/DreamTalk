/**
 * pick-gate.ts — the fast picker's gate: same answers as the reference pick,
 * and how much faster.
 *
 *   bun scripts/pick-gate.ts [scene ...] [--port N] [--t T]
 *   e.g. bun scripts/pick-gate.ts gallery flowmap earth hands-test
 *
 * For each scene (the player, free play, settled): a grid of points over the
 * viewport, then points scattered tightly around every grid hit (±12 px —
 * where ink edges and tolerance boundaries are), and the same again after
 * the view turns. At each point `host.pick` (accelerated) must name the same
 * holon as `host.pickReference` (the original, exhaustive pick). Then 3D:
 * `pickNear` at points scattered around real ink and at random in view, and
 * `pickRay` from the eye through a grid and along random (some capped) rays,
 * each against its own `exhaustive` run — same holon, same distance / t.
 * Prints mismatches, and the mean / p95 time of each. Exits 1 on any mismatch.
 */

import puppeteer from "puppeteer-core"

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const port = Number(flag("--port") ?? 4174)
const t = flag("--t")
const scenes = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"))
const list = scenes.length ? scenes : ["gallery", "flowmap", "hands-test"]

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  // The reference pick is the slow one being replaced: thousands of points take minutes.
  protocolTimeout: 1_800_000,
  args: ["--headless=new", "--enable-unsafe-webgpu", "--enable-features=WebGPU", "--use-angle=metal", "--window-size=1280,760"],
})

let failed = false
/** One scene, retried when the daemon reloads the page under us (another agent's edit rebuilt the bundle). */
const measure = async (scene: string) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await measureOnce(scene)
    } catch (err) {
      if (attempt >= 4 || !String(err).includes("navigation")) throw err
      console.log(`  [${scene}] page reloaded mid-run — again (${attempt})`)
    }
  }
}
const measureOnce = async (scene: string) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  page.on("pageerror", (e) => console.log(`  [${scene}] pageerror: ${String(e).slice(0, 160)}`))
  await page.goto(`http://localhost:${port}/demo/?scene=${scene}&play=free${t ? `&t=${t}` : ""}`)
  await page.waitForFunction(() => (window as unknown as { __dtHost?: unknown }).__dtHost, { timeout: 60_000 })
  await new Promise((r) => setTimeout(r, 4000))
  const result = await page.evaluate(async () => {
    type Host = {
      pick(x: number, y: number): { constructor: { name: string }; id?: string } | undefined
      pickReference?(x: number, y: number): unknown
      renderFrame?(t: number): Promise<void>
    }
    const w = window as unknown as { __dtHost: Host; __dtGame?: { view?: { orbit(dx: number, dy: number, w: number): void } } }
    const host = w.__dtHost
    const ref = host.pickReference?.bind(host)
    const points: [number, number][] = []
    for (let i = 0; i < 32; i++) for (let j = 0; j < 20; j++) points.push([-0.97 + (1.94 * (i + 0.5)) / 32, -0.95 + (1.9 * (j + 0.5)) / 20])
    const timeOf = (fn: (x: number, y: number) => unknown, pts: [number, number][]) => {
      const ms: number[] = []
      const out: unknown[] = []
      for (const [x, y] of pts) {
        const t0 = performance.now()
        out.push(fn(x, y))
        ms.push(performance.now() - t0)
      }
      return { out, ms }
    }
    const runs: { label: string; n: number; mismatches: string[]; fast: number[]; slow: number[] }[] = []
    const run = (label: string) => {
      const base = timeOf((x, y) => (ref ?? host.pick.bind(host))(x, y), points)
      // Around every hit, a tight scatter: the edges are where a cull could be wrong.
      const near: [number, number][] = [...points]
      let seed = 7
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
      points.forEach(([x, y], k) => {
        if (!base.out[k]) return
        for (let s = 0; s < 12; s++) near.push([x + (rnd() * 12 * 2) / 1280, y + (rnd() * 12 * 2) / 760])
      })
      const fast = timeOf((x, y) => host.pick(x, y), near)
      const slow = ref ? timeOf((x, y) => ref(x, y), near) : { out: [], ms: [] as number[] }
      const mismatches: string[] = []
      if (ref)
        near.forEach(([x, y], k) => {
          if (fast.out[k] !== slow.out[k]) {
            const name = (h: unknown) => (h ? (h as { constructor: { name: string } }).constructor.name : "∅")
            mismatches.push(`(${x.toFixed(4)}, ${y.toFixed(4)}): fast ${name(fast.out[k])} ≠ reference ${name(slow.out[k])}`)
          }
        })
      runs.push({ label, n: near.length, mismatches, fast: fast.ms, slow: slow.ms })
    }
    // --- 3D: pickNear around real ink and at random, pickRay from the eye and at random ---
    type V = { x: number; y: number; z: number; clone(): V; unproject(c: unknown): V; sub(v: V): V; length(): number; normalize(): V }
    type Host3 = Host & {
      camera: { position: { constructor: new (x: number, y: number, z: number) => V }; getWorldPosition(v: V): V }
      pickNear?(p: V, r: number, o?: { exhaustive?: boolean }): { holon: unknown; distance: number } | undefined
      pickRay?(o: V, d: V, opts?: { exhaustive?: boolean; maxDistance?: number }): { holon: unknown; t: number; at: V } | undefined
    }
    const runs3: { label: string; n: number; mismatches: string[]; fast: number[]; slow: number[] }[] = []
    const run3 = (label: string) => {
      const h = host as Host3
      if (!h.pickNear || !h.pickRay) return
      const V3 = h.camera.position.constructor
      const eye = h.camera.getWorldPosition(new V3(0, 0, 0))
      let seed = 3
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
      const name = (x: unknown) => (x ? (x as { constructor: { name: string } }).constructor.name : "∅")
      const rays: { o: V; d: V; max?: number }[] = []
      for (let i = 0; i < 16; i++)
        for (let j = 0; j < 10; j++) {
          // Near plane to far plane through the pixel: the pixel's own ray, perspective or orthographic.
          const x = -0.95 + (1.9 * (i + 0.5)) / 16
          const y = -0.9 + (1.8 * (j + 0.5)) / 10
          const o = new V3(x, y, -1).unproject(h.camera)
          rays.push({ o, d: new V3(x, y, 1).unproject(h.camera).sub(o).normalize() })
        }
      const hits = rays.map((r) => h.pickRay!(r.o, r.d, { exhaustive: true })).filter((x) => x) as { t: number; at: V }[]
      const scale = hits.length ? hits.reduce((s, x) => s + x.t, 0) / hits.length : 1000
      // random rays from points near the scene, and capped rays
      for (let k = 0; k < 60; k++) {
        const o = new V3(eye.x + rnd() * scale * 0.3, eye.y + rnd() * scale * 0.3, eye.z + rnd() * scale * 0.3)
        const target = hits[k % Math.max(1, hits.length)]?.at ?? new V3(0, 0, 0)
        rays.push({ o, d: target.clone().sub(o).normalize(), max: k % 2 ? target.clone().sub(o).length() * 0.98 : undefined })
      }
      const radius = scale * 0.03
      const points: V[] = []
      for (const x of hits) for (let s = 0; s < 6; s++) points.push(new V3(x.at.x + rnd() * radius * 1.5, x.at.y + rnd() * radius * 1.5, x.at.z + rnd() * radius * 1.5))
      for (let k = 0; k < 120; k++) points.push(new V3(rnd(), rnd(), 0.2 + 0.7 * Math.abs(rnd())).unproject(h.camera))
      const mismatches: string[] = []
      const fast: number[] = []
      const slow: number[] = []
      const same = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a))
      for (const p of points) {
        let t0 = performance.now()
        const f = h.pickNear!(p, radius)
        fast.push(performance.now() - t0)
        t0 = performance.now()
        const e = h.pickNear!(p, radius, { exhaustive: true })
        slow.push(performance.now() - t0)
        if (f?.holon !== e?.holon || (f && e && !same(f.distance, e.distance)))
          mismatches.push(`near (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}): fast ${name(f?.holon)} ${f?.distance} ≠ exhaustive ${name(e?.holon)} ${e?.distance}`)
      }
      runs3.push({ label: `${label} · pickNear r=${radius.toFixed(1)}`, n: points.length, mismatches: [...mismatches], fast: [...fast], slow: [...slow] })
      mismatches.length = 0
      fast.length = 0
      slow.length = 0
      for (const r of rays) {
        let t0 = performance.now()
        const f = h.pickRay!(r.o, r.d, { maxDistance: r.max })
        fast.push(performance.now() - t0)
        t0 = performance.now()
        const e = h.pickRay!(r.o, r.d, { maxDistance: r.max, exhaustive: true })
        slow.push(performance.now() - t0)
        if (f?.holon !== e?.holon || (f && e && !same(f.t, e.t)))
          mismatches.push(`ray: fast ${name(f?.holon)} t=${f?.t} ≠ exhaustive ${name(e?.holon)} t=${e?.t}`)
      }
      runs3.push({ label: `${label} · pickRay`, n: rays.length, mismatches, fast, slow })
    }
    run("home view")
    run3("home view")
    const view = w.__dtGame?.view
    if (view) {
      view.orbit(220, 90, 1280)
      await new Promise((r) => setTimeout(r, 600))
      run("turned view")
      run3("turned view")
    }
    return [...runs, ...runs3]
  })
  await page.close()
  return result
}
for (const scene of list) {
  const result = await measure(scene)
  const stat = (a: number[]) => {
    if (!a.length) return "—"
    const s = [...a].sort((x, y) => x - y)
    return `mean ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2)} ms · p95 ${s[Math.floor(0.95 * (s.length - 1))]!.toFixed(2)} ms`
  }
  for (const r of result) {
    console.log(`${scene} · ${r.label} · ${r.n} points · fast ${stat(r.fast)} · reference ${stat(r.slow)} · mismatches ${r.mismatches.length}`)
    for (const m of r.mismatches.slice(0, 8)) console.log(`    ${m}`)
    if (r.mismatches.length) failed = true
  }
}
await browser.close()
process.exit(failed ? 1 : 0)
