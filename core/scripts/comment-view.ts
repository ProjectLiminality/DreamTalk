/**
 * comment-view.ts — render exactly what a comment points at.
 *
 * EDITOR-VOICE-COMMENTS step 3 (the auto-render-into-context), built as the
 * OPERATING AGENT's tool rather than a daemon endpoint: a comment already
 * stores its scene, timeline `t`, and the selection's screen `bounds`
 * (core/.comments/<scene>.jsonl), so the rendered crop is a pure function of
 * those. This renders the DEMO scene (chromeless — no editor UI, no marquee)
 * at the comment's t and crops to its bounds, so Claude sees precisely the
 * ink the note is about.
 *
 * Usage:
 *   bun scripts/comment-view.ts <scene>            # newest comment for scene
 *   bun scripts/comment-view.ts <scene> <id>       # a specific comment id
 *   bun scripts/comment-view.ts <scene> --all      # every comment, one png each
 *
 * Output: docs/reports/comments/<scene>-<id>.png (+ a one-line index printed
 * so the agent can Read the right file). The full-frame is saved alongside the
 * crop when bounds are absent (a scene-level comment with no selection).
 */
import puppeteer from "puppeteer-core"
import { mkdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const REPO = join(import.meta.dir, "..", "..")
const CORE = join(import.meta.dir, "..")
const PORT = process.env.DT_PORT ?? "4174"

interface Comment {
  path: unknown
  pathLabel: string
  text: string
  t: number
  scene: string
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null
  id: string
  ts: string
}

const [scene, arg] = process.argv.slice(2)
if (!scene) {
  console.error("usage: bun scripts/comment-view.ts <scene> [<id> | --all]")
  process.exit(2)
}

const file = join(CORE, ".comments", `${scene}.jsonl`)
if (!existsSync(file)) {
  console.error(`no comments for scene '${scene}' (${file} missing)`)
  process.exit(1)
}
const all: Comment[] = readFileSync(file, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as Comment)

const targets =
  arg === "--all" ? all : arg ? all.filter((c) => c.id === arg) : all.slice(-1)
if (targets.length === 0) {
  console.error(arg ? `no comment with id '${arg}'` : "no comments")
  process.exit(1)
}

const outDir = join(REPO, "docs", "reports", "comments")
mkdirSync(outDir, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--headless=new",
    "--enable-unsafe-webgpu",
    "--enable-features=WebGPU",
    "--use-angle=metal",
    "--window-size=1280,720",
  ],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 720 })
// The chromeless DEMO — the ink only, exactly what the comment's bounds were
// measured against (the editor draws the marquee/gizmo on an OVERLAY, so the
// demo canvas and the editor canvas paint identical pixels for the same t).
await page.goto(`http://localhost:${PORT}/demo/?scene=${scene}`, {
  waitUntil: "networkidle0",
  timeout: 60000,
})
await page.waitForFunction("window.__dt && window.__dt.ready", { timeout: 60000 })

for (const c of targets) {
  await page.evaluate((t) => (window as unknown as { __dt: { setT(t: number): void } }).__dt.setT(t), c.t)
  await new Promise((r) => setTimeout(r, 200))
  const out = join(outDir, `${scene}-${c.id}.png`)
  if (c.bounds) {
    // Pad the crop a little so the selected ink has breathing room, clamped
    // to the frame. bounds are in render pixels (host.boundsOf), same space
    // as the demo canvas.
    const pad = 24
    const x = Math.max(0, Math.floor(c.bounds.minX - pad))
    const y = Math.max(0, Math.floor(c.bounds.minY - pad))
    const w = Math.min(1280 - x, Math.ceil(c.bounds.maxX - c.bounds.minX + 2 * pad))
    const h = Math.min(720 - y, Math.ceil(c.bounds.maxY - c.bounds.minY + 2 * pad))
    await page.screenshot({ path: out as `${string}.png`, clip: { x, y, width: Math.max(1, w), height: Math.max(1, h) } })
  } else {
    await page.screenshot({ path: out as `${string}.png` })
  }
  // The line the agent reads: what/where/when + the file to open.
  console.log(
    `[${c.pathLabel} @ ${c.t.toFixed(2)}s] "${c.text}" → ${out}`,
  )
}

await browser.close()
