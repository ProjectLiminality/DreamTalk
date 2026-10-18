import { expect, test } from "bun:test"
import { rekey, toggle } from "../src/automaton"
import { scalar } from "../src/params"

test("rekey: a symbol joining a larger machine takes its free keys, drops what it has, walks only where seen", () => {
  const gate = { seen: true, own: true }
  const open = toggle("open", scalar(0), { key: "o" })
  const labels = toggle("labels", scalar(0), { key: "l" })
  const glow = toggle("glow", scalar(0), { when: () => gate.own })
  const r = rekey({ axes: [open, labels, glow] }, { open: "7", labels: null }, () => gate.seen)
  expect(r.axes.map((a) => [a.id, a.key])).toEqual([["open", "7"], ["glow", undefined]])
  expect(r.axes[0]!.positions).toBe(open.positions) // the same axis otherwise
  expect(r.axes.map((a) => a.when!())).toEqual([true, true])
  gate.own = false
  expect(r.axes[1]!.when!()).toBe(false) // its own when still holds
  gate.own = true
  gate.seen = false
  expect(r.axes.map((a) => a.when!())).toEqual([false, false]) // and only where seen
})
