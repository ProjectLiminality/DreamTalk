/**
 * mirror-e2e.ts — the whiteboard page on the tablet's screen, end to end,
 * without the tablet.
 *
 *   bun scripts/mirror-e2e.ts            (needs Docker running and Chrome)
 *
 *   1. serves the REAL whiteboard page (sketch/main.ts, bundled here into
 *      .cache/mirror-e2e) on a private port with a fixture board, and the
 *      daemon's own /ws/display hub (sketch/display.ts `displayHub`);
 *   2. opens it in headless Chrome, light theme, 1 css px per page unit,
 *      selects a stroke and a symbol (frame, handles, ✦ chip), and
 *      screenshots the page rectangle → mac.png;
 *   3. subscribes to /ws/display like the bridge does, and writes the
 *      snapshot it gets as the tablet's wire (one op per line);
 *   4. runs the REAL armv7 dreamtalk-pad on it (tablet/dreamtalk-pad:
 *      ./build.sh e2e in an emulated container) → the page it drew;
 *   5. compares the two pictures: how much of the pad's ink lies on the
 *      Mac's and vice versa (within 3 px), and writes an overlay —
 *      black both, red Mac only, blue pad only.
 *
 * Writes nothing outside .cache/ and tablet/dreamtalk-pad/build/; never
 * touches the running daemon, the repo's boards or the shared bundle.
 */

import puppeteer from "puppeteer-core"
import { mkdirSync, writeFileSync } from "node:fs"
import { displayHub, parseDisplayOps, toLines } from "../sketch/display"
import { PAGE_H, PAGE_W, type DisplayOp } from "../sketch/protocol"
import { serializeBoard } from "../sketch/board"
import type { InkStroke, PlacedSymbol } from "../sketch/protocol"

const repoRoot = new URL("../../", import.meta.url).pathname
const outDir = `${repoRoot}.cache/mirror-e2e`
const padDir = `${repoRoot}tablet/dreamtalk-pad`
mkdirSync(outDir, { recursive: true })

// --- the board -------------------------------------------------------------------

const wave = (id: string, x0: number, y0: number, n: number, amp: number): InkStroke => ({
  id,
  points: Array.from({ length: n }, (_, i) => ({
    x: x0 + i * 9,
    y: y0 + amp * Math.sin(i / 5),
    pressure: 0.25 + 0.6 * (i / n),
    t: i * 8,
  })),
})

const strokes: InkStroke[] = [wave("ink-wave", 120, 1560, 60, 40), wave("ink-sel", 820, 1500, 40, 25)]
const sym = (id: string, symbol: string, params: Record<string, unknown>): PlacedSymbol => ({ id, symbol, params, fromStrokes: [] })
const symbols: PlacedSymbol[] = [
  sym("s-circle", "circle", { cx: 260, cy: 260, r: 140 }),
  sym("s-square", "square", { cx: 700, cy: 260, size: 230, rotation: 0.3 }),
  sym("s-tri", "triangle", { cx: 1130, cy: 280, r: 150, rotation: 0 }),
  sym("s-flower", "flowerOfLife", { cx: 330, cy: 800, r: 95, rings: 1 }),
  sym("s-cube", "cube", { cx: 1000, cy: 760, size: 220, h: 0.6, p: 0.4 }),
  sym("s-eye", "eye", { cx: 330, cy: 1260, size: 300, rotation: 0 }),
  sym("s-figure", "figure", { cx: 1180, cy: 1240, height: 360 }),
  sym("s-virus", "mindVirus", { x: 760, y: 1200, size: 140, heading: 0, fold: 0.8, cable: [[520, 1340], [600, 1300], [640, 1240], [690, 1210]] }),
]
const boardText = serializeBoard({ strokes, symbols })

// --- 1. the page, served ---------------------------------------------------------------

const built = await Bun.build({ entrypoints: [`${repoRoot}core/sketch/main.ts`], outdir: outDir, target: "browser", format: "esm" })
if (!built.success) {
  console.error(built.logs.join("\n"))
  process.exit(1)
}
const html = (await Bun.file(`${repoRoot}core/sketch/index.html`).text()).replace("/core/sketch/dist/main.js", "/__mirror/main.js")

const hub = displayHub()
type Data = { display?: boolean }
const server = Bun.serve<Data>({
  port: 0,
  async fetch(req, srv) {
    const url = new URL(req.url)
    const p = url.pathname
    if (p === "/ws/display") return srv.upgrade(req, { data: { display: true } }) ? undefined : new Response("", { status: 400 })
    if (p === "/ws/pen") return srv.upgrade(req, { data: {} }) ? undefined : new Response("", { status: 400 })
    if (p === "/sketch/" || p === "/sketch") return new Response(html, { headers: { "content-type": "text/html" } })
    if (p.startsWith("/__mirror/")) return new Response(Bun.file(`${outDir}/${p.slice("/__mirror/".length)}`))
    if (p === "/api/boards") return Response.json([])
    if (p.startsWith("/api/board/")) return req.method === "GET" ? new Response(boardText) : new Response("ok")
    const f = Bun.file(repoRoot + decodeURIComponent(p.slice(1)))
    return (await f.exists()) ? new Response(f) : new Response("not found", { status: 404 })
  },
  websocket: {
    open: (ws) => (ws.data.display ? hub.open(ws) : ws.subscribe("pen")),
    message: (ws, raw) => (ws.data.display ? hub.message(ws, raw) : undefined),
    close: (ws) => (ws.data.display ? hub.close(ws) : undefined),
  },
})
const base = `http://localhost:${server.port}`

// --- 2. Chrome draws it ---------------------------------------------------------------

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--headless=new", "--enable-unsafe-webgpu", "--enable-features=WebGPU", "--use-angle=metal", "--hide-scrollbars"],
})
let exit = 0
try {
  const page = await browser.newPage()
  // 1 css px per page unit: the page lays itself out in (W − 32) × (H − 44 − 24).
  await page.setViewport({ width: PAGE_W + 32, height: PAGE_H + 68, deviceScaleFactor: 1 })
  page.on("pageerror", (e) => console.error("page error:", (e as Error).message))
  await page.evaluateOnNewDocument(() => localStorage.setItem("dreamtalk.sketch.dark", "0"))
  await page.goto(`${base}/sketch/?board=mirror-e2e`, { waitUntil: "load", timeout: 60000 })
  type S = { ready?: boolean; symbolsReady?: () => boolean; select: (ids: string[]) => void }
  const sketch = () => (window as unknown as { __sketch: S }).__sketch
  await page.waitForFunction(() => {
    const s = (window as unknown as { __sketch?: { ready?: boolean; symbolsReady?: () => boolean } }).__sketch
    return !!s?.ready && !!s.symbolsReady?.()
  }, { timeout: 60000 })
  await page.evaluate((f) => (eval(f) as () => S)().select(["ink-sel", "s-figure"]), `(${sketch})`)
  await page.waitForFunction(() => (window as unknown as { __sketch: { symbolsReady: () => boolean } }).__sketch.symbolsReady(), { timeout: 60000 })
  await page.evaluate(() => new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 400)))
  const macPng = `${outDir}/mac.png` as `${string}.png`
  await (await page.$("#page"))!.screenshot({ path: macPng })

  // --- 3. what the bridge would receive ---------------------------------------------------

  const ops = await new Promise<DisplayOp[]>((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${server.port}/ws/display`)
    ws.onmessage = (m) => {
      resolve(parseDisplayOps(JSON.parse(String(m.data))))
      ws.close()
    }
    setTimeout(() => reject(new Error("no snapshot on /ws/display — did the page publish?")), 5000)
  })
  const ids = ops.flatMap((o) => (o.op === "put" ? [o.id] : []))
  console.log(`display list: ${ids.length} items — ${ids.join(" ")}`)
  writeFileSync(`${padDir}/build/display.ndjson`, toLines(ops))

  // --- 4. the real pad draws it ---------------------------------------------------------

  const pad = Bun.spawn(["./build.sh", "e2e"], { cwd: padDir, env: { ...process.env, E2E_LIST: "build/display.ndjson" }, stdout: "pipe", stderr: "pipe" })
  const [out, err] = [await new Response(pad.stdout).text(), await new Response(pad.stderr).text()]
  const code = await pad.exited
  process.stdout.write(out.split("\n").filter((l) => /e2e:|FAIL|round trip/.test(l)).map((l) => `pad: ${l}\n`).join(""))
  if (code !== 0) {
    console.error(err.split("\n").filter((l) => /FAIL|error/i.test(l)).join("\n"))
    throw new Error(`pad e2e failed (${code})`)
  }
  const pgm = new Uint8Array(await Bun.file(`${padDir}/build/e2e.pgm`).arrayBuffer())

  // --- 5. compare, in the browser (it decodes PNGs) ---------------------------------------

  const cmp = await browser.newPage()
  const result = await cmp.evaluate(
    async (macB64: string, pgmB64: string, W: number, H: number) => {
      const bytes = Uint8Array.from(atob(pgmB64), (c) => c.charCodeAt(0))
      let off = 0
      for (let lines = 0; lines < 3; off++) if (bytes[off] === 10) lines++
      const padGrey = bytes.subarray(off, off + W * H)
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${macB64}`)).blob())
      const c = new OffscreenCanvas(W, H)
      const g = c.getContext("2d")!
      g.fillStyle = "#fff"
      g.fillRect(0, 0, W, H)
      g.drawImage(img, 0, 0, W, H)
      const mac = g.getImageData(0, 0, W, H).data
      const macInk = new Uint8Array(W * H)
      const padInk = new Uint8Array(W * H)
      for (let i = 0; i < W * H; i++) {
        const lo = Math.min(mac[4 * i]!, mac[4 * i + 1]!, mac[4 * i + 2]!)
        macInk[i] = 255 - lo > 110 ? 1 : 0
        padInk[i] = padGrey[i]! < 150 ? 1 : 0
      }
      // within R px of the other's ink
      const R = 3
      const near = (src: Uint8Array) => {
        const rows = new Uint8Array(W * H)
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            let v = 0
            for (let d = -R; d <= R && !v; d++) {
              const xx = x + d
              if (xx >= 0 && xx < W) v = src[y * W + xx]!
            }
            rows[y * W + x] = v
          }
        const out = new Uint8Array(W * H)
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            let v = 0
            for (let d = -R; d <= R && !v; d++) {
              const yy = y + d
              if (yy >= 0 && yy < H) v = rows[yy * W + x]!
            }
            out[y * W + x] = v
          }
        return out
      }
      const nearMac = near(macInk)
      const nearPad = near(padInk)
      let pad = 0, padOnMac = 0, macN = 0, macOnPad = 0
      const ov = g.createImageData(W, H)
      for (let i = 0; i < W * H; i++) {
        if (padInk[i]) (pad++, (padOnMac += nearMac[i]!))
        if (macInk[i]) (macN++, (macOnPad += nearPad[i]!))
        const [r, gg, b] = macInk[i] && padInk[i] ? [0, 0, 0] : macInk[i] ? [230, 40, 40] : padInk[i] ? [40, 90, 230] : [255, 255, 255]
        ov.data.set([r, gg, b, 255], 4 * i)
      }
      g.putImageData(ov, 0, 0)
      const overlay = await new Promise<string>(async (res) => {
        const fr = new FileReader()
        fr.onload = () => res(String(fr.result).split(",")[1]!)
        fr.readAsDataURL(await c.convertToBlob({ type: "image/png" }))
      })
      // the pad's page as a PNG too
      const pi = g.createImageData(W, H)
      for (let i = 0; i < W * H; i++) pi.data.set([padGrey[i]!, padGrey[i]!, padGrey[i]!, 255], 4 * i)
      g.putImageData(pi, 0, 0)
      const padPng = await new Promise<string>(async (res) => {
        const fr = new FileReader()
        fr.onload = () => res(String(fr.result).split(",")[1]!)
        fr.readAsDataURL(await c.convertToBlob({ type: "image/png" }))
      })
      return { precision: padOnMac / Math.max(1, pad), recall: macOnPad / Math.max(1, macN), pad, mac: macN, overlay, padPng }
    },
    Buffer.from(await Bun.file(macPng).arrayBuffer()).toString("base64"),
    Buffer.from(pgm).toString("base64"),
    PAGE_W,
    PAGE_H,
  )
  writeFileSync(`${outDir}/overlay.png`, Buffer.from(result.overlay, "base64"))
  writeFileSync(`${outDir}/pad.png`, Buffer.from(result.padPng, "base64"))
  const pct = (v: number) => `${(100 * v).toFixed(1)}%`
  console.log(`pad ink on the Mac's: ${pct(result.precision)} of ${result.pad} px · Mac ink on the pad's: ${pct(result.recall)} of ${result.mac} px (±3 px)`)
  console.log(`mac:     ${macPng}\npad:     ${outDir}/pad.png\noverlay: ${outDir}/overlay.png  (black both · red Mac only · blue pad only)`)
  if (result.precision < 0.95 || result.recall < 0.9) exit = 1
} catch (err) {
  console.error("mirror-e2e:", (err as Error).message)
  exit = 1
} finally {
  await browser.close()
  server.stop(true)
}
process.exit(exit)
