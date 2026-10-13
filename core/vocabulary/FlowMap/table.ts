/**
 * Flow tables — real data into a FlowMap, over time.
 *
 * The shape every value-flow export can be bent into: one ROW per
 * (from, to, stage, period) with a volume — "how much moved from this place
 * to that place, in this step of the chain, in this month". Rows may carry
 * a unit and an item/category (several rows for one flow and period sum).
 *
 *   from,to,stage,period,volume,unit,item
 *   Supplier 1,Site A,raw,2026-01,120,t,granulate
 *
 * `flowTable(rows, base)` folds such rows into FlowMapData: one flow per
 * (from, to, stage), each with a SERIES — its volume per period, in period
 * order. The distinction the series keeps is the certainty language's:
 *
 *   a number (0 included) — DATA for that period: solid. 0 means nothing
 *                            moved, and is shown as nothing moving.
 *   null                   — NO DATA for that period: conjecture. The flow
 *                            is drawn ghosted at its typical known level.
 *
 * Entities the base data does not know are added as partners when
 * `autoPartners` is set — a supplier only ever sends ("in"), a customer
 * only ever receives ("out"), anything else is "both" — so a raw export
 * can be drawn before anyone has curated it.
 *
 * Pure: parse → fold → data. No I/O.
 */

import type { FlowMapData } from "./FlowMap"

export interface FlowRow {
  from: string
  to: string
  stage: string
  period: string
  volume: number
  unit?: string
  item?: string
}

/**
 * Parse CSV text with a header row into records. Commas separate fields;
 * double-quoted fields may contain commas and doubled quotes (""). Blank
 * lines are skipped. Small and exact — enough for an export, not a
 * spreadsheet engine.
 */
export const parseCSV = (text: string): Record<string, string>[] => {
  const lines: string[][] = []
  let field = ""
  let row: string[] = []
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.some((f) => f.trim() !== "")) lines.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== "")) lines.push(row)
  const [head, ...body] = lines
  if (!head) return []
  const keys = head.map((k) => k.trim())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])))
}

/** Records (from CSV or JSON) as typed rows; a missing required column is an error that names it. */
export const toRows = (records: readonly Record<string, unknown>[]): FlowRow[] =>
  records.map((r, i) => {
    for (const k of ["from", "to", "stage", "period", "volume"])
      if (r[k] === undefined || r[k] === "") throw new Error(`flow table row ${i + 1}: missing '${k}'`)
    const volume = Number(r.volume)
    if (!Number.isFinite(volume)) throw new Error(`flow table row ${i + 1}: volume '${String(r.volume)}' is not a number`)
    return {
      from: String(r.from),
      to: String(r.to),
      stage: String(r.stage),
      period: String(r.period),
      volume,
      unit: r.unit === undefined || r.unit === "" ? undefined : String(r.unit),
      item: r.item === undefined || r.item === "" ? undefined : String(r.item),
    }
  })

export interface FlowTableOptions {
  /** The periods in order. Default: every period in the rows, sorted as strings (ISO months sort right). */
  periods?: string[]
  /** Add entities the base data does not name, as partners (side from how they appear). Default false. */
  autoPartners?: boolean
}

/**
 * Fold rows into the base data: flows (one per from/to/stage, each with its
 * series over `periods`), plus `periods` and the unit. The base's own flows
 * are replaced — a table is the flows' source of truth.
 */
export const flowTable = (rows: readonly FlowRow[], base: FlowMapData, opts: FlowTableOptions = {}): FlowMapData => {
  const periods = opts.periods ?? [...new Set(rows.map((r) => r.period))].sort()
  const index = new Map(periods.map((p, i) => [p, i]))
  const known = new Set([...base.members.map((m) => m.id), ...(base.partners ?? []).map((p) => p.id)])
  const partners = [...(base.partners ?? [])]
  if (opts.autoPartners) {
    const sends = new Set(rows.map((r) => r.from))
    const gets = new Set(rows.map((r) => r.to))
    for (const id of [...new Set([...sends, ...gets])].sort()) {
      if (known.has(id)) continue
      const side = sends.has(id) && gets.has(id) ? "both" : sends.has(id) ? "in" : "out"
      partners.push({ id, label: id, side })
      known.add(id)
    }
  }
  const stages = new Set(base.stages.map((s) => s.id))
  const flows = new Map<string, { from: string; to: string; stage: string; series: (number | null)[] }>()
  const units = new Set<string>()
  for (const r of rows) {
    for (const end of [r.from, r.to]) if (!known.has(end)) throw new Error(`flow table: unknown entity '${end}' (set autoPartners to add it)`)
    if (!stages.has(r.stage)) throw new Error(`flow table: unknown stage '${r.stage}'`)
    const at = index.get(r.period)
    if (at === undefined) continue // a period outside the chosen window
    if (r.unit) units.add(r.unit)
    const key = `${r.from}\u0000${r.to}\u0000${r.stage}`
    let f = flows.get(key)
    if (!f) flows.set(key, (f = { from: r.from, to: r.to, stage: r.stage, series: periods.map(() => null) }))
    f.series[at] = (f.series[at] ?? 0) + r.volume
  }
  if (units.size > 1) throw new Error(`flow table: mixed units (${[...units].join(", ")}) — convert before drawing`)
  return {
    ...base,
    partners,
    periods,
    unit: [...units][0] ?? base.unit,
    flows: [...flows.values()],
  }
}

/** The largest volume any flow carries in any period (what 1.0 means), at least a hair above 0. */
export const peakVolume = (data: FlowMapData): number =>
  Math.max(1e-9, ...data.flows.flatMap((f) => (f.series ?? []).filter((v): v is number => v !== null)))

/**
 * A flow's reading at a continuous period p (0 … P−1): volume and coverage,
 * each linearly interpolated between the periods either side. A period with
 * no data reads the flow's TYPICAL volume (the mean of its known periods)
 * at coverage 0 — the conjectured level, drawn ghosted. Pure.
 */
export const seriesAt = (series: readonly (number | null)[], p: number): { volume: number; coverage: number } => {
  const n = series.length
  if (n === 0) return { volume: 0, coverage: 1 }
  const known = series.filter((v): v is number => v !== null)
  const typical = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0
  const at = (i: number) => {
    const v = series[Math.min(n - 1, Math.max(0, i))]
    return v === null || v === undefined ? { volume: typical, coverage: 0 } : { volume: v, coverage: 1 }
  }
  const q = Math.min(n - 1, Math.max(0, p))
  const i = Math.floor(q)
  const u = q - i
  const a = at(i)
  const b = at(i + 1)
  return { volume: a.volume + (b.volume - a.volume) * u, coverage: a.coverage + (b.coverage - a.coverage) * u }
}

/**
 * Particle j of a stream is shown when its place in the golden-ratio
 * sequence falls under the density — so ANY density thins the stream
 * evenly, and changing density fades particles in and out one by one
 * rather than sliding the rest. Returns its visibility in [0, 1]. Pure.
 */
export const thinning = (j: number, density: number, soft = 0.04): number => {
  // Exact at the ends: nothing moved shows nothing; full shows everything.
  if (density <= 0) return 0
  if (density >= 1) return 1
  // Half a step in, so no particle sits on rank 0.
  const rank = ((j + 0.5) * 0.6180339887498949) % 1
  const x = (density - rank) / soft
  return x <= -0.5 ? 0 : x >= 0.5 ? 1 : x + 0.5
}
