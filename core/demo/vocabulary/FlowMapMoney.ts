/**
 * FlowMapMoney.ts — A DreamWeaving
 *
 * "Every material flow in the value chain comes with the inverse money
 * flow" (David, 2026-10-13). The mock year again, now priced: each row's
 * volume at a price per unit, so every flow also carries the money that
 * came back for it. The map shows value; then both at once — material one
 * way, coins the other, in paired lanes down each channel; then money
 * alone; and back. One intercompany flow is unpriced: its money lane is
 * conjecture, ghosted. The year runs underneath it all.
 *
 * Generic mock data — no organisation's numbers or prices.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { FlowMap, MOCK_FLOWMAP } from "../../vocabulary/FlowMap/FlowMap"
import { flowTable, parseCSV, toRows } from "../../vocabulary/FlowMap/table"
import { MONTHS, YEAR } from "./FlowMapTime"

/** Price per tonne, in k€, by stage — and one flow left unpriced. */
const PRICE: Record<string, number> = { raw: 0.9, semi: 2.6, finished: 5.4 }
const UNPRICED = "G→H"

const CSV = [
  "from,to,stage,period,volume,unit,price,currency",
  ...YEAR.flatMap(([from, to, stage, v]) =>
    v.flatMap((x, i) => {
      if (x === null) return []
      const priced = `${from}→${to}` !== UNPRICED
      return [`${from},${to},${stage},${MONTHS[i]},${x},t,${priced ? PRICE[stage] : ""},${priced ? "k€" : ""}`]
    }),
  ),
].join("\n")

const DATA = flowTable(
  toRows(parseCSV(CSV)),
  { ...MOCK_FLOWMAP, stages: MOCK_FLOWMAP.stages.map((s) => ({ ...s, certainty: 1 })), flows: [] },
  { periods: MONTHS },
)

export class FlowMapMoneyDream extends Dream {
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
    // The year runs slowly underneath; value → both → money → both → value.
    this.play(
      together(
        m.time.by(24, { easing: "linear" }),
        m.period.to(MONTHS.length - 1, { easing: "linear" }),
        [m.money.to(0.5), 0.1, 0.2],
        [m.money.to(1), 0.38, 0.48],
        [m.money.to(0.5), 0.66, 0.76],
        [m.money.to(0), 0.88, 0.97],
      ),
      24,
    )
    this.flowing(1.5)
  }
}

if (import.meta.main) render(FlowMapMoneyDream)
