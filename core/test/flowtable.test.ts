import { describe, expect, test } from "bun:test"
import { flowTable, parseCSV, peakValue, peakVolume, seriesAt, thinning, toRows } from "../vocabulary/FlowMap/table"
import { FlowMap, MOCK_FLOWMAP, type FlowMapData } from "../vocabulary/FlowMap/FlowMap"
import { certaintyOf } from "../src/certainty"

const base: FlowMapData = { ...MOCK_FLOWMAP, stages: MOCK_FLOWMAP.stages.map((s) => ({ ...s, certainty: 1 })), flows: [] }

describe("parsing a flow table", () => {
  test("CSV with a header, quoted fields, CRLF and blank lines", () => {
    const rows = parseCSV('from,to,stage,period,volume,item\r\n"Supplier, North",A,raw,2026-01,5,"a ""big"" one"\r\n\r\nB,C,semi,2026-02,7,\n')
    expect(rows.length).toBe(2)
    expect(rows[0]!.from).toBe("Supplier, North")
    expect(rows[0]!.item).toBe('a "big" one')
    expect(rows[1]!.volume).toBe("7")
  })

  test("rows name what is missing or not a number", () => {
    expect(() => toRows([{ from: "A", to: "B", stage: "raw", period: "p" }])).toThrow(/missing 'volume'/)
    expect(() => toRows([{ from: "A", to: "B", stage: "raw", period: "p", volume: "lots" }])).toThrow(/not a number/)
  })
})

describe("folding rows into flows over time", () => {
  const rows = toRows([
    { from: "S1", to: "A", stage: "raw", period: "2026-01", volume: 10, unit: "t" },
    { from: "S1", to: "A", stage: "raw", period: "2026-01", volume: 5, unit: "t", item: "other" },
    { from: "S1", to: "A", stage: "raw", period: "2026-03", volume: 0, unit: "t" },
    { from: "A", to: "D", stage: "semi", period: "2026-02", volume: 40, unit: "t" },
  ])

  test("one flow per from/to/stage; rows of a period sum; no row is null, an explicit 0 stays 0", () => {
    const d = flowTable(rows, base)
    expect(d.periods).toEqual(["2026-01", "2026-02", "2026-03"])
    expect(d.unit).toBe("t")
    const raw = d.flows.find((f) => f.stage === "raw")!
    expect(raw.series).toEqual([15, null, 0])
    expect(peakVolume(d)).toBe(40)
  })

  test("unknown entities: refused, or added as partners by how they appear", () => {
    const odd = toRows([
      { from: "Vendor", to: "A", stage: "raw", period: "p1", volume: 1 },
      { from: "D", to: "Buyer", stage: "finished", period: "p1", volume: 1 },
    ])
    expect(() => flowTable(odd, base)).toThrow(/unknown entity 'Vendor'/)
    const d = flowTable(odd, base, { autoPartners: true })
    expect(d.partners!.find((p) => p.id === "Vendor")!.side).toBe("in")
    expect(d.partners!.find((p) => p.id === "Buyer")!.side).toBe("out")
  })

  test("mixed units are refused rather than summed", () => {
    const mixed = toRows([
      { from: "S1", to: "A", stage: "raw", period: "p1", volume: 1, unit: "t" },
      { from: "S1", to: "A", stage: "raw", period: "p2", volume: 1, unit: "kg" },
    ])
    expect(() => flowTable(mixed, base)).toThrow(/mixed units/)
  })
})

describe("reading a series at a continuous period", () => {
  test("interpolates volume and coverage; a gap reads the typical level as conjecture", () => {
    const s = [10, null, 30]
    expect(seriesAt(s, 0)).toEqual({ volume: 10, coverage: 1 })
    expect(seriesAt(s, 1)).toEqual({ volume: 20, coverage: 0 }) // typical = mean(10, 30)
    const mid = seriesAt(s, 0.5)
    expect(mid.volume).toBeCloseTo(15, 12)
    expect(mid.coverage).toBeCloseTo(0.5, 12)
    expect(seriesAt(s, 9)).toEqual({ volume: 30, coverage: 1 })
  })

  test("thinning shows the right share of particles, evenly, and never un-shows one as density rises", () => {
    const n = 200
    for (const d of [0.1, 0.5, 0.9]) {
      const shown = Array.from({ length: n }, (_, j) => thinning(j, d)).reduce((a, b) => a + b, 0)
      expect(shown / n).toBeCloseTo(d, 1)
    }
    for (let j = 0; j < n; j++) expect(thinning(j, 0.6)).toBeGreaterThanOrEqual(thinning(j, 0.5))
    expect(thinning(3, 0)).toBe(0)
    expect(thinning(3, 1.05)).toBe(1)
  })
})

describe("a FlowMap over time", () => {
  const data = flowTable(
    toRows([
      { from: "S1", to: "A", stage: "raw", period: "m1", volume: 100 },
      { from: "S1", to: "A", stage: "raw", period: "m3", volume: 20 },
      { from: "A", to: "D", stage: "semi", period: "m1", volume: 0 },
      { from: "A", to: "D", stage: "semi", period: "m2", volume: 50 },
      { from: "A", to: "D", stage: "semi", period: "m3", volume: 50 },
    ]),
    base,
  )

  test("width follows volume; a period without data ghosts the flow; data restores it", () => {
    const m = new FlowMap({ data })
    void m.parts
    const raw = m.stage("raw").flows[0]!
    m.period.value = 0
    expect(raw.line.stroke.value).toBeCloseTo(1 + 4.5, 9)
    expect(certaintyOf(raw.line)).toBeCloseTo(1, 12)
    m.period.value = 1 // m2: no raw data
    expect(certaintyOf(raw.line)).toBeCloseTo(0.15, 12)
    m.period.value = 2
    expect(raw.line.stroke.value).toBeCloseTo(1 + 4.5 * 0.2, 9)
    expect(certaintyOf(raw.line)).toBeCloseTo(1, 12)
  })

  test("a flow whose data says nothing moved draws nothing, then appears", () => {
    const m = new FlowMap({ data })
    void m.parts
    m.stage("semi").shown.value = 1
    const semi = m.stage("semi").flows[0]!
    m.period.value = 0
    expect(semi.line.opacity.value).toBe(0)
    expect(semi.dots.every((d) => d.opacity.value === 0)).toBe(true)
    m.period.value = 1
    expect(semi.line.opacity.value).toBeGreaterThan(0)
  })

  test("the periods are an axis of the state space", () => {
    const m = new FlowMap({ data })
    void m.parts
    const period = m.stateSpace().axes.find((a) => a.id === "period")!
    expect(period.positions.map((p) => p.name)).toEqual(["m1", "m2", "m3"])
  })
})

describe("value ↔ money", () => {
  const priced = flowTable(
    toRows([
      { from: "S1", to: "A", stage: "raw", period: "m1", volume: 10, price: 2, currency: "k€" },
      { from: "S1", to: "A", stage: "raw", period: "m2", volume: 20, value: 50, currency: "k€" },
      { from: "A", to: "D", stage: "semi", period: "m1", volume: 30 },
      { from: "A", to: "D", stage: "semi", period: "m2", volume: 30 },
    ]),
    base,
  )

  test("value or volume × price folds into a money series; unpriced periods are unknown", () => {
    expect(priced.currency).toBe("k€")
    const raw = priced.flows.find((f) => f.stage === "raw")!
    expect(raw.valueSeries).toEqual([20, 50])
    const semi = priced.flows.find((f) => f.stage === "semi")!
    expect(semi.valueSeries).toEqual([null, null])
    expect(peakValue(priced)).toBe(50)
  })

  test("a table that priced nothing carries no money series; mixed currencies are refused", () => {
    const plain = flowTable(toRows([{ from: "S1", to: "A", stage: "raw", period: "m1", volume: 1 }]), base)
    expect(plain.flows[0]!.valueSeries).toBeUndefined()
    expect(() =>
      flowTable(
        toRows([
          { from: "S1", to: "A", stage: "raw", period: "m1", volume: 1, value: 1, currency: "EUR" },
          { from: "S1", to: "A", stage: "raw", period: "m2", volume: 1, value: 1, currency: "USD" },
        ]),
        base,
      ),
    ).toThrow(/mixed currencies/)
  })

  test("money 0 shows value, 1 shows money; ½ shows both, parted into two lanes", () => {
    const m = new FlowMap({ data: priced })
    void m.parts
    m.stage("raw").shown.value = 1
    m.time.value = 3
    const f = m.stage("raw").flows[0]!
    const anyShown = (xs: { opacity: { value: number } }[]) => xs.some((x) => x.opacity.value > 0.5)
    const coinFaces = f.money!.coins.map((c) => c.parts[0]!.parts[0]! as unknown as { opacity: { value: number } })
    expect(anyShown(f.dots)).toBe(true)
    expect(anyShown(coinFaces)).toBe(false)
    m.money.value = 1
    expect(anyShown(f.dots)).toBe(false)
    expect(anyShown(coinFaces)).toBe(true)
    // Both: the lanes part — value on one side of the channel, money on the other.
    m.money.value = 0.5
    const v = f.line.points
    const g = f.money!.line.points
    const mid = (pts: { x: number; y: number }[]) => pts[Math.floor(pts.length / 2)]!
    expect(Math.hypot(mid(v).x - mid(g).x, mid(v).y - mid(g).y)).toBeGreaterThan(5)
    m.money.value = 1
    const v1 = f.line.points
    const g1 = f.money!.line.points
    expect(Math.hypot(mid(v1).x - mid(g1).x, mid(v1).y - mid(g1).y)).toBeLessThan(1e-6)
  })

  test("money runs the other way down the channel", () => {
    const m = new FlowMap({ data: priced })
    void m.parts
    m.stage("raw").shown.value = 1
    m.money.value = 1
    const f = m.stage("raw").flows[0]!
    const g = f.money!.line.points
    const v = f.line.points
    // The money channel starts where the value channel ends.
    expect(Math.hypot(g[0]!.x - v.at(-1)!.x, g[0]!.y - v.at(-1)!.y)).toBeLessThan(1e-6)
    const carrier = f.money!.coins[0]!
    m.time.value = 1
    const a = { x: carrier.x.value, y: carrier.y.value }
    m.time.value = 1.05
    const b = { x: carrier.x.value, y: carrier.y.value }
    const src = v[0]!
    expect(Math.hypot(b.x - src.x, b.y - src.y)).toBeLessThan(Math.hypot(a.x - src.x, a.y - src.y))
  })

  test("money lanes are built only where money can be shown (or when asked)", () => {
    const plain = flowTable(toRows([{ from: "S1", to: "A", stage: "raw", period: "m1", volume: 1 }]), base)
    const m = new FlowMap({ data: plain })
    void m.parts
    expect(m.flows[0]!.money).toBeUndefined()
    expect(m.stateSpace().axes.some((a) => a.id === "money")).toBe(false)
    const asked = new FlowMap({ data: plain, moneyLanes: true })
    void asked.parts
    expect(asked.flows[0]!.money).toBeDefined()
  })

  test("an unpriced flow's money is conjecture", () => {
    const m = new FlowMap({ data: priced })
    void m.parts
    const semi = m.stage("semi").flows[0]!
    expect(certaintyOf(semi.money!.line)).toBeCloseTo(0.15, 12)
    const raw = m.stage("raw").flows[0]!
    expect(certaintyOf(raw.money!.line)).toBeCloseTo(1, 12)
  })
})
