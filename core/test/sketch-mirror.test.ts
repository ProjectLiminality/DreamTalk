/**
 * The whiteboard on the reMarkable's own screen, verified without one: the
 * page → display list (symbols flattened through the page's camera to the
 * page coordinates the Mac draws them at, ink with its nib, the selection's
 * chrome as controls), the diffs the page sends, the merged list the daemon
 * keeps and relays over a real WebSocket, and the bridge's `ssh -W` argv.
 * The tablet end (tablet/dreamtalk-pad) has its own tests: ./build.sh e2e.
 */

import { describe, expect, test } from "bun:test"
import { DisplayDiff, DisplayStore, displayHub, encodeItem, parseDisplayOps, toLines } from "../sketch/display"
import { buildDisplay, flattenSymbol, inkWidth, type MirrorView } from "../sketch/mirror"
import type { DisplayItem, DisplayOp, DisplayPrim, InkStroke, PlacedSymbol } from "../sketch/protocol"
import { sshForwardArgs } from "../scripts/remarkable-bridge"

const pairs = (p: DisplayPrim) => {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i + 1 < p.pts.length; i += 2) out.push({ x: p.pts[i]!, y: p.pts[i + 1]! })
  return out
}

const view = (over: Partial<MirrorView> = {}): MirrorView => ({
  strokes: [],
  symbols: [],
  selection: new Set(),
  liveStroke: [],
  lasso: [],
  erased: new Set(),
  unit: 2,
  groupBoxes: [],
  ...over,
})

const items = (v: MirrorView): DisplayItem[] =>
  buildDisplay(v).map((e) => {
    const { op: _, ...item } = JSON.parse(e.json) as DisplayItem & { op: string }
    return item
  })

const stroke = (id: string, pts: [number, number, number][]): InkStroke => ({
  id,
  points: pts.map(([x, y, pressure], i) => ({ x, y, pressure, t: i * 8 })),
})

describe("flattenSymbol: the page's camera, exactly", () => {
  test("a circle is a closed polyline at its page centre and radius", () => {
    const prims = flattenSymbol({ symbol: "circle", params: { cx: 400, cy: 600, r: 100 } })
    expect(prims).toHaveLength(1)
    const p = prims[0]!
    expect(p.k).toBe("line")
    const pts = pairs(p)
    expect(pts.length).toBeGreaterThan(32)
    expect(pts[0]!.x).toBeCloseTo(pts[pts.length - 1]!.x, 1)
    expect(pts[0]!.y).toBeCloseTo(pts[pts.length - 1]!.y, 1)
    for (const q of pts) expect(Math.abs(Math.hypot(q.x - 400, q.y - 600) - 100)).toBeLessThan(0.2)
    // Page y is down: the loop reaches y = 500 (top) and 700 (bottom).
    expect(Math.min(...pts.map((q) => q.y))).toBeCloseTo(500, 0)
    expect(Math.max(...pts.map((q) => q.y))).toBeCloseTo(700, 0)
  })

  test("a square's corners land on its page corners, rotation clockwise on the page", () => {
    const flat = pairs(flattenSymbol({ symbol: "square", params: { cx: 300, cy: 300, size: 200 } })[0]!)
    for (const c of [
      { x: 200, y: 200 },
      { x: 400, y: 200 },
      { x: 400, y: 400 },
      { x: 200, y: 400 },
    ])
      expect(flat.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < 0.2)).toBe(true)
    // π/4 clockwise on the page: a corner straight to the right of the centre.
    const turned = pairs(flattenSymbol({ symbol: "square", params: { cx: 300, cy: 300, size: 200, rotation: Math.PI / 4 } })[0]!)
    expect(turned.some((q) => Math.hypot(q.x - (300 + 100 * Math.SQRT2), q.y - 300) < 0.3)).toBe(true)
  })

  test("a tumbled cube shows depth around its page centre", () => {
    const prims = flattenSymbol({ symbol: "cube", params: { cx: 700, cy: 900, size: 200, h: 0.6, p: 0.4 } })
    const pts = prims.flatMap(pairs)
    const xs = pts.map((q) => q.x)
    const ys = pts.map((q) => q.y)
    const mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
    expect(Math.abs(mid.x - 700)).toBeLessThan(20)
    expect(Math.abs(mid.y - 900)).toBeLessThan(20)
    // Turned, it is wider than its face.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(220)
  })

  test("every vocabulary symbol flattens to something on the page; unknown ones to nothing", () => {
    for (const symbol of ["triangle", "flowerOfLife", "eye", "figure"]) {
      const prims = flattenSymbol({ symbol, params: { cx: 700, cy: 900, r: 100, size: 200, height: 300 } })
      expect(prims.length).toBeGreaterThan(0)
      for (const p of prims) for (const q of pairs(p)) expect(q.x > 300 && q.x < 1100 && q.y > 500 && q.y < 1300).toBe(true)
    }
    const mv = flattenSymbol({ symbol: "mindVirus", params: { x: 700, y: 900, size: 120, cable: [[300, 900], [450, 950], [600, 900]] } })
    // The cable reaches back to where it was drawn from.
    expect(Math.min(...mv.flatMap(pairs).map((q) => q.x))).toBeLessThan(320)
    expect(flattenSymbol({ symbol: "noSuchThing", params: {} })).toEqual([])
  })

  test("the Eye's iris is a fill (painted, so it covers what it should)", () => {
    const prims = flattenSymbol({ symbol: "eye", params: { cx: 700, cy: 900, size: 200 } })
    expect(prims.some((p) => p.k === "fill")).toBe(true)
  })
})

describe("buildDisplay: the page as items", () => {
  const circle: PlacedSymbol = { id: "c1", symbol: "circle", params: { cx: 400, cy: 600, r: 100 }, fromStrokes: [] }
  const ink = stroke("k1", [
    [100, 100, 0.2],
    [150, 120, 0.9],
    [200, 110, 0],
  ])

  test("ink keeps the page's nib; symbols sit under ink", () => {
    const list = items(view({ strokes: [ink], symbols: [circle] }))
    const k = list.find((i) => i.id === "ink:k1")!
    const s = list.find((i) => i.id === "sym:c1")!
    expect(k.prims[0]!.k).toBe("line")
    expect((k.prims[0] as { w: number[] }).w).toEqual(ink.points.map((p) => Math.round(inkWidth(p) * 10) / 10))
    expect(inkWidth(ink.points[2]!)).toBeCloseTo(3.8) // no reading → the middle of the nib
    expect(s.z).toBeLessThan(k.z)
  })

  test("a selection shows its frame (grab) and handles (noInk), as the Mac does", () => {
    const list = items(
      view({
        strokes: [ink],
        selection: new Set(["k1"]),
        frame: { x: 80, y: 80, w: 140, h: 60 },
        chrome: {
          corners: [
            { x: 80, y: 80 },
            { x: 220, y: 80 },
            { x: 220, y: 140 },
            { x: 80, y: 140 },
          ],
          knob: { x: 150, y: 40 },
          frameTop: { x: 150, y: 80 },
          chip: { x: 150, y: 180 },
          handle: 14,
          knobR: 10,
          chipR: 26,
        },
      }),
    )
    const ids = list.map((i) => i.id)
    expect(ids).toEqual(expect.arrayContaining(["frame", "chrome:knob", "chrome:corner0", "chrome:corner3", "chrome:chip"]))
    const frame = list.find((i) => i.id === "frame")!
    expect(frame.grab).toBe(true)
    expect((frame.prims[0] as { dash?: number[] }).dash).toEqual([6, 12]) // css px × unit
    for (const id of ids.filter((x) => x.startsWith("chrome:"))) expect(list.find((i) => i.id === id)!.noInk).toBe(true)
    // the chip's knockout disk sits where the Mac draws it
    const chip = list.find((i) => i.id === "chrome:chip")!
    const disk = pairs(chip.prims[0]!)
    expect(chip.prims[0]!.k).toBe("fill")
    for (const q of disk) expect(Math.hypot(q.x - 150, q.y - 180)).toBeCloseTo(26, 0)
  })

  test("the gesture in progress is `live`; erased ink is grey", () => {
    const list = items(
      view({
        strokes: [ink],
        erased: new Set(["k1"]),
        liveStroke: ink.points,
        lasso: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 50, y: 50 },
        ],
      }),
    )
    expect(list.find((i) => i.id === "live")!.live).toBe(true)
    const lasso = list.find((i) => i.id === "lasso")!
    expect(lasso.live).toBe(true)
    expect(pairs(lasso.prims[0]!).at(-1)).toEqual({ x: 0, y: 0 }) // closed
    expect((list.find((i) => i.id === "ink:k1")!.prims[0] as { grey?: number }).grey).toBe(200)
  })

  test("a live move carries the selected symbol and ink with it, nothing else", () => {
    const other: PlacedSymbol = { ...circle, id: "c2", params: { cx: 900, cy: 900, r: 50 } }
    const xf = { translate: { x: 30, y: -20 }, rotate: 0, scale: 1, pivot: { x: 0, y: 0 } }
    const at = (v: MirrorView, id: string) => pairs(items(v).find((i) => i.id === id)!.prims[0]!)[0]!
    const rest = view({ symbols: [circle, other], strokes: [ink] })
    const moving = view({ symbols: [circle, other], strokes: [ink], selection: new Set(["c1", "k1"]), liveXf: xf })
    expect(at(moving, "sym:c1").x - at(rest, "sym:c1").x).toBeCloseTo(30, 1)
    expect(at(moving, "sym:c1").y - at(rest, "sym:c1").y).toBeCloseTo(-20, 1)
    expect(at(moving, "ink:k1").x).toBeCloseTo(130, 1)
    expect(at(moving, "sym:c2")).toEqual(at(rest, "sym:c2"))
    expect(items(moving).find((i) => i.id === "sym:c1")!.z).toBeGreaterThan(items(rest).find((i) => i.id === "sym:c1")!.z)
  })

  test("the options ring: each chip draws its candidate inside its own circle", () => {
    const list = items(
      view({
        ring: {
          center: { x: 700, y: 900 },
          radius: 300,
          chipPage: 200,
          chips: [
            { x: 700, y: 600, candidate: { symbol: "circle", params: { cx: 0, cy: 0, r: 500 }, confidence: 0.5, why: "" } },
            { x: 960, y: 1050, candidate: { symbol: "square", params: { cx: 10, cy: 10, size: 40 }, confidence: 0.4, why: "" } },
          ],
        },
      }),
    )
    expect(list.find((i) => i.id === "ring")).toBeDefined()
    for (const [i, c] of [
      [0, { x: 700, y: 600 }],
      [1, { x: 960, y: 1050 }],
    ] as const) {
      const chip = list.find((x) => x.id === `ring:${i}`)!
      expect(chip.noInk).toBe(true)
      expect(chip.prims.length).toBeGreaterThan(2) // disk, outline, the symbol
      for (const p of chip.prims) for (const q of pairs(p)) expect(Math.hypot(q.x - c.x, q.y - c.y)).toBeLessThanOrEqual(100.5)
    }
  })
})

describe("diffs, the merged list, the wire", () => {
  const a: DisplayItem = { id: "a", z: 1, prims: [{ k: "line", pts: [0, 0, 1, 1], w: 2 }] }
  const b: DisplayItem = { id: "b", z: 2, prims: [{ k: "fill", pts: [0, 0, 1, 0, 1, 1], grey: 255 }] }

  test("the page sends everything once, then only what changed, every batch ending in flush", () => {
    const d = new DisplayDiff()
    const full = JSON.parse(d.full([a, b].map(encodeItem))) as DisplayOp[]
    expect(full.map((o) => o.op)).toEqual(["clear", "put", "put", "flush"])
    expect(d.diff([a, b].map(encodeItem))).toBeUndefined()
    const moved = { ...a, prims: [{ k: "line" as const, pts: [5, 5, 6, 6], w: 2 }] }
    expect(JSON.parse(d.diff([moved].map(encodeItem))!)).toEqual([{ op: "put", ...moved }, { op: "del", id: "b" }, { op: "flush" }])
    d.reset()
    expect(JSON.parse(d.diff([moved].map(encodeItem))!)).toHaveLength(2)
  })

  test("the store merges batches; a snapshot rebuilds it from nothing", () => {
    const s = new DisplayStore()
    s.apply([{ op: "put", ...a }, { op: "put", ...b }, { op: "flush" }])
    s.apply([{ op: "del", id: "a" }, { op: "put", ...a, z: 9 }])
    const snap = s.snapshot()
    expect(snap[0]).toEqual({ op: "clear" })
    expect(snap.at(-1)).toEqual({ op: "flush" })
    expect(snap.slice(1, -1).map((o) => (o as { id: string }).id)).toEqual(["b", "a"])
    s.apply([{ op: "clear" }])
    expect(s.size).toBe(0)
  })

  test("malformed ops are dropped, not the batch", () => {
    const ops = parseDisplayOps([{ op: "put", id: "x", prims: [] }, { op: "put" }, "junk", { op: "del" }, { op: "flush" }, { op: "zap" }])
    expect(ops).toEqual([{ op: "put", id: "x", z: 0, prims: [] }, { op: "flush" }])
  })

  test("the tablet's wire is one op per line", () => {
    const text = toLines([{ op: "put", ...a }, { op: "flush" }])
    expect(text.split("\n")).toEqual([JSON.stringify({ op: "put", ...a }), '{"op":"flush"}', ""])
  })

  test("the bridge reaches the pad with ssh -W on the tablet's loopback, never David's ssh config", () => {
    const argv = sshForwardArgs("192.168.0.129", 7777, "/k")
    expect(argv.slice(-3)).toEqual(["-W", "127.0.0.1:7777", "root@192.168.0.129"])
    expect(argv).toContain("/dev/null")
    expect(argv.join(" ")).toContain("-i /k")
  })
})

describe("the daemon's /ws/display relay (a real socket)", () => {
  test("a batch reaches every other client; a late one starts from a snapshot", async () => {
    const hub = displayHub()
    const server = Bun.serve<object>({
      port: 0,
      fetch: (req, srv) => (srv.upgrade(req, { data: {} }) ? undefined : new Response("no", { status: 400 })),
      websocket: { open: (ws) => hub.open(ws), message: (ws, raw) => hub.message(ws, raw), close: (ws) => hub.close(ws) },
    })
    const url = `ws://localhost:${server.port}`
    const open = (inbox: unknown[]) =>
      new Promise<WebSocket>((resolve) => {
        const ws = new WebSocket(url)
        ws.onmessage = (m) => inbox.push(JSON.parse(String(m.data)))
        ws.onopen = () => resolve(ws)
      })
    const until = async (cond: () => boolean) => {
      for (let i = 0; i < 100 && !cond(); i++) await Bun.sleep(10)
    }
    try {
      const pageIn: unknown[] = []
      const bridgeIn: unknown[] = []
      const page = await open(pageIn)
      await open(bridgeIn)
      page.send(new DisplayDiff().full([{ id: "s", z: 10, prims: [{ k: "line" as const, pts: [1, 2, 3, 4], w: 3 }] }].map(encodeItem)))
      await until(() => bridgeIn.length > 0)
      expect(bridgeIn[0]).toEqual([{ op: "clear" }, { op: "put", id: "s", z: 10, prims: [{ k: "line", pts: [1, 2, 3, 4], w: 3 }] }, { op: "flush" }])
      expect(pageIn).toHaveLength(0) // never echoed to the sender
      const lateIn: unknown[] = []
      await open(lateIn)
      await until(() => lateIn.length > 0)
      expect(lateIn[0]).toEqual(bridgeIn[0])
    } finally {
      server.stop(true)
    }
  })
})
