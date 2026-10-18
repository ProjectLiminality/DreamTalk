/**
 * hands-nest-check.ts — the hands inside a nested level, end to end in the
 * player (daemon at :4174): a Figure is summoned into hands-test and
 * unpacked (editor/nest.ts — a symbol with no song of its own opens beside
 * its StateLattice); a simulated right hand points at the lattice node the
 * Figure is NOT at and pinches it — the spark must be the LEVEL's (none on
 * the scene beneath), the node fires its position and the Figure walks
 * there, the scene beneath fires nothing; then Esc closes the level and the
 * hands aim at the scene again. Prints one JSON line; exits 1 on a failure.
 *
 *   bun scripts/hands-nest-check.ts [screenshot.png]
 */
import puppeteer from "puppeteer-core"
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--headless=new", "--enable-unsafe-webgpu", "--enable-features=WebGPU", "--use-angle=metal", "--window-size=1280,720"] })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 })
page.on("pageerror", (e) => console.log("[pageerror]", e.message))
await page.goto(`http://localhost:4174/demo/?scene=hands-test&play=free&hud=0`, { waitUntil: "load", timeout: 180000 })
await page.waitForFunction("window.__dtHands && window.__dtNest && window.__dt?.ready && window.__dtGame?.game?.on", { timeout: 180000 })
await new Promise((r) => setTimeout(r, 1000))
const out = await page.evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const N = __dtNest, H = __dtHands, outer = __dtGame.game
  const summoned = __dtSummon.summon("Figure")
  await sleep(1500)
  await N.unpack(summoned.holon)
  await sleep(2500)
  const top = N.top()
  if (!top) return "no level"
  if (!top.game.on) { top.game.enter?.(0) }
  const roots = top.host.dream.roots
  const lattice = roots.find((r) => r.constructor.name === "StateLattice")
  const symbol = roots.find((r) => r.constructor.name === "Figure")
  if (!symbol || !lattice) return JSON.stringify({ roots: roots.map((r) => r.constructor.name), keys: Object.keys(top.host.dream) })
  const d = lattice.drawn.find((x) => x.factor.label === "Figure")
  const axis = d.factor.axes[0]
  const valueNow = () => [...axis.positions[0].values.keys()][0].value
  const atStart = valueNow()
  // The node the figure is NOT at.
  const other = axis.positions.findIndex((p) => [...p.values.values()][0] !== atStart)
  const closed = d.nodes[other]
  const c = top.canvas, rect = c.getBoundingClientRect(), b = top.host.boundsOf(closed)
  const dpr = c.width / rect.width
  const cx = rect.left + (b.min.x + b.max.x) / 2 / dpr, cy = rect.top + (b.min.y + b.max.y) / 2 / dpr
  // A right hand whose thumb-weighted point stands at (sx, sy) in the level's canvas, fingers this far apart.
  const sx = (cx - rect.left) / rect.width, sy = (cy - rect.top) / rect.height
  const w = H.calibration.w
  let t = 0
  const hand = (gap) => { const v = gap * 0.1; const T = [sx - (1 - w) * v, sy, 0], I = [sx + w * v, sy, 0]
    const j = Array.from({ length: 21 }, () => [sx, sy + 0.05, 0]); j[4] = T; j[8] = I
    return { t: (t++) / 60, source: "test", aspect: 1, hands: [{ id: 3, side: "right", confidence: 1, scale: 0.1, gap, reach: 0.9, joints: j }] } }
  const before = { form: valueNow(), target: axis.positions[other].name }
  for (let k = 0; k < 20; k++) { H.push(hand(0.7)); await sleep(16) }
  const hover = { sparkOnLevel: !!top.game.spark, sparkOnOuter: !!outer.spark, hovered: top.game.hovered?.constructor.name }
  for (let k = 0; k <= 10; k++) { H.push(hand(0.7 - 0.6 * k / 10)); await sleep(16) }
  for (let k = 0; k <= 10; k++) { H.push(hand(0.1 + 0.6 * k / 10)); await sleep(16) }
  await sleep(1800)
  const after = { form: valueNow(), journal: top.game.automaton.journal.map((j) => j.axis + "→" + j.position), outerJournal: outer.automaton.journal.length }
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }))
  await sleep(2500)
  for (let k = 0; k < 10; k++) { H.push(hand(0.7)); await sleep(16) }
  const back = { depth: N.state().depth, sparkOnOuter: !!outer.spark }
  return JSON.stringify({ node: [Math.round(cx), Math.round(cy)], before, hover, after, back })
})()`)
console.log(out)
if (process.argv[2]) await page.screenshot({ path: process.argv[2] })
await browser.close()
const r = JSON.parse(out) as { hover: { sparkOnLevel: boolean; sparkOnOuter: boolean }; before: { form: number }; after: { form: number; outerJournal: number }; back: { depth: number; sparkOnOuter: boolean } }
const ok = r.hover.sparkOnLevel && !r.hover.sparkOnOuter && r.after.form !== r.before.form && r.after.outerJournal === 0 && r.back.depth === 0 && r.back.sparkOnOuter
console.log(ok ? "ok" : "FAILED")
process.exit(ok ? 0 : 1)
