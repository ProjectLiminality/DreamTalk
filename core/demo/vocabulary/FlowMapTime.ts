/**
 * FlowMapTime.ts — A DreamWeaving
 *
 * The value flow map driven by DATA OVER TIME. A plain monthly table —
 * from, to, stage, period, volume — goes through the FlowMap's importer
 * (parseCSV → toRows → flowTable) exactly as a real export would. Then the
 * year runs: flows thicken and thin with their volume, particles thin out
 * one by one as volume falls and fill in as it rises, two flows APPEAR
 * (their months before were explicit zeros: data saying nothing moved), and
 * the months with no data at all ghost their flow into conjecture until the
 * data returns. Midway the map turns into its stage stack and back.
 *
 * Generic mock data — no organisation's numbers.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { FlowMap, MOCK_FLOWMAP } from "../../vocabulary/FlowMap/FlowMap"
import { flowTable, parseCSV, toRows } from "../../vocabulary/FlowMap/table"

const MONTHS = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`)
const _ = null

/** The mock year: one row per flow, its volume per month (null: no data that month). */
const YEAR: [string, string, string, (number | null)[]][] = [
  ["S1", "A", "raw", [80, 85, 90, 95, 100, 110, 120, 125, 130, 135, 140, 150]],
  ["S2", "B", "raw", [120, 115, 110, 100, 95, 90, 80, 70, 60, 55, 50, 45]],
  ["S3", "G", "raw", [_, _, _, 60, 65, 70, _, _, 75, 80, 85, 90]],
  ["A", "D", "semi", [70, 72, 75, 80, 85, 92, 100, 104, 110, 115, 120, 128]],
  ["B", "E", "semi", [100, 96, 92, 85, 80, 74, 66, 58, 50, 46, 42, 38]],
  ["C", "F", "semi", [0, 0, 0, 0, 10, 30, 50, 70, 90, 100, 110, 120]],
  ["G", "H", "semi", [50, 50, 52, 50, 48, 50, 52, 54, 52, 50, 50, 52]],
  ["D", "K1", "finished", [60, 62, 66, 70, 75, 80, 88, 95, 100, 106, 112, 120]],
  ["E", "K2", "finished", [90, 86, 80, 75, 70, 64, 58, 52, 48, 44, 42, 40]],
  ["F", "K2", "finished", [0, 0, 0, 0, 0, 10, 25, 45, 60, 80, 95, 110]],
  ["H", "K3", "finished", [45, 46, 44, 45, 47, 46, _, _, 48, 47, 46, 48]],
]

/** The table as a CSV export would have it. */
const CSV = [
  "from,to,stage,period,volume,unit",
  ...YEAR.flatMap(([from, to, stage, v]) =>
    v.flatMap((x, i) => (x === null ? [] : [`${from},${to},${stage},${MONTHS[i]},${x},t`])),
  ),
].join("\n")

/** The mock map's entities and stages, its flows replaced by the table's. Here every stage is data. */
const DATA = flowTable(
  toRows(parseCSV(CSV)),
  { ...MOCK_FLOWMAP, stages: MOCK_FLOWMAP.stages.map((s) => ({ ...s, certainty: 1 })), flows: [] },
  { periods: MONTHS },
)

export class FlowMapTimeDream extends Dream {
  map = new FlowMap({ radius: 300, data: DATA, grain: 1, seenBy: () => this.observer })

  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.map.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const m = this.map
    const o = this.observer
    o.orthographic.value = o.orthographic.defaultValue = true
    o.zoom.value = o.zoom.defaultValue = 1023 / (1300 * (16 / 9))
    this.stage(m)
    this.flowing(2.5, Create(m))
    this.flowing(2, ...m.stages.map((s) => s.shown.to(1)))
    this.flowing(1)
    // The year runs — linearly, month after month — and midway the map
    // turns into its stage stack and lays flat again.
    this.flowing(
      26,
      m.period.to(MONTHS.length - 1, { easing: "linear" }),
      ...([[m.expand.to(1), 0.32, 0.45], [m.expand.to(0), 0.78, 0.9]] as [Anim, number, number][]).map(
        ([a, s, e]) => restaged(a, s, e),
      ),
    )
    this.flowing(2)
  }
}

/** An anim windowed to [s, e] of its clip. */
const restaged = (a: Anim, s: number, e: number): Anim => together([a, s, e])

if (import.meta.main) render(FlowMapTimeDream)
