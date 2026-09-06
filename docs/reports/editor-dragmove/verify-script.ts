/**
 * Headless verification of direct manipulation (EDITOR-V5).
 * bun dragmove-verify.ts <case>   where case is one of:
 *   rect    — s01: select Rectangle, drag 100px right, commit, check file
 *   orbit   — s01: drag empty space still orbits the observer
 *   eye     — s01: select the Eye whole (cast chip), drag → whole moves, x AND y commit
 *   escape  — s01: drag then Escape → revert, no write
 *   bound   — mindvirus: bound x/y refuse with the cue
 */
import puppeteer from "puppeteer-core"
import { mkdirSync, readFileSync } from "node:fs"

const CASE = process.argv[2] ?? "rect"
const PORT = 4177
const OUT = "/Users/davidrug/RealDealVault/ProjectLiminality/DreamTalk/docs/reports/editor-dragmove"
const S01 = "/Users/davidrug/RealDealVault/ProjectLiminality/DreamTalk/core/demo/video01/S01.ts"
mkdirSync(OUT, { recursive: true })

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

declare global {
  interface Window {
    __dt?: any
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  page.on("console", (msg) => console.log("[page]", msg.text()))
  const scene = CASE === "bound" ? "mindvirus" : "s01"
  const t = CASE === "bound" ? 1.0 : CASE === "eye" ? 12 : 23
  await page.goto(`http://localhost:${PORT}/?scene=${scene}&t=${t}`, {
    waitUntil: "networkidle0",
    timeout: 30000,
  })
  await page.waitForFunction("window.__dt !== undefined && window.__dt.ready", { timeout: 30000 })
  await sleep(400)

  // --- shared helpers (run in page) ---------------------------------------
  const scanFor = (className: string) =>
    page.evaluate((cls: string) => {
      // NDC grid scan for a point whose pick is `cls`; returns client coords.
      const canvas = document.getElementById("stage") as HTMLCanvasElement
      const rect = canvas.getBoundingClientRect()
      for (let iy = 0; iy < 72; iy++) {
        for (let ix = 0; ix < 128; ix++) {
          const ndcX = -1 + (2 * (ix + 0.5)) / 128
          const ndcY = -1 + (2 * (iy + 0.5)) / 72
          if (window.__dt!.pick(ndcX, ndcY) === cls) {
            return {
              x: rect.left + ((ndcX + 1) / 2) * rect.width,
              y: rect.top + ((1 - ndcY) / 2) * rect.height,
            }
          }
        }
      }
      return undefined
    }, className)

  const pointer = (type: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
    page.evaluate(
      (ty: string, cx: number, cy: number, ex: any) => {
        const canvas = document.getElementById("stage") as HTMLCanvasElement
        canvas.dispatchEvent(
          new PointerEvent(ty, {
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
            button: 0,
            buttons: ty === "pointerup" ? 0 : 1,
            pointerId: 7,
            isPrimary: true,
            ...ex,
          }),
        )
      },
      type,
      x,
      y,
      extra,
    )

  const drag = async (from: { x: number; y: number }, dx: number, dy: number, opts: { escape?: boolean; shift?: boolean } = {}) => {
    await pointer("pointerdown", from.x, from.y)
    await sleep(60)
    const steps = 8
    for (let i = 1; i <= steps; i++) {
      await pointer("pointermove", from.x + (dx * i) / steps, from.y + (dy * i) / steps, {
        shiftKey: opts.shift ?? false,
      })
      await sleep(50)
    }
    const mid = await page.evaluate(() => ({
      overrides: window.__dt!.overrides(),
      selected: window.__dt!.selected()?.className,
      classes: (document.getElementById("stage") as HTMLElement).className,
    }))
    console.log("MID-DRAG:", JSON.stringify(mid))
    if (opts.escape) {
      await page.evaluate(() =>
        document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true })),
      )
      await sleep(150)
    }
    await pointer("pointerup", from.x + dx, from.y + dy)
  }

  const state = () =>
    page.evaluate(() => ({
      selected: window.__dt!.selected()?.className,
      overrides: window.__dt!.overrides(),
      bounds: window.__dt!.bounds(),
      pose: window.__dt!.pose(),
      classes: (document.getElementById("stage") as HTMLElement).className,
      marqueeClasses: (document.getElementById("marquee") as HTMLElement).className,
    }))

  // --- cases ---------------------------------------------------------------
  if (CASE === "rect") {
    const pt = await scanFor("Rectangle")
    if (!pt) throw new Error("no Rectangle ink found")
    // click to select
    await pointer("pointerdown", pt.x, pt.y)
    await sleep(50)
    await pointer("pointerup", pt.x, pt.y)
    await sleep(200)
    console.log("after click:", JSON.stringify((await state()).selected))
    await page.screenshot({ path: `${OUT}/rect-1-selected.png` })
    const before = await state()
    // drag 100px right
    await drag(pt, 100, 0)
    await sleep(200)
    const during = await state()
    console.log("bounds before:", JSON.stringify(before.bounds))
    console.log("bounds after drag:", JSON.stringify(during.bounds))
    await page.screenshot({ path: `${OUT}/rect-2-dragged.png` })
    console.log("overrides at release:", JSON.stringify(during.overrides))
    // wait for op → rebuild → reload
    await sleep(2500)
    await page.evaluate(() => window.__dt!.setT(23))
    await sleep(400)
    await page.screenshot({ path: `${OUT}/rect-3-reloaded.png` })
    const src = readFileSync(S01, "utf8")
    const m = src.match(/rectangle = new Rectangle\(\{[^}]*\}/s)
    console.log("FILE LITERAL:", JSON.stringify(m?.[0]))
  } else if (CASE === "orbit") {
    const empty = await page.evaluate(() => {
      const canvas = document.getElementById("stage") as HTMLCanvasElement
      const rect = canvas.getBoundingClientRect()
      // top-left corner area — verified empty via pick
      for (let ndcY = 0.9; ndcY > 0; ndcY -= 0.1) {
        if (window.__dt!.pick(-0.9, ndcY) === undefined)
          return {
            x: rect.left + ((-0.9 + 1) / 2) * rect.width,
            y: rect.top + ((1 - ndcY) / 2) * rect.height,
          }
      }
      return undefined
    })
    if (!empty) throw new Error("no empty space found")
    const poseBefore = (await state()).pose
    await drag(empty, 120, 40)
    await sleep(200)
    const after = await state()
    console.log("pose before:", JSON.stringify(poseBefore))
    console.log("pose after: ", JSON.stringify(after.pose))
    console.log("selected after empty drag:", JSON.stringify(after.selected))
    await page.screenshot({ path: `${OUT}/orbit-after.png` })
  } else if (CASE === "eye") {
    // select the Eye WHOLE via its cast chip
    await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll(".castchip"))
      const eye = chips.find((c) => c.textContent?.includes("Eye")) as HTMLElement
      eye.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    await sleep(200)
    const sel = await state()
    console.log("selected via cast:", JSON.stringify(sel.selected), "bounds:", JSON.stringify(sel.bounds))
    await page.screenshot({ path: `${OUT}/eye-1-selected.png` })
    // find ink INSIDE the selection bounds (client coords)
    const pt = await page.evaluate(() => {
      const b = window.__dt!.bounds()
      if (!b) return undefined
      const canvas = document.getElementById("stage") as HTMLCanvasElement
      const rect = canvas.getBoundingClientRect()
      const sx = rect.width / canvas.width
      const sy = rect.height / canvas.height
      for (let py = b.minY + 2; py < b.maxY; py += 4) {
        for (let px = b.minX + 2; px < b.maxX; px += 4) {
          const ndcX = (px / canvas.width) * 2 - 1
          const ndcY = -((py / canvas.height) * 2 - 1)
          const hit = window.__dt!.pick(ndcX, ndcY)
          if (hit !== undefined && hit !== "Cylinder") {
            return { x: rect.left + px * sx, y: rect.top + py * sy, hit }
          }
        }
      }
      return undefined
    })
    if (!pt) throw new Error("no ink inside Eye bounds")
    console.log("dragging from ink:", JSON.stringify(pt))
    await drag(pt, -60, -40)
    await sleep(200)
    const during = await state()
    console.log("selected after drag:", JSON.stringify(during.selected))
    console.log("overrides:", JSON.stringify(during.overrides))
    await page.screenshot({ path: `${OUT}/eye-2-dragged.png` })
    await sleep(2500)
    const src = readFileSync(S01, "utf8")
    const m = src.match(/circler = new Eye\(\{[^}]*\}/s)
    console.log("FILE LITERAL:", JSON.stringify(m?.[0]))
  } else if (CASE === "escape") {
    const hashBefore = readFileSync(S01, "utf8")
    const pt = await scanFor("Rectangle")
    if (!pt) throw new Error("no Rectangle ink found")
    await pointer("pointerdown", pt.x, pt.y)
    await sleep(50)
    await pointer("pointerup", pt.x, pt.y)
    await sleep(200)
    const before = await state()
    await drag(pt, 80, 50, { escape: true })
    await sleep(300)
    const after = await state()
    console.log("bounds before:", JSON.stringify(before.bounds))
    console.log("bounds after escape:", JSON.stringify(after.bounds))
    console.log("overrides after escape:", JSON.stringify(after.overrides))
    await page.screenshot({ path: `${OUT}/escape-after.png` })
    await sleep(1500)
    const hashAfter = readFileSync(S01, "utf8")
    console.log("file untouched:", hashBefore === hashAfter)
  } else if (CASE === "bound") {
    // select the MindVirus via cast chip (its x/y follow the journey path)
    await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll(".castchip"))
      const chip = chips.find((c) => c.textContent?.includes("MindVirus")) as HTMLElement | undefined
      chip?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    await sleep(200)
    const sel = await state()
    console.log("selected:", JSON.stringify(sel.selected), "bounds:", JSON.stringify(sel.bounds))
    const pt = await page.evaluate(() => {
      const b = window.__dt!.bounds()
      if (!b) return undefined
      const canvas = document.getElementById("stage") as HTMLCanvasElement
      const rect = canvas.getBoundingClientRect()
      const sx = rect.width / canvas.width
      const sy = rect.height / canvas.height
      for (let py = b.minY + 2; py < b.maxY; py += 3) {
        for (let px = b.minX + 2; px < b.maxX; px += 3) {
          const ndcX = (px / canvas.width) * 2 - 1
          const ndcY = -((py / canvas.height) * 2 - 1)
          if (window.__dt!.pick(ndcX, ndcY) !== undefined)
            return { x: rect.left + px * sx, y: rect.top + py * sy }
        }
      }
      return undefined
    })
    if (!pt) throw new Error("no ink inside MindVirus bounds")
    await pointer("pointerdown", pt.x, pt.y)
    await sleep(60)
    const pressed = await state()
    console.log("classes at press:", JSON.stringify(pressed.classes), JSON.stringify(pressed.marqueeClasses))
    await page.screenshot({ path: `${OUT}/bound-refusal.png` })
    await pointer("pointermove", pt.x + 60, pt.y)
    await sleep(100)
    const moved = await state()
    console.log("overrides after refused drag:", JSON.stringify(moved.overrides))
    console.log("selected still:", JSON.stringify(moved.selected))
    await pointer("pointerup", pt.x + 60, pt.y)
  }
} finally {
  await browser.close()
}
